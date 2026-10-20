/* THE PHONE'S BACK BUTTON (Android app only). Left to Capacitor, Back asks
   the WebView to go back, and the WebView skips every history entry a page
   added without a tap (Chrome's history intervention). The entry the router
   puts back when a form with unsaved changes refuses to close (router.onPop)
   is one: after "Unsaved changes. Press back again to discard them." the
   WebView answered canGoBack false and Back did nothing at all, however
   often it was pressed; only ✕ could leave the form (found on the owner's
   S23, 2026-10-20). So Back is now the page's own step back, which nothing
   skips — exactly what ✕ does — and with nothing behind it the app goes to
   the background, as Android's own Back does at the first screen.

   Its own small chunk, read right after start-up and only inside the
   Android app. */
import { router } from '../state/router.svelte';
import { isNative } from './files';

/** One press of Back from this entry of the session (`router.entry`) with
    this many sheets open: a step back, or out of the app. */
export function backAction(entry: number, layers: number): 'back' | 'leave' {
  return entry > 0 || layers > 0 ? 'back' : 'leave';
}

let started = false;

export async function startBackButton(): Promise<void> {
  if (started || !isNative()) return;
  started = true;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (backAction(router.entry, router.layerDepth) === 'back') history.back();
    else void App.minimizeApp();
  });
}
