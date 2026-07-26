# Known Limitations – Inbox Sender Organizer

These limitations are inherent to the V1 product boundary (spec §36) and must be
accepted before release.

1. **Current-page discovery only.** Senders appearing on the analyzed inbox page
   _once_ are never proposed, even if many more messages exist for them
   elsewhere in the inbox. Only the currently loaded page is analyzed; crawling
   is explicitly out of scope for V1.
2. **Conversation view counts conversations, not messages.** With Gmail's
   conversation view on, a list entry is normally a thread, not a single
   message. The UI therefore says „Einträge“/„Treffer“ and never claims to equal
   the number of individual emails.
3. **`from:` search can hit a thread with other senders.** A `from:` query may
   match a conversation that also involves other participants; selection applies
   to the whole conversation.
4. **Gmail's „select all matches“ is not a public API.** Its appearance varies
   by result count, UI variant, and rollout. When it cannot be safely detected,
   the add-on falls back to manual instructions.
5. **Gmail DOM is undocumented and can change.** Detection is multi-signal and
   isolated in the adapter; after a Gmail change the add-on may fall back to
   manual hints until the adapter is recalibrated.
6. **Unusual Gmail languages** partially fall back to manual operation (DE/EN
   are supported; others degrade conservatively).
7. **Very specific themes or browser CSS** can influence native Gmail detection.
8. **Server-side success is observed only via UI signals.** The add-on cannot
   guarantee Gmail's server state; completion is a plausibility, not a guarantee.
9. **Gmail's „Undo“ is outside the add-on's control.**
10. **New labels are created only via Gmail.** The add-on never creates or
    selects a destination label.
11. **The extension is not a backup tool.**
12. **Do not first-test in an important mailbox.** Use a dedicated test account.
13. **Placeholder icons** ship until replaced with final brand artwork (see
    `DECISIONS.md` D-002).

## Not in V1 (roadmap, spec §37)

- multi-page inbox crawl; additional Gmail languages; persisted sender→label
  mappings; quick-label actions; configurable minimum occurrences; unread-only
  filter; multi-sender batch preview; own label dropdown; automatic label
  selection; other webmail providers. None of these may be pulled forward
  „because they look easy“.
