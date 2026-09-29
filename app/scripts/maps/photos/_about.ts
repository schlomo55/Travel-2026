import { readFileSync } from 'node:fs';
import { photoPlaces } from './places';
import { readCache } from './net';
import { aboutText } from './rules';
const seed = JSON.parse(readFileSync('../seed/china-2026.trip.json', 'utf8'));
const items = readCache<Record<string, any>>('items.json')!;
const sums = readCache<Record<string, any>>('summaries.json')!;
for (const p of photoPlaces(seed)) {
  const it = p.wd ? items[p.wd] : undefined;
  const s = p.wd ? sums[p.wd] : undefined;
  console.log(`\n## ${p.id} — ${p.name} ${p.native ?? ''} [${p.wd ?? '-'} ${it?.en ?? ''} / ${it?.zh ?? ''}] enwiki=${it?.enwiki ?? '-'} type=${s?.type ?? '-'} p856=${(it?.p856 ?? []).join(' ')} p625=${it?.p625 ? it.p625.lat.toFixed(4)+','+it.p625.lng.toFixed(4) : '-'} pin=${p.pos.lat.toFixed(4)},${p.pos.lng.toFixed(4)}`);
  if (s?.extract) console.log('   ABOUT: ' + aboutText(s.extract));
}
