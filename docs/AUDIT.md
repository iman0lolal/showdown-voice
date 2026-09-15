# Auditoría del núcleo (2026-09-15)

No se ha empezado Android (cancelado). iOS: spec en `docs/IOS-MVP-SPEC.md`, sin SwiftUI todavía.

## A. Estado

| Área | Veredicto |
|---|---|
| Core | **READY** (singles; carrera Safari/`\|error\|` cubierta) |
| Showdown integration | **READY** Random Battle + auto-join `\|updatesearch\|` |
| Voice | **READY** (STT/TTS son del shell) |
| Action execution | **READY** (`/choose` solo tras confirmación + `\|request\|`) |
| iOS | **SPEC READY** — no hay binario. Port Swift pendiente de `IMPLEMENT IOS MVP` |

## B. Cerrado en el núcleo

`requireConfirm` fijo, `/choose` vs `|request|`, targets doubles (encoding only), hedges de voz, discovery `config.js`, reconexión, `|error|` / `|-activate|`, `revealed`, `lifecycle.ts`, recomendación data-only, `planVoiceBattleJoin`.

**Carrera dual-client:** si Safari envía primero, `|error| already been made` no deja `lastSentRqid` clavado. Sesión vuelve a ser jugable con el `|request|` vivo.

## C. Límites (no bugs)

- Doubles no se juega. Choice lock = `disabled` en `|request|`.
- Login HTTP en el shell. Core solo parsea.
- iOS: el socket no tiene garantía Apple aparte del proceso de audio.

## D. Tests

`npm test` del glob `src/lib/radiodown/**/*.test.ts`.

## E. Siguiente

No escribir Swift hasta `IMPLEMENT IOS MVP`. Contrato: `docs/IOS-MVP-SPEC.md`.
