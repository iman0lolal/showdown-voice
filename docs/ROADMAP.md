# Roadmap

Plataformas: **iOS primero**. Chrome extension después. **Android cancelado.**

La web actual es harness de desarrollo, no el producto.

- [x] Fase 0 — investigación Showdown / ToS / protocolo
- [x] Fase 1 — Battle Core (estado, parser, fixtures, tests)
- [x] Fase 2 — protocolo Showdown (websocket helpers, login parse, `/choose`, reconexión, `\|updatesearch\|`)
- [x] Fase 3 — voice engine (parser ES/EN, narrador, sesión)
- [x] Fase 4 — action + confirmation (`validateAndChoose`, `requireConfirm` fijo)
- [x] Fase 5 — iOS feasibility (`docs/IOS.md`, `docs/CHROME.md`)
- [x] Fase 6a — **especificación del MVP iOS** (`docs/IOS-MVP-SPEC.md`). Sin SwiftUI todavía
- [ ] Fase 6b — `IMPLEMENT IOS MVP` (fuentes Swift, port del core, audio, START)
- [ ] Fase 7 — prueba real: iPhone + Safari + AirPods + lock + ≥ 10 turnos
- [ ] Fase 8 — Chrome extension, solo si iOS pasa Fase 7

`requireConfirm = true` no se relaja. Ver `docs/SHOWDOWN-COMPLIANCE.md`.

Contrato del MVP: [`docs/IOS-MVP-SPEC.md`](IOS-MVP-SPEC.md).

No se escribe la app iOS hasta la orden explícita **IMPLEMENT IOS MVP**.
