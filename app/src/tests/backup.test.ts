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
    expect(s).toContain('11 stops');
    /* 23 since 2026-07-28: 7 flights + 11 beds, plus the FIVE rail legs that
       had always been in the trip's prose and never in its bookings.
       34 SINCE 2026-08-06, and for the same reason a second time: the ELEVEN
       experiences — the concert that was actually bought, plus the cableways,
       the show, the guided wall day, the ferry, the park pass, the lesson and
       the one meal that needs a table — had all been written down for months
       and none of them was a booking. */
    expect(s).toContain('34 bookings');
    expect(s).toContain('1 document');
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
