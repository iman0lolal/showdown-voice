# Radiodown

Cliente de voz para [Pokémon Showdown](https://pokemonshowdown.com). Tú decides cada turno. Radiodown narra el estado, valida la jugada y solo envía `/choose` cuando confirmas.

No es un bot. No juega ladder solo. No hace clic en la web oficial.

**Producto:** app nativa iPhone. **Secundario:** extensión de Chrome. **No:** Android, ni una web como producto. Esta demo web es el harness de desarrollo.

Repositorio: https://github.com/iman0lolal/showdown-voice

[PokeCoachAI](https://github.com/iman0lolal/PokeCoachAI) es **otro** proyecto (Team Preview de Pokémon Champions). Este repo no lo toca.

## Conclusión iOS (Fase 5)

La experiencia soñada — Showdown en Safari, START VOICE BATTLE, AirPods, pantalla bloqueada, voz bidireccional — **es viable** si Voice Battle es un **cliente nativo del protocolo**. No es viable como PWA ni controlando Safari.

Auto-join sin escribir Battle ID: misma **cuenta con nombre** + `|updatesearch|.games` + `/join`. Un invitado de Safari no se puede detectar.

Matriz honesta: [`docs/IOS.md`](docs/IOS.md). Chrome: [`docs/CHROME.md`](docs/CHROME.md). Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md).

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

La IA / heurística es opcional y **nunca ejecuta**. `requireConfirm` es invariante.

## Requisitos

- Node 22+ (`--experimental-strip-types`)
- Sin dependencias npm para el núcleo

```bash
git clone https://github.com/iman0lolal/showdown-voice.git
cd showdown-voice
npm test
npm run demo
```

No hay `.env`. El login de Showdown usa usuario/contraseña en memoria. No se suben secretos a este repo.

## Estructura

```
showdown-voice/
├── src/lib/radiodown/     # Battle Core portable
├── examples/demo.ts
├── docs/                  # IOS, CHROME, PROTOCOL, COMPLIANCE, AUDIT
└── .github/workflows/test.yml
```

## Tests

```bash
npm test
```

Un movimiento ilegal no produce `/choose`. “Terremoto” no se envía hasta “sí”.

## ToS / bots

Showdown permite clientes no oficiales. Un **bot que decide y juega ladder solo** es otra cosa.

| Uso | ¿Aceptable aquí? |
|---|---|
| Cliente de voz: tú eliges, él envía `/choose` | Sí, por diseño |
| Lector de estado + recomendación | Sí, no ejecuta |
| Accessibility / OCR sobre la web oficial | No |
| Jugar ladder sin confirmación humana | No. `requireConfirm` es obligatorio |

## Licencia

MIT. Pokémon y Pokémon Showdown son marcas de sus respectivos dueños. Cliente no oficial.
