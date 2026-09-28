/* ============================================================
   Bundle gate — `npm run check:bundle` (the last step of `build`).

   The app must stay light enough to load instantly on a phone that has
   been offline for three weeks: every byte of JavaScript is parsed on
   every cold start, precached or not. The budget is 200 KB of GZIPPED
   JavaScript across everything the page itself loads — the app chunk
   plus the lazily imported Capacitor/plugin chunks and workbox-window,
   i.e. every *.js under dist/assets. That is the same set the
   ARCHITECTURE.md budget table has always measured.

   The service worker (dist/sw.js + dist/workbox-*.js) runs in its own
   thread and never on a page's main thread, so it is printed for the
   record and not counted — again as the table always did.

   Gzip at zlib's default level, the level a static host serves at.
   KB here is the DECIMAL kilobyte (1 KB = 1000 bytes) — the unit Vite
   prints and the ARCHITECTURE.md table was written in — so the budget is
   the stricter reading of "200 KB"; the KiB figure is printed beside it.
   Prints the table every time; exits 1 over budget, 2 with no dist/.
   ============================================================ */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200;

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const assets = join(dist, 'assets');
if (!existsSync(assets)) {
  console.error('No dist/assets to measure — run `vite build` first.');
  process.exit(2);
}

const kb = (n) => n / 1000;
const fmt = (n) => kb(n).toFixed(2).padStart(9);
function measure(file) {
  const buf = readFileSync(file);
  return { raw: statSync(file).size, gz: gzipSync(buf).length };
}

const page = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: `assets/${f}`, ...measure(join(assets, f)) }))
  .sort((a, b) => b.gz - a.gz);
const worker = readdirSync(dist)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, ...measure(join(dist, f)) }));
const css = readdirSync(assets)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: `assets/${f}`, ...measure(join(assets, f)) }));
const fonts = readdirSync(assets).filter((f) => f.endsWith('.woff2') || f.endsWith('.woff'));
const fontBytes = fonts.reduce((n, f) => n + statSync(join(assets, f)).size, 0);

const total = page.reduce((a, f) => ({ raw: a.raw + f.raw, gz: a.gz + f.gz }), { raw: 0, gz: 0 });
const line = '─'.repeat(78);
console.log('\nBUNDLE — JavaScript the page loads (gzip, KB)');
console.log(line);
console.log(`${'file'.padEnd(52)}${'raw KB'.padStart(13)}${'gzip KB'.padStart(13)}`);
for (const f of page) console.log(`${f.name.padEnd(52)}${fmt(f.raw).padStart(13)}${fmt(f.gz).padStart(13)}`);
console.log(line);
console.log(`${`TOTAL · ${page.length} files`.padEnd(52)}${fmt(total.raw).padStart(13)}${fmt(total.gz).padStart(13)}`);
console.log(`${'budget'.padEnd(52)}${''.padStart(13)}${`${BUDGET_KB.toFixed(2)}`.padStart(13)}`);
console.log(line);
console.log('not counted — the service worker runs off the main thread:');
for (const f of worker) console.log(`  ${f.name.padEnd(50)}${fmt(f.raw).padStart(13)}${fmt(f.gz).padStart(13)}`);
for (const f of css) console.log(`css ${f.name.padEnd(48)}${fmt(f.raw).padStart(13)}${fmt(f.gz).padStart(13)}`);
console.log(`fonts · ${fonts.length} files${fmt(fontBytes).padStart(40)} KB on disk`);

const over = kb(total.gz) - BUDGET_KB;
if (over > 0) {
  console.error(`\nBundle gate: ${kb(total.gz).toFixed(2)} KB gzipped JS is ${over.toFixed(2)} KB over the ${BUDGET_KB} KB budget.`);
  process.exit(1);
}
console.log(
  `\nBundle gate: ${kb(total.gz).toFixed(2)} KB gzipped JS (${(total.gz / 1024).toFixed(2)} KiB) — ${(-over).toFixed(2)} KB under the ${BUDGET_KB} KB budget.`,
);
