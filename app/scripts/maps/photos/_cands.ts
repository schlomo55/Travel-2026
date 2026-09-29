import { readFileSync } from 'node:fs';
import { photoPlaces } from './places';
import { readCache } from './net';
import { licenceOf } from './rules';
const seed = JSON.parse(readFileSync('../seed/china-2026.trip.json', 'utf8'));
const C = readCache<Record<string, any[]>>('candidates.json')!;
let none = 0, few = 0;
for (const p of photoPlaces(seed)) {
  const all = C[p.id] ?? [];
  const ok = all.filter((c) => licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree }).ok);
  if (ok.length >= 2) continue;
  if (!ok.length) none++; else few++;
  console.log(`${ok.length}/${all.length} ${p.id} — ${p.name} ${p.native ?? ''} [${p.category}] ${all.map((c) => c.via.slice(0, 14) + ':' + (c.licenceShort ?? c.licenceCode)).join(' | ')}`);
}
console.log({ none, few });
