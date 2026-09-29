/* THE MAP'S LETTERS, DRAWN BY THE PHONE — no glyph files.

   With no `glyphs` URL in the style, MapLibre (5.x and 6.x) draws every label
   itself with TinySDF from CSS fonts: `text-font` "is interpreted as a
   cascading fallback list of local font names" (the style spec). The weight is
   read from the FIRST name ("SemiBold" → 600, "Italic" → italic), so each
   stack name below is registered as a family of its own, pointing at the very
   woff2 files the app already ships (src/horizon-fonts.css: Figtree's latin
   normal and italic, Martian Mono's latin standard) — no new asset, no
   download. Chinese falls through to the phone's own CJK face (Noto Sans CJK
   on Android), which is why nothing Chinese is ever shipped.

   The faces MUST be loaded before the first glyph is drawn: a glyph drawn
   while its face is still loading is drawn in the fallback and kept for the
   session. The spike's finding; its code. */
import figNormal from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url';
import figItalic from '@fontsource-variable/figtree/files/figtree-latin-wght-italic.woff2?url';
import martian from '@fontsource-variable/martian-mono/files/martian-mono-latin-standard-normal.woff2?url';

export const STACK = {
  regular: 'Figtree Regular',
  bold: 'Figtree SemiBold',
  italic: 'Figtree Italic',
  mono: 'Martian Mono Regular',
} as const;

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

let loaded: Promise<void> | null = null;

/** Register and load the four faces once; resolves when they can draw. */
export function loadMapFonts(): Promise<void> {
  loaded ??= (async () => {
    const spec: [string, string, string][] = [
      [STACK.regular, figNormal, 'normal'],
      [STACK.bold, figNormal, 'normal'],
      [STACK.italic, figItalic, 'italic'],
      [STACK.mono, martian, 'normal'],
    ];
    const faces = spec.map(
      ([family, url, style]) =>
        new FontFace(family, `url(${url}) format('woff2')`, { weight: '300 900', style, unicodeRange: LATIN, display: 'block' }),
    );
    for (const f of faces) document.fonts.add(f);
    await Promise.all(faces.map((f) => f.load().catch(() => undefined)));
  })();
  return loaded;
}
