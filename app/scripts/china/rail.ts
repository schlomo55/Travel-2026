/* THE FIVE TRAIN JOURNEYS, AND THE STATIONS THE DOCUMENTS DO AND DO NOT NAME.

   The trip has five rail legs and, on 2026-07-28, zero train bookings. Every
   flight has had a card since the first build; the trains lived only inside the
   prose of a day line, which means the one screen you look at while standing on
   a concourse had nothing on it. This file is that gap closed.

   IT IS A TRANSCRIPTION, NOT A PLAN. Every date, duration, fare, time-of-day
   and ticket window below is quoted from `legacy/index.html` or `sources/`, and
   each leg carries the line it came from in `source` so the claim can be traced
   without leaving the file. NOTHING IS RESEARCHED HERE: no train numbers, no
   departure times, no platforms, no seat classes and no prices that a document
   did not already state. Where the documents are silent, so is the card.

   EVERY ONE OF THEM SHIPS `status: 'pending'`. Not one ticket is booked — the
   trip's own to-do list still says to buy them as each 15-day window opens —
   and a card that looked booked would be the worst kind of lie this app can
   tell, because you would stop chasing it.

   ─────────────────────────────────────────────────────────────────────────
   THE STATIONS, WHICH ARE THE WHOLE DIFFICULTY

   A flight has one place at each end: an airport code IS a place, which is why
   `airportFields` in transform.ts can borrow a driver card's verified name and
   be done. A train does not. Of the ten ends below, THREE are not named anywhere
   in the trip's documents (four until 2026-09-27), and one more is named twice
   without being decided:

     Dec  9 · departure  "Beijing North / Qinghe" — TWO stations, and the plan
              has not chosen. Both are real, both are in the seed as Phase 2
              spots, and both open. Picking one would be inventing a decision
              nobody has made; opening both is exactly what the line says.
     Dec 11 · arrival    NAMED SINCE 2026-09-27: Qinghe. For two months the
              day said only "back to Beijing" and this end shipped NO BUTTON.
              Then Air China retimed CA1953 and the booking moved to CA8609
              from DAXING, and the rewritten day (days-and-food, Dec 11) names
              the station: "HSR Taizicheng → Qinghe ~1 h, then Qinghe → Daxing".
              It borrows the Phase 2 spot the Dec 9 card already opens.
     Dec 14 · arrival    "Chongqing" — no station. Chongqing has 重庆北 and
              重庆西 and they are far apart, so a guess is not a near miss; it
              is the wrong side of a very large city. NO BUTTON.
     Dec 20 · departure  "Dali" — no station. The day's own line says "the
              station is in Xiaguan, 30–45 min from the old town", which is
              ambiguous about WHICH station it describes, and this repo does not
              resolve an ambiguity by choosing. NO BUTTON.
     Nov 22 · arrival    "Yantai" — no station, only the city. NO BUTTON.

   A missing button is the correct behaviour, and each of those ends says so on
   its own face: `why` is printed on the card, next to where the button would
   have been. That is the same contract the buttonless driver cards and the
   buttonless bed already ship under.

   ─────────────────────────────────────────────────────────────────────────
   THE ENDS THAT DO OPEN BORROW, THEY DO NOT INVENT

   `stationIds` names entities that ALREADY EXIST and have ALREADY passed
   `verify:places`. Two forms, both resolved in transform.ts:

     `cn26-place-NN`      a driver card — 北京南站 (03), 太子城站 (08),
                          昆明南站 (19), 北京大兴国际机场 (01)
     `<stopKey>/<spotId>` a stop's spot — beijing/beijing-north, beijing/qinghe
                          (Dec 9 AND Dec 11), zhangjiajie/zjj-west, all added
                          by Phase 2

   The resolver copies the entity's own name and its own map decision. It does
   not compose a query, and if an id ever stops being openable — a future gate
   run demoting it, say — the BUILD FAILS rather than the card quietly shipping
   a dead button. Silent drops are the failure mode this repo exists to refuse.

   ─────────────────────────────────────────────────────────────────────────
   WHY THERE IS NO `priceNote` ON ANY OF THEM

   The documents do state fares, and they are all here — in `meta`, labelled as
   the estimates they are. They are NOT `priceNote`, because `priceNote` feeds
   "Booked & committed", the card that answers "what have I already spent". An
   unbought ticket quoted at "~¥90" is a plan, not a commitment, and adding five
   of them would inflate that total with money nobody has paid. The money screen
   counts them as unpriced instead, which is the literal truth: five rows with
   no price yet. */
import type { ISODate } from '../../src/lib/model/types';

export interface RailLegEnd {
  /** What the documents call this end, verbatim in their own words. */
  label: string;
  /** Entities to borrow a verified station from. Empty where the documents
      name no station — and then `why` is what the card prints instead. */
  stationIds?: string[];
  /** Printed on the card wherever there is no button. Required in that case. */
  why?: string;
}

export interface RailLeg {
  /** `cn26-train-<key>` — keyed by the day, which is how the trip refers to
      each of these ("the Dec 20 train"), and stable in a way an index is not. */
  key: string;
  date: ISODate;
  /** The card's headline. */
  title: string;
  from: RailLegEnd;
  to: RailLegEnd;
  /** The documents' own figure ("~1 h"), never a computed one. */
  duration?: string;
  /** k/v chips, exactly as a flight's `meta` works. `true` marks it warning. */
  meta: [string, string, boolean?][];
  /** md-lite, drawn under the chips. */
  note: string;
  /** Draw the note as an alert. */
  alert?: boolean;
  /** This leg is the OTHER way of doing the same journey, not a second part. */
  alternative?: boolean;
  /** The document line(s) this card was transcribed from, verbatim. Not
      shipped — it is here so the next reader can check the card against its
      source without opening `legacy/index.html`. */
  source: string;
}

/** In the order the trip meets them. */
export const RAIL_LEGS: RailLeg[] = [
  /* ── Nov 22 · THE FALLBACK, and the only leg here that is not the plan ──
     The plan is a flight. This is the other half of the same sentence, and
     neither has been booked, which is precisely why it needs a card: on the
     morning it matters you are in an arrivals hall deciding between them.
     PKX and Beijing South are both named and both are driver cards already, so
     the departure end opens two things in the order you need them. Yantai is a
     city, not a station, and gets nothing. */
  {
    key: 'nov22',
    date: '2026-11-22',
    /* The ONLY leg on this trip flagged `alternative`. CA8683 was booked on
       2026-08-12 and is the plan; this shares its date and is the other way of
       making the same journey, so the Plans page must offer it as an OR and
       never as a second hop. */
    alternative: true,
    title: 'HSR fallback · PKX → Beijing South → Yantai',
    from: {
      label: 'PKX → Beijing South',
      stationIds: ['cn26-place-01', 'cn26-place-03'],
    },
    to: {
      label: 'Yantai',
      why: 'the plan names no Yantai station — only the city',
    },
    duration: '~5 h',
    meta: [
      ['Only if', 'the Sunday flight is not booked', true],
      ['PKX → Beijing South', 'taxi/metro ~1 h'],
      ['Fare', '~$60–70 (planned)'],
      ['Arrival', 'evening — tell the academy', true],
    ],
    alert: true,
    note:
      '**FALLBACK ONLY.** The plan is the ~1h25 flight to Yantai *if it is booked* — this is what the day says to do if it is not. Neither is booked. There is **no direct train from Beijing Daxing to Yantai**; the route is PKX → Beijing South by taxi or metro, then HSR.',
    source:
      'Day 2026-11-22 line 1: "Onward to Yantai: flight (~1h25) if booked, else PKX → Beijing South → HSR ~5h" · Kunyu stop: "Plan B if no Sunday flight: PKX → Beijing South (taxi/metro ~1h) → HSR to Yantai ~5h ($60–70), evening arrival — tell the academy" · handoff prompt: "there is NO direct train from Beijing Daxing to Yantai (myth)"',
  },
  /* ── Dec 9 · THE TWO-STATION DEPARTURE ──
     "Beijing North / Qinghe" is where this file earns its keep. The line names
     both and chooses neither, so the card names both and chooses neither: two
     buttons, one per station, and the label keeps the document's own slash.
     Blossom House was picked for its distance to Qinghe ("closest base to
     Qinghe, where you leave from on Dec 9"), which is evidence the question is
     live rather than settled — it is a reason to prefer one, not a booking. */
  {
    key: 'dec09',
    date: '2026-12-09',
    title: 'HSR · Beijing → Taizicheng',
    from: {
      label: 'Beijing North / Qinghe',
      stationIds: ['beijing/beijing-north', 'beijing/qinghe'],
    },
    to: {
      label: 'Taizicheng',
      stationIds: ['cn26-place-08'],
    },
    duration: '~1 h',
    meta: [
      ['Line', '2022 Olympic HSR'],
      ['Fare', '~¥90 (planned)'],
      ['Ticket window', 'opens ~Nov 25'],
      ['At the other end', 'resort shuttle meets the station'],
    ],
    note:
      'The departure station is **not decided**: the plan names Beijing North **or** Qinghe, so both open here. Blossom House was chosen as the closest base to Qinghe, which is a reason to prefer it — not a ticket.',
    source:
      'Day 2026-12-09 line 0: "HSR Beijing North / Qinghe → Taizicheng ~1h (~¥90), resort shuttle meets the station" · Chongli stop, Getting there: "Dec 9: Beijing North / Qinghe → Taizicheng on the 2022 Olympic HSR line, ~1h (~¥90) · resort shuttles meet the station" · alarm 2026-11-25: "Train window: Beijing→Taizicheng (Dec 9)"',
  },
  /* ── Dec 11 · THE LEG THAT FEEDS THE DAXING FLIGHT ──
     Departure is 太子城站, the card the trip already ships. Until 2026-09-27 the
     Beijing end was named nowhere ("back to Beijing") and shipped no button,
     and the flight it fed was CA1953 from PEK Capital. Then Air China retimed
     CA1953 to 07:45 and the same Trip.com order was changed free onto CA8609,
     DAXING 18:15 → DYG 20:30. The rewritten day names the station — Qinghe —
     so the arrival now borrows the Phase 2 spot the Dec 9 card already opens.
     NO TRAIN IS CHOSEN and none is invented here: the card says what the train
     has to achieve (into Qinghe by ~14:30, so that ~1.5 h across Beijing — a
     planning figure, marked verify — still puts you at PKX by ~16:45), not
     which one does it. */
  {
    key: 'dec11',
    date: '2026-12-11',
    title: 'HSR · Taizicheng → Qinghe',
    from: {
      label: 'Taizicheng',
      stationIds: ['cn26-place-08'],
    },
    to: {
      label: 'Qinghe',
      stationIds: ['beijing/qinghe'],
    },
    duration: '~1 h',
    meta: [
      ['Fare', '~$13 (planned)'],
      ['Ticket window', 'opens ~Nov 27'],
      ['Into Qinghe by', '~14:30 — no train chosen yet', true],
      ['Then', 'Qinghe → DAXING (PKX) ~1.5 h — NOT Capital', true],
    ],
    alert: true,
    note:
      'This is the leg **CA8609** sits on the end of — **Daxing (PKX) 18:15 → Zhangjiajie 20:30**. Pick a train that reaches **Qinghe by ~14:30**: Qinghe → Daxing is ~1.5 h by metro or taxi *(verify)*, and the aim is to be at PKX by ~16:45. **Daxing, NOT Capital** — the old flight (CA1953) left from Capital, and the two airports are on opposite sides of the city. No train is chosen or booked yet.',
    source:
      'Day 2026-12-11 (rewritten 27 Sep 2026): "HSR Taizicheng → **Qinghe** ~1h — aim for a train into Qinghe by ~14:30 — then cross to **Daxing (PKX) — NOT Capital**, ~1.5h by metro or taxi *verify*. **Be at PKX by ~16:45**" / "CA8609 · Daxing (PKX) 18:15 → Zhangjiajie DYG T2 20:30" · runbook dec11: "HSR Taizicheng → Qinghe (~1h) — a train into Qinghe by ~14:30 (none chosen or booked yet)" · alarm 2026-11-27: "Train window: Taizicheng→Qinghe (Dec 11) — feeds CA8609 at Daxing, 18:15"',
  },
  /* ── Dec 14 · THE UNNAMED ARRIVAL ──
     张家界西站 is a Phase 2 spot and opens. The Chongqing end does not, and this
     is the clearest case in the file: two documents describe this train and
     NEITHER names a station. Chongqing has 重庆北 and 重庆西 — different sides of
     a municipality the size of Austria — so a coin flip here does not land
     "near enough". The stop itself opens 解放碑, which is where you are going. */
  {
    key: 'dec14',
    date: '2026-12-14',
    title: 'HSR · Zhangjiajie West → Chongqing',
    from: {
      label: 'Zhangjiajie West',
      stationIds: ['zhangjiajie/zjj-west'],
    },
    to: {
      label: 'Chongqing',
      why: 'no document names the arrival station, and Chongqing has two main ones far apart (重庆北 and 重庆西) — a guess here is not a near miss. The Chongqing stop opens 解放碑, which is where the evening goes',
    },
    duration: '~2 h',
    meta: [
      ['When', 'mid-afternoon'],
      ['Fare', '~$35 (planned)'],
      ['Ticket window', 'opens ~Nov 30'],
      ['Then', 'metro/taxi to Jiefangbei'],
    ],
    note:
      'The hotel’s driver runs you to Zhangjiajie West after a 14:00 late check-out. Which **Chongqing** station this arrives at is not written down anywhere in the trip, so no button guesses at it.',
    source:
      'Day 2026-12-14 lines 2–3: "the hotel\'s driver runs you to Zhangjiajie West" / "Mid-afternoon HSR Zhangjiajie West → Chongqing (~2h)" · Chongqing stop, Getting there: "Dec 14 eve: direct HSR from Zhangjiajie West (~2h), metro/taxi to Jiefangbei" · guide: "ZJJ→Chongqing ~$35 (~Nov 30)"',
  },
  /* ── Dec 20 · THE VISA-CRITICAL ONE ──
     昆明南站 is a driver card and opens; it is also the one end the documents
     are emphatic about ("arrives Kunming South", twice, plus a whole card about
     the transfer). The DALI end is not named, and the sentence that looks like
     it names one does not: "the station is in Xiaguan, 30–45 min from the old
     town" describes A station without saying which, and Xiaguan is where Dali's
     modern city is. Reading that as a station name would be resolving an
     ambiguity by preference, which is the thing §0 forbids.
     This leg is the one that must not slip: it puts you in the exit city the
     night before the visa deadline, and its booking window opens on Dec 6. */
  {
    key: 'dec20',
    date: '2026-12-20',
    title: 'HSR · Dali → Kunming',
    from: {
      label: 'Dali',
      why: 'no document names the Dali station. The day\'s line says "the station is in Xiaguan, 30–45 min from the old town" without saying which station it means, and an ambiguity is not resolved by picking',
    },
    to: {
      label: 'Kunming South',
      stationIds: ['cn26-place-19'],
    },
    duration: '~2 h',
    meta: [
      ['When', 'afternoon — the day’s only fixed item'],
      ['Fare', '~$15 (planned)'],
      ['Book', 'Dec 6, when the 15-day window opens', true],
      ['Why it matters', 'this is the visa exit leg', true],
    ],
    alert: true,
    note:
      '**Book this on Dec 6**, the day the 15-day window opens — it is the one train the trip calls visa-critical, because it puts you in the exit city the night before the deadline. It arrives at **Kunming South**; the bed is out at the airport, and that transfer is on you.',
    source:
      'Day 2026-12-20 line 2: "**Afternoon HSR to Kunming (~2h)** — arrives Kunming South; the station is in Xiaguan, 30–45 min from the old town" · Kunming stop, Getting there: "Dec 20 afternoon: Dali → Kunming HSR ~2h (~$15, very frequent) — **book Dec 6 when the window opens** · the train arrives at Kunming South, the bed is out at the airport" · Dec 6 line 3: "⚠️ **Book the Dali→Kunming train today** — the 15-day window opens and this leg is visa-critical"',
  },
];

/** Where an unbooked ticket is actually bought, from the trip's own key-dates
    list: *"Book trains on Trip.com/12306 as each 15-day window opens"*, whose
    link is this one. It is the platform's entry point, never a deep link to an
    order that does not exist — the same rule the booked beds' `manageUrl`
    follows. Five pending cards with nowhere to go would be a nag; this is the
    one action any of them affords. */
export const RAIL_BOOKING_URL = 'https://www.trip.com/trains/';

/** The group these cards sit under on the Wallet's Travel tab, beside the
    flights' "Etihad · PNR …" and "Domestic · Trip.com". It says the state of
    the whole set in its own heading, because that is the fact that matters. */
export const RAIL_GROUP_LABEL = 'Trains · none booked yet';
