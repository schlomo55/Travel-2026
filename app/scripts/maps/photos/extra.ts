/* A SECOND LOOK (Map 5e) — DEV ONLY. For the places the first pass left
   without a photo that shows them, a few more questions, each written by
   hand for its place: Commons searched by the names the place goes by, and
   Openverse (free-licensed libraries, Flickr among them) with a better
   query than the city's name. Every hit becomes a candidate to LOOK at on the
   contact sheets (fetch.ts sheets --ids=…) — nothing here chooses. Polite and
   cached as the rest (net.ts).

   Run (from app/):  npx tsx scripts/maps/photos/extra.ts --trip <trip file> [--third] */
import { haversineKm } from '../../../src/lib/logic/geoStats';
import { EXTRA_ASK, EXTRA_THIRD } from './choices';
import { photoPlaces, seedFromArgs } from './places';
import { asked, getFile, getJson, readCache, writeCache } from './net';
import { plainText } from './rules';
import type { Candidate } from './fetch';

const seed = seedFromArgs();
const PLACES = photoPlaces(seed);
const CANDS = readCache<Record<string, Candidate[]>>('candidates.json') ?? {};

/* the questions, place by place: Commons searches, Openverse searches — one trip's, written by hand, kept with its
   photo decisions (choices.json EXTRA_ASK; --third: EXTRA_THIRD, three places whose names needed another try).
   Without them there is nothing to ask. */
const THIRD = EXTRA_THIRD;
const ASK = EXTRA_ASK;

const EXT = 'Artist|Credit|License|LicenseShortName|LicenseUrl|NonFree|Restrictions|ImageDescription|Categories|GPSLatitude|GPSLongitude|DateTimeOriginal';
type Info = { title: string; missing?: string; imageinfo?: { url: string; descriptionurl: string; thumburl?: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value: string }> }[] };

async function search(q: string): Promise<string[]> {
  const body = await getJson<{ query?: { search?: { title: string }[] } }>(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(q)}`);
  return (body?.query?.search ?? []).map((s) => s.title).filter((t) => /\.(jpe?g|png|webp)$/i.test(t));
}
async function info(titles: string[]): Promise<Map<string, Info>> {
  const known = readCache<Record<string, Info>>('fileinfo.json') ?? {};
  const need = [...new Set(titles)].filter((t) => !known[t]);
  for (let i = 0; i < need.length; i += 40) {
    const batch = need.slice(i, i + 40);
    const body = await getJson<{ query?: { pages?: Info[]; normalized?: { from: string; to: string }[] } }>(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=500&iiextmetadatafilter=${encodeURIComponent(EXT)}&titles=${batch.map((t) => encodeURIComponent(t)).join('%7C')}`,
    );
    const norm = new Map((body?.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of body?.query?.pages ?? []) {
      known[p.title] = p;
      const f = norm.get(p.title);
      if (f) known[f] = p;
    }
  }
  writeCache('fileinfo.json', known);
  return new Map(titles.filter((t) => known[t]).map((t) => [t, known[t]!]));
}

const QUESTIONS = process.argv.includes('--third') ? THIRD : ASK;
if (!Object.keys(QUESTIONS).some((id) => PLACES.some((p) => p.id === id))) console.log('second look: no questions for this trip’s places (choices.json) — nothing to ask');
for (const [id, ask] of Object.entries(QUESTIONS)) {
  const p = PLACES.find((x) => x.id === id);
  if (!p) continue;
  const list = (CANDS[id] ??= []);
  const have = new Set(list.map((c) => c.file));
  for (const q of ask.commons ?? []) {
    const titles = (await search(q)).filter((t) => !have.has(t));
    const got = await info(titles);
    for (const t of titles) {
      const pg = got.get(t);
      const ii = pg?.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      const v = (k: string): string | undefined => m[k]?.value;
      const lat = Number(v('GPSLatitude'));
      const lng = Number(v('GPSLongitude'));
      const geo = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : undefined;
      list.push({
        file: pg!.title,
        via: `second look: Commons search “${q}”`,
        w: ii.width,
        h: ii.height,
        mime: ii.mime,
        thumb: ii.thumburl ?? ii.url,
        orig: ii.url,
        page: ii.descriptionurl,
        author: plainText(v('Artist')),
        ...(v('License') ? { licenceCode: v('License') } : {}),
        ...(v('LicenseShortName') ? { licenceShort: plainText(v('LicenseShortName')) } : {}),
        ...(v('LicenseUrl') ? { licenceUrl: v('LicenseUrl') } : {}),
        ...(v('NonFree') ? { nonFree: v('NonFree') } : {}),
        ...(v('ImageDescription') ? { description: plainText(v('ImageDescription')).slice(0, 300) } : {}),
        ...(v('Categories') ? { categories: v('Categories')!.split('|').filter(Boolean) } : {}),
        ...(geo ? { geo, km: Math.round(haversineKm(geo, p.pos) * 100) / 100 } : {}),
      });
      have.add(pg!.title);
    }
  }
  for (const q of ask.openverse ?? []) {
    const body = await getJson<{ results?: { id: string; title?: string; foreign_landing_url?: string; url?: string; thumbnail?: string; creator?: string; license?: string; license_version?: string; license_url?: string; source?: string; width?: number; height?: number; tags?: { name: string }[] }[] }>(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=by,by-sa,cc0,pdm&page_size=8&mature=false`,
    );
    for (const r of body?.results ?? []) {
      const file = `openverse:${r.id}`;
      if (!r.url || r.source === 'wikimedia' || have.has(file)) continue;
      list.push({
        file,
        via: `second look: Openverse “${q}” (${r.source})`,
        w: r.width ?? 0,
        h: r.height ?? 0,
        mime: 'image/jpeg',
        thumb: r.thumbnail ?? r.url,
        orig: r.url,
        page: r.foreign_landing_url ?? r.url,
        author: r.creator ?? '',
        licenceCode: r.license === 'cc0' ? 'cc0' : r.license === 'pdm' ? 'pd' : `cc-${r.license}-${r.license_version}`,
        ...(r.license_url ? { licenceUrl: r.license_url } : {}),
        ...(r.title ? { description: r.title } : {}),
        ...(r.tags?.length ? { categories: r.tags.map((t) => t.name).slice(0, 12) } : {}),
      });
      have.add(file);
    }
  }
  process.stdout.write(`${id}: ${list.length}  `);
}
writeCache('candidates.json', CANDS);
/* and their thumbnails, to look at */
let n = 0;
for (const id of Object.keys(QUESTIONS)) for (const c of (CANDS[id] ?? []).filter((x) => x.via.startsWith('second look')).slice(0, 14)) {
  try {
    await getFile(c.thumb, 'img');
    n++;
  } catch (e) {
    console.warn(`  no thumbnail for ${c.file}: ${(e as Error).message}`);
  }
}
console.log(`\nsecond look: ${n} thumbnails; asked ${asked.network} over the network, ${asked.cached} from the cache`);
