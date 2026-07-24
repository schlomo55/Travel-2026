/* Handing a coordinate to a map app.

   Same shape as files.ts: the web path is a plain window.open, the native path
   goes through a Capacitor plugin because an Android WebView refuses <a href>
   to a custom scheme such as androidamap://. AppLauncher.canOpenUrl tells us
   whether Amap is actually installed; if it is not, the https URI still opens
   Amap's web marker page (or the phone's browser).

   The plugin is imported dynamically so the web bundle never carries it. */
import { isNative } from './files';
import { amapAppUrl, amapWebUrl, googleMapsUrl } from '../logic/geo';
import type { Coord } from '../model/types';

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

export async function openInGoogleMaps(coord: Coord): Promise<void> {
  const url = googleMapsUrl(coord);
  if (!isNative()) return openWeb(url);
  if (!(await openNative(url))) openWeb(url);
}

/** Amap: try the installed app first (correct datum), fall back to its web URI. */
export async function openInAmap(coord: Coord, name: string): Promise<void> {
  const web = amapWebUrl(coord, name);
  if (!isNative()) return openWeb(web);
  const app = amapAppUrl(coord, name);
  if (await canOpenNative(app)) {
    if (await openNative(app)) return;
  }
  if (!(await openNative(web))) openWeb(web);
}
