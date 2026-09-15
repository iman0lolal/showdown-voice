# Radiodown core (portable)

This folder is the Battle Core. It must stay free of:

- DOM / `window` / `document`
- React
- Web Speech API
- Node `http` / `ws` constructors

```
radiodown/
├── battle-state     → battle/  types.ts
├── showdown-protocol→ protocol/ showdown/
├── action-engine    → action/choose.ts action/targets.ts
├── validation       → action/choose.ts + lifecycle.ts
├── voice-command-model → voice/
└── analysis         → recommend/   (data only, never /choose)
```

App shells:

```
                ┌── Web demo (React + Web Speech)
Battle Core ────┼── Android (Phase 5, not in this tree)
                └── iOS (later)
```

The websocket lives in the shell (`src/lib/showdown-browser.ts` for web).
The core consumes protocol strings and emits `/choose` strings.
