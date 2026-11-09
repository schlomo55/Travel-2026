/* THE MAP'S SIDE CONTROLS AND THE ROOM THEY HAVE (10 Nov 2026, lib/logic/mapchrome.ts) — on a 384 × 823 phone:
   the sheet at its peek (240 px with the phone's 24 px bar) leaves the whole column room; opened to its cards
   (466 px) it leaves a ~185 px band of map, and the column wraps instead of sliding under the sheet. */
import { describe, expect, it } from 'vitest';
import { SIDE_GAP, SIDE_HEIGHTS, SIDE_W, sideColumns, sideWidth } from '../lib/logic/mapchrome';

const full = SIDE_HEIGHTS.reduce((a, h) => a + h, 0) + SIDE_GAP * (SIDE_HEIGHTS.length - 1);

/* the screen's own sum (Map.svelte sideRoom): the room above the sheet and the foot line, under the search row */
const room = (vh: number, sheet: number, topH: number, foot = 26): number => Math.max(0, vh - sheet - (foot + 16) - (topH + 18));

describe('the controls column', () => {
  it('is 267 px tall in one column — Rings 52, the zoom pair 89, north 48, locate 48, 10 apart', () => {
    expect(full).toBe(267);
    expect(sideColumns(267)).toBe(1);
    expect(sideColumns(1000)).toBe(1);
    expect(sideColumns(Infinity)).toBe(1);
  });
  it('one px short of whole, the last control wraps to a second column', () => {
    expect(sideColumns(266)).toBe(2);
  });
  it('wraps the way CSS does: a column holds what fits, the next control starts the next', () => {
    expect(sideColumns(151)).toBe(2); // Rings + zoom (52 + 10 + 89 = 151) | north + locate (106)
    expect(sideColumns(150)).toBe(3); // Rings | zoom + north (89 + 10 + 48 = 147) | locate
  });
  it('never fewer than one column, never more than one per control', () => {
    expect(sideColumns(0)).toBe(4);
    expect(sideColumns(-50)).toBe(4);
    expect(sideColumns(NaN)).toBeGreaterThanOrEqual(1);
  });
  it('its width: 48 a column, 10 between', () => {
    expect(sideWidth(1)).toBe(SIDE_W);
    expect(sideWidth(2)).toBe(106);
    expect(sideWidth(3)).toBe(164);
  });
});

describe('384 × 823, the search row and the chips over the top (topH ≈ 172)', () => {
  it('at the sheet’s peek (240 px): the whole column fits, in one', () => {
    expect(sideColumns(room(823, 240, 172))).toBe(1);
  });
  it('opened to its cards (466 px): every control still fits above the sheet — in more columns', () => {
    const r = room(823, 466, 172);
    const cols = sideColumns(r);
    expect(cols).toBeGreaterThan(1);
    expect(cols).toBeLessThanOrEqual(3);
    expect(sideWidth(cols)).toBeLessThanOrEqual(164);
  });
  it('a taller or shorter sheet moves nothing under it: the column is never taller than its room', () => {
    for (const sheet of [200, 240, 320, 466, 520]) {
      const r = room(823, sheet, 172);
      const cols = sideColumns(r);
      // the tallest column the wrap makes
      let tallest = 0;
      let used = 0;
      for (const h of SIDE_HEIGHTS) {
        if (used > 0 && used + SIDE_GAP + h > r) used = 0;
        used += (used > 0 ? SIDE_GAP : 0) + h;
        tallest = Math.max(tallest, used);
      }
      expect(tallest, `sheet ${sheet}`).toBeLessThanOrEqual(Math.max(r, ...SIDE_HEIGHTS));
      expect(cols).toBeGreaterThanOrEqual(1);
    }
  });
});
