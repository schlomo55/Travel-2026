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
  /* PROMOTED 2026-07-25, on evidence from both sources. This entry had been
     demoted to a coordinate by an earlier verify:places run. It now passes
     cleanly: OSM answers 太子城, 崇礼 1.22 km from the coordinate coords.ts
     verified, with the hit's own name matching; Wikidata Q13902043 太子城村 sits
     0.65 km from the same pin. The identical query has been shipping as a name
     search on the Chongli BED (cn26-stay-02) all along, so this is the stop
     catching up with what the app already sends, not a new risk. */
  chongli: {
    query: '太子城',
    city: '崇礼',
    grade: 'city',
    expect: '太子城',
    via: 'name',
    why: 'Taizicheng, the Olympic ski cluster you sleep and ski in (coords.ts) — OSM lands 1.22 km from our pin and Wikidata Q13902043 太子城村 0.65 km, and the same name already ships on the bed booked here',
  },
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
  'cn26-place-05': { query: '什刹海', city: '北京', grade: 'poi', address: '东城区什刹海街道什刹海地安门外大街', via: 'name', why: "the card reads 后海; 什刹海 is the lake district it belongs to and the name that verified (spots.ts shichahai), so that is what the button searches" },
  'cn26-place-07': { query: '北京按摩医院', city: '北京', grade: 'poi', address: '西城区新街口街道宝产胡同', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-08': { query: '太子城站', city: '张家口', grade: 'poi', expect: '太子城', via: 'name', why: "the card's own Chinese name; OSM's node for the station is spelled 太子城, 60 m away" },
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
  'cn26-place-26': { query: '解放碑', city: '重庆', grade: 'city', via: 'name', why: "the card's own Chinese name, and the identical query already ships on the Chongqing stop, where it verified 2026-07-25. It has no coordinate of its own here, so it opens by name alone" },
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
    print one in the document. Those ship as `via: 'address'`, which is exactly
    what the owner typing the address into the Address field produces — the app
    searches that address, and the driver overlay shows it. The other five ship
    NOTHING, and the reason is written beside each one. A missing button is the
    correct behaviour, not a gap: the stop and the driver cards still open the
    district each bed is in. */
export const STAY_MAPS: Record<string, MapPlan> = {
  /* The document gives no address for this one — it says the opposite:
     "Verify exact address at booking. Not on Booking.com." */
  'cn26-stay-00': { via: 'none', why: 'Four Points by Sheraton Sanlitun Workers Stadium — the accommodation document has NO address for it and says to verify one at booking, so there is nothing honest to open. 三里屯 (place card 04) opens the district it is in' },
  /* Blossom House prints no address either — only "Beijing, Houhai / Gulou". */
  'cn26-stay-01': { via: 'none', why: 'Blossom House Houhai — the accommodation document gives a district, not an address, and no map has been shown to resolve the name. 后海 (place card 05) opens the lakes it sits on' },
  'cn26-stay-02': {
    address: 'Block I, Thaiwoo Ski Resort & Alpine Park, Sitaizui County',
    via: 'address',
    why: "Element by Marriott — the accommodation document's own address line, trimmed of its last component (Yingcha Village) to stay inside ADDRESS_MAX. The name is no help: OSM carries neither 太舞滑雪小镇 nor \"Thaiwoo Ski Resort\" (see spots.ts, rejected 2026-07-25), so the street is the only thing that opens",
  },
  'cn26-stay-03': {
    address: 'No. 188 Gaoyun Road, Wulingyuan',
    via: 'address',
    why: "Pullman Zhangjiajie — the accommodation document's own address line. 武陵源 (place card 10) is the town; this is the door",
  },
  /* Huatian prints a district and a distance, not an address. */
  'cn26-stay-04': { via: 'none', why: 'Huatian Grand Hotel — the accommodation document places it 450 m from the Tianmen cableway but gives no address, and the old cableway entry belonged to a different, unnamed hotel. 天门山 (place card 11) opens the cableway itself' },
  'cn26-stay-05': {
    address: 'No. 66 Qingnian Road, Yuzhong District',
    via: 'address',
    why: "Glenview ITC Plaza — the accommodation document's own address line. 解放碑 (place card 26) is the monument 390 m away; this is the tower",
  },
  'cn26-stay-06': {
    address: 'No. 43 Yizheng Jinjia Street, Dayan Ancient Town',
    via: 'address',
    why: "Yue Tu Inn — the accommodation document's own address line. The old Mama Naxi name search is gone with the bed; 丽江古城 大研 (place card 16) still opens the old town around it",
  },
  /* UNCHANGED — the one bed the owner did not replace, and the one whose name
     a map resolves. Verified 2026-07-25, left exactly as it was. */
  'cn26-stay-07': { query: '中途客栈', city: '香格里拉', grade: 'city', nearKm: 30, via: 'name', why: 'the English name finds nothing; 中途客栈 is what the guesthouse is called on the trail. It sits halfway ALONG the gorge, well east of the Qiaotou stop pin' },
  /* The ONE bed whose document entry carries a coordinate — and it still ships
     nothing, because a bed never ships a coordinate. */
  'cn26-stay-08': { via: 'none', why: 'Yanyuan Mountain Retreat 大理晏清山居 — the accommodation document gives verified COORDINATES (25.6957 / 100.1537) and no street address. A bed never ships a coordinate, so this one ships nothing; 大理古城 (place card 18) opens the old city it is 790 m from' },
  'cn26-stay-09': {
    address: 'Unit 1-1, Building 1, Yunlifang, Changshui Hangcheng',
    via: 'address',
    why: "ibis Kunming Changshui Airport — the accommodation document's own address line. 昆明长水国际机场 (place card 20) is the terminal 3.4 km away, which the free shuttle covers; this is the hotel",
  },
  'cn26-stay-10': {
    address: '69 Mody Road, TST East, Kowloon',
    via: 'address',
    why: "The Royal Garden — the accommodation document's own address line. The old Salisbury Road search belonged to a hotel that is no longer booked; Mody Road is a different street, in TST East",
  },
};

/** Airports the trip uses that have NO driver card, keyed by IATA. The six
    mainland ones already have cards (PKX·01, PEK·02, DYG·09, CKG·12, LJG·15,
    KMG·20) and the flights borrow the card's own verified name. */
export const AIRPORT_MAPS: Record<string, MapPlan> = {
  TLV: { query: 'Ben Gurion Airport', city: 'Israel', grade: 'poi', via: 'name', why: 'the departure airport of EY608; the flight card already spells it "TLV Ben Gurion"' },
  AUH: { query: 'Zayed International Airport', city: 'Abu Dhabi', grade: 'poi', address: 'Al Mireef Street, Al Raha, 阿布扎比, 阿布扎比酋长国', via: 'name', why: 'the departure airport of EY888 and EY609; renamed from Abu Dhabi International in 2024' },
  HKG: { query: 'Hong Kong International Airport', city: 'Hong Kong', grade: 'poi', expect: '香港國際機場', address: '香港大嶼山赤鱲角航天城路', via: 'name', why: 'the departure airport of EY871; OSM answers in Chinese' },
};

/* NO ENTRY AT ALL — these six have no coordinate either, so no button renders
   and there is nothing to decide:
     cn26-place-00  the academy — address officially pending.
     cn26-place-06  曲水兰亭 — collides with a resort and a hotel brand.
     cn26-place-21  象山腊排骨 · 22 胡师傅三下锅 · 23 滟设火锅 — restaurants that
                    exist only in Chinese map services, on the GCJ-02 datum.
     cn26-place-25  太舞滑雪小镇 — OSM has neither the Chinese name nor "Thaiwoo
                    Ski Resort" (spots.ts, 2026-07-25). Added 2026-07-26 for the
                    driver, not for the map.
   Sending a name search for any of them would risk the wrong branch of a
   chain, which is worse than no button. */
