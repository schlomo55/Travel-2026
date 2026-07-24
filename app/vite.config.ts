import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        background_color: '#fafaf9',
        theme_color: '#fafaf9',
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
