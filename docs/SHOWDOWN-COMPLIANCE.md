# Showdown compliance

Sources: [pokemonshowdown.com/rules](https://pokemonshowdown.com/rules), `smogon/pokemon-showdown` PROTOCOL.md, official client list of unofficial clients, staff comments that user-made ladder bots exist.

## What this project is

A **voice accessibility client**. It:

1. Connects to the public Showdown websocket as a custom client (the documented way).
2. Narrates `|request|` and public battle events.
3. Parses a spoken/typed command into a typed action.
4. Validates the action against **that** `|request|`.
5. Asks for an explicit confirmation (`sí` / `hazlo`).
6. Only then sends `ROOMID|/choose …`.

`requireConfirm = true` is a **security invariant**, not a user preference. There is no auto-battle flag in the core. Do not add one.

## What this project is not

| Do not add | Why |
|---|---|
| Auto-play / “just win the match” | Turns the client into a ladder bot |
| LLM → `/choose` | The model must never hold the websocket |
| OCR / Accessibility clicks on play.pokemonshowdown.com | Input bot, fragile, against the spirit of a custom client |
| Reading the opponent’s unrevealed moves/item/EVs | Information the player would not have |
| Skipping confirmation because STT “sounded sure” | False positives |

## Accessibility client vs bot

| | Client (this) | Bot |
|---|---|---|
| Who decides the turn | The human, after a prompt | The program |
| `/choose` trigger | Explicit confirm | Timer / policy / LLM |
| Information used | `|request|` + public log | Same protocol, no extra omniscience if written honestly |

Custom clients are listed in PROTOCOL.md (including Majeur’s Android client). Staff have said users may run scripts. That is **not** a reason for Radiodown to play unattended.

## Human confirmation

Pipeline:

```
heuristic or LLM
    → Recommendation (data)
        → voice / UI command
            → validateAndChoose(|request|)
                → ACTION_PENDING_CONFIRMATION
                    → user "sí"
                        → /choose
```

A recommendation object has **no** `choose` field and no transport handle.

## Risks

Playing rated ladder while a script confirms for you is still automation. If you disable the confirm gate in a fork, you own that.

## Information boundaries

| Source | Examples | Allowed in BattleState |
|---|---|---|
| `|request|` (private, our side) | PP, item, ability, tera type, legal moves | Yes, our Pokémon only |
| Public log | `|move|`, `|switch|`, `|-terastallize|`, faint, weather | Yes, marked revealed |
| Guess / dex / analysis | “Garchomp usually runs Earthquake” | Recommend layer only, never as `known moves` |
| Simulator omniscience | Opponent EVs, unrevealed item | Never |
