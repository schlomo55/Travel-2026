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

class AppState {
  previewDate = $state<ISODate | null>(readPreviewParam());
  now = $state<ISODate>(localToday(readPreviewParam()));

  get previewing(): boolean {
    return this.previewDate !== null;
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
    });
  }

  refresh(): void {
    this.now = localToday(this.previewDate);
  }

  setPreview(d: ISODate | null): void {
    this.previewDate = d;
    const url = new URL(location.href);
    if (d) url.searchParams.set('d', d);
    else url.searchParams.delete('d');
    history.replaceState(history.state, '', url);
    this.refresh();
  }
}

export const appState = new AppState();
