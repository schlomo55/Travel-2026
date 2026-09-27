/* The deployed bundle must contain ZERO personal data — that is the structural
   privacy fix over the legacy app, where a passport number sat in the HTML at a
   guessable URL. This greps every built file for values that live in the seed
   and in the source documents, and fails the build if any leaked in.
   Run: npm run check:dist (also part of `npm run deploy`). */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const dist = join(here, '..', 'dist');
const seedPath = join(repo, 'seed', 'china-2026.trip.json');
const handoffPath = join(repo, 'sources', 'china-2026', 'china-2026-handoff-prompt.md');

/** Patterns that must never appear in a deployed file. */
const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: 'traveller name', re: /SALOMON|CHALOM/i },
  { label: 'French passport number', re: /\b23AD\d{5}\b/ },
  { label: 'Etihad PNR', re: /\b8CR7MR\b/ },
  /* NINE Trip.com order numbers now: the three flights (1653716…), Four Points
     (…561783471), Blossom House (…561827302), Huatian (…534089209), Glenview
     (…534121148) and the ibis Kunming airport night (…562519718) — plus the
     SUPERSEDED Four Points order (…561596848), which no longer appears anywhere
     in the app but is still personal data and is still guarded here. A dead
     booking number paired with a surname and a property is enough to talk to a
     call centre.

     They all share a 1653715/1653716 prefix, so ONE family pattern covers every
     one of them and any sibling order from the same account epoch. That is the
     whole point of a family pattern rather than a list of literals: the three
     numbers that arrived on 2026-07-27 morning (Four Points' replacement,
     Blossom House's, and the dead one that has to stay guarded) needed no edit
     here at all, and neither did the ibis order that evening. Verified against
     this exact regex, not assumed — all nine match, and `\b` on both ends means
     a longer digit run does not (`16537155617834710` and `165371556178347` were
     both measured as misses, and so were `16537155625197180` and
     `165371556251971`). */
  { label: 'Trip.com booking number', re: /\b16537(?:15|16)\d{9}\b/ },
  /* THE BOOKING.COM CONFIRMATION NUMBERS — Lijiang Yue Tu Inn and the Dali
     Yanyuan retreat, both booked 2026-07-27. Ten digits each with no family
     shape between them: Booking.com mints opaque serials, not account-epoch
     ones, so 5942328968 and 6352597569 share nothing a pattern could
     generalise. They are grepped LITERALLY, as an alternation, exactly the way
     the three airline PNRs are — and exactly like Pullman's Agoda id and The
     Royal Garden's direct-booking token.

     The arithmetic that licenses a bare literal is the same as Agoda's: one in
     ten BILLION, with `\b` at both ends so it cannot match inside a longer
     digit run. Measured for the number added today, not assumed:
     `16352597569`, `63525975690`, `x6352597569x` and `width:6352597569px` are
     all misses; `6352597569` and `a 6352597569 b` are hits. And there is no
     label to hang a contextual pattern on anyway — a Booking.com confirmation
     number travels as the bare number in a `code` field. Paired with the
     property and a surname it views, changes and cancels the stay, so neither
     may ever reach dist. */
  { label: 'Booking.com confirmation number', re: /\b(?:5942328968|6352597569)\b/ },
  /* THE AGODA BOOKING ID FOR PULLMAN ZHANGJIAJIE, booked 2026-07-27. Agoda mints
     a short numeric serial with no family shape — nothing like the 16-digit
     account-epoch form above — so, like the airline PNRs and The Royal Garden's
     direct-booking token, it is grepped LITERALLY.

     A bare literal is the honest form here, and the reason is arithmetic. The
     two values on this trip that get the contextual treatment (the booking PIN,
     the card's last four) are FOUR digits: one in ten thousand, which collides
     with prices, years, room numbers, pixel values and hash fragments often
     enough that a bare pattern would cry wolf and get switched off. This is
     NINE digits — one in a billion — and `\b` on both ends means it cannot even
     match inside a longer run of digits (measured: `16826076630` does not hit).
     A gate is allowed to be strict when strictness costs nothing, and there is
     no label to hang it on anyway: an Agoda id travels as the bare number in a
     `code` field. It IS personal data — paired with the property and a surname
     it views, changes and cancels the stay — so it must never reach dist. */
  { label: 'Agoda booking id', re: /\b682760663\b/ },
  /* A FOUR-DIGIT PIN CANNOT BE GREPPED ON ITS OWN. `\b9858\b` matches a price,
     a year, a room number, a pixel value and four digits of any content hash;
     a gate that cries wolf is a gate that gets switched off. Two facts make the
     contextual form the honest one: a bare four-digit number identifies nobody,
     and every PIN on this trip only ever travels BESIDE its own label — as
     "PIN 3635" in a codeSub, and as {"k":"PIN","v":"2786"} in a meta chip. So
     the label is required, which also covers the 3U8011 PIN that shipped
     unguarded for a while. And the booking number each PIN unlocks is forbidden
     outright above, so the pair can never leave together regardless.

     FIVE PINs are listed, and four are live. 3635 is Yue Tu Inn's and 8706 is
     the Dali retreat's, both Booking.com, both added 2026-07-27; 2284 is the
     ibis Kunming order's, which Trip.com itself marks "do not disclose"; 2786 is
     3U8011's. 9858 belonged to the Four Points order that was REPLACED on the
     same day: it is gone from the app, and it stays in this pattern precisely
     because it is gone — a retired credential is still a credential, and
     dropping it from the gate is how a stale build quietly ships one.
     Residual false-positive shape, measured: a variable or custom property
     literally called `pin` within 16 characters of the digits ("var pin =
     9858", "var pin = 8706"). That fails the build rather than passing a leak,
     which is the direction a privacy gate is allowed to be wrong in. Measured
     for the two added today: `PIN 8706 — needed` and `PIN 2284 — Trip.com` hit
     (which is exactly how each ships, in a codeSub); bare `8706`, bare `2284`,
     `width:8706px`, `var t=2284`, `room 2284` and `2026 8706` are all misses.
     Also measured earlier: bare `3635`, `width:3635px` and `var t=3635`. */
  { label: 'booking PIN beside its label', re: /\bPIN\b.{0,16}?\b(?:9858|2786|3635|8706|2284)\b/i },
  /* A HOTEL RESERVATION NUMBER IS PERSONAL DATA, exactly like a Trip.com order
     number: paired with the property and the guest's surname it is enough to
     view, change or cancel the stay on the hotel's own booking engine. This one
     — The Royal Garden, booked direct 2026-07-27 — has no family shape to match
     the way 1653715/1653716 does, because a direct booking mints an opaque
     token rather than an account-epoch serial. So it is grepped literally, the
     same treatment the airline PNRs get, and case-insensitively in case a
     bundler ever re-cases a string.
     A SECOND ONE JOINED ON 2026-09-27: Blossom House's OWN confirmation number,
     R9000388217900556001, printed on its Trip.com confirmation email beside the
     Trip.com order number (which the family pattern above already guards). It
     is the property's handle on the stay, so it is the same class of
     credential, and it has no family shape either — so it joins this literal
     alternation rather than getting a pattern of its own. Twenty characters
     with `\b` on both ends cannot collide with anything the bundle carries. */
  { label: 'hotel reservation number', re: /\b(?:cohTex87hq19CnTh|R9000388217900556001)\b/i },
  /* THE CARD LAST FOUR HAS THE PIN'S PROBLEM: `\b3321\b` is a price, a year, a
     port number and four digits of any hash, and a gate that cries wolf gets
     switched off. It only ever travels beside its own label — "MasterCard
     ···3321" in a meta chip, "MasterCard ending 3321" in the source document —
     so the label is required. Four digits identify nobody on their own; four
     digits next to the scheme name identify the card on file. */
  { label: 'card last four beside its scheme', re: /\b(?:master ?card|visa|amex)\b.{0,16}?\b3321\b/i },
  /* THE URBTIX TICKET REFERENCE for the HK Phil concert, bought 2026-08-06 —
     the trip's first ticket and, on 22 Dec, the string that admits you to the
     hall. It is a credential of exactly the class already guarded above: paired
     with the surname it retrieves, re-issues or refunds the seat on URBTIX.
     ONE PATTERN COVERS BOTH NUMBERS. The transaction is 26080616302422701 and
     the ticket reference is that number with 001 appended, so the optional
     group matches either and `\b` on both ends means neither matches inside a
     longer digit run. Measured, not assumed: `26080616302422701` and
     `26080616302422701001` hit; `260806163024227010010`,
     `126080616302422701` and `2608061630242270100` miss. */
  { label: 'URBTIX ticket reference', re: /\b26080616302422701(?:001)?\b/ },
  { label: 'e-ticket number', re: /\b607\s?2417267029\b/ },
  { label: 'airline PNR', re: /\b(PLF8S9|NGNRZ1|MZ904B)\b/ },
  { label: 'gift-card number', re: /\b2870[\s-]?6769[\s-]?9755\b/ },
  { label: 'Etihad Guest number', re: /\b600023186044\b/ },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let failures = 0;
/* The Android build copies dist/ into the apk — scan that copy too, so a stale
   or hand-edited bundle can never ship personal data inside the app. */
const androidAssets = join(here, '..', 'android', 'app', 'src', 'main', 'assets');
const roots = [dist, ...(existsSync(androidAssets) ? [androidAssets] : [])];
const files = roots.flatMap(walk);
const textFiles = files.filter((f) => /\.(html|js|css|json|webmanifest|svg|txt|map)$/i.test(f));

for (const file of textFiles) {
  const body = readFileSync(file, 'utf8');
  for (const { label, re } of FORBIDDEN) {
    if (re.test(body)) {
      console.error(`✗ ${label} found in ${file.replace(repo, '')}`);
      failures++;
    }
  }
}

/* Any identifier-shaped token from the Israeli-passport line must be absent
   from dist AND from the seed — read from the source so it is never written
   down in this repo's code. */
const israeliLines = readFileSync(handoffPath, 'utf8').split('\n').filter((l) => /israeli/i.test(l));
const frenchPassport = /\b23AD\d{5}\b/.exec(readFileSync(seedPath, 'utf8'))?.[0];
const israeliTokens = new Set<string>();
for (const line of israeliLines) {
  for (const tok of line.match(/\b[A-Z0-9]{6,12}\b/gi) ?? []) {
    if (/\d/.test(tok) && tok !== frenchPassport) israeliTokens.add(tok);
  }
}
if (israeliTokens.size === 0) {
  console.error('✗ could not locate the Israeli-passport identifier in the source — check cannot run');
  failures++;
}
const seedText = readFileSync(seedPath, 'utf8');
for (const tok of israeliTokens) {
  for (const file of textFiles) {
    if (readFileSync(file, 'utf8').includes(tok)) {
      console.error(`✗ Israeli passport identifier found in ${file.replace(repo, '')}`);
      failures++;
    }
  }
  if (seedText.includes(tok)) {
    console.error('✗ Israeli passport identifier found in the seed');
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} privacy failure(s). The bundle must never carry personal data.`);
  process.exit(1);
}

console.log(`✓ ${textFiles.length} built files scanned — no personal data`);
console.log(`✓ Israeli passport identifier absent from dist and seed (${israeliTokens.size} token[s] checked)`);
console.log(`✓ ${FORBIDDEN.length} sensitive patterns checked`);
