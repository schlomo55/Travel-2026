/* The theme, and the three places that have to agree about it.

   Two themes, dark by default (owner decision 2026-08-12). "By default" is the
   part with teeth: dark is the ABSENCE of an attribute, so every layer has to
   agree on what "nothing stored" means, and they are three different languages
   — TypeScript here, CSS in app.css, and four lines of plain JS in index.html
   that run before any of this is loaded. A test that only exercised
   normalizeTheme() would pass happily while the boot script read a key nobody
   writes, and the only symptom would be a black flash on someone's morning
   train. So the drift between the three is asserted directly, against the real
   files. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  DEFAULT_THEME,
  normalizeTheme,
  rememberTheme,
  themeAttr,
  THEME_COLOR,
  THEME_KEY,
  type Theme,
  type ThemeDocument,
} from '../lib/logic/theme';

const appDir = join(__dirname, '..', '..');
const appCss = readFileSync(join(appDir, 'src', 'app.css'), 'utf8');
/* the rules, without the prose about them — app.css explains in comments that
   it uses no prefers-color-scheme, and a naive grep would read that as a use */
const appRules = appCss.replace(/\/\*[\s\S]*?\*\//g, '');
const indexHtml = readFileSync(join(appDir, 'index.html'), 'utf8');

/* the document, reduced to what applyTheme touches — the suite runs in node */
function fakeDoc(): ThemeDocument & { attrs: Record<string, string | null>; meta: string | null } {
  const state = {
    attrs: {} as Record<string, string | null>,
    meta: '#000000' as string | null,
    documentElement: {
      setAttribute(name: string, value: string) {
        state.attrs[name] = value;
      },
      removeAttribute(name: string) {
        delete state.attrs[name];
      },
    },
    querySelector(sel: string) {
      if (sel !== 'meta[name="theme-color"]') return null;
      return {
        setAttribute(_name: string, value: string) {
          state.meta = value;
        },
        removeAttribute() {},
      };
    },
  };
  return state;
}

describe('theme · what counts as dark', () => {
  it('defaults to dark, and dark is what every absent value means', () => {
    expect(DEFAULT_THEME).toBe('dark');
    for (const v of [undefined, null, '', 'Dark', 'auto', 'system', 0, 1, {}, []]) {
      expect(normalizeTheme(v)).toBe('dark');
    }
  });

  it('only the exact string "light" is light', () => {
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('Light')).toBe('dark');
    expect(normalizeTheme(' light')).toBe('dark');
  });

  /* This is the rule the whole no-flash design rests on: if dark were
     data-theme="dark", a cold boot would have to WRITE something before it
     could paint, and there is nothing to write it with. */
  it('dark is the absence of the attribute, never data-theme="dark"', () => {
    expect(themeAttr('dark')).toBeNull();
    expect(themeAttr('light')).toBe('light');
  });
});

describe('theme · applying it to the document', () => {
  it('adds the attribute for light and removes it for dark', () => {
    const doc = fakeDoc();
    applyTheme('light', doc);
    expect(doc.attrs['data-theme']).toBe('light');
    applyTheme('dark', doc);
    expect(doc.attrs['data-theme']).toBeUndefined();
  });

  it('is idempotent — it runs on every settings tick', () => {
    const doc = fakeDoc();
    applyTheme('light', doc);
    applyTheme('light', doc);
    expect(doc.attrs['data-theme']).toBe('light');
    applyTheme('dark', doc);
    applyTheme('dark', doc);
    expect(doc.attrs['data-theme']).toBeUndefined();
  });

  it('repaints the OS chrome to match', () => {
    const doc = fakeDoc();
    applyTheme('light', doc);
    expect(doc.meta).toBe(THEME_COLOR.light);
    applyTheme('dark', doc);
    expect(doc.meta).toBe(THEME_COLOR.dark);
  });

  it('survives a document with no theme-color meta at all', () => {
    const doc = fakeDoc();
    doc.querySelector = () => null;
    expect(() => applyTheme('light', doc)).not.toThrow();
    expect(doc.attrs['data-theme']).toBe('light');
  });
});

describe('theme · the synchronous mirror', () => {
  it('writes the chosen theme under the key the boot script reads', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    rememberTheme('light');
    expect(setItem).toHaveBeenCalledWith(THEME_KEY, 'light');
    vi.unstubAllGlobals();
  });

  /* Private mode throws on write. One flash is a cost; a crash on boot is not. */
  it('swallows a storage that refuses to store', () => {
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => rememberTheme('light')).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('theme · the three layers agree', () => {
  it('app.css keys off exactly the attribute themeAttr() produces', () => {
    expect(appRules).toContain(":root[data-theme='light'] {");
    /* and dark is plain :root — no [data-theme='dark'] block anywhere */
    expect(appRules).not.toContain("data-theme='dark'");
    expect(appRules).not.toContain('data-theme="dark"');
  });

  /* The owner's decision was "by default dark". A prefers-color-scheme rule or
     a light-dark() anywhere would hand that decision back to the phone. */
  it('no OS-driven theming sneaks in', () => {
    expect(appRules).not.toContain('prefers-color-scheme');
    expect(appRules).not.toContain('light-dark(');
  });

  it('the boot script reads the same key this module writes', () => {
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_KEY}')`);
    expect(indexHtml).toContain("setAttribute('data-theme', 'light')");
  });

  it('the boot script paints the same chrome colour applyTheme() would', () => {
    expect(indexHtml).toContain(THEME_COLOR.light);
    expect(indexHtml).toContain(`content="${THEME_COLOR.dark}"`);
  });

  /* Under Horizon every screen paints its top edge with the sky itself, so
     the status bar has to BE that sky — each theme's own --sky — or the top
     of the phone is a visible seam. Both themes are read, not just one. */
  it('the chrome colour is each theme’s own sky', () => {
    const lightAt = appCss.indexOf(":root[data-theme='light'] {");
    const dark = appCss.slice(appCss.indexOf(':root {'), lightAt);
    const light = appCss.slice(lightAt);
    const skyOf = (block: string): string | undefined => /--sky:\s*(#[0-9a-f]{6})/i.exec(block)?.[1];
    expect(skyOf(dark)).toBe(THEME_COLOR.dark);
    expect(skyOf(light)).toBe(THEME_COLOR.light);
  });

  /* ...and the manifest paints the splash and the task switcher with the
     same default sky, because a manifest is read once, at install, long
     before any settings record exists. */
  it('the web manifest takes the default theme’s sky', () => {
    const vite = readFileSync(join(appDir, 'vite.config.ts'), 'utf8');
    expect(vite).toContain(`background_color: '${THEME_COLOR.dark}'`);
    expect(vite).toContain(`theme_color: '${THEME_COLOR.dark}'`);
  });

  it('every theme the type allows has a chrome colour', () => {
    const themes: Theme[] = ['dark', 'light'];
    for (const t of themes) expect(THEME_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
