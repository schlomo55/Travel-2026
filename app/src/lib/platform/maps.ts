/* Handing a place to a map app.

   ONE button, because the phone is better at this than we are: a `geo:` URI
   is the Android intent every map app registers for, so the system offers its
   own chooser the first time and remembers the answer. Google Maps, Amap,
   Organic Maps, Waze — whichever the owner picks stays picked.

   Same shape as files.ts: the web path is a plain window.open, the native path
   goes through a Capacitor plugin because an Android WebView refuses <a href>
   to a custom scheme. In a desktop browser `geo:` opens nothing at all, so the
   web path skips it and goes straight to the Google Maps https link.

   The plugin is imported dynamically so the web bundle never carries it. */
import { isNative } from './files';
import {
  amapAppSearchUrl,
  isHongKongOrMacau,
  amapAppUrl,
  amapWebSearchUrl,
  amapWebUrl,
  geoUri,
  googleMapsUrl,
  safeMapUrl,
  type MapTarget,
} from '../logic/geo';

function openWeb(url: string): void {
  window.open(url, '_blank', 'noopener');
}

async function openNative(url: string): Promise<boolean> {
  try {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    await AppLauncher.openUrl({ url });
    return true;
  } catch {
    return false;
  }
}

async function canOpenNative(url: string): Promise<boolean> {
  try {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    const { value } = await AppLauncher.canOpenUrl({ url });
    return value;
  } catch {
    return false;
  }
}

/** The one the UI calls. A saved share link opens verbatim; anything else
    goes out as a geo: intent on the phone, and as a Google Maps link on the
    web. If the intent finds no app at all, the https link is the safety net —
    a browser can always show the place. */
export async function openInMaps(target: MapTarget): Promise<void> {
  const saved = safeMapUrl(target.url);
  if (saved) {
    if (!isNative()) return openWeb(saved);
    if (!(await openNative(saved))) openWeb(saved);
    return;
  }
  const fallback = googleMapsUrl(target);
  /* Hong Kong goes straight to Google: Amap centres the right street there but
     has no entry for the landmark itself. Everywhere else the geo: intent lets
     the phone offer its map apps, and Amap wins the mainland. */
  if (isNative() && !isHongKongOrMacau(target)) {
    const geo = geoUri(target);
    if (geo && (await openNative(geo))) return;
  }
  if (!fallback) return;
  if (!isNative()) return openWeb(fallback);
  if (!(await openNative(fallback))) openWeb(fallback);
}

/** Kept for the fallback path and its tests; the UI no longer calls it. */
export async function openInGoogleMaps(target: MapTarget): Promise<void> {
  const url = googleMapsUrl(target);
  if (!url) return;
  if (!isNative()) return openWeb(url);
  if (!(await openNative(url))) openWeb(url);
}

/** Amap: try the installed app first, fall back to its web URI.
    A saved share link is opened as-is; a name goes to POI search; only a
    place with neither falls back to a coordinate marker (datum-shifted). */
export async function openInAmap(target: MapTarget, name: string): Promise<void> {
  const saved = safeMapUrl(target.url);
  if (saved) {
    if (!isNative()) return openWeb(saved);
    if (!(await openNative(saved))) openWeb(saved);
    return;
  }
  const web = amapWebSearchUrl(target) ?? (target.coord ? amapWebUrl(target.coord, name) : null);
  if (!web) return;
  if (!isNative()) return openWeb(web);
  const app = amapAppSearchUrl(target) ?? (target.coord ? amapAppUrl(target.coord, name) : null);
  if (app && (await canOpenNative(app))) {
    if (await openNative(app)) return;
  }
  if (!(await openNative(web))) openWeb(web);
}
