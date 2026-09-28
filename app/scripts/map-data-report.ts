/* Writes docs/design/horizon/MAP-DATA.md — the audit of the Map tab's data
   layer (Map 5a), from the committed seed and china/pins.ts. No network.

   Run: npx tsx scripts/map-data-report.ts

   Every number and every row below comes out of the data, so the document
   cannot drift from what the app ships: re-run it after `npm run seed-build`. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup, Booking, PlaceCategory, ShowCard, Stop, TripBundle } from '../src/lib/model/types';
import { nearestStop } from '../src/lib/logic/citymap';
import { mdliteToText } from '../src/lib/logic/mdlite';
import { categoryFromOsm, OVERRIDES, PLACE_CATEGORIES } from './china/categories';
import { STOP_COORDS } from './china/coords';
import { pinnedClass, spotKey } from './china/map-layer';
import { FAR_KM } from './china/pin-rules';
import { PIN_ANCHORS, PIN_FITS, PIN_ONLY } from './china/pin-targets';
import { COORD_CHECKS, PINS, PINS_AS_OF } from './china/pins';
import { DEFAULT_NEAR_KM, SPOTS } from './china/spots';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const b = seed.trips[0] as TripBundle;
const out = join(repo, 'docs', 'design', 'horizon', 'MAP-DATA.md');

const cell = (s: string | number | undefined) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ');
const plain = (s: string) => mdliteToText(s).replace(/\s+/g, ' ').trim();
const short = (s: string) => (s.length > 60 ? s.slice(0, 59).trimEnd() + '…' : s);
const real = b.stops.filter((s) => s.kind === 'stop');
const stopName = (s: Stop) => plain(s.name).split(' — ')[0] ?? s.id;
const inStay = (s: Stop, d: string) => d >= s.start && d < s.end;

/* ---- what each place is, where it belongs, and how it stands ---- */
type Kind = 'spot' | 'card' | 'bed' | 'ticket' | 'move';
interface Row {
  id: string;
  kind: Kind;
  name: string;
  native?: string;
  city?: Stop;
  category: PlaceCategory;
  from: 'trip' | 'osm' | 'kind';
  state: 'coord' | 'pin' | 'name' | 'none';
  detail?: string;
}
const state = (e: { coord?: unknown; pin?: unknown; mapQuery?: string; mapUrl?: string; address?: string }): Row['state'] =>
  e.coord ? 'coord' : e.pin ? 'pin' : e.mapQuery || e.mapUrl || e.address ? 'name' : 'none';
const from = (id: string, osmClass: string | undefined): Row['from'] => (OVERRIDES[id] ? 'trip' : osmClass && categoryFromOsm(osmClass) ? 'osm' : 'kind');

const named = new Map<string, Stop>();
for (const d of b.dayPlans) for (const id of d.placeIds ?? []) { const s = real.find((x) => inStay(x, d.date)); if (s && !named.has(id)) named.set(id, s); }
for (const d of b.dayDefaults) for (const id of d.placeIds ?? []) { const s = real.find((x) => x.id === d.stopId); if (s && !named.has(id)) named.set(id, s); }

const rows: Row[] = [];
for (const st of real) {
  const key = st.id.slice('cn26-stop-'.length);
  for (const sp of st.spots ?? []) {
    rows.push({ id: sp.id, kind: 'spot', name: sp.name, ...(sp.native ? { native: sp.native } : {}), city: st, category: sp.category!, from: from(sp.id, pinnedClass(spotKey(key, sp.id))), state: state(sp), ...(sp.detail ? { detail: sp.detail } : {}) });
  }
}
for (const c of b.showCards.filter((x): x is ShowCard => x.kind === 'place')) {
  const at = c.coord ?? c.pin;
  /* a card with no position belongs where its own lookup was anchored (the
     trip's words put it there), and the academy's card to the academy */
  const anchor = PIN_ONLY.find((t) => t.entity === c.id)?.anchor;
  const city =
    (at ? nearestStop(at, real) : null) ?? named.get(c.id) ?? (anchor ? nearestStop(anchor, real) : null) ?? (c.id === 'cn26-place-00' ? real.find((s) => s.id === 'cn26-stop-kunyu') : undefined);
  rows.push({ id: c.id, kind: 'card', name: short(plain(c.meaning).split(' — ')[0] ?? c.id), native: c.native.slice(0, 24), ...(city ? { city } : {}), category: c.category!, from: from(c.id, undefined), state: state(c), ...(c.detail ? { detail: c.detail } : {}) });
}
for (const x of b.bookings as Booking[]) {
  const kind: Kind = x.kind === 'hotel' ? 'bed' : x.kind === 'activity' ? 'ticket' : 'move';
  /* a bed by its check-in; a ticket where it happens (its coordinate or pin),
     else by its date — Tianmen's ticket is dated the day you leave Zhangjiajie */
  const at = x.coord ?? x.pin;
  const city =
    x.kind === 'hotel'
      ? real.find((s) => inStay(s, x.checkIn))
      : x.kind === 'activity'
        ? ((at ? nearestStop(at, real) : null) ?? real.find((s) => inStay(s, x.date)))
        : undefined;
  const osmClass = x.kind === 'hotel' ? pinnedClass(`stay:${x.id.slice(-2)}`) : undefined;
  rows.push({ id: x.id, kind, name: plain(x.title), ...(city ? { city } : {}), category: x.category!, from: from(x.id, osmClass), state: state(x), ...(x.detail ? { detail: x.detail } : {}) });
}
const places = rows.filter((r) => r.kind !== 'move');

/* ---- the per-city table ---- */
const cats = PLACE_CATEGORIES;
const count = (list: Row[], f: (r: Row) => boolean) => list.filter(f).length;
const cityLine = (label: string, list: Row[]) =>
  `| ${label} | ${list.length} | ${count(list, (r) => r.state === 'coord' || r.state === 'pin')} (${count(list, (r) => r.state === 'coord')} · ${count(list, (r) => r.state === 'pin')}) | ${count(list, (r) => r.state === 'name')} | ${count(list, (r) => r.state === 'none')} | ` +
  cats.map((c) => count(list, (r) => r.category === c) || '·').join(' | ') +
  ` | ${count(list, (r) => !!r.detail)} |`;
const perCity = [
  `| City | places | pinned (stored · new) | by name only | no pin, no button | ${cats.join(' | ')} | with a detail |`,
  `|---|---:|---:|---:|---:|${cats.map(() => '---:').join('|')}|---:|`,
  ...real.map((s) => cityLine(stopName(s), places.filter((r) => r.city?.id === s.id))),
  ...(places.some((r) => !r.city) ? [cityLine('(no city)', places.filter((r) => !r.city))] : []),
  cityLine('**All**', places),
];
const byKind = (['spot', 'card', 'bed', 'ticket'] as Kind[]).map((k) => {
  const l = places.filter((r) => r.kind === k);
  return `| ${k === 'spot' ? 'Spots' : k === 'card' ? 'Driver cards (place)' : k === 'bed' ? 'Beds' : 'Tickets'} | ${l.length} | ${count(l, (r) => r.state === 'coord')} | ${count(l, (r) => r.state === 'pin')} | ${count(l, (r) => r.state === 'name')} | ${count(l, (r) => r.state === 'none')} | ${count(l, (r) => !!r.detail)} |`;
});
const moves = rows.filter((r) => r.kind === 'move');
const byCategory = cats.map((c) => {
  const l = places.filter((r) => r.category === c);
  return `| ${c} | ${l.length} | ${count(l, (r) => r.state === 'coord' || r.state === 'pin')} | ${count(l, (r) => r.state === 'name')} | ${count(l, (r) => r.state === 'none')} |`;
});

/* ---- the radius, city by city ---- */
const radius = real.map((s) => {
  const key = s.id.slice('cn26-stop-'.length);
  const odd = (SPOTS[key] ?? []).filter((sp) => sp.via === 'name' && (sp.nearKm ?? DEFAULT_NEAR_KM) !== DEFAULT_NEAR_KM);
  const list = odd.map((sp) => `${sp.name} ${sp.nearKm} km`).join(' · ');
  const c = STOP_COORDS[key];
  return `| ${stopName(s)} | ${c ? `${c.lat}, ${c.lng}` : '—'} | ${(SPOTS[key] ?? []).filter((sp) => sp.via === 'name').length - odd.length} at ${DEFAULT_NEAR_KM} km | ${cell(list || '—')} |`;
});

/* ---- the audit ---- */
const recEntity = new Map(Object.entries(PINS).map(([k, v]) => [v.entity, k]));
const audit: string[] = [];
for (const s of [...real, undefined]) {
  const list = Object.entries(PINS).filter(([, p]) => (rows.find((r) => r.id === p.entity)?.city?.id ?? undefined) === s?.id);
  if (!list.length) continue;
  audit.push('', `### ${s ? stopName(s) : 'No city'} — ${list.filter(([, p]) => p.ok).length} of ${list.length} pinned`, '');
  audit.push('| Place | Native | OSM id | Matched name | OSM class | Source(s) | km / limit | Decision — reason |', '|---|---|---|---|---|---|---:|---|');
  for (const [, p] of list) {
    audit.push(
      `| ${cell(p.name)} | ${cell(p.native)} | ${cell(p.osm ?? '—')} | ${cell(p.matched ?? '—')} | ${cell(p.osmClass ?? '—')} | ${p.ok ? (p.sources === 'osm+wikidata' ? `OSM + Wikidata ${p.wd} (${p.wdKm} km)` : 'OSM') : '—'} | ${p.km ?? '—'} / ${p.nearKm} | ${p.ok ? '**pinned**' : 'no pin'} — ${cell(p.reason)} |`,
    );
  }
}
const rejectKinds: [string, RegExp][] = [
  ['OSM answers with a different place', /a different place/],
  ['the right name on the wrong kind of thing', /which is not a|the trip names a/],
  ['too far from its anchor', /too far/],
  ['ambiguous — the name answers in more than one place', /ambiguous/],
  ['the sources disagree', /disagree/],
  [`past ${FAR_KM} km with one source`, /Wikidata does not confirm/],
  ['OSM does not know the name', /does not know/],
];
const rejects = Object.values(PINS).filter((p) => !p.ok);
const rejectLines = rejectKinds.flatMap(([label, re]) => {
  const l = rejects.filter((p) => re.test(p.reason));
  return l.length ? [`- **${label}** (${l.length}): ${l.map((p) => `${cell(p.name)}${p.native && p.native !== p.name ? ` ${cell(p.native)}` : ''} — ${cell(p.reason)}`).join('; ')}`] : [];
});
const unclassified = rejects.filter((p) => !rejectKinds.some(([, re]) => re.test(p.reason)));
if (unclassified.length) rejectLines.push(`- **other** (${unclassified.length}): ${unclassified.map((p) => `${cell(p.name)} — ${cell(p.reason)}`).join('; ')}`);

const checks = Object.entries(COORD_CHECKS).map(
  ([id, c]) =>
    `| ${cell(id)} | ${cell(c.name)} | ${c.coord.lat}, ${c.coord.lng} | ${cell(c.matched ?? '—')} ${c.osmClass ? `(${cell(c.osmClass)})` : ''} | ${c.osmKm ?? '—'}${c.named === false ? ' · other name' : ''} | ${cell(c.wd ? `${c.wd} ${c.wdName ?? ''}` : '—')} | ${c.wdKm ?? '—'} | ${c.confirmed ? 'confirmed' : '**read by hand**'} — ${cell(c.verdict)} |`,
);

const overrides = Object.entries(OVERRIDES).map(([id, o]) => `| ${cell(rows.find((r) => r.id === id)?.name ?? id)} | ${o.category} | ${cell(o.why)} |`);
const noDetail = places.filter((r) => !r.detail);
const beds = rows
  .filter((r) => r.kind === 'bed')
  .map((r) => {
    const x = b.bookings.find((y) => y.id === r.id)!;
    const k = recEntity.get(r.id);
    const p = k ? PINS[k] : undefined;
    const booked = x.address ? `address: ${cell(x.address)}` : x.mapQuery ? `name: ${cell(x.mapQuery)}` : 'none';
    return `| ${cell(r.name)} | ${booked} | ${x.pin ? `${x.pin.lat}, ${x.pin.lng}` : '—'} | ${cell(p?.osmAddress ?? '—')} | ${cell(p ? (p.ok ? p.reason : `no pin — ${p.reason}`) : 'not asked — no name any document gives')} | ${cell(r.detail ?? '—')} |`;
  });
const pinOnly = PIN_ONLY.map((t) => `| ${cell(t.id)} | ${cell(t.query)} | ${cell(t.expect.join(' / '))} | ${t.nearKm} km | ${cell(t.why)} |`);
const anchors = Object.entries(PIN_ANCHORS).map(([id, a]) => `| ${cell(id)} | ${a.anchor.lat}, ${a.anchor.lng} | ${a.nearKm} km | ${cell(a.why)} |`);
const ownKinds = Object.entries(PIN_FITS).map(([id, k]) => `| ${cell(id)} | ${cell(k.fits.join(' · '))} | ${cell(k.why)} |`);

const md = `# Map 5a — the Map tab's data: pins, categories, details

Generated by \`npx tsx scripts/map-data-report.ts\` from \`seed/china-2026.trip.json\` and
\`app/scripts/china/pins.ts\` (OpenStreetMap + Wikidata answers of ${PINS_AS_OF}). The tables are the
data; do not edit them by hand. Brief: \`MAP-5A.md\`; design: \`MAPS6.md\`.

## What this step adds

Three optional fields on every spot, driver card (place kind) and booking — \`pin\`, \`category\`, \`detail\`
(\`app/src/lib/model/types.ts\`, the block under \`Coord\`). The layer changes nothing else: the tests rebuild
the trip without it and compare field for field and in order (\`src/tests/mapdata.test.ts\`). Against the
committed seed, the regenerated one differs in exactly one existing value, and not because of the layer: the
flight PDF's \`meta.size\` read 162884 since 24 July while the bytes embedded beside it are 161182 long (they are
identical to \`sources/china-2026/China-2026-Flights.pdf\`) — any \`npm run seed-build\` writes the true length.
A second pipeline defect was fixed on the way: \`readExtras\` now reads the read-more sources with \\n line endings,
so a Windows checkout no longer turns ten stops' paragraph breaks into \\r\\n (\`app/scripts/china/inputs.ts\`).

**Why \`pin\` and not \`coord\`.** \`coord\` already means three things the app acts on today: the map button's
fallback dot, a pin on the city close-up, and the day screen's distance ranking — and the owner's rules around it
are strict ("a bed never ships a dot"; a bed's button is phone-tested first). Filling \`coord\` would have given
two buttonless beds a dot to open, zoomed every city close-up out to fit Mutianyu, Penglai and Macau, and
re-ranked the day screen's options — UI changes this step must not make. \`pin\` is only where the Map tab may
draw a place: it is never a map target, it exists only where \`coord\` does not, and the Map tab reads
\`coord ?? pin\`. Step 5c decides, screen by screen, whether anything else should read it.

**The coordinate rules** (\`app/scripts/china/pin-rules.ts\`, unit-tested in \`pinrules.test.ts\`). Of
Nominatim's five answers to the button's own query, (1) the first that passes rules 2–4 is judged, and the
namesakes above it — a bus stop, a metro station, a motorway junction named after the place — are written
down as skipped (a button opens the first answer, so its gate reads only that; a pin claims where the place
IS); it must (2) carry one of the trip's own tokens in one of its names (label, name, name:*, official/alt/short
name — never old_name; normalised for width, case, quotes and dashes), (3) lie within its anchor's radius,
(4) be the right kind of thing (its class=type fits what the trip says the place is: a sight is never a railway
station, a hotel named after a temple is not the temple, and five places are held to their own kinds —
\`pin-targets.ts\` PIN_FITS), (5) not be ambiguous (no other qualifying answer elsewhere in the circle; a road OSM
keeps in pieces is one road; anything else — a chain's branches included — needs Wikidata to side with one
answer), (6) not be contradicted (the item OSM links it to, or one bearing the place's own name inside the circle,
must lie on the answer's outline or within 0.5 km of it), and (7) past ${FAR_KM} km from its anchor, be
confirmed by Wikidata. Two sources agreeing is recorded as such; one clean OSM answer is accepted. Anything
else: no pin, and the place keeps opening by name exactly as before.

**The lookups** are \`npm run verify:places\` — the same dev-only script, Nominatim + Wikidata at no more than one
request a second per service (enforced per host, slowed to one per 5 s after a 429), with the script's own
User-Agent, every answer cached in \`app/.cache/places\` (git-ignored). \`PLACES_PINS=1\` writes \`pins.ts\` and
refuses to while any answer is missing. The beds and the six driver cards without a coordinate were asked under
their own names for a pin only (\`app/scripts/china/pin-targets.ts\`):

| Id | Query (the trip's own name) | Tokens | Radius | Anchor and why |
|---|---|---|---:|---|
${pinOnly.join('\n')}

## Per city

Places = the stop's spots, the driver cards that belong to the city (by coordinate, else by the days that name
them), its beds and its tickets. *Pinned* = a stored \`coord\` or a new \`pin\`; *by name only* = no position, but
its button opens it by name or address, as today; *no pin, no button* = named only, on purpose.

${perCity.join('\n')}

| Kind | total | stored coord | new pin | by name only | neither | with a detail |
|---|---:|---:|---:|---:|---:|---:|
${byKind.join('\n')}

| Category | places | pinned | by name only | neither |
|---|---:|---:|---:|---:|
${byCategory.join('\n')}

Movements (flights, trains, road legs) are not places: ${moves.length} bookings, every one category \`transport\`,
no pin (a flight's \`coord\` is its departure airport, unchanged) and no detail.

## The radius, city by city

Each place is held to the radius its own map button is already gated with (\`spots.ts\` \`nearKm\`, the reason
written beside each), measured from the stop's verified coordinate — or, for six far-flung spots, from their own
independently sourced yardstick (\`coords.ts\` SPOT_COORDS). ${DEFAULT_NEAR_KM} km is the city: every stop's own
sights sit inside it. Parks and scenic areas are large, so the anchor for a park is the park, not its gate, and
the radius covers the park; a place farther out than that is named by the trip itself ("about an hour north")
and — past ${FAR_KM} km — must also be confirmed by Wikidata. The anchor is the stop's own coordinate
(coords.ts: Mount Kunyu, Tiananmen, Taizicheng, Wulingyuan town, Jiefangbei, Dayan old town, Qiaotou, Dali
ancient city, Cuihu Park, the TST harbourfront).

| City | Anchor (WGS-84) | Spots at the default | Held to their own radius (their button's, spots.ts — PIN_ANCHORS below may tighten it) |
|---|---|---|---|
${radius.join('\n')}

Where the trip's own words tie a place to a closer verified coordinate than its button's gate uses, the pin is
held to that instead (\`pin-targets.ts\` PIN_ANCHORS) — never looser than the button:

| Place | Anchor | Radius | Why |
|---|---|---:|---|
${anchors.join('\n')}

And where the trip says exactly what a place is and a namesake would pass the kind table, the place is held to
its own kinds (\`pin-targets.ts\` PIN_FITS):

| Place | Its kinds | Why |
|---|---|---|
${ownKinds.join('\n')}

## The audit — every place the coordinate pass decided on
${audit.join('\n')}

## The rejects and why

${rejects.length} of ${Object.keys(PINS).length} places got no pin. Each keeps its button exactly as it was.

${rejectLines.join('\n')}

## The coordinates the trip already stored — measured, not changed

Confirmed = OSM's first answer carries the name and our coordinate sits inside it (its own size, at least 0.5 km;
2 km for a city), or Wikidata's item of that name sits that close. "Read by hand" is a report, not a change: a
city- or area-grade pin, or an entry whose name OSM files elsewhere (map-links.ts already says why for each).

| Id | Place | Ours | OSM's answer | km to OSM | Wikidata | km to WD | Verdict |
|---|---|---|---|---:|---|---:|---|
${checks.join('\n')}

## Categories

${places.length} places and ${moves.length} movements, every one categorised: ${cats.map((c) => `${c} ${count(rows, (r) => r.category === c)}`).join(' · ')}.
Decided by the trip's own words ${count(rows, (r) => r.from === 'trip')} times, by OSM's confirmed tags ${count(rows, (r) => r.from === 'osm')},
by the entity's own kind ${count(rows, (r) => r.from === 'kind')} (\`app/scripts/china/categories.ts\`). Where the trip's words win:

| Place | Category | The trip's words |
|---|---|---|
${overrides.join('\n')}

## Details

${count(rows, (r) => !!r.detail)} one-line details (${count(places, (r) => r.kind === 'spot' && !!r.detail)} spots, ${count(places, (r) => r.kind === 'card' && !!r.detail)} driver cards,
${count(places, (r) => r.kind === 'bed' && !!r.detail)} beds, ${count(places, (r) => r.kind === 'ticket' && !!r.detail)} tickets), each a verbatim stretch of the trip's own text about that place, at most 90
characters, proven at build time (\`app/scripts/china/details.ts\`). ${noDetail.length} places have none because the trip names
them without describing them: ${noDetail.map((r) => cell(r.name)).join(' · ')}.

## The beds

| Bed | Its button (unchanged) | Pin | OSM's address for it | How the pass decided | Detail |
|---|---|---|---|---|---|
${beds.join('\n')}

Three of the five pinned beds are corroborated by the owner's own paperwork as well: OSM's address for each is
the booked door — 高云路188号 is "No. 188 Gaoyun Road", 青年路66号 "No. 66 Qingnian Road", 麼地道69号 "69 Mody
Road" — and Huatian's pin lies 0.35 km from the Tianmen cableway the accommodation document puts it 450 m from.
The pin is still never a button: each bed opens exactly what it opened before.
`;

writeFileSync(out, md.replace(/\n/g, '\r\n'), 'utf8');
console.log(`Wrote ${out}: ${places.length} places, ${Object.keys(PINS).length} decisions, ${Object.keys(COORD_CHECKS).length} stored coordinates`);
