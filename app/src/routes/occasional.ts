/* THE SCREENS OPENED NOW AND THEN, AS ONE LAZY CHUNK (10 Nov 2026).
   Settings, Backup, the trip wizard and the import sheet are opened a few
   times a trip (or a year) and never at a cold start, so they are lazy
   (lib/state/lazy.ts). Each used to be a chunk of its own; every lazy chunk
   costs bytes of its own — its imports from the start-up chunk by name, and
   a gzip stream that starts cold — and none of the four is on the road
   (Settings and Backup are full screens of their own, the wizard and the
   import sheets of the Trips shelf and Backup). Imported from here, Vite builds them as
   one chunk: the first of them to open reads all four from the app's own
   files (no network), and the next opens at once. Measured on the same code:
   all app JS −2.44 KB; the initial load unchanged (scripts/check-bundle.mjs).
   Import a screen from here only with import() — a static import would put
   all four into the start-up chunk. */
export { default as Settings } from './Settings.svelte';
export { default as Backup } from './Backup.svelte';
export { default as TripWizard } from './TripWizard.svelte';
export { default as ImportSheet } from './ImportSheet.svelte';
