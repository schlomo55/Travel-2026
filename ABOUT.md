# China 2026 — the project, the app, and why it exists

*Written 24 July 2026. Companion to `README.md`, which covers deployment and day-to-day use;
this document explains the reasoning behind the whole thing.*

---

## 1. The problem it solves

The trip has been planned for months, and the planning lives in a 1,700-line HTML guide plus a
handoff brief. Those documents are excellent for **deciding** — sitting at a desk, comparing
hotels, weighing whether Macau is worth a day. They are close to useless for **executing**:
standing at a check-in counter in Chongqing at 18:00, tired, being asked for a booking
reference, with no signal.

Three things make that gap dangerous on this particular trip rather than merely annoying.

### The internet is hostile where you're going

Mainland China blocks Google, Gmail's web interface, and most content delivery networks. Any
itinerary that lives in a cloud document, a Claude artifact, or a web page pulling fonts from a
CDN can simply fail to load at the moment it's needed. A VPN helps but is itself fragile — and
NordVPN cannot be installed or repaired once you are inside, because `nordvpn.com` is blocked
too.

### The trip has hard, unforgiving constraints

| Constraint | Consequence of getting it wrong |
|---|---|
| 30-day visa, legal deadline **Dec 22 24:00**, planned exit Dec 21 = day 29 | Overstay — fines, and a record |
| **20 kg** checked-bag cap on all three domestic flights (Etihad allows 40) | Refused at the counter, or paying excess three times |
| **CA1953 leaves from PEK (Capital), not PKX (Daxing)** | Miss the only evening nonstop to Zhangjiajie |
| **No Sunday pickup** at Kunyu — and you arrive on a Sunday | Stranded in Yantai on day one |
| Dec 16 Chongqing→Lijiang is an evening flight landing ~22:00 | Arriving at a guesthouse with no late check-in arranged |

One day of visa buffer. One monopoly flight. One arrival day with no pickup. These are not
theoretical.

### The information you need is time-dependent

What matters on Dec 11 (get to the right airport, bag under 20 kg) is completely different from
Dec 17 (altitude, arrange the bag transfer, draw cash before a trail with no ATMs) — and neither
is findable quickly in a long document.

**So the app is a risk-reduction device more than a convenience.** Its single job is to answer
*"what do I need right now?"* without a network, in one or two taps.

---

## 2. What the project is

`C:\Source\China` is a **private** git repository (`schlomo55/china-2026`, configured to mirror
the pennybot-platform setup) containing two distinct things.

### The sources — the authority

| File | What it is |
|---|---|
| `china-2026-trip-guide-v12.html` | The master itinerary: route, day-by-day, budget, packing, per-city recommendations |
| `china-2026-handoff-prompt.md` | Planning state: what's booked, the 12 NEXT ACTIONS, gotchas, open decisions |
| `insurance-quotes-comparison.md` | Harel vs Phoenix, and the five things needing written confirmation |
| `china-app-prompt.md` | The specification this app was built to |
| `China-2026-Flights.pdf` | The confirmed flight manifest — authoritative for seats, PNRs, ticket numbers |

All five were read in full and none were edited.

### The app — a derivative of the sources

`app/` holds eight files that get deployed. The entire application is **one `index.html`**
containing every line of CSS, every line of JavaScript, and all the trip data. Alongside it: a
service worker, a manifest, four generated icons, and a copy of the flight PDF.

The relationship matters. The sources are truth; the app is transcribed from them. **57
trip-critical values** (passport number, all seven flight times, every booking reference, PINs,
ticket numbers, insurance quotes, deadlines) were verified present and correct in the built
file. Nothing was invented. Where a fact does not exist yet — the Kunyu Chinese address, the
insurance policy number, ten unbooked hotels — the app shows **⏳ pending** with the booking
link rather than guessing.

One deliberate omission: the **Israeli passport number appears nowhere in the app**, verified by
automated check. Everything is on the French passport, as it must be.

---

## 3. Why it's built the way it is

### One self-contained file, vanilla JavaScript, no framework, no build step

This looks primitive and is deliberate. Every external dependency is a thing that can fail to
load behind the Great Firewall. A React app pulling from a CDN is a beautifully engineered way
to show a blank screen in Yantai. With everything inline, the app either exists on the phone or
it doesn't — there is no partial-load failure mode.

The secondary benefit is longevity: in three years the file still opens in any text editor and a
hotel name can be changed, with no toolchain to resurrect.

### Data separated from rendering

Near the top of the script is a single `DATA` object holding the whole trip — stops, per-day
plans, bookings, hotels, tasks, alarms, gotchas, Chinese phrases. Everything visible is
generated from it.

That is what makes the app **date-aware** rather than a static document: it can compute that
today is day 21 of 37, that the current city is Zhangjiajie, that tonight's bed is Peakcap
Hostel and it isn't booked yet. It also means recording a booking is a one-line edit in one
place.

### Date-awareness is the core feature

A document shows everything and makes you find your day. The app knows the date and leads with
it — which is why the Today tab changes character three times: countdown before Nov 21, live
day-by-day during, closing summary after Dec 27.

---

## 4. The five tabs

### 🏠 Today — the tab you'll live in

Before the trip: countdown, next flight, next overdue deadline, next timed moment.
During: day N of 37, current city, today's plan, tonight's accommodation with booking status,
next flight, live visa-day count.

The most valuable element is the **travel-day runbook**. On the six hardest logistics days —
Nov 21, Nov 22, Dec 11, Dec 16, Dec 21, Dec 26 — prose is replaced by an ordered, tickable
checklist. Dec 11 reads:

```
□ No morning ski — this is a clean travel day by design
□ HSR Taizicheng → Beijing (~1h)
□ Cross to PEK (Capital Airport) — NOT Daxing. Allow 1.5–2h across Beijing
□ CA1953 · PEK Terminal 3 · 17:00 → Zhangjiajie 19:40 · booking 1653716183770225
□ Checked bag capped at 20 kg + 5 kg cabin
□ If CA1953 is cancelled (fog-prone): CA9659 morning · CA8609 ex-Daxing · or Changsha + HSR
□ On landing: ~40 min transfer to Wulingyuan
```

That is the day the trip is most likely to break, reduced to seven boxes.

Also on this tab: clocks for China, Tel Aviv and Abu Dhabi (Israeli time matters for bank OTP
codes and calling home), and a free-text notes field.

### 📅 Itinerary — the reference layer

All ten stops as expandable cards, colour-coded by city as in the guide. Each holds getting
there, sleeping, day-by-day, costs, tips, and the researched extras — restaurants, shows, sights.
It auto-opens whichever stop you're in and labels it *"you are here"*.

Not what you need *right now*; what you consult when you have a free afternoon in Dali.

### 🎫 Wallet — the counter-facing tab

Each of the seven flights is a boarding-pass card: route in large airport codes, times,
terminals, seat, cabin, baggage, and the confirmation code in the largest type in the app —
readable at arm's length across a counter, one tap to copy.

Below the flights: the passport card, the Trip.com gift card with an **editable balance** (it
changes as hotels get booked), the Kunyu deposit, and an insurance card waiting for a policy
number. Then all eleven beds, marked booked / pending / walk-in.

Every booking carries a **📧 Find email** button opening a Gmail search for that reference. This
is the one feature that needs a network — inside China it needs the VPN, and the app says so in
small print.

A second segment holds the **spending tracker**, ported from the guide with the same categories,
the same $6,500 budget, and the same storage format, so an old backup imports cleanly.
Multi-currency at fixed rates, cash-vs-card, refunds, CSV export.

### ✅ Tasks — three lists

**The merged action list** combines the handoff's 12 NEXT ACTIONS with the guide's 16 key dates
into one deduped, deadline-sorted list. Overdue items flag red; each item's reasoning collapses
behind *"why this matters"* so the screen stays scannable. The insurance entry carries the full
Harel-vs-Phoenix analysis and the five points needing written confirmation.

**The packing list** with the 20 kg warning pinned at the top, plus custom items.

**The pre-flight app checklist** — Alipay, WeChat Pay, eSIM, 12306, AMap, DiDi — with a separate
emphatic card for NordVPN, because it must be set to an obfuscated protocol *before* landing.

Finally the **alarms card**. A web app cannot ring while closed — a real limitation, so rather
than pretend otherwise the app lists the 15 miss-it-lose-it moments (the 20:00 Forbidden City
ticket release, the Dec 6 visa-critical train window, the 06:30 Great Wall pickup) and exports
them as a calendar `.ics` file. The phone's calendar *does* ring.

### ⚠️ Key info — the emergency reference

A live **visa clock** computing exactly which mainland day you're on and how many remain.
Emergency numbers with tap-to-dial. Every gotcha: the 20 kg rule, the power-bank 3C-logo
requirement, passport-as-train-ticket, no ATMs on the gorge trail, controlled medications, PSB
hotel registration.

And the **taxi cards**: tap any Chinese place name and the screen fills with it in enormous
white-on-black type plus 请带我去这里 *("please take me here")*, with the screen held awake while
a driver reads it. The feature most likely to matter at 22:30 in Lijiang.

---

## 5. The offline machinery

On first open over HTTPS, a service worker copies every file into the browser cache. From then
on every request is served cache-first — the app never consults the network to render. Verified
by killing the web server completely and reloading: the app came up fully, including the arrival
runbook.

One design detail worth recording, because it was a genuine bug caught in testing. The obvious
way to precache is `cache.addAll([...])` — but that call is **atomic**: if any single file
fails, nothing caches and the entire offline app breaks. A failed PDF download would silently
have cost the whole app.

The service worker therefore:

- separates **critical** assets (the HTML — must succeed) from **optional** ones (icons, PDF —
  cached individually, failures tolerated),
- refuses to store empty or error responses,
- backfills the cache when next online, repairing itself,
- and the Wallet tab reports honestly whether the PDF is really cached instead of assuming.

Updates use the same mechanism: a new deployment is detected and offered as a *"tap to reload"*
toast rather than changing silently underneath you.

---

## 6. Where the data lives

Every tick, note, expense, and the gift-card balance live in the phone's `localStorage`. Nothing
syncs anywhere — no server, no account, no other user. That is what was asked for, and it also
means there is nothing to leak.

The trade-off: browser storage can be cleared, especially on Android phones low on space. So
there is a **backup button** that copies the entire state as one blob to paste into a note or a
self-addressed email, restorable in ten seconds. Worth doing before the trip and occasionally
during it.

---

## 7. The design

Dark by default — battery on an AMOLED screen, and kinder at night.

The direction is **"night lacquer"**: ink-black warmed slightly, cinnabar red, imperial gold, a
serif display face, monospace for every code, perforated boarding-pass cards, and a rotated red
中国 seal. It should feel like a document from the place you're going, not a generic travel app.

Practically: 412-point layout for the S23 Ultra, bottom navigation in thumb reach, 44-point touch
targets, confirmation codes at 28–34 points, and a persistent status pill in the top bar showing
the countdown before the trip and the visa day during it — because that number is the one that
cannot be lost track of, and it shouldn't require navigating to see.

---

## 8. What it deliberately does not do

- **It does not invent facts.** Ten hotels, the insurance policy and the trains genuinely aren't
  booked, so they appear as pending with links rather than as plans.
- **The Kunyu Chinese address is blank.** It exists only in a reply to an unsent email, and a
  fabricated address handed to a taxi driver is worse than none.
- **It does not send notifications** — a closed web app can't. Hence the calendar export.
- **It does not sync between devices.**
- **Facts added from general knowledge** rather than the trip documents — Chinese airport and
  station names, two French consulate numbers — are tagged **verify** in the interface so their
  provenance is visible.

---

## 9. Keeping it alive

The app is a snapshot of what is true today, and its value decays as bookings land. The workflow:

1. A booking is confirmed.
2. Tell Claude the details.
3. The `DATA` object is updated and the version bumped.
4. The `app/` folder is re-uploaded to Cloudflare Pages.
5. The installed app offers the update next time it's online.

### Still open at time of writing

| Item | Status |
|---|---|
| Insurance (Harel vs Phoenix) | Not bought — top priority, Kunyu requires proof |
| 10 of 11 hotels | Not booked (Beijing and Hong Kong are the scarce ones) |
| Trains (4 legs) | Booked on 15-day windows; Dec 6 Dali→Kunming is **visa-critical** |
| Kunyu 5-question email | Unsent — its reply supplies the Chinese address card |
| Kunyu Chinese address | ⏳ pending in the app |
| Insurance policy number + emergency line | ⏳ pending in the app |
| SZSST / Shan Clinic side trip | Undecided, logged as a task |
| Deployment to Cloudflare Pages | **Not done — the app is not yet on the phone** |
| Airplane-mode dress rehearsal | Scheduled Nov 10 in the task list |

The immediate next step is deployment. The app is finished, verified and on GitHub — but until
it is uploaded and added to the home screen, it isn't on the device where it needs to be. And the
test that actually matters is the airplane-mode one.
