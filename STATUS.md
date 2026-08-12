# Where this stands — 6 August 2026

*One page, kept current, so any session or person can pick this up cold. For what the app
IS see [OVERVIEW.md](OVERVIEW.md); how to use it, [README.md](README.md); how it is built,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); why it exists, [ABOUT.md](ABOUT.md).*

**The trip: China, 21 Nov – 27 Dec 2026. 37 days. One traveller, French passport.**
107 days out at the time of writing.

---

## The app, in numbers

| | |
|---|---|
| Tests · parity · rehearsal | **269** · 90 critical values + 69 structural facts · **57/57 with the network hard off** |
| Places that open in a map | 145 spots · 28 driver cards · 11 stops · 18 travel bookings |
| Day plans with tappable places | 87 links across 25 days |
| Beds | 12, of which **11 booked** — the academy fortnight became a real stay record on 12 Aug (held, priceless by design); the gorge guesthouse is a deliberate walk-in |
| Rail | 5 legs, **all pending** — not one ticket bought |
| Experiences | 11, of which **1 booked** (the concert) |
| **Money committed** | **$4,444.42** of a $7,500 budget |

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
3. **The academy's address is still officially pending** — which is why the Kunyu stop
   opens a mountain and not a school, and why the Nov 22 taxi needs the address card.

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
- **Zero runtime network.** The rehearsal proves it with the network off.
- **No personal data in the bundle.** `check:dist` greps every built file and fails.
- **Nothing is "booked" unless it is.** Five rail legs and ten experiences ship `pending`.

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
