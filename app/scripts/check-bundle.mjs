/* ============================================================
   Bundle gate — `npm run check:bundle` (the last step of `build`).

   TWO NUMBERS, TWO BUDGETS (Horizon Run 3c, 2026-09-28).

   1. INITIAL LOAD ≤ 200 KB gzipped — the JavaScript a cold start has to
      load and parse before the first screen can draw: the ENTRY chunk plus
      every chunk it imports STATICALLY, transitively (exactly the set the
      page modulepreloads). This is the number the phone feels: after three
      weeks offline, every cold start pays it again, precached or not.
   2. ALL APP JS ≤ 260 KB gzipped — every *.js under dist/assets: the entry,
      its static imports AND every lazily imported chunk (the screens opened
      later — Settings, Backup, the trip wizard, the import sheet — the
      Capacitor plugin chunks and workbox-window). A lazy chunk is still
      shipped, precached and parsed the day it opens, so bloat must not be
      able to hide in one.

   Which chunk is which is never guessed from file names: it is read from
   Vite's own manifest, dist/.vite/manifest.json (`build.manifest: true` in
   vite.config.ts). The chunk marked `isEntry` is the start; its `imports`
   edges are static (counted in the initial load); `dynamicImports` edges
   are lazy (counted in the total only). A *.js file the manifest does not
   name is still counted in the total, and printed as such.

   Until Run 3c the gate was one number — every JS file against 200 KB — so
   a screen opened twice a trip weighed on start-up exactly like Now. The
   200 KB promise now applies to what actually starts the app; the total
   has its own ceiling. (Run 5's map engine will get a budget of its own.)

   The service worker (dist/sw.js + dist/workbox-*.js) runs in its own
   thread and never on a page's main thread, so it is printed for the record
   and counted in neither budget — as the table always did.

   Gzip at zlib's default level, the level a static host serves at. KB here
   is the DECIMAL kilobyte (1 KB = 1000 bytes) — the unit Vite prints and the
   ARCHITECTURE.md tables are written in — so each budget is the stricter
   reading of its number; the KiB figure is printed beside it.
   Prints both tables every time; exits 1 over either budget, 2 with no
   dist/ or no manifest to read.
   ============================================================ */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const INITIAL_KB = 200;
const TOTAL_KB = 260;

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

/* the start-up set: the entry chunk(s) and every chunk reachable through
   STATIC imports — dynamic imports are where a lazy screen begins */
const initialKeys = new Set();
const queue = [...entryKeys];
while (queue.length) {
  const k = queue.shift();
  if (initialKeys.has(k) || !manifest[k]) continue;
  initialKeys.add(k);
  for (const i of manifest[k].imports ?? []) queue.push(i);
}
const byFile = new Map(Object.entries(manifest).map(([k, c]) => [c.file, { key: k, ...c }]));
const initialFiles = new Set([...initialKeys].map((k) => manifest[k].file));

const kb = (n) => n / 1000;
const fmt = (n) => kb(n).toFixed(2).padStart(9);
function measure(file) {
  const buf = readFileSync(file);
  return { raw: statSync(file).size, gz: gzipSync(buf).length };
}
/** What a chunk is, in a few words: the module it starts from, as the
    manifest names it — "lazy · routes/Settings", "lazy · @capacitor/share/web". */
function what(name) {
  const c = byFile.get(name);
  if (!c) return 'not in the manifest';
  if (c.isEntry) return 'entry';
  const src = (c.src ?? c.key)
    .replace(/^_/, '')
    .replace(/^src\//, '')
    .replace(/^node_modules\/((?:@[^/]+\/)?[^/]+)\/.*?([^/]+?)(?:\.prod\.es5)?\.m?js$/, (_, pkg, file) => (pkg.endsWith(file) ? pkg : `${pkg}/${file}`))
    .replace(/\.(?:svelte|ts|js)$/, '');
  return `${c.isDynamicEntry ? 'lazy' : 'shared'} · ${src}`;
}

const chunks = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => {
    const name = `assets/${f}`;
    return { name, what: what(name), initial: initialFiles.has(name), ...measure(join(assets, f)) };
  })
  .sort((a, b) => Number(b.initial) - Number(a.initial) || b.gz - a.gz);
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

const line = '─'.repeat(108);
const row = (name, note, raw, gz) => `${name.padEnd(44)}${note.slice(0, 39).padEnd(40)}${raw.padStart(12)}${gz.padStart(12)}`;
const head = () => row('file', 'what', 'raw KB', 'gzip KB');

console.log('\nBUNDLE 1 of 2 — INITIAL LOAD: the entry chunk + everything it imports statically (gzip, KB)');
console.log(line);
console.log(head());
for (const f of initial) console.log(row(f.name, f.what, fmt(f.raw), fmt(f.gz)));
console.log(line);
console.log(row(`INITIAL · ${initial.length} ${initial.length === 1 ? 'file' : 'files'}`, '', fmt(initialSum.raw), fmt(initialSum.gz)));
console.log(row('budget', '', '', INITIAL_KB.toFixed(2)));

console.log('\nBUNDLE 2 of 2 — ALL APP JS: every chunk under dist/assets, lazy ones included (gzip, KB)');
console.log(line);
console.log(head());
for (const f of chunks) console.log(row(f.name, f.initial ? `start · ${f.what}` : f.what, fmt(f.raw), fmt(f.gz)));
console.log(line);
console.log(row(`TOTAL · ${chunks.length} files`, '', fmt(totalSum.raw), fmt(totalSum.gz)));
console.log(row('budget', '', '', TOTAL_KB.toFixed(2)));

console.log(line);
console.log('not counted — the service worker runs off the main thread:');
for (const f of worker) console.log(row(`  ${f.name}`, '', fmt(f.raw), fmt(f.gz)));
for (const f of css) console.log(row(`css ${f.name}`, '', fmt(f.raw), fmt(f.gz)));
console.log(`fonts · ${fonts.length} files${fmt(fontBytes).padStart(40)} KB on disk`);

const overInitial = kb(initialSum.gz) - INITIAL_KB;
const overTotal = kb(totalSum.gz) - TOTAL_KB;
const say = (label, gz, over, budget) =>
  over > 0
    ? `${label}: ${kb(gz).toFixed(2)} KB gzipped JS is ${over.toFixed(2)} KB OVER the ${budget} KB budget.`
    : `${label}: ${kb(gz).toFixed(2)} KB gzipped JS (${(gz / 1024).toFixed(2)} KiB) — ${(-over).toFixed(2)} KB under the ${budget} KB budget.`;
const verdicts = [say('Initial load', initialSum.gz, overInitial, INITIAL_KB), say('All app JS', totalSum.gz, overTotal, TOTAL_KB)];
if (overInitial > 0 || overTotal > 0) {
  console.error(`\nBundle gate FAILED.\n  ${verdicts.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nBundle gate:\n  ${verdicts.join('\n  ')}`);
