/* THE POCKET HOME, AS DATA. Every tile is decided from the trip file, and a
   tile with nothing to say says nothing. */
import { describe, expect, it } from 'vitest';
import type { ComplianceCounter, EmergencyContact, ShowCard } from '../lib/model/types';
import { docsSummary, driverChips, emergencyPreview, isShowable, needsAddress, visaPreview } from '../lib/logic/pocket';

const card = (id: string, order: number, meaning = `Place ${id}`, extra: Partial<ShowCard> = {}): ShowCard => ({
  id,
  tripId: 't',
  kind: 'place',
  native: `地${id}`,
  meaning,
  verify: false,
  pending: false,
  isKey: false,
  order,
  ...extra,
});
const phone = (id: string, value: string, order: number, extra: Partial<EmergencyContact> = {}): EmergencyContact => ({
  id,
  tripId: 't',
  label: id,
  value,
  kind: 'phone',
  verify: false,
  pending: false,
  order,
  ...extra,
});

describe('pocket · the documents tile', () => {
  it('names what the vault holds', () => {
    const pdf = { mime: 'application/pdf', tag: 'ticket' as const };
    const photo = { mime: 'image/webp', tag: 'photo' as const };
    expect(docsSummary([pdf, ...Array(10).fill(photo)])).toBe('PDF + 10 photos');
    expect(docsSummary([pdf, pdf, { mime: 'image/png', tag: 'other' as const }])).toBe('2 PDFs + 1 image');
    expect(docsSummary([{ mime: 'text/plain', tag: 'other' as const }])).toBe('1 file');
    expect(docsSummary([])).toBeNull();
  });
});

describe('pocket · the emergency tile', () => {
  it('shows the short public numbers, one entry each so the tile can wrap between them, and counts the rest', () => {
    const list = [
      phone('police', '110', 0),
      phone('ambulance', '120', 1),
      phone('fire', '119', 2),
      phone('hk', '999', 3),
      phone('embassy', '+86 10 0000 0000', 5),
      phone('insurer', '⏳ add after purchase', 4, { kind: 'text', pending: true }),
    ];
    expect(emergencyPreview(list)).toEqual({ numbers: ['110', '120', '119', '999'], more: 1 });
  });

  it('never shows a pending line or a text line as a number', () => {
    expect(emergencyPreview([phone('x', '112', 0, { pending: true })])).toBeNull();
    expect(emergencyPreview([phone('y', 'see card', 0, { kind: 'text' })])).toBeNull();
  });

  it('falls back to the first long number when no short one exists', () => {
    expect(emergencyPreview([phone('e', '+33 1 00 00 00 00', 0)])).toEqual({ numbers: ['+33 1 00 00 00 00'], more: 0 });
  });
});

describe('pocket · the three driver chips', () => {
  const cards = [
    card('a', 0),
    card('b', 1, 'Airport West (AAW) — ⚠️ NOT the Monday airport any more'),
    card('c', 2),
    card('d', 3),
    card('e', 4, 'Pending place', { pending: true }),
    { ...card('p', 5), kind: 'phrase' as const },
  ];

  it('leads with today’s own places, in the day’s order', () => {
    expect(driverChips(cards, ['d', 'c']).map((c) => c.id)).toEqual(['d', 'c', 'a']);
  });

  it('never offers a card that carries its own ⚠️, a pending card or a phrase', () => {
    expect(driverChips(cards, ['b', 'e', 'p']).map((c) => c.id)).toEqual(['a', 'c', 'd']);
  });

  it('with no day, the trip’s cards in their order', () => {
    expect(driverChips(cards, undefined).map((c) => c.id)).toEqual(['a', 'c', 'd']);
    expect(driverChips([], ['a'])).toEqual([]);
  });
});

describe('pocket · which cards a driver can be shown', () => {
  const list = [
    card('a', 0),
    card('gone', 1, 'Declined place', { pending: true }),
    { ...card('p', 2), kind: 'phrase' as const },
    card('c', 3, 'Airport West (AAW) — ⚠️ NOT the Monday airport any more'),
  ];

  it('is a place the trip file has not marked pending — the Map’s own rule', () => {
    expect(list.filter(isShowable).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('so the list, its count and the ‹ › sequence of the full screen card all leave a declined card out', () => {
    const sequence = list.filter(isShowable);
    expect(sequence).toHaveLength(2);
    expect(sequence.some((c) => c.pending)).toBe(false);
    expect(driverChips(list, ['gone', 'a']).map((c) => c.id)).toEqual(['a']);
  });
});

describe('pocket · the note about a stay with no street address', () => {
  it('belongs to a stay’s own card (order −1) that has no address of either kind', () => {
    expect(needsAddress(card('s', -1, 'Sample Inn', { category: 'hotel' }))).toBe(true);
    expect(needsAddress(card('s', -1, 'Sample Inn', { address: '样例市中山路1号' }))).toBe(false);
    expect(needsAddress(card('s', -1, 'Sample Inn', { addressEn: '1 Main St' }))).toBe(false);
  });

  it('is never said of a card from the trip file, whose address is its own to edit', () => {
    expect(needsAddress(card('p', 4))).toBe(false);
  });
});

describe('pocket · the visa tile', () => {
  const visa: ComplianceCounter = {
    id: 'v',
    tripId: 't',
    name: 'Visa',
    startDate: '2027-01-10',
    countStartsDayAfter: true,
    limitDays: 30,
    hardDeadline: '2027-02-09',
    plannedEndDate: '2027-02-08',
    pinned: true,
  };

  it('counts the day, and says when to be out', () => {
    expect(visaPreview(visa, '2027-01-29')).toEqual({
      name: 'Visa',
      value: '19/30',
      pct: 63,
      line: 'Exit by 9 Feb',
      tone: '',
    });
  });

  it('gets loud as the room runs out', () => {
    expect(visaPreview(visa, '2027-02-05')?.tone).toBe('warn');
    expect(visaPreview(visa, '2027-02-08')?.tone).toBe('crit');
  });

  it('before, on the entry day, and after', () => {
    /* the count starts the day AFTER entry: the tile names day 1, not the entry (QA 7 Nov) */
    expect(visaPreview(visa, '2027-01-01')?.line).toBe('Day 1 = 11 Jan');
    expect(visaPreview({ ...visa, countStartsDayAfter: false }, '2027-01-01')?.line).toBe('Day 1 = 10 Jan');
    expect(visaPreview(visa, '2027-01-10')?.value).toBe('0/30');
    expect(visaPreview(visa, '2027-02-20')?.line).toBe('Done');
    expect(visaPreview(undefined, '2027-01-20')).toBeNull();
  });
});
