<script lang="ts" module>
  /* the stays that have already replayed themselves this session: a city
     replays on its first opening, and again only when asked */
  const flown = new Set<string>();
</script>

<script lang="ts">
  /* A STOP — Journey › a city (journey/:stopId) and its guide
     (journey/:stopId/guide). What both read is decided here once: the
     city's places and which of them have a stored position (logic/citymap),
     the stay walked hop by hop, what is booked here, the planned days and the
     guide's chapters — so the map, the sheet and the long read can never
     disagree about the same fact. */
  import { tick, untrack } from 'svelte';
  import type { Booking, DayDefault, DayPlan, ISODate, Runbook, ShowCard, Stop, Trip } from '../lib/model/types';
  import { buildCityMap, cityPlaces, stayRoute } from '../lib/logic/citymap';
  import { bookedHere, daysHere, guideChapters, guideParts } from '../lib/logic/guide';
  import { realStops, resolveDay } from '../lib/logic/day';
  import type { Spot } from '../lib/model/types';
  import { cityConstellation, cityKeepOut, labelSize, layoutCity, pinText, scaleBar, wayOnLine } from '../lib/logic/citymap';
  import { buildConnectors } from '../lib/logic/connectors';
  import { fmtDow, fmtDowDay, fmtShort } from '../lib/logic/dates';
  import { mdliteToText } from '../lib/logic/mdlite';
  import { shortName } from '../lib/logic/constellation';
  import { chipOf } from '../lib/logic/stamps';
  import { parseHash } from '../lib/logic/routes';
  import { motion } from '../lib/state/motion.svelte';
  import { blockTitle, localName, nightsOf, pullQuote, stayRange, tailWords, whenTail } from '../lib/logic/guide';
  import { mdHtml, optionsHtml, proseHtml, storyHtml } from '../lib/components/journey/html';
  import { priceOf } from '../lib/logic/booked';
  import { fmtRange, splitCostRows, tripSymbols } from '../lib/logic/prices';
  import { symbolFor } from '../lib/logic/money';
  import { resolvePlaces } from '../lib/logic/places';
  import { asWeatherCache, dayIn, weatherAge, weatherGlyph, weatherKey, weatherTemps } from '../lib/logic/weather';
  import { db } from '../lib/db/db';
  import { live } from '../lib/data/live.svelte';
  import { deleteEntity, saveEntity } from '../lib/data/edit';
  import { mutate } from '../lib/data/repo';
  import { addDocument } from '../lib/data/documents';
  import { dayPlanSpec, stopSpec } from '../lib/components/forms/specs';
  import type { FormSpec } from '../lib/components/forms/types';
  import { editMode } from '../lib/state/editMode.svelte';
  import { router } from '../lib/state/router.svelte';
  import { copyText, toast } from '../lib/state/toast.svelte';
  import { S } from '../lib/i18n/strings';
  import Icon from '../lib/components/horizon/Icon.svelte';
  import Md from '../lib/components/ui/Md.svelte';
  import MapButtons from '../lib/components/ui/MapButtons.svelte';
  import ShowOnMap from '../lib/components/map/ShowOnMap.svelte';
  import { drawnIds } from '../lib/logic/mapdrawn';
  import PhotoImg from '../lib/components/ui/PhotoImg.svelte';
  import EmptyState from '../lib/components/ui/EmptyState.svelte';
  import EditSheet from '../lib/components/ui/EditSheet.svelte';
  import TripMap from '../lib/map/TripMap.svelte';
  import { revealFocus } from '../lib/components/ui/revealFocus';

  let {
    trip,
    stop,
    stops,
    bookings,
    dayPlans,
    dayDefaults,
    runbooks,
    showCards,
    now,
    view,
  }: {
    trip: Trip;
    stop: Stop;
    stops: Stop[];
    bookings: Booking[];
    dayPlans: DayPlan[];
    dayDefaults: DayDefault[];
    runbooks: Runbook[];
    showCards: ShowCard[];
    now: ISODate;
    view?: string;
  } = $props();

  /* ---------- what the city and its guide both read, decided once ---------- */
  const places = $derived(cityPlaces(stop, { stops, showCards, bookings, dayPlans, dayDefaults }));
  /* THE CITY IS LAID OUT IN ITS OWN PIXELS (Run 3b): the map is as wide as
     the screen (at most 480) — 412 px on the boards, 384 on the S23 — and
     390 tall, so a label's estimated size is the room its words really take
     there (drawn at 412 and scaled down, the S23's labels wrapped onto their
     own pins). Read once as the city opens: the app is portrait-only. */
  const W = Math.round(Math.min(480, document.documentElement.clientWidth)) || 412;
  const H = 390;
  const map = $derived(buildCityMap(stop, places, stops, { width: W, height: H, pad: 40 }));
  const hops = $derived(map ? stayRoute(stop, map, (d) => resolveDay(d, dayPlans, dayDefaults, stops)?.placeIds, now) : []);
  const noPin = $derived(map ? map.noPin : places.filter((p) => !p.coord));
  const booked = $derived(bookedHere(stop, bookings, new Set(places.filter((p) => p.kind === 'booking').map((p) => p.id))));
  const days = $derived(daysHere(stop, dayPlans));
  const chapters = $derived(guideChapters(stop, { booked: booked.beds.length + booked.flights.length + booked.tickets.length > 0, days: days.length > 0 }));
  const parts = $derived(guideParts(stop));
  const at = $derived.by(() => {
    const real = realStops(stops);
    const i = real.findIndex((s) => s.id === stop.id);
    return i < 0 ? null : { n: i + 1, total: real.length };
  });
  const id = $derived(encodeURIComponent(trip.id));
  /* the places the Map tab draws — each gets its "Show on map" (Map 5c) */
  const onMap = $derived(drawnIds({ stops, showCards, bookings }));
  const zh = $derived(localName(stop));

  /* ---------- A CITY (f-city) — the stop at real positions, and its guide at half height ----------
     THE MAP is the trip's own map at city scale (logic/citymap.ts → a
     constellation → lib/map/TripMap): a pin only where the trip file stores a
     coordinate; the stay walked hop by hop between the pins its days name;
     the way on pointing at the next stop, amber while it is not booked. The
     live hop Flows; on its first opening the stay replays itself — one COMET
     per hop, in order — and the Replay button flies it again. Everything with
     no stored position is named under the map ("No pin yet"), never pinned
     where it might be. THE SHEET: the guide's kicker, its budget, the dates, a
     chip per chapter (each opens the guide there) and "Read the guide". The
     scale switch goes back up to the trip or across to today. */
  const pc = (v: number, of: number): string => `${(v / of) * 100}%`;
  const here = $derived(`#/trip/${id}/journey/${encodeURIComponent(stop.id)}`);
  const guide = $derived(`${here}/guide`);
  const tail = $derived(whenTail(stop));

  /* ---------- the way on, in words ---------- */
  const out = $derived(buildConnectors(stops, bookings, trip).find((c) => c.fromStopId === stop.id) ?? null);
  const exit = $derived(map?.exits.find((e) => e.role === 'out') ?? null);
  const c = $derived(map ? cityConstellation(map, hops, { width: W, height: H }, out?.state === 'booked') : null);
  const bar = $derived(map ? scaleBar(map.kmPx) : null);

  /* the map's own furniture — the note up top, the scale bar, and the way-on
     note inward from the edge it leaves by (citymap.ts cityKeepOut, which
     the tests read too); the pins' labels keep clear of all of it */
  const wayOn = $derived(out ? wayOnLine(out, stops) : '');
  const furniture = $derived(cityKeepOut({ width: W, height: H }, bar?.px ?? null, out ? exit : null, wayOn));
  const exitBox = $derived.by(() => {
    const n = furniture.note;
    if (!exit || !out || !n) return null;
    return {
      right: n.right,
      style: `${n.right ? `right:${pc(W - exit.x + 8, W)}` : `left:${pc(exit.x + 8, W)}`};top:${pc(n.top, H)}`,
      date: fmtDowDay(out.date),
      word: S.journey.leg[out.state],
      tone: out.state === 'booked' ? 'ok' : 'warn',
      line: wayOn,
    };
  });
  /* ---------- the pins' words, laid out so none covers another ---------- */
  const texts = $derived(map ? map.pins.map((p) => pinText(p, showCards, bookings, now)) : []);
  const labels = $derived.by(() => {
    if (!map) return [];
    /* the stop's own centre, with a real place within 4 km, is only the
       point the kilometres are measured from — it gets no name */
    const sizes = map.pins.map((p, i) =>
      p.places.every((x) => x.kind === 'stop') && map.pins.some((q) => q !== p && q.km < 4) ? null : labelSize(texts[i]!),
    );
    /* the sheet laps the map's last 20 px */
    return layoutCity(map.pins, sizes, { width: W, height: H - 20 }, furniture.rects).map((l) => {
      const t = texts[l.pin]!;
      return {
        ...l,
        t,
        style: `left:${pc(l.x, W)};top:${pc(l.y, H)};width:${pc(l.w, W)}`,
        /* the booking's own status, in its own tone (a walk-in is no warning) */
        tone: t.booking ? chipOf(t.booking.status).cls : '',
      };
    });
  });

  /* ---------- the stay replays itself, once ---------- */
  let flying = $state(-1);
  /* the stay can only be replayed where routes may move — under Calm
     motion, Route animations off or the phone's reduce-motion the ↻ is not
     offered at all (Run 3c: it stayed, and did nothing) */
  function fly(): void {
    if (!hops.length || !motion.routes) return;
    flying = -1;
    queueMicrotask(() => (flying = 0));
  }
  $effect(() => {
    /* not before the settings are read: under Calm motion the stay does not
       replay itself, and that is only known once they are */
    if (view === 'guide' || !hops.length || flown.has(stop.id) || !motion.known) return;
    flown.add(stop.id);
    untrack(fly);
  });
  const next = (): void => {
    flying = flying + 1 < hops.length ? flying + 1 : -1;
  };
  /* a comet that never reports landing must not strand the rest */
  $effect(() => {
    const i = flying;
    if (i < 0) return;
    const t = setTimeout(() => flying === i && next(), 4000);
    return () => clearTimeout(t);
  });

  const scale = $derived([
    { href: `#/trip/${id}/journey`, icon: 'route', label: S.city.trip },
    { href: `#/trip/${id}/now/day`, icon: 'sun', label: S.city.today },
    { href: here, icon: 'pin', label: S.city.city },
  ]);
  const openAt = (anchor: string): void => {
    router.pendingAnchor = anchor;
  };

  /* ---------- THE CITY GUIDE (f-guide) — the guide sheet pulled to full ----------
     An Edition-style long read of the stop's own trip-file prose: the photo
     hero with the city's name, a standfirst of its facts, then the chapters
     in reading order (logic/guide.ts): getting there and the money, the story
     with a drop cap and a pull quote in its own words, what is booked here and
     what is still to buy, the days, the stop's other blocks, all the options,
     and every place with its map button. (Whether each night and move is held
     is Journey's route check.) Nothing is fetched: the forecast on a day is the
     cache TripShell fills. */
  const editing = $derived(editMode.on);
  const quote = $derived(pullQuote(stop.detail));
  const symbols = $derived(tripSymbols(trip));
  const firstOption = $derived(chapters.find((c) => c.kind === 'option')?.id);

  /* ---------- what is booked here, and what is still to buy — one row shape ---------- */
  interface Row {
    b: Booking;
    icon: string;
    title: string;
    sub: string;
    price?: string;
  }
  const rows = $derived.by((): { held: Row[]; buy: Row[] } => {
    const sym = symbolFor(trip, trip.homeCurrency);
    const when = (d: string, t?: string): string => `${fmtDow(d)}${t ? ` · ${t}` : ''}`;
    const held: Row[] = [
      ...booked.beds.map((b) => {
        const p = priceOf(b, trip).range;
        return { b, icon: 'bed', title: b.title, sub: `${fmtShort(b.checkIn)} → ${fmtShort(b.checkOut)}`, price: p ? fmtRange(p, sym) : S.money.noPrice };
      }),
      /* a flight's own fare, where the file gives it one; a flight whose fare
         the file records elsewhere (the flights in and home share one, on
         the International Flights stop, which Money counts) shows no price
         line — never "price not recorded" for a price the file has (Run 3c) */
      ...booked.flights.map((f) => ({
        b: f,
        icon: 'plane',
        title: `${f.flightNo} · ${f.from.code} → ${f.to.code}`,
        sub: when(f.date, f.dep),
        price: f.priceNote,
      })),
    ];
    const buy: Row[] = [];
    for (const t of booked.tickets) {
      const r = { b: t, icon: 'ticket', title: t.title, sub: when(t.date, t.time), price: t.priceNote };
      (t.status === 'pending' ? buy : held).push(r);
    }
    return { held, buy };
  });

  /* ---------- the forecast, from the cache (never fetched here) ---------- */
  const weatherLive = live(() => db.meta.get(weatherKey(stop.id)), { deps: () => stop.id });
  const weather = $derived(asWeatherCache(weatherLive.current?.value));
  const age = $derived(weatherAge(weather, Date.now()));

  /* ---------- where the page opens (Run 3c) ----------
     A stop or a view opens at its top — except the guide, which reopens
     where it was left when back brings you to it from a pass (it reopened
     ~11,800 px up), and which remembers where it was opened from, so its
     close button can say where it goes. Both live in the guide's own
     history entry, as the browser keeps a page's scroll. */
  type Entry = { from?: string; y?: number } | null;
  let from = $state('');
  /* keyed on the stop's id, not the stop: saving the stop hands down a new
     object for the same stop, and the guide jumped to its top (Run 4b) */
  const stopId = $derived(stop.id);
  $effect(() => {
    void stopId;
    const v = view;
    const st = history.state as Entry;
    const y = v === 'guide' && untrack(() => router.pendingAnchor) === null ? (st?.y ?? 0) : 0;
    window.scrollTo(0, y);
    /* the page is drawn by now; should anything still be growing, once more */
    if (y) void tick().then(() => requestAnimationFrame(() => window.scrollY < y - 2 && window.scrollTo(0, y)));
    if (v !== 'guide') return;
    from = st?.from ?? router.prev ?? '';
    if (st?.from === undefined) history.replaceState({ ...(st ?? {}), from }, '');
  });
  /* a pass (or any screen) opened from the guide: its place on the page
     goes into the guide's entry first */
  $effect(() => {
    if (view !== 'guide') return;
    const keep = (e: MouseEvent): void => {
      if ((e.target as Element | null)?.closest?.('a[href^="#"]')) history.replaceState({ ...((history.state as Entry) ?? {}), y: window.scrollY }, '');
    };
    document.addEventListener('click', keep, true);
    return () => document.removeEventListener('click', keep, true);
  });
  /* the close button goes back the way the guide was opened — and says so */
  const closeTo = $derived.by((): keyof typeof S.guide.closeTo => {
    const r = parseHash(from || '#/');
    if (r.name !== 'trip' || (r.place === 'journey' && r.sub)) return 'map';
    return r.place;
  });
  /* A chapter asked for — a chip, "+N", another screen: it is handed over
     as the guide opens, and the guide scrolls to it once it is drawn. The
     city's chips set it BEFORE the view changes, so it waits for the guide
     (Run 3c: it was taken on the city and found by a 160 ms timer). */
  $effect(() => {
    const a = router.pendingAnchor;
    if (!a || view !== 'guide') return;
    untrack(() => (router.pendingAnchor = null));
    void (async () => {
      await tick();
      for (let i = 0; i < 20; i++) {
        const el = document.getElementById(a);
        if (el) return el.scrollIntoView({ block: 'start' });
        await new Promise(requestAnimationFrame);
      }
    })();
  });
  const mapOf = (s: Stop | Spot) => ({
    coord: s.coord,
    name: ('native' in s ? s.native : undefined) ?? s.name,
    query: s.mapQuery,
    address: s.address,
    city: s.mapCity,
    url: s.mapUrl,
  });
  const SPOT_ICON: Record<string, string> = { food: 'utensils', show: 'ticket', transport: 'train' };

  /* ---------- editing ---------- */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Sheet = { spec: FormSpec<any>; entity?: any; save: (x: any) => Promise<void>; del?: () => Promise<void> };
  let sheet = $state<Sheet | null>(null);
  /* A DELETED STOP HAS NO CITY TO STAY ON (Run 3c). The delete itself moves
     nothing: the sheet closes first (its own history entry goes, and its
     back handler with it), and only then does the app step back past the
     stop's city and guide to the Journey — whose undo toast can bring the
     stop back. (Navigating inside the delete pushed the Journey on top of
     the sheet's entry; closing the sheet then went back onto the deleted
     stop's guide — "Stop not found" — with the sheet's handler stuck.) */
  let gone: { mine: string; journey: string } | null = null;
  const closeSheet = (): void => {
    sheet = null;
    const g = gone;
    gone = null;
    if (g) void router.backPast((h) => h === g.mine || h.startsWith(`${g.mine}/`), g.journey);
  };
  const editStop = (): void => {
    /* the addresses are taken now: once the stop is deleted this screen
       has no stop to read them from */
    const leave = { mine: `#/trip/${id}/journey/${encodeURIComponent(stop.id)}`, journey: `#/trip/${id}/journey` };
    const s = stop;
    sheet = {
      spec: stopSpec(trip.id, stops.length),
      entity: s,
      save: (x: Stop) => saveEntity(db.stops, x),
      del: async () => {
        /* The way out is decided BEFORE the delete (Run 4b): the delete takes
           this screen away, sheet and all, the moment the stop is gone — its
           second write is still on its way — and the sheet hands its layer
           back as it goes, so its onclose may run before the delete returns. */
        gone = leave;
        try {
          await deleteEntity(db.stops, s, 'Stop deleted');
        } catch (ex) {
          gone = null;
          throw ex;
        }
      },
    };
  };
  const editDay = (date: ISODate, e?: DayPlan): void => {
    sheet = { spec: dayPlanSpec(trip.id, date, runbooks), entity: e, save: (x: DayPlan) => saveEntity(db.dayPlans, x), del: e && (() => deleteEntity(db.dayPlans, e, 'Day deleted')) };
  };
  /* A photo goes through the documents vault (a Blob cannot ride the form's
     JSON); only its id lands on the stop, and a photo it replaces goes. */
  async function addPhoto(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const old = stop.photoDocId ? await db.documents.get(stop.photoDocId) : undefined;
    const meta = await addDocument(file, trip.id, { stopId: stop.id, tag: 'photo' });
    await mutate(async () => {
      await db.stops.update(stop.id, { photoDocId: meta.id });
      if (old && old.tag === 'photo') {
        await db.documents.delete(old.id);
        await db.documentBlobs.delete(old.id);
      }
    });
    toast.show(S.plan.photoAdded);
  }
</script>

{#if view === 'guide'}
{#snippet item(r: Row)}
  <li>
    <a class="gd-item" href="#/trip/{id}/pocket/{encodeURIComponent(r.b.id)}">
      <span class="gd-well" aria-hidden="true"><Icon name={r.icon} size={16} /></span>
      <span class="gd-it"><span class="gd-itn">{mdliteToText(r.title)}</span><span class="gd-its">{r.sub} · <span class="chip {chipOf(r.b.status).cls}">{chipOf(r.b.status).label}</span></span></span>
      {#if r.price}<span class="num gd-price" class:nopr={r.price === S.money.noPrice}>{r.price}</span>{/if}
    </a>
  </li>
{/snippet}

<main class="guide">
  <figure class="gd-hero">
    {#if stop.photoDocId}<PhotoImg docId={stop.photoDocId} alt="" loading="eager" />{/if}
    <span class="gd-shade" aria-hidden="true"></span>
    <span class="gd-grab" aria-hidden="true"></span>
    <button class="gd-glass gd-close" onclick={() => router.backOr(`#/trip/${id}/journey/${encodeURIComponent(stop.id)}`)} aria-label={S.guide.closeTo[closeTo]}
      ><Icon name="chevron-down" size={20} stroke={1.9} /></button
    >
    <div class="gd-acts">
      <button class="gd-glass" onclick={() => copyText([mdliteToText(stop.name), stop.address].filter(Boolean).join(' · '), S.maps.copied)} aria-label={S.guide.copyPlace}
        ><Icon name="copy" size={18} /></button
      >
      <MapButtons {...mapOf(stop)} compact />
      <button class="gd-glass" class:on={editing} onclick={() => editMode.toggle()} aria-pressed={editing} aria-label={editing ? S.edit.turnOff : S.edit.turnOn}
        ><Icon name={editing ? 'check' : 'edit'} size={18} /></button
      >
    </div>
    <figcaption class="gd-title">
      {#if at}<span class="caps">{S.city.guideOf(at.n, at.total)}</span>{/if}
      <h1 class="display gd-h1">{shortName(stop.name)}</h1>
      <span class="gd-sub">{#if zh}<span class="zh gd-zh" lang="zh">{zh}</span><span aria-hidden="true">·</span>{/if}{stayRange(stop)}</span>
    </figcaption>
  </figure>

  <article class="gd-body">
    <p class="gd-stand">{S.guide.standfirst(nightsOf(stop), stayRange(stop), tailWords(whenTail(stop)))}</p>

    {#if editing}
      <div class="gd-edit">
        <button class="btn" onclick={editStop}><Icon name="edit" size={16} />{S.journey.editStop(shortName(stop.name))}</button>
        <button class="btn" onclick={() => editDay(stop.start)}><Icon name="plus" size={16} />{S.guide.addDay}</button>
        <label class="btn filebtn"
          ><Icon name="image" size={16} />{stop.photoDocId ? S.plan.replacePhoto : S.plan.addPhoto}<input type="file" accept="image/*" onchange={addPhoto} /></label
        >
      </div>
    {/if}

    {#each chapters as ch (ch.id)}
      {#if ch.id === firstOption}
        <h2 class="gd-opthead" id="g-options">{S.guide.options}<span>{S.plan.optionsHint}</span></h2>
      {/if}
      <section class="gd-ch" id={ch.id} aria-labelledby="{ch.id}-h">
        <div class="gd-chhead"><span class="num gd-n">{ch.n}</span><h2 id="{ch.id}-h" class="display gd-h2">{ch.title}</h2></div>
        <span class="gd-rule" aria-hidden="true"></span>

        {#if ch.kind === 'there'}
          {#if stop.warn}<div class="card crit gd-warn"><Md text={stop.warn} as="div" /></div>{/if}
          {#each parts.there as b (b.id)}{@html proseHtml(b, true)}{/each}
          {#if stop.costNote}<div class="gd-budget"><span>{S.guide.budget}</span><span class="num"><Md text={stop.costNote} /></span></div>{/if}
          {#each parts.costs as b (b.id)}
            <h3 class="caps gd-h3">{blockTitle(b.heading)}</h3>
            {#each b.items as it, i (i)}
              {#each splitCostRows(it, symbols) as row, j (j)}
                <p class="mrow"><span><Md text={row.label} verify /></span>{#if row.amount}<span class="num">{row.amount}</span>{/if}</p>
              {/each}
            {/each}
          {/each}
          <MapButtons {...mapOf(stop)} pill />
        {:else if ch.kind === 'story'}
          {@html storyHtml(stop.detail, quote)}
        {:else if ch.kind === 'booked'}
          {#if rows.held.length}<ul class="gd-items">{#each rows.held as r (r.b.id)}{@render item(r)}{/each}</ul>{/if}
          {#if rows.buy.length}
            <span class="caps gd-buy">{S.guide.stillToBuy}</span>
            <ul class="gd-items buy">{#each rows.buy as r (r.b.id)}{@render item(r)}{/each}</ul>
          {/if}
          {#each parts.sleep as b (b.id)}<h3 class="caps gd-h3">{blockTitle(b.heading)}</h3>{@html proseHtml(b)}{/each}
        {:else if ch.kind === 'days'}
          {#if age}<p class="small">{age}</p>{/if}
          {#each parts.glance as b (b.id)}<div class="gd-glance"><span class="caps">{S.guide.glance}</span>{@html proseHtml(b)}</div>{/each}
          {#if days.length}
            <div class="acc">
              {#each days as d (d.id)}
                {@const w = dayIn(weather, d.date)}
                {@const places = resolvePlaces(d.placeIds, { stops, showCards, bookings })}
                <details class="accitem">
                  <summary>
                    <span class="num ad">{fmtDow(d.date)}</span>
                    <span class="at"><Md text={d.title} /></span>
                    {#if w}<span class="aw"><Icon name={weatherGlyph(w.code)} size={14} /><span class="num">{weatherTemps(w)}</span></span>{/if}
                    <Icon name="chevron-down" size={16} class="chev" />
                  </summary>
                  <div class="accbody">
                    <ul>{@html d.planItems.map((p) => `<li>${mdHtml(p)}</li>`).join('')}</ul>
                    {#if places.length}
                      <div class="dayplaces">
                        <span class="caps">{S.maps.placesToday}</span>
                        {#each places as p (p.id)}
                          <span class="dchip"
                            ><span class="dcname">{p.label}</span><MapButtons
                              {...{ coord: p.coord, name: p.mapName, query: p.mapQuery, address: p.address, addressInSearch: p.addressInSearch, city: p.mapCity, url: p.mapUrl }}
                              compact
                            /></span
                          >
                        {/each}
                      </div>
                    {/if}
                    {#if d.bedLabel}<p class="bed"><Icon name="bed" size={16} /><Md text={d.bedLabel} /></p>{/if}
                    {#if editing}<button class="btn" onclick={() => editDay(d.date, d)}><Icon name="edit" size={16} />{S.guide.editDay}</button>{/if}
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        {:else if ch.kind === 'places'}
          <p class="small">{S.maps.placesHint}</p>
          <ul class="spots">
            {#each stop.spots ?? [] as sp (sp.id)}
              <li>
                <span class="thumb" aria-hidden="true">{#if sp.photoDocId}<PhotoImg docId={sp.photoDocId} alt="" />{:else}<Icon name={SPOT_ICON[sp.kind] ?? 'pin'} size={18} />{/if}</span>
                <span class="sp-nm"
                  ><b>{sp.name}</b>{#if sp.rating}<span class="stars" role="img" aria-label="{sp.rating} out of 5">{'★'.repeat(sp.rating)}<span class="off">{'★'.repeat(5 - sp.rating)}</span></span>{/if}{#if sp.verify}<span class="md-vfy">{S.plan.verify}</span>{/if}{#if sp.native}<span class="zh sp-zh" lang="zh">{sp.native}</span>{/if}</span
                >
                {#if onMap.has(sp.id)}<ShowOnMap tripId={trip.id} id={sp.id} name={sp.name} />{/if}
                <span class="sp-acts"><MapButtons {...mapOf(sp)} pill /></span>
              </li>
            {/each}
          </ul>
        {:else if ch.block && ch.kind === 'option'}
          <ul class="gd-opts">{@html optionsHtml(ch.block, stop.spots ?? [])}</ul>
        {:else if ch.block}
          {@html proseHtml(ch.block)}
        {/if}
      </section>
    {/each}

    {#if !chapters.length}<EmptyState glyph={S.empty.guide.glyph} title={S.empty.guide.title} body={S.empty.guide.body} />{/if}
    <footer class="foot">{trip.title} · {S.misc.localOnly}</footer>
  </article>
</main>

{#if chapters.length > 1}
  <button class="totop" onclick={() => window.scrollTo({ top: 0, behavior: motion.calm ? 'auto' : 'smooth' })} aria-label={S.guide.top}><Icon name="chevron-up" size={22} /></button>
{/if}

{#if sheet}
  <EditSheet spec={sheet.spec} entity={sheet.entity} onsave={sheet.save} ondelete={sheet.del} onclose={closeSheet} />
{/if}

{:else}
<main class="city">
  <header class="wrap ct-head">
    <button class="iconbtn" onclick={() => router.backOr(`#/trip/${id}/journey`)} aria-label={S.city.back}><Icon name="chevron-left" size={20} /></button>
    <div class="ct-titles">
      <span class="caps ct-scale">{S.city.scale(stayRange(stop))}</span>
      <span class="ct-namerow"><h1 class="display ct-name">{shortName(stop.name)}</h1>{#if zh}<span class="ct-zh" lang="zh">{zh}</span>{/if}</span>
    </div>
    {#if motion.routes}<button class="iconbtn ct-replay" onclick={fly} aria-label={S.city.replay} disabled={!hops.length}><Icon name="replay" size={19} stroke={1.9} /></button>{/if}
  </header>

  <nav class="wrap ct-nav" aria-label={S.city.scaleNav}>
    <div class="ct-seg">
      {#each scale as s, i (i)}<a href={s.href} class:on={i === 2} aria-current={i === 2 ? 'page' : undefined}><Icon name={s.icon} size={16} />{s.label}</a>{/each}
    </div>
  </nav>

  <!-- The map is drawn for the eye; a screen reader reads the list under it
       instead — every pin with its words and its booking's line (a label the
       layout had to leave off included), and the way on with its status
       (Run 3c: the whole map was one image, and all of that was hidden). -->
  <div class="ct-map" style="aspect-ratio:{W}/{H}" aria-hidden={c ? 'true' : undefined}>
    {#if c}
      <span class="ct-dots"></span>
      <TripMap {c} comet={flying >= 0 ? (c.legs[flying] ?? null) : null} oncometend={next} />
      <span class="caps ct-note">{S.city.real}</span>
      <span class="ct-north"><i></i>{S.city.north}</span>
      {#if bar}<span class="ct-bar" style="width:{pc(bar.px, W)}"><span class="num">{S.city.km(bar.km)}</span></span>{/if}
      {#each labels as l (l.pin)}
        <span class="ct-lbl {l.side}" style={l.style}
          ><b>{l.t.title}</b>{#if l.t.native}<span class="zh" lang="zh">{l.t.native}</span>{/if}{#if l.t.line}<span class="ln {l.tone}">{l.t.line}</span>{/if}</span
        >
      {/each}
      {#if exitBox}
        <span class="ct-exit" class:right={exitBox.right} style={exitBox.style}
          ><span class="ce-top"><span class="caps">{exitBox.date}</span><span class="chip {exitBox.tone}">{exitBox.word}</span></span><span class="ce-line">{exitBox.line}</span></span
        >
      {/if}
    {:else}
      <p class="ct-nomap">{S.city.noMap}</p>
    {/if}
  </div>
  {#if c && map}
    <ul class="sr-only" aria-label={S.city.mapAria(map.pins.length, noPin.length)}>
      {#each texts as t, i (i)}
        <li>{t.title}{#if t.native}, <span lang="zh">{t.native}</span>{/if}{#if t.line}: {t.line.replace('\n', ', ')}{/if}</li>
      {/each}
      {#if exitBox}<li>{S.city.wayOnAria(exitBox.date, exitBox.word, exitBox.line)}</li>{/if}
    </ul>
  {/if}

  <section class="ct-sheet" aria-label={S.city.guideTitle}>
    <span class="grab" aria-hidden="true"></span>
    {#if at}<span class="caps ct-kicker">{S.city.guideOf(at.n, at.total)}</span>{/if}
    <div class="ct-row">
      <h2 class="display ct-h2">{S.city.guideTitle}</h2>
      {#if stop.costNote}<span class="ct-budget"><span class="caps">{S.city.budget}</span><span class="num ct-bv"><Md text={stop.costNote} /></span></span>{/if}
    </div>
    <span class="ct-dates">{S.journey.stopSub(stayRange(stop), nightsOf(stop))}{tail ? ` · ${tail}` : ''}</span>

    {#if chapters.length}
      <nav class="ct-chips" aria-label={S.city.chapters} use:revealFocus>
        {#each chapters as ch, i (ch.id)}<a class="ct-chip" class:first={i === 0} href={guide} onclick={() => openAt(ch.id)}><span class="num">{ch.n}</span>{ch.chip}</a>{/each}
      </nav>
    {/if}

    {#if noPin.length}
      <div class="ct-nopin">
        <span class="ct-np">{S.city.noPin}</span>
        {#each noPin.slice(0, 3) as p (p.id)}<span class="ct-npc">{(p.name.split(' · ')[0] ?? p.name).trim()}</span>{/each}
        {#if noPin.length > 3}
          <a class="ct-npc more" href={guide} onclick={() => openAt(stop.spots?.length ? 'g-eat' : 'g-booked')} aria-label={S.city.moreAria(noPin.length - 3)}>{S.city.more(noPin.length - 3)}</a>
        {/if}
      </div>
    {/if}

    <a class="btn primary lg wfull ct-read" href={guide}><Icon name="book" size={18} stroke={1.9} />{S.city.read}</a>
  </section>
</main>

{/if}

<style>
  .city {
    position: relative;
  }
  .ct-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: calc(16px + env(safe-area-inset-top));
  }
  .ct-titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .ct-scale {
    color: var(--ink-2);
  }
  .ct-namerow {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .ct-name {
    margin: 0;
    font-size: var(--fs-screen-title);
    font-weight: 600;
    line-height: 1.05;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ct-zh {
    flex-shrink: 0;
    font-family: var(--font-zh);
    font-size: var(--fs-row);
    color: var(--ink-2);
  }
  .ct-replay {
    color: var(--sunrise);
    background: color-mix(in srgb, var(--sunrise-fill) 10%, transparent);
    border-color: color-mix(in srgb, var(--sunrise) 42%, transparent);
  }
  .ct-replay:disabled {
    opacity: 0.4;
  }
  .ct-nav {
    margin-top: 12px;
  }
  .ct-seg {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    height: 52px;
    padding: 3px;
    border-radius: var(--radius-pill);
    background: var(--sky-2);
    border: 1px solid var(--line);
  }
  .ct-seg a {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-label);
    font-weight: 600;
    color: var(--ink-2);
  }
  .ct-seg a.on {
    color: var(--sunrise);
    background: color-mix(in srgb, var(--sunrise-fill) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sunrise) 42%, transparent);
    box-shadow: 0 0 20px -6px color-mix(in srgb, var(--sunrise-fill) 60%, transparent);
  }
  .ct-map {
    position: relative;
    max-width: 480px;
    margin: 4px auto 0;
  }
  .ct-nomap {
    margin: 40px var(--gutter);
    padding: 24px 16px;
    border: 1.5px dashed var(--edge);
    border-radius: var(--radius-tile);
    text-align: center;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }

  /* ---------- the guide, at half height ---------- */
  .ct-sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    max-width: 480px;
    margin: -20px auto calc(-1 * (var(--nav-h) + env(safe-area-inset-bottom) + 18px));
    padding: 0 var(--gutter) calc(var(--nav-h) + env(safe-area-inset-bottom) + 28px);
    border-radius: var(--radius-photo) var(--radius-photo) 0 0;
    background: var(--sky-2);
    border-top: 1px solid var(--line);
    box-shadow: 0 -24px 60px -12px rgba(0, 0, 0, 0.85);
    animation: h-rise var(--duration-rise) var(--ease-out) both;
  }
  .ct-sheet::before {
    content: '';
    position: absolute;
    left: 28px;
    right: 28px;
    top: -1px;
    height: 1px;
    background: var(--horizon-line);
  }
  .grab {
    align-self: center;
    width: 40px;
    height: 5px;
    margin: 7px 0 6px;
    border-radius: 3px;
    background: var(--edge);
    opacity: 0.6;
  }
  .ct-kicker {
    margin-top: 6px;
    color: var(--sunrise);
    letter-spacing: 0.16em;
  }
  .ct-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-top: 6px;
  }
  .ct-h2 {
    flex: 1;
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.1;
  }
  .ct-budget {
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .ct-budget .caps {
    color: var(--faint);
  }
  .ct-bv {
    font-size: var(--fs-card-title);
    font-weight: 500;
    color: var(--sunrise);
  }
  .ct-dates {
    margin-top: 4px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  /* 6 px of the scroll box above and below the chips, so a focused chip's
     ring (3 px out) is not cut off; the margins give the room back */
  .ct-chips {
    display: flex;
    gap: 8px;
    margin: 8px calc(-1 * var(--gutter)) -6px;
    padding: 6px var(--gutter);
    overflow-x: auto;
    /* a chip scrolled to by focus stops short of the edge, ring and all */
    scroll-padding-inline: var(--gutter);
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(90deg, #000 84%, transparent);
    mask-image: linear-gradient(90deg, #000 84%, transparent);
  }
  .ct-chip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 16px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--ink);
    background: var(--card-2);
    border: 1px solid var(--line);
    white-space: nowrap;
  }
  .ct-chip .num {
    font-size: var(--fs-caps);
    color: var(--ink-2);
  }
  .ct-chip.first {
    background: color-mix(in srgb, var(--sunrise-fill) 10%, transparent);
    border-color: color-mix(in srgb, var(--sunrise) 42%, transparent);
  }
  .ct-chip.first .num {
    color: var(--sunrise);
  }
  .ct-nopin {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .ct-np {
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .ct-npc {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 0 9px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-chip);
    font-weight: 500;
    color: var(--lilac-ink);
    background: var(--lilac-soft);
    border: 1px dashed var(--lilac-line);
  }
  .ct-npc.more {
    min-height: 44px;
    min-width: 44px;
    justify-content: center;
    font-weight: 600;
  }
  .ct-read {
    margin-top: 14px;
  }

  /* ---------- the map's own furniture, over the trip's map ---------- */
  .ct-map :global(.tmap) {
    position: absolute;
    inset: 0;
  }
  .ct-dots {
    position: absolute;
    inset: 0;
    background-image: var(--dot-grid);
    background-size: 22px 22px;
    -webkit-mask-image: radial-gradient(ellipse 66% 60% at 50% 50%, #000 35%, transparent 85%);
    mask-image: radial-gradient(ellipse 66% 60% at 50% 50%, #000 35%, transparent 85%);
  }
  .ct-note {
    position: absolute;
    left: 46px;
    top: 10px;
    color: var(--faint);
    letter-spacing: 0.12em;
  }
  .ct-north {
    position: absolute;
    left: 24px;
    top: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: var(--fs-caps);
    font-weight: 700;
    color: var(--ink-2);
  }
  .ct-north i {
    width: 0;
    height: 0;
    border: 5px solid transparent;
    border-bottom: 9px solid var(--ink-2);
    border-top: 0;
  }
  .ct-bar {
    position: absolute;
    left: 20px;
    bottom: 22px;
    height: 10px;
    border: 1.5px solid var(--ink-2);
    border-top: none;
  }
  .ct-bar .num {
    position: absolute;
    left: calc(100% + 6px);
    top: -4px;
    font-size: var(--fs-caps);
    color: var(--ink-2);
    white-space: nowrap;
  }
  .ct-lbl {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 1px;
    pointer-events: none;
    font-size: var(--fs-chip);
    line-height: 1.3;
  }
  .ct-lbl.left {
    align-items: flex-end;
    text-align: right;
  }
  .ct-lbl.below,
  .ct-lbl.above {
    align-items: center;
    text-align: center;
  }
  .ct-lbl b {
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .ct-lbl .zh {
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  /* a booking's line is two rows: when, then which booking and its status */
  .ct-lbl .ln {
    white-space: pre-line;
    font-weight: 600;
    color: var(--ink-2);
  }
  .ct-lbl .ok {
    color: var(--ok-ink);
  }
  .ct-lbl .warn {
    color: var(--warn-ink);
  }
  .ct-exit {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 46%;
    pointer-events: none;
  }
  .ct-exit.right {
    align-items: flex-end;
    text-align: right;
  }
  .ce-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ce-top .caps {
    color: var(--warn-ink);
    letter-spacing: 0.12em;
  }
  .ct-exit .chip {
    min-height: 22px;
    padding: 0 8px;
    font-size: var(--fs-caps);
  }
  .ce-line {
    font-size: var(--fs-chip);
    line-height: 1.35;
  }

  /* ---------- the guide ---------- */
  .guide {
    padding-bottom: 8px;
    animation: h-rise var(--duration-rise) var(--ease-out) both;
  }
  /* ---------- the hero: the stop's photo, else the dawn scene ---------- */
  .gd-hero {
    position: relative;
    height: 220px;
    max-width: 480px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: 0 0 var(--radius-photo) var(--radius-photo);
    background:
      radial-gradient(circle at 73% 64%, var(--sunrise-fill) 0 24px, transparent 25px),
      var(--scene-sky);
  }
  .gd-hero::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 46%;
    background: var(--ridge-3);
    clip-path: polygon(0 40%, 22% 12%, 38% 34%, 56% 4%, 74% 30%, 88% 16%, 100% 32%, 100% 100%, 0 100%);
  }
  .gd-hero :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 42%;
  }
  /* the words sit on night sky: 92 % at the foot, where the title is */
  .gd-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(11, 12, 22, 0.55) 0%, rgba(11, 12, 22, 0) 30%, rgba(11, 12, 22, 0.5) 55%, rgba(11, 12, 22, 0.92) 100%);
  }
  .gd-grab {
    position: absolute;
    left: 50%;
    top: 10px;
    width: 40px;
    height: 5px;
    margin-left: -20px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.55);
  }
  .gd-glass,
  .gd-hero .gd-acts :global(.maps.compact .mapbtn) {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: var(--radius-pill);
    color: var(--photo-ink);
    background: rgba(11, 12, 22, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .gd-close {
    position: absolute;
    left: 16px;
    top: calc(22px + env(safe-area-inset-top));
  }
  .gd-acts {
    position: absolute;
    right: 16px;
    top: calc(22px + env(safe-area-inset-top));
    display: flex;
    gap: 8px;
  }
  .gd-glass.on {
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
  }
  .gd-title {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--photo-ink);
  }
  .gd-title .caps {
    letter-spacing: 0.16em;
  }
  .gd-h1 {
    margin: 0;
    font-size: var(--fs-hero-code);
    font-weight: 600;
    line-height: 0.98;
    letter-spacing: -0.045em;
    overflow-wrap: anywhere;
    text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
  }
  .gd-sub {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: var(--fs-label);
  }
  .gd-zh {
    font-size: var(--fs-body);
  }

  /* ---------- the article ---------- */
  .gd-body {
    max-width: 480px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .gd-stand {
    margin: 16px 0 0;
    font-size: var(--fs-body);
    line-height: 1.45;
  }
  .gd-edit {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }
  .filebtn {
    position: relative;
    overflow: hidden;
  }
  /* the file input is invisible inside the label: the label wears its ring */
  .filebtn:focus-within {
    outline: 2px solid var(--sunrise);
    outline-offset: 3px;
  }
  .filebtn input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }
  .gd-opthead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    margin: 30px 0 0;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: var(--fs-caps);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--sunrise);
    scroll-margin-top: 12px;
  }
  .gd-opthead span {
    font-size: var(--fs-chip);
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--faint);
  }
  .gd-ch {
    display: flex;
    flex-direction: column;
    margin-top: 26px;
    scroll-margin-top: 12px;
  }
  .gd-chhead {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .gd-n {
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
  }
  .gd-h2 {
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.025em;
  }
  .gd-rule {
    height: 1px;
    margin: 8px 0 2px;
    background: linear-gradient(90deg, rgba(255, 179, 138, 0.7), rgba(182, 156, 255, 0.5), rgba(127, 227, 240, 0));
  }
  .gd-body :global(.gd-p) {
    margin: 10px 0 0;
    font-size: var(--fs-row);
    line-height: 1.55;
  }
  .gd-body :global(.gd-drow) {
    display: flex;
    gap: 10px;
    margin: 8px 0 0;
    font-size: var(--fs-label);
    line-height: 1.5;
  }
  .gd-body :global(.gd-drow > b) {
    flex-shrink: 0;
    min-width: 64px;
    font-size: var(--fs-chip);
    font-weight: 600;
    color: var(--sunrise);
  }
  /* a Getting-there line's fallback, in its own amber callout (f-guide) */
  .gd-body :global(.gd-fall) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-inner);
    font-size: var(--fs-caption);
    line-height: 1.45;
    background: linear-gradient(var(--warn-soft), var(--warn-soft)), var(--card);
    border: 1px solid var(--warn-line);
  }
  .gd-body :global(.gd-fall > .caps) {
    font-weight: 700;
    color: var(--warn-ink);
  }
  .gd-h3 {
    margin: 18px 0 0;
    color: var(--ink-2);
  }
  .gd-warn {
    margin: 12px 0 0;
  }
  .gd-budget {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-top: 14px;
    font-size: var(--fs-label);
    color: var(--ink-2);
  }
  .gd-budget span:first-child {
    flex: 1;
  }
  .gd-budget .num {
    font-size: var(--fs-code-lg);
    font-weight: 500;
    color: var(--sunrise);
    text-shadow: 0 0 18px rgba(255, 159, 107, 0.45);
  }
  .mrow {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    padding: 6px 0;
    border-bottom: 1px dashed var(--line);
    font-size: var(--fs-label);
    line-height: 1.45;
  }
  .mrow span:first-child {
    flex: 1;
    min-width: 0;
  }
  /* an amount is printed as written, and some carry their terms
     ("¥165 (4 consecutive days, …)"): it wraps at the right rather than
     running over its label */
  .mrow .num {
    flex: 0 1 auto;
    max-width: 62%;
    font-weight: 600;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .gd-ch > :global(.maps.pill),
  .gd-ch > :global(.addrcopy) {
    align-self: flex-start;
    margin-top: 12px;
  }

  /* ---------- the story ---------- */
  .gd-body :global(.gd-story) {
    margin: 10px 0 0;
    font-size: var(--fs-body);
    line-height: 1.6;
  }
  .gd-body :global(.gd-story.lead::first-letter) {
    float: left;
    margin: 5px 10px 0 0;
    font-family: var(--font-display);
    font-size: var(--fs-wordmark);
    font-weight: 600;
    line-height: 0.82;
    letter-spacing: -0.04em;
    color: var(--sunrise);
  }
  .gd-body :global(.gd-quote) {
    display: flex;
    gap: 12px;
    margin: 12px 0 0;
    padding: 8px 0;
    border-top: 1px solid rgba(255, 179, 138, 0.45);
    border-bottom: 1px solid rgba(182, 156, 255, 0.35);
  }
  .gd-body :global(.gd-quote span) {
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: var(--fs-hero-code);
    font-weight: 600;
    line-height: 0.8;
    color: var(--sunrise);
  }
  .gd-body :global(.gd-quote blockquote) {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-body);
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  /* ---------- booked ---------- */
  .gd-items {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }
  .gd-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 6px 0;
    color: var(--ink);
  }
  .gd-well {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--card-2);
  }
  .buy .gd-well {
    color: var(--warn);
    background: none;
    border: 1px dashed var(--warn-line);
  }
  .gd-it {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .gd-itn {
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .gd-its {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .gd-price {
    flex-shrink: 0;
    font-size: var(--fs-label);
    color: var(--sunrise);
  }
  .gd-price.nopr {
    font-family: var(--font-ui);
    font-size: var(--fs-chip);
    color: var(--faint);
  }
  .gd-buy {
    margin-top: 12px;
    color: var(--warn-ink);
  }
  .gd-glance {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--card);
    border: 1px solid var(--line);
  }
  .gd-glance > .caps {
    color: var(--ink-2);
  }

  /* ---------- the days ---------- */
  .acc {
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-inner);
    overflow: hidden;
  }
  .accitem + .accitem {
    border-top: 1px solid var(--line);
  }
  /* the accordion clips its rounded corners: a day's focus ring goes inside */
  .accitem > summary:focus-visible {
    outline-offset: -4px;
  }
  .accitem > summary {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 8px 12px;
    list-style: none;
    cursor: pointer;
    background: var(--card);
  }
  .accitem > summary::-webkit-details-marker {
    display: none;
  }
  .ad {
    flex-shrink: 0;
    font-size: var(--fs-chip);
    color: var(--sunrise);
  }
  .at {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .aw {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .accitem :global(.chev) {
    color: var(--faint);
    transition: transform var(--motion-fast) var(--ease-out);
  }
  .accitem[open] :global(.chev) {
    transform: rotate(180deg);
  }
  .accbody {
    padding: 2px 14px 12px;
    background: var(--card);
    font-size: var(--fs-row);
    line-height: 1.55;
  }
  .accbody ul {
    margin: 0;
    padding-left: 18px;
  }
  .accbody > .btn {
    margin-top: 10px;
  }
  .dayplaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .dayplaces > .caps {
    width: 100%;
    color: var(--faint);
  }
  .dchip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px 0 12px;
    border-radius: var(--radius-pill);
    background: var(--card-2);
    border: 1px solid var(--line);
  }
  .dcname {
    max-width: 52vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .bed {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0 0;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }

  /* ---------- the options ---------- */
  .gd-opts {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }
  .gd-opts :global(li) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 7px 0;
    font-size: var(--fs-row);
    line-height: 1.45;
  }
  .gd-opts :global(li > span:first-of-type) {
    flex: 1;
    min-width: 0;
  }
  .gd-opts :global(li > .hicon) {
    margin-top: 3px;
    color: var(--ink-2);
  }
  .gd-opts :global(li.star > .hicon) {
    color: var(--sunrise);
    fill: currentColor;
    filter: drop-shadow(0 0 6px rgba(255, 159, 107, 0.7));
  }
  .gd-opts :global(.go-cost) {
    flex-shrink: 0;
    font-size: var(--fs-caption);
    color: var(--sunrise);
  }

  /* ---------- places ---------- */
  .spots {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  /* a place: its name, and beside it the Map tab's doorway (Map 5c); under
     them, at the row's end, Open in Maps and Copy address — beside the name
     they ran past the screen (4 px at 384 with the two pills, Known issue 16;
     84 px with the doorway too) */
  .spots li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    min-height: 56px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
  }
  .sp-acts {
    flex: 1 0 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }
  .spots li:last-child {
    border-bottom: none;
  }
  .thumb {
    position: relative;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-chip-sm);
    overflow: hidden;
    color: var(--ink-2);
    background: var(--card-2);
  }
  .thumb :global(img) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sp-nm {
    flex: 1 1 0;
    min-width: 0;
    font-size: var(--fs-label);
    line-height: 1.4;
  }
  .stars {
    margin-left: 6px;
    color: var(--sunrise);
    letter-spacing: 1px;
  }
  .stars .off {
    color: var(--ink-2);
    opacity: 0.4;
  }
  .sp-zh {
    display: block;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .spots :global(.maps) {
    margin-top: 0;
    flex-shrink: 0;
  }
  .totop {
    position: fixed;
    right: max(16px, calc(50vw - 240px + 16px));
    bottom: calc(env(safe-area-inset-bottom) + 18px);
    z-index: 55;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 50%;
    color: var(--sunrise);
    background: var(--card-2);
    border: 1px solid var(--edge);
    box-shadow: var(--shadow-float);
  }
</style>
