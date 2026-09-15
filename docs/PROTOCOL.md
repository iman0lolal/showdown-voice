# Protocolo de Pokémon Showdown (comprobado)

No existe una API REST de batallas en vivo. El canal es el websocket documentado por Smogon.

## Conexión

- `wss://sim3.psim.us/showdown/websocket`
- Mensajes cliente → servidor: `ROOMID|TEXT`
- Mensajes servidor → cliente: `>ROOMID` + líneas `|TYPE|data`

## Login

1. El servidor envía `|challstr|CHALLSTR` (`CHALLSTR` contiene `|`)
2. POST `https://play.pokemonshowdown.com/api/login` con `name`, `pass`, `challstr`
3. La respuesta empieza por `]` + JSON
4. Completar con `/trn USERNAME,0,ASSERTION`

## Batalla

Ver `sim/SIM-PROTOCOL.md` en smogon/pokemon-showdown.

- Estado: `|switch|`, `|move|`, `|-damage|`, `|turn|`, `|faint|`, `|-weather|`, `|-sidestart|`, `|-terastallize|`, …
- Decisión: `|request|{json}` (privado; los replays públicos no lo incluyen)
- Respuesta: `/choose move earthquake`, `/choose move earthquake terastallize`, `/choose switch 2`

El motor de Voxdown implementa este contrato. No hay OCR.
