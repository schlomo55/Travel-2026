/* Reads the committed photo + read-more inputs for the China seed.
   Shared by build-china-seed, seed.test and the parity audit so they can
   never drift apart. No network — everything comes from sources/. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLACE_PHOTOS } from './photos';

export interface PhotoInput {
  key: string;
  base64: string;
  size: number;
}

export function readPhotoInputs(repoRoot: string): PhotoInput[] {
  const dir = join(repoRoot, 'sources', 'china-2026', 'images');
  return PLACE_PHOTOS.map(({ stopKey }) => {
    const buf = readFileSync(join(dir, `${stopKey}.webp`));
    return { key: stopKey, base64: buf.toString('base64'), size: buf.byteLength };
  });
}

/** stop key → md-lite read-more text, from sources/china-2026/extras/<key>.md. */
export function readExtras(repoRoot: string): Record<string, string> {
  const dir = join(repoRoot, 'sources', 'china-2026', 'extras');
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md')) continue;
    out[f.replace(/\.md$/, '')] = readFileSync(join(dir, f), 'utf8').trim();
  }
  return out;
}
