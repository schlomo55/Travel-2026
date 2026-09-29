/* The unit suite runs in node, over the pure modules in lib/logic and the
   Dexie repos in lib/data.

   THE SVELTE PLUGIN IS HERE FOR THE `.svelte.ts` MODULES, not for components.
   `lib/state/*.svelte.ts` hold runes at module scope (`toast.svelte.ts`
   instantiates its class on import), and `lib/data/repo.ts` imports the toast
   so a failed write is never silent. Without the plugin the first test that
   reaches a repo dies on `$state is not defined` — which is how the pick /
   un-pick round-trip could not be tested against the real database at all.
   `svelte()` compiles `.svelte.js|ts` through its module transform, so those
   files behave in a test exactly as they do in the app.

   `#map-engine` resolves as the app's build resolves it (vite.config.ts), so
   a test can put a stand-in engine in its place (streetmap.test.ts, Map 5d). */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { '#map-engine': fileURLToPath(new URL('./src/lib/map/street/engine-v6.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
