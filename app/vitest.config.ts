/* The unit suite runs in node, over the pure modules in lib/logic and the
   Dexie repos in lib/data.

   THE SVELTE PLUGIN IS HERE FOR THE `.svelte.ts` MODULES, not for components.
   `lib/state/*.svelte.ts` hold runes at module scope (`toast.svelte.ts`
   instantiates its class on import), and `lib/data/repo.ts` imports the toast
   so a failed write is never silent. Without the plugin the first test that
   reaches a repo dies on `$state is not defined` — which is how the pick /
   un-pick round-trip could not be tested against the real database at all.
   `svelte()` compiles `.svelte.js|ts` through its module transform, so those
   files behave in a test exactly as they do in the app. */
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
