# AMO Reviewer Notes — Inbox Sender Organizer

Copy-paste reference for the AMO submission (spec §67.1–67.5).

## Purpose

Inbox Sender Organizer is a Firefox-only extension for Gmail Web. It groups
recurring senders found on the currently loaded inbox page. For a sender
explicitly selected by the user, it inserts the exact query
`in:inbox "from:sender@example.com"` into Gmail's native search UI, verifies
the visible search result state, selects the current page, attempts Gmail's
native “select all matching results” action, and opens Gmail's native “Move to”
menu. The extension never chooses a destination label; the user must do so in
Gmail.

## Permissions

- `storage`: local UI settings only (overlay position, diagnostics enabled,
  auto-open-move preference).
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
developer-controlled service.

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
7. Observe native Gmail search and selection UI.
8. Choose a test label manually in Gmail's native “Move to” menu.
9. Confirm completion or the conservative manual fallback.

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

Gruppiert wiederkehrende Absender auf der geladenen Gmail-Inbox-Seite und führt
kontrolliert zu Gmails nativer Auswahl und „Verschieben nach“-Funktion – ohne
Gmail API, OAuth, Tracking oder eigenen Server.
