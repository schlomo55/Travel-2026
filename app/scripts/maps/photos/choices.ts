/* THE PHOTO CHOICES (Map 5e) — made by LOOKING at every candidate on the
   contact sheets (fetch.ts sheets; app/.cache/photos/sheets/), place by
   place. A photo is chosen only when it shows THIS place — the building, the
   lake, the street the trip means — not a namesake, not a generic street, not
   a sign; when in doubt it is refused, and the place keeps its colour and
   icon ("No free photo of this place"). Every refusal is written down with
   its reason. Licences are checked again by manifest.ts (rules.ts licenceOf):
   a choice on a file whose licence is not on the owner's list fails the
   build of the manifest.

   `shows` says what the photo shows — the check, in words. `fy` moves the
   crops' focal point (0 top … 1 bottom) where the middle of the photo would
   cut its subject in the 16:9 card, the rail's banner or the round pin. */

export interface Rejected {
  file: string;
  why: string;
}
export type Choice = ({ photo: string; shows: string; fy?: number } | { none: string }) & { rejected?: Rejected[] };

/** Where Map 5a's evidence tied a place to the WRONG Wikidata item — a
    namesake its coordinate check happened to match — the item that is the
    place. (Map 5a's pins were verified by OpenStreetMap; these items only
    confirmed a coordinate, and are not the place.) */
export const ITEM_FIX: Record<string, { wd: string; why: string }> = {
  'cn26-place-16': {
    wd: 'Q618394',
    why: 'Map 5a matched Q130601985, the Wenchang Palace (丽江古城文昌宫) inside the old town; the Old Town of Lijiang is Q618394',
  },
  'cn26-place-18': {
    wd: 'Q126678744',
    why: 'Map 5a matched Q85852932, the Sacred Heart Cathedral of Dali (a building in the old town); Dali Old Town is Q126678744',
  },
};

/** An About left out, and why (Wikipedia's text is used only when the article is about THIS place). */
export const ABOUT_SKIP: Record<string, string> = {
  'cn26-spot-zhangjiajie-yuanjiajie': 'the item’s English article is a redirect to Zhangjiajie National Forest Park: its lead is about the park, not Yuanjiajie or the Hallelujah Mountain',
};

/** An official site left out, and why. */
export const OFFICIAL_SKIP: Record<string, string> = {
  'cn26-spot-hongkong-big-buddha': 'the item’s official website is malformed (http://www.plm.org.hk/.com)',
};

export const CHOICES: Record<string, Choice> = {
  "cn26-spot-kunyu-yantaishan": { photo: "File:Old British embassy in Yantai.jpg", shows: "the former British consulate on Yantai Hill, one of the old consulate buildings the park is made of" },
  "cn26-spot-kunyu-penglai": { photo: "File:Penglai Pavilion viewed from the southeast.jpg", shows: "Penglai Pavilion on its headland above the sea, seen from the southeast", rejected: [
      { file: "File:Penglaige.jpg", why: "passed over: the item’s own photo shows the pavilion only as a speck on the headland above a beach" },
    ] },
  "cn26-spot-kunyu-weihai": { photo: "File:Weihai City.jpg", shows: "Weihai from the sea: the waterfront and its gate-shaped landmark" },
  "cn26-spot-kunyu-liugong": { photo: "File:Weihai.port de Liugong dao.jpg", shows: "the harbour of Liugong Island and the buildings on its landing" },
  "cn26-spot-beijing-798": { photo: "File:Space-gallery 798-art-district.jpg", shows: "a gallery in one of 798’s old factory halls, the slogans still on its arches" },
  "cn26-spot-beijing-beihai": { photo: "File:Beihai Park 2.jpg", shows: "the White Dagoba on Jade Flower Island above the lake, with its stone bridge" },
  "cn26-spot-beijing-drum-tower": { photo: "File:Beijing drum tower.JPG", shows: "the Drum Tower, red and gold, from the street", fy: 0.25 },
  "cn26-spot-beijing-bell-tower": { photo: "File:Beijingbelltower1.jpg", shows: "the grey stone Bell Tower on its square" },
  "cn26-spot-beijing-national-museum": { photo: "File:62684-Beijing-Tiananmen-Square (28609003992).jpg", shows: "the museum’s colonnaded front on Tiananmen Square" },
  "cn26-spot-beijing-nanluoguxiang": { photo: "File:Nanluogu Xiang (6230757826).jpg", shows: "the hutong lane under its trees, lanterns on the shopfronts" },
  "cn26-spot-beijing-observatory": { photo: "File:Armilla at Ancient Observatory in Beijing, China - panoramio.jpg", shows: "a bronze armillary sphere on the observatory’s platform", rejected: [
      { file: "File:Vm-4359-Beijing-Observatory-Guo-Shouking-statue.jpg", why: "passed over: a bust of Guo Shoujing in the garden, the observatory only a wall behind it" },
    ] },
  "cn26-spot-beijing-ming-tombs": { photo: "File:Mingchangling201910.jpg", shows: "Changling, the largest of the tombs, in its valley under the mountains" },
  "cn26-spot-beijing-panjiayuan": { photo: "File:Panjiayuan Market Beijing China.jpg", shows: "the market hall, its name in red characters over the stalls" },
  "cn26-spot-beijing-capital-museum": { photo: "File:Capital Museum in Beijing.jpg", shows: "the museum’s modern hall under its long roof" },
  "cn26-spot-beijing-palace-museum": { photo: "File:Forbidden City Beijing Shenwumen Gate.JPG", shows: "Shenwumen, the Forbidden City’s north gate, with the Palace Museum’s name board" },
  "cn26-spot-beijing-temple-heaven": { photo: "File:Temple of Heaven 20160323 01.jpg", shows: "the Hall of Prayer for Good Harvests on its marble terraces" },
  "cn26-spot-beijing-lama-temple": { photo: "File:Pavillon des dix mille bonheurs.jpg", shows: "the Wanfu Pavilion (Pavilion of Ten Thousand Happinesses) of the Yonghe Temple", fy: 0.35 },
  "cn26-spot-beijing-summer-palace": { photo: "File:Longevity Hill of the Summer Palace.jpg", shows: "Longevity Hill and the Tower of Buddhist Incense across Kunming Lake" },
  "cn26-spot-beijing-shichahai": { photo: "File:Beijing Shichahai 1.jpg", shows: "a Shichahai lake with a row of poplars mirrored in still water" },
  "cn26-spot-beijing-mutianyu": { photo: "File:Great Wall of China July 2006.JPG", shows: "the wall at Mutianyu along green ridges (the item’s own photo, 0.7 km from the pin)" },
  "cn26-spot-beijing-yaoji": { photo: "File:Yaoji Chaogan Restaurant (20201105155735).jpg", shows: "the restaurant’s front, its name over the door" },
  "cn26-spot-beijing-laoshe": { photo: "File:Laoshe Teahouse (20200904130159).jpg", shows: "the teahouse’s building with its 老舍茶馆 name sign" },
  "cn26-spot-beijing-ncpa": { photo: "File:National Centre for the Performing Arts.jpg", shows: "the titanium-and-glass “Egg” mirrored in its lake" },
  "cn26-spot-beijing-concert-hall": { photo: "File:Beijing concert hall 04 sep 2010.jpg", shows: "the hall’s front with its 北京音乐厅 Beijing Concert Hall sign" },
  "cn26-spot-beijing-jingshan": { photo: "File:Jingshan from the southwest (20211107141052).jpg", shows: "Jingshan’s hill with the Wanchun Pavilion on top, across the moat" },
  "cn26-place-01": { photo: "File:北京大兴机场航站楼, 2023-02-20 (20240113195424).jpg", shows: "Daxing airport’s starfish-shaped terminal from the air" },
  "cn26-place-02": { photo: "File:APM Tram at PEK T3 20260105.jpg", shows: "the terminal’s people-mover train beside Terminal 3’s glass front", rejected: [
      { file: "File:Airport, Terminal JP6209567.jpg", why: "the item’s own photo is GFDL 1.2 only — not on the owner’s list" },
      { file: "File:20240809 230753 Beijing.jpg", why: "the apron at dusk from a plane — no terminal to see" },
      { file: "File:Airbus A330-343X, China Eastern Airlines JP6379281.jpg", why: "GFDL 1.2 only — not on the list" },
      { file: "File:Airbus A380-841, Lufthansa AN1942006.jpg", why: "GFDL 1.2 only — not on the list" },
    ] },
  "cn26-place-03": { photo: "File:Beijing South Station (cropped).jpg", shows: "Beijing South station’s oval roof from above" },
  "cn26-place-04": { photo: "File:19th BMF - Sanlitun.jpg", shows: "Taikoo Li’s glass shopfronts in Sanlitun" },
  "cn26-place-05": { photo: "File:Beijing Shichahai 1.jpg", shows: "a Shichahai lake with a row of poplars mirrored in still water — Houhai is its northern lake" },
  "cn26-place-07": { none: "no free photo of the hospital on Wikimedia Commons or in the free libraries" },
  "cn26-place-27": { none: "no free photo of the hospital on Wikimedia Commons or in the free libraries" },
  "cn26-spot-zhangjiajie-yuanjiajie": { photo: "File:Wulingyuan 3.jpg", shows: "a sandstone pillar of Yuanjiajie rising out of the forest (the item’s own photo, 160 m from the pin)", fy: 0.3 },
  "cn26-spot-zhangjiajie-tianzishan": { photo: "File:China Tianzi Gebirge.JPG", shows: "Tianzi Mountain’s pillars in mist" },
  "cn26-spot-zhangjiajie-bailong": { photo: "File:湖南 张家界 百龙天梯 - panoramio (cropped).jpg", shows: "the Bailong elevator’s glass shaft on the cliff face", fy: 0.4 },
  "cn26-spot-zhangjiajie-golden-whip": { photo: "File:张家界金鞭溪.jpg", shows: "the Golden Whip Stream in its forest (named for it, 350 m from the pin)", fy: 0.6 },
  "cn26-spot-zhangjiajie-glass-bridge": { photo: "File:Zhangjiajie Glass Bridge 20190726 (2).jpg", shows: "the glass-floored bridge over the canyon, walkers on it" },
  "cn26-spot-zhangjiajie-baofeng": { photo: "File:张家界国家森林公园-宝峰湖 - panoramio.jpg", shows: "Baofeng Lake between its cliffs (the item’s own photo)" },
  "cn26-place-09": { photo: "File:Zhangjiajie Airport (27796134377).jpg", shows: "the airport’s terminal, a jet at the gate and Tianmen Mountain behind", rejected: [
      { file: "File:38197-Zhangjiajie (49047512127).jpg", why: "passed over: the runway far below, seen from Tianmen Mountain — no terminal to look for" },
    ] },
  "cn26-place-10": { photo: "File:Wulingyuan bridge.jpg", shows: "Wulingyuan town’s bridge over the river under the sandstone peaks" },
  "cn26-spot-chongqing-liziba": { photo: "File:李子坝站轻轨穿楼 0023.png", shows: "the monorail running through the middle of a residential block at Liziba" },
  "cn26-spot-chongqing-nanbin": { photo: "File:重庆市南岸区南滨路建筑、趸船和长江.jpg", shows: "Nanbin Road’s riverfront buildings and pontoons on the Yangtze (named for it, 320 m from the pin)", rejected: [
      { file: "File:重庆市南岸区南滨路建筑和趸船.jpg", why: "passed over: the same place, upright — the landscape one fits the card" },
      { file: "File:南滨路施工提示.jpg", why: "a roadworks notice on the road" },
      { file: "File:南滨路工地5.jpg", why: "a building site on the road" },
      { file: "File:南滨路工地4.jpg", why: "a building site on the road" },
      { file: "File:南滨路工地6.jpg", why: "a building site on the road" },
    ] },
  "cn26-spot-chongqing-three-gorges-museum": { photo: "File:Chongqing Zhongguo Sanxia Bowuguan 2014.04.21 11-11-06.jpg", shows: "the museum’s glass front on People’s Square" },
  "cn26-spot-chongqing-huguang": { photo: "File:Chongqing Huguang Huiguan 2014.04.21 13-14-42.jpg", shows: "the Yu Wang Palace gate of the Huguang Guild Hall" },
  "cn26-spot-chongqing-chaotianmen": { photo: "File:朝天门.jpg", shows: "Chaotianmen from above, where the Jialing meets the Yangtze, Raffles City on the point" },
  "cn26-spot-chongqing-sichuan-fine-arts": { photo: "File:四川美术学院坦克仓库 - panoramio.jpg", shows: "the institute’s Tank Warehouse art space at Huangjueping, a tank in front (99 m from the pin)" },
  "cn26-spot-chongqing-cableway": { photo: "File:Chongqing Changjiang Cableway.jpg", shows: "a Yangtze River Cableway cabin over the river" },
  "cn26-spot-chongqing-shibati": { photo: "File:Shibati 十八梯 2022.1.1.jpg", shows: "the Shibati stairs and their rebuilt old houses from above", fy: 0.6 },
  "cn26-spot-chongqing-eling": { none: "every free photo is the view from the park’s tower over the city, not the park or Testbed 2", rejected: [
      { file: "File:Eling and Niujiaotuo, Chongqing 2002 SIK 03-056646-Print.jpg", why: "a 2002 view over the city from above Eling — not the park" },
      { file: "File:Panorama of Chongqing from tower in Eling park.jpg", why: "a panorama from the park’s tower — the city, not the park" },
      { file: "File:嘉陵江-李子坝站 2391.jpg", why: "the Jialing at Liziba, 1 km away" },
      { file: "File:飞阁外全景 2392.jpg", why: "the view outside the Feige pavilion over the river — not the park" },
      { file: "File:鹅岭 - panoramio.jpg", why: "high-rises on a hill — nothing of the park" },
    ] },
  "cn26-spot-chongqing-grand-theatre": { photo: "File:CQTheatre.JPG", shows: "the theatre’s glass hull on the Jiangbei bank" },
  "cn26-spot-chongqing-qiansimen": { photo: "File:重庆 江北.jpg", shows: "the Qiansimen bridge over the Jialing, its white pylon" },
  "cn26-place-13": { photo: "File:Hongya Cave 20180520.jpg", shows: "Hongya Cave’s stilted buildings stepping down the cliff to the Jialing" },
  "cn26-place-14": { photo: "File:人头攒动的磁器口.jpg", shows: "Ciqikou’s old streets packed with people, from above" },
  "cn26-place-26": { photo: "File:Jiefangbei.jpg", shows: "the Liberation Monument among Jiefangbei’s towers" },
  "cn26-spot-lijiang-black-dragon": { photo: "File:黑龙潭公园.jpg", shows: "the pool, its marble bridge and pavilion, the Jade Dragon Snow Mountain behind — the Lijiang view" },
  "cn26-spot-lijiang-lion-hill": { photo: "File:Wangu Pagoda (48369105057).jpg", shows: "the Wangu Tower on Lion Hill" },
  "cn26-spot-lijiang-jade-dragon": { photo: "File:Yulong Xueshan 08.JPG", shows: "the Jade Dragon Snow Mountain’s peaks" },
  "cn26-spot-lijiang-mufu": { photo: "File:Mu Mansion entrance.JPG", shows: "the Mu Palace gate with its 木府 name board" },
  "cn26-spot-lijiang-baisha": { photo: "File:白沙古镇 03.jpg", shows: "a street of Baisha’s old houses" },
  "cn26-spot-lijiang-yuhu": { photo: "File:Lijiang Oct 2007 232.jpg", shows: "a stone-walled Naxi courtyard in Yuhu, the village built of the mountain’s stone" },
  "cn26-spot-lijiang-lashihai": { photo: "File:Lashihai (1).jpg", shows: "Lashi Lake under a big sky, hills behind" },
  "cn26-spot-lijiang-zhongyi": { photo: "File:Zhongyi Market (48366765802).jpg", shows: "vegetable stalls at Zhongyi Market" },
  "cn26-spot-lijiang-shuhe": { photo: "File:20240503 Shuhe.jpg", shows: "a street of Shuhe’s old town (named for it, 480 m from the pin)" },
  "cn26-spot-lijiang-sifang": { photo: "File:四方街 - panoramio.jpg", shows: "Sifang Square and its Naxi buildings (named for it, 2 m from the pin)" },
  "cn26-place-15": { photo: "File:丽江机场 - 航站楼 - 2025-05-12 04.jpg", shows: "Lijiang airport’s terminal front and canopy" },
  "cn26-place-16": { photo: "File:1 lijiang old town 2012a.jpg", shows: "a canal, a stone bridge and old houses in Dayan" },
  "cn26-place-17": { photo: "File:20130528国道G214附近虎跳峡镇河桥 - panoramio.jpg", shows: "the river through Hutiaoxia town — Qiaotou — its houses on the banks" },
  "cn26-spot-dali-xizhou": { photo: "File:Xizhou Old Town.jpg", shows: "Xizhou old town’s square, its memorial arch and old houses (110 m from the pin)", rejected: [
      { file: "File:Xizhou baba.jpg", why: "a Xizhou baba flatbread — food, not the town" },
    ] },
  "cn26-spot-dali-three-pagodas": { photo: "File:Three Pagodas from bottom view.JPG", shows: "the Three Pagodas under the Cangshan range", fy: 0.2 },
  "cn26-spot-dali-museum": { photo: "File:Dali Old Town 30.JPG", shows: "the gate of Du Wenxiu’s mansion, which houses the museum (the item’s own photo)" },
  "cn26-spot-dali-church": { photo: "File:云南大理古城天主教堂1.JPG", shows: "the Bai-style Catholic church with its cross" },
  "cn26-spot-dali-shuanglang": { photo: "File:大理双廊-2489796.jpg", shows: "Shuanglang on Erhai Lake from the air" },
  "cn26-place-18": { photo: "File:大理古城 - panoramio (10).jpg", shows: "the old town’s rooftops from a gate tower, the Cangshan behind (named for it, 150 m from the pin)" },
  "cn26-spot-kunming-cuihu": { photo: "File:Southwest part of Cuihu Park, Kunming (20240214121712).jpg", shows: "Green Lake with its boats" },
  "cn26-spot-kunming-yuantong": { photo: "File:昆明圆通寺.JPG", shows: "Yuantong Temple’s halls round their pool" },
  "cn26-spot-kunming-dounan": { photo: "File:昆明斗南花卉市场01.jpg", shows: "the market hall with its 昆明斗南花卉市场 sign (40 m from the pin)" },
  "cn26-spot-kunming-nanping": { photo: "File:Kunming (9964685065).jpg", shows: "the bronze figures of old Kunming on Nanping Street" },
  "cn26-place-19": { photo: "File:Kunming South Railway Station.jpg", shows: "the station’s front with its 昆明南站 sign" },
  "cn26-place-20": { photo: "File:Façade of Kunming Changshui International Airport (20180213180341).jpg", shows: "the terminal under its swooping golden roof" },
  "cn26-spot-hongkong-man-mo": { photo: "File:Man Mo Temple Compound.jpg", shows: "the Man Mo Temple compound among the towers" },
  "cn26-spot-hongkong-hollywood-road": { photo: "File:HK SW 上環 Sheung Wan 荷李活道 208 Hollywood Road Tai Ping Mansion April 2022 Px3.jpg", shows: "Tai Ping Mansion at 208 Hollywood Road and its shops (named for it, 170 m from the pin)", rejected: [
      { file: "File:HK SW Hollywood Road Polic Qtrs w1.JPG", why: "the item’s own photo names no author on its file page (“no machine-readable author”) — it cannot be credited" },
      { file: "File:District Council 2007 Banner Thanks HK Hollywood Road at night.jpg", why: "an election banner at night" },
      { file: "File:HK SW 上環 Sheung Wan Po Yan Street view 荷李活道 Hollywood Road Park trees April 2022 Px3 01.jpg", why: "passed over: a side street under trees" },
      { file: "File:HK SW 上環 Sheung Wan 荷李活道 222 Hollywood Road Po Yan Street April 2022 Px3 01.jpg", why: "passed over: a corner building at Po Yan Street" },
    ] },
  "cn26-spot-hongkong-escalator": { photo: "File:Central-Mid-levels escalator.jpg", shows: "the covered escalator climbing the Mid-Levels", fy: 0.4 },
  "cn26-spot-hongkong-tai-kwun": { photo: "File:Tai Kwun Parade Ground 201806.jpg", shows: "the parade ground of the old police station compound" },
  "cn26-spot-hongkong-lamma": { photo: "File:Beach, Lamma Island, Hong Kong, 2018.jpg", shows: "a beach on Lamma Island and the houses behind it", rejected: [
      { file: "File:Lamma Island and Pok Fu Lam 1.jpg", why: "passed over: Lamma far across the sea from Hong Kong Island" },
      { file: "File:Agapornis roseicollis -Hong Kong -yellow-8a.jpg", why: "a lovebird on a window sill" },
      { file: "File:Ahh, Dogs Do Business Here (2891415031).jpg", why: "a sign by a path" },
      { file: "File:CMA CGM cargo ship 12-02-2016.jpg", why: "a cargo ship off the island" },
    ] },
  "cn26-spot-hongkong-cheung-chau": { photo: "File:Blick über Cheung Chau.JPG", shows: "Cheung Chau’s harbour and town from the hill" },
  "cn26-spot-hongkong-big-buddha": { photo: "File:Tian Tan Buddha by Beria.jpg", shows: "the Tian Tan Buddha on its hill", fy: 0.35 },
  "cn26-spot-hongkong-po-lin": { photo: "File:Polintemple.JPG", shows: "Po Lin Monastery’s halls from above" },
  "cn26-spot-hongkong-sham-shui-po": { photo: "File:HK Sham Shui Po 2009.jpg", shows: "Sham Shui Po’s streets from above" },
  "cn26-spot-hongkong-wong-tai-sin": { photo: "File:HK WongTaiSinTemple.JPG", shows: "the temple’s main hall and its red columns" },
  "cn26-spot-hongkong-mplus": { photo: "File:WKCD M+, 2021.11.jpg", shows: "the M+ building at West Kowloon" },
  "cn26-spot-hongkong-pmq": { photo: "File:PMQ Overview 201510.jpg", shows: "the PMQ blocks behind their trees" },
  "cn26-spot-hongkong-tai-o": { photo: "File:1 tai o hong kong 2013.jpg", shows: "Tai O’s stilt houses over the creek" },
  "cn26-spot-hongkong-star-ferry": { photo: "File:Tsim Sha Tsui Ferry Pier.jpg", shows: "the Star Ferry pier at Tsim Sha Tsui, a ferry alongside" },
  "cn26-spot-hongkong-chi-lin": { photo: "File:Hong Kong - Chi Lin Nunnery main building.jpg", shows: "Chi Lin Nunnery’s wooden halls behind its courtyard" },
  "cn26-spot-hongkong-nan-lian": { photo: "File:Nan Lian Garden 004.jpg", shows: "Nan Lian Garden’s golden pavilion" },
  "cn26-spot-hongkong-happy-valley": { photo: "File:Happy Valley Racecourse 1.jpg", shows: "the racecourse from above, the towers round it" },
  "cn26-spot-hongkong-dragons-back": { photo: "File:A typically Asian group atop the Dragons back (8117559052).jpg", shows: "hikers on the grassy crest of the Dragon’s Back", rejected: [
      { file: "File:Dragon's Back, Hong Kong 02.jpg", why: "passed over: the view from the ridge down onto Shek O — Shek O’s own photo shows it" },
      { file: "File:Dragon's Back (3206275754).jpg", why: "passed over: the trail’s signpost" },
    ] },
  "cn26-spot-hongkong-australia-dairy": { photo: "File:Australia Dairy Company outlook.JPG", shows: "the restaurant’s front and its 澳洲牛奶公司 sign" },
  "cn26-spot-hongkong-yat-lok": { photo: "File:HK 中環 Central 士丹利街 Stanley Street shop 一樂燒鵝 Yat Lok Restaurant June 2019 IX2 01.jpg", shows: "Yat Lok’s shopfront on Stanley Street", rejected: [
      { file: "File:HK 中環 Central 士丹利街 Stanley Street shop 一樂燒鵝 Yat Lok Restaurant June 2019 IX2 02.jpg", why: "a basket of chillies" },
      { file: "File:HK 中環 Central 士丹利街 Stanley Street shop 一樂燒鵝 Yat Lok Restaurant June 2019 IX2 06.jpg", why: "the menu board" },
    ] },
  "cn26-spot-hongkong-kau-kee": { photo: "File:HK KauKeeRestaurant.JPG", shows: "Kau Kee’s shopfront with its 九記牛腩 sign" },
  "cn26-spot-hongkong-peninsula": { photo: "File:The Peninsula.jpg", shows: "The Peninsula’s façade, where the lobby is", fy: 0.45 },
  "cn26-spot-hongkong-cultural-centre": { photo: "File:HK Cultral Centre 2010.jpg", shows: "the Cultural Centre’s curving roof and the clock tower" },
  "cn26-spot-hongkong-the-peak": { photo: "File:High West and Victoria Peak from Victoria Gap (crop1).jpg", shows: "Victoria Peak from Victoria Gap" },
  "cn26-spot-hongkong-ngong-ping": { photo: "File:Cable train Hong Kong station.jpg", shows: "the Tung Chung cable car station, a gondola coming in", rejected: [
      { file: "File:HK TC Tung Chung 360 Mei Tung Street Citygate.JPG", why: "the item’s own photo names no author on its file page — it cannot be credited" },
    ] },
  "cn26-spot-hongkong-macau-ferry": { photo: "File:HK Sheung Wan Shun Tak Centre HK-Macau Ferry Terminal Heliport.JPG", shows: "the Hong Kong–Macau Ferry Terminal and its helipad" },
  "cn26-spot-hongkong-big-wave-bay": { photo: "File:Big Wave Bay, Hong Kong Island 1.jpg", shows: "Big Wave Bay’s beach and surf" },
  "cn26-spot-hongkong-shek-o": { photo: "File:DragonBack1.jpg", shows: "Shek O village on its headland, seen from the Dragon’s Back" },
  "cn26-spot-hongkong-shau-kei-wan": { photo: "File:Shau Kei Wan Station 2014 04 part5.JPG", shows: "the station’s platform with its 筲箕灣 calligraphy" },
  "cn26-spot-hongkong-winterfest": { photo: "File:Central Harbourfront Event Space, Hong Kong.jpg", shows: "the Central Harbourfront event space, the observation wheel beside it", rejected: [
      { file: "openverse:184c1aa8-3498-4a48-a318-979481b13157", why: "a family in front of the WinterFest tree — a portrait of people" },
      { file: "openverse:0fd53496-48c9-4b80-a972-442dd5e29476", why: "a portrait of people" },
      { file: "openverse:b1b682a0-cc23-4555-a335-15181ac0827d", why: "a portrait of people" },
      { file: "openverse:d38e9e53-3b44-4f75-9212-5e5f4e2b3931", why: "a portrait of people" },
    ] },
  "cn26-spot-hongkong-hzmb-hk": { photo: "File:Hong Kong Port of Hong Kong-Zhuhai-Macao Bridge (20181025160021).jpg", shows: "the port’s passenger clearance building" },
  "cn26-spot-hongkong-symphony": { photo: "File:2024-12-27 Avenue of Stars, Hong Kong.jpg", shows: "the Tsim Sha Tsui promenade — the Avenue of Stars — along the harbour, Hong Kong Island’s skyline across the water (200 m from the pin)", rejected: [
      { file: "File:Avenue of Stars Hong Kong Bruce Lee Statue.jpg", why: "its file page names no author — only a Flickr link labelled “[2]” — so it cannot be credited" },
      { file: "File:2024-12-27 Avenue of Stars and skyline of Wan Chai, Hong Kong.jpg", why: "passed over: a pier and a hazy skyline" },
      { file: "File:A Symphony of Lights crowd, Tsim Sha Tsui.JPG", why: "a crowd at night, the place unseen" },
    ] },
  "cn26-spot-hongkong-ruins-st-paul": { photo: "File:Cathedral of Saint Paul in Macau, 2023 (04).jpg", shows: "the façade of St. Paul’s atop its steps", fy: 0.35 },
  "cn26-spot-hongkong-senado": { photo: "File:Centre of Makau.jpg", shows: "Senado Square’s wave-patterned pavement and white colonial buildings" },
  "cn26-spot-hongkong-lord-stows": { photo: "File:Lord Stow's Bakery in Coloane 17-10-2023(1).jpg", shows: "Lord Stow’s shopfront in Coloane (4 m from the pin)" },
  "cn26-stay-10": { photo: "File:HK TheRoyalGarden Entrance.JPG", shows: "the hotel’s entrance and its The Royal Garden sign", rejected: [
      { file: "File:Royal Garden Hotel 2011.jpg", why: "passed over: the hotel’s roof from a tower above — not the door you would look for" },
    ] },
  "cn26-spot-kunyu-yangma": { none: "no free photo that can be tied to Yangma Island", rejected: [
      { file: "File:Untitled - panoramio - China Q-H.jpg", why: "a hazy, untitled stretch of coast 2 km from the pin — nothing in it shows it is Yangma Island rather than any Shandong shore" },
      { file: "openverse:75bd27e1-c650-4bd9-8ef5-5ccfd5d3363e", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:36d7525d-91c3-4ba8-9b22-762e7fd60cc8", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:4849fa66-7ea7-40a5-8e70-05747b0c4792", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:ff5a0925-6efd-4c94-a014-974af5ff9d01", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:afa20212-0833-4bf8-abba-aadde0113f27", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:547b0020-e25c-4ade-b629-6bfe6aa48f8b", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:8cfb6f50-66fb-4207-9fe4-797b09b9208b", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
      { file: "openverse:43f4aa70-3d06-40f6-81a8-cd406ffa5b13", why: "Island Peak in the Himalaya (Nepal) — an Openverse false match for “island”" },
    ] },
  "cn26-spot-kunyu-museum": { none: "every free photo shows objects of the collection, none the museum you would walk to", rejected: [
      { file: "File:烟台市博物馆馆藏文物20240225 30.jpg", why: "a vase in its display case — an object of the collection, not the museum" },
      { file: "File:Yan - Yantai museum.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 22.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 31.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 12.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 32.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 04.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 05.jpg", why: "an object of the collection or a display inside — not the museum" },
      { file: "File:烟台市博物馆馆藏文物20240225 39.jpg", why: "an object of the collection or a display inside — not the museum" },
    ] },
  "cn26-spot-zhangjiajie-shili": { none: "no free photo of Zhangjiajie’s Shili Gallery itself", rejected: [
      { file: "File:桂林阳朔十里画廊小火车.jpg", why: "a namesake — Yangshuo’s Shili Gallery in Guilin, 600 km away" },
      { file: "File:桂林阳朔十里画廊喀斯特山景 04.jpg", why: "a namesake — Yangshuo’s Shili Gallery in Guilin, 600 km away" },
      { file: "File:张家界十里画廊小火车.jpeg", why: "passengers inside the sightseeing train — neither the valley nor the train you would look for" },
    ] },
  "cn26-spot-zhangjiajie-zjj-west": { none: "no free photo of the station", rejected: [
      { file: "File:RW19T 554509 at Yamenkoudong (20260624154253).jpg", why: "a railway carriage at Yamenkoudong, 1,300 km away — not the station" },
      { file: "File:CRH380B-3650 near Lijiatang Railway Station in Shanghai, China 20260404.jpg", why: "a train near Lijiatang station, 1,070 km away" },
      { file: "File:202309 CR400AF-A-2070 as G1370 at Jinhua Station.jpg", why: "a train at Jinhua station, 890 km away" },
    ] },
  "cn26-place-11": { photo: "File:Tian Menshan Mountain 2.jpg", shows: "a Tianmen cableway cabin climbing over the mountain’s winding road — the way up the card is for (in Commons’ Tianmen Mountain cable car category)", rejected: [
      { file: "File:天门山-天门洞 - panoramio.jpg", why: "the Tianmen Cave on the summit, 7 km up — the mountain’s sight, not the cableway station this card marks" },
      { file: "File:天门山 - panoramio.jpg", why: "a namesake — another 天门山, 1,300 km away" },
      { file: "File:天门山落日余晖 - panoramio.jpg", why: "a namesake — another 天门山, 800 km away" },
      { file: "File:远望天门山 - panoramio.jpg", why: "a namesake — another 天门山, 800 km away" },
      { file: "File:望天门山 20240418.jpg", why: "a namesake — another 天门山, 400 km away" },
      { file: "File:人工沙滩西望天门山 - panoramio.jpg", why: "a namesake — another 天门山, 800 km away" },
    ] },
  "cn26-stay-04": { none: "no free photo of the Zhangjiajie Huatian hotel", rejected: [
      { file: "File:长沙华天大酒店 20240506.jpg", why: "a namesake — Changsha’s Huatian hotel, 266 km away" },
      { file: "File:芙蓉华天 20240506.jpg", why: "a namesake — Changsha’s Huatian hotel, 266 km away" },
    ] },
  "cn26-stay-03": { none: "no free photo of the hotel on Wikimedia Commons or in the free libraries" },
  "cn26-spot-chongqing-one-tree": { none: "no free photo of the viewing platform on Wikimedia Commons or in the free libraries" },
  "cn26-spot-chongqing-ronghui": { none: "no free photo of the hot springs on Wikimedia Commons or in the free libraries" },
  "cn26-spot-chongqing-theatre-1949": { none: "no free photo of the theatre", rejected: [
      { file: "File:ChongQing 69 High school(重庆69中路口) - panoramio.jpg", why: "a road junction by the No. 69 middle school, 210 m from the pin — not the theatre" },
    ] },
  "cn26-place-12": { photo: "File:Terminal 3 of Chongqing Jiangbei Airport.jpg", shows: "Terminal 3’s departure level and its long roof", rejected: [
      { file: "File:Interior of Car 6, Chongqing Jiangbei Airport APM.jpg", why: "inside a people-mover car — not the terminal" },
      { file: "File:Platform (West), T3A Station, Chongqing Jiangbei Airport APM.jpg", why: "the people-mover’s platform — not the terminal" },
      { file: "File:Exit 1, Terminal 3 of Jiangbei Airport Station, Chongqing Rail Transit 20260618.jpg", why: "an exit of the airport’s metro station" },
      { file: "File:Exit 6, Terminal 3 of Jiangbei Airport Station, Chongqing Rail Transit 20260618-B.jpg", why: "an exit of the airport’s metro station" },
      { file: "File:Concourse, Terminal 3 of Jiangbei Airport Station, Chongqing Rail Transit 20250425.jpg", why: "the metro station’s concourse" },
      { file: "File:Platform of L10 (S), Terminal 3 of Jiangbei Airport Station, Chongqing Rail Transit 20250425.jpg", why: "a metro platform" },
      { file: "File:Chongqing Rail Transit - Jiangbei Airport - Exit 3.JPG", why: "the metro station’s exit" },
      { file: "File:Chongqing Rail Transit - Jiangbei Airport - Platform.JPG", why: "a metro platform" },
      { file: "File:Terminal 2 of Jiangbei Airport Station Line 10.jpg", why: "Terminal 2’s metro station" },
      { file: "File:Terminal 3 of Jiangbei Airport Station Line 10.jpg", why: "Terminal 3’s metro station, not the terminal" },
      { file: "File:Panorama of Chongqing Jiangbei Airport Terminal 3.JPG", why: "passed over: the same departure level in a narrow panorama" },
      { file: "File:TVMs of Terminal 3 of Jiangbei Airport Station (20191224192825).jpg", why: "ticket machines in the metro station" },
      { file: "File:Northbound platform of Terminal 3 of Jiangbei Airport Station (20191224220621).jpg", why: "a metro platform" },
    ] },
  "cn26-stay-05": { none: "no free photo of the hotel on Wikimedia Commons or in the free libraries" },
  "cn26-spot-lijiang-dongba": { none: "every free photo is an exhibit inside, none the museum you would walk to", rejected: [
      { file: "File:Lijiang Oct 2007 205.jpg", why: "a portrait of a Dongba scribe at work inside" },
      { file: "File:Lijiang Oct 2007 206.jpg", why: "a chart of the Dongba script" },
      { file: "File:Lijiang Oct 2007 207.jpg", why: "a chart of the Dongba script" },
      { file: "File:Lijiang Oct 2007 208.jpg", why: "a chart of the Dongba script" },
      { file: "File:Lijiang Oct 2007 209.jpg", why: "a ritual display inside" },
      { file: "File:Lijiang Oct 2007 214.jpg", why: "an exhibit inside" },
      { file: "File:Lijiang Oct 2007 218.jpg", why: "a painting inside" },
      { file: "File:Lijiang Oct 2007 224.jpg", why: "figures on a shelf inside" },
    ] },
  "cn26-spot-gorge-tea-horse": { none: "no free photo that shows the guesthouse", rejected: [
      { file: "File:Yunnan pigsty 1.JPG", why: "a pigsty — nothing of the guesthouse" },
      { file: "File:Small roll of Chinese toilet paper.JPG", why: "a roll of toilet paper" },
      { file: "File:Football padlock.JPG", why: "a padlock" },
      { file: "openverse:d9400528-9bf7-4171-82b9-457b1c4279a8", why: "titled for the guesthouse (“first night”) but it shows a hillside and a few houses — which, if any, is the guesthouse cannot be told" },
      { file: "openverse:39936f03-568f-459d-97fc-d969315c9377", why: "Westcombe, a farm in England — an Openverse false match" },
    ] },
  "cn26-stay-07": { none: "no free photo that shows the guesthouse", rejected: [
      { file: "openverse:cde5a590-1351-456c-8ccc-72952e11bcf7", why: "mountains after sunset — the view from the gorge, not the guesthouse" },
    ] },
  "cn26-spot-dali-caicun": { photo: "File:大理才村的洱海 04.jpg", shows: "the lake shore at Caicun, a jetty out into Erhai (the photographer’s own “Erhai at Caicun”)", rejected: [
      { file: "File:Yun L66482 at Sanyuejiekou (20200122144931).jpg", why: "a bus at Sanyuejiekou" },
    ] },
  "cn26-spot-dali-zhonghe": { none: "no free photo that can be tied to the Zhonghe chairlift", rejected: [
      { file: "File:Fala Bridge 4.jpg", why: "the Fala Bridge, 177 km away" },
      { file: "File:Fala Bridge 3.jpg", why: "the Fala Bridge, 177 km away" },
      { file: "File:Fala Bridge 5.jpg", why: "the Fala Bridge, 177 km away" },
    ] },
  "cn26-spot-dali-ximatan": { none: "no free photo that can be tied to the Ximatan cableway", rejected: [
      { file: "File:远看苍山洗马潭索道 - panoramio.jpg", why: "the Cangshan range from 5 km — the cableway cannot be seen in it" },
      { file: "File:苍山索道.jpg", why: "a Cangshan cableway — the file does not say which of the three" },
      { file: "File:中國大理154.jpg", why: "a poster board about building a cableway" },
      { file: "File:中國大理152.jpg", why: "a Cangshan cableway — which of the three is not said" },
      { file: "File:中國大理46.jpg", why: "a cableway station — which of the three is not said" },
      { file: "File:中國大理53.jpg", why: "a Cangshan cableway — which of the three is not said" },
      { file: "File:苍山索道2.jpg", why: "a chairlift — most likely Zhonghe’s, not Ximatan’s" },
      { file: "File:苍山索道3.jpg", why: "a Cangshan cableway — which of the three is not said" },
      { file: "File:感通索道下站站房.jpg", why: "the Gantong cableway’s lower station — another cableway" },
    ] },
  "cn26-spot-dali-zhoucheng": { none: "no free photo that can be tied to Zhoucheng", rejected: [
      { file: "File:宾川州城红军长征过大理陈列馆.jpg", why: "a namesake — a museum in Binchuan, 50 km away" },
      { file: "File:Dali 2007 183.jpg", why: "a Bai house its file places only as “Dali 2007” — nothing ties it to Zhoucheng" },
    ] },
  "cn26-spot-dali-foreigner-street": { photo: "File:大理洋人街 - panoramio.jpg", shows: "Foreigner Street’s café terraces at night (大理洋人街, in Commons’ “Streets in Dali Ancient City”, 580 m from the pin)", rejected: [
      { file: "File:洋人街裸女背影 - panoramio.jpg", why: "a namesake — Chongqing’s Foreigner Street, 770 km away" },
      { file: "File:洋人街山顶N15°W - panoramio.jpg", why: "a namesake — Chongqing’s Foreigner Street, 770 km away" },
      { file: "openverse:1f337392-9aff-425e-a667-818cec300664", why: "passed over: the same street by day, on Flickr" },
      { file: "openverse:a7881d9b-3aa6-428e-b51e-9e21433a6e84", why: "a European town street — an Openverse false match" },
      { file: "openverse:6fe7cc81-a1d1-44c6-90e4-3844e62b7176", why: "a European town street — an Openverse false match" },
    ] },
  "cn26-spot-dali-jade-belt": { photo: "openverse:e4ac772e-9e09-4262-a0d1-aa244e7eefae", shows: "the Jade Belt Road — the Cloud Road — cut along the Cangshan cliff, a railing and a walker (tagged “jadebeltroad” by its photographer)", rejected: [
      { file: "File:江都玉带路 - panoramio.jpg", why: "a namesake — Jiangdu’s 玉带路 in Jiangsu, 2,000 km away" },
      { file: "File:苍山玉带路景区旅游导览示意图.jpg", why: "a tourist map board of the Cangshan trails, not the road" },
    ] },
  "cn26-spot-dali-longkan": { none: "no free photo of the wharf", rejected: [
      { file: "File:杭州.玉皇山（天龙寺造像.观音龛） - panoramio.jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
      { file: "File:杭州.玉皇山（天龙寺造像.弥勒龛） - panoramio.jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
      { file: "File:杭州.玉皇山（天龙寺造像.弥勒龛） - panoramio (2).jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
      { file: "File:杭州.玉皇山（天龙寺造像.弥勒龛） - panoramio (3).jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
      { file: "File:杭州.玉皇山（天龙寺造像.弥勒龛） - panoramio (1).jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
      { file: "File:杭州.玉皇山（天龙寺造像.观音龛） - panoramio (1).jpg", why: "the Tianlong Temple carvings on Yuhuang Hill, Hangzhou — 2,018 km away" },
    ] },
  "cn26-spot-kunming-wenlin": { none: "no free photo of the street", rejected: [
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street tunnel September 2022 Px3 01.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 16.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 01.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 11.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 13.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 07.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 14.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
      { file: "File:HK 沙田 Sha Tin 文林路 Man Lam Road 沙田正街 Shatin Centre Street 植物 green leaves September 2022 Px3 10.jpg", why: "a namesake — Man Lam Road (文林路) in Sha Tin, Hong Kong, 1,206 km away" },
    ] },
  "cn26-spot-kunming-zhengyi": { photo: "File:Zhengyi Lu Pedestrian Mall.jpg", shows: "the pedestrian mall on Zhengyi Road in the centre of Kunming (in Commons’ “Zhengyi Road, Kunming”)", rejected: [
      { file: "File:South start of Zhengyi Rd (20210517120317).jpg", why: "a namesake — another Zhengyi Road, 2,087 km away" },
      { file: "File:Law firms in Wuhan, Hubei, China.jpg", why: "law firms in Wuhan" },
      { file: "File:Zhengyi Lu.jpg", why: "passed over: a plainer stretch of the same road" },
      { file: "File:Kunming - evening - P1340565.JPG", why: "Renmin Road, Kunming — another street" },
    ] },
  "cn26-spot-hongkong-lung-king-heen": { none: "no free photo of the restaurant — only its dishes", rejected: [
      { file: "openverse:e32b9233-d7c2-4629-bed3-03b5d2f140b6", why: "One Dim Sum — another restaurant" },
      { file: "openverse:082a2e4e-e9aa-4cd2-8591-444f67d4034f", why: "dishes on a table — nothing of the restaurant you would look for" },
      { file: "openverse:3184ad3b-7164-48e2-96bf-00241c67a3a9", why: "dishes on a table" },
      { file: "openverse:58d3b079-3ab3-448b-917d-80dc900457e0", why: "dishes on a table" },
      { file: "openverse:7098e591-7bba-469c-ae16-2553b854b5aa", why: "dishes on a table" },
      { file: "File:Location map Hong Kong Island.png", why: "a location map of Hong Kong Island" },
      { file: "File:One Dim Sum, Michelin-Star Fast Food Dim Sum in Hong Kong SML.20120818.IP3 (7809374102).jpg", why: "One Dim Sum — another restaurant" },
    ] },
  "cn26-spot-hongkong-coloane": { photo: "File:Coloane Village 27-10-2023(6).jpg", shows: "a lane of Coloane Village’s painted old houses (10 m from the pin)", rejected: [
      { file: "File:Hac Sa Beach 01.JPG", why: "Hac Sa Beach — Coloane’s beach, 2 km from the village" },
      { file: "File:Centro De Exm. De Condução Dos Auto. Pesados bus stop 02-03-2023.jpg", why: "a bus stop by a building site" },
      { file: "File:Centro Náutico de Cheoc Van 12-03-2024.jpg", why: "the Cheoc Van nautical centre, 1 km away" },
      { file: "File:Cheoc Van Barbecue Park 31-03-2024(1).jpg", why: "the Cheoc Van barbecue park, 1.2 km away" },
      { file: "File:Cheoc Van Barbecue Park 31-03-2024(2).jpg", why: "the Cheoc Van barbecue park, 1.2 km away" },
    ] },
  "cn26-place-24": { none: "no free photo of the clinic", rejected: [
      { file: "File:SZ 深圳 Shenzhen 福田 Futian 深南大道 Shennan Blvd 崗廈北站 Gangxia North Station night December 2024 R12S 01.jpg", why: "Gangxia North metro station, 90 m away — not the clinic" },
      { file: "File:SZ 深圳 Shenzhen 福田 Futian 深南大道 Shennan Blvd 崗廈北站 Gangxia North Station night December 2024 R12S 02.jpg", why: "Gangxia North metro station — not the clinic" },
      { file: "File:深南大道 Shen Nan Da Dao - panoramio (4).jpg", why: "Shennan Boulevard at night — not the clinic" },
    ] },
};
