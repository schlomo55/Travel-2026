/* The three cover images.

   Abstract gradients, not photographs: this is a fabricated trip and a real
   photo of a real place would be the one thing in it pretending to be true.
   They are generated here from pure integer maths — no randomness, no network,
   no committed binary — so two runs of the builder produce identical bytes.

   sharp is already a devDependency (scripts/fetch-photos.ts uses it for the
   China photos), so nothing new is installed to make these. */
import sharp from 'sharp';

const W = 1200;
const H = 800;

type RGB = readonly [number, number, number];

export interface GeneratedImage {
  key: string;
  buffer: Buffer;
}

interface GradientSpec {
  key: string;
  from: RGB;
  to: RGB;
  /** Phase of the soft band overlay, in radians — keeps the three distinct. */
  phase: number;
}

const SPECS: GradientSpec[] = [
  /* teal → sand: the shelf cover */
  { key: 'cover', from: [14, 82, 96], to: [232, 213, 168], phase: 0 },
  /* limestone: deep olive → pale gold */
  { key: 'jerusalem', from: [46, 40, 28], to: [230, 207, 156], phase: 1.9 },
  /* desert: burnt red → ochre */
  { key: 'negev', from: [92, 38, 18], to: [232, 167, 101], phase: 3.7 },
];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function render(spec: GradientSpec): Buffer {
  const buf = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      /* Diagonal ramp, weighted so the sweep runs corner to corner. */
      const ramp = fx * 0.62 + fy * 0.38;
      /* Two out-of-phase sine bands: enough structure that it does not read as
         a flat CSS gradient, smooth enough to stay tiny once encoded. */
      const band =
        0.055 * Math.sin(fx * Math.PI * 3 + fy * Math.PI * 1.5 + spec.phase) +
        0.028 * Math.sin(fy * Math.PI * 5 - fx * Math.PI * 2 + spec.phase * 1.7);
      /* Gentle corner falloff so the edges do not glare. */
      const dx = fx - 0.5;
      const dy = fy - 0.5;
      const vignette = 1 - 0.26 * (dx * dx + dy * dy) * 4;
      const k = Math.min(1, Math.max(0, ramp + band));
      const i = (y * W + x) * 3;
      buf[i] = clamp((spec.from[0] + (spec.to[0] - spec.from[0]) * k) * vignette);
      buf[i + 1] = clamp((spec.from[1] + (spec.to[1] - spec.from[1]) * k) * vignette);
      buf[i + 2] = clamp((spec.from[2] + (spec.to[2] - spec.from[2]) * k) * vignette);
    }
  }
  return buf;
}

export async function buildImages(): Promise<GeneratedImage[]> {
  const out: GeneratedImage[] = [];
  for (const spec of SPECS) {
    const raw = render(spec);
    const buffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    out.push({ key: spec.key, buffer });
  }
  return out;
}
