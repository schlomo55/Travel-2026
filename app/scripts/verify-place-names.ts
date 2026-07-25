/* DEV ONLY — the one script in this repo that is allowed to touch the network.
   It is NOT part of `npm run build` or `npm run seed-build`, and the app never
   calls anything like it: the app ships the decision, never the lookup.

   What it does: for every name this trip would hand to a map — stops, driver
   cards, the eleven beds, the airports without cards, and every spot inside a
   city — it asks OpenStreetMap's Nominatim where that name is, and measures
   how far the top hit sits from a coordinate we already verified by hand (the
   entity's own, or its stop's). A name that lands close is trustworthy enough
   to send out as a SEARCH — which opens the place page rather than a nameless
   dot. A name that lands far, or that OSM does not know, is demoted in the
   manifest: `via: 'coord'` where a coordinate exists, `via: 'none'` where none
   does — and then the app ships NO button for it, on purpose.

   The measured example that shaped all of this: "CHAO Sanlitun Beijing"
   resolves to Beijing Chaoyang Hospital, two kilometres from the hotel. A
   button that opens the wrong place is worse than no button.

   Nominatim's usage policy: one request per second, and a real User-Agent that
   identifies the application. Both are honoured below — do not lower the delay.

   Run: npm run verify:places */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, Coord, TripBundle } from '../src/lib/model/types';
import { AIRPORT_COORDS, PLACE_COORDS, STOP_COORDS } from './china/coords';
import { AIRPORT_MAPS, CITY_KM, POI_KM, PLACE_MAPS, STAY_MAPS, STOP_MAPS, type MapPlan } from './china/map-links';
import { DEFAULT_NEAR_KM, SPOTS } from './china/spots';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const bundle = seed.trips[0] as TripBundle;

const UA = 'ltd-trip-curation/1.0 (personal)';
const GAP_MS = 1100; // ≥1 request/second — Nominatim's usage policy
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

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

/* THE SECOND HALF OF THE GATE, and the more important one.

   Distance alone cannot tell a hotel from the stadium next door: "CHAO
   Sanlitun" lands 5 km from our Beijing pin — well inside any city radius —
   and is the Workers' Stadium, not the hotel. So the top hit must also BE the
   place we asked for: its own name (the first component of Nominatim's
   display_name, before the address) has to contain the name we searched, or
   the Chinese/local form of it.

   `expect` overrides that token where OSM's spelling differs from the one the
   trip content uses (太子城站 → "太子城", 白沙古镇 → "白沙镇"). Every override is
   written down in the manifest beside the reason. */
function hitName(label: string): string {
  return (label.split(',')[0] ?? label).trim();
}
function nameAgrees(hit: string, want: string): boolean {
  return hitName(hit).toLowerCase().includes(want.trim().toLowerCase());
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
const stayName = (id: string) => bundle.bookings.find((b) => b.id === id)?.title ?? id;

/* Which stop each bed belongs to — verification only. A hotel has no
   coordinate of its own (none of their addresses is in the trip sources), so
   the yardstick is the stop it is booked for. */
const STAY_STOP: Record<string, string> = {
  'cn26-stay-00': 'beijing',
  'cn26-stay-01': 'beijing',
  'cn26-stay-02': 'chongli',
  'cn26-stay-03': 'zhangjiajie',
  'cn26-stay-04': 'zhangjiajie',
  'cn26-stay-05': 'chongqing',
  'cn26-stay-06': 'lijiang',
  'cn26-stay-07': 'gorge',
  'cn26-stay-08': 'dali',
  'cn26-stay-09': 'kunming',
  'cn26-stay-10': 'hongkong',
};

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
  ...Object.entries(STAY_MAPS).map(([id, plan]) => ({
    id: `stay:${id.slice(-2)}`,
    label: stayName(id),
    coord: STOP_COORDS[STAY_STOP[id] ?? ''],
    plan,
  })),
  ...Object.entries(AIRPORT_MAPS).map(([iata, plan]) => ({
    id: `air:${iata}`,
    label: iata,
    coord: AIRPORT_COORDS[iata],
    plan,
  })),
  /* Spots have no coordinate of their own by design — the whole point is that
     nobody had to research 130 of them. Their yardstick is the stop. */
  ...Object.entries(SPOTS).flatMap(([key, list]) =>
    list.map((s) => ({
      id: `${key}/${s.id}`,
      label: s.name,
      coord: STOP_COORDS[key],
      plan: {
        query: s.query,
        ...(s.city ? { city: s.city } : {}),
        expect: s.expect ?? s.native ?? s.query,
        nearKm: s.nearKm ?? DEFAULT_NEAR_KM,
        via: s.via,
        why: s.why,
      } satisfies MapPlan,
    })),
  ),
];

const rows: Row[] = [];
const rejects: string[] = [];
let disagreements = 0;
let first = true;

for (const t of targets) {
  const { plan } = t;
  const limit = plan.nearKm ?? (plan.grade === 'city' ? CITY_KM : POI_KM);

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
    if (plan.via === 'name') { disagreements++; rejects.push(`${t.id}	lookup failed: ${err}`); }
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
    if (plan.via === 'name') {
      disagreements++;
      rejects.push(`${t.id}	${hit ? 'nothing of ours to compare it against' : 'OSM has never heard of this name'}`);
    }
    continue;
  }

  const d = km(t.coord, hit);
  const within = d <= limit;
  const want = plan.expect ?? plan.query;
  const named = nameAgrees(hit.label, want);
  const verdict = !within
    ? `${d.toFixed(1)} km away — too far`
    : !named
      ? `a different place: "${hitName(hit.label)}"`
      : 'agrees';
  rows.push({
    id: t.id,
    name: t.label,
    query: q,
    hit: hit.label,
    dist: d < 10 ? d.toFixed(2) : d.toFixed(1),
    limit: `${limit}`,
    verdict,
    ships: plan.via,
  });
  /* A shipped name search must agree; a demoted one is expected to disagree. */
  if (plan.via === 'name' && verdict !== 'agrees') {
    disagreements++;
    rejects.push(`${t.id}	${verdict} — "${cut(hit.label, 64)}"`);
  }
}

/* Optional machine-readable copy of the same table, for whoever is auditing a
   hundred names at once. Off unless asked for — nothing lands in the repo. */
if (process.env.PLACES_JSON) writeFileSync(process.env.PLACES_JSON, JSON.stringify(rows, null, 1), 'utf8');

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
console.log(
  `${rows.length} places · ships: ${byVia('name')} name · ${byVia('coord')} coord · ${byVia('url')} url · ${byVia('none')} nothing at all`,
);
console.log(`thresholds: ${POI_KM} km for a POI, ${CITY_KM} km for a city/area.`);

if (disagreements > 0) {
  console.error(
    `\n${disagreements} name(s) ship a search OpenStreetMap does not agree with. Demote each one:`,
  );
  console.error("  via 'coord' where the entity has a coordinate of its own, via 'none' where it has not." + "\n");
  for (const r of rejects) console.error(`  ${r}`);
  process.exit(1);
}
console.log('\n✓ every shipped name search agrees with the place OpenStreetMap knows by that name.');
