import { getJson } from './net';
for (const q of ['丽江古城', 'Old Town of Lijiang', '大理古城', 'Dali Old Town']) {
  const lang = /[一-鿿]/.test(q) ? 'zh' : 'en';
  const r = await getJson<{ search?: { id: string; label?: string; description?: string }[] }>(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=${lang}&uselang=en&limit=6&search=${encodeURIComponent(q)}`);
  console.log(q, '→', (r?.search ?? []).map((s) => `${s.id} ${s.label ?? ''} (${s.description ?? ''})`).join(' | '));
}
