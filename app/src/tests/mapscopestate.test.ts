/* THE SCOPE AS THE PERSON LEFT IT (10 Nov 2026, lib/map/scope.svelte.ts): kept for the session, per trip — the Map
   tab left for a place's pass or for Now and opened again finds it where it was; another trip starts unchosen. */
import { describe, expect, it, vi } from 'vitest';

async function fresh() {
  vi.resetModules();
  return (await import('../lib/map/scope.svelte')).mapScope;
}

describe('the chosen scope', () => {
  it('nobody has chosen: undefined — the screen uses the default for today', async () => {
    expect((await fresh()).of('t1')).toBeUndefined();
  });
  it('keeps a stop, and the whole trip (null) as a choice of its own', async () => {
    const s = await fresh();
    s.choose('t1', 's-brindle');
    expect(s.of('t1')).toBe('s-brindle');
    s.choose('t1', null);
    expect(s.of('t1')).toBeNull();
  });
  it('is one trip’s: another trip finds nothing chosen', async () => {
    const s = await fresh();
    s.choose('t1', 's-brindle');
    expect(s.of('t2')).toBeUndefined();
  });
  it('lasts the session (the same module) and is not written to the phone', async () => {
    const writes: string[] = [];
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: (k: string) => writes.push(k), removeItem: () => undefined });
    const s = await fresh();
    s.choose('t1', 's-corvane');
    expect((await import('../lib/map/scope.svelte')).mapScope.of('t1')).toBe('s-corvane');
    expect(writes).toEqual([]);
    vi.unstubAllGlobals();
  });
});
