/* A LINK OUT OF THE APP (Map 5e) — Wikipedia, a place's official site, a
   photo's file page, a licence. They are the only things on the Map tab that
   need the internet, and they open OUTSIDE the app: in the phone's browser
   (Capacitor's AppLauncher — an Android WebView keeps a plain link to itself,
   the way it refuses a map app's scheme: platform/maps.ts), in a new tab on
   the web. Only http(s) goes out; anything else is not a link. */
import { isNative } from './files';

export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  if (!isNative()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  try {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    await AppLauncher.openUrl({ url });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

/** For an <a href>: a real link (its address on a long press, its role for a
    screen reader), opened the app's way on a tap. */
export function external(e: MouseEvent, url: string): void {
  e.preventDefault();
  void openExternal(url);
}
