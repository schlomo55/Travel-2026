/* Extracts the legacy DATA object literal from legacy/index.html and evaluates
   it in a vm sandbox — zero manual transcription, zero transcription errors.
   The literal is pure data (no functions); the legacy file is frozen. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import type { LegacyData } from './legacy-types';

export function extractLegacyData(indexHtmlPath: string): LegacyData {
  const html = readFileSync(indexHtmlPath, 'utf8');
  const startMarker = 'var DATA = {';
  const start = html.indexOf(startMarker);
  if (start < 0) throw new Error(`DATA literal not found in ${indexHtmlPath}`);
  const braceStart = html.indexOf('{', start);
  const endMarker = '\n};';
  const end = html.indexOf(endMarker, start);
  if (end < 0) throw new Error('DATA literal end marker not found');
  const objText = html.slice(braceStart, end + 2); // includes the closing '\n}'
  const data = vm.runInNewContext(`(${objText})`, Object.create(null), { timeout: 5000 }) as LegacyData;
  if (!data || !Array.isArray(data.stops) || !data.trip?.start) {
    throw new Error('Extracted DATA does not look like the legacy trip object');
  }
  return data;
}
