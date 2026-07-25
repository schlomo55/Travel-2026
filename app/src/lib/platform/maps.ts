/* Handing a coordinate to a map app.

   Same shape as files.ts: the web path is a plain window.open, the native path
   goes through a Capacitor plugin because an Android WebView refuses <a href>
   to a custom scheme such as androidamap://. AppLauncher.canOpenUrl tells us
   whether Amap is actually installed; if it is not, the https URI still opens
   Amap's web marker page (or the phone's browser).

   The plugin is imported dynamically so the web bundle never carries it. */
import { isNative } from './files';
import {
  amapAppSearchUrl,
  amapAppUrl,
  amapWebSearchUrl,
  amapWebUrl,
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
