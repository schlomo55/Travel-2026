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

  constructor(query: () => T | Promise<T>, opts?: LiveOpts<T>) {
    this.current = opts?.initial;
    $effect(() => {
      opts?.deps?.();
      const sub = liveQuery(query).subscribe({
        next: (v) => (this.current = v),
        error: (err) => console.error('liveQuery failed', err),
      });
      return () => sub.unsubscribe();
    });
  }
}

export function live<T>(query: () => T | Promise<T>, opts?: LiveOpts<T>): Live<T> {
  return new Live(query, opts);
}
