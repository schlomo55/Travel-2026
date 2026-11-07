import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { loadMapKey } from './scripts/privacy/map-key';

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

/* THE ANDROID BUILD AND THE ONLINE MAP'S KEY (7 Nov 2026). The Protomaps API
   key (lib/map/street/online.ts) is built in as __LTD_MAP_KEY__ ONLY for the
   Android app — `vite build --mode android` (npm run build:android), which
   writes dist-android/ (git-ignored; Capacitor's webDir) — and for the dev
   server, which writes nothing. Every other build is keyless and goes to
   dist/, which is COMMITTED to a public repository and deployed as the PWA
   (whose origin the key's CORS list refuses anyway): `npm run build` never
   reads the key file, and the privacy gate (check:dist) fails if the key is
   ever found in dist/. No key file on this machine: an Android build without
   online tiles, everything else the same. */
const android = (mode: string): boolean => mode === 'android' || mode.startsWith('android-');

export default defineConfig(({ command, mode }) => ({
  define: { __LTD_MAP_KEY__: JSON.stringify(command === 'serve' || android(mode) ? loadMapKey() : '') },
  /* THE DEV SERVER ON :8080 (7 Nov 2026): http://localhost:8080 is the one dev origin the online map's key allows
     (lib/map/street/online.ts ONLINE_ORIGINS), so `npm run dev` serves there, or not at all. `vite preview` keeps
     its own port (4173, the rehearsal's). */
  server: { port: 8080, strictPort: true },
  /* THE MAP ENGINE (Map 5c) — maplibre-gl 6 by default; the tested fallback,
     maplibre-gl 5.24, with `vite build --mode engine-v5` (`--mode
     android-engine-v5` for the app), should v6's module worker not start in
     the phone's WebView (lib/map/street/engine-*.ts). Its worker is an ES
     module (v6 starts it with { type: 'module' }). */
  /* DEXIE'S OWN ES2021 BUILD (QA fix list, 2026-11-07). Dexie 4.4.4 ships
     two builds of the same source: the package's default entry wraps
     dist/dexie.min.js, transpiled to ES5 (its class and async helpers
     included); dist/modern/dexie.mjs is the same release compiled for ES2021
     — the build Dexie's own README links for ES-module use. The app's target
     (Chrome ≥ 107, the Android WebView) runs ES2021 natively, so the ES5
     helpers were dead weight in every cold start. Measured on the same code:
     initial 201.57 → 199.96 KB, all app JS 286.17 → 284.59 KB. The unit
     suite resolves it the same way (vitest.config.ts). Gates unchanged. */
  resolve: {
    alias: [
      { find: '#map-engine', replacement: mode.endsWith('engine-v5') ? '/src/lib/map/street/engine-v5.ts' : '/src/lib/map/street/engine-v6.ts' },
      { find: /^dexie$/, replacement: fileURLToPath(new URL('./node_modules/dexie/dist/modern/dexie.mjs', import.meta.url)) },
    ],
  },
  worker: { format: 'es' },
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
     Still nothing from terser's unsafe family.
     QA fix list (2026-11-07): `safari10: false`. Vite passes terser
     safari10: true by default — workarounds for Safari 10's bugs in mangling
     and loops, which cost bytes in every chunk. The app runs in Chrome and
     the Android WebView (ES2020 target, above); no Safari 10 ever loads it.
     Measured on the same code: initial 199.82 → 199.52 KB, all app JS
     284.18 → 283.76 KB. The gates are unchanged. */
  build: {
    outDir: android(mode) ? 'dist-android' : 'dist',
    minify: 'terser',
    terserOptions: { ecma: 2020, safari10: false, compress: { passes: 5, hoist_funs: true } },
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
        // The app is dark only (Horizon Run 4): the splash and the system
        // chrome take the night-indigo sky, app.css --sky
        // (lib/logic/theme.ts THEME_COLOR; theme.test.ts proves they agree).
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
}));
