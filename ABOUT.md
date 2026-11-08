# Why this project exists

*The rationale document. It explains **why** there is an app at all, what the first version was
and what it got wrong, and why it was rebuilt.*

*For a one-page summary of what it does, see [`OVERVIEW.md`](OVERVIEW.md).
For how to use and deploy the current app, see [`README.md`](README.md).
For how it is built, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
This file is the one that answers "why".*

---

## 1. The problem

A long trip is planned in long documents: a guide, a handoff brief, a pile of confirmation
emails. Those documents are excellent for **deciding** — sitting at a desk, comparing hotels,
weighing whether a side trip is worth a day. They are close to useless for **executing**:
standing at a check-in counter at 18:00, tired, being asked for a booking reference, with no
signal.

Three things make that gap dangerous rather than merely annoying.

### The internet can be hostile where you're going

Some countries block Google, webmail and most content delivery networks. An itinerary living
in a cloud document, a chat artifact, or a page pulling fonts from a CDN can simply fail to load
at the moment it is needed. A VPN helps but is itself fragile — and some VPN providers cannot be
installed or repaired from inside such a country, because their own site is blocked too.

### A trip has hard, unforgiving constraints

| Constraint | Consequence of getting it wrong |
|---|---|
| A visa or visa-free stay with a legal day limit | Overstay — fines and a record |
| A checked-bag cap that differs between airlines on the same trip | Refused at the counter, or paying excess on every leg |
| A city with two airports, and a flight that moved from one to the other | Go to the airport the old flight used and miss the new one |
| A pickup that does not run on the day you arrive | Stranded on day one |
| A late arrival at a guesthouse with no night desk | No bed |

One day of visa buffer, one airport trap, one arrival with no pickup are not theoretical.

### The information you need is time-dependent

What matters on a flight day (get to the right airport, bag under the cap) is completely
different from a mountain day (altitude, cash before a trail with no ATMs) — and neither is
findable quickly in a long document.

**So the app is a risk-reduction device more than a convenience.** Its job is to answer
*"what do I need right now?"* without a network, in one or two taps.

---

## 2. Version 1 — the single-file app

*It was removed from the repository in Nov 2026, together with the first trip's files.*

One `index.html` holding every line of CSS, every line of JavaScript, and all trip data, plus a
hand-written service worker, a manifest and generated icons. Vanilla JavaScript, no framework, no
build step, `localStorage` for state.

That looks primitive and was deliberate: every external dependency is something that can fail to
load behind a national firewall, and a framework pulled from a CDN is a well-engineered way to
show a blank screen. With everything inline the app either exists on the phone or it doesn't —
no partial-load failure mode. It was built and verified in a day.

**What it got right**, and what therefore survived into v2:

- **Date-awareness as the core feature.** A document shows everything and makes you find your
  day. The app knows the date and leads with it.
- **Travel-day runbooks.** On the hardest days, prose is replaced by an ordered, tickable
  checklist — the days the trip is most likely to break.
- **Confirmation codes in the biggest type in the app**, one tap to copy, readable across a
  counter at arm's length.
- **The visa clock pinned to every screen**, because that number is the one you cannot afford to
  lose track of.
- **Full-screen driver cards** — tap a place name in the local script and the screen fills with
  it plus "please take me here", screen held awake while a driver reads it.
- **Honest about limits.** A closed web app cannot ring an alarm, so instead of pretending, it
  exported the miss-it-lose-it moments as a calendar file. The phone's calendar rings.

**What it got wrong** — and this is the reason for the rebuild:

- **Personal data was inside the deployed bundle.** The passport number, every PNR, ticket
  numbers and a gift-card number sat in the HTML served from a URL. Private hosting reduced the
  exposure but the structure was wrong.
- **`localStorage` and hand-rolled everything.** Fine for one trip; no schema, no migrations, no
  document storage, no editing — every change meant editing the source file.
- **Single-trip by construction.** The trip was hard-coded into the markup.

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
*your* data. A trip arrives as a file you import (`seed/` holds only made-up trips) and the
build **fails** if a credential-shaped value — or any value on the owner's private list, kept
outside the repository — appears in any built file. That gate caught a real leak the first time
it ran: a form placeholder using an actual booking reference as its example.

**Trips became a concept rather than a hard-coding.** The next trip takes minutes instead of a
rebuild. The visa clock generalized into *compliance counters* — a start date, a day limit,
whether counting starts the day after entry, a hard deadline — which is the same idea made
reusable.

**Content became editable in the app.** v1 required editing source and redeploying to record a
booking. v2 has schema-driven forms, undo on every destructive action, and a documents vault.

**Storage got serious.** IndexedDB with versioned migrations, `navigator.storage.persist()`, and
a backup nag that escalates during an active trip — because there is no server holding a second
copy, and browser storage on a phone low on space can be cleared.

The seed pipeline is worth noting as a piece of engineering hygiene: a trip is built by a script
that **asserts** what it builds before it writes anything — counts, ids, dates, referential
integrity, every day resolving to a plan — and asserts that no private value appears in it.
`app/scripts/build-demo-seed.ts` builds the made-up demo trip that way.

---

## 4. What has not changed

A trip's sources remain the authority: its guide, its brief and its confirmations (kept by the
owner, never in this repository). Everything the app shows is derived from them. Nothing is
invented — where a fact does not exist yet, the app shows **⏳ pending** with a booking link
rather than guessing.

Two consequences of that rule are deliberate and worth restating:

- **A missing address stays blank.** A fabricated address handed to a taxi driver at 22:00 is
  worse than none.
- **Facts added from general knowledge** rather than the trip documents — airport and station
  names, consulate numbers — are tagged **verify** in the interface, so their provenance is
  visible.

And the privacy rule: passport numbers appear nowhere in the repository — not in code, not in a
seed, not as a hash — and automated checks in the seed builds and in the `dist/` privacy gate
prove their absence by reading them from private files outside the repo.
