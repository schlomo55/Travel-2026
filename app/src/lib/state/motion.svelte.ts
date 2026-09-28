/* WHETHER THINGS MAY MOVE, as state a screen can read (Run 3c).

   App.svelte decides the motion classes on <html> (logic/motion.ts:
   `calm`, `no-routes`, `app-hidden`) and hands the same answer here; the
   phone's own reduce-motion is watched here. CSS already takes every motion
   to its end state under them — this is for what CSS cannot reach: a
   control whose only job is to move a route (the city's ↻ replay) is not
   offered when routes may not move, and a scroll the script starts is not
   smooth when motion is calm. */
class Motion {
  classes = $state<readonly string[]>([]);
  reduced = $state(false);
  /** The settings have been read, so `classes` is the real answer — a
      motion that runs by itself on arrival (the city's first replay) waits
      for this, or Calm motion would be decided before it is known. */
  known = $state(false);

  constructor() {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = mq.matches;
    mq.addEventListener('change', (e) => (this.reduced = e.matches));
  }

  /** Route motions (Flow, Comet, Ink, Relay) may run. */
  get routes(): boolean {
    return !this.reduced && !this.classes.includes('no-routes');
  }
  /** Every motion jumps to its end (Calm motion, or the phone's reduce-motion). */
  get calm(): boolean {
    return this.reduced || this.classes.includes('calm');
  }
}

export const motion = new Motion();
