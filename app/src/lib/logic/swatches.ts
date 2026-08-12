/* The expense-category swatches — the one colour set in this app that is DATA,
   not CSS.

   An ExpenseCategory carries its `color` in the database and in every backup
   file, so it cannot be a `var(--…)` the way the rest of the palette is: the
   value has to survive an export, a phone swap and an import on a build that
   never heard of this file. What it CAN stop being is six anonymous hex
   literals buried in the trip wizard, which is what they were until
   2026-08-12 (Gap D). They are named here, once, and the wizard reads them.

   They are also, deliberately, NOT Lantern gold. A spending chart needs six
   colours a traveller can tell apart at a glance; the brand voice would make
   all six the same. LANTERN §Per-trip identity already carves out this kind of
   exception for the per-stop hue — this is the second and last one.

   Contrast: these are 8 px dots and 3 px meter fills beside a label in
   `--ink-2`, never a text colour and never a text ground, so they carry no
   contrast obligation. Nothing in the app prints a character on one. */
export const CATEGORY_SWATCH = {
  transport: '#3987e5',
  lodging: '#9085e9',
  food: '#c98500',
  activities: '#199e70',
  shopping: '#d55181',
  other: '#898781',
} as const;

/** The starter set a brand-new trip gets, in the order they are drawn. */
export const DEFAULT_CATEGORIES: readonly (readonly [string, string])[] = [
  ['Transport', CATEGORY_SWATCH.transport],
  ['Lodging', CATEGORY_SWATCH.lodging],
  ['Food', CATEGORY_SWATCH.food],
  ['Activities', CATEGORY_SWATCH.activities],
  ['Shopping', CATEGORY_SWATCH.shopping],
  ['Other', CATEGORY_SWATCH.other],
];
