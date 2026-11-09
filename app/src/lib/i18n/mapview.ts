/* THE MAP TAB'S SCOPE CHIP, ITS PEEK ROW AND ITS CREDITS, IN WORDS (10 Nov 2026) — a module of its own, like
   photos.ts and mapbuild.ts: only the Map tab reads these, and it is a lazy screen; in strings.ts's `S` they would
   sit in the start-up bundle every cold start loads and parses (that bundle is at its 200 KB gate). Everything
   the Map tab already said — counts, "Show places", the licence's words — is `S.mapTab`'s, said once. */
export const SM = {
  /* the scope chip, in the filter row: where the chips, the cards and the list are about */
  wholeTrip: 'Whole trip',
  chipAria: (where: string, n: number) => `Showing ${where}, ${n} ${n === 1 ? 'place' : 'places'}. Change where.`,
  scopeTitle: 'Where on the trip',
  scopeSub: 'The cards and the list follow this — only you change it.',
  /* the places' sheet at its peek: one row of chips */
  peekRow: 'Places here',
  /* the credits behind the line at the map's foot: its words are S.mapTab.attribution(Short) */
  creditsTitle: 'Map credits',
};
