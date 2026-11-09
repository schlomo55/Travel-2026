<script lang="ts">
  /* THE PASS (f-pass) — loaded when a pass is first opened (10 Nov 2026).

     The pass itself is PassView.svelte. It used to be part of the start-up
     JavaScript, and that bundle is at its 200 KB gate (scripts/check-bundle.mjs):
     a pass is opened a few times a trip, so its chunk is read the first time
     one is (lib/state/lazy.ts — no network: one of the app's own files, from
     the service worker's precache or the APK's assets), and a cold start no
     longer parses it. Props pass straight through; `#bk-<id>` and every class
     inside are the view's own.

     The code strip and Counter mode live in the view, so a chunk that could
     not be read says so, in words, and is asked for again next time. */
  import type { ComponentProps } from 'svelte';
  import type PassView from './PassView.svelte';
  import { once } from '../../state/lazy';
  import { S } from '../../i18n/strings';

  const view = once(() => import('./PassView.svelte').then((m) => m.default));
  let props: ComponentProps<typeof PassView> = $props();
</script>

{#await view()}
  <p class="lazywait" role="status">{S.misc.opening}</p>
{:then Screen}
  <Screen {...props} />
{:catch}
  <p class="lazywait fail" role="alert">{S.misc.openFailed}</p>
{/await}
