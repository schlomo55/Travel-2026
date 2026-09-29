<script lang="ts">
  /* THE MAP (Map 5c) — boards map4-map (the tab), map4-place (a place's
     sheet), map4-go (Guide me) and map4-filters (what to show).

     A street map "like Google Maps, with the points": the trip's places as
     typed pins on the owner's own OpenStreetMap streets, imported once onto
     the phone (lib/map/pack.ts) — or, with no pack yet, on the plain night
     canvas; YOU, your heading and how rough your position is; the radar's
     rings; the places near you; and a way to each of them that works
     offline. The map engine is its own chunk, loaded the first time this
     screen opens (lib/map/street/, the bundle gate's third budget); this
     screen is the app's, and counts with it.

       #/trip/:id/map              the map, "Near you" at peek
       #/trip/:id/map/:place       the place's sheet (back closes it)
       #/trip/:id/map/:place/go    Guide me

     The truth rules hold: a place is drawn at `coord ?? pin` and nowhere
     else, a place with no position is listed by name and never guessed onto
     the map, its line is the trip's own words, and a distance is a straight
     line from your REAL position — never from anywhere else, never a time.

     For a screen reader the map is one named region; the rail and the list
     carry every place's name, category, line and distance, and focus goes
     into a sheet as it opens and back to where it came from as it closes. */
  import { onMount, tick } from 'svelte';
  import type { Booking, DayDefault, DayPick, DayPlan, ISODate, PlaceCategory, ShowCard, Stop, Trip } from '../lib/model/types';
  import {
    CATEGORIES,
    categoryCounts,
    dayTitleShort,
    inStop,
    isToday,
    isTonight,
    mapPlaces,
    placeById,
    searchPlaces,
    shown,
    todayIds,
    type MapPlace,
    type ShowFilter,
  } from '../lib/logic/mapplaces';
  import {
    accuracyText,
    bearingDeg,
    compass16,
    compassWords,
    distanceM,
    distanceSpoken,
    distanceText,
    meaningful,
    nearestFirst,
    scaleBar,
    steerHeading,
    type Ranged,
  } from '../lib/logic/wayfind';
  import { declinationAt } from '../lib/logic/declination';
  import { nearestStop } from '../lib/logic/citymap';
  import { currentStop, realStops } from '../lib/logic/day';
  import { compareIso } from '../lib/logic/dates';
  import { candidatesOf } from '../lib/logic/options';
  import { pickOption, unpick } from '../lib/data/picks';
  import { catColour, glyphOf } from '../lib/map/icons';
  import { packFile, packInfo, type PackInfo } from '../lib/map/pack';
  import { locator } from '../lib/map/locate.svelte';
  import { router } from '../lib/state/router.svelte';
  import { toast } from '../lib/state/toast.svelte';
  import { once } from '../lib/state/lazy';
  import { offscreen } from '../lib/motion/offscreen';
  import { revealFocus } from '../lib/components/ui/revealFocus';
  import { S } from '../lib/i18n/strings';
  import type { StreetMap, StreetPin, StreetView } from '../lib/map/street';
  import MapIcon from '../lib/components/map/MapIcon.svelte';
  import PlaceSheet from '../lib/components/map/PlaceSheet.svelte';
  import GuideMe from '../lib/components/map/GuideMe.svelte';
  import Rail from '../lib/components/map/Rail.svelte';
  import FiltersSheet from '../lib/components/map/FiltersSheet.svelte';
  import PlaceList from '../lib/components/map/PlaceList.svelte';
  import PackImport from '../lib/components/map/PackImport.svelte';
  import DriverCard from '../lib/components/pocket/DriverCard.svelte';
  import FlowPath from '../lib/motion/FlowPath.svelte';

  /* the engine chunk — asked for once, kept (lib/state/lazy.ts) */
  /** round you: the 1 km ring just inside the screen's width (map4-map) */
  const YOU_ZOOM = 13.5;
  /** a place on its own: its street and the ones round it */
  const PLACE_ZOOM = 15;
  /** you and a place this close share the view when its sheet opens */
  const BOTH_M = 8000;
  const engine = once(() => import('../lib/map/street'));

  let {
    trip,
    stops,
    bookings,
    showCards,
    dayPlans,
    dayDefaults,
    dayPicks,
    now,
    sub,
    view,
  }: {
    trip: Trip;
    stops: Stop[];
    bookings: Booking[];
    showCards: ShowCard[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    dayPicks: DayPick[];
    now: ISODate;
    sub?: string;
    view?: string;
  } = $props();

  const tid = $derived(trip.id);
  const src = $derived({ tripId: trip.id, stops, showCards, bookings, dayPlans, dayDefaults });
  const places = $derived(mapPlaces(src));
  const todays = $derived(todayIds(src, now));
  const dayTitle = $derived(dayTitleShort(src, now));
  const selected = $derived(placeById(places, sub));
  const guiding = $derived(view === 'go' && !!selected?.pos);

  /* ---------- what to show (a per-phone convenience, kept in localStorage) ---------- */
  const PREF = 'ltd:map:show';
  function readPref(): { off: PlaceCategory[]; hotels: 'beds' | 'all'; rings: boolean } {
    try {
      const v = JSON.parse(localStorage.getItem(PREF) ?? 'null') as { off?: unknown; hotels?: unknown; rings?: unknown } | null;
      return {
        off: Array.isArray(v?.off) ? (v.off as PlaceCategory[]).filter((c) => CATEGORIES.includes(c)) : [],
        hotels: v?.hotels === 'all' ? 'all' : 'beds',
        rings: v?.rings !== false,
      };
    } catch {
      return { off: [], hotels: 'beds', rings: true };
    }
  }
  const pref = readPref();
  let off = $state<Set<PlaceCategory>>(new Set(pref.off));
  let hotels = $state<'beds' | 'all'>(pref.hotels);
  let rings = $state(pref.rings);
  $effect(() => {
    const v = JSON.stringify({ off: [...off], hotels, rings });
    try {
      localStorage.setItem(PREF, v);
    } catch {
      /* no storage — the choice lasts until the tab closes */
    }
  });
  const filter = $derived<ShowFilter>({ off, hotels });

  /* ---------- you ---------- */
  const fix = $derived(locator.state === 'on' ? locator.fix : null);
  const you = $derived(fix ? { lat: fix.lat, lng: fix.lng } : null);
  const rough = $derived(fix ? accuracyText(fix.accuracy) : null);
  const heading = $derived(
    steerHeading({
      compassMagnetic: locator.compass,
      declination: fix ? declinationAt(fix.lat, fix.lng) : 0,
      course: fix?.course ?? null,
      speed: fix?.speed ?? null,
    }),
  );
  /** how far a place is from you, when your position makes it worth saying */
  function away(p: MapPlace): { m: number; deg: number } | null {
    if (!you || !fix || !p.pos) return null;
    const m = distanceM(you, p.pos);
    return meaningful(m, fix.accuracy) ? { m, deg: bearingDeg(you, p.pos) } : null;
  }

  /* ---------- where the map opens ---------- */
  const tripStops = $derived(realStops(stops).filter((s) => s.coord));
  function startCamera(): { center: [number, number]; zoom: number } {
    const p = placeById(places, sub);
    if (p?.pos) return { center: [p.pos.lng, p.pos.lat], zoom: PLACE_ZOOM };
    const here = currentStop(stops, now) ?? tripStops[0];
    if (here?.coord) return { center: [here.coord.lng, here.coord.lat], zoom: here === currentStop(stops, now) ? 13 : 12 };
    return { center: [0, 20], zoom: 2 };
  }
  const start = startCamera();

  /* ---------- the city in view: the chips, the rail, the list ---------- */
  let camera = $state<StreetView | null>(null);
  let settled = $state<{ lat: number; lng: number }>({ lat: start.center[1], lng: start.center[0] });
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const scope = $derived(nearestStop(settled, stops));
  const where = $derived(scope ? (scope.name.split(' — ')[0] ?? scope.name).trim() : S.mapTab.wholeTrip);
  const here = $derived(inStop(places, scope?.id ?? null));
  const pinnedHere = $derived(here.filter((p) => p.pos && shown(p, { off: new Set(), hotels })));
  const counts = $derived(categoryCounts(pinnedHere));
  const chips = $derived(CATEGORIES.filter((c) => counts[c] > 0));
  const onlyCat = $derived.by(() => {
    const on = chips.filter((c) => !off.has(c));
    return on.length === 1 && chips.length > 1 ? on[0] : null;
  });

  /* the rail: near YOU when you are in this city, else round the map's middle */
  const youHere = $derived(!!you && (!scope || nearestStop(you, stops)?.id === scope.id));
  const railItems = $derived(nearestFirst(here.filter((p) => p.pos && shown(p, filter)), (p) => p.pos, youHere && you ? you : settled).slice(0, 12));
  const measured = (r: Ranged<MapPlace>): boolean => youHere && !!fix && meaningful(r.m, fix.accuracy);

  /* ---------- the search ---------- */
  let query = $state('');
  let searchEl = $state<HTMLInputElement | null>(null);
  const results = $derived(query.trim() ? searchPlaces(places, query, (c) => S.mapTab.cat[c]).slice(0, 40) : []);

  /* ---------- the engine ---------- */
  let mapEl = $state<HTMLElement | null>(null);
  let street = $state<StreetMap | null>(null);
  let failed = $state(false);
  let pack = $state<PackInfo | null | undefined>(undefined);
  let following = $state(false);
  let userMoved = false;

  const pins = $derived<StreetPin[]>(
    places
      .filter((p) => p.pos && shown(p, filter))
      .map((p) => ({
        id: p.id,
        lng: p.pos!.lng,
        lat: p.pos!.lat,
        cat: p.category,
        glyph: glyphOf(p.category, p.name, p.native),
        label: p.label,
        v: isTonight(p, now) ? 'tonight' : isToday(p, todays) ? 'today' : '',
      })),
  );

  async function open(file: File | null, info: PackInfo | null, at?: { center: [number, number]; zoom: number }): Promise<void> {
    const m = await engine();
    if (!mapEl) return;
    const cam = at ?? start;
    const s = await m.openStreetMap({
      container: mapEl,
      pack: file,
      ...(info ? { packZooms: { min: info.minZoom, max: info.maxZoom } } : {}),
      center: cam.center,
      zoom: cam.zoom,
      padding: padding(),
      label: S.mapTab.mapAria,
      onPin: (id) => openPlace(id, mapEl?.querySelector<HTMLElement>('canvas') ?? null),
      onView: (v) => {
        camera = v;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => (settled = { lat: v.lat, lng: v.lng }), 220);
      },
      onGesture: () => {
        userMoved = true;
        following = false;
      },
      onError: () => (failed = true),
      onDrawn: (ids, at) => {
        const key = [...ids].sort().join(' ');
        if (key !== drawnKey) {
          drawnKey = key;
          drawnIds = ids;
        }
        const k2 = at.map((q) => `${q.x},${q.y}`).join(' ');
        if (k2 !== drawnAtKey) {
          drawnAtKey = k2;
          drawnAt = at;
        }
      },
    });
    if (!alive) {
      s.destroy();
      return;
    }
    street = s;
    placeMarkers(s);
  }

  let alive = true;
  onMount(() => {
    locator.attach();
    locator.heading(true);
    void (async () => {
      const info = await packInfo();
      pack = info;
      await open(info ? await packFile() : null, info);
    })().catch(() => (failed = true));
    return () => {
      alive = false;
      clearTimeout(settleTimer);
      street?.destroy();
      street = null;
      locator.heading(false);
      locator.detach();
    };
  });

  /* a pack imported from the empty state: the same map, now with streets */
  async function imported(info: PackInfo): Promise<void> {
    pack = info;
    const v = street?.view();
    street?.destroy();
    street = null;
    await open(await packFile(), info, v ? { center: [v.lng, v.lat], zoom: v.zoom } : undefined);
  }

  $effect(() => {
    street?.setPins(pins);
  });
  $effect(() => {
    street?.setSelected(selected?.pos ? selected.id : null);
  });
  $effect(() => {
    street?.setYou(you && fix ? { lng: you.lng, lat: you.lat, accuracy: fix.accuracy } : null);
  });
  $effect(() => {
    street?.setRings(rings);
  });

  /* ---------- the DOM on the map: you, your heading, the chosen pin, today's names ---------- */
  let youEl = $state<HTMLElement | null>(null);
  let coneEl = $state<HTMLElement | null>(null);
  let selEl = $state<HTMLElement | null>(null);
  let youM: ReturnType<StreetMap['marker']> | null = null;
  let coneM: ReturnType<StreetMap['marker']> | null = null;
  let selM: ReturnType<StreetMap['marker']> | null = null;
  function placeMarkers(s: StreetMap): void {
    const at: [number, number] = [start.center[0], start.center[1]];
    if (youEl) youM = s.marker(youEl, at);
    if (coneEl) coneM = s.marker(coneEl, at, { map: true });
    if (selEl) selM = s.marker(selEl, at, { anchor: 'top', offset: [0, -22] });
  }
  $effect(() => {
    if (!street || !you) return;
    youM?.move([you.lng, you.lat]);
    coneM?.move([you.lng, you.lat]);
  });
  $effect(() => {
    if (street && heading) coneM?.rotate(heading.deg);
  });
  $effect(() => {
    const p = selected;
    if (street && p?.pos) selM?.move([p.pos.lng, p.pos.lat]);
  });
  /* today's and tonight's names under their pins (the board's bubbles) — on
     the map itself: not while a place is open (map4-place, map4-go name only
     the chosen one), and not for a pin inside a cluster, which has no pin of
     its own to be under */
  let drawnIds = $state<Set<string>>(new Set());
  let drawnKey = '';
  /** every pin and cluster on screen, as the map last came to rest */
  let drawnAt = $state<{ x: number; y: number }[]>([]);
  let drawnAtKey = '';
  $effect(() => {
    const s = street;
    if (!s || selected) return;
    const tags = pins.filter((p) => p.v && drawnIds.has(p.id));
    const made = tags.map((p) => {
      const el = document.createElement('span');
      el.className = `m-tag ${p.v}`;
      el.setAttribute('aria-hidden', 'true');
      el.textContent = p.v === 'tonight' ? `${S.mapTab.tonight} · ${p.label}` : `${p.label} · ${S.mapTab.today.toLowerCase()}`;
      return s.marker(el, [p.lng, p.lat], { anchor: 'top', offset: [0, 20] });
    });
    return () => made.forEach((m) => m.remove());
  });

  /* ---------- the camera ---------- */
  let bottom = $state(0);
  let topH = $state(0);
  /* the search bar and the chips as drawn; while a search is typed its
     results cover the map, and the frame keeps the height the bar and the
     chips had — the map does not jump at every letter */
  let headH = $state(0);
  $effect(() => {
    if (!query.trim()) topH = headH;
  });
  /* the scale and the attribution sit over the map's foot: nothing is framed under them */
  let footH = $state(0);
  /* no pack yet: its card sits over the map's foot, just above the rail, and
     the map keeps you and your rings in the clear band above it */
  let nopackH = $state(0);
  /** what the map keeps clear above its bottom panel: the scale and the
      attribution — over a place's sheet and Guide me, the attribution's one
      line — or, with no pack, the import card (nothing of OpenStreetMap is
      drawn then, so no attribution) */
  const footSpace = (): number => (guiding || selected ? (pack === null ? 12 : 34) : pack === null ? nopackH + 24 : footH + 20);
  function padding(): { top: number; bottom: number; left: number; right: number } {
    return { top: topH + 8, bottom: bottom + footSpace(), left: 16, right: guiding || selected ? 16 : 72 };
  }
  $effect(() => {
    void bottom;
    void topH;
    void footH;
    void nopackH;
    void pack;
    void guiding;
    void selected;
    street?.setPadding(padding());
  });
  /* a place chosen: bring it above its sheet */
  let flownTo: string | null = null;
  $effect(() => {
    const p = selected;
    const s = street;
    if (!s || !p?.pos || guiding) return;
    if (flownTo === p.id) return;
    flownTo = p.id;
    const y = you;
    void tick().then(() =>
      y && distanceM(y, p.pos!) < BOTH_M ? s.fit([[y.lng, y.lat], [p.pos!.lng, p.pos!.lat]], 16) : s.flyTo([p.pos!.lng, p.pos!.lat], Math.max(PLACE_ZOOM, s.view().zoom)),
    );
  });
  $effect(() => {
    if (!selected) flownTo = null;
  });
  /* Guide me: you and the place, both in view */
  let fitted: string | null = null;
  $effect(() => {
    const s = street;
    const p = selected;
    if (!s || !guiding || !p?.pos) {
      fitted = null;
      return;
    }
    const key = `${p.id}:${you ? 'you' : 'none'}`;
    if (fitted === key) return;
    fitted = key;
    void tick().then(() => s.fit(you ? [[you.lng, you.lat], [p.pos!.lng, p.pos!.lat]] : [[p.pos!.lng, p.pos!.lat]], 16));
  });
  /* following you: the first fix brings the map to you (unless you moved it, or
     chose a place); after that the map keeps you in view with a short pan */
  let arrived = false;
  $effect(() => {
    const s = street;
    const y = you;
    if (!s || !y) return;
    if (!following && !userMoved && !sub) following = true;
    if (!following || sub) return;
    if (!arrived) s.flyTo([y.lng, y.lat], YOU_ZOOM);
    else s.panTo([y.lng, y.lat]);
    arrived = true;
  });

  function locate(): void {
    if (locator.state === 'denied') {
      toast.show(S.mapTab.denied);
      locator.start();
      return;
    }
    if (locator.state === 'on' && you && street) {
      following = !following;
      if (following) street.flyTo([you.lng, you.lat], Math.max(YOU_ZOOM, street.view().zoom));
      return;
    }
    following = true;
    userMoved = false;
    locator.start();
  }

  /* ---------- opening and closing a place ---------- */
  let returnTo: HTMLElement | null = null;
  /* the rail card a sheet was opened from: the rail is drawn again as the sheet
     closes, so focus goes back to the new card for the same place */
  let returnPlace: string | null = null;
  let sheetEl = $state<HTMLElement | null>(null);
  let guidePanel = $state<HTMLElement | null>(null);
  /* Guide me's panel is fixed to the foot of the screen: the map's padding follows its height */
  $effect(() => {
    const el = guidePanel;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => (bottom = el.offsetHeight));
    ro.observe(el);
    bottom = el.offsetHeight;
    return () => ro.disconnect();
  });
  function openPlace(id: string, from: HTMLElement | null): void {
    returnTo = from;
    returnPlace = from?.classList.contains('rc-open') ? id : null;
    query = '';
    const h = router.mapHash(tid, id);
    if (sub) router.replace(h);
    else router.go(h);
  }
  $effect(() => {
    if (sheetEl && selected && !guiding) void tick().then(() => sheetEl?.focus({ preventScroll: true }));
  });
  /* Guide me takes focus too, on its panel (its name is the direction) */
  $effect(() => {
    if (guidePanel && guiding) void tick().then(() => guidePanel?.focus({ preventScroll: true }));
  });
  let hadSheet = false;
  $effect(() => {
    const open = !!selected;
    if (hadSheet && !open) {
      const card = returnPlace;
      const from = returnTo;
      void tick().then(() => {
        const again = card ? document.querySelector<HTMLElement>(`.rail .rc-open[data-place="${CSS.escape(card)}"]`) : null;
        const back = again ?? (from?.isConnected ? from : (mapEl?.querySelector<HTMLElement>('canvas') ?? null));
        back?.focus({ preventScroll: true });
      });
      returnTo = null;
      returnPlace = null;
    }
    hadSheet = open;
  });
  /* a link to a place this trip no longer has: just the map */
  $effect(() => {
    if (sub && !placeById(places, sub)) router.replace(router.mapHash(tid));
  });
  function closePlace(): void {
    router.backOr(router.mapHash(tid));
  }
  function navigate(p: MapPlace): void {
    if (!p.pos) return;
    router.go(router.mapHash(tid, p.id, true));
  }

  /* ---------- the sheets and the driver card ---------- */
  let sheet = $state<'filters' | 'list' | null>(null);
  let driver = $state<ShowCard | null>(null);
  async function fromList(p: MapPlace): Promise<void> {
    await router.closeTopLayer();
    openPlace(p.id, document.querySelector<HTMLElement>('.m-listbtn'));
  }

  /* ---------- Add to my day: the trip's own option line, picked for today ---------- */
  const candidate = $derived.by(() => {
    const p = selected;
    if (!p?.spot || !p.stopId) return null;
    const stop = stops.find((s) => s.id === p.stopId);
    if (!stop) return null;
    return candidatesOf(stop).find((c) => c.spot?.id === p.spot?.id) ?? null;
  });
  const pickId = $derived(candidate ? (dayPicks.find((k) => k.date === now && k.blockId === candidate.blockId && k.itemIndex === candidate.index)?.id ?? null) : null);
  const inTrip = $derived(compareIso(now, trip.start) >= 0 && compareIso(now, trip.end) <= 0);
  const dayState = $derived<'add' | 'in' | null>(candidate && inTrip ? (pickId ? 'in' : 'add') : null);
  async function toggleDay(): Promise<void> {
    if (!candidate) return;
    if (pickId) {
      await unpick(pickId);
      toast.show(S.mapTab.removed);
    } else {
      await pickOption(trip.id, now, selected?.stopId, candidate);
      toast.show(S.mapTab.added);
    }
  }

  /* ---------- the lines: you → the place ---------- */
  const line = $derived.by(() => {
    void camera;
    const s = street;
    const p = selected;
    if (!s || !you || !p?.pos) return null;
    const a = s.project([you.lng, you.lat]);
    const b = s.project([p.pos.lng, p.pos.lat]);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    return { a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, angle, m: distanceM(you, p.pos) };
  });

  const scale = $derived(camera ? scaleBar(camera.mpp, 95) : null);

  /* ---------- past the edge (map4-map): today's places and tonight's bed, off screen ----------
     A chip on the edge the place lies beyond, as the board draws Sanlitun and
     Beijing South — its name, how far from you (only from you), an arrow on
     its bearing; a tap opens it. It hugs its edge (under the side controls on
     the right), never covers you, and never another chip. At most three. */
  let vw = $state(412);
  let vh = $state(915);
  let sideH = $state(0);
  /** a chip's box, for keeping it off you and off the others (the widest it draws) */
  const EDGE_W = 172;
  const EDGE_H = 44;
  type Edge = { p: MapPlace; side: 'l' | 'r' | 't' | 'b'; x: number; y: number; deg: number; dist: string | null; spoken: string };
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  const edgeRect = (e: { side: Edge['side']; x: number; y: number }): { l: number; r: number; t: number; b: number } => {
    const l = e.side === 'l' ? e.x : e.side === 'r' ? e.x - EDGE_W : e.x - EDGE_W / 2;
    return { l, r: l + EDGE_W, t: e.y - EDGE_H / 2, b: e.y + EDGE_H / 2 };
  };
  const edges = $derived.by(() => {
    void camera;
    const s = street;
    if (!s || selected || guiding || query.trim()) return [];
    const box = { l: 12, t: topH + 12, r: vw - 12, b: vh - bottom - footSpace() };
    if (box.r - box.l < EDGE_W + 40 || box.b - box.t < EDGE_H * 2) return [];
    const cx = (box.l + box.r) / 2;
    const cy = (box.t + box.b) / 2;
    /* the right edge below the side controls; beside them above that */
    const under = topH + 18 + sideH + 10;
    const me = you ? s.project([you.lng, you.lat]) : null;
    const from = you ?? (camera ? { lat: camera.lat, lng: camera.lng } : null);
    const out: Edge[] = [];
    const clash = (e: { side: Edge['side']; x: number; y: number }): boolean => {
      const r = edgeRect(e);
      if (me && me.x > r.l - 18 && me.x < r.r + 18 && me.y > r.t - 18 && me.y < r.b + 18) return true;
      /* nor over a pin: a chip laid on one would take its tap */
      if (drawnAt.some((q) => q.x > r.l - 17 && q.x < r.r + 17 && q.y > r.t - 17 && q.y < r.b + 17)) return true;
      return out.some((o) => {
        const q = edgeRect(o);
        return r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t;
      });
    };
    for (const p of places) {
      if (!p.pos || !shown(p, filter) || !(isToday(p, todays) || isTonight(p, now))) continue;
      const at = s.project([p.pos.lng, p.pos.lat]);
      if (at.x >= box.l && at.x <= box.r && at.y >= box.t && at.y <= box.b) continue;
      /* the edge the line from the middle of the map leaves by */
      const dx = at.x - cx;
      const dy = at.y - cy;
      const kx = dx ? (dx > 0 ? box.r - cx : box.l - cx) / dx : Infinity;
      const ky = dy ? (dy > 0 ? box.b - cy : box.t - cy) / dy : Infinity;
      let e: { side: Edge['side']; x: number; y: number };
      if (kx <= ky) {
        const y = clamp(cy + dy * kx, box.t + EDGE_H / 2, box.b - EDGE_H / 2);
        e = dx > 0 ? { side: 'r', x: y - EDGE_H / 2 < under ? box.r - 64 : box.r, y } : { side: 'l', x: box.l, y };
      } else {
        const x = clamp(cx + dx * ky, box.l + EDGE_W / 2, box.r - EDGE_W / 2);
        e = { side: dy > 0 ? 'b' : 't', x, y: dy > 0 ? box.b - EDGE_H / 2 : box.t + EDGE_H / 2 };
      }
      /* off you and off the others: a step along its edge, either way */
      if (clash(e)) {
        const along = e.side === 'l' || e.side === 'r' ? 'y' : 'x';
        const step = along === 'y' ? EDGE_H + 8 : EDGE_W / 2 + 8;
        const lo = along === 'y' ? box.t + EDGE_H / 2 : box.l + EDGE_W / 2;
        const hi = along === 'y' ? box.b - EDGE_H / 2 : box.r - EDGE_W / 2;
        const tries = [1, -1, 2, -2].map((k) => ({ ...e, [along]: clamp(e[along] + k * step, lo, hi) }));
        const ok = tries.find((t) => !clash(t));
        if (!ok) continue;
        e = ok;
      }
      const deg = from ? bearingDeg(from, p.pos) - (camera?.bearing ?? 0) : 0;
      const a = you ? away(p) : null;
      out.push({
        p,
        ...e,
        deg,
        dist: a ? distanceText(a.m).replace('≈ ', '') : null,
        spoken: a ? `${distanceSpoken(a.m)} ${compassWords(compass16(a.deg))}` : '',
      });
      if (out.length === 3) break;
    }
    return out;
  });
  const edgeStyle = (e: Edge): string =>
    e.side === 'l'
      ? `left: ${e.x}px; top: ${e.y}px; transform: translateY(-50%)`
      : e.side === 'r'
        ? `right: ${vw - e.x}px; top: ${e.y}px; transform: translateY(-50%)`
        : `left: ${e.x}px; top: ${e.y}px; transform: translate(-50%, -50%)`;
  const bearing = $derived(camera?.bearing ?? 0);
  const noPack = $derived(pack === null);
  /* a pack on the phone, and the map somewhere it has no streets for */
  const outside = $derived.by(() => {
    if (!pack || !camera) return false;
    const [w, s, e, n] = pack.bounds;
    return camera.lng < w || camera.lng > e || camera.lat < s || camera.lat > n;
  });
</script>

<div class="mapscreen" class:sheetmode={!!selected && !guiding} class:guiding bind:clientWidth={vw} bind:clientHeight={vh} data-following={following ? '1' : undefined} data-located={locator.state}>
  {#if !selected}<h1 class="sr-only">{S.mapTab.h1(where)}</h1>{/if}

  <!-- the map: MapLibre's canvas is its one named region (the list carries its places) -->
  <div class="m-canvas" bind:this={mapEl}></div>

  {#if line}
    <svg class="m-lines" aria-hidden="true">
      <defs>
        <linearGradient id="m-leg" gradientUnits="userSpaceOnUse" x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y}>
          <stop offset="0" style="stop-color: var(--route-lit)" />
          <stop offset="0.55" style="stop-color: var(--route-today)" />
          <stop offset="1" style="stop-color: {catColour(selected?.category ?? 'spa')}" />
        </linearGradient>
      </defs>
      {#if guiding}
        <path d="M{line.a.x} {line.a.y} L{line.b.x} {line.b.y}" stroke="url(#m-leg)" stroke-width="7" stroke-linecap="round" opacity="0.18" fill="none" />
        <FlowPath d="M{line.a.x} {line.a.y} L{line.b.x} {line.b.y}" stroke="url(#m-leg)" width={3} tip={{ x: line.b.x, y: line.b.y, angle: line.angle }} />
      {:else}
        <path d="M{line.a.x} {line.a.y} L{line.b.x} {line.b.y}" stroke="url(#m-leg)" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 6" opacity="0.8" fill="none" />
      {/if}
    </svg>
    {#if guiding}<span class="m-legkm num" aria-hidden="true" style="left:{line.mid.x}px; top:{line.mid.y + 14}px">{Math.round(line.m / 100) / 10} km</span>{/if}
  {/if}

  <!-- held for the map, which places them (lib/map/street marker()) -->
  <div class="m-hold" aria-hidden="true">
    <div bind:this={youEl} class="m-you" class:off={!you} aria-hidden="true">
      <span class="ping" use:offscreen></span>
      <span class="core"></span>
      {#if !selected && !guiding}<span class="m-youlbl">{S.mapTab.you}{#if rough}<span class="num"> · {rough}</span>{/if}</span>{/if}
    </div>
    <div bind:this={coneEl} class="m-cone" class:off={!you || !heading} aria-hidden="true"></div>
    <div bind:this={selEl} class="m-sel" class:off={!selected?.pos} style="--c: {catColour(selected?.category ?? 'sight')}" aria-hidden="true">
      <span class="m-seldisc"><MapIcon name={selected ? glyphOf(selected.category, selected.name, selected.native) : 'sight'} size={22} stroke={2} /></span>
      <span class="m-selname">{selected?.label ?? ''}</span>
    </div>
  </div>

  {#if failed}
    <div class="m-fail" role="status">{S.mapTab.noEngine}</div>
  {:else if !street}
    <p class="lazywait m-wait" role="status">{S.mapTab.opening}</p>
  {/if}

  {#if selected && pack}
    <!-- the map is a band over the sheet: whose streets they are, in one line -->
    <span class="m-attr1" style="bottom: calc({bottom}px + 8px)">{S.mapTab.attributionShort}</span>
  {/if}
  {#if guiding && selected}
    <span class="m-shade" aria-hidden="true"></span>
    <GuideMe
      place={selected}
      away={away(selected)}
      {heading}
      {rough}
      onclose={() => router.backOr(router.mapHash(tid, selected?.id))}
      ondriver={() => (driver = selected?.driver ?? null)}
      onlocate={locate}
      bind:panel={guidePanel}
    />
  {:else}
    <!-- the top: search (or the chosen place's name) and the category chips -->
    <div class="m-top" bind:clientHeight={headH}>
      <div class="m-toprow">
        {#if selected}
          <button class="m-round" onclick={closePlace} aria-label={S.mapTab.backToMap}><MapIcon name="back" size={20} stroke={1.9} /></button>
          <div class="m-namepill" style="--c: {catColour(selected.category)}">
            <MapIcon name={glyphOf(selected.category, selected.name, selected.native)} size={18} />
            <span>{selected.name}</span>
          </div>
        {:else}
          <label class="m-search">
            <MapIcon name="search" size={20} />
            <span class="sr-only">{S.mapTab.findIn(where)}</span>
            <input type="search" bind:this={searchEl} bind:value={query} placeholder={S.mapTab.find} autocomplete="off" enterkeyhint="search" />
            {#if query}
              <button class="m-clear" onclick={() => ((query = ''), searchEl?.focus())} aria-label={S.mapTab.clear}><MapIcon name="close" size={16} stroke={2} /></button>
            {:else}
              <span class="m-where">{where}</span>
            {/if}
          </label>
          <button class="m-round" onclick={() => (sheet = 'filters')} aria-label={S.mapTab.filters}><MapIcon name="sliders" size={20} /></button>
        {/if}
      </div>
      {#if !selected && !query.trim()}
        <div class="m-chips" role="toolbar" aria-label={S.mapTab.types} use:revealFocus>
          <button class="m-chip" class:on={off.size === 0} aria-pressed={off.size === 0} onclick={() => (off = new Set())}>
            {S.mapTab.all} <span class="num">{counts.all}</span>
          </button>
          {#each chips as c (c)}
            <button
              class="m-chip"
              class:on={onlyCat === c}
              aria-pressed={onlyCat === c}
              aria-label={S.mapTab.showOnly(S.mapTab.catChip[c], counts[c])}
              style="--c: {catColour(c)}"
              onclick={() => (off = onlyCat === c ? new Set() : new Set(CATEGORIES.filter((x) => x !== c)))}
            >
              <MapIcon name={c} size={15} />
              {S.mapTab.catChip[c]} <span class="num m-chipn">{counts[c]}</span>
            </button>
          {/each}
        </div>
      {/if}
      {#if query.trim()}
        <div class="m-results" role="region" aria-label={S.mapTab.results(results.length)}>
          <p class="m-rcount" role="status">{results.length ? S.mapTab.results(results.length) : S.mapTab.noResults(query.trim())}</p>
          <ul>
            {#each results as p (p.id)}
              <li>
                <button class="m-res" style="--c: {catColour(p.category)}" onclick={(e) => openPlace(p.id, e.currentTarget)}>
                  <span class="m-resdisc" aria-hidden="true"><MapIcon name={glyphOf(p.category, p.name, p.native)} size={15} /></span>
                  <span class="m-resbody">
                    <span class="m-resname">{p.name}{#if p.native}<span class="zh m-reszh" lang="zh">{p.native}</span>{/if}</span>
                    <span class="m-ressub">{S.mapTab.cat[p.category]}{p.pos ? '' : ` · ${S.mapTab.noPinYet}`}</span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>

    <!-- the controls down the side (not under a search's results) -->
    {#if !selected && !query.trim()}
      <div class="m-side" style="top: calc({topH}px + 18px)" bind:clientHeight={sideH}>
        <button class="m-rings" class:on={rings} aria-pressed={rings} aria-label={S.mapTab.ringsAria(rings)} onclick={() => (rings = !rings)}>
          <MapIcon name="rings" size={20} />
          <span>{S.mapTab.rings}</span>
        </button>
        <div class="m-zoom">
          <button onclick={() => street?.zoomBy(1)} aria-label={S.mapTab.zoomIn}><MapIcon name="plus" size={18} stroke={2} /></button>
          <span aria-hidden="true"></span>
          <button onclick={() => street?.zoomBy(-1)} aria-label={S.mapTab.zoomOut}><MapIcon name="minus" size={18} stroke={2} /></button>
        </div>
        <button class="m-north" onclick={() => street?.northUp()} aria-label={S.mapTab.northUp}>
          <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" style="transform: rotate({-bearing}deg)"><path d="M7 1 12 9H2Z" style="fill: var(--sunrise)" /><path d="M7 17 2 9h10Z" style="fill: var(--edge)" /></svg>
        </button>
        <button
          class="m-locate"
          class:on={following && !!you}
          aria-pressed={following && !!you}
          aria-busy={locator.state === 'asking'}
          aria-label={locator.state === 'asking' ? S.mapTab.locating : following && you ? S.mapTab.following : S.mapTab.locate}
          onclick={locate}
        >
          <MapIcon name="navigate" size={20} />
        </button>
      </div>
    {/if}

    {#if outside && !selected && !query.trim()}
      <p class="m-outside" role="status" style="top: calc({topH}px + 10px)">{S.mapTab.noStreetsHere(pack?.areas?.length ?? 0)}</p>
    {/if}

    {#if noPack && !selected}
      <div class="m-nopack" style="bottom: calc({bottom}px + 12px)" bind:clientHeight={nopackH}>
        <h2 class="m-nph">{S.mapTab.noPack}</h2>
        <p>{S.mapTab.noPackBody}</p>
        <PackImport onimported={(i) => void imported(i)} />
      </div>
    {/if}

    {#each edges as e (e.p.id)}
      <button
        class="m-edge"
        style={edgeStyle(e)}
        onclick={(ev) => openPlace(e.p.id, ev.currentTarget)}
        aria-label={S.mapTab.pastEdge(e.p.name, e.spoken)}
      >
        <span class="m-edgedisc" style="--c: {catColour(e.p.category)}" aria-hidden="true"><MapIcon name={glyphOf(e.p.category, e.p.name, e.p.native)} size={14} /></span>
        <span class="m-edgen">{e.p.label}</span>
        {#if e.dist}<span class="num m-edged">{e.dist}</span>{/if}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform: rotate({e.deg}deg); stroke: var(--ink-2)"
          ><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg
        >
      </button>
    {/each}

    <!-- the foot of the map: its scale, whose streets they are -->
    {#if !noPack && !selected}
      <div class="m-foot" style="bottom: calc({bottom}px + 12px)" bind:clientHeight={footH}>
        {#if scale}
          <span class="m-scale" role="img" aria-label={S.mapTab.scale(scale.label)}>
            <svg width={Math.max(20, scale.px + 2)} height="8" aria-hidden="true"><path d="M1 1v6h{scale.px}V1" fill="none" style="stroke: var(--ink-2)" stroke-width="1.5" /></svg>
            <span class="num">{scale.label}</span>
          </span>
        {/if}
        <span class="m-attr">{S.mapTab.attribution}</span>
      </div>
    {/if}

    {#if selected}
      <div class="m-sheet" bind:clientHeight={bottom}>
        <PlaceSheet
          place={selected}
          away={away(selected)}
          rough={fix && !away(selected) && selected.pos ? rough : null}
          todayTitle={isToday(selected, todays) ? dayTitle : null}
          tonight={isTonight(selected, now)}
          {dayState}
          tripId={tid}
          onclose={closePlace}
          onnavigate={() => navigate(selected!)}
          ondriver={() => (driver = selected?.driver ?? null)}
          onday={() => void toggleDay()}
          onlocate={locate}
          bind:sheet={sheetEl}
        />
      </div>
    {:else}
      <section class="m-peek" aria-labelledby="m-near" bind:clientHeight={bottom}>
        <span class="m-hline" aria-hidden="true"></span>
        <span class="m-grab" aria-hidden="true"></span>
        <div class="m-peekhead">
          <h2 id="m-near" class="display">{youHere ? S.mapTab.nearYou : S.mapTab.aroundHere}</h2>
          <span class="m-peeksub">{youHere && !rough ? S.mapTab.exactFirst : rough && youHere ? S.mapTab.rough(rough) : S.mapTab.locateForDistances}</span>
          <button class="m-listbtn" onclick={() => (sheet = 'list')}><MapIcon name="list" size={16} />{S.mapTab.list}</button>
        </div>
        {#if railItems.length}
          <Rail
            items={railItems}
            total={here.filter((p) => p.pos || p.target.query || p.target.address || p.target.url).length}
            {measured}
            today={(p) => isToday(p, todays)}
            onopen={(p, el) => openPlace(p.id, el)}
            onnavigate={navigate}
            onlist={() => (sheet = 'list')}
          />
        {:else}
          <p class="m-empty">{S.mapTab.nothingHere}</p>
        {/if}
      </section>
    {/if}
  {/if}
</div>

{#if sheet === 'filters'}
  <FiltersSheet
    {where}
    places={here}
    {off}
    {hotels}
    {rings}
    onchange={(n) => {
      off = n.off;
      hotels = n.hotels;
      rings = n.rings;
    }}
    onclose={() => (sheet = null)}
  />
{:else if sheet === 'list'}
  <PlaceList {where} places={here} {away} onopen={(p) => void fromList(p)} onclose={() => (sheet = null)} />
{/if}

{#if driver}
  <DriverCard cards={[driver]} start={0} suffix={trip.driverSuffix} onclose={() => (driver = null)} />
{/if}

<style>
  /* ---------- the minimal MapLibre rules this map needs (its own sheet is 83 KB) ---------- */
  :global(.maplibregl-map) {
    overflow: hidden;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }
  :global(.maplibregl-canvas) {
    position: absolute;
    left: 0;
    top: 0;
  }
  :global(.maplibregl-canvas:focus-visible) {
    outline-offset: -4px;
  }
  :global(.maplibregl-canvas-container.maplibregl-touch-zoom-rotate),
  :global(.maplibregl-canvas-container.maplibregl-touch-zoom-rotate .maplibregl-canvas) {
    touch-action: pan-x pan-y;
  }
  :global(.maplibregl-canvas-container.maplibregl-touch-drag-pan),
  :global(.maplibregl-canvas-container.maplibregl-touch-drag-pan .maplibregl-canvas) {
    touch-action: pinch-zoom;
  }
  :global(.maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan),
  :global(.maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan .maplibregl-canvas) {
    touch-action: none;
  }
  :global(.maplibregl-marker) {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }

  .mapscreen {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--map-land);
    color: var(--ink);
  }
  .m-canvas {
    position: absolute;
    inset: 0;
    background: var(--dot-grid), var(--map-land);
    background-size:
      18px 18px,
      auto;
  }
  .m-canvas:focus-visible {
    outline-offset: -4px;
  }
  .m-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
    overflow: visible;
  }
  .m-lines :global(.fl-under) {
    display: none;
  }
  .m-legkm {
    position: absolute;
    z-index: 3;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--ink);
    background: rgba(11, 12, 22, 0.9);
    border: 1px solid rgba(255, 126, 182, 0.5);
    pointer-events: none;
  }
  .m-hold {
    position: absolute;
    left: -9999px;
    top: 0;
  }
  .m-wait {
    position: absolute;
    left: 0;
    right: 0;
    top: 45%;
    z-index: 2;
  }
  .m-fail {
    position: absolute;
    left: 16px;
    right: 16px;
    top: 40%;
    z-index: 2;
    padding: 14px 16px;
    border-radius: var(--radius-inner);
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
    background: var(--card);
    border: 1px solid var(--line);
  }

  /* you: the only sunrise-filled dot, its ping, your name tag */
  :global(.m-you) {
    position: relative;
    width: 20px;
    height: 20px;
    pointer-events: none;
  }
  :global(.m-you.off),
  :global(.m-cone.off),
  :global(.m-sel.off) {
    visibility: hidden;
  }
  :global(.m-you .ping),
  :global(.m-you .core) {
    position: absolute;
    left: 3px;
    top: 3px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    box-sizing: border-box;
  }
  :global(.m-you .ping) {
    border: 2px solid var(--sunrise-fill);
    animation: h-ping var(--duration-ping) ease-out infinite;
  }
  :global(.m-you .core) {
    background: var(--sunrise-fill);
    box-shadow:
      0 0 0 2.5px var(--sky),
      0 0 14px rgba(255, 159, 107, 0.9);
  }
  :global(.m-youlbl) {
    position: absolute;
    left: 26px;
    top: -2px;
    padding: 3px 8px;
    border-radius: 10px;
    white-space: nowrap;
    font-size: var(--fs-chip);
    font-weight: 700;
    color: var(--sunrise);
    background: rgba(11, 12, 22, 0.86);
    border: 1px solid rgba(255, 159, 107, 0.38);
  }
  :global(.m-youlbl .num) {
    font-weight: 500;
    color: var(--ink-2);
  }
  /* the heading cone: a 50° wedge, sunrise fading out (the board's #m4mCone) */
  :global(.m-cone) {
    width: 104px;
    height: 104px;
    pointer-events: none;
    background: radial-gradient(closest-side, rgba(255, 159, 107, 0.55), rgba(255, 159, 107, 0) 100%);
    clip-path: polygon(50% 50%, 26.7% 0, 73.3% 0);
  }
  /* the chosen place: filled, its name in a bubble */
  :global(.m-sel) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }
  :global(.m-seldisc) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    color: var(--sky);
    background: var(--c);
    box-shadow:
      0 0 0 3px var(--sky),
      0 0 22px color-mix(in srgb, var(--c) 70%, transparent);
  }
  :global(.m-selname) {
    max-width: 220px;
    padding: 5px 10px;
    border-radius: 12px;
    font-size: var(--fs-chip);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--sky);
    background: var(--c);
  }
  /* today's and tonight's names under their pins */
  :global(.m-tag) {
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    font-size: var(--fs-caps);
    font-weight: 700;
    color: var(--sunrise);
    background: rgba(11, 12, 22, 0.88);
    border: 1px solid rgba(255, 159, 107, 0.5);
    pointer-events: none;
  }

  /* Guide me's header reads over the map through the board's shade */
  .m-shade {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 5;
    height: calc(130px + env(safe-area-inset-top));
    background: linear-gradient(180deg, rgba(11, 12, 22, 0.96) 0%, rgba(11, 12, 22, 0.7) 60%, rgba(11, 12, 22, 0) 100%);
    pointer-events: none;
  }

  /* ---------- the top ---------- */
  .m-top {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 5;
    padding: calc(16px + env(safe-area-inset-top)) 0 12px;
    background: linear-gradient(180deg, rgba(11, 12, 22, 0.95) 0%, rgba(11, 12, 22, 0.65) 62%, rgba(11, 12, 22, 0) 100%);
    pointer-events: none;
  }
  .m-top > * {
    pointer-events: auto;
  }
  .m-toprow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
  }
  .m-search {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 8px 0 16px;
    border-radius: 999px;
    color: var(--ink-2);
    background: var(--chrome);
    border: 1px solid var(--edge);
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.9);
    cursor: text;
  }
  .m-search:focus-within {
    border-color: var(--sunrise);
    box-shadow: var(--focus-halo);
  }
  .m-search input {
    flex: 1;
    min-width: 0;
    height: 44px;
    min-height: 0;
    padding: 0;
    font-size: var(--fs-body);
    color: var(--ink);
    background: transparent;
    border: none;
    outline: none;
    box-shadow: none;
  }
  /* one clear button: the field's own (.m-clear), not the browser's too */
  .m-search input::-webkit-search-cancel-button {
    display: none;
  }
  .m-search input::placeholder {
    color: var(--placeholder);
    opacity: 1;
  }
  .m-where {
    flex-shrink: 0;
    padding-right: 8px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--faint);
    max-width: 38%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-clear {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 999px;
    color: var(--ink-2);
    background: none;
  }
  .m-round {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--chrome);
    border: 1px solid var(--edge);
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.9);
  }
  .m-namepill {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 16px;
    border-radius: 999px;
    color: var(--c);
    background: var(--chrome);
    border: 1px solid var(--line);
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.9);
  }
  .m-namepill span {
    min-width: 0;
    font-size: var(--fs-row);
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-chips {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding: 6px 16px;
    overflow-x: auto;
    scrollbar-width: none;
    scroll-padding-inline: 16px;
    -webkit-mask-image: linear-gradient(90deg, #000 86%, transparent);
    mask-image: linear-gradient(90deg, #000 86%, transparent);
  }
  .m-chips::-webkit-scrollbar {
    display: none;
  }
  .m-chip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--chrome);
    border: 1px solid var(--edge);
  }
  .m-chip :global(.micon) {
    color: var(--c);
  }
  .m-chip .num {
    font-size: var(--fs-chip);
  }
  .m-chipn {
    color: var(--ink-2);
  }
  .m-chip.on {
    color: var(--sunrise);
    background: linear-gradient(var(--sunrise-soft), var(--sunrise-soft)), var(--chrome);
    border-color: rgba(255, 159, 107, 0.6);
  }
  .m-chip.on .m-chipn {
    color: var(--sunrise);
  }
  .m-results {
    margin: 10px 16px 0;
    max-height: min(52vh, 420px);
    overflow-y: auto;
    border-radius: var(--radius-inner);
    background: var(--chrome);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-float);
  }
  .m-results ul {
    margin: 0;
    padding: 0 0 6px;
    list-style: none;
  }
  .m-rcount {
    margin: 0;
    padding: 12px 16px 6px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .m-res {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 6px 16px;
    border: none;
    background: none;
    color: var(--ink);
    text-align: left;
  }
  .m-res:focus-visible {
    outline-offset: -4px;
  }
  .m-resdisc {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    box-sizing: border-box;
    color: var(--c);
    background: var(--card-2);
    border: 1.5px solid var(--c);
  }
  .m-resbody {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .m-resname {
    font-size: var(--fs-row);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-reszh {
    margin-left: 8px;
    font-family: var(--font-zh);
    font-size: var(--fs-caption);
    font-weight: 400;
    color: var(--ink-2);
  }
  .m-ressub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }

  /* ---------- the side ---------- */
  .m-side {
    position: absolute;
    right: 16px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .m-rings,
  .m-north,
  .m-locate,
  .m-zoom {
    background: var(--chrome);
    border: 1px solid var(--edge);
    box-shadow: 0 16px 30px -12px rgba(0, 0, 0, 0.9);
  }
  .m-rings {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 48px;
    height: 52px;
    padding: 0;
    border-radius: 18px;
    font-size: var(--fs-caps);
    font-weight: 700;
    color: var(--ink-2);
  }
  .m-rings.on,
  .m-locate.on {
    color: var(--sunrise);
    border-color: rgba(255, 159, 107, 0.55);
  }
  .m-zoom {
    display: flex;
    flex-direction: column;
    border-radius: 999px;
    overflow: hidden;
  }
  .m-zoom button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 44px;
    padding: 0;
    border: none;
    color: var(--ink);
    background: transparent;
  }
  .m-zoom button:focus-visible {
    outline-offset: -4px;
  }
  .m-zoom span {
    height: 1px;
    margin: 0 12px;
    background: var(--line);
  }
  .m-north,
  .m-locate {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 999px;
    color: var(--ink-2);
  }
  .m-north svg {
    transition: transform var(--motion) var(--ease-out);
  }

  /* ---------- no pack yet ---------- */
  .m-nopack {
    position: absolute;
    left: 16px;
    right: 80px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: var(--radius-inner);
    background: var(--card);
    border: 1px solid var(--lilac-line);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  }
  .m-nph {
    margin: 0;
    font-size: var(--fs-row);
    font-weight: 700;
    line-height: 1.3;
  }
  .m-nopack p {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }

  /* ---------- past the edge ---------- */
  .m-edge {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    max-width: 172px;
    padding: 0 10px 0 6px;
    border-radius: 999px;
    font-size: var(--fs-chip);
    font-weight: 600;
    white-space: nowrap;
    color: var(--ink);
    background: rgba(16, 18, 31, 0.92);
    border: 1px solid var(--edge);
  }
  /* drawn 36 px as the board draws it; a 44 px target all the same */
  .m-edge::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    right: 0;
    bottom: -4px;
  }
  .m-edgedisc {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    color: var(--c);
    background: var(--card-2);
  }
  .m-edgen {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-edged {
    font-size: var(--fs-caps);
    color: var(--ink-2);
  }

  .m-outside {
    position: absolute;
    left: 16px;
    right: 80px;
    z-index: 4;
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--radius-inner);
    font-size: var(--fs-caption);
    line-height: 1.4;
    color: var(--ink-2);
    background: rgba(16, 18, 31, 0.92);
    border: 1px solid var(--line);
  }

  /* ---------- the foot of the map ---------- */
  .m-foot {
    position: absolute;
    left: 16px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 200px;
    padding: 7px 10px;
    border-radius: 12px;
    background: rgba(11, 12, 22, 0.84);
    border: 1px solid rgba(255, 255, 255, 0.06);
    pointer-events: none;
  }
  .m-scale {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-caps);
    color: var(--ink-2);
  }
  .m-attr {
    font-size: var(--fs-caps);
    line-height: 1.35;
    color: var(--faint);
  }
  .m-attr1 {
    position: absolute;
    left: 12px;
    z-index: 3;
    padding: 3px 8px;
    border-radius: 8px;
    font-size: var(--fs-caps);
    line-height: 1.35;
    color: var(--faint);
    background: rgba(11, 12, 22, 0.84);
    pointer-events: none;
  }

  /* ---------- the sheets ---------- */
  .m-peek,
  .m-sheet {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 6;
  }
  @media (min-width: 560px) {
    .m-peek,
    .m-sheet {
      left: calc(50% - 260px);
      right: calc(50% - 260px);
    }
  }
  .m-sheet {
    max-height: calc(100dvh - 96px - env(safe-area-inset-top));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
    background: var(--chrome);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
  }
  .m-peek {
    padding: 24px 0 calc(var(--nav-h) + 6px + env(safe-area-inset-bottom));
    background: var(--chrome);
    border-top: 1px solid var(--line);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
  }
  .m-hline {
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .m-grab {
    position: absolute;
    left: 50%;
    top: 10px;
    width: 40px;
    height: 5px;
    margin-left: -20px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.22);
  }
  .m-peekhead {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
  }
  .m-peekhead h2 {
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 500;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .m-peeksub {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-chip);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-listbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .m-empty {
    margin: 14px 16px 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
</style>
