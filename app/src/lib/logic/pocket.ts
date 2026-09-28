/* THE POCKET HOME, AS DATA — what each tile says, decided from the trip file
   alone. A tile with nothing to say is not drawn (GlanceTile README: "a tile
   with nothing to say is not shown"), so every function here returns null or
   an empty list rather than a zero or a placeholder. */
import type { ComplianceCounter, DocumentFile, EmergencyContact, ISODate, ShowCard } from '../model/types';
import { counterState } from './counters';
import { fmtShort } from './dates';
import { splitWarning } from './pass';

/** "PDF + 10 photos" — what the Documents tile says the vault holds. */
export function docsSummary(docs: Pick<DocumentFile, 'mime' | 'tag'>[]): string | null {
  if (!docs.length) return null;
  const photos = docs.filter((d) => d.tag === 'photo').length;
  const files = docs.filter((d) => d.tag !== 'photo');
  const pdf = files.filter((d) => d.mime === 'application/pdf').length;
  const images = files.filter((d) => d.mime.startsWith('image/')).length;
  const other = files.length - pdf - images;
  const parts: string[] = [];
  if (pdf) parts.push(pdf === 1 ? 'PDF' : `${pdf} PDFs`);
  if (images) parts.push(`${images} ${images === 1 ? 'image' : 'images'}`);
  if (other) parts.push(`${other} ${other === 1 ? 'file' : 'files'}`);
  if (photos) parts.push(`${photos} ${photos === 1 ? 'photo' : 'photos'}`);
  return parts.join(' + ');
}

/** The numbers the Emergency tile shows in its two short lines — the short
    public ones (110 · 120 / 119 · 999) — and how many longer ones follow.
    Only dialable numbers; a pending or text line is never shown as one. */
export function emergencyPreview(contacts: EmergencyContact[]): { lines: string[]; more: number } | null {
  const phones = [...contacts]
    .filter((c) => c.kind === 'phone' && !c.pending)
    .sort((a, b) => a.order - b.order);
  if (!phones.length) return null;
  const short = phones.filter((c) => c.value.replace(/\D/g, '').length <= 4).slice(0, 4);
  const shown = short.length ? short : phones.slice(0, 1);
  const lines: string[] = [];
  for (let i = 0; i < shown.length; i += 2) {
    lines.push(
      shown
        .slice(i, i + 2)
        .map((c) => c.value)
        .join(' · '),
    );
  }
  return { lines, more: phones.length - shown.length };
}

/**
 * THE THREE CHIPS UNDER "SHOW THE DRIVER". Today's own places first, in the
 * day's order (DayPlan.placeIds — the explicit join, never a text match),
 * then the rest of the trip's cards in their order, until there are three.
 * Never a pending card, and NEVER a card that carries its own ⚠️: a place
 * you must not be taken to does not belong one tap from a taxi driver.
 */
export function driverChips(cards: ShowCard[], todayPlaceIds: string[] | undefined, n = 3): ShowCard[] {
  const usable = cards
    .filter((c) => c.kind === 'place' && !c.pending && !splitWarning(c.meaning).warning)
    .sort((a, b) => a.order - b.order);
  const byId = new Map(usable.map((c) => [c.id, c]));
  const out: ShowCard[] = [];
  for (const id of todayPlaceIds ?? []) {
    const c = byId.get(id);
    if (c && !out.includes(c)) out.push(c);
    if (out.length === n) return out;
  }
  for (const c of usable) {
    if (!out.includes(c)) out.push(c);
    if (out.length === n) break;
  }
  return out;
}

/** The visa tile: day of limit, how far through, and the date to be out by. */
export interface VisaPreview {
  name: string;
  value: string;
  pct: number;
  line: string;
  tone: '' | 'warn' | 'crit';
}
export function visaPreview(c: ComplianceCounter | undefined, now: ISODate): VisaPreview | null {
  if (!c) return null;
  const st = counterState(c, now);
  const exit = c.hardDeadline ? `Exit by ${fmtShort(c.hardDeadline)}` : '';
  switch (st.phase) {
    case 'before':
      return { name: c.name, value: `0/${st.limitDays}`, pct: 0, line: `Starts ${fmtShort(c.startDate)}`, tone: '' };
    case 'entryDay':
      return { name: c.name, value: `0/${st.limitDays}`, pct: 0, line: exit || 'Entry day', tone: '' };
    case 'complete':
      return { name: c.name, value: `${st.day}/${st.limitDays}`, pct: 100, line: 'Done', tone: '' };
    case 'overLimit':
      return { name: c.name, value: `${st.day}/${st.limitDays}`, pct: 100, line: 'Over the limit', tone: 'crit' };
    case 'counting': {
      const tone = st.remaining <= 2 ? 'crit' : st.remaining <= 5 ? 'warn' : '';
      return {
        name: c.name,
        value: `${st.day}/${st.limitDays}`,
        pct: Math.round((st.day / st.limitDays) * 100),
        line: exit || `${st.remaining} days left`,
        tone,
      };
    }
  }
}
