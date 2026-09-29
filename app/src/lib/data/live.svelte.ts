/* The one bridge between Dexie liveQuery and Svelte 5 runes.
   Usage (inside component init): const trips = live(() => db.trips.toArray());
   … then read trips.current. Any DB write anywhere re-renders every reader. */
import { liveQuery } from 'dexie';
import { errorText } from '../logic/liveError';

export interface LiveOpts<T> {
  initial?: T;
  /** Reactive reads made here re-subscribe the query when they change
      (Dexie only re-runs on DB writes; route/param changes need this). */
  deps?: () => unknown;
}

export class Live<T> {
  /* RAW, NOT DEEP (Run 4). A query's answer is only ever replaced whole —
     Dexie hands over new arrays of new objects on every change, and nothing
     writes into them in place (writes go to the database, through plain()) —
     so a deep proxy bought nothing but a trap on every property the day's
     logic reads: the map, the metro line, the sentence all walk these arrays.
     Reassigning `current` is still what re-renders every reader. */
  current = $state.raw<T | undefined>(undefined);
  /** False until the first result arrives — lets callers tell "still loading"
      from "loaded, and the record isn't there" (Dexie returns undefined for both). */
  loaded = $state(false);
  /** THE FAILURE HAS TO BE A STATE, NOT A CONSOLE LINE. A liveQuery that
      throws used to leave `current` undefined, every screen resolved it
      through `?? []`, and a broken database rendered a calm, believable,
      entirely empty trip — "nothing is booked tonight" said in the same voice
      as the truth. The error is kept here so the shell can say so out loud. */
  error = $state<string | null>(null);

  constructor(query: () => T | Promise<T>, opts?: LiveOpts<T>) {
    this.current = opts?.initial;
    $effect(() => {
      opts?.deps?.();
      this.loaded = false;
      this.error = null;
      const sub = liveQuery(query).subscribe({
        next: (v) => {
          this.current = v;
          this.loaded = true;
          this.error = null;
        },
        error: (err) => {
          console.error('liveQuery failed', err);
          this.error = errorText(err);
        },
      });
      return () => sub.unsubscribe();
    });
  }
}

export function live<T>(query: () => T | Promise<T>, opts?: LiveOpts<T>): Live<T> {
  return new Live(query, opts);
}
