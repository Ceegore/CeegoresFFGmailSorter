# Manual Live-Gmail Acceptance Checklist (Phase 11 — HUMAN-OWNED)

> This checklist must be executed by a human against a **dedicated test Gmail
> account**, never a personal/production mailbox (spec §33, §66). The agent
> prepares this document but does NOT execute it. No agent may receive Gmail
> credentials or run live mass actions.

## Preconditions (human)

- [ ] Dedicated Gmail test account created and logged into Firefox 142+.
- [ ] Test senders present (reserved domains only — synthetic):
  - `newsletter-alpha@example.com` × 3–5
  - `newsletter-beta@example.net` × 2–3
  - `billing@example.org` × 2
  - `single@example.net` × 1 (must NOT appear as a group)
  - `mixed-name@example.org` × 2 (different display names, same address)
- [ ] Test label `GISO/Test Existing` exists.
- [ ] `GISO/Test New` does NOT exist (to test "create new").
- [ ] Separate Firefox test profile (not the primary profile).
- [ ] Built extension loaded via `npm run webext:run`.
- [ ] Gmail Undo affordance reachable during every move.

## Matrix (spec §66.2) — fill each cell: PASS / FAIL / BLOCKED + evidence id

| ID       | Lang | Theme | Density     | Conv | Result set   | Selection path     | Target   | Result             |
| -------- | ---- | ----- | ----------- | ---- | ------------ | ------------------ | -------- | ------------------ |
| LIVE-001 | DE   | Light | Default     | On   | 1 page       | automatic          | existing | _____              |
| LIVE-002 | DE   | Dark  | Compact     | On   | multi-page   | auto global        | existing | _____              |
| LIVE-003 | DE   | Light | Comfortable | Off  | 1 page       | single-page proof  | new      | _____              |
| LIVE-004 | DE   | Dark  | Default     | Off  | multi-page   | manual             | existing | _____              |
| LIVE-005 | EN   | Light | Default     | On   | 1 page       | automatic          | existing | _____              |
| LIVE-006 | EN   | Dark  | Compact     | On   | multi-page   | auto global        | new      | _____              |
| LIVE-007 | EN   | Light | Comfortable | Off  | multi-page   | manual             | existing | _____              |
| LIVE-008 | DE   | Light | Default     | On   | no results   | N/A                | N/A      | no selection       |
| LIVE-009 | EN   | Light | Default     | On   | related only | N/A                | N/A      | abort              |
| LIVE-010 | DE   | Light | Default     | On   | normal       | abort after search | N/A      | no selection click |
| LIVE-011 | DE   | Light | Default     | On   | normal       | abort after page   | N/A      | no move click      |
| LIVE-012 | EN   | Light | Default     | On   | normal       | route change       | N/A      | stop               |

## Per-run limits (spec §66.3)

- Max 10 messages/conversations moved per run.
- Smallest result set first.
- Human watches cursor + target throughout.
- Gmail Undo must not be covered by the overlay.
- On any unexpected click: disable the add-on immediately and reset the test account.

## Sign-off

- Tester name: _______
- Date: _______
- Test account confirmed dedicated (not personal): YES / NO
- No unexpected clicks observed across all 12 cells: YES / NO
- Decision: GO / NO-GO
