# Gmail DOM Adapter Maintenance

The primary maintenance risk for this extension is a change to Gmail's web UI.
Gmail exposes no public, stable DOM contract. This document defines how the
adapter is maintained safely (spec §13, §35, §69).

## Architecture principle

Business logic **never** contains Gmail selectors. All detection lives behind
the `GmailDomAdapter` interface (`src/gmail/adapter.ts`) and the detector
helpers (`src/gmail/dom-detectors.ts`, `src/gmail/gmail-text-patterns.ts`,
`src/gmail/{search,selection,move,completion}-controller.ts`). Detection is
multi-signal and semantic; a generated Gmail CSS class is never the sole
selector.

## Adapter version

`GMAIL_ADAPTER_VERSION` is bumped on any change to: candidate rules, text
patterns, scoring, or structure detection. The current version is `2026.07.1`.

## When Gmail breaks

Severity (spec §69.1):

| Severity | Definition                  | Example                      | Reaction                            |
| -------- | --------------------------- | ---------------------------- | ----------------------------------- |
| SEV-0    | risk of wrong mass action   | wrong move button possible   | halt distribution / disable version |
| SEV-1    | core workflow breaks safely | no selection possible        | prioritized patch                   |
| SEV-2    | analysis partially impaired | sender source not recognized | adapter patch                       |
| SEV-3    | cosmetic / diagnostic       | layout / copy                | normal patch                        |

## Fix process (spec §35.3, §69.2)

1. Reproduce via diagnostics.
2. Identify which adapter part failed.
3. Update the synthetic/redacted fixture.
4. Write a regression test.
5. Change **only** the adapter — never business logic.
6. Run the full fixture suite.
7. DE/EN live smoke test (human-owned, Phase 11).
8. Patch version + signed update.

## Signal priority (spec §13.4)

1. native attributes with semantic meaning;
2. ARIA roles;
3. ARIA labels and tooltips;
4. stable data attributes (e.g. email address);
5. structural position relative to list/toolbar;
6. text lexicon;
7. CSS classes only as last, low-weight aid.

## Allowed row attributes (spec §52.2)

`email`, `data-hovercard-id`, `data-email`, `title`, `aria-label`, `role`,
`id`, `data-thread-id`, `data-legacy-thread-id`. Other `data-*` attributes may
be used only after live calibration and documentation here.
