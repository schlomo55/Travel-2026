import { readFileSync } from 'node:fs';
import { photoPlaces } from './places';
import { readCache } from './net';
import { licenceOf } from './rules';
const seed = JSON.parse(readFileSync('../seed/china-2026.trip.json', 'utf8'));
const C = readCache<Record<string, any[]>>('candidates.json')!;
for (const p of photoPlaces(seed)) {
  const all = C[p.id] ?? [];
  const lines = all.slice(0, 6).map((c, i) => {
    const l = licenceOf({ code: c.licenceCode, short: c.licenceShort, nonFree: c.nonFree });
    return `   ${i + 1}. ${c.file.replace('File:', '').slice(0, 70)} | ${l.ok ? l.licence : 'NO ' + (c.licenceShort ?? c.licenceCode)} | ${String(c.author).slice(0, 30)} | ${c.w}x${c.h}${c.km !== undefined ? ' | ' + c.km + ' km' : ''} | ${c.via.slice(0, 40)}${c.restrictions ? ' | R:' + c.restrictions : ''}`;
  });
  console.log(`${p.id} — ${p.name} ${p.native ?? ''}\n${lines.join('\n')}`);
}
