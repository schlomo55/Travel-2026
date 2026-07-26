# Changelog — 中国 2026

The single-file trip app (`legacy/index.html` + `sw.js`). Newest first.

---

## 1.2.0 — 26 Jul 2026

The accommodation swap. Ten of the eleven beds changed, from
`sources/china-2026/accommodation-2026-07-25.md` — the authority document for
every bed, which overrides the guide wherever they disagree. Nothing is booked;
every rate below is the **freely cancellable** one, which is the owner's standing
decision even where a cheaper non-refundable rate exists.

### Changed
- **All eleven beds rewritten.** Dec 5–7 Four Points by Sheraton Sanlitun
  Workers Stadium ($242) · Dec 7–9 Blossom House Houhai ($360) · Dec 9–11 Element
  by Marriott, Thaiwoo ($221) · Dec 11–13 Pullman Zhangjiajie, Wulingyuan ($104)
  · Dec 13–14 Huatian Grand, Zhangjiajie city ($62) · Dec 14–16 Glenview ITC
  Plaza, Jiefangbei ($172) · Dec 16–18 Yue Tu Inn, Dayan ($73) · Dec 18–19
  Halfway Guesthouse ($20, the one bed that did not change, still walk-in) ·
  Dec 19–20 Yanyuan Mountain Retreat, Dali old city ($47) · Dec 20–21 ibis
  Kunming Changshui Airport ($26) · Dec 21–26 The Royal Garden, TST East
  ($1,209). Six of them now carry a real street address, straight out of the
  authority document. Bed labels, sleep blocks, day plans, costs and every
  hotel-bearing task, alarm and runbook step follow the new names.
- **Two taxi cards were actively wrong and are corrected.** 宝钞胡同 (Baochao
  Hutong — the old hutong hotel) is replaced by **后海**, the district Blossom
  House is in, and Dec 7–8 point at it. 昆明南站 stays — the Dali train still
  arrives there on Dec 20 — but its gloss now says so out loud, and Dec 20 points
  at **昆明长水国际机场** instead, because that is where the bed is.
- **Two cards added**, both `vfy:1`: 太舞滑雪小镇 (Thaiwoo Ski Town, for Element)
  and 解放碑 (Jiefangbei, for Glenview). They sit at the END of `DATA.places` on
  purpose — a card's seed id is its index in that array.
- **Dec 20–21 replanned with the bed.** Kunming moved from downtown to the
  airport, so the evening of the 20th now holds the noodles and, if there is
  time, Green Lake at dusk — and the morning of the 21st holds nothing at all.
  You wake 3.4 km from the terminal with a free 24-hour shuttle; the visa exit
  is the only thing that day.
- **Budget raised to $7,500** (was $6,500): lodging $1,750 → $2,550, other
  $350 → $510. Stop totals moved with the beds — Beijing ≈$920, Chongli ≈$520,
  Zhangjiajie ≈$240, Chongqing ≈$240, Lijiang ≈$200, Dali ≈$80, Kunming ≈$26,
  Hong Kong ≈$1,600.

### Added
- Task **`pullman-charge`** (Dec 6): Pullman charges the card on Dec 7, the day
  you are on the Great Wall with no signal — a declined charge could drop the
  room quietly. Paired with a 09:00 alarm the day before.
- Task **`lijiang-bagtransfer`** (Sept 15): get the gorge bag transfer in writing
  from Yue Tu Inn while the booking is still freely cancellable. Mama Naxi
  survives in the app only here and in the Lijiang tip, as the named fallback —
  that service is the whole reason it was ever the pick.

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
