/* DEV ONLY — the one script in this repo that is allowed to touch the network.
   It is NOT part of `npm run build` or `npm run seed-build`, and the app never
   calls anything like it: the app ships the decision, never the lookup.

   What it does: for every name this trip would hand to a map — stops, driver
   cards, the eleven beds, the airports without cards, and every spot inside a
   city — it asks TWO independent sources who and where that place is.

   1. OpenStreetMap (Nominatim), with `addressdetails=1`. It measures how far
      the top hit sits from a coordinate we already verified by hand (the
      entity's own, or its stop's), checks that the hit really IS the place we
      asked for, and — new — keeps the ADDRESS components it returns, so a
      Chinese street address can ship beside the name.
   2. Wikidata (keyless). It answers with the CANONICAL name (labels.zh /
      labels.en), the coordinate (P625) and, for airports, the IATA code
      (P238). It knows names OSM has never carried: 张家界荷花机场 is really
      张家界荷花国际机场, and Wikidata is the only one of the two that says so.

   A name that lands close AND agrees is trustworthy enough to send out as a
   SEARCH — which opens the place page rather than a nameless dot. A name that
   lands far, or that OSM does not know, is demoted in the manifest:
   `via: 'coord'` where a coordinate exists, `via: 'none'` where none does —
   and then the app ships NO button for it, on purpose.

   The measured example that shaped all of this: "CHAO Sanlitun Beijing"
   resolves to Beijing Chaoyang Hospital, two kilometres from the hotel. A
   button that opens the wrong place is worse than no button.

   Both services ask for one request per second and a real User-Agent that
   identifies the application. Both are honoured below — the two passes run
   concurrently, but each SERVICE keeps its own ≥1 s cadence, enforced in
   `get()` per host, so neither sees more than one request per second. Do not
   lower the delay.

   THE COORDINATE PASS (Map 5a, 2026-09-28). The same answers now also decide
   where the Map tab may draw a PIN: a confirmed hit yields its coordinate,
   under the rules in china/pin-rules.ts (name, distance, kind, no ambiguity,
   no contradiction). Beds and the six pinless driver cards are asked once more
   under their own names (china/pin-targets.ts) — for a pin only, never a
   button. `PLACES_PINS=1` writes the decisions to china/pins.ts, which the
   seed build reads; it refuses to while any answer is missing.

   EVERY ANSWER IS CACHED on disk (app/.cache/places, git-ignored), keyed by
   the exact request, so a re-run asks nobody anything it has asked before and
   only a new question costs a second. `PLACES_REFRESH=1` asks again.

   Run: npm run verify:places        (PLACES_JSON=<file> also writes the dump
                                      this script's findings are encoded from;
                                      PLACES_EVIDENCE=<file> every answer read) */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, Coord, TripBundle } from '../src/lib/model/types';
import { AIRPORT_COORDS, PLACE_COORDS, SPOT_COORDS, STOP_COORDS } from './china/coords';
import { AIRPORT_MAPS, CITY_KM, POI_KM, PLACE_MAPS, STAY_MAPS, STOP_MAPS, type MapPlan } from './china/map-links';
import { DEFAULT_NEAR_KM, SPOTS } from './china/spots';
import { ADDRESS_MAX, joinAddress, searchTerms } from '../src/lib/logic/geo';
import { decidePin, km, namesAgree, osmNames, sizeKm, type OsmCand, type PinAsk, type PinKind, type WdCand } from './china/pin-rules';
import { mdliteToText } from '../src/lib/logic/mdlite';
import { PIN_ANCHORS, PIN_FITS, PIN_ONLY } from './china/pin-targets';
import { renderPins, type CoordCheck, type PinRecord } from './china/pins-format';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const bundle = seed.trips[0] as TripBundle;

const UA = 'ltd-trip-curation/1.0 (personal)';
const GAP_MS = 1100; // ≥1 request/second — the usage policy of both services
const ACCEPT_LANGUAGE = 'zh,en';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

/* ---------------------------------------------------------------- OSM ---- */

/** One Nominatim answer. The button gate reads what it always read — where it
    is, its label, and the address components it hands back, in the order a
    Chinese address is written: province → city → district → subdistrict →
    street (Nominatim returns them small-to-big; `joinAddress`, shared with the
    app so the shipped string and the search agree, puts them right). The
    coordinate pass also reads its class=type, OSM id, every name it carries,
    its extent and its own Wikidata link (china/pin-rules.ts OsmCand). */
interface Hit extends OsmCand {
  /** province, city, district, subdistrict, street — big to small, sparse. */
  parts: string[];
  postcode?: string;
}

interface OsmRow {
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  osm_type?: string;
  osm_id?: number;
  boundingbox?: string[];
  address?: OsmAddress;
  namedetails?: Record<string, string>;
  extratags?: Record<string, string>;
}

interface OsmAddress {
  state?: string;
  province?: string;
  city?: string;
  county?: string;
  town?: string;
  village?: string;
  city_district?: string;
  district?: string;
  suburb?: string;
  borough?: string;
  neighbourhood?: string;
  quarter?: string;
  hamlet?: string;
  road?: string;
  house_number?: string;
  postcode?: string;
  [k: string]: string | undefined;
}

/** Big → small, one component per administrative rung, no repeats. A rung with
    nothing in it is simply skipped; nothing is invented to fill it. */
function addressParts(a: OsmAddress): string[] {
  const rungs: (string | undefined)[] = [
    a.state ?? a.province,
    a.city ?? a.county ?? a.town ?? a.village,
    a.city_district ?? a.district ?? a.borough,
    a.suburb ?? a.quarter,
    a.neighbourhood ?? a.hamlet,
    a.house_number && a.road ? `${a.road}${a.house_number}号` : a.road,
  ];
  const out: string[] = [];
  for (const r of rungs) {
    /* OSM packs alternative names for the same thing into one field with a
       semicolon ("阿布扎比酋长国;阿布達比酋長國", "G674;S223"). That is a naming
       artifact, not an address, so only the first form travels. */
    const v = (r ?? '').split(';')[0]?.trim() ?? '';
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Does this address say anything the name and the city do not already say?
    "重庆市" beside 洪崖洞, 重庆 is noise; "重庆市渝中区朝天门街道千厮门大桥" is an
    address. So at least one rung BELOW the city must be present. */
function addressIsUseful(a: OsmAddress): boolean {
  return !!(
    a.city_district ??
    a.district ??
    a.borough ??
    a.suburb ??
    a.quarter ??
    a.neighbourhood ??
    a.hamlet ??
    a.road
  );
}

function toHit(r: OsmRow): Hit {
  const a = r.address ?? {};
  const bb = (r.boundingbox ?? []).map(Number);
  const [s, n, w, e] = bb;
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    names: osmNames(r.display_name, r.namedetails),
    cls: r.class ?? '',
    type: r.type ?? '',
    osm: `${r.osm_type ?? '?'}/${r.osm_id ?? '?'}`,
    ...(r.extratags?.wikidata ? { wikidata: r.extratags.wikidata } : {}),
    ...(s !== undefined && n !== undefined && w !== undefined && e !== undefined && bb.every(Number.isFinite)
      ? { bbox: [s, n, w, e] as [number, number, number, number] }
      : {}),
    parts: addressIsUseful(a) ? addressParts(a) : [],
    ...(a.postcode ? { postcode: a.postcode } : {}),
  };
}

/** Nominatim's answers, in its own order. The button gate reads the FIRST, as
    it always has; the coordinate pass reads all five, because the second
    answer is how an ambiguous name shows itself (pin-rules rule 5). */
async function nominatim(query: string): Promise<Hit[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&namedetails=1&extratags=1` +
    `&q=${encodeURIComponent(query)}`;
  const rows = (await get(url, `Nominatim "${query}"`)) as OsmRow[];
  return rows.map(toHit);
}

/* ----------------------------------------------------------- Wikidata ---- */

interface Wd {
  id: string;
  zh?: string;
  en?: string;
  coord?: Coord;
  iata?: string;
  /** How many items the search offered before this one was chosen. */
  from: number;
}

interface WdEntity {
  labels?: Record<string, { value?: string }>;
  aliases?: Record<string, { value?: string }[]>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
}

function claimValue(e: WdEntity, prop: string): unknown {
  return e.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

/** Chinese in every script Wikidata keeps it in, then English. */
const WD_LANGS = ['zh', 'zh-hans', 'zh-cn', 'zh-hant', 'zh-hk', 'zh-tw', 'en'];

/** A request that says "slow down" is not an answer, and must never be turned
    into a verdict. Both services start returning 429 once a script has asked a
    few hundred questions in an afternoon, so back off hard — 5 s, 10 s, 20 s,
    40 s — and if it still will not answer, raise a RateLimited, which the
    reporting below keeps strictly apart from "this name is wrong". */
class RateLimited extends Error {}

/* THE CACHE, AND THE CADENCE — both here, so no caller can get either wrong.

   An answer already on disk is returned without touching the network (and
   without waiting: the one-a-second rule is about what a service sees). A new
   question waits its turn on a per-HOST queue — one request in flight per
   service, each at least GAP_MS after the last one sent to it — so the two
   services still run side by side and neither ever sees more than one request
   a second, whatever order the passes ask in. Only a real answer (HTTP 200) is
   kept; a 429 is not an answer and is never written down. */
const CACHE_DIR = join(here, '..', '.cache', 'places');
const REFRESH = !!process.env.PLACES_REFRESH;
const asked = { cached: 0, network: 0 };
/** The day the newest answer used was fetched — pins.ts records it. */
let newestAnswer = '';
const lastSent = new Map<string, number>();
const inFlight = new Map<string, Promise<unknown>>();
/* A SERVICE THAT HAS SAID "SLOW DOWN" ONCE IS TAKEN AT ITS WORD for the rest
   of the run: its gap goes from GAP_MS to SLOWED_MS and stays there, and a
   Retry-After it sends is waited out in full. Wikidata answers in bursts of
   about ten and then returns 429 — measured 2026-09-28 — so this only ever
   makes a run slower, never faster than one request a second. */
const SLOWED_MS = 5_000;
const gapFor = new Map<string, number>();

async function fetchPolitely(url: string, what: string): Promise<unknown> {
  const host = new URL(url).host;
  const backoff = [5_000, 10_000, 20_000, 40_000];
  const turn = (inFlight.get(host) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = (lastSent.get(host) ?? 0) + (gapFor.get(host) ?? GAP_MS) - Date.now();
        if (wait > 0) await sleep(wait);
        lastSent.set(host, Date.now());
        asked.network++;
        const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': ACCEPT_LANGUAGE } });
        if (res.ok) return res.json() as Promise<unknown>;
        const throttled = res.status === 429 || res.status === 503;
        const back = backoff[attempt];
        if (!throttled || back === undefined) {
          throw throttled ? new RateLimited(`${what} ${res.status}`) : new Error(`${what} ${res.status}`);
        }
        gapFor.set(host, SLOWED_MS);
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(Math.max(back, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0));
      }
    });
  inFlight.set(host, turn);
  return turn;
}

async function get(url: string, what: string): Promise<unknown> {
  const key = createHash('sha256').update(`${url}\n${ACCEPT_LANGUAGE}`).digest('hex').slice(0, 40);
  const file = join(CACHE_DIR, `${key}.json`);
  if (!REFRESH && existsSync(file)) {
    const kept = JSON.parse(readFileSync(file, 'utf8')) as { fetchedAt?: string; body: unknown };
    asked.cached++;
    const day = (kept.fetchedAt ?? '').slice(0, 10);
    if (day > newestAnswer) newestAnswer = day;
    return kept.body;
  }
  const body = await fetchPolitely(url, what);
  const fetchedAt = new Date().toISOString();
  if (fetchedAt.slice(0, 10) > newestAnswer) newestAnswer = fetchedAt.slice(0, 10);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify({ url, fetchedAt, body }), 'utf8');
  return body;
}

/* WHICH Wikidata item, and why it is not simply the first one.

   `wbsearchentities` matches LABELS, so 磁器口 answers with 磁器口站 — a Beijing
   subway station 1,500 km from the Chongqing quarter we asked about. Taking
   the top hit would have shipped that. So the search asks for five candidates,
   ONE batched `wbgetentities` reads all five at once (same two requests per
   place as before), and the candidate whose P625 sits nearest our own verified
   coordinate wins. A place we have no coordinate for keeps the top hit and the
   table says how far away Wikidata thinks it is. */
/** One Wikidata item, read whole: what the gate's table prints (zh, en, IATA)
    and what the coordinate pass compares (every label and alias, P625). */
type WdItem = Wd & WdCand;

/** ONE batched `wbgetentities` for any number of items. */
async function wdEntities(ids: string[], from: number): Promise<WdItem[]> {
  if (!ids.length) return [];
  const entUrl =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels%7Caliases%7Cclaims` +
    `&languages=${WD_LANGS.join('%7C')}&ids=${ids.join('%7C')}`;
  const body = (await get(entUrl, `Wikidata entities ${ids[0]}`)) as { entities?: Record<string, WdEntity> };
  return ids.flatMap((id) => {
    const e = body.entities?.[id];
    if (!e) return [];
    const pos = claimValue(e, 'P625') as { latitude?: number; longitude?: number } | undefined;
    const iata = claimValue(e, 'P238');
    const label = (lang: string) => e.labels?.[lang]?.value;
    const zh = ['zh', 'zh-hans', 'zh-cn', 'zh-hant', 'zh-hk', 'zh-tw'].map(label).find((v) => !!v);
    const names: string[] = [];
    for (const lang of WD_LANGS) {
      for (const v of [label(lang), ...(e.aliases?.[lang] ?? []).map((a) => a.value)]) {
        if (v && !names.includes(v)) names.push(v);
      }
    }
    return [
      {
        id,
        ...(zh ? { zh } : {}),
        ...(label('en') ? { en: label('en') } : {}),
        ...(typeof pos?.latitude === 'number' && typeof pos.longitude === 'number'
          ? { coord: { lat: pos.latitude, lng: pos.longitude } }
          : {}),
        ...(typeof iata === 'string' ? { iata } : {}),
        from,
        names,
      } satisfies WdItem,
    ];
  });
}

async function wikidata(term: string, ours?: Coord): Promise<{ chosen: Wd | null; all: WdItem[] }> {
  const lang = hasCjk(term) ? 'zh' : 'en';
  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=5` +
    `&language=${lang}&uselang=${lang}&search=${encodeURIComponent(term)}`;
  const found = (await get(searchUrl, `Wikidata search for "${term}"`)) as { search?: { id?: string }[] };
  const ids = (found.search ?? []).map((s) => s.id).filter((x): x is string => !!x);
  if (!ids.length) return { chosen: null, all: [] };

  /* the entity read is a second request to the same service — get() spaces it */
  const cands = await wdEntities(ids, ids.length);
  if (!cands.length) return { chosen: null, all: [] };
  if (!ours) return { chosen: cands[0] ?? null, all: cands };
  const placed = cands.filter((c) => c.coord);
  if (!placed.length) return { chosen: cands[0] ?? null, all: cands };
  return { chosen: placed.reduce((best, c) => (km(ours, c.coord!) < km(ours, best.coord!) ? c : best)), all: cands };
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
/** `want` may name SEVERAL spellings; matching any one of them is agreement.
    That is not a loosening — it is how you write down that OpenStreetMap holds
    one place under two names (云顶滑雪公园 and 密苑云顶乐园 are the same ski
    resort) without letting the run's luck decide whether the gate passes. */
function nameAgrees(hit: string, want: string | string[]): boolean {
  const name = hitName(hit).toLowerCase();
  return (Array.isArray(want) ? want : [want]).some((w) => name.includes(w.trim().toLowerCase()));
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
  /** The address OSM knows, big → small, ready to ship. '' when it has none,
      and '' when folding it into the search made the search worse. */
  address: string;
  /** The address OSM returned before the re-check, and how the re-check went. */
  addressRaw: string;
  addressCheck: string;
  postcode: string;
  /** What Wikidata says this place is called, and where it is. */
  wd: string;
  wdName: string;
  wdIata: string;
  /** Distance between the OSM hit and the Wikidata coordinate. */
  agree: string;
  /** Distance between the Wikidata coordinate and OUR verified one. */
  wdOurs: string;
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

/* WHAT TO ASK WIKIDATA, where the manifest has no name to ask with. These are
   the entries that ship on a coordinate or a saved link precisely because no
   name survived the OSM gate — so the Wikidata pass has to be told what the
   place is called before it can rescue one. Each is the name the trip content
   itself uses; nothing here is a new guess. */
const WD_HINTS: Record<string, string> = {
  'stop:kunyu': '昆嵛山', // the massif coords.ts pins; the academy itself is unlisted anywhere
  'stop:chongli': '太子城', // the Olympic ski cluster the stop is
  'stop:gorge': '虎跳峡', // the gorge the saved share link opens
};

interface Target {
  id: string;
  label: string;
  coord?: Coord;
  plan: MapPlan;
  /** What the Wikidata pass searches for. */
  wdTerm: string;
}

/** Where `expect` lists several spellings, Wikidata is asked the first — the
    one written down as the place's official name. */
const firstExpect = (e: string | string[] | undefined): string | undefined => (Array.isArray(e) ? e[0] : e);

const mk = (t: Omit<Target, 'wdTerm'>): Target => ({
  ...t,
  wdTerm: WD_HINTS[t.id] ?? firstExpect(t.plan.expect) ?? t.plan.query ?? t.label,
});

const targets: Target[] = [
  ...Object.entries(STOP_MAPS).map(([key, plan]) =>
    mk({ id: `stop:${key}`, label: stopName(key), coord: STOP_COORDS[key], plan }),
  ),
  ...Object.entries(PLACE_MAPS).map(([id, plan]) => mk({ id, label: cardName(id), coord: PLACE_COORDS[id], plan })),
  ...Object.entries(STAY_MAPS).map(([id, plan]) =>
    mk({ id: `stay:${id.slice(-2)}`, label: stayName(id), coord: STOP_COORDS[STAY_STOP[id] ?? ''], plan }),
  ),
  ...Object.entries(AIRPORT_MAPS).map(([iata, plan]) => mk({ id: `air:${iata}`, label: iata, coord: AIRPORT_COORDS[iata], plan })),
  /* Spots have no coordinate of their own by design — the whole point is that
     nobody had to research 130 of them. Their yardstick is the stop.

     SIX ARE THE EXCEPTION and carry one in SPOT_COORDS, because measuring
     them from their stop would have meant a radius wide enough to accept the
     wrong answer (Jinshanling is 113 km from the Beijing pin; Sai Kung's Big
     Wave Bay is inside Hong Kong's default radius). Those coordinates come
     from Wikipedia/Wikidata only — never from OSM, which would make this
     check the same answer twice — and never reach the app. */
  ...Object.entries(SPOTS).flatMap(([key, list]) =>
    list.map((s) =>
      mk({
        id: `${key}/${s.id}`,
        label: s.name,
        coord: SPOT_COORDS[`${key}/${s.id}`] ?? STOP_COORDS[key],
        plan: {
          query: s.query,
          ...(s.city ? { city: s.city } : {}),
          expect: s.expect ?? s.native ?? s.query,
          nearKm: s.nearKm ?? DEFAULT_NEAR_KM,
          via: s.via,
          why: s.why,
          ...(s.address ? { address: s.address } : {}),
        } satisfies MapPlan,
      }),
    ),
  ),
];

/* The five entries that ship a coordinate rather than a name — the ones the
   Wikidata pass exists to try to rescue. Kept here so the run reports on them
   by name instead of leaving the reader to spot them in 176 rows. */
const COORD_ONLY = targets.filter((t) => t.plan.via === 'coord').map((t) => t.id);

/* --------------------------------------------------------- the passes ---- */

/** Keyed by row id — a button's own target, or `pin:<id>` / `<id>#street` for
    the coordinate pass's extra questions. `hit` is the first answer (what the
    gate reads); `all` is every answer Nominatim gave. */
const osmHits = new Map<string, { hit: Hit | null; all: Hit[]; err?: string; throttled?: boolean }>();
const wdHits = new Map<string, { wd: Wd | null; all: WdItem[]; err?: string }>();
/** Items an OSM answer links to by its own `wikidata=` tag, keyed by Q-id. */
const linkedWd = new Map<string, WdItem>();
let linkedErr = '';
/** Did folding the address into the search leave it still pointing at the same
    place? Absent = never asked (no address to fold in). */
const addrOk = new Map<string, { ok: boolean; why: string }>();

const asList = (w: string | string[] | undefined): string[] => (w === undefined ? [] : Array.isArray(w) ? w : [w]);

/* THE COORDINATE PASS'S EXTRA QUESTIONS — beyond the ones the buttons ask:
   the beds and the pinless cards, under their own names (pin-targets.ts).
   A CHAIN GETS NO EXTRA QUESTION. Its two branches in this trip (东来顺,
   四季民福) search with a street their button took from OSM's own July answer,
   not from the trip — and the trip names other branches (Donghuamen,
   Dengshikou, Wangfujing) — so a street-scoped answer would be OSM agreeing
   with itself. They stay ambiguous unless Wikidata sides with one branch. */
const PIN_ASKS = PIN_ONLY.map((p) => ({ key: `pin:${p.id}`, query: p.city ? `${p.query}, ${p.city}` : p.query, wdTerm: p.query }));

const osmQuery = (t: Target): string | null =>
  t.plan.query ? (t.plan.city ? `${t.plan.query}, ${t.plan.city}` : t.plan.query) : null;

/** The gate applied to a hit: near enough, and actually the place we asked for. */
function judge(t: Target & { coord: Coord }, hit: Hit): { ok: boolean; why: string; d: number } {
  const limit = t.plan.nearKm ?? (t.plan.grade === 'city' ? CITY_KM : POI_KM);
  const d = km(t.coord, hit);
  if (d > limit) return { ok: false, why: `${d.toFixed(1)} km away — too far`, d };
  const want = t.plan.expect ?? t.plan.query ?? '';
  if (!nameAgrees(hit.label, want)) return { ok: false, why: `a different place: "${hitName(hit.label)}"`, d };
  return { ok: true, why: 'agrees', d };
}

/* PASS 1 — where is this name?
   PASS 2 — and does the name STILL find it once the address is folded in?

   Pass 2 is the whole reason this feature is safe to ship. An address is only
   an improvement if the string the app will really send — name, address, city,
   exactly as searchTerms() composes it — still lands on the same place. Some
   of what OSM calls an address is a shopping centre or the words "domestic
   departures"; bolted onto a good name it can turn a working search into a
   miss. So every candidate address is re-asked as the app would ask it, and
   only the ones that survive are written into the manifests.

   Both passes share one queue, so Nominatim still sees one request a second. */
async function osmPass(): Promise<void> {
  const ask = async (q: string): Promise<Hit | null> => (await nominatim(q))[0] ?? null;
  const record = async (key: string, q: string): Promise<void> => {
    try {
      const all = await nominatim(q);
      osmHits.set(key, { hit: all[0] ?? null, all });
    } catch (e) {
      osmHits.set(key, {
        hit: null,
        all: [],
        err: e instanceof Error ? e.message : String(e),
        throttled: e instanceof RateLimited,
      });
    }
  };

  for (const t of targets) {
    const q = osmQuery(t);
    if (q) await record(t.id, q);
  }
  for (const p of PIN_ASKS) await record(p.key, p.query);

  for (const t of targets) {
    const hit = osmHits.get(t.id)?.hit;
    const coord = t.coord;
    if (!hit || !hit.parts.length || !coord) continue;
    if (!judge({ ...t, coord }, hit).ok) continue; // a failed name never donates an address
    const combined = searchTerms({
      query: t.plan.query,
      address: joinAddress(hit.parts),
      ...(t.plan.city ? { city: t.plan.city } : {}),
    });
    try {
      const again = await ask(combined);
      if (!again) addrOk.set(t.id, { ok: false, why: 'with the address the search finds nothing' });
      else {
        const v = judge({ ...t, coord }, again);
        addrOk.set(t.id, { ok: v.ok, why: v.ok ? `still agrees (${v.d.toFixed(2)} km)` : `the address breaks it: ${v.why}` });
      }
    } catch (e) {
      addrOk.set(t.id, { ok: false, why: `re-check failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
}

/* The Wikidata half is the CROSS-CHECK, not the gate. It doubles the length of
   a run and is rate-limited separately, so `PLACES_NO_WIKIDATA=1` skips it —
   which is what you want when you are re-running to confirm the gate after
   changing one name, rather than re-deriving the whole picture. */
const SKIP_WIKIDATA = !!process.env.PLACES_NO_WIKIDATA;

async function wdPass(): Promise<void> {
  if (SKIP_WIKIDATA) return;
  const asks = [
    ...targets.map((t) => ({ key: t.id, term: t.wdTerm, ours: t.coord })),
    ...PIN_ASKS.map((p) => ({ key: p.key, term: p.wdTerm, ours: PIN_ONLY.find((x) => `pin:${x.id}` === p.key)?.anchor })),
  ];
  for (const a of asks) {
    if (!a.term) continue;
    try {
      const { chosen, all } = await wikidata(a.term, a.ours);
      wdHits.set(a.key, { wd: chosen, all });
    } catch (e) {
      wdHits.set(a.key, { wd: null, all: [], err: e instanceof Error ? e.message : String(e) });
    }
  }
}

/* PASS 3 — the item an OSM answer names as itself. Many OSM objects carry a
   `wikidata=` tag; where that item was not among the label search's five, it
   is read here, fifty to a request (sorted, so a re-run asks the same
   questions and the cache answers them). An OSM object and the Wikidata item
   it links to, placed at the same spot, is the strongest agreement there is. */
async function linkedPass(): Promise<void> {
  if (SKIP_WIKIDATA) return;
  const known = new Set<string>();
  for (const { all } of wdHits.values()) for (const c of all) known.add(c.id);
  const want = new Set<string>();
  for (const { all } of osmHits.values()) for (const h of all) if (h.wikidata && /^Q\d+$/.test(h.wikidata) && !known.has(h.wikidata)) want.add(h.wikidata);
  const ids = [...want].sort();
  for (let i = 0; i < ids.length; i += 50) {
    try {
      for (const item of await wdEntities(ids.slice(i, i + 50), 1)) linkedWd.set(item.id, item);
    } catch (e) {
      linkedErr = e instanceof Error ? e.message : String(e);
    }
  }
}

console.log(
  `Asking OpenStreetMap and Wikidata about ${targets.length} places (+${PIN_ASKS.length} for the coordinate pass), ≥1 s each per service. Answers already cached cost nothing…`,
);
await Promise.all([osmPass(), wdPass()]);
await linkedPass();
console.log(`${asked.cached} answers from the cache, ${asked.network} asked over the network.`);

/* ------------------------------------------------------------- verdict ---- */

const rows: Row[] = [];
const rejects: string[] = [];
/** Names this run could not check at all, because a service was throttling. */
const unchecked: string[] = [];
let disagreements = 0;

for (const t of targets) {
  const { plan } = t;
  const limit = plan.nearKm ?? (plan.grade === 'city' ? CITY_KM : POI_KM);
  const w = wdHits.get(t.id)?.wd ?? null;
  const wdErr = wdHits.get(t.id)?.err;

  const wdCell = SKIP_WIKIDATA ? 'not asked' : w ? w.id : wdErr ? `ERROR ${wdErr}` : 'unknown to Wikidata';
  const wdName = w ? (w.zh ?? w.en ?? '') : '';
  const wdIata = w?.iata ?? '';
  const wdOurs = w?.coord && t.coord ? km(t.coord, w.coord).toFixed(2) : '—';

  const base = {
    id: t.id,
    name: t.label,
    limit: `${limit}`,
    ships: plan.via,
    wd: wdCell,
    wdName,
    wdIata,
    wdOurs,
  };

  const q = osmQuery(t);
  if (!q) {
    rows.push({
      ...base,
      query: plan.via === 'url' ? '(saved link)' : '—',
      hit: plan.via === 'url' ? (plan.url ?? '') : 'not looked up',
      dist: '—',
      limit: '—',
      verdict: plan.via === 'url' ? 'saved link wins' : 'no name to check',
      address: '',
      addressRaw: '',
      addressCheck: '',
      postcode: '',
      agree: '—',
    });
    continue;
  }

  const { hit, err, throttled } = osmHits.get(t.id) ?? { hit: null };

  if (err) {
    const failed = throttled ? 'rate-limited — NOT a verdict' : 'lookup failed';
    rows.push({ ...base, query: q, hit: `ERROR ${err}`, dist: '—', verdict: failed, address: '', addressRaw: '', addressCheck: '', postcode: '', agree: '—' });
    /* A service that would not answer has told us NOTHING about this name. It
       counts as unchecked, never as a name to demote — acting on a 429 as if it
       were a disagreement would tear out ninety correct buttons. */
    if (plan.via === 'name') {
      if (throttled) unchecked.push(`${t.id}\t${err}`);
      else {
        disagreements++;
        rejects.push(`${t.id}\tlookup failed: ${err}`);
      }
    }
    continue;
  }

  /* THE ADDRESS ONLY SHIPS IF IT SURVIVED THE RE-CHECK. Anything else keeps
     the name it already had — never a worse search than the one before. */
  const addressRaw = hit && hit.parts.length ? joinAddress(hit.parts) : '';
  const check = addrOk.get(t.id);
  const address = check?.ok ? addressRaw : '';
  const addressCheck = addressRaw ? (check?.why ?? 'not re-checked') : '';
  const agree = hit && w?.coord ? km(hit, w.coord).toFixed(2) : '—';

  if (!hit || !t.coord) {
    rows.push({
      ...base,
      query: q,
      hit: hit ? hit.label : 'no result',
      dist: '—',
      verdict: hit ? 'no coordinate of ours to compare' : 'OSM does not know this name',
      address,
      addressRaw,
      addressCheck,
      postcode: hit?.postcode ?? '',
      agree,
    });
    if (plan.via === 'name') {
      disagreements++;
      rejects.push(`${t.id}\t${hit ? 'nothing of ours to compare it against' : 'OSM has never heard of this name'}`);
    }
    continue;
  }

  const d = km(t.coord, hit);
  const within = d <= limit;
  const want = plan.expect ?? plan.query ?? '';
  const named = nameAgrees(hit.label, want);
  const verdict = !within
    ? `${d.toFixed(1)} km away — too far`
    : !named
      ? `a different place: "${hitName(hit.label)}"`
      : 'agrees';
  rows.push({
    ...base,
    query: q,
    hit: hit.label,
    dist: d < 10 ? d.toFixed(2) : d.toFixed(1),
    verdict,
    address: verdict === 'agrees' ? address : '', // only a PASS may donate an address
    addressRaw,
    addressCheck,
    postcode: hit.postcode ?? '',
    agree,
  });
  /* A shipped name search must agree; a demoted one is expected to disagree. */
  if (plan.via === 'name' && verdict !== 'agrees') {
    disagreements++;
    rejects.push(`${t.id}\t${verdict} — "${cut(hit.label, 64)}"`);
  }
}

/* Machine-readable copy of the same table — this is what the addresses and the
   canonical names in map-links.ts / spots.ts were transcribed from. Off unless
   asked for; nothing lands in the repo by itself. */
if (process.env.PLACES_JSON) writeFileSync(process.env.PLACES_JSON, JSON.stringify(rows, null, 1), 'utf8');

const W = { id: 15, name: 14, ships: 5, dist: 6, verdict: 21, address: 30, wd: 24, agree: 6 };
const head = [
  'place'.padEnd(W.id),
  'name'.padEnd(W.name),
  'ships'.padEnd(W.ships),
  'km'.padStart(W.dist),
  'OSM verdict'.padEnd(W.verdict),
  'address OSM knows'.padEnd(W.address),
  'Wikidata'.padEnd(W.wd),
  'agree'.padStart(W.agree),
].join('  ');

console.log('');
console.log('PLACE VERIFICATION — OpenStreetMap / Nominatim  ×  Wikidata');
console.log(head);
console.log('─'.repeat(head.length));
for (const r of rows) {
  console.log(
    [
      cut(r.id, W.id).padEnd(W.id),
      cut(r.name, W.name).padEnd(W.name),
      r.ships.padEnd(W.ships),
      r.dist.padStart(W.dist),
      cut(r.verdict, W.verdict).padEnd(W.verdict),
      cut(r.address || '—', W.address).padEnd(W.address),
      cut(`${r.wd}${r.wdName ? ' ' + r.wdName : ''}${r.wdIata ? ' [' + r.wdIata + ']' : ''}`, W.wd).padEnd(W.wd),
      r.agree.padStart(W.agree),
    ].join('  '),
  );
}
console.log('─'.repeat(head.length));
const byVia = (v: MapPlan['via']) => rows.filter((r) => r.ships === v).length;
console.log(
  `${rows.length} places · ships: ${byVia('name')} name · ${byVia('coord')} coord · ${byVia('url')} url · ${byVia('none')} nothing at all`,
);
console.log(`thresholds: ${POI_KM} km for a POI, ${CITY_KM} km for a city/area. Addresses capped at ${ADDRESS_MAX} characters.`);
console.log(
  `${rows.filter((r) => r.address).length} ship an address; ` +
    `${rows.filter((r) => r.addressRaw && !r.address).length} had one that made the search worse and was dropped.`,
);
console.log(`${rows.filter((r) => r.wd.startsWith('Q')).length} of them are in Wikidata.`);

/* The coordinate-only entries, called out by name: these are the ones a
   canonical Wikidata name could promote back to a name search. */
console.log('');
console.log('THE COORDINATE-ONLY ENTRIES — can Wikidata rescue any of them?');
for (const id of COORD_ONLY) {
  const r = rows.find((x) => x.id === id);
  if (!r) continue;
  console.log(
    `  ${r.id.padEnd(16)} ships coord · OSM: ${r.verdict} · Wikidata: ${r.wd} ${r.wdName}${r.wdIata ? ` [${r.wdIata}]` : ''} · ${r.wdOurs} km from our own pin`,
  );
}

/* Every address OSM offered that was thrown away, and why. These are the
   places that keep the name they already had — the honest outcome. */
const dropped = rows.filter((r) => r.addressRaw && !r.address);
if (dropped.length) {
  console.log('');
  console.log('ADDRESSES OFFERED AND REJECTED — the name alone searches better:');
  for (const r of dropped) console.log(`  ${r.id.padEnd(24)} ${cut(r.addressRaw, 40).padEnd(40)} ${r.addressCheck}`);
}

/* Where the two sources disagree about position by more than a POI radius, the
   manifest has to say which one it believes and why. */
const split = rows.filter((r) => r.agree !== '—' && Number(r.agree) > POI_KM);
if (split.length) {
  console.log('');
  console.log(`OSM AND WIKIDATA PLACE THESE MORE THAN ${POI_KM} km APART — record the choice in \`why\`:`);
  for (const r of split) console.log(`  ${r.id.padEnd(16)} ${r.agree} km apart · Wikidata is ${r.wdOurs} km from our pin`);
}

/* ------------------------------------------------------- the pin pass ---- */

/* WHERE THE MAP TAB MAY DRAW EACH PLACE (Map 5a). The same answers the gate
   just read, judged by china/pin-rules.ts. Every shipped spot (the button's own
   lookup), the two beds that open by name, and the pin-only asks. Nothing here
   changes a button: a pin is drawn, never opened. */
interface PinJob {
  id: string;
  entity: string;
  name: string;
  native?: string;
  kind: PinKind;
  anchor: Coord;
  nearKm: number;
  want: string[];
  osmKey: string;
  wdKey: string;
  /** The place's own kinds, where pin-targets.ts PIN_FITS names them. */
  fits?: readonly string[];
}

const latinOnly = (s: string) => /[A-Za-z]/.test(s) && !hasCjk(s);
const cardMeaning = (id: string) => bundle.showCards.find((c) => c.id === id)?.meaning ?? id;
const needAnchor = (c: Coord | undefined, id: string): Coord => {
  if (!c) throw new Error(`pin pass: ${id} has no anchor`);
  return c;
};

const pinJobs: PinJob[] = [
  ...Object.entries(SPOTS).flatMap(([key, list]) =>
    list
      .filter((s) => s.via === 'name')
      .map((s): PinJob => {
        const id = `${key}/${s.id}`;
        const own = PIN_ANCHORS[id];
        return {
          id,
          entity: `cn26-spot-${key}-${s.id}`,
          name: s.name,
          ...(s.native ? { native: s.native } : {}),
          kind: s.kind,
          anchor: needAnchor(own?.anchor ?? SPOT_COORDS[id] ?? STOP_COORDS[key], id),
          nearKm: own?.nearKm ?? s.nearKm ?? DEFAULT_NEAR_KM,
          /* the gate's own token(s), and the English query where the button
             searches in English (Hong Kong, Macau) — "Chinese or English" */
          want: [...new Set([...asList(s.expect ?? s.native ?? s.query), ...(latinOnly(s.query) ? [s.query] : [])])],
          osmKey: id,
          wdKey: id,
          ...(PIN_FITS[id] ? { fits: PIN_FITS[id].fits } : {}),
        };
      }),
  ),
  ...Object.entries(STAY_MAPS)
    .filter(([, p]) => p.via === 'name' && !!p.query)
    .map(([entity, p]): PinJob => {
      const id = `stay:${entity.slice(-2)}`;
      const own = PIN_ANCHORS[id];
      return {
        id,
        entity,
        name: mdliteToText(stayName(entity)),
        ...(p.query ? { native: p.query } : {}),
        kind: 'hotel',
        anchor: needAnchor(own?.anchor ?? STOP_COORDS[STAY_STOP[entity] ?? ''], id),
        nearKm: own?.nearKm ?? p.nearKm ?? CITY_KM,
        want: asList(p.expect ?? p.query),
        osmKey: id,
        wdKey: id,
      };
    }),
  ...PIN_ONLY.map(
    (p): PinJob => ({
      id: p.id,
      entity: p.entity,
      name: mdliteToText(p.entity.startsWith('cn26-stay-') ? stayName(p.entity) : cardMeaning(p.entity)),
      native: p.query,
      kind: p.kind,
      anchor: p.anchor,
      nearKm: p.nearKm,
      want: p.expect,
      osmKey: `pin:${p.id}`,
      wdKey: `pin:${p.id}`,
    }),
  ),
];

/** The Wikidata items a decision may lean on: the label search's, plus any
    item one of the OSM answers links to itself. */
function wdFor(key: string, hits: Hit[]): WdCand[] {
  const out: WdCand[] = [...(wdHits.get(key)?.all ?? [])];
  for (const h of hits) {
    const l = h.wikidata ? linkedWd.get(h.wikidata) : undefined;
    if (l && !out.some((c) => c.id === l.id)) out.push(l);
  }
  return out;
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
const pinRecords: Record<string, PinRecord> = {};
const pinMissing: string[] = [];
for (const j of pinJobs) {
  const o = osmHits.get(j.osmKey);
  const w = wdHits.get(j.wdKey);
  if (!o || o.err || SKIP_WIKIDATA || !w || w.err) {
    pinMissing.push(`${j.id}\t${o?.err ?? w?.err ?? (SKIP_WIKIDATA ? 'Wikidata skipped' : 'not asked')}`);
    continue;
  }
  const ask: PinAsk = {
    kind: j.kind,
    anchor: j.anchor,
    nearKm: j.nearKm,
    want: j.want,
    osm: o.all,
    wd: wdFor(j.wdKey, o.all),
    ...(j.fits ? { fits: j.fits } : {}),
  };
  const v = decidePin(ask);
  const h = v.hit;
  pinRecords[j.id] = {
    entity: j.entity,
    name: j.name,
    ...(j.native ? { native: j.native } : {}),
    kind: j.kind,
    ok: v.ok,
    ...(v.ok && h ? { lat: r5(h.lat), lng: r5(h.lng) } : {}),
    ...(h ? { osm: h.osm, matched: h.names[0] ?? hitName(h.label), osmClass: `${h.cls}=${h.type}` } : {}),
    ...(v.km !== undefined ? { km: v.km } : {}),
    anchor: j.anchor,
    nearKm: j.nearKm,
    ...(v.sources ? { sources: v.sources } : {}),
    ...(v.wd ? { wd: v.wd.id, wdKm: v.wd.km } : {}),
    /* the hit is one of the Hits read above, with the address OSM returned */
    ...(j.kind === 'hotel' && h && (h as Hit).parts.length ? { osmAddress: joinAddress((h as Hit).parts) } : {}),
    reason: v.reason,
  };
}

/* THE COORDINATES THE TRIP ALREADY STORES — the stops, the pinned driver cards
   and the three card-less airports — measured against both sources. Reported,
   never changed here: a clear error is fixed in coords.ts, by hand, with the
   evidence beside it. Confirmed = OSM's first answer carries the name and our
   coordinate sits inside it (its own size, at least 0.5 km for a place and
   2 km for a city), or Wikidata's item of the name sits that close. */
const coordChecks: Record<string, CoordCheck> = {};
for (const t of targets) {
  const ours = t.id.startsWith('stop:')
    ? STOP_COORDS[t.id.slice(5)]
    : t.id.startsWith('cn26-place-')
      ? PLACE_COORDS[t.id]
      : t.id.startsWith('air:')
        ? AIRPORT_COORDS[t.id.slice(4)]
        : undefined;
  if (!ours) continue;
  const floor = t.plan.grade === 'city' || t.id.startsWith('stop:') ? 2 : 0.5;
  const hit = osmHits.get(t.id)?.hit ?? null;
  const want = asList(t.plan.expect ?? t.plan.query ?? t.wdTerm);
  const named = !!hit && (nameAgrees(hit.label, want) || !!namesAgree(hit.names, want));
  const osmKm = hit ? km(ours, hit) : undefined;
  const w = wdHits.get(t.id)?.wd ?? null;
  const wdKm = w?.coord ? km(ours, w.coord) : undefined;
  const osmOk = named && osmKm !== undefined && hit !== null && osmKm <= Math.max(floor, sizeKm(hit));
  const wdOk = wdKm !== undefined && wdKm <= floor;
  const verdict = osmOk
    ? `OSM agrees: ${hitName(hit!.label)} ${osmKm!.toFixed(2)} km`
    : wdOk
      ? `Wikidata agrees: ${w!.id} ${wdKm!.toFixed(2)} km`
      : `neither source confirms it — OSM ${osmKm === undefined ? 'has no answer' : `${osmKm.toFixed(2)} km${named ? '' : ', another name'}`}, Wikidata ${wdKm === undefined ? 'has no coordinate' : `${wdKm.toFixed(2)} km`}`;
  coordChecks[t.id] = {
    entity: t.id.startsWith('stop:') ? `cn26-stop-${t.id.slice(5)}` : t.id,
    name: t.label,
    coord: ours,
    ...(hit ? { osm: hit.osm, matched: hit.names[0] ?? hitName(hit.label), osmClass: `${hit.cls}=${hit.type}`, osmKm: Math.round(osmKm! * 100) / 100, named, osmAgrees: osmOk } : {}),
    ...(w ? { wd: w.id, wdName: w.zh ?? w.en ?? '', ...(wdKm !== undefined ? { wdKm: Math.round(wdKm * 100) / 100 } : {}) } : {}),
    confirmed: osmOk || wdOk,
    verdict,
  };
}

const pins = Object.values(pinRecords);
console.log('');
console.log('THE COORDINATE PASS — where the Map tab may draw each place (china/pin-rules.ts)');
console.log(
  `${pins.length} decided · ${pins.filter((p) => p.ok).length} pinned ` +
    `(${pins.filter((p) => p.sources === 'osm+wikidata').length} two sources, ${pins.filter((p) => p.sources === 'osm').length} one clean OSM answer) · ` +
    `${pins.filter((p) => !p.ok).length} by name only${pinMissing.length ? ` · ${pinMissing.length} NOT DECIDED (no answer)` : ''}`,
);
for (const [id, p] of Object.entries(pinRecords)) {
  console.log(
    `  ${p.ok ? 'PIN ' : 'none'} ${cut(id, 30).padEnd(30)} ${cut(p.matched ?? '—', 16).padEnd(16)} ${(p.osmClass ?? '').padEnd(24)} ${p.km === undefined ? '    —' : p.km.toFixed(1).padStart(5)}/${String(p.nearKm).padEnd(4)} ${cut(p.reason, 90)}`,
  );
}
const checks = Object.values(coordChecks);
console.log('');
console.log(`THE STORED COORDINATES — ${checks.length} measured: ${checks.filter((c) => c.confirmed).length} confirmed by a source, ${checks.filter((c) => !c.confirmed).length} to read by hand`);
for (const [id, c] of Object.entries(coordChecks)) if (!c.confirmed) console.log(`  ${id.padEnd(16)} ${cut(c.name, 20).padEnd(20)} ${c.verdict}`);

if (process.env.PLACES_EVIDENCE) {
  writeFileSync(
    process.env.PLACES_EVIDENCE,
    JSON.stringify({ osm: Object.fromEntries(osmHits), wd: Object.fromEntries(wdHits), linked: Object.fromEntries(linkedWd), jobs: pinJobs }, null, 1),
    'utf8',
  );
}

/* pins.ts is only ever written from a COMPLETE set of answers: a question a
   service would not answer is not a "no pin", and must never become one. */
if (process.env.PLACES_PINS) {
  if (pinMissing.length || linkedErr) {
    console.error(`\npins.ts NOT written — ${pinMissing.length} place(s) have no complete answer${linkedErr ? ` (and a linked Wikidata read failed: ${linkedErr})` : ''}:`);
    for (const m of pinMissing.slice(0, 12)) console.error(`  ${m}`);
  } else {
    const out = join(here, 'china', 'pins.ts');
    writeFileSync(out, renderPins(newestAnswer, pinRecords, coordChecks), 'utf8');
    console.log(`\nWrote ${out}`);
  }
}

if (disagreements > 0) {
  console.error(`\n${disagreements} name(s) ship a search OpenStreetMap does not agree with. Demote each one:`);
  console.error("  via 'coord' where the entity has a coordinate of its own, via 'none' where it has not." + '\n');
  for (const r of rejects) console.error(`  ${r}`);
  process.exit(1);
}

/* NOT the same failure, and it must never be confused with one. On a day when
   this script has already asked Nominatim six hundred questions it starts
   answering 429 to everything, and an earlier version of this file reported
   that as "91 names OpenStreetMap does not agree with — demote each one".
   Demoting on the strength of a rate limit would have deleted ninety correct
   buttons. A service that will not answer has told us nothing. */
if (unchecked.length) {
  console.error(`\n⚠ ${unchecked.length} name(s) COULD NOT BE CHECKED — the service asked us to slow down.`);
  console.error('  This is not a verdict about them, and nothing may be demoted on the strength of it.');
  console.error('  The manifests keep the decision from the last run that got real answers.');
  console.error('  Re-run later; the limit resets within the hour.\n');
  for (const r of unchecked.slice(0, 12)) console.error(`  ${r}`);
  if (unchecked.length > 12) console.error(`  …and ${unchecked.length - 12} more`);
  process.exit(2);
}

console.log('\n✓ every shipped name search agrees with the place OpenStreetMap knows by that name.');
