# Where this stands — 26 August 2026

*One page, kept current, so any session or person can pick this up cold. For what the app
IS see [OVERVIEW.md](OVERVIEW.md); how to use it, [README.md](README.md); how it is built,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); why it exists, [ABOUT.md](ABOUT.md).*

**The trip: China, 21 Nov – 27 Dec 2026. 37 days. One traveller, French passport.**
100 days out at the time of writing.

---

## The app, in numbers

| | |
|---|---|
| Tests · parity · rehearsal | **450** · 106 critical values + 74 structural facts · **106/106 with the network hard off** |
| Contrast gate | **104 pairs in each of 2 palettes**, 0 failures |
| Bundle | **158.7 KB gzipped JS** against a 200 KB budget · 21.7 KB CSS |
| Places that open in a map | 145 spots · 28 driver cards · 11 stops · 18 travel bookings |
| Day plans with tappable places | 87 links across 25 days |
| Beds | 12, of which **11 booked** — the academy fortnight became a real stay record on 12 Aug (held, priceless by design); the gorge guesthouse is a deliberate walk-in |
| Rail | 5 legs, **all pending** — not one ticket bought |
| Experiences | 11, of which **1 booked** (the concert) |
| **Money** | **$6,402 committed** of a $7,500 budget · **$4,806.46 already paid** (the academy's $840 arrived in writing 13 Aug) |

Installed on the phone as `com.livingthedream.travel`. The trip arrives as a file you
import; the app itself ships empty and a build gate proves it.

---

## What is actually paid for

- **Flights** — all four Etihad legs (~$2,026) and the three internal flights ($241 / $230 / $293)
- **Beds** — three have taken money: Yue Tu's first night ($59.95), the ibis in full
  ($25.73), and **The Royal Garden in full, $1,232.01**, which also made it the only
  **non-refundable, unamendable** booking on the trip
- **The concert** — HK Phil, 22 Dec, HK$689
- **Insurance** — Phoenix Smart, policy `260676675684357`, $148.40
- **Kunyu deposit** — $100

## What is not, and when it can be

| When | What |
|---|---|
| **Now** | Macau ferry (both legs, return **~17:15** — the concert is 19:30) · Ngong Ping 360, Dec 25 (free cancellation) |
| **15 Oct** | Thaiwoo English ski lesson — not bookable before the winter schedule loads |
| **15 Nov** | Great Wall guide · **download the concert e-Ticket and keep it OFFLINE** |
| **Nov–Dec** | Trains, as each 15-day window opens. **The Dec 20 Dali→Kunming leg is visa-critical** |
| **29 Nov, 20:00 Beijing** | Forbidden City, exactly 7 days ahead. Passport IS the ticket |
| **10 Dec, 20:00 Beijing** | **Jade Dragon cableway — sells out in minutes**, and you will be on a mountain in Chongli |

## The three open questions

1. **Is amateur Sanda training covered?** The Phoenix rider covers sport *"במסגרת תחרות או
   אימונים לקראת תחרות"* — in a competition, or training toward one. **Kunyu is neither.**
   The task was closed on 6 Aug once the policy was bought; the question moved onto the
   insurance wallet card, Hebrew and all. Wanted in writing before 22 Nov.
2. **The Royal Garden prepayment is acknowledged, not verified.** Reservations said it
   would "pass to our Account Department". Worth one line in writing, saved offline.
3. **The academy's four small asks** (13 Aug — address and price are ANSWERED; the school's
   own taxi card is now the driver card): the Saturday/departure-day schedule (it gates the
   Dec 5 flight booking), PSB registration, whether the sent deposit counts against the $840,
   and whether pickup could be from the city centre instead of Muping.

---

## Lantern Run C — the last build run before the Nov 1 freeze (13 Aug 2026)

**Google Drive backup, opt-in.** The one thing a file in Downloads cannot do is survive the
phone itself. Scope is `drive.appdata` — the app sees only its own folder, never the owner's
Drive. Payload is the same `livingthedream/backup` bytes the Backup screen already saves,
gzipped, last 10 kept. Auto-backup is debounced and **only ever runs online**; offline it is
a silent no-op, because offline is normal on this trip.

> **One owner-only step remains.** Google issues an OAuth client id to a *person*, in a
> console, and it cannot be scripted or invented. The app therefore ships with the credential
> `null` and the Backup card says *"Not connected — needs a one-time Google setup"* out loud.
> Five minutes of console work, then a two-minute test on the phone:
> **[docs/DRIVE-SETUP.md](docs/DRIVE-SETUP.md)**. Nothing in this repo has ever talked to
> Google, deliberately — no test fakes a login, and the rehearsal proves the opposite.

**Three small road tools**, all built from data the trip already carried, none of them new
facts: an **offline converter** (rates from the trip, or from what you actually spent, or
typed off the board — each labelled with where it came from and when), a **health &
insurance** section that gathers the policy, the 24-hour line, the local numbers and the
medicine note onto one screen, and **two clocks** on any flight whose own printed flying time
proves its ends keep different time (the four Etihad legs; every domestic Chinese leg stays
silent, correctly).

**Hardening.** The last hard-coded `rgba()` in the app — Home's timeline cards — became
tokens and now flips with the theme. The rehearsal grew an a11y floor swept across seven
screens: every button has a name, every control shows focus.

**Deferred, on purpose:** runbook templates, connectivity guide, transit primer, document
scanning, budget alerts. All Run B / public-product territory, which stays post-trip.

---

## Trips after this one (26 August 2026)

The multi-trip promise now has a mechanism, and it is a form plus a scaffold, not a feature.
Three artifacts: **[docs/TRIP-BRIEF-TEMPLATE.md](docs/TRIP-BRIEF-TEMPLATE.md)**, a blank brief you
fill in as prose; **[docs/NEW-TRIP.md](docs/NEW-TRIP.md)**, the five-step loop — fill, compile,
import, book the open items with Claude, paste the confirmations back; and
`app/scripts/trip-template/`, the builder scaffold whose `assert.ts` is imported rather than
copied, so every trip compiled from a brief passes the same gate. The rule it all turns on:
**every flight and bed line starts `- ✅ BOOKED —` or `- ⏳ OPEN —`** — ✅ becomes a booking with
its reference, ⏳ becomes a `pending` placeholder plus a dated task, amber and only ever amber.
A worked example compiles to `seed/template-example.trip.json` (`npm run seed-build:template-example`,
slug `tx00`). **Nothing in `app/src/` moved: no app change, no APK rebuild, the Nov 1 freeze untouched.**

---

## Rules this repo actually enforces

Not aspirations — each one is a gate that fails the build.

- **Never invent a trip fact.** Bookings, prices and addresses come from `seed/` and
  `sources/`; `verify:china` re-checks them against the original documents.
- **A wrong pin is worse than no pin.** Every map name passes `verify:places` against
  OpenStreetMap *and* Wikidata. About one in seven failed and ships **no button**, each
  with its reason written down.
- **The phone outranks the gate.** Names that OSM answers, Amap does not — 菩提 returns
  a district, Tina's returns a different guesthouse. Both were demoted on device evidence.
- **Two runtime calls, both disclosed, both optional.** Weather (open-meteo, toggleable) and
  the opt-in Drive backup — nothing else, ever. No analytics, no crash reporting. The
  rehearsal proves it with the network hard off, and proves the Drive path makes **zero**
  requests while it is not connected.
- **No personal data in the bundle.** `check:dist` greps every built file and fails.
- **Nothing is "booked" unless it is.** Five rail legs and ten experiences ship `pending`, and
  every future trip inherits the rule: the brief template refuses an ⏳ OPEN line that does not
  compile to both a placeholder and a dated task.

## Traps that cost real time

- **`legacy/index.html` is single-quoted JS — escape every apostrophe.** Pasted text never is.
- **`encodeURIComponent` leaves `'` alone**, and a literal apostrophe kills a Google Maps
  link stone dead. Everything goes through `enc()` now.
- **Amap echoes your query**, so "is the name on screen" matches your own question. Assert
  on the result card.
- **Wireless debugging: read the PAIRING port from mDNS**, not from the screenshot — it
  moves. Then `-s`, because pairing leaves two entries for one phone.
- **Building the APK needs JDK 21** at `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`;
  Gradle caches a daemon on whichever JVM started it, so `--stop` after changing `JAVA_HOME`.

---

## Working on it

```bash
cd app
npm run seed-build && npm run check && npm test && npm run verify:china && npm run build
npm run preview & npm run rehearsal      # the offline dress rehearsal
npm run verify:places                    # network, ~15 min. Exit 2 = throttled, NEVER demote on it
```

Every change to the trip starts in `sources/` or `legacy/index.html` — never in
`seed/china-2026.trip.json`, which is generated.
