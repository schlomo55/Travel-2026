/* The coordinate manifest — one dataset, two consumers: the map buttons and
   the weather lookup. EVERYTHING HERE IS WGS-84 (the datum GPS, Wikipedia,
   Wikidata and OpenStreetMap all use). The GCJ-02 shift that Chinese map apps
   need is applied at the link builder, never in storage.

   Sourcing rule, from the owner: verified links only, no guesses. Every value
   below was checked against Wikipedia / Wikidata / OpenStreetMap on 2026-07-25,
   and SPOT_COORDS on 2026-07-28. Where a place could not be pinned from a
   public source, it simply has NO entry — the map button then does not render.
   That is the intended failure mode. Hotels and the academy are never given
   coordinates: their addresses are not in the seed sources.

   Grades: stops are city/area grade (weather is happy with a few km);
   place cards are POI grade (a taxi has to arrive at them).

   FOUR MAPS, AND ONE OF THEM IS NOT SHIPPED. STOP_COORDS, PLACE_COORDS and
   AIRPORT_COORDS all reach the app. SPOT_COORDS does not: it exists only so
   `verify:places` has something to measure six far-flung spots against, and
   its own comment says why each of the six is there. */
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

/** Keyed by the ShowCard id the transform assigns (`cn26-place-00`…`-26`).
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
  /* 后海 → 什刹海 — wikidata.org/wiki/Q1136851 什刹海, the lake district 后海 is
     one of the three lakes of. SUPPLIED BY THE OWNER FROM WIKIDATA on
     2026-07-28, and Wikidata is the point: it is a source independent of
     OpenStreetMap, which is the only kind this file accepts as a yardstick.
     THE HISTORY, because it is the whole argument. The card lost its pin on
     2026-07-26, when the old 宝钞胡同 midpoint left with the hotel that was in
     it, and the `verify:places` run of 2026-07-28 then demoted the card — not
     for a wrong name, but because a name cannot be certified against nothing.
     The remedy was the coordinate, not the demotion. With this value the check
     runs and passes: OSM's own 什刹海 node sits 0.34 km away, inside POI_KM. */
  'cn26-place-05': { lat: 39.938, lng: 116.3871 },
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
  /* 解放碑 — wikidata.org/wiki/Q6683399 抗战胜利纪功碑暨人民解放纪念碑, the
     monument itself. SUPPLIED BY THE OWNER FROM WIKIDATA on 2026-07-28.
     IT IS THE SAME VALUE THE CHONGQING STOP CARRIES, AND THAT IS THE POINT.
     Until 2026-07-28 this card had no pin of its own and openly borrowed the
     stop's verification; the first gate run that could test that borrowing
     rejected it, because a certificate belongs to the entity it was issued to.
     Citing Q6683399 here gives the card its own — the same item, held rather
     than borrowed. OSM's 解放碑 lands 0.01 km from it. */
  'cn26-place-26': { lat: 29.5602, lng: 106.5734 },
  /* 护国寺中医医院 — the OSM way for 航空胡同, 什刹海街道, 西城区, which is the
     STREET the outpatient clinic sits on, not its door. The hospital runs
     一院三址 and OSM knows only the 棉花胡同 inpatient campus, 344 m south; that
     is the hit the name check has to clear, and it does. Anchoring here rather
     than on OSM's own node is deliberate: it makes the gate measure something,
     and if anything ever falls back to a dot it is the right campus. */
  'cn26-place-27': { lat: 39.9377, lng: 116.3683 },
};

/** VERIFICATION YARDSTICKS FOR SPOTS — keyed `<legacy stop id>/<spot id>`,
    the same key `verify:places` prints in its table.

    NOTHING HERE REACHES THE APP. Spots have never carried a coordinate and
    still do not: `transform.ts` ships a spot's name, city and address and
    nothing else. These values exist for one purpose — to give the OSM gate
    something honest to measure against.

    Every other spot is measured against ITS STOP'S coordinate, which works
    because a spot is normally a thing inside a city. Six are not, and for
    those the stop pin can only be made to work by opening `nearKm` so wide
    that the distance check stops meaning anything (Jinshanling would need a
    130 km circle drawn round Tiananmen). So each of these six is measured
    against its own independently sourced coordinate at POI distance instead.

    The rule that decides who gets one: THE SOURCE MUST BE INDEPENDENT OF
    OPENSTREETMAP. Storing an OSM hit and then measuring the OSM hit against it
    proves nothing — it is the same answer twice. Every coordinate below comes
    from Wikipedia/Wikidata, so the gate really is two sources agreeing. */
export const SPOT_COORDS: Record<string, Coord> = {
  /* 金山岭长城 — en.wikipedia.org/wiki/Jinshanling + wikidata.org/wiki/Q1689619.
     In Luanping County, CHENGDE, Hebei — 113 km NE of the Beijing stop pin,
     which is why it cannot be measured from it. */
  'beijing/jinshanling': { lat: 40.67639, lng: 117.24444 },
  /* 北京北站 — en.wikipedia.org/wiki/Beijing_North_railway_station (Q3267033) */
  'beijing/beijing-north': { lat: 39.94528, lng: 116.34722 },
  /* 清河站 — en.wikipedia.org/wiki/Qinghe_railway_station (Q728992, the RAILWAY
     station; the metro station of the same name is a separate item). 16.5 km
     from the stop pin, and 清河 is also a river and a district, so the name
     alone could not be trusted inside a 25 km circle. */
  'beijing/qinghe': { lat: 40.03861, lng: 116.31 },
  /* 张家界西站 — en.wikipedia.org/wiki/Zhangjiajie_West_railway_station
     (Q81060013). Opened 2019 in Yongding District, 21 km from the Wulingyuan
     stop pin — inside the default radius, but only just. */
  'zhangjiajie/zjj-west': { lat: 29.17086, lng: 110.45699 },
  /* 大浪灣 Big Wave Bay, HONG KONG ISLAND —
     en.wikipedia.org/wiki/Big_Wave_Bay,_Hong_Kong_Island (Q4906668). The
     reason this one is here: there is a SECOND 大浪灣 in Sai Kung, and it sits
     ~24 km from the Tsim Sha Tsui stop pin — inside the default radius. Only a
     coordinate of its own can tell the two bays apart. */
  'hongkong/big-wave-bay': { lat: 22.24583, lng: 114.2475 },
  /* 港珠澳大橋香港口岸 HZMB Hong Kong Port —
     en.wikipedia.org/wiki/Hong_Kong-Zhuhai-Macao_Bridge_Hong_Kong_Port, whose
     infobox point is used here; Wikidata Q57599408 (22.31808/113.95111) and
     OSM (22.31787/113.95407) sit 100–400 m from it, which is what a reclaimed
     island with terminals, car parks and approach roads looks like from three
     directions. 23 km west of the Tsim Sha Tsui stop pin, out by the airport —
     far enough that the stop could only gate it with a 30 km circle over the
     whole territory. */
  'hongkong/hzmb-hk': { lat: 22.3171, lng: 113.9544 },
};

/** The three airports the trip flies through that have no driver card, keyed
    by IATA. They exist so a flight card can open the terminal you are actually
    standing in front of; the six mainland airports are place cards already.
    Two of them sit outside China, which is why the seed guard checks bookings
    against the trip's own box rather than the China one. */
export const AIRPORT_COORDS: Record<string, Coord> = {
  /* Ben Gurion TLV — en.wikipedia.org/wiki/Ben_Gurion_Airport (32°00′41″N 34°53′12″E) */
  TLV: { lat: 32.0114, lng: 34.8867 },
  /* Zayed International AUH — en.wikipedia.org/wiki/Zayed_International_Airport (24°25′58″N 54°39′04″E) */
  AUH: { lat: 24.4328, lng: 54.6511 },
  /* Hong Kong International HKG — en.wikipedia.org/wiki/Hong_Kong_International_Airport (22°18′32″N 113°54′52″E) */
  HKG: { lat: 22.3089, lng: 113.9144 },
};

/* DELIBERATELY WITHOUT COORDINATES — the button just does not render.
   cn26-place-00  the academy. Its address stopped being pending on 2026-08-13 —
                  the school's own website footer prints 中国山东省烟台市昆嵛山自然保护区,
                  postal code 264100 — and it STILL gets no coordinate. A natural
                  conservation district is an area, not a door; the name has
                  never been through `verify:places`; and the driver card now
                  carries the address in text, which is the thing a driver reads.
                  Printing an address and pinning one are different promises.
   cn26-place-06  曲水兰亭 — the name collides with a resort and a hotel brand;
                  no branch is in OSM/Wikipedia/Wikidata. RE-CHECKED 2026-07-28,
                  and the collision is now PROVEN rather than suspected: asked
                  again and scoped to 北京, Nominatim answers 北京城建龙樾湾 — a
                  residential development in QINGDAO, Shandong, over 500 km
                  east, which merely borrows "Beijing" as a marketing name. The
                  venue's own address off the ctrip/booking listings,
                  朝阳区惠河南街1070号, resolves only as far as the STREET
                  (惠河南街, 39.9075/116.5690, in 三间房乡) and never the
                  building; no Wikidata item exists at all. The re-attempt also
                  disproved the "Sanlitun area" assumption earlier research had
                  carried — that street is ~15 km east of Sanlitun. Worse
                  evidence than before, not better. No pin, and no button.
   cn26-place-21  象山腊排骨 — a restaurant cluster; only Chinese map services
                  carry a point for it, and those are GCJ-02, not WGS-84.
   cn26-place-22  胡师傅三下锅 — same: text addresses only, no public geodata.
   cn26-place-23  滟设火锅 — only the 8 km Nanbin Road strip is verifiable,
                  which is useless to a taxi.
   cn26-place-25  太舞滑雪小镇 — added 2026-07-26 with the new beds and never put
                  through verify:places under any spelling OSM carries; spots.ts
                  `thaiwoo` records the same rejection. No pin, no button.

   TWO LEFT THIS LIST ON 2026-07-28 — cn26-place-05 (后海/什刹海) and
   cn26-place-26 (解放碑), both added pinless on 2026-07-26 and both demoted by
   the gate run for having nothing to be measured against. The owner sourced a
   Wikidata coordinate for each, which is what the rule actually asks for, and
   they are in PLACE_COORDS above with their citations. A demotion is not a
   verdict on a name; it is a statement that the name could not be checked. */
