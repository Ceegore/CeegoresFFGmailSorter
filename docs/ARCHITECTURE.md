# Architecture – Inbox Sender Organizer

Content-script-centric Firefox MV3 extension (spec §10). All Gmail DOM
operations run in the isolated content-script context. The background script
holds no Gmail data and no business logic.

## Component map

```
Firefox Toolbar Action
        │
        ▼
Background (src/background/index.ts)
        │ browser.tabs.sendMessage("TOGGLE_OVERLAY" | "SHOW_OVERLAY")
        ▼
Content Script (src/content/*)
  ├── bootstrap          lifetime, listeners, route cleanup
  ├── Overlay UI         Shadow-DOM shell + views (src/ui/*)
  ├── App Store          pure reducer state machine (src/app/*)
  ├── Controller         effect orchestration, owns the AbortController
  ├── Inbox Analyzer     read-only analysis (src/analyzer/*)
  ├── Gmail Controllers  search / selection / move / completion (src/gmail/*)
  ├── DOM Adapter        multi-signal detection, no business decisions
  ├── Privacy            source-allowlisted diagnostics + redaction
  └── Settings           storage.local: position/diagnostics/auto-open only
```

## Layering rules

- `src/shared/*` — framework-agnostic primitives (Result, errors, types, time,
  dom, abort). No Gmail knowledge, no UI.
- `src/analyzer/*` — read-only analysis. Never clicks.
- `src/gmail/*` — Gmail DOM detection + native-control operation. Holds no
  state; returns Result/Detection values.
- `src/app/*` — pure state machine + store + the controller that orchestrates
  effects and owns at most one AbortController.
- `src/ui/*` — Shadow-DOM overlay. Reads state, dispatches events; never touches
  Gmail DOM directly.
- `src/privacy/*`, `src/settings/*` — privacy + persistence.

## Hard invariants

- No `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`/
  `document.cookie`/remote `import()`/`eval`/`new Function` (lint-enforced +
  `verify:no-network` build scan).
- Only `storage` permission + `https://mail.google.com/*` host permission.
- No persistent sender/query/subject data; `storage.local` holds settings only.
- No automatic label selection; the user always chooses the destination.
- Every automatic click is preceded by re-resolve + score/delta/interactability
  checks and followed by a postcondition (spec §4, §16.1, §51.6).

## State machine

See `src/app/state-machine.ts` for the full transition table (spec §17.1).
Illegal transitions are logged as `GISO-STATE-ILLEGAL-001` and never mutate the
workflow or trigger a DOM click.
