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
  /** What this place ships with. */
  via: 'name' | 'coord' | 'url';
  /** A share link the owner supplied (via 'url'). */
  url?: string;
  /** The provenance of the name, and the verification outcome. */
  why: string;
}

/** Keyed by the LEGACY stop id, like STOP_COORDS. */
export const STOP_MAPS: Record<string, MapPlan> = {
  kunyu: {
    via: 'coord',
    why: "the academy's own address is officially pending — there is no name to search that would not be a guess; the pin stays on Mount Kunyu",
  },
  beijing: { query: 'Beijing', city: 'China', grade: 'city', via: 'name', why: 'the stop is the city; OSM Beijing 0.4 km from our Tiananmen pin' },
  chongli: {
    query: '太子城',
    city: '崇礼',
    grade: 'city',
    via: 'coord',
    why: 'Taizicheng, the Olympic ski cluster (coords.ts) — see the verify:places run',
  },
  zhangjiajie: { query: '武陵源', city: '张家界', grade: 'city', via: 'name', why: 'the stop is Wulingyuan, not Zhangjiajie city 30 km SW — same name as place card 10' },
  chongqing: { query: 'Chongqing', city: 'China', grade: 'city', via: 'name', why: 'the stop is the city; OSM Chongqing near our Jiefangbei pin' },
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
  kunming: { query: 'Cuihu Park', city: 'Kunming', grade: 'city', via: 'coord', why: 'the Green Lake area (coords.ts cites en.wikipedia.org/wiki/Cuihu_Park) — see the verify:places run' },
  hongkong: { query: 'Tsim Sha Tsui', city: 'Hong Kong', grade: 'city', via: 'name', why: 'Hong Kong is English-speaking and off the GCJ-02 datum; the stop is the TST harbourfront' },
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
  'cn26-place-08': { query: '太子城站', city: '张家口', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-09': { query: '张家界荷花机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-10': { query: '武陵源', city: '张家界', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-11': { query: '天门山', city: '张家界', grade: 'poi', via: 'name', why: "the card's own Chinese name; there is more than one 天门山 in China, so the city matters" },
  'cn26-place-12': { query: '重庆江北国际机场', grade: 'poi', via: 'name', why: "the card's name without its 'T3' suffix" },
  'cn26-place-13': { query: '洪崖洞', city: '重庆', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-14': { query: '磁器口', city: '重庆', grade: 'poi', via: 'name', why: "the card's own Chinese name; Nanjing has a 磁器口 too" },
  'cn26-place-15': { query: '丽江三义国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-16': { query: '丽江古城', city: '丽江', grade: 'poi', via: 'name', why: "the card's name without its '大研' suffix" },
  'cn26-place-17': { query: '虎跳峡镇', city: '香格里拉', grade: 'poi', via: 'name', why: 'the Qiaotou town seat, the name coords.ts verified the trailhead against' },
  'cn26-place-18': { query: '大理古城', city: '大理', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-19': { query: '昆明南站', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-20': { query: '昆明长水国际机场', grade: 'poi', via: 'name', why: "the card's own Chinese name" },
  'cn26-place-24': { query: '深南大道', city: '深圳', grade: 'poi', via: 'coord', why: 'the card is a street NUMBER (深南大道2003号); the road itself runs 25 km — see the verify:places run' },
};

/* NO ENTRY AT ALL — these five have no coordinate either, so no button renders
   and there is nothing to decide:
     cn26-place-00  the academy — address officially pending.
     cn26-place-06  曲水兰亭 — collides with a resort and a hotel brand.
     cn26-place-21  象山腊排骨 · 22 胡师傅三下锅 · 23 滟设火锅 — restaurants that
                    exist only in Chinese map services, on the GCJ-02 datum.
   Sending a name search for any of them would risk the wrong branch of a
   chain, which is worse than no button. */
