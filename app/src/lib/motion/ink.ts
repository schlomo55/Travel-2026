/* INK, ON THIS PHONE — once means once (logic/motion.ts decides; this only
   remembers). The last key inked lives in localStorage beside the theme: a
   per-device memory of what the eye has already seen, never trip data. */
import { inkDue, type InkStep } from '../logic/motion';

const KEY = 'ltd:ink';

/** True when `key` has not been inked on this phone yet — and from now on it
    has. Never throws: with no storage, nothing inks (the painted end state). */
export function inkOnce(key: string): boolean {
  try {
    if (!inkDue(localStorage.getItem(KEY), key)) return false;
    localStorage.setItem(KEY, key);
    return true;
  } catch {
    return false;
  }
}

/** The two custom properties the `.ink` / `.bloom` classes pace themselves by. */
export const inkVars = (s: InkStep | undefined): string => (s ? `--ink-d:${s.delay}ms;--ink-t:${s.dur}ms` : '');
