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
  warnAt,
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
/* THE TRIP AS IT STOOD UNTIL 28 SEP 2026 — the real seed minus the two
   bookings made that morning (the Muping bed for Nov 22 and CA1560 for Dec 5).
   The bed not booked and the move nothing covers were drawn for those two
   holes and are still proved on them (coverage.test.ts does the same). */
const BOOKED_28_SEP = new Set(['cn26-stay-12', 'cn26-flight-ca1560']);
const before = china.bookings.filter((b) => !BOOKED_28_SEP.has(b.id));

/* Fri 11 Dec was the Daxing flight (Element → Taizicheng → Qinghe → PKX →
   CA8609) until 2026-10-17. Skiing was dropped: the day leaves the Hi Cozy
   hostel in Shanghai (booked; the Meliá until later that day, never booked)
   for Pudong and MU394 — NOT booked yet — and CA8609, still booked, is the
   `alternative`, which no line draws as a leg. */
describe('metro line · Fri 11 Dec, the Pudong flight', () => {
  const l = line('2026-12-11');

  it('runs from last night’s bed to tonight’s, through every end of every leg', () => {
    expect(l.stations.map((s) => s.name)).toEqual([
      'Hi Cozy International Hostel East Nanjing Road & The Bund & 24h English Services',
      'Shanghai Pudong Intl · Terminal 1',
      'Zhangjiajie Hehua · Terminal 2',
      'Pullman Zhangjiajie, Wulingyuan',
    ]);
    expect(l.stations[0]!.bed).toBe('last');
    expect(l.stations[0]!.booking?.id).toBe('cn26-stay-13'); // the Hi Cozy hostel — booked; never Element, which is cancelled
    expect(l.stations[3]!.bed).toBe('tonight');
    expect(l.stations[3]!.booking?.id).toBe('cn26-stay-03');
  });

  it('draws the flight as a leg, the gaps around it as transfers, and never the alternative', () => {
    expect(l.segments.map((s) => `${s.kind}:${s.mode}:${s.label}`)).toEqual([
      'transfer:transfer:',
      'leg:air:MU 394',
      'transfer:transfer:',
    ]);
    const flight = l.segments[1]!;
    expect(flight.status).toBe('booked'); // booked 17 Oct 2026, the same day it was planned
    expect(flight.duration).toBe('2h 30m');
    expect(l.segments.some((s) => /8609/.test(s.label))).toBe(false);
  });

  it('joins each segment to the runbook step that is about it', () => {
    expect(l.segments.map((s) => s.step)).toEqual([1, 3, 6]);
    expect(l.segments.map((s) => s.verify)).toEqual([false, false, false]);
    expect(segmentOfStep(l, 1)).toBe(0);
    expect(segmentOfStep(l, 4)).toBe(-1); // the bag allowance is not a place
  });

  it('lifts only the times the steps tie to a place', () => {
    const by = l.stations.map((s) => s.by ?? null);
    /* "Back at Hi Cozy ~15:30" — the bed it is tied to; "at PVG by 17:10" —
       Pudong, 2 h before MU394 as its booking advises (17 Oct 2026); "Pullman
       ≈22:30" */
    expect(by).toEqual(['~15:30', '17:10', null, '≈22:30']);
    /* the booking's own clocks */
    expect(l.stations[1]!.time).toBe('19:10');
    expect(l.stations[2]!.time).toBe('21:40');
  });

  /* The day's one warning sits on the Pudong row, lifted from its own step:
     "taxi to Pudong (PVG) — NOT Hongqiao" — there is no nonstop from SHA. */
  it('lifts the warning its own step ties to a station, and only there', () => {
    expect(l.stations.map((s) => s.warn ?? null)).toEqual([null, 'NOT Hongqiao', null, null]);
    const rows = metroRows(l).filter((r) => r.kind === 'st');
    expect(rows[1]!.warn).toBe('NOT Hongqiao');
    expect(rows.filter((r) => r.warn)).toHaveLength(1);
    /* no other travel day has one */
    for (const d of ['2026-11-21', '2026-11-22', '2026-12-09', '2026-12-14', '2026-12-16', '2026-12-18', '2026-12-19', '2026-12-20', '2026-12-21', '2026-12-26', '2026-12-27']) {
      expect(line(d).stations.some((s) => s.warn), d).toBe(false);
    }
  });

  it('gives the stations their Chinese and their driver cards by exact joins — and none to Pudong', () => {
    expect(l.stations[1]!.card).toBeUndefined(); // PVG: no driver card is verified
    expect(l.stations[1]!.native).toBeUndefined();
    expect(l.stations[2]!.card).toBe('cn26-place-09'); // (DYG)
    expect(l.stations[2]!.native).toBe('张家界荷花国际机场');
    expect(l.stations[3]!.card).toBeUndefined(); // no card is the Pullman
  });

  it('with nothing ticked you are at the bed you leave, and that segment is NOW', () => {
    expect(l.you).toBe(0);
    expect(l.segments.map((s) => s.state)).toEqual(['now', 'ahead', 'ahead']);
    expect(l.arrived).toBe(false);
  });

  it('a ticked step moves you on — to Pudong', () => {
    const t = line('2026-12-11', { ticked: (i) => i <= 1 });
    expect(t.you).toBe(1);
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'now', 'ahead']);
  });

  it('the clock finishes a timed leg on the real day, and everything before it with it', () => {
    const t = line('2026-12-11', { realToday: '2026-12-11', nowMinutes: 22 * 60 });
    expect(t.segments.map((s) => s.state)).toEqual(['done', 'done', 'now']);
    expect(t.you).toBe(2);
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

  it('22 Nov: lands at Daxing, flies on from Daxing, and tonight’s bed is the Muping night', () => {
    const l = line('2026-11-22');
    expect(l.stations.map((s) => s.code ?? s.name).slice(0, 2)).toEqual(['PKX', 'YNT']);
    expect(l.stations[0]!.time).toBe('08:45');
    expect(l.segments[0]!.label).toBe('CA 8641'); // retimed from CA 8683 on 29 Sep, same booking
    const bed = l.stations[l.stations.length - 1]!;
    expect(bed.bed).toBe('tonight');
    expect(bed.booking?.id).toBe('cn26-stay-12');
    expect(bed.missing).toBeFalsy();
    /* the HSR fallback is the OTHER way of making the journey — not a leg */
    expect(l.segments.some((s) => /HSR/.test(s.label))).toBe(false);
  });

  it('22 Nov, until 28 Sep: tonight’s bed was not booked, and the line said so', () => {
    const bed = line('2026-11-22', { bookings: before }).stations.at(-1)!;
    expect(bed.bed).toBe('tonight');
    expect(bed.missing).toBe(true);
  });

  it('5 Dec: CA 1560 from Yantai to Capital, between the academy and Four Points', () => {
    const l = line('2026-12-05');
    expect(l.stations.map((s) => s.code ?? s.bed)).toEqual(['last', 'YNT', 'PEK', 'tonight']);
    expect(l.stations[1]!.time).toBe('14:55');
    expect(l.stations[2]!.time).toBe('16:15');
    expect(l.segments.map((s) => `${s.kind}:${s.label}`)).toEqual(['transfer:', 'leg:CA 1560', 'transfer:']);
    expect(l.segments.some((s) => s.missing)).toBe(false);
  });

  it('5 Dec, until 28 Sep: two beds and nothing booked between them is a missing move, not a transfer', () => {
    const l = line('2026-12-05', { bookings: before });
    expect(l.stations.map((s) => s.bed)).toEqual(['last', 'tonight']);
    expect(l.segments).toHaveLength(1);
    expect(l.segments[0]!.missing).toBe(true);
  });

  /* Until 2026-10-17 the Dec 9 train left from "Beijing North / Qinghe" for
     Chongli and the card said both. It is Beijing South → Shanghai Hongqiao
     now: Beijing South is a verified driver card, Hongqiao is not, and
     tonight's bed is the Hi Cozy hostel (booked 17 Oct 2026, no map button). */
  it('9 Dec: Beijing South (its own card) → Shanghai Hongqiao (none), to the Hi Cozy hostel', () => {
    const l = line('2026-12-09');
    expect(l.stations.map((s) => s.name)).toEqual([
      "Blossom House Prince Kung's Mansion · Beijing Houhai",
      'Beijing South',
      'Shanghai Hongqiao',
      'Hi Cozy International Hostel East Nanjing Road & The Bund & 24h English Services',
    ]);
    expect(l.stations[1]!.native).toBe('北京南站');
    expect(l.stations[1]!.card).toBe('cn26-place-03');
    expect(l.stations[2]!.native).toBeUndefined();
    expect(l.segments[1]!.status).toBe('pending');
    expect(l.stations[3]!.booking?.id).toBe('cn26-stay-13');
    expect(l.stations[3]!.booking?.status).toBe('booked'); // the Hi Cozy hostel, booked 17 Oct 2026
  });

  it('a day that moves nobody and changes no bed has no line', () => {
    expect(buildMetroLine({ date: '2026-12-12', bookings: china.bookings })).toBeNull();
  });
});

describe('metro line · the words', () => {
  it('a runbook title keeps its meaning and loses its emoji and its date', () => {
    expect(runbookHeadline('⚠️ Dec 11 runbook — the Pudong flight')).toBe('The Pudong flight');
    expect(runbookHeadline('🛂 Dec 21 runbook — VISA EXIT DAY')).toBe('VISA EXIT DAY');
    expect(runbookHeadline('Departure runbook — Nov 21')).toBe('Departure runbook — Nov 21');
    expect(runbookHeadline('Travel-day basics')).toBe('Travel-day basics');
  });

  it('a leg goes by its number, else by the words its title opens with', () => {
    const b = (id: string) => china.bookings.find((x) => x.id === id)!;
    expect(legLabel(b('cn26-flight-ca1953'))).toBe('CA 8609');
    expect(legLabel(b('cn26-flight-mu394'))).toBe('MU 394');
    expect(legLabel(b('cn26-train-dec09'))).toBe('HSR');
    const car = china.bookings.find((x) => /Shared car/.test(x.title))!;
    expect(legLabel(car)).toBe('Shared car');
  });

  it('lifts a time only where the step ties it to the place', () => {
    expect(timeAt('a train into **Qinghe** by ~14:30', ['Qinghe'])).toBe('~14:30');
    expect(timeAt('Pullman ≈21:30', ['Pullman'])).toBe('≈21:30');
    expect(timeAt('Off the snow by ~11:00, check out of Element by 12:00', ['Taizicheng'])).toBeNull();
    expect(timeAt('Qinghe → Daxing ~1 h 20 by taxi', ['Daxing'])).toBeNull();
  });

  it('lifts a warning only as the file writes it, and only beside the place', () => {
    const step = '**Cross to Daxing (PKX) — NOT Capital (PEK).** Qinghe → Daxing ~1 h 20 by taxi';
    expect(warnAt(step, ['PKX', 'Beijing', 'Daxing'])).toBe('NOT Capital');
    /* a lower-case "not" is prose, not the file's warning */
    expect(warnAt('The bag rides Tina’s bus, not the inn', ['Tina'])).toBeNull();
    /* a NOT about somewhere else, far from this place, is not this place's */
    expect(warnAt(step, ['Qinghe'])).toBeNull();
    expect(warnAt('Dali station is in Xiaguan, NOT the old town', ['Kunming'])).toBeNull();
  });

  /* Run 3c: the name after NOT was one word — "NOT Beijing South" became
     "NOT Beijing", the wrong station — and a shouted status after a NOT
     would have become a warning */
  it('lifts every word of the name the NOT rules out, and never a shouted status', () => {
    expect(warnAt('Arrive at Beijing West — NOT Beijing South', ['West'])).toBe('NOT Beijing South');
    expect(warnAt('Kunming Station 昆明站, NOT Kunming South Railway Station', ['昆明站'])).toBe('NOT Kunming South Railway Station');
    expect(warnAt('Daxing (PKX) — NOT Capital (PEK)', ['PKX'])).toBe('NOT Capital');
    /* shouted words are statuses, not places */
    expect(warnAt('Train to Qinghe — NOT BOOKED YET', ['Qinghe'])).toBeNull();
    expect(warnAt('Qinghe — NOT BOOKED', ['Qinghe'])).toBeNull();
    expect(warnAt('Qinghe — NOT A walk-up', ['Qinghe'])).toBeNull();
    /* the name stops at the first word that is not Title-case */
    expect(warnAt('Beijing West — NOT Beijing South station', ['West'])).toBe('NOT Beijing South');
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
    const rows = metroRows(line('2026-12-11', { ticked: (i) => i <= 1 }));
    expect(rows.map((r) => r.kind).join(' ')).toBe('st seg st seg st seg st');
    const [bed, t0, pvg, fly, dyg, t1, pull] = rows;
    expect(bed!.sub).toBe('checked out');
    expect(bed!.dot).toBe('bed');
    expect(t0!.rail).toBe('r done transfer');
    expect(t0!.facts).toBe('Transfer · see step 2');
    expect(pvg!.you).toBe(true);
    expect(pvg!.dot).toBe('you');
    expect(pvg!.time).toBe('19:10');
    expect(fly!.rail).toBe('r now leg flow');
    expect(fly!.air).toBe(true);
    expect(fly!.label).toBe('MU 394');
    expect(fly!.chip?.cls).toBe('ok'); // booked 17 Oct 2026
    expect(fly!.facts).toBe('19:10 → 21:40 · 2h 30m');
    expect(fly!.booking?.id).toBe('cn26-flight-mu394');
    expect(dyg!.arrow).toBe(true); // the calm arrowhead of MU394 lands at DYG
    expect(dyg!.time).toBe('21:40');
    expect(t1!.facts).toBe('Transfer · see step 7');
    expect(pull!.sub).toBe('tonight’s bed');
    expect(pull!.time).toBe('≈22:30');
    expect(pull!.booking?.id).toBe('cn26-stay-03');
    expect(pull!.down).toBe('');
  });

  it('a segment finished with Done inks itself, once', () => {
    const rows = metroRows(line('2026-12-11', { ticked: (i) => i <= 3 }), 1); // segment 1, MU394, finished with step 4
    expect(rows[3]!.rail).toBe('r done leg ink');
    expect(rows[1]!.rail).toBe('r done transfer');
  });

  it('a gap nothing covers says so, and carries no transfer words', () => {
    /* Dec 5 on the trip as it stood until 28 Sep — the real trip has no gap left */
    const rows = metroRows(line('2026-12-05', { bookings: before }));
    expect(rows[1]!.missing).toBe(true);
    expect(rows[1]!.facts).toBe('');
  });
});

describe('metro line · the Focus card', () => {
  const rb = china.runbooks.find((r) => r.id === 'cn26-run-dec11')!;
  it('the first step is its own words — leaving the bag is not a move', () => {
    const f = focusOf(line('2026-12-11'), rb.steps, 0)!;
    expect(f).toMatchObject({ n: 1, of: 7 });
    expect(f.title).toBeUndefined();
    expect(f.text).toMatch(/^Breakfast, check out by 12:00, and \*\*leave the bag at Hi Cozy\*\*/);
    expect(metroRows(line('2026-12-11'))[0]!.sub).toBe('check out by ~15:30');
  });

  it('the crossing leaves the Hi Cozy hostel for Pudong, with its times and its warning', () => {
    const f = focusOf(line('2026-12-11', { ticked: (i) => i === 0 }), rb.steps, 1)!;
    expect(f).toMatchObject({ n: 2, of: 7, title: 'Hi Cozy International Hostel East Nanjing Road & The Bund & 24h English Services → Shanghai Pudong Intl · Terminal 1', facts: 'check out by ~15:30 · by 17:10', warn: 'NOT Hongqiao' });
    expect(f.card).toBeUndefined(); // Pudong has no verified driver card
    expect(f.chip).toBeUndefined();
  });

  it('holds the flight as a move, booked', () => {
    const f = focusOf(line('2026-12-11', { ticked: (i) => i <= 2 }), rb.steps, 3)!;
    expect(f).toMatchObject({ n: 4, of: 7, title: 'MU 394 PVG → DYG', facts: '19:10 → 21:40 · 2h 30m' });
    expect(f.chip?.cls).toBe('ok');
    expect(f.warn).toBeUndefined();
  });

  it('a step that is not a move is its own words', () => {
    const f = focusOf(line('2026-12-11'), rb.steps, 4)!;
    expect(f.text).toBe('Checked bag 20 kg (40×60×100) + one 8 kg carry-on (20×40×55) — on the booking');
    expect(f.title).toBeUndefined();
  });

  it('nothing to focus once every step is done', () => {
    expect(focusOf(line('2026-12-11'), rb.steps, null)).toBeNull();
    expect(segTitle({ kind: 'leg', mode: 'air', label: 'CA 8609', step: null, verify: false, state: 'ahead' }, { name: 'x', code: 'PKX' }, { name: 'y', code: 'DYG' })).toBe('CA 8609 PKX → DYG');
    expect(legFacts({ kind: 'transfer', mode: 'transfer', label: '', step: null, verify: false, state: 'ahead' })).toBe('');
  });
});
