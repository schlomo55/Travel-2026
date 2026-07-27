import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
/* Lantern's guide faces: typewriter body + handwritten city titles. */
import './lantern-fonts.css';
import './app.css';
import { Capacitor } from '@capacitor/core';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

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
} else {
  const updateSW = registerSW({
    onNeedRefresh() {
      document.getElementById('sw-update')?.classList.add('show');
    },
    onOfflineReady() {
      console.info('Living the dream: precached — ready for airplane mode');
    },
  });
  document.getElementById('sw-update')?.addEventListener('click', () => updateSW(true));
}

mount(App, { target: document.getElementById('app')! });
