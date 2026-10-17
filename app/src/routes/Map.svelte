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
     into a sheet as it opens and back to where it came from as it closes.

     THE PLACES' PHOTOS (Map 5e) travel inside the map pack: its index is read
     once the pack is known (lib/map/pack.ts packPhotos), and every photo is a
     slice of the pack on this phone, shown lazily (lib/map/photoUrls.ts). The
     owner's choices: A — the place card's photo, its credit, full screen on a
     tap, About from Wikipedia and the links; A2 — the category's colour where
     the pack found no free photo; B — a photo on each "Near you" card; E —
     at close zoom a pin wears its place's photo (map images, painted on
     demand: lib/map/street); F — "Look for this" in Guide me. No photos on
     the phone: every screen as before.

     A DAY ON THE MAP (demo, Wanderlog-inspired; logic/dayroute.ts, logic/maproute.ts): today's plan — or
     the day the chips under the search choose (state/mapDay.svelte.ts), or every day of the stay — as
     numbered stops in the day's colour joined by a line, dotted on to tonight's bed; the peek sheet lists
     the stops in the plan's order (DayRail) with the day's estimated distance and moving time. "Off"
     leaves the map as it was. A stop is the place's own pin: a tap opens its sheet. */
  import { onMount, tick, untrack } from 'svelte';
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
    footPlace,
    legText,
    meaningful,
    nearestFirst,
    pinOn,
    scaleBar,
    steerHeading,
    tagBelow,
    type DrawnPin,
    type Ranged,
  } from '../lib/logic/wayfind';
  import { declinationAt } from '../lib/logic/declination';
  import { nearestStop } from '../lib/logic/citymap';
  import { currentStop, realStops, resolveDay } from '../lib/logic/day';
  import { tripPhase } from '../lib/logic/phase';
  import { isTravelDay } from '../lib/logic/metroline';
  import { dayOffers, offerFor } from '../lib/logic/options';
  import { pickedIndex, pickOption, unpick } from '../lib/data/picks';
  import { chipSel, dayChips, mapRoutes, routeDraws, routeFit, routeIds, selDate, shownKey } from '../lib/logic/maproute';
  import { fmtDow, fmtDowDay } from '../lib/logic/dates';
  import { mapDay } from '../lib/state/mapDay.svelte';
  import { legModes } from '../lib/state/legModes.svelte';
  import { catColour, glyphOf } from '../lib/map/icons';
  import { packFile, packInfo, packPhotos, type PackInfo } from '../lib/map/pack';
  import { entryFor, indexForTrip, photoOf, type PackPhoto } from '../lib/logic/placephotos';
  import { photoBlob, type PhotoSource } from '../lib/map/photoUrls';
  import { locator } from '../lib/map/locate.svelte';
  import { peek } from '../lib/map/peek.svelte';
  import { router } from '../lib/state/router.svelte';
  import { backToOf } from '../lib/logic/routes';
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
  import DayRail from '../lib/components/map/DayRail.svelte';
  import FiltersSheet from '../lib/components/map/FiltersSheet.svelte';
  import PlaceList from '../lib/components/map/PlaceList.svelte';
  import PackImport from '../lib/components/map/PackImport.svelte';
  import DriverCard from '../lib/components/pocket/DriverCard.svelte';
  import PhotoViewer from '../lib/components/map/PhotoViewer.svelte';
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
  /* every place here the rail and the list can open — the rail's "all" card */
  const railTotal = $derived(here.filter((p) => p.pos || p.target.query || p.target.address || p.target.url).length);
  /* the folded bar's count: the places on the map it would show — what the "All" chip counts, filters and all */
  const peekCount = $derived(here.filter((p) => p.pos && shown(p, filter)).length);
  const measured = (r: Ranged<MapPlace>): boolean => youHere && !!fix && meaningful(r.m, fix.accuracy);

  /* THE PLACES' SHEET FOLDED AWAY AND BACK (Map 5e — the owner's arrow; lib/map/peek.svelte.ts keeps the
     choice for the session). What the map shows stays where it is (keepUntil, below, and the engine's
     setPadding keep): the room the sheet gives back is more map at the foot. Shown again, the rail rises
     into place — unless motion is calm or reduced (app.css stills every animation then). */
  /* until when a new padding keeps the view: the fold's own height lands first, and the foot box it moves
     may measure itself again a moment later — both belong to the fold */
  let keepUntil = 0;
  let rise = $state(false);
  function togglePeek(): void {
    rise = peek.hidden;
    keepUntil = performance.now() + 1500;
    peek.toggle();
  }

  /* ---------- the search ---------- */
  let query = $state('');
  let searchEl = $state<HTMLInputElement | null>(null);
  const results = $derived(query.trim() ? searchPlaces(places, query, (c) => S.mapTab.cat[c]).slice(0, 40) : []);

  /* ---------- the engine ---------- */
  let mapEl = $state<HTMLElement | null>(null);
  let street = $state<StreetMap | null>(null);
  let failed = $state(false);
  let pack = $state<PackInfo | null | undefined>(undefined);
  /* the pack's photos and their index, once read (null: none on this phone) — and shown only for the trip the
     pack was built for (Map 5f): the Israel trip with the China pack on the phone gets no photo, no empty "no free
     photo" box on every card, no About */
  let packPhotoSrc = $state<PhotoSource | null>(null);
  const photoSrc = $derived.by<PhotoSource | null>(() => {
    const src = packPhotoSrc;
    const index = indexForTrip(src?.index, trip.id);
    return src && index ? src : null;
  });
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
        ph: !!photoOf(photoSrc?.index, p),
      })),
  );
  /* ---------- the day on the map (demo) ----------
     mapDay.sel: null — today (`now`, the app's clock and its ?d= preview); a date; 'all' — every day of the
     stay; 'off' — none. The chips are the days of the stay that have a route; after "All days" or "Off"
     they stay on the stay of the last day chosen. */
  let lastDay = $state(untrack(() => selDate(mapDay.sel)));
  $effect(() => {
    const sel = mapDay.sel;
    if (sel === null) lastDay = null;
    else if (selDate(sel)) lastDay = sel;
  });
  const dayRoutes = $derived(mapRoutes(src, places, mapDay.sel, now, lastDay, legModes.chosen));
  const daySel = $derived(dayChips(dayRoutes, mapDay.sel, now));
  const shownRoutes = $derived(dayRoutes.shown);
  const draws = $derived(routeDraws(shownRoutes));
  const stopIds = $derived(routeIds(draws));
  /** the route a place is a stop of, for its colour */
  const routeOf = (id: string | undefined) => (id ? shownRoutes.find((r) => r.stops.some((s) => s.id === id)) : undefined);
  /* the last stop opened — its row in the day's list is the one lit, and scrolled to, when the list comes back */
  let lastStop = $state<string | null>(null);
  $effect(() => {
    const id = selected?.id;
    if (id && stopIds.has(id)) lastStop = id;
  });
  /* THE CAMERA FOLLOWS A CHOICE OF DAY — a chip tapped, or the day view's "See the day on the map" (which
     chooses the day before it comes here) — and frames its stops and tonight's bed. Today's route as the
     map opens is drawn where the map opens (on you, or the place asked for). */
  let fitDay = $state(untrack(() => !sub && mapDay.sel !== null && mapDay.sel !== 'off'));
  function chooseDay(sel: typeof mapDay.sel): void {
    mapDay.sel = sel;
    fitDay = sel !== 'off';
  }
  /* a pin's photo, for the map to paint (E): the square image from the pack */
  async function pinPhoto(id: string): Promise<Blob | null> {
    const src = photoSrc;
    const p = placeById(places, id);
    const ph = src && p ? photoOf(src.index, p) : undefined;
    return src && ph ? photoBlob(src.file, src.index, ph.pin) : null;
  }
  async function loadPhotos(file: File | null): Promise<void> {
    const index = file ? await packPhotos(file) : null;
    if (alive) packPhotoSrc = file && index ? { file, index } : null;
  }

  /* THE MAP THAT CANNOT START (Map 5d): no WebGL, or a map that never loads —
     `openStreetMap` rejects and `street` is never set, so nothing below
     reaches a map that is not there; the screen says so and the rail, the
     list, the search and a place's sheet go on without it. A rebuild that
     fails later (a lost context) ends the same way, through onError. */
  function lostMap(): void {
    failed = true;
    const s = street;
    street = null;
    s?.destroy();
  }
  async function open(file: File | null, info: PackInfo | null, at?: { center: [number, number]; zoom: number }): Promise<void> {
    const m = await engine();
    if (!mapEl) return;
    const cam = at ?? start;
    let s: StreetMap;
    try {
      s = await m.openStreetMap({
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
          /* the places' sheet folding or unfolding moves nothing on the screen, only the centre the room is
             measured from: the rail does not sort itself again for it — only a real move of the map, or a new
             fix, does (Map 5f: it re-sorted right after "Show places") */
          if (v.kept) return;
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => (settled = { lat: v.lat, lng: v.lng }), 220);
        },
        onGesture: () => {
          userMoved = true;
          following = false;
        },
        onError: () => lostMap(),
        photo: (id) => pinPhoto(id),
        onDrawn: (ids, at, photos) => {
          const key = `${[...ids].sort().join(' ')}|${[...photos].sort().join(' ')}`;
          if (key !== drawnKey) {
            drawnKey = key;
            drawnIds = ids;
            drawnPhotos = photos;
          }
          const k2 = at.map((q) => `${q.x},${q.y},${q.photo ? 1 : 0},${q.chars ?? 0}`).join(' ');
          if (k2 !== drawnAtKey) {
            drawnAtKey = k2;
            drawnAt = at;
          }
        },
      });
    } catch {
      if (alive) failed = true; // the designed fallback: no map, the rest of the tab works
      return;
    }
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
      const file = info ? await packFile() : null;
      void loadPhotos(file);
      await open(file, info);
    })().catch(() => {
      if (alive) failed = true;
    });
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
    const file = await packFile();
    await loadPhotos(file);
    await open(file, info, v ? { center: [v.lng, v.lat], zoom: v.zoom } : undefined);
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
  $effect(() => {
    street?.setRoutes(draws);
  });
  $effect(() => {
    const s = street;
    if (!s || !fitDay || selected) return;
    const key = shownKey(shownRoutes);
    const points = routeFit(draws);
    fitDay = false;
    if (!key || !points.length) return;
    /* a hand-picked view: the first fix no longer pulls the map to you (the locate button still does) */
    userMoved = true;
    following = false;
    /* once the peek sheet has taken the day's list and its height (the padding follows it) */
    void tick()
      .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      .then(() => {
        /* room for a numbered pin and the name under it */
        if (street === s && shownKey(shownRoutes) === key) s.fit(points, 15.5, [36, 30]);
      });
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
    /* the beam first, so the dot is drawn over it — the board's order */
    if (coneEl) coneM = s.marker(coneEl, at, { map: true });
    if (youEl) youM = s.marker(youEl, at);
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
     its own to be under. Under a pin that wears its photo (from z15), the tag
     hangs below the photo's rim and tonight's ring, not on the photo (Map 5f,
     logic/wayfind.ts tagBelow) — the map says which pins wear it as it comes
     to rest. */
  let drawnIds = $state<Set<string>>(new Set());
  let drawnPhotos = $state<Set<string>>(new Set());
  let drawnKey = '';
  /** every pin and cluster on screen, as the map last came to rest — and how much room each takes */
  let drawnAt = $state<DrawnPin[]>([]);
  let drawnAtKey = '';
  $effect(() => {
    const s = street;
    if (!s || selected) return;
    /* a numbered stop is named by its own label: no tag on it */
    const tags = pins.filter((p) => p.v && drawnIds.has(p.id) && !stopIds.has(p.id));
    const made = tags.map((p) => {
      const v = p.v as 'today' | 'tonight';
      const el = document.createElement('span');
      el.className = `m-tag ${v}`;
      el.setAttribute('aria-hidden', 'true');
      el.textContent = v === 'tonight' ? `${S.mapTab.tonight} · ${p.label}` : `${p.label} · ${S.mapTab.today.toLowerCase()}`;
      const below = tagBelow(v, drawnPhotos.has(p.id));
      el.dataset.below = String(below);
      return s.marker(el, [p.lng, p.lat], { anchor: 'top', offset: [0, below] });
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
  /* the scale and the attribution sit over the map's foot: nothing is framed under them.
     The space kept for it is the WHOLE box's height, whichever form it wears —
     turning short (below) must never move the map, or the pins it moved for
     would move too (Map 5d) */
  let footH = $state(0);
  let footW = $state(0);
  let fullFootH = $state(0);
  let fullFootW = $state(0);
  /* no pack yet: its card sits over the map's foot, just above the rail, and
     the map keeps you and your rings in the clear band above it */
  let nopackH = $state(0);
  /** what the map keeps clear above its bottom panel: the scale and the
      attribution — over a place's sheet and Guide me, the attribution's one
      line — or, with no pack, the import card (nothing of OpenStreetMap is
      drawn then, so no attribution) */
  /* over a sheet or Guide me: the one-line attribution (34) — and, since Map 5e made most sheets reach their
     height, room for the chosen pin's name bubble, which hangs 56 px under its point, to stay clear of it */
  const footSpace = (): number => (guiding || selected ? (pack === null ? 12 : 56) : pack === null ? nopackH + 24 : (fullFootH || footH) + 20);
  function padding(): { top: number; bottom: number; left: number; right: number } {
    return { top: topH + 8, bottom: bottom + footSpace(), left: 16, right: guiding || selected ? 16 : 72 };
  }
  $effect(() => {
    void bottom;
    void topH;
    void fullFootH;
    void nopackH;
    void pack;
    void guiding;
    void selected;
    street?.setPadding(padding(), !selected && performance.now() < keepUntil);
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
    const onPlace = !!sub;
    if (!s || !y) return;
    /* `following` is read and written here UNTRACKED (Map 5d): tracked, the
       write re-ran this effect at once, and its short pan cancelled the
       flight to you it had just begun — the first fix landed short of
       YOU_ZOOM. The locate button flies to you itself when it turns
       following on. */
    untrack(() => {
      if (!following && !userMoved && !onPlace) following = true;
      if (!following || onPlace) return;
      if (!arrived) s.flyTo([y.lng, y.lat], YOU_ZOOM);
      else s.panTo([y.lng, y.lat]);
      arrived = true;
    });
  });

  /* "Show where you are": the answer to the tap is said — the position, or
     why there is none (location off for the app, or no position to be had:
     the watch is started over and the toast says so, never nothing — Map 5d) */
  let asked = false;
  function locate(): void {
    if (locator.state === 'on' && you && street) {
      following = !following;
      if (following) street.flyTo([you.lng, you.lat], Math.max(YOU_ZOOM, street.view().zoom));
      return;
    }
    following = true;
    userMoved = false;
    asked = true;
    const was = locator.state;
    locator.start();
    if (was === 'unavailable' && locator.state === 'unavailable') toast.show(S.mapTab.unavailable);
  }
  $effect(() => {
    const s = locator.state;
    if (!asked || s === 'asking') return;
    asked = false;
    if (s === 'denied') toast.show(S.mapTab.denied);
    else if (s === 'unavailable') toast.show(S.mapTab.unavailable);
  });
  /* waiting for a position you asked for — the first, or a fresh one after a while away */
  const finding = $derived(locator.state === 'asking');

  /* ---------- opening and closing a place ---------- */
  let returnTo: HTMLElement | null = null;
  /* the rail card a sheet was opened from: the rail is drawn again as the sheet
     closes, so focus goes back to the new card for the same place */
  let returnPlace: string | null = null;
  let sheetEl = $state<HTMLElement | null>(null);
  /* the place sheet's scroll box (Map 5f: it ends above the nav) */
  let sheetBox = $state<HTMLElement | null>(null);
  let guidePanel = $state<HTMLElement | null>(null);
  /* A PLACE OPENS AT ITS TOP (Map 5f). The sheet's scroll box stays on the screen as one place gives way to another
     — a pin tapped in the band of map above it — so the next place opened as far down as the last was scrolled: its
     photo and its About scrolled away. A new place starts at the top; the same place keeps where it was. */
  let boxFor: string | null = null;
  $effect(() => {
    const box = sheetBox;
    const id = selected?.id ?? null;
    if (!box || !id) {
      boxFor = null;
      return;
    }
    if (id === boxFor) return;
    boxFor = id;
    box.scrollTop = 0;
  });
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
    returnPlace = from?.classList.contains('rc-open') || from?.classList.contains('dr-open') ? id : null;
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
        const again = card
          ? document.querySelector<HTMLElement>(`.rail .rc-open[data-place="${CSS.escape(card)}"], .dr-rail .dr-open[data-place="${CSS.escape(card)}"]`)
          : null;
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
  /* WHERE BACK GOES, SAID ON ITS BUTTON (Map 5d): the screen the sheet was
     opened from — the guide, a pass, Find, the day — kept in the sheet's own
     history entry the first time it opens (the guide's way, Stop.svelte), so
     a trip through Guide me and back does not change it; a place chosen
     from another's sheet takes the entry over, and its origin with it. */
  let openedFrom = $state('');
  $effect(() => {
    if (!sub) {
      openedFrom = '';
      return;
    }
    untrack(() => {
      const st = history.state as { from?: string } | null;
      openedFrom = st?.from ?? router.prev ?? '';
      if (st?.from === undefined) history.replaceState({ ...(st ?? {}), from: openedFrom }, '');
    });
  });
  const backLabel = $derived(S.mapTab.backTo[backToOf(openedFrom)]);
  function navigate(p: MapPlace): void {
    if (!p.pos) return;
    router.go(router.mapHash(tid, p.id, true));
  }

  /* ---------- the sheets and the driver card ---------- */
  let sheet = $state<'filters' | 'list' | null>(null);
  let driver = $state<ShowCard | null>(null);
  /* a place's photo, full screen (A, F): a layer; focus goes back to what opened it */
  let viewer = $state<{ place: MapPlace; photo: PackPhoto; from: HTMLElement | null } | null>(null);
  function showPhoto(place: MapPlace | undefined, from: HTMLElement | null): void {
    const ph = place ? photoOf(photoSrc?.index, place) : undefined;
    if (place && ph) viewer = { place, photo: ph, from };
  }
  function closePhoto(): void {
    const from = viewer?.from ?? null;
    viewer = null;
    void tick().then(() => {
      if (from?.isConnected) from.focus({ preventScroll: true });
    });
  }
  async function fromList(p: MapPlace): Promise<void> {
    await router.closeTopLayer();
    openPlace(p.id, document.querySelector<HTMLElement>('.m-listbtn'));
  }

  /* ---------- Add to my day: what the day screen itself offers (Map 5d) ----------
     The day's own rule (logic/options.ts dayOffers): during the trip, not on a
     travel day — the same test Now makes to draw the day as a line — and only a
     line of the stop you are in that the day does not already have. */
  const picked = $derived(pickedIndex(dayPicks, now));
  const offers = $derived.by(() => {
    const day = resolveDay(now, dayPlans, dayDefaults, stops);
    return dayOffers({
      during: tripPhase(trip, now) === 'during',
      travel: isTravelDay(day?.runbookId, bookings, now),
      day,
      stop: currentStop(stops, now),
      picked,
    });
  });
  const candidate = $derived(selected ? offerFor(offers, { spotId: selected.spot?.id, stopId: selected.stopId }) : null);
  const pickId = $derived(candidate ? (picked.get(candidate.id) ?? null) : null);
  const dayState = $derived<'add' | 'in' | null>(candidate ? (pickId ? 'in' : 'add') : null);
  async function toggleDay(): Promise<void> {
    const c = candidate;
    const o = offers;
    if (!c || !o) return;
    if (pickId) {
      await unpick(pickId);
      toast.show(S.mapTab.removed);
    } else {
      await pickOption(trip.id, now, o.stop.id, c);
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
    /* its distance only where your position stands behind it (the panel's own) */
    return { a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, angle, km: legText(distanceM(you, p.pos), fix?.accuracy) };
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
    /* the right edge below the side controls; beside them above that — wherever a step along the edge takes it
       (Map 5f: a chip stepped up into the controls' band kept its old place on the edge, its end under Rings) */
    const under = topH + 18 + sideH + 10;
    const onEdge = (e: { side: Edge['side']; x: number; y: number }): { side: Edge['side']; x: number; y: number } =>
      e.side === 'r' ? { ...e, x: e.y - EDGE_H / 2 < under ? box.r - 64 : box.r } : e;
    /* the controls down the side: no chip lies under them */
    const controls = sideH ? { l: vw - 16 - 48, t: topH + 18, r: vw - 16, b: topH + 18 + sideH } : null;
    const me = you ? s.project([you.lng, you.lat]) : null;
    const from = you ?? (camera ? { lat: camera.lat, lng: camera.lng } : null);
    const out: Edge[] = [];
    const meet = (a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }): boolean => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const clash = (e: { side: Edge['side']; x: number; y: number }): boolean => {
      const r = edgeRect(e);
      if (me && me.x > r.l - 18 && me.x < r.r + 18 && me.y > r.t - 18 && me.y < r.b + 18) return true;
      /* nor over a pin, nor over its name: a chip laid on one would take its tap, and on its name would leave it
         unnamed — a photo pin's larger round and lower name counted as drawn (Map 5f, logic/wayfind.ts pinBox) */
      if (drawnAt.some((q) => pinOn(q, r, 4))) return true;
      if (controls && meet(r, controls)) return true;
      return out.some((o) => meet(r, edgeRect(o)));
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
        e = dx > 0 ? onEdge({ side: 'r', x: box.r, y }) : { side: 'l', x: box.l, y };
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
        const tries = [1, -1, 2, -2].map((k) => onEdge({ ...e, [along]: clamp(e[along] + k * step, lo, hi) }));
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
  /* THE FOOT KEEPS OFF THE PINS AT REST (Map 5d, logic/wayfind.ts footPlace):
     on the left, as the board draws it, unless a pin or its name lies under
     it there; then on the right, if that is clear of pins and of the side
     controls; else one short line — the scale and "© OpenStreetMap
     contributors" (the licence's words, as over a sheet and Guide me). The
     camera's padding keeps the box clear of what the map FRAMES; this keeps
     it off what the map happens to draw round it. */
  const footAt = $derived.by((): 'l' | 'r' | 'short' => {
    const full = { w: fullFootW || footW, h: fullFootH || footH };
    if (!full.w || !full.h) return 'l';
    const side = !selected && !query.trim() && sideH ? [{ l: vw - 16 - 48, t: topH + 18, r: vw - 16, b: topH + 18 + sideH }] : [];
    return footPlace(full, { width: vw, bottom: vh - bottom - 12 }, drawnAt, side);
  });
  $effect(() => {
    if (footAt === 'short' || !footH || !footW) return;
    fullFootH = footH;
    fullFootW = footW;
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
    {#if guiding && line.km}<span class="m-legkm num" aria-hidden="true" style="left:{line.mid.x}px; top:{line.mid.y + 14}px">{line.km}</span>{/if}
  {/if}

  <!-- held for the map, which places them (lib/map/street marker()) -->
  <div class="m-hold" aria-hidden="true">
    <div bind:this={youEl} class="m-you" class:off={!you} aria-hidden="true">
      <span class="ping" use:offscreen></span>
      <span class="core"></span>
      {#if !selected && !guiding}<span class="m-youlbl">{S.mapTab.you}{#if rough}<span class="num"> · {rough}</span>{/if}</span>{/if}
    </div>
    <!-- the board's beam (map4-map #m4mCone): a 50° sector, 46 px long, the
         sunrise fading from 0.55 at you to nothing at 48 px — pointing north
         here; the map turns it to your heading -->
    <div bind:this={coneEl} class="m-cone" class:off={!you || !heading} aria-hidden="true">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <defs>
          <radialGradient id="m-cone-g" cx="48" cy="48" r="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" style="stop-color: var(--sunrise-fill)" stop-opacity="0.55" />
            <stop offset="1" style="stop-color: var(--sunrise-fill)" stop-opacity="0" />
          </radialGradient>
        </defs>
        <path d="M48 48 L28.56 6.31 A46 46 0 0 1 67.44 6.31 Z" fill="url(#m-cone-g)" />
      </svg>
    </div>
    <!-- over a sheet that leaves only a thin band of map (a photo card, Map 5e — as the approved mockup draws it), the
         chosen pin goes without its name bubble: the name is in the top row and on the card, and the bubble would lie
         on the licence line -->
    <!-- a numbered stop chosen keeps its number on the map (the engine draws it, larger, ringed in white): only the
         name bubble, in the day's colour -->
    <div
      bind:this={selEl}
      class="m-sel"
      class:off={!selected?.pos}
      class:stop={!!routeOf(selected?.id)}
      class:tight={!!selected && !guiding && vh - bottom < 320}
      style="--c: {routeOf(selected?.id)?.colour ?? catColour(selected?.category ?? 'sight')}"
      aria-hidden="true"
    >
      <span class="m-seldisc"><MapIcon name={selected ? glyphOf(selected.category, selected.name, selected.native) : 'sight'} size={22} stroke={2} /></span>
      <span class="m-selname">{selected?.label ?? ''}</span>
    </div>
  </div>

  {#if failed}
    <div class="m-fail" role="status">{S.mapTab.noEngine}</div>
  {:else if !street}
    <p class="lazywait m-wait" role="status">{S.mapTab.opening}</p>
  {/if}

  {#if selected && pack && !failed}
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
      {finding}
      onclose={() => router.backOr(router.mapHash(tid, selected?.id))}
      ondriver={() => (driver = selected?.driver ?? null)}
      onlocate={locate}
      photos={photoSrc}
      photo={photoOf(photoSrc?.index, selected)}
      onphoto={(el) => showPhoto(selected, el)}
      bind:panel={guidePanel}
    />
  {:else}
    <!-- the top: search (or the chosen place's name) and the category chips -->
    <div class="m-top" bind:clientHeight={headH}>
      <div class="m-toprow">
        {#if selected}
          <button class="m-round" onclick={closePlace} aria-label={backLabel}><MapIcon name="back" size={20} stroke={1.9} /></button>
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
      {#if !selected && !query.trim() && daySel.days.length}
        <!-- the day's route: a chip per day of the stay that has one, every day, or none (demo) -->
        <div class="m-chips m-days" role="toolbar" aria-label={S.mapTab.dayRoutes} use:revealFocus>
          {#each daySel.days as d (d.date)}
            <button
              class="m-chip m-day"
              class:on={d.on}
              aria-pressed={d.on}
              aria-label={S.mapTab.dayChipAria(S.mapTab.dayChip(fmtDowDay(d.date), d.today), d.stops)}
              style="--c: {d.colour}"
              onclick={() => chooseDay(chipSel(d.date, now))}
            >
              <span class="m-daydot" aria-hidden="true"></span>
              {S.mapTab.dayChip(fmtDowDay(d.date), d.today)}
            </button>
          {/each}
          <button class="m-chip" class:on={daySel.all} aria-pressed={daySel.all} aria-label={S.mapTab.allDaysAria(dayRoutes.every.length)} onclick={() => chooseDay('all')}>
            {S.mapTab.allDays}
          </button>
          <button class="m-chip" class:on={daySel.off} aria-pressed={daySel.off} aria-label={S.mapTab.routeOffAria} onclick={() => chooseDay('off')}>
            {S.mapTab.routeOff}
          </button>
        </div>
      {/if}
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
        <!-- no map, nothing to zoom, turn or ring: only your position, which the rail still measures from -->
        {#if !failed}
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
        {/if}
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
        <!-- a day's route drawn: the card keeps its title and its button, and leaves the route some map -->
        {#if !shownRoutes.length}<p>{S.mapTab.noPackBody}</p>{/if}
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
    {#if !noPack && !selected && !failed}
      <div class="m-foot" class:right={footAt === 'r'} class:short={footAt === 'short'} style="bottom: calc({bottom}px + 12px)" bind:clientHeight={footH} bind:clientWidth={footW}>
        {#if scale}
          <span class="m-scale" role="img" aria-label={S.mapTab.scale(scale.label)}>
            <svg width={Math.max(20, scale.px + 2)} height="8" aria-hidden="true"><path d="M1 1v6h{scale.px}V1" fill="none" style="stroke: var(--ink-2)" stroke-width="1.5" /></svg>
            <span class="num">{scale.label}</span>
          </span>
        {/if}
        <span class="m-attr">{footAt === 'short' ? S.mapTab.attributionShort : S.mapTab.attribution}</span>
      </div>
    {/if}

    {#if selected}
      <!-- a place's sheet: its words scroll in a box that ENDS ABOVE THE NAV (Map 5f) — the band under it is the
           sheet's own ground, where the nav floats, so nothing of the place is ever under the nav, at any scroll -->
      <div class="m-sheet" bind:clientHeight={bottom}>
        <div class="m-sheetbox" bind:this={sheetBox}>
          <PlaceSheet
            place={selected}
            away={away(selected)}
            rough={fix && !away(selected) && selected.pos ? rough : null}
            {finding}
            todayTitle={isToday(selected, todays) ? dayTitle : null}
            tonight={isTonight(selected, now)}
            {dayState}
            tripId={tid}
            photos={photoSrc}
            entry={entryFor(photoSrc?.index, selected)}
            onphoto={(el) => showPhoto(selected, el)}
            onclose={closePlace}
            onnavigate={() => navigate(selected!)}
            ondriver={() => (driver = selected?.driver ?? null)}
            onday={() => void toggleDay()}
            onlocate={locate}
            bind:sheet={sheetEl}
          />
        </div>
      </div>
    {:else}
      <!-- the places near you — or, folded (the owner's arrow, Map 5e), a slim bar: the title, how many, and
           "Show places". The chevron is the control (it says whether the places are shown, and which box it
           folds); the grab above it folds and unfolds under a thumb too, and stays out of the reading order -->
      <section class="m-peek" class:folded={peek.hidden} aria-labelledby="m-near" bind:clientHeight={bottom}>
        <span class="m-hline" aria-hidden="true"></span>
        <button class="m-grab" tabindex="-1" aria-hidden="true" onpointerdown={(e) => e.preventDefault()} onclick={togglePeek}></button>
        <div class="m-peekhead">
          {#if shownRoutes.length}
            <h2 id="m-near" class="display">{mapDay.sel === 'all' ? S.mapTab.allDays : shownRoutes[0]!.date === now ? S.mapTab.today : fmtDow(shownRoutes[0]!.date)}</h2>
            <span class="m-peeksub">{peek.hidden ? S.mapTab.stops(shownRoutes.reduce((a, r) => a + r.stops.length, 0)) : S.mapTab.estimates}</span>
          {:else}
            <h2 id="m-near" class="display">{youHere ? S.mapTab.nearYou : S.mapTab.aroundHere}</h2>
            <span class="m-peeksub"
              >{peek.hidden ? S.mapTab.results(peekCount) : youHere && !rough ? S.mapTab.exactFirst : rough && youHere ? S.mapTab.rough(rough) : finding ? S.mapTab.locating : S.mapTab.locateForDistances}</span
            >
          {/if}
          {#if !peek.hidden}
            <button class="m-listbtn" onclick={() => (sheet = 'list')}><MapIcon name="list" size={16} />{S.mapTab.list}</button>
          {/if}
          <button
            class="m-peekbtn"
            class:folded={peek.hidden}
            aria-expanded={!peek.hidden}
            aria-controls="m-peekbody"
            aria-label={peek.hidden ? undefined : S.mapTab.hidePlaces}
            onclick={togglePeek}
            ><MapIcon name={peek.hidden ? 'chevron-up' : 'chevron-down'} size={18} stroke={2} />{#if peek.hidden}<span>{S.mapTab.showPlaces}</span>{/if}</button
          >
        </div>
        <div id="m-peekbody" class="m-peekbody" class:rise hidden={peek.hidden} onanimationend={() => (rise = false)}>
          {#if !peek.hidden}
            {#if shownRoutes.length}
              <DayRail routes={shownRoutes} {now} all={mapDay.sel === 'all'} current={lastStop} onopen={(p, el) => openPlace(p.id, el)} oncycle={(l) => legModes.cycle(l)} />
            {:else if railItems.length}
              <Rail
                items={railItems}
                total={railTotal}
                {measured}
                photos={photoSrc}
                entryOf={(p) => entryFor(photoSrc?.index, p)}
                today={(p) => isToday(p, todays)}
                onopen={(p, el) => openPlace(p.id, el)}
                onnavigate={navigate}
                onlist={() => (sheet = 'list')}
              />
            {:else}
              <p class="m-empty">{S.mapTab.nothingHere}</p>
            {/if}
          {/if}
        </div>
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

{#if viewer && photoSrc}
  <PhotoViewer src={photoSrc} photo={viewer.photo} name={viewer.place.name} native={viewer.place.native} onclose={closePhoto} />
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
  /* the heading cone: the board's beam (#m4mCone), drawn as the board draws it */
  :global(.m-cone) {
    width: 96px;
    height: 96px;
    pointer-events: none;
  }
  :global(.m-cone svg) {
    display: block;
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
  :global(.m-sel.tight .m-selname) {
    display: none;
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
  /* the day's route (demo): its own row under the search, the place types under it */
  .m-days + .m-chips {
    margin-top: 0;
  }
  .m-daydot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--c);
    box-shadow: 0 0 0 2px var(--sky);
  }
  .m-chip.m-day.on {
    color: var(--ink);
    background: linear-gradient(color-mix(in srgb, var(--c) 18%, transparent), color-mix(in srgb, var(--c) 18%, transparent)), var(--chrome);
    border-color: var(--c);
  }
  /* a numbered stop chosen: the map draws its number; the screen adds only its name */
  :global(.m-sel.stop .m-seldisc) {
    visibility: hidden;
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
  .m-foot.right {
    left: auto;
    right: 16px;
  }
  /* no room either side: one line, the scale beside the licence's words */
  .m-foot.short {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    max-width: none;
    padding: 4px 10px;
    white-space: nowrap;
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
  /* a place's sheet leaves a band of map above it for the chosen pin and its name —
     the top row, then room for the pin (Map 5e: with a photo and an About most sheets
     reach this height, and 96 px left the pin under the top row); what does not fit
     scrolls inside. THE SCROLL BOX ENDS ABOVE THE NAV (Map 5f): the sheet's foot — the
     nav's 64 px, its 16 px inset and 8 px of air, and the phone's own bar — is the
     sheet's ground and holds no words, so the floating nav never hides the end of a
     place's links or its About, at any scroll position (5e scrolled the whole sheet,
     its last ~90 px under the nav on first view) */
  .m-sheet {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 210px - env(safe-area-inset-top));
    padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
    overflow: hidden;
    background: var(--chrome);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
  }
  /* its words fade out over the last 16 px above that ground — the rail's own "there is more" — which at the end
     of the scroll is only the sheet's own padding; focus scrolled into view stays clear of the fade */
  .m-sheetbox {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-padding-bottom: 16px;
    -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
    mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
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
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.22);
    cursor: pointer;
  }
  /* a thumb's worth round the grab (Map 5e): it folds and unfolds the sheet too */
  .m-grab::before {
    content: '';
    position: absolute;
    inset: -10px -44px -9px;
  }
  /* (8 px apart since Map 5e's chevron joined the head: "Exact distances first" still whole at 384 px) */
  .m-peekhead {
    display: flex;
    align-items: center;
    gap: 8px;
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
  /* THE FOLD (Map 5e, the owner's arrow): the chevron at the head's end — round, 44 px, as the List pill;
     folded, it says "Show places" beside its up-chevron, and the sheet is its head alone above the nav */
  .m-peekbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--edge);
  }
  .m-peekbtn.folded {
    padding: 0 16px 0 12px;
  }
  .m-peekbody.rise {
    animation: m-rise 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* A SHORT SCREEN — the phone on its side (Map 5f; no orientation lock, as Map 5d decided: 915 × 412 here). The
     open "Near you" sheet (466 px) ran off the top of the screen, its chevron with it, and a place's sheet left
     ~180 px under a 292 px photo. Both are capped to the screen: "Near you" stops under the search row — its head
     and chevron always on screen, its cards' photos a lower band (Rail.svelte) and what still does not fit scrolls
     inside; a place's sheet keeps a band of map for its pin, its photo a lower band (PlaceSheet.svelte). The
     chevron folds "Near you" away and gives the whole map back. */
  @media (max-height: 540px) {
    .m-peek {
      display: flex;
      flex-direction: column;
      max-height: calc(100dvh - 84px - env(safe-area-inset-top));
    }
    .m-peekhead {
      flex-shrink: 0;
    }
    .m-peekbody {
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .m-sheet {
      max-height: calc(100dvh - 150px - env(safe-area-inset-top));
    }
  }
  @keyframes m-rise {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
</style>
