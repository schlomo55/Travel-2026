/* THE MAP'S GLYPHS (Map 5c) — the Map tab design's category icon set, exactly, and the
   Map tab's own controls: 24 × 24, stroke 1.8, round caps and joins. One
   source for both places they are drawn — as SVG in the tab (MapIcon.svelte)
   and as Path2D on the pins the map engine paints (street/pins.ts) — so a pin
   and its chip can never disagree. A <rect> or <circle> is written as a path
   here, so every glyph is a list of path data. A glyph Horizon's icon set
   (components/horizon/iconpaths.ts) already draws is borrowed from it, P(…),
   so the same drawing ships once.

   THE CATEGORY COLOURS are tokens (app.css `--cat-*`, tokens.json): the tab
   reads them as CSS, the engine reads the same custom properties at run time,
   and the contrast gate measures them on the pin's disc. Status colours
   (ok / warn / crit) stay reserved for bookings — never a place type. */
import type { PlaceCategory } from '../model/types';
import { iconPaths as P } from '../components/horizon/iconpaths';

const rect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}Z`;
const circle = (cx: number, cy: number, r: number): string => `M${cx + r} ${cy}a${r} ${r} 0 1 1 -${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0Z`;

export const GLYPH: Record<string, string[]> = {
  food: ['M4 11h16a8 8 0 0 1-16 0Z', 'M6 19h12', 'm14 3-4 7', 'm18 3-4 7'],
  spa: ['M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z', 'M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5'],
  sight: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  show: P('ticket'),
  shopping: ['M6 7h12l-1 13H7L6 7Z', 'M9 7a3 3 0 0 1 6 0'],
  hotel: P('bed'),
  transport: ['M8 3.1V7a4 4 0 0 0 8 0V3.1', 'm9 15-1-1', 'm15 15 1-1', 'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z', 'm8 19-2 3', 'm16 19 2 3'],
  plane: P('plane'),
  medical: [rect(3, 3, 18, 18, 4), 'M12 8v8', 'M8 12h8'],
  mixed: [circle(7, 8, 2.5), circle(17, 8, 2.5), circle(12, 16.5, 2.5)],
  /* the tab's controls */
  rings: [circle(12, 12, 2), circle(12, 12, 6), circle(12, 12, 10)],
  navigate: ['M3 11 22 2l-9 19-2-8-8-2z'],
  sliders: ['M4 6h9', 'M17 6h3', circle(15, 6, 2), 'M4 12h3', 'M11 12h9', circle(9, 12, 2), 'M4 18h11', 'M19 18h1', circle(17, 18, 2)],
  'arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
  plus: P('plus'),
  minus: ['M5 12h14'],
  search: [circle(11, 11, 7), ...P('search')],
  close: P('close'),
  back: P('chevron-left'),
  car: [...P('car'), circle(7, 17, 2), circle(17, 17, 2)],
  external: P('external'),
  /* Map 5e: a photo, full screen; the places' sheet folded away and back */
  expand: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
  'chevron-down': P('chevron-down'),
  'chevron-up': P('chevron-up'),
  copy: [rect(9, 9, 12, 12, 2), ...P('copy')],
  check: P('check'),
  list: P('list'),
  pin: [...P('pin'), circle(12, 10, 3)],
};

/** A place's glyph: its category's — an airport flies the plane. */
export function glyphOf(category: PlaceCategory, name = '', native = ''): string {
  if (category === 'transport' && /\bairport\b|\([A-Z]{3}\)|机场/i.test(`${name} ${native}`)) return 'plane';
  return category;
}

/** A category's colour as CSS — each a literal var() of its token, so the
    contrast gate's dangling-var() check sees every one. */
const CAT_COLOUR: Record<PlaceCategory, string> = {
  food: 'var(--cat-food)',
  spa: 'var(--cat-spa)',
  sight: 'var(--cat-sight)',
  show: 'var(--cat-show)',
  shopping: 'var(--cat-shopping)',
  hotel: 'var(--cat-hotel)',
  transport: 'var(--cat-transport)',
  medical: 'var(--cat-medical)',
};
export const catColour = (c: PlaceCategory): string => CAT_COLOUR[c] ?? 'var(--ink-2)';
