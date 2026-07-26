# Changelog — 中国 2026

The single-file trip app (`legacy/index.html` + `sw.js`). Newest first.

---

## 1.1.0 — 26 Jul 2026

Trip-speed pass: fewer taps between "I need this now" and having it on screen.

### Added
- **Tonight's taxi card.** Days that have a known Chinese address carry a `taxi`
  field pointing at an existing `places` entry; the Tonight card grows a
  full-width **🚕 Show the driver** button that opens the fullscreen card.
  Dec 5 – Dec 20 are covered. Nov 22 – Dec 5 is deliberately blank: the Kunyu
  address is still ⏳ pending and is not going to be invented.
- **Wallet → 🛏 Beds**, a third segment holding the hotels. During the trip
  tonight's bed sorts to the top with a red **TONIGHT** pill, the rest follow by
  date, and nights already behind you drop to the bottom, dimmed, with a `done`
  pill. Hotels gained ISO `start`/`end` fields read off their existing date text.
- **Ticket state at a glance.** Today's leg gets a gold **TODAY** pill, flown
  legs go dim and dashed, and every flight ticket now shows the passport number
  in its meta row — rendered from `traveler`, not copied into each booking.
- **Deep link from Today.** "Open in Wallet" on the next-flight card jumps to the
  Tickets segment, scrolls that exact ticket into view and flashes it.

### Changed
- **Today card order** during the trip: hero → runbook → **Tonight** → the plan →
  next flight → next deadline → next alarm → clocks → notes. At 23:00 in a taxi,
  the bed matters more than the itinerary.
- **Key info card order**: taxi cards → emergency → visa clock → useful Chinese →
  gotchas → backup. The visa clock is a thing you read once a day; the taxi card
  is a thing you open standing in the street.
- Wallet's first segment is now labelled **🎫 Tickets** (was "Bookings").

### Fixed
- **Transition days pick the right stop.** `currentStop()` now matches both ends
  inclusively and lets the last match win, so Dec 9 / Dec 11 / Dec 14 read as the
  place you are arriving in, and **Dec 26 correctly reads Hong Kong**. Dec 27 is
  flying home and shows no stop, which is right. The itinerary's "you are here"
  now comes from that same function instead of duplicating the comparison.
- **Alarms retire during the day.** The next timed moment skips alarms whose time
  has already passed today, not just whole past days.
- **Day rollover on resume.** A phone that slept through midnight now re-renders
  everything when it wakes, instead of only refreshing the status pill.
- **Update toast** waits for the new service worker to actually take control
  before reloading (with a 1.5 s fallback), so tapping it can no longer serve the
  old cached page back.
- **Restore is undoable** — the current state is snapshotted first and the toast's
  UNDO puts it back. Import also validates the blob before writing: non-object
  payloads are rejected and non-string values are skipped.

### Notes
- Storage keys, the backup format and the expense-entry shape are unchanged.
  v1.0.0 backup blobs and bare expense arrays still import.
- **Considered and rejected: full-text search.** A search box across every card
  sounds useful and isn't — typing one-handed on a train, half of it in Chinese,
  loses every time to a button that is already on the screen. The effort went
  into one-tap jumps instead: the taxi button, the beds sort, the ticket deep
  link. Revisit only if something genuinely can't be reached in two taps.
- Service worker cache bumped to `china2026-v1.1.0`; nothing else in `sw.js` moved.

---

## 1.0.0 — 24 Jul 2026

First build. Five tabs (Today, Itinerary, Wallet, Tasks, Key info), all trip data
transcribed from the guide, handoff notes, insurance comparison and the flight
PDF. Offline-first service worker, `?d=YYYY-MM-DD` day preview, boarding-pass
ticket cards, fullscreen show-the-driver overlay, packing and pre-flight
checklists, expense tracker with fixed rates, and copy/file backup + restore.
