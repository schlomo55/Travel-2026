import { readFileSync } from 'node:fs';
import { photoPlaces } from './places';
const seed = JSON.parse(readFileSync('../seed/china-2026.trip.json', 'utf8'));
const ps = photoPlaces(seed);
console.log(ps.length, 'drawn places;', ps.filter((p) => p.wd).length, 'with a Map 5a item');
for (const p of ps) console.log([p.id, p.city, p.category, p.name, p.native ?? '', p.wd ?? '-', p.ids.length > 1 ? `+${p.ids.slice(1).join(',')}` : ''].join(' | '));
