/* THE PROTOMAPS API KEY (online map, 7 Nov 2026) — the owner's, for the
   Android app's online street tiles (lib/map/street/online.ts). Not personal
   data, but this repository is public and the key must never be in it: it is
   read from a file OUTSIDE the repo, on the build machine,

     ~/.ltd-private/protomaps.key   (override: LTD_PROTOMAPS_KEY_FILE)

   by vite.config.ts — only for the Android build (dist-android/, git-ignored)
   and the dev server — and by the privacy gate, which proves the committed
   dist/ does not carry it. Its value is never printed. A missing file is
   fine: the app builds without online tiles, everything else as before. */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MAP_KEY_FILE = process.env.LTD_PROTOMAPS_KEY_FILE ?? join(homedir(), '.ltd-private', 'protomaps.key');

/** The key, or '' when this machine has none. */
export function loadMapKey(): string {
  try {
    return existsSync(MAP_KEY_FILE) ? readFileSync(MAP_KEY_FILE, 'utf8').trim() : '';
  } catch {
    return '';
  }
}
