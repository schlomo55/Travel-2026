/* The theme — one, dark — and the four places that have to agree about it.

   Daylight was removed on 2026-09-28 (owner: "we dont need Daylight" …
   "remove it"). "Dark only" is easy to say and easy to half-do: a light rule
   left in a component's <style>, a boot script still reading the old key, a
   meta tag still offering the phone a light scheme, a manifest painting the
   splash some other colour than the sky. Each of those would pass every
   screen check on a phone that never chose Daylight — and show up only on the
   one that did. So the files themselves are read here: app.css, every
   source file, index.html, the manifest in vite.config.ts and the design
   system's tokens.json. (The rehearsal boots a phone that DID choose it —
   `theme: 'light'` stored both ways — and finds the night.) */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_THEME_KEY, THEME_COLOR } from '../lib/logic/theme';

const appDir = join(__dirname, '..', '..');
const srcDir = join(appDir, 'src');
/* the rules, without the prose about them — app.css explains in comments what
   it no longer does, and a naive grep would read that as a use */
const rules = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
const appCss = readFileSync(join(srcDir, 'app.css'), 'utf8');
const appRules = rules(appCss);
const indexHtml = readFileSync(join(appDir, 'index.html'), 'utf8');
const vite = readFileSync(join(appDir, 'vite.config.ts'), 'utf8');
const tokens = JSON.parse(readFileSync(join(appDir, '..', 'docs', 'design', 'horizon', 'system', 'tokens.json'), 'utf8')) as {
  color: { themes: { id: string }[]; tokens: { name: string; value: unknown }[] };
};

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'tests') out.push(...sources(f));
    } else if (/\.(svelte|ts|css)$/.test(e.name)) out.push(f);
  }
  return out;
}
const files = sources(srcDir).map((f) => ({ name: relative(srcDir, f).replace(/\\/g, '/'), text: rules(readFileSync(f, 'utf8')) }));

describe('theme · one palette', () => {
  it('the sky the OS chrome paints is app.css’s own --sky', () => {
    const root = appCss.slice(appCss.indexOf(':root {'), appCss.indexOf('\n}\n', appCss.indexOf(':root {')));
    expect(/--sky:\s*(#[0-9a-f]{6})/i.exec(root)?.[1]).toBe(THEME_COLOR);
    expect(root).toContain('color-scheme: dark;');
  });

  it('app.css has no second palette, and never asks the phone for one', () => {
    expect(appRules).not.toContain('data-theme');
    expect(appRules).not.toContain('prefers-color-scheme');
    expect(appRules).not.toContain('light-dark(');
    expect(appRules).not.toMatch(/color-scheme:\s*light/);
    /* one :root block: the identity hues are composed once, not per theme */
    expect(appRules.match(/--stop-text:\s*hsl\(/g)).toHaveLength(1);
  });

  /* A light rule in a component's own <style> is the easy one to leave
     behind: it passes every check on a phone that never chose Daylight. */
  it('no source file carries a light rule or reads a theme', () => {
    const offenders = files
      .filter(({ text }) => /data-theme|prefers-color-scheme|light-dark\(|color-scheme:\s*light/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
    /* a stored `theme: 'light'` is ignored because nothing reads it */
    const readers = files.filter(({ name, text }) => name !== 'lib/logic/theme.ts' && /\.theme\b|'ltd:theme'|LEGACY_THEME_KEY/.test(text)).map(({ name }) => name);
    expect(readers).toEqual([]);
  });
});

describe('theme · the boot and the chrome agree', () => {
  it('index.html paints the sky and offers the phone only the dark scheme', () => {
    expect(indexHtml).toContain(`<meta name="theme-color" content="${THEME_COLOR}" />`);
    expect(indexHtml).toContain('<meta name="color-scheme" content="dark" />');
  });

  /* The boot script existed only to put Daylight on <html> before the first
     paint. With nothing to choose there is nothing to run before the app. */
  it('index.html runs no boot script and reads no stored theme', () => {
    const html = rules(indexHtml);
    expect(html.match(/<script\b[^>]*>/g)).toEqual(['<script type="module" src="/src/main.ts">']);
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain(LEGACY_THEME_KEY);
    expect(html).not.toContain('data-theme');
  });

  /* The manifest is read once, at install: the splash and the task switcher
     take the same sky. */
  it('the web manifest takes the sky', () => {
    expect(vite).toContain(`background_color: '${THEME_COLOR}'`);
    expect(vite).toContain(`theme_color: '${THEME_COLOR}'`);
  });
});

describe('theme · the design system is dark only too', () => {
  it('tokens.json has one theme, and one value per colour', () => {
    expect(tokens.color.themes.map((t) => t.id)).toEqual(['dark']);
    const notOne = tokens.color.tokens.filter((t) => typeof t.value !== 'string').map((t) => t.name);
    expect(notOne).toEqual([]);
    expect(tokens.color.tokens.find((t) => t.name === 'sky')?.value).toBe(THEME_COLOR);
  });
});
