/* The one bridge between Dexie liveQuery and Svelte 5 runes.
   Usage (inside component init): const trips = live(() => db.trips.toArray());
   … then read trips.current. Any DB write anywhere re-renders every reader. */
import { liveQuery } from 'dexie';

export class Live<T> {
  current = $state<T | undefined>(undefined);

  constructor(query: () => T | Promise<T>, initial?: T) {
    this.current = initial;
    $effect(() => {
      const sub = liveQuery(query).subscribe({
        next: (v) => (this.current = v),
        error: (err) => console.error('liveQuery failed', err),
      });
      return () => sub.unsubscribe();
    });
  }
}

export function live<T>(query: () => T | Promise<T>, initial?: T): Live<T> {
  return new Live(query, initial);
}
