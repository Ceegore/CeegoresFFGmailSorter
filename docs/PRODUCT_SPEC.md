# Gmail Inbox Sender Organizer
## Vollständiges, implementierungsgebundenes Produkt-, UX-, Architektur-, Datenschutz-, Test- und Ausführungskonzept

**Dokument-ID:** GISO-DOM-FIREFOX-IMPLEMENTATION-LOCKED  
**Version:** 2.1.0 FINAL  
**Stand:** 26. Juli 2026  
**Zielplattform:** Firefox Desktop  
**Zielwebseite:** Gmail Web unter `https://mail.google.com/`  
**Integrationsart:** reine DOM-Integration, keine Gmail API, kein Google OAuth, kein eigener Server  
**Dokumentstatus:** FINAL / IMPLEMENTATION LOCKED / IMPLEMENTATION READY  
**Primärsprache der Oberfläche:** Deutsch  
**Sekundärsprache der Gmail-Erkennung:** Englisch  
**Zweck:** Dieses Dokument definiert das Produkt, die Referenzarchitektur, die ausführbaren Implementierungsverträge, den vollständigen Agentenplan, die Test- und Release-Gates sowie die Wartungsprozesse so vollständig, dass auch ein schwächerer autonomer AI-Coding-Agent die Erweiterung ohne zusätzliche Produkt-, Architektur-, UX-, Sicherheits- oder Prozessentscheidungen implementieren, testen, paketieren und zur menschlichen Endabnahme vorbereiten kann.

**Verhältnis zu Vorversionen:** Version 2.1.0 FINAL ersetzt Version 2.0.0 und alle älteren Fassungen vollständig. Sie enthält die Ergebnisse einer tiefen Architektur-, Code-, Sicherheits-, Datenschutz-, UX-, Test-, Toolchain-, Release- und Planungsprüfung. Bei einem Konflikt gilt ausschließlich diese Datei. Innerhalb dieser Datei haben Sicherheitsinvarianten, die vollständigen Referenzdateien und die finalen Gates Vorrang vor verkürzten Erläuterungsbeispielen.

---

# 1. Verbindlichkeit und Auslegungsregeln

## 1.1 Normative Begriffe

Die Begriffe **MUSS**, **DARF NICHT**, **SOLL**, **SOLL NICHT** und **KANN** sind normativ:

- **MUSS / DARF NICHT:** zwingende Anforderung;
- **SOLL / SOLL NICHT:** nur bei technisch belegbarer Notwendigkeit abweichbar;
- **KANN:** optionale Verbesserung, die den verbindlichen Umfang nicht verändern darf.

## 1.2 Rangfolge bei Konflikten

Bei einem Widerspruch gilt folgende Priorität:

1. Datenschutz und Verhinderung unbeabsichtigter Massenaktionen;
2. funktionale Akzeptanzkriterien;
3. Zustandsmaschine und Sicherheitsregeln;
4. DOM-Adapterregeln;
5. UX-Spezifikation;
6. vollständige Referenzdateien und Verträge aus Kapitel 41–77 und den Anhängen;
7. ältere technische Detailbeispiele aus Kapitel 1–40.

Ein Coding-Agent DARF keine stillen Annahmen treffen, die den Umfang erweitern. Nicht ausdrücklich für V1 freigegebene Funktionen gehören in die Roadmap und NICHT in den produktiven V1-Code.

## 1.3 Unvermeidbare externe Unsicherheit

Gmail stellt keine öffentliche, stabile DOM-Schnittstelle bereit. Daher kann kein statisches Dokument dauerhaft korrekte Gmail-Selektoren garantieren. Dieses Dokument beseitigt diese Unsicherheit durch:

- einen austauschbaren Gmail-DOM-Adapter;
- semantische, mehrstufige Elementerkennung;
- einen Diagnosemodus;
- DOM-Fixtures;
- kontrollierte Fallbacks;
- obligatorische Live-Abnahmetests vor jeder Veröffentlichung.

Ein Agent DARF keine einzelne Gmail-CSS-Klasse als dauerhafte Produktlogik behandeln.

---

# 2. Produktzusammenfassung

## 2.1 Problem

Der Nutzer möchte den Gmail-Posteingang zunächst gesammelt überblicken und ihn danach halbmanuell nach Absendern aufräumen. Automatische Gmail-Filter sind für diesen Arbeitsstil ungeeignet, weil neue Nachrichten weiterhin zunächst gemeinsam im Posteingang sichtbar sein sollen.

## 2.2 Lösung

Die Firefox-Erweiterung fügt in Gmail ein lokales Overlay ein. Die Erweiterung:

1. analysiert ausschließlich die aktuell in Gmails Nachrichtenliste geladene Seite;
2. erkennt Absender, die dort mindestens zweimal vorkommen;
3. gruppiert diese Absender im Overlay;
4. startet für eine ausgewählte Gruppe eine globale Gmail-Suche wie  
   `in:inbox "from:newsletter@example.com"`;
5. wählt zunächst die aktuelle Suchergebnisseite aus;
6. versucht anschließend, Gmails native Funktion „alle Treffer dieser Suche auswählen“ zu aktivieren;
7. öffnet Gmails natives Menü „Verschieben nach“;
8. überlässt die Wahl eines bestehenden oder neuen Labels dem Nutzer in Gmails eigener Oberfläche;
9. überwacht den Abschluss und ermöglicht die Bearbeitung der nächsten Absendergruppe.

Die erste Posteingangsseite dient nur zur **Entdeckung relevanter Absender**. Die spätere Suche gilt für den gesamten aktuellen Gmail-Posteingang.

## 2.3 Zentrale Produktentscheidung

V1 enthält **kein eigenes Label-Dropdown im Overlay**.

Begründung:

- Ohne Gmail API müsste die Erweiterung Labels aus undokumentierten Gmail-Menüs oder der Seitenleiste extrahieren.
- Eingeklappte, verschachtelte oder dynamisch geladene Labels wären fehleranfällig.
- Das native Gmail-Menü unterstützt bestehende Labels und – sofern Gmail es dort anbietet – die native Erstellung neuer Labels.
- Die halbmanuelle Zielauswahl verhindert versehentliche Massenverschiebungen.

V1 automatisiert die repetitive Suche und Auswahl. Der Nutzer bestätigt das tatsächliche Ziel in Gmail.

---

# 3. Ziele und Nichtziele

## 3.1 Muss-Ziele

GISO-01: Das Add-on MUSS ohne Google Cloud Project, Gmail API und OAuth funktionieren.  
GISO-02: Es MUSS ausschließlich im lokalen Browser arbeiten.  
GISO-03: Es MUSS Absender der aktuell geladenen Gmail-Inbox-Seite gruppieren.  
GISO-04: Es MUSS nur Gruppen mit mindestens zwei erkannten Listeneinträgen anzeigen.  
GISO-05: Eine Aktion MUSS über Gmail-Suche den gesamten Posteingang einbeziehen.  
GISO-06: Vor der finalen Labelwahl MUSS eine sichtbare Nutzerinteraktion erfolgen.  
GISO-07: Das Add-on MUSS bei unsicherer DOM-Erkennung abbrechen statt blind zu klicken.  
GISO-08: Es MUSS Deutsch und Englisch als Gmail-Oberflächensprachen erkennen.  
GISO-09: Es MUSS Light Mode, Dark Mode und die Gmail-Dichtevarianten unterstützen.  
GISO-10: Es MUSS mehrere Gmail-Konten in getrennten Tabs beziehungsweise `/mail/u/<n>/` korrekt behandeln.  
GISO-11: Es DARF keine Mailinhalte, Betreffzeilen oder Kontakte extern übertragen.  
GISO-12: Es MUSS als Firefox-Manifest-V3-Erweiterung paketierbar sein.
GISO-13: Das Overlay MUSS in jeder sichtbaren Ansicht genau einmal den kleinen, nicht interaktiven Hinweis **„made by Ceegore“** innerhalb seines Shadow DOM anzeigen.

## 3.2 Soll-Ziele

- sehr geringe CPU-Last im Leerlauf;
- keine dauerhafte Speicherung erkannter E-Mail-Adressen;
- keyboard- und screenreader-taugliches Overlay;
- nachvollziehbarer Fortschritt;
- wiederholbare automatische Tests mit Gmail-DOM-Fixtures;
- austauschbare DOM-Erkennung ohne Änderungen an der Geschäftslogik.

## 3.3 Nichtziele für V1

V1 DARF NICHT:

- den gesamten Posteingang Seite für Seite automatisch crawlen;
- Gmail APIs oder inoffizielle Google-Netzwerkendpunkte aufrufen;
- automatische Gmail-Filter erstellen;
- selbstständig Ziel-Labels auswählen;
- ohne letzte Nutzerentscheidung verschieben;
- Mailtexte lesen oder semantisch analysieren;
- KI-Modelle oder Cloud-Dienste verwenden;
- Daten synchronisieren;
- Chrome, Edge, Safari oder Firefox Android offiziell unterstützen;
- Gmail-Einstellungen verändern;
- die Konversationsansicht automatisch umstellen;
- Spam, Papierkorb, Gesendet oder beliebige Labels analysieren;
- mehrere Absendergruppen in einer unbeaufsichtigten Massenwarteschlange verschieben.

---

# 4. Fachliche Begriffe

## 4.1 „Listeneintrag“

Ein sichtbarer Datensatz in Gmails aktueller Nachrichtenliste.

- Bei aktivierter Konversationsansicht entspricht ein Eintrag normalerweise einer Unterhaltung.
- Bei deaktivierter Konversationsansicht entspricht ein Eintrag normalerweise einer einzelnen Nachricht.

Die Benutzeroberfläche des Add-ons MUSS daher „Einträge“ oder „Treffer“ verwenden und DARF nicht garantieren, dass die Zahl identisch mit der Anzahl einzelner E-Mails ist.

## 4.2 „Sichtbare Seite“

Alle aktuell von Gmail in der zentralen Liste dargestellten Einträge der aktuellen Seite, unabhängig davon, ob ein Eintrag gerade innerhalb des Browser-Viewports liegt. Nicht gemeint sind Einträge auf späteren Gmail-Seiten.

## 4.3 „Globaler Treffer“

Ein Gmail-Suchergebnis im gesamten Bereich `in:inbox`, das die gewählte Absenderadresse erfüllt.

## 4.4 „Absenderidentität“

Primärer Gruppenschlüssel ist eine normalisierte E-Mail-Adresse. Anzeigenamen sind nur Darstellung.

## 4.5 „Native Aktion“

Eine Aktion, die durch Anklicken der existierenden Gmail-Oberfläche ausgeführt wird. Das Add-on selbst sendet keine Gmail-API- oder Backend-Anfrage.

---

# 5. Zielgruppe und Nutzungsszenario

## 5.1 Primärnutzer

- nutzt Gmail im Firefox-Desktopbrowser;
- erhält wiederkehrende Nachrichten vieler Absender;
- möchte neue Nachrichten zuerst gemeinsam sehen;
- möchte danach in Gruppen aufräumen;
- bevorzugt Kontrolle gegenüber vollautomatischen Regeln.

## 5.2 Haupt-User-Story

> Als Gmail-Nutzer möchte ich die aktuellste Inbox-Seite analysieren, mehrfach vorkommende Absender sehen und anschließend alle Inbox-Unterhaltungen eines ausgewählten Absenders mit möglichst wenigen Klicks über Gmails native Labeloberfläche verschieben.

## 5.3 Neben-User-Stories

- Der Nutzer kann Gruppen nach Anzahl sortieren.
- Der Nutzer kann Gruppen filtern.
- Der Nutzer kann einen Absender aus der aktuellen Sitzung ignorieren.
- Der Nutzer sieht vor der Aktion die verwendete Gmail-Suchanfrage.
- Der Nutzer kann die Automatisierung jederzeit abbrechen.
- Bei Änderungen an Gmail erhält der Nutzer eine verständliche manuelle Anweisung statt einer riskanten Fehlaktion.

---

# 6. Verbindlicher End-to-End-Ablauf

## 6.1 Add-on öffnen

1. Nutzer öffnet Gmail.
2. Nutzer klickt das Firefox-Toolbar-Symbol des Add-ons.
3. Das Background-Script sendet `TOGGLE_OVERLAY` an den Content-Script-Kontext des aktiven Tabs.
4. Ist kein Gmail-Content-Script erreichbar, wird ein neuer Tab mit `https://mail.google.com/` geöffnet.
5. In Gmail erscheint rechts oben ein schwebendes Overlay.

## 6.2 Analyse starten

1. Nutzer klickt **„Posteingang analysieren“**.
2. Add-on prüft:
   - Gmail-Hauptoberfläche geladen;
   - zentrale Nachrichtenliste vorhanden;
   - keine laufende andere Add-on-Aktion;
   - aktuelle Ansicht ist Inbox oder eine Inbox-Kategorie;
   - mindestens ein analysierbarer Listeneintrag vorhanden.
3. Add-on ermittelt alle Listeneinträge der aktuellen Seite.
4. Für jeden Eintrag wird der Absender mit dem Sender-Extractor ermittelt.
5. Absender mit identischer normalisierter E-Mail-Adresse werden gruppiert.
6. Gruppen mit weniger als zwei Einträgen werden ausgeblendet.
7. Ergebnisse werden nach Anzahl absteigend, danach Anzeigename aufsteigend sortiert.
8. Das Overlay zeigt Zusammenfassung und Gruppenliste.

## 6.3 Absender bearbeiten

1. Nutzer klickt in einer Gruppe **„Alle im Posteingang finden“**.
2. Overlay zeigt Sicherheitsvorschau:
   - Anzeigename;
   - E-Mail-Adresse;
   - erkannte Einträge der Ausgangsseite;
   - Suchanfrage;
   - Hinweis auf mögliche vollständige Unterhaltungen.
3. Nutzer klickt **„Suche starten“**.
4. Add-on trägt die Suchanfrage in Gmails native Suchleiste ein.
5. Add-on wartet ereignisbasiert auf die aktualisierte Ergebnisliste.
6. Add-on prüft, ob die Suchleiste die erwartete Anfrage enthält.
7. Add-on klickt die Checkbox zur Auswahl der aktuellen Suchergebnisseite.
8. Add-on versucht, den Link beziehungsweise Button zur Auswahl aller Treffer dieser Suche zu aktivieren.
9. Wenn kein solcher Link erforderlich oder vorhanden ist:
   - Bei nachweislich nur einer Ergebnisseite wird fortgefahren.
   - Bei unklarem Zustand wird pausiert und der Nutzer zur manuellen Auswahl aller Treffer aufgefordert.
10. Nach gesicherter Auswahl öffnet das Add-on das native Gmail-Menü **„Verschieben nach“**.
11. Overlay wechselt in den Zustand **„Ziel in Gmail auswählen“**.
12. Nutzer wählt in Gmail ein vorhandenes Label oder Gmails native Option zur Erstellung eines neuen Labels.
13. Add-on beobachtet Ergebnisliste und Gmail-Statusmeldungen.
14. Bei plausibel abgeschlossenem Vorgang markiert es die Gruppe als erledigt.
15. Nutzer kann die nächste Gruppe bearbeiten, ohne erneut zur ursprünglichen Inbox-Seite zurückkehren zu müssen.

## 6.4 Abbruch

Der Overlay-Button **„Abbrechen“**:

- stoppt nur die Add-on-Automatisierung;
- kann bereits durch Gmail ausgeführte Aktionen nicht zurücknehmen;
- schließt kein geöffnetes Gmail-Menü gewaltsam;
- setzt die interne Zustandsmaschine in `RESULTS_READY` oder `IDLE`;
- weist bei bereits erfolgter Verschiebung auf Gmails native Rückgängig-Funktion hin.

---

# 7. UX- und UI-Spezifikation

## 7.1 Overlay-Position

Desktop-Standard:

- `position: fixed`;
- rechts: `16px`;
- oben: `80px`;
- Breite: `380px`;
- maximale Breite: `min(380px, calc(100vw - 32px))`;
- maximale Höhe: `calc(100vh - 112px)`;
- interner Scrollbereich;
- hoher, aber kontrollierter `z-index`;
- Gmail-Snackbarbereich unten links bleibt frei.

Bei Viewports unter 720 px Breite:

- Overlay nutzt links und rechts je `8px`;
- Breite `auto`;
- maximale Höhe `55vh`;
- Warnung „Schmales Fenster – Gmail-Bedienelemente können verdeckt sein“.

## 7.2 Shadow DOM

Das Overlay MUSS in einem eigenen offenen Shadow Root gerendert werden.

Vorgaben:

- Host-ID: `giso-extension-root`;
- CSS beginnt im Shadow Root mit kontrolliertem Reset;
- keine globalen CSS-Regeln;
- Gmail-CSS darf das Overlay nicht gestalten;
- das Add-on darf Gmail-CSS nicht verändern, außer einem temporären Highlight-Attribut auf gefundenen nativen Bedienelementen;
- alle Nutzerwerte werden mit `textContent`, niemals ungeprüft mit `innerHTML`, eingefügt.

## 7.3 Grundzustand

Elemente:

- Titel: **„Inbox Sender Organizer“**
- Statuszeile: **„Bereit“**
- Primärbutton: **„Posteingang analysieren“**
- Sekundärbutton: **„Schließen“**
- Linkbutton: **„Diagnose“**
- nicht interaktiver Footerhinweis: **„made by Ceegore“**
- kurzer Hinweis:  
  **„Analysiert nur die aktuell geladene Inbox-Seite. Die spätere Suche kann alle passenden Inbox-Treffer erfassen.“**

## 7.4 Analysezustand

- Spinner;
- Text: **„Posteingang wird analysiert …“**
- Fortschrittswerte:
  - erkannte Listeneinträge;
  - erfolgreich erkannte Absender;
  - nicht eindeutig erkannte Einträge.
- Button: **„Abbrechen“**

Da die Analyse nur eine Seite umfasst, ist kein künstlich animierter Prozentwert erlaubt.

## 7.5 Ergebniszustand

Kopfbereich:

- **„Analyse abgeschlossen“**
- Zusammenfassung:  
  `{{rowCount}} Einträge geprüft · {{groupCount}} wiederkehrende Absender · {{unresolvedCount}} nicht eindeutig`
- Suchfeld: Platzhalter **„Absender filtern …“**
- Sortierung:
  - **„Häufigste zuerst“** – Standard;
  - **„Name A–Z“**;
  - **„Adresse A–Z“**.

Gruppenzeile:

- Anzeigename fett;
- E-Mail-Adresse kleiner;
- Badge `{{count}} Einträge`;
- optional mehrere Anzeigenamen als Hinweis;
- Button **„Alle im Posteingang finden“**;
- Menübutton mit **„Für diese Sitzung ignorieren“**.

Nicht eindeutig erkannte Einträge erscheinen nicht als normale Gruppe. Stattdessen gibt es einen einklappbaren Bereich:

- **„{{count}} Einträge konnten nicht sicher zugeordnet werden“**
- Button **„Details anzeigen“**
- pro Eintrag: erkannter Anzeigename, Grund und Diagnosecode;
- keine globale Aktion, solange keine validierte E-Mail-Adresse vorliegt.

## 7.6 Sicherheitsvorschau

Dialog innerhalb des Overlays:

**Titel:** „Gesamten Posteingang durchsuchen?“

Text:

> Gmail sucht nach allen Inbox-Treffern von diesem Absender. Bei aktivierter Konversationsansicht können vollständige Unterhaltungen ausgewählt werden.

Felder:

- Absender;
- Adresse;
- sichtbare Ausgangstreffer;
- Suchanfrage in monospace.

Buttons:

- Primär: **„Suche starten“**
- Sekundär: **„Zurück“**

## 7.7 Automatisierungsfortschritt

Schrittanzeige:

1. `Suche öffnen`
2. `Ergebnisse auswählen`
3. `Alle Treffer auswählen`
4. `Verschieben-Menü öffnen`
5. `Ziel in Gmail auswählen`

Zustände je Schritt:

- ausstehend;
- aktiv;
- erledigt;
- Hilfe nötig;
- fehlgeschlagen.

Während automatischer Klickschritte ist die Gruppenliste gesperrt.

## 7.8 Native Zielauswahl

Nach Öffnen des Gmail-Menüs:

**Titel:** „Ziel jetzt in Gmail auswählen“

Text:

> Wähle im geöffneten Gmail-Menü ein vorhandenes Label oder „Neu erstellen“. Das Add-on führt die Verschiebung nicht ohne deine Auswahl aus.

Buttons:

- **„Menü erneut öffnen“**
- **„Ich bin fertig“**
- **„Abbrechen“**

Das Overlay darf das native Menü nicht überdecken. Falls nötig, wird es automatisch um maximal 420 px nach unten oder links verschoben.

## 7.9 Abschlusszustand

Erfolgreich:

- Icon;
- **„Absender bearbeitet“**
- `{{sender}} wurde als erledigt markiert.`
- Buttons:
  - **„Nächsten Absender bearbeiten“**
  - **„Zur Ergebnisliste“**

Unsicher:

- **„Abschluss nicht eindeutig erkannt“**
- Text:  
  **„Prüfe die Gmail-Ergebnisliste. Wenn die Nachrichten verschoben wurden, markiere die Gruppe als erledigt.“**
- Buttons:
  - **„Als erledigt markieren“**
  - **„Erneut versuchen“**
  - **„Zurück“**

## 7.10 Fehlermeldungsformat

Jede Fehlermeldung enthält:

1. klare Nutzerbeschreibung;
2. ungefährliche nächste Aktion;
3. Diagnosecode;
4. kopierbare Diagnosedetails nur im Diagnosebereich.

Beispiel:

> **Gmails Auswahlleiste wurde nicht gefunden.**  
> Wähle die Treffer manuell aus und klicke danach auf „Fortsetzen“.  
> Diagnose: `GISO-DOM-SELECT-001`

---

# 8. Exakte deutsche UI-Texte

Die folgenden Texte sind verbindlich und müssen zentral in `src/i18n/de.ts` liegen.

```ts
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
  stepSearch: "Suche öffnen",
  stepSelectPage: "Ergebnisse auswählen",
  stepSelectAll: "Alle Treffer auswählen",
  stepOpenMove: "Verschieben-Menü öffnen",
  stepChooseTarget: "Ziel in Gmail auswählen",
  chooseTargetTitle: "Ziel jetzt in Gmail auswählen",
  chooseTargetBody:
    "Wähle im geöffneten Gmail-Menü ein vorhandenes Label oder „Neu erstellen“. Das Add-on führt die Verschiebung nicht ohne deine Auswahl aus.",
  reopenMenu: "Menü erneut öffnen",
  done: "Ich bin fertig",
  senderProcessed: "Absender bearbeitet",
  nextSender: "Nächsten Absender bearbeiten",
  resultList: "Zur Ergebnisliste",
  completionUncertain: "Abschluss nicht eindeutig erkannt",
  completionUncertainBody:
    "Prüfe die Gmail-Ergebnisliste. Wenn die Nachrichten verschoben wurden, markiere die Gruppe als erledigt.",
  markDone: "Als erledigt markieren",
  retry: "Erneut versuchen",
  continue: "Fortsetzen",
  copyDiagnostics: "Diagnose kopieren",
  noGroups:
    "Auf der aktuell geladenen Seite wurden keine Absender mit mindestens zwei Einträgen gefunden.",
  notInbox:
    "Öffne den Gmail-Posteingang oder eine Inbox-Kategorie und starte die Analyse erneut.",
  gmailNotReady:
    "Gmail ist noch nicht vollständig geladen. Warte kurz und versuche es erneut.",
  unsafeState:
    "Die Gmail-Oberfläche konnte nicht sicher erkannt werden. Es wurde nichts angeklickt.",
  searchFailed:
    "Die globale Gmail-Suche konnte nicht sicher gestartet werden.",
  selectFailed:
    "Gmails Auswahlleiste wurde nicht gefunden.",
  selectAllHelp:
    "Wähle in Gmail alle Treffer dieser Suche aus und klicke danach auf „Fortsetzen“.",
  moveMenuFailed:
    "Das Gmail-Menü „Verschieben nach“ konnte nicht geöffnet werden.",
  nativeUndoHint:
    "Eine bereits ausgeführte Gmail-Aktion kann gegebenenfalls über Gmails „Rückgängig“-Hinweis zurückgenommen werden."
} as const;
```

---

# 9. Funktionale Anforderungen

## FR-001 – Overlay-Injektion

- Pro Gmail-Tab darf exakt ein Overlay-Host existieren.
- Wiederholte Initialisierung darf kein Duplikat erzeugen.
- Ein Toolbar-Klick toggelt sichtbar/unsichtbar.
- Gmail-interne Navigation darf das Overlay nicht zerstören.
- Wird der Host von Gmail entfernt, stellt ein begrenzter Observer ihn wieder her.

## FR-002 – Ansichtserkennung

Analyse ist nur erlaubt, wenn:

- Hostname exakt `mail.google.com` ist;
- ein Gmail-Hauptbereich erkannt wurde;
- eine Nachrichtenliste existiert;
- die aktuelle Ansicht als Inbox oder Inbox-Kategorie klassifiziert wird;
- keine Suchanfrage aktiv ist.

Die Ansichtserkennung verwendet eine Kombination aus:

- URL-Hash;
- leerer nativer Gmail-Suchleiste;
- zentraler Listenstruktur;
- sichtbaren Inbox-/Kategoriehinweisen;
- Vorhandensein typischer Nachrichtenzeilen.

Ein einzelnes Textlabel reicht nicht als Beweis.

## FR-003 – Listeneinträge sammeln

- Es werden nur Einträge innerhalb des primären Nachrichtenlistencontainers erfasst.
- Navigations-, Werbe-, Kontakt-, Chat- und Einstellungszeilen werden ausgeschlossen.
- Mehrfach gefundene DOM-Repräsentationen desselben Eintrags werden dedupliziert.
- Einträge müssen eine interaktive Öffnungsfläche oder eine Gmail-Zeilenstruktur besitzen.
- Mindestanzahl für eine Analyse: 1.

## FR-004 – Absender extrahieren

Prioritätskette:

1. Elementattribut `email` mit valider Adresse;
2. `data-hovercard-id` mit valider Adresse;
3. `data-email` mit valider Adresse;
4. `title` mit parsbarer Adresse;
5. `aria-label` mit parsbarer Adresse;
6. Textfragment im Senderbereich mit parsbarer Adresse;
7. optionaler kontrollierter Hovercard-Resolver;
8. sonst `UNRESOLVED`.

Die Erweiterung DARF eine reine Anzeigenamengruppe nicht global bearbeiten.

## FR-005 – E-Mail-Normalisierung

- trimmen;
- umgebende spitze Klammern entfernen;
- Domain in Kleinbuchstaben;
- lokaler Teil ebenfalls in Kleinbuchstaben als pragmatischer Gruppenschlüssel;
- Unicode-Domain über Browser-URL-/IDN-Funktionen normalisieren;
- keine anbieterspezifische Entfernung von Punkten oder Plus-Tags;
- Syntaxvalidierung pragmatisch, nicht überrestriktiv;
- maximal 320 Zeichen;
- Steuerzeichen verboten.

Beispiel:

`"Shop <NEWS@Example.COM>"` → `news@example.com`

## FR-006 – Gruppierung

```text
groupKey = normalizedEmail
```

- `visibleEntryCount` zählt eindeutige Gmail-Listeneinträge.
- Anzeigenamen werden als Set gesammelt.
- Primärer Anzeigename ist der häufigste nichtleere Name.
- Bei Gleichstand wird der zuerst erkannte Name verwendet.
- Gruppen mit `visibleEntryCount < 2` werden nicht angezeigt.
- Gleiche Anzeigenamen mit verschiedenen Adressen bleiben getrennt.
- Gleiche Adresse mit verschiedenen Anzeigenamen wird zusammengeführt.

## FR-007 – Gmail-Suchanfrage

Verbindliches Format:

```text
in:inbox "from:normalized@example.com"
```

Voraussetzungen:

- Adresse wurde validiert;
- keine freien Nutzereingaben werden ungefiltert in Operatoren eingebaut;
- die angezeigte Vorschau entspricht exakt dem verwendeten String.

Die Suche wird über Gmails native Suchleiste ausgelöst, nicht über undokumentierte Netzwerkendpunkte.

## FR-008 – Suche ausführen

1. Suchbox erkennen;
2. fokussieren;
3. bestehenden Wert über den nativen Input-Setter ersetzen;
4. `input`- und `change`-Events auslösen;
5. Enter-Tastaturereignis auslösen;
6. falls nötig nativen Suchbutton anklicken;
7. auf Zustandsänderung warten;
8. Suchboxwert gegen Sollwert prüfen;
9. Ergebnislisten-Fingerprint muss sich ändern.

Wenn Schritt 8 oder 9 nicht bestätigt wird, erfolgt kein Auswahlklick.

## FR-009 – Aktuelle Ergebnisseite auswählen

- Auswahl-Checkbox in der Ergebnis-Toolbar semantisch erkennen.
- Nicht die Checkbox einer einzelnen Nachricht klicken.
- Nach dem Klick muss ein sichtbarer Auswahlzustand oder eine veränderte Toolbar bestätigt werden.
- Bei fehlender Bestätigung nach Retry wird pausiert.

## FR-010 – Alle Suchtreffer auswählen

Das Add-on versucht, die Gmail-Aktion zur Erweiterung von der aktuellen Seite auf alle Treffer zu erkennen.

Erkennung über:

- klickbares Element in einem Banner/Statusbereich oberhalb der Liste;
- deutsche oder englische Lexikonmuster;
- zeitliche Entstehung nach Auswahl der aktuellen Seite;
- Bezug auf „alle“ und „Treffer/Unterhaltungen/Nachrichten“;
- Ausschluss von „Auswahl aufheben“.

Wichtig: Diese Gmail-Funktion ist keine garantierte öffentliche API. Wenn sie nicht sicher erkannt wird:

- Das Add-on DARF nicht behaupten, alle Treffer seien ausgewählt.
- Das Add-on zeigt die manuelle Anweisung.
- Nutzer klickt in Gmail selbst.
- Nutzer bestätigt im Overlay mit **„Fortsetzen“**.
- Danach wird das Verschieben-Menü geöffnet.

## FR-011 – Eine Ergebnisseite erkennen

Das Add-on darf ohne „Alle Treffer auswählen“-Link fortfahren, wenn mindestens eine der folgenden Bedingungen sicher erfüllt ist:

1. Gmail zeigt eine Gesamtzahl, die kleiner oder gleich der Zahl ausgewählter Zeilen ist;
2. es existiert keine Seitennavigation zu einer Folgeseite und alle Ergebniszeilen sind ausgewählt;
3. Gmail zeigt ausdrücklich an, dass alle passenden Treffer ausgewählt sind.

Ist keine Bedingung sicher, erfolgt manueller Fallback.

## FR-012 – Verschieben-Menü öffnen

- Button semantisch anhand Rolle, Tooltip, ARIA-Label und Toolbar-Kontext erkennen.
- Deutsche Kandidaten: „Verschieben nach“, „Verschieben“, „In … verschieben“.
- Englische Kandidaten: „Move to“, „Move“.
- Nach Klick muss ein Menü/Dialog erscheinen.
- Das Add-on wählt selbst kein Label.
- Bei fehlendem Menü wird höchstens einmal erneut geklickt.

## FR-013 – Neues Label

V1 verlässt sich auf Gmails native Möglichkeiten.

- Wenn das geöffnete Gmail-Menü eine Option „Neu erstellen“/„Create new“ enthält, kann der Nutzer sie verwenden.
- Wenn Gmail diese Option im konkreten Menü nicht anbietet, zeigt das Overlay:
  **„Erstelle das Label über Gmails native Labelverwaltung und öffne danach das Verschieben-Menü erneut.“**
- Das Add-on implementiert keinen eigenen Label-Erstellungsdialog.

## FR-014 – Abschluss erkennen

Abschlussindikatoren mit absteigender Vertrauensstufe:

1. Gmail-Snackbar/Statusmeldung deutet auf Verschieben hin;
2. geöffnete Menüstruktur verschwindet nach Nutzerauswahl und Ergebniszahl sinkt;
3. Ergebnisliste wird leer;
4. aktuelle Gruppe enthält in der Suchliste keine Inbox-Treffer mehr;
5. Nutzer bestätigt manuell „Ich bin fertig“.

Automatische Erkennung markiert nur die Add-on-Sitzung als erledigt. Sie ist keine Garantie über Gmails Serverzustand.

## FR-015 – Sitzung

- Analyseergebnisse leben im Speicher des Content Scripts.
- Keine E-Mail-Adresse wird standardmäßig in `storage.local` geschrieben.
- Ein Gmail-Reload beendet die Sitzung.
- Einstellungswerte dürfen persistent sein.
- Erledigt-/Ignoriert-Status gilt nur für die aktuelle Sitzung.

## FR-016 – erneute Analyse

Eine erneute Analyse ersetzt die bisherige Ergebnisliste vollständig, nachdem der Nutzer bestätigt hat, falls unbearbeitete Gruppen vorhanden sind.

---

# 10. Technische Architektur

## 10.1 Komponenten

```text
Firefox Toolbar Action
        │
        ▼
Background Event Script
        │ browser.tabs.sendMessage
        ▼
Gmail Content Script
        ├── Bootstrap / Lifetime Manager
        ├── Overlay UI im Shadow DOM
        ├── Application State Store
        ├── Inbox Analyzer
        ├── Sender Extractor
        ├── Gmail Search Controller
        ├── Selection Controller
        ├── Native Move Menu Controller
        ├── Workflow State Machine
        ├── DOM Adapter Registry
        ├── Mutation / Route Observers
        ├── Diagnostics
        └── Settings Adapter
```

## 10.2 Architekturentscheidung: Content-Script-zentriert

Alle Gmail-DOM-Operationen laufen im isolierten Content-Script-Kontext.

Das Background-Script hat nur folgende Aufgaben:

- Toolbar-Aktion empfangen;
- aktiven Tab ermitteln;
- Toggle-Nachricht senden;
- bei nicht erreichbarem Content Script Gmail öffnen;
- optional Build-/Versionsinformationen liefern.

Es enthält keine Gmail-Daten und keine Geschäftslogik.

## 10.3 Keine MAIN-World-Injektion

Das Content Script MUSS im standardmäßigen isolierten Kontext laufen. Es darf keine Gmail-internen JavaScript-Objekte, privaten APIs oder Angular/Closure-Interna verwenden.

## 10.4 Keine Netzwerklogik

Produktiver Code DARF NICHT:

- `fetch` zu Google oder Dritten verwenden;
- `XMLHttpRequest` verwenden;
- Gmail-interne RPC-Endpunkte aufrufen;
- Cookies lesen;
- Google-Tokens auslesen;
- Requests abfangen;
- Remote-Skripte laden.

Ein statischer Linter-Test muss verbotene Netzwerkaufrufe in `src/` erkennen, sofern sie nicht ausdrücklich in einem Test-Mock liegen.

---

# 11. Manifest-V3-Spezifikation

Verbindliche Ausgangsversion:

```json
{
  "manifest_version": 3,
  "name": "Inbox Sender Organizer",
  "version": "1.0.0",
  "description": "Gruppiert wiederkehrende Absender auf der aktuellen Gmail-Inbox-Seite und unterstützt das globale Verschieben über Gmails native Oberfläche.",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://mail.google.com/*"
  ],
  "background": {
    "scripts": [
      "background.js"
    ]
  },
  "action": {
    "default_title": "Inbox Sender Organizer",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "https://mail.google.com/*"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png"
  },
  "incognito": "not_allowed",
  "browser_specific_settings": {
    "gecko": {
      "id": "{a3f84f1e-3947-4fe6-8d31-6d5deff1ae71}",
      "strict_min_version": "140.0",
      "data_collection_permissions": {
        "required": [
          "none"
        ]
      }
    }
  }
}
```

## 11.1 Manifest-Regeln

- Die verbindliche Add-on-ID lautet `{a3f84f1e-3947-4fe6-8d31-6d5deff1ae71}` und DARF nach der ersten signierten Version nicht geändert werden.
- `strict_min_version` bleibt auf Firefox 140 oder höher, solange keine eigene Consent-Lösung für ältere Versionen implementiert wird.
- Keine Berechtigung `tabs`, `cookies`, `webRequest`, `identity`, `notifications`, `clipboardRead`, `clipboardWrite`, `<all_urls>` oder `scripting`.
- Falls eine zukünftige Funktion eine zusätzliche Berechtigung benötigt, ist dies eine neue Produktversion mit Datenschutzreview.
- Kein `update_url` für öffentlich über AMO verteilte Versionen.
- Produktionsbundles werden als klassische IIFE-Skripte erzeugt; keine Annahme persistenter Background-Laufzeit.

---

# 12. Datenmodell

```ts
export type Confidence = "high" | "medium" | "low" | "unresolved";

export interface SenderIdentity {
  normalizedEmail: string | null;
  rawEmail: string | null;
  displayName: string | null;
  source:
    | "email-attribute"
    | "hovercard-id"
    | "data-email"
    | "title"
    | "aria-label"
    | "visible-text"
    | "hovercard"
    | "none";
  confidence: Confidence;
  diagnostics: string[];
}

export interface AnalyzedEntry {
  fingerprint: string;
  sender: SenderIdentity;
  rowIndex: number;
}

export type GroupStatus =
  | "ready"
  | "ignored"
  | "in-progress"
  | "done"
  | "error";

export interface SenderGroup {
  id: string;
  normalizedEmail: string;
  displayNames: string[];
  primaryDisplayName: string;
  visibleEntryCount: number;
  sourceFingerprints: string[];
  confidence: "high" | "medium";
  status: GroupStatus;
  lastErrorCode?: string;
}

export interface AnalysisResult {
  startedAt: number;
  completedAt: number;
  sourceRoute: {
    accountSlot: number | null;
    view: string;
    fingerprint: string;
  };
  rowCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  duplicateCount: number;
  groups: SenderGroup[];
  unresolvedEntries: AnalyzedEntry[];
}

export type WorkflowState =
  | "IDLE"
  | "ANALYZING"
  | "RESULTS_READY"
  | "CONFIRM_SEARCH"
  | "SETTING_SEARCH"
  | "WAITING_SEARCH_RESULTS"
  | "SELECTING_PAGE"
  | "WAITING_SELECT_ALL"
  | "MANUAL_SELECT_ALL"
  | "OPENING_MOVE_MENU"
  | "WAITING_TARGET_SELECTION"
  | "VERIFYING_COMPLETION"
  | "COMPLETED"
  | "CANCELLED"
  | "ERROR";

export interface WorkflowSession {
  state: WorkflowState;
  groupId: string | null;
  expectedQuery: string | null;
  stateEnteredAt: number;
  abortController: AbortController | null;
  diagnostics: DiagnosticEvent[];
}

export interface Settings {
  minimumOccurrences: 2;
  locale: "de";
  gmailDetectionLocales: Array<"de" | "en">;
  overlayPosition: { top: number; right: number };
  diagnosticsEnabled: boolean;
  confirmBeforeSearch: true;
  autoOpenMoveMenu: true;
}

export interface DiagnosticEvent {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

## 12.1 Verbotene gespeicherte Daten

Nicht persistent speichern:

- erkannte E-Mail-Adressen;
- Anzeigenamen;
- Betreffzeilen;
- Gmail-Zeileninhalte;
- Suchhistorie;
- Nachrichten- oder Thread-IDs;
- Gmail-Kontoidentität;
- DOM-Snapshots aus realen Postfächern.

Diagnoseexporte können solche Daten enthalten und müssen vor Export standardmäßig redigiert werden.

---

# 13. Gmail-DOM-Adapter

## 13.1 Ziel

Die Geschäftslogik darf niemals direkte Gmail-Selektoren enthalten. Alle Erkennung liegt hinter folgenden Interfaces:

```ts
export interface GmailDomAdapter {
  detectShell(): Detection<GmailShell>;
  detectCurrentView(): Detection<GmailView>;
  findSearchBox(): Detection<HTMLInputElement>;
  findMessageList(): Detection<HTMLElement>;
  findMessageRows(list: HTMLElement): Detection<HTMLElement[]>;
  extractSender(row: HTMLElement): SenderIdentity;
  findPageSelectControl(): Detection<HTMLElement>;
  detectPageSelection(): Detection<SelectionState>;
  findSelectAllMatchesControl(): Detection<HTMLElement | null>;
  detectAllMatchesSelected(): Detection<boolean>;
  findMoveControl(): Detection<HTMLElement>;
  detectMoveMenu(): Detection<HTMLElement>;
  detectCompletion(context: CompletionContext): Detection<CompletionEvidence>;
}

export interface Detection<T> {
  ok: boolean;
  value?: T;
  confidence: number;
  evidence: string[];
  errorCode?: string;
}
```

## 13.2 Erkennungsprinzip

Jede Erkennung verwendet mehrere Signale. Ein Kandidat erhält Punkte.

Beispiel Button-Scoring:

- `role="button"`: +20;
- passendes deutsches ARIA-Label: +35;
- passendes englisches ARIA-Label: +35;
- innerhalb erkannter Gmail-Toolbar: +25;
- sichtbar und aktiv: +10;
- enthält widersprüchliches Label: −60;
- innerhalb einer Nachrichtenzeile statt Toolbar: −80.

Nur Kandidaten über dem festgelegten Schwellwert werden geklickt.

## 13.3 Verbotene Selektorstrategie

Nicht zulässig:

```ts
document.querySelector(".T-I.J-J5-Ji.ar7.nf.T-I-ax7.L3")
```

als alleiniger Selektor.

Generierte Klassen dürfen ausschließlich als schwache Zusatzsignale oder temporäre Fixture-Hinweise genutzt werden.

## 13.4 Bevorzugte Signale

Reihenfolge:

1. native Attribute mit semantischer Bedeutung;
2. ARIA-Rollen;
3. ARIA-Labels und Tooltips;
4. stabile Datenattribute wie E-Mail-Adresse;
5. strukturelle Position relativ zur Liste oder Toolbar;
6. Textlexikon;
7. CSS-Klassen nur als letzte, niedrig gewichtete Hilfe.

## 13.5 Sichtbarkeit

Ein Element gilt als bedienbar, wenn:

- `isConnected`;
- keine `hidden`-Eigenschaft;
- `aria-hidden` nicht `true`;
- `display` nicht `none`;
- `visibility` nicht `hidden`;
- Bounding Box größer als 2×2 px;
- nicht `disabled`;
- nicht durch das Overlay verdeckt.

## 13.6 Route- und DOM-Beobachtung

Gmail ist eine Single-Page-Anwendung. Der Adapter MUSS:

- Änderungen an `location.href` beziehungsweise Hash erfassen;
- `popstate` und `hashchange` beobachten;
- einen debouncten `MutationObserver` auf den App-Root anwenden;
- keine vollständige Analyse bei jeder Mutation starten;
- nur den DOM-Cache invalidieren;
- Observer beim Entfernen des Content Scripts beziehungsweise Tab-Schließen automatisch verlieren;
- den Observer bei Overlay-Schließung nicht zwingend deaktivieren, aber auf minimale Route-Erkennung reduzieren.

## 13.7 MutationObserver-Budget

- Debounce: 150 ms;
- maximale Verarbeitung pro Callback: 8 ms;
- tiefe Vollscans nur bei expliziter Nutzeraktion;
- bei mehr als 1.000 Mutationen in 2 Sekunden Diagnosewarnung und Cooldown von 500 ms;
- keine Polling-Schleife unter 250 ms.

---

# 14. Sender-Extractor im Detail

## 14.1 Zeilenbereich bestimmen

Der Extractor sucht zunächst innerhalb des erkannten Zeilenelements nach einer Senderzone.

Kandidaten:

- Element mit `email`;
- Element mit `data-hovercard-id`;
- interaktives Element am Anfang der Zeile;
- Textbereich vor Betreff-/Snippetbereich;
- Element mit zugänglichem Namen, das eine E-Mail enthält.

## 14.2 Parser

```ts
export function parseEmailCandidate(value: string): {
  displayName: string | null;
  email: string | null;
};
```

Unterstützte Muster:

- `Name <address@example.com>`;
- `<address@example.com>`;
- `address@example.com`;
- `Name (address@example.com)`;
- zugänglicher Text mit genau einer Adresse.

Bei mehreren Adressen:

- keine willkürliche Auswahl;
- `UNRESOLVED_MULTIPLE_EMAILS`.

## 14.3 Hovercard-Fallback

Der Hovercard-Fallback ist in V1 standardmäßig aktiviert, aber nur bei folgenden Bedingungen:

- genau ein plausibles Senderelement;
- direkte Attribute lieferten keine Adresse;
- keine laufende Workflow-Aktion;
- maximal 5 Hovercard-Auflösungen pro Sekunde;
- maximal 20 Hovercard-Versuche pro Analyse;
- simuliertes `pointerover`/`mouseover`;
- Warten bis 1.500 ms auf ein neues sichtbares, zuordenbares Hovercard-Element;
- E-Mail-Adresse muss eindeutig sein;
- Hovercard wird anschließend durch Escape oder Pointerbewegung geschlossen.

Wenn mehr als 20 Zeilen Hovercard benötigen, werden die übrigen als ungelöst markiert, um keine UI-Flut zu erzeugen.

## 14.4 Vertrauensstufen

**High:**

- `email`;
- `data-hovercard-id`;
- `data-email`.

**Medium:**

- eindeutige Adresse in `title`;
- eindeutige Adresse in `aria-label`;
- eindeutige Hovercard.

**Low:**

- E-Mail nur in unspezifischem sichtbaren Text;
- widersprüchliche Anzeigenamen.

Low wird ausschließlich im nicht sicher zugeordneten Detailbereich sichtbar gemacht. Eine Low-Identität darf unabhängig von syntaktischer Validität keine globale Aktion auslösen.

**Unresolved:**

- keine Adresse;
- mehrere Adressen;
- Konflikt zwischen Attributen;
- ungültige Adresse.

## 14.5 Konfliktregel

Wenn zwei Quellen verschiedene valide E-Mail-Adressen liefern:

- Gruppe nicht erstellen;
- Diagnose `GISO-SENDER-CONFLICT-001`;
- kein automatischer Suchworkflow.

---

# 15. Gmail-Suchsteuerung

## 15.1 Native Setter

React-/Framework-gesteuerte Eingaben reagieren möglicherweise nicht auf direkte Zuweisung. Daher:

```ts
function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
```

Danach:

```ts
input.dispatchEvent(
  new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  })
);
input.dispatchEvent(
  new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true
  })
);
```

Falls keine Navigation startet, wird ein erkannter nativer Suchbutton geklickt.

## 15.2 Suchabschluss

`WAITING_SEARCH_RESULTS` gilt als abgeschlossen, wenn alle Bedingungen erfüllt sind:

- Suchbox enthält normalisiert den Sollwert;
- Route oder Listen-Fingerprint hat sich geändert;
- kein sichtbarer Gmail-Ladeindikator;
- Liste oder Leerzustand erkannt;
- Zustand war mindestens 250 ms stabil.

Timeout: 12 Sekunden.

Retry:

- genau ein erneuter Enter-/Suchbuttonversuch;
- weiterer Timeout führt zu manuellem Fallback, nicht zu weiteren Klicks.

## 15.3 Leere Ergebnisse

Wenn keine Treffer gefunden werden:

- Gruppe erhält Status `error`;
- Text: **„Gmail hat für diese Suche keine Inbox-Treffer angezeigt.“**
- keine Auswahlaktion;
- Nutzer kann zur Ergebnisliste zurück.

---

# 16. Auswahl- und Verschiebeworkflow

## 16.1 Sicherheitsinvariante

Vor jedem automatischen Klick muss geprüft werden:

```text
aktueller Workflowzustand erlaubt Aktion
UND erwartete Gmail-Ansicht erkannt
UND genau ein ausreichend sicherer Kandidat
UND Kandidat sichtbar und aktiv
UND vorheriger Schritt bestätigt
```

Andernfalls: stoppen.

## 16.2 Auswahl der aktuellen Seite

- Kandidaten nur innerhalb der Ergebnis-Toolbar.
- Checkboxzustand vor Klick erfassen.
- nach Klick muss Zustand auf ausgewählt/teilweise ausgewählt wechseln oder Aktionsbuttons erscheinen.
- Timeout 4 Sekunden.
- ein Retry zulässig.

## 16.3 Auswahl aller Treffer

Lokalisierungslexikon:

```ts
export const gmailTextPatterns = {
  de: {
    selectAllMatches: [
      /alle .* auswählen, die dieser suche entsprechen/i,
      /alle .* dieser suche auswählen/i,
      /alle .* in dieser ansicht auswählen/i
    ],
    allSelected: [
      /alle .* ausgewählt/i
    ],
    move: [
      /^verschieben nach$/i,
      /^verschieben$/i,
      /in .* verschieben/i
    ],
    createNew: [
      /^neu erstellen$/i,
      /^neues label/i
    ],
    undo: [
      /^rückgängig$/i
    ]
  },
  en: {
    selectAllMatches: [
      /select all .* that match this search/i,
      /select all .* in this view/i
    ],
    allSelected: [
      /all .* selected/i
    ],
    move: [
      /^move to$/i,
      /^move$/i
    ],
    createNew: [
      /^create new$/i,
      /^new label/i
    ],
    undo: [
      /^undo$/i
    ]
  }
} as const;
```

Die Muster dürfen nach Fixture- und Live-Tests erweitert werden, ohne Geschäftslogik zu verändern.

## 16.4 Manuelle Fallbackführung

Wenn der globale Auswahl-Link nicht sicher gefunden wird:

1. Overlay markiert Schritt 3 als **„Hilfe nötig“**.
2. Es hebt den Bereich oberhalb der Gmail-Liste visuell hervor, ohne Klick.
3. Es zeigt:
   **„Klicke in Gmail auf ‚Alle … auswählen, die dieser Suche entsprechen‘. Klicke danach hier auf ‚Fortsetzen‘.“**
4. `Fortsetzen` prüft erneut auf einen globalen Auswahlhinweis.
5. Kann dies nicht bestätigt werden, erscheint eine letzte Checkbox:
   **„Ich bestätige, dass alle gewünschten Treffer ausgewählt sind.“**
6. Erst nach manueller Bestätigung wird das Move-Menü geöffnet.

## 16.5 Move-Menü

Das Menü wird nur geöffnet, wenn:

- irgendein Auswahlzustand bestätigt ist;
- Nutzer die Sicherheitsvorschau bestätigt hat;
- keine andere Gruppe aktiv ist.

Das Add-on darf nicht:

- auf ein konkretes Label klicken;
- Text in die Labelsuche eingeben;
- „Anwenden“ oder „Erstellen“ bestätigen.

---

# 17. Zustandsmaschine

## 17.1 Erlaubte Übergänge

```text
IDLE
 ├─ analyze ─> ANALYZING
 └─ close ─> IDLE

ANALYZING
 ├─ success ─> RESULTS_READY
 ├─ cancel ─> CANCELLED ─> IDLE
 └─ failure ─> ERROR ─> IDLE

RESULTS_READY
 ├─ select group ─> CONFIRM_SEARCH
 ├─ reanalyze ─> ANALYZING
 └─ close ─> RESULTS_READY (Overlay verborgen)

CONFIRM_SEARCH
 ├─ confirm ─> SETTING_SEARCH
 └─ back ─> RESULTS_READY

SETTING_SEARCH
 ├─ submitted ─> WAITING_SEARCH_RESULTS
 ├─ cancel ─> CANCELLED
 └─ failure ─> ERROR

WAITING_SEARCH_RESULTS
 ├─ ready ─> SELECTING_PAGE
 ├─ no results ─> ERROR
 ├─ cancel ─> CANCELLED
 └─ timeout ─> ERROR

SELECTING_PAGE
 ├─ selected ─> WAITING_SELECT_ALL
 ├─ manual needed ─> MANUAL_SELECT_ALL
 └─ failure ─> ERROR

WAITING_SELECT_ALL
 ├─ all selected ─> OPENING_MOVE_MENU
 ├─ single page confirmed ─> OPENING_MOVE_MENU
 ├─ manual needed ─> MANUAL_SELECT_ALL
 └─ failure ─> ERROR

MANUAL_SELECT_ALL
 ├─ confirmed ─> OPENING_MOVE_MENU
 ├─ cancel ─> CANCELLED
 └─ failure ─> ERROR

OPENING_MOVE_MENU
 ├─ menu visible ─> WAITING_TARGET_SELECTION
 ├─ manual open ─> WAITING_TARGET_SELECTION
 └─ failure ─> ERROR

WAITING_TARGET_SELECTION
 ├─ evidence ─> VERIFYING_COMPLETION
 ├─ manual done ─> VERIFYING_COMPLETION
 └─ cancel ─> CANCELLED

VERIFYING_COMPLETION
 ├─ confirmed ─> COMPLETED
 ├─ uncertain/manual done ─> COMPLETED
 └─ failure ─> ERROR

COMPLETED
 ├─ next ─> RESULTS_READY
 └─ reanalyze ─> ANALYZING
```

## 17.2 Illegaler Übergang

Jeder illegale Übergang:

- wird ignoriert;
- protokolliert `GISO-STATE-ILLEGAL-001`;
- erzeugt keinen DOM-Klick.

---

# 18. Zeitsteuerung, Retries und Abbruch

## 18.1 Keine starren Ablaufketten

Verboten:

```ts
clickSearch();
await sleep(2000);
clickSelectAll();
await sleep(1000);
clickMove();
```

Erlaubt ist nur:

- ereignisbasierte Beobachtung;
- kurze Stabilitätsfenster;
- begrenzte Timeouts;
- Schrittbestätigung.

## 18.2 Standard-Timeouts

| Vorgang | Timeout | Retries |
|---|---:|---:|
| Gmail Shell erkennen | 10 s | 1 |
| Analyse einer Seite | 8 s | 0 |
| Hovercard je Zeile | 1,5 s | 0 |
| Suche starten | 12 s | 1 |
| Seitenauswahl bestätigen | 4 s | 1 |
| Global-Auswahl-Link warten | 4 s | 0 |
| Move-Menü öffnen | 4 s | 1 |
| Abschluss automatisch erkennen | 15 s | 0 |

## 18.3 AbortController

Jeder Workflow besitzt einen `AbortController`.

Bei Abbruch:

- Observer-Promises lösen mit `AbortError`;
- keine weiteren Klicks;
- temporäre Highlights entfernen;
- interner aktiver Gruppenstatus zurück auf `ready`, sofern kein Abschluss nachweisbar;
- Diagnoseevent schreiben.

---

# 19. Datenschutz und Sicherheit

## 19.1 Datenschutzmodell

Das Add-on verarbeitet lokal:

- Absendernamen;
- E-Mail-Adressen;
- Anzahl sichtbarer Listeneinträge;
- Gmail-DOM-Zustände.

Es besitzt keine extension-eigenen Netzwerkübertragungen und übermittelt keine Daten an den Entwickler, Analyse-, Werbe- oder sonstige developer-kontrollierte Dienste. Erst nach ausdrücklicher Nutzerbestätigung wird die ausgewählte Adresse in Gmails eigene Suchbox geschrieben und von Google als normale Gmail-Nutzeraktion verarbeitet.

## 19.2 Datenminimierung

Das Add-on liest nur DOM-Bereiche, die für folgende Aufgaben nötig sind:

- Absenderidentifikation;
- Suchfeld;
- Ergebnisliste;
- Auswahlleiste;
- Move-Menü;
- Gmail-Statusmeldung.

Es DARF NICHT gezielt auslesen:

- Nachrichtentexte;
- Snippets, sofern nicht technisch unvermeidbar im Zeilen-DOM vorhanden;
- Anhänge;
- Kontakte;
- Kalender;
- Chat;
- Drive;
- Kontoeinstellungen.

## 19.3 Diagnose-Redaktion

Diagnoseexport ersetzt standardmäßig:

- lokale Teile von E-Mail-Adressen durch Hash-Präfix;
- Anzeigenamen durch `[NAME]`;
- Betreff-/Snippettexte durch `[REDACTED]`;
- URL-Kontopfade `/u/<n>/` dürfen erhalten bleiben;
- vollständige HTML-Fragmente werden nicht exportiert.

Beispiel:

`newsletter@example.com` → `email_sha256_8:4a7d1ed4@example.com`

## 19.4 Kein Remote Code

- keine CDN-Abhängigkeiten;
- keine dynamischen Imports von Remote-URLs;
- keine `eval`-/`new Function`-Nutzung;
- keine verschleierten/minifizierten Quellen ohne beigefügten reproduzierbaren Source-Build für AMO;
- Source Maps nur in Entwicklungsartefakten, nicht zwingend im Release-XPI.

## 19.5 XSS-Vermeidung

- Nutzerdaten ausschließlich per `textContent`;
- keine HTML-Templates mit interpolierten Mailwerten;
- URL nicht aus Nutzertext konstruieren;
- Suchquery nur aus validierter Adresse;
- Diagnose JSON sicher serialisieren;
- keine event-handler strings.

## 19.6 Least Privilege

Nur:

- Gmail-Hostzugriff;
- `storage` für Einstellungen.

## 19.7 Fehlklickschutz

- keine automatische Massenaktion direkt nach Analyse;
- Sicherheitsdialog;
- genaue Absenderadresse sichtbar;
- jeder Schritt verifiziert;
- bei Unsicherheit stoppen;
- Labelwahl immer durch Nutzer.

---

# 20. Barrierefreiheit

## 20.1 Tastatur

- Toolbar-Klick öffnet Overlay.
- Fokus wird beim Öffnen auf die Überschrift oder den ersten Button gesetzt.
- Tab-Reihenfolge logisch.
- Escape:
  - schließt nur Dialog;
  - bei laufender Automation fragt nach Abbruch;
  - schließt Overlay nicht unbemerkt während kritischem Schritt.
- Enter aktiviert fokussierten Button.
- Listenmenüs per Pfeiltasten.

## 20.2 ARIA

- Overlay-Hauptbereich: `role="dialog"` und `aria-label="Inbox Sender Organizer"`;
- nicht modal, außer Sicherheitsdialog;
- Statusmeldungen: `aria-live="polite"`;
- Fehler: `role="alert"`;
- Progress Steps als geordnete Liste;
- Buttons besitzen sichtbare Namen;
- Icons nie alleiniger Informationsträger.

## 20.3 Kontrast

- WCAG-AA-Ziel;
- Fokusrahmen mindestens 2 px;
- Status nicht nur über Farbe;
- Dark- und Light-Mode über `prefers-color-scheme`, nicht über Gmail-CSS.

## 20.4 Zoom

Funktional bei:

- 80 %;
- 100 %;
- 125 %;
- 150 %;
- 200 %.

---

# 21. Internationalisierung

## 21.1 Add-on-Sprache

V1-Oberfläche ausschließlich Deutsch.

## 21.2 Gmail-Erkennung

V1 unterstützt Gmail UI:

- Deutsch;
- Englisch.

Die Gmail-Sprache wird nicht aus einer einzelnen Einstellung gelesen, sondern anhand mehrerer sichtbarer Bedienelemente geschätzt.

Bei unbekannter Sprache:

- Analyse und Senderextraktion können funktionieren;
- automatisierte Suche kann funktionieren;
- Auswahl-/Move-Erkennung wird konservativer;
- Nutzer erhält:
  **„Diese Gmail-Oberflächensprache wird noch nicht vollständig unterstützt. Die Suche wurde geöffnet; führe Auswahl und Verschieben bitte manuell aus.“**

## 21.3 Textnormalisierung

Für Erkennung:

- Unicode NFKC;
- trim;
- Mehrfachleerzeichen reduzieren;
- typografische Anführungszeichen vereinheitlichen;
- Kleinschreibung über Locale-unabhängiges Mapping;
- keine Übersetzung durch externe Dienste.

---

# 22. Einstellungen

V1-Optionen:

1. **Overlay-Position zurücksetzen**
2. **Diagnosemodus aktivieren**
3. **Automatisch das Verschieben-Menü öffnen** – Standard an
4. **Sicherheitsdialog vor jeder Suche** – fest an, nicht deaktivierbar
5. **Gmail-Erkennungssprachen** – Deutsch und Englisch fest aktiv
6. **Einstellungen zurücksetzen**

Nicht einstellbar:

- Mindestanzahl bleibt in V1 exakt 2;
- kein vollautomatisches Verschieben;
- keine persistente Senderhistorie;
- keine Cloudfunktion.

---

# 23. Diagnosemodus

## 23.1 Zweck

Der Diagnosemodus unterstützt Gmail-DOM-Änderungen, ohne Nutzerdaten unnötig zu sammeln.

## 23.2 Anzeige

- Add-on-Version;
- Firefox-Version, sofern über User Agent verfügbar;
- aktuelle Route redigiert;
- erkannter Gmail-Locale;
- Adapterversion;
- erkannte Shell-Komponenten;
- Anzahl Kandidaten und Scores;
- letzter Fehlercode;
- Zustandsverlauf;
- redigierte Senderquellen;
- keine kompletten Mailzeilen.

## 23.3 DOM-Kalibrierung

Button **„Elementerkennung prüfen“** führt nur lesende Erkennung aus:

- Suchbox;
- Nachrichtenliste;
- Zeilen;
- Seitenauswahl;
- Move-Button, sofern sichtbar.

Es klickt nichts.

## 23.4 Diagnoseexport

Dateiname:

```text
giso-diagnostics-YYYYMMDD-HHmmss.json
```

Der Export benötigt `downloads` nicht zwingend, wenn ein Blob-Link im Overlay erzeugt und vom Nutzer angeklickt wird.

Export enthält eine Warnung:

> Prüfe die Datei vor dem Teilen. Obwohl persönliche Daten automatisch redigiert werden, können technische Kontextinformationen enthalten sein.

---

# 24. Projekt- und Dateistruktur

Die folgende Struktur ist verbindlich. Eine Datei darf nur dann entfallen, wenn ihre Verantwortung nachweislich vollständig in einer gleichwertigen Datei liegt und die Traceability-Matrix vor dem Merge aktualisiert wird.

```text
gmail-inbox-sender-organizer/
├── README.md
├── LICENSE
├── DECISIONS.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── web-ext-config.mjs
├── eslint.config.js
├── .nvmrc
├── .npmrc
├── .prettierrc.json
├── .prettierignore
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── scripts/
│   ├── clean.mjs
│   ├── build.mjs
│   ├── package.mjs
│   ├── verify-no-network.mjs
│   ├── verify-manifest.mjs
│   ├── verify-dist.mjs
│   └── create-fixture.mjs
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-96.png
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── bootstrap.ts
│   │   └── lifetime-manager.ts
│   ├── app/
│   │   ├── controller.ts
│   │   ├── events.ts
│   │   ├── initial-state.ts
│   │   ├── state-machine.ts
│   │   └── store.ts
│   ├── analyzer/
│   │   ├── inbox-analyzer.ts
│   │   ├── sender-extractor.ts
│   │   ├── email-parser.ts
│   │   ├── grouping.ts
│   │   └── fingerprint.ts
│   ├── gmail/
│   │   ├── adapter.ts
│   │   ├── adapter-registry.ts
│   │   ├── candidate-scoring.ts
│   │   ├── shell-detector.ts
│   │   ├── view-detector.ts
│   │   ├── search-controller.ts
│   │   ├── selection-controller.ts
│   │   ├── move-controller.ts
│   │   ├── completion-detector.ts
│   │   ├── route-observer.ts
│   │   ├── mutation-waiter.ts
│   │   └── gmail-text-patterns.ts
│   ├── ui/
│   │   ├── overlay-host.ts
│   │   ├── overlay-position.ts
│   │   ├── brand-credit.ts
│   │   ├── render.ts
│   │   ├── components/
│   │   │   ├── header.ts
│   │   │   ├── analysis-view.ts
│   │   │   ├── results-view.ts
│   │   │   ├── sender-row.ts
│   │   │   ├── confirm-dialog.ts
│   │   │   ├── workflow-view.ts
│   │   │   ├── diagnostics-view.ts
│   │   │   └── error-view.ts
│   │   └── styles.css
│   ├── i18n/
│   │   └── de.ts
│   ├── privacy/
│   │   ├── redact.ts
│   │   └── diagnostic-export.ts
│   ├── settings/
│   │   ├── defaults.ts
│   │   └── storage.ts
│   ├── shared/
│   │   ├── constants.ts
│   │   ├── messages.ts
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   ├── result.ts
│   │   ├── abort.ts
│   │   ├── dom.ts
│   │   └── time.ts
│   └── types/
│       └── browser.d.ts
├── tests/
│   ├── unit/
│   │   ├── email-parser.test.ts
│   │   ├── grouping.test.ts
│   │   ├── candidate-scoring.test.ts
│   │   ├── state-machine.test.ts
│   │   ├── brand-credit.test.ts
│   │   ├── settings.test.ts
│   │   └── redaction.test.ts
│   ├── fixtures/
│   │   ├── gmail-de-inbox-light.html
│   │   ├── gmail-de-inbox-dark.html
│   │   ├── gmail-en-inbox-light.html
│   │   ├── gmail-search-selected-page-de.html
│   │   ├── gmail-search-select-all-de.html
│   │   ├── gmail-search-select-all-en.html
│   │   ├── gmail-move-menu-de.html
│   │   ├── gmail-move-menu-en.html
│   │   └── gmail-empty-search.html
│   ├── integration/
│   │   ├── analyze-fixtures.test.ts
│   │   ├── search-workflow.test.ts
│   │   ├── selection-workflow.test.ts
│   │   └── move-menu-workflow.test.ts
│   └── e2e/
│       ├── mock-gmail-page.spec.ts
│       └── manual-live-checklist.md
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── PRIVACY.md
│   ├── DOM_ADAPTER_MAINTENANCE.md
│   ├── RELEASE.md
│   └── KNOWN_LIMITATIONS.md
├── artifacts/
│   ├── evidence/
│   └── release/
└── dist/
```

Verbindliche Klarstellungen:

- Es gibt keine `vite.config.ts`; der Build wird über die dokumentierte Vite-JavaScript-API gesteuert.
- Die Ereignisdatei heißt `src/app/events.ts`, nicht `actions.ts`.
- Der Overlay-Host liegt in `src/ui/overlay-host.ts`.
- `dist/`, `coverage/`, Playwright-Berichte, Testprofile und Release-Artefakte sind generiert und dürfen nicht eingecheckt werden.
- `tests/e2e/` testet eine synthetische Mock-Gmail-Seite. Echte Gmail-Live-Tests bleiben bewusst manuell und werden niemals in öffentlichem CI ausgeführt.

---

# 25. Technologiestack

Verbindlich:

- TypeScript im Strict Mode;
- WebExtensions API über `browser.*`;
- kleine lokale Promise-Hilfen;
- Vanilla DOM für UI;
- Shadow DOM;
- CSS ohne Framework;
- Vite oder ein äquivalenter lokaler Bundler;
- Vitest für Unit-/Integrationstests;
- Playwright für Mock-DOM-E2E;
- Mozilla `web-ext` für Lint, lokale Ausführung, Build und Signierworkflow;
- ESLint und Prettier;
- keine produktiven Runtime-Abhängigkeiten, sofern nicht zwingend.

Nicht verwenden:

- React;
- Vue;
- Angular;
- jQuery;
- externe UI-Kits;
- Remote-Fonts;
- Analytics-SDKs;
- Gmail-API-SDK;
- OAuth-Bibliotheken.

Begründung: geringe Bundlegröße, leichte AMO-Prüfbarkeit, kleine Angriffsfläche und einfache Wartung.

---

# 26. Coding Standards

## 26.1 TypeScript

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 26.2 Ergebnisobjekte statt unkontrollierter Exceptions

DOM-Erkennung verwendet:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Exceptions nur für tatsächlich unerwartete Programmfehler.

## 26.3 Keine beliebigen `any`

`any` ist in `src/` verboten. Ausnahmen nur in isolierten Browser-API-Typ-Shims mit Kommentar.

## 26.4 Keine unendlichen Retries

Jeder Retry ist explizit begrenzt.

## 26.5 DOM-Referenzen

DOM-Elemente nie langfristig über Gmail-Routenwechsel hinweg speichern. Vor einem Klick:

- `isConnected` prüfen;
- Kandidat neu auflösen;
- Zustand neu validieren.

---

# 27. Kernalgorithmen

## 27.1 Analyse

```ts
async function analyzeCurrentInbox(
  adapter: GmailDomAdapter,
  signal: AbortSignal
): Promise<AnalysisResult> {
  assertNotAborted(signal);

  const shell = requireDetection(adapter.detectShell());
  const view = requireDetection(adapter.detectCurrentView());

  if (!view.isInboxLike || view.isSearchActive) {
    throw new UserFacingError("GISO-VIEW-NOT-INBOX-001");
  }

  const list = requireDetection(adapter.findMessageList());
  const rows = requireDetection(adapter.findMessageRows(list));

  const entries: AnalyzedEntry[] = [];
  const seenFingerprints = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    assertNotAborted(signal);

    const row = rows[index];
    const fingerprint = fingerprintRow(row);

    if (seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);

    const sender = await extractSenderWithOptionalHovercard(row, adapter, signal);

    entries.push({
      fingerprint,
      sender,
      rowIndex: index
    });
  }

  const groups = groupResolvedSenders(entries)
    .filter(group => group.visibleEntryCount >= 2)
    .sort(compareByCountThenName);

  return buildAnalysisResult(entries, groups);
}
```

## 27.2 Workflow

```ts
async function processGroup(group: SenderGroup): Promise<void> {
  transition("CONFIRM_SEARCH");
  const confirmed = await ui.confirmSearch(group);
  if (!confirmed) return transition("RESULTS_READY");

  const query = buildInboxSenderQuery(group.normalizedEmail);

  transition("SETTING_SEARCH");
  await searchController.submit(query, signal);

  transition("WAITING_SEARCH_RESULTS");
  await searchController.waitUntilReady(query, signal);

  transition("SELECTING_PAGE");
  await selectionController.selectCurrentPage(signal);

  transition("WAITING_SELECT_ALL");
  const globalSelection = await selectionController.trySelectAllMatches(signal);

  if (globalSelection === "manual-required") {
    transition("MANUAL_SELECT_ALL");
    await ui.waitForManualGlobalSelection(signal);
  }

  transition("OPENING_MOVE_MENU");
  await moveController.openMoveMenu(signal);

  transition("WAITING_TARGET_SELECTION");
  await ui.waitForNativeTargetChoice(signal);

  transition("VERIFYING_COMPLETION");
  const completion = await completionDetector.wait(group, signal);

  if (completion.confirmed || await ui.confirmCompletion()) {
    markGroupDone(group.id);
    transition("COMPLETED");
  } else {
    throw new UserFacingError("GISO-COMPLETION-UNCERTAIN-001");
  }
}
```

---

# 28. Fehlerkatalog

| Code | Bedeutung | Verhalten |
|---|---|---|
| `GISO-SHELL-001` | Gmail-Hauptoberfläche fehlt | warten/erneut versuchen |
| `GISO-VIEW-NOT-INBOX-001` | keine Inbox-Ansicht | Nutzer zur Inbox führen |
| `GISO-LIST-001` | Nachrichtenliste nicht gefunden | Diagnose/Fallback |
| `GISO-ROWS-001` | keine Zeilen erkannt | leerer Zustand oder Adapterfehler unterscheiden |
| `GISO-SENDER-NONE-001` | Absender nicht ermittelbar | Eintrag ungelöst |
| `GISO-SENDER-MULTIPLE-001` | mehrere Adressen | Eintrag ungelöst |
| `GISO-SENDER-CONFLICT-001` | widersprüchliche Quellen | Eintrag ungelöst |
| `GISO-SEARCHBOX-001` | Suchbox fehlt | keine Aktion |
| `GISO-SEARCH-SUBMIT-001` | Suche startete nicht | ein Retry, dann manuell |
| `GISO-SEARCH-MISMATCH-001` | falsche Suchanfrage aktiv | sofort stoppen |
| `GISO-SEARCH-EMPTY-001` | keine Treffer | Gruppe als Fehler |
| `GISO-SELECT-PAGE-001` | Seitencheckbox fehlt | manuelle Anleitung |
| `GISO-SELECT-PAGE-002` | Auswahl nicht bestätigt | manuelle Anleitung |
| `GISO-SELECT-ALL-001` | globale Auswahl nicht gefunden | manueller Fallback |
| `GISO-MOVE-001` | Move-Button fehlt | manuell öffnen |
| `GISO-MOVE-002` | Menü öffnet nicht | Retry, dann manuell |
| `GISO-COMPLETION-UNCERTAIN-001` | Abschluss unklar | Nutzerbestätigung |
| `GISO-STATE-ILLEGAL-001` | illegaler Übergang | keine Aktion |
| `GISO-ABORT-001` | Nutzerabbruch | sauber beenden |
| `GISO-DOM-CHANGED-001` | Adaptervertrauen zu niedrig | Diagnose anzeigen |

---

# 29. Testspezifikation

## 29.1 Unit Tests

### E-Mail-Parser

Mindestens:

- einfache Adresse;
- Groß-/Kleinschreibung;
- Anzeigename mit Klammern;
- Unicode-Anzeigename;
- Plus-Adresse;
- Subdomain;
- IDN-Domain;
- mehrere Adressen;
- ungültige Adresse;
- Steuerzeichen;
- leere Eingabe;
- 320-Zeichen-Grenze.

### Gruppierung

- gleiche Adresse, gleicher Name;
- gleiche Adresse, verschiedene Namen;
- gleicher Name, verschiedene Adressen;
- 1/2/3 Einträge;
- Deduplikation gleicher Fingerprints;
- sortierte Ausgabe;
- ungelöste Einträge ausgeschlossen.

### Candidate Scoring

- Toolbar-Move gewinnt gegen Nachrichtenzeilen-Button;
- unsichtbare Kandidaten verlieren;
- widersprüchliche Texte führen zu Ablehnung;
- zwei gleich starke Kandidaten führen zu Unsicherheit statt willkürlichem Klick.

### Zustandsmaschine

- jeder erlaubte Übergang;
- jeder kritische illegale Übergang;
- Abbruch in jedem aktiven Zustand;
- kein DOM-Klick nach Abbruch;
- Retry-Limits.

### Redaktion

- E-Mail-Adressen;
- Namen;
- Snippets;
- verschachtelte Diagnoseobjekte;
- Arrays;
- unbekannte Werte.

## 29.2 Fixture-Integrationstests

Jedes Fixture muss synthetische, nicht reale Daten enthalten.

Mindest-Fixtures:

1. deutsche Inbox, Light Mode;
2. deutsche Inbox, Dark Mode;
3. englische Inbox;
4. kompakte Dichte;
5. komfortable Dichte;
6. Konversationsansicht an;
7. Konversationsansicht aus;
8. Absender über `email`;
9. Absender über `data-hovercard-id`;
10. Absender nur im `title`;
11. Konflikt;
12. leere Inbox;
13. Suchergebnisse erste Seite ausgewählt;
14. Banner „alle Treffer auswählen“;
15. alle Treffer ausgewählt;
16. Move-Menü;
17. Abschluss-Snackbar;
18. unbekannte Gmail-Sprache;
19. DOM mit absichtlich geänderten Klassen;
20. zwei ähnliche Toolbars.

## 29.3 Mock-E2E

Mock Gmail SPA muss simulieren:

- Routewechsel ohne Reload;
- Mutation-basierte Listenneuladung;
- Suche;
- Auswahlcheckbox;
- globales Auswahlbanner;
- Move-Menü;
- Labelauswahl durch Nutzer;
- Snackbar;
- Fehlerzustände.

E2E-Erwartung:

1. Overlay öffnet;
2. Analyse findet Gruppen;
3. Vorschau zeigt korrekte Query;
4. Workflow klickt nur erwartete Elemente;
5. Nutzer wählt Ziel im Mock;
6. Gruppe wird erledigt;
7. kein externer Netzwerkrequest.

## 29.4 Live-Gmail-Abnahmetests

Live-Tests werden ausschließlich mit einem dedizierten Test-Gmail-Konto durchgeführt.

Testdaten:

- mindestens 4 synthetische Absender;
- zwei Absender mit je mindestens 3 Inbox-Unterhaltungen;
- ein Absender nur einmal;
- ein Thread mit mehreren Teilnehmern;
- mindestens ein vorhandenes Testlabel;
- Möglichkeit, ein neues Testlabel anzulegen.

Pflichtmatrix:

| Fall | DE | EN |
|---|---:|---:|
| Light Mode | ✓ | ✓ |
| Dark Mode | ✓ | ✓ |
| Default Density | ✓ | ✓ |
| Compact Density | ✓ | ✓ |
| Conversation View On | ✓ | ✓ |
| Conversation View Off | ✓ | ✓ |
| 1 Ergebnisseite | ✓ | ✓ |
| mehrere Ergebnisseiten | ✓ | ✓ |
| neues Label | ✓ | ✓ |
| bestehendes Label | ✓ | ✓ |
| Abbruch vor Suche | ✓ | ✓ |
| Abbruch nach Auswahl | ✓ | ✓ |
| manuelle Global-Auswahl | ✓ | ✓ |

## 29.5 Negative Tests

- Nicht-Gmail-Tab;
- Gmail Login-Seite;
- Gmail Settings;
- einzelne geöffnete Nachricht;
- aktive Gmail-Suche;
- Spam;
- Papierkorb;
- kein Internet;
- Gmail lädt langsam;
- DOM ändert sich während Klick;
- zwei Gmail-Tabs;
- mehrere Accounts;
- Nutzer klickt gleichzeitig in Gmail;
- Move-Menü bereits geöffnet;
- Overlay wird während Workflow verborgen;
- Add-on-Neuladen;
- Firefox-Zoom 200 %.

---

# 30. Akzeptanzkriterien

## AC-001 – Analyse

Gegeben eine Inbox-Seite mit:

- A dreimal,
- B zweimal,
- C einmal,

zeigt das Add-on exakt A und B mit korrekten Zahlen.

## AC-002 – Adressbasierte Gruppierung

Zwei Zeilen mit gleichem Anzeigenamen, aber verschiedenen Adressen werden getrennt.

## AC-003 – Globale Suche

Für `news@example.com` wird exakt folgende Query verwendet:

```text
in:inbox "from:news@example.com"
```

## AC-004 – Keine API

Während Analyse und Verschiebeworkflow erzeugt das Add-on keine eigenen Netzwerkrequests.

## AC-005 – Sicherheitsstopp

Wenn zwei Move-Button-Kandidaten gleich sicher sind, klickt das Add-on keinen und zeigt Hilfe.

## AC-006 – Globaler Umfang

Bei mehreren Suchergebnisseiten aktiviert das Add-on entweder nachweislich Gmails globale Auswahlfunktion oder verlangt eine manuelle Bestätigung. Es darf nie still nur die erste Seite als vollständig darstellen.

## AC-007 – Nutzerkontrolle

Kein Label wird ohne direkten Nutzerklick im nativen Gmail-Menü gewählt.

## AC-008 – Datenschutz

Nach Browser-/Tab-Neuladen sind keine analysierten Absender in `storage.local`.

## AC-009 – Gmail-Routenwechsel

Overlay bleibt nach Inbox → Suche → Inbox funktional und wird nicht dupliziert.

## AC-010 – Lokalisierung

Alle automatisierten Kernschritte funktionieren in deutscher und englischer Gmail-Oberfläche oder fallen kontrolliert auf manuelle Hilfe zurück.

## AC-011 – Barrierefreiheit

Der vollständige Overlay-Workflow bis zum nativen Gmail-Menü ist nur per Tastatur bedienbar.

## AC-012 – Build

Folgende Befehle laufen fehlerfrei:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run webext:lint
npm run package
```

## AC-013 – Reproduzierbarkeit

Zwei Builds aus demselben Commit und derselben Lockfile erzeugen funktional identische Paketinhalte; Zeitstempel dürfen separat normalisiert werden.

## AC-014 – Keine realen Daten in Tests

Repository und Releasepaket enthalten keine realen E-Mail-Adressen, Betreffzeilen oder Gmail-DOM-Dumps eines Nutzers.

---

# 31. Definition of Done

V1 ist fertig, wenn:

- alle Muss-Anforderungen umgesetzt;
- alle Akzeptanzkriterien bestanden;
- Unit-Tests bestanden;
- Fixture-Integrationstests bestanden;
- Mock-E2E bestanden;
- Live-Gmail-Matrix bestanden;
- Diagnosemodus redigiert;
- kein eigener Netzwerkzugriff vorhanden;
- Manifest nur minimale Rechte enthält;
- Datenschutzdokument vorhanden;
- AMO-Linter ohne kritische Fehler;
- XPI gebaut;
- Quell-ZIP gebaut;
- Installationsanleitung geschrieben;
- bekannte Einschränkungen dokumentiert;
- menschliche Endabnahme bestätigt;
- Add-on signierbereit ist.

„Funktioniert auf dem Rechner des Agenten“ reicht nicht.

---

# 32. Agenten-Ausführungsplan

## Phase 0 – Repository und Constraints

Agent MUSS:

1. Repository initialisieren;
2. dieses Dokument unter `docs/PRODUCT_SPEC.md` ablegen;
3. `DECISIONS.md` mit Verweis „keine Produktentscheidungen außerhalb der Spezifikation“ erstellen;
4. TypeScript Strict, Lint und Tests einrichten;
5. Verbot externer Netzwerklogik als Build-Check implementieren.

Gate:

- leeres Add-on baut;
- Manifest-Lint bestanden;
- Toolbar-Button lädt.

## Phase 1 – UI-Shell

Implementieren:

- Background Toggle;
- Content Bootstrap;
- Shadow-DOM-Overlay;
- Grund-, Analyse-, Ergebnis- und Fehleransichten;
- zentraler State Store;
- deutsche Texte;
- Barrierefreiheit.

Gate:

- Overlay dupliziert sich nicht;
- Gmail-Stile greifen nicht hinein;
- Mock-UI-Tests bestanden.

## Phase 2 – Analyse

Implementieren:

- Gmail Shell-/View-Erkennung;
- Message-List-/Row-Erkennung;
- Sender-Extractor;
- Parser;
- Gruppierung;
- Analyseanzeige;
- ungelöste Einträge.

Gate:

- Fixture-Suite bestanden;
- keine globalen Aktionen.

## Phase 3 – Suche

Implementieren:

- Searchbox-Erkennung;
- sichere Werteingabe;
- Route-/Mutation-Waiter;
- Query-Verifikation;
- Leerzustand.

Gate:

- Mock-SPA-Suche bestanden;
- bei Mismatch kein Klick.

## Phase 4 – Auswahl

Implementieren:

- Seitenauswahl;
- globale Auswahl;
- eine-Seite-Erkennung;
- manueller Fallback;
- Schrittanzeige.

Gate:

- positive und negative Fixture-Tests;
- kein Blindklick.

## Phase 5 – Native Move-Interaktion

Implementieren:

- Move-Button-Erkennung;
- Menübestätigung;
- Wartezustand;
- Abschlussdetektor;
- Nutzerbestätigung.

Gate:

- Ziel wird niemals automatisch gewählt;
- Mock-E2E vollständig.

## Phase 6 – Diagnose und Datenschutz

Implementieren:

- Diagnoseevents;
- Redaction;
- Export;
- Datenschutzseite;
- no-network verification;
- Datenablageprüfung.

Gate:

- Diagnose enthält keine unredigierten Testdaten;
- `storage.local` enthält nur Settings.

## Phase 7 – Live-Kalibrierung

Mensch stellt dediziertes Gmail-Testkonto bereit und loggt sich ein.

Agent führt unter menschlicher Sichtkontrolle aus:

1. DOM-Kalibrierung;
2. Fixture-Erstellung mit synthetischer/redigierter Struktur;
3. Anpassung nur im Adapter;
4. komplette Live-Matrix;
5. keine Nutzung echter persönlicher Mailboxdaten.

Gate:

- Matrix dokumentiert;
- kritische Schritte DE/EN bestätigt.

## Phase 8 – Release

- Version setzen;
- Changelog;
- `web-ext lint`;
- Release-XPI;
- Source-ZIP;
- Prüfsummen;
- Installations- und Datenschutztexte;
- AMO-Metadatenentwurf.

Gate:

- menschliche Veröffentlichung, weil Kontologin und rechtliche Bestätigung nicht autonom erfolgen sollen.

---

# 33. Menschliche Pflichtschritte

Auch bei autonomer Entwicklung bleiben zwingend:

1. Firefox-/AMO-Entwicklerkonto anlegen;
2. die bereits verbindlich festgelegte Add-on-ID gegen alle Release-Artefakte prüfen und die Herausgeberdaten ergänzen;
3. Test-Gmail-Konto bereitstellen und manuell anmelden;
4. Live-Aktionen beobachten;
5. Datenschutztext rechtlich prüfen;
6. Add-on zur Mozilla-Signierung einreichen;
7. AMO-Rückfragen beantworten;
8. vor jedem Update Smoke-Test gegen aktuelles Gmail durchführen.

Der Agent darf keine Gmail-Zugangsdaten erhalten oder speichern.

---

# 34. Veröffentlichung und Distribution

## 34.1 Entwicklungsinstallation

- `web-ext run` mit separatem Firefox-Testprofil;
- niemals das persönliche Hauptprofil für destruktive Tests;
- Testkonto statt Produktionspostfach.

## 34.2 Signierung

Für reguläre Firefox-Release- und Beta-Versionen muss die Erweiterung von Mozilla signiert werden. Möglich:

- öffentlich gelistet auf AMO;
- unlisted/self-distributed, aber ebenfalls über Mozilla signiert.

## 34.3 AMO-Unterlagen

Bereitzustellen:

- verständliche Funktionsbeschreibung;
- Erklärung der Gmail-Hostberechtigung;
- Datenschutztext: keine Datenerhebung oder Übertragung;
- Screenshots des Overlays;
- Testanleitung für Reviewer;
- Quellcode und Build-Anweisung;
- Hinweis auf native Gmail-Interaktion;
- keine Behauptung offizieller Google-Partnerschaft.

## 34.4 Empfohlene Reviewer-Anleitung

1. Gmail-Testkonto öffnen.
2. Mindestens zwei sichtbare Einträge desselben Absenders bereitstellen.
3. Toolbar-Symbol öffnen.
4. Analyse starten.
5. Gruppe auswählen.
6. Suchworkflow beobachten.
7. im nativen Gmail-Menü Testlabel wählen.
8. bestätigen, dass kein Google OAuth erscheint.
9. Browser-Netzwerkwerkzeuge prüfen: keine Add-on-eigenen externen Requests.

---

# 35. Wartungskonzept

## 35.1 Erwartbare Änderungsquelle

Primäres Wartungsrisiko ist eine Änderung der Gmail-Oberfläche.

## 35.2 Adapterversion

```ts
export const GMAIL_ADAPTER_VERSION = "2026.07.1";
```

Jede Änderung an:

- Kandidaten;
- Textmustern;
- Scoring;
- Strukturerkennung

erhöht die Adapterversion.

## 35.3 Updateprozess bei Bruch

1. Fehler über Diagnose reproduzieren;
2. feststellen, welcher Adapterteil versagt;
3. redigierte/synthetische Fixture aktualisieren;
4. Regressionstest schreiben;
5. nur Adapter ändern;
6. vollständige Fixture-Suite;
7. DE-/EN-Live-Smoke-Test;
8. Patchversion;
9. signiertes Update.

## 35.4 Smoke-Test vor jedem Release

- Overlay;
- Inbox-Erkennung;
- 2+-Gruppierung;
- Suche;
- Seitenauswahl;
- globale Auswahl oder Fallback;
- Move-Menü;
- Abschluss;
- Dark Mode;
- Deutsch;
- Englisch.

## 35.5 Graceful Degradation

Wenn Gmail sich ändert:

- Analyse darf weiterhin funktionieren, sofern Sender erkennbar;
- Suche darf manuell fortgesetzt werden;
- kritische Auswahl-/Move-Schritte dürfen auf Anleitung zurückfallen;
- niemals riskante „Best Guess“-Klicks.

---

# 36. Bekannte Einschränkungen

1. Absender, die auf der analysierten Seite nur einmal vorkommen, werden nicht vorgeschlagen, selbst wenn später viele weitere Nachrichten existieren.
2. Bei aktivierter Konversationsansicht zählt Gmail Unterhaltungen, nicht zwingend einzelne Nachrichten.
3. Eine Suche `from:` kann eine Unterhaltung treffen, in der auch andere Absender beteiligt sind.
4. Gmails globale Auswahloption kann je nach Ergebniszahl, UI-Variante oder Rollout anders erscheinen.
5. Gmail-DOM ist undokumentiert und kann sich ändern.
6. Ungewöhnliche Gmail-Sprachen fallen teilweise auf manuelle Bedienung zurück.
7. Sehr spezielle Themes oder Browser-CSS können native Gmail-Erkennung beeinflussen.
8. Das Add-on kann Gmails serverseitigen Erfolg nur über UI-Indizien beobachten.
9. Gmails „Rückgängig“-Funktion liegt außerhalb der Kontrolle des Add-ons.
10. Neue Labels werden ausschließlich über Gmail erstellt.
11. Die Erweiterung ist kein Backup-Werkzeug.
12. Die Erweiterung soll nicht in einem wichtigen Postfach erstmals getestet werden.

---

# 37. Roadmap – ausdrücklich nicht Teil von V1

## V1.1

- optionale Analyse mehrerer sichtbarer Seiten mit Nutzerbestätigung;
- zusätzliche Gmail-Sprachen;
- lokal gemerkte, ausdrücklich vom Nutzer bestätigte Absender-Ziel-Zuordnungen;
- verbesserte Diagnose-Fixtures.

## V1.2

- Quick-Action für häufige Labels, weiterhin mit Bestätigungsdialog;
- konfigurierbare Mindestanzahl;
- Stapelvorschau mehrerer Absender, aber keine unbeaufsichtigte Ausführung;
- optional nur ungelesene Nachrichten.

## V2 – nur nach neuer Risikoentscheidung

- eigene Labelauswahl aus Gmail-DOM;
- automatische Labelwahl;
- mehrseitiger Inbox-Crawler;
- Unterstützung anderer Webmailanbieter.

Keine Roadmapfunktion darf vorgezogen werden, nur weil ein Agent sie „einfach“ findet.

---

# 38. Qualitäts- und Sicherheits-Checkliste für den implementierenden Agenten

Vor Abschluss MUSS der Agent jede Aussage mit Ja beantworten:

- [ ] Keine Gmail API.
- [ ] Kein OAuth.
- [ ] Kein eigener Server.
- [ ] Kein externer Netzwerkrequest.
- [ ] Nur Gmail-Hostberechtigung.
- [ ] Absender werden über E-Mail-Adresse gruppiert.
- [ ] Anzeigename allein löst nie eine globale Suche aus.
- [ ] Analyse umfasst nur die geladene Seite.
- [ ] Suchquery umfasst `in:inbox`.
- [ ] Query wird vor Auswahl bestätigt.
- [ ] Auswahlzustand wird nach jedem Klick verifiziert.
- [ ] Globale Auswahl wird nicht still angenommen.
- [ ] Bei Unsicherheit erfolgt manueller Fallback.
- [ ] Ziel-Label wird vom Nutzer in Gmail gewählt.
- [ ] Keine persistenten Absenderdaten.
- [ ] Diagnose ist redigiert.
- [ ] Shadow DOM verhindert CSS-Konflikte.
- [ ] Deutsch und Englisch getestet.
- [ ] Konversationsansicht an und aus getestet.
- [ ] Dark und Light Mode getestet.
- [ ] Keine generierte Gmail-Klasse ist alleiniger Selektor.
- [ ] Alle Retry-Schleifen sind begrenzt.
- [ ] Abbruch verhindert weitere Klicks.
- [ ] AMO-Datenerklärung steht auf `none`.
- [ ] Add-on-ID und minimale Firefox-Version sind gesetzt.
- [ ] Build ist reproduzierbar.
- [ ] XPI und Source-ZIP sind erzeugt.
- [ ] Live-Abnahme mit dediziertem Testkonto dokumentiert.

---

# 39. Abschließende Machbarkeitseinschätzung

## Technische Machbarkeit

**Hoch.**

Der Kern – DOM-Analyse einer Gmail-Seite, Gruppierung und Steuerung nativer UI – ist mit Firefox WebExtensions gut realisierbar. Die fehlende Gmail API beseitigt Google-OAuth- und Restricted-Scope-Probleme.

## Hauptunsicherheit

Die Gmail-DOM-Struktur ist nicht vertraglich stabil. Das Projekt ist deshalb kein „einmal programmieren und nie warten“-Add-on. Die in diesem Dokument festgelegte Adapterarchitektur und der kontrollierte manuelle Fallback machen das Risiko jedoch beherrschbar.

## Realistischer Aufwand

Für eine robuste V1:

- Implementierung und automatisierte Tests: etwa 30–55 Personenstunden;
- Live-Kalibrierung und Fehlerbehebung: etwa 8–20 Stunden;
- Dokumentation, Packaging und AMO-Vorbereitung: etwa 6–12 Stunden;
- Gesamt: grob 44–87 Personenstunden.

Ein AI-Coding-Agent kann einen hohen Anteil davon übernehmen. Die Live-Gmail-Kalibrierung, echte Massenaktionsprüfung und Veröffentlichung benötigen menschliche Kontrolle.

## Freigabeurteil

**GO**, sofern folgende Bedingungen akzeptiert werden:

1. native Gmail-Zielauswahl bleibt in V1 manuell;
2. Gmail-DOM-Wartung wird als laufende Produktaufgabe eingeplant;
3. vor jedem Release wird mit einem dedizierten Testkonto geprüft;
4. bei unsicherer Erkennung stoppt das Add-on;
5. V1 verspricht keine vollständige Erkennung aller wiederkehrenden Absender im gesamten Posteingang, sondern nur der aktuell geladenen Seite.

---

# 40. Primäre technische Referenzgrundlagen

Die Implementierung ist gegen die jeweils aktuelle Fassung folgender Primärdokumente zu prüfen:

- Mozilla MDN: Browser extensions / WebExtensions;
- Mozilla MDN: Content scripts;
- Mozilla MDN: `content_scripts` in `manifest.json`;
- Mozilla MDN: `host_permissions`;
- Mozilla MDN: Background scripts;
- Mozilla MDN: `storage.local`;
- Mozilla MDN: `browser_specific_settings`;
- Mozilla Extension Workshop: Firefox built-in consent for data collection and transmission;
- Mozilla Extension Workshop: Signing and distribution overview;
- Mozilla Extension Workshop: `web-ext`;
- Google Gmail Help: Search in Gmail und kombinierbare Suchoperatoren.

Die Auswahl- und Move-Oberfläche von Gmail ist ausdrücklich eine beobachtete UI-Abhängigkeit und keine öffentliche Google-API. Sie muss deshalb vor Veröffentlichung live verifiziert werden.

---

# 41. Versionsdelta 2.1.0 FINAL und endgültige Implementierungsgrenzen

## 41.1 Zweck der Erweiterung dieser Version

Version 2.1.0 FINAL schließt die größten verbleibenden Lücken zwischen einem guten Konzept und einer tatsächlich autonom implementierbaren Spezifikation. Die folgenden Punkte sind ab jetzt verbindlich:

1. Jede Komponente besitzt einen eindeutigen Eingabe-/Ausgabevertrag.
2. Jeder DOM-Klick besitzt Vorbedingungen, Nachbedingungen und einen Stop-Pfad.
3. Jede Implementierungsphase besitzt Sub-Phasen, konkrete Dateien, Befehle, Expected Results, Evidence-Artefakte und ein binäres Gate.
4. Kritische Kernfunktionen werden als Copy-paste-Referenzcode vorgegeben.
5. Der Agent darf keine Abhängigkeit, Berechtigung, Persistenz, Telemetrie oder Automatisierung hinzufügen, die hier nicht ausdrücklich freigegeben ist.
6. Gmail-bezogene Unsicherheit wird ausschließlich im Adapter und in Live-Kalibrierungsartefakten behandelt.
7. Ein „grüner“ automatischer Test ersetzt niemals die vorgeschriebenen Live-Gmail-Gates.

## 41.2 Harte V1-Produktgrenze

V1 ist exakt folgende Produktkette:

```text
Toolbar-Klick
→ Overlay öffnen
→ aktuell geladene Inbox-Seite analysieren
→ wiederkehrende Absender nach validierter Adresse gruppieren
→ Sicherheitsvorschau
→ native Gmail-Suche für gesamten Inbox-Bereich
→ aktuelle Ergebnisseite auswählen
→ nachweislich alle Treffer auswählen ODER manueller Bestätigungsfallback
→ natives „Verschieben nach“-Menü öffnen
→ Nutzer wählt Ziel selbst
→ Abschluss plausibilisieren oder manuell bestätigen
→ nächste Gruppe
```

Nicht in dieser Kette enthaltene Automatisierung ist für V1 verboten.

## 41.3 Neue Sicherheitsentscheidung: Gmail-Suchergebnisse nicht blind vertrauen

Gmail kann bei bestimmten Suchzuständen ähnliche oder erweiterte Ergebnisse anzeigen. Daher gelten zusätzlich:

- Nach dem Start der Suche MUSS die Suchbox den erwarteten Query-String enthalten.
- Eine globale Auswahl darf erst erfolgen, wenn die Ansicht eindeutig als E-Mail-Suchergebnisliste klassifiziert ist.
- Ein erkannter „ähnliche Ergebnisse“- oder „related results“-Bereich DARF NICHT mit ausgewählt werden.
- Wenn Gmail keine exakten Treffer, sondern nur ähnliche Ergebnisse anzeigt, bricht der Workflow mit `GISO-SEARCH-RELATED-ONLY-001` ab.
- Drive-, Chat-, Space- oder Gemini-Ergebnisbereiche dürfen niemals als Mail-Liste behandelt werden.
- Der Adapter muss das zentrale Mail-Ergebnis-Root bestimmen; alle Zeilen- und Auswahloperationen bleiben darauf begrenzt.

## 41.4 Normative Entwicklungsregel

Der implementierende Agent MUSS in jeder Phase zuerst Tests und Verträge erstellen, danach Produktcode. Abweichung ist nur erlaubt, wenn ein Test technisch erst nach einem minimalen Adapter-Stummel kompilieren kann. In diesem Fall muss der Stummel ohne produktive Klicklogik sein.

---

# 42. Verifizierter Plattform- und Toolchain-Snapshot

## 42.1 Locked Baseline

Die Baseline wurde am 26. Juli 2026 gegen die offiziellen Projekt- und Plattformquellen abgeglichen. Maßgeblich sind die im `package-lock.json` aufgelösten Versionen; die nachstehenden Versionen sind der verbindliche Bootstrap-Snapshot:

| Komponente | Locked Version | Regel |
|---|---:|---|
| Node.js | `24.18.0` | aktuelle LTS-Baseline des Dokuments |
| npm | `11.16.0` | mit der Baseline geprüft |
| TypeScript | `6.0.3` | unterhalb der von typescript-eslint 8.65 unterstützten Obergrenze `<6.1` |
| Vite | `8.1.5` | Build über JavaScript-API |
| Vitest / Coverage | `4.1.10` | Unit und Fixture-Integration |
| Playwright | `1.61.1` | ausschließlich Mock-E2E |
| web-ext | `10.5.0` | Lint, Run, Build |
| ESLint | `10.8.0` | Flat Config |
| @eslint/js | `10.0.1` | ESLint-Regelbasis |
| typescript-eslint | `8.65.0` | typed linting |
| Prettier | `3.9.6` | Formatierung |
| globals | `17.7.0` | Browser-/Node-/Test-Globals |
| jsdom | `29.1.1` | Test-DOM |
| @types/firefox-webext-browser | `143.0.0` | WebExtension-Typen |
| @types/node | `24.10.6` | exakte Node-24-Typbaseline |
| Firefox | `>=140.0` | Manifest-Untergrenze |

## 42.2 Quellen und aktuelle Plattformregeln

Primärquellen:

- Firefox MV3 Background Scripts: `https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background`
- Firefox `data_collection_permissions`: `https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings`
- Mozilla Add-on Policies: `https://extensionworkshop.com/documentation/publish/add-on-policies/`
- Gmail-Suchoperatoren: `https://support.google.com/mail/answer/7190`
- Gmail-Suchverhalten und ähnliche Ergebnisse: `https://support.google.com/mail/answer/6593`
- Node Releases: `https://nodejs.org/en/about/previous-releases`
- Paketversionen: jeweilige offizielle npm-Paketseiten.

## 42.3 Upgrade-Gate

Kein Agent darf Versionen spontan aktualisieren. Ein Upgrade benötigt:

1. separaten Branch;
2. Changelog- und Kompatibilitätsprüfung;
3. frisches `npm ci` aus neu erzeugtem Lockfile;
4. `npm audit --audit-level=high` ohne ungeklärte High-/Critical-Befunde;
5. vollständiges `npm run verify`;
6. Paket-Diff und Permission-Diff;
7. Firefox-Live-Smoke-Test bei Toolchain-, WebExtension-Typen- oder `web-ext`-Upgrade;
8. archivierte Evidence;
9. menschliche Freigabe.

## 42.4 Keine Scheinsicherheit

Versionsnummern, Gmail-DOM und AMO-Prüfpraxis können sich ändern. Dieses Dokument garantiert weder zukünftige Gmail-Kompatibilität noch AMO-Zulassung. Es definiert stattdessen binäre Prüfungen, konservative Fallbacks und einen verpflichtenden Live-/Policy-Gate, damit Änderungen nicht unbemerkt in eine Veröffentlichung gelangen.

---

# 43. Repository-Bootstrap – exakt auszuführende Befehle

## 43.1 Voraussetzungen

- Git installiert;
- Node.js `24.18.0`;
- npm `11.16.0`;
- Firefox Desktop 140 oder neuer;
- separates Firefox-Testprofil;
- dediziertes Gmail-Testkonto erst ab Live-Phase;
- keine privaten Produktivmails in Fixtures oder Screenshots.

## 43.2 Bootstrap-Befehle

```bash
mkdir gmail-inbox-sender-organizer
cd gmail-inbox-sender-organizer
git init
npm init -y
npm install --save-dev --save-exact \
  typescript@6.0.3 \
  vite@8.1.5 \
  vitest@4.1.10 \
  @vitest/coverage-v8@4.1.10 \
  @playwright/test@1.61.1 \
  web-ext@10.5.0 \
  eslint@10.8.0 \
  @eslint/js@10.0.1 \
  typescript-eslint@8.65.0 \
  prettier@3.9.6 \
  globals@17.7.0 \
  jsdom@29.1.1 \
  @types/node@24.10.6 \
  @types/firefox-webext-browser@143.0.0
npx playwright install firefox
```

Falls exakt `@types/node@24.10.6` im Registry-Snapshot nicht verfügbar ist, darf ausschließlich der neueste `24.x`-Patch gewählt werden. Die Abweichung wird in `DECISIONS.md` und im Lockfile-Evidence vermerkt; kein anderer Major ist zulässig.

## 43.3 Verzeichnisanlage

```bash
mkdir -p \
  .github/workflows scripts public/icons \
  src/background src/content src/app src/analyzer src/gmail \
  src/ui/components src/i18n src/privacy src/settings src/shared src/types \
  tests/unit tests/integration tests/fixtures tests/e2e \
  docs artifacts/evidence artifacts/release
```

Unter Windows PowerShell ist dieselbe Struktur mit `New-Item -ItemType Directory -Force` anzulegen. Der Agent darf die Struktur nicht vereinfachen, wenn dadurch Schichtengrenzen vermischt werden.

## 43.4 Lockfile- und Supply-Chain-Gate

Nach Installation:

```bash
npm ls --depth=0
npm audit --audit-level=high
npm ci
```

Expected Result:

- `package-lock.json` vorhanden und eingecheckt;
- alle Top-Level-Versionen entsprechen Kapitel 42 oder einer ausdrücklich protokollierten `@types/node`-Patchabweichung;
- keine ungeklärten High-/Critical-Befunde;
- `npm ci` verändert weder `package.json` noch `package-lock.json`.

## 43.5 Erster Commit

Der erste Commit enthält ausschließlich Toolchain-Dateien, leere Quellordner, dieses Dokument als `docs/PRODUCT_SPEC.md` und `DECISIONS.md`. Commit-Nachricht:

```text
chore: bootstrap locked Firefox extension workspace
```

Gate G0:

```text
npm ci                  PASS
npm run format:check    PASS
npm run lint            PASS
npm run typecheck       PASS
npm test                PASS
npm run build           PASS
npm run webext:lint     PASS
npm audit --audit-level=high PASS
Git working tree        CLEAN
```

---

# 44. Vollständige Toolchain-Referenzdateien

## 44.1 `package.json`

```json
{
  "name": "gmail-inbox-sender-organizer",
  "version": "1.0.0",
  "private": true,
  "description": "Firefox extension that groups recurring senders on the currently loaded Gmail inbox page and guides a safe native Gmail move workflow.",
  "type": "module",
  "engines": {
    "node": "24.18.0",
    "npm": "11.16.0"
  },
  "scripts": {
    "clean": "node scripts/clean.mjs",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "build": "node scripts/build.mjs",
    "verify:no-network": "node scripts/verify-no-network.mjs",
    "verify:manifest": "node scripts/verify-manifest.mjs",
    "verify:dist": "node scripts/verify-dist.mjs",
    "verify:security": "npm audit --audit-level=high",
    "webext:lint": "web-ext lint --source-dir dist --warnings-as-errors",
    "webext:run": "web-ext run --source-dir dist --firefox-profile ./.firefox-profile --keep-profile-changes",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run verify:no-network && npm run verify:manifest && npm run verify:dist && npm run webext:lint && npm run test:e2e && npm run verify:security",
    "package": "node scripts/package.mjs",
    "release:check": "npm ci && npm run verify && npm run package"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.61.1",
    "@types/firefox-webext-browser": "143.0.0",
    "@types/node": "24.10.6",
    "@vitest/coverage-v8": "4.1.10",
    "eslint": "10.8.0",
    "globals": "17.7.0",
    "jsdom": "29.1.1",
    "prettier": "3.9.6",
    "typescript": "6.0.3",
    "typescript-eslint": "8.65.0",
    "vite": "8.1.5",
    "vitest": "4.1.10",
    "web-ext": "10.5.0"
  }
}
```

## 44.2 `.nvmrc`

```text
24.18.0
```

## 44.3 `.npmrc`

```ini
save-exact=true
engine-strict=true
audit=true
fund=false
package-lock=true
```

## 44.4 `.gitignore`

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
artifacts/release/
artifacts/evidence/**
!artifacts/evidence/.gitkeep
.firefox-profile/
*.xpi
*.zip
*.log
.DS_Store
Thumbs.db
```

## 44.5 `.prettierignore`

```text
node_modules
dist
coverage
playwright-report
test-results
artifacts
.firefox-profile
package-lock.json
*.xpi
*.zip
```

## 44.6 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": false,
    "types": ["node", "firefox-webext-browser", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "*.ts"],
  "exclude": ["dist", "artifacts", "node_modules", ".firefox-profile"]
}
```

`types: ["node"]` dient nur den Konfigurationsdateien. ESLint verbietet Node-APIs in `src/`, soweit sie nicht ausdrücklich browserkompatibel sind.

## 44.7 `eslint.config.js`

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const restrictedNetworkGlobals = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "artifacts/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".firefox-profile/**",
      "node_modules/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.config.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.webextensions, ...globals.es2022 },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/only-throw-error": "error",
      "no-restricted-globals": ["error", ...restrictedNetworkGlobals],
      "no-restricted-properties": [
        "error",
        { "object": "navigator", "property": "sendBeacon", "message": "No network transmission is allowed." },
        { "object": "document", "property": "cookie", "message": "Cookie access is forbidden." }
      ],
      "no-eval": "error",
      "no-implied-eval": "error"
    }
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.jest } }
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js", "web-ext-config.mjs", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: { "no-restricted-globals": "off" }
  }
);
```

## 44.8 `.prettierrc.json`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf",
  "proseWrap": "preserve"
}
```

## 44.9 `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/types/**"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
    }
  }
});
```

## 44.10 `playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  webServer: {
    command: "node tests/e2e/mock-server.mjs",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: !process.env.CI
  },
  use: {
    browserName: "firefox",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
```

## 44.11 `web-ext-config.mjs`

```js
export default {
  sourceDir: "dist",
  artifactsDir: "artifacts/release",
  run: { startUrl: ["https://mail.google.com/"], keepProfileChanges: true },
  lint: { warningsAsErrors: true },
  build: { overwriteDest: true }
};
```

## 44.12 `public/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Inbox Sender Organizer",
  "version": "1.0.0",
  "description": "Gruppiert wiederkehrende Absender auf der aktuell geladenen Gmail-Inbox-Seite und unterstützt das sichere globale Verschieben über Gmails native Oberfläche.",
  "permissions": ["storage"],
  "host_permissions": ["https://mail.google.com/*"],
  "background": { "scripts": ["background.js"] },
  "action": {
    "default_title": "Inbox Sender Organizer",
    "default_icon": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "96": "icons/icon-96.png" }
  },
  "content_scripts": [
    { "matches": ["https://mail.google.com/*"], "js": ["content.js"], "run_at": "document_idle" }
  ],
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "96": "icons/icon-96.png" },
  "incognito": "not_allowed",
  "browser_specific_settings": {
    "gecko": {
      "id": "{a3f84f1e-3947-4fe6-8d31-6d5deff1ae71}",
      "strict_min_version": "140.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  }
}
```

Die UUID ist stabil. Vor AMO-Einreichung muss Gate PRIV-AMO-01 bestätigen, dass die Deklaration `none` nach der dann aktuellen Mozilla-Taxonomie weiterhin korrekt ist. Die nutzerinitiierte Übergabe einer Senderadresse an Gmails eigene Suchoberfläche wird in Listing, Datenschutztext und Reviewer Notes ausdrücklich beschrieben; eine stillschweigende Garantie der Reviewer-Einstufung ist verboten.

---

# 45. Build-, Packaging- und Verifikationsskripte

## 45.1 `scripts/clean.mjs`

```js
import { rm } from "node:fs/promises";

await Promise.all([
  rm("dist", { recursive: true, force: true }),
  rm("coverage", { recursive: true, force: true }),
  rm("playwright-report", { recursive: true, force: true }),
  rm("test-results", { recursive: true, force: true }),
  rm("artifacts/release", { recursive: true, force: true })
]);
```

## 45.2 `scripts/build.mjs`

```js
import { build } from "vite";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
  throw new Error("package.json contains no valid WebExtension version");
}

async function buildEntry(entry, fileName) {
  await build({
    root,
    publicDir: false,
    build: {
      emptyOutDir: false,
      sourcemap: false,
      minify: false,
      target: "firefox140",
      outDir: dist,
      lib: {
        entry: resolve(root, entry),
        name: fileName.replace(/\W+/g, "_"),
        formats: ["iife"],
        fileName: () => fileName
      },
      rollupOptions: { output: { inlineDynamicImports: true, generatedCode: "es2015" } }
    }
  });
}

await mkdir(dist, { recursive: true });
await buildEntry("src/background/index.ts", "background.js");
await buildEntry("src/content/index.ts", "content.js");
await cp(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });

const manifest = JSON.parse(await readFile(resolve(root, "public/manifest.json"), "utf8"));
if (manifest.version !== packageJson.version) {
  throw new Error(`Manifest version ${manifest.version} differs from package version ${packageJson.version}`);
}
await writeFile(resolve(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
```

## 45.3 `scripts/verify-no-network.mjs`

```js
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const forbidden = [
  ["fetch", /\bfetch\s*\(/u],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
  ["WebSocket", /\bWebSocket\b/u],
  ["EventSource", /\bEventSource\b/u],
  ["sendBeacon", /\bnavigator\.sendBeacon\b/u],
  ["importScripts", /\bimportScripts\s*\(/u],
  ["remote dynamic import", /\bimport\s*\(\s*["'`]https?:\/\//u],
  ["eval", /\beval\s*\(/u],
  ["new Function", /\bnew\s+Function\b/u],
  ["document.cookie", /\bdocument\.cookie\b/u]
];

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(full)));
    else if (/\.(ts|js|mjs)$/u.test(entry.name)) result.push(full);
  }
  return result;
}

const roots = ["src", "dist"];
const failures = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const content = await readFile(file, "utf8");
    for (const [name, pattern] of forbidden) {
      if (pattern.test(content)) failures.push(`${file}: ${name}`);
    }
  }
}

if (failures.length) {
  console.error(`Forbidden network, cookie or dynamic-code patterns found:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("No forbidden network, cookie or dynamic-code primitives found.");
```

Wichtig: Ein statischer URL-String wie `https://mail.google.com/` ist keine Netzwerkoperation und darf nicht pauschal verboten werden. Verboten sind die ausführenden Netzwerkprimitive und Remote-Code-Pfade.

## 45.4 `scripts/verify-manifest.mjs`

```js
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const allowedPermissions = new Set(["storage"]);
const fail = (message) => { console.error(message); process.exitCode = 1; };

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (manifest.version !== packageJson.version) fail("manifest and package versions differ");
if (!Array.isArray(manifest.permissions)) fail("permissions must be an array");
for (const permission of manifest.permissions ?? []) {
  if (!allowedPermissions.has(permission)) fail(`Unexpected permission: ${permission}`);
}
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(["https://mail.google.com/*"])) fail("host_permissions must be exactly Gmail");
if (manifest.incognito !== "not_allowed") fail("incognito must be not_allowed");
if (manifest.browser_specific_settings?.gecko?.id !== "{a3f84f1e-3947-4fe6-8d31-6d5deff1ae71}") fail("stable Gecko ID mismatch");
if (manifest.browser_specific_settings?.gecko?.strict_min_version !== "140.0") fail("strict_min_version must be 140.0");
const dataPermissions = manifest.browser_specific_settings?.gecko?.data_collection_permissions;
if (JSON.stringify(dataPermissions?.required) !== JSON.stringify(["none"])) fail('data_collection_permissions.required must be ["none"] pending PRIV-AMO-01');
if (JSON.stringify(manifest.background?.scripts) !== JSON.stringify(["background.js"])) fail("background.scripts must be exactly background.js");
if (manifest.background?.service_worker) fail("Firefox-only V1 must not declare service_worker");
if (manifest.update_url) fail("update_url is forbidden for AMO release");
if (manifest.content_security_policy?.extension_pages?.includes("unsafe-eval")) fail("unsafe-eval is forbidden");
if (process.exitCode) process.exit(process.exitCode);
console.log("Manifest contract verified.");
```

## 45.5 `scripts/verify-dist.mjs`

```js
import { readdir, readFile, stat } from "node:fs/promises";

const allowedTopLevel = new Set(["manifest.json", "background.js", "content.js", "icons"]);
for (const entry of await readdir("dist")) {
  if (!allowedTopLevel.has(entry)) throw new Error(`Unexpected dist entry: ${entry}`);
}
for (const file of ["dist/background.js", "dist/content.js"]) {
  const info = await stat(file);
  if (info.size === 0) throw new Error(`${file} is empty`);
  if (info.size > 750_000) throw new Error(`${file} exceeds 750 KB review budget`);
  const content = await readFile(file, "utf8");
  if (/sourceMappingURL/u.test(content)) throw new Error(`${file} contains a source map reference`);
  if (/made by Ceegore/u.test(content) === false && file.endsWith("content.js")) {
    throw new Error("content.js does not contain the locked overlay credit");
  }
}
console.log("Distribution layout verified.");
```

## 45.6 `scripts/package.mjs`

```js
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const releaseDir = resolve("artifacts/release");
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
const webExt = resolve("node_modules", ".bin", process.platform === "win32" ? "web-ext.cmd" : "web-ext");
await exec(webExt, ["build", "--source-dir", "dist", "--artifacts-dir", releaseDir, "--overwrite-dest"], { shell: false });
await exec("git", ["archive", "--format=zip", "--output", resolve(releaseDir, "source.zip"), "HEAD"], { shell: false });

const files = (await readdir(releaseDir)).filter((name) => /\.(zip|xpi)$/u.test(name)).sort();
if (files.length < 2) throw new Error("Expected extension archive and source archive");
const lines = [];
for (const name of files) {
  const bytes = await readFile(resolve(releaseDir, name));
  lines.push(`${createHash("sha256").update(bytes).digest("hex")}  ${name}`);
}
await writeFile(resolve(releaseDir, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
console.log("Fresh release artifacts created.");
```

## 45.7 Packaging-Gates

- `artifacts/release/` wird vor jedem Build gelöscht;
- niemals globales `npx` oder Shell-Interpolation für `web-ext`;
- `git status --porcelain` muss vor Packaging leer sein;
- Source-ZIP und Extension-Archiv stammen aus demselben Commit;
- Prüfsummen werden erst nach erfolgreichem vollständigem Verify geschrieben;
- Binäridentität von ZIP-Dateien wird wegen Zeitstempeln nicht vorausgesetzt; verglichen werden entpackter Inhalt, Dateinamen, Größen und Hashes der enthaltenen Dateien;
- die signierte AMO-Datei wird nochmals separat gegen Manifest, Berechtigungen und installierte Permission-Prompts geprüft.

---

# 46. Domänenverträge und gemeinsame Typen

## 46.1 Designprinzip

Alle Schichten kommunizieren über explizite unveränderliche Daten. DOM-Elemente dürfen nicht im Store, in Diagnoseexporten oder zwischen Background und Content Script gespeichert werden.

## 46.2 `src/shared/result.ts`

```ts
export type Result<T, E> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function mapResult<T, U, E>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(mapper(result.value)) : result;
}
```

## 46.3 `src/shared/errors.ts`

```ts
export type ErrorCode =
  | "GISO-SHELL-001"
  | "GISO-VIEW-NOT-INBOX-001"
  | "GISO-LIST-001"
  | "GISO-ROWS-001"
  | "GISO-SENDER-CONFLICT-001"
  | "GISO-SENDER-UNRESOLVED-001"
  | "GISO-SEARCH-BOX-001"
  | "GISO-SEARCH-MISMATCH-001"
  | "GISO-SEARCH-TIMEOUT-001"
  | "GISO-SEARCH-EMPTY-001"
  | "GISO-SEARCH-RELATED-ONLY-001"
  | "GISO-SELECT-PAGE-001"
  | "GISO-SELECT-PAGE-002"
  | "GISO-SELECT-ALL-001"
  | "GISO-MOVE-001"
  | "GISO-MOVE-002"
  | "GISO-COMPLETION-UNCERTAIN-001"
  | "GISO-STATE-ILLEGAL-001"
  | "GISO-ABORT-001"
  | "GISO-DOM-CHANGED-001"
  | "GISO-INTERNAL-001";

export interface AppError {
  readonly code: ErrorCode;
  readonly userMessageKey: string;
  readonly technicalMessage: string;
  readonly recoverable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function appError(
  code: ErrorCode,
  userMessageKey: string,
  technicalMessage: string,
  recoverable: boolean,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return { code, userMessageKey, technicalMessage, recoverable, ...(details ? { details } : {}) };
}
```

## 46.4 `src/shared/types.ts`

```ts
import type { AppError } from "./errors";

export type Confidence = "high" | "medium" | "low" | "unresolved";

export interface SenderIdentity {
  readonly normalizedEmail: string | null;
  readonly rawEmail: string | null;
  readonly displayName: string | null;
  readonly source:
    | "email-attribute"
    | "hovercard-id"
    | "data-email"
    | "title"
    | "aria-label"
    | "visible-text"
    | "hovercard"
    | "none";
  readonly confidence: Confidence;
  readonly diagnostics: readonly string[];
}

export interface AnalyzedEntry {
  readonly fingerprint: string;
  readonly sender: SenderIdentity;
  readonly rowIndex: number;
}

export type GroupStatus = "ready" | "ignored" | "in-progress" | "done" | "error";

export interface SenderGroup {
  readonly id: string;
  readonly normalizedEmail: string;
  readonly displayNames: readonly string[];
  readonly primaryDisplayName: string;
  readonly visibleEntryCount: number;
  readonly sourceFingerprints: readonly string[];
  readonly confidence: "high" | "medium";
  readonly status: GroupStatus;
  readonly lastErrorCode?: string;
}

export interface AnalysisResult {
  readonly startedAt: number;
  readonly completedAt: number;
  readonly sourceRoute: Readonly<{
    accountSlot: number | null;
    view: string;
    fingerprint: string;
  }>;
  readonly rowCount: number;
  readonly resolvedCount: number;
  readonly unresolvedCount: number;
  readonly duplicateCount: number;
  readonly weakFingerprintCount: number;
  readonly groups: readonly SenderGroup[];
  readonly unresolvedEntries: readonly AnalyzedEntry[];
}

export type WorkflowState =
  | "IDLE"
  | "ANALYZING"
  | "RESULTS_READY"
  | "CONFIRM_SEARCH"
  | "SETTING_SEARCH"
  | "WAITING_SEARCH_RESULTS"
  | "SELECTING_PAGE"
  | "WAITING_SELECT_ALL"
  | "MANUAL_SELECT_ALL"
  | "OPENING_MOVE_MENU"
  | "WAITING_TARGET_SELECTION"
  | "VERIFYING_COMPLETION"
  | "COMPLETED"
  | "CANCELLED"
  | "ERROR";

export type WorkflowStep = "search" | "select-page" | "select-all" | "open-move" | "choose-target";
export type StepStatus = "pending" | "active" | "done" | "help" | "failed";

export interface DiagnosticEvent {
  readonly timestamp: number;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AppState {
  readonly overlayVisible: boolean;
  readonly workflow: WorkflowState;
  readonly analysis: AnalysisResult | null;
  readonly activeGroupId: string | null;
  readonly expectedQuery: string | null;
  readonly error: AppError | null;
  readonly filter: string;
  readonly sort: "count" | "name" | "address";
  readonly diagnostics: readonly DiagnosticEvent[];
}
```

## 46.5 `src/shared/abort.ts`

```ts
export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("Operation aborted", "AbortError");
}

export function isAbortError(value: unknown): boolean {
  return value instanceof DOMException && value.name === "AbortError";
}
```

## 46.6 `src/shared/time.ts`

```ts
import { assertNotAborted } from "./abort";

export async function delay(ms: number, signal: AbortSignal): Promise<void> {
  assertNotAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Operation aborted", "AbortError"));
    }, { once: true });
  });
}

export async function waitForFingerprint<T extends string | number | boolean>(options: {
  readonly read: () => T | null;
  readonly accept: (value: T) => boolean;
  readonly timeoutMs: number;
  readonly stabilityMs: number;
  readonly signal: AbortSignal;
}): Promise<T> {
  const { read, accept, timeoutMs, stabilityMs, signal } = options;
  const started = performance.now();
  let candidate: T | null = null;
  let stableSince = 0;
  while (performance.now() - started < timeoutMs) {
    assertNotAborted(signal);
    const current = read();
    if (current === null || !accept(current)) {
      candidate = null;
      stableSince = 0;
    } else if (candidate === current) {
      if (performance.now() - stableSince >= stabilityMs) return current;
    } else {
      candidate = current;
      stableSince = performance.now();
    }
    await delay(50, signal);
  }
  throw new Error(`waitForFingerprint timed out after ${timeoutMs} ms`);
}
```

---

# 47. Nachrichtenprotokoll zwischen Background und Content Script

## 47.1 Erlaubte Nachrichten

```ts
export type BackgroundToContentMessage =
  | Readonly<{ type: "TOGGLE_OVERLAY" }>
  | Readonly<{ type: "SHOW_OVERLAY" }>;

export interface ContentResponse {
  readonly ok: boolean;
  readonly overlayVisible?: boolean;
  readonly error?: string;
}

export function isContentResponse(value: unknown): value is ContentResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record["ok"] === "boolean" &&
    (record["overlayVisible"] === undefined || typeof record["overlayVisible"] === "boolean") &&
    (record["error"] === undefined || typeof record["error"] === "string");
}
```

Keine Nachricht darf E-Mail-Adresse, Anzeigename, DOM-Auszug, Query oder Analyseergebnis enthalten. Nicht verwendete Nachrichtenarten werden nicht vorsorglich definiert.

## 47.2 `src/shared/constants.ts`

```ts
export const GMAIL_HOME_URL = "https://mail.google.com/" as const;
export const OVERLAY_ROOT_ID = "giso-extension-root" as const;
export const BRAND_CREDIT = "made by Ceegore" as const;
```

## 47.3 `src/background/index.ts`

```ts
import { GMAIL_HOME_URL } from "@/shared/constants";
import { isContentResponse, type BackgroundToContentMessage } from "@/shared/messages";

browser.action.onClicked.addListener(async (tab) => {
  if (typeof tab.id !== "number") return;
  const message: BackgroundToContentMessage = { type: "TOGGLE_OVERLAY" };

  let rawResponse: unknown;
  try {
    rawResponse = await browser.tabs.sendMessage(tab.id, message);
  } catch {
    await browser.tabs.create({ url: GMAIL_HOME_URL });
    return;
  }

  if (!isContentResponse(rawResponse)) {
    console.warn("Inbox Sender Organizer received an invalid content response.");
    return;
  }
  if (!rawResponse.ok) {
    console.warn("Inbox Sender Organizer could not toggle the existing Gmail overlay:", rawResponse.error ?? "unknown error");
  }
});
```

Nur ein Transportfehler beziehungsweise fehlender Content-Script-Empfänger öffnet Gmail. Eine gültige `{ok:false}`-Antwort darf keinen zweiten Tab erzeugen.

## 47.4 Message-Gate

Tests beweisen:

- unbekannte Nachricht wird ignoriert;
- Listener-Ausnahme wird in `{ok:false}` übersetzt;
- Antwort innerhalb 500 ms;
- zwei schnelle Klicks erzeugen keinen zweiten Overlay-Host;
- Nicht-Gmail-Tab beziehungsweise fehlender Empfänger öffnet exakt einen Gmail-Tab;
- gültige Fehlerantwort öffnet keinen neuen Tab;
- Loginseite erlaubt Overlay, sperrt aber Analyse;
- keine Nachricht enthält personenbezogene Sitzungsdaten.

---

# 48. Deterministische Zustandsmaschine und Store

## 48.1 Ereignisse – `src/app/events.ts`

```ts
import type { AnalysisResult, AppState } from "@/shared/types";
import type { AppError } from "@/shared/errors";

export type AppEvent =
  | { type: "TOGGLE_OVERLAY" }
  | { type: "SHOW_OVERLAY" }
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_SUCCEEDED"; result: AnalysisResult }
  | { type: "ANALYSIS_FAILED"; error: AppError }
  | { type: "SELECT_GROUP"; groupId: string }
  | { type: "CONFIRM_SEARCH" }
  | { type: "SEARCH_SUBMITTED"; query: string }
  | { type: "SEARCH_READY" }
  | { type: "PAGE_SELECTED" }
  | { type: "ALL_SELECTED" }
  | { type: "MANUAL_SELECT_REQUIRED" }
  | { type: "MANUAL_SELECT_CONFIRMED" }
  | { type: "MOVE_MENU_OPENED" }
  | { type: "TARGET_CHOICE_DETECTED" }
  | { type: "COMPLETION_CONFIRMED" }
  | { type: "IGNORE_GROUP"; groupId: string }
  | { type: "MARK_GROUP_READY"; groupId: string }
  | { type: "MARK_GROUP_DONE"; groupId: string }
  | { type: "MARK_GROUP_ERROR"; groupId: string; errorCode: string }
  | { type: "FAIL"; error: AppError }
  | { type: "CANCELLED" }
  | { type: "RETURN_TO_RESULTS" }
  | { type: "SET_FILTER"; value: string }
  | { type: "SET_SORT"; value: AppState["sort"] };
```

`CONFIRM_SEARCH` enthält absichtlich keinen Query-String. Der Controller erzeugt die Query ausschließlich aus der validierten Adresse der aktiven Gruppe und dispatcht sie erst mit `SEARCH_SUBMITTED`.

## 48.2 Kritische Zustände

```ts
const CRITICAL = new Set([
  "SETTING_SEARCH",
  "WAITING_SEARCH_RESULTS",
  "SELECTING_PAGE",
  "WAITING_SELECT_ALL",
  "MANUAL_SELECT_ALL",
  "OPENING_MOVE_MENU",
  "WAITING_TARGET_SELECTION",
  "VERIFYING_COMPLETION"
]);
```

Während eines kritischen Zustands darf `TOGGLE_OVERLAY` das Overlay nicht verbergen. Es bleibt sichtbar und zeigt eine explizite Abbruchaktion. Der Toolbar-Klick kann es lediglich nach vorn holen.

## 48.3 Helfer

```ts
import type { AppState, DiagnosticEvent, SenderGroup, StepStatus, WorkflowStep } from "@/shared/types";

const MAX_DIAGNOSTICS = 500;

export function appendDiagnostic(state: AppState, event: DiagnosticEvent): readonly DiagnosticEvent[] {
  return [...state.diagnostics, event].slice(-MAX_DIAGNOSTICS);
}

function updateGroup(state: AppState, groupId: string, updater: (group: SenderGroup) => SenderGroup): AppState {
  if (!state.analysis) return state;
  return {
    ...state,
    analysis: {
      ...state.analysis,
      groups: state.analysis.groups.map((group) => group.id === groupId ? updater(group) : group)
    }
  };
}

export function deriveSteps(workflow: AppState["workflow"]): Readonly<Record<WorkflowStep, StepStatus>> {
  const order: readonly WorkflowStep[] = ["search", "select-page", "select-all", "open-move", "choose-target"];
  const activeIndex: Partial<Record<AppState["workflow"], number>> = {
    SETTING_SEARCH: 0,
    WAITING_SEARCH_RESULTS: 0,
    SELECTING_PAGE: 1,
    WAITING_SELECT_ALL: 2,
    MANUAL_SELECT_ALL: 2,
    OPENING_MOVE_MENU: 3,
    WAITING_TARGET_SELECTION: 4,
    VERIFYING_COMPLETION: 4,
    COMPLETED: 5
  };
  const index = activeIndex[workflow] ?? -1;
  return Object.fromEntries(order.map((step, i) => [step, i < index ? "done" : i === index ? (workflow === "MANUAL_SELECT_ALL" ? "help" : "active") : "pending"])) as Readonly<Record<WorkflowStep, StepStatus>>;
}
```

`steps` wird beim Rendern aus `workflow` abgeleitet und nicht als zweite, driftende Wahrheit mutiert.

## 48.4 Reducer-Vertrag

Der Reducer MUSS rein und synchron sein. Die vollständige Implementierung folgt diesen Regeln:

- `SELECT_GROUP` ist nur für eine vorhandene Gruppe mit Status `ready` und Confidence `high|medium` erlaubt;
- `CONFIRM_SEARCH` setzt nur `SETTING_SEARCH`, noch keine Query;
- `SEARCH_SUBMITTED` wird nur akzeptiert, wenn die Query exakt dem vom Controller aus der aktiven Gruppe erzeugten Wert entspricht;
- `FAIL` ist nur aus `ANALYZING` oder kritischen Workflowzuständen erlaubt;
- `RETURN_TO_RESULTS` ist nur aus `COMPLETED`, `CANCELLED` oder `ERROR` erlaubt;
- der Controller muss seinen aktiven `AbortController` bereits beendet haben, bevor er `CANCELLED` oder `RETURN_TO_RESULTS` dispatcht;
- `IGNORE_GROUP`, `MARK_GROUP_READY`, `MARK_GROUP_DONE` und `MARK_GROUP_ERROR` aktualisieren genau eine vorhandene Gruppe;
- illegale Ereignisse erzeugen `GISO-STATE-ILLEGAL-001`, verändern aber weder Workflow noch DOM;
- Diagnoseevents werden auf 500 begrenzt.

## 48.5 Referenzkern `src/app/state-machine.ts`

```ts
import { buildInboxSenderQuery } from "@/gmail/search-controller";
import type { AppState, DiagnosticEvent, SenderGroup, StepStatus, WorkflowState, WorkflowStep } from "@/shared/types";
import type { AppEvent } from "./events";

const MAX_DIAGNOSTICS = 500;
const CRITICAL: ReadonlySet<WorkflowState> = new Set([
  "SETTING_SEARCH", "WAITING_SEARCH_RESULTS", "SELECTING_PAGE", "WAITING_SELECT_ALL",
  "MANUAL_SELECT_ALL", "OPENING_MOVE_MENU", "WAITING_TARGET_SELECTION", "VERIFYING_COMPLETION",
]);

export function isCriticalWorkflow(workflow: WorkflowState): boolean {
  return CRITICAL.has(workflow);
}

export function appendDiagnostic(state: AppState, event: DiagnosticEvent): readonly DiagnosticEvent[] {
  return [...state.diagnostics, event].slice(-MAX_DIAGNOSTICS);
}

export function deriveSteps(workflow: WorkflowState): Readonly<Record<WorkflowStep, StepStatus>> {
  const order: readonly WorkflowStep[] = ["search", "select-page", "select-all", "open-move", "choose-target"];
  const activeIndex: Partial<Record<WorkflowState, number>> = {
    SETTING_SEARCH: 0, WAITING_SEARCH_RESULTS: 0, SELECTING_PAGE: 1,
    WAITING_SELECT_ALL: 2, MANUAL_SELECT_ALL: 2, OPENING_MOVE_MENU: 3,
    WAITING_TARGET_SELECTION: 4, VERIFYING_COMPLETION: 4, COMPLETED: 5,
  };
  const index = activeIndex[workflow] ?? -1;
  return Object.fromEntries(order.map((step, itemIndex) => [
    step,
    itemIndex < index ? "done" : itemIndex === index ? (workflow === "MANUAL_SELECT_ALL" ? "help" : "active") : "pending",
  ])) as Readonly<Record<WorkflowStep, StepStatus>>;
}

function illegal(state: AppState, event: AppEvent): AppState {
  return {
    ...state,
    diagnostics: appendDiagnostic(state, {
      timestamp: Date.now(),
      level: "error",
      code: "GISO-STATE-ILLEGAL-001",
      message: `Illegal ${event.type} transition from ${state.workflow}`,
    }),
  };
}

function replaceGroup(state: AppState, groupId: string, updater: (group: SenderGroup) => SenderGroup): AppState | null {
  if (!state.analysis) return null;
  const index = state.analysis.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return null;
  return {
    ...state,
    analysis: {
      ...state.analysis,
      groups: state.analysis.groups.map((group) => group.id === groupId ? updater(group) : group),
    },
  };
}

function updateGroupEvent(state: AppState, event: Extract<AppEvent, { type: "IGNORE_GROUP" | "MARK_GROUP_READY" | "MARK_GROUP_DONE" | "MARK_GROUP_ERROR" }>): AppState {
  const next = replaceGroup(state, event.groupId, (group) => {
    switch (event.type) {
      case "IGNORE_GROUP":
        return group.status === "ready" ? { ...group, status: "ignored" } : group;
      case "MARK_GROUP_READY": {
        if (!["in-progress", "error"].includes(group.status)) return group;
        const { lastErrorCode: _discarded, ...withoutError } = group;
        return { ...withoutError, status: "ready" };
      }
      case "MARK_GROUP_DONE": {
        if (!["in-progress", "ready"].includes(group.status)) return group;
        const { lastErrorCode: _discarded, ...withoutError } = group;
        return { ...withoutError, status: "done" };
      }
      case "MARK_GROUP_ERROR":
        return group.status === "in-progress" ? { ...group, status: "error", lastErrorCode: event.errorCode } : group;
    }
  });
  if (!next || next === state) return illegal(state, event);
  const before = state.analysis?.groups.find((group) => group.id === event.groupId);
  const after = next.analysis?.groups.find((group) => group.id === event.groupId);
  return before === after || before?.status === after?.status ? illegal(state, event) : next;
}

export function reduceAppState(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "TOGGLE_OVERLAY":
      return isCriticalWorkflow(state.workflow) ? { ...state, overlayVisible: true } : { ...state, overlayVisible: !state.overlayVisible };
    case "SHOW_OVERLAY": return { ...state, overlayVisible: true };
    case "SET_FILTER": return { ...state, filter: event.value };
    case "SET_SORT": return { ...state, sort: event.value };
    case "START_ANALYSIS":
      return ["IDLE", "RESULTS_READY"].includes(state.workflow)
        ? { ...state, workflow: "ANALYZING", error: null, activeGroupId: null, expectedQuery: null }
        : illegal(state, event);
    case "ANALYSIS_SUCCEEDED":
      return state.workflow === "ANALYZING" ? { ...state, workflow: "RESULTS_READY", analysis: event.result, error: null } : illegal(state, event);
    case "ANALYSIS_FAILED":
      return state.workflow === "ANALYZING" ? { ...state, workflow: "ERROR", error: event.error } : illegal(state, event);
    case "SELECT_GROUP": {
      const group = state.analysis?.groups.find((candidate) => candidate.id === event.groupId);
      return state.workflow === "RESULTS_READY" && group?.status === "ready"
        ? { ...state, workflow: "CONFIRM_SEARCH", activeGroupId: group.id, error: null }
        : illegal(state, event);
    }
    case "CONFIRM_SEARCH":
      return state.workflow === "CONFIRM_SEARCH" ? { ...state, workflow: "SETTING_SEARCH" } : illegal(state, event);
    case "SEARCH_SUBMITTED": {
      const group = state.analysis?.groups.find((candidate) => candidate.id === state.activeGroupId);
      const expected = group ? buildInboxSenderQuery(group.normalizedEmail) : null;
      return state.workflow === "SETTING_SEARCH" && expected === event.query
        ? { ...state, workflow: "WAITING_SEARCH_RESULTS", expectedQuery: event.query }
        : illegal(state, event);
    }
    case "SEARCH_READY": return state.workflow === "WAITING_SEARCH_RESULTS" ? { ...state, workflow: "SELECTING_PAGE" } : illegal(state, event);
    case "PAGE_SELECTED": return state.workflow === "SELECTING_PAGE" ? { ...state, workflow: "WAITING_SELECT_ALL" } : illegal(state, event);
    case "ALL_SELECTED": return state.workflow === "WAITING_SELECT_ALL" ? { ...state, workflow: "OPENING_MOVE_MENU" } : illegal(state, event);
    case "MANUAL_SELECT_REQUIRED":
      return ["SELECTING_PAGE", "WAITING_SELECT_ALL"].includes(state.workflow) ? { ...state, workflow: "MANUAL_SELECT_ALL" } : illegal(state, event);
    case "MANUAL_SELECT_CONFIRMED": return state.workflow === "MANUAL_SELECT_ALL" ? { ...state, workflow: "OPENING_MOVE_MENU" } : illegal(state, event);
    case "MOVE_MENU_OPENED": return state.workflow === "OPENING_MOVE_MENU" ? { ...state, workflow: "WAITING_TARGET_SELECTION" } : illegal(state, event);
    case "TARGET_CHOICE_DETECTED": return state.workflow === "WAITING_TARGET_SELECTION" ? { ...state, workflow: "VERIFYING_COMPLETION" } : illegal(state, event);
    case "COMPLETION_CONFIRMED": return state.workflow === "VERIFYING_COMPLETION" ? { ...state, workflow: "COMPLETED" } : illegal(state, event);
    case "FAIL": return state.workflow === "ANALYZING" || isCriticalWorkflow(state.workflow) ? { ...state, workflow: "ERROR", error: event.error } : illegal(state, event);
    case "CANCELLED": return state.workflow === "ANALYZING" || isCriticalWorkflow(state.workflow) ? { ...state, workflow: "CANCELLED", error: null } : illegal(state, event);
    case "RETURN_TO_RESULTS":
      return ["COMPLETED", "CANCELLED", "ERROR"].includes(state.workflow)
        ? state.analysis
          ? { ...state, workflow: "RESULTS_READY", activeGroupId: null, expectedQuery: null, error: null }
          : { ...state, workflow: "IDLE", activeGroupId: null, expectedQuery: null, error: null }
        : illegal(state, event);
    case "IGNORE_GROUP":
    case "MARK_GROUP_READY":
    case "MARK_GROUP_DONE":
    case "MARK_GROUP_ERROR":
      return updateGroupEvent(state, event);
  }
}
```

Der Referenzkern enthält alle Helfer vollständig. Keine nicht definierte Ergänzungsfunktion ist erforderlich.

## 48.6 Store-Regeln

- State niemals mutieren;
- Subscriber aus Snapshot iterieren;
- fehlerhafter Subscriber blockiert keine anderen;
- keine DOM-Elemente im Store;
- maximal 500 Diagnostics;
- Overlay-Rendering verwendet `deriveSteps(state.workflow)`;
- Controller besitzt höchstens einen Effect-Run und muss diesen vor Route-Wechsel, Abbruch oder Session-Reset wirklich aborten.

---

# 49. E-Mail-Parser und Normalisierung – vollständiger Referenzcode

## 49.1 Sicherheits- und Produktentscheidung

V1 akzeptiert E-Mail-Adressen mit ASCII-Lokalteil und ASCII- oder Unicode-IDN-Domain. Die Domain wird vor der eigentlichen Syntaxprüfung über die Browser-URL-Implementierung in ASCII/Punycode normalisiert. Der Parser entfernt weder Punkte noch Plus-Tags und verwendet keine Anbieter-Sonderregeln.

## 49.2 `src/analyzer/email-parser.ts`

```ts
import { err, ok, type Result } from "@/shared/result";

export interface ParsedEmailCandidate {
  readonly displayName: string | null;
  readonly email: string;
}

export type EmailParseError = "EMPTY" | "CONTROL_CHARACTER" | "TOO_LONG" | "MULTIPLE_EMAILS" | "INVALID_SYNTAX";

const LOCAL = String.raw`[A-Z0-9.!#$%&'*+/=?^_\`{|}~-]+`;
const DOMAIN = String.raw`(?:[A-Z0-9\u0080-\u{10FFFF}](?:[A-Z0-9\u0080-\u{10FFFF}-]{0,61}[A-Z0-9\u0080-\u{10FFFF}])?)(?:\.(?:[A-Z0-9\u0080-\u{10FFFF}](?:[A-Z0-9\u0080-\u{10FFFF}-]{0,61}[A-Z0-9\u0080-\u{10FFFF}])?))+`;
const EMAIL_FIND_PATTERN = new RegExp(`${LOCAL}@${DOMAIN}`, "giu");
const ASCII_FULL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const CONTROL_PATTERN = /[\u0000-\u001F\u007F]/u;
const RAW_DOMAIN_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+$/u;

function normalizeDomain(rawDomain: string): string | null {
  const domain = rawDomain.normalize("NFKC").replace(/\.$/u, "").toLowerCase();
  if (!RAW_DOMAIN_PATTERN.test(domain) || /[/\\?#:@]/u.test(domain)) return null;
  try {
    const hostname = new URL(`https://${domain}/`).hostname.toLowerCase();
    return hostname && !hostname.includes("/") ? hostname : null;
  } catch { return null; }
}

export function normalizeEmail(raw: string): Result<string, EmailParseError> {
  const trimmed = raw.normalize("NFKC").trim().replace(/^<|>$/gu, "");
  if (!trimmed) return err("EMPTY");
  if (CONTROL_PATTERN.test(trimmed)) return err("CONTROL_CHARACTER");
  if (trimmed.length > 320) return err("TOO_LONG");
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1 || trimmed.indexOf("@") !== at) return err("INVALID_SYNTAX");
  const local = trimmed.slice(0, at).toLowerCase();
  const domain = normalizeDomain(trimmed.slice(at + 1));
  if (!domain || local.length > 64 || domain.length > 255 || /^\.|\.$|\.\./u.test(local)) return err("INVALID_SYNTAX");
  const normalized = `${local}@${domain}`;
  if (normalized.length > 320) return err("TOO_LONG");
  return ASCII_FULL_PATTERN.test(normalized) ? ok(normalized) : err("INVALID_SYNTAX");
}

export function parseEmailCandidate(value: string): Result<ParsedEmailCandidate, EmailParseError> {
  const normalizedValue = value.normalize("NFKC").trim();
  if (!normalizedValue) return err("EMPTY");
  if (CONTROL_PATTERN.test(normalizedValue)) return err("CONTROL_CHARACTER");
  if (normalizedValue.length > 1_024) return err("TOO_LONG");

  const rawMatches = [...normalizedValue.matchAll(EMAIL_FIND_PATTERN)].map((match) => ({ raw: match[0], index: match.index ?? -1 }));
  const normalizedMatches = rawMatches.map((match) => ({ ...match, normalized: normalizeEmail(match.raw) })).filter((match) => match.normalized.ok);
  const unique = [...new Map(normalizedMatches.map((match) => [match.normalized.ok ? match.normalized.value : "", match])).values()];
  if (unique.length === 0) return err("INVALID_SYNTAX");
  if (unique.length > 1) return err("MULTIPLE_EMAILS");
  const match = unique[0];
  if (!match || !match.normalized.ok) return err("INVALID_SYNTAX");

  const displayNameRaw = `${normalizedValue.slice(0, match.index)} ${normalizedValue.slice(match.index + match.raw.length)}`
    .replace(/[<>()[\]"]+/gu, " ").replace(/\s+/gu, " ").trim();
  return ok({ displayName: displayNameRaw || null, email: match.normalized.value });
}
```

Der entscheidende Unterschied zur Vorversion: Die ursprüngliche Schreibweise des Matches wird anhand von Index und Länge entfernt. Ein großgeschriebenes `ALICE@Example.COM` bleibt dadurch nicht versehentlich im Anzeigenamen stehen.

## 49.3 Pflicht-Testvektoren

| ID | Eingabe | Erwartung |
|---|---|---|
| EP-001 | `alice@example.com` | Adresse normalisiert |
| EP-002 | `Alice <ALICE@Example.COM>` | Name exakt `Alice` |
| EP-003 | `<plus+tag@example.com>` | Plus bleibt |
| EP-004 | `first.last@gmail.com` | Punkt bleibt |
| EP-005 | `Name (a@example.com)` | parsbar |
| EP-006 | zwei verschiedene Adressen | `MULTIPLE_EMAILS` |
| EP-007 | dieselbe Adresse zweimal | genau eine Identität |
| EP-008 | `a@localhost` | `INVALID_SYNTAX` |
| EP-009 | Steuerzeichen | `CONTROL_CHARACTER` |
| EP-010 | >320 normalisierte Zeichen | `TOO_LONG` |
| EP-011 | Unicode-Anzeigename | Name bleibt |
| EP-012 | `user@bücher.de` | `user@xn--bcher-kva.de` |
| EP-013 | `.alice@example.com` | ungültig |
| EP-014 | `alice..x@example.com` | ungültig |
| EP-015 | Domain mit `/`, `?`, `#`, `:` | ungültig |
| EP-016 | leer | `EMPTY` |

## 49.4 Aktionsgrenze

Nur syntaktisch valide, konfliktfreie Identitäten mit Confidence `high` oder `medium` dürfen gruppiert und global bearbeitet werden. `low` bleibt ausschließlich im nicht auflösbaren Detailbereich sichtbar.

---

# 50. Gruppierung, Fingerprints und Analyse

## 50.1 Fingerprint-Grundsätze

Ein Fingerprint ist ausschließlich sitzungsintern. Er darf keine Betreffzeile, keinen Snippettext, keine komplette Zeilenbeschriftung und keine Kontoidentität enthalten.

```ts
export interface RowFingerprint {
  readonly value: string;
  readonly strength: "stable" | "weak";
}

export function fingerprintRow(row: HTMLElement, index: number, analysisRunId: string): RowFingerprint {
  const attributeNames = ["data-legacy-thread-id", "data-thread-id", "data-message-id", "id"] as const;
  for (const name of attributeNames) {
    const value = row.getAttribute(name)?.trim();
    if (value) return { value: `attr:${name}:${value}`, strength: "stable" };
  }
  return { value: `weak:${analysisRunId}:${index}`, strength: "weak" };
}
```

Vor der Fingerprintbildung dedupliziert der Analyzer identische `HTMLElement`-Objekte über ein `Set<HTMLElement>`. Bei fehlender stabiler Gmail-ID wird keine Scheinsicherheit behauptet: Ein schwacher Fingerprint verhindert Doppelzählung desselben bereits deduplizierten Elements, kann aber zwei unterschiedliche DOM-Repräsentationen desselben Threads nicht sicher zusammenführen. Der Diagnosezähler `weakFingerprintCount` macht dies sichtbar.

## 50.2 Gruppierung

```ts
import type { AnalyzedEntry, SenderGroup } from "@/shared/types";

function choosePrimaryName(names: readonly string[], fallback: string): string {
  const counts = new Map<string, { count: number; first: number }>();
  names.forEach((name, index) => {
    const current = counts.get(name);
    counts.set(name, { count: (current?.count ?? 0) + 1, first: current?.first ?? index });
  });
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)[0]?.[0] ?? fallback;
}

export function groupResolvedSenders(entries: readonly AnalyzedEntry[], minimumOccurrences = 2): SenderGroup[] {
  if (!Number.isInteger(minimumOccurrences) || minimumOccurrences < 2) throw new Error("minimumOccurrences must be an integer >= 2");
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.fingerprint, entry])).values()];
  const buckets = new Map<string, AnalyzedEntry[]>();
  for (const entry of uniqueEntries) {
    const email = entry.sender.normalizedEmail;
    if (!email || !["high", "medium"].includes(entry.sender.confidence)) continue;
    const bucket = buckets.get(email) ?? [];
    bucket.push(entry);
    buckets.set(email, bucket);
  }

  return [...buckets.entries()].flatMap(([email, bucket]) => {
    if (bucket.length < minimumOccurrences) return [];
    const names = bucket.map((entry) => entry.sender.displayName?.trim() ?? "").filter(Boolean);
    const fingerprints = bucket.map((entry) => entry.fingerprint);
    return [{
      id: `sender:${email}`,
      normalizedEmail: email,
      displayNames: [...new Set(names)],
      primaryDisplayName: choosePrimaryName(names, email),
      visibleEntryCount: bucket.length,
      sourceFingerprints: fingerprints,
      confidence: bucket.every((entry) => entry.sender.confidence === "high") ? "high" : "medium",
      status: "ready"
    } satisfies SenderGroup];
  });
}
```

## 50.3 Analysevertrag

Vorbedingungen:

- expliziter Nutzerklick;
- Workflow `IDLE` oder `RESULTS_READY`;
- Inbox-/Kategorieansicht, keine Suche;
- keine aktive Gmail-Auswahl;
- DOM mindestens 250 ms stabil;
- eigener `analysisRunId` pro Analyse.

Ausgabeinvarianten:

```text
rowCount = Anzahl deduplizierter Row-Elemente
resolvedCount + unresolvedCount = rowCount
jede sichtbare Gruppe hat count >= 2
jede Gruppe hat valide normalizedEmail
keine Fingerprint-Dopplung innerhalb oder zwischen Gruppen
keine Adresse in zwei Gruppen
completedAt >= startedAt
sourceRoute enthält nur Route-Klasse und Account-Slot, keine Query
```

Die alte Speicherung einer vollen `sourceUrl` wird nicht implementiert. Das Datenmodell verwendet stattdessen `sourceRoute: { accountSlot: number | null; view: string; fingerprint: string }`, wobei `fingerprint` nur aus nicht personenbezogenen Route-Merkmalen erzeugt wird.

## 50.4 Pflicht-Tests

- Singletons werden nicht ausgegeben;
- `low`/`unresolved` wird nie gruppiert;
- doppelte Fingerprints zählen einmal;
- identische Adresse mit verschiedenen Namen bildet eine Gruppe;
- identischer Name mit verschiedenen Adressen bildet zwei Gruppen;
- Sortierung Count absteigend, dann Name deterministisch;
- schwache Fingerprints lesen weder `aria-label` noch `textContent` der Zeile.

---

# 51. DOM-Adapter – vollständiger Sicherheitsvertrag

## 51.1 Adapter darf suchen, aber nicht entscheiden

Der Adapter liefert Kandidaten, Confidence und Evidence. Die Workflow-Schicht entscheidet anhand fester Schwellwerte, ob geklickt werden darf.

## 51.2 Detection-Typ

```ts
export interface Detection<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly errorCode?: string;
  readonly candidateCount?: number;
}
```

## 51.3 Globale Klickschwellen

| Aktion | Mindestscore | Mindestabstand zum zweitbesten Kandidaten | Exakt ein Kandidat nötig |
|---|---:|---:|---:|
| Suchbox | 75 | 15 | ja |
| Seiten-Auswahl | 85 | 20 | ja |
| Alle-Treffer-Link | 90 | 20 | ja |
| Move-Button | 90 | 25 | ja |
| Move-Menü | 80 | 15 | ja |
| Snackbar | 65 | 10 | nein, aber nur lesend |

Ein Unentschieden oder Abstand unter Delta führt zu manuellem Fallback.

## 51.4 `src/gmail/candidate-scoring.ts`

```ts
export interface CandidateEvidence {
  readonly code: string;
  readonly score: number;
  readonly detail: string;
}

export interface ScoredCandidate<T extends Element> {
  readonly element: T;
  readonly score: number;
  readonly evidence: readonly CandidateEvidence[];
}

export function scoreCandidate<T extends Element>(
  element: T,
  rules: readonly ((element: T) => CandidateEvidence | null)[],
): ScoredCandidate<T> {
  const evidence = rules.map((rule) => rule(element)).filter((item): item is CandidateEvidence => item !== null);
  return { element, evidence, score: evidence.reduce((sum, item) => sum + item.score, 0) };
}

export function selectUnambiguous<T extends Element>(
  candidates: readonly ScoredCandidate<T>[],
  minimum: number,
  delta: number,
): ScoredCandidate<T> | null {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (!best || best.score < minimum) return null;
  const second = sorted[1];
  if (second && best.score - second.score < delta) return null;
  return best;
}
```

## 51.5 Bedienbarkeit

```ts
export function isInteractable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}
```

## 51.6 Re-Resolve-before-click

Jeder Controller muss unmittelbar vor dem Klick:

1. aktuellen Workflowzustand prüfen;
2. aktuelle Route prüfen;
3. Kandidaten neu suchen;
4. Score neu berechnen;
5. `isInteractable` prüfen;
6. Overlay-Overlap prüfen;
7. Klick durchführen;
8. Nachbedingung beobachten.

Ein zuvor gespeichertes Element darf nur als Diagnosehinweis, nicht als Klickziel verwendet werden.

## 51.7 Verbotene Kandidatenbereiche

- Overlay-Shadow-Root;
- einzelne Nachrichtenzeilen bei Toolbar-Aktionen;
- Gmail-Seitenleiste;
- Chat-/Spaces-Bereiche;
- Werbe-/Promotion-Module außerhalb der Mail-Liste;
- Einstellungen;
- Suchvorschlags-Popup;
- Gemini-/AI-Overview-Bereich;
- Related-Results-Bereich.

---

# 52. Sender-Extractor – Quellenfusion und Konfliktlogik

## 52.1 Quellenpriorität

Jede Quelle erzeugt einen `Observation`-Datensatz:

```ts
interface SenderObservation {
  readonly source: SenderIdentity["source"];
  readonly raw: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly confidence: "high" | "medium" | "low";
}
```

Fusion:

1. Alle Beobachtungen normalisieren.
2. Ungültige Beobachtungen verwerfen, aber Diagnose behalten.
3. Wenn zwei verschiedene valide Adressen übrig bleiben: Konflikt, keine Gruppe.
4. Wenn genau eine Adresse bleibt: höchste Confidence verwenden.
5. Anzeigename aus der höchstgewichteten Beobachtung; sonst erster nichtleerer Name.
6. Sichtbarer Text allein ergibt höchstens `low`; `low` darf nicht in globale Aktion.

## 52.2 Attribute, die gelesen werden dürfen

```text
email
data-hovercard-id
data-email
title
aria-label
role
id
data-thread-id
data-legacy-thread-id
```

Andere `data-*`-Attribute dürfen nur nach Live-Kalibrierung und Dokumentation in `DOM_ADAPTER_MAINTENANCE.md` genutzt werden.

## 52.3 Hovercard-Budget

- nur nach expliziter Analyse;
- max. 20 Versuche;
- max. 5 pro Sekunde;
- kein Hover während Workflow-Aktionen;
- kein Klick;
- Escape nach jeder Auflösung;
- bei Overlay-/Nutzerinteraktion sofort abbrechen;
- Hovercard muss räumlich/zeitlich plausibel dem auslösenden Sender zuordenbar sein;
- keine Adresse aus global vorhandener alter Hovercard übernehmen.

---

# 53. Suchcontroller – exakte Vor- und Nachbedingungen

## 53.1 `src/gmail/search-controller.ts` – exakte Query

Gmail kann bei unquoted `from:`-Suchen Nachrichten von Alias-Adressen einbeziehen. V1 verwendet deshalb die von Gmail dokumentierte gequotete Operatorform:

```ts
import { normalizeEmail } from "@/analyzer/email-parser";

export function buildInboxSenderQuery(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized.ok) throw new Error(`Invalid sender email: ${normalized.error}`);
  return `in:inbox "from:${normalized.value}"`;
}
```

Die Vorschau im Overlay und der tatsächlich gesetzte String müssen bytegenau identisch sein.

## 53.2 Query-Vergleich

```ts
export function normalizeQueryForComparison(value: string): string {
  return value.normalize("NFKC").replace(/[“”]/gu, '"').replace(/\s+/gu, " ").trim().toLowerCase();
}
```

## 53.3 Wert setzen

```ts
export function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (!descriptor?.set) throw new Error("Native input setter unavailable");
  descriptor.set.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  if (input.value !== value) throw new Error("Search input did not accept the expected query");
}
```

## 53.4 Submission-Reihenfolge

Synthetische Keyboard-Events sind nicht vertrauenswürdig und lösen Browser-Defaultaktionen nicht garantiert aus. Verbindliche Reihenfolge:

1. eindeutig erkannte Search-Box fokussieren;
2. Vorschlagspopup gegebenenfalls mit Escape schließen;
3. Query über nativen Setter setzen und erneut lesen;
4. eindeutig erkannten nativen Gmail-Suchbutton neu auflösen und klicken;
5. falls kein sicherer Button existiert und die Box in einem eindeutig zugeordneten `HTMLFormElement` liegt: `form.requestSubmit()`;
6. synthetisches Enter nur als letzter kompatibilitätsbedingter Versuch; niemals als alleinige Erfolgsevidenz;
7. unabhängig vom Auslöseweg alle Nachbedingungen prüfen.

Kein zweiter Submission-Versuch, solange der erste noch lädt. Höchstens ein kontrollierter Retry nach Timeout.

## 53.5 Search Evidence

```ts
interface SearchReadyEvidence {
  readonly queryMatches: boolean;
  readonly routeChanged: boolean;
  readonly listFingerprintChanged: boolean;
  readonly mailListDetected: boolean;
  readonly emptyStateDetected: boolean;
  readonly relatedOnlyDetected: boolean;
  readonly loadingVisible: boolean;
  readonly stableForMs: number;
}
```

Fortfahren nur bei:

```text
queryMatches
AND (mailListDetected OR emptyStateDetected)
AND NOT relatedOnlyDetected
AND NOT loadingVisible
AND stableForMs >= 250
AND (routeChanged OR listFingerprintChanged)
```

## 53.6 Related-/Similar-Results- und Fremdergebnis-Schutz

Abbruch ohne Auswahl, wenn:

- nur „ähnliche/verwandte/similar/related results“ erkannt werden;
- Drive-, Chat-, Space- oder AI-Ergebnisse außerhalb der verifizierten Mail-Liste liegen;
- die Suchbox die Query normalisiert nicht exakt enthält;
- ein Leerzustand und fremde Ergebnisgruppen gleichzeitig nicht sicher getrennt werden können;
- die Route unerwartet Konto oder Ansicht wechselt.

## 53.7 Tests

- Query genau `in:inbox "from:alice@example.com"`;
- Alias-Erweiterung wird nicht durch unquoted Syntax ausgelöst;
- Suchbutton ist primärer Weg;
- `requestSubmit` nur bei eindeutigem Form-Kontext;
- ignoriertes synthetisches Enter führt nicht zu Erfolg;
- Related-only führt zu `GISO-SEARCH-RELATED-ONLY-001`;
- Query-Mismatch verhindert jeden Auswahlklick.

---

# 54. Auswahlcontroller – Sicherheitsreferenz

## 54.1 Auswahl aktuelle Seite

Vorbedingung:

- Workflow `SELECTING_PAGE`;
- gültige Suchansicht;
- Query stimmt;
- Mail-Liste vorhanden;
- mindestens ein Ergebnis;
- kein Related-Results-only-Zustand.

Klickziel:

- innerhalb primärer Ergebnis-Toolbar;
- Rolle Checkbox oder nativer Checkboxinput;
- nicht innerhalb Mailzeile;
- nicht „Auswahl aufheben“;
- Score ≥85, Delta ≥20.

Nachbedingung:

Mindestens eines:

- `aria-checked="true"` oder `mixed`;
- Toolbar-Aktionsbuttons erscheinen;
- Gmail-Auswahltext erscheint;
- mindestens eine Ergebniszeile wird als ausgewählt erkannt.

## 54.2 Globale Auswahl

Automatische Aktivierung nur bei Score ≥90 und Delta ≥20. Der Text muss gleichzeitig enthalten:

- positives „alle/select all“ Signal;
- Such-/Treffer-/Konversationssignal;
- kein „aufheben/clear/deselect“ Signal.

## 54.3 Manuelle Bestätigung als Zwei-Stufen-Fallback

Stufe A:

- Nutzer erhält genaue Anweisung;
- Zielbereich wird nur markiert;
- `Fortsetzen` führt erneut lesende Prüfung aus.

Stufe B, falls technisch nicht verifizierbar:

- Checkbox erscheint: „Ich bestätige, dass alle gewünschten Treffer dieser Suche ausgewählt sind.“
- Checkbox standardmäßig aus;
- Button erst nach Aktivierung verfügbar;
- Diagnose speichert `manualGlobalSelectionConfirmed: true`, aber keine Adresse.

## 54.4 Single-Page-Beweis

Ohne Global-Link darf nur fortgefahren werden, wenn eines sicher zutrifft:

1. Range-Text `1–N von N`/`1-N of N` und N ≤ ausgewählte Anzahl;
2. keine Next-Page-Steuerung bedienbar und alle erkannten Mailzeilen ausgewählt;
3. explizites Gmail-Signal „alle N ausgewählt“.

Nur „Next“-Button nicht sichtbar ist allein kein Beweis.

---

# 55. Move-Menü und Abschlussdetektion

## 55.1 Move-Button

Positive Signale:

- Toolbar-Kontext nach Auswahl;
- role button;
- DE: `Verschieben nach`, `Verschieben`, `In … verschieben`;
- EN: `Move to`, `Move`;
- sichtbar, aktiv;
- nicht in Seitenleiste/Zeile.

Negative Signale:

- `Label`, `Mark as`, `Archive`, `Delete`, `More`;
- innerhalb Overlay;
- innerhalb einzelner Zeile;
- ausgegraut;
- zwei gleichwertige Kandidaten.

## 55.2 Menü-Nachbedingung

Nach Klick muss innerhalb 4 Sekunden ein sichtbares Menü/Dialog erkannt werden, das mindestens zwei der folgenden Merkmale besitzt:

- Rolle `menu`, `dialog` oder `listbox`;
- Bezug zu Verschieben;
- Label-/Ordneroptionen;
- Suchfeld innerhalb des Menüs;
- Option „Neu erstellen“/„Create new“;
- räumliche Nähe zum Move-Button.

## 55.3 Nutzergrenze

Ab Menüöffnung stoppt jede automatische Klicklogik. Erlaubt sind nur:

- Menü sichtbar halten durch Overlay-Positionierung;
- lesendes Beobachten;
- Menü erneut öffnen, wenn der Nutzer ausdrücklich klickt;
- Abschlussindizien prüfen.

Verboten:

- Label auswählen;
- Label suchen;
- neues Label benennen;
- „Anwenden“, „Erstellen“ oder „Verschieben“ bestätigen;
- Keyboard-Events in das native Menü senden.

## 55.4 Abschluss-Evidenzmodell

```ts
interface CompletionEvidence {
  readonly snackbarMoveText: boolean;
  readonly menuClosedAfterInteraction: boolean;
  readonly resultCountDecreased: boolean;
  readonly resultListEmpty: boolean;
  readonly inboxMatchesAbsent: boolean;
  readonly undoVisible: boolean;
  readonly score: number;
}
```

Scoring:

| Signal | Punkte |
|---|---:|
| Snackbar mit Move-/Moved-Semantik | +60 |
| Undo sichtbar zusammen mit Move-Semantik | +25 |
| Liste leer | +35 |
| Ergebniszahl gesunken | +25 |
| Inbox-Treffer nicht mehr vorhanden | +35 |
| Menü geschlossen nach Nutzerinteraktion | +10 |
| Menü schloss ohne Ergebnisänderung | −20 |
| Route wechselte unerwartet | −40 |

Automatisch bestätigt ab 70 Punkten und ohne negatives Route-Signal. Sonst Nutzerbestätigung.

---

# 56. Overlay-Designsystem und UI-Verträge

## 56.1 Design Tokens

```css
:host {
  --giso-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --giso-bg: #ffffff;
  --giso-surface: #f7f8fa;
  --giso-text: #1f2328;
  --giso-muted: #5b6472;
  --giso-border: #d8dee8;
  --giso-primary: #0b57d0;
  --giso-primary-hover: #0847ad;
  --giso-danger: #b3261e;
  --giso-warning: #8a4f00;
  --giso-success: #137333;
  --giso-focus: #1a73e8;
  --giso-radius: 12px;
  --giso-shadow: 0 12px 40px rgb(0 0 0 / 22%);
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :host {
    --giso-bg: #202124; --giso-surface: #292a2d; --giso-text: #e8eaed;
    --giso-muted: #bdc1c6; --giso-border: #4a4d52; --giso-primary: #8ab4f8;
    --giso-primary-hover: #aecbfa; --giso-danger: #f28b82; --giso-warning: #fdd663;
    --giso-success: #81c995; --giso-focus: #8ab4f8;
  }
}
```

## 56.2 `src/ui/overlay-host.ts` – Host und Shadow Root

```ts
import { OVERLAY_ROOT_ID } from "@/shared/constants";

export function ensureOverlayHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  const existing = document.getElementById(OVERLAY_ROOT_ID);
  if (existing instanceof HTMLDivElement && existing.shadowRoot) return { host: existing, shadow: existing.shadowRoot };
  existing?.remove();
  const host = document.createElement("div");
  host.id = OVERLAY_ROOT_ID;
  host.style.position = "fixed";
  host.style.inset = "0 auto auto 0";
  host.style.zIndex = "2147483000";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);
  return { host, shadow };
}
```

## 56.3 `src/ui/brand-credit.ts` – verbindlicher Hinweis „made by Ceegore“

Der Hinweis ist Produktbestandteil und erscheint in **jeder** sichtbaren Overlay-Ansicht genau einmal:

- Literal: `made by Ceegore`;
- innerhalb des offenen Shadow Roots;
- unterhalb des zustandsspezifischen Inhalts;
- nicht interaktiv, kein Link, kein Tooltip, kein Tracking;
- `data-testid="brand-credit"`;
- 10 px, Zeilenhöhe 1,4, zentriert, `var(--giso-muted)`;
- ausreichender Kontrast in Light/Dark Mode;
- nicht im `aria-live`- oder Fehlerbereich;
- darf kritische Gmail-Bedienelemente nicht überdecken.

```ts
import { BRAND_CREDIT } from "@/shared/constants";

export function renderBrandCredit(): HTMLParagraphElement {
  const credit = document.createElement("p");
  credit.className = "giso-brand-credit";
  credit.dataset["testid"] = "brand-credit";
  credit.textContent = BRAND_CREDIT;
  return credit;
}
```

```css
.giso-brand-credit {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.4;
  text-align: center;
  color: var(--giso-muted);
  user-select: text;
}
```

Der Root-Renderer leert nur den zustandsspezifischen Container, nicht den gesamten Shadow Root, oder hängt den Credit nach jedem Render deterministisch genau einmal an. Ein Test zählt `shadow.querySelectorAll('[data-testid="brand-credit"]')` und erwartet `1`.

## 56.4 Rendering-Regeln

- Laufzeitwerte nur mit `textContent`;
- keine unsichere `innerHTML`-Interpolation;
- `data-testid` für Mock-E2E;
- Buttons `type="button"`;
- genau eine primäre Aktion je Zustand;
- konkurrierende Aktionen während Effects disabled;
- `aria-live="polite"` nur für Fortschritt;
- `role="alert"` nur für Fehler;
- Focus Trap und Restore im Sicherheitsdialog;
- Toolbar-Toggle versteckt das Overlay nicht während kritischer Zustände.

## 56.5 Positionierung und Drag-Vertrag

Die gespeicherte Overlay-Position ist nur zulässig, weil das Verhalten vollständig definiert ist:

- Drag ausschließlich über einen sichtbaren Header-Handle „Overlay verschieben“;
- Pointer Capture; keine Drag-Auslösung von Button, Link, Input oder Dialog;
- während Drag auf Viewport begrenzen; mindestens 24 px Header bleiben sichtbar;
- Persistenz erst bei `pointerup`;
- Escape stellt Position vor Beginn des aktuellen Drags wieder her;
- Tastatur am Handle: Pfeiltasten 8 px, Shift+Pfeil 32 px;
- „Overlay-Position zurücksetzen“ stellt `top:80`, `right:16` wieder her;
- temporäres Ausweichen vor Gmails Move-Menü wird nie gespeichert;
- nach Resize/Zoom wird die Position neu geclamped.

## 56.6 Vollständige zusätzliche UI-Texte

```ts
export const deV2 = {
  madeBy: "made by Ceegore",
  moveOverlay: "Overlay verschieben",
  narrowViewportWarning: "Schmales Fenster – Gmail-Bedienelemente können verdeckt sein.",
  unknownGmailLanguage: "Diese Gmail-Oberflächensprache wird noch nicht vollständig unterstützt. Die Suche wurde geöffnet; führe Auswahl und Verschieben bitte manuell aus.",
  relatedResultsOnly: "Gmail zeigt keine sicher erkennbaren exakten Inbox-Treffer, sondern nur ähnliche Ergebnisse. Es wurde nichts ausgewählt.",
  noExactMailList: "Die E-Mail-Ergebnisliste konnte nicht sicher von anderen Gmail-Ergebnisbereichen unterschieden werden.",
  manualSelectInstruction: "Klicke in Gmail auf „Alle … auswählen, die dieser Suche entsprechen“. Klicke danach hier auf „Fortsetzen“.",
  manualSelectConfirmation: "Ich bestätige, dass alle gewünschten Treffer dieser Suche ausgewählt sind.",
  createLabelUnavailable: "Erstelle das Label über Gmails native Labelverwaltung und öffne danach das Verschieben-Menü erneut.",
  completionEvidenceWeak: "Das Add-on konnte den Abschluss nicht sicher bestätigen. Prüfe die Ergebnisliste und bestätige nur, wenn die Nachrichten tatsächlich verschoben wurden.",
  sessionLost: "Die Gmail-Seite wurde neu geladen. Die bisherige Add-on-Sitzung wurde aus Datenschutz- und Sicherheitsgründen beendet.",
  routeChanged: "Die Gmail-Ansicht hat sich während des Vorgangs geändert. Die Automatisierung wurde gestoppt.",
  noRows: "Auf dieser Gmail-Seite wurden keine analysierbaren Inbox-Einträge gefunden.",
  unresolvedConflict: "Dieser Eintrag enthält widersprüchliche Absenderinformationen und kann nicht automatisch bearbeitet werden.",
  diagnosticsRedacted: "Persönliche Daten wurden für den Diagnoseexport automatisch redigiert.",
  diagnosticsReviewWarning: "Prüfe die Datei vor dem Teilen. Technische Kontextinformationen können weiterhin enthalten sein.",
  retryDetection: "Erkennung erneut prüfen",
  openInbox: "Posteingang öffnen",
  copyQuery: "Suchanfrage kopieren",
  copied: "Kopiert",
  resetPosition: "Overlay-Position zurücksetzen",
  settingsReset: "Einstellungen wurden zurückgesetzt.",
  liveActionWarning: "Die nächsten Schritte bedienen echte Gmail-Elemente. Beobachte die Aktion und brich bei einem unerwarteten Zustand sofort ab."
} as const;
```

## 56.7 Brand-Akzeptanztests

- genau ein Credit in `IDLE`, `ANALYZING`, `RESULTS_READY`, Dialog, Workflow, Fehler, Diagnose und Abschluss;
- exakter Text inklusive Groß-/Kleinschreibung;
- kein Anchor-Element und kein Click-Listener;
- Credit existiert nur im Shadow Root;
- bei 200 % Zoom nicht abgeschnitten;
- Light/Dark-Kontrast geprüft;
- `dist/content.js` enthält den Literalstring.

---

# 57. Diagnose, Datenschutz und Redaction – Referenzimplementierung

## 57.1 Datensparsame Diagnose an der Quelle

Diagnostics dürfen nur allowgelistete technische Felder aufnehmen. Die Factory verwirft sensitive Schlüssel bereits vor der Exportredaktion.

```ts
import type { DiagnosticEvent } from "@/shared/types";

const FORBIDDEN_KEY = /email|address|query|href|url|subject|snippet|body|html|textcontent|outerhtml|arialabel|displayname|sendername|name/iu;
const ALLOWED_KEY = /^(confidence|score|candidateCount|rowCount|resolvedCount|unresolvedCount|duplicateCount|weakFingerprintCount|timeoutMs|retry|workflow|view|locale|accountSlot|manualGlobalSelectionConfirmed|evidenceCodes)$/u;

export function diagnostic(
  level: DiagnosticEvent["level"], code: string, message: string,
  details?: Readonly<Record<string, unknown>>,
): DiagnosticEvent {
  const safeDetails = details ? Object.fromEntries(Object.entries(details).filter(([key]) => ALLOWED_KEY.test(key) && !FORBIDDEN_KEY.test(key))) : undefined;
  return { timestamp: Date.now(), level, code, message, ...(safeDetails && Object.keys(safeDetails).length ? { details: safeDetails } : {}) };
}
```

## 57.2 Hash-Redaction

```ts
const EMAILISH = /(?:mailto:)?[^\s"'<>]+@[^\s"'<>]+/giu;

async function hash12(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.normalize("NFKC").toLowerCase()));
  return [...new Uint8Array(digest)].slice(0, 6).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function redactString(value: string): Promise<string> {
  let result = value.replace(/%40/giu, "@");
  for (const match of [...result.matchAll(EMAILISH)]) {
    result = result.replace(match[0], `email_sha256_12:${await hash12(match[0])}`);
  }
  return result
    .replace(/\b(?:subject|snippet|body|html|textcontent|outerhtml|aria-label)\s*[:=].*$/gimu, "[REDACTED]")
    .replace(/in:inbox\s+["']?from:[^\s"']+["']?/giu, "[QUERY_REDACTED]");
}
```

Der Domainname wird standardmäßig nicht erhalten, weil auch er personenbezogen oder organisationsbezogen sein kann.

## 57.3 Rekursive Redaction

```ts
export async function redactUnknown(value: unknown, key = ""): Promise<unknown> {
  if (FORBIDDEN_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return Promise.all(value.map((item) => redactUnknown(item, key)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([childKey, child]) => [childKey, await redactUnknown(child, childKey)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}
```

## 57.4 Export-Gate

Nach Redaction und JSON-Serialisierung wird der Export blockiert, wenn irgendeines zutrifft:

- `@`, `%40`, `mailto:`;
- `in:inbox` zusammen mit `from:`;
- `textContent`, `outerHTML`, `subject`, `snippet` mit nicht redigiertem Wert;
- Gmail-URL mit Suchhash oder Query;
- Datei >2 MB.

Der Nutzer startet den lokalen Download explizit und sieht die Warnung, die Datei vor Weitergabe zu prüfen.

## 57.5 Persistenzvertrag

`storage.local` enthält ausschließlich:

```ts
interface StoredSettingsV1 {
  readonly schemaVersion: 1;
  readonly overlayPosition: { readonly top: number; readonly right: number };
  readonly diagnosticsEnabled: boolean;
  readonly autoOpenMoveMenu: boolean;
}
```

Nie persistent: Gruppen, Absender, Query, volle URL, Kontoadresse, DOM-Text, Abschlussstatus, Diagnoseevents oder Search-Historie.

## 57.6 Privacy-/AMO-Gate `PRIV-AMO-01`

Vor Einreichung prüft ein Mensch die dann aktuelle Mozilla-Taxonomie. Das Add-on besitzt keine extension-eigenen Netzwerkaufrufe und sendet nichts an Entwicklerdienste. Durch den klar beschrifteten Nutzerbefehl wird jedoch die ausgewählte Senderadresse in Gmails native Suchbox geschrieben und anschließend von Google als Bestandteil der Gmail-Nutzung verarbeitet. Diese Tatsache muss im Datenschutztext und in den Reviewer Notes stehen. Falls Mozilla dafür eine andere `data_collection_permissions`-Kategorie oder Einwilligungsdarstellung verlangt, wird das Manifest vor Einreichung angepasst und der vollständige Privacy-Gate erneut ausgeführt. Keine Veröffentlichung basiert auf einer unbestätigten Policy-Annahme.

---

# 58. Sicherheits- und Bedrohungsmodell

## 58.1 Schutzgüter

1. Integrität des Gmail-Postfachs;
2. Verhinderung unbeabsichtigter Massenverschiebungen;
3. Vertraulichkeit von Absenderdaten und Mailmetadaten;
4. Transparenz gegenüber Nutzer und AMO-Reviewer;
5. Wartbarkeit bei Gmail-DOM-Änderungen;
6. Reproduzierbarkeit des Releases.

## 58.2 Bedrohungen und Kontrollen

| ID | Bedrohung | Auswirkung | Prävention | Detektion | Reaktion |
|---|---|---|---|---|---|
| TH-001 | falscher Toolbar-Button | falsche Gmail-Aktion | Scoring + Kontext + Delta | Nachbedingung fehlt | Stop, manuell |
| TH-002 | stale DOM reference | Klick auf neues Element | re-resolve-before-click | `isConnected`, Route | Stop |
| TH-003 | Related Results | falsche Treffer ausgewählt | Mail-Root-Klassifikation | Text-/Struktursignale | Abbruch |
| TH-004 | zwei Gmail-Konten | falscher Account | Tab-lokaler State | Route-Fingerprint | Stop bei Wechsel |
| TH-005 | Nutzer klickt parallel | Zustand driftet | UI-Sperre, Revalidation | Fingerprint ändert sich | Stop |
| TH-006 | Gmail A/B-Test | Selektorbruch | semantischer Adapter | Confidence sinkt | manueller Fallback |
| TH-007 | Diagnose leakt Daten | Datenschutzverletzung | rekursive Redaction | Post-Serialize Scan | Export blockieren |
| TH-008 | Supply Chain | kompromittierter Build | exact pins, lockfile, npm ci | audit, diff | Release blockieren |
| TH-009 | Remote Code | AMO-/Security-Verstoß | keine URLs, CSP, lint | verify-no-network | Build fail |
| TH-010 | Persistenzfehler | Senderdaten bleiben | Storage-Schema | Storage-Test | Release blockieren |
| TH-011 | Overlay verdeckt Menü | Fehlbedienung | Overlap-Erkennung | Bounding Rect | verschieben |
| TH-012 | Workflow nach Reload | unkontrollierte Fortsetzung | State nur RAM | pageshow/load | Sitzung beenden |
| TH-013 | Suchquery Injection | falsche Suche | nur validierte Adresse | Query-Equality | Abbruch |
| TH-014 | Hovercard-Verwechslung | falscher Sender | zeitliche/räumliche Zuordnung | Konfliktprüfung | unresolved |
| TH-015 | AI-Agent erweitert Scope | unerwartete Funktion | Implementation Lock | Diff-Gate | Änderung verwerfen |

## 58.3 Klick-Audit

Jeder automatische Klick schreibt vor dem Klick ein Event:

```text
CLICK_INTENT
- action
- workflowState
- candidateScore
- runnerUpScore
- evidenceCodes
- ausschließlich nicht personenbezogene `sourceRoute`-Merkmale enthalten
```

Nach dem Klick:

```text
CLICK_RESULT
- action
- confirmed true/false
- confirmationEvidence
- elapsedMs
```

Keine DOM-Texte außer kontrollierten Lexikonmatches.

---

# 59. Testdaten- und Fixture-Standard

## 59.1 Synthetische Identitäten

Nur reservierte Domains verwenden:

- `example.com`
- `example.net`
- `example.org`
- `.invalid`

Verbindliche Testsender:

```text
newsletter-alpha@example.com
newsletter-beta@example.net
billing@example.org
alerts@example.com
single@example.net
mixed-name@example.org
```

## 59.2 Fixture-Metadaten

Jede HTML-Fixture beginnt mit:

```html
<!--
GISO SYNTHETIC FIXTURE
fixture-id: FIX-DE-INBOX-LIGHT-001
source: manually authored synthetic structure
contains-real-user-data: false
gmail-ui-locale: de
conversation-view: on
density: default
expected-adapter-version: 2026.07.2
-->
```

## 59.3 Fixture-Regeln

- keine vollständigen realen Gmail-Dumps;
- keine Inline-Skripte;
- keine externen Ressourcen;
- nur minimale Struktur für Testzweck;
- generierte Gmail-Klassen entweder entfernen oder durch `giso-fixture-*` ersetzen;
- erwartete Detection-Evidence im Test angeben;
- ein Fixture testet primär einen Zustand;
- komplexe End-to-End-Sequenz gehört in Mock-SPA.

## 59.4 Mock-Gmail-Zustände

```ts
export type MockGmailState =
  | "INBOX"
  | "SEARCH_LOADING"
  | "SEARCH_RESULTS_PAGE_UNSELECTED"
  | "SEARCH_RESULTS_PAGE_SELECTED"
  | "SEARCH_RESULTS_ALL_SELECTED"
  | "MOVE_MENU_OPEN"
  | "MOVE_COMPLETED"
  | "EMPTY_RESULTS"
  | "RELATED_RESULTS_ONLY"
  | "AMBIGUOUS_TOOLBAR";
```

Der Mock muss jeden Zustandswechsel deterministisch und per Test-Hook auslösbar machen.

---

# 60. Vollständiger Testkatalog

## 60.1 Testprioritäten

- P0: Postfachintegrität, Datenschutz, kein Blindklick;
- P1: Kernfunktion und kontrollierte Fallbacks;
- P2: UX, Barrierefreiheit, Layout;
- P3: Diagnosekomfort und Wartbarkeit.

## 60.2 Unit-Testkatalog

| ID | Priorität | Test | Eingabe | Expected Result |
|---|---|---|---|---|
| UT-EMAIL-001 | P0 | parse simple address | alice@example.com | normalized address |
| UT-EMAIL-002 | P0 | parse name and brackets | Alice <ALICE@Example.COM> | name + lowercased email |
| UT-EMAIL-003 | P0 | reject two addresses | a@example.com b@example.com | MULTIPLE_EMAILS |
| UT-EMAIL-004 | P0 | preserve plus tag | a+tag@example.com | unchanged plus tag |
| UT-EMAIL-005 | P0 | preserve dots | first.last@gmail.com | unchanged dots |
| UT-EMAIL-006 | P0 | reject controls | address with U+0000 | CONTROL_CHARACTER |
| UT-EMAIL-007 | P1 | normalize IDN | user@bücher.example | punycode/URL normalized domain |
| UT-EMAIL-008 | P1 | reject local dot edge | .a@example.com | INVALID_SYNTAX |
| UT-GROUP-001 | P0 | same email groups | 2 entries same email | one group count 2 |
| UT-GROUP-002 | P0 | same name separate | same display name, two emails | two groups |
| UT-GROUP-003 | P0 | dedupe fingerprints | duplicate DOM representation | count once |
| UT-GROUP-004 | P1 | primary name frequency | two names with 2:1 frequency | most frequent name |
| UT-GROUP-005 | P1 | tie name | two names 1:1 | first observed |
| UT-GROUP-006 | P0 | exclude low confidence | valid email low confidence | no global group |
| UT-SCORE-001 | P0 | move toolbar wins | toolbar and row move-like buttons | toolbar selected |
| UT-SCORE-002 | P0 | ambiguous tie | equal top candidates | null |
| UT-SCORE-003 | P0 | below threshold | candidate score 89 for move | null |
| UT-SCORE-004 | P1 | hidden rejected | perfect label hidden | not selected |
| UT-STATE-001 | P0 | happy path transitions | all valid events | COMPLETED |
| UT-STATE-002 | P0 | illegal transition | ALL_SELECTED from IDLE | state unchanged + diagnostic |
| UT-STATE-003 | P0 | cancel each active state | CANCEL | CANCELLED |
| UT-STATE-004 | P0 | no cancel after completed | CANCEL from COMPLETED | illegal |
| UT-QUERY-001 | P0 | query exact | news@example.com | in:inbox "from:news@example.com" |
| UT-QUERY-002 | P0 | query injection rejected | a@example.com) OR in:anywhere | invalid |
| UT-QUERY-003 | P1 | comparison whitespace | extra spaces | equal normalized |
| UT-REDACT-001 | P0 | email redacted | alice@example.com | hash prefix + domain |
| UT-REDACT-002 | P0 | nested object | email nested in array | redacted |
| UT-REDACT-003 | P0 | subject removed | subject key | [REDACTED] |
| UT-REDACT-004 | P0 | display name removed | displayName key | [NAME] |
| UT-STORE-001 | P1 | subscriber isolation | one subscriber throws | others called |
| UT-TIME-001 | P0 | abort wait | AbortSignal | AbortError |
| UT-TIME-002 | P1 | stability window | flapping read | only returns after stable |


## 60.3 Fixture-Integrationstestkatalog

| ID | Priorität | Fixture | Expected Result |
|---|---|---|---|
| IT-INBOX-001 | P0 | DE Inbox Light | Liste und Sender erkannt |
| IT-INBOX-002 | P0 | EN Inbox Light | Liste und Sender erkannt |
| IT-INBOX-003 | P1 | DE Dark | unabhängig von Farben |
| IT-INBOX-004 | P1 | Compact Density | gleiche Gruppierung |
| IT-INBOX-005 | P1 | Conversation Off | Zeilen korrekt gezählt |
| IT-INBOX-006 | P0 | aktive Suche | Analyse blockiert |
| IT-INBOX-007 | P0 | einzelne Nachricht offen | Analyse blockiert |
| IT-INBOX-008 | P0 | Spam | Analyse blockiert |
| IT-SENDER-001 | P0 | `email` attribute | high confidence |
| IT-SENDER-002 | P0 | `data-hovercard-id` | high confidence |
| IT-SENDER-003 | P1 | title only | medium confidence |
| IT-SENDER-004 | P0 | conflicting attributes | unresolved conflict |
| IT-SEARCH-001 | P0 | exact results | ready evidence true |
| IT-SEARCH-002 | P0 | related only | abort code |
| IT-SEARCH-003 | P0 | Drive result section plus mail | only mail root |
| IT-SELECT-001 | P0 | page checkbox | correct toolbar target |
| IT-SELECT-002 | P0 | two similar toolbars | ambiguous/manual |
| IT-SELECT-003 | P0 | select-all banner DE | global selected |
| IT-SELECT-004 | P0 | select-all banner EN | global selected |
| IT-SELECT-005 | P0 | deselect banner | never clicked |
| IT-MOVE-001 | P0 | move button DE | menu opens |
| IT-MOVE-002 | P0 | move button EN | menu opens |
| IT-MOVE-003 | P0 | label button nearby | move wins or ambiguity stops |
| IT-COMPLETE-001 | P0 | move snackbar + undo | auto confirmed |
| IT-COMPLETE-002 | P1 | list empty only | confirmed by score if threshold |
| IT-COMPLETE-003 | P0 | menu closes no change | uncertain/manual |

## 60.4 Mock-E2E-Testkatalog

| ID | Szenario | Expected Result |
|---|---|---|
| E2E-001 | kompletter DE Happy Path | Gruppe done, keine automatische Labelwahl |
| E2E-002 | kompletter EN Happy Path | identisches Verhalten |
| E2E-003 | globale Auswahl fehlt | manuelle Anleitung + Checkboxfallback |
| E2E-004 | Suchquery weicht ab | kein Auswahlklick |
| E2E-005 | Related Results only | Fehler, null Klicks |
| E2E-006 | Nutzer bricht vor Enter ab | keine Suche |
| E2E-007 | Nutzer bricht nach Seitenauswahl ab | kein Move-Klick |
| E2E-008 | Route ändert sich während Wait | Stop |
| E2E-009 | Overlay wird verborgen | Workflow bleibt sichtbar warnend oder stoppt gemäß Regel |
| E2E-010 | Content Script doppelt initialisiert | ein Host |
| E2E-011 | Gmail entfernt Host | Host einmal wiederhergestellt |
| E2E-012 | zwei Gruppen nacheinander | getrennte Sessions, kein stale state |
| E2E-013 | Completion unsicher | Nutzer muss bestätigen |
| E2E-014 | 200 % Zoom | Primäraktion erreichbar |
| E2E-015 | Tastatur-only | Overlay bis Menü bedienbar |
| E2E-016 | reduced motion | keine notwendige Animation |
| E2E-017 | no external network | alle unerwarteten Requests blockiert/0 |

## 60.5 Failure-Injection-Katalog

| ID | Injektion | Erwartete Reaktion |
|---|---|---|
| FI-001 | Searchbox wird nach Resolve entfernt | Stop vor Setter |
| FI-002 | Checkbox wird vor Klick ersetzt | Re-resolve; kein stale click |
| FI-003 | zweiter Move-Kandidat erscheint | Ambiguität; Stop |
| FI-004 | Liste mutiert 1.000×/2s | Cooldown + Diagnose |
| FI-005 | Query wird von Gmail verändert | Mismatch; Stop |
| FI-006 | Nutzer navigiert zu Settings | Route stop |
| FI-007 | Abort exakt während click preflight | kein Klick |
| FI-008 | Abort direkt nach Klick | keine Folgeaktion |
| FI-009 | Redaction wirft | Export blockiert |
| FI-010 | storage enthält unbekannten Key | Migration verwirft Key |
| FI-011 | malformed stored settings | Defaults |
| FI-012 | build bundle enthält `fetch(` | Build fail |
| FI-013 | Manifest enthält `tabs` | Manifest verify fail |
| FI-014 | Source Map im dist | dist verify fail |
| FI-015 | XPI Build anderer Commit | Release evidence mismatch |

---

# 61. Coverage-, Qualitäts- und Mutation-Gates

## 61.1 Mindest-Coverage

- Lines ≥90 %;
- Statements ≥90 %;
- Functions ≥90 %;
- Branches ≥85 %;
- Sicherheitsmodule `state-machine`, `selection-controller`, `move-controller`, `redact`, `verify-manifest`: Branches ≥95 %.

## 61.2 Kein Coverage-Gaming

Verboten:

- `/* istanbul ignore */` ohne dokumentierte Ausnahme;
- triviale Tests ohne Assertion;
- private Methoden nur für Coverage exportieren;
- Production Branches entfernen, nur um Prozentwert zu erhöhen;
- Test gegen Mock-Implementierung statt echten Modulcode.

## 61.3 Mutation-Test-Empfehlung

Vor 1.0.0 Release SOLL ein begrenzter Mutationstest oder manuelle Mutation-Suite folgende Mutanten erkennen:

- Score `>=` zu `>`;
- Delta-Prüfung entfernt;
- Query-Equality invertiert;
- Related-Results-Stop entfernt;
- Abort-Prüfung entfernt;
- Redaction übersprungen;
- `low` Confidence zugelassen;
- Single-Page-Beweis auf „Next unsichtbar“ reduziert;
- Completion threshold gesenkt.

Gate: Jeder dieser Mutanten muss mindestens einen Test brechen.

---

# 62. CI-Referenzworkflow

## 62.1 `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.18.0
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps firefox
      - run: npm run verify
      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: verification-evidence
          path: |
            coverage/
            playwright-report/
            test-results/
            dist/
          if-no-files-found: ignore
          retention-days: 14
```

## 62.2 CI-Regeln

- keine Secrets oder Gmail-Live-Tests im normalen CI;
- keine AMO-Signierung aus Pull Requests;
- `permissions: contents: read`;
- für Release-Branches werden `checkout`, `setup-node` und `upload-artifact` auf vollständig geprüfte Commit-SHAs gepinnt; Tags allein sind für das Release-Gate nicht ausreichend;
- `npm audit --audit-level=high` prüft die tatsächlichen Dev-/Build-Abhängigkeiten und darf nicht mit `--omit=dev` umgangen werden;
- Mock-E2E läuft erst nach erfolgreichem Build und statischen Dist-Gates;
- CI-Evidence ergänzt, ersetzt aber nicht Live-, Policy- und signiertes-Paket-Gate.

---

# 63. Traceability-Matrix

| Requirement | Primärmodule | Primärtests | Phase-Gate |
|---|---|---|---|
| FR-001 Overlay | content/bootstrap, ui/overlay | E2E-010, E2E-011 | G2 |
| FR-002 Ansicht | gmail/view-detector | IT-INBOX-006–008 | G4 |
| FR-003 Zeilen | gmail/adapter, analyzer | IT-INBOX-001–005 | G4 |
| FR-004 Sender | sender-extractor | IT-SENDER-001–004 | G4 |
| FR-005 Normalisierung | email-parser | UT-EMAIL-* | G3 |
| FR-006 Gruppierung | grouping | UT-GROUP-* | G4 |
| FR-007 Query | search-controller | UT-QUERY-* | G5 |
| FR-008 Suche | search-controller | IT-SEARCH-*, E2E-004 | G5 |
| FR-009 Seite | selection-controller | IT-SELECT-001/002 | G6 |
| FR-010 Alle Treffer | selection-controller | IT-SELECT-003–005 | G6 |
| FR-011 Eine Seite | selection-controller | dedicated single-page tests | G6 |
| FR-012 Move | move-controller | IT-MOVE-* | G7 |
| FR-013 Neues Label | UI/native boundary | E2E-001/002 | G7 |
| FR-014 Abschluss | completion-detector | IT-COMPLETE-* | G7 |
| FR-015 Sitzung | store/bootstrap | E2E-012, reload tests | G8 |
| FR-016 Reanalyse | controller/UI | E2E reanalysis | G8 |
| AC-004 Keine API | verify-no-network | FI-012, E2E-017 | G9 |
| AC-008 Datenschutz | settings/redaction | UT-REDACT-*, storage tests | G9 |
| AC-011 Accessibility | UI | E2E-015 | G10 |
| AC-012 Build | scripts | CI | G11 |
| AC-013 Reproducibility | package/release | reproducible build test | G12 |

---

# 64. Evidence-Artefaktstandard

## 64.1 Verzeichnis

```text
artifacts/evidence/
├── phase-00-governance/
├── phase-01-toolchain/
├── phase-02-lifecycle/
├── phase-03-domain/
├── phase-04-analysis/
├── phase-05-search/
├── phase-06-selection/
├── phase-07-move/
├── phase-08-ui-session/
├── phase-09-privacy-security/
├── phase-10-qa/
├── phase-11-live/
└── phase-12-release/
```

## 64.2 `gate-result.json`

```json
{
  "gateId": "G6",
  "phase": "selection",
  "commit": "FULL_GIT_SHA",
  "timestampUtc": "2026-07-26T00:00:00Z",
  "status": "PASS",
  "commands": [
    { "command": "npm test -- selection", "exitCode": 0 }
  ],
  "tests": {
    "passed": 42,
    "failed": 0,
    "skipped": 0
  },
  "manualAssertions": [
    { "id": "MA-G6-001", "result": "PASS", "reviewer": "HUMAN_NAME" }
  ],
  "artifacts": ["selection-test-output.txt"],
  "exceptions": []
}
```

## 64.3 Gate-Regel

Ein Gate ist nur PASS, wenn:

- alle Expected Results erfüllt;
- kein P0/P1-Test skipped;
- keine offene Exception;
- Evidence auf aktuellem Commit basiert;
- keine uncommitted Änderungen;
- bei menschlichem Gate Reviewer angegeben;
- `status` nicht vom Agenten frei interpretiert, sondern aus Kriterien abgeleitet wird.

---

# 65. Vollständiger Implementierungsplan mit Phasen und Sub-Phasen

## 65.1 Ausführungsregeln für alle Phasen

Für jede Sub-Phase gilt zwingend:

1. Eingaben prüfen.
2. Tests/Verträge schreiben.
3. kleinsten Produktcode implementieren.
4. fokussierte Tests ausführen.
5. vollständige bisherige Suite ausführen.
6. Diff auf Scope-Verstoß prüfen.
7. Evidence schreiben.
8. Commit mit vorgegebener Konvention.
9. nächstes Gate erst nach PASS.

Der Agent darf keine Phase überspringen, auch wenn spätere Teile einfach erscheinen.


## Phase 00 – Governance und Specification Lock

**Ziel:** Sicherstellen, dass Repository, Agent und Reviewer dieselben unveränderlichen Grenzen verwenden.

### Sub-Phase 00.1 – Spezifikation verankern

**Exakte Aufgaben:**
1. Dokument als docs/PRODUCT_SPEC.md speichern.
2. SHA-256 der Spezifikation in docs/SPEC_SHA256.txt schreiben.
3. DECISIONS.md mit Verbot stiller Produktentscheidungen erstellen.

**Expected Results:**
- Spezifikation im Repository auffindbar;
- Hash reproduzierbar;
- keine Implementierungsdateien vorhanden;

### Sub-Phase 00.2 – Agentenregeln

**Exakte Aufgaben:**
1. AGENTS.md aus Kapitel 72 erstellen.
2. Scope-Change-Prozess definieren.
3. Definition für STOP-AND-ESCALATE einfügen.

**Expected Results:**
- Agent erhält eindeutige Arbeitsregeln;
- jede Unsicherheit hat einen Stop-Pfad;

### Sub-Phase 00.3 – Branch- und Commitmodell

**Exakte Aufgaben:**
1. main schützen.
2. feature branches pro Phase.
3. Conventional Commits festlegen.

**Expected Results:**
- keine direkte Produktarbeit auf main;
- Commits eindeutig rückverfolgbar;

**Pflichtbefehle:**

```bash
sha256sum docs/PRODUCT_SPEC.md > docs/SPEC_SHA256.txt
git status --short
```

**Evidence:**
- `SPEC_SHA256.txt`;
- `DECISIONS.md`;
- `AGENTS.md`;

**Gate G0 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- Spezifikation fehlt;
- Hash stimmt nicht;
- Agentenregeln erlauben Scope-Erweiterung;

**Commit:** `docs: lock product specification and agent rules`

---

## Phase 01 – Toolchain und leeres Add-on

**Ziel:** Reproduzierbare, AMO-prüfbare Buildbasis ohne Gmail-Logik erstellen.

### Sub-Phase 01.1 – Dependencies

**Exakte Aufgaben:**
1. exakte Pins installieren.
2. Lockfile committen.
3. npm audit dokumentieren.

**Expected Results:**
- npm ci aus sauberem Checkout möglich;
- keine Runtime Dependencies;

### Sub-Phase 01.2 – Konfiguration

**Exakte Aufgaben:**
1. tsconfig, ESLint, Prettier, Vitest, Playwright erstellen.
2. Node-Version pinnen.

**Expected Results:**
- alle Configs laden fehlerfrei;

### Sub-Phase 01.3 – Buildpipeline

**Exakte Aufgaben:**
1. IIFE-Build für background/content.
2. Manifest und Icons kopieren.
3. dist-Verifikation.

**Expected Results:**
- dist hat exakt erlaubte Dateien;

### Sub-Phase 01.4 – Leeres Extension-Lifecycle

**Exakte Aufgaben:**
1. Background action listener.
2. Content listener mit einfacher Antwort.
3. keine UI.

**Expected Results:**
- Toolbar-Klick in Gmail antwortet;
- Nicht-Gmail öffnet Gmail;

**Pflichtbefehle:**

```bash
npm ci
npm run build
npm run verify:manifest
npm run webext:lint
```

**Evidence:**
- `npm-ci.txt`;
- `web-ext-lint.txt`;
- `dist-tree.txt`;

**Gate G1 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- zusätzliche Berechtigung;
- minifiziertes/obfuskiertes Bundle;
- Build nur auf Entwicklerrechner;

**Commit:** `chore: establish reproducible Firefox extension toolchain`

---

## Phase 02 – Overlay-Lifecycle und Shadow-DOM-Shell

**Ziel:** Ein einmaliges, isoliertes, barrierefreies Overlay ohne Geschäftslogik implementieren.

### Sub-Phase 02.1 – Host Manager

**Exakte Aufgaben:**
1. ensureOverlayHost.
2. Duplikaterkennung.
3. begrenzte Wiederherstellung nach Host-Entfernung.

**Expected Results:**
- exakt ein Host pro Tab;

### Sub-Phase 02.2 – Visibility

**Exakte Aufgaben:**
1. Toolbar Toggle.
2. SHOW_OVERLAY.
3. Focus beim Öffnen.
4. Focus Restore beim Schließen.

**Expected Results:**
- Toggle deterministisch;
- kein Reload nötig;

### Sub-Phase 02.3 – UI Skeleton

**Exakte Aufgaben:**
1. Header, Status, Analysebutton, Schließen, Diagnose.
2. Shadow CSS Reset.
3. Light/Dark Tokens.

**Expected Results:**
- Gmail CSS beeinflusst Overlay nicht;

### Sub-Phase 02.4 – A11y Basis

**Exakte Aufgaben:**
1. dialog role.
2. aria-live.
3. Tastaturreihenfolge.
4. Escape-Regeln.

**Expected Results:**
- axe/manuelle Basisprüfung ohne kritische Fehler;

**Pflichtbefehle:**

```bash
npm test -- overlay
npm run test:e2e -- --grep Overlay
```

**Evidence:**
- `overlay-light.png`;
- `overlay-dark.png`;
- `overlay-e2e-report`;

**Gate G2 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- zweiter Host;
- globales CSS;
- innerHTML mit Laufzeitwerten;

**Commit:** `feat: add isolated Gmail overlay lifecycle`

---

## Phase 03 – Domänenmodell, Parser, Store und Zustandsmaschine

**Ziel:** Alle Gmail-unabhängigen Kernverträge vollständig und testgetrieben umsetzen.

### Sub-Phase 03.1 – Result und Errors

**Exakte Aufgaben:**
1. Result-Typ.
2. ErrorCode-Union.
3. User-/Technical separation.

**Expected Results:**
- keine untypisierten Exceptions im Normalpfad;

### Sub-Phase 03.2 – Parser

**Exakte Aufgaben:**
1. parseEmailCandidate.
2. normalizeEmail.
3. vollständige Testvektoren.

**Expected Results:**
- alle P0 Parser-Tests grün;

### Sub-Phase 03.3 – Grouping

**Exakte Aufgaben:**
1. Fingerprint contract.
2. Gruppierung.
3. Name selection.
4. Sortierung.

**Expected Results:**
- deterministische Gruppen;

### Sub-Phase 03.4 – State Machine

**Exakte Aufgaben:**
1. Events.
2. Reducer.
3. illegal transition logging.
4. cancel paths.

**Expected Results:**
- jeder Übergang getestet;

### Sub-Phase 03.5 – Store

**Exakte Aufgaben:**
1. subscribe/dispatch/getState.
2. subscriber isolation.
3. diagnostic cap.

**Expected Results:**
- keine DOM-Elemente im State;

**Pflichtbefehle:**

```bash
npm test -- email-parser grouping state-machine store
npm run typecheck
```

**Evidence:**
- `unit-test-report.txt`;
- `coverage-domain.json`;

**Gate G3 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- any in src;
- low confidence global action;
- illegal transition mutiert Workflow;

**Commit:** `feat: implement deterministic domain core`

---

## Phase 04 – Inbox-Erkennung und Senderanalyse

**Ziel:** Aktuelle Inbox-Seite sicher erkennen und wiederkehrende Sender ohne Aktionen gruppieren.

### Sub-Phase 04.1 – Shell/View Detector

**Exakte Aufgaben:**
1. Shell.
2. Inbox-like route.
3. aktive Suche blockieren.
4. Settings/Message/Spam blockieren.

**Expected Results:**
- nur erlaubte Ansicht analysierbar;

### Sub-Phase 04.2 – List/Rows

**Exakte Aufgaben:**
1. primären List Root bestimmen.
2. Zeilen sammeln.
3. Dedup.
4. Werbe-/Chat-Bereiche ausschließen.

**Expected Results:**
- Fixture-Zeilen exakt erwartet;

### Sub-Phase 04.3 – Sender Extractor

**Exakte Aufgaben:**
1. Attributquellen.
2. Konfliktlogik.
3. Confidence.
4. Hovercard-budgeted fallback.

**Expected Results:**
- kein Anzeigename-only Workflow;

### Sub-Phase 04.4 – Analyzer

**Exakte Aufgaben:**
1. Abort.
2. Progress counters.
3. Result invariants.
4. unresolved section.

**Expected Results:**
- Analyse ≤8 s bei Max-Fixture;

### Sub-Phase 04.5 – UI Results

**Exakte Aufgaben:**
1. Sortierung.
2. Filter.
3. Ignore session.
4. unresolved details.

**Expected Results:**
- Expected groups und counts;

**Pflichtbefehle:**

```bash
npm test -- analyze-fixtures
npm run test:coverage
```

**Evidence:**
- `fixture-matrix.json`;
- `analysis-ui.png`;
- `coverage-analysis.json`;

**Gate G4 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- Analyse in Search/Spam;
- reale Datenfixture;
- Gruppe count 1;

**Commit:** `feat: analyze recurring senders on current inbox page`

---

## Phase 05 – Sicherheitsvorschau und Gmail-Suche

**Ziel:** Exakte globale Inbox-Suche setzen und Ergebnisansicht beweisen, ohne Auswahlaktion.

### Sub-Phase 05.1 – Preview

**Exakte Aufgaben:**
1. Sender, Adresse, count, query anzeigen.
2. modal focus trap.
3. Confirm/back.

**Expected Results:**
- Query sichtbar exakt gleich Produktquery;

### Sub-Phase 05.2 – Searchbox Detector

**Exakte Aufgaben:**
1. Scoring.
2. Ambiguität.
3. Input type handling.

**Expected Results:**
- genau ein sicherer Kandidat;

### Sub-Phase 05.3 – Submit

**Exakte Aufgaben:**
1. native setter.
2. events.
3. Enter.
4. ein Searchbutton retry.

**Expected Results:**
- Query wird übernommen;

### Sub-Phase 05.4 – Ready Evidence

**Exakte Aufgaben:**
1. route/list fingerprint.
2. loading.
3. stable window.
4. empty state.

**Expected Results:**
- keine voreilige Fortsetzung;

### Sub-Phase 05.5 – Related Results

**Exakte Aufgaben:**
1. AI/Drive/related classification.
2. abort code.

**Expected Results:**
- null Auswahlklicks;

**Pflichtbefehle:**

```bash
npm test -- search
npm run test:e2e -- --grep Search
```

**Evidence:**
- `search-evidence.json`;
- `related-results-trace.zip`;

**Gate G5 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- Query mismatch;
- Search via URL/internal endpoint;
- Auswahlcode in Phase 05;

**Commit:** `feat: submit and verify safe Gmail sender search`

---

## Phase 06 – Seiten- und Global-Auswahl

**Ziel:** Treffer nur bei bewiesenem Zustand auswählen oder sicher auf manuell fallen.

### Sub-Phase 06.1 – Page Checkbox

**Exakte Aufgaben:**
1. Toolbar scoping.
2. score/delta.
3. preflight.
4. postcondition.

**Expected Results:**
- richtige Checkbox oder manual fallback;

### Sub-Phase 06.2 – Select All

**Exakte Aufgaben:**
1. DE/EN patterns.
2. banner timing.
3. deselect exclusion.

**Expected Results:**
- globaler Zustand bewiesen;

### Sub-Phase 06.3 – Single Page

**Exakte Aufgaben:**
1. range parsing.
2. selected rows.
3. next control.
4. explicit text.

**Expected Results:**
- kein false positive;

### Sub-Phase 06.4 – Manual Fallback

**Exakte Aufgaben:**
1. highlight.
2. continue recheck.
3. explicit checkbox.

**Expected Results:**
- Move erst nach Bestätigung;

### Sub-Phase 06.5 – Failure Injection

**Exakte Aufgaben:**
1. stale node.
2. second candidate.
3. route change.
4. abort timing.

**Expected Results:**
- keine unerlaubten Klicks;

**Pflichtbefehle:**

```bash
npm test -- selection
npm run test:e2e -- --grep Selection
```

**Evidence:**
- `selection-click-audit.json`;
- `failure-injection-report.txt`;

**Gate G6 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- erste Seite still als vollständig;
- deselect geklickt;
- stale reference;

**Commit:** `feat: add verified page and global result selection`

---

## Phase 07 – Move-Menü und Abschluss

**Ziel:** Native Zielauswahl sicher vorbereiten und Abschluss ohne automatische Labelwahl erkennen.

### Sub-Phase 07.1 – Move Detector

**Exakte Aufgaben:**
1. toolbar context.
2. DE/EN patterns.
3. negative signals.
4. delta.

**Expected Results:**
- nur Move-Button;

### Sub-Phase 07.2 – Menu Verification

**Exakte Aufgaben:**
1. role/content/proximity.
2. retry once.

**Expected Results:**
- sichtbares natives Menü;

### Sub-Phase 07.3 – Native Boundary

**Exakte Aufgaben:**
1. Automation stop.
2. overlay reposition.
3. reopen only by user.

**Expected Results:**
- kein Labelklick im Code;

### Sub-Phase 07.4 – Completion

**Exakte Aufgaben:**
1. evidence scoring.
2. timeout.
3. manual confirm.

**Expected Results:**
- done nur ab threshold/confirmation;

### Sub-Phase 07.5 – Undo Hint

**Exakte Aufgaben:**
1. Snackbar observe.
2. native undo guidance.

**Expected Results:**
- keine eigene Undo-Implementierung;

**Pflichtbefehle:**

```bash
npm test -- move completion
npm run test:e2e -- --grep 'Move|Completion'
```

**Evidence:**
- `move-menu-fixtures.json`;
- `completion-score-tests.txt`;

**Gate G7 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- Label gewählt;
- Apply/Create geklickt;
- Completion bei schwacher Evidence;

**Commit:** `feat: open native Gmail move menu with verified completion`

---

## Phase 08 – Sitzung, Reanalyse und UX-Härtung

**Ziel:** Mehrere Gruppen sicher nacheinander verarbeiten und alle Abbruch-/Reload-Pfade schließen.

### Sub-Phase 08.1 – Session Controller

**Exakte Aufgaben:**
1. AbortController per workflow.
2. cleanup.
3. group status.

**Expected Results:**
- keine Folgeaktion nach Abort;

### Sub-Phase 08.2 – Route/Reload

**Exakte Aufgaben:**
1. route fingerprint.
2. pageshow/load.
3. session lost message.

**Expected Results:**
- kein Workflow über Reload;

### Sub-Phase 08.3 – Reanalysis

**Exakte Aufgaben:**
1. warning for unfinished.
2. replace result.
3. reset statuses.

**Expected Results:**
- keine Datenmischung;

### Sub-Phase 08.4 – Multi-group

**Exakte Aufgaben:**
1. return results.
2. next sender.
3. done/ignored display.

**Expected Results:**
- stale query/group ausgeschlossen;

### Sub-Phase 08.5 – Responsive/A11y

**Exakte Aufgaben:**
1. 80–200% zoom.
2. 720 px behavior.
3. keyboard-only.
4. reduced motion.

**Expected Results:**
- kritische Buttons erreichbar;

**Pflichtbefehle:**

```bash
npm run test:e2e -- --grep 'Session|Keyboard|Zoom'
```

**Evidence:**
- `session-sequence-trace.json`;
- `a11y-checklist.md`;

**Gate G8 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- persistente Senderdaten;
- Workflow nach Reload;
- Focus verloren;

**Commit:** `feat: harden session lifecycle and accessibility`

---

## Phase 09 – Datenschutz, Diagnose und statische Sicherheitschecks

**Ziel:** No-data-collection-Behauptung technisch erzwingen und sichere Wartungsdiagnose liefern.

### Sub-Phase 09.1 – Settings Schema

**Exakte Aufgaben:**
1. defaults.
2. validation.
3. migration.
4. unknown key removal.

**Expected Results:**
- nur erlaubte Keys gespeichert;

### Sub-Phase 09.2 – Diagnostics

**Exakte Aufgaben:**
1. event schema.
2. candidate evidence.
3. state history.
4. caps.

**Expected Results:**
- ausreichend für Adapterdebugging;

### Sub-Phase 09.3 – Redaction

**Exakte Aufgaben:**
1. hash email local part.
2. name/content redaction.
3. recursive pass.
4. post-scan.

**Expected Results:**
- kein Klartext im Export;

### Sub-Phase 09.4 – Static Checks

**Exakte Aufgaben:**
1. no-network.
2. manifest allowlist.
3. dist layout.
4. no source maps.

**Expected Results:**
- Build blockiert Verstöße;

### Sub-Phase 09.5 – Privacy Docs

**Exakte Aufgaben:**
1. PRIVACY.md.
2. AMO disclosure.
3. in-product explanation.

**Expected Results:**
- Aussagen konsistent mit Code;

**Pflichtbefehle:**

```bash
npm run verify:no-network
npm run verify:manifest
npm test -- redaction storage
```

**Evidence:**
- `storage-dump-redacted.json`;
- `diagnostic-export-scan.txt`;
- `manifest-contract.txt`;

**Gate G9 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- Klartextadresse im Export;
- unbekannter Storage-Key;
- externer Request;

**Commit:** `feat: enforce local-only privacy and safe diagnostics`

---

## Phase 10 – Gesamt-QA, CI und Release Candidate

**Ziel:** Alle automatischen Qualitätsgates und Mock-E2E in sauberer Umgebung bestehen.

### Sub-Phase 10.1 – CI

**Exakte Aufgaben:**
1. workflow.
2. least permissions.
3. artifact upload.

**Expected Results:**
- PR CI grün;

### Sub-Phase 10.2 – Coverage

**Exakte Aufgaben:**
1. thresholds.
2. critical module 95%.
3. no skips.

**Expected Results:**
- Coverage Gate grün;

### Sub-Phase 10.3 – Full Mock E2E

**Exakte Aufgaben:**
1. DE/EN.
2. fallbacks.
3. failure injection.
4. network zero.

**Expected Results:**
- alle P0/P1 grün;

### Sub-Phase 10.4 – Clean Checkout

**Exakte Aufgaben:**
1. fresh clone.
2. npm ci.
3. verify.
4. package.

**Expected Results:**
- reproduzierbar;

### Sub-Phase 10.5 – RC Freeze

**Exakte Aufgaben:**
1. version 1.0.0-rc.1.
2. changelog.
3. known limitations.

**Expected Results:**
- keine offenen P0/P1 Bugs;

**Pflichtbefehle:**

```bash
npm ci
npm run verify
npm run package
```

**Evidence:**
- `ci-run-url.txt`;
- `coverage-html.zip`;
- `mock-e2e-report.zip`;
- `SHA256SUMS.txt`;

**Gate G10 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- flaky test;
- skipped P0/P1;
- dirty working tree;

**Commit:** `test: complete release-candidate verification gates`

---

## Phase 11 – Live-Gmail-Kalibrierung und Abnahme

**Ziel:** Aktuellen Gmail-DOM unter menschlicher Aufsicht validieren, ohne persönliche Mailboxdaten zu übernehmen.

### Sub-Phase 11.1 – Testkonto vorbereiten

**Exakte Aufgaben:**
1. synthetische Sender.
2. Testlabel.
3. DE/EN settings.
4. conversation modes.

**Expected Results:**
- Matrixdaten vorhanden;

### Sub-Phase 11.2 – Read-only Calibration

**Exakte Aufgaben:**
1. diagnose mode.
2. shell/list/rows/searchbox scores.
3. no clicks.

**Expected Results:**
- Adapterconfidence dokumentiert;

### Sub-Phase 11.3 – Controlled Actions

**Exakte Aufgaben:**
1. jeweils ein kleiner Testfall.
2. Mensch beobachtet.
3. Undo verfügbar.

**Expected Results:**
- Suche/Auswahl/Move bestätigt;

### Sub-Phase 11.4 – Fixture Update

**Exakte Aufgaben:**
1. nur synthetische minimale Struktur.
2. Regression test.
3. adapter version bump.

**Expected Results:**
- keine realen Daten;

### Sub-Phase 11.5 – Full Matrix

**Exakte Aufgaben:**
1. DE/EN.
2. light/dark.
3. density.
4. conversation.
5. single/multi page.
6. fallbacks.

**Expected Results:**
- jede Zelle PASS oder release block;

**Pflichtbefehle:**

```bash
npm run webext:run
npm run verify
```

**Evidence:**
- `live-matrix.md`;
- `calibration-scores-redacted.json`;
- `human-signoff.md`;

**Gate G11 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- persönliches Hauptkonto;
- unbeaufsichtigte Massenaktion;
- kritische Matrixzelle fail;

**Commit:** `test: record supervised live Gmail acceptance`

---

## Phase 12 – AMO-Release und Übergabe

**Ziel:** Signierbare, reviewbare, reproduzierbare Version mit vollständiger Reviewer-Unterlage erstellen.

### Sub-Phase 12.1 – Final Version

**Exakte Aufgaben:**
1. 1.0.0 setzen.
2. manifest/package sync.
3. adapter version.
4. changelog.

**Expected Results:**
- Versionen konsistent;

### Sub-Phase 12.2 – Final Build

**Exakte Aufgaben:**
1. clean checkout.
2. npm ci.
3. release:check.
4. checksums.

**Expected Results:**
- XPI/source zip vorhanden;

### Sub-Phase 12.3 – Reviewer Package

**Exakte Aufgaben:**
1. build README.
2. test credentials/instructions.
3. permission rationale.
4. third-party list.

**Expected Results:**
- Reviewer kann bauen/testen;

### Sub-Phase 12.4 – Listing Copy

**Exakte Aufgaben:**
1. name, summary, description, privacy.
2. screenshots.

**Expected Results:**
- keine Google-Partnerschaft suggeriert;

### Sub-Phase 12.5 – Human Submission

**Exakte Aufgaben:**
1. AMO login.
2. upload.
3. answer questions.
4. download signed XPI.

**Expected Results:**
- signierte Version archiviert;

**Pflichtbefehle:**

```bash
git clean -xfd
npm ci
npm run release:check
```

**Evidence:**
- `release-manifest.json`;
- `source.zip`;
- `unsigned-xpi-or-zip`;
- `SHA256SUMS.txt`;
- `reviewer-notes.md`;

**Gate G12 – PASS nur wenn:**
- alle Sub-Phasen vollständig;
- alle genannten Expected Results erfüllt;
- alle Pflichtbefehle Exit Code 0;
- keine offene P0/P1-Abweichung;
- Evidence auf aktuellem Commit.

**Sofortiger FAIL:**
- uncommitted change;
- build differs from source;
- placeholder add-on ID;
- missing signoff;

**Commit:** `release: prepare Inbox Sender Organizer 1.0.0`

---



## 65.14 Finalisierungs-Subphase F – 360°-Korrekturen aus Version 2.1.0

Diese Subphase wird nach den funktionalen Phasen und vor dem Live-Gate ausgeführt. Sie darf nicht übersprungen werden, auch wenn Teile bereits früher implementiert wurden.

### F.1 Toolchain und Build

Anweisungen:

1. Node/npm und alle Top-Level-Abhängigkeiten gegen Kapitel 42/44 sperren.
2. `.gitignore` und `.prettierignore` anlegen.
3. `build.mjs` liest Version aus `package.json` und bricht bei Manifestabweichung ab.
4. No-Network-Scanner prüft `src` und `dist`, aber erlaubt statische URL-Konstanten.
5. Packaging löscht alte Release-Artefakte und verwendet lokales `web-ext` ohne Shell.
6. `npm audit --audit-level=high` in Verify integrieren.

Expected Result:

- frischer Clone ist mit `npm ci && npm run verify` reproduzierbar;
- keine Stale-Artefakte oder unbestimmte Manifestversion;
- Gmail-URL-Konstante löst keinen False Positive aus;
- echte Netzwerkprimitive werden sicher erkannt.

Gate F-BUILD: PASS nur mit vollständigem Log, cleanem Git-Status und frischem Release-Verzeichnis.

### F.2 Domänenlogik

Anweisungen:

1. Parser entfernt das Originalmatch indexbasiert und deckt IDN/Path-Injection-Tests ab.
2. Gruppierung dedupliziert Fingerprints und filtert `<2`, `low`, `unresolved`.
3. Fingerprint-Fallback liest weder Zeilen-ARIA-Label noch Textinhalt.
4. Query ist ausschließlich `in:inbox "from:<normalized>"`.
5. Query wird vom Controller, nicht aus UI-Eingabe erzeugt.

Expected Result:

- alle Pflichtvektoren EP-001 bis EP-016 PASS;
- Singletons und unsichere Identitäten sind nicht aktionsfähig;
- keine Betreff-/Snippetdaten im Analysemodell;
- Alias-Suchausweitung durch unquoted `from:` ist vermieden.

Gate F-DOMAIN: 100 % der kritischen Branches getestet; Mutationstest der Parser-/Query-/Grouping-Module erfüllt das festgelegte Gate.

### F.3 Workflow und Lifetime

Anweisungen:

1. Toolbar kann Overlay während kritischer Schritte nicht verstecken.
2. Route-Wechsel abortet echten Controller-Run vor Reset.
3. `RETURN_TO_RESULTS` nur aus sicheren Terminalzuständen.
4. Bootstrap kann nach Fehler erneut starten und behandelt BFCache.
5. Route Observer nutzt Debounce/Burst-Cooldown.
6. Mutation Waiter vergleicht primitive semantische Fingerprints.

Expected Result:

- kein Effect läuft nach Cancel/Route-Wechsel weiter;
- kein illegaler State kann einen Klick auslösen;
- kein doppelter Host oder Listener nach SPA-/BFCache-Navigation.

Gate F-LIFETIME: Failure-Injection für Abbruch vor und nach jedem await-Punkt PASS.

### F.4 Branding und UX

Anweisungen:

1. `made by Ceegore` zentral als Konstante und i18n-Text definieren.
2. Credit in jeder Overlay-Ansicht genau einmal rendern.
3. Kein Link, Tracking oder Gmail-DOM-Inhalt.
4. Drag/Keyboard/Clamp/Reset vollständig implementieren.
5. Zoom, Dark/Light und Screenreader prüfen.

Expected Result:

- exakter Credit immer sichtbar, klein und unaufdringlich;
- keine Duplikate nach Re-Render oder Toggle;
- Overlay bleibt erreichbar und verdeckt kein Move-Menü.

Gate F-UX: Unit-, Mock-E2E-, 80–200-%-Zoom- und DE/EN-Live-Matrix PASS.

### F.5 Privacy und AMO

Anweisungen:

1. Diagnosefelder allowlisten; sensitive Keys an der Quelle verwerfen.
2. vollständige E-Mail-Hashredaktion ohne Domainleak.
3. post-serialization Leak-Scan.
4. Datenschutztext beschreibt nutzerinitiierte Gmail-Suche.
5. `PRIV-AMO-01` gegen aktuelle Mozilla-Regeln durchführen.
6. signiertes Paket mit realem Permission-Prompt testen.

Expected Result:

- keine Klartextadresse, Query, Betreff, Snippet, URL oder Kontoadresse in Storage/Export/Evidence;
- Reviewer Notes und Listing stimmen mit Verhalten überein;
- Manifestdeklaration ist menschlich bestätigt oder vor Submission angepasst.

Gate F-PRIVACY: ohne dokumentiertes PASS keine Einreichung.

# 66. Live-Gmail-Testmatrix – vollständig auszufüllen

## 66.1 Testkonto-Datensatz

Das Testkonto muss vor Start enthalten:

| Sender | Inbox-Einträge | Zweck |
|---|---:|---|
| newsletter-alpha@example.com | 3–5 | Mehrfachgruppe |
| newsletter-beta@example.net | 2–3 | zweite Gruppe |
| billing@example.org | 2 | kleine Gruppe |
| single@example.net | 1 | darf nicht erscheinen |
| mixed-name@example.org | 2 | verschiedene Anzeigenamen, gleiche Adresse |
| thread-participant@example.com | 2 Threads | Konversationsrisiko |

Labels:

- `GISO/Test Existing`;
- kein `GISO/Test New` vor dem Test zur Prüfung „Neu erstellen“.

## 66.2 Matrix

Jede Zelle enthält `PASS`, `FAIL`, `BLOCKED` oder `N/A` plus Evidence-ID. `N/A` ist bei P0-Kernfällen unzulässig.

| ID | Sprache | Theme | Dichte | Conversation | Ergebnismenge | Auswahlpfad | Ziel | Expected |
|---|---|---|---|---|---|---|---|---|
| LIVE-001 | DE | Light | Default | On | 1 Seite | automatisch | bestehend | komplett |
| LIVE-002 | DE | Dark | Compact | On | mehrere Seiten | automatisch global | bestehend | komplett |
| LIVE-003 | DE | Light | Comfortable | Off | 1 Seite | Single-page proof | neu | komplett |
| LIVE-004 | DE | Dark | Default | Off | mehrere Seiten | manuell | bestehend | komplett |
| LIVE-005 | EN | Light | Default | On | 1 Seite | automatisch | bestehend | komplett |
| LIVE-006 | EN | Dark | Compact | On | mehrere Seiten | automatisch global | neu | komplett |
| LIVE-007 | EN | Light | Comfortable | Off | mehrere Seiten | manuell | bestehend | komplett |
| LIVE-008 | DE | Light | Default | On | keine Treffer | N/A | N/A | keine Auswahl |
| LIVE-009 | EN | Light | Default | On | related/similar | N/A | N/A | Abbruch |
| LIVE-010 | DE | Light | Default | On | normale Treffer | Abbruch nach Suche | N/A | kein Auswahlklick |
| LIVE-011 | DE | Light | Default | On | normale Treffer | Abbruch nach Seite | N/A | kein Move-Klick |
| LIVE-012 | EN | Light | Default | On | normale Treffer | Routewechsel | N/A | Stop |

## 66.3 Live-Aktionslimit

- pro Testlauf maximal 10 Nachrichten/Unterhaltungen verschieben;
- zuerst kleinstmögliche Ergebnismenge;
- Mensch beobachtet Cursor und Ziel;
- native Rückgängig-Möglichkeit darf nicht verdeckt werden;
- bei unerwartetem Klick sofort Add-on deaktivieren und Testkonto zurücksetzen;
- keine Live-Tests in persönlichem Konto.

---

# 67. AMO-Reviewer-Unterlagen – Copy-paste-Vorlagen

## 67.1 Reviewer Notes

```text
Purpose
Inbox Sender Organizer is a Firefox-only extension for Gmail Web. It groups recurring senders found on the currently loaded inbox page. For a sender explicitly selected by the user, it inserts the exact query in:inbox "from:sender@example.com" into Gmail's native search UI, verifies the visible search result state, selects the current page, attempts Gmail's native “select all matching results” action, and opens Gmail's native “Move to” menu. The extension never chooses a destination label; the user must do so in Gmail.

Permissions
- storage: local UI settings only (overlay position, diagnostics enabled, auto-open-move preference).
- https://mail.google.com/*: read the visible Gmail DOM and operate visible native controls.

Data and network behavior
The extension has no fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon, cookies, webRequest, analytics, advertising, remote code, own server, Gmail API, OAuth, or internal Gmail RPC usage. Sender addresses exist only in content-script memory for the active tab session and are not persisted. When the user confirms a sender workflow, the selected sender address is placed into Gmail's own search field; Google processes that query as part of the user's normal Gmail action. No such value is sent to the developer or another developer-controlled service.

Manifest privacy declaration
The submitted manifest declares data_collection_permissions.required = ["none"] because the extension performs no extension-owned collection or transmission. Before submission, project gate PRIV-AMO-01 rechecks the then-current Mozilla taxonomy. If reviewers classify the user-initiated Gmail search differently, the project will update the declaration and consent UX before release.

Branding
The overlay contains the small non-interactive text “made by Ceegore”. It is not a link and performs no tracking or external navigation.

Build
1. Install Node.js 24.18.0 and npm 11.16.0.
2. Run npm ci.
3. Run npm run verify.
4. Run npm run package.
The built extension is in dist/ and fresh release files are in artifacts/release/.

Test steps
1. Open Gmail in Firefox 140+ using the provided synthetic test account.
2. Click the extension toolbar icon.
3. Verify the overlay shows “made by Ceegore”.
4. Click “Posteingang analysieren”.
5. Choose a sender group with at least two entries.
6. Confirm the exact quoted sender query.
7. Observe native Gmail search and selection UI.
8. Choose a test label manually in Gmail's native “Move to” menu.
9. Confirm completion or the conservative manual fallback.

Safety behavior
If the Gmail DOM, query, result list, selection state or Move control is ambiguous, the extension stops and displays manual instructions. It never guesses a target and never selects a destination label.
```

## 67.2 Berechtigungsbegründung Deutsch

```text
Die Hostberechtigung für mail.google.com ist erforderlich, weil die Erweiterung ausschließlich lokal die sichtbare Gmail-Weboberfläche analysiert und sichtbare native Bedienelemente nutzt. Sie liest Absenderadressen aus der aktuell geladenen Inbox-Seite. Erst nach einer ausdrücklichen Nutzerbestätigung schreibt sie die ausgewählte Adresse in Gmails eigene Suchbox; diese Suchanfrage wird als normale Gmail-Nutzeraktion von Google verarbeitet. Die Erweiterung sendet keine Daten an den Entwickler oder einen eigenen beziehungsweise fremden Analysedienst. storage speichert nur lokale Oberflächeneinstellungen und niemals E-Mail-Adressen oder Nachrichteninformationen.
```

## 67.3 Datenschutztext

```text
Datenschutz – Inbox Sender Organizer

Inbox Sender Organizer arbeitet ohne eigenen Server, Analyse-, Werbe- oder Trackingdienst. Auf der aktuell geladenen Gmail-Seite verarbeitet die Erweiterung im Browser Absendernamen, Absenderadressen und die Anzahl sichtbarer Listeneinträge, um wiederkehrende Absender zu gruppieren. Diese Sitzungsdaten werden nicht an den Entwickler übertragen und nicht dauerhaft gespeichert.

Wenn du für einen Absender ausdrücklich „Suche starten“ bestätigst, schreibt die Erweiterung die angezeigte Absenderadresse in Gmails eigene Suchbox. Die Suchanfrage wird dann durch Google im Rahmen deiner normalen Gmail-Nutzung verarbeitet. Die Erweiterung verwendet dafür weder Gmail API noch Google OAuth oder interne Gmail-Netzwerkendpunkte.

In Firefox storage.local werden ausschließlich technische Einstellungen wie Overlay-Position und Diagnosemodus gespeichert. Ein Neuladen des Gmail-Tabs beendet die Analysesitzung.

Ein von dir ausdrücklich erzeugter Diagnoseexport wird lokal als Datei erstellt und automatisch redigiert. Prüfe ihn dennoch vor dem Teilen.

Im Overlay steht klein „made by Ceegore“. Der Hinweis ist nicht verlinkt und überträgt keine Daten.
```

## 67.4 AMO-Kurzbeschreibung

```text
Gruppiert wiederkehrende Absender auf der geladenen Gmail-Inbox-Seite und führt kontrolliert zu Gmails nativer Auswahl und „Verschieben nach“-Funktion – ohne Gmail API, OAuth, Tracking oder eigenen Server.
```

## 67.5 Langbeschreibung

```text
Inbox Sender Organizer hilft beim kontrollierten halbmanuellen Aufräumen eines Gmail-Posteingangs.

Die Erweiterung analysiert nur die aktuell geladene Inbox-Seite und zeigt Absender, die dort mehrfach vorkommen. Für einen ausdrücklich ausgewählten Absender setzt sie eine exakte Gmail-Suche über den gesamten Posteingang, unterstützt die sichere Auswahl der Treffer und öffnet Gmails eigenes „Verschieben nach“-Menü. Das Ziel-Label wird immer vom Nutzer selbst gewählt.

Sicherheit und Datenschutz:
- keine Gmail API und kein Google OAuth;
- kein eigener Server, Tracking, Werbung oder Remote Code;
- keine dauerhafte Speicherung erkannter Absender;
- Senderadresse wird nur nach Bestätigung in Gmails eigene Suchbox eingesetzt;
- keine automatische Auswahl eines Ziel-Labels;
- kontrollierter Stopp statt riskanter Klicks bei unsicherer Gmail-Erkennung;
- deutsche Oberfläche, Erkennung für deutsche und englische Gmail-UI;
- kleiner nicht interaktiver Overlay-Hinweis „made by Ceegore“.

Gmail stellt keine stabile öffentliche DOM-Schnittstelle bereit. Nach Gmail-Änderungen kann die Erweiterung daher vorübergehend auf sichere manuelle Hinweise zurückfallen, bis der Adapter geprüft wurde.
```

---

# 68. Release- und Reproduzierbarkeitsprotokoll

## 68.1 Release Freeze

72 Stunden vor geplanter Einreichung:

- keine neuen Features;
- nur P0/P1-Fixes;
- Dependency Freeze;
- Adapter Freeze nach Live-Matrix;
- Dokumentationsänderungen nur bei Konsistenzfehlern;
- jeder Fix startet relevante Phase erneut.

## 68.2 Clean-Room-Build

```bash
: "${GISO_REPOSITORY_URL:?Setze GISO_REPOSITORY_URL auf die HTTPS- oder SSH-Repository-URL}"
: "${GISO_RELEASE_TAG:?Setze GISO_RELEASE_TAG auf den signierten Release-Tag}"

git clone -- "$GISO_REPOSITORY_URL" giso-release
cd giso-release
git checkout --detach "$GISO_RELEASE_TAG"
node --version
npm --version
npm ci
npx playwright install --with-deps firefox
npm run release:check
git status --porcelain
```

Expected:

- Node `v24.18.0`;
- npm `11.16.0`;
- alle Befehle Exit 0;
- `git status --porcelain` leer;
- XPI/ZIP und Source ZIP vorhanden;
- Checksums vorhanden.

## 68.3 Rebuild-Vergleich

Zwei Builds müssen nach Entpacken denselben Dateibaum und identische Inhalte besitzen. Falls ZIP-Zeitstempel variieren:

1. beide Archive entpacken;
2. Dateinamen sortiert vergleichen;
3. SHA-256 je entpackter Datei vergleichen;
4. Unterschiede blockieren Release.

## 68.4 Release Manifest

```json
{
  "productVersion": "1.0.0",
  "specVersion": "2.1.0",
  "adapterVersion": "2026.07.2",
  "gitCommit": "FULL_SHA",
  "gitTag": "v1.0.0",
  "node": "24.18.0",
  "npm": "11.16.0",
  "firefoxMinimum": "140.0",
  "liveMatrix": "PASS",
  "automatedVerify": "PASS",
  "humanSignoff": "PASS",
  "artifacts": [
    { "file": "addon.xpi", "sha256": "..." },
    { "file": "source.zip", "sha256": "..." }
  ]
}
```

---

# 69. Wartung, Incident Response und Gmail-DOM-Bruch

## 69.1 Schweregrade

| Severity | Definition | Beispiel | Reaktion |
|---|---|---|---|
| SEV-0 | Risiko falscher Massenaktion | falscher Move-Button möglich | Distribution stoppen/Version deaktivieren |
| SEV-1 | Kernworkflow bricht sicher | keine Auswahl möglich | Patch priorisiert |
| SEV-2 | Analyse teilweise beeinträchtigt | Senderquelle nicht erkannt | Adapterpatch |
| SEV-3 | kosmetisch/Diagnose | Layout/Copy | normaler Patch |

## 69.2 Sofortmaßnahmen bei SEV-0

1. betroffene Version nicht weiter verteilen;
2. AMO-Version falls nötig deaktivieren;
3. bekannte sichere Version referenzieren;
4. reproduzierbaren synthetischen Fall erstellen;
5. Klickpfad und Evidence untersuchen;
6. Regressionstest schreiben;
7. Fix ausschließlich im Adapter/Controller, keine Scope-Erweiterung;
8. vollständige Phasen G5–G12 erneut;
9. Postmortem.

## 69.3 Postmortem-Vorlage

```markdown
# Incident GISO-YYYY-MM-DD-NN

## Summary
## User impact
## Detection
## Timeline
## Root cause
## Why safeguards did/did not work
## Immediate fix
## Permanent corrective actions
## Tests added
## Documentation changes
## Release and rollback details
## Owner and due dates
```

## 69.4 Adapter-Kompatibilitätsfenster

Ein Adapter darf mehrere Gmail-Varianten unterstützen, aber:

- jede Variante hat eigene Evidence-Regeln;
- kein pauschaler „old/new Gmail“-Best-Guess;
- veraltete Variante erst nach zwei stabilen Releases entfernen;
- Entfernung als Adapter-Major-Change dokumentieren;
- Businesslogik bleibt unverändert.

---

# 70. Verbindliche Code-Review-Checkliste

## 70.1 Architektur

- [ ] DOM-Zugriff nur in Gmail-/UI-Schicht.
- [ ] Geschäftslogik kennt keine Gmail-CSS-Klasse.
- [ ] Store enthält keine DOM-Elemente.
- [ ] Background enthält keine Senderdaten.
- [ ] Keine neue Runtime-Abhängigkeit.

## 70.2 Sicherheit

- [ ] Jeder Klick hat Preflight und Postcondition.
- [ ] Score und Delta geprüft.
- [ ] Re-resolve-before-click.
- [ ] Abort direkt vor Klick geprüft.
- [ ] Route/Query vor Auswahl geprüft.
- [ ] Related Results ausgeschlossen.
- [ ] Keine automatische Labelwahl.

## 70.3 Datenschutz

- [ ] Keine Senderpersistenz.
- [ ] Keine externe Übertragung.
- [ ] Diagnose rekursiv redigiert.
- [ ] Serialisierter Export nachgescannt.
- [ ] Manifest `none` unverändert.

## 70.4 Tests

- [ ] neuer Branch besitzt positive und negative Tests.
- [ ] Failure Injection für kritische Änderung.
- [ ] kein P0/P1 skip.
- [ ] Coverage nicht gesenkt.
- [ ] Live-Gate bei DOM-Verhalten.

## 70.5 Release

- [ ] Manifest-Berechtigungen exakt.
- [ ] Add-on-ID kein Platzhalter.
- [ ] Versionsnummern synchron.
- [ ] Source-ZIP baut reproduzierbar.
- [ ] Reviewer Notes aktualisiert.

---

# 71. STOP-AND-ESCALATE-Regeln für autonome Agenten

Der Agent MUSS stoppen und darf keine produktive Annahme treffen, wenn:

1. Gmail zwei gleich sichere Klickkandidaten liefert;
2. eine neue Berechtigung nötig scheint;
3. eine externe Bibliothek oder ein Netzwerkrequest nötig scheint;
4. eine Nutzeraktion automatisiert werden müsste, die hier manuell festgelegt ist;
5. reale Maildaten in Fixtures gelangen könnten;
6. Testkonto/Login nicht bereitsteht;
7. Live-Test eine unerwartete UI zeigt;
8. ein P0-Test flaky ist;
9. Redaction nicht beweisbar ist;
10. AMO-Policy oder Manifest-Schema der Spezifikation widerspricht;
11. die Query von Gmail verändert wird;
12. Related Results nicht sicher ausgeschlossen werden;
13. ein vorheriges Gate keine gültige Evidence besitzt;
14. die Spezifikationsdatei geändert wurde, ohne Scope-Change-Freigabe.

Stop-Ausgabeformat:

```markdown
## STOP-AND-ESCALATE
- Phase/Sub-Phase:
- Gate:
- Beobachtung:
- Sicherheits- oder Produktregel:
- Bereits geprüfte Evidenz:
- Warum keine sichere Standardentscheidung existiert:
- Kleinste benötigte menschliche Entscheidung:
- Bis zur Entscheidung durchgeführte sichere Arbeiten:
```

Der Agent darf parallel nur Arbeiten fortsetzen, die garantiert unabhängig vom gestoppten Punkt sind und kein späteres Design festlegen.

---

# 72. Copy-paste-Masterprompt für den implementierenden AI-Agenten

```text
Du implementierst das Firefox-Add-on „Inbox Sender Organizer“ ausschließlich nach docs/PRODUCT_SPEC.md, Version 2.1.0 FINAL. Dieses Dokument ist autoritativ.

Hauptziel:
Erstelle eine sichere Firefox-Manifest-V3-Erweiterung für Gmail Web, die wiederkehrende Absender auf der aktuell geladenen Inbox-Seite gruppiert und anschließend über Gmails native Oberfläche eine globale Inbox-Suche, Treffer-Auswahl und das Öffnen des nativen „Verschieben nach“-Menüs unterstützt. Das Ziel-Label wählt immer der Nutzer.

Unveränderliche Grenzen:
- keine Gmail API;
- kein OAuth;
- kein Server;
- kein fetch/XMLHttpRequest/WebSocket/EventSource/sendBeacon;
- kein Remote Code;
- keine automatische Labelwahl;
- keine persistente Speicherung von Sendern oder Queries;
- keine zusätzlichen Berechtigungen;
- keine stillen Produktentscheidungen;
- bei unsicherem DOM niemals klicken;
- nur DE/EN Gmail Detection;
- Firefox Desktop ab 140;
- keine Chrome-Portierung in V1.

Arbeitsmodus:
1. Lies das vollständige Dokument.
2. Prüfe den SHA-256-Lock.
3. Führe Phasen 00–12 strikt nacheinander aus.
4. Beginne jede Sub-Phase mit Tests und Verträgen.
5. Implementiere nur den kleinsten Code für die spezifizierten Expected Results.
6. Führe nach jeder Sub-Phase fokussierte Tests und nach jeder Phase die gesamte bisherige Suite aus.
7. Erzeuge die vorgeschriebenen Evidence-Artefakte.
8. Setze ein Gate nur auf PASS, wenn alle Kriterien objektiv erfüllt sind.
9. Committe mit der vorgegebenen Commit-Nachricht.
10. Nutze STOP-AND-ESCALATE bei jedem nicht sicher entscheidbaren Konflikt.

Klickregel:
Kein automatischer DOM-Klick ohne zulässigen Workflowzustand, bestätigte Gmail-Ansicht, neu aufgelösten eindeutigen Kandidaten, Mindestscore, Mindestabstand, Sichtbarkeit, Abort-Prüfung und bestätigte Vorstufe. Nach jedem Klick muss eine spezifizierte Nachbedingung bestätigt werden.

Qualitätsregel:
„Funktioniert im Mock“ reicht nicht. Vor Release müssen alle automatischen Gates, die vollständige DE/EN Live-Matrix mit dediziertem Testkonto, Privacy/Manifest/No-Network-Checks, Clean-Room-Build, reproduzierbare Artefakte und menschliche Freigabe bestanden sein.

Ausgabe nach jeder Phase:
- implementierte Sub-Phasen;
- geänderte Dateien;
- ausgeführte Befehle und Exit Codes;
- Testzahlen;
- Coverage;
- Evidence-Pfade;
- Gate PASS/FAIL;
- offene Risiken;
- exakter nächster Schritt.
```

---

# 73. Finales Abnahmeprotokoll

```markdown
# GISO 1.0.0 Final Acceptance

## Identität
- Spec version: 2.1.0 FINAL
- Spec SHA-256:
- Product version: 1.0.0
- Adapter version:
- Git commit:
- Git tag:

## Automated gates
- G0:
- G1:
- G2:
- G3:
- G4:
- G5:
- G6:
- G7:
- G8:
- G9:
- G10:

## Live gates
- G11 matrix result:
- DE reviewer:
- EN reviewer:
- Test account only confirmed: YES/NO
- No unexpected clicks observed: YES/NO

## Release gate
- G12:
- Clean-room build: PASS/FAIL
- Rebuild file comparison: PASS/FAIL
- web-ext lint: PASS/FAIL
- Manifest permission review: PASS/FAIL
- No-network review: PASS/FAIL
- Privacy review: PASS/FAIL
- AMO reviewer package complete: YES/NO

## Known limitations accepted
- [ ] current-page discovery only
- [ ] Gmail DOM maintenance required
- [ ] conversation semantics documented
- [ ] target selection remains manual
- [ ] unsupported Gmail language falls back safely

## Final decision
- [ ] GO
- [ ] NO-GO

Decision owner:
Date:
Signature/approval record:
```

---


# Anhang A. Ergänzende vollständige Referenzdateien

## A.1 `src/app/store.ts`

```ts
export interface Store<S, E> {
  readonly getState: () => S;
  readonly dispatch: (event: E) => void;
  readonly subscribe: (listener: (state: S) => void) => () => void;
}

export function createStore<S, E>(
  initial: S,
  reducer: (state: S, event: E) => S,
): Store<S, E> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();

  return {
    getState: () => state,
    dispatch: (event) => {
      const next = reducer(state, event);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of [...listeners]) {
        try {
          listener(state);
        } catch (error) {
          console.error("GISO store subscriber failed", error);
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

## A.2 `src/settings/defaults.ts`

```ts
export interface StoredSettingsV1 {
  readonly schemaVersion: 1;
  readonly overlayPosition: Readonly<{ top: number; right: number }>;
  readonly diagnosticsEnabled: boolean;
  readonly autoOpenMoveMenu: boolean;
}

export type Settings = StoredSettingsV1;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  overlayPosition: { top: 80, right: 16 },
  diagnosticsEnabled: false,
  autoOpenMoveMenu: true,
};
```

## A.3 `src/settings/storage.ts`

```ts
import { DEFAULT_SETTINGS, type Settings } from "./defaults";

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const record = value as Record<string, unknown>;
  const position = record["overlayPosition"];
  const positionRecord = position && typeof position === "object" ? position as Record<string, unknown> : null;
  const top = positionRecord?.["top"];
  const right = positionRecord?.["right"];
  const validPosition = typeof top === "number" && Number.isFinite(top) && top >= 0 &&
    typeof right === "number" && Number.isFinite(right) && right >= 0;

  return {
    ...DEFAULT_SETTINGS,
    diagnosticsEnabled: typeof record["diagnosticsEnabled"] === "boolean" ? record["diagnosticsEnabled"] : DEFAULT_SETTINGS.diagnosticsEnabled,
    autoOpenMoveMenu: typeof record["autoOpenMoveMenu"] === "boolean" ? record["autoOpenMoveMenu"] : DEFAULT_SETTINGS.autoOpenMoveMenu,
    overlayPosition: validPosition ? { top, right } : DEFAULT_SETTINGS.overlayPosition
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get("settings");
  return validateSettings(stored["settings"]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ settings: validateSettings(settings) });
}
```

Die Bracket-Notation ist wegen `noPropertyAccessFromIndexSignature` zwingend. Vor Persistenz wird erneut validiert und geclamped.

---

## A.4 `src/gmail/gmail-text-patterns.ts`

```ts
export const gmailTextPatterns = {
  de: {
    inbox: [/^posteingang$/i, /^primär$/i, /^werbung$/i, /^soziale netzwerke$/i],
    selectAllMatches: [
      /alle .* auswählen, die dieser suche entsprechen/i,
      /alle .* dieser suche auswählen/i,
      /alle .* in dieser ansicht auswählen/i,
    ],
    allSelected: [/alle .* ausgewählt/i],
    deselect: [/auswahl aufheben/i, /keine auswählen/i],
    move: [/^verschieben nach$/i, /^verschieben$/i, /in .* verschieben/i],
    createNew: [/^neu erstellen$/i, /^neues label/i],
    undo: [/^rückgängig$/i],
    loading: [/wird geladen/i, /laden/i],
    empty: [/keine e-mails/i, /keine nachrichten/i, /keine treffer/i],
    related: [/ähnliche ergebnisse/i, /verwandte ergebnisse/i],
    mailScope: [/^e-mails$/i, /^mail$/i],
  },
  en: {
    inbox: [/^inbox$/i, /^primary$/i, /^promotions$/i, /^social$/i],
    selectAllMatches: [
      /select all .* that match this search/i,
      /select all .* in this view/i,
    ],
    allSelected: [/all .* selected/i],
    deselect: [/deselect/i, /clear selection/i, /select none/i],
    move: [/^move to$/i, /^move$/i],
    createNew: [/^create new$/i, /^new label/i],
    undo: [/^undo$/i],
    loading: [/loading/i],
    empty: [/no emails/i, /no messages/i, /no results/i],
    related: [/related results/i, /similar results/i],
    mailScope: [/^mail$/i, /^emails$/i],
  },
} as const;

export type GmailDetectionLocale = keyof typeof gmailTextPatterns;

export function normalizeVisibleText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

export function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  const normalized = normalizeVisibleText(value);
  return patterns.some((pattern) => pattern.test(normalized));
}
```

## A.5 `src/gmail/route-observer.ts`

```ts
export interface RouteObserver { readonly dispose: () => void; }

export function observeRoutes(onRouteChange: () => void): RouteObserver {
  let last = location.href;
  let timer: number | null = null;
  let burstStarted = performance.now();
  let burstCount = 0;

  const schedule = (): void => {
    burstCount += 1;
    const now = performance.now();
    if (now - burstStarted > 2_000) { burstStarted = now; burstCount = 1; }
    const delayMs = burstCount > 1_000 ? 500 : 150;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      if (location.href !== last) {
        last = location.href;
        onRouteChange();
      }
    }, delayMs);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);
  return {
    dispose: () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("popstate", schedule);
    },
  };
}
```

Der Callback abortet im Bootstrap zuerst den aktiven Controller-Run und dispatcht erst danach den sicheren Sitzungsreset.

---

## A.6 `src/gmail/mutation-waiter.ts`

```ts
import { assertNotAborted } from "@/shared/abort";

export async function waitForMutationState<T extends string | number | boolean>(options: {
  readonly root: Node;
  readonly readFingerprint: () => T | null;
  readonly accept: (fingerprint: T) => boolean;
  readonly timeoutMs: number;
  readonly stabilityMs: number;
  readonly signal: AbortSignal;
}): Promise<T> {
  const { root, readFingerprint, accept, timeoutMs, stabilityMs, signal } = options;
  assertNotAborted(signal);

  return new Promise<T>((resolve, reject) => {
    let last: T | null = null;
    let stableSince = 0;
    let pollTimer: number | null = null;
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      signal.removeEventListener("abort", onAbort);
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      window.clearTimeout(timeoutTimer);
      callback();
    };
    const onAbort = (): void => finish(() => reject(new DOMException("Operation aborted", "AbortError")));
    const check = (): void => {
      if (settled) return;
      const current = readFingerprint();
      const now = performance.now();
      if (current !== null && current === last && accept(current) && now - stableSince >= stabilityMs) {
        finish(() => resolve(current));
        return;
      }
      if (current !== last) { last = current; stableSince = now; }
      pollTimer = window.setTimeout(check, Math.min(50, Math.max(10, stabilityMs)));
    };

    const observer = new MutationObserver(check);
    const timeoutTimer = window.setTimeout(
      () => finish(() => reject(new Error(`Mutation wait timed out after ${timeoutMs} ms`))),
      timeoutMs,
    );
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    signal.addEventListener("abort", onAbort, { once: true });
    check();
  });
}
```

`readFingerprint` liefert absichtlich primitive semantische Werte. Der Vergleich eines unveränderten `HTMLElement`-Objekts wäre keine gültige Stabilitätsevidenz, wenn sich dessen Attribute oder Text ändern.

---

## A.7 `src/privacy/diagnostic-export.ts`

```ts
import { redactUnknown } from "./redact";

const FORBIDDEN_AFTER_REDACTION = [
  /@/u,
  /%40/iu,
  /mailto:/iu,
  /in:inbox\s+["']?from:/iu,
  /(?:textContent|outerHTML|subject|snippet)\s*[=:]\s*(?!\[REDACTED\])/iu,
  /mail\.google\.com\/.*(?:search|query|#search)/iu,
];
const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

export async function createDiagnosticBlob(payload: unknown): Promise<Blob> {
  const redacted = await redactUnknown(payload);
  const json = `${JSON.stringify(redacted, null, 2)}\n`;
  const leak = FORBIDDEN_AFTER_REDACTION.find((pattern) => pattern.test(json));
  if (leak) throw new Error(`GISO diagnostic export failed redaction gate: ${leak.source}`);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_EXPORT_BYTES) throw new Error("GISO diagnostic export exceeds 2 MB");
  return new Blob([bytes], { type: "application/json" });
}

export function downloadDiagnosticBlob(blob: Blob, now = new Date()): void {
  const stamp = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `giso-diagnostics-${stamp}.json`;
  link.rel = "noopener";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

## A.8 `src/content/index.ts`

```ts
import { bootstrap } from "./bootstrap";

try {
  bootstrap();
} catch (error: unknown) {
  console.error("GISO content bootstrap failed", error);
}
```

## A.9 `src/content/bootstrap.ts`

```ts
import { createAppController } from "@/app/controller";
import { initialState } from "@/app/initial-state";
import { reduceAppState } from "@/app/state-machine";
import { createStore } from "@/app/store";
import { observeRoutes } from "@/gmail/route-observer";
import type { BackgroundToContentMessage, ContentResponse } from "@/shared/messages";
import { ensureOverlayHost } from "@/ui/overlay-host";
import { renderApp } from "@/ui/render";

const BOOTSTRAP_KEY = Symbol.for("giso.bootstrap.state");
type BootState = "initializing" | "ready";

export function bootstrap(): void {
  const globalState = globalThis as typeof globalThis & { [BOOTSTRAP_KEY]?: BootState };
  if (globalState[BOOTSTRAP_KEY]) return;
  globalState[BOOTSTRAP_KEY] = "initializing";

  try {
    const { host, shadow } = ensureOverlayHost();
    const store = createStore(initialState, reduceAppState);
    const controller = createAppController(store);
    const unsubscribe = store.subscribe((state) => renderApp(shadow, state, controller));
    renderApp(shadow, store.getState(), controller);

    const routeObserver = observeRoutes(() => {
      controller.cancel("route-changed");
      controller.resetSession();
    });

    const listener = (message: unknown): ContentResponse | Promise<ContentResponse> => {
      const typed = message as Partial<BackgroundToContentMessage>;
      if (typed.type !== "TOGGLE_OVERLAY" && typed.type !== "SHOW_OVERLAY") {
        return { ok: false, error: "Unsupported message" };
      }
      return controller.handleBackgroundMessage(typed.type);
    };
    browser.runtime.onMessage.addListener(listener);

    const onPageHide = (event: PageTransitionEvent): void => { if (!event.persisted) dispose(); };
    const onPageShow = (): void => { if (!host.isConnected) document.documentElement.append(host); };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    function dispose(): void {
      controller.dispose();
      routeObserver.dispose();
      unsubscribe();
      browser.runtime.onMessage.removeListener(listener);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      host.remove();
      delete globalState[BOOTSTRAP_KEY];
    }
    globalState[BOOTSTRAP_KEY] = "ready";
  } catch (error) {
    delete globalState[BOOTSTRAP_KEY];
    throw error;
  }
}
```

Der Bootstrap-Marker wird erst nach erfolgreicher Initialisierung `ready`; ein Fehler darf einen späteren Retry nicht blockieren. BFCache-`pagehide` mit `persisted=true` zerstört die Sitzung nicht unkontrolliert.

---

## A.10 `src/app/initial-state.ts`

```ts
import type { AppState } from "@/shared/types";

export const initialState: AppState = {
  overlayVisible: false,
  workflow: "IDLE",
  analysis: null,
  activeGroupId: null,
  expectedQuery: null,
  error: null,
  filter: "",
  sort: "count",
  diagnostics: [],
};
```

## A.11 Controller-Orchestrierungsvertrag

`src/app/controller.ts` besitzt exakt diese öffentliche Oberfläche (`ContentResponse` wird aus `@/shared/messages` importiert):

```ts
import type { ContentResponse } from "@/shared/messages";

export interface AppController {
  readonly analyze: () => Promise<void>;
  readonly selectGroup: (groupId: string) => void;
  readonly confirmSearch: () => Promise<void>;
  readonly confirmManualSelection: () => Promise<void>;
  readonly reopenMoveMenu: () => Promise<void>;
  readonly confirmCompletion: () => void;
  readonly cancel: (reason?: string) => void;
  readonly resetSession: () => void;
  readonly returnToResults: () => void;
  readonly handleBackgroundMessage: (type: "TOGGLE_OVERLAY" | "SHOW_OVERLAY") => ContentResponse | Promise<ContentResponse>;
  readonly dispose: () => void;
}
```

Controller-Invarianten:

- besitzt höchstens einen aktiven `AbortController`;
- startet Effects nur nach erfolgreichem State-Transition-Dispatch;
- fängt `AbortError` getrennt von Produktfehlern;
- wandelt unbekannte Exceptions in `GISO-INTERNAL-001` um;
- setzt Gruppe vor Workflow auf `in-progress` und bei sicherem Abschluss auf `done`;
- setzt bei Abbruch ohne Abschluss wieder auf `ready`;
- ruft niemals ein konkretes Gmail-Label auf.

---

# Anhang B. Copy-paste-Testbeispiele

## B.1 `tests/unit/email-parser.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { normalizeEmail, parseEmailCandidate } from "@/analyzer/email-parser";

describe("parseEmailCandidate", () => {
  it("removes the original uppercase match from the display name", () => {
    expect(parseEmailCandidate("Alice <ALICE@Example.COM>")).toEqual({ ok: true, value: { displayName: "Alice", email: "alice@example.com" } });
  });
  it("rejects multiple distinct addresses", () => {
    expect(parseEmailCandidate("a@example.com b@example.com")).toEqual({ ok: false, error: "MULTIPLE_EMAILS" });
  });
  it("preserves plus tags and dots", () => {
    expect(normalizeEmail("First.Last+tag@GMAIL.COM")).toEqual({ ok: true, value: "first.last+tag@gmail.com" });
  });
  it("normalizes an IDN domain", () => {
    expect(normalizeEmail("user@bücher.de")).toEqual({ ok: true, value: "user@xn--bcher-kva.de" });
  });
  it.each(["a@example.com/path", "a@example.com?x", "a@example.com#x", "a@example.com:443"])("rejects path-like domain input %s", (value) => {
    expect(normalizeEmail(value).ok).toBe(false);
  });
});
```

---

## B.2 `tests/unit/state-machine.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { reduceAppState } from "@/app/state-machine";
import { initialState } from "@/app/initial-state";

describe("state machine", () => {
  it("rejects an illegal selection transition from idle", () => {
    const next = reduceAppState(initialState, { type: "ALL_SELECTED" });
    expect(next.workflow).toBe("IDLE");
    expect(next.diagnostics.at(-1)?.code).toBe("GISO-STATE-ILLEGAL-001");
  });
  it("does not hide the overlay during a critical state", () => {
    const critical = { ...initialState, overlayVisible: true, workflow: "WAITING_SEARCH_RESULTS" as const };
    expect(reduceAppState(critical, { type: "TOGGLE_OVERLAY" }).overlayVisible).toBe(true);
  });
  it("does not accept a free query before a valid active group exists", () => {
    expect(reduceAppState(initialState, { type: "SEARCH_SUBMITTED", query: 'in:inbox "from:a@example.com"' }).workflow).toBe("IDLE");
  });
});
```

---

## B.3 `tests/unit/settings.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/settings/defaults";
import { validateSettings } from "@/settings/storage";

describe("settings validation", () => {
  it("drops unknown keys and clamps invalid structure to defaults", () => {
    expect(validateSettings({
      schemaVersion: 99,
      overlayPosition: { top: -1, right: "bad" },
      diagnosticsEnabled: true,
      senderHistory: ["private@example.com"],
    })).toEqual({
      ...DEFAULT_SETTINGS,
      diagnosticsEnabled: true,
    });
  });
});
```

## B.4 `tests/unit/candidate-scoring.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { selectUnambiguous, type ScoredCandidate } from "@/gmail/candidate-scoring";

describe("selectUnambiguous", () => {
  it("rejects candidates whose margin is too small", () => {
    const first = document.createElement("button");
    const second = document.createElement("button");
    const candidates: ScoredCandidate<HTMLElement>[] = [
      { element: first, score: 100, evidence: [] },
      { element: second, score: 90, evidence: [] },
    ];
    expect(selectUnambiguous(candidates, 90, 20)).toBeNull();
  });
});
```

## B.5 `tests/unit/redaction.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { redactUnknown } from "@/privacy/redact";

describe("diagnostic redaction", () => {
  it("redacts nested email, name and subject values", async () => {
    const redacted = await redactUnknown({
      sender: { displayName: "Alice", email: "alice@example.com" },
      subject: "Private subject",
    });
    const json = JSON.stringify(redacted);
    expect(json).not.toContain("alice@example.com");
    expect(json).not.toContain("Alice");
    expect(json).not.toContain("Private subject");
  });
});
```


## B.6 `tests/unit/brand-credit.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { renderBrandCredit } from "@/ui/brand-credit";

describe("brand credit", () => {
  it("renders exactly the locked non-interactive text", () => {
    const credit = renderBrandCredit();
    expect(credit.textContent).toBe("made by Ceegore");
    expect(credit.dataset["testid"]).toBe("brand-credit");
    expect(credit.querySelector("a")).toBeNull();
  });
});
```

## B.7 Netzwerkfreier E2E-Hook

```ts
import { test, expect } from "@playwright/test";

test("mock workflow performs no external request", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) external.push(request.url());
  });

  await page.goto("http://127.0.0.1:4173/mock-gmail.html");
  await page.getByTestId("giso-open").click();
  await page.getByTestId("giso-analyze").click();
  await expect(page.getByText("Analyse abgeschlossen")).toBeVisible();
  await expect(page.getByTestId("brand-credit")).toHaveText("made by Ceegore");
  expect(external).toEqual([]);
});
```

---

# Anhang C. Datei-für-Datei-Completion-Matrix

| Datei | Muss-Inhalt | Verbot | Primärgate |
|---|---|---|---|
| `src/background/index.ts` | Toolbar toggle; Gmail nur bei Transportfehler öffnen | Sender-/DOM-Logik | G1 |
| `src/content/index.ts` | Bootstrap-Aufruf | Produktlogik | G2 |
| `src/content/bootstrap.ts` | Lifetime, listeners, route cleanup | Gmail-Klicks | G2/G8 |
| `src/app/state-machine.ts` | pure transitions | async/DOM | G3 |
| `src/app/store.ts` | sync store | DOM state | G3 |
| `src/app/controller.ts` | Effect orchestration | Label selection | G5–G8 |
| `src/analyzer/email-parser.ts` | parse/normalize | provider canonicalization | G3 |
| `src/analyzer/grouping.ts` | deterministic grouping | display-name keying | G3/G4 |
| `src/analyzer/inbox-analyzer.ts` | read-only analysis | selection clicks | G4 |
| `src/gmail/adapter.ts` | detection interfaces | business decisions | G4–G7 |
| `src/gmail/search-controller.ts` | native search/evidence | URL/RPC search | G5 |
| `src/gmail/selection-controller.ts` | verified selection/fallback | blind first-page assumption | G6 |
| `src/gmail/move-controller.ts` | open/verify menu | label click | G7 |
| `src/gmail/completion-detector.ts` | evidence scoring | server guarantee claim | G7 |
| `src/ui/render.ts` | State-Rendering; Credit genau einmal anhängen | direct Gmail DOM | G2/G8 |
| `src/ui/brand-credit.ts` | exakter nicht interaktiver Text `made by Ceegore` | Link/Tracking | G2/G8 |
| `src/privacy/redact.ts` | recursive redaction | allowlist bypass | G9 |
| `src/settings/storage.ts` | strict schema | sender history | G9 |
| `scripts/verify-no-network.mjs` | ausführende Netzwerk-/Remote-Code-Primitiven in src und dist erkennen | pauschales URL-String-Verbot | G9 |
| `scripts/verify-manifest.mjs` | exact permission contract | warning-only failure | G9/G12 |
| `tests/fixtures/*` | synthetic minimal DOM | real dumps | G4–G7 |

Definition „Datei vollständig“:

- kompiliert;
- keine TODOs;
- keine ungenutzten Exporte;
- positive und negative Tests;
- dokumentierte Fehlercodes;
- alle Branches entweder getestet oder begründet;
- keine Schichtverletzung.

---

# Anhang D. Letzter autonomer Selbst-Audit vor Übergabe

Der Agent muss vor der menschlichen Endabnahme folgende Befehle ausführen und die ungekürzten Ausgaben archivieren:

```bash
node --version
npm --version
git rev-parse HEAD
git status --porcelain
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run test:e2e
npm run build
npm run verify:no-network
npm run verify:manifest
npm run verify:dist
npm run webext:lint
npm run package
```

Danach beantwortet der Agent ausschließlich auf Evidence-Basis:

1. Enthält `src/` irgendeinen Netzwerkprimitive-Aufruf?
2. Enthält das Manifest mehr als `storage` und Gmail-Hostzugriff?
3. Kann irgendein Codepfad ein Label auswählen?
4. Kann irgendein Klick ohne Score/Delta/Postcondition erfolgen?
5. Kann ein `low`-/`unresolved`-Sender global bearbeitet werden?
6. Kann Related Results ausgewählt werden?
7. Kann State über Reload fortgesetzt werden?
8. Kann eine Adresse in `storage.local` gelangen?
9. Kann eine Klartextadresse im Diagnoseexport verbleiben?
10. Sind alle P0/P1-Tests ohne Skip grün?
11. Ist die vollständige Live-Matrix PASS?
12. Ist die UUID-Add-on-ID stabil und identisch in allen Artefakten?
13. Sind Build und Source auf demselben Commit?
14. Ist das Arbeitsverzeichnis sauber?

Schon ein `JA` bei Frage 1–9 oder ein `NEIN` bei 10–14 bedeutet **NO-GO**.

---

# 74. Tiefe 360°-Prüfung Version 2.1.0 FINAL

## 74.1 Durchgeführte Prüfklassen

- vollständige Anforderungs- und Scope-Prüfung;
- Widerspruchsanalyse zwischen Kapitel 1–40, Referenzkapiteln und Anhängen;
- JSON-Parsing aller JSON-Codeblöcke;
- TypeScript-Syntaxprüfung aller TS-Codeblöcke;
- strikter Referenz-Typecheck der extrahierbaren Kernmodule mit Teststubs;
- Zustands- und Effect-Lifetime-Prüfung;
- Parser-, IDN-, Gruppierungs- und Query-Randfallprüfung;
- Datenschutz-/Diagnose-/Persistenzprüfung;
- No-Network-, Permission- und Supply-Chain-Prüfung;
- Build-, Packaging-, CI- und Reproduzierbarkeitsprüfung;
- UX-, Accessibility-, Overlay-Positionierungs- und Brandingprüfung;
- Gmail-Similar-Results-, Alias-, SPA-, BFCache- und DOM-Bruchprüfung;
- AMO-Taxonomie-/Reviewer-Offenlegungsprüfung;
- Phasen-, Evidence-, Gate- und Stop-Regelprüfung.

## 74.2 Behobene wesentliche Befunde

| ID | Befund der Vorversion | Risiko | Finale Korrektur |
|---|---|---|---|
| AUD-001 | No-Network-Scanner verbot jeden URL-String | Build scheitert an Gmail-URL/IDN-Normalisierung | Scanner verbietet ausführende Primitive in `src` und `dist` |
| AUD-002 | Background öffnete bei jeder Fehlerantwort Gmail neu | unnötige zweite Tabs | neuer Tab nur bei Messaging-Transportfehler |
| AUD-003 | fehlende Event-Imports | Typecheck-Fehler | vollständige Imports in `events.ts` |
| AUD-004 | Settings-Zugriff widersprach strict TS | Typecheck-Fehler | Bracket-Notation und erneute Validierung |
| AUD-005 | Parser entfernte lowercase statt Originalmatch | Adresse blieb bei Großschreibung im Namen | indexbasierte Entfernung |
| AUD-006 | Unicode-IDN-Test widersprach ASCII-Finder | falsche Unresolved-Fälle | Unicode-Finder, Punycode-Normalisierung, Revalidierung |
| AUD-007 | Gruppierung lieferte Singletons und zählte Duplikate | verletzt GISO-04 | Mindestgrenze und Fingerprint-Deduplikation |
| AUD-008 | schwacher Fingerprint las Row-ARIA/Text | Betreff-/Snippet-Leak | nur stabile IDs oder opaker Run-/Index-Fallback |
| AUD-009 | unquoted Gmail-`from:` | Alias-Erweiterung möglich | exakt gequotete Operatorform |
| AUD-010 | synthetisches Enter als Hauptweg | unzuverlässige Suche | nativer Button, `requestSubmit`, Enter nur Fallback |
| AUD-011 | Query konnte aus Event/UI übernommen werden | Injection/State Drift | Controller erzeugt Query aus aktiver Gruppe |
| AUD-012 | Overlay konnte kritischen Flow verstecken | unsichtbare Automation | kritische Zustände erzwingen sichtbar |
| AUD-013 | Route reset ohne garantierten Effect-Abort | spätere Klicks möglich | Controller-Abort vor Reset |
| AUD-014 | Steps doppelt im State ohne Update | UI-Drift | Ableitung aus Workflow |
| AUD-015 | Bootstrap-Marker blockierte Retry nach Fehler | dauerhaft defekter Tab | `initializing/ready`, Löschung bei Fehler |
| AUD-016 | Route Observer ohne spezifiziertes Debounce | Mutation-Last | 150-ms-Debounce und Burst-Cooldown |
| AUD-017 | Mutation waiter verglich Objektidentität | falsche Stabilität | primitive semantische Fingerprints |
| AUD-018 | Redaction-Schlüssel und E-Mail-Muster unvollständig | Diagnoseleak | Source-Allowlist, Vollhash, Post-Serialize-Scan |
| AUD-019 | Packaging konnte alte Artefakte checksumen | falsche Release-Evidence | Release-Verzeichnis vorab löschen |
| AUD-020 | Buildversion hing von npm-Umgebung ab | `undefined`/Mismatch | package.json als Source of Truth, harter Abbruch |
| AUD-021 | Projektbaum widersprach Referenzdateien | Agent implementiert falsche Dateien | finaler konsistenter Baum |
| AUD-022 | Overlay-Position gespeichert, Drag unvollständig | UX-/A11y-Lücke | Pointer-, Keyboard-, Clamp- und Reset-Vertrag |
| AUD-023 | Policy-Text behauptete absolute Nichtübertragung | unpräzise Gmail-Offenlegung | nutzerinitiierte Gmail-Suchverarbeitung explizit |
| AUD-024 | kein verbindlicher Credit | Nutzeranforderung fehlt | `made by Ceegore` als Requirement, Code und Gate |

## 74.3 Automatisierte Dokument-Gates

Vor Auslieferung dieser Spezifikation müssen folgende Dokumentprüfungen PASS sein:

1. alle Markdown-Codefences balanciert;
2. alle JSON-Blöcke parsebar;
3. alle TypeScript-Blöcke syntaktisch parsebar;
4. alle explizit benannten Referenzdateien eindeutig;
5. keine alte Queryform `from:(...)`;
6. keine alte Node/npm-Baseline;
7. `made by Ceegore` in Requirement, Textressource, Renderer, CSS, Tests, Dist-Gate, Live-Matrix und AMO-Unterlagen;
8. Version `2.1.0 FINAL` konsistent;
9. keine Produkt-/Code-TODOs oder unmarkierten Release-Platzhalter;
10. ZIP-Prüfsumme entspricht ausgelieferter Datei.

# 75. Verbleibende externe Risiken und Schutzmaßnahmen

Kein Dokument kann garantieren, dass eine undokumentierte Gmail-DOM-Struktur niemals geändert wird oder dass ein externer AMO-Reviewer jede Policy identisch auslegt. Ebenso kann ohne den späteren realen Repository- und Live-Build kein produktiver Code bereits heute vollständig ausgeführt werden.

Diese verbleibenden Risiken sind kontrolliert durch:

- Adapterisolierung und Score/Delta/Postcondition vor jedem Klick;
- Stop statt Guess;
- synthetische Fixtures plus verpflichtende Live-Matrix;
- manuelle Global-Selection- und Completion-Fallbacks;
- signiertes-Paket-/Permission-Prompt-Test;
- `PRIV-AMO-01` unmittelbar vor Submission;
- Incident-/Rollback-Prozess;
- keine automatische Labelwahl;
- keine Erweiterungs-eigenen Netzrequests.

# 76. Finales Implementierungs-Startpaket

Ein Coding-Agent startet ausschließlich so:

1. neue leere Repository-Struktur aus Kapitel 24 erstellen;
2. dieses Dokument unverändert als `docs/PRODUCT_SPEC.md` übernehmen;
3. Phase 00/G0 ausführen und Evidence archivieren;
4. Phasen 01–12 und Finalisierungs-Subphase F strikt in Reihenfolge abarbeiten;
5. jede Phase mit Expected Result, Negativtests und Gate abschließen;
6. keine Gmail-Live-Aktion vor dem dafür vorgesehenen menschlich überwachten Gate;
7. bei STOP-AND-ESCALATE-Bedingung keine improvisierte Alternative implementieren;
8. Produktversion `1.0.0` und Spezifikationsversion `2.1.0 FINAL` nicht verwechseln.

Startfreigabe besteht, sobald G0 grün ist. Releasefreigabe besteht erst nach G12, F-BUILD, F-DOMAIN, F-LIFETIME, F-UX, F-PRIVACY, vollständiger Live-Matrix und menschlicher Endsignatur.

# 77. Endgültiges Freigabeurteil Version 2.1.0 FINAL

Die Dokumentenbasis ist nach der beschriebenen 360°-Prüfung **IMPLEMENTATION READY**. Die zuvor erkannten internen Inkonsistenzen und Codeblocker sind in dieser Fassung korrigiert. Produkt-, Architektur-, Sicherheits-, Datenschutz-, UX-, Test-, CI-, Packaging-, Wartungs- und Phasenentscheidungen sind verbindlich vorgegeben.

Die Implementierung ist für einen schwächeren AI-Coding-Agenten weitgehend mechanisch ausführbar, sofern der Agent die Gates nicht umgeht und die unvermeidbaren Gmail-/AMO-Liveprüfungen unter menschlicher Kontrolle erfolgen. Eine Garantie für zukünftige externe DOM- oder Policy-Änderungen wird bewusst nicht behauptet; der Prozess ist darauf ausgelegt, solche Änderungen sicher zu erkennen, zu stoppen und gezielt zu beheben.

# Ende des autoritativen Dokuments
