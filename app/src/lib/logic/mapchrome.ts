/* THE MAP'S CONTROLS DOWN THE SIDE, AND THE ROOM THEY HAVE (Map tab). They sit under the search row, on the right,
   in one column — Rings, zoom in/out, north up, "show where you are" — 267 px tall. The places' sheet at its
   peek height leaves that room; opened to its cards (Map 5f's 466 px) it leaves a band of map ~185 px high on a
   384 × 823 phone, and a column laid under the sheet is a column nobody can tap. So the column is capped to the
   room above the sheet and WRAPS into a second (third) column to its left: every control stays on the map and
   above the sheet, at any height of it. The CSS does the wrapping (`flex-wrap: wrap-reverse` under a max-height);
   this is the same count, so the screen can keep its other things — the edge chips, the notices — off them. */

/** a control's width, and the gap between controls and between columns */
export const SIDE_W = 48;
export const SIDE_GAP = 10;
/** the controls' heights, top to bottom: Rings, the zoom pair, north up, locate */
export const SIDE_HEIGHTS: readonly number[] = [52, 89, 48, 48];

/** How many columns the controls fill in `room` px of height (never fewer than one). */
export function sideColumns(room: number, heights: readonly number[] = SIDE_HEIGHTS): number {
  const cap = Number.isFinite(room) ? Math.max(0, room) : Infinity;
  let cols = 1;
  let used = 0;
  for (const h of heights) {
    if (used > 0 && used + SIDE_GAP + h > cap) {
      cols++;
      used = h;
    } else used += (used > 0 ? SIDE_GAP : 0) + h;
  }
  return cols;
}

/** The controls' total width in `cols` columns. */
export const sideWidth = (cols: number): number => cols * SIDE_W + (cols - 1) * SIDE_GAP;
