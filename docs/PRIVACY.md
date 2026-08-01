# Datenschutz – Inbox Sender Organizer

Inbox Sender Organizer arbeitet ohne eigenen Server, Analyse-, Werbe- oder
Trackingdienst. Auf der aktuell geladenen Gmail-Seite verarbeitet die Erweiterung
im Browser Absendernamen, Absenderadressen und die Anzahl sichtbarer
Listeneinträge, um wiederkehrende Absender zu gruppieren. Diese Sitzungsdaten
werden nicht an den Entwickler übertragen und nicht dauerhaft gespeichert.

Wenn du für einen Absender ausdrücklich „Suche starten“ bestätigst, schreibt die
Erweiterung die angezeigte Absenderadresse in Gmails eigene Suchbox. Die
Suchanfrage wird dann durch Google im Rahmen deiner normalen Gmail-Nutzung
verarbeitet. Die Erweiterung verwendet dafür weder Gmail API noch Google OAuth
oder interne Gmail-Netzwerkendpunkte.

In Firefox `storage.local` werden ausschließlich technische Einstellungen wie
die Overlay-Position gespeichert. Ein Neuladen des Gmail-Tabs beendet die
Analysesitzung.

Im Overlay steht klein „made by Ceegore“. Der Hinweis ist nicht verlinkt und
überträgt keine Daten.

## AMO / Mozilla data-collection declaration

The manifest declares `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`
because the extension performs **no extension-owned** collection or transmission.
The extension has no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`sendBeacon`, cookie, `webRequest`, analytics, advertising, remote-code, own
server, Gmail API, OAuth, or internal Gmail RPC usage.

**Disclosure of user-initiated Gmail search processing:** When the user
explicitly confirms a sender workflow, the selected sender address is placed
into Gmail's own search field; Google processes that query as part of the
user's normal Gmail action. No such value is sent to the developer or any
developer-controlled service. This fact is disclosed here, in the listing copy,
and in the reviewer notes.

Before any AMO submission, gate **PRIV-AMO-01** rechecks the then-current
Mozilla taxonomy. If reviewers classify the user-initiated Gmail search
differently, the project will update the declaration and consent UX before
release.
