# Why this project exists

*The rationale document. It explains **why** there is an app at all, what the first version was
and what it got wrong, and why it was rebuilt.*

*For a one-page summary of what it does, see [`OVERVIEW.md`](OVERVIEW.md).
For how to use and deploy the current app, see [`README.md`](README.md).
For how it is built, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
This file is the one that answers "why".*

---

## 1. The problem

The China trip was planned across a 1,700-line HTML guide and a handoff brief. Those documents
are excellent for **deciding** — sitting at a desk, comparing hotels, weighing whether Macau is
worth a day. They are close to useless for **executing**: standing at a check-in counter in
Chongqing at 18:00, tired, being asked for a booking reference, with no signal.

Three things make that gap dangerous rather than merely annoying.

### The internet is hostile where you're going

Mainland China blocks Google, Gmail's web interface, and most content delivery networks. An
itinerary living in a cloud document, a chat artifact, or a page pulling fonts from a CDN can
simply fail to load at the moment it is needed. A VPN helps but is itself fragile — and NordVPN
cannot be installed or repaired once you are inside, because `nordvpn.com` is blocked too.

### The trip has hard, unforgiving constraints

| Constraint | Consequence of getting it wrong |
|---|---|
| 30-day visa, legal deadline **Dec 22 24:00**, planned exit Dec 21 = day 29 | Overstay — fines and a record |
| **20 kg** checked-bag cap on all three domestic flights (Etihad allows 40) | Refused at the counter, or paying excess three times |
| **CA1953 leaves from PEK (Capital), not PKX (Daxing)** | Miss the only evening nonstop to Zhangjiajie |
| **No Sunday pickup** at Kunyu — and you arrive on a Sunday | Stranded in Yantai on day one |
| Dec 16 Chongqing→Lijiang lands ~22:00 | Arriving at a guesthouse with no late check-in arranged |

One day of visa buffer. One monopoly flight. One arrival with no pickup. Not theoretical.

### The information you need is time-dependent

What matters on Dec 11 (get to the right airport, bag under 20 kg) is completely different from
Dec 17 (altitude, arrange the bag transfer, draw cash before a trail with no ATMs) — and neither
is findable quickly in a long document.

**So the app is a risk-reduction device more than a convenience.** Its job is to answer
*"what do I need right now?"* without a network, in one or two taps.

---

## 2. Version 1 — the single-file app

*Frozen in [`legacy/`](legacy/). Still works, still deployable.*

One `index.html` holding every line of CSS, every line of JavaScript, and all trip data, plus a
hand-written service worker, a manifest and generated icons. Vanilla JavaScript, no framework, no
build step, `localStorage` for state.

That looks primitive and was deliberate: every external dependency is something that can fail to
load behind the Great Firewall, and a framework pulled from a CDN is a well-engineered way to
show a blank screen in Yantai. With everything inline the app either exists on the phone or it
doesn't — no partial-load failure mode. It was built and verified in a day.

**What it got right**, and what therefore survived into v2:

- **Date-awareness as the core feature.** A document shows everything and makes you find your
  day. The app knows the date and leads with it.
- **Travel-day runbooks.** On the six hardest days, prose is replaced by an ordered, tickable
  checklist. Dec 11 became seven boxes — the day the trip is most likely to break.
- **Confirmation codes in the biggest type in the app**, one tap to copy, readable across a
  counter at arm's length.
- **The visa clock pinned to every screen**, because that number is the one you cannot afford to
  lose track of.
- **Full-screen driver cards** — tap a Chinese place name and the screen fills with it plus
  请带我去这里, screen held awake while a driver reads it.
- **Honest about limits.** A closed web app cannot ring an alarm, so instead of pretending, it
  exports the fifteen miss-it-lose-it moments as a calendar file. The phone's calendar rings.

**What it got wrong** — and this is the reason for the rebuild:

- **Personal data was inside the deployed bundle.** The passport number, every PNR, ticket
  numbers and the gift-card number sat in the HTML served from a URL. Private hosting reduced the
  exposure but the structure was wrong.
- **`localStorage` and hand-rolled everything.** Fine for one trip; no schema, no migrations, no
  document storage, no editing — every change meant editing the source file.
- **Single-trip by construction.** China 2026 was hard-coded into the markup.

One implementation detail worth preserving, because it was a real bug caught in testing: the
obvious way to precache is `cache.addAll([...])`, but that call is **atomic** — one failed file
and nothing caches, silently costing the entire offline app. The fix was to separate critical
assets from optional ones and refuse to store empty responses. v2 gets this from Workbox instead,
but the lesson is the same: the offline path needs testing, not assuming.

---

## 3. Version 2 — Living the dream

The rebuild generalizes the app from *this trip* to *trips*, and fixes the privacy structure.
Svelte 5 + TypeScript + Vite + Dexie (IndexedDB), wrapped as a native Android app via Capacitor.
Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the reasoning is:

**Personal data left the bundle entirely.** All trip content now lives in the phone's database as
*your* data. The China trip arrives as a file you import — `seed/china-2026.trip.json` — and the
build **fails** if the passport number, a PNR, a ticket number or the traveller's name appears in
any built file. That gate caught a real leak the first time it ran: a form placeholder using the
actual Etihad PNR as its example.

**Trips became a concept rather than a hard-coding.** China 2026 is the first trip, not the only
one; the next takes minutes instead of a rebuild. The visa clock generalized into *compliance
counters* — a start date, a day limit, whether counting starts the day after entry, a hard
deadline — which is the same idea made reusable.

**Content became editable in the app.** v1 required editing source and redeploying to record a
booking. v2 has schema-driven forms, undo on every destructive action, and a documents vault.

**Storage got serious.** IndexedDB with versioned migrations, `navigator.storage.persist()`, and
a backup nag that escalates during an active trip — because there is no server holding a second
copy, and browser storage on a phone low on space can be cleared.

The seed pipeline is worth noting as a piece of engineering hygiene: rather than re-transcribing
the trip by hand, `scripts/build-china-seed.ts` slices the `DATA` object out of the legacy
`index.html`, evaluates it, transforms it, and **asserts the counts** — plus asserts the Israeli
passport number appears nowhere. The v1 transcription (57 trip-critical values verified against
the source documents) is therefore carried forward mechanically rather than retyped.

---

## 4. What has not changed

The sources remain the authority: the guide v12, the handoff brief, the insurance comparison and
the flight-manifest PDF, in [`sources/china-2026/`](sources/china-2026/). Everything the app
shows is derived from them. Nothing is invented — where a fact does not exist yet, the app shows
**⏳ pending** with a booking link rather than guessing.

Two consequences of that rule are deliberate and worth restating:

- **The Kunyu Chinese address is blank.** It exists only in a reply to an unsent email, and a
  fabricated address handed to a taxi driver at 22:00 is worse than none.
- **Facts added from general knowledge** rather than the trip documents — Chinese airport and
  station names, consulate numbers — are tagged **verify** in the interface, so their provenance
  is visible.

And the traveller rule: everything is on the **French passport** (Salomon Chalom Cohen). The
Israeli passport number appears nowhere, asserted by automated check in the seed build and in the
`dist/` privacy gate.

---

## 5. Where things stand

*As of 24 July 2026 — the app itself is the live source of truth for task state.*

| Item | Status |
|---|---|
| Insurance (Harel vs Phoenix) | Not bought — top priority; Kunyu requires proof |
| Hotels | Beijing and Hong Kong are the scarce ones; most still to book |
| Trains | Booked on 15-day windows; Dec 6 Dali→Kunming is **visa-critical** |
| Kunyu 5-question email | Unsent — its reply supplies the Chinese address card |
| SZSST / Shan Clinic side trip | Undecided, logged as a task |
| Airplane-mode rehearsal on the phone | The gate before legacy retires |

The scripted rehearsal (`npm run rehearsal`) drives a headless browser hard-offline through all
five tabs and the six difficult days. It catches regressions in seconds — but it is not a
substitute for doing it on the actual S23 Ultra, in actual airplane mode, before flying.
