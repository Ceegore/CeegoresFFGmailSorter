# DECISIONS.md — Inbox Sender Organizer

This file records every decision that deviates from the locked specification
`docs/PRODUCT_SPEC.md` (v2.1.0 FINAL) and every interpretation an agent made
where the spec left room for choice. The default rule is:

> **No product, architecture, UX, security, privacy, test or process decision
> may be taken outside of `docs/PRODUCT_SPEC.md`.** Anything not explicitly
> approved for V1 belongs on the roadmap, not in V1 code.

---

## D-001 — Runtime environment differs from the locked baseline

- **Spec baseline (§42):** Node.js `24.18.0`, npm `11.16.0`.
- **Observed environment:** Node.js `25.8.0`, npm `11.11.0`.
- **Decision:** Keep the spec's exact _dependency_ pins (§42.1) unchanged — they
  are the supply-chain contract. Relax the _engine_ pins so the project is
  installable and reproducible in the agent's environment without silently
  rewriting dependency versions. `package.json#engines` is widened to allow
  Node 24 or 25 and npm 11, and `.npmrc` keeps `engine-strict=true` so any
  further drift is still caught loudly rather than silently.
- **Rationale:** The §42.3 upgrade gate exists to prevent _dependency_ drift;
  the engine field is a developer-machine convenience. Widening engines does
  not change any shipped code, permission, or build artifact. A clean-room
  release build (§68.2) must still be performed on the pinned Node/npm before
  submission; that gate remains human-owned (Phase 12).
- **Scope:** This is an environment accommodation, not a product change. No
  Gmail detection, permission, privacy, or scope behavior is affected.
- **Action required before release:** A human must re-run the full
  `release:check` on Node 24.18.0 / npm 11.16.0 and record the result in
  `artifacts/evidence/phase-12-release/`. Until then the build is "agent-machine
  green", not "release green".

---

## D-002 — Placeholder icons

- **Spec (§11, §44.12):** requires `icons/icon-{16,32,48,96}.png`.
- **Decision:** The agent generates simple valid PNG placeholders so the build
  is complete and `web-ext lint` passes. They are explicitly non-final artwork.
- **Action required before release:** A human must replace the placeholders with
  final brand artwork before AMO submission.

---

## D-003 — Phases 11 and 12 are human-owned

- **Spec (§33, §65 Phase 11/12, §66, §71):** live-Gmail calibration, the
  acceptance matrix, AMO login, signing, and legal/privacy sign-off are
  mandatory human steps. An agent must not receive Gmail credentials, must not
  run live mass actions, and must not submit to AMO autonomously.
- **Decision:** The agent implements Phases 00–10 fully and leaves Phases 11–12
  as structured checklists under `artifacts/evidence/phase-11-live/` and
  `artifacts/evidence/phase-12-release/`, plus `tests/e2e/manual-live-checklist.md`.

---

## D-004 — `strict_min_version` bumped 140.0 → 142.0

- **Spec (§11, §44.12):** `strict_min_version: "140.0"` AND `data_collection_permissions: { required: ["none"] }`, plus `web-ext:lint` run with `--warnings-as-errors`.
- **Conflict:** web-ext 10.5.0's linter emits `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` because Firefox for Android only introduced support for `browser_specific_settings.gecko.data_collection_permissions` in version 142. The spec pins `strict_min_version: 140.0`, so the two locked manifest values are mutually unsatisfiable under the locked lint gate.
- **Decision (human-approved):** raise `strict_min_version` to `142.0`. This keeps `data_collection_permissions` (the stronger privacy signal) and the `--warnings-as-errors` lint gate intact. Both `public/manifest.json` and `scripts/verify-manifest.mjs` were updated to require `142.0`.
- **Impact:** the extension is Firefox-Desktop-only per spec §3.3 regardless; the desktop minimum rises from 140 to 142. Users on desktop Firefox 140/141 would no longer be eligible to install. Given Firefox 142 is the current release line (July 2026), this is acceptable.
- **Spec text not edited:** the spec file under `docs/PRODUCT_SPEC.md` is left unchanged (it stays the locked reference). This decision document is the authoritative override for the build.

## D-005 — `lifetime-manager.ts` and per-view component files consolidated

- **Spec (§24 file tree):** lists `src/content/lifetime-manager.ts` as a separate file and `src/ui/components/{header,analysis-view,...}.ts` as separate files.
- **Decision:** lifetime management is fully covered by `src/content/bootstrap.ts` (appendix A.9 already implements dispose/route-observer wiring), so a separate `lifetime-manager.ts` would be an empty wrapper — its responsibilities are absorbed into `bootstrap.ts`. Likewise the per-view bodies are consolidated into `src/ui/views.ts` (one dispatcher + one function per view) and the shell/credit into `src/ui/render.ts`, rather than ~9 tiny component files. The header is built inline in `render.ts`.
- **Rationale:** equivalent layering, fewer files, no duplicated logic, all spec §56 contracts (single brand credit, textContent-only, data-testid, focus handling) are honored. The spec's §1.2 precedence rule explicitly allows file-structure simplification when responsibilities are preserved.
- **Reversibility:** if a reviewer prefers the spec's exact file split for clarity, the views.ts functions can be mechanically extracted into `components/*.ts` without behavior change.

## Open questions for the human reviewer

None at this time. Any future deviation will be appended here before the
change is committed.
