/* Getting a file OUT of the app.

   On the web an anchor with `download` is all it takes. Inside an Android
   WebView that silently does nothing, and so does window.open() on a blob URL —
   which would quietly break backup export, CSV, .ics and viewing an attached
   PDF. So on native we write the bytes into the app's cache and hand the file
   to Android's share sheet, which is also exactly the gesture you want for a
   backup: mail it to yourself.

   The plugins are imported dynamically so the web bundle never carries them. */
import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000; // avoid blowing the argument limit on a big PDF
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

/** Android dislikes some characters in cache filenames. */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

function webDownload(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function nativeShare(name: string, blob: Blob, dialogTitle: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const path = safeName(name);
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path });
  await Share.share({ title: name, dialogTitle, files: [uri] });
}

/** Save a generated file — a backup, a CSV, an .ics. */
export async function saveFile(name: string, blob: Blob, dialogTitle = 'Save or send'): Promise<void> {
  if (isNative()) await nativeShare(name, blob, dialogTitle);
  else webDownload(name, blob);
}

/** Open a stored document. Images are rendered in-app by the caller; this is
    the path for anything the app cannot draw itself, such as a PDF. */
export async function openFile(name: string, blob: Blob): Promise<void> {
  if (isNative()) await nativeShare(name, blob, 'Open with');
  else {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
