/* Horizon's three faces (Unbounded · Figtree · Martian Mono), latin-only
   and woff2-only — see the budget at the top of the file. */
import './horizon-fonts.css';
import './app.css';
import { Capacitor } from '@capacitor/core';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { setMutationHook } from './lib/data/repo';
import { exposeOAuthBridge, noteMutation } from './lib/data/drive';

/* Drive backup (opt-in). Both of these are inert until the owner has both
   filled in a client id AND connected: `noteMutation` returns on its first
   line with no timer and no Dexie read, and the bridge only ever listens.
   Nothing here reaches the network. */
setMutationHook(noteMutation);
exposeOAuthBridge();

/* The APK already carries every asset inside the app package, so a service
   worker there is a second, staler copy of the same files: after an app
   update the old worker keeps serving the old build and the app appears not
   to update at all. Native therefore registers NO worker and tears down any
   left by an earlier version (data in IndexedDB is untouched). The browser
   build keeps the worker — it is what makes the PWA work offline. */
if (Capacitor.isNativePlatform()) {
  void navigator.serviceWorker?.getRegistrations().then((rs) => {
    for (const r of rs) void r.unregister();
  });
  void caches?.keys().then((keys) => {
    for (const k of keys) void caches.delete(k);
  });
  document.getElementById('sw-update')?.remove();
  /* Reminders (the Reminders run): the scheduler and its plugin are their own
     chunk, read after the first paint, so a cold start pays nothing for them.
     They re-plan what Android should ring, then listen for changes. */
  setTimeout(() => {
    void import('./lib/platform/reminders').then((m) => m.startReminders()).catch(() => {});
  }, 2500);
  /* The launcher's long-press shortcuts (Now, Wallet, Map, To do) arrive as
     ltd://open/… URLs; their small router is read at once, not after 2.5 s,
     because the shortcut is why the app was opened. */
  void import('./lib/platform/shortcuts').then((m) => m.startShortcuts()).catch(() => {});
  /* The phone's Back steps back through the page itself (see backbutton.ts:
     the WebView's own step skipped entries and froze Back on a dirty form). */
  void import('./lib/platform/backbutton').then((m) => m.startBackButton()).catch(() => {});
} else {
  /* THE BANNER IS NOW A STATE, NOT A CLASS SOMEONE ADDS. Three things decide
     whether it shows: an update really is waiting, it has not been dismissed
     this session, and the phone is ONLINE — "tap to reload" behind the
     Firewall on 8 % battery is the scariest instruction this app could give,
     and a reload with no network is a reload into nothing. */
  const banner = document.getElementById('sw-update');
  const DISMISSED = 'ltd:sw-dismissed';
  let waiting = false;
  const paint = (): void => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISSED) === '1';
    } catch {
      /* private mode — treat as not dismissed */
    }
    banner?.classList.toggle('show', waiting && !dismissed && navigator.onLine !== false);
  };
  const updateSW = registerSW({
    onNeedRefresh() {
      waiting = true;
      paint();
    },
    onOfflineReady() {
      console.info('Living the dream: precached — ready for airplane mode');
    },
  });
  document.getElementById('sw-reload')?.addEventListener('click', () => updateSW(true));
  document.getElementById('sw-dismiss')?.addEventListener('click', () => {
    try {
      sessionStorage.setItem(DISMISSED, '1');
    } catch {
      /* nothing to remember it with — it still hides for now */
    }
    waiting = false;
    paint();
  });
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);
}

mount(App, { target: document.getElementById('app')! });
