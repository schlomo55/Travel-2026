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
   places 0.6 km apart, and the day means the hilltop), and "Yat Lok is closed
   Wednesdays" — a line that NAMES the restaurant precisely in order to say you
   are not going. Both are coin flips for a matcher and neither is one for a
   reader.

   THE RULES THIS MANIFEST IS HELD TO
   1. Only ids that ALREADY EXIST in the seed, and only ones that already open
      (`mapUrl` / `mapQuery` / `coord` / `address`). `assert.ts` fails the build
      on an id that resolves to nothing or to something with no map target, so a
      typo here can never become a missing chip on the phone.
   2. A place the day names but the seed does not carry is LEFT OUT — it is not
      approximated with a neighbour. Jingshan Park is not the Palace Museum;
      Jinshanling is not Mutianyu; 重庆1949's theatre is not the Chongqing Grand
      Theatre. Those lines stay bare until the place is researched, verified and
      added. A missing chip is the honest outcome.
      PHASE 2 LANDED ON 2026-07-28 and closed most of that gap: thirty new spots
      were researched, sourced and gated across two passes, so those three
      examples are now three real, separate entities and the lines that named
      them are linked below. Longkan Wharf and the Naxi Ancient Music hall,
      which the first pass missed, came in with the second.
      The rule did not change, and one place still has no chip because of it:
      the MACAU end of the HZMB bridge, whose only sourceable coordinate covers
      the combined Zhuhai + Macau complex. The Hong Kong end, which is where
      Dec 22's fallback bus actually leaves from, does open.
   3. A place named in order to say you are NOT going there does not get a chip.
      Dec 23's Yat Lok and Dec 24's Australia Dairy are both "closed today"
      notes; each is linked on the day it is actually open, and only then.
   4. Order is the DAY'S OWN order — first mention wins, and a place named twice
      in one day appears once.
   5. A day with nothing to link has NO KEY here at all, never an empty array.
      TWO days are in that state on purpose: Nov 29 (an errand day in Yantai)
      and Dec 10 (a full day on the Chongli greens, no named venue). Dec 22 was
      the third until 2026-07-28, when Macau got places of its own; it now
      carries five.

   THE CROSS-NAME LINKS — DO NOT "CORRECT" THESE
   The day text on the left, the entity id on the right. Every one of them looks
   like a mistake to a reader who only has one of the two lists:

     Forbidden City (Dec 6)        → cn26-spot-beijing-palace-museum
     Historic Centre (Dec 22)      → cn26-spot-hongkong-senado (`Senado Square`)
     The Peak (Dec 24)             → cn26-spot-hongkong-the-peak (Victoria Peak)
     Dec 24's evening            → cn26-spot-hongkong-symphony, which is now
                                     named `TST promenade · Avenue of Stars`.
                                     The id still says "symphony" and the day
                                     text no longer does: A Symphony of Lights
                                     is being RETIRED in the second half of
                                     2026, so the card was renamed to the place
                                     rather than the event. Renaming the id
                                     would have rippled through the manifest,
                                     the seed and the gate for no gain — an id
                                     is not a promise, a label is
     WinterFest (Dec 24)           → cn26-spot-hongkong-winterfest (the VENUE —
                                     the festival itself has no coordinate)
     Naxi Ancient Music (Dec 17)   → cn26-spot-lijiang-naxi-music 纳西古乐会,
                                     NOT 东巴宫 across the same street
     Yuanjiajie / Avatar (Dec 12)  → cn26-spot-zhangjiajie-yuanjiajie, which
                                     searches 阿凡达哈利路亚山 — the only name of
                                     the four the trip uses that a map resolves
     HZMB Golden Bus (Dec 22)      → cn26-spot-hongkong-hzmb-hk (the HONG KONG
                                     port; the Macau one cannot be pinned)
     Ngong Ping cable car (25)     → cn26-spot-hongkong-ngong-ping (Tung Chung,
                                     the end you board at — the upper terminal
                                     is 200 m from the Big Buddha's own chip)
     Chongqing 1949 (Dec 15)       → cn26-spot-chongqing-theatre-1949, NEVER
                                     cn26-spot-chongqing-grand-theatre
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
   terminal: Dec 11 links the PKX card, not CA8609, because they open the same
   place and two chips for one gate is noise. (It linked the PEK card until
   2026-09-27, when the Dec 11 flight moved from Capital to Daxing.)

   BEDS ARE LINKED WHERE THE DAY NAMES THEM, and only there. Checking into a
   hotel is a place you go to; sleeping in it a second night is not a line in
   the plan, and neither is checking out of one. ONE bed ships no button at all
   — Blossom House — and is simply absent even on its own arrival day. Huatian
   Grand was the second until 2026-07-28, when OpenStreetMap and the
   accommodation document's own "450 m from the Tianmen cableway" were found to
   agree on where it is; it is linked on Dec 13, the evening you move to it. */

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
     cn26-place-00, which has carried its real address since 2026-08-13 and
     still ships NO BUTTON — the address is printed for a driver, never sent to
     a map — so there is nothing here to link to. */
  '2026-11-22': ['cn26-place-01', 'cn26-place-03'],

  /* Nov 29 has no key. Its three lines are a ticket release watched from Yantai
     (the Palace Museum is NOT visited that day — Dec 6 is), a Decathlon/Uniqlo
     gear run with no named branch, and train booking. Nothing to open. */

  /* Academy → Beijing. Beijing South is the train fallback again. 曲水兰亭 (the
     midnight massage, cn26-place-06) exists as a driver card but never passed
     verification and ships no button — the 2026-07-28 re-attempt made that
     case stronger, not weaker (see coords.ts). Its FALLBACK does open: the
     same line names "Bodhi 菩提, 5-min walk" — and as of 2026-08-01 that does
     not open either. Bodhi was demoted on the phone: Amap answers 菩提 三里屯
     with the DISTRICT (see spots.ts `bodhi`). So this line names two bodywork
     rooms and neither has a pin; the chips that remain are the station, the
     bed and Sanlitun itself, which is where both of them are. */
  '2026-12-05': ['cn26-place-03', 'cn26-stay-00', 'cn26-place-04'],

  /* CROSS-NAME: "Forbidden City" is the Palace Museum 故宫博物院. The spot is
     named the way OSM answers, the day the way everyone speaks.
     Jingshan Park (line 2) arrived with Phase 2 and is linked in the day's own
     order. BODHI CAME OFF ON 2026-08-01: the phone showed Amap answering
     菩提 三里屯 with the district rather than the room (spots.ts `bodhi`), so
     line 3 keeps its name and loses its chip. Sanlitun still opens, which is
     the honest amount of help available — it is the right few streets. */
  '2026-12-06': [
    'cn26-spot-beijing-palace-museum',
    'cn26-spot-beijing-jingshan',
    'cn26-place-04',
  ],

  /* Great Wall day, and the whole point of it — Jinshanling — is a spot as of
     Phase 2. Mutianyu is still NOT substituted for it: it is a different
     section of wall 60 km away, which is the example rule 2 exists for.
     THE DAY'S THIRD CHIP LEFT AND CAME BACK ON 2026-07-28. The night's bed is
     Blossom House, which ships no button, so 后海 (cn26-place-05) is the driver
     card that stands in for it — and the gate run demoted that card for having
     no coordinate to certify 什刹海 against. The card was restored the same day
     with the coordinate it had been missing (Wikidata Q1136851, coords.ts), so
     the chip is back where the day's own order puts it: check out of Four
     Points, spend the day on the wall, get dropped at the lakes. */
  '2026-12-07': ['cn26-stay-00', 'cn26-spot-beijing-jinshanling', 'cn26-place-05'],

  /* Spa day. The clinic is the driver card the day quotes an address for
     (航空胡同42号), then the hot springs the second line names. Chunhuiyuan is
     in the seed too, but only the STOP's day-by-day text offers it as "the
     quieter alternative" — this day's own line names Jiuhua and nothing else,
     so Jiuhua is the only chip. */
  '2026-12-08': ['cn26-place-27', 'cn26-spot-beijing-jiuhua'],

  /* To Chongli. Line 1 names BOTH departure stations ("Beijing North /
     Qinghe"), and both are spots as of Phase 2 — the slash is the trip not
     having decided yet, so the row carries the choice rather than making it.
     太子城站 is the station the resort shuttle meets; Element is the bed the
     line names. 太舞滑雪小镇 (Thaiwoo, the resort Element sits inside) is
     cn26-place-25 and ships no button, so the town is not linked. */
  '2026-12-09': [
    'cn26-spot-beijing-beijing-north',
    'cn26-spot-beijing-qinghe',
    'cn26-place-08',
    'cn26-stay-02',
  ],

  /* Dec 10 has no key. "Group lesson + full practice day on the greens" names
     no venue: the day happens wherever Element's own lift pass goes, and
     guessing between Genting, Wanlong and Fulong would be inventing a plan. */

  /* THE "NOT CAPITAL" LINE — inverted on 2026-09-27. Until then this read
     "cross to PEK (Capital) — NOT Daxing" and linked the PEK card. Air China
     retimed CA1953 to 07:45 and the booking moved free onto CA8609 from DAXING,
     so the day now runs: Taizicheng (the station you leave from, named for the
     first time), Qinghe (the HSR arrival, the Phase 2 spot Dec 9 already opens),
     PKX — still the single most important place of the day, because it is the
     airport a traveller with two months of "PEK" in their head could miss —
     then the airport it lands at, and Wulingyuan, the park gate you drive on
     to. Element is NOT linked: checking out of a bed is not a place you go. */
  '2026-12-11': [
    'cn26-place-08',
    'cn26-spot-beijing-qinghe',
    'cn26-place-01',
    'cn26-place-09',
    'cn26-place-10',
  ],

  /* YUANJIAJIE OPENS NOW, under the pillar's own official name. Line 2 names
     both it and "the Avatar Hallelujah pillars", which turn out to be one
     entity: 阿凡达哈利路亚山 is what the pillar was renamed to in 2010, it is
     the only spelling of any of them that a map resolves, and OSM files it
     inside 袁家界社区 — the same neighbourhood. The Bailong Elevator is in the
     seed and is STILL deliberately not linked: the line says "on foot, NOT the
     elevator". */
  '2026-12-12': ['cn26-spot-zhangjiajie-golden-whip', 'cn26-spot-zhangjiajie-yuanjiajie'],

  /* THE BED IS THE THIRD CHIP, and it is new: Huatian Grand opened by nothing
     at all until 2026-07-28. Line 3 is a place you GO to ("Evening move to the
     city (~40 min) — Huatian Grand, 450 m from the Tianmen cableway"), which is
     the arrival-day rule exactly. 天门山 is named on the same line only as the
     LANDMARK that locates the hotel — you go there tomorrow, so tomorrow is
     where its chip is. Zhangjiajie West is named on line 4 as something to
     ARRANGE at check-in, not somewhere you stand today; it is linked on Dec 14,
     the day you are driven to it. */
  '2026-12-13': [
    'cn26-spot-zhangjiajie-tianzishan',
    'cn26-spot-zhangjiajie-yangjiajie',
    'cn26-stay-04',
  ],

  /* Tianmen, named on two consecutive lines (the ice check and the 08:00
     entry), appears once. Then the station lines 3 and 4 both point at, then
     the evening: 洪崖洞 and — new with Phase 2 — 千厮门大桥, the bridge viewpoint
     110 m from it that the "cyberpunk shot" line means. Checking OUT of Huatian
     on line 3 gets no chip: leaving a bed is not going somewhere. */
  '2026-12-14': [
    'cn26-place-11',
    'cn26-spot-zhangjiajie-zjj-west',
    'cn26-place-13',
    'cn26-spot-chongqing-qiansimen',
  ],

  /* CROSS-NAME ×4. Ciqikou is a DRIVER CARD (磁器口), not a Chongqing spot —
     the stop's spot list never carried it. "Liziba train-through-building" is
     the spot `Liziba station`, "Eling Park / Testbed 2" is the single spot
     `Eling Park & Testbed 2`, and "Chongqing 1949" — the SHOW — is the spot
     `Chongqing 1949 Grand Theatre` 重庆1949大剧院, the venue built for it out by
     Ciqikou. The Chongqing Grand Theatre 重庆大剧院 is also in the seed, is a
     different building on the other side of the city, and must NEVER be
     substituted for it: there is a ¥150 deposit riding on the right address. */
  '2026-12-15': [
    'cn26-place-14',
    'cn26-spot-chongqing-liziba',
    'cn26-spot-chongqing-eling',
    'cn26-spot-chongqing-ronghui',
    'cn26-spot-chongqing-theatre-1949',
  ],

  /* Ciqikou again ("more Ciqikou / viewpoints"), then the airport run, the
     airport you land at, and the inn that approved the 22:00–23:00 arrival. */
  '2026-12-16': ['cn26-place-14', 'cn26-place-12', 'cn26-place-15', 'cn26-stay-06'],

  /* CROSS-NAME ×2: "Baisha village" is `Baisha village & murals`, "Shuhe" is
     `Shuhe Ancient Town`. The Naxi Ancient Music concert hall arrived with the
     second Phase 2 research pass and is now the fourth chip — and WHICH venue
     it is matters: two rival ensembles face each other across 东大街, and this
     is 纳西古乐会 (Xuan Ke's), not 东巴宫 opposite. The wrong one is a wrong
     theatre at 20:00. Yue Tu appears because line 4 sends you to its DESK for
     the bag transfer — an errand at a place, not just the bed you woke up in.
     Tina's, which the same line names, is where the BAG goes today and where
     YOU go on the 19th, so its chip is on the 19th. */
  '2026-12-17': [
    'cn26-spot-lijiang-jade-dragon',
    'cn26-spot-lijiang-baisha',
    'cn26-spot-lijiang-shuhe',
    'cn26-spot-lijiang-naxi-music',
    'cn26-stay-06',
  ],

  /* The gorge. 桥头 is the trailhead card (a coordinate — its name was never
     verified, so it opens as a pin, which for a trailhead is right). Halfway
     Guesthouse is the one walk-in bed on the trip and opens by name (中途客栈).
     Tea Horse — the lunch stop — arrived with Phase 2 and comes THIRD, because
     rule 4 is the day's own order and the day writes Halfway on line 2 and the
     lunch stop on line 3, even though you walk past Tea Horse first. */
  '2026-12-18': ['cn26-place-17', 'cn26-stay-07', 'cn26-spot-gorge-tea-horse'],

  /* TINA'S LED THIS DAY FOR THREE DAYS AND NO LONGER DOES. Phase 2 rescued it
     from a bad query and OpenStreetMap answered under both names — but on
     2026-08-01 the phone was asked, and Amap has it under neither: "Tina's"
     returns Info not found, and 中峡客栈 returns Zhang Laoshi's Inn, a
     different guesthouse at the same descent. Right trail, wrong business, on
     the morning a transferred bag is waiting at one of them — so it ships no
     button (spots.ts `tinas`). What remains still covers the day: 大理古城, the
     "shared car toward Dali" destination; Yanyuan, the desk that shuts at
     23:00; and the Renmin Road food street of line 4. The seed's `The Catholic
     church on Renmin Road` is still a DIFFERENT entity — a building on that
     road, not the stalls — and still must not stand in for it. */
  '2026-12-19': [
    'cn26-place-18',
    'cn26-stay-08',
    'cn26-spot-dali-renmin-road',
  ],

  /* The longest chip row of the trip, and every one of them is on line 2 or
     later of a six-line day: the optional Erhai shore ride (three spots, in the
     order the line writes them), the station the train arrives at, Green Lake
     at dusk — CROSS-NAME, the spot is `Green Lake (Cuihu Park)` — and the
     airport hotel that lines 4 and 5 both chase. LONGKAN WHARF was bare here
     until the second Phase 2 research pass found it; it now sits third, where
     line 2 writes it, between the Xizhou ride and the Zhoucheng tea. */
  '2026-12-20': [
    'cn26-spot-dali-caicun',
    'cn26-spot-dali-xizhou',
    'cn26-spot-dali-longkan',
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

  /* MACAU — THE DAY THAT USED TO SHOW NOTHING. Until 2026-07-28 this date had
     no key at all, because a full day in another territory had not one place in
     the seed. It has five now, all spots on the HONG KONG stop (the trip has no
     Macau stop, and this is a day trip out of Hong Kong).

     They route to GOOGLE, not Amap, and that was checked rather than assumed:
     every one carries city 'Macau', which isHongKongOrMacau()'s regex matches
     directly — and the coordinate box it falls back on already contained every
     Macau coordinate researched, so nothing in geo.ts had to move. The note is
     beside the box.

     CROSS-NAME: line 2's "Historic Centre" is a UNESCO area rather than
     anything a map can open, and `Senado Square` 議事亭前地 is the square at the
     middle of it — linked before the Ruins because that is the day's own order.
     Line 1's terminal is the SHEUNG WAN end, which is the one the trip names
     ("Macau route currently sails from Sheung Wan"); Macau's own two terminals
     are spots as well but get no chip here, because the day names neither and
     nothing states which one the booked legs arrive at.
     LINE 4'S HZMB FALLBACK OPENS THE HONG KONG END, and only that end. "HZMB
     Golden Bus HK$65, 24h, no pre-book" is a bus you catch at 港珠澳大橋香港口岸,
     which has its own Wikipedia article, Wikidata item and OSM node — all three
     within 400 m. The MACAU end of the same bridge still opens nothing, because
     the only coordinate anyone could source for it covers the combined Zhuhai +
     Macau complex and would risk pinning the mainland side of a border crossing
     (spots.ts says so at length). Half a route is the honest half here: the end
     you leave from is the end you have to reach. */
  '2026-12-22': [
    'cn26-spot-hongkong-macau-ferry',
    'cn26-spot-hongkong-senado',
    'cn26-spot-hongkong-ruins-st-paul',
    'cn26-spot-hongkong-coloane',
    'cn26-spot-hongkong-lord-stows',
    'cn26-spot-hongkong-hzmb-hk',
  ],

  /* CROSS-NAME: "the races" is `Happy Valley Racecourse` 跑馬地馬場. Big Wave
     Bay and Shek O arrived with Phase 2 and sit between the hike and the races,
     in the day's own order.
     SHAU KEI WAN IS FOURTH, NOT FIRST, AND THAT IS RULE 4 DOING ITS JOB. You
     actually start the day there — bus 9 to Shek O leaves from the bay at its
     exit — but line 1 names it LAST, in a parenthesis after the lunch stop, and
     the order here is the line's order, not a re-planned itinerary. Reordering
     it would be this manifest quietly deciding how the day goes.
     YAT LOK IS DELIBERATELY ABSENT: line 3 names it only to say it is closed on
     Wednesdays. It is linked on Dec 24, when it is open — which is the whole
     argument for an explicit manifest. */
  '2026-12-23': [
    'cn26-spot-hongkong-dragons-back',
    'cn26-spot-hongkong-big-wave-bay',
    'cn26-spot-hongkong-shek-o',
    'cn26-spot-hongkong-shau-kei-wan',
    'cn26-spot-hongkong-happy-valley',
  ],

  /* CROSS-NAME ×5, and two of them are places that DO NOT EXIST as places.
     `Yat Lok · roast goose` 一樂燒鵝 and `Star Ferry · Tsim Sha Tsui pier` are
     ordinary renamings; `The Peak` searches Victoria Peak. The other two are
     events: "Symphony of Lights" is a show over the harbour and opens the
     Avenue of Stars, the promenade Wikipedia's own coordinate for it lands on;
     "WinterFest" is the Tourism Board's seasonal city-wide programme, whose
     footprint is redrawn every year, and opens Central Harbourfront Event
     Space, the venue it is anchored on. Neither event has a coordinate and
     neither ever will — do not try to pin them.
     Australia Dairy is absent for Yat Lok's reason in reverse: line 4 says it
     is closed on Thursdays, and Dec 24 is a Thursday. */
  '2026-12-24': [
    'cn26-spot-hongkong-the-peak',
    'cn26-spot-hongkong-yat-lok',
    'cn26-spot-hongkong-winterfest',
    'cn26-spot-hongkong-symphony',
    'cn26-spot-hongkong-star-ferry',
  ],

  /* CROSS-NAME ×3: "Big Buddha" is `Tian Tan Buddha` 天壇大佛, "Tai O" is
     `Tai O stilt village` 大澳, and "Ngong Ping cable car" is the spot pinned at
     the TUNG CHUNG lower terminal — the end you board at. The upper terminal is
     200 m from the Buddha, whose chip is already on this row. Lung King Heen
     leads, from line 1's brunch. Po Lin Monastery is in the seed and sits beside
     the Buddha, but the day does not name it, so it gets no chip. */
  '2026-12-25': [
    'cn26-spot-hongkong-lung-king-heen',
    'cn26-spot-hongkong-big-buddha',
    'cn26-spot-hongkong-ngong-ping',
    'cn26-spot-hongkong-tai-o',
  ],

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
    is six lines that all happen inside the academy, and the academy still ships
    no button (cn26-place-00 prints its 2026-08-13 address and searches
    nothing). There is nothing to open, and the stop's Mount Kunyu pin is the
    massif, not the school — a chip pointing at it would claim to know where the
    school is. */
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
