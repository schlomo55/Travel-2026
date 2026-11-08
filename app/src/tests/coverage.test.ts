/* Coverage — is each leg of the trip actually booked?
   Tested against the seed files rather than a synthetic fixture, because the
   demo trip carries every interesting case this module handles: a week held
   with no code, a night before the first stop opens, two walk-up road legs and
   a walk-in bed. The two genuine gaps are made by removing one booking each. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Booking, HotelBooking, Stop, Trip } from '../lib/model/types';
import {
  BOOKING_WINDOW_DAYS,
  buildCoverage,
  coverageByStop,
  coverageStamp,
} from '../lib/logic/coverage';
import { addDays, compareIso } from '../lib/logic/dates';

const repo = join(__dirname, '..', '..', '..');

interface SeedTrip {
  trip: Trip;
  stops: Stop[];
  bookings: Booking[];
}
function readSeed(name: string): SeedTrip {
  const raw = JSON.parse(readFileSync(join(repo, 'seed', name), 'utf8')) as { trips: SeedTrip[] };
  return raw.trips[0]!;
}

const demo = readSeed('demo-2027.trip.json');
/* The day the demo seed was built — far outside every booking window, which
   is the state a reader sees when they open the app months before the trip. */
const TODAY = '2026-11-08';

const segs = buildCoverage(demo.trip, demo.stops, demo.bookings, TODAY);
const byStop = coverageByStop(segs);

/* THE TRIP WITH TWO HOLES — the demo seed minus two bookings, made in the
   test: the Station Inn for the night of Mar 20 and the G7520 train of Mar 29.
   The cases this module was built for — a night that belongs to no stop, a
   move with nothing booked — are proved on those two holes. The demo trip
   itself is asserted separately: it has no hole on the Hangzhou leg. */
const HOLES = new Set(['dm27-stay-01', 'dm27-train-mar29']);
const before = demo.bookings.filter((b) => !HOLES.has(b.id));
const byStopBefore = coverageByStop(buildCoverage(demo.trip, demo.stops, before, TODAY));

describe('coverage · the demo trip', () => {
  it('reports one segment per real stop and never the transit phase', () => {
    expect(segs.length).toBe(9);
    expect(segs.map((s) => s.stopId)).not.toContain('dm27-stop-flights');
    expect(segs[0]?.stopId).toBe('dm27-stop-hangzhou');
    expect(segs[segs.length - 1]?.stopId).toBe('dm27-stop-hongkong');
  });

  /* THE CASE THE MODULE EXISTS FOR. The school collects you on Sunday the
     21st, so the Hangzhou stop begins on the 21st — and the night of the 20th,
     on the ground by Hangzhou East, belongs to no stop window of its own. */
  it('answers for the arrival night that belongs to no stop window', () => {
    /* Without the Station Inn: on the ground, nothing booked, owned by no stop. */
    const was = byStopBefore.get('dm27-stop-hangzhou')!;
    expect(was.from).toBe('2027-03-20');
    expect(was.end).toBe('2027-03-29');
    expect(was.nights.length).toBe(9);
    const wasMar20 = was.nights.find((n) => n.date === '2027-03-20')!;
    expect(wasMar20.state).toBe('missing');
    expect(wasMar20.booking).toBeNull();
    expect(was.bedsMissing).toBe(1);
    /* On the demo trip: the Station Inn covers it, in the same segment. */
    const hz = byStop.get('dm27-stop-hangzhou')!;
    expect(hz.from).toBe('2027-03-20');
    expect(hz.nights.length).toBe(9);
    const mar20 = hz.nights.find((n) => n.date === '2027-03-20')!;
    expect(mar20.state).toBe('booked');
    expect(mar20.booking?.id).toBe('dm27-stay-01');
    expect(hz.bedsMissing).toBe(0);
  });

  /* The school week IS a booking (dm27-stay-02), held with no code and paid in
     cash on arrival — eight nights that must never read as unbooked. The
     ninth night of the segment is the Station Inn's, not the school's. */
  it('counts the school week as held', () => {
    const hz = byStop.get('dm27-stop-hangzhou')!;
    const held = hz.nights.filter((n) => n.state === 'booked' && n.booking?.id === 'dm27-stay-02');
    expect(held.length).toBe(8);
    expect(held[0]?.date).toBe('2027-03-21');
    expect(held[held.length - 1]?.date).toBe('2027-03-28');
    expect(hz.nights.filter((n) => n.state === 'booked').length).toBe(9);
  });

  it('names the missing bed on the Hangzhou chip while the night is open', () => {
    const was = byStopBefore.get('dm27-stop-hangzhou')!;
    expect(was.state).toBe('missing');
    expect(was.tone).toBe('warn');
    expect(was.bedsMissing).toBe(1);
    expect(coverageStamp(was)).toEqual({ label: '⚠ bed missing', cls: 'warn' });
  });

  /* With the Station Inn and G7520 both booked, the Hangzhou leg — the first
     stop on the trip — reads the way Hong Kong does. */
  it('reports the Hangzhou leg as entirely booked', () => {
    const hz = byStop.get('dm27-stop-hangzhou')!;
    expect(hz.nights.every((n) => n.state === 'booked')).toBe(true);
    expect(hz.legs.map((l) => l.state)).toEqual(['booked', 'booked']);
    expect(hz.missing).toBe(0);
    expect(coverageStamp(hz)).toEqual({ label: 'All booked ✓', cls: 'ok' });
  });

  /* Mar 29, Hangzhou → Shanghai: without G7520 nothing is bought.
     connectors.ts calls it `none`; this counts it on both sides of the
     hand-over, because it is both stops' problem. */
  it('counts the Mar 29 gap as a missing move, on both segments it joins', () => {
    const hz = byStopBefore.get('dm27-stop-hangzhou')!;
    const sh = byStopBefore.get('dm27-stop-shanghai')!;
    expect(hz.legsMissing).toBe(1);
    expect(hz.legs.find((l) => l.role === 'out')?.state).toBe('none');
    expect(sh.legsMissing).toBe(1);
    expect(sh.legs.find((l) => l.role === 'in')?.state).toBe('none');
    expect(sh.bedsMissing).toBe(0);
    expect(sh.state).toBe('missing');
    expect(coverageStamp(sh).label).toBe('⚠ move unbooked');
  });

  it('closes the Mar 29 gap with G7520, on both segments it joins', () => {
    const hz = byStop.get('dm27-stop-hangzhou')!;
    const sh = byStop.get('dm27-stop-shanghai')!;
    expect(hz.legsMissing).toBe(0);
    expect(hz.legs.find((l) => l.role === 'out')?.state).toBe('booked');
    expect(sh.legsMissing).toBe(0);
    const arrive = sh.legs.find((l) => l.role === 'in')!;
    expect(arrive.state).toBe('booked');
    expect(arrive.connector.legs.map((b) => b.id)).toContain('dm27-train-mar29');
    expect(segs.reduce((n, s) => n + s.legsMissing + s.bedsMissing, 0)).toBe(0);
  });

  it('reports Hong Kong as entirely booked', () => {
    const hk = byStop.get('dm27-stop-hongkong')!;
    expect(hk.nights.length).toBe(4);
    expect(hk.nights.every((n) => n.state === 'booked')).toBe(true);
    expect(hk.legs.map((l) => l.state)).toEqual(['booked', 'booked']);
    expect(hk.state).toBe('ok');
    expect(hk.tone).toBe('ok');
    expect(hk.pending + hk.missing).toBe(0);
    expect(coverageStamp(hk)).toEqual({ label: 'All booked ✓', cls: 'ok' });
  });

  /* THE WALK-UP LEGS ARE NOT GAPS. The public bus into the terraces and the
     shared car out of them are arranged on the day — their own cards say so.
     They carry a card and no reservation, which connectors.ts calls `planned`. */
  it('treats the Longji road legs as planned, never as gaps', () => {
    const longji = byStop.get('dm27-stop-longji')!;
    expect(longji.legs.map((l) => l.state)).toEqual(['planned', 'planned']);
    expect(longji.legsMissing).toBe(0);
    expect(longji.legsPending).toBe(2);
    expect(longji.missing).toBe(0);
    expect(longji.state).toBe('pending');
    expect(longji.pending).toBe(2);
    expect(longji.tone).toBe('warn');
    expect(coverageStamp(longji)).toEqual({ label: '2 pending', cls: 'warn' });
  });

  it('reports the Longji walk-in as covered, and still says it is a walk-in', () => {
    const longji = byStop.get('dm27-stop-longji')!;
    expect(longji.nights.length).toBe(1);
    expect(longji.nights[0]?.state).toBe('walkin');
    expect(longji.bedsMissing).toBe(0);
    expect(longji.nights.filter((n) => n.state !== 'booked').map((n) => n.state)).toEqual(['walkin']);
  });

  /* Every night of the trip belongs to exactly one segment — the property that
     makes a blank impossible. The night of the 19th is spent aboard AY 9057 and
     is owned by the transit phase, which is not a place and is never reported;
     the night of Apr 17 is aboard AY 9070, after the last stop closes. */
  it('partitions the trip into segments with no night counted twice', () => {
    const seen = new Set<string>();
    for (const s of segs) {
      for (const n of s.nights) {
        expect(seen.has(n.date)).toBe(false);
        seen.add(n.date);
      }
    }
    expect(seen.has('2027-03-19')).toBe(false);
    let d = '2027-03-20';
    while (compareIso(d, '2027-04-17') < 0) {
      expect(seen.has(d)).toBe(true);
      d = addDays(d, 1);
    }
    expect(seen.size).toBe(28);
  });

  it('never counts a night as missing while it is spent in the air', () => {
    /* Widen the first segment to the trip's own start by removing the transit
       phase: the night of the 19th then falls to Hangzhou, and must read as
       transit rather than as a hole nobody could have filled. */
    const noTransit = demo.stops.filter((s) => s.kind === 'stop');
    const alt = buildCoverage(demo.trip, noTransit, demo.bookings, TODAY);
    const hz = alt.find((s) => s.stopId === 'dm27-stop-hangzhou')!;
    expect(hz.from).toBe('2027-03-19');
    expect(hz.nights.find((n) => n.date === '2027-03-19')?.state).toBe('transit');
    expect(hz.bedsMissing).toBe(0);
    /* and on the trip with holes, the one bed hole is Mar 20 — never the 19th */
    const altBefore = buildCoverage(demo.trip, noTransit, before, TODAY).find((s) => s.stopId === 'dm27-stop-hangzhou')!;
    expect(altBefore.bedsMissing).toBe(1);
    expect(altBefore.nights.find((n) => n.date === '2027-03-19')?.state).toBe('transit');
  });

  it('excludes the Mar 20 later-train fallback from the legs it counts', () => {
    const hz = byStop.get('dm27-stop-hangzhou')!;
    const arrive = hz.legs.find((l) => l.role === 'in')!;
    expect(arrive.state).toBe('booked');
    expect(arrive.connector.legs.map((b) => b.id)).not.toContain('dm27-train-mar20-late');
    expect(arrive.connector.alternatives.map((b) => b.id)).toContain('dm27-train-mar20-late');
  });
});

describe('coverage · escalation', () => {
  /* Proved on the trip with holes, which has the Mar 20 bed hole. */
  const hzAt = (now: string) =>
    coverageByStop(buildCoverage(demo.trip, demo.stops, before, now)).get('dm27-stop-hangzhou')!;

  it('stays amber while the hole is months away', () => {
    expect(hzAt('2026-11-08').tone).toBe('warn');
    expect(hzAt(addDays('2027-03-20', -(BOOKING_WINDOW_DAYS + 1))).tone).toBe('warn');
  });

  it('goes red inside the booking window and while you are living the segment', () => {
    expect(hzAt(addDays('2027-03-20', -BOOKING_WINDOW_DAYS)).tone).toBe('crit');
    expect(hzAt('2027-03-20').tone).toBe('crit');
    expect(hzAt('2027-03-25').tone).toBe('crit');
  });

  /* A night that has already passed cannot be booked any more. It stays true
     and stops being urgent — red that fires on the unfixable teaches the
     reader to skip red. */
  it('drops back to amber once the segment is over', () => {
    expect(hzAt('2027-03-29').tone).toBe('warn');
    expect(hzAt('2027-04-08').tone).toBe('warn');
  });

  it('never escalates a segment that is merely pending', () => {
    const longji = coverageByStop(buildCoverage(demo.trip, demo.stops, demo.bookings, '2027-04-11')).get(
      'dm27-stop-longji',
    )!;
    expect(longji.state).toBe('pending');
    expect(longji.tone).toBe('warn');
  });

  it('leaves every tone amber when no date is given', () => {
    const undated = buildCoverage(demo.trip, demo.stops, demo.bookings, null);
    expect(undated.every((s) => s.tone !== 'crit')).toBe(true);
  });
});

describe('coverage · it flips by data alone', () => {
  const inn: HotelBooking = {
    ...(demo.bookings.find((b) => b.id === 'dm27-stay-09') as HotelBooking),
    id: 'test-inn',
    title: 'A Hangzhou East bed',
    stopId: 'dm27-stop-hangzhou',
    status: 'booked',
    date: '2027-03-20',
    checkIn: '2027-03-20',
    checkOut: '2027-03-21',
  };

  /* All three start from the trip with holes (`before`), where Mar 20 has no
     bed and Mar 29 no move — the demo's own Station Inn (dm27-stay-01) is the
     same shape as `inn` here. */
  it('clears the missing bed the moment a stay covers the night', () => {
    const after = coverageByStop(
      buildCoverage(demo.trip, demo.stops, [...before, inn], TODAY),
    ).get('dm27-stop-hangzhou')!;
    expect(after.bedsMissing).toBe(0);
    expect(after.nights.find((n) => n.date === '2027-03-20')?.booking?.id).toBe('test-inn');
    /* The Mar 29 gap is still a gap, so the chip changes what it names rather
       than going quiet — the loudest remaining truth. */
    expect(after.legsMissing).toBe(1);
    expect(after.state).toBe('missing');
    expect(coverageStamp(after).label).toBe('⚠ move unbooked');
  });

  it('ignores a cancelled bed and an alternative one', () => {
    const dead: Booking[] = [
      { ...inn, id: 'test-cancelled', status: 'cancelled' },
      { ...inn, id: 'test-alternative', alternative: true },
    ];
    const after = coverageByStop(
      buildCoverage(demo.trip, demo.stops, [...before, ...dead], TODAY),
    ).get('dm27-stop-hangzhou')!;
    expect(after.bedsMissing).toBe(1);
  });

  it('prefers the held stay when two cover the same night', () => {
    const pending: HotelBooking = { ...inn, id: 'test-pending', status: 'pending' };
    const after = coverageByStop(
      buildCoverage(demo.trip, demo.stops, [...before, pending, inn], TODAY),
    ).get('dm27-stop-hangzhou')!;
    expect(after.nights.find((n) => n.date === '2027-03-20')?.state).toBe('booked');
  });
});

describe('coverage · other trips', () => {
  it('reads the Israel sample trip without crashing', () => {
    const il = readSeed('israel-test.trip.json');
    const out = buildCoverage(il.trip, il.stops, il.bookings, '2026-08-12');
    expect(out.length).toBe(8);
    expect(out.every((s) => s.nights.length > 0)).toBe(true);
    /* Its beds are a mix of held, pending and one walk-in; none is absent. */
    expect(out.reduce((n, s) => n + s.bedsMissing, 0)).toBe(0);
    expect(out.some((s) => s.bedsPending > 0)).toBe(true);
    expect(out.some((s) => s.state === 'pending')).toBe(true);
  });

  it('returns nothing for a trip with no stops', () => {
    expect(buildCoverage(demo.trip, [], demo.bookings, TODAY)).toEqual([]);
  });

  it('survives a trip whose only stop is the transit phase', () => {
    const only = demo.stops.filter((s) => s.kind === 'transit');
    expect(buildCoverage(demo.trip, only, demo.bookings, TODAY)).toEqual([]);
  });
});
