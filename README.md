# Living the dream

A personal, offline-first travel companion. Trips are projects: China 2026 is the first one,
and every trip after it takes minutes to start rather than a rebuild.

Everything lives on your phone. There is no account, no server, and nothing is ever uploaded.

```
C:\Source\China\
├─ app/                      Living the dream — the app you install (Svelte 5 + TypeScript + Vite)
├─ seed/                     china-2026.trip.json — the China trip as an importable file
├─ legacy/                   the old one-file China app, frozen and still deployable
├─ sources/china-2026/       the authority documents (guide, handoff, insurance, flights PDF)
│                            + extras/ and options/ — the authored city-guide text
├─ OVERVIEW.md               one page: what it does, what it is for, how it works
└─ docs/ARCHITECTURE.md      how it is built and why
```

**This repository is private and must stay private.** `seed/` and `sources/` contain passport
and booking numbers. The *app itself* carries none of that — see “Privacy” below.

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
re-runs the China parity audit, and uploads. You get an HTTPS URL like
`https://livingthedream.pages.dev`.

Then, on the S23 Ultra:

1. Open the URL in Chrome.
2. Menu (⋮) → **Add to Home screen** → Install.
3. Open it once and tap around — that earns it protected storage.
4. **Load the China trip:** put `seed/china-2026.trip.json` somewhere the phone can reach
   (a cable copy, Drive, or an email to yourself), then in the app: **Import a trip** →
   choose the file → **Import**.
5. **Test in airplane mode before you fly.** Turn on airplane mode, kill the app, reopen it.
   Every screen must render. If it does, it will work in China.

   A scripted version of that walk-through lives in the repo — with `npm run preview` running
   in one terminal, `npm run rehearsal` in another drives a headless browser hard-offline through
   all five tabs and the six difficult days (Nov 21, Nov 22, Dec 11, Dec 16, Dec 21, Dec 26),
   the driver card and its Chinese address, the flight PDF, the ten place photos, the read-more
   city guide, the map buttons, the booked-and-committed money breakdown, and proof that with the
   network off the app does not reach out at all.
   It currently passes 37/37. It is not a substitute for doing it on the actual phone,
   but it catches regressions in seconds.

If you were already using the old app, export its backup and load it the same way — expenses,
ticks, notes, custom packing items and the gift-card balance land back on the imported trip.

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

Every one of those names was checked against OpenStreetMap before it shipped (`npm run
verify:places`): the answer has to *be* the right place, and it has to land near a coordinate
verified by hand. **About one name in seven failed, and those ship no button at all.** "CHAO
Sanlitun" resolves to the Workers' Stadium; "The Jade Emu" resolves to nothing; a hotel pin on the
wrong building is worse than no pin. A missing button is the app telling you the truth — the
reason is written down in `app/scripts/china/map-links.ts` and `spots.ts`.

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

**Weather.** When the phone is online, the app quietly fetches a 16-day forecast for the stop you
are in and the next one, and caches it. Today shows a temperature chip (and snow falling on the
hero photo when it is actually snowing); the day rows in a city guide show a small chip each.
With an empty cache nothing renders at all — no placeholders, no error. Settings has a switch to
turn it off entirely.

**Previewing another day:** Settings → *Preview a date*, or add `?d=2026-12-11` to the URL. The
whole app behaves as if it were that day. Tap the amber pill to come back.

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
  phone's database. The China trip arrives as a file *you* import.
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
  map app you chose, and nothing else; the app itself never contacts any of them. The verification
  that decided which places get a button — and which addresses were worth shipping — runs in the
  workshop against OpenStreetMap and Wikidata, never on the phone.
- **Weather** is the one place the app talks to the internet. Only the *coordinates* of your
  current and next stop are sent, only to [open-meteo.com](https://open-meteo.com), only when the
  phone is online and the Settings switch is on. There is no account and no key, so nothing
  identifies you. It times out after 8 seconds, fails silently, and the app is fully usable if it
  never succeeds — which is what will happen inside the Firewall without the VPN.

Beyond that, the only features that touch the network are the “Find email” buttons and booking
links. Inside mainland China those need the VPN. Everything else works with no signal at all.

---

## Working on it

```bash
cd app
npm run dev          # local dev server
npm test             # 211 tests — dates, counters, money, seed parity, legacy import, map,
                     #             addresses, the GCJ-02 conversion and the weather code map
npm run check        # TypeScript + Svelte, must stay clean
npm run build        # check + build + privacy gate
npm run preview      # serve the built app (service worker only works here, not in dev)
npm run seed-build   # rebuild seed/china-2026.trip.json from legacy/ + sources/
npm run verify:china # re-audit the seed against the source documents
npm run verify:places # ask OpenStreetMap AND Wikidata where all 175 map names really are, and
                      # what address each one has (dev-only, network; ~15 min).
                      # PLACES_NO_WIKIDATA=1 runs the gate alone, in half the time.
                      # Exit 1 = a name is wrong. Exit 2 = the service throttled
                      # us and told us nothing — never demote on a 429.
npm run photos:fetch # re-download + optimize the curated place photos (dev-only, network)
npm run rehearsal    # airplane-mode dress rehearsal (needs `npm run preview` running)
npm run deploy       # build + audit + upload to Cloudflare Pages
```

`app/dist/` is committed on purpose: if the toolchain ever stops installing, that folder is still
a working app you can drag into the Cloudflare dashboard.

Design and data-model decisions are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## The old app

`legacy/` is the original single-file China app, untouched. It still works and can still be
deployed by uploading that folder. Keep it until you have done the airplane-mode rehearsal on
Living the dream and are happy. It stays in git either way.
