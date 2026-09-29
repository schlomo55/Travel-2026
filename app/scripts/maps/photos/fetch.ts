/* THE PHOTO LOOKUPS (Map 5e) — DEV ONLY, run by hand, never by the build.

   Run (from app/):  npx tsx scripts/maps/photos/fetch.ts [stage…]
     items      the Wikidata items: Map 5a's for each drawn place — its image
                (P18), Commons category (P373), official website (P856),
                English Wikipedia article, position (P625)
     summaries  each article's REST summary (the About text is cut from it)
     files      the candidate photos: the item's P18 first; then files in its
                Commons category; files geotagged near the pin whose name or
                categories carry the place's name; a Commons search by name —
                each read with its licence, author, size, geotag, categories
     openverse  for places Commons left without a usable candidate: Openverse
                (CC-licensed libraries, Flickr among them), licence-filtered
     thumbs     a 500 px thumbnail of every candidate, for looking at
     sheets     contact sheets, city by city (app/.cache/photos/sheets/) — how
                every candidate is LOOKED AT before it may be chosen
   No stage given: all of them, in that order. Everything is cached
   (app/.cache/photos/, net.ts), so a second run is instant and offline. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { AppBackup } from '../../../src/lib/model/types';
import { haversineKm } from '../../../src/lib/logic/geoStats';
import { photoPlaces, type PhotoPlace } from './places';
import { asked, CACHE, cachedFile, getFile, getJson, readCache, writeCache } from './net';
import { licenceOf, plainText } from './rules';
import { ITEM_FIX } from './choices';

const seed = JSON.parse(readFileSync(join(CACHE, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
/* the item each place is looked up by: Map 5a's, or the fix where that one was a namesake */
const PLACES = photoPlaces(seed).map((p) => (ITEM_FIX[p.id] ? { ...p, wd: ITEM_FIX[p.id]!.wd, wdFrom: 'choices.ts ITEM_FIX' } : p));
const stages = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (s: string): boolean => !stages.length || stages.includes(s);
/* --ids a,b: only these places (a second look); --first: only each place's first candidate */
const opt = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ONLY = opt('ids')?.split(',').filter(Boolean);
const FIRST = process.argv.includes('--first');
const UPTO = Number(opt('upto') ?? 5);
/* --second: the sheets show only the second look's candidates (extra.ts), up to COLS a row */
const SECOND = process.argv.includes('--second');
const COLS = SECOND ? 8 : 5;

/* ---------- Wikidata ---------- */
interface Snak {
  mainsnak?: { datavalue?: { value?: unknown } };
  rank?: string;
}
interface Entity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, Snak[]>;
  sitelinks?: Record<string, { title: string }>;
}
export interface Item {
  id: string;
  en?: string;
  zh?: string;
  p18: string[];
  p373?: string;
  p856: string[];
  p625?: { lat: number; lng: number };
  p31: string[];
  enwiki?: string;
}
function values(e: Entity, p: string): unknown[] {
  const list = (e.claims?.[p] ?? []).filter((s) => s.rank !== 'deprecated');
  const pref = list.filter((s) => s.rank === 'preferred');
  return (pref.length ? pref : list).map((s) => s.mainsnak?.datavalue?.value).filter((v) => v !== undefined);
}
async function items(ids: string[]): Promise<Record<string, Item>> {
  const out: Record<string, Item> = {};
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 50) {
    const batch = uniq.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels%7Cclaims%7Csitelinks&languages=en%7Czh%7Czh-hans%7Czh-hant%7Czh-cn%7Czh-hk&sitefilter=enwiki&ids=${batch.join('%7C')}`;
    const body = await getJson<{ entities?: Record<string, Entity> }>(url);
    for (const id of batch) {
      const e = body?.entities?.[id];
      if (!e) continue;
      const pos = values(e, 'P625')[0] as { latitude?: number; longitude?: number } | undefined;
      const lab = (l: string): string | undefined => e.labels?.[l]?.value;
      out[id] = {
        id,
        ...(lab('en') ? { en: lab('en') } : {}),
        ...(['zh', 'zh-hans', 'zh-cn', 'zh-hant', 'zh-hk'].map(lab).find(Boolean) ? { zh: ['zh', 'zh-hans', 'zh-cn', 'zh-hant', 'zh-hk'].map(lab).find(Boolean)! } : {}),
        p18: values(e, 'P18').filter((v): v is string => typeof v === 'string'),
        ...(typeof values(e, 'P373')[0] === 'string' ? { p373: values(e, 'P373')[0] as string } : {}),
        p856: values(e, 'P856').filter((v): v is string => typeof v === 'string' && /^https?:\/\//.test(v)),
        ...(pos && typeof pos.latitude === 'number' && typeof pos.longitude === 'number' ? { p625: { lat: pos.latitude, lng: pos.longitude } } : {}),
        p31: values(e, 'P31').map((v) => (v as { id?: string })?.id).filter((v): v is string => !!v),
        ...(e.sitelinks?.enwiki?.title ? { enwiki: e.sitelinks.enwiki.title } : {}),
      };
    }
  }
  return out;
}

/* ---------- Commons ---------- */
export interface Candidate {
  /** "File:…" on Commons, or "openverse:<id>" */
  file: string;
  via: string;
  w: number;
  h: number;
  mime: string;
  thumb: string;
  /** the original file (for the pack's own sizes, made from it or its 1280 px thumbnail) */
  orig?: string;
  page: string;
  author: string;
  credit?: string;
  licenceCode?: string;
  licenceShort?: string;
  licenceUrl?: string;
  nonFree?: string;
  restrictions?: string;
  description?: string;
  categories?: string[];
  geo?: { lat: number; lng: number };
  km?: number;
  date?: string;
}
const EXT = 'Artist|Credit|License|LicenseShortName|LicenseUrl|NonFree|Restrictions|ImageDescription|Categories|GPSLatitude|GPSLongitude|DateTimeOriginal|ObjectName';
type Info = { title: string; missing?: string; imageinfo?: { url: string; descriptionurl: string; thumburl?: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value: string }> }[] };
/* Every file's answer is kept BY TITLE (fileinfo.json), so a new title asks
   Commons for itself alone — batches that shift when a place gains a title do
   not ask again for the ones already answered. Seeded once from the batches
   already in the HTTP cache. */
function knownInfo(): Record<string, Info> {
  const kept = readCache<Record<string, Info>>('fileinfo.json');
  if (kept) return kept;
  const out: Record<string, Info> = {};
  const dir = join(CACHE, 'http');
  for (const f of readdirSync(dir)) {
    const k = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { url?: string; body?: { query?: { pages?: Info[]; normalized?: { from: string; to: string }[] } } };
    if (!k.url?.includes('prop=imageinfo') || !k.url.includes('iiurlwidth=500')) continue;
    const norm = new Map((k.body?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of k.body?.query?.pages ?? []) {
      out[p.title] = p;
      const from = norm.get(p.title);
      if (from) out[from] = p;
    }
  }
  return out;
}
async function commonsInfo(titles: string[], width = 500): Promise<Map<string, Info>> {
  const known = knownInfo();
  const uniq = [...new Set(titles)];
  const need = uniq.filter((t) => !known[t]);
  for (let i = 0; i < need.length; i += 40) {
    const batch = need.slice(i, i + 40);
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata` +
      `&iiurlwidth=${width}&iiextmetadatafilter=${encodeURIComponent(EXT)}&titles=${batch.map((t) => encodeURIComponent(t)).join('%7C')}`;
    const body = await getJson<{ query?: { pages?: Info[]; normalized?: { from: string; to: string }[] } }>(url);
    const norm = new Map((body?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of body?.query?.pages ?? []) {
      known[p.title] = p;
      const from = norm.get(p.title);
      if (from) known[from] = p;
    }
  }
  writeCache('fileinfo.json', known);
  return new Map(uniq.filter((t) => known[t]).map((t) => [t, known[t]!]));
}
function candidateOf(p: Info, via: string, pos: { lat: number; lng: number }): Candidate | null {
  const ii = p.imageinfo?.[0];
  if (!ii || p.missing !== undefined) return null;
  const m = ii.extmetadata ?? {};
  const v = (k: string): string | undefined => m[k]?.value;
  const lat = Number(v('GPSLatitude'));
  const lng = Number(v('GPSLongitude'));
  const geo = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : undefined;
  return {
    file: p.title,
    via,
    w: ii.width,
    h: ii.height,
    mime: ii.mime,
    thumb: ii.thumburl ?? ii.url,
    orig: ii.url,
    page: ii.descriptionurl,
    author: plainText(v('Artist')),
    ...(v('Credit') ? { credit: plainText(v('Credit')) } : {}),
    ...(v('License') ? { licenceCode: v('License') } : {}),
    ...(v('LicenseShortName') ? { licenceShort: plainText(v('LicenseShortName')) } : {}),
    ...(v('LicenseUrl') ? { licenceUrl: v('LicenseUrl') } : {}),
    ...(v('NonFree') ? { nonFree: v('NonFree') } : {}),
    ...(v('Restrictions') ? { restrictions: v('Restrictions') } : {}),
    ...(v('ImageDescription') ? { description: plainText(v('ImageDescription')).slice(0, 300) } : {}),
    ...(v('Categories') ? { categories: v('Categories')!.split('|').filter(Boolean) } : {}),
    ...(geo ? { geo, km: Math.round(haversineKm(geo, pos) * 100) / 100 } : {}),
    ...(v('DateTimeOriginal') ? { date: plainText(v('DateTimeOriginal')).slice(0, 10) } : {}),
  };
}
async function categoryFiles(cat: string, limit = 30): Promise<string[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&list=categorymembers&cmtype=file&cmlimit=${limit}&cmtitle=${encodeURIComponent(`Category:${cat}`)}`;
  const body = await getJson<{ query?: { categorymembers?: { title: string }[] } }>(url);
  return (body?.query?.categorymembers ?? []).map((m) => m.title).filter((t) => /\.(jpe?g|png|webp|tiff?)$/i.test(t));
}
async function geoFiles(pos: { lat: number; lng: number }, radius: number): Promise<{ title: string; dist: number }[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&list=geosearch&gsnamespace=6&gslimit=100&gsradius=${radius}&gscoord=${pos.lat.toFixed(5)}%7C${pos.lng.toFixed(5)}`;
  const body = await getJson<{ query?: { geosearch?: { title: string; dist: number }[] } }>(url);
  return (body?.query?.geosearch ?? []).filter((g) => /\.(jpe?g|png|webp)$/i.test(g.title));
}
async function searchFiles(q: string, limit = 20): Promise<string[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=6&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`;
  const body = await getJson<{ query?: { search?: { title: string }[] } }>(url);
  return (body?.query?.search ?? []).map((s) => s.title).filter((t) => /\.(jpe?g|png|webp)$/i.test(t));
}

/** The words that name a place, for matching file names and categories. */
function tokens(p: PhotoPlace, item?: Item): string[] {
  const words = new Set<string>();
  const add = (s: string | undefined): void => {
    if (!s) return;
    const t = s.replace(/[·,()“”"']/g, ' ').trim();
    if (/[一-鿿]/.test(t)) {
      for (const run of t.match(/[一-鿿]{2,}/g) ?? []) words.add(run);
    } else {
      const w = t.split(/\s+/).filter((x) => x.length > 3 && !/^(the|and|park|temple|road|street|station|railway|village|town|island|museum|hall|lake|mountain|ancient|old|great|wall|square|pier|ferry|terminal|night|skiing|hotel|dock|wharf)$/i.test(x));
      if (w.length) words.add(w.join(' ').toLowerCase());
    }
  };
  add(p.native);
  add(p.name.split(' · ')[0]);
  add(item?.en);
  add(item?.zh);
  return [...words];
}
const matches = (hay: string, words: string[]): boolean => {
  const h = hay.toLowerCase().replace(/_/g, ' ');
  return words.some((w) => (/[一-鿿]/.test(w) ? h.includes(w) : w.split(' ').every((x) => h.includes(x))));
};
const RADIUS: Partial<Record<string, number>> = { sight: 600, shopping: 400, show: 300, food: 150, spa: 200, hotel: 250, transport: 400, medical: 200 };

/* ---------- the stages ---------- */
const itemIds = PLACES.map((p) => p.wd).filter((x): x is string => !!x);
let ITEMS = readCache<Record<string, Item>>('items.json') ?? {};
if (want('items')) {
  ITEMS = await items(itemIds);
  const f = writeCache('items.json', ITEMS);
  const withImg = Object.values(ITEMS).filter((i) => i.p18.length).length;
  console.log(`items: ${Object.keys(ITEMS).length} read, ${withImg} with an image, ${Object.values(ITEMS).filter((i) => i.enwiki).length} with an English article → ${f}`);
}

interface Summary {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  wikibase_item?: string;
}
let SUMMARIES = readCache<Record<string, Summary | null>>('summaries.json') ?? {};
if (want('summaries')) {
  SUMMARIES = {};
  for (const it of Object.values(ITEMS)) {
    if (!it.enwiki) continue;
    const title = it.enwiki.replace(/ /g, '_');
    SUMMARIES[it.id] = await getJson<Summary>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`);
  }
  console.log(`summaries: ${Object.values(SUMMARIES).filter((s) => s?.extract).length} → ${writeCache('summaries.json', SUMMARIES)}`);
}

let CANDS = readCache<Record<string, Candidate[]>>('candidates.json') ?? {};
if (want('files')) {
  CANDS = {};
  /* 1 · the titles, place by place: the item's own image first, then its
     category; a place with no image of its own looks round its pin and asks
     Commons by name */
  const titlesOf = new Map<string, { t: string; via: string }[]>();
  for (const p of PLACES) {
    const item = p.wd ? ITEMS[p.wd] : undefined;
    const words = tokens(p, item);
    const titles: { t: string; via: string }[] = [];
    const push = (t: string, via: string): void => {
      const title = t.startsWith('File:') ? t : `File:${t}`;
      if (!titles.some((x) => x.t === title)) titles.push({ t: title, via });
    };
    for (const f of item?.p18 ?? []) push(f, `P18 of ${item!.id}`);
    if (item?.p373) for (const f of (await categoryFiles(item.p373, 12)).slice(0, 5)) push(f, `Category:${item.p373}`);
    if (!item?.p18.length) {
      const near = await geoFiles(p.pos, RADIUS[p.category] ?? 400);
      for (const g of near) if (matches(g.title, words)) push(g.title, `geotagged ${Math.round(g.dist)} m from the pin, named for it`);
      if (titles.length < 3 && p.native) for (const f of (await searchFiles(p.native, 12)).slice(0, 6)) push(f, `Commons search “${p.native}”`);
      if (titles.length < 3) for (const f of (await searchFiles(`${p.name.split(' · ')[0]!.replace(/[()]/g, '')} ${p.city}`, 12)).slice(0, 6)) push(f, `Commons search “${p.name.split(' · ')[0]} ${p.city}”`);
    }
    titlesOf.set(p.id, titles.slice(0, 10));
    process.stdout.write('.');
  }
  /* 2 · every title's licence, author, size, geotag and categories — batched */
  const info = await commonsInfo([...titlesOf.values()].flat().map((x) => x.t));
  /* 3 · the candidates: a search hit must name the place in its own name, description or categories */
  for (const p of PLACES) {
    const words = tokens(p, p.wd ? ITEMS[p.wd] : undefined);
    const list: Candidate[] = [];
    for (const { t, via } of titlesOf.get(p.id) ?? []) {
      const i = info.get(t);
      const c = i ? candidateOf(i, via, p.pos) : null;
      if (!c) continue;
      if (via.startsWith('Commons search') && !matches(`${c.file} ${c.description ?? ''} ${(c.categories ?? []).join(' ')}`, words)) continue;
      list.push(c);
    }
    CANDS[p.id] = list.slice(0, 8);
  }
  console.log(`\nfiles: ${Object.values(CANDS).reduce((n, l) => n + l.length, 0)} candidates for ${Object.values(CANDS).filter((l) => l.length).length} places → ${writeCache('candidates.json', CANDS)}`);
}

interface Ov {
  id: string;
  title?: string;
  foreign_landing_url?: string;
  url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  source?: string;
  width?: number;
  height?: number;
  tags?: { name: string }[];
  thumbnail?: string;
}
if (want('openverse')) {
  let n = 0;
  for (const p of PLACES) {
    const usable = (CANDS[p.id] ?? []).filter((c) => licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree }).ok);
    if (usable.length >= 2) continue;
    const q = `${p.name.split(' · ')[0]!.replace(/[()]/g, '')} ${p.city}`;
    const body = await getJson<{ results?: Ov[] }>(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=by,by-sa,cc0,pdm&page_size=12&mature=false`);
    n++;
    for (const r of body?.results ?? []) {
      if (!r.url || r.source === 'wikimedia') continue;
      const lic = r.license === 'cc0' ? 'cc0' : r.license === 'pdm' ? 'pd' : `cc-${r.license}-${r.license_version}`;
      (CANDS[p.id] ??= []).push({
        file: `openverse:${r.id}`,
        via: `Openverse “${q}” (${r.source})`,
        w: r.width ?? 0,
        h: r.height ?? 0,
        mime: 'image/jpeg',
        /* Openverse's own small copy, for looking at; the source's full image (orig) is fetched only for a photo chosen */
        thumb: r.thumbnail ?? r.url,
        orig: r.url,
        page: r.foreign_landing_url ?? r.url,
        author: r.creator ?? '',
        licenceCode: lic,
        ...(r.license_url ? { licenceUrl: r.license_url } : {}),
        ...(r.title ? { description: r.title } : {}),
        ...(r.tags?.length ? { categories: r.tags.map((t) => t.name).slice(0, 12) } : {}),
      });
      if ((CANDS[p.id] ?? []).length >= 10) break;
    }
  }
  console.log(`openverse: ${n} searches → ${writeCache('candidates.json', CANDS)}`);
}

if (want('thumbs')) {
  let n = 0;
  for (const p of PLACES) {
    if (ONLY && !ONLY.includes(p.id)) continue;
    for (const c of (CANDS[p.id] ?? []).slice(0, FIRST ? 1 : UPTO)) {
      await getFile(c.thumb, 'img');
      n++;
    }
  }
  console.log(`thumbs: ${n} on disk`);
}

/* ---------- contact sheets: every candidate, looked at ---------- */
if (want('sheets')) {
  const dir = join(CACHE, 'sheets');
  mkdirSync(dir, { recursive: true });
  const cell = { w: 300, h: 225 };
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const byCity = new Map<string, PhotoPlace[]>();
  for (const p of PLACES) byCity.set(p.city, [...(byCity.get(p.city) ?? []), p]);
  let sheet = 0;
  for (const [city, list] of byCity) {
    /* one row per place: its name, then up to 5 candidates */
    const rows = list
      .filter((p) => !ONLY || ONLY.includes(p.id))
      .map((p) => ({ p, cands: (CANDS[p.id] ?? []).map((c, i) => ({ ...c, n: i + 1 })).filter((c) => !!cachedFile(c.thumb, 'img') && (!SECOND || c.via.startsWith('second look'))).slice(0, COLS) }))
      .filter((r) => r.cands.length);
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += 4) {
      const part = rows.slice(i, i + 4);
      const W = 220 + cell.w * COLS;
      const H = part.length * (cell.h + 30);
      const layers: sharp.OverlayOptions[] = [];
      for (const [r, { p, cands }] of part.entries()) {
        const y = r * (cell.h + 30);
        layers.push({
          input: Buffer.from(`<svg width="220" height="${cell.h + 30}"><rect width="220" height="${cell.h + 30}" fill="#161829"/><text x="8" y="22" font-family="Arial" font-size="15" fill="#fff">${esc(p.name.slice(0, 26))}</text><text x="8" y="42" font-family="Arial" font-size="13" fill="#bbb">${esc(p.name.slice(26, 52))}</text><text x="8" y="64" font-family="Arial" font-size="14" fill="#ffb">${esc(p.native ?? '')}</text><text x="8" y="86" font-family="Arial" font-size="12" fill="#9cf">${esc(p.category)} · ${esc(p.wd ?? 'no item')}</text><text x="8" y="106" font-family="Arial" font-size="11" fill="#999">${esc(p.id.replace('cn26-', ''))}</text></svg>`),
          left: 0,
          top: y,
        });
        for (const [k, c] of cands.entries()) {
          const x = 220 + k * cell.w;
          try {
            const src = cachedFile(c.thumb, 'img')!;
            const img = await sharp(src).resize(cell.w - 6, cell.h - 6, { fit: 'contain', background: '#000' }).jpeg().toBuffer();
            layers.push({ input: img, left: x + 3, top: y + 3 });
          } catch {
            /* unreadable thumb: the label says so */
          }
          const lic = licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree });
          const tag = `${(c as { n?: number }).n ?? k + 1} ${lic.ok ? lic.licence : 'NO: ' + (c.licenceShort ?? c.licenceCode ?? '?')} ${c.km !== undefined ? c.km + 'km' : ''} ${c.via.startsWith('P18') ? 'P18' : c.via.slice(0, 12)}`;
          layers.push({ input: Buffer.from(`<svg width="${cell.w}" height="30"><rect width="${cell.w}" height="30" fill="#0b0c16"/><text x="4" y="13" font-family="Arial" font-size="11" fill="${lic.ok ? '#8f8' : '#f88'}">${esc(tag.slice(0, 48))}</text><text x="4" y="26" font-family="Arial" font-size="10" fill="#aaa">${esc(c.file.replace(/^File:/, '').slice(0, 52))}</text></svg>`), left: x, top: y + cell.h });
        }
      }
      const name = `${SECOND ? 's' : ONLY ? 'x' : ''}${String(++sheet).padStart(2, '0')}-${city.replace(/[^A-Za-z]+/g, '-')}.jpg`;
      await sharp({ create: { width: W, height: H, channels: 3, background: '#0b0c16' } }).composite(layers).jpeg({ quality: 82 }).toFile(join(dir, name));
      console.log(`  sheet ${name}`);
    }
  }
}

/* ---------- the first look: each place's leading candidate, twelve places to a sheet ---------- */
if (want('grid')) {
  const dir = join(CACHE, 'sheets');
  mkdirSync(dir, { recursive: true });
  const cell = { w: 400, h: 300, label: 46 };
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pick = Number(opt('pick') ?? 0);
  const list = PLACES.filter((p) => (!ONLY || ONLY.includes(p.id)) && (CANDS[p.id] ?? [])[pick] && cachedFile(CANDS[p.id]![pick]!.thumb, 'img'));
  for (let i = 0; i < list.length; i += 12) {
    const part = list.slice(i, i + 12);
    const layers: sharp.OverlayOptions[] = [];
    for (const [k, p] of part.entries()) {
      const c = CANDS[p.id]![pick]!;
      const x = (k % 4) * cell.w;
      const y = Math.floor(k / 4) * (cell.h + cell.label);
      try {
        const img = await sharp(cachedFile(c.thumb, 'img')!).resize(cell.w - 6, cell.h - 6, { fit: 'contain', background: '#000' }).jpeg().toBuffer();
        layers.push({ input: img, left: x + 3, top: y + 3 });
      } catch {
        /* unreadable: the label says so below */
      }
      const lic = licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree });
      layers.push({
        input: Buffer.from(
          `<svg width="${cell.w}" height="${cell.label}"><rect width="${cell.w}" height="${cell.label}" fill="#161829"/><text x="5" y="17" font-family="Arial" font-size="14" fill="#fff">${esc(`${String(i + k + 1).padStart(3, ' ')} ${p.name}`.slice(0, 50))}</text><text x="5" y="37" font-family="Arial" font-size="12" fill="${lic.ok ? '#8f8' : '#f88'}">${esc(`${lic.ok ? lic.licence : 'NO ' + (c.licenceShort ?? c.licenceCode)} · ${c.km !== undefined ? c.km + ' km · ' : ''}${c.file.replace(/^File:/, '')}`.slice(0, 62))}</text></svg>`,
        ),
        left: x,
        top: y + cell.h,
      });
    }
    const rows = Math.ceil(part.length / 4);
    const name = `grid${pick ? `${pick + 1}` : ''}${ONLY ? 'x' : ''}-${String(i / 12 + 1).padStart(2, '0')}.jpg`;
    await sharp({ create: { width: cell.w * 4, height: rows * (cell.h + cell.label), channels: 3, background: '#0b0c16' } }).composite(layers).jpeg({ quality: 80 }).toFile(join(dir, name));
    console.log(`  ${name}: ${part.map((p) => p.id.replace('cn26-', '')).join(' ')}`);
  }
}

console.log(`asked: ${asked.network} over the network, ${asked.cached} from the cache`);
writeFileSync(join(CACHE, 'last-run.txt'), new Date().toISOString());
