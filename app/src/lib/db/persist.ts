/* Storage persistence — the defense against Android evicting the vault.
   Called on the first user gesture; installed PWAs on Android Chrome are
   effectively always granted. Result is surfaced on the Backup screen. */
import { getSettings, updateSettings } from '../data/repo';

export async function requestPersistence(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !navigator.storage.persist) return false;
    const already = await navigator.storage.persisted();
    const granted = already || (await navigator.storage.persist());
    const s = await getSettings();
    if (s.persisted !== granted) await updateSettings({ persisted: granted });
    return granted;
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!('storage' in navigator) || !navigator.storage.estimate) return null;
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
