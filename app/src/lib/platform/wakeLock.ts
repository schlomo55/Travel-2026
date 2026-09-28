/* HOLD THE SCREEN AWAKE while something is being shown to someone else —
   Counter mode at a desk, the driver card across a taxi seat. A screen that
   dims while a stranger is reading it is a screen they stop reading.

   The browser releases a wake lock whenever the page is hidden, so it is
   asked for again each time the app comes back into view. Denied or
   unsupported is not an error: the card still works, it just may dim.
   Returns the release function; call it when the card closes. */
export function holdScreenAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let released = false;

  const acquire = async (): Promise<void> => {
    if (released || document.hidden) return;
    try {
      const next = (await navigator.wakeLock?.request('screen')) ?? null;
      if (released) void next?.release();
      else lock = next;
    } catch {
      /* denied or unsupported — nothing to hold */
    }
  };
  const onVisible = (): void => {
    if (!document.hidden) void acquire();
  };

  void acquire();
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisible);
    try {
      void lock?.release();
    } catch {
      /* already gone */
    }
    lock = null;
  };
}
