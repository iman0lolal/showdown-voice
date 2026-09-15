# Auditoría del núcleo (2026-09-15)

No se ha empezado Android. Objetivo: core portable y seguro.

## A. Estado

| Área | Veredicto |
|---|---|
| Core | **READY** (con límites de singles documentados) |
| Showdown integration | **READY** para Random Battle singles; servidor descubrible |
| Voice | **READY** (STT/TTS son del shell web, no del core) |
| Action execution | **READY** (`/choose` solo tras confirmación + `|request|`) |
| Mobile architecture | **READY** para portar: el core no usa DOM/React/Web Speech |

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

## C. Límites que quedan (no bugs)

- Doubles no se *juega*: el engine no elige dos acciones separadas por coma. El tipo de target ya está.
- Choice lock se ve como `disabled: true` en `|request|`; no hay un flag aparte.
- EVs/IVs/naturaleza del rival no existen en el protocolo público; no se inventan.
- Ping de aplicación: `|/cmd ping`. El ping WebSocket lo hace el runtime.
- El login HTTP sigue en el shell (hace falta `fetch`). El core solo parsea la respuesta.
- Typecheck/lint/build del monorepo App Builder incluyen código de plataforma; el contrato de CI del repo GitHub es `npm test` del core.

## D. Tests

Ver el mensaje de la auditoría / `npm test`.

## E. Fase 5

El core se puede incrustar en Android (JS engine o port Kotlin del mismo contrato). No implementado aquí.
