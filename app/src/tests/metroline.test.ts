/* THE TRAVEL DAY AS A METRO LINE — generated from the day's bookings,
   joined to the runbook by exact words only, and never composing a time,
   a mode or a place the trip file does not state. Proved on the demo trip
   (seed/demo-2027.trip.json). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import {
  buildMetroLine,
  dayMoves,
  focusOf,
  isTravelDay,
  legFacts,
  legLabel,
  metroRows,
  runbookHeadline,
  segTitle,
  segmentOfStep,
  stepProgress,
  timeAt,
  warnAt,
  type MetroInput,
} from '../lib/logic/metroline';

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const runbook = (date: string) => {
  const id = demo.dayPlans.find((d) => d.date === date)?.runbookId;
  return demo.runbooks.find((r) => r.id === id);
};
const line = (date: string, extra: Partial<MetroInput> = {}) =>
  buildMetroLine({
    date,
    bookings: demo.bookings,
    cards: demo.showCards,
    runbook: runbook(date),
    bedLabel: demo.dayPlans.find((d) => d.date === date)?.bedLabel,
    realToday: '2027-03-01',
    ...extra,
  })!;
/* HOLES, made in the test: the demo trip has a bed for every night and a
   booking for every move between beds, so the "bed not booked" and "move
   nothing covers" drawings are proved on the trip minus one booking each —
   the Mar 20 Station Inn, and the Apr 7 flight 3U 9001. */
const withoutStationInn = demo.bookings.filter((b) => b.id !== 'dm27-stay-01');
const without3U9001 = demo.bookings.filter((b) => b.id !== 'dm27-flight-3u9001');

/* Sun 4 Apr, the Hongqiao flight: the Canal Hostel in Suzhou (booked) →
   Shanghai HONGQIAO → MU 5001 (booked) → Huangshan Tunxi → the Pine Lodge.
   MU 5003 from Pudong, the first plan, is CANCELLED, and no line draws a
   cancelled booking as a leg. */
describe('metro line · Sun 4 Apr, the Hongqiao flight', () => {
  const l = line('2027-04-04');

  it('runs from last night’s bed to tonight’s, through every end of every leg', () => {
    expect(l.stations.map((s) => s.name)).toEqual([
      'Sample Canal Hostel, Pingjiang Road',
      'Shanghai Hongqiao · T2',
      'Huangshan Tunxi',
      'Sample Pine Lodge, Tangkou',
    ]);
    expect(l.stations[0]!.bed).toBe('last');
    expect(l.stations[0]!.booking?.id).toBe('dm27-stay-05'); // the Canal Hostel — booked; never the Lakeside Resort, which is cancelled
    expect(l.stations[3]!.bed).toBe('tonight');
    expect(l.stations[3]!.booking?.id).toBe('dm27-stay-07');
  });

  it('draws the flight as a leg, the gaps around it as transfers, and never the cancelled one', () => {
    expect(l.segments.map((s) => `${s.kind}:${s.mode}:${s.label}`)).toEqual([
      'transfer:transfer:',
      'leg:air:MU 5001',
      'transfer:transfer:',
    ]);
    const flight = l.segments[1]!;
    expect(flight.status).toBe('booked');
    expect(flight.duration).toBe('1h 15m');
    expect(l.segments.some((s) => /5003/.test(s.label))).toBe(false);
  });

  it('joins each segment to the runbook step that is about it', () => {
    expect(l.segments.map((s) => s.step)).toEqual([1, 3, 6]);
    expect(l.segments.map((s) => s.verify)).toEqual([false, false, false]);
    expect(segmentOfStep(l, 1)).toBe(0);
    expect(segmentOfStep(l, 4)).toBe(-1); // the bag allowance is not a place
  });

  it('lifts only the times the steps tie to a place', () => {
    const by = l.stations.map((s) => s.by ?? null);
    /* "Back at the hostel ~14:00" — the bed it is tied to; "at SHA by 17:10"
       — Hongqiao, 2 h before MU 5001; "Pine Lodge ≈21:30" */
    expect(by).toEqual(['~14:00', '17:10', null, '≈21:30']);
    /* the booking's own clocks */
    expect(l.stations[1]!.time).toBe('19:10');
    expect(l.stations[2]!.time).toBe('20:25');
  });

  /* The day's one warning sits on the Hongqiao row, lifted from its own step:
     "the train to Hongqiao (SHA) — NOT Pudong". */
  it('lifts the warning its own step ties to a station, and only there', () => {
    expect(l.stations.map((s) => s.warn ?? null)).toEqual([null, 'NOT Pudong', null, null]);
    const rows = metroRows(l).filter((r) => r.kind === 'st');
    expect(rows[1]!.warn).toBe('NOT Pudong');
    expect(rows.filter((r) => r.warn)).toHaveLength(1);
    /* no other travel day has one */
    for (const d of ['2027-03-19', '2027-03-20', '2027-03-29', '2027-04-02', '2027-04-07', '2027-04-09', '2027-04-11', '2027-04-12', '2027-04-13', '2027-04-17', '2027-04-18']) {
      expect(line(d).stations.some((s) => s.warn), d).toBe(false);
    }
  });

  it('gives the stations their Chinese and their driver cards by exact joins — and none to the lodge', () => {
    expect(l.stations[1]!.card).toBe('dm27-place-02'); // (SHA) T2
    expect(l.stations[1]!.native).toBe('上海虹桥国际机场 2号航站楼');
    expect(l.stations[2]!.card).toBe('dm27-place-08'); // (TXN)
    expect(l.stations[2]!.native).toBe('黄山屯溪国际机场');
    expect(l.stations[3]!.card).toBeUndefined(); // no card is the Pine Lodge
  });

  it('with nothing ticked you are at the bed you leave, and that segment is NOW', () => {
    expect(l.you).toBe(0);
    expect(l.segments.map((s) => s.state)).toEqual(['now', 'ahead', 'ahead']);
    expect(l.arrived).toBe(false);
  });

  it('a ticked step moves you on — to Hongqiao', () => {
    const t = line('2027-04-04', { ticked: (i) => i <= 1 });
    expect(t.you).toBe(1);
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'now', 'ahead']);
  });

  it('the clock finishes a timed leg on the real day, and everything before it with it', () => {
    /* 21:00 — MU 5001 landed at 20:25 */
    const t = line('2027-04-04', { realToday: '2027-04-04', nowMinutes: 21 * 60 });
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'done', 'now']);
    expect(t.you).toBe(2);
    /* but never on a day it is only previewing */
    const p = line('2027-04-04', { nowMinutes: null });
    expect(p.you).toBe(0);
  });

  it('a day already over in real life is all behind you', () => {
    const over = line('2027-04-04', { realToday: '2027-05-02' });
    expect(over.arrived).toBe(true);
    expect(over.you).toBe(-1);
    expect(over.segments.every((s) => s.state === 'done')).toBe(true);
  });
});

describe('metro line · the other travel days', () => {
  it('19 Mar: two flights, joined at Helsinki, the night spent aboard the second', () => {
    const l = line('2027-03-19');
    expect(l.stations.map((s) => s.code ?? s.name)).toEqual(['CDG', 'HEL', 'PVG']);
    expect(l.segments.map((s) => s.label)).toEqual(['AY 1501', 'AY 9057']);
    /* it lands tomorrow, and says so */
    expect(l.stations[2]!.time).toBe('08:50+1');
    expect(l.stations.some((s) => s.bed === 'tonight')).toBe(false);
  });

  it('20 Mar: lands at Pudong, trains on from Hongqiao, and tonight’s bed is the Station Inn', () => {
    const l = line('2027-03-20');
    expect(l.stations.map((s) => s.code ?? s.name).slice(0, 3)).toEqual(['PVG', 'Shanghai Hongqiao', 'Hangzhou East']);
    expect(l.stations[0]!.time).toBe('08:50');
    expect(l.segments.map((s) => s.label)).toEqual(['', 'G7501', '']);
    const bed = l.stations[l.stations.length - 1]!;
    expect(bed.bed).toBe('tonight');
    expect(bed.booking?.id).toBe('dm27-stay-01');
    expect(bed.missing).toBeFalsy();
    /* the later-train fallback is the OTHER way of making the journey — not a leg */
    expect(l.segments.filter((s) => s.kind === 'leg')).toHaveLength(1);
    expect(l.segments.some((s) => /later train/i.test(s.label))).toBe(false);
  });

  it('20 Mar, without the Station Inn booking: tonight’s bed is not booked, and the line says so', () => {
    const bed = line('2027-03-20', { bookings: withoutStationInn }).stations.at(-1)!;
    expect(bed.bed).toBe('tonight');
    expect(bed.missing).toBe(true);
  });

  it('7 Apr: 3U 9001 from Tunxi to Chengdu, between the Old Street Hotel and the Teahouse Hotel', () => {
    const l = line('2027-04-07');
    expect(l.stations.map((s) => s.code ?? s.bed)).toEqual(['last', 'TXN', 'CTU', 'tonight']);
    expect(l.stations[1]!.time).toBe('14:30');
    expect(l.stations[2]!.time).toBe('17:10');
    expect(l.segments.map((s) => `${s.kind}:${s.label}`)).toEqual(['transfer:', 'leg:3U 9001', 'transfer:']);
    expect(l.segments.some((s) => s.missing)).toBe(false);
  });

  it('7 Apr, without 3U 9001: two beds and nothing booked between them is a missing move, not a transfer', () => {
    const l = line('2027-04-07', { bookings: without3U9001 });
    expect(l.stations.map((s) => s.bed)).toEqual(['last', 'tonight']);
    expect(l.segments).toHaveLength(1);
    expect(l.segments[0]!.missing).toBe(true);
  });

  /* Mar 29: both stations of a booked train are verified driver cards. Apr 2:
     the pending train to Suzhou names no station at either end, so neither
     gets Chinese or a card — nothing is guessed. */
  it('29 Mar: Hangzhou East → Shanghai Hongqiao, each with its own card; 2 Apr: Shanghai → Suzhou, none', () => {
    const l = line('2027-03-29');
    expect(l.stations.map((s) => s.name)).toEqual(['Sample Tai-chi School dormitory', 'Hangzhou East', 'Shanghai Hongqiao', 'Sample Bund Hotel']);
    expect(l.stations[1]!.native).toBe('杭州东站');
    expect(l.stations[1]!.card).toBe('dm27-place-04');
    expect(l.stations[2]!.card).toBe('dm27-place-03');
    expect(l.stations[3]!.booking?.id).toBe('dm27-stay-03');
    const s = line('2027-04-02');
    expect(s.stations.map((x) => x.name)).toEqual(['Sample Lane House, Xintiandi', 'Shanghai', 'Suzhou', 'Sample Canal Hostel, Pingjiang Road']);
    expect(s.stations[1]!.native).toBeUndefined();
    expect(s.stations[2]!.card).toBeUndefined();
    expect(s.segments[1]!.status).toBe('pending');
    expect(s.stations[3]!.booking?.status).toBe('booked');
  });

  it('a day that moves nobody and changes no bed has no line', () => {
    expect(buildMetroLine({ date: '2027-04-08', bookings: demo.bookings })).toBeNull();
  });
});

describe('metro line · the words', () => {
  it('a runbook title keeps its meaning and loses its emoji and its date', () => {
    expect(runbookHeadline('⚠️ Apr 4 runbook — the Hongqiao flight')).toBe('The Hongqiao flight');
    expect(runbookHeadline('🛂 Apr 13 runbook — VISA EXIT DAY')).toBe('VISA EXIT DAY');
    expect(runbookHeadline('Departure runbook — Mar 19')).toBe('Departure runbook — Mar 19');
    expect(runbookHeadline('Travel-day basics')).toBe('Travel-day basics');
  });

  it('a leg goes by its number, else by the words its title opens with', () => {
    const b = (id: string) => demo.bookings.find((x) => x.id === id)!;
    expect(legLabel(b('dm27-flight-mu5003'))).toBe('MU 5003');
    expect(legLabel(b('dm27-flight-mu5001'))).toBe('MU 5001');
    expect(legLabel(b('dm27-train-mar20'))).toBe('G7501');
    expect(legLabel(b('dm27-train-apr02'))).toBe('HSR');
    const car = demo.bookings.find((x) => /Shared car/.test(x.title))!;
    expect(legLabel(car)).toBe('Shared car');
  });

  it('lifts a time only where the step ties it to the place', () => {
    expect(timeAt('a train into **Hongqiao** by ~14:30', ['Hongqiao'])).toBe('~14:30');
    expect(timeAt('Pine Lodge ≈21:30', ['Pine Lodge'])).toBe('≈21:30');
    expect(timeAt('Off the hill by ~09:30, check out of the school by 12:00', ['Hangzhou East'])).toBeNull();
    expect(timeAt('Suzhou → Hongqiao ~1 h 20 by train', ['Hongqiao'])).toBeNull();
  });

  it('lifts a warning only as the file writes it, and only beside the place', () => {
    const step = '**Fly from Hongqiao (SHA) — NOT Pudong (PVG).** Suzhou → Hongqiao ~1 h 20 by train';
    expect(warnAt(step, ['SHA', 'Shanghai', 'Hongqiao'])).toBe('NOT Pudong');
    /* a lower-case "not" is prose, not the file's warning */
    expect(warnAt('The bag rides the Sample School van, not the inn', ['Sample School'])).toBeNull();
    /* a NOT about somewhere else, far from this place, is not this place's */
    expect(warnAt(step, ['Suzhou'])).toBeNull();
    expect(warnAt('Hangzhou East is out of town, NOT the lake shore', ['Chengdu'])).toBeNull();
  });

  /* Run 3c: the name after NOT was one word — "NOT Hangzhou West" became
     "NOT Hangzhou", the wrong station — and a shouted status after a NOT
     would have become a warning */
  it('lifts every word of the name the NOT rules out, and never a shouted status', () => {
    expect(warnAt('Arrive at Hangzhou East — NOT Hangzhou West', ['East'])).toBe('NOT Hangzhou West');
    expect(warnAt('上海虹桥站 Shanghai Hongqiao, NOT Shanghai South Railway Station', ['上海虹桥站'])).toBe('NOT Shanghai South Railway Station');
    expect(warnAt('Hongqiao (SHA) — NOT Pudong (PVG)', ['SHA'])).toBe('NOT Pudong');
    /* shouted words are statuses, not places */
    expect(warnAt('Train to Suzhou — NOT BOOKED YET', ['Suzhou'])).toBeNull();
    expect(warnAt('Suzhou — NOT BOOKED', ['Suzhou'])).toBeNull();
    expect(warnAt('Suzhou — NOT A walk-up', ['Suzhou'])).toBeNull();
    /* the name stops at the first word that is not Title-case */
    expect(warnAt('Hangzhou East — NOT Hangzhou West station', ['East'])).toBe('NOT Hangzhou West');
  });

  it('a travel day is a runbook day or a day something moves you', () => {
    expect(isTravelDay(undefined, demo.bookings, '2027-04-04')).toBe(true);
    expect(isTravelDay(undefined, demo.bookings, '2027-04-08')).toBe(false);
    /* a runbook alone makes it one, even on a day no booking moves you */
    expect(isTravelDay('dm27-run-move', demo.bookings, '2027-04-08')).toBe(true);
    /* last night's overnight flight lands today, so it is one of today's moves;
       the alternative later train is not */
    expect(dayMoves(demo.bookings, '2027-03-20').map((b) => b.id)).toEqual(['dm27-flight-ay9057', 'dm27-train-mar20']);
  });

  it('counts the runbook: done, and the first step still to do', () => {
    expect(stepProgress(8, (i) => i === 0)).toEqual({ total: 8, done: 1, current: 1 });
    expect(stepProgress(3, () => true)).toEqual({ total: 3, done: 3, current: null });
    expect(stepProgress(0, () => false)).toEqual({ total: 0, done: 0, current: null });
  });
});

describe('metro line · the layout the screen draws', () => {
  it('lays the line out as station, segment, station … with the words each prints', () => {
    const rows = metroRows(line('2027-04-04', { ticked: (i) => i <= 1 }));
    expect(rows.map((r) => r.kind).join(' ')).toBe('st seg st seg st seg st');
    const [bed, t0, sha, fly, txn, t1, lodge] = rows;
    expect(bed!.sub).toBe('checked out');
    expect(bed!.dot).toBe('bed');
    expect(t0!.rail).toBe('r done transfer');
    expect(t0!.facts).toBe('Transfer · see step 2');
    expect(sha!.you).toBe(true);
    expect(sha!.dot).toBe('you');
    expect(sha!.time).toBe('19:10');
    expect(sha!.sub).toBe('by 17:10');
    expect(fly!.rail).toBe('r now leg flow');
    expect(fly!.air).toBe(true);
    expect(fly!.label).toBe('MU 5001');
    expect(fly!.chip?.cls).toBe('ok'); // booked
    expect(fly!.facts).toBe('19:10 → 20:25 · 1h 15m');
    expect(fly!.booking?.id).toBe('dm27-flight-mu5001');
    expect(txn!.arrow).toBe(true); // the calm arrowhead of MU 5001 lands at TXN
    expect(txn!.time).toBe('20:25');
    expect(t1!.facts).toBe('Transfer · see step 7');
    expect(lodge!.sub).toBe('tonight’s bed');
    expect(lodge!.time).toBe('≈21:30');
    expect(lodge!.booking?.id).toBe('dm27-stay-07');
    expect(lodge!.down).toBe('');
  });

  it('a segment finished with Done inks itself, once', () => {
    const rows = metroRows(line('2027-04-04', { ticked: (i) => i <= 3 }), 1); // segment 1, MU 5001, finished with step 4
    expect(rows[3]!.rail).toBe('r done leg ink');
    expect(rows[1]!.rail).toBe('r done transfer');
  });

  it('a gap nothing covers says so, and carries no transfer words', () => {
    /* Apr 7 without 3U 9001 — the demo trip itself has no gap */
    const rows = metroRows(line('2027-04-07', { bookings: without3U9001 }));
    expect(rows[1]!.missing).toBe(true);
    expect(rows[1]!.facts).toBe('');
  });
});

describe('metro line · the Focus card', () => {
  const rb = demo.runbooks.find((r) => r.id === 'dm27-run-apr04')!;
  it('the first step is its own words — leaving the bag is not a move', () => {
    const f = focusOf(line('2027-04-04'), rb.steps, 0)!;
    expect(f).toMatchObject({ n: 1, of: 7 });
    expect(f.title).toBeUndefined();
    expect(f.text).toMatch(/^Breakfast, check out by 12:00 and \*\*leave the bag at the Canal Hostel\*\*/);
    expect(metroRows(line('2027-04-04'))[0]!.sub).toBe('check out by ~14:00');
  });

  it('the crossing leaves the Canal Hostel for Hongqiao, with its times, its card and its warning', () => {
    const f = focusOf(line('2027-04-04', { ticked: (i) => i === 0 }), rb.steps, 1)!;
    expect(f).toMatchObject({ n: 2, of: 7, title: 'Sample Canal Hostel, Pingjiang Road → Shanghai Hongqiao · T2', facts: 'check out by ~14:00 · by 17:10', warn: 'NOT Pudong' });
    expect(f.card).toBe('dm27-place-02'); // the Hongqiao T2 driver card, by exact join
    expect(f.chip).toBeUndefined();
  });

  it('holds the flight as a move, booked', () => {
    const f = focusOf(line('2027-04-04', { ticked: (i) => i <= 2 }), rb.steps, 3)!;
    expect(f).toMatchObject({ n: 4, of: 7, title: 'MU 5001 SHA → TXN', facts: '19:10 → 20:25 · 1h 15m' });
    expect(f.chip?.cls).toBe('ok');
    expect(f.warn).toBeUndefined();
  });

  it('a step that is not a move is its own words', () => {
    const f = focusOf(line('2027-04-04'), rb.steps, 4)!;
    expect(f.text).toBe('Checked bag 20 kg + one 7 kg carry-on — on the booking');
    expect(f.title).toBeUndefined();
  });

  it('nothing to focus once every step is done', () => {
    expect(focusOf(line('2027-04-04'), rb.steps, null)).toBeNull();
    expect(segTitle({ kind: 'leg', mode: 'air', label: 'MU 5003', step: null, verify: false, state: 'ahead' }, { name: 'x', code: 'PVG' }, { name: 'y', code: 'TXN' })).toBe('MU 5003 PVG → TXN');
    expect(legFacts({ kind: 'transfer', mode: 'transfer', label: '', step: null, verify: false, state: 'ahead' })).toBe('');
  });
});
