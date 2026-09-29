/* The route grammar of the app, as pure functions: what a hash MEANS, and
   what the canonical hash for a route is. The router (state/router.svelte.ts)
   owns history and the layer stack; this file owns only the mapping, so the
   alias table — every link the app has ever written — can be tested with
   plain strings. See the grammar and the reasons in router.svelte.ts. */

/** The four places in the nav, plus Find (Map 5c added the Map). */
export type Place = 'now' | 'journey' | 'map' | 'pocket' | 'find';
export const PLACES: Place[] = ['now', 'journey', 'map', 'pocket'];

/** Every tab id the app has ever written. (Lantern's 'map' — its route
    diagram — is a place again since Map 5c: the Map tab, the map it always was.) */
export type LegacyTab = 'today' | 'itinerary' | 'wallet' | 'tasks' | 'info' | 'stats' | 'docs';
export type TabName = Place | LegacyTab;

/** The Pocket's own screens — anything else under pocket/ is a booking id. */
export const POCKET_SECTIONS = [
  'travel',
  'stays',
  'experiences',
  'cards',
  'money',
  'docs',
  'driver',
  'phrases',
  'visa',
  'emergency',
  'convert',
  'health',
  'info',
  'notes',
  'clocks',
] as const;
export type PocketSection = (typeof POCKET_SECTIONS)[number];
export function isPocketSection(s: string | undefined): s is PocketSection {
  return !!s && (POCKET_SECTIONS as readonly string[]).includes(s);
}

export type Route =
  | { name: 'redirect' }
  | { name: 'shelf' }
  | { name: 'settings' }
  | { name: 'backup' }
  | {
      name: 'trip';
      tripId: string;
      place: Place;
      /** now: 'todo'; journey: a stop id; map: a place id (its sheet);
          pocket: a section or a booking id. */
      sub?: string;
      /** now/todo: which list — 'packing' | 'lists'; journey/<stop>: 'guide';
          map/<place>: 'go' — Guide me. */
      view?: string;
      /** A section to scroll to once the screen has mounted. */
      anchor?: string;
    };

/** One old path → where its content lives now. `sub` passes a path segment
    straight through (a stop id, a booking id); a fixed value replaces it. */
interface Alias {
  place: Place;
  sub?: string | ((rest: string[]) => string | undefined);
  view?: (rest: string[]) => string | undefined;
  anchor?: string;
}
const ALIASES: Record<LegacyTab, Alias> = {
  today: { place: 'now' },
  itinerary: { place: 'journey', sub: (r) => r[0] },
  /* `wallet/spend` was the money view; `wallet/<id>` a booking — its pass. */
  wallet: { place: 'pocket', sub: (r) => (r[0] === 'spend' ? 'money' : r[0]) },
  tasks: { place: 'now', sub: 'todo', view: (r) => r[0] },
  /* Info was split: its bigger half — papers, driver cards, phrases,
     numbers, health, converter, notes, clocks — is the Pocket. */
  info: { place: 'pocket' },
  stats: { place: 'journey', anchor: 'stats' },
  docs: { place: 'pocket', sub: 'docs' },
};

export function parseHash(h: string): Route {
  const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeSeg);
  const p0 = parts[0];
  if (!p0) return { name: 'redirect' };
  if (p0 === 'trips') return { name: 'shelf' };
  if (p0 === 'settings') return { name: 'settings' };
  if (p0 === 'backup') return { name: 'backup' };
  if (p0 === 'trip' && parts[1]) {
    const tripId = parts[1];
    const tab = parts[2] ?? 'now';
    const rest = parts.slice(3);
    if (tab === 'now' || tab === 'journey' || tab === 'map' || tab === 'pocket' || tab === 'find') {
      /* now/todo/<list>, journey/<stop>/guide and map/<place>/go carry a second segment */
      if (tab === 'now' || tab === 'journey' || tab === 'map') return { name: 'trip', tripId, place: tab, sub: rest[0], view: rest[0] ? rest[1] : undefined };
      return { name: 'trip', tripId, place: tab, sub: rest[0] };
    }
    const alias = ALIASES[tab as LegacyTab];
    if (alias) {
      const sub = typeof alias.sub === 'function' ? alias.sub(rest) : alias.sub;
      return {
        name: 'trip',
        tripId,
        place: alias.place,
        ...(sub ? { sub } : {}),
        ...(alias.view && alias.view(rest) ? { view: alias.view(rest) } : {}),
        ...(alias.anchor ? { anchor: alias.anchor } : {}),
      };
    }
    /* an unknown tab name is not an error page: the trip opens on Now */
    return { name: 'trip', tripId, place: 'now' };
  }
  return { name: 'shelf' };
}

function decodeSeg(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The canonical hash for a route — what the address bar is rewritten to. */
export function routeHash(r: Route): string {
  switch (r.name) {
    case 'redirect':
      return '#/';
    case 'shelf':
      return '#/trips';
    case 'settings':
      return '#/settings';
    case 'backup':
      return '#/backup';
    case 'trip': {
      const segs = ['trip', r.tripId, r.place];
      if (r.sub) segs.push(r.sub);
      if (r.sub && r.view) segs.push(r.view);
      return '#/' + segs.map((s) => encodeURIComponent(s)).join('/');
    }
  }
}

/** Where an old tab id lands, as a path — used by goTab for legacy callers. */
export function tabPath(tripId: string, tab: TabName): string {
  const r = parseHash(`#/trip/${tripId}/${tab}`);
  return routeHash(r);
}
