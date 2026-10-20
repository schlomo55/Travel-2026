/* EVERY DATE AND TIME FIELD SPEAKS THE APP'S FORMAT. The phone's own
   <input type="date"> shows the date in the phone's locale (11/29/2026 on the
   owner's S23) and <input type="time"> asked for AM/PM, so every screen goes
   through ui/DateField ("Sun 29 Nov 2026") and ui/TimeField (24-hour). Read
   from the source: a new raw date or time input anywhere else fails here. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '..');
const svelteFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'tests' ? [] : svelteFiles(p);
    return n.endsWith('.svelte') ? [p] : [];
  });

describe('date and time fields', () => {
  it('no screen uses the phone’s own date or time input but DateField', () => {
    const raw = svelteFiles(src)
      .filter((p) => !p.endsWith('DateField.svelte'))
      .filter((p) => {
        const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
        return /type="(date|time|datetime-local)"/.test(code);
      })
      .map((p) => relative(src, p));
    expect(raw).toEqual([]);
  });
});
