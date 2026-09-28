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

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const real = china.stops.filter((s) => s.kind === 'stop');
const zjj = real.find((s) => s.id === 'cn26-stop-zhangjiajie')!;

describe('guide · the chapters', () => {
  it('gives every block exactly one home — nothing the Plans page printed is lost', () => {
    for (const s of real) {
      const p = guideParts(s);
      const placed = [...p.there, ...p.costs, ...p.sleep, ...p.glance, ...p.rest].map((b) => b.id).sort();
      expect(placed).toEqual(s.blocks.map((b) => b.id).sort());
      expect(p.options.map((b) => b.id)).toEqual([...(s.options ?? []), ...s.recoBlocks].map((b) => b.id));
    }
  });

  it('reads Zhangjiajie in the board’s order, numbered', () => {
    const ch = guideChapters(zjj, { booked: true, days: true });
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

  it('keeps the academy’s own blocks — the kit list, the week, the rhythm — as chapters', () => {
    const kunyu = real.find((s) => s.id === 'cn26-stop-kunyu')!;
    const chips = guideChapters(kunyu, { booked: true, days: true }).map((c) => c.chip);
    expect(chips).toContain('Bring these or you cannot train');
    expect(chips).toContain('How their week lands on yours');
    expect(chips).toContain('The rhythm');
  });

  it('draws no chapter a stop has nothing for', () => {
    const bare: Stop = { ...zjj, blocks: [], options: [], recoBlocks: [], detail: undefined, costNote: undefined, warn: undefined, spots: [] };
    expect(guideChapters(bare, { booked: false, days: false })).toEqual([]);
  });

  it('titles a block in the trip’s words, without its emoji', () => {
    expect(blockTitle('🛏 Sleep — two bases (BOTH BOOKED)')).toBe('Sleep — two bases (BOTH BOOKED)');
    expect(chipOf('🛏 Sleep — two bases (BOTH BOOKED)')).toBe('Sleep');
    expect(chipOf('⚠️ Bring these or you cannot train (academy, 11 Aug)')).toBe('Bring these or you cannot train');
    expect(chipOf('⭐ Our picks')).toBe('Our picks');
  });
});

describe('guide · the story', () => {
  it('splits the long read into its paragraphs', () => {
    expect(paragraphs(zjj.detail).length).toBe(3);
    expect(paragraphs(undefined)).toEqual([]);
  });

  it('lifts the pull quote out of the story’s own words', () => {
    expect(pullQuote(zjj.detail)).toBe('Thin crowds, low prices, and fog that either steals the view or makes it — often both in one day.');
    const q = pullQuote(zjj.detail)!;
    const flat = zjj.detail!.replace(/\*/g, '').toLowerCase();
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
    expect(stayRange(zjj)).toBe('Fri 11 → Mon 14 Dec');
    expect(stayRange(real.find((s) => s.id === 'cn26-stop-kunyu')!)).toBe('Mon 23 Nov → Sat 5 Dec');
  });
  it('keeps what the trip file adds after the dates', () => {
    expect(whenTail(zjj)).toBe('2n park + 1n city');
    expect(whenTail(real.find((s) => s.id === 'cn26-stop-beijing')!)).toBeNull();
    expect(whenTail({ whenLabel: 'TLV → Beijing · Hong Kong → TLV' })).toBeNull();
  });
  /* Run 3b: "3 nights, Fri 11 → Mon 14 Dec — 2n park + 1n city." read like
     a template under a magazine title */
  it('opens the guide in its own voice, with only the trip’s facts', () => {
    const line = (s: Stop): string => S.guide.standfirst(nightsOf(s), stayRange(s), tailWords(whenTail(s)));
    expect(line(zjj)).toBe('Three nights · Fri 11 → Mon 14 Dec · two in the park, one in the city');
    expect(line(real.find((s) => s.id === 'cn26-stop-kunyu')!)).toBe('Twelve nights · Mon 23 Nov → Sat 5 Dec');
    /* a split in any other shape is kept as the file wrote it */
    expect(line(real.find((s) => s.id === 'cn26-stop-gorge')!)).toBe('One night · Fri 18 → Sat 19 Dec · 2-day hike');
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
    expect(localName(zjj)).toBe('张家界');
    expect(localName(real.find((s) => s.id === 'cn26-stop-beijing')!)).toBeNull();
  });
});

/* Run 3b: the board gives "If CA 8609 is cancelled" its own tinted warning
   box; the guide had left the fallbacks as the tail of the paragraph. */
describe('guide · a Getting-there fallback, set apart', () => {
  const there = (s: Stop): string => guideParts(s).there[0]!.items[0]!;

  it('splits Zhangjiajie’s fallbacks off the line, word for word', () => {
    const f = fallbackOf(there(zjj))!;
    expect(f.before).toBe('Dec 11 eve: Beijing **Daxing (PKX)** 18:15 → Zhangjiajie 20:30, 2h15 (Air China CA8609), then ~40 min to Wulingyuan, in ≈21:30');
    expect(f.label).toBe('fallbacks');
    /* the " · " inside the brackets does not end the clause */
    expect(f.text).toBe('the morning nonstops (CA1953, now 07:45 from PEK *verify* · CA9659) / via Changsha + HSR');
    expect(f.after).toBe('');
    /* nothing added, nothing lost */
    expect(`${f.before} · ${f.label}: ${f.text}`).toBe(there(zjj));
  });

  it('ends the clause where the line moves on, and keeps its emphasis whole', () => {
    const km = real.find((s) => s.id === 'cn26-stop-kunming')!;
    const f = fallbackOf(there(km))!;
    expect(f.label).toBe('fallback');
    expect(f.text).toBe('**Kunming South → straight to the airport ibis**');
    expect(f.before).toMatch(/keeps the Green Lake evening$/);
    expect(f.after).toMatch(/^trains and times verify when sales open/);
  });

  it('leaves a line with no "fallback:" clause alone', () => {
    /* Beijing's "train fallback ~5h" names no clause */
    expect(fallbackOf(there(real.find((s) => s.id === 'cn26-stop-beijing')!))).toBeNull();
    expect(fallbackOf('Dec 19 eve: shared car from the gorge (~4–5h, ~$25)')).toBeNull();
    expect(real.filter((s) => guideParts(s).there.some((b) => b.items.some((i) => fallbackOf(i)))).map((s) => s.id)).toEqual([
      'cn26-stop-zhangjiajie',
      'cn26-stop-kunming',
    ]);
  });

  /* Run 3c: "**Fallback:**" left "****" in the callout, and a bold run over
     the whole line was torn in two */
  it('drops the emphasis that only wrapped the label, and never splits inside a run', () => {
    const f = fallbackOf('Dec 11 eve: CA 8609 18:15 · **Fallback:** the 07:45 nonstop · book the car')!;
    expect(f).toEqual({ before: 'Dec 11 eve: CA 8609 18:15', label: 'Fallback', text: 'the 07:45 nonstop', after: 'book the car' });
    expect(fallbackOf('CA 8609 · *Fallbacks*: the morning nonstops')).toMatchObject({ label: 'Fallbacks', text: 'the morning nonstops', after: '' });
    /* a run that opens before the clause and closes after it: prose, whole */
    expect(fallbackOf('**Fly out on CA 8609 · fallback: the HSR · either way be early**')).toBeNull();
    expect(fallbackOf('Fly (CA 8609 · fallback: the HSR) · be early')).toBeNull();
    /* a run that starts at the label and goes on into the clause stays whole */
    expect(fallbackOf('x · **fallback: the bus** · y')).toMatchObject({ text: '**the bus**', after: 'y' });
  });

  it('sets the clause as its own amber callout in the long read', () => {
    const html = proseHtml(guideParts(zjj).there[0]!, true);
    expect(html).toMatch(/<\/p><div class="gd-fall" role="note"><span class="caps">fallbacks<\/span><span>the morning nonstops/);
    /* the verify flag inside it is still a flag */
    expect(html).toMatch(/gd-fall[\s\S]*md-vfy/);
    /* any other block is prose as before */
    expect(proseHtml(guideParts(zjj).there[0]!)).not.toMatch(/gd-fall/);
  });
});
