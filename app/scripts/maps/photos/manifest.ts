/* THE PHOTO MANIFEST (Map 5e) — DEV ONLY. What goes into the map pack for
   every drawn place, decided once and committed (photos/manifest.json), so
   the pack build is the same every time and the tests can hold it to the
   rules:

   · THE PHOTO — only the one choices.ts names for the place, and only after
     it was LOOKED AT on the contact sheets (fetch.ts sheets): it must show
     this place, not a namesake or a street somewhere. Its licence must be on
     the owner's list (rules.ts licenceOf), and its author, licence and file
     page are recorded as the file page gives them.
   · THE ABOUT — the first sentences of the English Wikipedia article of the
     place's own Wikidata item (the one Map 5a's evidence verified the pin
     with; ITEM_FIX where that evidence matched a namesake), cut by
     rules.ts aboutText, verbatim — and the summary's first paragraph beside
     it, so a test can prove the cut is a prefix of Wikipedia's own words.
   · THE LINKS — that article, and the item's official website (P856) — the
     English one where it has two.

   Run (from app/):  npx tsx scripts/maps/photos/manifest.ts
   It reads the lookups' cache (fetch.ts) and asks Commons, once and politely,
   for the 1280 px image of each chosen photo; it writes manifest.json and the
   coverage report (app/.cache/photos/report.md) — every place, city by city,
   and every candidate refused, with the reason. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppBackup } from '../../../src/lib/model/types';
import { CATEGORIES } from '../../../src/lib/logic/mapplaces';
import { ABOUT_SKIP, CHOICES, ITEM_FIX, OFFICIAL_SKIP, type Choice } from './choices';
import { photoPlaces } from './places';
import { CACHE, getJson, readCache, writeCache } from './net';
import { aboutText, creditable, licenceOf } from './rules';
import { MANIFEST, type Manifest, type ManifestPlace } from './pack-photos';
import type { Candidate, Item } from './fetch';

const seed = JSON.parse(readFileSync(join(CACHE, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const PLACES = photoPlaces(seed);
const ITEMS = readCache<Record<string, Item>>('items.json') ?? {};
const SUMMARIES = readCache<Record<string, { type?: string; title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } } | null>>('summaries.json') ?? {};
const CANDS = readCache<Record<string, Candidate[]>>('candidates.json') ?? {};

const missing = PLACES.filter((p) => !CHOICES[p.id]);
if (missing.length) {
  console.error(`No choice made yet for ${missing.length} places:\n  ${missing.map((p) => `${p.id} (${p.name})`).join('\n  ')}`);
  process.exit(1);
}
const stale = Object.keys(CHOICES).filter((id) => !PLACES.some((p) => p.id === id));
if (stale.length) {
  console.error(`choices.ts names places the trip no longer draws: ${stale.join(', ')}`);
  process.exit(1);
}

/* the 1280 px image of each chosen Commons photo (the pack's own sizes are made from it) */
const chosen = PLACES.map((p) => CHOICES[p.id]).filter((c): c is Choice & { photo: string } => !!c && 'photo' in c && !!c.photo && c.photo.startsWith('File:'));
const big = new Map<string, { thumb?: string; url: string; w: number; h: number }>();
{
  const titles = [...new Set(chosen.map((c) => c.photo))];
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const body = await getJson<{ query?: { pages?: { title: string; imageinfo?: { url: string; thumburl?: string; width: number; height: number }[] }[]; normalized?: { from: string; to: string }[] } }>(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize&iiurlwidth=1280&titles=${batch.map((t) => encodeURIComponent(t)).join('%7C')}`,
    );
    const from = new Map((body?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const pg of body?.query?.pages ?? []) {
      const ii = pg.imageinfo?.[0];
      if (!ii) continue;
      const v = { ...(ii.thumburl ? { thumb: ii.thumburl } : {}), url: ii.url, w: ii.width, h: ii.height };
      big.set(pg.title, v);
      const f = from.get(pg.title);
      if (f) big.set(f, v);
    }
  }
}

/** The official site to link: the English one where the item names two. */
function official(urls: string[]): string | undefined {
  const ok = urls.filter((u) => {
    try {
      const x = new URL(u);
      return /^https?:$/.test(x.protocol) && x.hostname.includes('.') && !/\/\.[a-z]+$/.test(x.pathname);
    } catch {
      return false;
    }
  });
  return ok.find((u) => /\/\/en\.|\/en(glish)?\/|\/eng\//i.test(u)) ?? ok[0];
}

const places: Record<string, ManifestPlace> = {};
const rejected: Manifest['rejected'] = [];
const problems: string[] = [];
for (const p of PLACES) {
  const choice = CHOICES[p.id]!;
  const wd = ITEM_FIX[p.id]?.wd ?? p.wd;
  const it = wd ? ITEMS[wd] : undefined;
  const sum = wd ? SUMMARIES[wd] : undefined;
  const out: ManifestPlace = { name: p.name, city: p.city, category: p.category, ...(wd ? { item: wd } : {}) };

  if (sum?.type === 'standard' && sum.extract && sum.title && sum.content_urls?.desktop?.page && !ABOUT_SKIP[p.id]) {
    const para = (sum.extract.trim().split(/\n/)[0] ?? '').trim();
    out.about = { text: aboutText(para), extract: para, title: sum.title, url: sum.content_urls.desktop.page, licence: 'CC BY-SA 4.0' };
  }
  const off = it && !OFFICIAL_SKIP[p.id] ? official(it.p856) : undefined;
  if (off) out.official = off;

  for (const r of choice.rejected ?? []) rejected.push({ place: p.id, file: r.file, why: r.why });
  if ('photo' in choice && choice.photo) {
    const c = (CANDS[p.id] ?? []).find((x) => x.file === choice.photo) ?? Object.values(CANDS).flat().find((x) => x.file === choice.photo);
    if (!c) {
      problems.push(`${p.id}: the chosen ${choice.photo} is not among the candidates looked at`);
      continue;
    }
    const lic = licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree });
    if (!lic.ok) {
      problems.push(`${p.id}: ${c.file} — ${lic.why}`);
      continue;
    }
    if (!creditable(c.author) && lic.kind !== 'pd' && lic.kind !== 'cc0') {
      problems.push(`${p.id}: ${c.file} names no author to credit (“${c.author}”)`);
      continue;
    }
    const b = c.file.startsWith('File:') ? big.get(c.file) : undefined;
    /* Commons: its 1280 px image (the original when it is smaller); elsewhere: the source's own full image, never a preview */
    const image = c.file.startsWith('File:') ? (b ? (b.w > 1280 ? (b.thumb ?? b.url) : b.url) : undefined) : (c.orig ?? c.thumb);
    if (!image) {
      problems.push(`${p.id}: no image URL for ${c.file}`);
      continue;
    }
    out.photo = {
      file: c.file,
      w: c.w,
      h: c.h,
      author: creditable(c.author) ? c.author : '',
      licence: lic.licence,
      ...(c.licenceUrl ? { licenceUrl: c.licenceUrl } : {}),
      source: c.page,
      site: c.file.startsWith('File:') ? 'Wikimedia Commons' : /flickr/i.test(c.page) ? 'Flickr' : new URL(c.page).hostname,
      image,
      ...(choice.fy !== undefined ? { fy: choice.fy } : {}),
      via: c.via,
      shows: choice.shows,
    };
  } else if ('none' in choice) {
    out.noPhoto = choice.none;
  }
  places[p.id] = out;
}
if (problems.length) {
  console.error(`The manifest was NOT written:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const manifest: Manifest = { v: 1, trip: seed.trips[0]!.trip.id, built: new Date().toISOString().slice(0, 10), places, rejected };
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);

/* ---------- the report: coverage city by city, category by category, and every refusal ---------- */
const cities = [...new Set(PLACES.map((p) => p.city))];
const cats = CATEGORIES.filter((c) => PLACES.some((p) => p.category === c));
const cell = (list: typeof PLACES): string => {
  const w = list.filter((p) => places[p.id]?.photo).length;
  return list.length ? `${w} / ${list.length}` : '·';
};
const lines: string[] = [];
lines.push(`| City | places | with a photo | without | About | official site | ${cats.join(' | ')} |`);
lines.push(`|---|---:|---:|---:|---:|---:|${cats.map(() => '---:').join('|')}|`);
for (const city of cities) {
  const list = PLACES.filter((p) => p.city === city);
  const w = list.filter((p) => places[p.id]?.photo).length;
  lines.push(`| ${city} | ${list.length} | ${w} | ${list.length - w} | ${list.filter((p) => places[p.id]?.about).length} | ${list.filter((p) => places[p.id]?.official).length} | ${cats.map((c) => cell(list.filter((p) => p.category === c))).join(' | ')} |`);
}
{
  const w = PLACES.filter((p) => places[p.id]?.photo).length;
  lines.push(`| **All** | ${PLACES.length} | ${w} | ${PLACES.length - w} | ${PLACES.filter((p) => places[p.id]?.about).length} | ${PLACES.filter((p) => places[p.id]?.official).length} | ${cats.map((c) => cell(PLACES.filter((p) => p.category === c))).join(' | ')} |`);
}
lines.push('', '| Category | places | with a photo | without |', '|---|---:|---:|---:|');
for (const c of cats) {
  const list = PLACES.filter((p) => p.category === c);
  const w = list.filter((p) => places[p.id]?.photo).length;
  lines.push(`| ${c} | ${list.length} | ${w} | ${list.length - w} |`);
}
lines.push('', '### Without a photo, and why', '');
for (const p of PLACES) if (!places[p.id]?.photo) lines.push(`- **${p.name}** (${p.city}, ${p.category}) — ${places[p.id]?.noPhoto ?? '—'}`);
lines.push('', '### Every candidate refused, and why', '');
for (const r of rejected) lines.push(`- ${PLACES.find((p) => p.id === r.place)?.name ?? r.place}: \`${r.file.replace(/^File:/, '')}\` — ${r.why}`);
const licences = new Map<string, number>();
for (const p of Object.values(places)) if (p.photo) licences.set(p.photo.licence, (licences.get(p.photo.licence) ?? 0) + 1);
lines.push('', `Licences: ${[...licences].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(' · ')}`);
lines.push(`Photos from: ${[...new Set(Object.values(places).flatMap((p) => (p.photo ? [p.photo.site] : [])))].join(', ')}`);
writeFileSync(join(CACHE, 'report.md'), `${lines.join('\n')}\n`);
writeCache('manifest-summary.json', { places: PLACES.length, photos: Object.values(places).filter((p) => p.photo).length, about: Object.values(places).filter((p) => p.about).length, official: Object.values(places).filter((p) => p.official).length, rejected: rejected.length });
console.log(`manifest: ${MANIFEST}\n${lines.slice(0, cities.length + 3).join('\n')}`);
