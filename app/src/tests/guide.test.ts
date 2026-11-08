/* THE GUIDE AS AN EDITION — every block of a stop in exactly one chapter,
   numbered in reading order; a pull quote lifted from the story's own
   words; the dates and the local name as the trip file stores them. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Stop } from '../lib/model/types';
import { blockTitle, chipOf, fallbackOf, guideChapters, guideParts, localName, nightsOf, paragraphs, pullQuote, stayRange, tailWords, whenTail } from '../lib/logic/guide';
import { proseHtml } from '../lib/components/journey/html';
import { S } from '../lib/i18n/strings';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const real = demo.stops.filter((s) => s.kind === 'stop');
const stopOf = (id: string): Stop => real.find((s) => s.id === `dm27-stop-${id}`)!;
const hs = stopOf('huangshan');
/** a stop with its Getting-there line rewritten, as the traveller would edit it */
const withThere = (s: Stop, line: string): Stop => ({
  ...s,
  blocks: s.blocks.map((b, i) => (i === 0 ? { ...b, items: [line, ...b.items.slice(1)] } : b)),
});
/* the demo writes no "fallback:" clause into a Getting-there line (its
   fallbacks live in the runbooks), so the two below are the demo's own lines
   with the runbook's fallback added */
const HS_LINE = hs.blocks[0]!.items[0]!;
const HS_FALLBACK = 'a morning train to **Huangshan North** (~3 h · from Hongqiao) *verify*';
const hsFb = withThere(hs, `${HS_LINE} · fallback: ${HS_FALLBACK}`);
const ysFb = withThere(
  stopOf('yangshuo'),
  'Fri Apr 9: **3U9003, Chengdu (CTU) 20:20 → Guilin (KWL) 22:00** — ✅ booked · the evening flight keeps the Jinli afternoon · fallback: **a morning flight into Guilin, then the bus** · ~1 h 15 min by car to Yangshuo',
);

describe('guide · the chapters', () => {
  it('gives every block exactly one home — nothing the Plans page printed is lost', () => {
    for (const s of real) {
      const p = guideParts(s);
      const placed = [...p.there, ...p.costs, ...p.sleep, ...p.glance, ...p.rest].map((b) => b.id).sort();
      expect(placed).toEqual(s.blocks.map((b) => b.id).sort());
      expect(p.options.map((b) => b.id)).toEqual([...(s.options ?? []), ...s.recoBlocks].map((b) => b.id));
    }
  });

  it('reads Huangshan in the board’s order, numbered', () => {
    const ch = guideChapters(hs, { booked: true, days: true });
    expect(ch.slice(0, 5).map((c) => `${c.n} ${c.chip}`)).toEqual([
      '01 Getting there',
      '02 The story',
      '03 Booked',
      '04 Day by day',
      '05 Tips',
    ]);
    expect(ch.map((c) => c.chip)).toContain('Our picks');
    expect(ch.map((c) => c.chip)).toContain('Where to eat');
    expect(ch[ch.length - 1]).toMatchObject({ id: 'g-eat', kind: 'places' });
    /* the anchors other screens land on */
    for (const id of ['g-there', 'g-about', 'g-booked', 'g-days', 'g-eat']) expect(ch.some((c) => c.id === id)).toBe(true);
  });

  it('keeps a stop’s own blocks — the hike, the reason for the night — as chapters', () => {
    expect(guideChapters(stopOf('longji'), { booked: true, days: true }).map((c) => c.chip)).toContain('The hike');
    expect(guideChapters(stopOf('guilin'), { booked: true, days: true }).map((c) => c.chip)).toContain('Why here');
    expect(guideChapters(stopOf('hangzhou'), { booked: true, days: true }).map((c) => c.chip)).toContain('Tips');
  });

  it('draws no chapter a stop has nothing for', () => {
    const bare: Stop = { ...hs, blocks: [], options: [], recoBlocks: [], detail: undefined, costNote: undefined, warn: undefined, spots: [] };
    expect(guideChapters(bare, { booked: false, days: false })).toEqual([]);
  });

  it('titles a block in the trip’s words, without its emoji', () => {
    expect(blockTitle('🛏 Sleep — two bases (BOTH BOOKED)')).toBe('Sleep — two bases (BOTH BOOKED)');
    expect(chipOf('🛏 Sleep — two bases (BOTH BOOKED)')).toBe('Sleep');
    expect(chipOf('⚠️ Bring indoor shoes or you cannot train (the school, 21 Mar)')).toBe('Bring indoor shoes or you cannot train');
    expect(chipOf('⭐ Our picks')).toBe('Our picks');
  });
});

describe('guide · the story', () => {
  it('splits the long read into its paragraphs', () => {
    expect(paragraphs(hs.detail).length).toBe(2);
    expect(paragraphs(undefined)).toEqual([]);
  });

  it('lifts the pull quote out of the story’s own words', () => {
    expect(pullQuote(hs.detail)).toBe('Spring mornings are the clear ones — start early.');
    const q = pullQuote(hs.detail)!;
    const flat = hs.detail!.replace(/\*/g, '').toLowerCase();
    expect(flat.includes(q.slice(1, -1).toLowerCase())).toBe(true);
  });

  it('never quotes a number, a price or a verify, and finds one for most cities', () => {
    let found = 0;
    for (const s of real) {
      const q = pullQuote(s.detail);
      if (!q) continue;
      found++;
      expect(q).not.toMatch(/\d|verify|[$¥€]/i);
      expect(q.length).toBeLessThanOrEqual(111);
    }
    expect(found).toBeGreaterThanOrEqual(5);
    expect(pullQuote('Short.')).toBeNull();
  });
});

describe('guide · the dates and the names', () => {
  it('writes a stay in one month and across two', () => {
    expect(stayRange(hs)).toBe('Sun 4 → Wed 7 Apr');
    expect(stayRange(stopOf('shanghai'))).toBe('Mon 29 Mar → Fri 2 Apr');
  });
  it('keeps what the trip file adds after the dates', () => {
    expect(whenTail(hs)).toBe('2n mountain + 1n town');
    expect(whenTail(stopOf('chengdu'))).toBeNull();
    expect(whenTail({ whenLabel: 'Paris → Shanghai · Hong Kong → Paris' })).toBeNull();
  });
  /* Run 3b: "3 nights, Sun 4 → Wed 7 Apr — 2n Tangkou + 1n Tunxi." read
     like a template under a magazine title */
  it('opens the guide in its own voice, with only the trip’s facts', () => {
    const line = (s: Stop): string => S.guide.standfirst(nightsOf(s), stayRange(s), tailWords(whenTail(s)));
    /* the demo's split names a mountain and a town, which do not compose — a
       split by place names, as an edit would write it, does */
    expect(line({ ...hs, whenLabel: 'Sun Apr 4 → Wed Apr 7 · 2n Tangkou + 1n Tunxi' })).toBe('Three nights · Sun 4 → Wed 7 Apr · two in Tangkou, one in Tunxi');
    expect(line(hs)).toBe('Three nights · Sun 4 → Wed 7 Apr · 2n mountain + 1n town');
    expect(line(stopOf('hangzhou'))).toBe('Eight nights · Sun 21 → Mon 29 Mar');
    /* a split in any other shape is kept as the file wrote it */
    expect(line(stopOf('longji'))).toBe('One night · Sun 11 → Mon 12 Apr · 2-day hike');
    expect(tailWords('2n Kyoto + 1n Nara')).toBe('two in Kyoto, one in Nara');
    expect(tailWords(null)).toBeNull();
    /* Run 3c: "2n lake" read "two in the lake", "2n the park" read "the the" —
       only a name or a kind of place that composes safely is read out, its
       own "the" never doubled; anything else stays as the file wrote it */
    expect(tailWords('2n the park + 1n city')).toBe('two in the park, one in the city');
    expect(tailWords('2n lake + 1n city')).toBe('2n lake + 1n city');
    expect(tailWords('2n by the lake')).toBe('2n by the lake');
    expect(tailWords('1n in Kyoto')).toBe('1n in Kyoto');
    expect(tailWords('3n old town + 1n The Hague')).toBe('three in the old town, one in The Hague');
    expect(S.guide.standfirst(15, 'Sun 16 → Mon 31 Aug', null)).toBe('15 nights · Sun 16 → Mon 31 Aug');
  });

  it('gives the local name only where the trip stores one in the local script', () => {
    expect(localName(hs)).toBe('黄山');
    /* Hong Kong stores its city in English; Suzhou stores none */
    expect(localName(stopOf('hongkong'))).toBeNull();
    expect(localName(stopOf('suzhou'))).toBeNull();
  });
});

/* Run 3b: the board gives "If MU 5001 is cancelled" its own tinted warning
   box; the guide had left the fallbacks as the tail of the paragraph. */
describe('guide · a Getting-there fallback, set apart', () => {
  const there = (s: Stop): string => guideParts(s).there[0]!.items[0]!;

  it('splits Huangshan’s fallback off the line, word for word', () => {
    const f = fallbackOf(there(hsFb))!;
    /* the demo's own line, its " · " clauses (the cancelled MU5003, the ride
       to Tangkou) all before the fallback */
    expect(f.before).toBe(HS_LINE);
    expect(f.before).toMatch(/MU5003 from Pudong was cancelled · then ~50 min to Tangkou/);
    expect(f.label).toBe('fallback');
    /* the " · " inside the brackets does not end the clause */
    expect(f.text).toBe(HS_FALLBACK);
    expect(f.after).toBe('');
    /* nothing added, nothing lost */
    expect(`${f.before} · ${f.label}: ${f.text}`).toBe(there(hsFb));
  });

  it('ends the clause where the line moves on, and keeps its emphasis whole', () => {
    const f = fallbackOf(there(ysFb))!;
    expect(f.label).toBe('fallback');
    expect(f.text).toBe('**a morning flight into Guilin, then the bus**');
    expect(f.before).toMatch(/keeps the Jinli afternoon$/);
    expect(f.after).toMatch(/^~1 h 15 min by car to Yangshuo/);
  });

  it('leaves a line with no "fallback:" clause alone', () => {
    /* Hangzhou's "fallback if the flight is late: …" names no clause */
    expect(there(stopOf('hangzhou'))).toMatch(/fallback if the flight is late:/);
    expect(fallbackOf(there(stopOf('hangzhou')))).toBeNull();
    expect(fallbackOf('Apr 12: shared car from Dazhai (~2 h 30, ~¥400)')).toBeNull();
    expect(real.filter((s) => guideParts(s).there.some((b) => b.items.some((i) => fallbackOf(i)))).map((s) => s.id)).toEqual([]);
    expect([hsFb, ysFb].filter((s) => guideParts(s).there.some((b) => b.items.some((i) => fallbackOf(i)))).map((s) => s.id)).toEqual([
      'dm27-stop-huangshan',
      'dm27-stop-yangshuo',
    ]);
  });

  /* Run 3c: "**Fallback:**" left "****" in the callout, and a bold run over
     the whole line was torn in two */
  it('drops the emphasis that only wrapped the label, and never splits inside a run', () => {
    const f = fallbackOf('Apr 4 eve: MU 5001 19:10 · **Fallback:** the 07:45 nonstop · book the car')!;
    expect(f).toEqual({ before: 'Apr 4 eve: MU 5001 19:10', label: 'Fallback', text: 'the 07:45 nonstop', after: 'book the car' });
    expect(fallbackOf('MU 5001 · *Fallbacks*: the morning nonstops')).toMatchObject({ label: 'Fallbacks', text: 'the morning nonstops', after: '' });
    /* a run that opens before the clause and closes after it: prose, whole */
    expect(fallbackOf('**Fly out on MU 5001 · fallback: the HSR · either way be early**')).toBeNull();
    expect(fallbackOf('Fly (MU 5001 · fallback: the HSR) · be early')).toBeNull();
    /* a run that starts at the label and goes on into the clause stays whole */
    expect(fallbackOf('x · **fallback: the bus** · y')).toMatchObject({ text: '**the bus**', after: 'y' });
  });

  it('sets the clause as its own amber callout in the long read', () => {
    const html = proseHtml(guideParts(hsFb).there[0]!, true);
    expect(html).toMatch(/<\/p><div class="gd-fall" role="note"><span class="caps">fallback<\/span><span>a morning train to <b>Huangshan North<\/b>/);
    /* the verify flag inside it is still a flag */
    expect(html).toMatch(/gd-fall[\s\S]*md-vfy/);
    /* any other block is prose as before */
    expect(proseHtml(guideParts(hsFb).there[0]!)).not.toMatch(/gd-fall/);
  });
});
