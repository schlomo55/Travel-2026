/* A PHOTO FROM THE MAP PACK, AS SOMETHING AN <img> CAN SHOW (Map 5e) — read
   lazily, one slice of the pack File per image (no copy: the slice is the
   file on the phone), handed out as an object URL, and revoked once nothing
   shows it: every URL is counted out and back in, and the last one back is
   revoked after a moment (a card that is drawn again at once keeps its URL,
   rather than reading the photo twice). How many are live is said on the
   document (data-photo-urls) — the rehearsal checks they go. */
import { spanBytes, type PhotoIndex, type PhotoSpan } from '../logic/placephotos';

const KEEP_MS = 1500;
const live = new Map<string, { url: string; n: number; timer?: ReturnType<typeof setTimeout> }>();
const say = (): void => {
  if (typeof document !== 'undefined') document.documentElement.dataset.photoUrls = String(live.size);
};
const keyOf = (f: File, s: PhotoSpan): string => `${f.size}:${f.lastModified}:${s[0]}`;

/** The image's bytes, as a Blob (a slice of the pack: nothing is read yet). */
export function photoBlob(f: File, index: Pick<PhotoIndex, 'base'>, s: PhotoSpan): Blob {
  const [a, b] = spanBytes(index, s);
  return f.slice(a, b, 'image/webp');
}

/** A URL for the image — hand it back with `release` when it is no longer shown. */
export function acquire(f: File, index: Pick<PhotoIndex, 'base'>, s: PhotoSpan): string {
  const k = keyOf(f, s);
  const e = live.get(k);
  if (e) {
    if (e.timer) clearTimeout(e.timer);
    delete e.timer;
    e.n++;
    return e.url;
  }
  const url = URL.createObjectURL(photoBlob(f, index, s));
  live.set(k, { url, n: 1 });
  say();
  return url;
}

export function release(f: File, s: PhotoSpan): void {
  const k = keyOf(f, s);
  const e = live.get(k);
  if (!e || --e.n > 0) return;
  e.timer = setTimeout(() => {
    if (e.n > 0) return;
    URL.revokeObjectURL(e.url);
    live.delete(k);
    say();
  }, KEEP_MS);
}

/** How many photo URLs are live now (the tests read it). */
export const liveUrls = (): number => live.size;

/** Where a screen's photos come from: the pack on this phone and its index. */
export interface PhotoSource {
  file: File;
  index: PhotoIndex;
}
