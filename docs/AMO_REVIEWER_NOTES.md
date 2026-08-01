# AMO Reviewer Notes — Inbox Sender Organizer

Copy-paste reference for the AMO submission (spec §67.1–67.5).

## Purpose

Inbox Sender Organizer is a Firefox-only extension for Gmail Web. It analyzes
the currently loaded inbox page, extracts sender addresses from the visible
DOM, and groups recurring senders so the user can see at a glance who sends
the most mail. For a sender explicitly selected by the user, the extension
builds the exact quoted query `in:inbox "from:sender@example.com"`, inserts it
into Gmail's native search field, and verifies the visible search-result state.

In the current version (SAFE_MODE), the extension **does not** perform any
automatic selection, select-all, or move-menu clicks. Instead, after the
verified search it surfaces the query (with a copy button and manual
instructions) for the user to act on manually in Gmail's own UI. The user
performs selection and the “Move to” action themselves and then marks the
group as done in the overlay.

## Permissions

- `storage`: local UI settings only (overlay position).
- `https://mail.google.com/*`: read the visible Gmail DOM and operate visible
  native controls.

## Data and network behavior

The extension has no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`sendBeacon`, cookies, `webRequest`, analytics, advertising, remote code, own
server, Gmail API, OAuth, or internal Gmail RPC usage. Sender addresses exist
only in content-script memory for the active tab session and are not persisted.
When the user confirms a sender workflow, the selected sender address is placed
into Gmail's own search field; Google processes that query as part of the
user's normal Gmail action. No such value is sent to the developer or another
developer-controlled service. The extension performs no automatic Gmail actions
in SAFE_MODE — selection and move are done manually by the user.

## Manifest privacy declaration

The submitted manifest declares
`data_collection_permissions.required = ["none"]` because the extension
performs no extension-owned collection or transmission. Before submission,
project gate PRIV-AMO-01 rechecks the then-current Mozilla taxonomy. If
reviewers classify the user-initiated Gmail search differently, the project
will update the declaration and consent UX before release.

## Branding

The overlay contains the small non-interactive text “made by Ceegore”. It is
not a link and performs no tracking or external navigation.

## Build

1. Install Node.js 24.18.0 and npm 11.16.0.
2. Run `npm ci`.
3. Run `npm run verify`.
4. Run `npm run package`.
   The built extension is in `dist/` and fresh release files are in
   `artifacts/release/`.

## Test steps

1. Open Gmail in Firefox 142+ using the provided synthetic test account.
2. Click the extension toolbar icon.
3. Verify the overlay shows “made by Ceegore”.
4. Click “Posteingang analysieren”.
5. Choose a sender group with at least two entries.
6. Confirm the exact quoted sender query.
7. Observe that Gmail runs the native search (no further automatic action is
   taken by the extension in SAFE_MODE).
8. Perform selection and the “Move to” action manually in Gmail's native UI.
9. Mark the sender group done in the overlay when finished.

## Safety behavior

If the Gmail DOM, query, result list, selection state or Move control is
ambiguous, the extension stops and displays manual instructions. It never
guesses a target and never selects a destination label.

---

## Berechtigungsbegründung (Deutsch)

Die Hostberechtigung für mail.google.com ist erforderlich, weil die Erweiterung
ausschließlich lokal die sichtbare Gmail-Weboberfläche analysiert und sichtbare
native Bedienelemente nutzt. Sie liest Absenderadressen aus der aktuell
geladenen Inbox-Seite. Erst nach einer ausdrücklichen Nutzerbestätigung
schreibt sie die ausgewählte Adresse in Gmails eigene Suchbox; diese Suchanfrage
wird als normale Gmail-Nutzeraktion von Google verarbeitet. Die Erweiterung
sendet keine Daten an den Entwickler oder einen eigenen beziehungsweise fremden
Analysedienst. `storage` speichert nur lokale Oberflächeneinstellungen und
niemals E-Mail-Adressen oder Nachrichteninformationen.

## AMO-Kurzbeschreibung

Gruppiert wiederkehrende Absender auf der geladenen Gmail-Inbox-Seite und fügt
für einen ausgewählten Absender die exakte Suchanfrage in Gmails native Suche
ein. Auswahl und „Verschieben nach“ erfolgen manuell durch die Nutzerin oder
den Nutzer – ohne Gmail API, OAuth, Tracking oder eigenen Server.
