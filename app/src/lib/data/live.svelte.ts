/* The one bridge between Dexie liveQuery and Svelte 5 runes.
   Usage (inside component init): const trips = live(() => db.trips.toArray());
   … then read trips.current. Any DB write anywhere re-renders every reader. */
import { liveQuery } from 'dexie';

export interface LiveOpts<T> {
  initial?: T;
  /** Reactive reads made here re-subscribe the query when they change
      (Dexie only re-runs on DB writes; route/param changes need this). */
  deps?: () => unknown;
}

export class Live<T> {
  current = $state<T | undefined>(undefined);
  /** False until the first result arrives — lets callers tell "still loading"
      from "loaded, and the record isn't there" (Dexie returns undefined for both). */
  loaded = $state(false);

  constructor(query: () => T | Promise<T>, opts?: LiveOpts<T>) {
    this.current = opts?.initial;
    $effect(() => {
      opts?.deps?.();
      this.loaded = false;
      const sub = liveQuery(query).subscribe({
        next: (v) => {
          this.current = v;
          this.loaded = true;
        },
        error: (err) => console.error('liveQuery failed', err),
      });
      return () => sub.unsubscribe();
    });
  }
}

export function live<T>(query: () => T | Promise<T>, opts?: LiveOpts<T>): Live<T> {
  return new Live(query, opts);
}
