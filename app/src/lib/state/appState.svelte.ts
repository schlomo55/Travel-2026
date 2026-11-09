/* The app's clock. `now` is the single source of "what day is it" for every
   screen — either the real local date (re-armed at midnight +5 s, refreshed on
   visibilitychange) or the ?d=YYYY-MM-DD preview date, exactly like the legacy
   app's best QA tool. */
import type { ISODate } from '../model/types';
import { isIsoDate, localToday } from '../logic/dates';

function readPreviewParam(): ISODate | null {
  if (typeof location === 'undefined') return null;
  const d = new URLSearchParams(location.search).get('d');
  return d && isIsoDate(d) ? d : null;
}

function readOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

class AppState {
  previewDate = $state<ISODate | null>(readPreviewParam());
  now = $state<ISODate>(localToday(readPreviewParam()));
  /* BEING OFFLINE IS NORMAL ON THIS TRIP, and it was completely invisible: the
     screen was pixel-identical with the network gone, so a dead "Find email"
     tab could be the phone, the Firewall or the app. It is a quiet chip, not a
     warning — the app works offline by design; it just says which it is. */
  online = $state<boolean>(readOnline());
  /* A PREVIEW OPENED FROM FIND BELONGS TO THAT VISIT. It remembers the session
     entry Find was on (the router's history.state.i) and ends when a step back
     reaches it; null for the user's own (Settings, ?d=), which only the strip
     ends. Plain, not $state: nothing draws from it. */
  private floor: number | null = null;

  get previewing(): boolean {
    return this.previewDate !== null;
  }
  get offline(): boolean {
    return !this.online;
  }

  start(): void {
    const arm = (): void => {
      const t = new Date();
      const next = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 5);
      setTimeout(() => {
        this.refresh();
        arm();
      }, next.getTime() - t.getTime());
    };
    arm();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh();
      this.online = readOnline();
    });
    window.addEventListener('online', () => (this.online = true));
    window.addEventListener('offline', () => (this.online = false));
    /* a step back onto the entry Find was on ends the preview that visit made
       (Android back and the header ‹ are both history.back()) */
    window.addEventListener('popstate', (e) => {
      if (this.floor !== null && (e.state?.i ?? Infinity) <= this.floor) this.setPreview(null);
    });
  }

  refresh(): void {
    this.now = localToday(this.previewDate);
  }

  /** Preview `d` (null ends it). With no `visitFrom` it is the user's own
      (Settings, the strip, ?d=): it stays across screens until the strip ends it. */
  setPreview(d: ISODate | null, visitFrom: number | null = null): void {
    this.previewDate = d;
    this.floor = d ? visitFrom : null;
    const url = new URL(location.href);
    if (d) url.searchParams.set('d', d);
    else url.searchParams.delete('d');
    history.replaceState(history.state, '', url);
    this.refresh();
  }

  /** The day view's ‹ › and long jump: another date, the same kind of preview. */
  movePreview(d: ISODate | null): void {
    this.setPreview(d, this.floor);
  }

  /** A day opened from Find, from the session entry `at`: previewed for this
      visit only. A preview already chosen (Settings, ?d=) stays the user's. */
  previewFromFind(d: ISODate | null, at: number): void {
    this.setPreview(d, this.previewDate && this.floor === null ? null : at);
  }
}

export const appState = new AppState();
