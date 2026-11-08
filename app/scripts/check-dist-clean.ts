/* The deployed bundle must contain ZERO personal data — that is the structural
   privacy fix over the legacy app, where a passport number sat in the HTML at a
   guessable URL. This greps every built file (and every seed) for values that lived in
   the real trip's documents, and fails the build if any leaked in.
   Run: npm run check:dist (also part of `npm run deploy`); the Android build
   (npm run build:android) runs it on dist-android/.

   THE ONLINE MAP'S KEY (7 Nov 2026) is checked here too: dist/ is committed to
   a public repository, so the Protomaps key must never be in it. It is read
   from its private file (scripts/privacy/map-key.ts) and its value is never
   printed. dist-android/ carries it on purpose and is git-ignored. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrivateIds } from './privacy/private-ids';
import { loadMapKey, MAP_KEY_FILE } from './privacy/map-key';
import { FORBIDDEN } from './privacy/forbidden';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
/* dist/ (the committed, public build) unless told: `check-dist-clean.ts dist-android` */
const outName = process.argv[2] ?? 'dist';
const dist = join(here, '..', outName);

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

/* Both passport numbers — Israeli and French — must be absent from dist AND
   from every seed. They are read from private files outside the repo (see
   privacy/private-ids.ts), so they are never written down here. A missing
   file is reported SKIPPED, never passed. Since the real China trip left the
   repository (Nov 2026) the seeds are the made-up demo trip, the Israel test
   trip and the template example — all fabricated, and all held to the same
   patterns as dist/ above. */
const listText = (dir: string, re: RegExp): string[] =>
  existsSync(dir) ? readdirSync(dir).map((f) => join(dir, f)).filter((f) => statSync(f).isFile() && re.test(f)) : [];
const repoFiles = listText(join(repo, 'seed'), /\.json$/i);
for (const file of repoFiles) {
  const body = readFileSync(file, 'utf8');
  for (const { label, re } of FORBIDDEN) {
    if (re.test(body)) {
      console.error(`✗ ${label} found in ${file.replace(repo, '')}`);
      failures++;
    }
  }
}
const privateIds = loadPrivateIds();
for (const id of privateIds) {
  if (!id.value) continue;
  for (const file of [...textFiles, ...repoFiles]) {
    if (readFileSync(file, 'utf8').includes(id.value)) {
      console.error(`✗ ${id.label} found in ${file.replace(repo, '')}`);
      failures++;
    }
  }
}

/* the Protomaps key: never in the committed dist/ (the Android build carries it on purpose) */
const mapKey = loadMapKey();
if (outName === 'dist' && mapKey) {
  for (const file of walk(dist)) {
    if (readFileSync(file).includes(mapKey)) {
      console.error(`✗ the Protomaps API key found in ${file.replace(repo, '')} — dist/ is committed and public; build the app with npm run build:android`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} privacy failure(s). The bundle must never carry personal data.`);
  process.exit(1);
}

console.log(`✓ ${textFiles.length} built files scanned — no personal data`);
for (const id of privateIds) {
  if (id.value) console.log(`✓ ${id.label} absent from dist and the seeds (${repoFiles.length} seed files)`);
  else console.warn(`⚠ ${id.label} check SKIPPED — no private file at ${id.file}`);
}
console.log(`✓ ${FORBIDDEN.length} sensitive patterns checked`);
if (outName !== 'dist') console.log(`· the Protomaps key is allowed in ${outName}/ (the Android build, git-ignored)`);
else if (mapKey) console.log('✓ the Protomaps API key absent from dist/');
else console.warn(`⚠ Protomaps key check SKIPPED — no private file at ${MAP_KEY_FILE}`);
