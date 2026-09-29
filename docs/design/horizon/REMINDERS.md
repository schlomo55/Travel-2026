# Horizon run: Reminders (builder brief)

At launch this file is copied to `C:\Source\China-map\docs\design\horizon\REMINDERS.md`. The builder follows that copy.

## Owner's decisions (2026-09-29)
The owner asked "does our app have a option to send notification on the phone?". It doesn't, so every reminder today needs a manual .ics export into the calendar. After a round of options (published page "LTD Reminders Plan"), the owner decided:

- **Phone-scheduled local notifications** (`@capacitor/local-notifications`), with no server and no network needed to ring.
- **All six basic reminders, on by default:** timed moments (alarms), flights and trains, to-dos with a due date, visa-free days, backup, and quiet hours.
- **Extras:**
  - morning brief (with weather), off by default;
  - evening prep;
  - travel-day lock-screen card;
  - "You've landed";
  - Done and Snooze buttons;
  - "Remind me" on anything;
  - the calendar-export time-zone fix, with flights added to the export;
  - long-press shortcuts on the launcher icon.
- **Later, not in this run:** the home-screen widget.
- **Drive backup is phone-only:** "Back up to Drive" = the existing backup file → the Android share sheet → the Google Drive app. There is NO Google Cloud Console and NO OAuth.
- **Flight status has no service at all:** "Check live status" buttons open FlightAware / Flightradar24, with a Variflight (飞常准) tip for inside China. There is no API, no key and no background polling.
- The owner has internet most of the time, but reminders must ring in airplane mode. Signal is gone exactly when it matters: in flight, on the Great Wall day (Dec 7) and in the gorge.
- This lands on `horizon-map` before the final switch, so the owner installs photos + reminders together, before the Nov 1 freeze.

## Base
- **Tree:** worktree `C:\Source\China-map`, branch `horizon-map`, on top of the committed Map 5e.
- **Read first:**
  - `docs/design/HORIZON.md` (conventions);
  - `docs/design/horizon/PROGRESS.md` (add a "Reminders" section in the same format: a part-status table, findings and evidence);
  - this brief.
- **Code map (verified 2026-09-29, paths under `app/src`):**
  - **Routes:** `lib/logic/routes.ts` (`parseHash` :79, `routeHash` :122) and `lib/state/router.svelte.ts` (`router.go`, `goPocket`, `pendingAnchor` for scroll-to-id).
    - To-do: `#/trip/:id/now/todo`. Booking: `#/trip/:id/pocket/:bookingId`. Day: `#/trip/:id/now/day`. Settings and backup: `#/settings`, `#/backup`.
  - **Alarms and tasks:**
    - UI in `lib/components/now/Todo.svelte`: the .ics export is at :59-63 and its button at :165; strings are at `strings.ts:931-932`.
    - Types: `Alarm` is at `types.ts:472` (`done` = "handled / put in the calendar"), and `Task` at :458.
  - **Flights:**
    - `FlightBooking` (`types.ts:327`) has `flightNo`, `carrier`, `from`/`to` `{code}`, `dep`/`arr` HHMM local-naive, `arrDayOffset` and `duration?`.
    - The detail view is `components/pocket/Pass.svelte`.
    - Travel days: `logic/metroline.ts` (`isTravelDay`, `dayMoves`, `buildMetroLine`).
    - Next commitment: `logic/commitment.ts` (`commitmentAt` returns a device-local Date).
  - **Zones:** `logic/zones.ts` (`zoneShiftMinutes(leg)`, `crossesZone`). No zone-at-moment function exists. There is no home-zone field. `TripClock {label,timeZone}` is used for display only.
  - **Weather:** `data/weather.ts` `readWeather(stop)` → `WeatherCache {fetchedAt, daily: DailyWeather[]}`, and `logic/weather.ts` has `dayIn(cache,date)`.
  - **Backup:**
    - `data/export.ts` has `buildBackup` :48, `exportVault` :66 (stamps `lastBackupAt`) and `backupIsStale` :112.
    - `data/repo.ts` has `mutate()` :60, `touchMutation` :44 (`settings.lastMutationAt`) and `setMutationHook` :39. The hook has a single subscriber, currently Drive (`main.ts:14`).
    - The Drive OAuth UI is `components/cards/DriveCard.svelte`, on `routes/Backup.svelte:130` and the Settings row :228-240.
  - **Settings:** `routes/Settings.svelte`. There is one `db.settings` record, read with `getSettings` and written with `updateSettings` (`repo.ts:23-29`), with defaults at `repo.ts:6`. New fields are optional, and undefined means the default.
  - **Platform:**
    - `platform/files.ts`: `isNative`, and `saveFile` (native: Filesystem Cache + Share).
    - `platform/maps.ts` / `platform/links.ts`: `openExternal` (AppLauncher native, `window.open` on web).
    - Lazy screens use `state/lazy.ts` `once(() => import(...))`.
  - **Lifecycle:** there is no `@capacitor/app` resume listener yet (the plugin is installed). `App.svelte:44-50` has only `visibilitychange`.
  - **Android:**
    - The manifest has only INTERNET + location. `MainActivity extends BridgeActivity {}`.
    - `app/build.gradle` has applicationId `com.livingthedream.travel.horizon` (keep it) and a signing block reading `~/.ltd-private/android/keystore.properties` (keep it; never read those files).
    - SDK levels: min 23, target/compile 35.
- **Budgets** (`scripts/check-bundle.mjs`): initial ≤ 200 KB gz (now ~191.9), all app JS ≤ 260 (~242.2), map engine ≤ 470.
  - **Everything in this run is lazy**: the plugin, the planner, Settings → Reminders, the sheets and the Remind-me picker.
  - Start-up may only gain a tiny sync trigger (≤ 1 KB). Measure before and after.

## Part 1: The engine (the core; everything else hangs on it)
1. `npm i @capacitor/local-notifications@^7`, then `npx cap sync android`.
   - Manifest: `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM`. Also `RECEIVE_BOOT_COMPLETED`, unless the plugin's own manifest already merges it (check the merged manifest and report which).
   - Notification small icon: a monochrome drawable. Don't reuse the launcher PNG.
2. **`logic/tripzone.ts` (pure).** `offsetAt(trip, bookings, dateISO, hhmm, homeOffsetFor)` returns the UTC offset in minutes that the traveller lives in at that wall-clock moment.
   - Before the first flight/leg departs: home.
   - `homeOffsetFor(date)` is injected. In the app it is the device zone via `Intl`, which is correct because the phone is at home until the first departure.
   - Once a leg has DEPARTED (the moment compared with the leg's date + dep, in the departure zone), the traveller lives in the arrival zone: previous offset + `zoneShiftMinutes(leg)`.
   - People write in-flight and landing-side times in destination time. Real case: EY888 departs AUH 21:20 on 21 Nov and lands PKX 08:45 on 22 Nov. The owner's alarm "22 Nov 08:30 change US$600 at the Daxing arrivals counter" is Beijing time.
   - If any leg before the moment has an unknown shift (no duration), return `null`. The scheduler then uses device-local time for that item and relies on the re-plan at open/resume.
   - `instantOf(...)` returns the absolute `Date`.
   - **Tests pinned on the real China seed:**
     - 12 Oct 10:00 → home (IDT +180).
     - 21 Nov EY608 14:00 → home (IST +120).
     - 22 Nov 08:30 → +480 (Beijing).
     - 22 Nov CA8641 15:00 → +480.
     - 21 Dec MU733 KMG 13:50 → +480.
     - 26 Dec EY871 HKG 19:35 → +480.
     - 27 Dec EY609 AUH 02:45 → +240.
   - Also add a synthetic trip with a DST boundary and one with a missing duration.
3. **`logic/notify.ts` (pure, fully tested).** `planNotifications(input, now)` returns `Planned[] {id:int31, at:Date, channel, title, body, route, actions?, ongoing?}`.
   - Ids are stable: a hash of kind + entity id + variant.
   - Future only; done items are silent; sorted; capped to the soonest 60.
   - Quiet hours (default 22:00–07:00, editable) move to 07:00 anything that isn't a leg, check-in, landed item or user alarm.
   - **Categories and default wording** (all strings in `lib/i18n/strings.ts`; write them in the app's plain voice):
     - **Alarms:** at the time, plus a heads-up (default 30 min, editable: off/10/30/60).
     - **Legs:**
       - "Leave for the airport": 3 h before international, 2 h before domestic, 1 h before train/other.
       - International = the origin and destination countries differ. Derive the country from the trip's stops or the airport codes you already have. If you can't, treat the leg as international, the safe side.
       - "Online check-in opens" 24 h before a flight.
       - The body carries flightNo, from→to, arrival time and the booking reference. On the lock screen, mask all but the last 3 characters: `••••9EM`.
     - **Tasks with `due`:** 09:00 the day before and 09:00 on the day.
     - **Visa-free days:** find the existing visa counter logic (grep `visa`) and reuse it. Ring on day 25, 28 and 29, and 08:00 on the exit day. China trip only, wherever the counter applies.
     - **Backup:** if `lastMutationAt > lastBackupAt` and the last backup is ≥ 3 days old: one at 20:00, at most daily, with the action "Back up now".
4. **`platform/notifications.ts` (lazy).**
   - `syncNotifications()`: read the settings and data, plan, cancel our pending ids that are not in the plan, and schedule the rest. Use `allowWhileIdle: true`.
   - Create the channels once: "Timed moments" and "Travel" (high), "Daily briefs" (default), "Backup" (low).
   - On web it is a no-op.
5. **Sync triggers:**
   - app start (deferred, after first paint);
   - `@capacitor/app` `appStateChange` → active;
   - the mutation hook: convert `setMutationHook` to allow several subscribers without breaking Drive, debounced 2 s;
   - after a seed/trip import;
   - when the device zone string changes (compare on resume).
6. **Tap routing:** `localNotificationActionPerformed` → `router.go(route)`, with `pendingAnchor` for the item.
7. **Settings → Reminders** (a lazy section or sub-screen, Horizon tokens only):
   - a master switch (the first ON asks for the permission; never ask at launch);
   - per-category switches, the heads-up lead and quiet hours;
   - "Send a test in 1 minute";
   - status rows:
     - "Notifications allowed" (`checkPermissions`);
     - "On-time ringing": `checkExactNotificationSetting()`, with "Allow →" calling `changeExactNotificationSetting()`;
     - a Samsung tip: "Settings → Battery → Background usage limits → Never sleeping apps → add LTD Horizon";
   - "Next reminder: <title> · <when>".
   - On web: one line saying reminders work in the phone app only.

## Part 2: Travel extras
1. **Done / Snooze actions** (plugin action types): alarm and task → Done / Snooze 10 min / Snooze 1 h, leg → Check live status / Open booking.
   - Done writes through `repo.mutate` (alarm `done=true`, task `done=true` + `doneAt`).
   - Snooze schedules a one-off with a distinct id.
   - It's fine if the app has to open for the action to run: say so in PROGRESS if so.
2. **Travel-day card:** on a travel day, from 4 h before the first leg, an `ongoing` notification (channel Travel, silent after the first).
   - Content: the next leg, the masked ref, the terminal if known, and the action Check live status.
   - It is replaced by the **"You've landed"** notification (SAME id) at the last leg's arrival + 10 min.
   - Landed content: "Welcome to <city>", tonight's bed name, and the pay-at-desk / check-in note if the data has one. Actions: "Show driver card" (the stay's pass / driver card route; find where the driver card lives) and "Open in maps" (existing map intent).
   - The next app open after arrival clears anything stale.
3. **Live status buttons:** there is no API.
   - `logic/flightlinks.ts` (pure, tested) builds:
     - FlightAware `https://flightaware.com/live/flight/<ICAO airline><number>`, with an IATA→ICAO table for the carriers in the data: CA→CCA, 3U→CSC, MU→CES, EY→ETD (extend as needed; unknown → IATA ident);
     - Flightradar24 `https://www.flightradar24.com/data/flights/<iata lowercase, no space>`.
   - **Verify both formats** by fetching one real URL each (dev-only, not in the app) and note the result in PROGRESS.
   - Variflight: find out whether a web URL or an app deep link exists; if not verifiable, show a one-line tip only ("Inside China, use the Variflight (飞常准) app").
   - Placement: Pass.svelte for flights (next to the booking ref), the travel card action and the leave-now action. Open with `openExternal`.

## Part 3: Briefs
1. **Morning brief** (off by default), 08:00 on days with a plan or a travel day. The content comes from the existing logic (`concierge`, `glance`, `DayView` data): the city, the weather (`dayIn(readWeather(stop), date)`, the icon + tmin–tmax; if `fetchedAt` is older than 36 h, add "forecast from <weekday>"; no forecast = omit), the anchor, the first timed item and tonight's bed.
2. **Evening prep**, 20:00 the day before a travel day or a day whose first timed item is before 09:00. It includes the first item plus the next day's weather if known ("🌧 Rain likely"), plus "passport" on travel days.
3. Both are re-planned on every sync, so the weather fills in as the forecast window reaches the date.

## Part 4: "Remind me" on anything
- A small bell control on a booking (Pass), a task row, and a place card (map PlaceSheet; coordinate with the 5e design, and keep it quiet).
- It opens a lazy sheet (`router.pushLayer`, release on unmount) with presets:
  - "1 h before" (only when the item has a time);
  - "The evening before, 20:00";
  - "That morning, 08:00";
  - "Pick a time…" (the existing alarm form, prefilled).
- It creates a normal `Alarm` with the item's title and adds an optional non-indexed `ref?: {kind:'booking'|'task'|'place', id}` so a tap lands on the item. No Dexie version bump. Check that backup and import keep the field. Legacy importers must ignore it.

## Part 5: Calendar export + backup
1. **`logic/ics.ts`:**
   - Write `DTSTART`/`DTEND` in UTC (`…Z`) computed with `instantOf`.
   - Keep floating time only when the offset is `null`, and say so in the file name/notes.
   - Add flights as events (dep→arr, the title "CA8641 PKX→YNT"), with a VALARM matching the leave-now lead.
   - Keep the UIDs stable.
   - Tests: 22 Nov 08:30 → `20261122T003000Z`, and 10 Dec 19:45 → `20261210T114500Z`.
   - Rename the button if the flights change its meaning ("Add moments and flights to the calendar").
2. **"Back up to Drive":** on Backup and Settings, the primary button text becomes "Back up to Drive" (native), using the existing `exportVault` → share sheet. Add a hint: "Pick Google Drive — Android remembers it next time."
   - The backup reminder's "Back up now" action lands on `#/backup` and starts the same export (a user gesture is available, since the tap came from the notification).
   - Hide `DriveCard` and the Settings Drive row while `driveConfigured()` is false (the owner declined the Console setup). Leave the code in place.

## Part 6: Launcher shortcuts (native; stop and report if it gets risky)
- Static long-press shortcuts: Now, Wallet, Map, To do.
  - Each is an implicit `ACTION_VIEW` intent to a scheme the app handles, routed through `@capacitor/app` `appUrlOpen` → a "current trip" resolver (the active trip, else the shelf).
- It must resolve to the INSTALLED variant (`.horizon` now, the real id after the switch). Generate the shortcuts resource from gradle (`resValue`, or a generated xml) rather than hard-coding a package.
- Note the existing Drive-scheme vs `.horizon` mismatch the explorer found (`driveConfig.ts:39` vs applicationId). Don't fix it (Drive stays unconfigured), but don't copy the pattern.

## Part 7: Gates and delivery
- **From `app/`:**
  - `npm run check` (0 errors), `npm test` (all green; new tests for tripzone, notify, flightlinks, ics and settings defaults), `npm run build` (contrast, dist and bundle all green; report the before/after KB for all three budgets);
  - `npm run verify:china`;
  - `REHEARSAL_PORT=4179 npm run rehearsal`, with new rows: Settings → Reminders renders offline on web with the phone-only line; Pass shows the live-status buttons; the .ics contains `Z` times; the a11y sweep still passes (add the new screen to FLOOR_SCREENS if it's a screen).
- Screenshots of Settings → Reminders, the Remind-me sheet and the Pass buttons at 412 and 384 px.
- **Update `PROGRESS.md`** with the Reminders section, including a DEVICE CHECKLIST for the owner:
  - permission prompt;
  - the test notification with the app closed + airplane mode;
  - survives a reboot;
  - set the phone zone to Asia/Shanghai and check the 22 Nov alarm still reads 08:30;
  - a Done action;
  - a live-status button;
  - a long-press shortcut;
  - Back up to Drive.

## Rules
- **Git is READ-ONLY** (log, diff, show, status). NEVER run `checkout`, `restore`, `clean`, `stash`, `rm`, `add` or `commit`: another run's work lives in this tree, and a git "cleanup" destroys it. Restore `dist` by rebuilding, never by git.
- Work only inside `C:\Source\China-map`.
- No adb and no APK builds (the main session builds). Never read `~/.ltd-private/*`. Never edit `~/.claude`.
- Never write the owner's name or any passport number anywhere.
- Keep `app/index.html` LF.
- Stop cleanly at a part boundary if you run low on context or hit a limit, and write the status in PROGRESS.md first.

---

## Status: built 2026-09-29 by the main session (china-ec), on branch `horizon-reminders`

The owner asked the main session to build it directly ("no do it yourself"). It was built in its own worktree
(`C:\Source\China-reminders`, from horizon-map c450c61) so it never wrote under Map 5e.

| Part | State | Where |
|---|---|---|
| 1 · The reminder system | done | `logic/tripzone.ts`, `logic/notify.ts`, `platform/reminders.ts`, Settings → Reminders, `i18n/reminders.ts`, manifest `SCHEDULE_EXACT_ALARM`, `res/drawable/ic_stat_ltd.xml`, `repo.ts` (several mutation hooks), `main.ts` (lazy start) |
| 2 · Travel extras | done | Done/Snooze/live/booking/backup/bed/driver actions (`platform/reminders.ts`), travel-day card + "You've landed" (same id, `notify.ts`), "Check live status" on the flight pass (`logic/flightlinks.ts`, `Pass.svelte`) |
| 3 · Briefs | done | morning brief (off by default) and evening prep, with the cached forecast (`notify.ts`) |
| 4 · Remind me | done | `components/remind/*` on bookings (Pass), to-dos (Todo) and, after merging Map 5e, the map's place card (PlaceSheet) |
| 5 · Calendar + backup | done | `logic/ics.ts` (exact UTC times, flights, lazy from `Todo.svelte`), "Back up to Drive" + the reminder's "Back up now" (`Backup.svelte`, `Settings.svelte`), the Drive sign-in card hidden while unconfigured |
| 6 · Icon shortcuts | done | `android/app/build.gradle` → `ltdShortcuts` writes `ltd_shortcuts.xml` for the applicationId being built; `platform/shortcuts.ts` routes `ltd://open/<place>` |
| 7 · Gates | see below | |

### Decisions made while building
- **The phone is the anchor for time zones.** Android moves the phone's clock when it lands, so the phone's current offset
  is where the traveller is now. Every other segment is walked out along the legs' proven shifts. While still at home,
  segment 0 follows the phone through DST (Israel changes on 25 Oct).
- **A leg's departure minute belongs to the ground it leaves**; any later moment is in the arrival zone (in-flight and
  landing-side times are written in destination time: EY888 lands 08:45, and the Daxing exchange at 09:30 is Beijing).
- **Ground legs with no printed duration shift by 0**; a flight whose duration can't be proven breaks the chain, and
  moments beyond it fall back to the phone's clock until the next open.
- **Hong Kong, Macau and Taiwan airports count as international** (own border, same clock): MU733 gets the 3 h lead.
- **Only one trip rings**: the one on the road, else the one last opened. The 🧪 sample trip never wakes anyone.
- **The reminder words live in `i18n/reminders.ts`**, not strings.ts: strings.ts is in the start-up bundle and none of
  these words are needed before the first paint. The bell's own label is in strings.ts (`S.remind`).
- **The calendar export and the zone plan load when the button is pressed**, not at start-up.
- **Links, not a service, for live status** (owner): FlightAware under the ICAO code was opened for real for CA8641,
  3U8011, MU733 and EY888 (each page named its flight); Flightradar24 answers scripts with a bot check, so its format
  is pinned in tests only.

## DEVICE CHECKLIST for the owner (S23, LTD Horizon)
1. Settings → Reminders → turn on "Reminders on this phone". Android asks "Allow notifications?" → Allow.
2. "On-time ringing" → Allow → switch on "Alarms & reminders" for LTD Horizon → come back.
3. Samsung: Settings → Battery → Background usage limits → Never sleeping apps → add LTD Horizon.
4. Press "Send a test in 1 minute", close the app, turn airplane mode on. It should ring within a minute.
5. Restart the phone. The "Next:" line in Settings should still show the same next reminder, and it should still ring.
6. Set the phone's time zone by hand to China (Shanghai), open the app once. The 22 Nov exchange alarm must still be 09:30
   in the To do list and the "Next" line must not move. Put automatic time zone back afterwards.
7. On a reminder with buttons, press Done (the app opens and the item ticks) and Snooze 10 min (it comes back).
8. Open a flight in the Wallet → "Check live status" → FlightAware opens in the browser.
9. Long-press the LTD Horizon icon → Now / Wallet / Map / To do each open that screen.
10. Backup → "Back up to Drive" → pick Google Drive → the file lands in Drive.

### After the code review and the design check (same day)
- **Review, fixed:** the phone lagging a zone in the air (home offset remembered, a landed-first rule, never falling to
  the post-trip segment); the travel-day card and the landing got separate ids; backup counts from the last backup;
  the next real trip rings, never a 🧪 sample; lock-screen text masks codes, long numbers and phone numbers, channels
  private; connections are one journey; snoozes and the test are never cancelled by a sync; the shortcut routes after
  the app's own first redirect, once; USE_EXACT_ALARM added.
- **Design check, fixed:** "Remind me" takes its own row on the pass; a to-do with its bell drops the redundant "Task"
  chip; the calendar button is shorter; the China note on the pass uses the brighter ink; the lead-time control wraps
  under its label at 384 px.
- **Budget:** Map 5e + Reminders came to 266.5 KB of all app JS; the owner raised the limit 260 → 275 KB (lazy code
  only; the initial load stays under 200).
