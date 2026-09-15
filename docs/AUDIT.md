# Auditoría del núcleo (2026-09-15)

Android cancelado. iOS es la plataforma. Objetivo: core portable y seguro.

## A. Estado

| Área | Veredicto |
|---|---|
| Core | **READY** (singles documentados) |
| Showdown integration | **READY** Random Battle + auto-join vía `\|updatesearch\|` |
| Voice | **READY** (STT/TTS son del shell, no del core) |
| Action execution | **READY** (`/choose` solo tras confirmación + `|request|`) |
| iOS architecture | **DOCUMENTED** (`docs/IOS.md`). Sin código nativo aún |
| Chrome extension | **DOCUMENTED** (`docs/CHROME.md`). Fase 8 |

## B. Problemas que había (y qué se hizo)

1. `requireConfirm` se podía apagar y auto-enviar. **Cerrado:** el flag es `true` fijo.
2. `/choose` no miraba batalla terminada, rqid ya enviado, ni forced switch con mensaje claro. **Cerrado.**
3. Sin TARGETSPEC para doubles. **Modelo añadido**; singles sigue omitiendo target (correcto).
4. “no, espera” no cancelaba. **Cerrado.**
5. “creo que terremoto” no extraía el movimiento. **Cerrado** (sigue pidiendo confirmación).
6. Servidor hardcodeado a sim3 sin parser de config. **Parser + fallback.**
7. Sin plan de reconexión. **`reconnectCommands` + `restoreFromLog`.** El protocolo no reanuda el socket: re-join.
8. `|error|` y `|-activate|` se ignoraban. **Narrados.**
9. `KnownMove` no marcaba *revealed*. **Campo `revealed`.** El analysis no escribe en el estado.
10. Máquina de estados implícita. **`lifecycle.ts` + `canSendChoose`.**
11. Recomendación era casi una acción. **Objeto de datos + `confidence`; nunca `choose`.**
12. Auto-join de batalla activa. **`parseUpdateSearch` + `planVoiceBattleJoin`.**

## C. Límites que quedan (no bugs)

- Doubles no se *juega*: el engine no elige dos acciones separadas por coma. El tipo de target ya está.
- Choice lock se ve como `disabled: true` en `|request|`; no hay un flag aparte.
- EVs/IVs/naturaleza del rival no existen en el protocolo público; no se inventan.
- Ping de aplicación: `|/cmd ping`. El ping WebSocket lo hace el runtime.
- El login HTTP sigue en el shell (hace falta `fetch`). El core solo parsea la respuesta.
- Invitado de Safari ≠ invitado de Radiodown. Auto-join exige cuenta con nombre.
- Typecheck/lint/build del monorepo App Builder incluyen código de plataforma; el contrato de CI del repo GitHub es `npm test` del core.

## D. Tests

`src/lib/radiodown/**/*.test.ts` (incluye `showdown/search.test.ts`).

## E. Fase 5 / 6

Fase 5 (este documento + `IOS.md`) **no** compila Xcode. Fase 6 es el MVP iOS, cuando el usuario confirme el veredicto.
