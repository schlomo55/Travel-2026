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

/** stop key → md-lite read-more text, from sources/china-2026/extras/<key>.md.
    Line endings are read as \n whatever the checkout wrote: git stores these
    files with LF, and a Windows checkout (core.autocrlf) hands them over with
    CRLF — which, read verbatim, put \r\n into ten stops' paragraphs and made
    the "byte-identical rebuild" depend on the machine (found 2026-09-28). */
export function readExtras(repoRoot: string): Record<string, string> {
  const dir = join(repoRoot, 'sources', 'china-2026', 'extras');
  const out: Record<string, string> = {};
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md')) continue;
    out[f.replace(/\.md$/, '')] = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n').trim();
  }
  return out;
}

export interface OptionBlockInput {
  heading: string;
  items: string[]; // md-lite; a leading '⭐ ' marks a pick and stays inline
}

/** The tiny authored format of sources/china-2026/options/<key>.md:
      `## Heading` opens a block, `- item` adds a line to it.
    Everything else (blank lines, a leading comment) is ignored. The item text
    is md-lite already — it is NOT run through the legacy HTML converter. */
export function parseOptions(src: string): OptionBlockInput[] {
  const out: OptionBlockInput[] = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      out.push({ heading: line.slice(3).trim(), items: [] });
      continue;
    }
    if (line.startsWith('- ')) {
      const block = out[out.length - 1];
      if (!block) throw new Error(`options: an item appears before any "## heading": ${line}`);
      block.items.push(line.slice(2).trim());
    }
  }
  return out.filter((b) => b.items.length > 0);
}

/** stop key → "All the options" blocks, from sources/china-2026/options/<key>.md. */
export function readOptions(repoRoot: string): Record<string, OptionBlockInput[]> {
  const dir = join(repoRoot, 'sources', 'china-2026', 'options');
  const out: Record<string, OptionBlockInput[]> = {};
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md')) continue;
    out[f.replace(/\.md$/, '')] = parseOptions(readFileSync(join(dir, f), 'utf8'));
  }
  return out;
}
