/* The theme, and the two-step dance that stops it flashing.

   Owner decision 2026-08-12: two themes, optional, dark by default. That last
   word is what makes this file more than a boolean. Dark is the ABSENCE of
   `data-theme` on <html>, never `data-theme="dark"` — so a cold boot paints
   the default with no attribute, no class and nothing to wait for.

   The setting itself lives in Dexie with every other setting, and Dexie is
   asynchronous: by the time it answers, the first frame is long painted. A
   light-theme user would therefore watch a black screen flash to cream on
   every single launch. So the chosen theme is MIRRORED into localStorage,
   which is synchronous, and a four-line script in index.html reads it in
   <head> before the body exists. Dexie remains the source of truth; the
   mirror is a cache that only ever has to be right at boot.

   Nothing here reads prefers-color-scheme. The theme is an app setting, not
   an operating-system one — the phone is dark-mode all day and this app is
   still the thing you read on a bright train (docs/design/horizon/system/
   README.md § Themes). */

export type Theme = 'dark' | 'light';

/** Dark is the default, and it is the default in three places: here, the
    absence of the attribute in app.css, and the boot script in index.html. */
export const DEFAULT_THEME: Theme = 'dark';

/** The localStorage key the index.html boot script reads. If you change it,
    change it there too — `theme.test.ts` fails the build if they drift. */
export const THEME_KEY = 'ltd:theme';

/** What the OS chrome (status bar, task switcher) is told to paint: the
    theme's own `--sky`, because under Horizon every screen paints its top
    edge with the sky itself — there is no app-bar band between the two.
    Night indigo by default, warm dawn paper in daylight (tokens.json). */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#0b0c16',
  light: '#f5f1ea',
};

/** Anything that is not the string 'light' is dark: undefined (settings
    written before this run), null (nothing stored), a stale 'auto' from some
    future experiment, or a value someone typed into devtools. */
export function normalizeTheme(value: unknown): Theme {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

/** The value of `data-theme`, or null when the attribute must not be there. */
export function themeAttr(theme: Theme): string | null {
  return theme === 'light' ? 'light' : null;
}

/* The document, reduced to the three things this module touches — so the
   behaviour can be unit-tested without a DOM (the suite runs in node). */
export interface ThemeElement {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}
export interface ThemeDocument {
  documentElement: ThemeElement;
  querySelector(selectors: string): ThemeElement | null;
}

/** Paint the theme onto the document: the attribute app.css keys off, and the
    meta the OS keys off. Idempotent, and safe to run on every settings tick. */
export function applyTheme(theme: Theme, doc: ThemeDocument): void {
  const attr = themeAttr(theme);
  if (attr === null) doc.documentElement.removeAttribute('data-theme');
  else doc.documentElement.setAttribute('data-theme', attr);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

/** Update the synchronous mirror the next cold boot will read. A refusal to
    store (private mode, a full quota) costs one flash, never a crash. */
export function rememberTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* nothing to remember it with — Dexie still knows */
  }
}
