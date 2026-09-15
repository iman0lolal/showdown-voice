# Radiodown core (portable)

This folder is the Battle Core. It must stay free of:

- DOM / `window` / `document`
- React
- Web Speech API
- Node `http` / `ws` constructors
- UIKit / AVFoundation

```
radiodown/
├── battle-state          → battle/  types.ts
├── showdown-protocol     → protocol/ showdown/
│                            including |updatesearch| auto-join
├── action-engine         → action/choose.ts action/targets.ts
├── validation            → action/choose.ts + lifecycle.ts
├── voice-command-model   → voice/
└── analysis              → recommend/   (data only, never /choose)
```

App shells (platforms implement mic / STT / TTS / net only):

```
                ┌── iOS app (Swift port of this core; TS is the test oracle)
Battle Core ────┼── Chrome extension (TS direct, Fase 8)
                └── CLI / web harness (not the product)
```

Android is cancelled.

iOS decision (see `docs/IOS-MVP-SPEC.md`): **port this core to Swift**. Not JavaScriptCore, not WASM. This TypeScript tree remains CI oracle + Chrome.

The websocket lives in the shell (`src/lib/showdown-browser.ts` for the web harness).
The core consumes protocol strings and emits `/choose` strings.

`requireConfirm` is not configurable.

Safari / Voice Battle race: `|error|` clears the sent rqid. The server log is the truth.
