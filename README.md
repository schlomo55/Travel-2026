# Living the dream

A personal, offline-first travel companion. Trips are projects: the first one was a China trip,
and every trip after it takes minutes to start rather than a rebuild — you fill in a markdown
brief and a Claude session compiles it into a file you import. See
[Starting another trip](#starting-another-trip).

Everything lives on your phone. There is no account, no server, and nothing is ever uploaded.

```
C:\Source\China\
├─ app/                      Living the dream — the app you install (Svelte 5 + TypeScript + Vite)
├─ seed/                     demo-2027.trip.json — "TEST — Demo China", a made-up trip the tests and
│                            the rehearsal run on — plus the test and template-example trips
├─ STATUS.md                 one page: where the trip stands today, and what is still open
├─ OVERVIEW.md               one page: what it does, what it is for, how it works
├─ docs/ARCHITECTURE.md      how it is built and why
└─ docs/NEW-TRIP.md          how the next trip starts: a brief, compiled into a seed
                             + TRIP-BRIEF-TEMPLATE.md and examples/ — the blank form and a filled-in one
```

**This repository is public, by the owner's decision on 2 Nov 2026, because friends use it.**
The real trips are not in it: the owner's own trips are imported on the phone from private files,
and `seed/` holds only made-up trips ("Sample" businesses, `DEMO` codes). Passport numbers live
outside the repository. The *app itself* carries none of that — see “Privacy” below.

---

## Getting it onto the phone

Once, on the PC:

```bash
cd app
npm install
npx wrangler login                      # opens a browser; approve once
npx wrangler pages project create livingthedream
npm run deploy
```

`npm run deploy` type-checks, builds, **fails if any personal data reached the bundle**,
re-runs the demo-seed audit (`verify:demo`), and uploads. You get an HTTPS URL like
`https://livingthedream.pages.dev`.

Then, on the S23 Ultra:

1. Open the URL in Chrome.
2. Menu (⋮) → **Add to Home screen** → Install.
3. Open it once and tap around — that earns it protected storage.
4. **Load your trip:** put your trip file (compiled from a brief, see
   [Starting another trip](#starting-another-trip), or a backup exported from the app) somewhere the
   phone can reach (a cable copy, Drive, or an email to yourself), then in the app: **Import a trip** →
   choose the file → **Import**. To try the app first, `seed/demo-2027.trip.json` is a made-up trip.
5. **Test in airplane mode before you fly.** Turn on airplane mode, kill the app, reopen it.
   Every screen must render. If it does, it will work abroad.

   A scripted version of that walk-through lives in the repo — with `npm run preview` running
   in one terminal, `npm run rehearsal` in another imports the demo trip (`seed/demo-2027.trip.json`)
   and drives a headless browser hard-offline through all five tabs and the demo's difficult days,
   the driver card and its Chinese address, the ticket PDF, the place photos, the map buttons, the
   booked-and-committed money breakdown, and proof that with the
   network off the app does not reach out at all.
   It is not a substitute for doing it on the actual phone,
   but it catches regressions in seconds.

If you have a backup from the old single-file app, the app can still import it the same way —
expenses, ticks, notes, custom packing items and the gift-card balance land back on the imported trip.

---

## Using it

**The shelf** lists every trip — active, upcoming, past. Tap one to open it.

Inside a trip, five tabs:

| Tab | What it is for |
|---|---|
| 🏠 **Today** | The date-aware home. Countdown before the trip; during it: day N, the plan, tonight's bed, the next leg, the next deadline. On hard travel days a tickable runbook replaces prose. |
| 🗺 **Plan** | The schematic route map, then every stop as a photo card — tap to expand the day-by-day detail, or open **Read more** for the city guide: a winter photo, then *getting there & money* (how you arrive, the budget, the flights that touch this stop, and the map button), *the story*, a tappable *day by day*, the practical blocks, **All the options** — researched picks and alternatives, ⭐ = recommended — and **📍 Places here**, every place named in those options as a row you can open in a map. |
| 🎫 **Wallet** | Boarding-pass cards with the confirmation code in the biggest type in the app, tap to copy. Plus stays, ID/money cards, the money tracker, and your files. |
| ✅ **Tasks** | Deadline-sorted actions with their reasoning, packing (with reusable templates), checklists, and the timed moments you export to the phone calendar. |
| ℹ️ **Info** | Compliance counters (the visa clock), clocks, phrase and place cards you hold up for a driver, emergency numbers, and every gotcha. |

**The ✎ button in the top bar turns on editing.** It is off by default so the Wallet reads clean
when you hold it across a counter. With it on, every card gets an ✎ and every section a ＋.
Deleting always offers Undo.

**Counters** generalize the visa clock: give one a start date, a limit in days, whether the count
starts the day *after* entry, and a hard deadline. The pinned one shows in the top bar on every
screen, because that number is the one you cannot lose track of.

**Maps.** One button — **🗺 Open in maps** — on every city, driver card, booking and place. In the
mainland it fires Android's own `geo:` intent, so the first tap puts up the phone's app chooser
(Amap 高德地图, Google Maps, Organic Maps, Waze…) and after that the phone keeps using whichever you
picked. Install **Amap** before you fly: it is the one that works everywhere in the mainland.
**Hong Kong is the exception and goes straight to Google Maps** — tested on the phone, Amap centres
the right street there but has no entry for a landmark like Tai Kwun, offering a shop, a park and
three office buildings instead, while Google opens it with its hours and 13,000 reviews. The app
decides by location; you never choose.

What the button sends is a **name**, not a coordinate — so each app resolves it in its own data and
China's shifted GCJ-02 datum never gets the chance to move the pin. Where only a coordinate is
known it goes out as a plain WGS-84 pin with no label at all. Both of those details were learned
the hard way on a real phone: Amap reads everything after `q=` as one literal keyword, so a comma
between the name and the city ("中国国家博物馆, 北京") made it answer *Info not found* while a space
opened the museum; and a labelled coordinate pin made it draw nothing whatsoever, leaving the raw
`%E2%80%94` of an em-dash sitting in its search box.

Every one of those names was checked against OpenStreetMap before it shipped (the first trip's
coordinate pass; its checker went with that trip — the rules that remain are in
`app/scripts/maps/pins/`): the answer has to *be* the right place, and it has to land near a coordinate
verified by hand. **About one name in seven failed, and those ship no button at all.** "CHAO
Sanlitun" resolves to the Workers' Stadium; "The Jade Emu" resolves to nothing; a hotel pin on the
wrong building is worse than no pin. A missing button is the app telling you the truth — the
reason is written into the trip's map manifest.

**Addresses.** 86 of those places also carry their street address in Chinese —
重庆市渝中区朝天门街道沧白路 — taken from OpenStreetMap's own address data, never composed by hand.
**The address is for the human, the name is for the machine.** It shows **full screen on the driver
card**, in large type with a copy button, so you can hand the phone to a taxi driver — and that is
all it normally does. It joins the map search only where a chain needs the street to pick a branch,
which today is 东来顺 and 四季民福; the phone confirms that lands on the Dongsi branch the guide
names.

That rule was written by testing, not by taste. Sending the street with the name buried 北京南站
under road segments — its street is literally called 南站幸福路, "South Station Happiness Road" —
while the name and city alone opened the station with its entrances and parking. The airport did
the same, ranking its own street above itself. The lists themselves look exactly as they did.
Long-press any map button to copy the address, or the place name where there is no address.

A second source, **Wikidata**, cross-checks every name and coordinate. It earned its place on the
first run: the Zhangjiajie airport card said 张家界荷花机场, which OpenStreetMap has never heard of,
so the card had been demoted to a bare coordinate. Wikidata's Q1134280 — IATA **DYG**, its own
coordinate 10 m from ours — spells it 张家界荷花国际机场, and under *that* name OpenStreetMap
answers instantly, 170 m away. One missing character. The card now shows the real name and opens
the real airport. Chongli was rescued too, by both sources agreeing. **Three places still open by
coordinate alone** — the Kunyu academy, whose address it has still not sent; the Tiger Leaping
Gorge trailhead, whose name every map service misplaces by 15 km; and a Shenzhen street number,
which is a door on a 25 km road. Each says why, in the manifest, in full.

**The street map.** The Map tab draws your places on OpenStreetMap streets kept on the phone — a
*map pack*, one file, read with no signal at all. Two ways to get one, both in Settings › Map pack
(and on the Map tab while no pack is on the phone):

- **Import map pack** — a pack file from Drive or Downloads (the workshop's `npm run map:pack`).
- **Build map for this trip** — in the Android app. It cuts the trip's own region — the streets
  round every place, and at least 25 km round every stop — out of the newest OpenStreetMap build
  (Protomaps), tells you the download size first (about 131 MB for China, a 125 MB map) and asks, because the new
  pack **replaces the one on the phone** — the place photos of the trip come along into it; another
  trip's photos do not. Wi-Fi or mobile data. **Cancel** any time and **Carry on** later — even after the
  app was closed — from where it stopped. In a browser the button is not there: building needs
  the app. The Map tab offers it whenever the map on the phone is not the trip's; Settings builds
  for the trip you came from, and says which.
- **Add place photos from a pack file** — puts a photo pack's place photos (the workshop's
  `…-map-photos.pmtiles`) into the map on the phone, keeping its streets.

With a connection the map also fills in, from Protomaps, the streets the pack does not have —
outside its areas, or everywhere with no pack yet — and a small badge in its corner says which
you are looking at: **Offline map** or **Online**. With no connection it asks nothing and shows
what the pack holds.

**Weather.** When the phone is online, the app quietly fetches a 16-day forecast for the stop you
are in and the next one, and caches it. Today shows a temperature chip (and snow falling on the
hero photo when it is actually snowing); the day rows in a city guide show a small chip each.
With an empty cache nothing renders at all — no placeholders, no error. Settings has a switch to
turn it off entirely.

**Previewing another day:** Settings → *Preview a date*, or add `?d=2026-12-11` to the URL. The
whole app behaves as if it were that day. Tap the amber pill to come back.

---

## Starting another trip

The first trip was reverse-engineered from documents. Every trip now starts from a form instead: copy
[docs/TRIP-BRIEF-TEMPLATE.md](docs/TRIP-BRIEF-TEMPLATE.md), describe the trip in prose — flights,
beds, cities, the rules you book by — and hand it to a Claude session in this repo, which compiles
it into `seed/<your-trip>.trip.json`. You import that exactly the way you import any trip file.

The whole thing turns on one marker: **every flight and bed line starts `- ✅ BOOKED —` or
`- ⏳ OPEN —`.** A ✅ line becomes a real booking — a green chip and its reference readable offline
in one tap. A ⏳ line becomes a placeholder plus a dated task — an amber chip on that leg and a
to-do in the Tasks tab — and it stays amber, never red, because *known about, not bought yet* is
the honest answer until money changes hands. You book the ⏳ items with Claude at planning time,
paste the confirmations back into the brief, recompile, re-import; the trip is done when nothing
is amber. The five-step loop, the id rule and a worked example are in
[docs/NEW-TRIP.md](docs/NEW-TRIP.md).

---

## Backups — please actually do this

Browser storage can be cleared, especially when the phone is low on space. Settings → Storage →
**Backup & restore**:

- **Save everything** — one file, your documents included. Mail it to yourself.
- **Copy as text** — fits in a note; excludes documents.
- Restore accepts Living the dream backups, single-trip files, and old China-app backups.

The app nags you on the shelf once your changes outlive the last backup. It is not being fussy;
there is no server holding a second copy.

---

## Privacy

The old app had the passport number, every PNR and the gift-card number inside the HTML that was
deployed to a public URL. Living the dream fixes that structurally:

- **The deployed bundle contains zero personal data.** All trip content is your data, in the
  phone's database. Your trip arrives as a file *you* import.
- `npm run build` runs `check:dist`, which greps every built file for the passport number,
  the PNRs, ticket numbers, the gift-card number and the traveller's name — and **fails the
  build** if any of them appear. (It caught a real leak the first time it ran: a form placeholder
  that used the real Etihad PNR as its example.)
- The Israeli passport number appears nowhere — not in the app, not in the bundle, not in the
  seed. The check reads it from the source document so it never has to be written down in code,
  and asserts its absence.

### Photos, weather and maps

- **Photos** are bytes in your own database. They are embedded in the seed file and never fetched.
- **Maps** are links. Tapping the map button hands a name, an address or a coordinate to whichever
  map app you chose, and nothing else; the app itself never contacts any of them.
- **The street map** goes online for two things only, and only in the Android app: the street
  tiles your map pack does not have, from [Protomaps](https://protomaps.com), while the phone is
  online — the request names a map tile, never you or your trip — and a map pack you build with
  **Build map for this trip**. With no connection it makes no request at all. The Protomaps key is
  the owner's and is not in this public repository: it is read from the build machine's private
  folder only for the Android build, and the privacy gate fails if it ever reaches `dist/`. The verification
  that decided which places get a button — and which addresses were worth shipping — runs in the
  workshop against OpenStreetMap and Wikidata, never on the phone.
- **Weather** is the one place the app talks to the internet. Only the *coordinates* of your
  current and next stop are sent, only to [open-meteo.com](https://open-meteo.com), only when the
  phone is online and the Settings switch is on. There is no account and no key, so nothing
  identifies you. It times out after 8 seconds, fails silently, and the app is fully usable if it
  never succeeds — which is what will happen inside the Firewall without the VPN.

Beyond that (and the street map above), the only features that touch the network are the
“Find email” buttons and booking links. Inside mainland China those need the VPN. Everything else works with no signal at all.

---

## Working on it

```bash
cd app
npm run dev          # local dev server, on http://localhost:8080 (the online map's dev origin)
npm test             # the unit tests — dates, counters, money, seed parity, legacy import, map,
                     #             addresses, the GCJ-02 conversion and the weather code map
npm run check        # TypeScript + Svelte, must stay clean
npm run build        # check + build + privacy gate — dist/, keyless (committed, the PWA)
npm run build:android # the same for the Android app → dist-android/ (git-ignored), with the
                     #             online map's key from ~/.ltd-private/protomaps.key if present
npm run preview      # serve the built app (service worker only works here, not in dev)
npm run seed-build   # rebuild seed/demo-2027.trip.json ("TEST — Demo China") from app/scripts/demo-trip/
npm run seed-build:template-example # rebuild the worked example trip (slug tx00) from the
                     #             brief in docs/examples/ — the template pipeline, end to end
npm run verify:demo  # the demo seed is exactly what its builder makes, and passes every rule
npm run rehearsal    # airplane-mode dress rehearsal on the demo trip (needs `npm run preview` running)
npm run deploy       # build + audit + upload to Cloudflare Pages
```

`app/dist/` is committed on purpose: if the toolchain ever stops installing, that folder is still
a working app you can drag into the Cloudflare dashboard.

Design and data-model decisions are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## The old app

The original single-file China app and the real trip's source documents were removed from this
repository in Nov 2026 (they carried the owner's personal trip data). The app can still import a
backup made by that old app; the tests do so with synthetic fixtures.
