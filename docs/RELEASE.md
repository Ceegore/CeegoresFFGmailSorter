# Release – Inbox Sender Organizer

This document describes how to build, sign, and ship the extension. The full
process is governed by `docs/PRODUCT_SPEC.md` chapters 33, 34, 62, 68.

## Versioning

- Product version (`package.json` + `public/manifest.json`): semver, currently
  `1.0.0`. Manifest and package versions must be identical; the build aborts
  otherwise.
- Adapter version: `GMAIL_ADAPTER_VERSION` in the adapter; bumped on any Gmail
  detection change.
- Spec version: `2.1.0 FINAL`, locked by `docs/SPEC_SHA256.txt`.

## Build (clean room)

```bash
git clone -- "$REPOSITORY_URL" giso-release
cd giso-release
git checkout --detach "$RELEASE_TAG"
node --version    # expected v24.18.0
npm --version     # expected 11.16.0
npm ci
npx playwright install --with-deps firefox
npm run release:check   # = npm ci && npm run verify && npm run package
git status --porcelain  # must be empty
```

Expected outputs in `artifacts/release/`: the extension archive, `source.zip`,
and `SHA256SUMS.txt`. Two builds from the same commit must produce identical
file trees and per-file SHA-256 hashes (ZIP timestamps may differ).

## Verify gate

`npm run verify` runs: format check, lint, strict typecheck, unit + integration
tests with coverage, build, no-network scan, manifest contract check, dist
layout check, `web-ext lint --warnings-as-errors`, Playwright mock-E2E, and
`npm audit --audit-level=high`.

## Human-only gates (Phases 11–12)

The agent prepares but does **not** execute:

1. **Live-Gmail acceptance matrix** (spec §66) with a dedicated test account.
2. **AMO submission**: sign-in, upload, answer reviewer questions, archive the
   signed XPI, re-check the permission prompt on the signed package.
3. **Privacy/legal sign-off** and **PRIV-AMO-01** against the current Mozilla
   taxonomy immediately before submission.

## Known limitations to accept before release

See `docs/KNOWN_LIMITATIONS.md`. Reviewer must explicitly accept each item.
