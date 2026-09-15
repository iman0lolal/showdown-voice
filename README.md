# Voxdown

Cliente de voz para [Pokémon Showdown](https://pokemonshowdown.com). Tú decides cada turno. Voxdown narra el estado, valida la jugada y solo envía `/choose` cuando confirmas.

No es un bot. No juega ladder solo. No hace clic en la web oficial.

Repositorio: https://github.com/iman0lolal/showdown-voice

[PokeCoachAI](https://github.com/iman0lolal/PokeCoachAI) es **otro** proyecto (Team Preview de Pokémon Champions). Este repo no lo toca.

## Conclusión técnica

Esto es viable **como cliente del protocolo público de Showdown**, no como automatización de la UI oficial.

- El estado de la batalla llega por websocket (`wss://sim3.psim.us/showdown/websocket`). No hay API REST de combates en vivo.
- Las acciones se envían como `ROOMID|/choose move earthquake` (con `terastallize`, `mega`, `max`, `zmove` si aplica).
- Un iPhone **no** puede controlar la PWA oficial con la pantalla bloqueada.
- Android sí puede mantener micrófono + websocket en un Foreground Service nativo. Eso es Fase 5, no este núcleo TypeScript.

Detalles: [`docs/PROTOCOL.md`](docs/PROTOCOL.md), [`docs/ANDROID.md`](docs/ANDROID.md), [`docs/IOS.md`](docs/IOS.md).

## Núcleo

```
Pokémon Showdown (websocket)
        ↓
Battle Event Parser  →  Battle State
        ↓
Voice Session (narrar → escuchar → confirmar)
        ↓
Action Validator  →  /choose …
        ↓
Pokémon Showdown
```

La IA es opcional y **nunca ejecuta**.

## Tests

```bash
npm test
```

Usa Node 22 (`--experimental-strip-types`). Fixtures: replay público `gen9ou-2681491500` y una batalla sintética Garchomp vs Rotom-Wash (los replays no traen `|request|`).

## Probar una partida real (honesto)

1. Abre la cabina web de este proyecto (preview) o clona y ejecuta los tests del núcleo.
2. En **En vivo**: Conectar → Login / Invitado → Buscar Random Battle.
3. Cuando narre el turno, di o escribe el movimiento (`Terremoto`, `usa Protect`, `cambio a Gholdengo`).
4. Confirma con `sí`. Solo entonces se envía `/choose`.
5. En iPhone: deja la pantalla encendida. El bloqueo mata STT en Safari.
6. No uses esto para jugar ladder automáticamente. Eso es un bot y puede acabar en sanción.

## Licencia

MIT. Pokémon y Pokémon Showdown son marcas de sus respectivos dueños. Cliente no oficial.
