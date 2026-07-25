/* DEV ONLY — the one script in this repo that is allowed to touch the network.
   It is NOT part of `npm run build` or `npm run seed-build`, and the app never
   calls anything like it: the app ships the decision, never the lookup.

   What it does: for every place in scripts/china/map-links.ts that carries a
   `query`, it asks OpenStreetMap's Nominatim where that name is, and measures
   how far the top hit sits from the coordinate we already verified by hand in
   scripts/china/coords.ts. A name that lands close is trustworthy enough to
   send to Google Maps and Amap as a SEARCH — which opens the place page the
   owner asked for. A name that lands far, or that OSM does not know, is
   demoted to `via: 'coord'` in the manifest and keeps the old coordinate pin.

   Nominatim's usage policy: one request per second, and a real User-Agent that
   identifies the application. Both are honoured below — do not lower the delay.

   Run: npm run verify:places */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, Coord, TripBundle } from '../src/lib/model/types';
import { PLACE_COORDS, STOP_COORDS } from './china/coords';
import { CITY_KM, POI_KM, PLACE_MAPS, STOP_MAPS, type MapPlan } from './china/map-links';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const bundle = seed.trips[0] as TripBundle;

const UA = 'ltd-trip-curation/1.0 (personal)';
const GAP_MS = 1100; // ≥1 request/second — Nominatim's usage policy
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hit {
  lat: number;
  lng: number;
  label: string;
}

async function nominatim(query: string): Promise<Hit | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh,en' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for "${query}"`);
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const top = rows[0];
  return top ? { lat: Number(top.lat), lng: Number(top.lon), label: top.display_name } : null;
}

/** Great-circle distance in km. */
function km(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface Row {
  id: string;
  name: string;
  query: string;
  hit: string;
  dist: string;
  limit: string;
  verdict: string;
  ships: MapPlan['via'];
}

const stopName = (key: string) => bundle.stops.find((s) => s.id === `cn26-stop-${key}`)?.name ?? key;
const cardName = (id: string) => bundle.showCards.find((c) => c.id === id)?.native ?? id;

const targets: { id: string; label: string; coord?: Coord; plan: MapPlan }[] = [
  ...Object.entries(STOP_MAPS).map(([key, plan]) => ({
    id: `stop:${key}`,
    label: stopName(key),
    coord: STOP_COORDS[key],
    plan,
  })),
  ...Object.entries(PLACE_MAPS).map(([id, plan]) => ({
    id,
    label: cardName(id),
    coord: PLACE_COORDS[id],
    plan,
  })),
];

const rows: Row[] = [];
let disagreements = 0;
let first = true;

for (const t of targets) {
  const { plan } = t;
  const limit = plan.grade === 'city' ? CITY_KM : POI_KM;

  if (!plan.query) {
    rows.push({
      id: t.id,
      name: t.label,
      query: plan.via === 'url' ? '(saved link)' : '—',
      hit: plan.via === 'url' ? (plan.url ?? '') : 'not looked up',
      dist: '—',
      limit: '—',
      verdict: plan.via === 'url' ? 'saved link wins' : 'no name to check',
      ships: plan.via,
    });
    continue;
  }

  if (!first) await sleep(GAP_MS);
  first = false;

  const q = plan.city ? `${plan.query}, ${plan.city}` : plan.query;
  let hit: Hit | null = null;
  let err = '';
  try {
    hit = await nominatim(q);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  if (err) {
    rows.push({ id: t.id, name: t.label, query: q, hit: `ERROR ${err}`, dist: '—', limit: `${limit}`, verdict: 'lookup failed', ships: plan.via });
    if (plan.via === 'name') disagreements++;
    continue;
  }
  if (!hit || !t.coord) {
    rows.push({
      id: t.id,
      name: t.label,
      query: q,
      hit: hit ? hit.label : 'no result',
      dist: '—',
      limit: `${limit}`,
      verdict: hit ? 'no coordinate of ours to compare' : 'OSM does not know this name',
      ships: plan.via,
    });
    if (plan.via === 'name') disagreements++;
    continue;
  }

  const d = km(t.coord, hit);
  const within = d <= limit;
  rows.push({
    id: t.id,
    name: t.label,
    query: q,
    hit: hit.label,
    dist: d < 10 ? d.toFixed(2) : d.toFixed(1),
    limit: `${limit}`,
    verdict: within ? 'agrees' : `${d.toFixed(1)} km away — too far`,
    ships: plan.via,
  });
  /* A shipped name search must agree; a demoted one is expected to disagree. */
  if (plan.via === 'name' && !within) disagreements++;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const W = { id: 15, name: 16, query: 22, hit: 44, dist: 7, ships: 5 };
const head = [
  'place'.padEnd(W.id),
  'name'.padEnd(W.name),
  'search'.padEnd(W.query),
  'top OSM hit'.padEnd(W.hit),
  'km'.padStart(W.dist),
  'ships'.padEnd(W.ships),
  'verdict',
].join('  ');

console.log('');
console.log('PLACE-NAME VERIFICATION — OpenStreetMap / Nominatim');
console.log(head);
console.log('─'.repeat(head.length + 20));
for (const r of rows) {
  console.log(
    [
      cut(r.id, W.id).padEnd(W.id),
      cut(r.name, W.name).padEnd(W.name),
      cut(r.query, W.query).padEnd(W.query),
      cut(r.hit, W.hit).padEnd(W.hit),
      r.dist.padStart(W.dist),
      r.ships.padEnd(W.ships),
      r.verdict,
    ].join('  '),
  );
}
console.log('─'.repeat(head.length + 20));
const byVia = (v: MapPlan['via']) => rows.filter((r) => r.ships === v).length;
console.log(`${rows.length} places · ships: ${byVia('name')} name · ${byVia('coord')} coord · ${byVia('url')} url`);
console.log(`thresholds: ${POI_KM} km for a POI, ${CITY_KM} km for a city/area.`);

if (disagreements > 0) {
  console.error(`\n${disagreements} place(s) ship a name search that OSM does not agree with — demote them to via 'coord' in scripts/china/map-links.ts.`);
  process.exit(1);
}
console.log('\n✓ every shipped name search agrees with the coordinate it was verified against.');
