/* The coordinate manifest — one dataset, two consumers: the map buttons and
   the weather lookup. EVERYTHING HERE IS WGS-84 (the datum GPS, Wikipedia,
   Wikidata and OpenStreetMap all use). The GCJ-02 shift that Chinese map apps
   need is applied at the link builder, never in storage.

   Sourcing rule, from the owner: verified links only, no guesses. Every value
   below was checked against Wikipedia / Wikidata / OpenStreetMap on 2026-07-25.
   Where a place could not be pinned from a public source, it simply has NO
   entry — the map button then does not render. That is the intended failure
   mode. Hotels and the academy are never given coordinates: their addresses
   are not in the seed sources.

   Grades: stops are city/area grade (weather is happy with a few km);
   place cards are POI grade (a taxi has to arrive at them). */
import type { Coord } from '../../src/lib/model/types';

/** Keyed by the LEGACY stop id (transform prefixes it with `cn26-stop-`). */
export const STOP_COORDS: Record<string, Coord> = {
  /* APPROXIMATE ON PURPOSE. The academy's own address is officially still
     pending (see the Kunyu place card), so this points at Mount Kunyu itself —
     the massif the academy sits under — not at the school.
     en.wikipedia.org/wiki/Mount_Kunyu */
  kunyu: { lat: 37.2554, lng: 121.7696 },
  /* Tiananmen Square — en.wikipedia.org/wiki/Tiananmen_Square */
  beijing: { lat: 39.9033, lng: 116.3917 },
  /* Taizicheng, the 2022 Olympic ski cluster you actually sleep and ski in —
     NOT Chongli town 15 km NW. en.wikipedia.org/wiki/Taizicheng */
  chongli: { lat: 40.9224, lng: 115.4471 },
  /* Wulingyuan town, the park gate side — OSM place node, agrees with Wikipedia */
  zhangjiajie: { lat: 29.35, lng: 110.53 },
  /* Jiefangbei CBD — wikidata.org/wiki/Q6683399 */
  chongqing: { lat: 29.5602, lng: 106.5734 },
  /* Dayan old town — OSM place=suburb "Lijiang Old City" */
  lijiang: { lat: 26.8739, lng: 100.2353 },
  /* Qiaotou / Hutiaoxia town seat, the trailhead — zh.wikipedia.org/wiki/虎跳峡镇
     (the English article's arcminute-rounded 27.217,100.150 is ~10 km off and
     disagrees with both OSM and the town boundary) */
  gorge: { lat: 27.1892, lng: 100.0488 },
  /* Dali ANCIENT city, not Xiaguan 13 km south — OSM "Dali Ancient City" */
  dali: { lat: 25.6983, lng: 100.1625 },
  /* Cuihu (Green Lake) Park — en.wikipedia.org/wiki/Cuihu_Park */
  kunming: { lat: 25.0504, lng: 102.7023 },
  /* Tsim Sha Tsui waterfront, Avenue of Stars — OSM. Hong Kong is NOT on the
     GCJ-02 datum; geo.ts exempts it. */
  hongkong: { lat: 22.2934, lng: 114.1751 },
};

/** Keyed by the ShowCard id the transform assigns (`cn26-place-00`…`-24`).
    Missing on purpose where no public source pins the place — see the notes
    at the bottom of this file. */
export const PLACE_COORDS: Record<string, Coord> = {
  /* 北京大兴国际机场 PKX — en.wikipedia.org/wiki/Beijing_Daxing_International_Airport */
  'cn26-place-01': { lat: 39.5092, lng: 116.4106 },
  /* 首都机场3号航站楼 — the OSM aeroway=terminal building for T3 itself
     (T3 is ~3 km end to end, so this lands mid-complex, not at a door) */
  'cn26-place-02': { lat: 40.0657, lng: 116.6075 },
  /* 北京南站 — OSM station node + wikidata.org/wiki/Q163962, agreeing to ~15 m */
  'cn26-place-03': { lat: 39.8636, lng: 116.3727 },
  /* 三里屯 — area grade, lands in the Taikoo Li core between the two blocks */
  'cn26-place-04': { lat: 39.9361, lng: 116.4489 },
  /* 宝钞胡同 — midpoint of the OSM way; the hutong runs ~800 m north from
     Gulou East Street, so this is street grade, not a door number */
  'cn26-place-05': { lat: 39.9431, lng: 116.3934 },
  /* 北京按摩医院 — OSM amenity=hospital node on 宝产胡同, Xicheng */
  'cn26-place-07': { lat: 39.9337, lng: 116.3655 },
  /* 太子城站 — en.wikipedia.org/wiki/Taizicheng_railway_station */
  'cn26-place-08': { lat: 40.9125, lng: 115.4418 },
  /* 张家界荷花机场 DYG — en.wikipedia.org/wiki/Zhangjiajie_Hehua_International_Airport */
  'cn26-place-09': { lat: 29.1031, lng: 110.4433 },
  /* 武陵源 — the OSM place node for Wulingyuan town (军地坪), where the beds and
     the gate cluster. The Wujiayu ticket station itself is not in OSM. */
  'cn26-place-10': { lat: 29.3488, lng: 110.5457 },
  /* 天门山 — the CABLEWAY LOWER STATION in the city, which is where you go;
     OSM aerialway=station, cross-checked against the 7,455 m cable length */
  'cn26-place-11': { lat: 29.1149, lng: 110.4784 },
  /* 重庆江北国际机场 T3 — OSM building way "T3A航站楼" (check-in and arrivals);
     the T3B satellite hall 2 km NE is a different place */
  'cn26-place-12': { lat: 29.7135, lng: 106.652 },
  /* 洪崖洞 — OSM building + wikidata.org/wiki/Q32171478, agreeing to ~110 m
     (zh.wikipedia's value is ~650 m inland and looks wrong) */
  'cn26-place-13': { lat: 29.5651, lng: 106.5753 },
  /* 磁器口 Ciqikou ancient town — OSM tourism node, Wikipedia agrees */
  'cn26-place-14': { lat: 29.5833, lng: 106.4466 },
  /* 丽江三义国际机场 LJG — en.wikipedia.org/wiki/Lijiang_Sanyi_International_Airport */
  'cn26-place-15': { lat: 26.6792, lng: 100.2458 },
  /* 丽江古城 大研 — OSM place=suburb */
  'cn26-place-16': { lat: 26.8739, lng: 100.2353 },
  /* 桥头 虎跳峡 trailhead — zh.wikipedia + OSM boundary + OSM Qiaotou station */
  'cn26-place-17': { lat: 27.1892, lng: 100.0488 },
  /* 大理古城 — OSM "Dali Ancient City" */
  'cn26-place-18': { lat: 25.6983, lng: 100.1625 },
  /* 昆明南站 — en.wikipedia.org/wiki/Kunming_South_railway_station + Wikidata */
  'cn26-place-19': { lat: 24.8731, lng: 102.8602 },
  /* 昆明长水国际机场 KMG — en.wikipedia.org/wiki/Kunming_Changshui_International_Airport */
  'cn26-place-20': { lat: 25.1019, lng: 102.9292 },
  /* 深南大道2003号 — the OSM building at Shennan Blvd 2003, Gangxia, Futian */
  'cn26-place-24': { lat: 22.5416, lng: 114.0607 },
};

/* DELIBERATELY WITHOUT COORDINATES — the button just does not render.
   cn26-place-00  the academy — its address is officially pending; never guess.
   cn26-place-06  曲水兰亭 — the name collides with a resort and a hotel brand;
                  no branch is in OSM/Wikipedia/Wikidata.
   cn26-place-21  象山腊排骨 — a restaurant cluster; only Chinese map services
                  carry a point for it, and those are GCJ-02, not WGS-84.
   cn26-place-22  胡师傅三下锅 — same: text addresses only, no public geodata.
   cn26-place-23  滟设火锅 — only the 8 km Nanbin Road strip is verifiable,
                  which is useless to a taxi. */
