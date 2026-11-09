/* THE PLACES' SHEET AT ITS PEEK, AND OPENED (Map 5e's fold, turned round 10 Nov 2026 —
   lib/map/peek.svelte.ts): the Map tab opens with the sheet at its peek (the head and one row of chips) so the map
   keeps two thirds of the screen; the chevron or the handle opens it to its photo cards and back. The choice lasts
   the SESSION — module state, so the Map tab left and opened again finds the sheet as it was — and nothing is
   written to the phone: a new start of the app opens at the peek again. */
import { afterEach, describe, expect, it, vi } from 'vitest';

const writes: string[] = [];
const spy = {
  getItem: (): string | null => null,
  setItem: (k: string) => void writes.push(k),
  removeItem: (k: string) => void writes.push(k),
};

async function fresh() {
  vi.resetModules();
  return (await import('../lib/map/peek.svelte')).peek;
}

afterEach(() => {
  vi.unstubAllGlobals();
  writes.length = 0;
});

describe('the sheet · peek and opened', () => {
  it('opens at its peek', async () => {
    expect((await fresh()).expanded).toBe(false);
  });
  it('the chevron opens it and closes it again', async () => {
    const peek = await fresh();
    peek.toggle();
    expect(peek.expanded).toBe(true);
    peek.toggle();
    expect(peek.expanded).toBe(false);
    peek.set(true);
    expect(peek.expanded).toBe(true);
  });
  it('lasts the session: the same module, so coming back to the Map tab finds it as it was left', async () => {
    const peek = await fresh();
    peek.set(true);
    const again = (await import('../lib/map/peek.svelte')).peek; // no resetModules: the same app run
    expect(again.expanded).toBe(true);
  });
  it('a new start of the app opens at the peek again — the choice is not kept on the phone', async () => {
    vi.stubGlobal('localStorage', spy);
    vi.stubGlobal('sessionStorage', spy);
    (await fresh()).set(true);
    expect((await fresh()).expanded).toBe(false);
    expect(writes).toEqual([]);
  });
});
