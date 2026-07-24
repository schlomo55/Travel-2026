import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './app.css';
import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

const updateSW = registerSW({
  onNeedRefresh() {
    document.getElementById('sw-update')?.classList.add('show');
  },
  onOfflineReady() {
    console.info('Living the dream: precached — ready for airplane mode');
  },
});
document.getElementById('sw-update')?.addEventListener('click', () => updateSW(true));

mount(App, { target: document.getElementById('app')! });
