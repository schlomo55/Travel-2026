/* THE TRAVEL DAY AS A METRO LINE — generated from the day's bookings,
   joined to the runbook by exact words only, and never composing a time,
   a mode or a place the trip file does not state. */
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
  type MetroInput,
} from '../lib/logic/metroline';

const china = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup)
  .trips[0]!;
const runbook = (date: string) => {
  const id = china.dayPlans.find((d) => d.date === date)?.runbookId;
  return china.runbooks.find((r) => r.id === id);
};
const line = (date: string, extra: Partial<MetroInput> = {}) =>
  buildMetroLine({
    date,
    bookings: china.bookings,
    cards: china.showCards,
    runbook: runbook(date),
    bedLabel: china.dayPlans.find((d) => d.date === date)?.bedLabel,
    realToday: '2026-09-28',
    ...extra,
  })!;

describe('metro line · Fri 11 Dec, the Daxing flight', () => {
  const l = line('2026-12-11');

  it('runs from last night’s bed to tonight’s, through every end of every leg', () => {
    expect(l.stations.map((s) => s.name)).toEqual([
      'Element Chongli',
      'Taizicheng',
      'Qinghe',
      'Beijing Daxing Intl',
      'Zhangjiajie Hehua · Terminal 2',
      'Pullman Zhangjiajie, Wulingyuan',
    ]);
    expect(l.stations[0]!.bed).toBe('last');
    expect(l.stations[5]!.bed).toBe('tonight');
    expect(l.stations[5]!.booking?.id).toBe('cn26-stay-03');
  });

  it('draws the train and the flight as legs, and the gaps between them as transfers', () => {
    expect(l.segments.map((s) => `${s.kind}:${s.mode}:${s.label}`)).toEqual([
      'transfer:transfer:',
      'leg:rail:HSR',
      'transfer:transfer:',
      'leg:air:CA 8609',
      'transfer:transfer:',
    ]);
    const [, hsr, , flight] = l.segments;
    expect(hsr!.status).toBe('pending');
    expect(hsr!.duration).toBe('~1 h');
    expect(flight!.status).toBe('booked');
    expect(flight!.duration).toBe('2h 15m');
  });

  it('joins each segment to the runbook step that is about it', () => {
    expect(l.segments.map((s) => s.step)).toEqual([0, 1, 2, 3, 7]);
    /* the Qinghe → Daxing crossing says *verify* */
    expect(l.segments.map((s) => s.verify)).toEqual([false, false, true, false, false]);
    expect(segmentOfStep(l, 2)).toBe(2);
    expect(segmentOfStep(l, 5)).toBe(-1); // "Checked bag capped at 20 kg" is not a place
  });

  it('lifts only the times the steps tie to a place', () => {
    const by = l.stations.map((s) => s.by ?? null);
    /* the check-out, from "check out of Element by 12:00" — the bed it is tied to */
    expect(by).toEqual(['12:00', null, '~14:30', '~16:45', null, '≈21:30']);
    /* the booking's own clocks */
    expect(l.stations[3]!.time).toBe('18:15');
    expect(l.stations[4]!.time).toBe('20:30');
  });

  it('gives the stations their Chinese and their driver cards by exact joins', () => {
    expect(l.stations[1]!.native).toBe('太子城站');
    expect(l.stations[1]!.card).toBe('cn26-place-08');
    expect(l.stations[2]!.native).toBe('清河站');
    expect(l.stations[3]!.card).toBe('cn26-place-01'); // (PKX)
    expect(l.stations[3]!.native).toBe('北京大兴国际机场');
    expect(l.stations[4]!.card).toBe('cn26-place-09'); // (DYG)
    expect(l.stations[5]!.card).toBeUndefined(); // no card is the Pullman
  });

  it('with nothing ticked you are at the bed you check out of, and that segment is NOW', () => {
    expect(l.you).toBe(0);
    expect(l.segments.map((s) => s.state)).toEqual(['now', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(l.arrived).toBe(false);
  });

  it('a ticked step moves you on — to Taizicheng, the board’s moment', () => {
    const t = line('2026-12-11', { ticked: (i) => i === 0 });
    expect(t.you).toBe(1);
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'now', 'ahead', 'ahead', 'ahead']);
  });

  it('the clock finishes a timed leg on the real day, and everything before it with it', () => {
    const t = line('2026-12-11', { realToday: '2026-12-11', nowMinutes: 20 * 60 + 40 });
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'now']);
    expect(t.you).toBe(4);
    /* but never on a day it is only previewing */
    const p = line('2026-12-11', { nowMinutes: null });
    expect(p.you).toBe(0);
  });

  it('a day already over in real life is all behind you', () => {
    const over = line('2026-12-11', { realToday: '2027-01-02' });
    expect(over.arrived).toBe(true);
    expect(over.you).toBe(-1);
    expect(over.segments.every((s) => s.state === 'done')).toBe(true);
  });
});

describe('metro line · the other travel days', () => {
  it('21 Nov: two flights, joined at Abu Dhabi, the night spent aboard the second', () => {
    const l = line('2026-11-21');
    expect(l.stations.map((s) => s.code ?? s.name)).toEqual(['TLV', 'AUH', 'PKX']);
    expect(l.segments.map((s) => s.label)).toEqual(['EY 608', 'EY 888']);
    /* it lands tomorrow, and says so */
    expect(l.stations[2]!.time).toBe('08:45+1');
    expect(l.stations.some((s) => s.bed === 'tonight')).toBe(false);
  });

  it('22 Nov: lands at Daxing, flies on from Daxing, and tonight’s bed is not booked', () => {
    const l = line('2026-11-22');
    expect(l.stations.map((s) => s.code ?? s.name).slice(0, 2)).toEqual(['PKX', 'YNT']);
    expect(l.stations[0]!.time).toBe('08:45');
    expect(l.segments[0]!.label).toBe('CA 8683');
    const bed = l.stations[l.stations.length - 1]!;
    expect(bed.bed).toBe('tonight');
    expect(bed.missing).toBe(true);
    /* the HSR fallback is the OTHER way of making the journey — not a leg */
    expect(l.segments.some((s) => /HSR/.test(s.label))).toBe(false);
  });

  it('5 Dec: two beds and nothing booked between them is a missing move, not a transfer', () => {
    const l = line('2026-12-05');
    expect(l.stations.map((s) => s.bed)).toEqual(['last', 'tonight']);
    expect(l.segments).toHaveLength(1);
    expect(l.segments[0]!.missing).toBe(true);
  });

  it('9 Dec: the train leaves from "Beijing North / Qinghe" and says both', () => {
    const l = line('2026-12-09');
    const from = l.stations.find((s) => /Qinghe/.test(s.name))!;
    expect(from.native).toBe('北京北站 / 清河站');
  });

  it('a day that moves nobody and changes no bed has no line', () => {
    expect(buildMetroLine({ date: '2026-12-12', bookings: china.bookings })).toBeNull();
  });
});

describe('metro line · the words', () => {
  it('a runbook title keeps its meaning and loses its emoji and its date', () => {
    expect(runbookHeadline('⚠️ Dec 11 runbook — the Daxing flight')).toBe('The Daxing flight');
    expect(runbookHeadline('🛂 Dec 21 runbook — VISA EXIT DAY')).toBe('VISA EXIT DAY');
    expect(runbookHeadline('Departure runbook — Nov 21')).toBe('Departure runbook — Nov 21');
    expect(runbookHeadline('Travel-day basics')).toBe('Travel-day basics');
  });

  it('a leg goes by its number, else by the words its title opens with', () => {
    const b = (id: string) => china.bookings.find((x) => x.id === id)!;
    expect(legLabel(b('cn26-flight-ca1953'))).toBe('CA 8609');
    expect(legLabel(b('cn26-train-dec11'))).toBe('HSR');
    const car = china.bookings.find((x) => /Shared car/.test(x.title))!;
    expect(legLabel(car)).toBe('Shared car');
  });

  it('lifts a time only where the step ties it to the place', () => {
    expect(timeAt('a train into **Qinghe** by ~14:30', ['Qinghe'])).toBe('~14:30');
    expect(timeAt('Pullman ≈21:30', ['Pullman'])).toBe('≈21:30');
    expect(timeAt('Off the snow by ~11:00, check out of Element by 12:00', ['Taizicheng'])).toBeNull();
    expect(timeAt('Qinghe → Daxing ~1 h 20 by taxi', ['Daxing'])).toBeNull();
  });

  it('a travel day is a runbook day or a day something moves you', () => {
    expect(isTravelDay(undefined, china.bookings, '2026-12-11')).toBe(true);
    expect(isTravelDay(undefined, china.bookings, '2026-12-12')).toBe(false);
    expect(isTravelDay('cn26-run-move', china.bookings, '2026-12-05')).toBe(true);
    expect(dayMoves(china.bookings, '2026-11-22').map((b) => b.id)).toEqual(['cn26-flight-ey888', 'cn26-flight-ca8683']);
  });

  it('counts the runbook: done, and the first step still to do', () => {
    expect(stepProgress(8, (i) => i === 0)).toEqual({ total: 8, done: 1, current: 1 });
    expect(stepProgress(3, () => true)).toEqual({ total: 3, done: 3, current: null });
    expect(stepProgress(0, () => false)).toEqual({ total: 0, done: 0, current: null });
  });
});

describe('metro line · the layout the screen draws', () => {
  it('lays the line out as station, segment, station … with the words each prints', () => {
    const rows = metroRows(line('2026-12-11', { ticked: (i) => i === 0 }));
    expect(rows.map((r) => r.kind).join(' ')).toBe('st seg st seg st seg st seg st seg st');
    const [bed, t0, tzc, hsr, qh, xfer, pkx, fly, dyg, t4, pull] = rows;
    expect(bed!.sub).toBe('checked out');
    expect(bed!.dot).toBe('bed');
    expect(t0!.rail).toBe('r done transfer');
    expect(tzc!.you).toBe(true);
    expect(tzc!.dot).toBe('you');
    expect(hsr!.rail).toBe('r now leg flow');
    expect(hsr!.label).toBe('HSR');
    expect(hsr!.chip?.cls).toBe('warn');
    expect(qh!.sub).toBe('by ~14:30');
    expect(qh!.arrow).toBe(true); // the calm arrowhead of the HSR lands at Qinghe
    expect(xfer!.facts).toBe('Transfer · see step 3');
    expect(xfer!.verify).toBe(true);
    expect(pkx!.dot).toBe('ahead air');
    expect(fly!.air).toBe(true);
    expect(fly!.facts).toBe('18:15 → 20:30 · 2h 15m');
    expect(fly!.booking?.id).toBe('cn26-flight-ca1953');
    expect(dyg!.time).toBe('20:30');
    expect(t4!.facts).toBe('Transfer · see step 8');
    expect(pull!.sub).toBe('tonight’s bed');
    expect(pull!.time).toBe('≈21:30');
    expect(pull!.booking?.id).toBe('cn26-stay-03');
    expect(pull!.down).toBe('');
  });

  it('a segment finished with Done inks itself, once', () => {
    const rows = metroRows(line('2026-12-11', { ticked: (i) => i <= 1 }), 1);
    expect(rows[3]!.rail).toBe('r done leg ink');
    expect(rows[1]!.rail).toBe('r done transfer');
  });

  it('a gap nothing covers says so, and carries no transfer words', () => {
    const rows = metroRows(line('2026-12-05'));
    expect(rows[1]!.missing).toBe(true);
    expect(rows[1]!.facts).toBe('');
  });
});

describe('metro line · the Focus card', () => {
  const rb = china.runbooks.find((r) => r.id === 'cn26-run-dec11')!;
  it('the first step leaves last night’s bed: the check-out and its time come first', () => {
    const f = focusOf(line('2026-12-11'), rb.steps, 0)!;
    expect(f.title).toBe('Element Chongli → Taizicheng');
    expect(f.facts).toBe('check out by 12:00');
    expect(metroRows(line('2026-12-11'))[0]!.sub).toBe('check out by 12:00');
  });

  it('holds the step you are on as a move, with its driver card', () => {
    const l = line('2026-12-11', { ticked: (i) => i === 0 });
    const f = focusOf(l, rb.steps, 1)!;
    expect(f).toMatchObject({ n: 2, of: 8, title: 'HSR Taizicheng → Qinghe', facts: '~1 h · by ~14:30', card: 'cn26-place-08' });
    expect(f.chip?.cls).toBe('warn');
  });

  it('a crossing shows the card of where it goes — Daxing, for the taxi', () => {
    const f = focusOf(line('2026-12-11'), rb.steps, 2)!;
    expect(f.title).toBe('Qinghe → Beijing Daxing Intl');
    expect(f.facts).toBe('by ~16:45');
    expect(f.card).toBe('cn26-place-01');
    expect(f.chip).toBeUndefined();
  });

  it('a step that is not a move is its own words', () => {
    const f = focusOf(line('2026-12-11'), rb.steps, 5)!;
    expect(f.text).toBe('Checked bag capped at 20 kg + 5 kg cabin');
    expect(f.title).toBeUndefined();
  });

  it('nothing to focus once every step is done', () => {
    expect(focusOf(line('2026-12-11'), rb.steps, null)).toBeNull();
    expect(segTitle({ kind: 'leg', mode: 'air', label: 'CA 8609', step: null, verify: false, state: 'ahead' }, { name: 'x', code: 'PKX' }, { name: 'y', code: 'DYG' })).toBe('CA 8609 PKX → DYG');
    expect(legFacts({ kind: 'transfer', mode: 'transfer', label: '', step: null, verify: false, state: 'ahead' })).toBe('');
  });
});
