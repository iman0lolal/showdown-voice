# Fase 0 — Investigación (comprobado)

Fuentes: `smogon/pokemon-showdown` PROTOCOL.md + SIM-PROTOCOL.md, `pokemon-showdown-client` WEB-API.md, [pokemonshowdown.com/rules](https://pokemonshowdown.com/rules), cliente Android no oficial de Majeur.

## Pokémon Showdown

**No hay API REST de combates en vivo.** El canal es el websocket:

- `wss://sim3.psim.us/showdown/websocket`
- `ws://sim3.psim.us:8000/showdown/websocket`

Cliente → servidor: `ROOMID|TEXT`  
Servidor → cliente: `>ROOMID` + líneas `|TYPE|data`

Login:

1. `|challstr|CHALLSTR`
2. POST `https://play.pokemonshowdown.com/api/login` (`name`, `pass`, `challstr`)
3. Cuerpo `]` + JSON con `assertion`
4. `|trn USERNAME,0,ASSERTION`

Decisiones (`sim/SIM-PROTOCOL.md`):

```
/choose move earthquake
/choose move earthquake terastallize
/choose move earthquake mega
/choose move earthquake zmove
/choose move earthquake max
/choose switch 2
```

`|request|{json}` es **privado** (HP exactos, PP, item, moveset). Los replays públicos no lo incluyen. Por eso hay un fixture sintético (Garchomp vs Rotom-Wash) además del replay real `gen9ou-2681491500`.

WEB-API.md del cliente oficial cubre ladder, replays y datos del sitio. **No** sustituye el websocket para una batalla en curso.

### Librerías / clientes existentes

PROTOCOL.md lista implementaciones de referencia, no un SDK REST:

- Cliente oficial HTML5: `smogon/pokemon-showdown-client`
- Cliente Android Kotlin: `MajeurAndroid/Android-Unofficial-Showdown-Client`
- Bots de chat (Node, Ruby, Lua, Perl)

`@pkmn/protocol` / `@pkmn/client` existen en el ecosistema pkmn. Voxdown no las usa: el parser es pequeño, testeable y en TypeScript plano.

### Web vs PWA vs app

`play.pokemonshowdown.com` es la app. En móvil es esa misma web (PWA). No hay app oficial de Apple/Google que sea *el* Showdown. El cliente Kotlin de Majeur es no oficial y es el precedente de “ser el cliente”, no de clicar la PWA.

## Qué camino tomar

| Método | Estado | Acciones | Pantalla bloqueada | Riesgo |
|---|---|---|---|---|
| Websocket propio | Fiable | `/choose` | Android nativo sí | El correcto |
| DOM / Accessibility sobre la PWA | Frágil | Clics | Casi nulo | Parece bot de inputs |
| OCR | Peor | Clics | No | Peor |
| Controlar la PWA oficial desde otra app | iOS: imposible | — | No | — |

**Conclusión:** hay que *ser* un cliente de Showdown. No hay que automatizar la UI oficial.

## Android (prioridad)

Viable con **Foreground Service** `microphone` + websocket persistente + `SpeechRecognizer` / TTS / `MediaSession`.

Accessibility Service para pulsar botones de la PWA **no** es el diseño. Con pantalla off el árbol de accesibilidad de otra app no es un canal de batalla.

API 34+: `FOREGROUND_SERVICE_MICROPHONE`. No uses `dataSync` como tapadera de una batalla de 20 minutos.

Este entorno **no** compila APK. Fase 5 queda documentada, no fingida.

## iOS (el teléfono actual)

- Una app **no** puede controlar Safari ni la PWA de Showdown.
- STT en PWA muere al bloquear (Safari suspende el micrófono).
- Siri / App Intents no hacen clic en otra app.
- Una app nativa propia sí puede: `UIBackgroundModes = audio` + `AVAudioSession` + Speech + websocket propio.

PWA en iPhone = pantalla encendida + auriculares. No prometas bloqueo.

## Voz

En el preview web: Web Speech API (Chrome / Safari con limitaciones). En nativo: APIs del SO. Bluetooth/auriculares van por la sesión de audio, no por un protocolo aparte.

Si STT es ambiguo: preguntar. Nunca `/choose` a ciegas.

## ToS / bots

[Reglas](https://pokemonshowdown.com/rules): “No cheating” = no explotar bugs, no farmear contra ti mismo, no hacerse pasar por staff. **No** prohíben clientes no oficiales. PROTOCOL.md los lista.

Staff ha dicho en público que la gente puede escribir bots y subir ladder: un bot es una cuenta que habla el protocolo. Eso **no** es un permiso para hacer trampas, y no es el producto que pediste.

Línea que sigue este repo:

| | |
|---|---|
| Interfaz de voz: tú eliges, él envía `/choose` | Diseño |
| Análisis / recomendación | Sí; no ejecuta |
| Cliente no oficial | El camino documentado |
| Bot que decide y juega solo | Fuera de alcance (`requireConfirm`) |
| OCR / clics en la web oficial | No |

## Arquitectura resultante

```
Showdown websocket
    → parser de protocolo
    → BattleEngine (estado)
    → VoiceSession (narra, escucha, confirma)
    → validateAndChoose
    → ROOMID|/choose …
```

Capa de reglas / IA debajo de la sesión. Nunca llama a `onExecute` por su cuenta.
