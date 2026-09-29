/* THE PINS, PAINTED (MAPS6) — a 34 px disc (card-2) with a 1.5 px ring and
   the 18 px glyph in the category's colour; the medical disc wears a white
   ring. Today's places carry a still sunrise halo (the board's glow, minus
   its loop: the motion rules allow the ping, the sun and the opal edge, not a
   pin that breathes); tonight's bed a 3 px gap and a sunrise ring, as the
   board draws it. A cluster is the pin of the one category it holds — or a
   quiet mixed pin — with a sunrise "+N" badge (logic/wayfind.ts).

   Drawn once per image with Path2D from lib/map/icons.ts (no sprite file,
   nothing loaded) at the phone's pixel density, and registered with
   addImage. The colours are app.css tokens, read at run time. */
import { GLYPH } from '../icons';
import { clusterBadge } from '../../logic/wayfind';
import { STACK } from './fonts';

export type PinVariant = '' | 'today' | 'tonight';

/** image pixels per CSS pixel: crisp on the S23's ~3.75× screen, capped for memory */
export const PR = Math.min(4, Math.max(2, Math.ceil(typeof devicePixelRatio === 'number' ? devicePixelRatio : 2)));

const SIZE = 46; // room for the tonight ring and the cluster badge round a 34 px disc
const C = SIZE / 2;

function css(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const colourOf = (glyph: string): string => {
  const cat = glyph === 'plane' ? 'transport' : glyph === 'mixed' ? '' : glyph;
  return cat ? css(`--cat-${cat}`, '#f4f2fa') : css('--ink-2', '#b4b3c8');
};

function canvas(): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = SIZE * PR;
  c.height = SIZE * PR;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  ctx.scale(PR, PR);
  return { c, ctx };
}
const pixels = (c: HTMLCanvasElement): ImageData => {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  return ctx.getImageData(0, 0, c.width, c.height);
};

function disc(ctx: CanvasRenderingContext2D, glyph: string, variant: PinVariant): void {
  const colour = colourOf(glyph);
  const sunrise = css('--sunrise', '#ff9f6b');
  if (variant === 'today') {
    const g = ctx.createRadialGradient(C, C, 15, C, C, 23);
    g.addColorStop(0, 'rgba(255,159,107,0.55)');
    g.addColorStop(1, 'rgba(255,159,107,0)');
    ctx.beginPath();
    ctx.arc(C, C, 23, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (variant === 'tonight') {
    ctx.beginPath();
    ctx.arc(C, C, 21.25, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = sunrise;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(C, C, 16.25, 0, Math.PI * 2);
  ctx.fillStyle = css('--card-2', '#1d2035');
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = glyph === 'medical' ? '#ffffff' : variant === 'today' ? sunrise : colour;
  ctx.stroke();
  ctx.save();
  ctx.translate(C - 9, C - 9);
  ctx.scale(0.75, 0.75); // the 24-unit glyph at 18 px, as the SVG draws it
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colour;
  for (const d of GLYPH[glyph] ?? []) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** A pin: `pin-<glyph>[-today|-tonight]`. */
export function pinImage(glyph: string, variant: PinVariant): ImageData {
  const { c, ctx } = canvas();
  disc(ctx, glyph, variant);
  return pixels(c);
}

/** A cluster: its pin and the "+N" badge at the top right. */
export function clusterImage(glyph: string, count: number): ImageData {
  const { c, ctx } = canvas();
  disc(ctx, glyph, '');
  const text = clusterBadge(count);
  ctx.font = `600 11px '${STACK.mono}', ui-monospace, monospace`;
  const w = Math.max(20, ctx.measureText(text).width + 8);
  const x = Math.min(SIZE - w, C + 17 - w / 2 + 4);
  const y = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 10);
  ctx.fillStyle = css('--sunrise-fill', '#ff9f6b');
  ctx.fill();
  ctx.fillStyle = css('--on-sunrise', '#1a0f08');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 10.5);
  return pixels(c);
}

/** OpenStreetMap's own points: a small quiet dot (no sprite). */
export function poiDot(): ImageData {
  const c = document.createElement('canvas');
  c.width = 8 * PR;
  c.height = 8 * PR;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  ctx.scale(PR, PR);
  ctx.beginPath();
  ctx.arc(4, 4, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = css('--edge', '#6a7099');
  ctx.fill();
  return ctx.getImageData(0, 0, c.width, c.height);
}

export const PIN_GLYPHS = ['food', 'spa', 'sight', 'show', 'shopping', 'hotel', 'transport', 'plane', 'medical'] as const;
