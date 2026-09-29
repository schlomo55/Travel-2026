/* ============================================================
   Bundle gate — `npm run check:bundle` (the last step of `build`).

   THREE NUMBERS, THREE BUDGETS (two since Horizon Run 3c, 2026-09-28; the
   third since Map 5c, 2026-09-29).

   1. INITIAL LOAD ≤ 200 KB gzipped — the JavaScript a cold start has to
      load and parse before the first screen can draw: the ENTRY chunk plus
      every chunk it imports STATICALLY, transitively (exactly the set the
      page modulepreloads). This is the number the phone feels: after three
      weeks offline, every cold start pays it again, precached or not.
   2. ALL APP JS ≤ 260 KB gzipped — every *.js under dist/assets but the map
      engine's: the entry, its static imports AND every lazily imported chunk
      (the screens opened later — Settings, Backup, the trip wizard, the import
      sheet, the Map tab's own screen — the Capacitor plugin chunks and
      workbox-window). A lazy chunk is still shipped, precached and parsed the
      day it opens, so bloat must not be able to hide in one.
   3. THE MAP ENGINE ≤ 470 KB gzipped, its worker included (Map 5c) —
      maplibre-gl, pmtiles, the basemap's layers and the glue that drives them:
      everything `src/lib/map/street/` starts and nothing else imports, plus
      the worker file that chunk starts. It loads only when the Map tab first
      opens, and only there, so it has a budget of its own rather than a place
      in the other two (the spike measured 305 + 143 KB). The Map tab's own
      screen is NOT the engine: it counts in the app's total, like any screen.

   Which chunk is which is never guessed from file names: it is read from
   Vite's own manifest, dist/.vite/manifest.json (`build.manifest: true` in
   vite.config.ts). The chunk marked `isEntry` is the start; its `imports`
   edges are static (counted in the initial load); `dynamicImports` edges
   are lazy. The engine is the dynamic entry whose source lies under
   src/lib/map/street/, with every chunk only it reaches; its worker is the
   *.js asset the manifest does not name and an engine chunk refers to by
   file name. A *.js file the manifest does not name and no engine chunk
   refers to is still counted in the app's total, and printed as such.

   THE MAP PACK NEVER SHIPS. The owner's street data is imported on the
   phone (lib/map/pack.ts); a .pmtiles file in dist/ — or in the Android
   copy of it — would put tens of MB into every install and every deploy
   (Cloudflare Pages refuses a file over 25 MiB), so one fails the gate.
   NOR DO THE PLACES' PHOTOS (Map 5e): they travel inside the pack, so a
   pack found by its bytes whatever its name, a pack's photo trailer, or any
   WebP (the app ships none) fails it too.

   The service worker (dist/sw.js + dist/workbox-*.js) runs in its own
   thread and never on a page's main thread, so it is printed for the record
   and counted in no budget — as the table always did.

   Gzip at zlib's default level, the level a static host serves at. KB here
   is the DECIMAL kilobyte (1 KB = 1000 bytes) — the unit Vite prints and the
   ARCHITECTURE.md tables are written in — so each budget is the stricter
   reading of its number; the KiB figure is printed beside it.
   Prints every table every time; exits 1 over any budget or with a map
   pack in dist/, 2 with no dist/ or no manifest to read.
   ============================================================ */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const INITIAL_KB = 200;
/* 260 → 275 on 2026-09-29, the owner's decision: Map 5e's photos and the
   Reminders run together came to 266.5. The rise is all LAZY code (Settings,
   the Map, a reminder's sheet); the initial load keeps its 200. */
const TOTAL_KB = 275;
const ENGINE_KB = 470;
const ENGINE_DIR = 'src/lib/map/street/';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const assets = join(dist, 'assets');
const manifestPath = join(dist, '.vite', 'manifest.json');
if (!existsSync(assets)) {
  console.error('No dist/assets to measure — run `vite build` first.');
  process.exit(2);
}
if (!existsSync(manifestPath)) {
  console.error('No dist/.vite/manifest.json — vite.config.ts must keep `build.manifest: true`,');
  console.error('or the gate cannot tell the start-up JavaScript from the lazy chunks.');
  process.exit(2);
}

/** @type {Record<string, { file: string, src?: string, name?: string, isEntry?: boolean, isDynamicEntry?: boolean, imports?: string[], dynamicImports?: string[] }>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entryKeys = Object.keys(manifest).filter((k) => manifest[k]?.isEntry);
if (entryKeys.length === 0) {
  console.error('The manifest names no entry chunk — nothing to measure the start-up from.');
  process.exit(2);
}

/** Every chunk reachable from `start` through STATIC imports. */
function closure(start) {
  const seen = new Set();
  const queue = [...start];
  while (queue.length) {
    const k = queue.shift();
    if (seen.has(k) || !manifest[k]) continue;
    seen.add(k);
    for (const i of manifest[k].imports ?? []) queue.push(i);
  }
  return seen;
}

/* the start-up set: the entry chunk(s) and every chunk reachable through
   STATIC imports — dynamic imports are where a lazy screen begins */
const initialKeys = closure(entryKeys);
const byFile = new Map(Object.entries(manifest).map(([k, c]) => [c.file, { key: k, ...c }]));
const initialFiles = new Set([...initialKeys].map((k) => manifest[k].file));

/* the map engine: what src/lib/map/street/ starts, less what anything else
   reaches as well (a module the Map screen shares with it is the screen's) */
const dynamicKeys = Object.keys(manifest).filter((k) => manifest[k]?.isDynamicEntry);
const engineStarts = dynamicKeys.filter((k) => (manifest[k].src ?? k).startsWith(ENGINE_DIR));
const others = closure([...entryKeys, ...dynamicKeys.filter((k) => !engineStarts.includes(k))]);
const engineKeys = new Set([...closure(engineStarts)].filter((k) => !others.has(k)));
const engineFiles = new Set([...engineKeys].map((k) => manifest[k].file));
/* its worker: a *.js asset the manifest does not name, referred to by an engine chunk */
const unnamed = readdirSync(assets).filter((f) => f.endsWith('.js') && !byFile.has(`assets/${f}`));
const engineText = [...engineFiles].map((f) => readFileSync(join(dist, f), 'utf8')).join('\n');
const workerFiles = new Set(unnamed.filter((f) => engineText.includes(f)).map((f) => `assets/${f}`));

const kb = (n) => n / 1000;
const fmt = (n) => kb(n).toFixed(2).padStart(9);
function measure(file) {
  const buf = readFileSync(file);
  return { raw: statSync(file).size, gz: gzipSync(buf).length };
}
/** What a chunk is, in a few words: the module it starts from, as the
    manifest names it — "lazy · routes/Settings", "lazy · @capacitor/share/web". */
function what(name) {
  if (workerFiles.has(name)) return 'worker · the map engine';
  const c = byFile.get(name);
  if (!c) return 'not in the manifest';
  if (c.isEntry) return 'entry';
  const src = (c.src ?? c.key)
    .replace(/^_/, '')
    .replace(/^src\//, '')
    .replace(/^node_modules\/((?:@[^/]+\/)?[^/]+)\/.*?([^/]+?)(?:\.prod\.es5)?\.m?js$/, (_, pkg, file) => (pkg.endsWith(file) ? pkg : `${pkg}/${file}`))
    .replace(/\.(?:svelte|ts|js)$/, '')
    /* a chunk Rollup named for what it shares ("_Map-Ab12Cd34.js"): its name, not its hash */
    .replace(/^([A-Za-z][\w]*)-[\w-]{8}$/, '$1');
  return `${c.isDynamicEntry ? 'lazy' : 'shared'} · ${src}`;
}

const all = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => {
    const name = `assets/${f}`;
    return { name, what: what(name), initial: initialFiles.has(name), engine: engineFiles.has(name) || workerFiles.has(name), ...measure(join(assets, f)) };
  })
  .sort((a, b) => Number(b.initial) - Number(a.initial) || b.gz - a.gz);
const chunks = all.filter((c) => !c.engine);
const engine = all.filter((c) => c.engine);
const worker = readdirSync(dist)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, ...measure(join(dist, f)) }));
const css = readdirSync(assets)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: `assets/${f}`, ...measure(join(assets, f)) }));
const fonts = readdirSync(assets).filter((f) => f.endsWith('.woff2') || f.endsWith('.woff'));
const fontBytes = fonts.reduce((n, f) => n + statSync(join(assets, f)).size, 0);

const sum = (list) => list.reduce((a, f) => ({ raw: a.raw + f.raw, gz: a.gz + f.gz }), { raw: 0, gz: 0 });
const initial = chunks.filter((c) => c.initial);
const initialSum = sum(initial);
const totalSum = sum(chunks);
const engineSum = sum(engine);

const line = '─'.repeat(108);
const row = (name, note, raw, gz) => `${name.padEnd(44)}${note.slice(0, 39).padEnd(40)}${raw.padStart(12)}${gz.padStart(12)}`;
const head = () => row('file', 'what', 'raw KB', 'gzip KB');

console.log('\nBUNDLE 1 of 3 — INITIAL LOAD: the entry chunk + everything it imports statically (gzip, KB)');
console.log(line);
console.log(head());
for (const f of initial) console.log(row(f.name, f.what, fmt(f.raw), fmt(f.gz)));
console.log(line);
console.log(row(`INITIAL · ${initial.length} ${initial.length === 1 ? 'file' : 'files'}`, '', fmt(initialSum.raw), fmt(initialSum.gz)));
console.log(row('budget', '', '', INITIAL_KB.toFixed(2)));

console.log('\nBUNDLE 2 of 3 — ALL APP JS: every chunk under dist/assets but the map engine, lazy ones included (gzip, KB)');
console.log(line);
console.log(head());
for (const f of chunks) console.log(row(f.name, f.initial ? `start · ${f.what}` : f.what, fmt(f.raw), fmt(f.gz)));
console.log(line);
console.log(row(`TOTAL · ${chunks.length} files`, '', fmt(totalSum.raw), fmt(totalSum.gz)));
console.log(row('budget', '', '', TOTAL_KB.toFixed(2)));

console.log('\nBUNDLE 3 of 3 — THE MAP ENGINE: what src/lib/map/street/ starts, and its worker (gzip, KB)');
console.log(line);
console.log(head());
for (const f of engine) console.log(row(f.name, f.what, fmt(f.raw), fmt(f.gz)));
console.log(line);
console.log(row(`ENGINE · ${engine.length} ${engine.length === 1 ? 'file' : 'files'}`, '', fmt(engineSum.raw), fmt(engineSum.gz)));
console.log(row('budget', '', '', ENGINE_KB.toFixed(2)));

console.log(line);
console.log('not counted — the service worker runs off the main thread:');
for (const f of worker) console.log(row(`  ${f.name}`, '', fmt(f.raw), fmt(f.gz)));
for (const f of css) console.log(row(`css ${f.name}`, '', fmt(f.raw), fmt(f.gz)));
console.log(`fonts · ${fonts.length} files${fmt(fontBytes).padStart(40)} KB on disk`);

/* no map pack in what ships (dist/, and the Android copy of it) */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
/* …by its name, and by its bytes whatever it is called (Map 5e): a PMTiles
   archive begins "PMTiles"; a pack that carries the places' photos ends in
   the "LTDPHOTO" trailer; and a photo is WebP ("RIFF"…"WEBP") — the app
   ships none, so a WebP in the build is a photo that escaped the pack. */
function isPack(f) {
  if (/\.pmtiles(\.part|\.tiles)?$/i.test(f)) return 'a map pack';
  const size = statSync(f).size;
  if (size < 12) return null;
  const head = readFileSync(f).subarray(0, 12);
  if (head.subarray(0, 7).toString('latin1') === 'PMTiles') return 'a map pack (its bytes)';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'a photo (WebP)';
  if (/\.webp$/i.test(f)) return 'a photo (WebP)';
  if (size >= 32 && readFileSync(f).subarray(size - 32, size - 24).toString('latin1') === 'LTDPHOTO') return 'a map pack with photos (its trailer)';
  return null;
}
const packs = [...walk(dist), ...walk(join(here, '..', 'android', 'app', 'src', 'main', 'assets'))].map((f) => ({ f, what: isPack(f) })).filter((x) => x.what).map((x) => `${x.f} (${x.what})`);
console.log(packs.length ? `\nMAP PACK OR PHOTOS IN THE BUILD: ${packs.join(', ')}` : '\n✓ no map pack and no photo in dist/ (street data and the places’ photos are imported on the phone, never shipped)');

const overInitial = kb(initialSum.gz) - INITIAL_KB;
const overTotal = kb(totalSum.gz) - TOTAL_KB;
const overEngine = kb(engineSum.gz) - ENGINE_KB;
const say = (label, gz, over, budget) =>
  over > 0
    ? `${label}: ${kb(gz).toFixed(2)} KB gzipped JS is ${over.toFixed(2)} KB OVER the ${budget} KB budget.`
    : `${label}: ${kb(gz).toFixed(2)} KB gzipped JS (${(gz / 1024).toFixed(2)} KiB) — ${(-over).toFixed(2)} KB under the ${budget} KB budget.`;
const verdicts = [
  say('Initial load', initialSum.gz, overInitial, INITIAL_KB),
  say('All app JS', totalSum.gz, overTotal, TOTAL_KB),
  engine.length ? say('Map engine', engineSum.gz, overEngine, ENGINE_KB) : 'Map engine: no chunk under src/lib/map/street/ in this build.',
];
if (overInitial > 0 || overTotal > 0 || overEngine > 0 || packs.length) {
  console.error(`\nBundle gate FAILED.\n  ${verdicts.join('\n  ')}${packs.length ? '\n  A map pack or a photo is in the build — they must stay on the phone.' : ''}`);
  process.exit(1);
}
console.log(`\nBundle gate:\n  ${verdicts.join('\n  ')}`);
