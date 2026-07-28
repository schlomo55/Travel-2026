/* Which PLACES each day of the trip goes to — the link, shipped as data.

   The day plans are prose. `planItems` are the sentences the trip file wrote,
   and a sentence names a place the way a human writes it: "Forbidden City",
   "Big Buddha", "the races". The entities that can actually be opened in a map
   are named the way OpenStreetMap and Amap answer to: `Palace Museum`,
   `Tian Tan Buddha`, `Happy Valley Racecourse`. Twelve of them disagree
   outright. Nothing but a human reading both lists can join them.

   SO THIS FILE IS THE JOIN, WRITTEN DOWN ONCE. It is deliberately NOT a text
   matcher. A matcher would have to guess, and the two guesses it would get
   wrong are exactly the ones that cost a day: "The Peak" vs `Peak Tram` (two
   different places, one of which does not exist here yet), and "Yat Lok is
   closed Wednesdays" — a line that NAMES the restaurant precisely in order to
   say you are not going. Both are coin flips for a matcher and neither is one
   for a reader.

   THE RULES THIS MANIFEST IS HELD TO
   1. Only ids that ALREADY EXIST in the seed, and only ones that already open
      (`mapUrl` / `mapQuery` / `coord` / `address`). `assert.ts` fails the build
      on an id that resolves to nothing or to something with no map target, so a
      typo here can never become a missing chip on the phone.
   2. A place the day names but the seed does not carry is LEFT OUT — it is not
      approximated with a neighbour. Jingshan Park is not the Palace Museum;
      Jinshanling is not Mutianyu; 重庆1949's theatre is not the Chongqing Grand
      Theatre. Those lines stay bare until the place is researched, verified and
      added (Phase 2). A missing chip is the honest outcome.
   3. A place named in order to say you are NOT going there does not get a chip.
      Dec 23's Yat Lok and Dec 24's Australia Dairy are both "closed today"
      notes; each is linked on the day it is actually open, and only then.
   4. Order is the DAY'S OWN order — first mention wins, and a place named twice
      in one day appears once.
   5. A day with nothing to link has NO KEY here at all, never an empty array.
      Three days are in that state on purpose: Nov 29 (an errand day in Yantai),
      Dec 10 (a full day on the Chongli greens, no named venue) and Dec 22
      (Macau, which has no places in the seed until Phase 4).

   THE CROSS-NAME LINKS — DO NOT "CORRECT" THESE
   The day text on the left, the entity id on the right. Every one of them looks
   like a mistake to a reader who only has one of the two lists:

     Forbidden City (Dec 6)        → cn26-spot-beijing-palace-museum
     Liziba (Dec 15)               → cn26-spot-chongqing-liziba  (`Liziba station`)
     Eling Park / Testbed 2 (15)   → cn26-spot-chongqing-eling   (`Eling Park & Testbed 2`)
     Ciqikou (Dec 15 & 16)         → cn26-place-14  磁器口 (a driver card, not a spot)
     Baisha village (Dec 17)       → cn26-spot-lijiang-baisha    (`Baisha village & murals`)
     Shuhe (Dec 17)                → cn26-spot-lijiang-shuhe     (`Shuhe Ancient Town`)
     Green Lake Park (Dec 20)      → cn26-spot-kunming-cuihu     (`Green Lake (Cuihu Park)`)
     Happy Valley races (Dec 23)   → cn26-spot-hongkong-happy-valley (`Happy Valley Racecourse`)
     Dragon's Back (Dec 23)        → cn26-spot-hongkong-dragons-back
     Yat Lok roast goose (Dec 24)  → cn26-spot-hongkong-yat-lok  (`Yat Lok · roast goose`)
     Star Ferry (Dec 24)           → cn26-spot-hongkong-star-ferry (`… · Tsim Sha Tsui pier`)
     Big Buddha (Dec 25)           → cn26-spot-hongkong-big-buddha (`Tian Tan Buddha`)
     Tai O (Dec 25)                → cn26-spot-hongkong-tai-o    (`Tai O stilt village`)
     M+ museum (Dec 26)            → cn26-spot-hongkong-mplus    (`M+ & West Kowloon`)

   AIRPORTS ARE LINKED THROUGH WHATEVER ALREADY CARRIES THEM, and that is two
   different things by accident of history. The six mainland airports are driver
   cards (`cn26-place-01/02/09/12/15/20`) because a taxi has to be shown them.
   Tel Aviv, Abu Dhabi and Hong Kong have no card, so the FLIGHT booking is the
   entity that opens them — a flight's map button is its DEPARTURE airport, the
   one you have to reach (transform.ts → airportFields). Never both for the same
   terminal: Dec 11 links the PEK card, not CA1953, because they open the same
   place and two chips for one gate is noise.

   BEDS ARE LINKED WHERE THE DAY NAMES THEM, and only there. Checking into a
   hotel is a place you go to; sleeping in it a second night is not a line in
   the plan. Two beds ship no button at all (Blossom House, Huatian Grand — see
   §1 of the plan) and so are simply absent even on their own arrival day. */

/** Keyed by ISO date → the ids that day's `planItems` refer to, in the day's
    own order. Consumed by transform.ts, validated by assert.ts. */
export const DAY_PLACES: Record<string, string[]> = {
  /* Departure. Two airports, both reached through their flight because neither
     TLV nor AUH has a driver card: EY608 opens Ben Gurion (where the day
     starts), EY888 opens Zayed Terminal A (where the layover is spent).
     PKX is NOT here — the third line says "08:45 tomorrow", and tomorrow is
     where the arrival chip belongs. */
  '2026-11-21': ['cn26-flight-ey608', 'cn26-flight-ey888'],

  /* Landing day. 北京南站 is the FALLBACK route ("flight if booked, else PKX →
     Beijing South → HSR ~5h") and is linked anyway: the line names a station
     the traveller may well stand in, and a chip that is not needed costs
     nothing while a missing one costs a taxi. The academy itself is
     cn26-place-00, whose address is officially still pending — it ships no
     button, so it cannot be linked. */
  '2026-11-22': ['cn26-place-01', 'cn26-place-03'],

  /* Nov 29 has no key. Its three lines are a ticket release watched from Yantai
     (the Palace Museum is NOT visited that day — Dec 6 is), a Decathlon/Uniqlo
     gear run with no named branch, and train booking. Nothing to open. */

  /* Academy → Beijing. Beijing South is the train fallback again. 曲水兰亭 (the
     midnight massage, cn26-place-06) exists as a driver card but never passed
     verification and ships no button; 三里屯 is where the evening actually is. */
  '2026-12-05': ['cn26-place-03', 'cn26-stay-00', 'cn26-place-04'],

  /* CROSS-NAME: "Forbidden City" is the Palace Museum 故宫博物院. The spot is
     named the way OSM answers, the day the way everyone speaks.
     Jingshan Park (line 2) does not exist in the seed yet — Phase 2. */
  '2026-12-06': ['cn26-spot-beijing-palace-museum', 'cn26-place-04'],

  /* Great Wall day. Jinshanling — the whole point of the day — is NOT in the
     seed, and Mutianyu (which is) is a different section of wall 60 km away, so
     nothing is linked for it. The bed that night, Blossom House, ships no
     button either; 后海 is the driver card that exists FOR it ("Houhai, Beijing
     — Blossom House district"), so it is the chip that gets you to the door's
     street rather than to nothing. */
  '2026-12-07': ['cn26-stay-00', 'cn26-place-05'],

  /* Spa day. The clinic is the driver card the day quotes an address for
     (航空胡同42号). Jiuhua Resort at Xiaotangshan is Phase 2. */
  '2026-12-08': ['cn26-place-27'],

  /* To Chongli. 太子城站 is the station the resort shuttle meets; Element is the
     bed the line names. 太舞滑雪小镇 (Thaiwoo, the resort Element sits inside)
     is cn26-place-25 and ships no button, so the town is not linked. */
  '2026-12-09': ['cn26-place-08', 'cn26-stay-02'],

  /* Dec 10 has no key. "Group lesson + full practice day on the greens" names
     no venue: the day happens wherever Element's own lift pass goes, and
     guessing between Genting, Wanlong and Fulong would be inventing a plan. */

  /* THE "NOT DAXING" LINE. "cross to PEK (Capital) — NOT Daxing" is a direction
     rather than a destination, and it is still the single most important place
     of the day: the trip's one flight that a traveller could plausibly take to
     the wrong airport (CA1953 carries the same warning on its own card). Then
     the airport it lands at, and Wulingyuan, the park gate you drive on to. */
  '2026-12-11': ['cn26-place-02', 'cn26-place-09', 'cn26-place-10'],

  /* Yuanjiajie and the Avatar pillars are not in the seed (Phase 2). The
     Bailong Elevator IS — and the line says "on foot, NOT the elevator", so it
     is deliberately not linked. */
  '2026-12-12': ['cn26-spot-zhangjiajie-golden-whip'],

  /* Huatian Grand (the bed) ships no button, and 天门山 is named here only as a
     LANDMARK for it ("450 m from the Tianmen cableway") — you go there
     tomorrow, so tomorrow is where its chip is. Zhangjiajie West is Phase 3. */
  '2026-12-13': ['cn26-spot-zhangjiajie-tianzishan', 'cn26-spot-zhangjiajie-yangjiajie'],

  /* Tianmen, named on two consecutive lines (the ice check and the 08:00
     entry), appears once. 千厮门大桥 — the bridge viewpoint beside Hongya Cave —
     is Phase 2. */
  '2026-12-14': ['cn26-place-11', 'cn26-place-13'],

  /* CROSS-NAME ×3. Ciqikou is a DRIVER CARD (磁器口), not a Chongqing spot —
     the stop's spot list never carried it. "Liziba train-through-building" is
     the spot `Liziba station`, and "Eling Park / Testbed 2" is the single spot
     `Eling Park & Testbed 2`. Ronghui Hot Springs and 重庆1949's theatre are
     both Phase 2; the Chongqing Grand Theatre already in the seed is a
     DIFFERENT venue and must never be substituted for the show. */
  '2026-12-15': ['cn26-place-14', 'cn26-spot-chongqing-liziba', 'cn26-spot-chongqing-eling'],

  /* Ciqikou again ("more Ciqikou / viewpoints"), then the airport run, the
     airport you land at, and the inn that approved the 22:00–23:00 arrival. */
  '2026-12-16': ['cn26-place-14', 'cn26-place-12', 'cn26-place-15', 'cn26-stay-06'],

  /* CROSS-NAME ×2: "Baisha village" is `Baisha village & murals`, "Shuhe" is
     `Shuhe Ancient Town`. The Naxi Ancient Music concert hall is not in the
     seed (Phase 2). Yue Tu appears because line 4 sends you to its DESK for the
     bag transfer — an errand at a place, not just the bed you woke up in. */
  '2026-12-17': [
    'cn26-spot-lijiang-jade-dragon',
    'cn26-spot-lijiang-baisha',
    'cn26-spot-lijiang-shuhe',
    'cn26-stay-06',
  ],

  /* The gorge. 桥头 is the trailhead card (a coordinate — its name was never
     verified, so it opens as a pin, which for a trailhead is right). Halfway
     Guesthouse is the one walk-in bed on the trip and opens by name (中途客栈).
     Tea Horse Guesthouse, the lunch stop, is Phase 2. */
  '2026-12-18': ['cn26-place-17', 'cn26-stay-07'],

  /* Tina's — where day 2 ends and the bag should be waiting — is not in the
     seed (Phase 2). 大理古城 is the "shared car toward Dali" destination, and
     Yanyuan is the desk that shuts at 23:00. The Renmin Road food street is
     Phase 2: the seed's `The Catholic church on Renmin Road` is a building ON
     that road, not the food street, and must not stand in for it. */
  '2026-12-19': ['cn26-place-18', 'cn26-stay-08'],

  /* The longest chip row of the trip, and every one of them is on line 2 or
     later of a six-line day: the optional Erhai shore ride (three spots, in the
     order the line writes them), the station the train arrives at, Green Lake
     at dusk — CROSS-NAME, the spot is `Green Lake (Cuihu Park)` — and the
     airport hotel that lines 4 and 5 both chase. Longkan Wharf is Phase 2. */
  '2026-12-20': [
    'cn26-spot-dali-caicun',
    'cn26-spot-dali-xizhou',
    'cn26-spot-dali-zhoucheng',
    'cn26-place-19',
    'cn26-spot-kunming-cuihu',
    'cn26-stay-09',
  ],

  /* EXIT DAY. You wake at the airport hotel and the whole morning is the
     airport, named on two lines. HKG is where you land, and its only entity is
     EY871 — the flight that LEAVES from it on Dec 26 — so linking it here would
     put a Dec 26 departure chip on Dec 21. Left out; the Royal Garden is not
     named on the "A21 bus to TST" line either. */
  '2026-12-21': ['cn26-place-20'],

  /* Dec 22 has no key. A full day in Macau: the Sheung Wan ferry pier, the
     Ruins of St. Paul's, Coloane and Lord Stow's. NONE of them is in the seed,
     and Macau is not even inside the coordinate box that routes places to
     Google instead of Amap — that is Phase 4, and until it lands this day
     honestly shows nothing. */

  /* CROSS-NAME: "the races" is `Happy Valley Racecourse` 跑馬地馬場. Big Wave
     Bay / Shek O is Phase 2. YAT LOK IS DELIBERATELY ABSENT: line 3 names it
     only to say it is closed on Wednesdays. It is linked on Dec 24, when it is
     open — which is the whole argument for an explicit manifest. */
  '2026-12-23': ['cn26-spot-hongkong-dragons-back', 'cn26-spot-hongkong-happy-valley'],

  /* CROSS-NAME ×2: `Yat Lok · roast goose` 一樂燒鵝 and `Star Ferry · Tsim Sha
     Tsui pier`. The Peak (and the Peak Tram) is Phase 2 — the day's headline
     place, and the seed cannot open it yet. The Symphony of Lights viewing
     point is Phase 2 too. Australia Dairy is absent for Yat Lok's reason in
     reverse: line 4 says it is closed on Thursdays, and Dec 24 is a Thursday. */
  '2026-12-24': ['cn26-spot-hongkong-yat-lok', 'cn26-spot-hongkong-star-ferry'],

  /* CROSS-NAME ×2: "Big Buddha" is `Tian Tan Buddha` 天壇大佛, "Tai O" is
     `Tai O stilt village` 大澳. Po Lin Monastery is in the seed and sits beside
     the Buddha, but the day does not name it, so it gets no chip. Lung King
     Heen and the Ngong Ping cable car are both Phase 2. */
  '2026-12-25': ['cn26-spot-hongkong-big-buddha', 'cn26-spot-hongkong-tai-o'],

  /* CROSS-NAME: "M+ museum" is `M+ & West Kowloon`. EY871 is the entity that
     opens HKG Terminal 1 — Hong Kong's airport has no driver card. */
  '2026-12-26': ['cn26-stay-10', 'cn26-spot-hongkong-mplus', 'cn26-flight-ey871'],

  /* Home. EY609 leaves Abu Dhabi at 02:45 on this date, so Zayed Terminal A
     really is a place you stand in on Dec 27 — the flight's own map button
     opens it. Ben Gurion, where the line's attention is ("lands TLV 04:35"),
     has no entity of its own: only EY608 opens it, and that is the Nov 21 leg. */
  '2026-12-27': ['cn26-flight-ey609'],
};

/** The same manifest for the two `dayDefault` templates — the Kunyu weeks,
    which have no dates of their own. Keyed by the DayDefault id the transform
    assigns.

    `cn26-daydef-kunyu-week` has NO ENTRY and will not get one: a training day
    is six lines that all happen inside the academy, and the academy's own
    address is still officially pending (cn26-place-00 ships no button). There
    is nothing to open, and the stop's Mount Kunyu pin is the massif, not the
    school — a chip pointing at it would claim to know where the school is. */
export const DAY_DEFAULT_PLACES: Record<string, string[]> = {
  /* The Sunday-off template's third line IS a list of places, written in the
     seed as "Penglai Pavilion · Changyu wine museum · Yantai Hill Park ·
     Suochengli" — four spots that already exist on the Kunyu stop, in that
     order. Line 1's "Yantai seaside" is not linked: it names a coastline, and
     `Yantai Hill Park` is a park on it, not the same thing. */
  'cn26-daydef-kunyu-sunday': [
    'cn26-spot-kunyu-penglai',
    'cn26-spot-kunyu-changyu',
    'cn26-spot-kunyu-yantaishan',
    'cn26-spot-kunyu-suochengli',
  ],
};
