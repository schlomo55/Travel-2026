/* The failure half of the liveQuery bridge, kept pure so it can be tested.

   `lib/data/live.svelte.ts` used to answer a broken database with a
   console.error and nothing else: `current` stayed undefined, every screen
   resolved it through `?? []`, and an evicted or quota-blocked IndexedDB
   rendered a calm, plausible, entirely EMPTY trip — no bookings, no tasks, no
   bed, said in exactly the voice the truth is said in. These two functions are
   what turns that silence into a state a screen can render. */

/** A readable one-liner for anything a rejected liveQuery can hand back.
    Never throws, never returns an empty string, never returns null for a real
    error — "something failed and we cannot name it" is still a failure. */
export function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object') {
    const name = (err as { name?: unknown }).name;
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return 'Unknown database error';
}

/** The first table that is in an error state, or null when every one of them
    is healthy. One broken table is enough to make the whole screen a lie, so
    the shell asks this once and shouts once. */
export function firstError(errors: readonly (string | null | undefined)[]): string | null {
  for (const e of errors) {
    if (typeof e === 'string' && e.length > 0) return e;
  }
  return null;
}
