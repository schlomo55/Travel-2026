<script lang="ts">
  /* THE NAV (system/components/NavBar): ONE solid bar on the bottom edge with
     five equal items — Now, Journey, Map, Pocket and Find (the Map since Map
     5c, map4-map; Find used to be a round button beside a floating pill). Every
     item is a real link to its place; the current one is sunrise with a 4 px
     sun under its label, and carries aria-current. Shown everywhere in a trip
     except the full-screen modes, which are layers drawn above it.

     The bar is opaque (--chrome) with a hairline on top, so no page text ever
     shows through it, and it takes --nav-bar-h of the screen (+ the safe-area
     inset) — the rest is the page's. app.css's --nav-h is what content clears. */
  import type { Place } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import { keyboardStep, type KeyboardWatch } from '../../logic/keyboard';
  import Icon from './Icon.svelte';

  let { tripId, active }: { tripId: string; active: Place | null } = $props();

  /* Find's word is the first word of its name ("Find anything" is the name a
     screen reader hears); its link keeps the class `findbtn`, which App.svelte
     reads to raise the keyboard with the tap */
  const items: { place: Place; icon: string; label: string }[] = [
    { place: 'now', icon: 'sun', label: S.nav.now },
    { place: 'journey', icon: 'route', label: S.nav.journey },
    { place: 'map', icon: 'map', label: S.nav.map },
    { place: 'pocket', icon: 'pouch', label: S.nav.pocket },
    { place: 'find', icon: 'search', label: S.nav.find.replace(/\s.*$/, '') },
  ];
  const href = (p: Place): string => `#/trip/${encodeURIComponent(tripId)}/${p}`;

  /* BACK CLOSES THE KEYBOARD BUT NOT THE FIELD (QA 10 Nov 2026): the hide rule
     below keys on the focus, so the bar stayed gone until a tap on blank space.
     When the page grows back from the keyboard's height (logic/keyboard.ts) the
     field that kept the focus lets go. Only on that one step: not while the
     keyboard opens or stays up, not for a field that never raised it (a date or
     time picker, a checkbox), and a desktop window never loses the height. */
  const TEXT =
    "input:not([type='checkbox'],[type='radio'],[type='button'],[type='submit'],[type='range'],[type='file'],[type='date'],[type='time'],[readonly]),textarea:not([readonly])";
  $effect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const size = (): number => vv.height * vv.scale;
    let w: KeyboardWatch = { full: size(), open: false };
    const onResize = (): void => {
      const r = keyboardStep(w, size());
      w = r.w;
      const el = document.activeElement;
      if (r.closed && el instanceof HTMLElement && el.matches(TEXT)) el.blur();
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  });
</script>

<nav class="navbar" class:fade={active !== 'map'} aria-label={S.nav.label}>
  {#each items as it (it.place)}
    <a
      class="navitem"
      class:on={active === it.place}
      class:findbtn={it.place === 'find'}
      href={href(it.place)}
      data-place={it.place}
      aria-label={it.place === 'find' ? S.nav.find : undefined}
      aria-current={active === it.place ? 'page' : undefined}
    >
      <Icon name={it.icon} size={22} />
      <span class="lb">{it.label}</span>
      <span class="sundot" aria-hidden="true"></span>
    </a>
  {/each}
</nav>
<i class="navfade" aria-hidden="true"></i>

<style>
  .navbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    display: flex;
    align-items: stretch;
    gap: 2px;
    height: calc(var(--nav-bar-h) + env(safe-area-inset-bottom));
    padding: 4px 4px env(safe-area-inset-bottom);
    background: var(--chrome);
    border-top: 1px solid var(--line);
  }
  /* What scrolls toward the bar fades into the sky instead of ending in a hard
     line: its own element beside the bar, a short non-interactive layer just
     above it (under the bar's 60, over the page; the page's sticky focus card
     and a city's "Read the guide" clear it by their own offsets). Not on the
     Map, whose street map runs to the edge. */
  .navfade {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-bar-h) + env(safe-area-inset-bottom));
    height: var(--nav-fade-h);
    z-index: 59;
    pointer-events: none;
    background: linear-gradient(rgba(11, 12, 22, 0), var(--sky));
  }
  .navbar:not(.fade) + .navfade {
    display: none;
  }
  /* THE KEYBOARD IS UP: the bar steps aside (QA 9 Nov 2026 — it sat on top of
     the keyboard, over the expense form's fields). A WebView resizes to the
     keyboard, so the viewport cannot tell; the focus can — a field that types
     text has it — and lets go of it when Back closes the keyboard (the
     effect above). */
  :global(body:has(input:focus:not([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='range'], [readonly]), textarea:focus:not([readonly]), [contenteditable='true']:focus))
    :is(.navbar, .navfade) {
    display: none;
  }
  /* on a wide screen the bar spans the window but its five items keep the
     phone's proportions, centred */
  @media (min-width: 560px) {
    .navbar {
      padding-left: calc(50% - 206px + 4px);
      padding-right: calc(50% - 206px + 4px);
    }
  }
  .navitem {
    flex: 1 1 0;
    min-width: 0;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 18px;
    text-decoration: none;
    color: var(--ink-2);
  }
  /* the bar sits on the screen's edge: the ring goes inside the item */
  .navitem:focus-visible {
    outline-offset: -4px;
  }
  .lb {
    font-size: var(--fs-caps);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
  }
  .sundot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
  }
  .navitem.on {
    color: var(--sunrise);
    background: var(--sunrise-soft);
  }
  .navitem.on :global(.hicon) {
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.7));
  }
  .navitem.on .sundot {
    background: var(--sunrise-fill);
    box-shadow: 0 0 8px var(--sunrise-fill);
  }
</style>
