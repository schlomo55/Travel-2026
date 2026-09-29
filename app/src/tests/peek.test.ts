/* THE PLACES' SHEET, FOLDED AWAY AND BACK (Map 5e — the owner's addition,
   lib/map/peek.svelte.ts): "i want to be able to press on a arrow or
   something to make it disipear and a arrow to reappear". The choice lasts
   the session (module state: the Map tab left and opened again finds it as
   it was) and is written to the phone's storage as a convenience — a storage
   that throws, or none at all, only forgets; it never breaks the Map tab. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PEEK_KEY, readPeekHidden, writePeekHidden } from '../lib/map/peek.svelte';

const store = new Map<string, string>();
const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const broken = {
  getItem: (): string | null => {
    throw new Error('SecurityError: storage is blocked');
  },
  setItem: (): void => {
    throw new Error('QuotaExceededError');
  },
  removeItem: (): void => {
    throw new Error('SecurityError: storage is blocked');
  },
};

async function fresh() {
  vi.resetModules();
  return (await import('../lib/map/peek.svelte')).peek;
}

beforeEach(() => store.clear());
afterEach(() => vi.unstubAllGlobals());

describe('the fold · what the phone remembers', () => {
  it('is shown unless the phone says hidden — anything else, or nothing, is shown', () => {
    expect(readPeekHidden(fake)).toBe(false);
    store.set(PEEK_KEY, '1');
    expect(readPeekHidden(fake)).toBe(true);
    store.set(PEEK_KEY, 'true');
    expect(readPeekHidden(fake)).toBe(false);
    expect(readPeekHidden(null)).toBe(false);
    expect(readPeekHidden(undefined)).toBe(false);
  });
  it('writes hidden, and forgets when shown again', () => {
    writePeekHidden(fake, true);
    expect(store.get(PEEK_KEY)).toBe('1');
    writePeekHidden(fake, false);
    expect(store.has(PEEK_KEY)).toBe(false);
  });
  it('a storage that throws only forgets — never an error', () => {
    expect(readPeekHidden(broken)).toBe(false);
    expect(() => writePeekHidden(broken, true)).not.toThrow();
    expect(() => writePeekHidden(broken, false)).not.toThrow();
    expect(() => writePeekHidden(null, true)).not.toThrow();
  });
});

describe('the fold · for the session', () => {
  it('starts shown, folds and unfolds, and the phone keeps the choice', async () => {
    vi.stubGlobal('localStorage', fake);
    const peek = await fresh();
    expect(peek.hidden).toBe(false);
    peek.toggle();
    expect(peek.hidden).toBe(true);
    expect(store.get(PEEK_KEY)).toBe('1');
    peek.toggle();
    expect(peek.hidden).toBe(false);
    expect(store.has(PEEK_KEY)).toBe(false);
    peek.set(true);
    expect(peek.hidden).toBe(true);
  });
  it('a new start of the app finds it as it was left', async () => {
    vi.stubGlobal('localStorage', fake);
    (await fresh()).set(true);
    expect((await fresh()).hidden).toBe(true);
  });
  it('with no storage at all the session still remembers', async () => {
    vi.stubGlobal('localStorage', broken);
    const peek = await fresh();
    expect(peek.hidden).toBe(false);
    peek.toggle();
    expect(peek.hidden).toBe(true);
    peek.toggle();
    expect(peek.hidden).toBe(false);
  });
});
