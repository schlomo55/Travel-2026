/* The places inside a stop — the actionable index behind "All the options".

   The 130 option lines are prose: *"⭐ **Beihai Park** — the White Dagoba
   above a frozen lake, ten minutes on foot from Jingshan."* Prose is what you
   read the night before. What you need at 9am is the name, in Chinese, with a
   button that opens it. Parsing names back out of the prose would be a
   guessing machine, so this file names them once, by hand.

   THE RULE, without exception: every spot corresponds to something already
   written in the trip content — an option line or a recommendation block.
   Nothing here is a new suggestion. The English `name` is the label the app
   shows; `native` is the Chinese, which is what both Amap and a taxi driver
   actually need; `query` is what a map search receives.

   THE GATE: `npm run verify:places` asks OpenStreetMap where each `query` is
   and measures the distance to the stop's own verified coordinate. Inside
   `nearKm`, the spot ships (`via: 'name'`). Outside it, or unknown to OSM, the
   entry stays here with `via: 'none'` and the evidence written into `why` —
   and the app ships NO button for it. A restaurant that resolves to the wrong
   branch of a chain is worse than a restaurant with no button at all.

   `nearKm` defaults to 25 km, the distance a city stop can plausibly cover. It
   is raised only where the trip content itself says the place is further out
   ("Penglai, about an hour north") — and the reason is always in `why`,
   because this is the one knob that could hide a wrong answer. It is also
   LOWERED, which costs nothing and buys a lot: 菩提 means "bodhi", so its
   entry allows 6 km rather than 25 and any other Bodhi in Beijing fails on
   distance.

   SIX SPOTS ARE MEASURED AGAINST A COORDINATE OF THEIR OWN (coords.ts
   SPOT_COORDS) instead of against their stop's, because the stop pin could
   only be made to work by opening `nearKm` so wide that it stopped meaning
   anything — Jinshanling is 113 km from Tiananmen, and Hong Kong Island's Big
   Wave Bay has a namesake in Sai Kung that sits inside the default radius.
   Those coordinates never reach the app; they exist so the gate can measure
   something real. The rule that decides who gets one is in coords.ts.

   NOTHING here is looked up at runtime. */

export interface SpotPlan {
  /** Unique within its stop; the seed id becomes `cn26-spot-<stopKey>-<id>`. */
  id: string;
  /** The label the app shows. */
  name: string;
  /** The Chinese name — what a driver reads and what Amap resolves exactly. */
  native?: string;
  /** What the map search receives (the Chinese one wherever there is one). */
  query: string;
  /** City/region context, added to the search. */
  city?: string;
  kind: 'sight' | 'food' | 'show' | 'transport' | 'other';
  /** How far the top OSM hit may sit from the stop's coordinate. Default 25. */
  nearKm?: number;
  /** The token the top OSM hit's own name must contain. Defaults to `native`,
      then `query`. Set it where OSM files the place under a different spelling
      (白沙古镇 → its node is 白沙镇) — always with the reason in `why`.

      A LIST where OSM carries the same place under more than one name and
      Nominatim's ranking moves between them from run to run. Then any one of
      them is a pass, and writing all of them down is the sign-off. */
  expect?: string | string[];
  /** The street address OpenStreetMap returned for this spot, in the local
      script. Folded into the map search behind the name; never invented. */
  address?: string;
  /** Chains only: the street picks the branch (proven for 东来顺 on the phone). */
  addressInSearch?: boolean;
  /** 'name' ships a button; 'none' was checked and rejected. */
  via: 'name' | 'none';
  /** Where in the trip content this came from, and how the check went. */
  why: string;
}

export const DEFAULT_NEAR_KM = 25;

/** Keyed by the LEGACY stop id, like STOP_COORDS and STOP_MAPS. */
export const SPOTS: Record<string, SpotPlan[]> = {
  kunyu: [
    { id: 'park', name: 'Kunyu Mountain National Forest Park', native: '昆嵛山国家森林公园', query: '昆嵛山国家森林公园', city: '烟台', kind: 'sight', nearKm: 20, address: 'S303, 殿后北口子, 牟平区, 山东省', via: 'name', why: "⭐ pick: 'the park behind the school'" },
    { id: 'yantaishan', name: 'Yantai Hill Park', native: '烟台山公园', query: '烟台山', city: '烟台', kind: 'sight', nearKm: 60, expect: '烟台山', via: 'name', why: "⭐ pick 'one full Yantai day' + the See & do block; Yantai is ~45 km from the academy, and OSM knows the hill, not the park boundary" },
    { id: 'penglai', name: 'Penglai Pavilion', native: '蓬莱阁', query: '蓬莱阁', city: '烟台', kind: 'sight', nearKm: 120, address: '山东省蓬莱区蓬莱阁街道仙阁西路', via: 'name', why: "⭐ pick: 'Penglai, about an hour north' — the distance is stated in the option itself" },
    { id: 'suochengli', name: 'Suochengli old quarter', native: '所城里', query: '所城里', city: '烟台', kind: 'sight', nearKm: 60, address: '山东省芝罘区向阳街道芝罘万达广场', via: 'name', why: 'See & do: the 600-year walled-town lanes' },
    { id: 'changyu', name: 'Changyu Wine Culture Museum', native: '张裕酒文化博物馆', query: '张裕酒文化博物馆', city: '烟台', kind: 'sight', nearKm: 60, address: '山东省芝罘区东山街道共和里', via: 'name', why: "See & do: China's oldest winery, the indoor Sunday option" },
    { id: 'yangma', name: 'Yangma Island', native: '养马岛', query: '养马岛', city: '烟台', kind: 'sight', nearKm: 45, via: 'name', why: 'More options: the coastal loop east of Muping' },
    { id: 'zhifu', name: 'Zhifu Island', native: '芝罘岛', query: '芝罘岛', city: '烟台', kind: 'sight', nearKm: 65, address: '山东省芝罘区幸福街道沈海高速', via: 'name', why: 'More options: the headland north of Yantai' },
    { id: 'museum', name: 'Yantai Museum', native: '烟台市博物馆', query: '烟台市博物馆', city: '烟台', kind: 'sight', nearKm: 60, via: 'name', why: 'More options: the old Fujian Guild Hall' },
    { id: 'weihai', name: 'Weihai', native: '威海', query: '威海', kind: 'sight', nearKm: 95, via: 'name', why: "More options: 'Weihai for a day, about an hour by train'" },
    { id: 'liugong', name: 'Liugong Island', native: '刘公岛', query: '刘公岛', city: '威海', kind: 'sight', nearKm: 100, via: 'name', why: 'More options: the Liugong Island ferry, part of the Weihai day' },
    { id: 'sanheyuan', name: 'Sanhe Yuan · mackerel dumplings', native: '三和园', query: '三和园', city: '烟台', kind: 'food', nearKm: 60, via: 'none', why: "Food & drink: Yantai's signature bayu jiaozi — REJECTED: OSM answers with 三和星海花园, a housing estate in another district" },
    { id: 'fushan', name: 'Fushan hand-pulled noodles', native: '福山大面', query: '福山大面', city: '烟台', kind: 'food', nearKm: 60, via: 'none', why: 'Food & drink: the 200-year noodle tradition — REJECTED: a style of noodle, not an address; OSM has no such place' },
  ],
  beijing: [
    { id: '798', name: '798 Art District', native: '798艺术区', query: '798艺术区', city: '北京', kind: 'sight', address: '朝阳区酒仙桥街道', via: 'name', why: '⭐ pick: the Bauhaus factory halls at Dashanzi' },
    { id: 'beihai', name: 'Beihai Park', native: '北海公园', query: '北海公园', city: '北京', kind: 'sight', address: '西城区首都功能核心区', via: 'name', why: '⭐ pick: the White Dagoba above the frozen lake' },
    { id: 'drum-tower', name: 'Drum Tower', native: '鼓楼', query: '鼓楼', city: '北京', kind: 'sight', address: '东城区安定门街道鼓楼东大街', via: 'name', why: "⭐ pick: 'Gulou at opening time'" },
    { id: 'bell-tower', name: 'Bell Tower', native: '钟楼', query: '钟楼', city: '北京', kind: 'sight', address: '东城区安定门街道钟楼湾胡同', via: 'name', why: "⭐ pick: 'climb the Drum or Bell Tower'" },
    { id: 'national-museum', name: 'National Museum of China', native: '中国国家博物馆', query: '中国国家博物馆', city: '北京', kind: 'sight', via: 'name', why: '⭐ pick: the free, enormous, warm grey-day answer' },
    { id: 'nanluoguxiang', name: 'Nanluoguxiang', native: '南锣鼓巷', query: '南锣鼓巷', city: '北京', kind: 'sight', address: '东城区交道口街道地安门东大街', via: 'name', why: "⭐ pick: 'the side lanes, not the main drag'" },
    { id: 'observatory', name: 'Beijing Ancient Observatory', native: '北京古观象台', query: '北京古观象台', city: '北京', kind: 'sight', address: '东城区建国门街道建国门南大街', via: 'name', why: 'More options: the bronze instruments on the city wall' },
    { id: 'ming-tombs', name: 'Ming Tombs & the Sacred Way', native: '明十三陵', query: '明十三陵', city: '北京', kind: 'sight', nearKm: 60, via: 'name', why: 'More options: the spirit road, usually paired with a Great Wall day — it is out at Changping' },
    { id: 'panjiayuan', name: 'Panjiayuan antique market', native: '潘家园旧货市场', query: '潘家园旧货市场', city: '北京', kind: 'sight', via: 'name', why: 'More options: weekend-morning antiques' },
    { id: 'taikooli', name: 'Sanlitun Taikoo Li', native: '三里屯太古里', query: '三里屯太古里', city: '北京', kind: 'sight', via: 'none', why: 'More options: modern Beijing in the evening — REJECTED: OSM answers with a middle school whose address happens to be in Taikoo Li North. Place card 04 opens 三里屯 itself' },
    { id: 'capital-museum', name: 'Capital Museum', native: '首都博物馆', query: '首都博物馆', city: '北京', kind: 'sight', via: 'name', why: "More options: the city's own story, quieter than the national one" },
    { id: 'wangfujing', name: 'Wangfujing', native: '王府井', query: '王府井', city: '北京', kind: 'sight', address: '东城区东华门街道王府井大街', via: 'name', why: 'More options: the church, the bookshop street, an indoor hour' },
    { id: 'palace-museum', name: 'Palace Museum', native: '故宫博物院', query: '故宫博物院', city: '北京', kind: 'sight', via: 'name', why: "More options: the Palace Museum's own indoor galleries" },
    { id: 'temple-heaven', name: 'Temple of Heaven', native: '天坛', query: '天坛', city: '北京', kind: 'sight', address: '东城区首都功能核心区', via: 'name', why: 'See & do: the imperial altar in winter frost' },
    { id: 'lama-temple', name: 'Lama Temple (Yonghegong)', native: '雍和宫', query: '雍和宫', city: '北京', kind: 'sight', address: '东城区北新桥街道戏楼胡同', via: 'name', why: 'See & do: the 18 m sandalwood Buddha' },
    { id: 'summer-palace', name: 'Summer Palace', native: '颐和园', query: '颐和园', city: '北京', kind: 'sight', via: 'name', why: 'See & do: off-season quiet on Kunming Lake' },
    { id: 'shichahai', name: 'Shichahai / Houhai', native: '什刹海', query: '什刹海', city: '北京', kind: 'sight', address: '东城区什刹海街道什刹海地安门外大街', via: 'name', why: 'See & do: the willow-lined hutong lakesides at dusk' },
    { id: 'mutianyu', name: 'Mutianyu Great Wall', native: '慕田峪长城', query: '慕田峪长城', city: '北京', kind: 'sight', nearKm: 85, via: 'name', why: 'Good to know: the easy winter fallback for the Wall — it is 70 km out at Huairou, which is the whole point of the driver plan' },
    { id: 'yaoji', name: 'Yaoji Chaogan', native: '姚记炒肝', query: '姚记炒肝', city: '北京', kind: 'food', via: 'name', why: 'Food & drink: chaogan and baozi by the Drum Tower' },
    { id: 'donglaishun', name: 'Dong Lai Shun · copper-pot hotpot', native: '东来顺', query: '东来顺', city: '北京', kind: 'food', address: '东城区东华门街道东四南大街', addressInSearch: true, via: 'name', why: 'Food & drink: mutton hotpot since 1903, Wangfujing. OSM answers with the Qianmen branch 1 km away — the same restaurant, and a name search shows a phone whichever branch is nearest' },
    { id: 'sijiminfu', name: 'Siji Minfu · Peking duck', native: '四季民福', query: '四季民福', city: '北京', kind: 'food', address: '东城区东华门街道东安门大街', addressInSearch: true, via: 'name', why: "Food & drink: Beijing's most beloved duck house. The option says Dengshikou and OSM answers with the Wangfujing branch 1.5 km away — the same restaurant, and a name search shows a phone whichever branch is nearest" },
    { id: 'laoshe', name: 'Lao She Teahouse', native: '老舍茶馆', query: '老舍茶馆', city: '北京', kind: 'show', address: '西城区大栅栏街道前门西后河沿街', via: 'name', why: 'Shows & music: the 90-minute variety night at Qianmen' },
    { id: 'liyuan', name: 'Liyuan Theatre', native: '梨园剧场', query: '梨园剧场', city: '北京', kind: 'show', via: 'none', why: 'Shows & music: teahouse-style Peking opera — REJECTED: OSM answers with 中山公园音乐堂, a different concert hall entirely' },
    { id: 'ncpa', name: 'NCPA · "the Egg"', native: '国家大剧院', query: '国家大剧院', city: '北京', kind: 'show', address: '西城区西长安街街道石碑胡同', via: 'name', why: 'Shows & music: early-December orchestra and opera' },
    { id: 'concert-hall', name: 'Beijing Concert Hall', native: '北京音乐厅', query: '北京音乐厅', city: '北京', kind: 'show', address: '西城区西长安街街道北新华街', via: 'name', why: 'Shows & music: the December Strauss and chamber programmes' },
    /* ADDED 2026-07-28. Every one of these seven is named by the DAY PLAN
       rather than by the "All the options" prose the rest of this list was
       built from, which is exactly why they were missing — and why the Dec 6,
       7, 8 and 9 chip rows had nothing to point at. Each was researched to an
       independent coordinate before its name was written down; the ones OSM
       only answers correctly with a qualifier carry that qualifier in `city`,
       because the bare name lands in the wrong province. */
    { id: 'jingshan', name: 'Jingshan Park', native: '景山公园', query: '景山公园', city: '北京', kind: 'sight', nearKm: 10, via: 'name', why: "Dec 6 line 2 ('Jingshan Park at sunset for the roofs') and the See & do block — Wikipedia/Wikidata Q734499 puts it at 39.92361/116.39056, 2.3 km from the Tiananmen stop pin, directly north of the Palace Museum" },
    /* JINSHANLING IS NOT IN BEIJING, and the city sent says so. Wikipedia puts
       it in Luanping County, CHENGDE, Hebei — 113 km NE of the Tiananmen pin
       every other Beijing spot is measured against, further than any `nearKm`
       this file has ever used. So it is measured against a coordinate of its
       own instead (coords.ts SPOT_COORDS), which turns a meaningless 130 km
       circle round Beijing into a real check. It hangs off the Beijing stop
       because that is where Dec 7 starts and where the driver collects you. */
    { id: 'jinshanling', name: 'Jinshanling Great Wall', native: '金山岭长城', query: '金山岭长城', city: '承德', kind: 'sight', nearKm: 10, expect: '金山岭', via: 'name', why: "Dec 7 line 2, 'Jinshanling in-gate → East Five-Window Tower' — Wikipedia/Wikidata Q1689619, 40.67639/117.24444. Measured against that coordinate, not the stop's, and the city sent is 承德 because Chengde is the city it is actually in; 10 km because the wall itself runs for kilometres and OSM may answer with any point on it" },
    { id: 'jiuhua', name: 'Jiuhua Resort hot springs', native: '九华山庄', query: '九华山庄', city: '小汤山', kind: 'sight', nearKm: 35, via: 'name', why: "Dec 8 line 2, 'All-day hot springs at Jiuhua Resort, Xiaotangshan' — the bare name is dangerous: OSM answers it with a residential estate in HEFEI, Anhui, 1,200 km south. Qualified 九华山庄, 小汤山 it answers with the resort at 40.18207/116.41234, ~31 km north of the stop pin, which is the day's own '~1h north'" },
    { id: 'chunhuiyuan', name: 'Chunhuiyuan hot springs', native: '春晖园温泉度假村', query: '春晖园温泉度假村', city: '顺义', kind: 'sight', nearKm: 30, via: 'name', why: "the Dec 8 stop line's 'quieter alternative: Chunhuiyuan 春晖园' — the FULL name ships, never the short one: OSM carries an unrelated 春晖园·随园 housing estate ~210 m away that shares the first three characters. 40.12924/116.48493, ~26 km NE of the stop pin, in Shunyi" },
    /* 菩提 IS A GENERIC WORD — bodhi, as in the tree — so this entry TIGHTENS
       its radius instead of loosening it: 6 km, just past the 5.3 km the venue
       sits from the Tiananmen pin. Any temple or shop of the same name
       elsewhere in Beijing then fails on distance, which the default 25 km
       would have waved straight through. The knob works both ways. */
    { id: 'bodhi', name: 'Bodhi · tuina and cupping', native: '菩提', query: '菩提', city: '三里屯', kind: 'other', nearKm: 6, expect: ['菩提', 'Bodhi'], via: 'name', why: "Dec 5's fallback ('Bodhi 菩提, 5-min walk, in the chair by 23:30') and Dec 6 line 3 ('Bodhi tuina + cupping') — OSM has a shop node at 39.93275/116.44034, opposite the Workers' Stadium north gate, which is the Sanlitun branch the trip means. The sister Bodhi Sense near Liangmaqiao is a different address, so 三里屯 rides in the city field and the radius does the rest" },
    { id: 'beijing-north', name: 'Beijing North railway station', native: '北京北站', query: '北京北站', city: '北京', kind: 'transport', nearKm: 5, expect: '北京北', via: 'name', why: "Dec 9 line 1, 'HSR Beijing North / Qinghe → Taizicheng' — Wikipedia/Wikidata Q3267033, 39.94528/116.34722, its own yardstick in coords.ts. The token drops 站 because OSM spells station nodes both ways (昆明南站 is filed as 昆明南)" },
    { id: 'qinghe', name: 'Qinghe railway station', native: '清河站', query: '清河站', city: '北京', kind: 'transport', nearKm: 5, expect: '清河', via: 'name', why: "Dec 9 line 1's other departure station — and the one Blossom House was chosen to be near ('closest base to Qinghe, where you leave from on Dec 9'). Wikipedia/Wikidata Q728992, the RAILWAY station rather than the metro station of the same name, 40.03861/116.31, its own yardstick in coords.ts: 清河 alone is a river and a district, so the pin disambiguates, not the name" },
  ],
  chongli: [
    { id: 'thaiwoo', name: 'Thaiwoo Ski Resort', native: '太舞滑雪小镇', query: '太舞滑雪小镇', city: '崇礼', kind: 'sight', via: 'none', why: 'Which resort: the first-timer base, closest to Taizicheng station — REJECTED: OSM has neither 太舞滑雪小镇 nor "Thaiwoo Ski Resort". The stop itself opens 太子城, a walk away' },
    /* OSM carries this resort TWICE, under both of its real names, and
       Nominatim hands back whichever it feels like: two runs on 2026-07-25
       answered 云顶滑雪公园 exactly, a third answered 密苑云顶乐园 — the
       resort's official name — 3.75 km away in the same district. Same place
       either way (Genting Snow Park / Secret Garden, the 2022 Olympic
       freestyle venue), so both names are written down and either is a pass.
       Naming only one of them would make this entry fail on alternate runs. */
    { id: 'genting', name: 'Genting Secret Garden', native: '云顶滑雪公园', query: '云顶滑雪公园', city: '崇礼', kind: 'sight', nearKm: 25, expect: ['密苑云顶乐园', '云顶滑雪公园'], address: '河北省张家口市崇礼区', via: 'name', why: 'Which resort: the 2022 Olympic freestyle venue — OSM files it under both 云顶滑雪公园 and its official 密苑云顶乐园, 3.75 km apart in the same district, and Nominatim alternates between them' },
    { id: 'wanlong', name: 'Wanlong', native: '万龙滑雪场', query: '万龙滑雪场', city: '崇礼', kind: 'sight', nearKm: 35, address: '河北省张家口市崇礼区万龙路（098乡道）', via: 'name', why: "Which resort + More options: 'Wanlong's upper terrain'" },
    { id: 'fulong', name: 'Fulong · night skiing', native: '富龙滑雪场', query: '富龙滑雪场', city: '崇礼', kind: 'sight', nearKm: 35, address: '河北省张家口市崇礼区西湾子镇', via: 'name', why: 'More options: the resort closest to Chongli town, floodlit at night' },
    { id: 'chongli-town', name: 'Chongli town', native: '崇礼区', query: '崇礼区', city: '张家口', kind: 'sight', nearKm: 35, via: 'name', why: 'More options: the ice and snow sculpture displays in town' },
  ],
  zhangjiajie: [
    /* RESCUED 2026-07-28 BY THE PILLAR'S OWN OFFICIAL NAME — and the old
       rejection was a NAME problem, never a place problem. Every name this repo
       and the trip content had tried is unmappable: bare 袁家界 answers with a
       street in Meihekou, JILIN, 1,800 km north; 袁家界景区 answers with noise
       in Nanchang, Beijing and Kyoto; and the informal pillar names 乾坤柱 and
       哈利路亚山 answer with a temple in Taiwan and a ryokan in Yokohama.
       The pillar was officially RENAMED 阿凡达哈利路亚山 in January 2010, and
       that form resolves at once — 29.34519/110.43722, exactly Wikidata
       Q15925953's own coordinate, and OSM files it inside 袁家界社区, the
       Yuanjiajie community itself. So the pillar and the area are one
       neighbourhood rather than two competing places, and the ⭐ pick finally
       has something to open. The `native` shown to a driver is the name that
       works; 袁家界 stays in the label, because that is what the trip says. */
    { id: 'yuanjiajie', name: 'Yuanjiajie · Avatar Hallelujah Mountain', native: '阿凡达哈利路亚山', query: '阿凡达哈利路亚山', city: '张家界', kind: 'sight', nearKm: 15, via: 'name', why: '⭐ pick and Dec 12 line 2: the Hallelujah pillar and the First Bridge — the AREA name is unmappable in every spelling (袁家界 → Jilin, 袁家界景区 → Nanchang, 乾坤柱/哈利路亚山 → Taiwan and Japan), but the pillar\'s post-2010 official name lands on Wikidata Q15925953\'s coordinate 9 km from the stop pin. 百龙天梯, the lift up to it, resolves separately and still ships' },
    { id: 'tianzishan', name: 'Tianzi Mountain', native: '天子山', query: '天子山', city: '张家界', kind: 'sight', address: '湖南省军地坪街道武陵源区', via: 'name', why: '⭐ pick: the pillar sea in low afternoon sun' },
    { id: 'yangjiajie', name: 'Yangjiajie & Wulong Zhai', native: '杨家界', query: '杨家界', city: '张家界', kind: 'sight', address: '湖南省中湖乡武陵源区杨家界大道', via: 'name', why: '⭐ pick: the quietest of the four areas' },
    { id: 'bailong', name: 'Bailong Elevator', native: '百龙天梯', query: '百龙天梯', city: '张家界', kind: 'transport', address: '湖南省锣鼓塔街道武陵源区金鞭溪步行道', via: 'name', why: "⭐ pick: 'take the Bailong lift up and walk down'" },
    { id: 'golden-whip', name: 'Golden Whip Stream', native: '金鞭溪', query: '金鞭溪', city: '张家界', kind: 'sight', address: '湖南省锣鼓塔街道武陵源区黄石寨金鞭溪步行道', via: 'name', why: 'More options: the flat 7 km valley walk for a cloudy day' },
    { id: 'shili', name: 'Shili Gallery monorail', native: '十里画廊', query: '十里画廊', city: '张家界', kind: 'sight', address: '湖南省武陵源区十里画廊', via: 'name', why: 'More options: ten minutes under the ten-mile pillar wall' },
    { id: 'glass-bridge', name: 'Grand Canyon glass bridge', native: '张家界大峡谷玻璃桥', query: '张家界大峡谷玻璃桥', city: '张家界', kind: 'sight', nearKm: 40, expect: '玻璃大桥', via: 'name', why: 'See & do: the 380 m span over the gorge, out east of Wulingyuan — OSM files it as 张家界玻璃大桥' },
    { id: 'huanglong', name: 'Huanglong Cave', native: '黄龙洞', query: '黄龙洞', city: '张家界', kind: 'sight', address: '湖南省军地坪街道武陵源区索溪峪迎宾路居委会黄龙路', via: 'name', why: 'See & do + More options: the all-weather underground day' },
    { id: 'baofeng', name: 'Baofeng Lake', native: '宝峰湖', query: '宝峰湖', city: '张家界', kind: 'sight', address: '湖南省武陵源区', via: 'name', why: 'See & do: the boat ride between the karst peaks' },
    { id: 'xibu', name: 'Xibu Street night market', native: '西部老街', query: '西部老街', city: '武陵源', kind: 'food', via: 'none', why: 'Food & drink + More options: the snack lane in Wulingyuan — REJECTED: OSM answers with a botanic-garden entrance in HANGZHOU, 929 km east' },
    { id: 'puguang', name: 'Puguang Temple', native: '普光禅寺', query: '普光禅寺', city: '张家界', kind: 'sight', nearKm: 40, address: '湖南省张家界市崇文街道回龙社区解放路', via: 'name', why: 'More options: the rest afternoon in Zhangjiajie city, by the Tianmen cableway base' },
    /* ADDED 2026-07-28 — the station Dec 14 leaves from, which the stop's
       "Getting there" block names and the options prose never did. */
    { id: 'zjj-west', name: 'Zhangjiajie West railway station', native: '张家界西站', query: '张家界西站', city: '张家界', kind: 'transport', nearKm: 5, expect: '张家界西', via: 'name', why: "Dec 14 lines 3–4 ('the hotel's driver runs you to Zhangjiajie West' → 'Mid-afternoon HSR Zhangjiajie West → Chongqing') and the stop's own Getting-there line — Wikipedia/Wikidata Q81060013, 29.17086/110.45699, its own yardstick in coords.ts: the station opened in 2019 down in Yongding District, 21 km from the Wulingyuan pin the rest of this list is measured against" },
  ],
  chongqing: [
    { id: 'liziba', name: 'Liziba station', native: '李子坝', query: '李子坝', city: '重庆', kind: 'transport', address: '重庆市渝中区上清寺街道李子坝正街', via: 'name', why: '⭐ pick: the monorail through the apartment block' },
    { id: 'kuixinglou', name: 'Kuixinglou', native: '魁星楼', query: '魁星楼', city: '重庆', kind: 'sight', via: 'none', why: '⭐ pick: the purest 8D moment in the city — REJECTED: OSM answers with 大唐广场, a different building 500 m away. The stop pin already lands on Jiefangbei, two minutes from it' },
    { id: 'nanbin', name: 'Nanbin Road', native: '南滨路', query: '南滨路', city: '重庆', kind: 'sight', via: 'name', why: '⭐ pick: the peninsula skyline from the far bank after dark' },
    { id: 'raffles', name: 'Raffles City sky bridge', native: '重庆来福士', query: '重庆来福士', city: '重庆', kind: 'sight', via: 'none', why: 'More options: the paid deck over the confluence — REJECTED: 重庆来福士 answers with a ring-road segment 24 km out, 来福士广场 with the Raffles in HANGZHOU. 朝天门, which it stands on, does resolve' },
    { id: 'three-gorges-museum', name: 'Three Gorges Museum', native: '三峡博物馆', query: '三峡博物馆', city: '重庆', kind: 'sight', via: 'name', why: 'More options: free, warm and good on a fog day' },
    { id: 'huguang', name: 'Huguang Guild Hall', native: '湖广会馆', query: '湖广会馆', city: '重庆', kind: 'sight', address: '重庆市渝中区朝天门街道朝天门隧道', via: 'name', why: 'More options: the Qing merchant halls above the river' },
    { id: 'chaotianmen', name: 'Chaotianmen', native: '朝天门', query: '朝天门', city: '重庆', kind: 'sight', address: '重庆市渝中区朝天门街道', via: 'name', why: 'More options: where the night cruises leave from' },
    { id: 'one-tree', name: 'One Tree viewing platform', native: '一棵树观景台', query: '一棵树观景台', city: '重庆', kind: 'sight', address: '重庆市南岸区南山街道南山隧道', via: 'name', why: 'More options: the high panorama on Nanshan' },
    { id: 'sichuan-fine-arts', name: 'Sichuan Fine Arts Institute · Huangjueping', native: '四川美术学院', query: '四川美术学院', city: '重庆', kind: 'sight', nearKm: 25, via: 'name', why: 'More options: the street of painted buildings' },
    { id: 'cableway', name: 'Yangtze River Cableway', native: '长江索道', query: '长江索道', city: '重庆', kind: 'transport', via: 'name', why: 'See & do: the night crossing, bought one-way from the Jiefangbei side' },
    { id: 'shibati', name: 'Shibati stepped old town', native: '十八梯', query: '十八梯', city: '重庆', kind: 'sight', via: 'name', why: 'See & do: the Ming/Qing stone steps lit from ~18:00' },
    { id: 'eling', name: 'Eling Park & Testbed 2', native: '鹅岭公园', query: '鹅岭公园', city: '重庆', kind: 'sight', address: '重庆市渝中区两路口街道', via: 'name', why: 'See & do: the banknote-factory arts quarter and its free two-rivers panorama — OSM has the park, not the factory' },
    { id: 'grand-theatre', name: 'Chongqing Grand Theatre', native: '重庆大剧院', query: '重庆大剧院', city: '重庆', kind: 'show', address: '重庆市江北城街道两江新区江北文华街', via: 'name', why: 'Shows & music: December is New Year Concert season' },
    /* ADDED 2026-07-28 — all three come from the day plan (Dec 14 evening and
       Dec 15), not from the options prose, which is why Chongqing's chip rows
       were short by three. */
    { id: 'qiansimen', name: 'Qiansimen bridge viewpoint', native: '千厮门大桥', query: '千厮门大桥', city: '重庆', kind: 'sight', nearKm: 10, via: 'name', why: "Dec 14 line 5, 'Hongya Cave 洪崖洞 + Qiansimen bridge viewpoint' — the most-sourced new place in this pass: three OSM nodes and Wikidata Q10904903 agree to under 100 m at 29.5687/106.5750, about 110 m from the 洪崖洞 coordinate coords.ts already verified for place card 13" },
    { id: 'ronghui', name: 'Ronghui Hot Springs', native: '融汇温泉', query: '融汇温泉', city: '重庆', kind: 'sight', nearKm: 20, via: 'name', why: "Dec 15 line 3, 'Ronghui Hot Springs soak' — OSM carries it twice, as 融汇温泉 and the traditional 融滙溫泉 ~230 m apart, at 29.5435/106.4370, 13.3 km west of the Jiefangbei stop pin" },
    /* NOT 重庆大剧院, which is on this same list two lines up. The Chongqing
       Grand Theatre is a different venue on the other side of the city; the
       show 重庆·1949 plays in a theatre built for it out by Ciqikou, and
       substituting one for the other would send you to the wrong building on
       the one night of the trip with a ¥150 deposit riding on it. */
    { id: 'theatre-1949', name: 'Chongqing 1949 Grand Theatre', native: '重庆1949大剧院', query: '重庆1949大剧院', city: '重庆', kind: 'show', nearKm: 15, via: 'name', why: "Dec 15 line 4, the 'Chongqing 1949 show (English earpiece, ¥150 deposit)' — an exact OSM name match at 29.58377/106.44321, which lands 0.35 km from the 磁器口 coordinate verified for place card 14, so two independently verified points corroborate each other" },
  ],
  lijiang: [
    { id: 'black-dragon', name: 'Black Dragon Pool', native: '黑龙潭公园', query: '黑龙潭公园', city: '丽江', kind: 'sight', address: '云南省古城区西安街道', via: 'name', why: '⭐ pick: the Lijiang photograph, first clear hour of the day' },
    { id: 'lion-hill', name: 'Lion Hill & Wangu Tower', native: '万古楼', query: '万古楼', city: '丽江', kind: 'sight', address: '云南省古城区大研街道新华社区狮山路', via: 'name', why: '⭐ pick: five minutes uphill from Sifang Square at sunset' },
    { id: 'jade-dragon', name: 'Jade Dragon Snow Mountain', native: '玉龙雪山', query: '玉龙雪山', city: '丽江', kind: 'sight', nearKm: 40, via: 'name', why: '⭐ pick: the half-day cable-car slot — the massif is ~25 km north of the old town' },
    { id: 'mufu', name: 'Mu Palace', native: '木府', query: '木府', city: '丽江', kind: 'sight', address: '云南省古城区丽江古城', via: 'name', why: "More options: the Naxi chieftains' compound inside the old town" },
    { id: 'dongba', name: 'Dongba culture museum', native: '东巴文化博物馆', query: '东巴文化博物馆', city: '丽江', kind: 'sight', expect: '丽江市博物院', address: '云南省古城区西安街道义正社区教育路', via: 'name', why: 'More options: the pictographic script, by Black Dragon Pool — OSM files the same building under its official name 丽江市博物院' },
    { id: 'baisha', name: 'Baisha village & murals', native: '白沙古镇', query: '白沙古镇', city: '丽江', kind: 'sight', nearKm: 30, expect: '白沙镇', via: 'name', why: 'More options + See & do: the Ming temple paintings north of Dayan' },
    { id: 'yuhu', name: 'Yuhu village', native: '玉湖村', query: '玉湖村', city: '丽江', kind: 'sight', nearKm: 35, via: 'name', why: "More options: Joseph Rock's old house at the foot of the mountain" },
    { id: 'lashihai', name: 'Lashihai', native: '拉市海', query: '拉市海', city: '丽江', kind: 'sight', nearKm: 30, via: 'name', why: 'More options: the lake and the tea-horse road stables' },
    { id: 'blue-moon', name: 'Blue Moon Valley', native: '蓝月谷', query: '蓝月谷', city: '丽江', kind: 'sight', nearKm: 40, address: 'G674, 上白水, 玉龙纳西族自治县, 云南省', via: 'name', why: 'More options: the cheap alternative to the summit cable car' },
    { id: 'zhongyi', name: 'Zhongyi Market', native: '忠义市场', query: '忠义市场', city: '丽江', kind: 'food', address: '云南省古城区祥和街道义和社区长水路', via: 'name', why: 'More options: where the restaurants buy, and the cheap breakfast' },
    { id: 'shuhe', name: 'Shuhe Ancient Town', native: '束河古镇', query: '束河古镇', city: '丽江', kind: 'sight', via: 'name', why: "See & do: Dayan's calmer canal-side sister, 4 km away" },
    { id: 'sifang', name: 'Sifang Square', native: '四方街', query: '四方街', city: '丽江', kind: 'sight', address: '云南省古城区丽江古城新华社区', via: 'name', why: "⭐ pick: the old town before 9am starts here" },
    /* TWO THEATRES FACE EACH OTHER ACROSS 东大街, AND THIS IS THE OTHER ONE'S
       PROBLEM AS MUCH AS THIS ONE'S. 大研纳西古乐会 — Xuan Ke's ensemble, which
       is what the trip means — and 东巴宫 (Dongba Palace) both stage
       Naxi-styled music on the same street, on opposite sides. OSM carries a
       single node named exactly 纳西古乐会, filed on 东大街 in the same 新华社区
       block as the 四方街 and 万古楼 spots above. Sending the other name would
       put you in the wrong theatre at 20:00, so the name is the specific one
       and this comment is why nobody should "simplify" it later. */
    { id: 'naxi-music', name: 'Naxi Ancient Music concert hall', native: '纳西古乐会', query: '纳西古乐会', city: '丽江', kind: 'show', nearKm: 5, via: 'name', why: "Dec 17 line 3, 'Shuhe stroll + 20:00 Naxi Ancient Music concert' — OSM's node at 26.87735/100.23293, 0.45 km from the stop pin, on 东大街 in the old town. The ticketing sites quote the alley address 新义街密士巷86号 and OSM the street frontage: the same building addressed two ways. NOT 东巴宫, the rival venue across the road" },
  ],
  gorge: [
    { id: 'tiger-stone', name: 'Tiger Leaping Stone boardwalk', native: '虎跳石', query: '虎跳石', city: '香格里拉', kind: 'sight', nearKm: 30, via: 'none', why: 'See & do: the postcard rapids view from the Qiaotou scenic entrance — REJECTED: OSM answers every name in this gorge with 香格里拉经济开发区, one node covering the whole township' },
    { id: 'walnut-garden', name: 'Walnut Garden', native: '核桃园', query: '核桃园', city: '香格里拉', kind: 'sight', nearKm: 35, via: 'none', why: "See & do: the gorge's original guesthouse village — REJECTED: OSM answers with a bus stop on the G214 named after it" },
    /* RESCUED 2026-07-28, and the old rejection was OUR QUERY'S FAULT rather
       than OpenStreetMap's — which is the useful part of this entry.
       The line below used to hand Nominatim the whole string "Tina's
       Guesthouse, Tiger Leaping Gorge" as one literal name and got nothing, and
       the file recorded that as "OSM has never heard of it". Asked the way
       every other spot on this page is asked — a NAME, with the town in the
       CITY field — Tina's + 虎跳峡 answers at once: two nodes 4 m apart at
       27.25686/100.15661, one tagged in English and one 中峡客栈, 13 km east of
       the Qiaotou pin, on the low road exactly where the trip puts it. Both
       spellings go into `expect` because either node may rank first.
       THE QUERY STAYS IN THE FORM THAT WAS ACTUALLY VERIFIED. 中峡客栈 is
       carried as `native`, which is what a driver reads off the screen, and
       whether Amap would rather have the Chinese is a question for the phone
       test (§6 of the plan), not something to guess at here. */
    { id: 'tinas', name: "Tina's Guesthouse", native: '中峡客栈', query: "Tina's", city: '虎跳峡', kind: 'other', nearKm: 35, expect: ["Tina's", '中峡客栈'], via: 'name', why: "More options: the standard drop-off and shuttle point on the low road, and where Dec 19 comes off the trail to meet the transferred bag — OSM has it under both names once 虎跳峡 is sent as the city instead of being bundled into the name" },
    /* ADDED 2026-07-28 — the Dec 18 lunch stop, named in the day plan and in
       the stop's own "Day by day" block, never in the options prose. The
       Chinese name was found first, from the guesthouse's own listings, and
       only then asked of OSM: that order matters, because 茶马 is a common
       tea-horse-road prefix and a bare English search finds nothing here. */
    { id: 'tea-horse', name: 'Tea Horse Guesthouse', native: '茶马客栈', query: '茶马客栈', city: '虎跳峡', kind: 'food', nearKm: 35, via: 'name', why: "Dec 18 line 3, 'Lunch on the Tea Horse Guesthouse terrace just past the Bends' — OSM answers 茶马客栈, 虎跳峡 with a tourism node at 27.20988/100.11124, 6.6 km up the trail from the Qiaotou pin, between the 28 Bends and Halfway" },
    { id: 'seans', name: "Sean's Spring Guesthouse", query: "Sean's Spring Guesthouse, Tiger Leaping Gorge", kind: 'other', nearKm: 35, via: 'none', why: 'See & do: the 1983 original at Walnut Garden — REJECTED: OSM has never heard of it' },
    { id: 'naxi-family', name: 'Naxi Family Guesthouse', query: 'Naxi Family Guesthouse, Tiger Leaping Gorge', kind: 'food', nearKm: 30, via: 'none', why: 'Food & drink: the fried goat cheese stop ~1.5 h into the trail — REJECTED: OSM has never heard of it' },
    { id: 'gorge-itself', name: 'Tiger Leaping Gorge', native: '虎跳峡', query: '虎跳峡', city: '香格里拉', kind: 'sight', nearKm: 35, via: 'none', why: 'the trail the whole stop is about — the ⭐ picks walk it from Qiaotou — REJECTED: OSM answers every name in this gorge with 香格里拉经济开发区, one node covering the whole township' },
    { id: 'bends', name: 'The 28 Bends', native: '二十八道拐', query: '二十八道拐', city: '香格里拉', kind: 'sight', nearKm: 35, via: 'none', why: "⭐ pick: 'be walking from Qiaotou by 09:00 — the 28 Bends want cool air' — REJECTED: the only 二十八道拐 in OSM is a PETROL STATION named after them, down on the road" },
    { id: 'middle-rapids', name: 'The middle rapids staircase', native: '中虎跳', query: '中虎跳', city: '香格里拉', kind: 'sight', nearKm: 35, via: 'none', why: 'More options: the steep hour down to the middle rapids — REJECTED: OSM answers every name in this gorge with 香格里拉经济开发区, one node covering the whole township' },
    { id: 'shangri-la', name: 'Shangri-La', native: '香格里拉市', query: '香格里拉市', kind: 'sight', nearKm: 105, via: 'name', why: "More options: 'on to Shangri-La instead of back to Lijiang' — Qiaotou sits on that road, ~90 km short of the town" },
  ],
  dali: [
    { id: 'xizhou', name: 'Xizhou', native: '喜洲古镇', query: '喜洲古镇', city: '大理', kind: 'sight', nearKm: 30, via: 'name', why: "⭐ pick: 'the Bai merchant town 20 km north'" },
    { id: 'caicun', name: 'Caicun dock', native: '才村码头', query: '才村码头', city: '大理', kind: 'sight', address: '云南省大理市凤北村洱海生态廊道', via: 'name', why: "⭐ pick: Erhai's west shore at sunset" },
    { id: 'three-pagodas', name: 'Three Pagodas of Chongsheng Temple', native: '崇圣寺三塔', query: '崇圣寺三塔', city: '大理', kind: 'sight', address: '云南省大理市文笔路', via: 'name', why: 'See & do + the rainy alternate: the Chongsheng halls' },
    { id: 'zhonghe', name: 'Zhonghe cableway', native: '中和索道', query: '中和索道', city: '大理', kind: 'transport', address: '云南省大理市木平台', via: 'name', why: 'More options: closer, cheaper and lower than Ximatan' },
    { id: 'ximatan', name: 'Cangshan Ximatan cableway', native: '洗马潭索道', query: '洗马潭索道', city: '大理', kind: 'transport', address: '云南省大理市玉带路', via: 'name', why: 'See & do: the cableway to ~3,900 m' },
    { id: 'museum', name: 'Dali Museum', native: '大理市博物馆', query: '大理市博物馆', city: '大理', kind: 'sight', via: 'name', why: 'More options: the old Qing yamen, small and warm' },
    { id: 'church', name: 'The Catholic church on Renmin Road', native: '大理天主教堂', query: '大理天主教堂', city: '大理', kind: 'sight', address: '云南省大理市五华社区大纸坊新民路', via: 'name', why: 'More options: the Bai-style timber church with upturned eaves' },
    { id: 'zhoucheng', name: 'Zhoucheng · Bai tie-dye', native: '周城', query: '周城', city: '大理', kind: 'sight', nearKm: 35, via: 'name', why: 'More options: the indigo dyeing village next to Xizhou' },
    { id: 'shuanglang', name: 'Shuanglang', native: '双廊', query: '双廊', city: '大理', kind: 'sight', nearKm: 45, via: 'name', why: "More options: 'prettier than Caicun, but an hour's drive'" },
    { id: 'foreigner-street', name: 'Foreigner Street (Huguo Road)', native: '洋人街', query: '洋人街', city: '大理', kind: 'sight', via: 'name', why: 'More options: the old backpacker strip, now cafés' },
    /* REFINED 2026-07-28 — refined, not reversed. The old rejection was RIGHT
       about the name: every county in China has a 人民路, and asked as
       人民路, 大理 OpenStreetMap answered with one 40 km north in 洱源 county.
       What changed is the CITY, not the name. Asked as 人民路, 大理古城 — the
       walled ancient city the food street runs through, which is also this
       stop's own map query — OSM lands 0.16 km from the stop pin. The old
       evidence is kept above because it is still true of the shorter city, and
       it is the reason this entry may never quietly go back to 大理.
       WHAT IS NOT PROVEN YET: whether Amap's own `city` parameter accepts
       大理古城 the way Nominatim's free text does. That is a phone-test
       question (§6). The geo: URI the app actually fires sends
       "人民路 大理古城" as one search string, which is the shape Amap wants
       either way, so the risk is contained to the app-scheme fallback. */
    { id: 'renmin-road', name: 'Renmin Road', native: '人民路', query: '人民路', city: '大理古城', kind: 'food', nearKm: 5, via: 'name', why: 'See & do + Dec 19 line 4: the food stalls and buskers near Erhai Gate — with city 大理 OSM picked a 人民路 40 km north in 洱源; qualified 大理古城 it answers the ancient city street, 0.16 km from the stop pin. 洋人街, its other end, already resolved and still does' },
    { id: 'jade-belt', name: 'Jade Belt Road', native: '玉带路', query: '玉带路', city: '大理', kind: 'sight', nearKm: 20, via: 'name', why: 'See & do: the flat 18 km path at 2,600 m on Cangshan' },
    /* ADDED 2026-07-28 — the "Longkan Wharf sunrise" of Dec 20's optional shore
       ride, which day-places.ts had been carrying as a deliberate blank. */
    { id: 'longkan', name: 'Longkan Wharf', native: '龙龛码头', query: '龙龛码头', city: '大理', kind: 'sight', nearKm: 10, via: 'name', why: "Dec 20 line 2, 'Caicun → Xizhou shore ride · Longkan Wharf sunrise' — a single clean OSM node at 25.70106/100.20564, on the same Erhai ecological corridor as the 才村码头 dock two lines up, 4.3 km from the ancient-city stop pin" },
  ],
  kunming: [
    { id: 'cuihu', name: 'Green Lake (Cuihu Park)', native: '翠湖公园', query: '翠湖公园', city: '昆明', kind: 'sight', address: '云南省昆明市五华区华山街道', via: 'name', why: '⭐ pick: the Siberian gulls at golden hour' },
    { id: 'wenlin', name: 'Wenlin Street', native: '文林街', query: '文林街', city: '昆明', kind: 'food', address: '云南省昆明市五华区华山街道文林雅居文林街', via: 'name', why: '⭐ pick: the university quarter for dinner' },
    { id: 'yuantong', name: 'Yuantong Temple', native: '圆通寺', query: '圆通寺', city: '昆明', kind: 'sight', via: 'name', why: "⭐ pick: Kunming's oldest, five minutes from Green Lake" },
    { id: 'guandu', name: 'Guandu Ancient Town', native: '官渡古镇', query: '官渡古镇', city: '昆明', kind: 'sight', expect: '官渡', address: '云南省昆明市官渡区官渡街道', via: 'name', why: 'More options: the restored temple quarter towards the airport — OSM only has the subdistrict of the same name that contains it' },
    { id: 'yunnan-museum', name: 'Yunnan Provincial Museum', native: '云南省博物馆', query: '云南省博物馆', city: '昆明', kind: 'sight', via: 'none', why: 'More options: big, modern and free — REJECTED: OSM answers with 昆明市博物馆, the CITY museum, a different building 3 km away' },
    { id: 'dounan', name: 'Dounan flower market', native: '斗南花卉市场', query: '斗南花卉市场', city: '昆明', kind: 'other', nearKm: 30, via: 'name', why: 'More options: the largest in Asia, trading late into the night' },
    { id: 'nanping', name: 'Nanping Street', native: '南屏街', query: '南屏街', city: '昆明', kind: 'sight', via: 'name', why: 'More options: the evening crowds when the lake is too cold' },
    { id: 'zhengyi', name: 'Zhengyi Road', native: '正义路', query: '正义路', city: '昆明', kind: 'sight', via: 'name', why: 'More options: paired with Nanping Street for the evening' },
    { id: 'yunnan-university', name: 'Yunnan University', native: '云南大学', query: '云南大学', city: '昆明', kind: 'sight', address: '云南省昆明市五华区华山街道文林雅居翠湖东路', via: 'name', why: '⭐ pick: the university quarter the dinner option names' },
  ],
  hongkong: [
    { id: 'man-mo', name: 'Man Mo Temple', native: '文武廟', query: 'Man Mo Temple', city: 'Hong Kong', kind: 'sight', via: 'name', why: '⭐ pick: the start of the Hollywood Road walk' },
    { id: 'hollywood-road', name: 'Hollywood Road', native: '荷李活道', query: 'Hollywood Road', city: 'Hong Kong', kind: 'sight', via: 'name', why: '⭐ pick: incense to antiques to bars' },
    { id: 'escalator', name: 'Central–Mid-Levels escalator', native: '中環至半山自動扶手電梯', query: 'Central-Mid-Levels escalator', city: 'Hong Kong', kind: 'transport', via: 'name', why: '⭐ pick: the third leg of the same walk' },
    { id: 'tai-kwun', name: 'Tai Kwun', native: '大館', query: 'Tai Kwun', city: 'Hong Kong', kind: 'sight', address: '香港香港島中環蘇豪荷李活道', via: 'name', why: '⭐ pick: the best rainy-day building in Hong Kong' },
    { id: 'lamma', name: 'Lamma Island', native: '南丫島', query: 'Lamma Island', city: 'Hong Kong', kind: 'sight', nearKm: 30, via: 'name', why: '⭐ pick: an hour out of the city by ferry' },
    { id: 'cheung-chau', name: 'Cheung Chau', native: '長洲', query: 'Cheung Chau', city: 'Hong Kong', kind: 'sight', nearKm: 40, address: '香港離島區', via: 'name', why: '⭐ pick: the other island ferry' },
    { id: 'big-buddha', name: 'Tian Tan Buddha', native: '天壇大佛', query: 'Tian Tan Buddha', city: 'Hong Kong', kind: 'sight', nearKm: 40, address: '香港大嶼山離島區昂平路', via: 'name', why: 'More options: the Big Buddha on Lantau' },
    { id: 'po-lin', name: 'Po Lin Monastery', native: '寶蓮禪寺', query: 'Po Lin Monastery', city: 'Hong Kong', kind: 'sight', nearKm: 40, via: 'name', why: 'More options: the monastery beside the Big Buddha' },
    { id: 'sham-shui-po', name: 'Sham Shui Po', native: '深水埗', query: 'Sham Shui Po', city: 'Hong Kong', kind: 'sight', address: '香港深水埗', via: 'name', why: 'More options: fabric, electronics and the best cheap food' },
    { id: 'wong-tai-sin', name: 'Wong Tai Sin Temple', native: '黃大仙祠', query: 'Wong Tai Sin Temple', city: 'Hong Kong', kind: 'sight', address: '香港黃大仙', via: 'name', why: 'More options: one stop from Chi Lin on the same line' },
    { id: 'mplus', name: 'M+ & West Kowloon', native: 'M+', query: 'M+ Museum', city: 'Hong Kong', kind: 'sight', via: 'name', why: 'More options: walkable from TST along the harbour' },
    { id: 'pmq', name: 'PMQ', native: '元創方', query: 'PMQ', city: 'Hong Kong', kind: 'sight', address: '香港香港島上環', via: 'name', why: 'More options: design studios off Hollywood Road' },
    { id: 'tai-o', name: 'Tai O stilt village', native: '大澳', query: 'Tai O', city: 'Hong Kong', kind: 'sight', nearKm: 50, via: 'name', why: 'More options: the fishing houses on poles, combined with the Big Buddha' },
    { id: 'star-ferry', name: 'Star Ferry · Tsim Sha Tsui pier', native: '尖沙咀天星碼頭', query: 'Tsim Sha Tsui Star Ferry Pier', city: 'Hong Kong', kind: 'transport', address: '香港油尖旺區梳士巴利道', via: 'name', why: 'More options: a few dollars, ten minutes, the best view in the city' },
    { id: 'chi-lin', name: 'Chi Lin Nunnery', native: '志蓮淨苑', query: 'Chi Lin Nunnery', city: 'Hong Kong', kind: 'sight', via: 'name', why: 'See & do: the free Tang-style nunnery' },
    { id: 'nan-lian', name: 'Nan Lian Garden', native: '南蓮園池', query: 'Nan Lian Garden', city: 'Hong Kong', kind: 'sight', address: '香港斧山', via: 'name', why: 'See & do: the garden beside Chi Lin' },
    { id: 'happy-valley', name: 'Happy Valley Racecourse', native: '跑馬地馬場', query: 'Happy Valley Racecourse', city: 'Hong Kong', kind: 'sight', address: '香港香港島灣仔區鵝頸摩理臣山道', via: 'name', why: 'See & do: Happy Wednesday, HK$10 entry' },
    { id: 'dragons-back', name: "Dragon's Back", native: '龍脊', query: "Dragon's Back", city: 'Hong Kong', kind: 'sight', nearKm: 30, address: '香港香港島大浪灣', via: 'name', why: 'See & do: the hike to Shek O, bus 9 from Shau Kei Wan' },
    { id: 'australia-dairy', name: 'Australia Dairy Company', native: '澳洲牛奶公司', query: 'Australia Dairy Company', city: 'Hong Kong', kind: 'food', via: 'name', why: 'Food & drink: scrambled egg toast in Jordan — closed Thursdays' },
    { id: 'yat-lok', name: 'Yat Lok · roast goose', native: '一樂燒鵝', query: 'Yat Lok', city: 'Hong Kong', kind: 'food', via: 'name', why: 'Food & drink: Stanley Street, cash only, closed Wednesdays' },
    { id: 'kau-kee', name: 'Kau Kee · beef brisket noodles', native: '九記牛腩', query: 'Kau Kee', city: 'Hong Kong', kind: 'food', via: 'name', why: 'Food & drink: 90 years old, on Gough Street' },
    { id: 'peninsula', name: 'The Peninsula lobby', native: '半島酒店', query: 'The Peninsula Hong Kong', city: 'Hong Kong', kind: 'show', via: 'name', why: "Shows & music: HK's tea ritual since 1928, walk-in only" },
    { id: 'cultural-centre', name: 'Hong Kong Cultural Centre', native: '香港文化中心', query: 'Hong Kong Cultural Centre', city: 'Hong Kong', kind: 'show', address: '香港油尖旺區梳士巴利道', via: 'name', why: 'Shows & music: the Philharmonic, next door to the hotel' },
    /* ADDED 2026-07-28 — the seven places the Hong Kong DAY PLAN names that the
       options prose never did, which is why Dec 23, 24 and 25 each had a chip
       row missing its headline. Hong Kong routes to GOOGLE (geo.ts →
       isHongKongOrMacau), so English queries are the house style here and every
       one of them keeps its traditional-Chinese `native` for the driver.

       MOST OF THEM WRITE DOWN BOTH SPELLINGS IN `expect`, and that is not a
       loosening. Nominatim is asked with Accept-Language zh,en and answers Hong
       Kong in whichever script the OSM object happens to be tagged in — the
       stop itself comes back 尖沙咀 while Tai Kwun comes back in English — so
       naming only one of a bilingual place's two names would make the gate pass
       or fail on how a mapper felt in 2015. The distance half of the gate is
       what actually separates these places, and it is TIGHTENED here rather
       than left at 25 km: 5 km on Big Wave Bay, 8 on the Peak. */
    { id: 'the-peak', name: 'The Peak', native: '山頂', query: 'Victoria Peak', city: 'Hong Kong', kind: 'sight', nearKm: 8, expect: ['Victoria Peak', '山頂', '扯旗山'], via: 'name', why: "Dec 24 line 1, 'The Peak in the morning for clarity' — Wikipedia puts the Peak Tram upper terminus at 22.27104/114.14994 (Q5959277) and the summit itself 0.6 km further on (Q17541); both are the same hilltop and either is a correct answer for 'get me there'. THE 2026-07-28 GATE RUN ADDED THE THIRD SPELLING: OSM answers 扯旗山 — the hill's other traditional name — 3.61 km from the TST pin, and Wikidata's 太平山 (Q17541) sits 3.79 km from the same pin, so the two sources agree to 0.2 km on one hilltop with three names. The run is the source for 扯旗山; it was not guessed at in advance" },
    /* THE PIN IS THE LOWER TERMINAL, AT TUNG CHUNG, and that is a choice worth
       recording: the upper terminal at 昂坪 sits 200 m from the Tian Tan Buddha,
       which already ships its own button, so pinning it would duplicate a chip
       AND point at the end of the ride you arrive at rather than the one you
       have to reach. The query is the Chinese form the research actually
       verified against OSM; the English attempts at Hong Kong's cable-car and
       tram terminals ("Peak Tram Lower Terminus", "Garden Road") all came back
       empty, which is why no English is guessed at here. */
    { id: 'ngong-ping', name: 'Ngong Ping cable car · Tung Chung terminal', native: '東涌纜車站', query: '东涌缆车站', city: 'Hong Kong', kind: 'transport', nearKm: 30, expect: ['東涌', '东涌', 'Tung Chung'], via: 'name', why: "Dec 25 line 2, 'Lantau: Big Buddha + Ngong Ping cable car' — OSM's bilingual aerialway node at 22.29017/113.93864, 24 km west of the TST pin, which is the same Lantau distance the Big Buddha entry carries 40 km for" },
    { id: 'lung-king-heen', name: 'Lung King Heen', native: '龍景軒', query: 'Lung King Heen', city: 'Hong Kong', kind: 'food', nearKm: 8, expect: ['Lung King Heen', '龍景軒'], via: 'name', why: "Dec 25 line 1's splurge brunch, and the Food & drink block — Wikipedia/Wikidata Q6704272 gives the restaurant a coordinate of its own, 22.28694/114.15611, inside the Four Seasons at 8 Finance Street, 2.1 km from the TST pin, so nothing has to fall back on the hotel's name" },
    { id: 'macau-ferry', name: 'Macau ferry pier · Sheung Wan', native: '港澳客輪碼頭', query: 'Hong Kong-Macau Ferry Terminal', city: 'Hong Kong', kind: 'transport', nearKm: 8, expect: ['Macau Ferry', '港澳客輪碼頭', '港澳客運碼頭'], via: 'name', why: "Dec 22 line 1, 'check the terminal: Macau route currently sails from Sheung Wan' — Wikipedia/Wikidata Q3207485, 22.28937/114.15215, the terminal in the Shun Tak Centre, 2.4 km from the TST pin. ONE CHARACTER APART: the 2026-07-28 gate run showed OSM spells it 港澳客運碼頭 where the sources print 港澳客輪碼頭, and its hit lands 2.39 km from our pin on 干諾道中, 上環, 中西區 — Connaught Road Central in Sheung Wan, which is the Shun Tak Centre's own address and the district the day names. Both spellings are written down; the sourced one stays as `native`. (Wikidata's search answered 外港碼頭, Macau's OUTER HARBOUR terminal — a label match across the estuary, and the reason the OSM hit is the gate and Wikidata only the cross-check.)" },
    { id: 'big-wave-bay', name: 'Big Wave Bay', native: '大浪灣', query: 'Big Wave Bay', city: 'Hong Kong', kind: 'sight', nearKm: 5, expect: ['Big Wave Bay', '大浪灣'], via: 'name', why: "Dec 23 line 1, 'Big Wave Bay / Shek O seafood lunch' — Wikipedia/Wikidata Q4906668, the HONG KONG ISLAND bay at 22.24583/114.24750. There is a second 大浪灣 in Sai Kung and it falls 24 km from the TST pin, INSIDE the default radius, so this entry is measured against its own coordinate (coords.ts) at 5 km — the only thing that can tell the two apart" },
    { id: 'shek-o', name: 'Shek O', native: '石澳', query: 'Shek O', city: 'Hong Kong', kind: 'sight', nearKm: 20, expect: ['Shek O', '石澳'], via: 'name', why: "Dec 23 line 1's lunch village, and the See & do block's 'Dragon's Back hike to Shek O' — Wikipedia/Wikidata Q835390, 22.23056/114.25194, 10.6 km from the TST pin at the island's south-east corner" },
    { id: 'shau-kei-wan', name: 'Shau Kei Wan MTR', native: '筲箕灣站', query: 'Shau Kei Wan station', city: 'Hong Kong', kind: 'transport', nearKm: 10, expect: ['Shau Kei Wan', '筲箕灣'], via: 'name', why: "Dec 23 line 1's own parenthesis, '(bus 9 from Shau Kei Wan MTR)', and the See & do block that repeats it — Wikipedia/Wikidata Q839709, 22.2789/114.2289, 5.8 km east of the TST pin. The bus itself leaves from the adjoining 筲箕灣巴士總站, a separate POI whose bays sit at the station exit; the STATION is the target, because that is what the trip names and what gets you to the bay" },
    /* "WINTERFEST" IS NOT A PLACE AND NEVER WILL BE. It is the Tourism Board's
       seasonal city-wide programme — Christmas Town, Starlight Boulevard, a
       light show on eight Central buildings — and its footprint and dates are
       re-drawn every year. It has no coordinate to find, so nobody should
       later try to pin it. What IS stable and mappable is the venue the
       programme is anchored on, and that is what ships. */
    { id: 'winterfest', name: 'WinterFest · Central Harbourfront', native: '中環海濱活動空間', query: 'Central Harbourfront Event Space', city: 'Hong Kong', kind: 'show', nearKm: 5, expect: ['Central Harbourfront', '中環海濱活動空間'], via: 'name', why: "Dec 24 line 3, 'WinterFest → Symphony of Lights 20:00' — the venue, not the festival: OSM's node at 22.28390/114.16251 (9 龍和道, per zh.wikipedia and Wikidata Q127618531, which carries no coordinate of its own), 1.7 km from the TST pin across the harbour" },
    { id: 'hzmb-hk', name: 'HZMB Hong Kong Port', native: '港珠澳大橋香港口岸', query: '港珠澳大桥香港口岸', city: 'Hong Kong', kind: 'transport', nearKm: 5, expect: ['港珠澳', 'Hong Kong-Zhuhai-Macao'], via: 'name', why: "Dec 22 line 4, the ferry fallback ('HZMB Golden Bus HK$65, 24h, no pre-book') — where that bus leaves from. Wikipedia's infobox point is the yardstick in coords.ts; Wikidata Q57599408 and OSM sit 100–400 m from it, which is the width of a reclaimed island. 23 km west of the TST pin, so it is measured against its own coordinate rather than the stop's. The query is the simplified form that was verified against Nominatim; the traditional spelling a Hong Kong driver reads rides as `native`" },
    /* THE SHOW IS A SKYLINE EVENT WITH NO ADDRESS OF ITS OWN. What ships is the
       Avenue of Stars: the named, mapped stretch of the TST promenade the
       options line means, and where Wikipedia's own coordinate for A Symphony
       of Lights lands.
       NO CHINESE NAME WAS CLAIMED IN ADVANCE, AND THAT WAS THE POINT. This
       entry first shipped with `expect: 'Avenue of Stars'` alone, because the
       research named the viewpoint in English only and inventing its Chinese to
       make a gate pass is exactly the thing this repo refuses. The 2026-07-28
       run then supplied it: OSM answered 星光大道, 0.11 km away on 梳士巴利道,
       尖沙咀, and Wikidata Q782876 香港星光大道 sits 0.03 km from our pin. The
       token and the `native` below both come from that run — after it, not
       before it. */
    { id: 'symphony', name: 'TST promenade · Avenue of Stars', native: '星光大道', query: 'Avenue of Stars', city: 'Hong Kong', kind: 'sight', nearKm: 5, expect: ['Avenue of Stars', '星光大道'], via: 'name', why: "Dec 24's evening and the Hong Kong options block. RENAMED on 2026-07-28, and the rename is the point: this card used to be called 'Symphony of Lights · TST promenade', but the 2026–27 Hong Kong budget retires the nightly harbour show in the SECOND HALF OF 2026 and Dec 24 falls inside that window. No final date was ever published, so the show is not deleted from the trip — it is demoted from a named 20:00 fixture to a thing to ask the concierge about, and the card now promises only what will certainly still be there: the promenade and the view. The map target never changed (`Avenue of Stars` 星光大道) because the place never changed — only the event that used to happen over it. Wikidata Q1068874 put the show at 22.28775/114.17362, which is the promenade itself; the gate landed it 0.11 km from the stop pin under its Chinese name, corroborated by Wikidata Q782876 at 0.03 km. Golden Bauhinia Square in Wan Chai is the article's named alternative and is not shipped: the trip content picks the TST side" },
    /* ---- MACAU, on the Hong Kong stop ----------------------------------
       Dec 22 is a full day in another territory and the trip has no Macau
       stop, so these hang off the stop the day belongs to.

       THE ROUTING WAS CHECKED, NOT ASSUMED. isHongKongOrMacau() (geo.ts) reads
       the text of `city` for anything that is not a bare coordinate, and its
       regex already matches macau/macao/澳門/澳门 — so every entry below
       carries city 'Macau' and goes to Google, never to Amap. The HK_MACAU
       coordinate box was measured against all seven researched Macau
       coordinates as well and contains every one of them; nothing was widened.
       See the note beside the box in geo.ts.

       THE RADIUS IS 75 km, AND THAT IS THE ESTUARY, NOT SLOPPINESS. Macau sits
       63–68 km from the Tsim Sha Tsui pin these spots are measured against, so
       the distance half of the gate is weak here and the NAME half is doing
       the work. Every one of them is therefore a landmark a map answers
       exactly, and the one that is not — Lord Stow's, which has outlets 3–5 km
       apart — carries Coloane inside the query for that reason.

       THE MACAU-SIDE HZMB PORT IS STILL NOT ADDED, and the reason has not
       softened. The only coordinate anyone could source for it is Wikidata
       Q28796013, which covers the COMBINED Zhuhai + Macau border complex on one
       shared artificial island — no Macau-side name, no Macau-side coordinate.
       A pin that might be on the mainland side of a border crossing is the
       definition of a wrong pin. The HONG KONG end of the same bridge is a
       different matter and does ship (`hzmb-hk` above): it has its own
       Wikipedia article, its own Wikidata item and its own OSM node, all three
       within 400 m of each other. Dec 22's fallback line is linked to the Hong
       Kong port, which is where the bus leaves from — never to the Macau one,
       which nobody has been able to place. */
    { id: 'ruins-st-paul', name: "Ruins of St. Paul's", native: '大三巴牌坊', query: "Ruins of St. Paul's", city: 'Macau', kind: 'sight', nearKm: 75, expect: ["Ruins of St. Paul", '大三巴', '聖保祿學院天主之母教堂遺址'], via: 'name', why: "Dec 22 line 2, 'Historic Centre + Ruins of St. Paul's before the crowds' — Wikipedia/Wikidata Q1551411, 22.19750/113.54056. THE THIRD TOKEN IS OSM'S OWN, from the 2026-07-28 run: it files the site under the full formal name 聖保祿學院天主之母教堂遺址 — the Ruins of the Church of Mater Dei of St. Paul's College — on 大三巴斜巷, 花王堂區, 澳門, 66.1 km from the TST pin, which is 0.04 km from where Wikidata Q1551411 puts it. Popular name, street name and formal name are three names for one facade" },
    { id: 'senado', name: 'Senado Square', native: '議事亭前地', query: 'Senado Square', city: 'Macau', kind: 'sight', nearKm: 75, expect: ['Senado Square', '議事亭前地'], via: 'name', why: "Dec 22 line 2's 'Historic Centre' — a UNESCO area rather than a place a map can open, and this is the square at the middle of it, 0.5 km from the Ruins. Wikipedia/Wikidata Q837935, 22.19358/113.53967. The cross-name is deliberate and is recorded in day-places.ts too" },
    { id: 'coloane', name: 'Coloane village', native: '路環村', query: '路環村', city: 'Macau', kind: 'sight', nearKm: 75, expect: ['路環', 'Coloane'], via: 'name', why: "Dec 22 line 3, 'Quiet Coloane village + Lord Stow's egg tarts' — the OSM village node at 22.11636/113.55134. Wikipedia carries only the PARISH coordinate (Q1022920), which is the whole peninsula 1.4 km away, so the village node is what ships and the difference is left visible rather than merged" },
    { id: 'lord-stows', name: "Lord Stow's Bakery", native: '安德魯餅店', query: "Lord Stow's Bakery Coloane", city: 'Macau', kind: 'food', nearKm: 75, expect: ["Lord Stow's", '安德魯'], via: 'name', why: "Dec 22 line 3's egg tarts — the ORIGINAL Coloane shop: OSM's shop node at 22.11820/113.55133, whose address matches the 1 Rua do Tássara that lordstow.com prints. Coloane is inside the QUERY and not just the city because the Venetian and Taipa outlets are only 3–5 km away and a 75 km radius cannot tell them apart — the word can" },
    { id: 'outer-harbour-ferry', name: 'Outer Harbour Ferry Terminal', native: '外港客運碼頭', query: 'Outer Harbour Ferry Terminal', city: 'Macau', kind: 'transport', nearKm: 75, expect: ['Outer Harbour', '外港'], via: 'name', why: "Dec 22 line 1's 'check the terminal' — Macau has TWO ferry terminals and nothing in the trip's paperwork says which one the booked legs use, so both ship and neither is claimed as the arrival. Wikipedia/Wikidata Q842280, 22.19708/113.55891" },
    { id: 'taipa-ferry', name: 'Taipa Ferry Terminal', native: '氹仔客運碼頭', query: 'Taipa Ferry Terminal', city: 'Macau', kind: 'transport', nearKm: 75, expect: ['Taipa Ferry', '氹仔'], via: 'name', why: "the other half of Dec 22's 'check the terminal' — Wikipedia/Wikidata Q9289281, 22.16250/113.57778. A light-rail station of the same name is a separate item; the FERRY terminal is the one written down here" },
  ],
};
