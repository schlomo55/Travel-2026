import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/* the scoped class for one component's styles (see SHORT SCOPED CLASS NAMES) */
const scoped = new Map<string, { css: string; file: string }>();
function cssHash({ css, filename, hash }: { css: string; filename: string; hash: (s: string) => string }): string {
  const name = `_${hash(css).slice(-4)}`;
  const seen = scoped.get(name);
  if (seen && seen.css !== css && seen.file !== filename) {
    throw new Error(`${filename} and ${seen.file} would share the scoped class ${name} — take more of the hash in vite.config.ts cssHash().`);
  }
  scoped.set(name, { css, file: filename });
  return name;
}

export default defineConfig({
  /* TERSER, NOT ESBUILD, MINIFIES THE BUILD (Horizon Run 2). The bundle gate
     (scripts/check-bundle.mjs — then 200 KB of gzipped JS the page loads;
     since Run 3c the start-up JS ≤ 200 KB and all app JS ≤ 260 KB) was
     unchanged; what changed is how small the same code ships. On this
     codebase — Svelte 5's compiled templates above all — terser's output
     gzips about 8 % smaller than esbuild's (209.43 → 192.66 KB at the end
     of Run 2, 2026-09-28).
     terser is not a new dependency: it is already installed with vite and
     workbox-build (see package-lock.json). Nothing unsafe (no unsafe-*
     options, property names are never mangled, getters are never assumed
     pure — Svelte's props are getters).
     Run 3 (2026-09-28): three compress passes and ES2020 output syntax — the
     build target (Vite's baseline, ≥ Chrome 107) already runs every ES2020
     form, the Android WebView included — and no modulepreload polyfill: the
     polyfill exists for browsers without <link rel=modulepreload>, and every
     browser this app ships to has it. Together ~0.6 KB gz; the gate is
     unchanged.
     Later in Run 3: five compress passes (each pass is the same safe
     rewrite, run again on its own output) and hoist_funs — function
     declarations moved to the top of their scope, where JavaScript already
     hoists them (ESM is strict mode, so block-level ones stay in their
     blocks). Measured on the same code, 2026-09-28: passes 3 → 199.79 KB,
     passes 4 → 198.90, passes 5 + hoist_funs → 198.13 (8 passes: 198.12).
     Still nothing from terser's unsafe family. */
  build: {
    minify: 'terser',
    terserOptions: { ecma: 2020, compress: { passes: 5, hoist_funs: true } },
    modulePreload: { polyfill: false },
    /* THE CHUNK MAP THE BUNDLE GATE READS (Run 3c). dist/.vite/manifest.json
       says which chunk is the entry, which chunks it imports statically (the
       JavaScript a cold start must load and parse) and which are imported
       lazily (a screen opened later). scripts/check-bundle.mjs gates the two
       sums separately. A few KB of file names; nothing else — no trip data,
       not precached (.json is outside the service worker's glob). */
    manifest: true,
  },
  plugins: [
    /* SHORT SCOPED CLASS NAMES (Run 3). Svelte marks every element a
       component's <style> reaches with a class naming that style, by default
       "svelte-" + 7 characters of a hash of the CSS — ~1,450 times in the
       compiled templates. Here it is "_" + the hash's last 4 characters: no
       class the app writes starts with "_", so it cannot meet one of ours,
       and cssHash() below fails the build if two different stylesheets ever
       share one. Measured 2026-09-28: 200.60 → 199.72 KB gz (with the Svelte
       version tag dropped too, discloseVersion: false — ~20 bytes). Behaviour
       is unchanged; the gate is unchanged. */
    svelte({ compilerOptions: { cssHash, discloseVersion: false } }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Living the dream — travel companion',
        short_name: 'LTD',
        description: 'Personal offline-first travel companion — trips as projects.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        // Dark is the DEFAULT theme, and a manifest is read once at install —
        // long before any settings record exists — so the splash and the
        // system chrome take the default's night-indigo sky. A daylight
        // user's running app repaints theme-color itself (lib/logic/theme.ts).
        background_color: '#0b0c16',
        theme_color: '#0b0c16',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        // The ?d=YYYY-MM-DD date-preview must always hit the cached shell.
        ignoreURLParametersMatching: [/^d$/],
        cleanupOutdatedCaches: true,
        // Workbox default (2 MB) silently drops large fonts from the precache.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
  ],
});
