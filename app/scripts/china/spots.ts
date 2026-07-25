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
   because this is the one knob that could hide a wrong answer.

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
    { id: 'yuanjiajie', name: 'Yuanjiajie', native: '袁家界', query: '袁家界', city: '张家界', kind: 'sight', via: 'none', why: '⭐ pick: the Hallelujah pillar and the First Bridge — REJECTED: bare, OSM answers with the 锣鼓塔 subdistrict; as 袁家界景区 it answers with a neighbourhood committee in Nanchang, 531 km away. 百龙天梯, the lift up to it, does resolve' },
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
  ],
  gorge: [
    { id: 'tiger-stone', name: 'Tiger Leaping Stone boardwalk', native: '虎跳石', query: '虎跳石', city: '香格里拉', kind: 'sight', nearKm: 30, via: 'none', why: 'See & do: the postcard rapids view from the Qiaotou scenic entrance — REJECTED: OSM answers every name in this gorge with 香格里拉经济开发区, one node covering the whole township' },
    { id: 'walnut-garden', name: 'Walnut Garden', native: '核桃园', query: '核桃园', city: '香格里拉', kind: 'sight', nearKm: 35, via: 'none', why: "See & do: the gorge's original guesthouse village — REJECTED: OSM answers with a bus stop on the G214 named after it" },
    { id: 'tinas', name: "Tina's Guesthouse", query: "Tina's Guesthouse, Tiger Leaping Gorge", kind: 'other', nearKm: 35, via: 'none', why: 'More options: the standard drop-off and shuttle point on the low road — REJECTED: OSM has never heard of it' },
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
    { id: 'renmin-road', name: 'Renmin Road', native: '人民路', query: '人民路', city: '大理', kind: 'food', via: 'none', why: 'See & do: the food stalls and buskers near Erhai Gate — REJECTED: every county in China has a 人民路 and OSM picked one 40 km north in 洱源. 洋人街, its other end, does resolve' },
    { id: 'jade-belt', name: 'Jade Belt Road', native: '玉带路', query: '玉带路', city: '大理', kind: 'sight', nearKm: 20, via: 'name', why: 'See & do: the flat 18 km path at 2,600 m on Cangshan' },
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
  ],
};
