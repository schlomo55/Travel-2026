# 🧪 Trip brief — Porto & Lisbon, five days (WORKED EXAMPLE)

> **This is a filled-in copy of [TRIP-BRIEF-TEMPLATE.md](../TRIP-BRIEF-TEMPLATE.md),
> and it is entirely fictional.** Every reference, price and property in it is
> invented; the two cities are real only so the map buttons mean something.
>
> It exists as the input half of a worked pair. The output half — the builder
> Claude compiled from it — is `app/scripts/trip-template/example/`, and the
> seed those produce is `seed/template-example.trip.json`:
>
> ```
> cd app && npm run seed-build:template-example
> ```
>
> Read the two side by side. Every field in the builder has a line here it came
> from, and the builder's comments name the section.
>
> **What it demonstrates:** the same trip carrying both states at once. Porto's
> bed is `✅ BOOKED` and its segment chip is green. Lisbon's is `⏳ OPEN` and its
> segment chip is amber, with a dated task carrying the shopping brief. Nothing
> is red, because no night has nothing against it.

---

## 1. Trip header

- **Name:** TEST — Porto & Lisbon 5
- **Emoji:** 🧪
- **Subtitle:** Worked example of the trip-brief pipeline · not real data
- **Dates:** 2027-04-12 → 2027-04-16 (Monday to Friday, five days, four nights)
- **Travellers:** 2 adults
- **Home airport:** CDG
- **Home currency:** EUR
- **Other currencies:** none — Portugal is euro too, so there is nothing to convert
- **Budget:** €900 all in. Roughly: €300 transport, €340 lodging, €180 food, €80 slack.
- **Pace:** Slow. Two cities in five days is already the limit; one whole day with nothing planned.
- **Accent colour:** violet — the other trips on the shelf are red and petrol
- **Time zones to show:** Portugal and home
- **Visa / permit clock:** none. Five days inside Schengen on a French passport is not a clock.

---

## 2. Flights

- ✅ BOOKED — CDG → OPO, 2027-04-12, Sample Air SA 410, dep 11:05 arr 12:50, ref **TEST-AA1**, €110 pp, 1×23 kg, seat 18C. (Sample — not a real reservation.)
- ✅ BOOKED — LIS → CDG, 2027-04-16, Sample Air SA 411, dep 21:05 arr 00:45+1, ref **TEST-ZZ9**, €125 pp, 1×23 kg, seat 9A. Evening flight, so we keep the Lisbon room all day. (Sample.)

---

## 3. Beds

- ✅ BOOKED — Sample river guesthouse, Porto. Check in 2027-04-12, out 2027-04-14. Ref **TEST-BK-4471**, €95/night, free cancellation until 5 Apr. (Sample — not a real reservation.)
- ⏳ OPEN — Lisbon, check in 2027-04-14, out 2027-04-17. **Want:** walkable to a metro station, twin beds, under €120/night, free cancellation, a quiet street. Late checkout on the 16th — the flight is at 21:05. **by 2027-03-01**

> Note the check-out on the 17th, one day past the end of the trip. That is
> deliberate and the template says why: the app treats the trip's last calendar
> day as a day you are still there, so a check-out on that same morning would
> leave the 16th looking uncovered. Here the flight really is at 21:05, so the
> room really is held through the day.

---

## 4. Cities & wishes

### Porto

- **Nights:** 2027-04-12 → 2027-04-14, 2 nights
- **Interests:** Land slowly. Walk downhill to the river and stop there. One completely unplanned day — no itinerary, no bookings, nothing to be late for.
- **Must do:** Cross the upper deck of the Dom Luís I bridge on foot at sunset, and walk back along the far bank.
- **Skip:** No port-cellar tour. Decided before the trip; nobody needs to re-suggest it.
- **Notes:** The city is built on a hill and every map underestimates it.

### Lisbon

- **Nights:** 2027-04-14 → 2027-04-17, 3 nights (the last is the departure day)
- **Interests:** The riverside, walked westward in the morning light rather than back into it. One late-afternoon square. Not much else — three days is not a city, it is a visit.
- **Must do:**
  - Torre de Belém
  - Praça do Comércio, at the blue hour
- **Skip:** nothing decided against yet
- **Notes:** Bed still open — see §3. Everything else about the days works whatever the room turns out to be.

---

## 5. Ground transport

- ✅ BOOKED — Porto → Lisbon, 2027-04-14, sample train dep 10:30 arr 13:25, ref **TEST-CP7**, €32 pp, car 4 seats 21/22. (Sample.)

> Booked on purpose, so that the amber on the Lisbon segment can only be coming
> from the bed. An unbought leg would turn the same chip amber for a different
> reason, and a demonstration with two causes demonstrates neither.

---

## 6. Rules I care about

- Always free-cancellable.
- Never a bed more than fifteen minutes' walk from a metro or train station.
- Hand luggage only.
- One day per trip with nothing scheduled.
- Two payment cards, kept in two different places.

---

## 7. Practical

- **Emergency numbers:** 112 (all services, EU-wide)
- **Insurance:** ⏳ not bought yet
- **Language cards:** "Please take me here" · "Thank you very much" · "How much does this cost?"
- **Packing:** shoes that survive cobbles and a hill; one warm layer (April on the Atlantic is not April inland); a light shell.
- **Alarms:** pack the evening of the 11th; leave for the airport at 18:00 on the 16th.
- **Anything that could go badly:** the last day. The flight is late, the room needs a late checkout agreed the night before, and it is the one day where improvising costs money.

---

## 8. Attachments

- **Files to add to the vault after import:** none — this is a sample trip and there is nothing real to attach.

---

## What it compiled into

| Brief line | Records emitted | On screen |
|---|---|---|
| ✅ Porto bed | `tx00-bed-porto`, status `booked`, ref TEST-BK-4471 | Porto segment: **green**, "All booked ✓" |
| ⏳ Lisbon bed | `tx00-bed-lisbon`, status `pending`, no ref, Want: in the note **and** `tx00-task-book-bed-lisbon` due 2027-03-01 | Lisbon segment: **amber**, "3 pending" |
| ✅ both flights, ✅ the train | three bookings, status `booked` | references readable offline in one tap |
| §4 Must do, Lisbon | two spots, linked from the 15 Apr day plan by id | openable map chips on the day |
| §4 "one unplanned day" | **no** day plan for 13 Apr — a Porto `DayDefault` covers it | the free-day card, not an invented itinerary |
| §6 house rules | repeated in the open task's detail | the constraint is in front of you when you book |

The build prints exactly that:

```
· tx00-stop-porto  2027-04-12→2027-04-14: ok   "All booked ✓"
· tx00-stop-lisbon 2027-04-14→2027-04-17: warn "3 pending"
```
