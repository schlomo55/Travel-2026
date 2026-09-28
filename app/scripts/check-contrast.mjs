/* ============================================================
   Horizon contrast gate — `npm run check:contrast` (inside `build`).

   Three jobs, in this order, and any one of them fails the build:

   1. THE DESIGN SYSTEM AND THE CSS AGREE. Every colour token in
      docs/design/horizon/system/tokens.json must exist in src/app.css
      with the same value, in BOTH themes. The system is the source of
      truth; app.css is its copy, and a copy that drifts is a bug that
      no screenshot would show until the day it mattered.

   2. EVERY PAIR THE APP RENDERS IS LEGIBLE, IN BOTH PALETTES. 4.5:1 for
      text, 3:1 for text at 24 px and up and for the boundary of a
      control. The pairs are the real text/ground pairs of the Horizon
      screens (Pocket, the pass, Counter mode, the driver card, Find,
      the Trips shelf, Settings, the shell) plus the LEGACY BRIDGE — the
      Lantern token names the Run 2–3 screens still read, measured at
      the Horizon values app.css re-points them to. Tokens are resolved
      exactly as the cascade resolves them: the light block restates
      only what changes and inherits the rest from :root, and
      `var(--x)` indirections are followed. A translucent token (a
      *-soft wash, a hairline) is composited over the ground it is
      actually drawn on — written `ok-soft@card`.

   3. NO DANGLING var(). A custom property that is read and never
      defined is not a loud failure: the declaration is invalid at
      computed-value time, so a colour inherits, a shadow draws NOTHING,
      and the screen looks plausible. Every `var(--x)` in src must be
      defined somewhere in src — app.css, a component's <style>, an
      inline `style="--x:…"` or a `setProperty('--x', …)` — unless the
      var() carries its own fallback.

   Tokens marked DECORATIVE are reported, never gated: they may never
   carry text. `--table` prints the markdown tables for both palettes.
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

/* ---------- the two token blocks ---------- */
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

const DECL = {
  dark: declarations(blockFor(':root {')),
  light: declarations(blockFor(":root[data-theme='light'] {")),
};

/** The declared value as the cascade sees it: light inherits from dark. */
function raw(theme, name) {
  return DECL[theme].get(name) ?? (theme === 'light' ? DECL.dark.get(name) : undefined);
}

/** A colour: { rgb, a }. Follows var() chains; returns null for anything that
    is not a plain colour (gradients, shadows, sizes). */
function colour(theme, name, seen = new Set()) {
  if (seen.has(name)) die(`var() cycle through --${name} in the ${theme} palette.`);
  seen.add(name);
  const v = raw(theme, name);
  if (v === undefined) return null;
  const ref = /^var\(--([\w-]+)\)$/.exec(v);
  if (ref) return colour(theme, ref[1], seen);
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
/* THE ONE OVERRIDE, and why. Each entry names the token, the theme, the value
   app.css carries instead, and the evidence — a system value that fails its
   own stated use is corrected here, in the open, never silently in the CSS. */
const OVERRIDES = {
  'ok-ink': {
    light: {
      value: '#186a42',
      why:
        'tokens.json #1f7a4d is 4.38:1 on its own chip ground (ok-soft over card); ' +
        'every approved daylight board (f-pass/f-pocket/f-find-light) prints the Booked chip at #186A42 — 5.45:1',
    },
  },
};
const drift = [];
for (const t of SYSTEM.color.tokens) {
  for (const theme of ['dark', 'light']) {
    const want = OVERRIDES[t.name]?.[theme]?.value ?? t.value[theme];
    const got = raw(theme, t.name);
    if (got === undefined) drift.push(`--${t.name} (${theme}) is missing from app.css; tokens.json says ${want}`);
    else if (!sameColour(got, want)) drift.push(`--${t.name} (${theme}) is ${got} in app.css; tokens.json says ${want}`);
  }
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
function resolve(theme, spec) {
  const derived = DERIVED[spec];
  if (derived) return derived(theme);
  const [name, ground] = spec.split('@');
  const c = colour(theme, name);
  if (!c) die(`The gate cannot read --${name} as a colour in the ${theme} palette (pair "${spec}").`);
  if (c.a >= 1) return c.rgb;
  if (!ground) die(`--${name} is translucent in the ${theme} palette; name the ground it is drawn on (${name}@card).`);
  return over(c.rgb, c.a, resolve(theme, ground));
}

/* Grounds that are not a token. A PHOTO IS ITS OWN GROUND: it does not get
   lighter because the app around it did, so the worst case is a white photo
   under the scrim's darkest stop, identical in both themes. */
const NIGHT = [11, 12, 22]; // --scrim is night sky in BOTH themes: photos do not change with them
const DERIVED = {
  /* the city-band scrim (--scrim) at its foot: night sky at 92 % over white */
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
  /* the metro line's chips and you-are-here pill sit on the sky: at night the
     sky is darker than a card, so the *-soft@card pairs above are the worse
     case; in daylight DayView lays them on card paper (see .metro .chip) */
  ['lilac-ink', 'card', 'a time on the day line, a to-do’s clock', BODY],
  ['lilac-ink', 'lilac-soft@card', 'the TO DO tile’s due chip', BODY],
  ['warn-ink', 'card-2', 'book ahead / verify on an option row', BODY],
  ['warn-ink', 'sky', 'a station’s own warning on the metro line (NOT Capital)', BODY],
  ['sunrise', 'card-2', 'In the day, on a picked option; the coming-up count', BODY],
  ['ink-2', 'card-2', 'an option’s detail and recorded facts', BODY],
  /* words on the TONIGHT photo — worst case a white photo, both themes */
  ['photo-ink', 'tonight-scrim-words', 'TONIGHT and the bed, on the tile’s photo', BODY],
  ['photo-ok', 'tonight-scrim-foot', 'Booked, on the TONIGHT photo', BODY],
  ['photo-warn', 'tonight-scrim-foot', 'Pending, on the TONIGHT photo', BODY],
  ['photo-crit', 'tonight-scrim-foot', 'No booking, on the TONIGHT photo', BODY],

  /* ---------- the one sunrise action ---------- */
  ['on-sunrise', 'sunrise-fill', 'primary button, chosen segment, the active Find button', BODY],

  /* ---------- white = for other eyes (identical in both themes) ---------- */
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
     gated above) and its sunrise glow, not by its fill against the page: the
     fill is the same peach in both themes by design (tokens.json). */
  ['sunrise-fill', 'sky', 'REPORTED the primary button’s fill against the page', DECO],

  /* ---------- LEGACY BRIDGE — Lantern names still read by the Run 2–3
     screens, at the Horizon values app.css re-points them to ---------- */
  ['ink', 'paper', 'bridge · body text on Now / To do / stops / the guide', BODY],
  ['ink-2', 'paper', 'bridge · .muted on those screens', BODY],
  ['faint', 'paper', 'bridge · .small, .foot', BODY],
  ['gold', 'paper', 'bridge · gold headings and links (now sunrise)', BODY],
  ['gold-light', 'card', 'bridge · gold text inside a card', BODY],
  ['gold-deep', 'card', 'bridge · secondary gold on a card', BODY],
  ['gold-deep', 'paper', 'bridge · secondary gold on the canvas', BODY],
  ['neon', 'card', 'bridge · progress numbers (packing ring)', BODY],
  ['neon', 'card-2', 'bridge · completion on a raised surface', BODY],
  ['neon', 'paper', 'bridge · progress text on the canvas', BODY],
  ['on-neon', 'neon', 'bridge · the packing FAB', BODY],
  ['neon', 'neon-bg@card', 'bridge · the completion chip', BODY],
  ['neon', 'neon-track', 'bridge · the ring value against its track', LARGE],
  ['on-accent', 'btn-fill', 'bridge · .btn.primary label', BODY],
  ['gold-light', 'accent-soft@card', 'bridge · .chip.accent / .pill.accent', BODY],
  ['warn', 'warn-bg@card', 'bridge · .chip.warn words', BODY],
  ['crit', 'crit-bg@card', 'bridge · .chip.crit words', BODY],
  ['cream-ink', 'cream', 'bridge · the guide’s getting-there block', BODY],
  ['paper-link', 'cream', 'bridge · a link in that block', BODY],
  ['guide-script', 'paper', 'bridge · the guide’s city title', BODY],
  ['on-material', 'paper-well', 'bridge · a day title in the guide’s accordion', BODY],
  ['ink-2', 'paper-well', 'bridge · the weather chip on a guide day', BODY],
  ['gold-deep', 'paper-well', 'bridge · the day-of-week label', BODY],
  ['ink', 'plan-card', 'bridge · a planned item on Now’s day line', BODY],
  ['ink-2', 'plan-card', 'bridge · the line under a planned item', BODY],
  ['gold', 'plan-card', 'bridge · the map glyph on a planned item', LARGE],
  ['line-2', 'paper', 'bridge · interactive boundary on the canvas', LARGE],
  ['line-2', 'card-2', 'bridge · interactive boundary on a raised surface', LARGE],
  ['on-photo', 'scrim-worst', 'text in a photo scrim (worst case: a white photo)', BODY],
  ['deco', 'paper', 'DECORATIVE bridge · dead glyphs, rules', DECO],
  ['gold-dim@paper', 'paper', 'DECORATIVE bridge · dim sunrise rules', DECO],
];

/* the identity hues — the worst hue on the wheel, in each theme */
function hueParams(token) {
  const found = [...css.matchAll(new RegExp(`--${token}:\\s*hsl\\([^;]*?(\\d+)%\\s+(\\d+)%\\s*\\)\\s*;`, 'g'))];
  if (found.length !== 2) {
    die(
      `Expected exactly two --${token} compositions in app.css (dark, then light);`,
      `found ${found.length}. The identity hues would go ungated in one theme.`,
    );
  }
  return { dark: [+found[0][1], +found[0][2]], light: [+found[1][1], +found[1][2]] };
}
const HUES = { stop: hueParams('stop'), 'stop-soft': hueParams('stop-soft'), 'stop-text': hueParams('stop-text') };
function hueRows(theme) {
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
  const text = (h) => hsl(h, ...HUES['stop-text'][theme]);
  const fill = (h) => hsl(h, ...HUES.stop[theme]);
  const soft = (h) => hsl(h, ...HUES['stop-soft'][theme]);
  return [
    ['stop-text', 'card', 'identity text on a card', BODY, worst(text, resolve(theme, 'card'))],
    ['stop-text', 'sky', 'identity text on the sky', BODY, worst(text, resolve(theme, 'sky'))],
    ['stop-text', 'stop-soft (same hue)', 'identity text on its own soft fill', BODY, worst(text, soft)],
    ['stop', 'card', 'stay bars, station dots', LARGE, worst(fill, resolve(theme, 'card'))],
    ['stop', 'sky', 'route-map lines on the sky', LARGE, worst(fill, resolve(theme, 'sky'))],
  ];
}

function runTheme(theme) {
  const rows = [];
  let failures = 0;
  for (const [fg, bg, where, min] of pairs) {
    const r = ratio(resolve(theme, fg), resolve(theme, bg));
    const ok = min === DECO ? null : r >= min;
    if (ok === false) failures++;
    rows.push({ fg, bg, where, min, r, ok });
  }
  for (const [fg, bg, where, min, w] of hueRows(theme)) {
    const ok = w.r >= min;
    if (!ok) failures++;
    rows.push({ fg: `${fg} (worst hue ${w.at})`, bg, where, min, r: w.r, ok });
  }
  return { rows, failures };
}

const RESULTS = { dark: runTheme('dark'), light: runTheme('light') };
const TITLES = { dark: 'Dark — the default', light: 'Daylight — `[data-theme="light"]`' };

if (process.argv.includes('--table')) {
  for (const theme of ['dark', 'light']) {
    const { rows, failures } = RESULTS[theme];
    console.log(`\n#### ${TITLES[theme]}`);
    console.log(`\n**${rows.length} pairs checked · ${failures} failures.**\n`);
    console.log('| Foreground | Background | Where it is used | Ratio | Required | Verdict |');
    console.log('|---|---|---|---|---|---|');
    for (const r of rows) {
      const verdict = r.ok === null ? 'n/a — decorative' : r.ok ? 'PASS' : '**FAIL**';
      const req = r.min === DECO ? '—' : `${r.min.toFixed(1)}:1`;
      console.log(`| \`--${r.fg}\` | \`--${r.bg}\` | ${r.where} | **${r.r.toFixed(2)}:1** | ${req} | ${verdict} |`);
    }
  }
} else {
  for (const theme of ['dark', 'light']) {
    for (const r of RESULTS[theme].rows) {
      if (r.ok === false) console.error(`FAIL [${theme}] ${r.fg} on ${r.bg}: ${r.r.toFixed(2)} < ${r.min} — ${r.where}`);
    }
  }
}

const total = RESULTS.dark.failures + RESULTS.light.failures;
if (total) {
  die(`\nContrast gate: ${RESULTS.dark.failures} failing pair(s) in dark, ${RESULTS.light.failures} in daylight.`);
}
console.error(
  `\nContrast gate: ${SYSTEM.color.tokens.length} system tokens × 2 themes match tokens.json; ` +
    `${RESULTS.dark.rows.length} pairs checked in each of 2 palettes (${RESULTS.dark.rows.length * 2} total), 0 failures.`,
);
