/* PICK, UN-PICK, AND SURVIVE A RESTORE.

   These run against the real Dexie schema through `fake-indexeddb`, and
   against the real backup envelope, because the thing being defended is
   exactly the seam between them: a pick is the only plan item the app itself
   writes, and the one way to lose it is for it to fall out of a file on the
   way to a new phone. */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../lib/db/db';
import { upsertTripBundle } from '../lib/data/repo';
import { buildTripBundle } from '../lib/data/export';
import { pickOption, pickedIndex, picksOn, unpick } from '../lib/data/picks';
import { normalizeBundle, parseBackupText, summarizeBundle } from '../lib/logic/backup';
import { candidatesOf, inTheDay, rankCandidates } from '../lib/logic/options';
import type { Stop, TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json');
const seedText = readFileSync(seedPath, 'utf8');
const rawBundle = (): Partial<TripBundle> =>
  (JSON.parse(seedText) as { trips: Partial<TripBundle>[] }).trips[0]!;
const seed = (): TripBundle => normalizeBundle(rawBundle());

const DATE = '2026-12-13'; // Zhangjiajie, no clock anywhere in the day
const zj = (b: TripBundle): Stop => b.stops.find((s) => s.id === 'cn26-stop-zhangjiajie')!;

/** The row the free block would offer first on that day. */
function firstOffer(b: TripBundle) {
  const stop = zj(b);
  const day = b.dayPlans.find((d) => d.date === DATE)!;
  const pool = candidatesOf(stop).filter((c) => !inTheDay(c, day.planItems, stop.spots ?? []));
  return rankCandidates(pool, { anchor: stop.coord }).shown[0]!;
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  for (const t of ['dayPicks', 'dayPlans', 'stops', 'trips', 'settings'] as const) await db[t].clear();
  await upsertTripBundle(seed());
});

describe('picking a researched line into a day', () => {
  it('writes exactly one row, carrying its provenance', async () => {
    const bundle = seed();
    const c = firstOffer(bundle);
    const id = await pickOption('cn26', DATE, 'cn26-stop-zhangjiajie', c);

    const rows = await db.dayPicks.toArray();
    expect(rows).toHaveLength(1);
    const p = rows[0]!;
    expect(p.id).toBe(id);
    expect(p.origin).toBe('picked');
    expect(p.date).toBe(DATE);
    expect(p.stopId).toBe('cn26-stop-zhangjiajie');
    expect(p.blockId).toBe(c.blockId);
    expect(p.itemIndex).toBe(c.index);
    /* the line is stored VERBATIM — the day says what was chosen */
    expect(p.text).toBe(c.raw);
  });

  it('never touches the authored day', async () => {
    const before = (await db.dayPlans.get('cn26-day-2026-12-13'))?.planItems;
    const written = before ?? (await db.dayPlans.where('date').equals(DATE).toArray())[0]?.planItems;
    await pickOption('cn26', DATE, 'cn26-stop-zhangjiajie', firstOffer(seed()));
    const after = (await db.dayPlans.where('tripId').equals('cn26').toArray()).find(
      (d) => d.date === DATE,
    );
    expect(after?.planItems).toEqual(written);
  });

  it('flips the candidate row in place, and un-picking re-opens it', async () => {
    const bundle = seed();
    const stop = zj(bundle);
    const day = bundle.dayPlans.find((d) => d.date === DATE)!;
    const pool = candidatesOf(stop).filter((c) => !inTheDay(c, day.planItems, stop.spots ?? []));
    const c = firstOffer(bundle);

    const id = await pickOption('cn26', DATE, stop.id, c);
    const withPick = await db.dayPicks.toArray();
    const ranked = rankCandidates(pool, { anchor: stop.coord, pickedIds: pickedIndex(withPick, DATE) });
    const row = ranked.shown.find((r) => r.id === c.id)!;
    expect(row.picked).toBe(true);
    expect(row.pickId).toBe(id);

    await unpick(id);
    const after = await db.dayPicks.toArray();
    expect(after).toHaveLength(0);
    const reopened = rankCandidates(pool, { anchor: stop.coord, pickedIds: pickedIndex(after, DATE) });
    expect(reopened.shown.find((r) => r.id === c.id)?.picked).toBe(false);
  });

  it('un-picking deletes exactly that row and nothing beside it', async () => {
    const bundle = seed();
    const stop = zj(bundle);
    const day = bundle.dayPlans.find((d) => d.date === DATE)!;
    const pool = candidatesOf(stop).filter((c) => !inTheDay(c, day.planItems, stop.spots ?? []));
    const a = await pickOption('cn26', DATE, stop.id, pool[0]!);
    const b = await pickOption('cn26', DATE, stop.id, pool[1]!);
    const other = await pickOption('cn26', '2026-12-12', stop.id, pool[2]!);

    await unpick(a);
    const left = (await db.dayPicks.toArray()).map((p) => p.id).sort();
    expect(left).toEqual([b, other].sort());
    /* and the other day's pick is not on this day's list */
    expect(picksOn(await db.dayPicks.toArray(), DATE).map((p) => p.id)).toEqual([b]);
  });
});

describe('a pick survives export → import', () => {
  it('carries the marker through the envelope and back into the database', async () => {
    const c = firstOffer(seed());
    const id = await pickOption('cn26', DATE, 'cn26-stop-zhangjiajie', c);

    /* export, exactly as the Backup screen does it */
    const bundle = await buildTripBundle('cn26', false);
    expect(bundle?.dayPicks).toHaveLength(1);
    const file = JSON.stringify({
      format: 'livingthedream/backup',
      formatVersion: 1,
      kind: 'trip',
      exportedAt: new Date().toISOString(),
      appVersion: 'test',
      trips: [bundle],
    });

    /* the phone is wiped */
    await db.dayPicks.clear();
    expect(await db.dayPicks.count()).toBe(0);

    /* …and restored from that file */
    const parsed = parseBackupText(file);
    await upsertTripBundle(parsed.trips[0]!);

    const back = await db.dayPicks.toArray();
    expect(back).toHaveLength(1);
    expect(back[0]?.id).toBe(id);
    expect(back[0]?.origin).toBe('picked');
    expect(back[0]?.text).toBe(c.raw);
    expect(back[0]?.blockId).toBe(c.blockId);
    expect(back[0]?.itemIndex).toBe(c.index);
    /* the same key the block uses to flip the row — a pick that came home
       under a different key would be a pick you could never un-pick */
    expect([...pickedIndex(back, DATE).keys()]).toEqual([c.id]);
  });

  it('the import preview counts them, and says nothing when there are none', async () => {
    expect(summarizeBundle(seed())).not.toContain('picked plan');
    await pickOption('cn26', DATE, 'cn26-stop-zhangjiajie', firstOffer(seed()));
    const bundle = await buildTripBundle('cn26', false);
    expect(summarizeBundle(bundle!)).toContain('1 picked plan');
  });

  it('restores a file written before picks existed', () => {
    /* the China seed itself: no dayPicks key at all */
    const raw = rawBundle();
    expect('dayPicks' in raw).toBe(false);
    expect(normalizeBundle(raw).dayPicks).toEqual([]);
  });
});
