# Run 4b — fixes from the code review of Runs 3c + 4 (2026-09-29) [+ the visual-regression check, appended below]

The reviewer found no HIGH defect and no data loss in 3c/4. The MEDIUMs are older bugs (Runs 1–2, M2) on paths it was
asked to trace. Fix all of them; each fix gets a unit test where it is logic and a rehearsal check where it is a flow.

## MEDIUM
1. **`closeTopLayer()` followed at once by another action races the async `history.back()`** (CONFIRMED in Chrome:
   `back()` computes its target at call time; the popstate lands after the follow-up push). Sites:
   `routes/TripsHome.svelte:342-348` (Edit trip — the wizard's layer is popped as it opens → **trip editing does not work**),
   `routes/TripWizard.svelte:125-126` (Create trip → lands on the shelf, not the new trip),
   `routes/ImportSheet.svelte:109-110` and `:137-138` (Import / legacy restore → shelf or Backup instead of the trip/Money).
   Fix at the root: `router.closeTopLayer()` returns a promise that resolves on the popstate that really closed the layer
   (with a timeout guard like `backPast`'s), and every "close, then go/open" site awaits it (or runs its follow-up from the
   sheet's `onclose`). Search for EVERY `closeTopLayer()` followed by `go`/`goTab`/`goPocket`/`replace`/`pushLayer`/opening
   a sheet, not only these four. Update the rehearsal: "Delete a trip" (`rehearsal.mjs:4466`) currently passes only because
   of this bug (it looks for `.tripcard` right after Create) — make it wait for the real landing screen; add checks for Edit
   trip (the wizard stays open, the edit saves), Create trip (lands on the new trip), Import (lands on the trip).
2. **Deleting a booking from its own pass ends on "This booking is gone"** (`routes/Pocket.svelte:156-159` +
   `SchemaForm.svelte:106-108`): same class as 3c's stop-delete fix. Mark it in `del`; from the sheet's `onclose` call
   `router.backPast(h => h === passHash, listHash)` as `Stop.svelte:327-352` does. Rehearsal: delete a booking from its pass
   → lands on the list; one back press is normal.
3. **Editing a flight's airport keeps the old airport's map target** (`forms/specs.ts:250-278`): all 8 China flights carry
   `coord` + `mapQuery` (CA 8609 → 北京大兴国际机场). Change From PKX → PEK and the map button still opens Daxing. Same for
   driver cards (`specs.ts:700-718`): retyping the Chinese name keeps the old place's address and coord. Fix: when the
   airport code (or a card's `native` / a stop's or booking's name that the map target was derived from) changes, drop the
   stale map target — `coord`, `pin`, `mapQuery`, `mapCity`, `mapUrl` where derived, `address`, `addressEn`,
   `addressInSearch` — so the button falls back to the name. Unit tests for flight, card and any other editor with the
   same pattern; keep the target when the identifying field is unchanged.

## LOW
4. Train ↔ other type change strips a road leg's ends (`specs.ts:374-390`, `:459-476`, `:429-432`): both kinds carry
   from/to/dep/arr/duration — drop only the old kind's fields the NEW kind lacks; start the train branch from the old ends;
   fill `fromName`/`toName` for `other` too.
5. `compareClock` (`logic/dates.ts:48-53`): strip a leading `[~≈\s]` in `pad` so "~07:30" sorts as 07:30 (it now sorts after
   every time, even after the '99:99' no-time value in `commitment.ts:78`). Test.
6. Guide jumps scroll after saving the stop (`routes/Stop.svelte:265`): `void stop.id` makes the effect depend on the whole
   `stop` object → key it on `$derived(stop.id)`.
7. A Sheet closed by clearing its flag leaves a stale layer (`Sheet.svelte:27` never removes its layer on unmount; DayView's
   jump list closes that way, `now/DayView.svelte:88-91` → the next Android back does nothing visible, `?d=` is lost,
   `router.depth > 0` hides TripShell's "Stop not found"). Fix: the Sheet removes its own layer on unmount (without a
   second history.back when the popstate already removed it), or close through `router.closeTopLayer()`. Test.
8. Nested objects some editors rebuild (`specs.ts:269-270` flight `from`/`to` as `{code, name}`, wallet-card `rows`,
   checklist items): spread the existing nested object first (`from: { ...e?.from, code, name }`) so a nested `pin`/`coord`
   added by the Map branch survives — except where item 3 deliberately drops a stale target.

## Rules
Same as RUN4.md (read-only git; work only in `C:\Source\China-horizon`; no adb/APK; zero runtime network; privacy rules;
don't touch sources/seed/legacy/app/scripts/china/privacy/check-dist-clean). Gates green with real numbers (check, test,
build, verify:china, `REHEARSAL_PORT=4177` rehearsal). PROGRESS.md: a "Run 4b" section (each item → change file:line,
tests). Stop cleanly at a part boundary if context runs low.

## Visual-regression check (Sonnet, 2026-09-29) — nothing to fix
48/48 screen × width pairs captured (Run 3c build afdcce5 vs Run 4 build, 412 and 384 px, offline, reduced motion):
31 pixel-identical; the other 17 all intended (Settings' theme card gone; To do / city scale-switch targets → 44 px; Now's
tile rail margin for focus reveal; the import sheet's focus ring now visible) or capture noise (live clocks, sub-pixel
text jitter). Zero regressions. Evidence: scratchpad `fid4/shots/`, `fid4/results.json`. Keep it that way: this pass must
not change how any screen looks, except where a fix needs it (report any such change).
