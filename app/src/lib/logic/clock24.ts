/* A CLOCK TIME AS THE TRAVELLER TYPES IT — always 24-hour. The phone's own
   <input type="time"> follows its locale, and on a 12-hour phone "20:00" typed
   in became "02:00 --" with an AM/PM still to pick (found on the owner's S23,
   setting a ticket's book-by). Every time field in the app goes through
   ui/TimeField.svelte, which reads the text with this and never shows AM/PM.

   Accepted: "20:00", "2000", "20.00", "20h00", "8:5" → 08:05, "800" → 08:00,
   "20" → 20:00, "8" → 08:00. Empty → ''. Anything else → null (refused, the
   field keeps what was typed and says so). Pure. */
import type { HHMM } from '../model/types';

const pad = (n: number): string => String(n).padStart(2, '0');

export function parseClock24(text: string): HHMM | '' | null {
  const t = text.trim();
  if (!t) return '';
  let h: number;
  let m: number;
  const sep = /^(\d{1,2})\s*[:.h]\s*(\d{1,2})$/i.exec(t);
  if (sep) {
    h = Number(sep[1]);
    m = Number(sep[2]);
  } else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) {
      h = Number(t);
      m = 0;
    } else {
      h = Number(t.slice(0, t.length - 2));
      m = Number(t.slice(-2));
    }
  } else return null;
  if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) return null;
  return `${pad(h)}:${pad(m)}` as HHMM;
}

/** While typing, the colon goes in only once it cannot be wrong: "2000" →
    "20:00", and "93" → "9:3" → "9:30" because no hour is 93. "200" or "130"
    could still go either way, so they stay digits until a fourth one comes or
    the field is left (parseClock24 then reads them as H:MM: 02:00, 01:30).
    Anything with a separator or a letter is left alone. Never more than "HH:MM". */
export function shapeClock24(text: string): string {
  if (!/^\d+$/.test(text)) return text.slice(0, 5);
  const d = text.slice(0, 4);
  const twoDigitHour = Number(d.slice(0, 2)) <= 23;
  if (d.length >= 2 && !twoDigitHour) return `${d[0]}:${d.slice(1, 3)}`;
  return d.length === 4 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
