# Trip brief — fill me in

> **What this is.** One markdown file that describes a trip well enough for a Claude
> session to compile it into a `.trip.json` you can import into the app. You write
> prose; Claude is the parser. The headings below are a guide, not a syntax — if a
> line is easier to say in a sentence, say it in a sentence.
>
> **The one rule that matters.** Every flight and every bed line starts with either
> `- ✅ BOOKED —` or `- ⏳ OPEN —`. That single marker is what the whole pipeline
> turns on:
>
> | Marker | What Claude emits | What you see in the app |
> |---|---|---|
> | `✅ BOOKED` | a confirmed booking, reference and all | a green **All booked ✓** chip, and the reference readable offline in one tap |
> | `⏳ OPEN` | a *placeholder* booking (status `pending`) **plus** a Task | an **amber** coverage chip on that leg, and a to-do with a deadline |
>
> An OPEN line is not a gap. A gap is a night with nothing at all against it, and
> the app shouts about those in red. An OPEN line is an honest "I know about this
> and I have not bought it yet" — amber, never red. **Never guess a booking into
> existence to make a chip go green.** ⏳ pending is the honest answer.
>
> **How to fill this in.** Copy this file, rename it (`docs/examples/` is where the
> worked example lives), and type over the placeholders. Delete any section you do
> not need — an empty section is fine, an invented one is not. Then follow
> [docs/NEW-TRIP.md](NEW-TRIP.md).

---

## 1. Trip header

> Everything here becomes the `Trip` record: the name on the shelf, the date
> window every other date is checked against, and the money settings.

- **Name:** <!-- e.g. "Japan 2027" — this is the title on the trip shelf -->
- **Emoji:** <!-- one emoji for the shelf card, e.g. 🗾 -->
- **Subtitle:** <!-- optional one-liner, e.g. "Three weeks, mostly trains" -->
- **Dates:** <!-- YYYY-MM-DD → YYYY-MM-DD, both inclusive. The first day is the day you leave home. -->
- **Travellers:** <!-- how many, and anything that changes the planning (kids, mobility, dietary) -->
- **Home airport:** <!-- e.g. CDG. Where flights start and end. -->
- **Home currency:** <!-- e.g. EUR — the currency your budget is in -->
- **Other currencies:** <!-- e.g. JPY at ~160 per EUR. Rough is fine; these are display rates, not live ones. -->
- **Budget:** <!-- total, in home currency. Optional. If you give one, also say roughly how it splits (transport / lodging / food / activities). -->
- **Pace:** <!-- e.g. "slow — three nights minimum per city" / "fast, we like moving" -->
- **Accent colour:** <!-- optional: a hue 0–360, or just a word ("forest green", "petrol"). Keep it distinct from your other trips. -->
- **Time zones to show:** <!-- e.g. Japan + home. The app shows a clock strip. -->
- **Visa / permit clock:** <!-- optional. e.g. "90-day Schengen, entered 12 Mar" — becomes a counter pinned in the app bar. -->

---

## 2. Flights

> One line per leg, in date order. Include the *return*. Connections that are on
> one ticket are one line; a self-transfer is two.
>
> **BOOKED lines** should carry whatever the confirmation email says: airline,
> flight number, date, times, airports, the booking reference, the price you paid,
> seat and bag if you have them. Paste it messily — Claude will sort it out.
>
> **OPEN lines** need a `Want:` clause. That is the shopping brief: it is what
> Claude searches against when you sit down to actually book it, and it is what
> the reminder in the app says. Add `by <date>` and it becomes the Task deadline.

- ✅ BOOKED — <!-- e.g. CDG → HND, 2027-03-12, Air France AF274, dep 13:30 arr 08:55+1, ref ABC123, €640 pp, 1×23kg, seats 31A/31B -->
- ⏳ OPEN — <!-- e.g. Osaka → CDG, around 2027-04-02. Want: one stop maximum, arrive before 20:00, under €500 pp, free date change. by 2027-01-15 -->

---

## 3. Beds

> One line per stay, in date order. **Every night of the trip needs a line** —
> including the ones you have not booked. A night with no line at all is a hole,
> and the app draws holes in red.
>
> Give check-in and check-out dates, not "3 nights" — the app reasons in nights,
> `[check-in, check-out)`, so the check-out date is the morning you leave.
>
> **Last stay tip:** make the final stay's check-out the day *after* the last day
> of the trip. The app treats the trip's final calendar day as a day you are still
> there, and a check-out on that same morning leaves it looking uncovered.

- ✅ BOOKED — <!-- e.g. Hotel Somewhere, Tokyo. Check in 2027-03-13, out 2027-03-17. Ref BK-99887, ¥18,000/night, breakfast included, free cancellation until 10 Mar. Address: 1-2-3 Somewhere, Shibuya. -->
- ⏳ OPEN — <!-- e.g. Kyoto, check in 2027-03-17, out 2027-03-21. Want: walkable to the station, twin beds, under ¥20,000/night, free cancellation, quiet street. by 2027-02-01 -->

---

## 4. Cities & wishes

> One block per city or area you sleep in. This is what becomes a **stop** — the
> card in the itinerary with its own guide, its own day plans, and its own
> coverage chip.
>
> `Nights:` has to add up with the Beds section above. `Interests:` is free prose
> and the more opinionated the better — it is what the day plans get written from.
> `Must do:` / `Skip:` are the two lists that save the most argument later.

### <!-- City name -->

- **Nights:** <!-- e.g. 2027-03-13 → 2027-03-17, 4 nights -->
- **Interests:** <!-- e.g. "food markets, one museum maximum, long walks, no queues" -->
- **Must do:** <!-- named places, one per line. These become openable map chips. -->
- **Skip:** <!-- what you have already decided against, and why — so nobody re-suggests it -->
- **Notes:** <!-- anything else: a friend to meet, a closing day, a reservation window -->

### <!-- next city… copy the block -->

---

## 5. Ground transport *(optional)*

> Trains, buses, ferries, transfers, car hire — anything that moves you between
> the cities above. Same `✅ BOOKED` / `⏳ OPEN` rule; these become bookings too,
> and an unbought leg turns its segment's chip amber exactly like an open bed.
>
> Leave this out entirely if everything is flights, or if you intend to buy
> tickets at the station. If you *are* going to walk up and buy on the day, say so
> in a `⏳ OPEN` line — "walk-up, no advance sale" is a plan, and the app knows the
> difference between a plan and a hole.

- ✅ BOOKED — <!-- e.g. Tokyo → Kyoto, 2027-03-17, Nozomi 21 dep 09:00 arr 11:15, ref SH-4412, ¥14,000 pp, car 7 seats 3A/3B -->
- ⏳ OPEN — <!-- e.g. Kyoto → Osaka, 2027-03-21, local train. Want: nothing to book, buy at the machine. -->

---

## 6. Rules I care about

> House rules. Claude applies these to every OPEN line when it goes shopping, and
> repeats them back in the task detail so future-you remembers why the constraint
> was there.

- <!-- e.g. Always free-cancellable until 48h before. -->
- <!-- e.g. Never a hotel more than 15 minutes' walk from a station. -->
- <!-- e.g. No flight that lands after 22:00. -->
- <!-- e.g. Two payment cards, kept separately. -->
- <!-- e.g. One rest day per week with nothing scheduled. -->

---

## 7. Practical

> Optional, but these are the things you want offline at the worst moment.

- **Emergency numbers:** <!-- local police / ambulance / your insurer's line -->
- **Insurance:** <!-- insurer and policy number, or "⏳ not bought yet" -->
- **Language cards:** <!-- phrases you want on a big screen to show a driver, e.g. "please take me here" -->
- **Packing:** <!-- anything trip-specific — the generic list is already in the app -->
- **Alarms:** <!-- fixed-time things: an early airport run, a timed-entry ticket -->
- **Anything that could go badly:** <!-- becomes a "runbook": a numbered checklist that surfaces on the day it matters -->

---

## 8. Attachments

> **Do not paste PDFs or e-tickets into this file.** Boarding passes, hotel
> vouchers, insurance certificates and passport scans go into the app's
> **documents vault** — you add them on the phone, from the booking itself, after
> importing the trip. The vault is on-device only; nothing in it is ever built
> into the app or deployed.
>
> What belongs *here* is only the part you would read out loud: the reference
> code, the property name, the times. That is what makes the card useful offline.

- **Files to add to the vault after import:** <!-- list them so you do not forget -->

---

## What happens next

1. Save this file somewhere you will find it again.
2. Hand it to a Claude session with the repo open and say "compile this into a trip seed".
3. Claude copies `app/scripts/trip-template/`, fills it in from your answers, runs the
   asserts, and writes `seed/<your-trip>.trip.json`.
4. Import that file in the app → **Settings → Import**. Importing **replaces the whole
   trip**, so anything you changed inside the app for that trip — ticked packing items,
   card balances, expenses entered on the road — is overwritten. Export a backup first
   once you are actually travelling.
5. Every `⏳ OPEN` item is now an amber chip and a dated task. When you book one for
   real, paste the confirmation back into this file, recompile, re-import — the chip
   turns green.

Full playbook, including the id-collision rule that protects your other trips:
[docs/NEW-TRIP.md](NEW-TRIP.md).
