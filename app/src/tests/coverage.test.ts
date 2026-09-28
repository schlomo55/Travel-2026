/* Coverage — is each leg of the trip actually booked?
   Tested against the REAL seed files rather than a synthetic fixture, because
   every interesting case in this module came from the real one: a fortnight
   held with no price, a night that belongs to no stop, two walk-up road legs
   and one genuine gap. A hand-made trip would have had none of them. */
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

const china = readSeed('china-2026.trip.json');
/* The day the run was built — far outside every booking window, which is the
   state the owner sees when he opens the app today. */
const TODAY = '2026-08-12';

const segs = buildCoverage(china.trip, china.stops, china.bookings, TODAY);
const byStop = coverageByStop(segs);

describe('coverage · the China trip', () => {
  it('reports one segment per real stop and never the transit phase', () => {
    expect(segs.length).toBe(10);
    expect(segs.map((s) => s.stopId)).not.toContain('cn26-stop-flights');
    expect(segs[0]?.stopId).toBe('cn26-stop-kunyu');
    expect(segs[segs.length - 1]?.stopId).toBe('cn26-stop-hongkong');
  });

  /* THE CASE THE MODULE EXISTS FOR. The academy takes arrivals Mon/Tue/Wed
     only, so the Kunyu stop begins on the 23rd and the night of the 22nd — on
     the ground in Yantai, nothing booked — belonged to no stop at all. */
  it('answers for the Yantai city night that belongs to no stop window', () => {
    const kunyu = byStop.get('cn26-stop-kunyu')!;
    expect(kunyu.from).toBe('2026-11-22');
    expect(kunyu.end).toBe('2026-12-05');
    expect(kunyu.nights.length).toBe(13);
    const nov22 = kunyu.nights.find((n) => n.date === '2026-11-22')!;
    expect(nov22.state).toBe('missing');
    expect(nov22.booking).toBeNull();
    expect(kunyu.bedsMissing).toBe(1);
  });

  /* The fortnight IS a booking since 12 Aug (cn26-stay-11), priceless and
     codeless but held — twelve nights that must never read as unbooked. */
  it('counts the academy fortnight as held', () => {
    const kunyu = byStop.get('cn26-stop-kunyu')!;
    const held = kunyu.nights.filter((n) => n.state === 'booked');
    expect(held.length).toBe(12);
    expect(held[0]?.date).toBe('2026-11-23');
    expect(held[held.length - 1]?.date).toBe('2026-12-04');
    expect(new Set(held.map((n) => n.booking?.id))).toEqual(new Set(['cn26-stay-11']));
  });

  it('names the missing bed on the Yantai chip', () => {
    const kunyu = byStop.get('cn26-stop-kunyu')!;
    expect(kunyu.state).toBe('missing');
    expect(kunyu.tone).toBe('warn');
    expect(kunyu.bedsMissing).toBe(1);
    expect(coverageStamp(kunyu)).toEqual({ label: '⚠ bed missing', cls: 'warn' });
  });

  /* Dec 5, Yantai → Beijing: neither the flight nor the train has been bought
     and the choice is still open. connectors.ts calls it `none`; this counts it
     on both sides of the hand-over, because it is both stops' problem. */
  it('counts the Dec 5 gap as a missing move, on both segments it joins', () => {
    const kunyu = byStop.get('cn26-stop-kunyu')!;
    const beijing = byStop.get('cn26-stop-beijing')!;
    expect(kunyu.legsMissing).toBe(1);
    expect(kunyu.legs.find((l) => l.role === 'out')?.state).toBe('none');
    expect(beijing.legsMissing).toBe(1);
    expect(beijing.legs.find((l) => l.role === 'in')?.state).toBe('none');
    expect(beijing.bedsMissing).toBe(0);
    expect(beijing.state).toBe('missing');
    expect(coverageStamp(beijing).label).toBe('⚠ move unbooked');
  });

  it('reports Hong Kong as entirely booked', () => {
    const hk = byStop.get('cn26-stop-hongkong')!;
    expect(hk.nights.length).toBe(5);
    expect(hk.nights.every((n) => n.state === 'booked')).toBe(true);
    expect(hk.legs.map((l) => l.state)).toEqual(['booked', 'booked']);
    expect(hk.state).toBe('ok');
    expect(hk.tone).toBe('ok');
    expect(hk.pending + hk.missing).toBe(0);
    expect(coverageStamp(hk)).toEqual({ label: 'All booked ✓', cls: 'ok' });
  });

  /* THE WALK-UP LEGS ARE NOT GAPS. The early bus into the gorge and the shared
     car out of it are walk-up, no advance sale — their own cards say so. They
     carry a card and no reservation, which connectors.ts calls `planned`. */
  it('treats the Tiger Leaping Gorge road legs as planned, never as gaps', () => {
    const gorge = byStop.get('cn26-stop-gorge')!;
    expect(gorge.legs.map((l) => l.state)).toEqual(['planned', 'planned']);
    expect(gorge.legsMissing).toBe(0);
    expect(gorge.legsPending).toBe(2);
    expect(gorge.missing).toBe(0);
    expect(gorge.state).toBe('pending');
    expect(gorge.pending).toBe(2);
    expect(gorge.tone).toBe('warn');
    expect(coverageStamp(gorge)).toEqual({ label: '2 pending', cls: 'warn' });
  });

  it('reports the gorge walk-in as covered, and still says it is a walk-in', () => {
    const gorge = byStop.get('cn26-stop-gorge')!;
    expect(gorge.nights.length).toBe(1);
    expect(gorge.nights[0]?.state).toBe('walkin');
    expect(gorge.bedsMissing).toBe(0);
    expect(gorge.nights.filter((n) => n.state !== 'booked').map((n) => n.state)).toEqual(['walkin']);
  });

  /* Every night of the trip belongs to exactly one segment — the property that
     makes a blank impossible. The night of the 21st is spent aboard EY 888 and
     is owned by the transit phase, which is not a place and is never reported. */
  it('partitions the trip into segments with no night counted twice', () => {
    const seen = new Set<string>();
    for (const s of segs) {
      for (const n of s.nights) {
        expect(seen.has(n.date)).toBe(false);
        seen.add(n.date);
      }
    }
    expect(seen.has('2026-11-21')).toBe(false);
    let d = '2026-11-22';
    while (compareIso(d, '2026-12-26') < 0) {
      expect(seen.has(d)).toBe(true);
      d = addDays(d, 1);
    }
    expect(seen.size).toBe(34);
  });

  it('never counts a night as missing while it is spent in the air', () => {
    /* Widen the first segment to the trip's own start by removing the transit
       phase: the night of the 21st then falls to Kunyu, and must read as
       transit rather than as a hole nobody could have filled. */
    const noTransit = china.stops.filter((s) => s.kind === 'stop');
    const alt = buildCoverage(china.trip, noTransit, china.bookings, TODAY);
    const kunyu = alt.find((s) => s.stopId === 'cn26-stop-kunyu')!;
    expect(kunyu.from).toBe('2026-11-21');
    expect(kunyu.nights.find((n) => n.date === '2026-11-21')?.state).toBe('transit');
    expect(kunyu.bedsMissing).toBe(1);
  });

  it('excludes the Nov 22 HSR fallback from the legs it counts', () => {
    const kunyu = byStop.get('cn26-stop-kunyu')!;
    const arrive = kunyu.legs.find((l) => l.role === 'in')!;
    expect(arrive.state).toBe('booked');
    expect(arrive.connector.legs.map((b) => b.id)).not.toContain('cn26-train-nov22');
    expect(arrive.connector.alternatives.map((b) => b.id)).toContain('cn26-train-nov22');
  });
});

describe('coverage · escalation', () => {
  const kunyuAt = (now: string) =>
    coverageByStop(buildCoverage(china.trip, china.stops, china.bookings, now)).get('cn26-stop-kunyu')!;

  it('stays amber while the hole is months away', () => {
    expect(kunyuAt('2026-08-12').tone).toBe('warn');
    expect(kunyuAt(addDays('2026-11-22', -(BOOKING_WINDOW_DAYS + 1))).tone).toBe('warn');
  });

  it('goes red inside the booking window and while you are living the segment', () => {
    expect(kunyuAt(addDays('2026-11-22', -BOOKING_WINDOW_DAYS)).tone).toBe('crit');
    expect(kunyuAt('2026-11-22').tone).toBe('crit');
    expect(kunyuAt('2026-12-01').tone).toBe('crit');
  });

  /* A night that has already passed cannot be booked any more. It stays true
     and stops being urgent — red that fires on the unfixable teaches the
     reader to skip red. */
  it('drops back to amber once the segment is over', () => {
    expect(kunyuAt('2026-12-05').tone).toBe('warn');
    expect(kunyuAt('2026-12-15').tone).toBe('warn');
  });

  it('never escalates a segment that is merely pending', () => {
    const gorge = coverageByStop(buildCoverage(china.trip, china.stops, china.bookings, '2026-12-18')).get(
      'cn26-stop-gorge',
    )!;
    expect(gorge.state).toBe('pending');
    expect(gorge.tone).toBe('warn');
  });

  it('leaves every tone amber when no date is given', () => {
    const undated = buildCoverage(china.trip, china.stops, china.bookings, null);
    expect(undated.every((s) => s.tone !== 'crit')).toBe(true);
  });
});

describe('coverage · it flips by data alone', () => {
  const yantai: HotelBooking = {
    ...(china.bookings.find((b) => b.id === 'cn26-stay-09') as HotelBooking),
    id: 'test-yantai',
    title: 'A Yantai city bed',
    status: 'booked',
    date: '2026-11-22',
    checkIn: '2026-11-22',
    checkOut: '2026-11-23',
  };

  it('clears the missing bed the moment a stay covers the night', () => {
    const after = coverageByStop(
      buildCoverage(china.trip, china.stops, [...china.bookings, yantai], TODAY),
    ).get('cn26-stop-kunyu')!;
    expect(after.bedsMissing).toBe(0);
    expect(after.nights.find((n) => n.date === '2026-11-22')?.booking?.id).toBe('test-yantai');
    /* The Dec 5 gap is still a gap, so the chip changes what it names rather
       than going quiet — the loudest remaining truth. */
    expect(after.legsMissing).toBe(1);
    expect(after.state).toBe('missing');
    expect(coverageStamp(after).label).toBe('⚠ move unbooked');
  });

  it('ignores a cancelled bed and an alternative one', () => {
    const dead: Booking[] = [
      { ...yantai, id: 'test-cancelled', status: 'cancelled' },
      { ...yantai, id: 'test-alternative', alternative: true },
    ];
    const after = coverageByStop(
      buildCoverage(china.trip, china.stops, [...china.bookings, ...dead], TODAY),
    ).get('cn26-stop-kunyu')!;
    expect(after.bedsMissing).toBe(1);
  });

  it('prefers the held stay when two cover the same night', () => {
    const pending: HotelBooking = { ...yantai, id: 'test-pending', status: 'pending' };
    const after = coverageByStop(
      buildCoverage(china.trip, china.stops, [...china.bookings, pending, yantai], TODAY),
    ).get('cn26-stop-kunyu')!;
    expect(after.nights.find((n) => n.date === '2026-11-22')?.state).toBe('booked');
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
    expect(buildCoverage(china.trip, [], china.bookings, TODAY)).toEqual([]);
  });

  it('survives a trip whose only stop is the transit phase', () => {
    const only = china.stops.filter((s) => s.kind === 'transit');
    expect(buildCoverage(china.trip, only, china.bookings, TODAY)).toEqual([]);
  });
});
