/* LAZY SCREENS (Horizon Run 3c). A screen opened a few times a trip —
   Settings, Backup, the trip wizard, the import sheet — is not parsed on
   every cold start: its chunk is imported the first time it is shown. Vite
   splits it out, and the bundle gate (scripts/check-bundle.mjs) counts it in
   the app's total but not in the initial load.

   No network is involved: a chunk is one of the app's own files, read from
   the APK's assets or the service worker's precache like every other one.
   The import is asked for ONCE and its promise kept, so the second opening
   draws at once — {#await} skips its waiting state for a promise that has
   already settled. A chunk that could not be read is asked for again the
   next time (the promise is dropped), and the screen says so meanwhile. */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () =>
    (p ??= load().catch((e: unknown) => {
      p = undefined;
      throw e;
    }));
}
