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
      button. A missing button is the correct behaviour, not a gap. */
  via: 'name' | 'coord' | 'url' | 'none';
  /** A share link the owner supplied (via 'url'). */
  url?: string;
  /** The token the top OSM hit's own name must contain, where OSM spells the
      place differently from the trip content (太子城站 → its node is "太子城").
      Defaults to `query`. */
  expect?: string;
  /** Overrides the grade limit where the place is far from its stop ON PURPOSE
      (a bed by an airport, a landmark an hour up the coast). Always with a
      reason in `why` — this is the one knob that can hide a wrong answer. */
  nearKm?: number;
  /** The provenance of the name, and the verification outcome. */
  why: string;
}

/** Keyed by the LEGACY stop id, like STOP_COORDS. */
export const STOP_MAPS: Record<string, MapPlan> = {
  kunyu: {
    via: 'coord',
    why: "the academy's own address is officially pending — there is no name to search that would not be a guess; the pin stays on Mount Kunyu",
  },
  beijing: { query: 'Beijing', city: 'China', grade: 'city', expect: '北京', via: 'name', why: 'the stop is the city; OSM answers 北京市, 0.3 km from our Tiananmen pin' },
  chongli: {
    query: '太子城',
    city: '崇礼',
    grade: 'city',
    via: 'coord',
    why: 'Taizicheng, the Olympic ski cluster (coords.ts) — see the verify:places run',
  },
  zhangjiajie: { query: '武陵源', city: '张家界', grade: 'city', via: 'name', why: 'the stop is Wulingyuan, not Zhangjiajie city 30 km SW — same name as place card 10' },
  /* NOT "Chongqing": the municipality is the size of Austria and OSM answers
     with its centroid, 137 km from where you sleep. The stop is Jiefangbei. */
  chongqing: { query: '解放碑', city: '重庆', grade: 'city', via: 'name', why: 'the stop is the Jiefangbei CBD; searching the municipality by name lands 137 km away in the countryside, which is worse than useless' },
  lijiang: { query: '丽江古城', city: '丽江', grade: 'city', via: 'name', why: 'the stop is the old town — same name as place card 16' },
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
  kunming: { query: '翠湖公园', city: '昆明', grade: 'city', via: 'name', why: 'the stop is the Green Lake area; 翠湖公园 lands 0.1 km from the coordinate coords.ts verified, where the English name found nothing at all' },
  hongkong: { query: 'Tsim Sha Tsui', city: 'Hong Kong', grade: 'city', expect: '尖沙咀', via: 'name', why: 'Hong Kong is English-speaking and off the GCJ-02 datum; the stop is the TST harbourfront (OSM answers in Chinese, 尖沙咀)' },
};

/** Keyed by the ShowCard id, like PLACE_COORDS. Queries are the card's own
    `native` string — the Chinese a driver already reads off the screen — so
    nothing new is invented here. */
export const PLACE_MAPS: Record<string, MapPlan> = {
  'cn26-place-01': { query: '北京大兴国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-02': { query: '北京首都国际机场', city: '北京', grade: 'poi', via: 'name', why: "the card's name without its '3号航站楼' suffix — OSM has the airport, not the single terminal" },
  'cn26-place-03': { query: '北京南站', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-04': { query: '三里屯', city: '北京', grade: 'poi', via: 'name', why: "the card's own Chinese name; the city disambiguates" },
  'cn26-place-05': { query: '宝钞胡同', city: '北京', grade: 'poi', via: 'name', why: "the card's own Chinese name; the city disambiguates" },
  'cn26-place-07': { query: '北京按摩医院', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-08': { query: '太子城站', city: '张家口', grade: 'poi', expect: '太子城', via: 'name', why: "the card's own Chinese name; OSM's node for the station is spelled 太子城, 60 m away" },
  /* Without the city this name lands in SHIJIAZHUANG, 1,062 km north. */
  /* DEMOTED after verification, twice over: bare, this name lands on a shopping
     centre in Shijiazhuang 1,062 km north; with the city, OSM returns nothing at
     all. The airport is simply not in OSM under that name, so the card keeps the
     coordinate Wikipedia gave it. */
  'cn26-place-09': { query: '张家界荷花机场', city: '张家界', grade: 'poi', via: 'coord', why: "the card's own Chinese name, which OSM does not carry — bare it answers with a mall in Shijiazhuang, with the city it answers nothing. The verified airport coordinate ships instead" },
  'cn26-place-10': { query: '武陵源', city: '张家界', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-11': { query: '天门山', city: '张家界', grade: 'poi', nearKm: 10, via: 'name', why: "the card's own Chinese name; there is more than one 天门山 in China, so the city matters. OSM's node is the SUMMIT, 7.2 km from our coordinate, which is the cableway station down in town — the same mountain, and either end is a correct answer for a driver" },
  'cn26-place-12': { query: '重庆江北国际机场', grade: 'poi', via: 'name', why: "the card's name without its 'T3' suffix" },
  'cn26-place-13': { query: '洪崖洞', city: '重庆', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-14': { query: '磁器口', city: '重庆', grade: 'poi', via: 'name', why: "the card's own Chinese name; Nanjing has a 磁器口 too" },
  'cn26-place-15': { query: '丽江三义国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-16': { query: '丽江古城', city: '丽江', grade: 'poi', via: 'name', why: "the card's name without its '大研' suffix" },
  /* DEMOTED after verification: OSM answers 虎跳峡镇 with a development-zone
     node 15.4 km from the trailhead. The verified coordinate is better. */
  'cn26-place-17': { query: '虎跳峡镇', city: '香格里拉', grade: 'poi', via: 'coord', why: 'the Qiaotou town seat — but OSM resolves that name to 香格里拉经济开发区, 15.4 km up the valley, so the card keeps its verified trailhead pin instead' },
  'cn26-place-18': { query: '大理古城', city: '大理', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-19': { query: '昆明南站', grade: 'poi', expect: '昆明南', via: 'name', why: "the card's own Chinese name; OSM's station node is spelled 昆明南, 30 m away" },
  'cn26-place-20': { query: '昆明长水国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-24': { query: '深南大道', city: '深圳', grade: 'poi', via: 'coord', why: 'the card is a street NUMBER (深南大道2003号); the road itself runs 25 km — see the verify:places run' },
};

/** Keyed by the BOOKING id the transform assigns to each bed
    (`cn26-stay-00`…`-10`). Hotels are the hardest names in the trip: a brand
    resolves to the wrong branch, a boutique is not in OSM at all, and three of
    the eleven are not hotels yet but placeholders ("slope-side, Thaiwoo /
    Taizicheng"). So where the booking itself names a landmark, the landmark is
    what the button opens — and `why` says so, out loud, rather than pretending
    the pin is the front door.

    NOTHING here has a coordinate. No hotel address is in the trip sources, and
    inventing one is the single worst thing this file could do. */
export const STAY_MAPS: Record<string, MapPlan> = {
  /* VERIFIED AND REJECTED. OSM answers "CHAO Sanlitun, Beijing" with 北京工人体育场
     — the Workers' Stadium. Right neighbourhood, wrong building. */
  'cn26-stay-00': { query: 'CHAO Sanlitun', city: 'Beijing', grade: 'city', via: 'none', why: "OSM has no CHAO: it answers with the Workers' Stadium. The bed ships no button — 三里屯 (place card 04) opens the district it is in" },
  'cn26-stay-01': { query: '兰花宾馆', city: '北京', grade: 'city', via: 'name', why: "the English name resolves to 兰花宾馆 at 65 宝钞胡同 — the hutong the booking title itself names. Shipping the Chinese name is what Amap and a driver can both read" },
  /* Neither 太舞滑雪小镇 nor "Thaiwoo Ski Resort" is in OSM. The booking names a
     SECOND place though — Taizicheng — and that one is exact. */
  'cn26-stay-02': { query: '太子城', city: '崇礼', grade: 'city', expect: '太子城', via: 'name', why: 'the bed is a placeholder ("slope-side, Thaiwoo / Taizicheng"); Thaiwoo is not in OSM under either spelling, so the button opens Taizicheng — the Olympic village the same booking line names, and where the beds and the station are' },
  /* VERIFIED AND REJECTED: OSM has never heard of it. */
  'cn26-stay-03': { query: 'Peakcap Hostel', city: '武陵源', grade: 'city', via: 'none', why: 'OSM has no such hostel, so the bed ships no button. 武陵源 (place card 10) is the park gate it sits five minutes from' },
  'cn26-stay-04': { query: '天门山索道', city: '张家界', grade: 'city', nearKm: 40, via: 'name', why: 'the bed is a placeholder ("City — next to Tianmen cableway"); the cableway base station IS the address, and it sits 26 km from the Wulingyuan stop pin on purpose' },
  /* VERIFIED AND REJECTED: OSM has never heard of it. */
  'cn26-stay-05': { query: 'Houju Hotel', city: '重庆', grade: 'city', via: 'none', why: 'OSM has no Houju, so the bed ships no button. The booking note places it on the river above Shibati; 洪崖洞 (place card 13) is the landmark nearby' },
  'cn26-stay-06': { query: 'Mama Naxi Guesthouse', city: 'Lijiang', grade: 'city', via: 'name', why: 'the booking name — OSM has the guesthouse itself, 1 km from the old-town pin. The one hotel in this trip that maps cleanly by its own name' },
  'cn26-stay-07': { query: '中途客栈', city: '香格里拉', grade: 'city', nearKm: 30, via: 'name', why: 'the English name finds nothing; 中途客栈 is what the guesthouse is called on the trail. It sits halfway ALONG the gorge, well east of the Qiaotou stop pin' },
  /* VERIFIED AND REJECTED: OSM has never heard of it. */
  'cn26-stay-08': { query: 'The Jade Emu', city: 'Dali', grade: 'city', via: 'none', why: 'OSM has no Jade Emu, so the bed ships no button. Its note already says west gate, Dali OLD town — and 大理古城 (place card 18) opens exactly that' },
  'cn26-stay-09': { query: '昆明南站', grade: 'city', expect: '昆明南', nearKm: 30, via: 'name', why: 'the bed is a placeholder ("Near Kunming South station / airport line"); the station is the landmark it names, and it is 25 km from the Green Lake stop pin because that is the entire point of this bed' },
  'cn26-stay-10': { query: 'Salisbury Road', city: 'Tsim Sha Tsui', grade: 'city', expect: '梳士巴利道', via: 'name', why: 'neither "The Salisbury YMCA" nor "YMCA of Hong Kong" is in OSM. The hotel is 41 Salisbury Road — 梳士巴利道, as OSM answers — a 600 m street beside the Cultural Centre, so the button opens the street it stands on and the booking title says the rest (the unbooked ICON alternative gets nothing)' },
};

/** Airports the trip uses that have NO driver card, keyed by IATA. The six
    mainland ones already have cards (PKX·01, PEK·02, DYG·09, CKG·12, LJG·15,
    KMG·20) and the flights borrow the card's own verified name. */
export const AIRPORT_MAPS: Record<string, MapPlan> = {
  TLV: { query: 'Ben Gurion Airport', city: 'Israel', grade: 'poi', via: 'name', why: 'the departure airport of EY608; the flight card already spells it "TLV Ben Gurion"' },
  AUH: { query: 'Zayed International Airport', city: 'Abu Dhabi', grade: 'poi', via: 'name', why: 'the departure airport of EY888 and EY609; renamed from Abu Dhabi International in 2024' },
  HKG: { query: 'Hong Kong International Airport', grade: 'poi', expect: '香港國際機場', via: 'name', why: 'the departure airport of EY871; OSM answers in Chinese' },
};

/* NO ENTRY AT ALL — these five have no coordinate either, so no button renders
   and there is nothing to decide:
     cn26-place-00  the academy — address officially pending.
     cn26-place-06  曲水兰亭 — collides with a resort and a hotel brand.
     cn26-place-21  象山腊排骨 · 22 胡师傅三下锅 · 23 滟设火锅 — restaurants that
                    exist only in Chinese map services, on the GCJ-02 datum.
   Sending a name search for any of them would risk the wrong branch of a
   chain, which is worse than no button. */
