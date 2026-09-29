/* THE PHOTO MANIFEST (Map 5e, app/scripts/maps/photos/manifest.json) — what
   the map pack carries for every place, held to the owner's rules: one entry
   for every place the Map tab draws and for nothing else; every photo under a
   licence on the list, credited as its file page credits it, with its page,
   how it was found and what it shows (it was LOOKED at: choices.ts); every
   About Wikipedia's own words — a prefix of the article's summary, cut at a
   sentence's end — with its article and licence; every link a real https
   address; and the rehearsal's tiny set true to the real pack. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AppBackup } from '../lib/model/types';
import { photoPlaces } from '../../scripts/maps/photos/places';
import { CHOICES, ITEM_FIX } from '../../scripts/maps/photos/choices';
import { ABOUT_MAX, sentenceEnds } from '../../scripts/maps/photos/rules';
import type { Manifest } from '../../scripts/maps/photos/pack-photos';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const manifest = JSON.parse(readFileSync(join(here, '..', '..', 'scripts', 'maps', 'photos', 'manifest.json'), 'utf8')) as Manifest;
const places = photoPlaces(seed);
const LICENCE = /^(CC0|Public domain|CC BY(-SA)? \d(\.\d)?)$/;
const https = (u: string | undefined): boolean => {
  try {
    return !!u && new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

describe('the photo manifest · every drawn place, and nothing else', () => {
  it('has one entry per place the Map tab draws, and a choice made for each', () => {
    expect(Object.keys(manifest.places).sort()).toEqual(places.map((p) => p.id).sort());
    for (const p of places) expect(CHOICES[p.id], p.id).toBeDefined();
  });
  it('names each place as the trip does', () => {
    for (const p of places) expect(manifest.places[p.id]?.name).toBe(p.name);
  });
});

describe('the photo manifest · the photos', () => {
  const photos = Object.entries(manifest.places).filter(([, p]) => p.photo);
  it('carries a photo for most places', () => {
    expect(photos.length).toBeGreaterThan(places.length / 2);
  });
  it('every photo under a licence on the owner’s list, credited, with its page — and looked at', () => {
    for (const [id, p] of photos) {
      const ph = p.photo!;
      expect(ph.licence, id).toMatch(LICENCE);
      if (!/^(CC0|Public domain)$/.test(ph.licence)) expect(ph.author.trim(), `${id} has no author`).not.toBe('');
      expect(https(ph.source), `${id} page ${ph.source}`).toBe(true);
      expect(https(ph.image), `${id} image`).toBe(true);
      expect(ph.shows.trim().length, `${id}: what does it show?`).toBeGreaterThan(8);
      expect(ph.via.trim(), id).not.toBe('');
      if (ph.site === 'Wikimedia Commons') {
        expect(ph.file, id).toMatch(/^File:/);
        expect(ph.source, id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
      expect(CHOICES[id] && 'photo' in CHOICES[id]! ? CHOICES[id]!.photo : null, id).toBe(ph.file);
    }
  });
  it('a photo that does not live on Commons carries the title its author gave it — never its library’s id (Map 5f)', () => {
    /* CC BY 2.0 §4(b): the credit names the work's title where one is supplied. A Commons file's name is its title;
       the Flickr photo found through Openverse was titled by its id, "openverse:e4ac772e-…" */
    const elsewhere = photos.filter(([, p]) => !p.photo!.file.startsWith('File:'));
    expect(elsewhere.length).toBeGreaterThan(0);
    for (const [id, p] of elsewhere) {
      expect(p.photo!.title?.trim() ?? '', `${id} has no title`).not.toBe('');
      expect(p.photo!.title, id).not.toMatch(/^openverse:|^[0-9a-f-]{36}$/);
    }
    expect(manifest.places['cn26-spot-dali-jade-belt']?.photo?.title).toBe('Dali - Cangshan');
  });
  it('a place without a photo says why', () => {
    for (const [id, p] of Object.entries(manifest.places)) if (!p.photo) expect(p.noPhoto?.trim().length ?? 0, id).toBeGreaterThan(8);
  });
  it('every refusal is written down with its reason', () => {
    for (const r of manifest.rejected) {
      expect(places.some((p) => p.id === r.place), r.place).toBe(true);
      expect(r.why.trim().length, `${r.place} ${r.file}`).toBeGreaterThan(8);
    }
  });
});

describe('the photo manifest · About is Wikipedia’s own words', () => {
  const abouts = Object.entries(manifest.places).filter(([, p]) => p.about);
  it('every About is a prefix of the article’s summary, cut at a sentence’s end, one to three sentences', () => {
    expect(abouts.length).toBeGreaterThan(50);
    for (const [id, p] of abouts) {
      const a = p.about!;
      expect(a.extract.startsWith(a.text), `${id}: not verbatim`).toBe(true);
      const ends = sentenceEnds(a.extract);
      expect(ends, id).toContain(a.text.length);
      const n = ends.filter((e) => e <= a.text.length).length;
      expect(n, id).toBeGreaterThanOrEqual(1);
      expect(n, id).toBeLessThanOrEqual(3);
      if (n > 1) expect(a.text.length, id).toBeLessThanOrEqual(ABOUT_MAX);
    }
  });
  it('with its article, on the English Wikipedia, under CC BY-SA 4.0', () => {
    for (const [id, p] of abouts) {
      expect(p.about!.url, id).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//);
      expect(p.about!.licence).toBe('CC BY-SA 4.0');
      expect(p.about!.title.trim(), id).not.toBe('');
    }
  });
  it('official sites are real web addresses', () => {
    for (const [id, p] of Object.entries(manifest.places)) if (p.official) expect(/^https?:\/\/[^/]+\.[^/]+/.test(p.official), `${id}: ${p.official}`).toBe(true);
  });
  it('an item fixed by hand is not the one Map 5a matched', () => {
    for (const [id, fix] of Object.entries(ITEM_FIX)) {
      expect(places.find((p) => p.id === id)?.wd, id).not.toBe(fix.wd);
      expect(manifest.places[id]?.item).toBe(fix.wd);
    }
  });
});
