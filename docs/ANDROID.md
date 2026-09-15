# Android (Fase 5)

Este preview no compila APK. El entorno no tiene Android SDK. La vía nativa, cuando se implemente, es **ser el cliente de Showdown**, no pulsar la web oficial.

## Por qué nativo y no Accessibility

| Enfoque | Pantalla bloqueada | Fiabilidad | Riesgo de “bot de inputs” |
|---|---|---|---|
| Cliente websocket propio + Foreground Service | Viable | Alta | Bajo (tú confirmas) |
| Accessibility Service clicando play.pokemonshowdown.com | Casi nulo con pantalla off | Frágil | Alto |
| OCR | No | Peor | Alto |

## Servicio

Foreground Service con tipos:

- `microphone` (`FOREGROUND_SERVICE_MICROPHONE` + `RECORD_AUDIO`)
- Conexión persistente del websocket (no uses `dataSync` para una batalla larga en API 35+)

`SpeechRecognizer`, `TextToSpeech`, `MediaSession` para auriculares. El motor TypeScript de `src/lib/radiodown` es el contrato: portarlo a Kotlin o llamarlo vía JS.

## Confirmación

El servicio **no** llama a `/choose` hasta `sí` / `hazlo`. Una recomendación nunca se envía sola.

No modificar [PokeCoachAI](https://github.com/iman0lolal/PokeCoachAI): es otro producto.
