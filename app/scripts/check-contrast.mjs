/* ============================================================
   Lantern contrast gate — `npm run check:contrast`.

   Reads the real token values out of src/app.css (so the table in
   docs/design/LANTERN.md can never quietly drift away from the CSS),
   then checks every foreground/background pair the app actually
   renders: 4.5:1 for body text, 3:1 for large text and for the
   boundaries of interactive controls.

   Tokens marked DECORATIVE are reported but not gated — they are
   never allowed to carry text (see docs/design/LANTERN.md §Do/Don't).

   Exit 1 on any failure. Pass --table to print the markdown table.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, '..', 'src', 'app.css');
const css = readFileSync(cssPath, 'utf8');

/* ---------- color math (WCAG 2.1) ---------- */
const parseHex = (h) => {
  const s = h.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`not a 6-digit hex: ${h}`);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const chan = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (rgb) => 0.2126 * chan(rgb[0]) + 0.7152 * chan(rgb[1]) + 0.0722 * chan(rgb[2]);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (src, alpha, bg) => src.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const hsl = (h, s, l) => {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor(h / 60) % 6];
  return t.map((v) => Math.round((v + m) * 255));
};

/* ---------- read the tokens out of app.css ---------- */
const NEEDED = [
  'paper',
  'paper-2',
  'card',
  'card-2',
  'line',
  'line-2',
  'ink',
  'ink-2',
  'faint',
  'deco',
  'gold',
  'gold-light',
  'gold-deep',
  'gold-dim',
  'neon',
  'neon-track',
  'on-neon',
  'on-accent',
  'accent-soft',
  'ok',
  'warn',
  'crit',
  'cream',
  'cream-ink',
  'leather',
  'leather-edge',
  'on-photo',
];
const T = {};
const missing = [];
for (const name of NEEDED) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!m) missing.push(name);
  else T[name] = parseHex(m[1]);
}
if (missing.length) {
  console.error('app.css is missing plain-hex values for:', missing.join(', '));
  process.exit(1);
}

/* derived backgrounds */
T['paper-lit'] = over(T.gold, 0.06, T.paper); // the lantern wash at its peak
T['ok-bg@card'] = over(T.ok, 0.14, T.card);
T['warn-bg@card'] = over(T.warn, 0.14, T.card);
T['crit-bg@card'] = over(T.crit, 0.14, T.card);
T['ok-bg@paper'] = over(T.ok, 0.14, T.paper);
T['warn-bg@paper'] = over(T.warn, 0.14, T.paper);
T['crit-bg@paper'] = over(T.crit, 0.14, T.paper);
T['scrim-worst'] = over(T.paper, 0.8, [255, 255, 255]); // white photo under the 80% scrim

/* ---------- the pairs the app actually renders ---------- */
const BODY = 4.5;
const LARGE = 3;
const DECO = 0; // reported, never gated — decorative tokens carry no text

const pairs = [
  ['ink', 'paper', 'body text on the screen', BODY],
  ['ink', 'paper-lit', 'body text under the lantern wash', BODY],
  ['ink-2', 'paper', 'secondary text (.muted)', BODY],
  ['ink-2', 'paper-lit', 'secondary text under the wash', BODY],
  ['faint', 'paper', 'tertiary text (.small, .foot, .pagesub)', BODY],
  ['faint', 'paper-lit', 'tertiary text under the wash', BODY],
  ['gold', 'paper', 'gold headings, active nav label + glyph', BODY],
  ['gold-light', 'paper', 'links, gold text emphasis', BODY],
  ['gold-deep', 'paper', 'gold at rest (secondary gold text)', BODY],
  ['neon', 'paper', 'progress % / completion text', BODY],
  ['ok', 'paper', 'ok status text', BODY],
  ['warn', 'paper', 'warn status text', BODY],
  ['crit', 'paper', 'critical status text', BODY],

  ['ink', 'paper-2', 'app bar / tab pill text', BODY],
  ['ink-2', 'paper-2', 'inactive tab label', BODY],
  ['faint', 'paper-2', 'tab-pill hint text', BODY],
  ['gold', 'paper-2', 'active tab label + glyph', BODY],

  ['ink', 'card', 'card body text', BODY],
  ['ink-2', 'card', 'card h3 (caps label), .muted', BODY],
  ['faint', 'card', 'card .small', BODY],
  ['gold', 'card', 'card gold accents, .countnum', BODY],
  ['gold-light', 'card', 'gold text inside a card', BODY],
  ['gold-deep', 'card', 'secondary gold on a card', BODY],
  ['neon', 'card', 'progress numbers on a card', BODY],
  ['ok', 'card', '.stamp.ok', BODY],
  ['warn', 'card', '.stamp.warn', BODY],
  ['crit', 'card', '.stamp.crit', BODY],

  ['ink', 'card-2', '.btn label, input text', BODY],
  ['ink-2', 'card-2', '.chip / .pill / .seg label', BODY],
  ['faint', 'card-2', 'input ::placeholder', BODY],
  ['gold-light', 'card-2', '.seg button.on (selected)', BODY],
  ['neon', 'card-2', 'completion chip on a raised surface', BODY],

  ['on-accent', 'gold', '.btn.primary label, toast, update banner', BODY],
  ['on-neon', 'neon', '.btn.neon label (packing FAB)', BODY],
  ['gold-light', 'accent-soft', '.chip.accent / .pill.accent', BODY],
  ['ok', 'ok-bg@card', '.chip.ok on a card', BODY],
  ['warn', 'warn-bg@card', '.chip.warn on a card', BODY],
  ['crit', 'crit-bg@card', '.chip.crit on a card', BODY],
  ['ok', 'ok-bg@paper', '.chip.ok on the canvas', BODY],
  ['warn', 'warn-bg@paper', '.chip.warn on the canvas', BODY],
  ['crit', 'crit-bg@paper', '.chip.crit on the canvas', BODY],
  ['ink', 'warn-bg@card', 'body text in a .card.warn', BODY],
  ['ink', 'crit-bg@card', 'body text in a .card.crit', BODY],

  ['cream-ink', 'cream', 'torn-paper guide card (typewriter body)', BODY],
  ['ink', 'leather', 'luggage-tag detail rows', BODY],
  ['gold', 'leather', 'luggage-tag carrier + confirmation code', BODY],
  ['cream', 'leather', 'luggage-tag header text', BODY],
  ['neon', 'neon-track', 'packing ring value vs its track', LARGE],
  ['on-photo', 'scrim-worst', 'text in a photo scrim (worst case: white photo)', BODY],

  ['line-2', 'paper', 'interactive boundary: .btn/.pill/input on the canvas', LARGE],
  ['line-2', 'card', 'interactive boundary on a card', LARGE],
  ['line-2', 'card-2', 'interactive boundary on a raised surface', LARGE],
  ['gold', 'paper', 'focus ring on the canvas', LARGE],
  ['gold', 'card-2', 'focus ring on a button', LARGE],

  ['deco', 'paper', 'DECORATIVE ONLY — hairlines, dead glyphs, watermarks', DECO],
  ['gold-dim', 'paper', 'DECORATIVE ONLY — dim gold rules, pin outlines', DECO],
  ['line', 'paper', 'DECORATIVE hairline / divider', DECO],
  ['leather-edge', 'card', 'DECORATIVE punched-hole ring, stitching', DECO],
];

/* hue-parameterised identity tokens: report the worst hue on the wheel */
const worst = (mk, bg) => {
  let r = Infinity;
  let at = 0;
  for (let h = 0; h < 360; h += 5) {
    const v = ratio(mk(h), bg);
    if (v < r) {
      r = v;
      at = h;
    }
  }
  return { r, at };
};
const stopText = (h) => hsl(h, 60, 80);
const stopFill = (h) => hsl(h, 55, 66);
const stopSoft = (h) => hsl(h, 40, 13);
const hueRows = [
  ['stop-text', 'card', 'per-stop / per-trip identity text', BODY, worst(stopText, T.card)],
  ['stop-text', 'paper', 'identity text on the canvas', BODY, worst(stopText, T.paper)],
  [
    'stop-text',
    'stop-soft (same hue)',
    'identity text on its own soft fill',
    BODY,
    worst((h) => stopText(h), stopSoft(0)) /* placeholder, replaced below */,
  ],
  ['stop', 'card', 'stay bars, station dots, line color', LARGE, worst(stopFill, T.card)],
  ['stop', 'paper', 'route-map lines on the canvas', LARGE, worst(stopFill, T.paper)],
];
/* same-hue pair has to vary both sides together */
{
  let r = Infinity;
  let at = 0;
  for (let h = 0; h < 360; h += 5) {
    const v = ratio(stopText(h), stopSoft(h));
    if (v < r) {
      r = v;
      at = h;
    }
  }
  hueRows[2][4] = { r, at };
}

/* ---------- run ---------- */
const rows = [];
let failures = 0;
for (const [fg, bg, where, min] of pairs) {
  const r = ratio(T[fg], T[bg]);
  const ok = min === DECO ? null : r >= min;
  if (ok === false) failures++;
  rows.push({ fg, bg, where, min, r, ok });
}
for (const [fg, bg, where, min, w] of hueRows) {
  const ok = w.r >= min;
  if (!ok) failures++;
  rows.push({ fg: `${fg} (worst hue ${w.at})`, bg, where, min, r: w.r, ok });
}

if (process.argv.includes('--table')) {
  console.log('| Foreground | Background | Where it is used | Ratio | Required | Verdict |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    const verdict = r.ok === null ? 'n/a — decorative' : r.ok ? 'PASS' : '**FAIL**';
    const req = r.min === DECO ? '—' : `${r.min.toFixed(1)}:1`;
    console.log(
      `| \`--${r.fg}\` | \`--${r.bg}\` | ${r.where} | **${r.r.toFixed(2)}:1** | ${req} | ${verdict} |`,
    );
  }
} else {
  for (const r of rows) {
    if (r.ok === false) console.error(`FAIL ${r.fg} on ${r.bg}: ${r.r.toFixed(2)} < ${r.min}`);
  }
}

if (failures) {
  console.error(`\nContrast gate: ${failures} failing pair(s).`);
  process.exit(1);
}
console.error(`\nContrast gate: ${rows.length} pairs checked, 0 failures.`);
