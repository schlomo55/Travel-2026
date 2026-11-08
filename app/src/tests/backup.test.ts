import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupFileName, isBackup, normalizeBundle, parseBackupText, summarizeBundle } from '../lib/logic/backup';
import type { TripBundle } from '../lib/model/types';

const seedPath = join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json');
const seedText = readFileSync(seedPath, 'utf8');

describe('backup envelope', () => {
  it('accepts the generated demo seed', () => {
    const parsed = parseBackupText(seedText);
    expect(isBackup(parsed)).toBe(true);
    expect(parsed.kind).toBe('trip');
    expect(parsed.trips).toHaveLength(1);
    expect(parsed.trips[0]?.trip.id).toBe('dm27');
  });

  it('wraps a bare trip bundle in an envelope', () => {
    const bundle = (JSON.parse(seedText) as { trips: TripBundle[] }).trips[0];
    const parsed = parseBackupText(JSON.stringify(bundle));
    expect(parsed.format).toBe('livingthedream/backup');
    expect(parsed.trips[0]?.trip.title).toBe('TEST — Demo China');
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
        name: 'Hangzhou',
        fileName: 'hangzhou.webp',
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
    /* LABELLED, not summed. "10 stops" would be true of the data and false of
       every screen: Plans draws nine, because the tenth is the transit
       pseudo-stop (the international flights). The preview says which number
       it is, so it can be checked against the app it is about to overwrite. */
    expect(s).toContain('9 stops + 1 transit');
    expect(s).not.toContain('10 stops');
    /* 25 dayPlans against a 31-day trip — a count of days WRITTEN, not lived:
       the school week mostly runs on its two day defaults. */
    expect(s).toContain('25 days written');
    /* 40 = 9 flights (one cancelled) + 4 trains (one an alternative) + 2 road
       legs + 13 beds (one walk-in, one cancelled) + 12 tickets. A cancelled
       booking is still a booking record, so it counts. */
    expect(s).toContain('40 bookings');
    /* The flights PDF + one photo per stop that has one: 9 — the transit stop
       and Suzhou have no photo. This used to read '1 document', which only
       ever passed as a substring of a two-digit count. */
    expect(s).toContain('· 9 documents');
    /* "cards" alone would collide with the Wallet's own cards; these are the
       show cards: 12 phrases + 23 place / driver cards. */
    expect(s).toContain('35 cards to show');
  });
});

/* The Backup screen prints the filename before you tap "save a copy", so the
   promise and the download have to be produced by the same function. */
describe('backup filenames', () => {
  const at = new Date(2027, 2, 21); // 21 Mar 2027, local — never UTC-parsed

  it('names the whole vault', () => {
    expect(backupFileName(null, at, true)).toBe('livingthedream-vault-20270321.json.gz');
  });

  it('drops to plain .json when the browser cannot gzip', () => {
    expect(backupFileName(null, at, false)).toBe('livingthedream-vault-20270321.json');
  });

  it('slugs a trip title, punctuation and all', () => {
    expect(backupFileName('Demo 2027 — 杭州 & 香港', at, true)).toBe('demo-2027-20270321.json.gz');
  });

  it('never produces a nameless file', () => {
    expect(backupFileName('***', at, true)).toBe('trip-20270321.json.gz');
  });

  it('pads single-digit months and days', () => {
    expect(backupFileName(null, new Date(2027, 0, 5), true)).toBe('livingthedream-vault-20270105.json.gz');
  });
});
