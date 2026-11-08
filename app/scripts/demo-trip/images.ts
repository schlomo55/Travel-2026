/* The demo trip's pictures and its one PDF.

   Abstract gradients, not photographs — a made-up trip should not carry a real
   photo pretending to be its own — generated from integer maths (no
   randomness, no network, no committed binary), so rebuilds are identical.
   The PDF is a one-page "sample e-ticket" written by hand, byte for byte. */
import sharp from 'sharp';

const W = 720;
const H = 480;
type RGB = readonly [number, number, number];
export interface GeneratedFile {
  key: string;
  buffer: Buffer;
}

const SPECS: { key: string; from: RGB; to: RGB; phase: number }[] = [
  { key: 'hangzhou', from: [24, 70, 52], to: [196, 222, 170], phase: 0.4 },
  { key: 'shanghai', from: [20, 24, 60], to: [236, 180, 96], phase: 1.2 },
  { key: 'huangshan', from: [40, 52, 60], to: [214, 224, 230], phase: 2.1 },
  { key: 'chengdu', from: [70, 20, 18], to: [240, 170, 120], phase: 2.9 },
  { key: 'yangshuo', from: [16, 60, 66], to: [170, 220, 200], phase: 3.6 },
  { key: 'longji', from: [50, 70, 20], to: [220, 210, 120], phase: 4.4 },
  { key: 'guilin', from: [36, 30, 70], to: [190, 180, 230], phase: 5.1 },
  { key: 'hongkong', from: [60, 14, 50], to: [250, 190, 210], phase: 5.9 },
];

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function render(s: (typeof SPECS)[number]): Buffer {
  const buf = Buffer.allocUnsafe(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const band = 0.06 * Math.sin(fx * Math.PI * 3 + fy * Math.PI * 1.5 + s.phase) + 0.03 * Math.sin(fy * Math.PI * 5 - fx * Math.PI * 2 + s.phase * 1.7);
      const k = Math.min(1, Math.max(0, fx * 0.6 + fy * 0.4 + band));
      const i = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) buf[i + ch] = clamp(s.from[ch]! + (s.to[ch]! - s.from[ch]!) * k);
    }
  }
  return buf;
}

export async function buildImages(): Promise<GeneratedFile[]> {
  const out: GeneratedFile[] = [];
  for (const s of SPECS) {
    const buffer = await sharp(render(s), { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 70, effort: 4 }).toBuffer();
    out.push({ key: s.key, buffer });
  }
  return out;
}

/** A one-page PDF that says what it is: a sample e-ticket, not a real one. */
export function buildTicketPdf(): Buffer {
  const lines = [
    'SAMPLE E-TICKET - NOT A REAL BOOKING',
    'Demo trip 2027 - every flight on one page',
    'AY 1501  CDG 11:05 -> HEL 15:20   19 MAR',
    'AY 9057  HEL 17:30 -> PVG 08:50+1 19 MAR',
    'MU 5001  SHA 19:10 -> TXN 20:25   04 APR',
    '3U 9001  TXN 14:30 -> CTU 17:10   07 APR',
    '3U 9003  CTU 20:20 -> KWL 22:00   09 APR',
    'CZ 9005  KWL 13:50 -> HKG 15:35   13 APR',
    'AY 9070  HKG 23:55 -> HEL 06:05+1 17 APR',
    'AY 1506  HEL 08:00 -> CDG 09:40   18 APR',
    'Booking DEMOAY - sample data only',
  ];
  const text = ['BT', '/F1 14 Tf', '50 780 Td', '18 TL', ...lines.map((l) => `(${l}) Tj T*`), 'ET'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
