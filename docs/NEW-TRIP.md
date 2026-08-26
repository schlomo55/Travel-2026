# Starting a new trip

The app is multi-trip. Adding one is a five-step loop that starts with a
markdown form and ends with a file you import on the phone — and then repeats,
one loop per thing you book, until nothing is amber any more.

| | Step | Who does it |
|---|---|---|
| 1 | Fill in the brief | you |
| 2 | Compile it into a seed | a Claude session, in this repo |
| 3 | Import the `.trip.json` | you, in the app |
| 4 | Actually book the ⏳ open items | you and Claude, together, at planning time |
| 5 | Paste the confirmations back → recompile → re-import | both |

The three principles at the bottom of this page are the ones worth reading even
if you never run the loop yourself.

---

## 1. Fill in the brief

Copy [TRIP-BRIEF-TEMPLATE.md](TRIP-BRIEF-TEMPLATE.md), rename it, and type over
it. It is prose with headings, not a syntax — Claude is the parser, so a
half-sentence in the right section beats a well-formed line in the wrong one.

The one thing that is not optional: **every flight and every bed line starts
`- ✅ BOOKED —` or `- ⏳ OPEN —`**, and every OPEN line carries a `Want:` clause
saying what you are shopping for. Add `by <date>` and it becomes a deadline.

A worked, filled-in copy is [examples/porto-lisbon-mini.brief.md](examples/porto-lisbon-mini.brief.md).

---

## 2. Hand it to a Claude session

Open this repo in a Claude session and say: *"compile this brief into a trip
seed."* What happens then:

1. **Copy the scaffold.** `app/scripts/trip-template/` → `app/scripts/<your-trip>/`.
   The scaffold is a working skeleton with `FILL ME` markers, and each file
   names the brief section it is filled from:

   | File | Brief section |
   |---|---|
   | `base.ts` | slug, dates, the city list, the fixed build timestamp |
   | `trip.ts` | §1 header — name, money, clocks, budget, permit clock |
   | `stops.ts` | §4 cities & wishes → one stop per city, plus its guide and spots |
   | `bookings.ts` | §2 flights, §3 beds, §5 ground — **where ✅/⏳ becomes data** |
   | `days.ts` | §4 interests → day plans, default days, §7 → runbooks |
   | `admin.ts` | §6 rules and §7 practical → tasks, alarms, wallet, packing, budget |
   | `cards.ts` | §7 → show cards, emergency numbers, info cards |
   | `bundle.ts` | assembly, and the assert configuration |

   `assert.ts` is **not** copied — it is generic and parameterised by slug, and
   every trip imports the same one.

2. **Pick a slug** — four characters, unique across every trip you own. Taken so
   far: `cn26` (China 2026), `il26` (the Israel test trip), `tx00` (the worked
   example). This matters more than it looks; see [the id rule](#the-id-rule) below.

3. **Compile.** Copy `app/scripts/build-template-example-seed.ts`, point it at
   your folder, and add the matching line to `app/package.json`:

   ```json
   "seed-build:<your-trip>": "tsx scripts/build-<your-trip>-seed.ts"
   ```

4. **Validate.** `cd app && npm run seed-build:<your-trip>`. The assertions run
   **before** the write, so a failure produces no file rather than a bad one.
   A clean run ends with a per-segment coverage report — this is the moment you
   find out whether the trip's colours say what you meant:

   ```
   · tx00-stop-porto  2027-04-12→2027-04-14: ok   "All booked ✓"
   · tx00-stop-lisbon 2027-04-14→2027-04-17: warn "3 pending"
   ```

   The gate refuses, among other things: an id that could collide with another
   trip, a night with nothing against it, an ⏳ OPEN line missing either its
   placeholder or its task, a task due after the thing it books, categories that
   do not add up to the budget, and anything passport-shaped.

The output is `seed/<your-trip>.trip.json`.

---

## 3. Import it in the app

Settings → Import → pick the file.

**Import upserts.** Re-importing the same trip replaces the whole trip record by
record, which is exactly what makes step 5 work — and it means **any edits you
made to that trip inside the app are overwritten**. Ticked packing items,
adjusted card balances, expenses you entered on the road: the seed wins.

So: the seed is the source of truth for what the trip *says*, the app is the
source of truth for what you *did*. Once you are travelling and entering real
expenses, export a backup before re-importing anything.

Other trips are untouched. Import is per-trip, and the id prefix is what
guarantees it.

---

## 4. Book the ⏳ open items

This is the part the app deliberately cannot do.

**The app is zero-runtime-network.** It never calls a booking site, never
searches for a fare, never holds a room. It works on a plane, in a dead spot,
on a phone with no SIM — and that property is worth more than any in-app booking
flow would be.

The searching happens in a **Claude session**, where flight and hotel search
connectors are available. Bring the brief, say which ⏳ item you are doing, and
the `Want:` clause plus the §6 house rules are the search brief. Claude finds
candidates; you book, on the real site, with your own card.

Every open item is already visible in three places on the phone, so you always
know what is outstanding: an **amber chip** on its segment in the itinerary, a
**dated task** in the to-do list, and the placeholder booking itself, which
carries the `Want:` clause verbatim.

---

## 5. Paste it back, recompile, re-import

Change the brief line from

```
- ⏳ OPEN — Lisbon, check in 2027-04-14, out 2027-04-17. Want: … by 2027-03-01
```

to

```
- ✅ BOOKED — Casa Whatever, Lisbon. In 2027-04-14, out 2027-04-17. Ref XYZ123, €108/night, free cancellation until 7 Apr.
```

Claude flips `status: 'pending'` → `'booked'`, adds the `code`, drops the task,
and rebuilds. Re-import. The chip turns green.

That is the whole loop, and the trip is finished when nothing is amber.

---

## The three rules

### The id rule

**Dexie primary keys in this app are global, not scoped per trip.** A record
whose id already exists is not rejected on import — it silently **overwrites**
whatever held that id, even if that was a different trip. One `cn26-` id in the
wrong file and China 2026 loses a record with no error anywhere.

The protection is two-layered and neither layer is optional:

1. **Every id in a bundle starts with the trip's own slug** — `tx00-bed-lisbon`,
   `tx00-day-2027-04-12`, `tx00-stop-porto`. The trip's own id is the bare slug.
   In the scaffold, every id goes through the `id()` helper in `base.ts`, so no
   id is ever typed by hand.
2. **`assert.ts` walks every collection in the bundle** — including the nested
   ones: stop blocks, stop spots, checklist items, document metadata — and
   refuses to write the file if any id lacks the prefix, if two ids collide, or
   if another trip's slug appears anywhere in the serialized output.

Adding a collection to the data model means adding it to `collectIds()`. A
collection nobody walks is a collection nobody guards.

### Never invent a trip fact — ⏳ pending is honest

The app's whole value is that you can believe what it says at 2am with no
signal. That only holds if nothing in it was made up to fill a field.

So: no guessed addresses, no invented opening hours, no plausible-looking
booking reference, no coordinate that was not verified. A stop with no verified
coordinate gets no map button; a bed with no address gets no address line; a
card built from general knowledge rather than from a document you hold is
flagged `verify: true` and says so on screen.

**And no invented bookings.** The temptation the ⏳ marker exists to remove is
the one where an unbooked room gets written in as booked because a green chip
looks better than an amber one. Amber is not a failure state — it means "known
about, not bought yet", and it is the correct answer right up until money
changes hands. The failure state is red, and red means a night with *nothing*
against it: no reservation, no placeholder, no plan. The build refuses to
produce one.

Concretely (`app/src/lib/logic/coverage.ts`):

| Booking `status` | Night state | Segment chip |
|---|---|---|
| `'booked'` | `booked` | green |
| `'walkin'` | `walkin` — a decision, not a gap | green |
| `'pending'` ← **⏳ OPEN** | `pending` | **amber, and only ever amber** |
| `'cancelled'` / nothing at all | `missing` | amber, escalating to **red** inside the 7-day booking window |

`toneOf()` escalates on `missing` alone, which is why an ⏳ placeholder never
cries wolf however close the date gets.

### Builds are deterministic

No `Date.now()`, no bare `new Date()`, no randomness anywhere in a builder.
Every timestamp comes from a fixed `SEED_TS` literal in `base.ts`.

Two runs of the same builder produce byte-identical output. That is what makes
a rebuild's diff mean something: if the file changed, the *trip* changed. It
also means you can safely rebuild any seed at any time to check nothing drifted
— which is exactly what `npm run seed-build:israel` is for.

---

## Files

| Path | What it is |
|---|---|
| `docs/TRIP-BRIEF-TEMPLATE.md` | the blank form you fill in |
| `docs/examples/porto-lisbon-mini.brief.md` | a filled-in one, fictional, for reference |
| `app/scripts/trip-template/` | the scaffold — copy this, keep it pristine |
| `app/scripts/trip-template/assert.ts` | the generic gate — import it, do not copy it |
| `app/scripts/trip-template/example/` | the brief above, compiled — read it beside the brief |
| `app/scripts/build-template-example-seed.ts` | the entry script to copy |
| `seed/template-example.trip.json` | the output, `npm run seed-build:template-example` |

The example is safe to import beside the real trips and safe to delete at any
time — that is what its unique `tx00` slug buys. It is also safe to remove from
the repo entirely: nothing in `app/src/` imports it, and no test reads it.
