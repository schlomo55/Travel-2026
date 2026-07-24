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
  { label: 'Trip.com booking number', re: /\b1653716\d{9}\b/ },
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
