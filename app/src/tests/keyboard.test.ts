/* THE KEYBOARD, FROM THE PAGE'S HEIGHT (logic/keyboard.ts): heights in, "is it
   up?" out — and the one step where it goes down, which is when the bottom bar
   may come back. */
import { describe, expect, it } from 'vitest';
import { keyboardOpen, keyboardStep, type KeyboardWatch } from '../lib/logic/keyboard';

describe('keyboardOpen', () => {
  it('is up when the page has lost a keyboard’s worth of height', () => {
    expect(keyboardOpen(800, 520)).toBe(true); // a phone, the keyboard ~35 %
    expect(keyboardOpen(800, 660)).toBe(true); // a low keyboard, 140 px
    expect(keyboardOpen(600, 400)).toBe(true); // a small phone
  });
  it('is down at the full height, and for a URL bar sliding away', () => {
    expect(keyboardOpen(800, 800)).toBe(false);
    expect(keyboardOpen(800, 750)).toBe(false); // ~50 px: browser chrome
    expect(keyboardOpen(800, 700)).toBe(false); // 100 px: still under the bar
    expect(keyboardOpen(1000, 860)).toBe(false); // 140 px of a 1000 px page: under 15 %
  });
  it('knows nothing of a page with no height', () => {
    expect(keyboardOpen(0, 0)).toBe(false);
  });
});

describe('keyboardStep', () => {
  const run = (heights: number[], from: KeyboardWatch = { full: 800, open: false }) => {
    let w = from;
    return heights.map((h) => {
      const r = keyboardStep(w, h);
      w = r.w;
      return r.closed;
    });
  };

  it('closes once, on the step where the page grows back — not while it opens or stays up', () => {
    expect(run([800, 520, 520, 800])).toEqual([false, false, false, true]);
    /* the keyboard changes shape while up: still up, never closed */
    expect(run([520, 480, 560, 520])).toEqual([false, false, false, false]);
  });

  it('a desktop window or a sliding URL bar never closes anything', () => {
    expect(run([800, 780, 800, 760, 800])).toEqual([false, false, false, false, false]);
  });

  it('opening in two steps is not a close, and the close in two steps is one', () => {
    expect(run([800, 700, 520])).toEqual([false, false, false]);
    expect(run([520, 640, 800], { full: 800, open: true })).toEqual([false, false, true]);
  });

  it('measures against the tallest page seen: a page that grows later raises the baseline', () => {
    const r = keyboardStep({ full: 700, open: false }, 800);
    expect(r.w).toEqual({ full: 800, open: false });
    expect(r.closed).toBe(false);
    expect(keyboardStep(r.w, 520).w.open).toBe(true);
  });
});
