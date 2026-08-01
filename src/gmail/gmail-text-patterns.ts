// Localisation lexicon for Gmail UI text (spec appendix A.4, §16.3). These
// patterns may be extended after fixture/live tests WITHOUT changing business
// logic. Generated Gmail CSS classes are never used here.
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
    move: [/^verschieben nach$/i, /^verschieben$/i, /in .* verschieben/i, /verschieben nach/iu],
    createNew: [/^neu erstellen$/i, /^neues label/i],
    undo: [/rückgängig/iu],
    loading: [/wird geladen/i, /laden/i],
    empty: [/keine e-mails/i, /keine nachrichten/i, /keine treffer/i],
    related: [/ähnliche ergebnisse/i, /verwandte ergebnisse/i],
    mailScope: [/^e-mails$/i, /^mail$/i],
  },
  en: {
    inbox: [/^inbox$/i, /^primary$/i, /^promotions$/i, /^social$/i],
    selectAllMatches: [/select all .* that match this search/i, /select all .* in this view/i],
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
