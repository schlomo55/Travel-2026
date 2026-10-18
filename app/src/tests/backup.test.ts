import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupFileName, isBackup, normalizeBundle, parseBackupText, summarizeBundle } from '../lib/logic/backup';
import type { TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'china-2026.trip.json');
const seedText = readFileSync(seedPath, 'utf8');

describe('backup envelope', () => {
  it('accepts the generated China seed', () => {
    const parsed = parseBackupText(seedText);
    expect(isBackup(parsed)).toBe(true);
    expect(parsed.kind).toBe('trip');
    expect(parsed.trips).toHaveLength(1);
    expect(parsed.trips[0]?.trip.id).toBe('cn26');
  });

  it('wraps a bare trip bundle in an envelope', () => {
    const bundle = (JSON.parse(seedText) as { trips: TripBundle[] }).trips[0];
    const parsed = parseBackupText(JSON.stringify(bundle));
    expect(parsed.format).toBe('livingthedream/backup');
    expect(parsed.trips[0]?.trip.title).toBe('China 2026');
  });

  it('rejects unrelated JSON', () => {
    expect(() => parseBackupText('{"hello":"world"}')).toThrow();
    expect(() => parseBackupText('[1,2,3]')).toThrow();
  });

  it('fills in collections a older file may not carry', () => {
    const bundle = (JSON.parse(seedText) as { trips: TripBundle[] }).trips[0]!;
    const thin = normalizeBundle({ trip: bundle.trip });
    expect(thin.stops).toEqual([]);
    expect(thin.documents).toEqual([]);
    expect(thin.checkState).toEqual([]);
  });

  it('carries place photos and read-more fields through untouched', () => {
    const bundle = (JSON.parse(seedText) as { trips: TripBundle[] }).trips[0]!;
    const stop = { ...bundle.stops[0]!, photoDocId: 'doc-photo-1', detail: 'A **longer** story.' };
    const photoDoc = {
      meta: {
        id: 'doc-photo-1',
        tripId: bundle.trip.id,
        stopId: stop.id,
        name: 'Beijing',
        fileName: 'beijing.webp',
        mime: 'image/webp',
        size: 3,
        tag: 'photo' as const,
        addedAt: 0,
      },
      dataBase64: 'AAAA',
    };
    const norm = normalizeBundle({
      ...bundle,
      stops: [stop, ...bundle.stops.slice(1)],
      documents: [...bundle.documents, photoDoc],
    });
    const back = norm.stops.find((s) => s.id === stop.id);
    expect(back?.photoDocId).toBe('doc-photo-1');
    expect(back?.detail).toContain('longer');
    expect(norm.documents.some((d) => d.meta.tag === 'photo' && d.meta.stopId === stop.id)).toBe(true);
  });

  it('still accepts backups from the Sojourn era', () => {
    const legacy = seedText.replace('livingthedream/backup', 'sojourn/backup');
    const parsed = parseBackupText(legacy);
    expect(isBackup(parsed)).toBe(true);
  });

  it('summarizes what an import will bring in', () => {
    const bundle = (JSON.parse(seedText) as { trips: TripBundle[] }).trips[0]!;
    const s = summarizeBundle(bundle);
    /* LABELLED SINCE 2026-08-12. "11 stops" was true of the data and false of
       every screen: Plans draws ten, because the eleventh is the transit
       pseudo-stop. The preview now says which number it is, so it can be
       checked against the app it is about to overwrite. */
    expect(s).toContain('10 stops + 1 transit');
    expect(s).not.toContain('11 stops');
    /* 28 dayPlans against a 37-day trip — a count of days WRITTEN, not lived.
       27 → 28 on 2026-09-28: Sat Nov 28, written out once the school said
       Saturdays do not train. */
    expect(s).toContain('28 days written');
    /* 23 since 2026-07-28: 7 flights + 11 beds, plus the FIVE rail legs that
       had always been in the trip's prose and never in its bookings.
       34 SINCE 2026-08-06, and for the same reason a second time: the ELEVEN
       experiences — the concert that was actually bought, plus the cableways,
       the show, the guided wall day, the ferry, the park pass, the lesson and
       the one meal that needs a table — had all been written down for months
       and none of them was a booking.
       35 SINCE 2026-08-12, and this one IS a new booking rather than a
       promotion: Air China CA8683, Beijing PKX → Yantai, bought the day the
       academy's Mon/Tue/Wed arrival rule forced a night in Yantai city. The
       trip's eighth flight.
       37 SINCE 2026-08-12, and the same gap closing a third time: the two ROAD
       legs — the early bus into Tiger Leaping Gorge and the shared car out of
       it — had lived only as clauses inside day plans. Mapping the trip end to
       end showed they were the only two joins between cities with nothing on
       either side of them (scripts/china/road.ts). Both ship `pending`, and
       there is nothing to book: the bus is walk-up and the car is arranged on
       the trail.
       38 SINCE 2026-08-12, and the same gap closing a fourth time: the KUNYU
       ACADEMY FORTNIGHT, Nov 23 → Dec 5. Its deposit was sent and acknowledged
       on 11 Aug, so the slot has been held all along — but the stay itself was
       never a booking, and twelve real nights read as having none. It ships
       `booked` with no price, no reference and no platform, because none of
       those three has ever existed for it.
       40 SINCE 2026-09-28: the Dec 5 flight out of Yantai (Air China CA1560)
       and the Nov 22 bed in Muping, both booked the morning the academy
       answered.
       41 SINCE 2026-10-17: skiing dropped. − the Chongli train,
       − the Thaiwoo lesson; + the Beijing → Shanghai train (the Dec 9 card,
       rewritten), + the Meliá (pending), + MU394 (pending), + the Disney ticket
       (pending). Element and CA8609 stay booked, to undo. Still 41 later the
       same day: the Meliá became the booked Hi Cozy hostel (same card) and
       Element was cancelled — shown as cancelled, still a booking record. */
    expect(s).toContain('41 bookings');
    /* The flights PDF + one photo per stop that has one: 10 since 2026-10-17
       (Shanghai has no curated photo). This used to read '1 document', which
       only ever passed as a substring of "11 documents". */
    expect(s).toContain('· 10 documents');
    /* "35 cards" collided with the Wallet's own cards; these are driver cards.
       33 since 2026-10-17: 太子城站 and 太舞滑雪小镇 went with skiing — and 34
       the same evening, with the Hi Cozy hostel's Chinese name for a driver. */
    expect(s).toContain('34 cards to show');
  });
});

/* The Backup screen prints the filename before you tap "save a copy", so the
   promise and the download have to be produced by the same function. */
describe('backup filenames', () => {
  const at = new Date(2026, 10, 21); // 21 Nov 2026, local — never UTC-parsed

  it('names the whole vault', () => {
    expect(backupFileName(null, at, true)).toBe('livingthedream-vault-20261121.json.gz');
  });

  it('drops to plain .json when the browser cannot gzip', () => {
    expect(backupFileName(null, at, false)).toBe('livingthedream-vault-20261121.json');
  });

  it('slugs a trip title, punctuation and all', () => {
    expect(backupFileName('China 2026 — 山东 & 北京', at, true)).toBe('china-2026-20261121.json.gz');
  });

  it('never produces a nameless file', () => {
    expect(backupFileName('***', at, true)).toBe('trip-20261121.json.gz');
  });

  it('pads single-digit months and days', () => {
    expect(backupFileName(null, new Date(2027, 0, 5), true)).toBe('livingthedream-vault-20270105.json.gz');
  });
});
