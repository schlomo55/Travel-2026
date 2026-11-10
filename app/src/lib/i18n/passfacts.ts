/* THE PASS'S FIRST SCREEN, IN WORDS (10 Nov 2026) — a module of its own, like
   backup.ts and mapview.ts: only the pass (a lazy chunk since this change)
   and logic/passfacts.ts read these, so they stay out of strings.ts's `S`,
   which every cold start loads and parses (that bundle is at its 200 KB gate).
   Everything the pass already said — "Driver card", "Find email", the code's
   label — is `S.pass`'s and `S.glance`'s, said once. A key fact that comes
   from a meta row is labelled with that row's OWN key (the trip file's words:
   "Free cancel", "Late arrival"); only the facts that are not a meta row need
   a word here. */
export const SPF = {
  /* the block under the actions, and the fold under it */
  keyFacts: 'Key facts',
  details: 'All details',
  detailsWarn: 'includes a warning',
  /* a booking's money that is neither paid nor still to pay (those two are S.chip's, the stamp's words) */
  price: 'Price',
  address: 'Address',
  /* the front desk's number, a `tel:` link (the driver card dials the same one) */
  call: 'Call',
};
