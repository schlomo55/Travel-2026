# ROUND 5 — THE MAP TAB (3 options) — Horizon, DARK ONLY

Owner's ask: "a tab for maps that will be detailed and easy to work with, with the current location and all the
spots we have in the app linked to the maps, with an icon depending on the type" + free hand for the best UX.
Look: HORIZON.md (dark only — the owner removed Daylight). Nav now has FOUR places: **Now · Journey · Map · Pocket**
+ the round Find button (Map active on these boards). Screens 412×915. No emoji; inline stroke icons; 44px targets.

## The data truth (never draw what isn't there)
- 143 recommended SPOTS (kind: sight 105 · food 12 · show 9 · transport 16 · other 1) — **none has a coordinate**.
  Each has a verified Chinese name (`native`) + `mapQuery` + `mapCity`, so it OPENS correctly in Amap / Google /
  any maps app BY NAME — it just can't be placed on an in-app map. Show them in lists with "No pin yet".
- PINNED today (real WGS-84 coords): 22 place/driver cards, 10 bookings (airports, park gate, Tianmen), 10 cities.
- A proposed fix (Step 0 of the plan): a build-time pass that looks every spot up in OpenStreetMap and stores the
  coordinate ONLY when the name matches and the distance is sane (the existing verify:places rules). You may show
  this as a note like "Pins for the other 29 places: after the coordinate pass" — never as fake pins.

## The moment
**Tue 8 Dec, 08:30, Beijing** — staying at Blossom House (Houhai district). Day plan "Spa day — legs fresh for
skiing": Clinical morning 护国寺中医医院 骨伤科 bone-setting (航空胡同42号) · All-day hot springs at Jiuhua Resort,
Xiaotangshan (~1 h north, ¥138 day pass — ring ahead) · Dinner: 南门涮肉 Nanmen Hotpot (copper-pot mutton) ·
Grey-day swap: the National Museum (reserve 7 days ahead) · Early night.
**You (example GPS position)**: Houhai, 39.9380 N 116.3871 E — label it "You · example position" on the boards.

Pinned places around you (distance · bearing from Houhai, computed from real coords):
| place | Chinese | distance | bearing | type |
|---|---|---|---|---|
| Huguosi TCM Hospital — 骨伤科 bone-setting, Dec 8 morning | 护国寺中医医院 | 1.6 km | 269° W | medical |
| Beijing Massage Hospital — blind massage / tuina | 北京按摩医院 | 1.9 km | 255° WSW | medical |
| Sanlitun — Four Points, Taikoo Li | 三里屯 | 5.3 km | 92° E | district |
| Beijing South Railway Station | 北京南站 | 8.4 km | 188° S | station |
| Beijing Capital Airport T3 (PEK) | 北京首都国际机场 3号航站楼 | 23.5 km | 53° NE | airport |
| Beijing Daxing Airport (PKX) — Dec 11 departure (CA8609) | 北京大兴国际机场 | 47.7 km | 178° S | airport |
| Houhai — Blossom House district (you are here) | 后海 | 0 | — | district |
Beijing's 29 spots (no pins): Palace Museum 故宫博物院 · Jingshan Park 景山公园 · Beihai Park 北海公园 · Drum Tower 鼓楼 ·
Bell Tower 钟楼 · Shichahai / Houhai 什刹海 · Nanluoguxiang 南锣鼓巷 · Lama Temple 雍和宫 · National Museum of China
中国国家博物馆 · Capital Museum 首都博物馆 · Wangfujing 王府井 · Temple of Heaven 天坛 · Summer Palace 颐和园 · 798 Art
District 798艺术区 · Beijing Ancient Observatory 北京古观象台 · Panjiayuan antique market 潘家园旧货市场 · Ming Tombs 明十三陵 ·
Mutianyu Great Wall 慕田峪长城 · Jinshanling Great Wall 金山岭长城 · Jiuhua Resort hot springs 九华山庄 · Chunhuiyuan hot
springs 春晖园温泉度假村 (sights) · Yaoji Chaogan 姚记炒肝 · Dong Lai Shun 东来顺 · Siji Minfu · Peking duck 四季民福 (food)
· Lao She Teahouse 老舍茶馆 · NCPA "the Egg" 国家大剧院 · Beijing Concert Hall 北京音乐厅 (shows) · Beijing North station
北京北站 · Qinghe station 清河站 (transport).
Trip-wide counts (for an "all cities" view): Kunyu 10 · Beijing 29 · Chongli 4 · Zhangjiajie 11 · Chongqing 14 ·
Lijiang 13 · Tiger Leaping Gorge 2 · Dali 13 · Kunming 8 · Hong Kong 39 spots (+ 28 driver cards, 22 pinned).

## Actions on every place (the point of the tab)
[Open in maps] (Android's chooser — Amap first on the mainland; the name is searched, or the pin used, as today) ·
[Driver card] (the Chinese full-screen white card) · [Copy address] · [Add to my day] (for spots) · distance only
as straight-line "≈ 1.6 km W" (never an invented walking time).

## Shared icon set (use EXACTLY these; 24×24, stroke 1.8, round caps/joins; icon colour = type colour)
- sight (mountain) `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>` — colour #FF9F6B (sunrise)
- food (bowl + chopsticks) `<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M6 19h12"/><path d="m14 3-4 7"/><path d="m18 3-4 7"/>` — #FF7EB6 (rose)
- show (ticket) `<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/>` — #B69CFF (lilac)
- station / transport (train front) `<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>` — #7FE3F0 (aqua)
- airport (plane) `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>` — #7FE3F0 (aqua)
- hotel (bed) `<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>` — #F4F2FA (ink)
- medical (cross) `<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>` — #F4F2FA (ink) on a disc with a white ring
- district (pin) `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>` — #B4B3C8 (ink-2)
- city (star) `<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z"/>` — #FF9F6B
- you: a filled #FF9F6B disc (10px) with a `ping` ring and a soft sunrise halo — the only filled pin.
Map pin = 34px disc, fill #1D2035 (card-2), 1.5px ring in the type colour, the icon in the type colour at 18px;
SELECTED pin = filled type colour with #0B0C16 icon + a label bubble. Status colours (ok/warn/crit) stay reserved
for booking states — never used as type colours.

## The three options (each: 3 boards, 412×915, prototype-linked between its own boards)
### Option 1 · RADAR — "around you" (files map1-radar, map1-place, map1-filter)
Offline, no street data. The screen is centred on YOU: rings at 1 km · 5 km · 25 km · 50 km (log-scaled so near
things are readable), each pinned place drawn at its true bearing, north up (N marker), the ring labels in
Martian Mono. Below, a sheet: filter chips with counts (All · Sights 21 · Food 3 · Shows 3 · Transport 2 · Medical 2
· Airports 2 …), then "Near you" sorted by distance with a small direction arrow + "≈ 1.6 km W"; unpinned places
follow in a "No pin yet — open by name" group. `map1-place`: the Huguosi TCM Hospital sheet (Chinese name large,
English, "Dec 8 morning · bone-setting 骨伤科", address 航空胡同42号, ☎ 56895700, "≈ 1.6 km W", the four actions,
and a mini radar with the bearing). `map1-filter`: the Food filter on — pinned food: none in Beijing, so it shows
the 3 food spots as by-name cards (honest empty map state: "No food pins here yet — open by name").
### Option 2 · ATLAS — a real offline street map (files map2-atlas, map2-place, map2-download)
A detailed street map drawn in Horizon night colours (roads as soft lines, water as deep indigo, parks as a faint
green-black, labels in Figtree) — the future state after downloading OpenStreetMap map data for each city at setup.
Draw the streets as a clearly schematic ILLUSTRATION (a caption "Illustration · real data from OpenStreetMap" in faint
text) — do not pretend it is accurate Beijing. The YOU dot is sunrise with a heading cone; typed pins with
clustering ("+12"); zoom buttons; a layer/filter button; a bottom sheet at peek ("12 places in view · 29 more by name").
`map2-place`: a pin tapped → sheet with the same four actions. `map2-download`: "Maps for offline use" — one row per
city with its state (Beijing ready ✓ · Zhangjiajie · Chongqing · Lijiang … download on Wi-Fi) and an honest line
"Needs a one-time download before the trip; the app itself never goes online for maps" — no invented MB numbers
(write "size shown before download").
### Option 3 · PLACES BOARD — list-first, map as a header (files map3-board, map3-place, map3-trip)
A beautiful directory: a slim constellation header of the city with its pins and YOU; a city switcher (Beijing ·
Chongli · Zhangjiajie · … with counts); type filter chips; places as rich rows grouped by type — icon disc, English +
Chinese name, one line of why, distance "≈ 1.6 km W" when pinned or "No pin yet · opens by name" — each with two big
buttons [Open in maps] [Driver card]. `map3-place`: the Palace Museum 故宫博物院 expanded (no pin: "opens by name in
Amap"), actions, "Add to my day". `map3-trip`: the trip-wide view — all 10 cities as a list/grid with their counts
by type and pins vs by-name, tap a city to jump.
