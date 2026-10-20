/* THE PHONE'S BACK BUTTON (lib/platform/backbutton.ts): the page's own step
   back while there is somewhere to go, out of the app only from the first
   screen — never the WebView's step, which froze on a form with unsaved
   changes. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/state/router.svelte', () => ({ router: { entry: 0, layerDepth: 0 } }));

const { backAction } = await import('../lib/platform/backbutton');

describe('backAction', () => {
  it('steps back from any screen past the first', () => {
    expect(backAction(1, 0)).toBe('back');
    expect(backAction(4, 0)).toBe('back');
  });

  it('steps back while a sheet is open, a form that refused to close included', () => {
    expect(backAction(4, 1)).toBe('back');
    expect(backAction(0, 1)).toBe('back');
  });

  it('leaves the app only from the first screen with nothing open', () => {
    expect(backAction(0, 0)).toBe('leave');
  });
});

describe('start-up', () => {
  it('only the Android app takes the back button over', () => {
    const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const nativeAt = main.indexOf('if (Capacitor.isNativePlatform()) {');
    const native = main.slice(nativeAt, main.indexOf('} else {', nativeAt));
    expect(native).toContain("import('./lib/platform/backbutton')");
    expect(main.match(/platform\/backbutton/g)).toHaveLength(1);
  });
});
