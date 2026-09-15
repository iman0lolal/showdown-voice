# Fase 0 — Investigación (comprobado)

Fuentes: `smogon/pokemon-showdown` PROTOCOL.md + SIM-PROTOCOL.md, `pokemon-showdown-client` WEB-API.md, [pokemonshowdown.com/rules](https://pokemonshowdown.com/rules), cliente Android no oficial de Majeur (precedente de custom client, no de plataforma).

Actualización 2026-09-15: Android ya no es objetivo. iOS + Chrome extension. Ver `docs/IOS.md` y `docs/CHROME.md`.

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

Un User admite varias Connection simultáneas (Safari + app).

`|updatesearch|JSON` lista `searching` y `games: {roomid: title}`. Es el auto-join de START VOICE BATTLE.

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
- Cliente Android Kotlin: `MajeurAndroid/Android-Unofficial-Showdown-Client` (precedente de “ser el cliente”)
- Bots de chat (Node, Ruby, Lua, Perl)

`@pkmn/protocol` / `@pkmn/client` existen en el ecosistema pkmn. Radiodown no las usa: el parser es pequeño, testeable y en TypeScript plano.

### Web vs PWA vs app

`play.pokemonshowdown.com` es la app. En móvil es esa misma web (PWA). No hay app oficial de Apple. El camino es **ser** un segundo cliente, no clicar la PWA.

## Qué camino tomar

| Método | Estado | Acciones | Pantalla bloqueada | Riesgo |
|---|---|---|---|---|
| Websocket propio (iOS nativo) | Fiable | `/choose` | Sí, con audio session | El correcto |
| Chrome extension + offscreen | Fiable en desktop | `/choose` | N/A | Fase 8 |
| DOM / Accessibility sobre la PWA | Frágil | Clics | Casi nulo | Parece bot de inputs |
| OCR | Peor | Clics | No | Peor |
| Controlar Safari desde otra app | iOS: imposible | — | No | — |

**Conclusión:** hay que *ser* un cliente de Showdown. No hay que automatizar la UI oficial.

## iOS (plataforma principal)

Viable con app nativa: `UIBackgroundModes=audio` + `AVAudioSession.playAndRecord` activada en foreground, Speech / SpeechAnalyzer, websocket propio, misma cuenta + `|updatesearch|`.

PWA en iPhone = pantalla encendida. No prometas bloqueo.

Matriz completa: `docs/IOS.md`.

## Chrome extension (secundaria)

MV3 + offscreen (`USER_MEDIA` + `AUDIO_PLAYBACK`) + content script que lee `/battle-*`. Core TS directo. `docs/CHROME.md`.

## Android (cancelado)

Documentado históricamente. No se implementa. `docs/ANDROID.md`.
