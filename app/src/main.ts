import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './app.css';
import { Capacitor } from '@capacitor/core';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

/* In the APK, updates arrive as app installs — the service-worker "update
   ready" prompt is meaningless there and its button used to sit under the
   floating tab bar. Native: apply silently. Web (PWA): keep the prompt. */
const native = Capacitor.isNativePlatform();
const updateSW = registerSW({
  onNeedRefresh() {
    if (native) void updateSW(true);
    else document.getElementById('sw-update')?.classList.add('show');
  },
  onOfflineReady() {
    console.info('Living the dream: precached — ready for airplane mode');
  },
});
document.getElementById('sw-update')?.addEventListener('click', () => updateSW(true));

mount(App, { target: document.getElementById('app')! });
