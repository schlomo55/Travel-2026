/* THE POCKET HOME, AS DATA — what each tile says, decided from the trip file
   alone. A tile with nothing to say is not drawn (GlanceTile README: "a tile
   with nothing to say is not shown"), so every function here returns null or
   an empty list rather than a zero or a placeholder. */
import type { Booking, ComplianceCounter, DayPlan, DocumentFile, EmergencyContact, ISODate, ShowCard, Stop } from '../model/types';
import { counterDay1, counterState } from './counters';
import { compareIso, fmtShort } from './dates';
import { isLive } from './booked';
import { nearestStop } from './citymap';
import { mdliteToText } from './mdlite';
import { splitWarning } from './pass';
import { S } from '../i18n/strings';

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
 * then the rest of the trip's cards in the order given (driverCards: trip
 * order), until there are three.
 * Never a pending card, and NEVER a card that carries its own ⚠️: a place
 * you must not be taken to does not belong one tap from a taxi driver.
 */
export function driverChips(cards: ShowCard[], todayPlaceIds: string[] | undefined, n = 3): ShowCard[] {
  const usable = cards.filter((c) => c.kind === 'place' && !c.pending && !splitWarning(c.meaning).warning);
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
      return { name: c.name, value: `0/${st.limitDays}`, pct: 0, line: S.info.day1(fmtShort(counterDay1(c))), tone: '' };
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

/* ---------- the driver cards, a stay's own among them ---------- */

const CJK_RUN = /[㐀-鿿豈-﫿][㐀-鿿豈-﫿　-〿＀-￯\d\s·()（）]*[㐀-鿿豈-﫿)）]/;
/** A title that carries both scripts — "Dali Yanyuan Mountain Retreat 大理晏清山居客栈" —
    split into its English and its Chinese, word for word. */
export function splitScripts(title: string): { name: string; native?: string } {
  const m = CJK_RUN.exec(title);
  if (!m) return { name: title.trim() };
  const latin = (title.slice(0, m.index) + title.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').replace(/[\s·,—-]+$/, '').trim();
  if (!/[A-Za-z]/.test(latin)) return { name: title.trim(), native: m[0].trim() };
  return { name: latin, native: m[0].trim() };
}

/* a letter of a script other than Latin: the local script */
const LOCAL = /[^\P{L}\p{Script=Latin}]/u;
const local = (s: string | undefined): string | undefined => (s && LOCAL.test(s) ? s.trim() : undefined);

/**
 * THE DRIVER CARD A STAY CARRIES (QA, 7 Nov 2026 — one tap from Now to the
 * card for tonight's bed). Built from the booking's own fields and nothing
 * else: its local-script name (`native`, else the local half of a two-script
 * title, else a local-script map name) and its local-script address, large;
 * its English address and its phone, small. The model's convention is
 * `address` local and `addressEn` romanised; an `address` in Latin letters
 * only is read as the English one, so a file written the other way round
 * still shows right. Null when the stay has neither a local name nor a local
 * address — nothing a driver could read — and for a cancelled or either/or
 * stay. Its `order` is −1: derived, never stored, never edited as a card.
 */
export function stayCard(b: Booking): ShowCard | null {
  if (b.kind !== 'hotel' || !isLive(b)) return null;
  const split = splitScripts(mdliteToText(b.title));
  const addr = local(b.address);
  const name = b.native?.trim() || split.native || local(b.mapQuery);
  const big = name || addr;
  if (!big) return null;
  return {
    id: b.id,
    tripId: b.tripId,
    kind: 'place',
    native: big,
    meaning: split.name,
    category: 'hotel',
    address: addr,
    addressEn: b.addressEn ?? (addr ? undefined : b.address),
    phone: b.phone,
    coord: b.coord,
    mapQuery: b.mapQuery,
    mapCity: b.mapCity,
    mapUrl: b.mapUrl,
    verify: false,
    pending: false,
    isKey: false,
    order: -1,
  };
}

/**
 * EVERY DRIVER CARD, IN TRIP ORDER — the trip file's place cards and each
 * stay's own (stayCard), as the Pocket lists them and ‹ › steps through
 * them. A place card goes where the trip first goes to it: the first day
 * whose plan names it (DayPlan.placeIds), else the start of the stop its
 * position lies in, else beside the card before it in the file's order; a
 * stay at its check-in. Pending cards stay in (drawn as placeholders);
 * phrases are not here.
 */
export function driverCards(showCards: ShowCard[], bookings: Booking[], dayPlans: DayPlan[], stops: Stop[]): ShowCard[] {
  const first = new Map<string, ISODate>();
  for (const d of [...dayPlans].sort((a, b) => compareIso(a.date, b.date))) for (const id of d.placeIds ?? []) if (!first.has(id)) first.set(id, d.date);
  let last = '';
  const keyed = showCards
    .filter((c) => c.kind === 'place')
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const at = c.coord ?? c.pin;
      last = first.get(c.id) ?? (at && nearestStop(at, stops)?.start) ?? last;
      return { c, k: last };
    });
  for (const b of bookings) {
    const c = stayCard(b);
    if (c && b.kind === 'hotel') keyed.push({ c, k: b.checkIn });
  }
  return keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).map((x) => x.c);
}
