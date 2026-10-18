/* How each place OPENS in a map — the decision, shipped as data.

   The owner's complaint, 2026-07-25: a coordinate link drops you on a nameless
   dot. What they want is the PLACE page — photos, hours, reviews, Directions.
   Three ways to get there, in order of preference:

     via 'url'   — a share link the owner pasted from their own phone. It wins
                   over everything and is opened verbatim.
     via 'name'  — a name search. Google's Maps URLs API resolves a name to its
                   place page; Amap's POI search resolves a Chinese name exactly.
     via 'coord' — the old coordinate pin. The honest fallback for anywhere the
                   name is ambiguous or unverified: better a correct dot than
                   the wrong branch of a chain.

   `query` is the name a map search receives. Every one of them was checked
   against OpenStreetMap by `npm run verify:places` — the top hit has to land
   within POI_KM (a place a taxi must arrive at) or CITY_KM (a city/area, where
   the button is a "show me this city" gesture) of the coordinate already
   verified in coords.ts. A query that failed keeps its entry here, demoted to
   via 'coord', so the reason survives in the repo instead of in a chat log.

   `city` IS NOT OPTIONAL DECORATION. Measured 2026-07-25 across the whole
   manifest: for TWENTY of these names, dropping the city changes the province
   or the country of the answer. 大理市博物馆 alone resolves to a museum in
   OSAKA; 翠湖公园 to Taipei; "Tian Tan Buddha" to Thailand; "M+" to Belgium;
   "PMQ" to Argentina. Every one of those twenty ships a city, which is why
   none of them is wrong today. Never remove one to shorten a query.

   NOTHING here is looked up at runtime. The app ships the decision, never the
   lookup — zero runtime network stays absolute. */

/** How far the top OSM hit may sit from our coordinate before we distrust it. */
export const POI_KM = 5;
export const CITY_KM = 25;

export interface MapPlan {
  /** The name handed to a map search. Chinese on the mainland — Amap resolves
      Chinese names exactly, and an English transliteration would not. */
  query?: string;
  /** City/region context: added to the Google query, and to Amap's `city`. */
  city?: string;
  /** 'poi' → POI_KM, 'city' → CITY_KM. */
  grade?: 'poi' | 'city';
  /** What this place ships with. 'none' means the name WAS checked and the
      check failed: the entry survives for its reasoning, the app gets no
      button. A missing button is the correct behaviour, not a gap.

      'address' is the beds' case and only theirs: the owner's own
      accommodation document gives a street address for the hotel but there is
      no name any map has been shown to resolve. The app opens the ADDRESS —
      exactly what it would do if the owner typed it into the Address field
      themselves, which is where every one of these came from. */
  via: 'name' | 'coord' | 'url' | 'none' | 'address';
  /** A share link the owner supplied (via 'url'). */
  url?: string;
  /** The street address. For everything except a bed it is exactly what
      OpenStreetMap's `addressdetails` returned beside a name that passed
      verification — never composed by hand. For a bed it is the line the
      owner's accommodation document prints, transcribed verbatim (trimmed at
      ADDRESS_MAX from the big end, never reworded). It rides in the driver
      overlay and is folded into the map search behind the name. An entity with
      no address in either source simply has none. */
  address?: string;
  /** The token the top OSM hit's own name must contain, where OSM spells the
      place differently from the trip content (太子城站 → its node is "太子城").
      Defaults to `query`. A LIST where OSM carries the place under more than
      one name and Nominatim's ranking moves between them. */
  expect?: string | string[];
  /** Overrides the grade limit where the place is far from its stop ON PURPOSE
      (a bed by an airport, a landmark an hour up the coast). Always with a
      reason in `why` — this is the one knob that can hide a wrong answer. */
  nearKm?: number;
  /** The provenance of the name, and the verification outcome. */
  why: string;
}

/** Keyed by the LEGACY stop id, like STOP_COORDS. */
export const STOP_MAPS: Record<string, MapPlan> = {
  /* CHECKED AGAINST WIKIDATA AND LEFT ALONE, 2026-07-25. Q11053273 崑嵛山 sits
     0.00 km from the coordinate coords.ts pins — an independent confirmation
     that the pin is exactly where it says it is. It is NOT a rescue: the stop
     is the ACADEMY, and 昆嵛山 is the massif the academy sits under. A name
     search would open the mountain and quietly claim to be the school, whose
     address the academy has still not sent. The coordinate is the more honest
     of the two, because it claims only what it knows. */
  kunyu: {
    via: 'coord',
    why: "the academy's own address is officially pending — there is no name to search that would not be a guess; the pin stays on Mount Kunyu, which Wikidata Q11053273 confirms to 0.00 km",
  },
  beijing: { query: 'Beijing', city: 'China', grade: 'city', expect: '北京', via: 'name', why: 'the stop is the city; OSM answers 北京市, 0.3 km from our Tiananmen pin' },
  /* `chongli` LEFT ON 2026-10-17 with the stop itself (skiing dropped). Its
     replacement, `shanghai`, has NO entry: nothing in Shanghai has been
     through `verify:places`, so the stop ships no button rather than a guess. */
  zhangjiajie: { query: '武陵源', city: '张家界', grade: 'city', address: '湖南省武陵源区', via: 'name', why: 'the stop is Wulingyuan, not Zhangjiajie city 30 km SW — same name as place card 10' },
  /* NOT "Chongqing": the municipality is the size of Austria and OSM answers
     with its centroid, 137 km from where you sleep. The stop is Jiefangbei. */
  chongqing: { query: '解放碑', city: '重庆', grade: 'city', via: 'name', why: 'the stop is the Jiefangbei CBD; searching the municipality by name lands 137 km away in the countryside, which is worse than useless' },
  lijiang: { query: '丽江古城', city: '丽江', grade: 'city', address: '云南省古城区丽江古城', via: 'name', why: 'the stop is the old town — same name as place card 16' },
  gorge: {
    via: 'url',
    /* Pasted by the owner on 2026-07-25 from their phone. It resolves to
       google.com/maps/place/Tiger+Leaping+Gorge+Scenic+Spot,+Shangri-La+City,…
       — the real place page, which is exactly what they asked the buttons to
       produce. THE ONLY saved link in the seed: no other share link exists. */
    url: 'https://maps.app.goo.gl/fHfSus2NQN8NmxKcA',
    why: 'the owner pasted this share link — it opens the Tiger Leaping Gorge Scenic Spot place page',
  },
  dali: { query: '大理古城', city: '大理', grade: 'city', via: 'name', why: 'the stop is the ancient city, NOT Xiaguan 13 km south — same name as place card 18' },
  /* The English "Cuihu Park" is unknown to OSM; the Chinese name is exact. */
  kunming: { query: '翠湖公园', city: '昆明', grade: 'city', address: '云南省昆明市五华区华山街道', via: 'name', why: 'the stop is the Green Lake area; 翠湖公园 lands 0.1 km from the coordinate coords.ts verified, where the English name found nothing at all' },
  hongkong: { query: 'Tsim Sha Tsui', city: 'Hong Kong', grade: 'city', expect: '尖沙咀', address: '香港尖沙咀', via: 'name', why: 'Hong Kong is English-speaking and off the GCJ-02 datum; the stop is the TST harbourfront (OSM answers in Chinese, 尖沙咀)' },
};

/** Keyed by the ShowCard id, like PLACE_COORDS. Queries are the card's own
    `native` string — the Chinese a driver already reads off the screen — so
    nothing new is invented here. */
export const PLACE_MAPS: Record<string, MapPlan> = {
  'cn26-place-01': { query: '北京大兴国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-02': { query: '北京首都国际机场', city: '北京', grade: 'poi', address: '顺义区四纬路', via: 'name', why: "the card's name without its '3号航站楼' suffix — OSM has the airport, not the single terminal" },
  'cn26-place-03': { query: '北京南站', city: '北京', grade: 'poi', address: '丰台区右安门街道南站幸福路', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-04': { query: '三里屯', city: '北京', grade: 'poi', via: 'name', why: "the card's own Chinese name; the city disambiguates" },
  /* REPOINTED 2026-07-26 with the bed. The card used to read 宝钞胡同 — the
     hutong of a hotel that is no longer booked — and its coordinate went with
     it. The card now reads 后海, the lakes Blossom House sits on, and the query
     is 什刹海: the lake district 后海 is one of the three lakes of, already
     shipping as a verified Beijing spot (spots.ts `shichahai`) with the address
     OSM handed back beside it. 后海 itself has never been through the gate, so
     it is not what gets searched. */
  /* DEMOTED AND RESTORED ON THE SAME DAY, 2026-07-28, and the round trip is
     worth keeping because the demotion was RIGHT and the remedy was WRONG.

     THE DEMOTION. The gate run found 什刹海 answering correctly — 什刹海,
     地安门外大街, 什刹海街道, 东城区, 北京市, with Wikidata Q1136851 agreeing it
     is the lake district — and demoted it anyway, because §0's rule is that the
     top OSM hit must land within POI_KM of a coordinate verified INDEPENDENTLY,
     and card 05 had carried none since 2026-07-26, when the 宝钞胡同 pin left
     with the hotel it belonged to. With no yardstick the distance half of the
     check cannot run at all, so `verify:places` reported "nothing of ours to
     compare it against". That reasoning stands: a name this repo cannot check
     does not ship, however right the answer looks.

     THE RESTORATION, and why taking the button away was the wrong fix. A card
     with no coordinate has two possible remedies — remove the button, or give
     it the coordinate — and the run took the one that loses something. The
     owner sourced the missing yardstick from WIKIDATA, which is independent of
     OpenStreetMap and therefore exactly what the rule asks for: Q1136851 什刹海
     at 39.9380/116.3871, now in coords.ts with its citation. The check runs and
     passes at 0.34 km. Nothing about the discipline was bent; the card simply
     stopped failing a test it had never been given the means to sit.

     AND THE DEMOTION WAS INCONSISTENT AS WELL AS LOSSY: 后海 is a DRIVER CARD,
     the hold-this-up-to-a-taxi surface, where a button is worth most, and the
     identical query was still shipping on the Beijing stop (spots.ts
     `shichahai`, 3.63 km) all along. The same string opened from one surface
     and not another. That is not a safety margin. */
  'cn26-place-05': { query: '什刹海', city: '北京', grade: 'poi', address: '东城区什刹海街道什刹海地安门外大街', via: 'name', why: "the card reads 后海; 什刹海 is the lake district it belongs to and the name OpenStreetMap answers (什刹海, 地安门外大街, 什刹海街道, 东城区). DEMOTED on 2026-07-28 for having no coordinate to certify that answer against, and RESTORED the same day with the coordinate instead — Wikidata Q1136851, sourced independently of OSM and recorded in coords.ts, which the OSM hit lands 0.34 km from. The same query also passes on the Beijing stop as spots.ts shichahai" },
  'cn26-place-07': { query: '北京按摩医院', city: '北京', grade: 'poi', address: '西城区新街口街道宝产胡同', via: 'name', why: "the card's own Chinese name" },
  /* 'cn26-place-08' (太子城站) left on 2026-10-17 — the card is `gone` with skiing. */
  /* RESCUED BY WIKIDATA, 2026-07-25. The card shipped the airport's colloquial
     name, 张家界荷花机场 — and OpenStreetMap has never carried that spelling:
     bare it answers with a shopping centre in Shijiazhuang 1,062 km north, and
     with the city it answers nothing at all, so the entry was demoted to a
     coordinate. Wikidata Q1134280 gives the airport's FULL name,
     张家界荷花国际机场 (IATA DYG, and its P625 sits 0.01 km from the coordinate
     coords.ts had already verified independently). Asked again under that
     name, OSM answers at once: the aeroway node 张家界荷花国际机场, 0.17 km from
     our pin, its own name matching — both gates passed, address and all. One
     missing character was the whole problem. */
  'cn26-place-09': { query: '张家界荷花国际机场', city: '张家界', grade: 'poi', address: '湖南省张家界市南庄坪街道牛儿岗机场路', via: 'name', why: "the airport's canonical name from Wikidata Q1134280 — the card's own 张家界荷花机场 is missing 国际 and OSM does not carry it, while the full name lands 0.17 km from the verified DYG coordinate" },
  'cn26-place-10': { query: '武陵源', city: '张家界', grade: 'poi', address: '湖南省武陵源区', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-11': { query: '天门山', city: '张家界', grade: 'poi', nearKm: 10, via: 'name', why: "the card's own Chinese name; there is more than one 天门山 in China, so the city matters. OSM's node is the SUMMIT, 7.2 km from our coordinate, which is the cableway station down in town — the same mountain, and either end is a correct answer for a driver" },
  'cn26-place-12': { query: '重庆江北国际机场', grade: 'poi', via: 'name', why: "the card's name without its 'T3' suffix" },
  'cn26-place-13': { query: '洪崖洞', city: '重庆', grade: 'poi', address: '重庆市渝中区朝天门街道沧白路', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-14': { query: '磁器口', city: '重庆', grade: 'poi', address: '重庆市沙坪坝区童家桥街道磁童路', via: 'name', why: "the card's own Chinese name; Nanjing has a 磁器口 too" },
  'cn26-place-15': { query: '丽江三义国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-16': { query: '丽江古城', city: '丽江', grade: 'poi', address: '云南省古城区丽江古城', via: 'name', why: "the card's name without its '大研' suffix" },
  /* DEMOTED after verification, and WIKIDATA COULD NOT RESCUE IT. OSM answers
     虎跳峡镇 with a development-zone node 15.4 km from the trailhead. Wikidata
     Q5950807 confirms the place is real and that our pin is right — its
     coordinate is 0.09 km from ours — but its canonical name is 虎跳峡镇, the
     very name OSM misplaces. There is no third name to try, so the coordinate
     stays. (The stop itself opens the share link the owner pasted.) */
  'cn26-place-17': { query: '虎跳峡镇', city: '香格里拉', grade: 'poi', via: 'coord', why: 'the Qiaotou town seat — OSM resolves that name to 香格里拉经济开发区, 15.4 km up the valley, and Wikidata Q5950807 offers no other name (it confirms our pin to 0.09 km), so the card keeps its verified trailhead pin' },
  'cn26-place-18': { query: '大理古城', city: '大理', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-19': { query: '昆明南站', city: '昆明', grade: 'poi', expect: '昆明南', address: '云南省呈贡区洛龙街道联大街', via: 'name', why: "the card's own Chinese name; OSM's station node is spelled 昆明南, 30 m away" },
  'cn26-place-20': { query: '昆明长水国际机场', city: '昆明', grade: 'poi', address: '云南省昆明市官渡区长水街道机场东路', via: 'name', why: "the card's own Chinese name" },
  /* NOT RESCUED. Wikidata Q11152833 is 深南路 — the road, with no coordinate of
     its own, which is the same answer as OSM's: a 25 km line, not a door. A
     street number can only be a coordinate. */
  'cn26-place-24': { query: '深南大道', city: '深圳', grade: 'poi', via: 'coord', why: 'the card is a street NUMBER (深南大道2003号); the road itself runs 25 km, and Wikidata Q11152833 深南路 carries no coordinate at all — see the verify:places run' },
  /* ADDED 2026-07-26 with the new beds. Card 25 (太舞滑雪小镇) gets NO entry at
     all: OSM carries neither that name nor "Thaiwoo Ski Resort" (spots.ts
     `thaiwoo`, rejected 2026-07-25), and this pass could not re-run
     verify:places to look for a third spelling. The card is still worth
     shipping — a driver reads it — it simply opens nothing. */
  /* DEMOTED AND RESTORED ON 2026-07-28, card 05's story exactly — except that
     this entry had ALREADY WRITTEN DOWN the assumption that got tested. It
     shipped on 2026-07-26 saying "it has no coordinate of its own here, so it
     opens by name alone", borrowing the Chongqing stop's verification, and the
     first gate run that could check that borrowing rejected it. That was
     correct: a certificate belongs to the entity it was issued to, and a card
     cannot inherit another one's.

     WHAT THE DEMOTION COST WAS CONSISTENCY, NOT SAFETY. The name was never in
     doubt — OSM answers 解放碑, 解放碑街道, 渝中区, 重庆市 — and the Chongqing STOP
     ships the IDENTICAL query 解放碑 and passed the same run at 0.01 km. So one
     string opened from the city page and not from the driver card, which is the
     card a taxi is shown. Two surfaces disagreeing about one name is a defect,
     not a margin.

     RESTORED BY GIVING THE CARD WHAT IT LACKED. Wikidata Q6683399
     抗战胜利纪功碑暨人民解放纪念碑, sourced by the owner independently of OSM and
     now in coords.ts against this card's own id. It is the same value the stop
     cites, and deliberately so: the card stops borrowing a certificate and
     holds one. Grade stays 'city' — 解放碑 names the CBD as much as the
     monument, and CITY_KM is the honest limit for that. */
  'cn26-place-26': { query: '解放碑', city: '重庆', grade: 'city', via: 'name', why: "the card's own Chinese name. It had been borrowing the Chongqing stop's verification, which the gate rejected on 2026-07-28 — a card with no coordinate cannot inherit one — and it was RESTORED the same day with a coordinate of its own instead: Wikidata Q6683399 抗战胜利纪功碑暨人民解放纪念碑, the item coords.ts already cited for the stop, now cited for this card too. OSM's 解放碑 lands 0.01 km from it, and the stop ships the identical query" },
  /* ADDED 2026-07-26 for the Dec 8 bone-setting appointment. Checked by hand
     against Nominatim with the same query and the same POI_KM gate that
     `verify:places` applies: 护国寺中医医院 answers at 棉花胡同, 什刹海街道,
     西城区 — 344 m from the coordinate in coords.ts, well inside 5 km.

     THE ADDRESS HERE HAS A PROVENANCE THIS FILE HAS NOT USED BEFORE, and the
     difference is the whole point. Every other address in this repo came out of
     OSM's own `addressdetails`; OSM's answer for this name is the INPATIENT
     campus, which is the wrong gate to be dropped at. The hospital runs 一院三址
     and its 骨伤科 outpatient clinic is at 航空胡同42号 (☎ 56895700) per the
     Xicheng District Government's own listing, bjxch.gov.cn/xxgk/xxxq/
     pnidpv927322.html. So the name and the address deliberately point 344 m
     apart: the name is what a map and a taxi driver both recognise, the address
     is which of the three gates to walk to. Do not "fix" one to match the
     other, and do not fold the address into the search — 胡同 numbering is
     exactly the kind of street data that buried 北京南站. */
  'cn26-place-27': { query: '护国寺中医医院', city: '北京', grade: 'poi', address: '北京市西城区航空胡同42号', via: 'name', why: "the hospital's own name, which Nominatim resolves 344 m from our coordinate. It ships via name and not via coord because the campuses are 344 m apart and a dot would commit to the wrong one; the outpatient address rides alongside, from the district government rather than from OSM" },
};

/** Keyed by the BOOKING id the transform assigns to each bed
    (`cn26-stay-00`…`-10`).

    REWRITTEN 2026-07-26, when the owner replaced ten of the eleven beds. The
    single source for all of it is
    `sources/china-2026/accommodation-2026-07-25.md` — the authority document
    for beds — and the rule it is read under has not changed:

    NOTHING HERE HAS A COORDINATE, EVER. Not even where the document prints one
    (it gives 25.6957 / 100.1537 for the Dali retreat): a bed opens by something
    the owner can read and check, never by a dot this repo would then have to
    defend. Hotel names are also the hardest names in the trip — a brand
    resolves to the wrong branch, a guesthouse is not in OpenStreetMap at all —
    and this rewrite could not re-run `verify:places`, so NOT ONE new name is
    claimed here.

    What DID arrive with the new beds is street addresses: six of the eleven
    printed one in the document, and Four Points made it SEVEN on 2026-07-27
    when it was booked and its confirmation printed the address the document
    had told us to go and get. Two more bookings the same day did not change
    the count but did change the provenance: Element Chongli's confirmation
    reprints the address the document already had, and The Royal Garden's
    direct booking prints a fuller one that replaces the document's short line.

    THE LAST TWO BEDS WERE BOOKED ON 2026-07-27 AND THE COUNT WENT TO EIGHT.
    DALI gained one: its document entry had verified coordinates and no street
    at all, and its Booking.com confirmation printed one, so the Four Points
    case repeated — a confirmation supplies what the document never had. The
    coordinate is still not shipped, because a bed never ships a dot. KUNMING
    did NOT move: its Trip.com order prints a fuller address that is not a
    superset of the document's, and adopting it would cost the word "Kunming"
    at ADDRESS_MAX. Eight addresses now; two beds still ship nothing.

    THREE MORE BEDS WERE BOOKED ON 2026-07-27 AND THE COUNT STILL DID NOT MOVE,
    for three different reasons. Pullman's Agoda confirmation prints the address
    MISSPELLED (GADYUN for Gaoyun), so the document's spelling is kept and the
    confirmation is treated as the corrupted copy. Huatian's Trip.com booking
    prints no address at all, so it stays in the silent set. Glenview's prints
    none either, so its document line stands unchallenged. Seven addresses,
    before and after — but every one of them now has a reason written beside it
    for why booking did not change it.

    Those ship as `via: 'address'`, which is exactly
    what the owner typing the address into the Address field produces — the app
    searches that address, and the driver overlay shows it. A missing button is
    the correct behaviour, not a gap: the stop and the driver cards still open
    the district each bed is in.

    ONE BED CHANGED SIDES ON 2026-07-28, AND IT IS THE FIRST EVER PROMOTED ONTO
    A NAME. Huatian Grand (cn26-stay-04) is now `via: 'name'` — see the block
    above it for why, and for why the rule it bends did not simply break: it
    took OpenStreetMap knowing the property under its own Chinese name AND the
    accommodation document's own "450 m from the Tianmen cableway" landing on
    the same spot, from a coordinate this repo had verified months earlier for
    something else. One source would not have been enough, and no coordinate is
    shipped even now.

    So the count today is EIGHT addresses, TWO names (the gorge guesthouse and
    Huatian) and ONE bed that still ships nothing at all — Blossom House, whose
    2026-07-28 re-attempt is written up beside it and made the case weaker, not
    stronger. */
export const STAY_MAPS: Record<string, MapPlan> = {
  /* PROMOTED 2026-07-27, the day the bed was booked. The document used to say
     the opposite — "Verify exact address at booking. Not on Booking.com." —
     and that instruction has now been carried out: the Trip.com confirmation
     prints the address, and the accommodation document records it. So this is
     the ordinary bed case after all, not the empty one: the owner's own
     paperwork gives a street and no name a map has been shown to resolve.
     Still NO name and NO coordinate — the brand resolves to the wrong Four
     Points, and a bed never ships a dot. */
  'cn26-stay-00': {
    address: 'No. 20 Gongti East Road, Chaoyang District, Beijing, China',
    via: 'address',
    why: "Four Points by Sheraton Beijing Sanlitun Workers Stadium — the address confirmed on the owner's own Trip.com booking, transcribed verbatim (58 chars, inside ADDRESS_MAX). The name stays out of the search: Four Points is a chain and this repo has never put the property through verify:places. 三里屯 (place card 04) still opens the district",
  },
  /* Blossom House still prints no address — the checkout page named a district
     and a landmark, not a street.

     RE-ATTEMPTED 2026-07-28 AND DELIBERATELY NOT PROMOTED, which is worth more
     written down than a second silent failure. Nothing resolves for the hotel:
     not "Blossom House", not 花间堂 (its Chinese hotel-brand name), not
     花间堂北京店, not any of them combined with 什刹海 / 恭王府 / 北京, and there
     is no Wikidata item for it at all.

     WHAT DID RESOLVE IS THE STREET, AND IT CHECKS OUT. 羊房胡同 — the hutong the
     booking sites name — is an OSM way at 39.9403/116.3755 in 什刹海街道,
     西城区, and it sits 0.53 km from Prince Kung's Mansion (恭王府, Wikidata
     Q2666344), which corroborates the listings' "5-minute walk from Prince
     Kung's Mansion" almost exactly. That is an ADDRESS being confirmed, not a
     hotel being found.

     AND IT STILL DOES NOT SHIP, because a hutong is not a door. There is a
     precedent for anchoring on a street in this repo — cn26-place-27 is pinned
     on 航空胡同 rather than on the clinic's own entrance — and it does not
     transfer: that anchor exists to give a VERIFIED NAME something to be
     measured against, and the button there still searches the hospital's name.
     Here there is no name at all, so the street would BE the answer: a whole
     hutong offered as a hotel, with OSM carrying no node for house number 9 on
     it. A wrong pin is worse than no pin, and the missing button stays. */
  'cn26-stay-01': { via: 'none', why: "Blossom House Prince Kung's Mansion · Beijing Houhai — BOOKED 2026-07-27, and the confirmation still gives a district rather than a street; no map has been shown to resolve the name either, and the 2026-07-28 re-attempt found only its hutong (羊房胡同, 0.53 km from 恭王府 — the listings' 5-minute walk, confirmed), which is a street and not a door. 后海 (place card 05) opens the lakes it sits on. The moment an address arrives, typing it into the app's Address field is all this bed needs" },
  /* cn26-stay-02, Element Chongli, opened by its address ('Block I, Thaiwoo
     Ski Resort & Alpine Park, Sitaizui County') from 2026-07-27 until
     2026-10-17, when the owner CANCELLED it on Agoda (skiing dropped). A
     cancelled bed is not somewhere to go, so it opens nothing; the entry is in
     git history (b35b3c8). */
  /* BOOKED 2026-07-27 on Agoda, and the address DELIBERATELY DID NOT MOVE. The
     confirmation prints "NO. 188 GADYUN ROAD WULINGYUAN, ZHANGJIAJIE, China
     427400" — and GADYUN is Agoda's misspelling of Gaoyun, the spelling the
     accommodation document has carried since 2026-07-25. A map search for a
     street that does not exist is worse than no button at all, so the document's
     spelling stays and the confirmation is treated as the corrupted copy.
     The postcode 427400 IS new and is recorded in the document and on the bed's
     note, but it is NOT appended here: this file's rule is that an address is
     transcribed verbatim from ONE source, never assembled from two, and a
     hand-built hybrid of a document line and a confirmation's tail is exactly
     the composed address the rest of this file refuses to ship. */
  'cn26-stay-03': {
    address: 'No. 188 Gaoyun Road, Wulingyuan',
    via: 'address',
    why: "Pullman Zhangjiajie — the accommodation document's own address line, kept UNCHANGED when the bed was booked because the Agoda confirmation misspells the street as \"GADYUN ROAD\". 武陵源 (place card 10) is the town; this is the door. The brand name stays out of the search: Pullman is an Accor chain and this repo has never put the property through verify:places",
  },
  /* PROMOTED 2026-07-28 — the first bed this repo has ever MOVED onto a name.
     The gorge guesthouse has always opened by one, but it arrived that way and
     was only ever left alone; nothing here has been promoted before, so the
     exception has to be argued rather than assumed. The rule above is that a
     bed's location comes from the owner's own booking document or from nowhere
     at all, and the reasons are good ones: a brand resolves to the wrong
     branch, a guesthouse is not in OpenStreetMap, and no rewrite of this file
     has ever been allowed to claim a hotel name.
     Huatian is different for two INDEPENDENT reasons, and it needed both.

     1. OPENSTREETMAP KNOWS IT UNDER ITS OWN CHINESE NAME. 华天大酒店, 张家界
        answers with a tourism node in 官黎坪街道, 永定区, 张家界市 at
        29.11767/110.47659 — the property itself, not a brand landing page and
        not a different city's Huatian.
     2. THE TRIP'S OWN PAPERWORK CORROBORATES THAT PIN, FROM THE OTHER SIDE.
        The accommodation document says the hotel is "450 m from the Tianmen
        cableway", and the cableway's lower station was verified independently
        long before this — it is the coordinate coords.ts carries for
        cn26-place-11 (29.1149/110.4784). The OSM node lands 0.36 km from it.
        Two sources that have never met agree, and they agree with a distance
        the document had already committed to in writing.

     WHAT HAS NOT CHANGED: no coordinate is shipped, because a bed never ships a
     dot — booked or not, corroborated or not. And the Trip.com booking still
     prints no street, so there is no address either. The name is the whole of
     it, which is exactly why it had to be verified twice before it could go in.

     The yardstick this is measured against is the WULINGYUAN stop pin, and the
     hotel is 26 km south-west of it, down in Zhangjiajie city — which is the
     entire point of the Dec 13 evening move. Hence nearKm 30, the same kind of
     override the gorge guesthouse carries for the same kind of reason. */
  'cn26-stay-04': {
    query: '华天大酒店',
    city: '张家界',
    expect: '华天大酒店',
    nearKm: 30,
    via: 'name',
    why: "Huatian Grand Hotel 张家界华天大酒店 — the one bed whose own name OpenStreetMap resolves: 华天大酒店, 张家界 answers 0.36 km from the Tianmen cableway coordinate already verified for place card 11, and the accommodation document's own '450 m from the Tianmen cableway' says the same thing independently. BOOKED 2026-07-26 on Trip.com with no address printed, so the name ships alone — no street, and no coordinate, because a bed never ships a dot. The token drops the city prefix so that either spelling OSM files it under, 华天大酒店 or 张家界华天大酒店, is a pass",
  },
  'cn26-stay-05': {
    address: 'No. 66 Qingnian Road, Yuzhong District',
    via: 'address',
    why: "Glenview ITC Plaza — the accommodation document's own address line, unchanged by the 2026-07-26 Trip.com booking, which printed no address of its own to compare it with. 解放碑 (place card 26) is the monument 390 m away; this is the tower",
  },
  /* BOOKED 2026-07-27 on Booking.com, and the address DID NOT MOVE — this time
     because the confirmation agrees with it. The page prints "No.43 Yizheng
     Jinjia Street, Dayan Ancient Town, 674100 Lijiang, China", whose street line
     is the line below verbatim; that agreement is what confirms the booking is
     for the property this file already had. The POSTCODE 674100 is new, and it
     is recorded in the accommodation document and on the bed's note but NOT
     appended here — same judgment as Pullman: an address is transcribed
     verbatim from ONE source, never assembled from two. The difference between
     the two beds is only which source won; the rule is the same. */
  'cn26-stay-06': {
    address: 'No. 43 Yizheng Jinjia Street, Dayan Ancient Town',
    via: 'address',
    why: "Lijiang Yue Tu Inn — the accommodation document's own address line, CONFIRMED unchanged by the Booking.com confirmation of 2026-07-27, which prints the same street and adds only a postcode. The old Mama Naxi name search is gone with the bed; 丽江古城 大研 (place card 16) still opens the old town around it",
  },
  /* UNCHANGED — the one bed the owner did not replace, and the one whose name
     a map resolves. Verified 2026-07-25, left exactly as it was. */
  'cn26-stay-07': { query: '中途客栈', city: '香格里拉', grade: 'city', nearKm: 30, via: 'name', why: 'the English name finds nothing; 中途客栈 is what the guesthouse is called on the trail. It sits halfway ALONG the gorge, well east of the Qiaotou stop pin' },
  /* PROMOTED 2026-07-27, the day the bed was booked, and it is the FOUR POINTS
     case rather than the Yue Tu one. The accommodation document gave this bed
     verified COORDINATES (25.6957 / 100.1537) and NO street address at all, so
     there was no document line to preserve and nothing to assemble a hybrid
     from: the Booking.com confirmation is the ONE source, and its address line
     is transcribed verbatim, 57 chars, inside ADDRESS_MAX.

     THE POSTCODE STAYS IN, and that is not a contradiction of Pullman's and Yue
     Tu's rule. There the postcode was the SECOND source being appended to a
     document line — assembly, which this file refuses. Here it is part of the
     single line being copied, and cutting it out would also cut out the word
     "Dali": the components after the street are "671003 Dali, China", and this
     file's own measured rule is that dropping the city can change the province
     or the country of the answer. A verbatim line that names the city beats a
     hand-trimmed one that does not.

     The coordinate is STILL not shipped. A bed never ships a dot, booked or
     not — that rule did not soften when the address arrived. */
  'cn26-stay-08': {
    address: 'No.133, Yinxian Road, Shuidui Village, 671003 Dali, China',
    via: 'address',
    why: "Dali Yanyuan Mountain Retreat 大理晏清山居客栈 — the address printed on the owner's own Booking.com confirmation of 2026-07-27, transcribed verbatim; the accommodation document had only coordinates, which a bed never ships. The name stays out of the search: no map has been shown to resolve it and this pass could not re-run verify:places. 大理古城 (place card 18) still opens the old city it is 790 m from",
  },
  /* BOOKED 2026-07-27 on Trip.com, and the address DELIBERATELY DID NOT MOVE —
     a third reason, different from Pullman's typo and Yue Tu's agreement. The
     order prints "Building 1, Changshui Hangcheng Yunlifang, Guandu District,
     Kunming, Yunnan, China": the same place, with the district and city added
     and the UNIT dropped, and reordered. Neither line contains the other, so
     there is no superset to prefer the way Element's and the Royal Garden's
     bookings offered one — and composing "Unit 1-1 … Guandu District" out of
     both would be exactly the hand-assembled address this file refuses.

     So one of the two ships whole, and it is the document's. The confirmation's
     line is 82 characters; at ADDRESS_MAX it would have to be trimmed from the
     big end, which deletes "Kunming" — the city, the one component this file
     has measured as load-bearing. Trading a unit number for a district while
     losing the city is not an improvement. The confirmation's fuller printing
     is recorded on the bed's note instead, where nothing about it is lost. */
  'cn26-stay-09': {
    address: 'Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng',
    via: 'address',
    why: "Ibis Kunming Changshui International Airport Hotel — the accommodation document's own address line, KEPT UNCHANGED when the bed was booked: the Trip.com order's version adds the district but drops the unit and would lose the word Kunming to the ADDRESS_MAX trim. 昆明长水国际机场 (place card 20) is the terminal 3.4 km away, which the free transfer covers; this is the hotel",
  },
  /* UPGRADED 2026-07-27, when the bed was booked DIRECT with the hotel. The
     document's short line is replaced by the one the hotel's own confirmation
     prints — same street, spelled the way the hotel spells it, with the
     district and the territory it left out. 50 chars, inside ADDRESS_MAX.
     Hong Kong is off the GCJ-02 datum and `isHongKongOrMacau` sends it straight
     to Google Maps (ARCHITECTURE §9a rule 4), which is exactly where a Kowloon
     street address resolves; no name is claimed and no coordinate is shipped. */
  'cn26-stay-10': {
    address: '69 Mody Road, Tsimshatsui East, Kowloon, Hong Kong',
    via: 'address',
    why: "The Royal Garden Tsim Sha Tsui — the address printed on the owner's own direct booking with the hotel, which supersedes the accommodation document's shorter line. The old Salisbury Road search belonged to a hotel that is no longer booked; Mody Road is a different street, in TST East",
  },
  /* cn26-stay-11 (the academy) and cn26-stay-12 (the Muping night, booked
     2026-09-28) have NO entry. The Muping bed's Trip.com confirmation prints a
     street — No. 460 Moushan Road, Muping District, Yantai — but it follows the
     Blossom House rule, not the Four Points one: every address this app opens
     was fired at Amap on the phone first, and this one has not been. It rides
     on the bed's note, with the Chinese name, for the driver's eyes. */
};

/** Airports the trip uses that have NO driver card, keyed by IATA. The six
    mainland ones already have cards (PKX·01, PEK·02, DYG·09, CKG·12, LJG·15,
    KMG·20) and the flights borrow the card's own verified name. */
export const AIRPORT_MAPS: Record<string, MapPlan> = {
  TLV: { query: 'Ben Gurion Airport', city: 'Israel', grade: 'poi', via: 'name', why: 'the departure airport of EY608; the flight card already spells it "TLV Ben Gurion"' },
  AUH: { query: 'Zayed International Airport', city: 'Abu Dhabi', grade: 'poi', address: 'Al Mireef Street, Al Raha, 阿布扎比, 阿布扎比酋长国', via: 'name', why: 'the departure airport of EY888 and EY609; renamed from Abu Dhabi International in 2024' },
  HKG: { query: 'Hong Kong International Airport', city: 'Hong Kong', grade: 'poi', expect: '香港國際機場', address: '香港大嶼山赤鱲角航天城路', via: 'name', why: 'the departure airport of EY871; OSM answers in Chinese' },
};
/* YNT (Yantai Penglai) IS DELIBERATELY ABSENT, 2026-09-28. CA1560 leaves from
   it on Dec 5 and the flight card therefore draws no map button: the airport
   has no driver card and its name has never been through verify:places, and a
   wrong pin is worse than no pin. It costs nothing on the day — the academy's
   own driver takes you there. Add it here (with an AIRPORT_COORDS entry and a
   verify:places run) if that ever changes; the parity gate names it as the one
   departure airport allowed to open nothing. */

/* NO ENTRY AT ALL — these six have no coordinate either, so no button renders
   and there is nothing to decide:
     cn26-place-00  the academy. The address arrived on 2026-08-13 off the
                    school's own website footer, and the card prints it — but
                    no query is sent: 昆嵛山自然保护区 names a conservation
                    district, which OSM would answer as an AREA rather than as
                    the school, and this repo does not search a name until
                    `verify:places` has checked it against a coordinate. The
                    address is for the driver's eyes, not for a map.
     cn26-place-06  曲水兰亭 — collides with a resort and a hotel brand, and the
                    2026-07-28 re-attempt PROVED the collision instead of
                    clearing it: scoped to 北京, Nominatim answers with a
                    residential development in QINGDAO, 500+ km east. Full
                    write-up at the foot of coords.ts.
     cn26-place-21  象山腊排骨 · 22 胡师傅三下锅 · 23 滟设火锅 — restaurants that
                    exist only in Chinese map services, on the GCJ-02 datum.
     cn26-place-25  太舞滑雪小镇 — OSM has neither the Chinese name nor "Thaiwoo
                    Ski Resort" (spots.ts, 2026-07-25). Added 2026-07-26 for the
                    driver, not for the map. `gone` since 2026-10-17 (skiing
                    dropped) — no longer in the seed at all.
   Sending a name search for any of them would risk the wrong branch of a
   chain, which is worse than no button. */
