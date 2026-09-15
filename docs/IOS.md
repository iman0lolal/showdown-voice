# iOS

El usuario actual usa iPhone. Conclusión honesta:

## Lo que iOS no permite

- Controlar Safari / la PWA oficial de Showdown desde otra app
- STT en una PWA con pantalla bloqueada (Safari suspende el micrófono)
- Accessibility global al estilo Android
- Siri / App Intents como “haz clic en Terremoto dentro de otra app”

## Lo que sí permite una app nativa

- `UIBackgroundModes = audio` + `AVAudioSession` para TTS y grabación continua
- Speech framework mientras la sesión de audio está activa
- Websocket propio mientras el proceso no se suspende (la sesión de audio ayuda)
- El mismo contrato `voxdown`: narrar, confirmar, `/choose`

## PWA en iPhone

Sirve para jugar con la pantalla encendida y auriculares. Al bloquear, espera que el micrófono y a menudo el socket mueran. No prometas lo contrario.

La Fase 5 iOS es una app nativa que **es** el cliente, no un overlay sobre Showdown.
