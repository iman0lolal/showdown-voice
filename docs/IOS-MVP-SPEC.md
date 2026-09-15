# iOS MVP — especificación definitiva

Fecha: 2026-09-15.  
Estado: **contrato**. No hay código nativo iOS en este repo hasta la orden `IMPLEMENT IOS MVP`.

Producto: **Voice Battle** (Radiodown en iPhone).  
No es un overlay de Safari. No es OCR. No es un bot.  
`requireConfirm = true` es invariante: no existe flag para apagarlo.

Prueba que esta spec tiene que hacer posible:

```
iPhone → Safari → Showdown → Random Battle
      → Voice Battle → START VOICE BATTLE
      → auto-join → AirPods → bloquear
      → asiste habla → tú respondes → confirmas → /choose
      → ≥ 10 turnos
```

Documentos relacionados: `docs/IOS.md` (viabilidad), `docs/CHROME.md` (Fase 8), `docs/PROTOCOL.md`, `docs/SHOWDOWN-COMPLIANCE.md`.

---

## 1. Arquitectura

```
                 Pokémon Showdown (sim3 / Config.defaultserver)
                            │
                       WebSocket
                            │
           ┌────────────────┴────────────────┐
           │                                 │
        Safari                         Voice Battle
    cliente oficial                      iOS app
    (tú empiezas)                            │
                           ┌─────────────────┼─────────────────┐
                           │                 │                 │
                      Battle Core      Voice Engine      UI / Lifecycle
                      (Swift, puro)    (iOS-only)        (SwiftUI)
                           │                 │                 │
                    state / parser      STT / TTS         START screen
                    action / confirm    AVAudioSession    background
                    |updatesearch|      AirPods routes    permissions
```

Tres reglas:

1. **El servidor es la fuente de verdad.** Safari y Voice Battle no se hablan. Ambos son `Connection` del mismo `User`.
2. **Battle Core no importa UIKit, AVFoundation, Speech ni SwiftUI.**
3. **Solo el VoiceController pega Core ↔ audio ↔ socket.** El core emite texto (`speak`, `/choose`). El socket envía bytes. El audio habla y escucha.

### Dónde vive cada pieza

| Pieza | Dónde | Por qué |
|---|---|---|
| Parseo `\|TYPE\|…`, `\|request\|`, `\|updatesearch\|` | **Battle Core (Swift)** | Lógica pura, testeable sin iPhone |
| `BattleState`, engine de eventos | **Battle Core** | Igual |
| `validateAndChoose`, targets, rqid | **Battle Core** | Igual |
| Parser de voz ES/EN, narrador, confirmación | **Battle Core** | El “sí” no depende de Apple Speech |
| `planVoiceBattleJoin` | **Battle Core** | Auto-join es protocolo, no UI |
| `reconnectCommands` / `restoreFromLog` | **Battle Core** | Contrato de reconexión |
| `URLSessionWebSocketTask`, TLS, keepalive timer | **iOS-only Network** | El core no construye sockets (igual que el TS actual) |
| Login HTTP `api/login` | **iOS-only Network** | `URLSession`. Core solo parsea el JSON |
| Keychain (usuario/clave Showdown) | **iOS-only** | API de plataforma. No inventar cifrado casero |
| `AVAudioSession`, `AVAudioEngine` | **iOS-only VoiceEngine** | |
| STT (`SpeechAnalyzer` / `SFSpeechRecognizer`) | **iOS-only VoiceEngine** | |
| TTS (`AVSpeechSynthesizer`) | **iOS-only VoiceEngine** | |
| Permisos mic / speech, `UIBackgroundModes` | **iOS-only Lifecycle** | |
| SwiftUI: idle / active / error | **iOS-only UI** | Una pantalla + STOP |
| App Intents “Start Voice Battle” | **iOS-only, opcional** | Lanza START. No es la conversación |
| TypeScript `src/lib/radiodown` | **Oráculo + Chrome + harness** | CI. No corre en el iPhone |

`Connection` y `Rooms` en el diagrama del producto significan **el modelo** (comandos `/join`, `/trn`, room id). El transporte WebSocket es iOS-only.

---

## 2. TypeScript → Swift — decisión

Cuatro opciones reales:

| | A. Port Swift del core | B. Paquete compartido (KMP / C) | C. JavaScriptCore + bundle TS | D. WASM |
|---|---|---|---|---|
| Rendimiento voz (STT → parse → TTS) | Nativo, 0 puente | Extra FFI | Puente JS en cada utterance | Puente WASM |
| Complejidad iOS | Media (port ~3–4k líneas) | Alta (tooling que no usamos en Chrome) | Baja al inicio, alta al debuggear hilos de audio | Alta, 0 beneficio en un parser de texto |
| Mantenimiento | Dos cores. TS = oráculo; tests 1:1 | Un core, peor encaje Chrome | Un core, peor encaje Swift Concurrency | Un core, peor tooling |
| Debugging | LLDB, Swift Testing | Mixto | “¿Falló JSC o el audio?” | Mixto |
| APIs iOS (audio, WS, Keychain) | Directas en el shell | Siguen en Swift | Siguen en Swift; el core no las ve igual | Igual |
| WebSocket | `URLSessionWebSocketTask` en el shell | Igual | Igual | Igual |
| Audio | Fuera del core | Fuera del core | Fuera del core. JSC y el audio thread no se mezclan bien | Igual |
| Tamaño del binario | Pequeño (texto) | Mayor runtime | JSC ya está en iOS; el bundle TS es chico | Runtime WASM |
| Estabilidad en background | Máxima: menos piezas moviéndose cuando iOS aprieta | Media | Media: GC / JSC en proceso que iOS puede matar | Media |
| Instalar en dispositivo | Un target Xcode | Más | Un target + copiar JS | Un target + copiar wasm |

**Decisión: opción A — port Swift del Battle Core.**

No es por gusto de lenguaje. El core cabe en unos pocos miles de líneas de parser/estado. El riesgo de iOS no es el parser: es audio + lifecycle. Meter JSC o WASM en ese camino añade modos de fallo que no arreglan el WebSocket ni los AirPods.

Condiciones del port:

- El TypeScript **no se borra**. Sigue siendo el oráculo (`npm test`) y el core de Chrome (Fase 8).
- Cada test TS del camino MVP se porta 1:1 a Swift Testing.
- Si un test Swift y uno TS divergen, se corrige el port, no se “simplifica” iOS.
- Recomendador / doubles / IA **no entran en el port del MVP**. El TS los conserva.

Atajo explícitamente rechazado para el MVP: JavaScriptCore. Si en algún momento se necesitara una demo en 48 h, JSC es el plan B documentado, no el producto.

---

## 3. Battle Core (iOS)

Paquete Swift, **cero SwiftUI**. Equivalente al TS en `src/lib/radiodown/`.

```
BattleCore
├── Protocol        parse line / payload, SockJS a/o/h ignorados
├── Showdown        challstr, trn, login JSON, join, ping, updatesearch
├── Rooms           roomId, isBattleRoomId, planVoiceBattleJoin
├── BattleState     HP, moves revelados, request, ended, rqid
├── EventParser     engine de |move| |switch| |request| |error| |win|…
├── RequestParser   |request| JSON → ChoiceRequest (fuente de acciones legales)
├── Action          BattleAction (move / switch / tera)
├── ActionValidator validateAndChoose → /choose o rechazo
├── Confirmation    pending + requireConfirm = true (no es un Bool configurable)
└── BattleLifecycle ConnectionPhase × BattlePhase, canSendChoose, canProposeAction
```

También en el core, porque es texto:

- `VoiceParser` (utterance → VoiceIntent)
- `Narrator` (estado → frase)
- `VoiceSession` (hear / ingest / restoreFromLog)

El core **no** conoce:

- UI, SwiftUI, colores, botones
- micrófono, TTS, AirPods
- `URLSession`, certificados, Keychain
- timers de iOS (el shell arma el ping)

Contrato de I/O:

```
ingest(protocolText) → SpeakEvent?
hear(utterance)      → SpeakEvent  { speak, execute?: "/choose …" }
```

El shell, si `execute != nil`, manda `ROOMID|execute` por el socket. Nunca al revés: el socket no llama a `/choose` por su cuenta.

Subset del MVP 1 (lo que se porta ya):

- Singles, Gen 9 Random Battle
- Movimiento, cambio, tera si `|request|` lo permite
- Confirmación, cancelar, “situación”, “opciones”, “repite”
- `|error|` (carrera con Safari)
- Reconexión por log

Fuera del MVP 1 (existe en TS, no se porta todavía):

- Doubles jugable, recomendador, capa Grok, team preview complejo, ladder UI

---

## 4. Voice Engine

Interfaz del shell. El Battle Core **no** la importa. El `VoiceController` sí.

```
protocol VoiceEngine {
  func configureAndActivate() async throws   // SOLO en foreground
  func listen() async
  func stopListening()
  func speak(_ text: String) async
  func cancelSpeech()
  var  audioState: AudioState { get }
}

enum AudioState {
  case inactive
  case ready          // sesión activa, engine corriendo
  case speaking
  case listening
  case interrupted
  case routeChanged
}
```

Callbacks hacia el controller (no hacia el core):

```
onUtterance(String)        // hipótesis final de STT
onAudioInterrupted(begin)
onAudioInterrupted(end)
onRouteChange(AirPods | builtIn | speaker | other)
```

Implementación MVP:

- `AVAudioSession` `.playAndRecord`, mode `.spokenAudio`, options `[.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]`
- TTS: `AVSpeechSynthesizer`
- STT: `SpeechAnalyzer` + `SpeechTranscriber` si iOS 26+; si no, `SFSpeechAudioBufferRecognitionRequest` on-device, reciclando la task ~cada 50 s
- Input: `AVAudioEngine` tap → buffers al recognizer

Una sola implementación en el MVP. El protocolo existe para no casar el controller a Apple Speech el día que cambie.

Flujo:

```
Battle Core  →  SpeakEvent
     ↓
VoiceController  (máquina de estados de voz)
     ↓
VoiceEngine.speak / .listen
```

El core nunca llama a `listen()`. El controller decide cuándo, según la fase.

---

## 5. Máquina de estados de voz

Tres máquinas, no una. Mezclarlas es como se rompe el background.

### 5.1 Conexión (`ConnectionPhase`)

`DISCONNECTED → CONNECTING → CONNECTED → AUTHENTICATING → IDLE | SEARCHING | JOINING | RECONNECTING | ERROR`

### 5.2 Batalla (`BattlePhase`) — ya en `lifecycle.ts`

`IDLE → BATTLE_FOUND → WAITING_FOR_REQUEST → AWAITING_USER_ACTION → CLARIFYING | ACTION_PENDING_CONFIRMATION → EXECUTING → WAITING_FOR_RESULT → (loop) | BATTLE_FINISHED`

`/choose` **solo** desde `ACTION_PENDING_CONFIRMATION`.

### 5.3 Voz (esta spec)

```
IDLE
  ↓ START (foreground)
STARTING            audio + permisos
  ↓
CONNECTING          websocket + challstr
  ↓
AUTHENTICATING      login + /trn
  ↓
DISCOVERING         |updatesearch|
  ↓
JOINING             /join battle-*   (o pregunta 0 / N batallas)
  ↓
ANNOUNCING          "Voice Battle conectado." + estado
  ↓
READY_TO_LOCK       "Puedes bloquear el iPhone."
  ↓
LISTENING           STT on
  ↓ utterance
COMMAND_DETECTED
  ↓
VALIDATING          validateAndChoose
  ↓ ok
CONFIRMATION_REQUIRED   TTS "X. ¿Confirmas?"
  ↓
LISTENING_CONFIRMATION
  ↓ "sí"
EXECUTING           onExecute → socket
  ↓
WAITING_RESULT
  ↓ |request| nuevo
ANNOUNCING  → LISTENING   (loop)
```

Errores (no son “el mismo estado con un string”):

| Estado | Qué hace el controller |
|---|---|
| `CONNECTION_LOST` | TTS breve, `RECONNECTING`, nuevo socket, `/trn`, `/join`, `restoreFromLog`. Comportamiento **normal**, no excepcional |
| `AUDIO_INTERRUPTED` | stop listen/speak, marcar interrupted; al `end` reactivar sesión y volver a LISTENING o WAITING_RESULT |
| `STT_ERROR` | reciclar recognizer; si falla 3 veces, TTS “no te oigo” y reintentar |
| `BATTLE_ENDED` | narrar ganador, desactivar listen, sesión de audio puede parar |
| `INVALID_COMMAND` | narrar opciones, volver a LISTENING |
| `AMBIGUOUS_COMMAND` | preguntar, CLARIFYING, LISTENING |
| `APP_SUSPENDED` | no hay trabajo posible; al volver, tratar como CONNECTION_LOST |
| `CHOICE_REJECTED` | `\|error\|`: limpiar rqid enviado, sincronizar con `\|request\|` vivo o esperar resolución |

Transiciones prohibidas:

- `LISTENING` mientras `speaking` (eco de TTS → falso “Terremoto”)
- `EXECUTING` sin pasar por confirmación
- `STARTING.configureAndActivate` desde background / lock

---

## 6. UX de START

Una pantalla.

```
VOICE BATTLE
Not connected
[ START VOICE BATTLE ]
```

Primera vez (o Keychain vacío): usuario + contraseña Showdown, “guardar en el llavero”, luego el mismo botón. No es un flujo de 6 pantallas.

Al pulsar START, **en foreground**, en este orden:

1. Pedir micrófono y speech si hace falta. Si niega → error visible, no conectar.
2. `VoiceEngine.configureAndActivate()` — **aquí** se arma `AVAudioSession` y arranca `AVAudioEngine`.
3. Abrir WebSocket Showdown. Esperar `|challstr|`.
4. POST `api/login` con usuario/clave del Keychain + challstr. Parsear assertion.
5. `/trn USER,0,ASSERTION`.
6. Esperar `|updatesearch|` (timeout ~2.5 s).
7. `planVoiceBattleJoin`:
   - 1 `battle-*` → `/join`
   - 0 → TTS *“No encuentro ninguna batalla activa. ¿Quieres buscar una Random Battle?”* y LISTENING (sí/no). **No** buscar sola.
   - >1 → TTS *“He encontrado N batallas.”* y enumerar títulos. Esperar elección por voz o tap.
   - ya `searching` → *“Ya estás buscando. Esperando rival.”*
8. Recibir `>battle-…`, log, `|request|`.
9. TTS: **“Voice Battle conectado.”**
10. Narrar el estado (quién, HP, opciones).
11. TTS: **“Puedes bloquear el iPhone.”**
12. LISTENING.

STOP (visible en activo): cierra socket, para audio, vuelve a IDLE. No envía `/choose`.

App Intents / Action Button, si se añaden después: equivalen a pulsar START, y **exigen** que iOS traiga la app a foreground (Apple no deja activar `playAndRecord` desde lock).

---

## 7. Background / bloqueo — evaluación precisa

No: “sí, funciona con pantalla bloqueada”.  
Cuatro columnas.

### Garantizado por las APIs de Apple

- Con `UIBackgroundModes=audio` y categoría `playAndRecord` activada **en foreground**, la reproducción **continúa** con el switch Silent y con la pantalla bloqueada (documentación de `playAndRecord`).
- `AVSpeechSynthesizer` es reproducción. Mientras la sesión siga activa, el TTS puede hablar bloqueado.
- El indicador rojo de micrófono si hay input. No se oculta.
- Permisos `NSMicrophoneUsageDescription` / `NSSpeechRecognitionUsageDescription`: sin ellos el sistema corta.

### Permitido, sujeto al lifecycle del proceso

- Que el **proceso no se suspenda** mientras la sesión de audio está activa y el audio unit **está corriendo**. Si el engine se para, iOS puede suspender. No hay un “background networking” que lo sustituya.
- Captura de micrófono bloqueado **si** el tap del engine sigue vivo (misma condición).
- STT sobre esos buffers. Apple no publica un contrato “Speech framework + lock screen”. En la práctica funciona **mientras el proceso vive**. Eso es lifecycle, no API.
- `URLSessionWebSocketTask`: **no tiene background mode**. Vive si vive el proceso. El socket **no** está garantizado por Apple aparte del audio. Diseño: **corte de socket = reconectar**, no “el WS es eterno”.

### Experimental (puede ir bien; no es criterio de “API sí”)

- 10–20 minutos bloqueados con huecos largos del rival (30–150 s sin TTS). Mitigación de MVP: **no parar `AVAudioEngine`** en `WAITING_RESULT`; el tap sigue, el recognizer ignora comandos de movimiento (acepta “situación”). Eso es audio de verdad, no un silencio fingido.
- Reciclar `SFSpeechRecognizer` cada ~50 s en iOS 18–25 sin perder un “sí” de una sílaba.
- Volver de una llamada de 2 minutos y reactivar `playAndRecord` sin que el usuario desbloquee. A menudo hay que volver a foreground. El MVP **narra** “audio interrumpido; desbloquea si no me oyes” en vez de fingir magia.
- Tone de keep-alive inaudible. No se usa: es truco de review y no hace el socket más legal.

### No posible

- Activar `AVAudioSession` / micrófono **ya** con el teléfono bloqueado.
- Prometer el WebSocket independiente del proceso.
- PWA Safari + lock (Safari mata mic y casi siempre el socket).
- Controlar Safari, leer su DOM, compartir sus cookies.
- Siri como bucle Terremoto / Confirmas / Sí.
- Ocultar que estamos grabando.

### Contrato de START → lock

```
START (foreground)
  → setCategory playAndRecord + setActive
  → arrancar AVAudioEngine (tap ON) + TTS + STT
  → websocket + login + join
  → "Voice Battle conectado."
  → "Puedes bloquear el iPhone."
  → el usuario bloquea
  → TTS y listen siguen SI el engine no se para
  → si el socket muere: CONNECTION_LOST → reconnect + rejoin + restore
```

Reconexión (normal, no “si algo sale mal”):

```
socket interrupted / ping timeout
  → ConnectionPhase = RECONNECTING
  → TTS “Reconectando.”
  → socket nuevo → |challstr| → /trn → /join battle-…
  → restoreFromLog (Showdown reenvía el log + |request|)
  → volver a ANNOUNCING / LISTENING según |request|
```

Keepalive Showdown: `|/cmd ping` ~20 s. Eso no mantiene el proceso; solo el server.

---

## 8. AirPods

Ruta deseada: micrófono **y** salida en AirPods.

| Evento | Manejo |
|---|---|
| AirPods conectados al START | `allowBluetooth` → HFP. Mic + voice. Calidad de música peor; es correcto |
| Conectar AirPods a mitad | `routeChangeNotification` → reconfigurar input/output, TTS “auriculares conectados”, seguir |
| Desconectar | ruta a altavoz / mic built-in, TTS “sigo por el iPhone”, **no** cerrar la batalla |
| Usuario cambia a altavoz | aceptar la ruta; no pelear |
| Llamada (`interruption began`) | `AUDIO_INTERRUPTED`, stop listen/speak. No enviar `/choose` |
| Fin de llamada (`interruption ended`, `shouldResume`) | `setActive(true)`, rearrancar engine, TTS “sigo aquí”, LISTENING o WAITING_RESULT |
| `shouldResume = false` | TTS al volver a foreground; no reactivar a ciegas en background |
| Siri / Control Center audio | misma vía de interrupción |

No CallKit. No PushKit VoIP. No “fingir una llamada” para vivir en background.

---

## 9. Speech-to-text — modo del MVP

Objetivo de producto: conversacional, **sin pulsar un botón cada turno**.

Opciones:

| Modo | Fiabilidad lock | Falsos positivos | Encaje |
|---|---|---|---|
| Push-to-talk | Alta si hay botón | Baja | En lock **no hay botón**. AirPods stem es extra y no todos lo usan |
| Wake phrase (“oye radio”) | Media | Media (STT de wake es otro modelo) | Complejidad que el MVP no necesita |
| Escucha continua 100 % | Media | Alta (eco, TV, “sí” accidental) | Peligroso sin confirmación **y** sin gate de fase |
| **Híbrido gated-conversational** | Alta para un juego por turnos | Baja: solo oye en LISTENING / LISTENING_CONFIRMATION, nunca mientras habla | **MVP** |

Reglas:

1. Tras terminar TTS → `listen()`.
2. Durante TTS → `stopListening()` (anti-eco).
3. En `WAITING_RESULT` el engine sigue, pero el parser **no** acepta movimientos. Acepta “situación” / “repite”.
4. Confirmación humana = segundo factor contra un STT inventado.
5. “creo que terremoto” sigue pidiendo confirmación (ya en el parser).
6. Timeout de silencio en LISTENING: seguir escuchando, no auto-enviar. A los ~20 s un beep/TTS mínimo “te escucho” solo si no hubo audio (opcional; no spam).
7. Fallback no-MVP: tap en pantalla (solo unlocked) = PTT. No es el camino del lock.

iOS 26: `SpeechAnalyzer` (long-form, on-device).  
iOS 18–25: on-device `SFSpeechRecognizer`, reciclar ~50 s. Hueco 100–300 ms, irrelevante en un turno.

Idioma: `es-ES` primero. Aliases de movimientos ya están en el core.

---

## 10. Siri

Siri / App Intents / Action Button / Control Center: **lanzadores**.

Permitido: “Hey Siri, Start Voice Battle” → abre la app en foreground → el mismo START.

Prohibido como interfaz de combate: no hay intent “Earthquake”. La conversación es TTS/STT de Voice Battle.

---

## 11. Detección automática de batalla

Único botón importante: **START VOICE BATTLE**.

```
login
  → |updatesearch|
  → battle-* rooms
  → 0 / 1 / N
```

| Resultado | Voz |
|---|---|
| 0 | “No encuentro ninguna batalla activa. ¿Quieres buscar una Random Battle?” → sí = `/utm null` + `/search gen9randombattle` |
| 1 | `/join` automático. “Conectado a {título}.” |
| >1 | “He encontrado N batallas.” Enumerar. Esperar “la primera” / título / tap |
| `searching` no vacío, 0 games | “Ya estás buscando. Esperando rival.” |

Fallbacks, por orden, **no** en la pantalla inicial:

2. Share Sheet / pegar URL `play.pokemonshowdown.com/battle-…`
3. Escribir Battle ID (último recurso; no se muestra hasta que 1 y 2 fallen)

Invitado de Safari: **no auto-join**. Hay que cuenta con nombre.

---

## 12. Mismo usuario / autenticación

Safari y Voice Battle **deben** ser el mismo nick de Showdown. No hay canal de cookies.

Showdown no tiene OAuth. El mecanismo documentado es:

1. `|challstr|`
2. POST `https://play.pokemonshowdown.com/api/login` (`name`, `pass`, `challstr`)
3. JSON `assertion`
4. `/trn USER,0,ASSERTION`

Almacén: **Keychain** (`kSecClassGenericPassword`, servicio `showdown.radiodown`). Usuario + contraseña. La assertion es de corta vida; no se persiste.

No:

- Keychain casero en UserDefaults
- Reutilizar cookies de Safari (`WKWebView` no las comparte; `SFSafariViewController` no nos da el nick)
- Mandar la clave a un servidor nuestro (no hay backend)

Si el login falla: TTS + texto, no buscar batalla.

---

## 13. Seguridad — confirmación

```
User:        "Earthquake"
Assistant:   "Earthquake. ¿Confirmas?"
User:        "Sí"
Assistant:   "Ejecutando."
             → /choose move earthquake
```

Nunca: STT → `/choose`.  
Nunca: heurística / IA → `/choose`.  
Nunca: un toggle `requireConfirm`. El tipo en Swift es `requireConfirm: Bool = true` con el setter inaccesible, igual que el TS (`readonly requireConfirm: true`).

Cancelar: “no”, “cancelar”, “espera” limpia `pending` y no envía.

---

## 14. Safari vs Voice Battle

```
Showdown Server
   ├── Safari          (Connection A)
   └── Voice Battle    (Connection B)
           mismo User
```

- `|request|` llega a **todas** las conexiones del usuario que están en la sala.
- El primer `/choose` válido gana. El segundo recibe `|error|`.
- Voice Battle **no** lee Safari. Si Safari juega, Voice Battle se entera por el **log público** y por `|error|` / el siguiente `|request|`.

UX: “deja Safari en segundo plano; no pulses movimientos ahí.” Si pulsas, no es corrupción de estado: es la sección 15.

---

## 15. Condición crítica — carrera Safari / Voice Battle

Caso: Safari elige Protect, Voice Battle confirma Terremoto.

```
Safari  → /choose move protect
App     → /choose move earthquake
Server  → |error|[Invalid choice] Can't do anything: Your decision has already been made
        → resolución del turno (Protect) + nuevo |request|
```

Comportamiento obligatorio (ya en el oráculo TS):

1. `|error|` **no** significa “nuestra acción se ejecutó”.
2. Se borra `lastSentRqid` / `lastSentChoose`.
3. Si sigue habiendo `|request|` vivo → `AWAITING_USER_ACTION` y se narra.
4. Si no → `WAITING_RESULT` (“La acción ya estaba enviada. Esperando la resolución.”).
5. Nunca reenviar el `/choose` rechazado.
6. El siguiente turno usa el `|request|` nuevo.

Tests TS: `VoiceSession` “Safari already submitted”. El port Swift los replica.

---

## 16. Chrome (Fase 8, no implementar)

```
Chrome Extension (MV3)
├── content script     URL /battle-*  (auto-detect más fácil que iOS)
├── service worker     orquesta, no audio
├── offscreen          mic + TTS + websocket
├── Battle Core TS     el de este repo, sin port
└── popup              START VOICE BATTLE
```

Mismo `requireConfirm`. No clics en el DOM de Showdown.  
Chrome en iPhone no existe como extensión.  
Detalle: `docs/CHROME.md`. Prioridad: cero hasta que iOS pase el test de 10 turnos.

---

## 17. MVP 1 — recorte

Hace:

```
START
 → audio foreground
 → connect Showdown
 → login Keychain
 → detectar Random Battle activa
 → join
 → leer estado
 → hablar estado
 → escuchar
 → “Earthquake” / “Terremoto”
 → “¿Confirmas?”
 → “Sí”
 → validate
 → /choose
 → siguiente |request|
 → hablar
 → repetir
```

No hace: IA, damage calc, doubles, recomendaciones, OU teambuilder, UI rica, Live Activities, Siri, Share Sheet, invitados, ladder automático, Android.

---

## 18. Criterio de aceptación — test real

iPhone físico, no simulador (el simulador no tiene AirPods ni el mismo background audio).

1. Abrir Safari → play.pokemonshowdown.com → login **misma cuenta**.
2. Buscar Random Battle, que empiece.
3. Abrir Voice Battle.
4. START VOICE BATTLE (pantalla encendida).
5. Oír “Voice Battle conectado” y “Puedes bloquear el iPhone.”
6. Ponerse AirPods si no estaban.
7. Bloquear.
8. Recibir narración del turno.
9. Decir un movimiento legal.
10. Oír la confirmación.
11. Decir “sí”.
12. Ver en Safari (al desbloquear, o en otra sesión) que el turno se resolvió con esa acción — o oír el siguiente estado coherente.
13. Seguir **≥ 10 turnos** con el teléfono bloqueado la mayor parte del tiempo.
14. Un turno a propósito: pulsar en Safari **y** confirmar otra cosa por voz → la app dice que ya estaba enviada y se sincroniza; **no** ejecuta la acción equivocada.
15. Quitar AirPods un turno → sigue por el iPhone. Volver a ponerlos → sigue.
16. Al ganar/perder: narra el fin. No envía más `/choose`.

Si 1–13 se cumplen: **iOS MVP técnicamente validado.**  
14–16 son el mismo hito, no un “v2”.

Fallo conocido aceptable (documentar, no fingir): una llamada telefónica de minutos puede exigir desbloquear para reactivar audio. No bloquea el hito si el caso normal (sin llamada) aguanta 10 turnos.

---

## 19. Estructura del proyecto (cuando se implemente)

No crear esta carpeta hasta `IMPLEMENT IOS MVP`.

```
showdown-voice/
├── src/lib/radiodown/          # oráculo TS (CI)
├── ios/
│   └── VoiceBattle/
│       ├── App/                # @main, Info.plist, capabilities
│       ├── UI/                 # StartScreen, ActiveScreen
│       ├── Audio/              # VoiceEngine + session + interruptions
│       ├── Network/            # ShowdownSocket, LoginClient
│       ├── Core/               # port Swift del Battle Core
│       ├── Voice/              # VoiceController (state machine)
│       └── VoiceBattleTests/   # Swift Testing 1:1 con el oráculo
├── docs/IOS-MVP-SPEC.md        # este archivo
└── docs/IOS.md                 # viabilidad (Fase 5)
```

Capabilities: Background Modes → Audio. No Audio, AirPlay and PiP de vídeo. No Voice over IP.

---

## 20. Tests necesarios (antes y con el port)

Oráculo TS (ya / ampliar):

- Parser, `|request|` → `/choose`, confirmación, cancelar
- `planVoiceBattleJoin` 0 / 1 / N / mafia
- Reconnect restore
- **Carrera Safari:** `|error| already been made` no deja el rqid clavado (añadido)

Swift (Fase 6):

- Los mismos, sin UI
- VoiceController con `VoiceEngine` fake: ANNOUNCING no llama `listen` hasta terminar `speak`
- ShowdownSocket fake: drop → reconnectCommands

Dispositivo (Fase 7): la lista de la sección 18. No se puede automatizar en este entorno.

---

## 21. Limitaciones que el MVP asume (no bugs)

1. Cuenta **con nombre**, la misma en Safari y en la app.
2. START con pantalla **encendida**.
3. El WebSocket sobrevive **porque** el audio mantiene el proceso, no porque Apple garantice red en background.
4. iOS puede matar el proceso; reconectar es el diseño.
5. STT pre-iOS 26 recicla cada ~50 s.
6. No invitados.
7. Singles Random Battle.
8. Este sandbox Linux **no compila** un IPA. La implementación serán fuentes Swift en el repo; hace falta un Mac + Xcode + el iPhone del usuario para el test de la sección 18.

---

## 22. Qué hace falta del usuario para la prueba real

Cuando llegue `IMPLEMENT IOS MVP`, para cerrar el hito hace falta:

| Qué | Para qué |
|---|---|
| iPhone físico + versión de iOS (18 vs 26) | Elegir SpeechAnalyzer vs SFSpeech; el simulador no vale |
| Mac con Xcode | Firmar e instalar. Este entorno no puede hacerlo |
| Apple ID (gratis o Developer) | Sideload. Gratis ≈ 7 días de firma |
| Cuenta Showdown con nombre + contraseña | Auto-join. Nunca se sube al repo |
| AirPods (o auriculares BT con mic) | El test de ruta de audio |
| 15–20 minutos en una Random Battle real | Criterio de 10 turnos |

Sin Mac, se pueden dejar los fuentes listos y un `README` de apertura en Xcode; no se puede mentir un “instálalo desde aquí” en el iPhone.
