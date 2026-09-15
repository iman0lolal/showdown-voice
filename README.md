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

Detalles: [`docs/PROTOCOL.md`](docs/PROTOCOL.md), [`docs/ANDROID.md`](docs/ANDROID.md), [`docs/IOS.md`](docs/IOS.md), [`docs/ROADMAP.md`](docs/ROADMAP.md).

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

La IA / heurística es opcional y **nunca ejecuta**.

## Requisitos

- Node 22+ (`--experimental-strip-types`)
- Sin dependencias npm para el núcleo

```bash
git clone https://github.com/iman0lolal/showdown-voice.git
cd showdown-voice
npm test
npm run demo
```

No hay `.env`. El login de Showdown (cabina web) usa usuario/contraseña en memoria. No se suben secretos a este repo.

## Estructura

```
showdown-voice/
├── src/lib/voxdown/
│   ├── protocol/      # líneas |TYPE|arg  + payloads SockJS
│   ├── battle/        # HP, |request|, motor de estado
│   ├── voice/         # alias ES/EN, parser, narrador, sesión
│   ├── action/        # valida y construye /choose
│   ├── recommend/     # type chart + heurística (no ejecuta)
│   ├── showdown/      # websocket + login helpers
│   └── fixtures/      # replay gen9ou-2681491500 + Garchomp vs Rotom
├── examples/demo.ts   # bucle de voz offline
├── docs/
├── .github/workflows/test.yml
└── package.json
```

## Tests

```bash
npm test
```

27 tests. Un movimiento ilegal no produce `/choose`. “Terremoto” no se envía hasta “sí”.

## ToS / bots

Showdown permite clientes no oficiales. Un **bot que decide y juega ladder solo** es otra cosa y puede acabar en sanción.

| Uso | ¿Aceptable aquí? |
|---|---|
| Cliente de voz: tú eliges, él envía `/choose` | Sí, por diseño |
| Lector de estado + recomendación | Sí, no ejecuta |
| Accessibility / OCR sobre la web oficial | No (frágil y huele a bot de inputs) |
| Jugar ladder sin confirmación humana | No. `requireConfirm` es obligatorio |

## Probar una partida real (honesto)

1. Abre la cabina web (preview de este proyecto) o clona y corre `npm run demo`.
2. En **En vivo**: Conectar → Login / Invitado → Buscar Random Battle.
3. Cuando narre el turno, di o escribe el movimiento (`Terremoto`, `usa Protect`, `cambio a Gholdengo`).
4. Confirma con `sí`. Solo entonces se envía `/choose`.
5. En iPhone: deja la pantalla encendida. El bloqueo mata STT en Safari.
6. No uses esto para jugar ladder automáticamente.

## Licencia

MIT. Pokémon y Pokémon Showdown son marcas de sus respectivos dueños. Cliente no oficial.
