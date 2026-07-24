/* md-lite: the only rich text Sojourn stores or renders.
   Supported: **bold**, *italic*, [label](http/https url), newlines.
   renderMdlite() escapes EVERYTHING first, so imported content can never
   inject markup. htmlToMdlite() is the one-way converter used by the seed
   builder for the legacy app's inline HTML strings. */

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}

/** md-lite → safe HTML (inline; newlines become <br>). */
export function renderMdlite(src: string): string {
  let out = escapeHtml(src);
  // links first: [label](https://…) — url already escaped; only allow http(s)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>');
  out = out.replace(/\n/g, '<br>');
  return out;
}

/** Plain-text projection (for titles, .ics, CSV). */
export function mdliteToText(src: string): string {
  return src
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1$2');
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&middot;': '·',
};

/** Legacy inline HTML (<b>, <a href>, <br>, entities) → md-lite. One-way, seed-builder only. */
export function htmlToMdlite(html: string): string {
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  s = s.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  s = s.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  s = s.replace(/<a\s[^>]*href=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi, (_m, h1: string, h2: string, label: string) => {
    const href = h1 || h2 || '';
    return href.startsWith('http') ? `[${label}](${href})` : label;
  });
  s = s.replace(/<sup>([\s\S]*?)<\/sup>/gi, '$1');
  s = s.replace(/<[^>]+>/g, ''); // strip anything else, keep inner text
  s = s.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
  return s;
}
