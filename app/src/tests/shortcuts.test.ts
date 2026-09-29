/* LONG-PRESS SHORTCUTS (Reminders, Part 6): an ltd://open/<place> URL
   becomes that place in the trip on the road; anything else is ignored. */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/db/db', () => ({
  db: {
    trips: {
      toArray: async () => [
        { id: 'cn26', archived: false, start: '2026-11-21', end: '2026-12-27' },
        { id: 'il26', archived: false, start: '2026-01-01', end: '2026-01-05' },
      ],
    },
  },
}));
vi.mock('../lib/data/repo', () => ({ getSettings: async () => ({ activeTripId: 'cn26' }) }));
vi.mock('../lib/state/router.svelte', () => ({ router: { go: () => {} } }));

const { shortcutRoute } = await import('../lib/platform/shortcuts');

describe('shortcutRoute', () => {
  it('opens each place in the active trip', async () => {
    expect(await shortcutRoute('ltd://open/now')).toBe('#/trip/cn26/now');
    expect(await shortcutRoute('ltd://open/wallet')).toBe('#/trip/cn26/pocket');
    expect(await shortcutRoute('ltd://open/map')).toBe('#/trip/cn26/map');
    expect(await shortcutRoute('ltd://open/todo')).toBe('#/trip/cn26/now/todo');
  });

  it('ignores every other URL, the Drive sign-in answer included', async () => {
    expect(await shortcutRoute('com.livingthedream.travel:/oauth2redirect?code=x')).toBeNull();
    expect(await shortcutRoute('ltd://open/nowhere')).toBeNull();
    expect(await shortcutRoute(undefined)).toBeNull();
  });
});
