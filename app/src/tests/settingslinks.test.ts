/* A VISIBLE WAY TO SETTINGS AND BACKUP (10 Nov 2026). Now's and the Pocket's
   bar carry a gear (components/horizon/AppBar.svelte) and the Pocket's tile
   grid a Backup tile (PocketHome.svelte); both are plain links — the app's own
   history holds the way back, so Back returns to the screen they were tapped
   on. This pins the two addresses they link to: each must be the canonical
   hash of a route the app resolves, or the address bar would be rewritten
   (router.start) and the entry the link made would be replaced under it. */
import { describe, expect, it } from 'vitest';
import { parseHash, routeHash } from '../lib/logic/routes';

describe('settings and backup links', () => {
  it.each([
    ['#/settings', 'settings'],
    ['#/backup', 'backup'],
  ])('%s is a canonical %s route', (hash, name) => {
    expect(parseHash(hash).name).toBe(name);
    expect(routeHash(parseHash(hash))).toBe(hash);
  });
});
