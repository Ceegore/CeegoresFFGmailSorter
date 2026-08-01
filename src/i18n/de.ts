// Locked German UI strings. Merge of spec §8 (`de`) and §56.6 (`deV2`).
// Every user-facing string lives here; runtime values are inserted via
// textContent only, never via innerHTML.
export const de = {
  addonName: "Inbox Sender Organizer",
  madeBy: "made by Ceegore",
  ready: "Bereit",
  analyzeInbox: "Posteingang analysieren",
  close: "Schließen",
  diagnostics: "Diagnose",
  analysisHint:
    "Analysiert nur die aktuell geladene Inbox-Seite. Die spätere Suche kann alle passenden Inbox-Treffer erfassen.",
  analyzing: "Posteingang wird analysiert …",
  cancel: "Abbrechen",
  analysisComplete: "Analyse abgeschlossen",
  filterPlaceholder: "Absender filtern …",
  sortFrequent: "Häufigste zuerst",
  sortName: "Name A–Z",
  sortAddress: "Adresse A–Z",
  // ITI-046: accessible label for the sort <select> control.
  sortLabel: "Sortieren",
  entries: "Einträge",
  findAllInbox: "Alle im Posteingang finden",
  ignoreSession: "Für diese Sitzung ignorieren",
  unresolvedSummary: "{count} Einträge konnten nicht sicher zugeordnet werden",
  showDetails: "Details anzeigen",
  confirmTitle: "Gesamten Posteingang durchsuchen?",
  confirmBody:
    "Gmail sucht nach allen Inbox-Treffern von diesem Absender. Bei aktivierter Konversationsansicht können vollständige Unterhaltungen ausgewählt werden.",
  sender: "Absender",
  address: "Adresse",
  visibleMatches: "Sichtbare Ausgangstreffer",
  searchQuery: "Suchanfrage",
  startSearch: "Suche starten",
  back: "Zurück",
  manualWorkflowHint:
    "Die Suche wurde in Gmail gestartet. Wähle die Treffer, öffne das „Verschieben nach“-Menü und wähle das Ziel selbst. Das Add-on führt in diesem Modus keine automatischen Klicks aus.",
  stepSearch: "Suche öffnen",
  stepSelectPage: "Ergebnisse auswählen",
  stepSelectAll: "Alle Treffer auswählen",
  stepOpenMove: "Verschieben-Menü öffnen",
  stepChooseTarget: "Ziel in Gmail auswählen",
  // Currently unused by views.ts/render.ts; retained from spec for the
  // not-yet-implemented "choose target" / "completion uncertain" views.
  chooseTargetTitle: "Ziel jetzt in Gmail auswählen",
  chooseTargetBody:
    "Wähle im geöffneten Gmail-Menü ein vorhandenes Label oder „Neu erstellen“. Das Add-on führt die Verschiebung nicht ohne deine Auswahl aus.",
  reopenMenu: "Menü erneut öffnen",
  done: "Ich bin fertig",
  senderProcessed: "Absender bearbeitet",
  nextSender: "Nächsten Absender bearbeiten",
  resultList: "Zur Ergebnisliste",
  // Currently unused; retained from spec for the not-yet-implemented
  // "completion uncertain" recovery view.
  completionUncertain: "Abschluss nicht eindeutig erkannt",
  completionUncertainBody:
    "Prüfe die Gmail-Ergebnisliste. Wenn die Nachrichten verschoben wurden, markiere die Gruppe als erledigt.",
  markDone: "Als erledigt markieren",
  retry: "Erneut versuchen",
  continue: "Fortsetzen",
  copyDiagnostics: "Diagnose kopieren",
  noGroups:
    "Auf der aktuell geladenen Seite wurden keine Absender mit mindestens zwei Einträgen gefunden.",
  notInbox: "Öffne den Gmail-Posteingang oder eine Inbox-Kategorie und starte die Analyse erneut.",
  gmailNotReady: "Gmail ist noch nicht vollständig geladen. Warte kurz und versuche es erneut.",
  unsafeState:
    "Die Gmail-Oberfläche konnte nicht sicher erkannt werden. Es wurde nichts angeklickt.",
  internal: "Ein interner Fehler ist aufgetreten.",
  searchFailed: "Die globale Gmail-Suche konnte nicht sicher gestartet werden.",
  selectFailed: "Gmails Auswahlleiste wurde nicht gefunden.",
  selectAllHelp: "Wähle in Gmail alle Treffer dieser Suche aus und klicke danach auf „Fortsetzen“.",
  moveMenuFailed: "Das Gmail-Menü „Verschieben nach“ konnte nicht geöffnet werden.",
  nativeUndoHint:
    "Eine bereits ausgeführte Gmail-Aktion kann gegebenenfalls über Gmails „Rückgängig“-Hinweis zurückgenommen werden.",

  // §56.6 additional UI texts
  moveOverlay: "Overlay verschieben",
  narrowViewportWarning: "Schmales Fenster – Gmail-Bedienelemente können verdeckt sein.",
  unknownGmailLanguage:
    "Diese Gmail-Oberflächensprache wird noch nicht vollständig unterstützt. Die Suche wurde geöffnet; führe Auswahl und Verschieben bitte manuell aus.",
  relatedResultsOnly:
    "Gmail zeigt keine sicher erkennbaren exakten Inbox-Treffer, sondern nur ähnliche Ergebnisse. Es wurde nichts ausgewählt.",
  noExactMailList:
    "Die E-Mail-Ergebnisliste konnte nicht sicher von anderen Gmail-Ergebnisbereichen unterschieden werden.",
  manualSelectInstruction:
    "Klicke in Gmail auf „Alle … auswählen, die dieser Suche entsprechen“. Klicke danach hier auf „Fortsetzen“.",
  manualSelectConfirmation:
    "Ich bestätige, dass alle gewünschten Treffer dieser Suche ausgewählt sind.",
  createLabelUnavailable:
    "Erstelle das Label über Gmails native Labelverwaltung und öffne danach das Verschieben-Menü erneut.",
  completionEvidenceWeak:
    "Das Add-on konnte den Abschluss nicht sicher bestätigen. Prüfe die Ergebnisliste und bestätige nur, wenn die Nachrichten tatsächlich verschoben wurden.",
  sessionLost:
    "Die Gmail-Seite wurde neu geladen. Die bisherige Add-on-Sitzung wurde aus Datenschutz- und Sicherheitsgründen beendet.",
  routeChanged:
    "Die Gmail-Ansicht hat sich während des Vorgangs geändert. Die Automatisierung wurde gestoppt.",
  noRows: "Auf dieser Gmail-Seite wurden keine analysierbaren Inbox-Einträge gefunden.",
  unresolvedConflict:
    "Dieser Eintrag enthält widersprüchliche Absenderinformationen und kann nicht automatisch bearbeitet werden.",
  diagnosticsRedacted: "Persönliche Daten wurden für den Diagnoseexport automatisch redigiert.",
  diagnosticsReviewWarning:
    "Prüfe die Datei vor dem Teilen. Technische Kontextinformationen können weiterhin enthalten sein.",
  retryDetection: "Erkennung erneut prüfen",
  openInbox: "Posteingang öffnen",
  copyQuery: "Suchanfrage kopieren",
  copied: "Kopiert",
  resetPosition: "Overlay-Position zurücksetzen",
  settingsReset: "Einstellungen wurden zurückgesetzt.",
  liveActionWarning:
    "Die nächsten Schritte bedienen echte Gmail-Elemente. Beobachte die Aktion und brich bei einem unerwarteten Zustand sofort ab.",
  entriesChecked: "Einträge geprüft",
  recurringSenders: "wiederkehrende Absender",
  notUnambiguous: "nicht eindeutig",
  groupMarkedDone: "wurde als erledigt markiert.",
} as const;

export type DeText = keyof typeof de;
