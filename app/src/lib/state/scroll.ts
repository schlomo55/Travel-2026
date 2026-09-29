/* WHERE A SCREEN OPENS (Map 5d) — at its top when you step forward to it,
   where you left it when you step back.

   Until Map 5c a route change flashed "Loading…" for a moment (a live query
   re-subscribed on every hash change); the page went short and the browser
   put the scroll back to 0 as a side effect — the only reset most screens had
   (Pocket and a city did their own). Map 5c ended the flash, and with it the
   reset: scrolled down Now, Journey opened at Now's offset. So this is said
   once, for the whole app:

   · FORWARD (a link, a tap, a redirect: router.nav 'push' / 'replace') — the
     new screen starts at its top.
   · BACK ('pop') — the screen comes back at the offset it had when it was
     left. The browser's own restoration is switched off
     (`history.scrollRestoration = 'manual'`): it runs at `popstate`, before
     the app has drawn the screen it is going back to, and clamps the offset
     to the height of the screen still on show. The offsets are kept here,
     per history entry (router.entry), as the page scrolls.
   · A city and its guide keep their own rule (routes/Stop.svelte, Run 3c): a
     city opens at its top; the guide reopens where it was left when back
     brings you to it from a pass, and lands on a chapter asked for.

   The app starting ('load') is left alone. */
import type { Route } from '../logic/routes';
import { router } from './router.svelte';

/** the offset each history entry's screen had, by its index in the session */
const offsets = new Map<number, number>();
/** the entry whose screen is on show — scrolls are its */
let shown: number | null = null;
/** one number per screen change, so a restore still under way stops when another begins */
let turn = 0;

/** A screen that places its own scroll: a city and its guide. */
export const ownsScroll = (r: Route): boolean => r.name === 'trip' && r.place === 'journey' && !!r.sub;

export function startScrollMemory(): void {
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  shown = router.entry;
  window.addEventListener(
    'scroll',
    () => {
      if (shown !== null) offsets.set(shown, window.scrollY);
    },
    { passive: true },
  );
}

/** A screen came on (App.svelte, on every change of address). */
export function screenShown(r: Route): void {
  const kind = router.nav;
  const i = router.entry;
  const back = offsets.get(i) ?? 0;
  shown = i;
  const mine = ++turn;
  if (ownsScroll(r) || kind === 'load') return;
  if (kind !== 'pop') {
    window.scrollTo(0, 0);
    return;
  }
  /* back: as far as the page reaches now, then again as the screen fills in
     (a lazy screen, the trip's first answer) — for at most ~40 frames */
  window.scrollTo(0, back);
  let frames = 0;
  const again = (): void => {
    if (mine !== turn || frames++ > 40) return;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(window.scrollY - back) <= 1) return;
    if (room >= back - 1) window.scrollTo(0, back);
    else requestAnimationFrame(again);
  };
  requestAnimationFrame(again);
}
