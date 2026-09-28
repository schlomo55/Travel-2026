# Run 3c — code-review fixes + the bundle restructure (from the Opus review of Runs 3 + 3b, 2026-09-28)

The reviewer traced these in code (CONFIRMED) or by reasoning (PLAUSIBLE). Fix all of them unless a fix would change a
screen's approved design — then note it. Pure logic → vitest tests; screens → rehearsal checks. Never invent a trip fact.

## A. The bundle restructure (planner decision, do this FIRST)
The 200 KB gate counts every JS file, so rarely used screens (Settings, Backup, TripWizard, ImportSheet, maybe the guide
long read) weigh on start-up exactly like Now. The metric that matters on the phone is the JS needed to START.
- Lazy-load the rarely used screens with dynamic `import()` (keep Now, Journey, Pocket, Find, the city and the shell in
  the entry chunk unless measurement says otherwise); show a quiet loading state; keep the router/back-layer contract.
- Rewrite `scripts/check-bundle.mjs` to report and gate TWO numbers: **initial-load JS ≤ 200 KB gz** (the entry chunk +
  every chunk it imports statically — derive it from Vite's manifest, `build.manifest: true`), and **total app JS ≤ 260 KB
  gz** (all chunks, so bloat can't hide in lazy chunks). Print both tables. Keep the service-worker exclusion. Explain the
  rule in the script header, in PROGRESS.md and in docs/ARCHITECTURE.md. (Run 5's map engine will get its own budget.)
- Report the new initial / total numbers and which screens became lazy.

## B. HIGH
1. **Deleting a stop from its guide ends on "Stop not found"** and a stuck back handler. `routes/Stop.svelte:284` with
   `forms/SchemaForm.svelte:106-108` and `router.svelte.ts:144,152`: `del` calls `router.go(journey)` (pushes history), then
   `closeTopLayer()` does `history.back()` onto the deleted stop's guide URL; `onPop` never pops the sheet's handler.
   Fix: remove navigation from `del`; after the sheet has really closed, `router.replace` to Journey (or TripShell replaces
   to Journey when the stop no longer exists). Rehearsal: delete a stop from its guide → lands on Journey, one back press
   behaves normally.

## C. MEDIUM
2. HK guide "price not recorded" for EY 871 though the fare is in the trip file (international stop's cost note; Money counts
   it) — `Stop.svelte:236`, window in `logic/guide.ts:48`. Use the same shared-price rule as `booked.ts`, or show no price
   line for a flight without its own price note. Never "price not recorded" when the file has it.
3. "Back to today" does nothing while Play runs — `Journey.svelte:280`: `onclick={() => { halt(false); pos = null; }}`.
   Rehearsal: press it WHILE playing.
4. City chapter chips / "+N" consume the scroll target before the view changes (`Stop.svelte:197,253-260`) and then rely on
   a fixed 160 ms: guard `if (!a || view !== 'guide') return;` and wait for `tick()` (+ the element to exist), not a delay.
5. `metroline.ts:229 warnAt` takes one word after NOT: "NOT Beijing South" → "NOT Beijing" on the wrong row; "NOT BOOKED
   YET" would become a warning. Capture consecutive Title-case words
   `NOT (\p{Lu}\p{Ll}[\p{L}-]*(?: \p{Lu}\p{Ll}[\p{L}-]*)*)`; reject shouted status words. Negative tests.

## D. LOW (fix all)
6. Flag rings unmount during Play and replay their sweep delays after (amber/red invisible up to ~8 s) — keep them mounted,
   hide via class (`Journey.svelte:294-295`, `TripMap.svelte:170`).
7. `counters.ts:39 counterWord`: "Visa-free 240h" → "h", "Transit 144-hour" → "hour". Use
   `/(?:^|\s)(\p{L}[\p{L}-]*)$/u` group 1, falling back to the first word; test both.
8. `routecheck.ts:125-126`: the arrival move is dated on the trip's first day, so on 22 Nov it shows "done" though CA 8683
   12:35 is ahead, and an unbooked leg that day drops out of "N legs to book". Judge past/today by the move's LAST leg date.
9. Route check / `connectors.ts` depart window: when the last stop ends after the trip end (Israel + template trips), the
   flights home vanish. Start the window at min(last stop end, trip end). Test on both seeds.
10. `guide.ts:156-161 fallbackOf`: "… · **Fallback:** the 07:45 nonstop" leaves "****" in the callout; bold spanning the
   whole line leaves unbalanced asterisks. Drop empty emphasis pairs; split only where emphasis before the clause is balanced.
11. `timeline.ts:52,116-122`: opening-hours lines ("Temple closes 17:00 ·", "Open daily 09:00 ·", "Gates shut 17:30 —") must
   not become fixed points (extend the until/till exclusion to open/opens/close/closes/shut/last); a clock RANGE
   "10:00 – 12:00" = start + end (no free block inside); add than/for/on/to to the dangling-word list ("Leave no later than").
   ALSO (review #21): replace the test that pins the whole seed's clock table with INVARIANTS + a few named days (Dec 12
   morning, Nov 23 pickup, Dec 10 release) so a plan-line edit on main doesn't break `npm test`.
12. `strings.ts guide.split` + `guide.ts:229-232`: "2n lake" → "two in the lake", "2n the park" → "the the". Only compose
   when the place word is safe; never double "the"; otherwise keep the file's text as written.
13. Status words hand-rolled in 3 places (`Journey.svelte:404` shows "Pending" for walk-in; `Stop.svelte:163` paints a
   walk-in amber; `ST` at `Stop.svelte:271` duplicates `chipOf`) — use `chipOf(b.status)` everywhere.
14. `citymap.ts:315-318 pinText`: a pin with two tickets of different status says one generic "ticket pending" — name each
   ticket by its own title when a pin holds more than one booking.
15. `pass.ts:153-154 passDocs`: every unattached "flight" ticket doc shows on every flight pass — if the doc name contains a
   flight number, require it to match this flight.
16. `places.ts:125-131 shortPlaceName`: removes "Airport" anywhere once a code appears anywhere ("Airport Express (AEL)" →
   "Express (AEL)"); a bare "Airport" becomes empty (Counter mode prints " (XXX)"). Look for the code in the kept part only;
   remove only a trailing "(International) Airport"; never return empty.
17. Stop order vs date order: city exits (`citymap.ts:165`), "stop N of M" (`Stop.svelte:91`) and Journey's count
   (`Journey.svelte:78`) sort by `order`; connectors/route check/Replay by date then order. One shared sorted-stops helper
   (date, then order) everywhere.
18. A11y: Replay section labelled "Route check" (`Journey.svelte:285`) — give it its own name; the city map `role="img"`
   (`Stop.svelte:476`) hides pin booking lines and the way-on status from screen readers — expose them (list or labels);
   the ↻ replay button stays enabled but does nothing under Calm motion / Route animations off / reduced motion — disable
   or hide it then; Play's label "Replay my trip from 21 Nov" is wrong after pause/drag — say "Resume" / "Play from <date>".
19. Carried-over guide items: star ratings put aria-label on a plain span (`Stop.svelte:432`) — `role="img"`; back-to-top
   forces smooth scroll ignoring reduced motion/Calm (`:452`); the close button says "back to the map" even when opened from
   Find/Now (`:326`) — label by the real origin; coming back from a pass reopens the ~11,800 px guide at the top — restore
   its scroll position.
20. Dedupe (≈0.2 KB): `blockTitle`+emoji regex vs metroline `plain`; the third cancelled/alternative filter copy in
   `guide.ts`; the 5 sorted-real-stops copies (→ item 17's helper); `ST` + Journey's inline chip vs `chipOf`; `legWord` vs
   `legLabel`; two regex-escape copies in metroline; `fmtDow(…).split(' ').slice(0, 2)` twice.
21. Tests: `citymap.test.ts` re-implements Stop.svelte's keep-out rectangles — move a `cityKeepOut()` helper into
   `citymap.ts` used by both. Add the missing cases the review lists (fallback with only the label bold, multi-word NOT,
   "240h", article/preposition in split words, two flight documents, multi-day arrival). Extract the Play/Back-to-today
   state machine into logic with a unit test.
22. Rehearsal: add checks for Back-to-today while playing, the rings right after Play, deleting a stop from its guide, the
   city under Calm motion.
