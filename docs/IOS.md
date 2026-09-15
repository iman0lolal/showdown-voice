# iOS — viabilidad y arquitectura (Fase 5)

Fecha: 2026-09-15. Investigado contra documentación de Apple (AVAudioSession, Speech, SpeechAnalyzer iOS 26, UIBackgroundModes), PROTOCOL.md de Showdown y el código del servidor (`User` / `Connection`).

**No hay código nativo iOS en este repo todavía.** Este documento es el veredicto. No se ocultan límites.

## Veredicto en una frase

**Sí se puede** la experiencia “Showdown en Safari → abrir Voice Battle → START → AirPods → bloquear → jugar por voz”, **si Voice Battle es un cliente nativo del protocolo** (no un overlay de Safari) y se aceptan las condiciones de iOS listadas abajo.

La PWA / Safari **no** puede ser esa experiencia.

---

## La pregunta concreta

> ¿Puede conseguirse esto en un iPhone?
>
> Showdown en Safari + nuestra app + auriculares + pantalla bloqueada + WebSocket de Showdown + voz bidireccional

| Pieza | ¿Sí? | Qué lo impide o lo permite |
|---|---|---|
| Showdown en Safari (empezar Random Battle) | Sí | Es el cliente oficial. No lo tocamos. |
| Nuestra app como cliente paralelo | Sí | Showdown permite varias `Connection` por el mismo `User`. |
| Detectar la batalla activa **sin escribir el ID** | Sí, con cuenta con nombre | Tras `/trn`, el servidor envía `\|updatesearch\|{games:{roomid:title}}`. Filtramos `battle-*` y hacemos `/join`. |
| Autodetectar un **invitado** de Safari | **No** | El guest de Safari no es el mismo userid que un guest de nuestra app. Las cookies de Safari no se comparten con la app. |
| Hablar con Safari / leer su pestaña | **No** | iOS no da IPC hacia Safari. No hace falta: el protocolo basta. |
| OCR / taps / Accessibility sobre Showdown | **No, y no se usará** | Imposible de forma fiable + huele a bot de inputs. |
| AirPods (TTS + micrófono) | Sí | `AVAudioSession` `.playAndRecord` + `.allowBluetooth`. |
| Voz bidireccional (STT + TTS) | Sí | Speech / SpeechAnalyzer + `AVSpeechSynthesizer`. |
| WebSocket con pantalla bloqueada | Sí, **si** el proceso no se suspende | No hay background mode de red. Lo que mantiene vivo el proceso es el audio. |
| Micrófono con pantalla bloqueada | Sí, **si** la sesión de audio se activó en primer plano | Apple: *Your audio continues … with the screen locked* (`playAndRecord`) **y** `UIBackgroundModes=audio`. |
| Empezar a escuchar **ya** con el teléfono bloqueado | **No** | Hay que pulsar START en primer plano. Después se bloquea. |
| Conversación continua 15–20 min bloqueado | **Parcial** | Viable si el audio no se para. Riesgo: iOS SIGKILL ~50s si la sesión no es “audio de verdad”; STT de servidor corta a ~60s por request. Mitigaciones abajo. |
| Siri como el asistente del combate | **No** | App Intents puede *lanzar* “Start Voice Battle”. No sostiene el turno a turno. |
| Live Activities | Cosmético | HP en lock screen. No entra voz. |
| PWA Safari con pantalla bloqueada | **No** | Safari suspende micrófono y suele matar el socket. |

---

## Qué iOS no permite (y no vamos a fingir)

1. **Controlar Safari.** Ni Accessibility global, ni taps, ni leer `play.pokemonshowdown.com` desde otra app.
2. **Compartir cookies de Safari** con nuestra app (`WKWebView` tiene su propio almacén). Login propio, misma cuenta.
3. **STT/WebSocket en una PWA bloqueada.**
4. **Siri / Shortcuts / App Intents como bucle de combate.** Un intent es un disparo (“abre Voice Battle”). No es “Terremoto / ¿Confirmas? / Sí”.
5. **Activar `playAndRecord` ya en background.** Apple: activar la sesión **en foreground**. Foros 2026: grabación + lock sin eso → SIGKILL ~50s aunque `backgroundTimeRemaining` mienta.
6. **Un único `SFSpeechRecognizer` (servidor) de 15 minutos.** Apple documenta ~1 minuto por request y ~1000 requests/hora/dispositivo. Hay que reciclar la task o usar on-device / SpeechAnalyzer.

Ninguno de esos puntos bloquea el producto **si somos el cliente**.

---

## Cómo detectamos la batalla (sin ID)

Showdown (`PROTOCOL.md`):

```
|updatesearch|JSON
JSON.searching  → formatos que estás buscando
JSON.games      → { roomid: title } o null
```

Se envía al login y cada vez que cambia una búsqueda o una partida. Incluye juegos no-Pokémon (Mafia). Filtramos `battle-*`.

```
Safari (cuenta NOMBRE)          Voice Battle (misma cuenta)
        │                                │
        │  empieza Random Battle         │
        │                                │  START VOICE BATTLE
        │                                │  /trn
        │                                │← |updatesearch|{games:{battle-…: "A vs B"}}
        │                                │  /join battle-…
        │                                │← log + |request|
        └──────── mismo User ────────────┘
                 (varias Connection)
```

El core ya parsea esto: `parseUpdateSearch` / `planVoiceBattleJoin`.

### Alternativas, en orden

| # | Método | ¿Escribe ID? | Cuándo |
|---|---|---|---|
| 1 | Misma cuenta + `\|updatesearch\|.games` | No | Camino principal |
| 2 | La app misma hace `/search gen9randombattle` | No | Si no hay batalla activa |
| 3 | Share Sheet / pegar URL `…/battle-…` | No (comparte) | Fallback si (1) falla |
| 4 | Universal Link / `radiodown://join/…` | No | Si un día hay dominio |
| 5 | Escribir Battle ID | Sí | Último recurso. No es la UX. |

**Invitados:** un guest de Safari (`Guest 12345`) no es el guest de la app. Auto-join exige **cuenta con nombre**.

No hace falta Universal Link para el MVP. El protocolo basta.

---

## Audio, bloqueo, auriculares

Contrato mínimo:

```
Info.plist
  UIBackgroundModes = [audio]
  NSMicrophoneUsageDescription
  NSSpeechRecognitionUsageDescription

Foreground, al pulsar START:
  AVAudioSession.setCategory(.playAndRecord,
    mode: .spokenAudio,          // o .voiceChat si hace falta AEC
    options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker])
  setActive(true)
  arrancar AVAudioEngine + STT + TTS
  entonces el usuario puede bloquear
```

- `.allowBluetooth` (HFP) = micrófono de AirPods. Baja un poco la calidad de salida. Es lo que queremos: oír y hablar.
- `.allowBluetoothA2DP` solo = salida hi-fi, **sin** mic de AirPods.
- Indicador rojo de micrófono en status bar: no se puede ocultar. Correcto.
- Interrupciones (llamada, Siri): observar `AVAudioSession.interruptionNotification` y reactivar.
- **No CallKit / PushKit VoIP.** Eso es para teléfono. Review de Apple y abuso. Uso personal sideload no lo necesita; tampoco lo pongas “para mantener el proceso”.

### STT

| API | iOS | Límite de sesión | On-device | Encaje |
|---|---|---|---|---|
| `SFSpeechAudioBufferRecognitionRequest` (servidor) | 10+ | ~60 s | no | Reciclar task cada ~50 s |
| idem `requiresOnDeviceRecognition = true` | 13+ | más holgado | sí | Mejor para batalla; locales limitados (es-ES suele estar) |
| `SpeechAnalyzer` + `SpeechTranscriber` | **26+** | pensado para long-form | sí | Preferido si el iPhone está en iOS 26 |

Workaround iOS 18–25: al terminar una utterance (o a los 50 s) se cierra la task y se abre otra. Hueco ~100–300 ms. Aceptable en un juego por turnos: no estás dictando un ensayo, dices “Terremoto”.

TTS: `AVSpeechSynthesizer` sigue en background con la misma sesión.

### WebSocket

`URLSessionWebSocketTask` vive mientras vive el proceso. Keepalive de Showdown: `|/cmd ping` cada ~20 s (ya en el core). Si iOS suspende, el socket muere → `reconnectCommands` + `restoreFromLog` (ya implementado).

---

## Siri, App Intents, Shortcuts, Live Activities

| API | Útil para Voice Battle | No útil para |
|---|---|---|
| App Intents / Shortcuts / Action Button / Control Center | “Hey Siri, Start Voice Battle” → abre la app en foreground y dispara el mismo START | El diálogo Terremoto / Confirmas / Sí |
| Live Activities / Dynamic Island | HP, turno, “escuchando…” en lock screen | Micrófono, websocket |
| Interactive widgets | Stop / abrir app | STT |

Siri **no** sustituye nuestro TTS/STT. Es un lanzador.

---

## Arquitectura iOS mínima

```
                    ┌── Safari / Showdown     (tú empiezas la partida)
                    │
Showdown Server ────┤
                    │
                    └── Voice Battle.app
                          SwiftUI  ── UI: START / STOP / HP
                          Audio    ── AVAudioSession + Speech + TTS
                          Net      ── URLSessionWebSocketTask
                          Core     ── parser / state / voice / choose
                                      (mismo contrato que TypeScript)
```

La app **no** incrusta `play.pokemonshowdown.com`. No WKWebView de Showdown. Protocolo puro.

Pantallas:

1. Idle: `VOICE BATTLE` + `START VOICE BATTLE` (login Keychain).
2. Active: HP, “Listening…”, STOP. El resto es voz.
3. Lock: audio + (opcional) Live Activity.

### TypeScript vs Swift en iOS

El core TS cabe en ~3–4k líneas. Opciones:

| Opción | Fiabilidad | Simplicidad | Latencia voz | Mantenimiento |
|---|---|---|---|---|
| Swift port del core | Alta | Alta en iOS | Mejor (sin puente) | Dos cores; TS sigue siendo el oráculo de tests |
| JavaScriptCore con el bundle TS | Media | Atajo de 1–2 sprints | Puente STT→JS→TTS | Un core, peor debug, hilos de audio vs JS |
| WASM | Innecesaria | Peor | Similar a JSC | No aporta en un parser de texto |

**Decisión: no forzar TypeScript en iOS.**

- iOS: SwiftUI + Swift (audio, red, UI) y **port Swift del core** (parser, engine, choose, voice session). Los 47 tests TS se portan 1:1. El repo TS sigue siendo el oráculo y alimenta Chrome / harness.
- Atajo aceptable si se quiere una primera batalla esta semana: JSC. No es el destino.
- Chrome extension: TypeScript directo. Cero port.

Prioridad del usuario: fiabilidad > simplicidad > mantenimiento > experiencia de voz > latencia. Eso apunta a Swift nativo, no a WASM.

---

## Condiciones que cambian la experiencia ideal

La escena soñada funciona con estos matices (no son “soluciones falsas”; son el producto real):

1. **Cuenta con nombre**, la misma en Safari y en Voice Battle. Guest ≠ auto-join.
2. **START se pulsa con la pantalla encendida.** Luego AirPods y lock.
3. **No pulsar en Safari** durante la batalla (dos clientes, un `/choose`; el primero gana).
4. **iOS 26** da STT continuo de verdad. iOS 18–25 recicla el recognizer cada ~50 s.
5. Si iOS mata el proceso (llamada larga, audio interrumpido y no reactivado): reconexión, no milagro. TTS de “reconectando”.
6. Sideload personal (`developer` / AltStore / etc.) evita la review de App Store del background `audio`. Si un día se publica, hay que justificar “accesibilidad / cliente de voz”, no “escucha oculta”.

Nada de eso exige OCR, ni controlar Safari, ni relajar `requireConfirm`.

---

## Qué no se implementa ahora

- Proyecto Xcode / SwiftUI
- App Intents
- Live Activities
- Extensión de Safari iOS

Siguiente fase de código iOS = Fase 6, cuando el usuario diga que el veredicto vale.
