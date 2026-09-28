# Run 3b — fidelity fixes (from the design review of 2026-09-28)

Source: an independent reviewer screenshotted all 14 Horizon screens (412×915, dark, `?d=` preview dates) and compared
them with the approved boards in `boards/`. Screenshots: session scratchpad `fidelity/` (real) and `fidelity/boards/`
(boards rendered). Fix these, in this order. Each fix: root cause, not a patch; a vitest test where it's logic.

## HIGH
1. **False "nothing timed yet" free block (Dec 12 and any day phrased the same way).** `lib/logic/timeline.ts`
   `LEADING_TIME` (~line 35) / `parsePlanItem` only accept a clock reading as the FIRST token and reject a leading `~`.
   The seed says "First entry ~07:30 · Golden Whip Stream valley walk" and "Sunset ~17:45 — be off the steps in
   daylight", so neither is timed and the free block becomes 08:00–22:00. Accept `~HH:MM` and a clock reading before the
   first separator (`·`, `—`, `–`, `:` after a word) — without turning prose like "a 2h ascent" or prices into times.
   Test with the real Dec 12 lines and every other day in the China seed (no day may lose or gain a timed item wrongly —
   write the before/after table in PROGRESS.md). Note: this logic predates Horizon, so the old app had the same bug.
2. **City pin shows a merged ticket's status instead of the booked hotel's.** `lib/logic/citymap.ts` `pinText()`
   (~279–296): when several places share a coordinate, it shows only the FIRST booking line (the pending Forest Park pass)
   so tonight's booked, paid Pullman reads "Sat 12 · Pending". Prefer the stay's own status for a pin that holds a stay,
   or show both lines clearly; never let one booking's status stand for another. Test with the real Wulingyuan pin.

## MEDIUM
3. **"NOT Capital" missing from the travel-day metro line.** The board puts the trip's highest-stakes warning on the
   Daxing PKX station row. `lib/logic/metroline.ts` only lifts times onto a station's sub-line. Lift a WARNING too — but
   only words the trip file states for that station's own step (e.g. the runbook step "Cross to Daxing (PKX) — NOT
   Capital (PEK)" → "NOT Capital" in warn amber on the PKX row). Never compose a warning. Test.
4. **Long real names overflow / wrap / truncate mid-word** on the Pocket driver chips (`components/horizon/PaperChip.svelte`
   `.pc-en` clamps "Beijing Daxing International Airport (PKX)" to "Beijing Daxing International…"), the pass header
   (the centred date wraps "Fri 11 / Dec" between long airport names), and Counter mode (route wraps to 3 lines). One
   systematic fix: a pure `shortPlaceName()`-style helper in `lib/logic` (e.g. text before " — ", "International Airport"
   → "Intl", a code kept) used where space is tight, plus layout rules (date below the codes row on narrow widths;
   never cut a word mid-way). The full name stays available (aria-label / the detail view). Tests.
5. **Flight-cancellation fallbacks lost their callout in the guide.** The board gives "If CA 8609 is cancelled ·
   fog-prone" its own tinted warning box; the real guide leaves it as a trailing clause of the Getting-there paragraph.
   When a Getting-there item carries a "fallback(s):" clause, render that clause as its own warning callout (text
   verbatim from the trip file). Test the split.

## LOW
6. The header counter pill shows the full counter name ("MAINLAND VISA") and grows wide — keep it compact like the
   board ("VISA 19/30"): derive a short label (full name kept in the accessible name). `components/horizon/AppBar.svelte`.
7. The pass has no direct link to the flight manifest PDF (documents vault) — add a quiet "E-ticket · flight manifest"
   row on flight passes when the trip has that document (by its tag/name; no invented link).
8. The pass lacks the board's ticket-perforation notches at the dashed divider — add them (decorative, no layout shift).
9. The guide's intro line under the title reads like a template ("3 nights, Fri 11 → Mon 14 Dec — 2n park + 1n city.").
   Give it the editorial voice of the rest of the page using ONLY the trip's facts (e.g. "Three nights · Fri 11 → Mon 14
   Dec · two in the park, one in the city") — no invented description.
10. Verify (don't change unless clearly wrong): city-map stay hops are all drawn "been" orange; the board differentiated
   by status. Decide and note in PROGRESS.md.

Not defects (don't touch): the preview-date chrome (strip + dashed pill), the delayed Relay summary chip (it fires after
the sweep — ~7–9 s on this trip), board rendering artefacts, and every deviation already accepted in PROGRESS.md.
