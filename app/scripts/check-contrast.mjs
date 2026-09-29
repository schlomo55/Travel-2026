/* ============================================================
   Horizon contrast gate — `npm run check:contrast` (inside `build`).

   Three jobs, in this order, and any one of them fails the build:

   1. THE DESIGN SYSTEM AND THE CSS AGREE. Every colour token in
      docs/design/horizon/system/tokens.json must exist in src/app.css
      with the same value. The system is the source of truth; app.css is
      its copy, and a copy that drifts is a bug that no screenshot would
      show until the day it mattered. ONE PALETTE: Horizon is dark only
      since Run 4 (owner, 2026-09-28), in the system and in the CSS, and
      a second palette appearing in either fails here too.

   2. EVERY PAIR THE APP RENDERS IS LEGIBLE. 4.5:1 for text, 3:1 for text
      at 24 px and up and for the boundary of a control. The pairs are
      the real text/ground pairs of the Horizon screens (Now, Journey,
      the city and its guide, Pocket, the pass, Counter mode, the driver
      card, Find, the Trips shelf, Settings, the shell) plus the few
      Lantern token names that still have a reader (the LEGACY BRIDGE).
      `var(--x)` indirections are followed. A translucent token (a *-soft
      wash, a hairline) is composited over the ground it is actually
      drawn on — written `ok-soft@card`.

   3. NO DANGLING var(). A custom property that is read and never
      defined is not a loud failure: the declaration is invalid at
      computed-value time, so a colour inherits, a shadow draws NOTHING,
      and the screen looks plausible. Every `var(--x)` in src must be
      defined somewhere in src — app.css, a component's <style>, an
      inline `style="--x:…"` or a `setProperty('--x', …)` — unless the
      var() carries its own fallback.

   Tokens marked DECORATIVE are reported, never gated: they may never
   carry text. `--table` prints the markdown table.
   ============================================================ */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');
const cssPath = join(srcDir, 'app.css');
const tokensPath = join(here, '..', '..', 'docs', 'design', 'horizon', 'system', 'tokens.json');
const css = readFileSync(cssPath, 'utf8');

function die(...lines) {
  for (const l of lines) console.error(l);
  process.exit(1);
}

/* ---------- colour math (WCAG 2.1) ---------- */
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
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/* ---------- the palette: one, on :root ---------- */
if (css.replace(/\/\*[\s\S]*?\*\//g, '').includes('data-theme')) {
  die(
    'app.css carries a [data-theme] rule. Horizon is dark only (Run 4): one palette, on :root.',
    'Remove the rule — or, if a second palette is ever wanted again, update this gate first.',
  );
}
function blockFor(selector) {
  const at = css.indexOf(selector);
  if (at < 0) {
    die(
      `app.css no longer contains the selector \`${selector}\` — the gate cannot`,
      'read a palette it cannot find. Restore it, or update this script.',
    );
  }
  const open = css.indexOf('{', at);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(open + 1, i - 1);
}

/** `--name: value;` declarations of one block, comments removed. A value may
    span lines (gradients); it ends at the first `;` outside parentheses. */
function declarations(block) {
  const text = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map();
  const re = /--([\w-]+)\s*:/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 0;
    let j = re.lastIndex;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ';' && depth === 0) break;
    }
    out.set(m[1], text.slice(re.lastIndex, j).trim().replace(/\s+/g, ' '));
    re.lastIndex = j + 1;
  }
  return out;
}

const DECL = declarations(blockFor(':root {'));

/** The value :root declares. */
function raw(name) {
  return DECL.get(name);
}

/** A colour: { rgb, a }. Follows var() chains; returns null for anything that
    is not a plain colour (gradients, shadows, sizes). */
function colour(name, seen = new Set()) {
  if (seen.has(name)) die(`var() cycle through --${name}.`);
  seen.add(name);
  const v = raw(name);
  if (v === undefined) return null;
  const ref = /^var\(--([\w-]+)\)$/.exec(v);
  if (ref) return colour(ref[1], seen);
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return { rgb: [0, 2, 4].map((k) => parseInt(hex[1].slice(k, k + 2), 16)), a: 1 };
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(v);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], a: +rgba[4] };
  return null;
}

/* ============================================================
   1 · the design system and the CSS agree
   ============================================================ */
if (!existsSync(tokensPath)) {
  die(
    `The Horizon design system is missing: ${tokensPath}`,
    'app.css copies its colour tokens from that file, and this gate proves the',
    'copy is faithful. Without it there is nothing to prove against.',
  );
}
const SYSTEM = JSON.parse(readFileSync(tokensPath, 'utf8'));
const themes = (SYSTEM.color.themes ?? []).map((t) => t.id);
if (themes.length !== 1 || themes[0] !== 'dark') {
  die(`tokens.json declares the themes [${themes.join(', ')}]; Horizon is dark only since Run 4 — one theme, "dark".`);
}
const sameColour = (a, b) => {
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  /* rgba(…,0.10) and rgba(…,0.1) are the same colour */
  const parse = (s) => /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(s);
  const pa = parse(na);
  const pb = parse(nb);
  return !!pa && !!pb && pa.slice(1).every((x, i) => Number(x) === Number(pb[i + 1]));
};
const drift = [];
for (const t of SYSTEM.color.tokens) {
  const want = t.value;
  if (typeof want !== 'string') {
    drift.push(`--${t.name} has ${JSON.stringify(want)} in tokens.json — one value per token (dark only)`);
    continue;
  }
  const got = raw(t.name);
  if (got === undefined) drift.push(`--${t.name} is missing from app.css; tokens.json says ${want}`);
  else if (!sameColour(got, want)) drift.push(`--${t.name} is ${got} in app.css; tokens.json says ${want}`);
}
if (drift.length) {
  for (const d of drift) console.error(`DRIFT ${d}`);
  die(`\nDesign-system gate: ${drift.length} token value(s) differ from docs/design/horizon/system/tokens.json.`);
}

/* ============================================================
   3 · no dangling var()  (run before the pairs: a missing token would
   otherwise surface as a confusing colour failure)
   ============================================================ */
{
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(svelte|css|ts)$/.test(e.name)) files.push(f);
    }
  })(srcDir);
  const bodies = files.map((f) => [f, readFileSync(f, 'utf8')]);
  const defined = new Set();
  for (const [, body] of bodies) {
    for (const m of body.matchAll(/--([\w-]+)\s*:/g)) defined.add(m[1]);
    for (const m of body.matchAll(/setProperty\(\s*['"]--([\w-]+)['"]/g)) defined.add(m[1]);
    for (const m of body.matchAll(/style:--([\w-]+)/g)) defined.add(m[1]);
  }
  const dangling = new Map();
  for (const [f, body] of bodies) {
    for (const m of body.matchAll(/var\(\s*--([\w-]+)\s*(,)?/g)) {
      if (m[2]) continue; // carries its own fallback
      if (!defined.has(m[1])) {
        dangling.set(m[1], (dangling.get(m[1]) || []).concat(f.slice(srcDir.length + 1)));
      }
    }
  }
  if (dangling.size) {
    for (const [tok, where] of dangling) console.error(`UNDEFINED --${tok} — used in ${[...new Set(where)].join(', ')}`);
    die(`\nToken gate: ${dangling.size} custom propert${dangling.size === 1 ? 'y' : 'ies'} read but never defined.`);
  }
}

/* ============================================================
   2 · the pairs
   ============================================================ */
const BODY = 4.5;
const LARGE = 3;
const DECO = 0;

/** Resolve a ground or ink: `token`, or `token@ground` (a translucent token
    composited over a solid one), or one of the derived grounds below. */
function resolve(spec) {
  const derived = DERIVED[spec];
  if (derived) return derived();
  const [name, ground] = spec.split('@');
  const c = colour(name);
  if (!c) die(`The gate cannot read --${name} as a colour (pair "${spec}").`);
  if (c.a >= 1) return c.rgb;
  if (!ground) die(`--${name} is translucent; name the ground it is drawn on (${name}@card).`);
  return over(c.rgb, c.a, resolve(ground));
}

/* Grounds that are not a token. A PHOTO IS ITS OWN GROUND: the worst case is
   a white photo under the night scrim's thinnest stop behind the words. */
const NIGHT = [11, 12, 22]; // the scrims are night sky, rgba(11, 12, 22, …)
const DERIVED = {
  /* the guide hero's scrim (Stop.svelte .gd-shade) at its foot, where the
     city's name sits: night sky at 92 % over white */
  'scrim-worst': () => over(NIGHT, 0.92, WHITE),
  /* Now's TONIGHT tile (NowHome .tt-photo::after): its thinnest stop under
     the label and the bed (62 %), and under the status word (80 %) */
  'tonight-scrim-words': () => over(NIGHT, 0.62, WHITE),
  'tonight-scrim-foot': () => over(NIGHT, 0.8, WHITE),
};

const pairs = [
  /* ---------- the sky, the chrome, the cards ---------- */
  ['ink', 'sky', 'body text on the screen', BODY],
  ['ink-2', 'sky', 'secondary text — subtitles, second lines', BODY],
  ['faint', 'sky', 'tertiary text — captions, timestamps, the offline line', BODY],
  ['sunrise', 'sky', 'links, key numbers, caps micro-labels in sunrise', BODY],
  ['ink', 'chrome', 'floating chrome — the nav bar, a sheet', BODY],
  ['ink-2', 'chrome', 'inactive nav label, a sheet’s second line', BODY],
  ['faint', 'chrome', 'a sheet’s hint text', BODY],
  ['sunrise', 'sunrise-soft@chrome', 'the active nav item — label and glyph on its wash', BODY],
  ['ink', 'field', 'the text in a field', BODY],
  ['placeholder', 'field', 'a field’s placeholder', BODY],
  ['ink', 'card', 'card and tile text', BODY],
  ['ink-2', 'card', 'a row’s second line, a tile label', BODY],
  ['faint', 'card', 'a caption on a card, caps labels', BODY],
  ['sunrise', 'card', 'sunrise on a card — the TODAY label, links, counts', BODY],
  ['lilac', 'card', 'what is planned and still ahead', BODY],
  ['aqua', 'card', 'the Experiences tile and its icon', BODY],
  ['aqua', 'aqua-soft@card', 'an experience’s icon well', BODY],
  ['ink', 'card-2', 'a secondary button, an input’s text', BODY],
  ['ink-2', 'card-2', 'a chip at rest, the clear-search glyph', BODY],

  /* ---------- status: chips, notes, the warning card ---------- */
  ['ok-ink', 'ok-soft@card', 'Booked chip', BODY],
  ['warn-ink', 'warn-soft@card', 'Not booked / pending chip, the amber note', BODY],
  ['crit-ink', 'crit-soft@card', 'Missing chip, the Find warning card', BODY],
  ['lilac-ink', 'lilac-soft@card', 'Planned chip, a step number well', BODY],
  ['crit-ink', 'crit-soft@sky', 'the Emergency pill in the Pocket header', BODY],
  ['sunrise', 'sunrise-soft@card', 'the accent chip — En route', BODY],
  ['ok', 'card', 'a booked tick’s word, “protected” in Settings', BODY],
  ['warn', 'card', 'amber words on a card', BODY],
  ['crit', 'card', 'a crit word on a card', BODY],
  ['crit-ink', 'card', 'the visa’s hard deadline, a crit value on a card', BODY],
  ['warn-ink', 'crit-soft@card', 'a pending line inside the emergency card', BODY],
  ['warn-ink', 'card', 'a warned value on the pass (Checked 20 kg)', BODY],
  ['ink', 'warn-soft@card', 'body text inside an amber note', BODY],
  ['ink', 'crit-soft@card', 'body text inside the warning card', BODY],
  ['mark-ink', 'mark-bg@card', 'what Find matched, highlighted', BODY],
  ['mark-ink', 'mark-bg@sky', 'a highlight on the sky', BODY],

  /* ---------- Now (Run 2): the map, the sentence, the tiles, the day, To do ---------- */
  ['ink-2', 'sky', 'a stop’s name on the map', BODY],
  ['sunrise', 'sky', 'the map’s YOU and TONIGHT labels, the you-are-here pill', BODY],
  ['ok-ink', 'card', 'Booked, as a word on a tile', BODY],
  /* the metro line's chips and you-are-here pill sit on the sky, which is
     darker than a card, so the *-soft@card pairs above are the worse case */
  ['lilac-ink', 'card', 'a time on the day line, a to-do’s clock', BODY],
  ['lilac-ink', 'lilac-soft@card', 'the TO DO tile’s due chip', BODY],
  ['warn-ink', 'card-2', 'book ahead / verify on an option row', BODY],
  ['warn-ink', 'sky', 'a station’s own warning on the metro line (NOT Capital)', BODY],
  ['sunrise', 'card-2', 'In the day, on a picked option; the coming-up count', BODY],
  ['ink-2', 'card-2', 'an option’s detail and recorded facts', BODY],
  /* words on the TONIGHT photo — worst case a white photo */
  ['photo-ink', 'tonight-scrim-words', 'TONIGHT and the bed, on the tile’s photo', BODY],
  ['photo-ok', 'tonight-scrim-foot', 'Booked, on the TONIGHT photo', BODY],
  ['photo-warn', 'tonight-scrim-foot', 'Pending, on the TONIGHT photo', BODY],
  ['photo-crit', 'tonight-scrim-foot', 'No booking, on the TONIGHT photo', BODY],

  /* ---------- the one sunrise action ---------- */
  ['on-sunrise', 'sunrise-fill', 'primary button, chosen segment, the active Find button', BODY],

  /* ---------- white = for other eyes ---------- */
  ['counter-ink', 'counter-paper', 'Counter mode’s code, the driver card’s Chinese', BODY],
  ['counter-ink-2', 'counter-paper', 'the English line under the Chinese, the route', BODY],
  ['counter-ink', 'counter-paper-2', 'the quiet band inside a white screen', BODY],
  ['counter-ink-2', 'counter-paper-2', 'secondary text in that band', BODY],
  ['counter-paper', 'counter-ink', 'the Close button’s label', BODY],
  ['counter-crit', 'counter-crit-soft@counter-paper', 'the warning on a driver card you must not show', BODY],
  ['counter-accent', 'counter-paper', 'the Counter-mode mark and focus ring on white', LARGE],
  ['paper-chip-ink', 'paper-chip', 'a driver-card chip in Pocket', BODY],
  ['paper-chip-ink-2', 'paper-chip', 'the English line on that chip', BODY],
  ['counter-crit', 'paper-chip', 'a warned driver card’s warning, in the list', BODY],
  ['counter-warn', 'paper-chip', '“verify” on a driver card, in the list', BODY],

  /* ---------- the pass hero scene ---------- */
  ['ink', 'scene-hill', 'the departure / arrival clocks on the pass hero', BODY],
  ['ink-2', 'scene-2', 'the flying time over the pass arc', BODY],

  /* ---------- boundaries of controls (3:1) ---------- */
  ['edge', 'sky', 'interactive outline on the sky — the Find button', LARGE],
  ['edge', 'chrome', 'interactive outline in floating chrome', LARGE],
  ['edge', 'field', 'a field’s outline', LARGE],
  ['edge', 'card', 'interactive outline on a card', LARGE],
  ['edge', 'card-2', 'an input’s outline', LARGE],
  ['sunrise', 'sky', 'the focus ring on the sky', LARGE],
  ['sunrise', 'card', 'the focus ring on a card', LARGE],
  ['sunrise', 'card-2', 'the focus ring on a button', LARGE],
  ['switch-off-edge', 'card', 'a switch that is off', LARGE],
  ['switch-on', 'card', 'a switch that is on', LARGE],

  /* ---------- DECORATIVE — reported, never gated ---------- */
  ['line@sky', 'sky', 'DECORATIVE hairline on the sky', DECO],
  ['line@card', 'card', 'DECORATIVE card edge', DECO],
  ['map-grid@sky', 'sky', 'DECORATIVE the dot grid', DECO],
  ['ridge-3', 'sky', 'DECORATIVE the front ridge', DECO],
  /* The primary button is identified by its label (on-sunrise on sunrise-fill,
     gated above) and its sunrise glow, not by its fill against the page. */
  ['sunrise-fill', 'sky', 'REPORTED the primary button’s fill against the page', DECO],

  /* ---------- the guide's hero ---------- */
  ['photo-ink', 'scrim-worst', 'the city’s name on the guide’s photo (worst case: a white photo)', BODY],

  /* ---------- LEGACY BRIDGE — the Lantern names still read, at the Horizon
     values app.css re-points them to ---------- */
  ['ink', 'plan-card', 'bridge · a planned item on Now’s day line', BODY],
  ['ink-2', 'plan-card', 'bridge · the line under a planned item', BODY],
  ['lilac-ink', 'plan-card', 'bridge · a planned item’s time', BODY],
];

/* the identity hues — the worst hue on the wheel */
function hueParams(token) {
  const found = [...css.matchAll(new RegExp(`--${token}:\\s*hsl\\([^;]*?(\\d+)%\\s+(\\d+)%\\s*\\)\\s*;`, 'g'))];
  if (found.length !== 1) {
    die(
      `Expected exactly one --${token} composition in app.css; found ${found.length}.`,
      'The identity hues are composed once, on every element — a second one would go ungated.',
    );
  }
  return [+found[0][1], +found[0][2]];
}
const HUES = { stop: hueParams('stop'), 'stop-soft': hueParams('stop-soft'), 'stop-text': hueParams('stop-text') };
function hueRows() {
  const worst = (fg, bg) => {
    let r = Infinity;
    let at = 0;
    for (let h = 0; h < 360; h += 5) {
      const v = ratio(fg(h), typeof bg === 'function' ? bg(h) : bg);
      if (v < r) {
        r = v;
        at = h;
      }
    }
    return { r, at };
  };
  const text = (h) => hsl(h, ...HUES['stop-text']);
  const fill = (h) => hsl(h, ...HUES.stop);
  const soft = (h) => hsl(h, ...HUES['stop-soft']);
  return [
    ['stop-text', 'card', 'identity text on a card', BODY, worst(text, resolve('card'))],
    ['stop-text', 'sky', 'identity text on the sky', BODY, worst(text, resolve('sky'))],
    ['stop-text', 'stop-soft (same hue)', 'identity text on its own soft fill', BODY, worst(text, soft)],
    ['stop', 'card', 'stay bars, station dots', LARGE, worst(fill, resolve('card'))],
    ['stop', 'sky', 'route-map lines on the sky', LARGE, worst(fill, resolve('sky'))],
  ];
}

function run() {
  const rows = [];
  let failures = 0;
  for (const [fg, bg, where, min] of pairs) {
    const r = ratio(resolve(fg), resolve(bg));
    const ok = min === DECO ? null : r >= min;
    if (ok === false) failures++;
    rows.push({ fg, bg, where, min, r, ok });
  }
  for (const [fg, bg, where, min, w] of hueRows()) {
    const ok = w.r >= min;
    if (!ok) failures++;
    rows.push({ fg: `${fg} (worst hue ${w.at})`, bg, where, min, r: w.r, ok });
  }
  return { rows, failures };
}

const { rows, failures } = run();

if (process.argv.includes('--table')) {
  console.log('\n#### The night sky — the one palette');
  console.log(`\n**${rows.length} pairs checked · ${failures} failures.**\n`);
  console.log('| Foreground | Background | Where it is used | Ratio | Required | Verdict |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    const verdict = r.ok === null ? 'n/a — decorative' : r.ok ? 'PASS' : '**FAIL**';
    const req = r.min === DECO ? '—' : `${r.min.toFixed(1)}:1`;
    console.log(`| \`--${r.fg}\` | \`--${r.bg}\` | ${r.where} | **${r.r.toFixed(2)}:1** | ${req} | ${verdict} |`);
  }
} else {
  for (const r of rows) {
    if (r.ok === false) console.error(`FAIL ${r.fg} on ${r.bg}: ${r.r.toFixed(2)} < ${r.min} — ${r.where}`);
  }
}

if (failures) die(`\nContrast gate: ${failures} failing pair(s).`);
console.error(
  `\nContrast gate: ${SYSTEM.color.tokens.length} system tokens match tokens.json (one palette, dark); ` +
    `${rows.length} pairs checked, 0 failures.`,
);
