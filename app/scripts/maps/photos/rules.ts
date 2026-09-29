/* THE PHOTO PASS'S RULES (Map 5e) — pure, unit-tested (src/tests/placephotos.test.ts).

   WHICH LICENCES. The owner's list, and nothing else: CC0, public domain, CC BY
   and CC BY-SA, any version (the port and "migrated" variants included). Not
   GFDL alone, not the Free Art License, not Commons' generic "Attribution" or
   "copyrighted free use" templates, never NC or ND, never a file Commons marks
   non-free. Decided on Commons' own machine-readable licence code first
   (extmetadata `License`), its short name second — a file carrying no code the
   list names is refused.

   WHO TOOK IT. Commons gives the author as HTML (a user link, a Flickr link, a
   credit line); the credit is its plain text — tags dropped, entities decoded,
   white space collapsed. Nothing is added to it and nothing is guessed.

   THE ABOUT TEXT IS WIKIPEDIA'S, VERBATIM: the first one to three sentences of
   the article's own summary (the REST summary's `extract`), cut only at the end
   of a sentence — never inside one, never reworded. A sentence end is ". ",
   "! " or "? " followed by a capital, a digit or a quote, and not after an
   abbreviation or an initial ("St.", "c.", "U.S.", "J.") . The cut text is a
   prefix of the extract, character for character (the test proves it for
   every place). */

export interface LicenceIn {
  /** extmetadata License — "cc-by-sa-4.0", "cc0", "pd", "gfdl" … */
  code?: string;
  /** extmetadata LicenseShortName — "CC BY-SA 4.0", "Public domain" … */
  short?: string;
  /** extmetadata NonFree */
  nonFree?: string | boolean;
}
export type LicenceOut = { ok: true; licence: string; kind: 'cc0' | 'pd' | 'by' | 'by-sa' } | { ok: false; why: string };

const CC = /^cc-(by|by-sa)-(\d(?:\.\d)?)(?:-[a-z0-9-]+)?$/i;

/** Is this licence on the owner's list? Its short name as the credit prints it. */
export function licenceOf(l: LicenceIn): LicenceOut {
  if (l.nonFree === true || String(l.nonFree ?? '').toLowerCase() === 'true') return { ok: false, why: 'Commons marks it non-free' };
  const code = (l.code ?? '').trim().toLowerCase();
  const short = (l.short ?? '').trim();
  if (/-nc\b|-nd\b|\bnc\b|\bnd\b/i.test(code) || /\bNC\b|\bND\b|NonCommercial|NoDerivs/i.test(short)) return { ok: false, why: `a non-commercial or no-derivatives licence (${short || code})` };
  const m = CC.exec(code);
  if (m) {
    const kind = m[1]!.toLowerCase() === 'by' ? 'by' : 'by-sa';
    return { ok: true, licence: `CC ${kind.toUpperCase()} ${m[2]}`, kind };
  }
  if (code === 'cc0' || /^cc0\b/i.test(short) || /^CC Zero$/i.test(short)) return { ok: true, licence: 'CC0', kind: 'cc0' };
  if (code === 'pd' || code.startsWith('pd-') || /^public domain$/i.test(short)) return { ok: true, licence: 'Public domain', kind: 'pd' };
  /* no code: the short name alone, exactly in the list's form */
  if (!code) {
    const s = /^CC (BY|BY-SA) (\d(?:\.\d)?)(?: [A-Za-z-]+)?$/.exec(short);
    if (s) return { ok: true, licence: `CC ${s[1]} ${s[2]}`, kind: s[1] === 'BY' ? 'by' : 'by-sa' };
  }
  return { ok: false, why: `not on the list (CC0, PD, CC BY, CC BY-SA): ${short || code || 'no licence given'}` };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** HTML (Commons' Artist, Credit) as plain text. */
export function plainText(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (all, e: string) => {
      if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith('#') && /^#\d+$/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Can this author line credit a photo? Not when Commons gives no name: an
    empty field, a bare footnote link ("[2]" — a Flickr account linked with
    no name), or its own "no machine-readable author" notice. A photo whose
    author cannot be named is not used (unless it is CC0 or public domain,
    where no credit is owed — it is still given when there is one). */
export function creditable(author: string): boolean {
  const a = author.trim();
  return !!a && !/^\[\d+\]$/.test(a) && !/no machine-readable author/i.test(a) && !/^unknown author/i.test(a);
}

/* the words a sentence may not end on: abbreviations and initials */
const ABBR = /(?:\b(?:St|Mt|Ft|Dr|Mr|Mrs|Ms|No|Nos|Jr|Sr|Co|Corp|Inc|Ltd|vs|etc|approx|ca|c|cf|al|Gen|Col|Capt|Lt|Sgt|Rev|Prof|Ave|Rd|Blvd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|km|sq|ft|lb|oz|e\.g|i\.e|a\.m|p\.m|U\.S|U\.K|D\.C)|\b[A-Z])$/;

/** Where each sentence of a text ends (the index just after its terminator).
    Wikipedia now and then drops the space after a full stop ("…within its
    vicinity.It intersects…"): a stop between a lower-case word and a
    capitalised one ends a sentence too. */
export function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const re = /[.!?](?:["”’')\]]*)(?=\s+["“‘(]?[A-Z0-9一-鿿]|\s*$)|(?<=[a-z]{3})\.(?=[A-Z][a-z])/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const at = m.index + m[0].length;
    const before = text.slice(0, m.index);
    if (m[0][0] === '.' && ABBR.test(before)) continue;
    ends.push(at);
  }
  return ends;
}

export const ABOUT_MAX = 380;

/** The first 1–3 sentences of Wikipedia's own summary, verbatim: as many as
    fit in ABOUT_MAX characters (always the first, however long), and never
    past the summary's first paragraph. */
export function aboutText(extract: string, max = ABOUT_MAX): string {
  const text = (extract.trim().split(/\n/)[0] ?? '').trim();
  const ends = sentenceEnds(text);
  if (!ends.length) return text;
  let cut = ends[0]!;
  for (const e of ends.slice(1, 3)) {
    /* never past Wikipedia's own missing space: the next sentence would show it */
    if (e > max || /^\S/.test(text.slice(cut))) break;
    cut = e;
  }
  return text.slice(0, cut).trim();
}
