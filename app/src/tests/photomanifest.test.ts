/* THE PHOTO MANIFEST'S RULES (Map 5e) — what the map pack carries for every
   place, held to the owner's rules: one entry for every place the Map tab
   draws and for nothing else, keyed by the place's own id and named as the
   trip names it; every photo under a licence on the list, credited as its
   file page credits it, with its page, how it was found and what it shows;
   every About Wikipedia's own words — a prefix of the article's summary, cut
   at a sentence's end — with its article and licence; every link a real https
   address.

   The real pack's manifest is a personal trip's data and is not kept in the
   repo, so the rules are held here against a small manifest built for the
   DEMO trip's drawn places with the pass's own rule functions (rules.ts) —
   and each rule is shown to catch the manifest that breaks it. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppBackup, Booking } from '../lib/model/types';
import { mapPlaces } from '../lib/logic/mapplaces';
import { ABOUT_MAX, aboutText, creditable, licenceOf, sentenceEnds } from '../../scripts/maps/photos/rules';

/* the manifest's shape (scripts/maps/photos/pack-photos.ts), the fields these rules read */
interface Photo {
  file: string;
  title?: string;
  author: string;
  licence: string;
  source: string;
  site: string;
  image: string;
  via: string;
  shows: string;
}
interface About {
  text: string;
  extract: string;
  title: string;
  url: string;
  licence: string;
}
interface Place {
  name: string;
  city: string;
  category: string;
  photo?: Photo;
  about?: About;
  official?: string;
  noPhoto?: string;
}
interface Manifest {
  trip: string;
  places: Record<string, Place>;
  rejected: { place: string; file: string; why: string }[];
}

const demo = (JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'seed', 'demo-2027.trip.json'), 'utf8')) as AppBackup).trips[0]!;
/* every place the Map tab DRAWS — `coord ?? pin` — the list the pass looks a photo up for */
const drawn = mapPlaces({ tripId: demo.trip.id, stops: demo.stops, showCards: demo.showCards, bookings: demo.bookings as Booking[], dayPlans: demo.dayPlans, dayDefaults: demo.dayDefaults }).filter((p) => p.pos);
const cityOf = new Map(demo.stops.map((s) => [s.id, (s.name.split(' — ')[0] ?? s.name).trim()]));

const LICENCE = /^(CC0|Public domain|CC BY(-SA)? \d(\.\d)?)$/;
const https = (u: string | undefined): boolean => {
  try {
    return !!u && new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

/* Invented summaries in Wikipedia's register — one runs past ABOUT_MAX, one
   carries an abbreviation that must not end a sentence. */
const EXTRACTS = [
  'The place is a landmark of the city. It was laid out in the 16th century by a retired official. Its gardens are open every day of the year. A museum on the site tells its history.',
  'St. Michael\'s Hall is a sample building near the river. It was restored in 1990. Visitors may climb its tower.',
  `This viewpoint is known for its sunrise over a sea of clouds, which has drawn painters and poets to the mountain for more than a thousand years and is today reached by stone steps or by cableway from either side of the range. ${'Long sentences like this one are kept whole or not at all, because the summary is never cut inside a sentence. '.repeat(3).trim()}`,
];

const licenced = (code: string): string => {
  const l = licenceOf({ code });
  if (!l.ok) throw new Error(l.why);
  return l.licence;
};

/** A manifest the pass could have written for the demo trip: a Commons photo,
    a CC0 photo with no author, a photo from elsewhere with its own title, or
    a place looked at and left without one — and an About for every spot. */
function buildManifest(): Manifest {
  const places: Record<string, Place> = {};
  drawn.forEach((p, i) => {
    const file = `File:Demo ${p.id}.jpg`;
    const commons = (code: string, author: string): Photo => ({
      file,
      author,
      licence: licenced(code),
      source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(file)}`,
      site: 'Wikimedia Commons',
      image: `https://upload.wikimedia.org/demo/${p.id}.jpg`,
      via: 'Wikidata P18 of the item that verified its pin',
      shows: `${p.name}, seen from the street in daylight`,
    });
    const photo: Photo | undefined = [
      commons('cc-by-sa-4.0', 'Sample Photographer'),
      commons('cc0', ''),
      {
        file: `flickr:${i}`,
        title: `${p.name} at dusk`,
        author: 'Sample Flickr User',
        licence: licenced('cc-by-2.0'),
        source: `https://www.flickr.com/photos/sample/${1000 + i}`,
        site: 'Flickr',
        image: `https://live.staticflickr.com/sample/${1000 + i}.jpg`,
        via: 'Openverse search, by name and city',
        shows: `${p.name} at dusk, lit from inside`,
      },
      undefined,
    ][i % 4];
    const extract = EXTRACTS[i % EXTRACTS.length]!;
    places[p.id] = {
      name: p.name,
      city: (p.stopId && cityOf.get(p.stopId)) || '—',
      category: p.category,
      ...(photo ? { photo } : { noPhoto: 'Every candidate photo showed a different building of the same name.' }),
      ...(p.kind === 'spot'
        ? { about: { text: aboutText(extract), extract, title: p.name, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.name.replace(/ /g, '_'))}`, licence: 'CC BY-SA 4.0' } }
        : {}),
      ...(i % 7 === 0 ? { official: 'https://www.example.org/' } : {}),
    };
  });
  const first = drawn[0]!.id;
  return { trip: demo.trip.id, places, rejected: [{ place: first, file: 'File:Demo rejected.jpg', why: 'CC BY-NC 2.0 — a non-commercial licence' }] };
}

/** Every rule the manifest is held to, as a list of what breaks one. */
function problems(m: Manifest): string[] {
  const out: string[] = [];
  const ids = drawn.map((p) => p.id).sort();
  const keys = Object.keys(m.places).sort();
  for (const k of keys) if (!ids.includes(k)) out.push(`${k}: not a place the Map tab draws`);
  for (const id of ids) if (!keys.includes(id)) out.push(`${id}: no entry`);
  for (const p of drawn) if (m.places[p.id] && m.places[p.id]!.name !== p.name) out.push(`${p.id}: named "${m.places[p.id]!.name}", not as the trip does`);
  for (const [id, p] of Object.entries(m.places)) {
    const ph = p.photo;
    if (!ph) {
      if ((p.noPhoto?.trim().length ?? 0) <= 8) out.push(`${id}: no photo and no reason`);
    } else {
      if (!LICENCE.test(ph.licence)) out.push(`${id}: licence ${ph.licence}`);
      if (!/^(CC0|Public domain)$/.test(ph.licence) && !creditable(ph.author)) out.push(`${id}: no author`);
      if (!https(ph.source) || !https(ph.image)) out.push(`${id}: a link that is not https`);
      if (ph.shows.trim().length <= 8) out.push(`${id}: what does it show?`);
      if (!ph.via.trim()) out.push(`${id}: how was it found?`);
      if (ph.site === 'Wikimedia Commons' && (!/^File:/.test(ph.file) || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File/.test(ph.source))) out.push(`${id}: not a Commons file page`);
      if (!ph.file.startsWith('File:') && (!ph.title?.trim() || /^openverse:|^[0-9a-f-]{36}$/.test(ph.title))) out.push(`${id}: no title of its own`);
    }
    const a = p.about;
    if (a) {
      const ends = sentenceEnds(a.extract);
      const n = ends.filter((e) => e <= a.text.length).length;
      if (!a.extract.startsWith(a.text)) out.push(`${id}: About not verbatim`);
      else if (!ends.includes(a.text.length)) out.push(`${id}: About cut inside a sentence`);
      else if (n < 1 || n > 3 || (n > 1 && a.text.length > ABOUT_MAX)) out.push(`${id}: About ${n} sentences, ${a.text.length} chars`);
      if (!/^https:\/\/en\.wikipedia\.org\/wiki\//.test(a.url) || a.licence !== 'CC BY-SA 4.0' || !a.title.trim()) out.push(`${id}: About without its article`);
    }
    if (p.official && !/^https?:\/\/[^/]+\.[^/]+/.test(p.official)) out.push(`${id}: official ${p.official}`);
  }
  for (const r of m.rejected) {
    if (!drawn.some((p) => p.id === r.place)) out.push(`rejected ${r.file}: unknown place ${r.place}`);
    if (r.why.trim().length <= 8) out.push(`rejected ${r.file}: no reason`);
  }
  return out;
}

const good = buildManifest();
const broken = (edit: (m: Manifest) => void): string[] => {
  const m = JSON.parse(JSON.stringify(good)) as Manifest;
  edit(m);
  return problems(m);
};
const someWith = (f: (p: Place) => boolean): string => Object.entries(good.places).find(([, p]) => f(p))![0];

describe('the photo manifest · every drawn place, and nothing else', () => {
  it('the demo trip draws places of every kind, keyed by its own ids', () => {
    expect(drawn.length).toBeGreaterThan(20);
    expect(new Set(drawn.map((p) => p.kind))).toEqual(new Set(['spot', 'card', 'bed', 'ticket']));
    expect(drawn.every((p) => p.id.startsWith('dm27-'))).toBe(true);
    expect(problems(good)).toEqual([]);
  });
  it('has one entry per place the Map tab draws — a missing one and a stray one are both caught', () => {
    const gone = drawn[3]!.id;
    expect(broken((m) => delete m.places[gone])).toEqual([`${gone}: no entry`]);
    expect(broken((m) => (m.places['dm27-spot-nowhere'] = { ...m.places[gone]! }))).toEqual(['dm27-spot-nowhere: not a place the Map tab draws']);
  });
  it('names each place as the trip does', () => {
    const id = drawn[2]!.id;
    expect(broken((m) => (m.places[id]!.name = 'Somewhere else'))).toEqual([`${id}: named "Somewhere else", not as the trip does`]);
  });
});

describe('the photo manifest · the photos', () => {
  const photos = Object.entries(good.places).filter(([, p]) => p.photo);
  it('carries a photo for most places', () => {
    expect(photos.length).toBeGreaterThan(drawn.length / 2);
  });
  it('every photo under a licence on the owner’s list, credited, with its page', () => {
    /* the list is licenceOf's: NC, ND, GFDL alone never make it into a manifest */
    expect(licenceOf({ code: 'cc-by-nc-2.0' }).ok).toBe(false);
    expect(licenceOf({ code: 'gfdl' }).ok).toBe(false);
    expect(licenceOf({ code: 'cc-by-sa-3.0-migrated' })).toEqual({ ok: true, licence: 'CC BY-SA 3.0', kind: 'by-sa' });
    const by = someWith((p) => p.photo?.licence === 'CC BY-SA 4.0');
    expect(broken((m) => (m.places[by]!.photo!.licence = 'GFDL'))).toEqual([`${by}: licence GFDL`]);
    /* a CC BY photo names its author; a CC0 one owes no credit */
    expect(broken((m) => (m.places[by]!.photo!.author = '[2]'))).toEqual([`${by}: no author`]);
    expect(good.places[someWith((p) => p.photo?.licence === 'CC0')]!.photo!.author).toBe('');
    expect(broken((m) => (m.places[by]!.photo!.image = 'http://upload.wikimedia.org/demo/x.jpg'))).toEqual([`${by}: a link that is not https`]);
    expect(broken((m) => (m.places[by]!.photo!.shows = 'a photo'))).toEqual([`${by}: what does it show?`]);
  });
  it('a photo that does not live on Commons carries the title its author gave it — never its library’s id (Map 5f)', () => {
    const elsewhere = photos.filter(([, p]) => !p.photo!.file.startsWith('File:'));
    expect(elsewhere.length).toBeGreaterThan(0);
    const [id] = elsewhere[0]!;
    expect(broken((m) => (m.places[id]!.photo!.title = 'openverse:e4ac772e-0000-0000-0000-000000000000'))).toEqual([`${id}: no title of its own`]);
  });
  it('a place without a photo says why', () => {
    const id = someWith((p) => !p.photo);
    expect(broken((m) => (m.places[id]!.noPhoto = ''))).toEqual([`${id}: no photo and no reason`]);
  });
  it('every refusal is written down with its reason, against a drawn place', () => {
    expect(good.rejected.length).toBeGreaterThan(0);
    expect(broken((m) => (m.rejected[0]!.place = 'dm27-spot-elsewhere'))).toEqual(['rejected File:Demo rejected.jpg: unknown place dm27-spot-elsewhere']);
  });
});

describe('the photo manifest · About is Wikipedia’s own words', () => {
  const abouts = Object.entries(good.places).filter(([, p]) => p.about);
  it('every About is a prefix of the article’s summary, cut at a sentence’s end, one to three sentences', () => {
    expect(abouts.length).toBeGreaterThan(10);
    /* the three summaries cut three ways: three sentences, past an abbreviation, and the one long first sentence alone */
    expect(aboutText(EXTRACTS[0]!).endsWith('every day of the year.')).toBe(true);
    expect(aboutText(EXTRACTS[1]!)).toBe(EXTRACTS[1]);
    expect(sentenceEnds(EXTRACTS[1]!)[0]).toBeGreaterThan('St.'.length);
    expect(aboutText(EXTRACTS[2]!).length).toBeLessThan(EXTRACTS[2]!.length);
    const long = someWith((p) => p.about?.extract === EXTRACTS[0]);
    const text = good.places[long]!.about!.text;
    expect(broken((m) => (m.places[long]!.about!.text = text.slice(0, 30)))).toEqual([`${long}: About cut inside a sentence`]);
    expect(broken((m) => (m.places[long]!.about!.text = text.replace('landmark', 'famous landmark')))).toEqual([`${long}: About not verbatim`]);
    expect(broken((m) => (m.places[long]!.about!.text = EXTRACTS[0]!))).toEqual([`${long}: About 4 sentences, ${EXTRACTS[0]!.length} chars`]);
  });
  it('with its article, on the English Wikipedia, under CC BY-SA 4.0', () => {
    const [id] = abouts[0]!;
    expect(broken((m) => (m.places[id]!.about!.licence = 'CC BY-SA 3.0'))).toEqual([`${id}: About without its article`]);
    expect(broken((m) => (m.places[id]!.about!.url = 'https://de.wikipedia.org/wiki/X'))).toEqual([`${id}: About without its article`]);
  });
  it('official sites are real web addresses', () => {
    const id = someWith((p) => !!p.official);
    expect(broken((m) => (m.places[id]!.official = 'www.example'))).toEqual([`${id}: official www.example`]);
  });
});
