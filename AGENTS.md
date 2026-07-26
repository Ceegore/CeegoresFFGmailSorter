# AGENTS.md — Rules for any AI coding agent working on this repository

This file binds every autonomous agent that touches this codebase. It is
derived from `docs/PRODUCT_SPEC.md` v2.1.0 FINAL, chapters 1, 41, 71, 72. Where
this file and the spec disagree, **the spec wins**.

## 1. Authoritative source

- The single source of truth is `docs/PRODUCT_SPEC.md`, locked by
  `docs/SPEC_SHA256.txt`.
- If the spec file is modified, the SHA must be recomputed and a scope-change
  entry added to `DECISIONS.md` first. Do not edit the spec in passing.

## 2. Immutable V1 boundaries (do not expand scope)

The agent MUST NOT add, and MUST STOP-AND-ESCALATE if it believes it needs:

- Gmail API, Google OAuth, or any internal Gmail RPC endpoint;
- an own server, analytics, ads, tracking, or telemetry;
- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`,
  `document.cookie`, remote dynamic `import()`, `eval`, or `new Function`;
- remote code, CDN dependencies, or remote fonts;
- any permission beyond `storage` and `https://mail.google.com/*`;
- persistent storage of sender addresses, display names, subjects, snippets,
  queries, thread/message IDs, or account identity;
- automatic destination-label selection or any "apply/create/move" confirmation
  inside the native Gmail menu;
- Chrome/Edge/Safari/Android support in V1;
- crawling beyond the currently loaded inbox page;
- a roadmap item from spec §37 "because it seems easy".

## 3. Working mode (per spec §65.1)

For every sub-phase, in order:

1. Verify inputs.
2. Write tests / contracts first.
3. Implement the smallest production code that satisfies the Expected Results.
4. Run the focused tests, then the full accumulated suite.
5. Diff-check for scope violations.
6. Write the prescribed evidence artifact.
7. Commit with the spec's exact commit message.
8. Only proceed to the next gate after PASS.

Never skip a phase because a later one looks easy.

## 4. Click rule (spec §16.1, §51.6)

No automatic DOM click is allowed unless ALL hold:

- the current workflow state permits the action;
- the expected Gmail view is detected;
- exactly one sufficiently-confident candidate exists (score ≥ threshold AND
  margin ≥ delta per §51.3);
- the candidate is freshly re-resolved, `isInteractable`, and not under the
  overlay;
- the abort signal is not set;
- the prior step is confirmed.

After every click, the specified postcondition must be confirmed before the
next action. On any ambiguity: STOP, never guess.

## 5. STOP-AND-ESCALATE (spec §71)

Stop and escalate (do not improvise) when:

1. Gmail yields two equally-confident click candidates;
2. a new permission, library, or network request seems necessary;
3. a user action that the spec defines as manual would have to be automated;
4. real mailbox data could enter a fixture or screenshot;
5. the test Gmail account / login is not available;
6. a live test shows an unexpected UI;
7. a P0 test is flaky;
8. redaction correctness cannot be proven;
9. AMO policy or manifest schema conflicts with the spec;
10. Gmail alters the search query;
11. related/similar results cannot be safely excluded;
12. a prior gate lacks valid evidence;
13. the spec file changed without scope-change approval.

Escalation output uses the template in spec §71.

## 6. Privacy defaults

- Sender data lives only in content-script memory for the active tab session.
- Diagnostics are allowlisted at the source and recursively redacted on export.
- `storage.local` holds settings only — never senders, queries, or analysis.
- A Gmail tab reload ends the session.

## 7. Quality bar

"Funny enough in the mock" is insufficient. Before any phase is marked PASS the
spec's commands must exit 0 and evidence must be archived. Live-Gmail and AMO
gates (Phases 11–12) are human-owned; the agent prepares them but does not
execute them.
