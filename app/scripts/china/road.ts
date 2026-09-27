/* THE TWO ROAD LEGS, AND WHY THEY HAD NO CARDS UNTIL NOW.

   Every other move between two cities on this trip is a flight or a train, and
   every one of those has had a card since `rail.ts` closed that gap on
   2026-07-28. Two did not, and they were the two nobody sells you a ticket for
   in advance: the early bus into Tiger Leaping Gorge on Dec 18, and the shared
   car out of it on Dec 19. They lived only as clauses inside day plans — "early
   bus to Qiaotou (~2h)", "shared car from the gorge (~4–5h, ~$25)" — which
   means the Plans page showed a night in Lijiang, then a night in the gorge,
   then a night in Dali, and nothing at all about how a person gets between
   them.

   Mapping the trip end to end on 2026-08-12 is what surfaced it: laid out as a
   route, these were the only two joins with nothing on either side of them.

   IT IS A TRANSCRIPTION, exactly as rail.ts is. Every figure below is quoted
   from `legacy/index.html` and carried in `source` so it can be traced without
   leaving this file. No operator names, no departure times, no fares and no
   pick-up points that a document did not already state.

   BOTH SHIP `status: 'pending'`, and unlike the trains that is not a thing to
   fix. There is no booking window to wait for and no site that sells them: the
   bus is walk-up at a Lijiang bus station and the car is arranged on the trail
   the day before. `pending` here means "nothing is held", which is the true
   state and the one that keeps them on the to-do list rather than reading as
   solved.

   NEITHER END OF EITHER LEG CARRIES A MAP BUTTON, and that is the same contract
   rail.ts ships under — a button appears only where a document names a place
   this repo has verified. Four ends, four silences:

     Dec 18 · departure  "Lijiang" — the day plan says "early bus to Qiaotou"
              and names no bus station. Lijiang has more than one, and they are
              not near each other.
     Dec 18 · arrival    "Qiaotou" — named only as a destination. The trailhead
              town is where the bus stops; no document gives the stand, the
              ticket office or the gate a searchable name.
     Dec 19 · departure  "Tina's Guesthouse" — the one end this repo DID once
              have. It was verified on OpenStreetMap and then DEMOTED on the
              phone on 2026-08-01: Amap answers "Tina's 虎跳峡" with "Info not
              found", and 中峡客栈 with a DIFFERENT guesthouse at the same
              descent. A bag was sent ahead to one of them. See spots.ts.
     Dec 19 · arrival    "Dali" — a city, never a drop-off point. The car puts
              you somewhere in the old town and no line says where.

   A missing button is the correct behaviour and each end says so on its face. */
import type { ISODate } from '../../src/lib/model/types';
import type { RailLegEnd } from './rail';

export interface RoadLeg {
  /** `cn26-road-<key>` — keyed by the day, the way the trip refers to them. */
  key: string;
  date: ISODate;
  title: string;
  from: RailLegEnd;
  to: RailLegEnd;
  /** The documents' own figure, never a computed one. */
  duration?: string;
  meta: [string, string, boolean?][];
  note: string;
  alert?: boolean;
  /** The line in legacy/index.html this leg was transcribed from. */
  source: string;
}

export const ROAD_LEGS: RoadLeg[] = [
  /* ── Dec 18 · INTO THE GORGE ──────────────────────────────────────────────
     The one leg on this trip with a hard consequence for being late rather than
     for being unbooked: the trek is 5–6 hours to Halfway and it is dark by
     18:00. "Early" is the whole instruction and the documents give no time. */
  {
    key: 'dec18',
    date: '2026-12-18',
    title: 'Early bus · Lijiang → Qiaotou',
    from: {
      label: 'Lijiang',
      why: 'The day plan says "early bus to Qiaotou" and names no station. Lijiang has more than one bus station and they are not close together — a guess would send the taxi to the wrong side of town before dawn.',
    },
    to: {
      label: 'Qiaotou',
      why: 'The trailhead town, named as a destination and never as a place. No document gives the stand, the ticket office or the gate a name to search.',
    },
    duration: '~2 h',
    meta: [
      ['Fare', 'not stated — ask'],
      ['Gorge entry', '¥65 — still current'],
      ['Booked', 'NO — walk-up, no advance sale', true],
      ['Leave', 'EARLY — ask Yue Tu on Dec 17 for the first bus', true],
      ['Trail status', 'ask on Dec 17 — mudslide/rockfalls Jul–Sep 2026', true],
      ['Fallback', 'not at Tea Horse by ~15:00 → sleep there · closed/icy → minibus to Tina\'s', true],
    ],
    note:
      '🚌 **Walk-up, and there is nothing to book.** No operator, no departure time and no fare is named anywhere in the trip\'s documents — only "early bus to Qiaotou (~2h)" and the **¥65** gorge entry, both still current. **Ask the Yue Tu desk on Dec 17 for the first bus time and the trail status**; they are the people who know.<br>⚠️ **"Early" is the entire instruction and it is load-bearing.** Qiaotou → the 28 Bends → Halfway Guesthouse is **5–6 h — the fast end of the range** — and it is dark by **18:00**. A late start is not a late arrival, it is walking the Bends in the dark.<br>🪨 **2026 on the gorge:** mudslide 23–24 Jul, rockfall 30 Jul, closure 31 Jul, reopened ~3 Aug, a minor rockfall 1 Sep, "operating normally" on 2 Sep (a Shangri-La-administered scenic area; which sections were hit is unclear).<br>🔁 **The fallback, decided in advance:** not at **Tea Horse by ~15:00** → sleep at Tea Horse · trail **closed or icy** → minibus along the gorge road to **Tina\'s** and sleep there (the bag is going there anyway) · **Dec 19 is unchanged** either way.<br>💵 **Draw cash in Lijiang first.** The trail is cash-only and Qiaotou\'s ATMs take China-issued cards only.',
    alert: true,
    source: 'legacy/index.html — Dec 18 day plan: "Early bus to Qiaotou (~2h) · entry ¥65" · the 2026-09-27 review: 2026 incidents (mudslide 23–24 Jul, rockfall 30 Jul, closure 31 Jul, reopened ~3 Aug, minor rockfall 1 Sep, "operating normally" 2 Sep) and the Tea Horse / Tina\'s fallback',
  },

  /* ── Dec 19 · OUT OF THE GORGE ────────────────────────────────────────────
     Already named in the accommodation document as the leg most likely to slip
     on the whole trip, and it runs into the earliest-closing desk of any bed.
     That pairing is the reason this one carries an alert. */
  {
    key: 'dec19',
    date: '2026-12-19',
    title: 'Shared car · Tiger Leaping Gorge → Dali',
    from: {
      label: "Tina's Guesthouse",
      why: 'Verified on OpenStreetMap and then demoted on the phone: Amap does not find "Tina\'s", and 中峡客栈 returns a different guesthouse at the same descent. Right trail, wrong business — and this is where the bag was sent. Read the name, do not open a map.',
    },
    to: {
      label: 'Dali',
      why: 'A city, never a drop-off point. No line says where in the old town the car stops.',
    },
    duration: '~4–5 h',
    meta: [
      ['Fare', '~$25'],
      ['Booked', 'NO — arranged on the trail', true],
      ['Arrive', 'evening', true],
      ['Desk shuts', '23:00 — Dali Yanyuan', true],
      ['As you leave', 'WhatsApp your ETA to +86 189 8708 1208', true],
    ],
    note:
      '🚗 **Arranged at Tina\'s on the day, not before.** ~4–5 h, ~$25, shared with whoever else is coming off the trail.<br>⚠️ **THIS IS THE LEG MOST LIKELY TO SLIP ON THE TRIP, and it runs into the earliest-closing desk of any bed on it.** Dali Yanyuan checks in **14:00–23:00**, and a **22:00–23:00 late arrival is APPROVED** (Booking.com, 27 Jul — read 27 Sep) — but the door still shuts at 23:00. **As the car leaves Tina\'s, WhatsApp +86 189 8708 1208 with your ETA** (the property asked for one; the number takes WhatsApp and WeChat), and again if the car slips toward 23:00.<br>🎒 **The bag should be waiting at Tina\'s**, sent ahead from Lijiang on Dec 18 — Yue Tu Inn said on 28 Jul it can move luggage to Tina\'s, and the bag-only transfer was asked for on 27 Sep; ⏳ not confirmed yet.',
    alert: true,
    source: 'legacy/index.html — Dec 19: "shared car from the gorge (~4–5h, ~$25)" and the Dali stop\'s 23:00 warning',
  },
];

/** The group these sit under on the Wallet's Travel tab, next to the trains'
    "Trains · none booked yet". It states the whole set's nature in its heading:
    these are not unbooked because nobody got round to it. */
export const ROAD_GROUP_LABEL = 'Road · arranged on the day';
