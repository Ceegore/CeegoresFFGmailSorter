# Inbox Sender Organizer

A Firefox (MV3) extension for Gmail Web that groups recurring senders on the
currently loaded inbox page and guides a safe, half-manual move workflow via
Gmail's native UI. The destination label is **always** chosen by the user in
Gmail — the extension never auto-selects or auto-creates a label.

- **No Gmail API, no Google OAuth, no own server.** Pure local DOM integration.
- **No tracking, no analytics, no remote code.** Only `storage` + Gmail host
  permission.
- **German UI; German + English Gmail detection.** Unknown languages fall back
  to manual operation safely.
- **Small non-interactive „made by Ceegore“ credit** in every overlay view.

## Install for development

```bash
npm ci
npm run build        # produces dist/
npm run webext:run   # loads dist/ into a test Firefox profile
```

Open Gmail, click the toolbar icon. Use a **dedicated test account**, never your
primary mailbox (see `docs/KNOWN_LIMITATIONS.md`).

## Scripts

| Script                                        | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `npm run build`                               | IIFE bundle into `dist/`                    |
| `npm test`                                    | unit + integration tests (Vitest)           |
| `npm run test:e2e`                            | mock-Gmail Playwright E2E                   |
| `npm run lint` / `typecheck` / `format:check` | static gates                                |
| `npm run verify`                              | full automated gate chain                   |
| `npm run package`                             | extension archive + source zip + SHA256SUMS |

## Documentation

- `docs/PRODUCT_SPEC.md` — the locked authoritative specification.
- `docs/ARCHITECTURE.md` — component map and layering rules.
- `docs/PRIVACY.md` — data handling and AMO disclosure.
- `docs/DOM_ADAPTER_MAINTENANCE.md` — maintaining Gmail detection.
- `docs/RELEASE.md` — build, sign, ship.
- `docs/KNOWN_LIMITATIONS.md` — accepted V1 limits.
- `DECISIONS.md` — every deviation from the locked spec, with rationale.

## Status

V1 implementation with automated gates green (typecheck, lint, unit/integration
tests, build, web-ext lint). SAFE_MODE is enabled — the extension analyzes the
inbox, groups senders, submits the Gmail search, and then stops for manual
operation. The automated selection/move path is disabled and must not be
enabled until independently regression-tested.

Live-Gmail acceptance (Phase 11) and AMO submission (Phase 12) are human-owned
and not yet completed.
