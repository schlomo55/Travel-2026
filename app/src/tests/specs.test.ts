/* AN EDIT KEEPS WHAT THE FORM DOES NOT SHOW (Horizon Run 4).

   Every editor (lib/components/forms/specs.ts) turns a record into form values
   and back. Until Run 4 each `fromValues` rebuilt the record from a hand-picked
   list, so a field the form has no input for was deleted by an edit: an
   unchanged save of a China stop took away its spots and its options (the Map
   track found it), a day lost its "Places today" links, the Nov 22 train lost
   the flag that makes it the OR-ELSE of the Yantai flight, a road leg its ends.

   The property that defines the bug, over every record of all three seeds and
   every editor: open it, change nothing, save — and the record is the record
   (a save restamps `updatedAt`, and a few shown fields write their empty form:
   a flight's alert toggle `false`, a stay's Gmail search its title, a card's
   balance `null`). Then the cases by name, a field no form knows, a cleared
   field, and a booking whose kind the edit changes. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking, DayPlan, FlightBooking, HotelBooking, Stop, TripBundle } from '../lib/model/types';
import type { FormSpec } from '../lib/components/forms/types';
import * as specs from '../lib/components/forms/specs';

const seed = (f: string): TripBundle =>
  (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', f), 'utf8')) as AppBackup).trips[0]!;
const SEEDS = ['china-2026.trip.json', 'israel-test.trip.json', 'template-example.trip.json'].map((f) => [f, seed(f)] as const);
const china = SEEDS[0]![1];
/* what the database write does to a record (lib/data/edit.ts plain()) */
const stored = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* every editor, and the records it edits */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editors(b: TripBundle): [string, FormSpec<any>, unknown[]][] {
  const t = b.trip.id;
  return [
    ['stop', specs.stopSpec(t, 0), b.stops],
    ['day', specs.dayPlanSpec(t, b.trip.start, b.runbooks), b.dayPlans],
    ['runbook', specs.runbookSpec(t), b.runbooks],
    ['flight', specs.flightSpec(t), b.bookings.filter((x) => x.kind === 'flight')],
    ['stay', specs.staySpec(t), b.bookings.filter((x) => x.kind === 'hotel')],
    ['train / activity / other', specs.otherBookingSpec(t), b.bookings.filter((x) => x.kind !== 'flight' && x.kind !== 'hotel')],
    ['wallet card', specs.walletCardSpec(t, 0, b.trip.homeCurrency), b.walletCards],
    ['task', specs.taskSpec(t, 0), b.tasks],
    ['alarm', specs.alarmSpec(t), b.alarms],
    ['packing item', specs.packingItemSpec(t, [], 0), b.packingItems],
    ['checklist', specs.checklistSpec(t, 0), b.checklists],
    ['driver or phrase card', specs.showCardSpec(t, 0), b.showCards],
    ['emergency number', specs.emergencySpec(t, 0), b.emergency],
    ['good to know', specs.infoCardSpec(t, 0), b.infoCards],
    ['visa clock', specs.counterSpec(t), b.counters],
  ];
}
/* the fields a save writes whatever the record held */
const STAMPED = new Set(['updatedAt']);
const EMPTY_FORM: Record<string, (rec: Record<string, unknown>, v: unknown) => boolean> = {
  alert: (_r, v) => v === false,
  gmailQuery: (r, v) => v === r.title,
  balance: (_r, v) => v === null,
};

/** Open the editor on `rec`, change nothing (or what `edit` changes), save. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function save<T>(spec: FormSpec<T>, rec: T, edit?: (v: Record<string, any>) => void): T {
  const v = spec.toValues(rec);
  edit?.(v);
  expect(spec.validate?.(v) ?? null).toBeNull();
  return stored(spec.fromValues(v, rec));
}

describe('editors · an unchanged save keeps the record', () => {
  for (const [file, b] of SEEDS) {
    for (const [name, spec, rows] of editors(b)) {
      it(`${file.split('.')[0]} · the ${name} editor (${rows.length})`, () => {
        const problems: string[] = [];
        for (const r of rows) {
          const want = stored(r) as Record<string, unknown>;
          const got = save(spec, r) as Record<string, unknown>;
          for (const k of Object.keys(want)) {
            if (!(k in got)) problems.push(`${String(want.id)} lost ${k}`);
            else if (!STAMPED.has(k) && JSON.stringify(got[k]) !== JSON.stringify(want[k])) problems.push(`${String(want.id)} changed ${k}`);
          }
          for (const k of Object.keys(got)) {
            if (k in want) continue;
            if (!EMPTY_FORM[k]?.(want, got[k])) problems.push(`${String(want.id)} added ${k}=${JSON.stringify(got[k])}`);
          }
        }
        expect(problems).toEqual([]);
      });
    }
  }

  /* a field a later trip file adds — the Map track's place categories, say —
     is not one any form knows; it must ride through every editor */
  it('a field no form knows survives every editor', () => {
    const lost: string[] = [];
    for (const [name, spec, rows] of editors(china)) {
      for (const r of rows.slice(0, 3)) {
        const got = save(spec, { ...(r as object), later: { category: 'food', line: 'one real line' } }) as { later?: unknown };
        if (JSON.stringify(got.later) !== '{"category":"food","line":"one real line"}') lost.push(name);
      }
    }
    expect([...new Set(lost)]).toEqual([]);
  });
});

describe('editors · the cases the bug hit', () => {
  const stopSpec = specs.stopSpec(china.trip.id, 0);

  /* THE REPORTED ONE: edit a stop (rename it), and its guide keeps its options
     and every place on its map */
  it('renaming a stop keeps its spots, its options, its blocks and its budget', () => {
    const zjj = china.stops.find((s) => s.id === 'cn26-stop-zhangjiajie')!;
    expect(zjj.spots?.length).toBeGreaterThan(0);
    expect(zjj.options?.length).toBeGreaterThan(0);
    const got = save(stopSpec, zjj, (v) => (v.name = `${zjj.name} (edited)`));
    expect(got.name).toBe(`${zjj.name} (edited)`);
    expect(got.spots).toEqual(stored(zjj.spots));
    expect(got.options).toEqual(stored(zjj.options));
    expect(got.blocks).toEqual(stored(zjj.blocks));
    expect(got.recoBlocks).toEqual(stored(zjj.recoBlocks));
    expect(got.costNote).toBe(zjj.costNote);
    expect(got.coord).toEqual(zjj.coord);
    expect(got.photoDocId).toBe(zjj.photoDocId);
  });

  /* the spread must not bring back what the user cleared */
  it('clearing a field the form shows removes it', () => {
    const withWarn = { ...china.stops.find((s) => s.spots?.length)!, warn: 'Book the ticket first' } satisfies Stop;
    const got = save(stopSpec, withWarn, (v) => (v.warn = ''));
    expect('warn' in got).toBe(false);
    expect(got.spots).toEqual(stored(withWarn.spots));
  });

  it('a new stop starts clean: no fields from anywhere else, empty blocks', () => {
    const v = stopSpec.toValues(undefined);
    Object.assign(v, { name: 'Somewhere', start: '2027-03-01', end: '2027-03-03' });
    const got = stored(stopSpec.fromValues(v, undefined));
    expect(got.blocks).toEqual([]);
    expect(got.recoBlocks).toEqual([]);
    expect(got.spots).toBeUndefined();
    expect(got.options).toBeUndefined();
  });

  it('editing a day keeps its "Places today" links', () => {
    const day = china.dayPlans.find((d) => d.placeIds?.length)!;
    const got = save(specs.dayPlanSpec(china.trip.id, china.trip.start, china.runbooks), day, (v) => (v.title = 'Renamed')) as DayPlan;
    expect(got.title).toBe('Renamed');
    expect(got.placeIds).toEqual(day.placeIds);
  });

  /* Nov 22 is a flight to Yantai OR ELSE the HSR: the flag is what keeps the
     route check from counting both (logic/connectors.ts) */
  it('editing the Nov 22 train keeps it the or-else, its group and its ends', () => {
    const nov22 = china.bookings.find((x) => x.id === 'cn26-train-nov22')!;
    expect(nov22.alternative).toBe(true);
    const got = save(specs.otherBookingSpec(china.trip.id), nov22 as Booking, (v) => (v.note = 'checked'));
    expect(got.alternative).toBe(true);
    expect(got.groupLabel).toBe(nov22.groupLabel);
    expect(got.kind === 'train' && nov22.kind === 'train' && got.from).toEqual(nov22.kind === 'train' ? stored(nov22.from) : null);
  });

  it('a road leg keeps its ends and its duration', () => {
    const road = china.bookings.find((x) => x.id === 'cn26-road-dec18')!;
    const got = save(specs.otherBookingSpec(china.trip.id), road as Booking) as Booking & { from?: unknown; duration?: string };
    expect(got.kind).toBe('other');
    expect(got.from).toEqual('from' in road ? stored(road.from) : undefined);
    expect(got.duration).toBe('duration' in road ? road.duration : undefined);
  });

  /* The kind CAN change in this editor. The old kind's own fields go — a
     train's number means nothing on an activity — and the rest stays. */
  it('a train edited into an activity drops the train’s own fields, keeps the rest', () => {
    const train = { ...china.bookings.find((x) => x.id === 'cn26-train-dec09')!, trainNo: 'G1234', stopId: 'cn26-stop-shanghai' } as Booking;
    const got: Record<string, unknown> = {
      ...save(specs.otherBookingSpec(china.trip.id), train, (v) => {
        v.kind = 'activity';
        v.venue = 'The station';
      }),
    };
    expect(got.kind).toBe('activity');
    expect(got.venue).toBe('The station');
    for (const f of ['trainNo', 'from', 'to', 'dep', 'arr', 'duration']) expect(f in got).toBe(false);
    expect(got.stopId).toBe('cn26-stop-shanghai');
    expect(got.groupLabel).toBe(train.groupLabel);
    expect(got.id).toBe(train.id);
  });
});

/* THE MAP TARGET FOLLOWS THE PLACE (Run 4b). A record's map fields were built
   from one field — a flight's From airport, a place card's native text, a
   stay's name, a ticket's venue. Change that field and, kept, they opened the
   OLD place: CA 8609's From changed PKX → PEK and its button still opened
   Daxing. Changed, the fields built from it go and the button searches the
   new name; unchanged, the target stays exactly as it was. */
describe('editors · the map target follows the place it was built from', () => {
  const t = china.trip.id;
  const TARGET = ['coord', 'pin', 'mapQuery', 'mapCity', 'mapUrl', 'address', 'addressEn', 'addressInSearch'];
  const targetOf = (x: object): Record<string, unknown> =>
    Object.fromEntries(TARGET.filter((k) => k in x).map((k) => [k, (x as Record<string, unknown>)[k]]));
  const booking = (id: string): Booking => china.bookings.find((b) => b.id === id)!;
  const flightOf = (id: string): FlightBooking => booking(id) as FlightBooking;
  const stayOf = (id: string): HotelBooking => booking(id) as HotelBooking;
  const flight = specs.flightSpec(t);

  it('a flight moved to another airport drops the old airport’s target and searches the new one', () => {
    const ca = flightOf('cn26-flight-ca1953');
    expect(ca.kind === 'flight' && ca.from.code).toBe('PKX');
    expect(ca.coord).toBeDefined();
    expect(ca.mapQuery).toBe('北京大兴国际机场');
    const got = save(flight, ca, (v) => {
      v.fromCode = 'PEK';
      v.fromName = 'Beijing Capital Intl';
    });
    expect(targetOf(got)).toEqual({ mapQuery: 'Beijing Capital Intl' });
    expect(got.kind === 'flight' && got.from).toEqual({ code: 'PEK', name: 'Beijing Capital Intl' });
    /* nothing else moved with it */
    expect(got.kind === 'flight' && got.aircraft).toBe(ca.kind === 'flight' && ca.aircraft);
    expect(got.groupLabel).toBe(ca.groupLabel);
    expect(got.meta).toEqual(stored(ca.meta));
  });

  it('…the address it carried goes too, and with no name typed it searches the code', () => {
    const mu = flightOf('cn26-flight-mu733');
    expect(mu.address && mu.mapCity).toBeTruthy();
    const got = save(flight, mu, (v) => {
      v.fromCode = 'ctu';
      v.fromName = '';
    });
    expect(targetOf(got)).toEqual({ mapQuery: 'CTU' });
  });

  it('the same airport keeps its target — a new name, a new To, the code as it was typed', () => {
    const ca = flightOf('cn26-flight-ca1953');
    const want = targetOf(stored(ca));
    const edits: ((v: Record<string, unknown>) => void)[] = [
      (v) => (v.fromName = 'Daxing · Terminal 1'),
      (v) => (v.toCode = 'CSX'),
      (v) => (v.fromCode = ' pkx '),
    ];
    for (const edit of edits) expect(targetOf(save(flight, ca, edit))).toEqual(want);
  });

  it('a flight with no target gets none from an edit', () => {
    const bare = { ...flightOf('cn26-flight-ca1953') } as Record<string, unknown>;
    for (const k of TARGET) delete bare[k];
    const got = save(flight, bare as unknown as FlightBooking, (v) => (v.fromCode = 'PEK'));
    expect(targetOf(got)).toEqual({});
  });

  it('a place card retyped drops the old place’s coordinate and address, and searches its new text', () => {
    const card = china.showCards.find((c) => c.kind === 'place' && c.coord && c.address && c.mapQuery)!;
    const got = save(specs.showCardSpec(t, 0), card, (v) => (v.native = '北京首都国际机场'));
    expect(targetOf(got)).toEqual({ mapQuery: '北京首都国际机场' });
    expect(got.meaning).toBe(card.meaning);
  });

  it('…keeps the map link typed into its own form, and everything when only the meaning changes', () => {
    const card = china.showCards.find((c) => c.kind === 'place' && c.coord && c.mapQuery)!;
    const linked = save(specs.showCardSpec(t, 0), card, (v) => {
      v.native = '北京首都国际机场';
      v.mapUrl = 'https://maps.example/pek';
    });
    expect(linked.mapUrl).toBe('https://maps.example/pek');
    expect(linked.coord).toBeUndefined();
    const meant = save(specs.showCardSpec(t, 0), card, (v) => (v.meaning = `${card.meaning} (checked)`));
    expect(targetOf(meant)).toEqual(targetOf(stored(card)));
  });

  it('a phrase card retyped gets no map search', () => {
    const phrase = { ...china.showCards.find((c) => c.kind === 'phrase')!, mapQuery: '一句话' };
    const got = save(specs.showCardSpec(t, 0), phrase, (v) => (v.native = '另一句话'));
    expect(targetOf(got)).toEqual({});
  });

  it('a stay renamed drops the target built from its old name; its address and link are the form’s', () => {
    const huatian = stayOf('cn26-stay-04');
    expect(huatian.mapQuery && huatian.mapCity).toBeTruthy();
    expect(targetOf(save(specs.staySpec(t), huatian, (v) => (v.title = 'Wulingyuan Lodge')))).toEqual({ mapQuery: 'Wulingyuan Lodge' });
    const withAddress = stayOf('cn26-stay-00');
    expect(withAddress.address).toBeTruthy();
    expect(targetOf(save(specs.staySpec(t), withAddress, (v) => (v.title = 'Another hotel')))).toEqual({ address: withAddress.address });
    expect(targetOf(save(specs.staySpec(t), huatian, (v) => (v.note = 'late check-in')))).toEqual(targetOf(stored(huatian)));
  });

  it('a ticket at a new venue drops the old venue’s target and searches the new one', () => {
    const palace = booking('cn26-ticket-forbidden-city');
    expect(palace.mapQuery && palace.mapCity).toBeTruthy();
    const other = specs.otherBookingSpec(t);
    expect(targetOf(save(other, palace, (v) => (v.venue = 'Temple of Heaven 天坛')))).toEqual({ mapQuery: 'Temple of Heaven 天坛' });
    expect(targetOf(save(other, palace, (v) => (v.title = 'Forbidden City · 08:30 entry')))).toEqual(targetOf(stored(palace)));
  });

  it('a booking that stops or starts being a ticket leaves the old target behind', () => {
    const other = specs.otherBookingSpec(t);
    expect(targetOf(save(other, booking('cn26-ticket-forbidden-city'), (v) => (v.kind = 'other')))).toEqual({});
    const coach = seed('israel-test.trip.json').bookings.find((b) => b.id === 'il26-other-negev')!;
    expect(coach.mapQuery).toBeTruthy();
    const made = save(other, coach, (v) => {
      v.kind = 'activity';
      v.venue = 'Ramon Crater visitor centre';
    });
    expect(targetOf(made)).toEqual({ mapQuery: 'Ramon Crater visitor centre' });
  });

  it('a stop keeps its target through a rename — its area, not its title (as Run 4 kept its coordinate)', () => {
    const zjj = china.stops.find((s) => s.id === 'cn26-stop-zhangjiajie')!;
    expect(targetOf(save(specs.stopSpec(t, 0), zjj, (v) => (v.name = 'Zhangjiajie · Wulingyuan')))).toEqual(targetOf(stored(zjj)));
  });
});

/* A TRAIN AND A ROAD LEG ARE THE SAME SHAPE (Run 4b). Both have two ends,
   times and a duration; changing one into the other dropped them all. */
describe('editors · a train made a road leg, and back', () => {
  const other = specs.otherBookingSpec(china.trip.id);
  type Leg = { from?: { name: string }; to?: { name: string }; dep?: string; arr?: string; duration?: string };
  const leg = (x: Booking): Leg => x as Leg;

  it('a train made a road leg keeps its ends, times and duration, and drops only its number', () => {
    const train = { ...china.bookings.find((x) => x.id === 'cn26-train-dec09')!, trainNo: 'G2481', dep: '08:10', arr: '09:05' } as Booking;
    const got = save(other, train, (v) => (v.kind = 'other'));
    expect(got.kind).toBe('other');
    expect(leg(got).from).toEqual(stored(leg(train).from));
    expect(leg(got).to).toEqual(stored(leg(train).to));
    expect([leg(got).dep, leg(got).arr, leg(got).duration]).toEqual(['08:10', '09:05', leg(train).duration]);
    expect('trainNo' in got).toBe(false);
  });

  it('a road leg shows its own ends to the form, and made a train keeps them — the reason an end has no station too', () => {
    const road = china.bookings.find((x) => x.id === 'cn26-road-dec18')!;
    const v = other.toValues(road);
    expect([v.fromName, v.toName]).toEqual([leg(road).from?.name, leg(road).to?.name]);
    const got = save(other, road, (x) => (x.kind = 'train'));
    expect(got.kind).toBe('train');
    expect(leg(got).from).toEqual(stored(leg(road).from));
    expect(leg(got).to).toEqual(stored(leg(road).to));
    expect(leg(got).duration).toBe(leg(road).duration);
  });
});

/* WHAT A NESTED OBJECT CARRIES SURVIVES TOO (Run 4b). A flight's two ends, a
   card's rows and a checklist's items were rebuilt from the form's fields,
   so anything else on them — a pin the Map track adds — was lost. */
describe('editors · nested objects keep what the form does not show', () => {
  const t = china.trip.id;
  const pin = { lat: 40.08, lng: 116.58, placed: 'by hand' };
  type Ends = { from: { pin?: unknown }; to: { pin?: unknown } };

  it('a flight’s ends keep a pin — until the end is another airport', () => {
    const ca = china.bookings.find((b) => b.id === 'cn26-flight-ca1953')!;
    if (ca.kind !== 'flight') throw new Error('not a flight');
    const pinned = { ...ca, from: { ...ca.from, pin }, to: { ...ca.to, pin } } as FlightBooking;
    const same = save(specs.flightSpec(t), pinned) as unknown as Ends;
    expect([same.from.pin, same.to.pin]).toEqual([pin, pin]);
    const moved = save(specs.flightSpec(t), pinned, (v) => (v.toCode = 'PEK')) as unknown as Ends;
    expect(moved.from.pin).toEqual(pin);
    expect(moved.to.pin).toBeUndefined();
  });

  it('a card’s rows keep what else they carry, edited or not', () => {
    const card = { ...china.walletCards[0]!, rows: [{ k: 'Policy', v: 'ABC', pin }, { k: 'Phone', v: '+1 555' }] };
    const spec = specs.walletCardSpec(t, 0, china.trip.homeCurrency);
    expect(save(spec, card).rows).toEqual(stored(card.rows));
    const edited = save(spec, card, (v) => ((v.rows as { k: string; v: string }[])[0]!.v = 'ABD'));
    expect(edited.rows[0]).toEqual({ k: 'Policy', v: 'ABD', pin });
  });

  it('a checklist’s items keep what else they carry, and an item edited in place stays itself', () => {
    const list = china.checklists[0]!;
    const withPin = { ...list, items: list.items.map((it, i) => (i === 0 ? { ...it, pin } : it)) };
    const spec = specs.checklistSpec(t, 0);
    expect(save(spec, withPin).items).toEqual(stored(withPin.items));
    const edited = save(spec, withPin, (v) => ((v.items as string[])[0] = `${list.items[0]!.label} (edited)`));
    expect(edited.items[0]).toMatchObject({ id: list.items[0]!.id, label: `${list.items[0]!.label} (edited)`, pin });
  });
});
