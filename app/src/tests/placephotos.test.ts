/* THE PLACES' PHOTOS (Map 5e) — the rules the photo pass keeps (which
   licences, whose credit, Wikipedia's words cut only at a sentence's end), the
   index the app reads out of the map pack (what it trusts and what it drops),
   the lookup (a place by its id, or by an entity riding with it), the credit
   text, and the zoom from which a pin wears its photo. */
import { describe, expect, it } from 'vitest';
import { aboutText, creditable, licenceOf, plainText, sentenceEnds } from '../../scripts/maps/photos/rules';
import {
  creditFree,
  creditLine,
  creditRows,
  deedOf,
  entryFor,
  indexForTrip,
  licencesUsed,
  parseIndex,
  photoButtonName,
  photoCount,
  photoOf,
  photoTitle,
  spanBytes,
} from '../lib/logic/placephotos';
/* the photo pins' zoom rule and image names: the engine's own, shipped with it */
import { parsePhotoPinName, photoPinAt, photoPinName, photoPinStep, PHOTO_PIN_ZOOM } from '../lib/map/street/view';

describe('the photo pass · which licences', () => {
  it('takes CC0, public domain, CC BY and CC BY-SA, any version', () => {
    expect(licenceOf({ code: 'cc-by-sa-4.0', short: 'CC BY-SA 4.0' })).toEqual({ ok: true, licence: 'CC BY-SA 4.0', kind: 'by-sa' });
    expect(licenceOf({ code: 'cc-by-2.0', short: 'CC BY 2.0' })).toEqual({ ok: true, licence: 'CC BY 2.0', kind: 'by' });
    expect(licenceOf({ code: 'cc-by-sa-3.0-migrated', short: 'CC BY-SA 3.0' })).toMatchObject({ ok: true, licence: 'CC BY-SA 3.0' });
    expect(licenceOf({ code: 'cc-by-2.5-cn', short: 'CC BY 2.5 cn' })).toMatchObject({ ok: true, licence: 'CC BY 2.5' });
    expect(licenceOf({ code: 'cc0', short: 'CC0' })).toMatchObject({ ok: true, licence: 'CC0', kind: 'cc0' });
    expect(licenceOf({ code: 'pd', short: 'Public domain' })).toMatchObject({ ok: true, licence: 'Public domain', kind: 'pd' });
    expect(licenceOf({ code: 'pd-self' })).toMatchObject({ ok: true, kind: 'pd' });
  });
  it('refuses everything else — GFDL alone, the Free Art License, NC, ND, non-free, nothing', () => {
    for (const l of [
      { code: 'gfdl', short: 'GFDL' },
      { code: 'fal', short: 'FAL' },
      { code: 'cc-by-nc-sa-2.0', short: 'CC BY-NC-SA 2.0' },
      { code: 'cc-by-nd-4.0', short: 'CC BY-ND 4.0' },
      { code: 'attribution', short: 'Attribution' },
      { code: 'cc-by-sa-4.0', short: 'CC BY-SA 4.0', nonFree: 'true' },
      { short: 'Copyrighted free use' },
      {},
    ]) {
      expect(licenceOf(l).ok, JSON.stringify(l)).toBe(false);
    }
  });
});

describe('the photo pass · whose credit, in plain text', () => {
  it('drops Commons’ HTML and nothing else', () => {
    expect(plainText('<a href="//commons.wikimedia.org/wiki/User:Shujianyang" title="User:Shujianyang">Shujianyang</a>')).toBe('Shujianyang');
    expect(plainText('<bdi><a href="https://www.wikidata.org/wiki/Q1">Charlie fong</a></bdi> 冯成')).toBe('Charlie fong 冯成');
    expect(plainText('Uwe Aranas / <a href="x">CEphoto</a>&nbsp;&amp; friends')).toBe('Uwe Aranas / CEphoto & friends');
    expect(plainText(undefined)).toBe('');
  });
  it('never credits a photo to nobody: a bare footnote link or Commons’ no-author notice is no name', () => {
    expect(creditable('Shujianyang')).toBe(true);
    expect(creditable('The original uploader was KingPilaf at Chinese Wikipedia.')).toBe(true);
    expect(creditable('[2]')).toBe(false);
    expect(creditable('No machine-readable author provided. Baycrest assumed (based on copyright claims).')).toBe(false);
    expect(creditable('Unknown authorUnknown author')).toBe(false);
    expect(creditable('  ')).toBe(false);
  });
});

describe('the photo pass · Wikipedia’s words, verbatim, cut at a sentence’s end', () => {
  const heaven =
    'The Temple of Heaven is a complex of imperial religious Confucian buildings situated in the southeastern part of central Beijing. The complex was visited by the Emperors of the Ming and then later restored by the Qing dynasties for annual ceremonies of prayer to Heaven for a good harvest and other seasonal rites. It has been regarded as a Taoist temple, although Chinese Heaven worship predates Taoism.';
  it('keeps as many whole sentences as fit, one to three, as a prefix of the summary', () => {
    const t = aboutText(heaven);
    expect(heaven.startsWith(t)).toBe(true);
    expect(t.endsWith('seasonal rites.')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(380);
  });
  it('never ends on an abbreviation or an initial', () => {
    const s = 'The Ruins of St. Paul’s are the remnants of a church. It was built c. 1602 by the Jesuits. J. R. Smith wrote of it.';
    expect(sentenceEnds(s).map((i) => s.slice(0, i))).toEqual(['The Ruins of St. Paul’s are the remnants of a church.', 'The Ruins of St. Paul’s are the remnants of a church. It was built c. 1602 by the Jesuits.', s]);
    expect(aboutText(s)).toBe(s);
  });
  it('ends a sentence where Wikipedia forgot the space, and never runs past the first paragraph', () => {
    const road = 'Hollywood Road is a street on Hong Kong Island. It runs between Central and Sheung Wan, all within its vicinity.It intersects with several streets.';
    expect(aboutText(road, 120)).toBe('Hollywood Road is a street on Hong Kong Island. It runs between Central and Sheung Wan, all within its vicinity.');
    /* …and never shows the missing space itself, however much room there is */
    expect(aboutText(road)).toBe('Hollywood Road is a street on Hong Kong Island. It runs between Central and Sheung Wan, all within its vicinity.');
    expect(aboutText('Lamma Island is the third largest island in Hong Kong. It is in the Islands District.\nLamma Island is a rural area.')).toBe(
      'Lamma Island is the third largest island in Hong Kong. It is in the Islands District.',
    );
  });
  it('keeps a first sentence whole however long it is', () => {
    const one = `${'A very long clause, '.repeat(30)}and the end.`;
    expect(aboutText(one)).toBe(one);
  });
});

/* ---------- the index the app reads ---------- */
const photo = (at: number, extra: Record<string, unknown> = {}) => ({
  file: 'File:Temple of Heaven 20160323 01.jpg',
  w: 4000,
  h: 2660,
  author: 'Shujianyang',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  source: 'https://commons.wikimedia.org/wiki/File:Temple_of_Heaven_20160323_01.jpg',
  card: [at, 1000, 800, 532],
  rail: [at + 1000, 300, 536, 216],
  pin: [at + 1300, 100, 128, 128],
  ...extra,
});
const INDEX = {
  v: 1,
  trip: 'cn26',
  places: {
    'cn26-spot-beijing-temple-heaven': {
      name: 'Temple of Heaven',
      city: 'Beijing',
      photo: photo(0),
      about: { text: 'The Temple of Heaven is a complex of imperial religious Confucian buildings.', title: 'Temple of Heaven', url: 'https://en.wikipedia.org/wiki/Temple_of_Heaven', licence: 'CC BY-SA 4.0' },
      official: 'https://www.tiantanpark.com/',
    },
    'cn26-place-07': { name: 'Beijing Massage Hospital', city: 'Beijing' },
    'cn26-ticket-forbidden-city': { name: 'Palace Museum', city: 'Beijing', photo: photo(2000, { author: '', licence: 'Public domain', licenceUrl: undefined }) },
  },
};

describe('the photo index · what the app trusts', () => {
  it('reads the index, and where its photo region starts in the pack', () => {
    const idx = parseIndex(INDEX, 5000, 700_000)!;
    expect(Object.keys(idx.places)).toEqual(['cn26-spot-beijing-temple-heaven', 'cn26-place-07', 'cn26-ticket-forbidden-city']);
    expect(idx.base).toBe(700_000);
    expect(spanBytes(idx, idx.places['cn26-spot-beijing-temple-heaven']!.photo!.card)).toEqual([700_000, 701_000]);
    expect(idx.places['cn26-place-07']!.photo).toBeUndefined();
  });
  it('refuses another version, or no places', () => {
    expect(parseIndex({ ...INDEX, v: 2 }, 5000)).toBeNull();
    expect(parseIndex({ v: 1 }, 5000)).toBeNull();
    expect(parseIndex('nope', 5000)).toBeNull();
  });
  it('never keeps a photo without its credit, its licence or its page, nor one outside the photo region', () => {
    const bad = (p: Record<string, unknown>) => parseIndex({ v: 1, places: { x: { name: 'X', photo: p } } }, 5000)!.places.x!.photo;
    expect(bad(photo(0))).toBeDefined();
    expect(bad(photo(0, { licence: '' }))).toBeUndefined();
    expect(bad(photo(0, { source: 'javascript:alert(1)' }))).toBeUndefined();
    expect(bad(photo(0, { author: undefined }))).toBeUndefined();
    /* MAP 5F, item 7: a CC BY or BY-SA photo with a blank author was kept, and shown as "Photo · CC BY 2.0" */
    expect(bad(photo(0, { author: '', licence: 'CC BY 2.0' }))).toBeUndefined();
    expect(bad(photo(0, { author: '   ', licence: 'CC BY-SA 4.0' }))).toBeUndefined();
    /* …while CC0 and the public domain ask no credit */
    expect(bad(photo(0, { author: '', licence: 'CC0' }))?.author).toBe('');
    expect(bad(photo(0, { author: '', licence: 'Public domain' }))).toBeDefined();
    expect([creditFree('CC0'), creditFree('Public domain'), creditFree('CC BY 2.0'), creditFree('CC BY-SA 4.0')]).toEqual([true, true, false, false]);
    expect(bad(photo(4000))).toBeUndefined(); // its pin ends at 5400, past the index at 5000
    expect(bad(photo(0, { card: [0, 0, 800, 532] }))).toBeUndefined();
    /* an About without its article is dropped, the photo kept */
    const idx = parseIndex({ v: 1, places: { x: { name: 'X', photo: photo(0), about: { text: 'Words.', title: 'X', licence: 'CC BY-SA 4.0' } } } }, 5000)!;
    expect(idx.places.x!.photo).toBeDefined();
    expect(idx.places.x!.about).toBeUndefined();
  });
});

describe('the photo index · the lookup', () => {
  const idx = parseIndex(INDEX, 5000)!;
  it('finds a place by its own id', () => {
    expect(photoOf(idx, { id: 'cn26-spot-beijing-temple-heaven', with: [] })?.author).toBe('Shujianyang');
  });
  it('finds it by an entity riding with it (a ticket at its spot)', () => {
    expect(entryFor(idx, { id: 'cn26-spot-beijing-palace-museum', with: [{ id: 'cn26-ticket-forbidden-city' }] })?.name).toBe('Palace Museum');
  });
  it('says "looked at, no free photo" apart from "never looked at"', () => {
    const massage = entryFor(idx, { id: 'cn26-place-07', with: [] });
    expect(massage).toBeDefined();
    expect(massage?.photo).toBeUndefined();
    expect(entryFor(idx, { id: 'cn26-spot-somewhere-new', with: [] })).toBeUndefined();
    expect(entryFor(null, { id: 'cn26-place-07' })).toBeUndefined();
  });
});

describe('the credit text', () => {
  it('names who took it and the licence, and nothing it does not know', () => {
    expect(creditLine({ author: 'Shujianyang', licence: 'CC BY-SA 4.0' })).toBe('Photo: Shujianyang · CC BY-SA 4.0');
    expect(creditLine({ author: '  ', licence: 'Public domain' })).toBe('Photo · Public domain');
  });
  it('titles a file by its own name', () => {
    expect(photoTitle({ file: 'File:Temple_of_Heaven 20160323 01.jpg' })).toBe('Temple of Heaven 20160323 01');
  });
  /* MAP 5F, item 3: the Flickr photo found through Openverse was credited as "openverse:e4ac772e-…" */
  it('titles a photo from elsewhere by the title its author gave it — never by its library’s id', () => {
    const jade = { file: 'openverse:e4ac772e-9e09-4262-a0d1-aa244e7eefae', title: 'Dali - Cangshan' };
    expect(photoTitle(jade)).toBe('Dali - Cangshan');
    expect(photoTitle({ file: jade.file })).toBe('');
    expect(photoTitle({ file: 'File:Beijing Shichahai 1.jpg', title: '  ' })).toBe('Beijing Shichahai 1');
    /* …and the index carries the title through */
    const idx = parseIndex({ v: 1, places: { x: { name: 'Jade Belt Road', photo: photo(0, { file: jade.file, title: ' Dali - Cangshan ', author: 'Mulligan Stu', licence: 'CC BY 2.0' }) } } }, 5000)!;
    expect(idx.places.x!.photo!.title).toBe('Dali - Cangshan');
    expect(photoTitle(idx.places.x!.photo!)).toBe('Dali - Cangshan');
  });
  it('lists every credit, the licences once each, the photos counted once', () => {
    const idx = parseIndex(INDEX, 5000)!;
    expect(creditRows(idx).map((r) => r.id)).toEqual(['cn26-spot-beijing-temple-heaven', 'cn26-ticket-forbidden-city']);
    expect(licencesUsed(idx)).toEqual([
      { licence: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0', n: 1, texts: 1 },
      { licence: 'Public domain', n: 1, texts: 0 },
    ]);
    expect(photoCount(idx)).toBe(2);
    expect(creditRows(null)).toEqual([]);
  });
  /* MAP 5F, item 12: the About texts' licence was linked only when a photo happened to share it */
  it('links the About texts’ licence too, whether or not a photo shares it', () => {
    const idx = parseIndex(
      {
        v: 1,
        places: {
          a: { name: 'A', photo: photo(0, { licence: 'CC BY 2.0', licenceUrl: 'https://creativecommons.org/licenses/by/2.0/' }), about: { text: 'Words.', title: 'A', url: 'https://en.wikipedia.org/wiki/A', licence: 'CC BY-SA 4.0' } },
          b: { name: 'B', about: { text: 'More words.', title: 'B', url: 'https://en.wikipedia.org/wiki/B', licence: 'CC BY-SA 4.0' } },
        },
      },
      5000,
    )!;
    const used = licencesUsed(idx);
    expect(used.map((l) => l.licence)).toEqual(['CC BY 2.0', 'CC BY-SA 4.0']);
    expect(used.find((l) => l.licence === 'CC BY-SA 4.0')).toEqual({ licence: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', n: 0, texts: 2 });
    expect(deedOf('CC BY 2.5')).toBe('https://creativecommons.org/licenses/by/2.5/');
    expect(deedOf('CC0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(deedOf('Public domain')).toBeUndefined();
  });
  /* MAP 5F, item 11: the button's label replaced the credit it shows */
  it('a photo button’s name says what a tap does AND the credit the photo wears', () => {
    const name = photoButtonName('Show the photo of Temple of Heaven full screen', { author: 'Shujianyang', licence: 'CC BY-SA 4.0' });
    expect(name).toBe('Show the photo of Temple of Heaven full screen. Photo: Shujianyang · CC BY-SA 4.0');
    expect(photoButtonName('Look for this: the photo of X, full screen', { author: '', licence: 'CC0' })).toMatch(/Photo · CC0$/);
  });
  /* MAP 5F, item 8: the Israel trip with the China pack drew an empty colour box on every card */
  it('photos only for the trip the pack was built for', () => {
    const idx = parseIndex(INDEX, 5000)!;
    expect(indexForTrip(idx, 'cn26')).toBe(idx);
    expect(indexForTrip(idx, 'il26')).toBeNull();
    expect(indexForTrip(parseIndex({ ...INDEX, trip: undefined }, 5000), 'cn26')).toBeNull();
    expect(indexForTrip(null, 'cn26')).toBeNull();
  });
  it('counts a photo two places share once — in the licences as in the pack’s count', () => {
    /* the lakes' photo serves Shichahai and the Houhai card: one image, two credits */
    const shared = parseIndex({ v: 1, places: { ...INDEX.places, 'cn26-spot-beijing-shichahai': { name: 'Shichahai', city: 'Beijing', photo: photo(0) } } }, 5000)!;
    expect(creditRows(shared)).toHaveLength(3);
    expect(photoCount(shared)).toBe(2);
    expect(licencesUsed(shared).reduce((n, l) => n + l.n, 0)).toBe(photoCount(shared));
    expect(licencesUsed(shared).find((l) => l.licence === 'CC BY-SA 4.0')?.n).toBe(1);
  });
});

describe('the photo pins · the zoom rule', () => {
  it('wears the photo from PHOTO_PIN_ZOOM on, and never without one', () => {
    expect(PHOTO_PIN_ZOOM).toBe(15);
    expect(photoPinAt(14.99, true)).toBe(false);
    expect(photoPinAt(15, true)).toBe(true);
    expect(photoPinAt(17.5, true)).toBe(true);
    expect(photoPinAt(18, false)).toBe(false);
  });
  /* MAP 5F, item 13: the style wrote its own `step` and only the test read photoPinAt — one rule, one source */
  it('the style’s zoom rule and the screen’s reading of it are one: a maplibre step at PHOTO_PIN_ZOOM', () => {
    expect(photoPinStep('icon', 'photo')).toEqual(['step', ['zoom'], 'icon', PHOTO_PIN_ZOOM, 'photo']);
    /* evaluated as maplibre evaluates a step, at every quarter zoom from 10 to 19: photoPinAt says what the style draws */
    const [, , below, from, above] = photoPinStep('icon', 'photo');
    for (let z = 10; z <= 19; z += 0.25) expect(photoPinAt(z, true), `z${z}`).toBe((z >= from ? above : below) === 'photo');
  });
  it('names its map image by the place and the pin’s variant, and reads it back', () => {
    expect(photoPinName('cn26-spot-beijing-beihai', '')).toBe('ph-cn26-spot-beijing-beihai');
    expect(photoPinName('cn26-place-05', 'today')).toBe('ph-cn26-place-05-today');
    expect(parsePhotoPinName('ph-cn26-place-05-today')).toEqual({ id: 'cn26-place-05', v: 'today' });
    expect(parsePhotoPinName('ph-cn26-stay-10-tonight')).toEqual({ id: 'cn26-stay-10', v: 'tonight' });
    expect(parsePhotoPinName('ph-cn26-spot-beijing-beihai')).toEqual({ id: 'cn26-spot-beijing-beihai', v: '' });
    expect(parsePhotoPinName('pin-sight-today')).toBeNull();
    expect(parsePhotoPinName('cl-sight-3')).toBeNull();
  });
});
