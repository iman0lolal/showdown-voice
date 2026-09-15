# Roadmap

Plataformas: **iOS primero**. Chrome extension después. **Android cancelado.**

La web actual es harness de desarrollo, no el producto.

- [x] Fase 0 — investigación Showdown / ToS / protocolo
- [x] Fase 1 — Battle Core (estado, parser, fixtures, tests)
- [x] Fase 2 — protocolo Showdown (websocket helpers, login parse, `/choose`, reconexión, `\|updatesearch\|`)
- [x] Fase 3 — voice engine (parser ES/EN, narrador, sesión)
- [x] Fase 4 — action + confirmation (`validateAndChoose`, `requireConfirm` fijo)
- [x] Fase 5 — **iOS feasibility + architecture** (`docs/IOS.md`, `docs/CHROME.md`)
- [ ] Fase 6 — iOS MVP (SwiftUI, audio, websocket, START VOICE BATTLE → auto-join)
- [ ] Fase 7 — prueba real: iPhone + Showdown + AirPods + Voice Battle (pantalla bloqueada)
- [ ] Fase 8 — Chrome extension, solo si iOS funciona

`requireConfirm = true` no se relaja. Ver `docs/SHOWDOWN-COMPLIANCE.md`.

## Fase 5 — resultado

La experiencia soñada es **viable como app nativa que es cliente de Showdown**. No es viable como PWA ni controlando Safari. Auto-join sin escribir Battle ID: misma cuenta con nombre + `|updatesearch|.games`. Detalle y matriz: `docs/IOS.md`.

No se ha escrito código nativo iOS ni la extensión. Eso es Fase 6 / 8.
