/* ONE MINUTE HAND for the countdowns outside Now's day view (the pass, the
   Pocket's TODAY card). Minute granularity and nothing finer — seconds would
   tick sixty times a minute on a phone at 8 % battery to say nothing new.

   It only runs while something is watching it AND the screen is awake: a
   component calls `watch()` in an $effect and the returned function stops it.
   Coming back into view catches up in one step. */
class MinuteHand {
  t = $state(Date.now());
  private watchers = 0;
  private id: ReturnType<typeof setInterval> | null = null;

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private start(): void {
    this.stop();
    this.t = Date.now();
    this.id = setInterval(() => (this.t = Date.now()), 60_000);
  }

  private stop(): void {
    if (this.id !== null) clearInterval(this.id);
    this.id = null;
  }

  watch(): () => void {
    if (this.watchers++ === 0) {
      this.start();
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    return () => {
      if (--this.watchers === 0) {
        this.stop();
        document.removeEventListener('visibilitychange', this.onVisibility);
      }
    };
  }
}

export const minute = new MinuteHand();
