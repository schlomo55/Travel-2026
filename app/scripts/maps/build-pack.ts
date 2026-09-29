/* BUILD THE MAP PACK (Map 5c; its photos since Map 5e) — DEV ONLY. The one
   step in this repo that downloads map data, and it is never part of
   `npm run build`, the tests or the rehearsal: the app itself never goes
   online for maps.

   Run (from app/):  npm run map:pack
                     npm run map:pack -- --date 20260928   (a given Protomaps build)
                     npm run map:pack -- --dry-run         (count, download nothing)
                     npm run map:pack -- --test-only       (re-cut the test pack only)
                     npm run map:pack -- --photos-only     (the tiles as they are: the photos again)

   1. The areas (areas.ts) from the China seed's verified positions → the
      region, one MultiPolygon: app/.cache/maps/region.geojson, and the areas
      with every box's anchors named: app/.cache/maps/areas.geojson.
   2. `pmtiles extract` from the Protomaps daily OpenStreetMap build
      (https://build.protomaps.com/<YYYYMMDD>.pmtiles) with that region and
      --maxzoom=15. go-pmtiles reads the planet by HTTP range requests and
      downloads ONLY the tiles inside the region (tens of MB — never the
      planet). Written beside the pack as a .part and renamed only once
      `pmtiles verify` has passed, so a failed build never leaves half a pack.
   3. The pack's own metadata gains a few `ltd:` keys — what it is, when it
      was cut, from which build, the areas — which the app shows in Settings.
   4. THE TEST PACK — a few hundred KB around Houhai, z11–13, cut from the
      pack just built, no network — committed at scripts/e2e/fixtures/ for the
      rehearsal. Refused over 1 MB. (Not z0–13: one tile per zoom below 11
      covers the whole of north China, and those eleven alone weigh 1.2 MB.)

   5. THE PHOTOS (Map 5e) — the places' photos, their About and links ride IN
      the pack, so the owner still imports one file: the archive, then every
      photo's three images, the index keyed by place id, and a trailer
      (photos/bundle.ts; the format is lib/logic/placephotos.ts). The archive's
      metadata declares them first (`ltd:photos`), is verified by `pmtiles
      verify` as an archive, and only then are the photos appended — then the
      whole file is read back by the app's own reader (lib/map/pack.ts) before
      it is renamed into place: china-2026-map-photos.pmtiles. What goes in is
      photos/manifest.json, decided by LOOKING at every candidate
      (photos/choices.ts, photos/manifest.ts). The test pack gets a tiny set:
      the few places round Houhai the rehearsal walks, small images.

   The pack itself (app/.cache/maps/china-2026-map-photos.pmtiles; the tiles
   alone beside it, china-2026-map.pmtiles) is git-ignored (app/.cache/) and
   never goes into dist/ (check-bundle.mjs refuses one): the owner imports it
   once, on the phone, from Drive or Downloads.

   THE TOOL: go-pmtiles (BSD-3-Clause, github.com/protomaps/go-pmtiles). The
   script looks for it in $PMTILES, then app/.cache/maps/tools/pmtiles(.exe),
   then on the PATH, and says where to put it if it finds none. */
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, openAsBlob, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppBackup } from '../../src/lib/model/types';
import { describePack, readPhotos } from '../../src/lib/map/pack';
import { photoCount } from '../../src/lib/logic/placephotos';
import { areasOf, boxKm2, LINK_KM, MARGIN_KM, regionOf, tripOf } from './areas';
import { photoAppendix, readManifest } from './photos/pack-photos';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const repo = join(app, '..');
const OUT = join(app, '.cache', 'maps');
const PACK = join(OUT, 'china-2026-map.pmtiles');
/** the pack the owner imports: the tiles and the places' photos (Map 5e) */
const BUNDLE = join(OUT, 'china-2026-map-photos.pmtiles');
const TEST_PACK = join(app, 'scripts', 'e2e', 'fixtures', 'houhai-test.pmtiles');
/** the same test tiles with the tiny photo set (Map 5e) — the plain one stays, as a pack from before */
const TEST_PHOTO_PACK = join(app, 'scripts', 'e2e', 'fixtures', 'houhai-test-photos.pmtiles');
/* the rehearsal's tiny photo set (Map 5e): the places it walks round Houhai —
   the lakes (the spot and the card: one photo, two places), the Drum and Bell
   Towers (the photo pins at close zoom, the first cards of the rail), Beihai
   Park (a place card with its About); and two the pass found no free photo
   of, the Massage Hospital (A2) and the Huguosi hospital — as the real pack
   says them. A place with a photo in the real pack but not in this set is
   left out of the test index (never "no free photo" when there is one). */
const TEST_PHOTOS = ['cn26-spot-beijing-shichahai', 'cn26-place-05', 'cn26-spot-beijing-drum-tower', 'cn26-spot-beijing-bell-tower', 'cn26-spot-beijing-beihai', 'cn26-place-07', 'cn26-place-27'];
/* Houhai and the lakes, the Massage Hospital (1.9 km WSW), Huguosi, Beihai,
   the Drum Tower, Nanluoguxiang and the Lama Temple */
const TEST_BBOX = '116.345,39.915,116.425,39.962';
const TEST_MINZOOM = 11;
const TEST_MAXZOOM = 13;
const TEST_LIMIT = 1_000_000;

const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (k: string): boolean => process.argv.includes(k);
const MB = (b: number): string => (b / 1e6).toFixed(2);

function tool(): string {
  const exe = process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles';
  const candidates = [process.env.PMTILES, join(OUT, 'tools', exe)].filter((x): x is string => !!x);
  for (const c of candidates) if (existsSync(c)) return c;
  try {
    execFileSync(exe, ['version'], { stdio: 'ignore' });
    return exe;
  } catch {
    console.error(`go-pmtiles not found. Put the release binary at ${join(OUT, 'tools', exe)}`);
    console.error('(https://github.com/protomaps/go-pmtiles/releases — 1.31.2 was used), or set PMTILES.');
    process.exit(2);
  }
}
const PM = tool();
const pm = (args: string[], quiet = false): string =>
  execFileSync(PM, args, { encoding: 'utf8', stdio: ['ignore', quiet ? 'pipe' : 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });

/** The header's counts, as `pmtiles show` prints them. */
function show(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of pm(['show', file], true).split('\n')) {
    const m = /^([a-z][a-z ]+?):\s+(.*)$/.exec(line.trim());
    if (m && m[1] && m[2] !== undefined) out[m[1]] = m[2];
  }
  return out;
}

/** Add our keys to an archive's JSON metadata, in place. */
function stamp(file: string, extra: Record<string, unknown>): Record<string, unknown> {
  const meta = JSON.parse(pm(['show', file, '--metadata'], true)) as Record<string, unknown>;
  const next = { ...meta, ...extra };
  const tmp = join(OUT, 'metadata.json');
  writeFileSync(tmp, JSON.stringify(next));
  pm(['edit', file, `--metadata=${tmp}`], true);
  rmSync(tmp, { force: true });
  return next;
}

async function latestBuild(): Promise<string> {
  const res = await fetch('https://build-metadata.protomaps.dev/builds.json');
  if (!res.ok) throw new Error(`builds.json answered ${res.status}`);
  const builds = (await res.json()) as { key: string; version?: string; size?: number }[];
  const last = builds.at(-1);
  if (!last) throw new Error('builds.json lists no build');
  console.log(`latest Protomaps build: ${last.key} (basemap ${last.version ?? '?'}, planet ${((last.size ?? 0) / 1e9).toFixed(1)} GB — only the region is read)`);
  return last.key.replace(/\.pmtiles$/, '');
}

/** The pack with its photos: the archive copied, its metadata declaring them,
    verified as an archive, the photos appended, and the whole read back by
    the app's own reader before it is renamed into place. */
async function withPhotos(tiles: string, out: string, ids: string[], small: boolean): Promise<{ bytes: number; photos: number; imageBytes: number }> {
  const { appendix, count, imageBytes } = await photoAppendix(readManifest(), ids, small);
  const part = `${out}.part`;
  rmSync(part, { force: true });
  copyFileSync(tiles, part);
  stamp(part, { 'ltd:photos': { v: 1, count, bytes: appendix.length } });
  pm(['verify', part], true);
  appendFileSync(part, appendix);
  const blob = await openAsBlob(part);
  const info = await describePack(new File([blob], 'check.pmtiles'));
  const index = await readPhotos(blob, info, info.photos);
  if (!index || photoCount(index) !== count) throw new Error(`${out}: the app's reader finds ${index ? photoCount(index) : 0} photos, not ${count}`);
  rmSync(out, { force: true });
  renameSync(part, out);
  return { bytes: statSync(out).size, photos: count, imageBytes };
}

function testPack(): void {
  if (!existsSync(PACK)) {
    console.error(`No pack at ${PACK} to cut the test pack from — run \`npm run map:pack\` first.`);
    process.exit(2);
  }
  mkdirSync(dirname(TEST_PACK), { recursive: true });
  let zoom = TEST_MAXZOOM;
  for (;;) {
    rmSync(TEST_PACK, { force: true });
    pm(['extract', PACK, TEST_PACK, `--bbox=${TEST_BBOX}`, `--minzoom=${TEST_MINZOOM}`, `--maxzoom=${zoom}`, '--quiet'], true);
    const size = statSync(TEST_PACK).size;
    if (size <= TEST_LIMIT || zoom <= TEST_MINZOOM + 1) break;
    console.log(`  test pack at z${zoom} is ${MB(size)} MB — over 1 MB, one zoom less`);
    zoom--;
  }
  pm(['verify', TEST_PACK], true);
  stamp(TEST_PACK, { 'ltd:pack': 'houhai-test', 'ltd:test': true, 'ltd:bbox': TEST_BBOX, 'ltd:minzoom': TEST_MINZOOM, 'ltd:maxzoom': zoom });
  const size = statSync(TEST_PACK).size;
  if (size > TEST_LIMIT) {
    console.error(`The test pack is ${MB(size)} MB — the limit is 1 MB.`);
    process.exit(1);
  }
  const h = show(TEST_PACK);
  console.log(`test pack: ${TEST_PACK.replace(repo, '').replace(/\\/g, '/')} — ${size} bytes (${MB(size)} MB), z${TEST_MINZOOM}–${zoom}, ${h['tile entries count'] ?? '?'} tiles, bbox ${TEST_BBOX}`);
}

/** The test pack with the tiny photo set: the committed test tiles, and the photos after them. */
async function testPhotos(): Promise<void> {
  const r = await withPhotos(TEST_PACK, TEST_PHOTO_PACK, TEST_PHOTOS, true);
  if (r.bytes > TEST_LIMIT) {
    console.error(`The test pack with its photos is ${MB(r.bytes)} MB — the limit is 1 MB.`);
    process.exit(1);
  }
  console.log(`test pack with photos: ${TEST_PHOTO_PACK.replace(repo, '').replace(/\\/g, '/')} — ${r.bytes} bytes (${MB(r.bytes)} MB), ${r.photos} photos (${r.imageBytes} bytes of images)`);
}

/** The owner's pack: the tiles and every place's photo. */
async function photosPack(): Promise<void> {
  const r = await withPhotos(PACK, BUNDLE, Object.keys(readManifest().places), false);
  console.log(`map pack with photos: ${BUNDLE} — ${r.bytes} bytes (${MB(r.bytes)} MB), ${r.photos} photos, ${MB(r.imageBytes)} MB of images (the tiles alone: ${MB(statSync(PACK).size)} MB)`);
  const report = JSON.parse(readFileSync(join(OUT, 'pack-report.json'), 'utf8')) as Record<string, unknown>;
  writeFileSync(join(OUT, 'pack-report.json'), JSON.stringify({ ...report, bundle: BUNDLE, bundleBytes: r.bytes, photos: r.photos, photoImageBytes: r.imageBytes }, null, 1));
}

/* ---------- 1 · the areas ---------- */
mkdirSync(OUT, { recursive: true });
if (flag('--test-only')) {
  testPack();
  await testPhotos();
  process.exit(0);
}
if (flag('--photos-only')) {
  if (!existsSync(PACK)) {
    console.error(`No pack at ${PACK} — run \`npm run map:pack\` first.`);
    process.exit(2);
  }
  await photosPack();
  await testPhotos();
  process.exit(0);
}
const seed = JSON.parse(readFileSync(join(repo, 'seed', 'china-2026.trip.json'), 'utf8')) as AppBackup;
const { areas, boxes, anchors, dropped } = areasOf(tripOf(seed));
const region = regionOf(boxes);
writeFileSync(join(OUT, 'region.geojson'), JSON.stringify(region));
writeFileSync(
  join(OUT, 'areas.geojson'),
  JSON.stringify(
    {
      type: 'FeatureCollection',
      features: areas.map((a) => ({
        type: 'Feature',
        properties: {
          stop: a.stopId,
          name: a.name,
          km2: a.km2,
          boxes: a.boxes.map((b) => ({ bbox: [b.w, b.s, b.e, b.n], km2: Math.round(boxKm2(b)), anchors: b.anchors.map((x) => `${x.label} [${x.src}]`) })),
        },
        geometry: regionOf(a.boxes),
      })),
    },
    null,
    1,
  ),
);
const total = areas.reduce((n, a) => n + a.km2, 0);
console.log(`areas (link ${LINK_KM} km, margin ${MARGIN_KM} km): ${anchors.length} anchors → ${boxes.length} boxes, ${total} km²`);
for (const a of areas) console.log(`  ${a.name.padEnd(22)} ${String(a.km2).padStart(5)} km²  ${a.boxes.length} box${a.boxes.length === 1 ? '' : 'es'}`);
const coverage = anchors.filter((x) => x.src === 'coverage');
if (coverage.length) console.log(`  coverage-only (no verified position — sizes a box, never a pin): ${coverage.map((x) => x.label).join(' · ')}`);
if (dropped.length) console.log(`  not in the pack (farther than any stop): ${dropped.map((d) => d.label).join(' · ')}`);

/* ---------- 2 · the extract ---------- */
const date = arg('--date') ?? (await latestBuild());
const maxzoom = arg('--maxzoom') ?? '15';
const part = `${PACK}.part`;
rmSync(part, { force: true });
const args = ['extract', `https://build.protomaps.com/${date}.pmtiles`, part, `--region=${join(OUT, 'region.geojson')}`, `--maxzoom=${maxzoom}`, '--download-threads=4'];
if (flag('--dry-run')) args.push('--dry-run');
console.log(`pmtiles ${args.join(' ')}`);
execFileSync(PM, args, { stdio: ['ignore', 'inherit', 'inherit'] });
if (flag('--dry-run')) process.exit(0);
pm(['verify', part], true);
renameSync(part, PACK);

/* ---------- 3 · our keys ---------- */
const meta = stamp(PACK, {
  'ltd:pack': 'china-2026-map',
  'ltd:trip': 'China 2026',
  'ltd:built': new Date().toISOString().slice(0, 10),
  'ltd:source': `Protomaps daily build ${date} · OpenStreetMap`,
  'ltd:areas': areas.map((a) => a.name),
  'ltd:maxzoom': Number(maxzoom),
});
const h = show(PACK);
const bytes = statSync(PACK).size;
console.log(`map pack: ${PACK} — ${bytes} bytes (${MB(bytes)} MB), ${h['tile entries count'] ?? '?'} tiles, z${h['min zoom'] ?? '0'}–${h['max zoom'] ?? maxzoom}`);
console.log(`  OpenStreetMap as of ${String(meta['planetiler:osm:osmosisreplicationtime'] ?? '?')}`);
writeFileSync(
  join(OUT, 'pack-report.json'),
  JSON.stringify({ pack: PACK, bytes, tiles: h['tile entries count'], build: date, maxzoom: Number(maxzoom), km2: total, boxes: boxes.length, areas: areas.map((a) => ({ name: a.name, km2: a.km2, boxes: a.boxes.length })) }, null, 1),
);

/* ---------- 4 · the test pack ---------- */
testPack();

/* ---------- 5 · the photos (Map 5e) ---------- */
await photosPack();
await testPhotos();
