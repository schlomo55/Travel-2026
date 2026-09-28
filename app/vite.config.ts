import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  /* TERSER, NOT ESBUILD, MINIFIES THE BUILD (Horizon Run 2). The bundle gate
     (scripts/check-bundle.mjs: 200 KB of gzipped JS the page loads) is
     unchanged; what changed is how small the same code ships. On this
     codebase — Svelte 5's compiled templates above all — terser's output
     gzips about 8 % smaller than esbuild's (209.43 → 192.66 KB at the end
     of Run 2, 2026-09-28).
     terser is not a new dependency: it is already installed with vite and
     workbox-build (see package-lock.json). Two compress passes; nothing
     unsafe (no unsafe-* options, property names are never mangled). */
  build: { minify: 'terser', terserOptions: { compress: { passes: 2 } } },
  plugins: [
    svelte(),
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
