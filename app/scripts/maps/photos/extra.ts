/* A SECOND LOOK (Map 5e) — DEV ONLY. For the places the first pass left
   without a photo that shows them, a few more questions, each written by
   hand for its place: Commons searched by the names the place goes by, and
   Openverse (free-licensed libraries, Flickr among them) with a better
   query than the city's name. Every hit becomes a candidate to LOOK at on the
   contact sheets (fetch.ts sheets --ids=…) — nothing here chooses. Polite and
   cached as the rest (net.ts).

   Run (from app/):  npx tsx scripts/maps/photos/extra.ts */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppBackup } from '../../../src/lib/model/types';
import { haversineKm } from '../../../src/lib/logic/geoStats';
import { photoPlaces } from './places';
import { asked, CACHE, getFile, getJson, readCache, writeCache } from './net';
import { plainText } from './rules';
import type { Candidate } from './fetch';

const seed = JSON.parse(readFileSync(join(CACHE, '..', '..', '..', 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const PLACES = photoPlaces(seed);
const CANDS = readCache<Record<string, Candidate[]>>('candidates.json') ?? {};

/* the questions, place by place: Commons searches, Openverse searches */
/* a third look (--third): three places whose names needed another try */
const THIRD: Record<string, { commons?: string[]; openverse?: string[] }> = {
  'cn26-spot-zhangjiajie-shili': { commons: ['Ten-mile Gallery Zhangjiajie', 'Shili Hualang Zhangjiajie'], openverse: ['Ten Mile Gallery Zhangjiajie'] },
  'cn26-spot-hongkong-coloane': { commons: ['Coloane Village', '路環市區', 'Chapel of St. Francis Xavier Coloane'] },
  'cn26-spot-kunyu-yangma': { openverse: ['Yangma Island'] },
};
const ASK: Record<string, { commons?: string[]; openverse?: string[] }> = {
  'cn26-place-11': { commons: ['天门山索道', 'Tianmen Mountain cableway'], openverse: ['Tianmen Mountain cable car'] },
  'cn26-spot-kunyu-yangma': { commons: ['Yangma Island'], openverse: ['Yangma Island Yantai'] },
  'cn26-spot-kunyu-museum': { commons: ['Yantai Museum'] },
  'cn26-spot-zhangjiajie-zjj-west': { commons: ['Zhangjiajiexi railway station', '张家界西站 站房'] },
  'cn26-spot-chongqing-theatre-1949': { commons: ['1949大剧院'], openverse: ['Chongqing 1949 theatre'] },
  'cn26-spot-gorge-tea-horse': { openverse: ['Tea Horse Guesthouse Tiger Leaping Gorge', 'Tea Horse Guest House'] },
  'cn26-stay-07': { commons: ['Halfway Guesthouse Tiger Leaping Gorge', '中途客栈 虎跳峡'], openverse: ['Halfway Guesthouse Tiger Leaping', 'Halfway House Tiger Leaping Gorge'] },
  'cn26-spot-dali-foreigner-street': { commons: ['Huguo Road Dali', '大理 洋人街'], openverse: ['Foreigner Street Dali'] },
  'cn26-spot-dali-jade-belt': { commons: ['苍山 玉带路', 'Jade Belt Road Cangshan'], openverse: ['Jade Belt Road Cangshan Dali'] },
  'cn26-spot-kunming-zhengyi': { commons: ['昆明 正义路', 'Zhengyi Road Kunming'] },
  'cn26-spot-dali-ximatan': { commons: ['洗马潭', 'Cangshan cableway'], openverse: ['Cangshan cable car Dali'] },
  'cn26-spot-chongli-wanlong': { commons: ['Wanlong ski', '万龙'], openverse: ['Wanlong ski resort Chongli'] },
  'cn26-spot-chongli-fulong': { commons: ['富龙', 'Fulong ski'], openverse: ['Fulong ski resort'] },
  'cn26-spot-chongqing-one-tree': { commons: ['一棵树观景台', 'Yikeshu viewing platform'] },
  'cn26-spot-chongqing-ronghui': { commons: ['融汇温泉'] },
  'cn26-spot-dali-caicun': { commons: ['才村', 'Caicun Dali'] },
  'cn26-spot-dali-zhonghe': { commons: ['中和索道', 'Zhonghe cableway'] },
  'cn26-spot-dali-zhoucheng': { commons: ['周城 大理', 'Zhoucheng tie-dye'], openverse: ['Zhoucheng Dali tie dye'] },
  'cn26-spot-dali-longkan': { commons: ['龙龛', 'Longkan Erhai'] },
  'cn26-spot-kunming-wenlin': { commons: ['文林街', 'Wenlin Street Kunming'] },
  'cn26-spot-lijiang-dongba': { commons: ['Dongba Museum Lijiang', '丽江市博物院'] },
  'cn26-place-12': { commons: ['重庆江北国际机场 T3航站楼', 'Chongqing Jiangbei Airport Terminal 3'] },
  'cn26-spot-hongkong-lung-king-heen': { commons: ['Lung King Heen', '龍景軒'] },
  'cn26-stay-04': { commons: ['张家界 华天大酒店'] },
  'cn26-stay-03': { commons: ['Pullman Zhangjiajie'] },
  'cn26-stay-05': { commons: ['Glenview ITC Plaza', '重庆国贸格兰维大酒店'] },
};

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
  process.stdout.write(`${id.replace('cn26-', '')}: ${list.length}  `);
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
