/* THE "NEAR YOU" SHEET AT ITS PEEK HEIGHT, OR OPENED (Map 5e's fold, reworked 10 Nov 2026). The Map tab opens with
   the places' sheet at its PEEK: the handle, the title and count with the List button, and ONE row of place chips —
   so the map keeps roughly two thirds of the screen. The chevron (and the handle) opens it to its photo cards and
   closes it back to the peek; before Nov 2026 it opened the other way — the cards first, a chevron to fold them.

   The choice lasts the SESSION: it is module state, so leaving the Map tab and coming back finds the sheet as it
   was left. It is not written to the phone: a new start of the app opens at the peek again, which is the point. */

let expanded = $state(false);

export const peek = {
  /** the sheet is opened to its cards (false: at its peek) */
  get expanded(): boolean {
    return expanded;
  },
  set(next: boolean): void {
    expanded = next;
  },
  toggle(): void {
    expanded = !expanded;
  },
};
