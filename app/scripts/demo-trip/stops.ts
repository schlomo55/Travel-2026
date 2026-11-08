/* The demo trip's stops, their guide text and their places.

   The places are REAL PUBLIC PLACES — temples, parks, museums, stations,
   viewpoints — with city-grade or POI-grade coordinates, because the map,
   the weather and the day routes need something to draw. Every bed, school,
   clinic and restaurant that a traveller would BOOK or be KNOWN at is a
   "Sample …" invention instead. Nothing here is anyone's itinerary. */
import type { ContentBlock, PlaceCategory, Spot, Stop } from '../../src/lib/model/types';
import { c, STOP_IDS, TRIP_ID, type StopKey } from './base';

type Pos = { lat: number; lng: number };
interface SpotIn {
  slug: string;
  name: string;
  native?: string;
  kind: Spot['kind'];
  category?: PlaceCategory;
  detail?: string;
  pin?: Pos;
  coord?: Pos;
  q?: string; // mapQuery, default: native ?? name
  city?: string; // mapCity, default: the stop's
  address?: string;
  rating?: number;
  verify?: boolean;
}
const spots = (key: StopKey, city: string, list: SpotIn[]): Spot[] =>
  list.map((s) => ({
    id: `dm27-spot-${key}-${s.slug}`,
    name: s.name,
    ...(s.native ? { native: s.native } : {}),
    kind: s.kind,
    category: s.category ?? (s.kind === 'other' ? 'sight' : s.kind),
    ...(s.detail ? { detail: s.detail } : {}),
    ...(s.coord ? { coord: s.coord } : {}),
    ...(s.pin ? { pin: s.pin } : {}),
    mapQuery: s.q ?? s.native ?? s.name,
    mapCity: s.city ?? city,
    ...(s.address ? { address: s.address } : {}),
    ...(s.rating !== undefined ? { rating: s.rating } : {}),
    ...(s.verify ? { verify: true } : {}),
  }));

const block = (stop: StopKey, k: string, heading: string, items: string[], dayRows?: { label: string; text: string }[]): ContentBlock => ({
  id: `${STOP_IDS[stop]}-${k}`,
  heading,
  items,
  ...(dayRows ? { dayRows } : {}),
});

export function buildStops(photo: Partial<Record<StopKey, string>>): Stop[] {
  const base = (key: StopKey, order: number) => ({
    id: STOP_IDS[key],
    tripId: TRIP_ID,
    order,
    ...(photo[key] ? { photoDocId: photo[key] } : {}),
  });

  return [
    {
      ...base('flights', 0),
      kind: 'transit',
      name: 'International Flights',
      emoji: '✈️',
      hue: 220,
      start: '2027-03-19',
      end: '2027-03-20',
      nights: 1,
      whenLabel: 'Fri Mar 19 → Sat Mar 20 · overnight',
      costNote: '≈$1,150 return (sample fare)',
      blocks: [
        block('flights', 'b0', '✈️ Outbound', [
          'Fri Mar 19: **AY1501**, Paris CDG 11:05 → Helsinki 15:20, then **AY9057**, Helsinki 17:30 → Shanghai Pudong (PVG) 08:50 next morning',
          'One sample booking reference covers all four legs — **DEMOAY**',
        ]),
        block('flights', 'b1', '✈️ Home', [
          'Sat Apr 17: **AY9070**, Hong Kong 23:55 → Helsinki 06:05, then **AY1506**, Helsinki 08:00 → Paris CDG 09:40 on Sun Apr 18',
        ]),
        block('flights', 'b2', '🧳 Bags', ['23 kg checked on the long-haul legs — the domestic flights allow **20 kg**, so pack to 20']),
      ],
      recoBlocks: [],
    },
    {
      ...base('hangzhou', 1),
      kind: 'stop',
      name: 'Tai-chi school — Hangzhou',
      emoji: '🥋',
      hue: 0,
      start: '2027-03-21',
      end: '2027-03-29',
      nights: 8,
      whenLabel: 'Sun Mar 21 → Mon Mar 29',
      costNote: '$720 cash (sample fee)',
      coord: c(30.2431, 120.1507),
      mapQuery: '西湖',
      mapCity: '杭州',
      metro: true,
      detail:
        'Eight nights at a **sample tai-chi school** in the tea hills west of the lake: two sessions a day, simple rooms, meals in the school canteen. The school collects you from the station inn on the Sunday morning; Monday to Saturday is training, and **Sunday is the free day** for the lake, the temples and laundry.\n\nThe city is easy: the metro reaches the lake shore, and the tea villages are a bus ride up the valley. Evenings are early — lights out around 21:30.',
      blocks: [
        block('hangzhou', 'b0', '🚄 Getting there', [
          'Sat Mar 20: land at **Pudong (PVG) 08:50**, metro to **Hongqiao station**, then the **G7501 13:00 → Hangzhou East 13:55** (✅ booked, sample) · fallback if the flight is late: a later train, any of the many that day',
        ]),
        block('hangzhou', 'b1', '🛏 Sleep', [
          'Mar 20: **Sample Station Inn**, by Hangzhou East — ✅ booked, ¥260 (sample)',
          'Mar 21–29: the school dormitory — ✅ held, paid in cash on arrival',
        ]),
        block('hangzhou', 'b2', '🗓 Day by day', [], [
          { label: 'Mon–Sat', text: '06:30 qigong → breakfast → morning form → lunch → push-hands → evening free' },
          { label: 'Sunday', text: 'Free: the lake, Lingyin Temple, the tea village' },
        ]),
        block('hangzhou', 'b3', '💰 Costs', ['School $720 for the week, cash · the inn ¥260 · the train ¥73 (all sample figures)']),
        block('hangzhou', 'b4', '💡 Tips', ['Bring indoor shoes for the hall — the school asks for them', 'Cash for the school fee: **US$720 in an envelope**']),
      ],
      recoBlocks: [
        block('hangzhou', 'r0', '🎯 See & do', ['**West Lake** at dawn, before the tour groups', '**Lingyin Temple** and the carved Buddhas of Feilai Feng', '**Longjing village** — tea terraces and a tasting in a farmhouse']),
        block('hangzhou', 'r1', '🍜 Food & drink', ['**Dongpo pork** and **West Lake fish in vinegar** — the two Hangzhou classics', 'Longjing tea, bought in the village rather than on the lake front']),
        block('hangzhou', 'r2', '💡 Good to know', ['The lake loop is 15 km — rent a public bike for half of it']),
      ],
      options: [
        block('hangzhou', 'o0', '⭐ Our picks', [
          '⭐ **West Lake at sunrise** — the Su Causeway end to end before 08:00',
          '⭐ **Lingyin Temple** early, then the path up Feilai Feng',
          '⭐ **Longjing village** — a farmhouse tasting, then the walk down to Jiuxi',
        ]),
        block('hangzhou', 'o1', '➕ More options', [
          '**Leifeng Pagoda** at golden hour, across the lake from the causeway',
          '**Hefang Street** for snacks on a free evening',
          '**Xixi Wetland** — boats through the reeds, a half day *(verify the spring hours)*',
        ]),
        block('hangzhou', 'o2', '🍜 Where to eat', ['**Sample Lakeside Noodle House** — the school\'s Sunday favourite, ¥30pp']),
      ],
      spots: spots('hangzhou', '杭州', [
        { slug: 'west-lake', name: 'West Lake', native: '西湖', kind: 'sight', detail: 'The Su Causeway end to end before 08:00', pin: c(30.2431, 120.1507), rating: 5 },
        { slug: 'lingyin', name: 'Lingyin Temple', native: '灵隐寺', kind: 'sight', detail: 'The carved Buddhas of Feilai Feng on the way in', pin: c(30.2408, 120.1012), address: '浙江省杭州市西湖区灵隐路法云弄1号' },
        { slug: 'longjing', name: 'Longjing village', native: '龙井村', kind: 'sight', detail: 'Tea terraces and a tasting in a farmhouse', pin: c(30.2295, 120.1236) },
        { slug: 'leifeng', name: 'Leifeng Pagoda', native: '雷峰塔', kind: 'sight', pin: c(30.2311, 120.1489) },
        { slug: 'hefang', name: 'Hefang Street', native: '河坊街', kind: 'food', category: 'food', detail: 'Snacks on a free evening', pin: c(30.2418, 120.1702) },
        { slug: 'xixi', name: 'Xixi Wetland', native: '西溪湿地', kind: 'sight', detail: 'Boats through the reeds, a half day', verify: true },
      ]),
    },
    {
      ...base('shanghai', 2),
      kind: 'stop',
      name: 'Shanghai',
      emoji: '🌃',
      hue: 30,
      start: '2027-03-29',
      end: '2027-04-02',
      nights: 4,
      whenLabel: 'Mon Mar 29 → Fri Apr 2 · two beds',
      costNote: '≈$540',
      coord: c(31.2304, 121.4737),
      mapQuery: '人民广场',
      mapCity: '上海',
      metro: true,
      detail:
        'Four nights in the big city, in two beds: two nights by the Bund, two in a lane house near Xintiandi. The **Shanghai Museum East** is the one thing that needs a ticket ahead — it is **closed on Mondays**, so the visit is Tuesday. Wednesday is a guided walk out to the water town of Zhujiajiao.\n\nEverything else is the metro and your feet: the Bund at night, Yu Garden in the morning before the crowds, the plane-tree streets of the old French Concession in the afternoon.',
      blocks: [
        block('shanghai', 'b0', '🚄 Getting there', ['Mon Mar 29: **G7520, Hangzhou East 10:10 → Shanghai Hongqiao 11:05** — ✅ booked (sample)']),
        block('shanghai', 'b1', '🛏 Sleep — two beds (BOTH BOOKED)', [
          'Mar 29–31: **Sample Bund Hotel**, Huangpu — ✅ booked, ¥1,180 (2n)',
          'Mar 31 – Apr 2: **Sample Lane House**, Xintiandi — ✅ booked, ¥960 (2n)',
        ]),
        block('shanghai', 'b2', '🗓 Day by day', [], [
          { label: 'Mar 30', text: '**Museum Tuesday** — the Shanghai Museum East, then Lujiazui at dusk' },
          { label: 'Mar 31', text: 'Guided walk in **Zhujiajiao** → move to the lane house' },
          { label: 'Apr 1', text: 'Yu Garden early, Tianzifang, the French Concession on foot' },
        ]),
        block('shanghai', 'b3', '💰 Costs', ['Museum free with a timed booking · Zhujiajiao walk ¥380 · beds ¥2,140 (sample)']),
      ],
      recoBlocks: [
        block('shanghai', 'r0', '🎯 See & do', ['**The Bund** after dark, from the river side', '**Yu Garden** at opening', '**Jing\'an Temple** — gold roofs between towers']),
        block('shanghai', 'r1', '🍜 Food & drink', ['**Xiaolongbao** at Nanxiang, by Yu Garden — expect a queue', '**Shengjian** pan-fried buns for breakfast']),
        block('shanghai', 'r2', '💡 Good to know', ['The museum books **7 days ahead at 20:00**, against the passport']),
        block('shanghai', 'r3', '🧭 Getting around', ['Metro Line 2 links both airports, Hongqiao station and East Nanjing Road']),
      ],
      options: [
        block('shanghai', 'o0', '⭐ Our picks', [
          '⭐ **The Bund at night** — from the Huangpu promenade, then the ferry across for ¥2',
          '⭐ **Yu Garden** at 08:30, before the groups',
          '⭐ **Shanghai Museum East** — the bronzes and the calligraphy halls',
        ]),
        block('shanghai', 'o1', '➕ More options', [
          '**Jing\'an Temple** on the way to the French Concession',
          '**Tianzifang** lanes in the afternoon',
          '**Lujiazui** skywalk at dusk *(verify the ticket)*',
          '**Fuxing Park** in the morning — dancing, cards, tai-chi',
        ]),
        block('shanghai', 'o2', '🍜 Where to eat', ['⭐ **Nanxiang Mantou Dian** by Yu Garden — xiaolongbao, ¥60pp', '**Sample Lane Kitchen** — the lane house\'s neighbour, home cooking']),
      ],
      spots: spots('shanghai', '上海', [
        { slug: 'bund', name: 'The Bund', native: '外滩', kind: 'sight', detail: 'From the river side after dark', pin: c(31.2400, 121.4903), rating: 5 },
        { slug: 'yuyuan', name: 'Yuyuan Garden', native: '豫园', kind: 'sight', detail: 'At opening, before the groups', pin: c(31.2272, 121.4921), address: '上海市黄浦区安仁街218号' },
        { slug: 'museum-east', name: 'Shanghai Museum East', native: '上海博物馆东馆', kind: 'sight', detail: 'The bronzes and the calligraphy halls', pin: c(31.2213, 121.5531) },
        { slug: 'jingan', name: 'Jing\'an Temple', native: '静安寺', kind: 'sight', pin: c(31.2235, 121.4453) },
        { slug: 'tianzifang', name: 'Tianzifang', native: '田子坊', kind: 'sight', pin: c(31.2083, 121.4686) },
        { slug: 'lujiazui', name: 'Lujiazui', native: '陆家嘴', kind: 'sight', pin: c(31.2397, 121.4998) },
        { slug: 'nanxiang', name: 'Nanxiang Mantou Dian', native: '南翔馒头店', kind: 'food', detail: 'Xiaolongbao, expect a queue', pin: c(31.2275, 121.4925) },
        { slug: 'zhujiajiao', name: 'Zhujiajiao water town', native: '朱家角', kind: 'sight', detail: 'Canals and stone bridges, an hour west' },
      ]),
    },
    {
      ...base('suzhou', 3),
      kind: 'stop',
      name: 'Suzhou + the gardens',
      emoji: '🏯',
      hue: 205,
      start: '2027-04-02',
      end: '2027-04-04',
      nights: 2,
      whenLabel: 'Fri Apr 2 → Sun Apr 4',
      costNote: '≈$150 planned — the bed is booked, the rest is not',
      warn: '✅ **The bed is booked** — the Sample Canal Hostel on Pingjiang Road. ⏳ **The train and the garden ticket are not**, each dated on Tasks. The Sample Lakeside Resort was cancelled — nothing charged.',
      detail:
        'Two nights in the garden city between Shanghai and the mountains. The shape is simple: the Friday train out of Shanghai, Saturday for the **Humble Administrator\'s Garden** and the canal lanes, and Sunday back to Shanghai Hongqiao for the evening flight to Huangshan.\n\nThe bed is booked: a **sample hostel on Pingjiang Road**, a canal-side lane with teahouses. The garden ticket is timed and sells out on spring weekends, so it carries a dated task.',
      blocks: [
        block('suzhou', 'b0', '🚄 Getting there', ['Fri Apr 2: an HSR from Shanghai, ~30 min — **not booked yet**, any train that day']),
        block('suzhou', 'b1', '🛏 Sleep — Sample Canal Hostel, Pingjiang Road (✅ BOOKED)', ['Apr 2–4: private double, ¥420 (2n, sample) · the Sample Lakeside Resort was cancelled']),
        block('suzhou', 'b2', '🗓 Day by day', [], [
          { label: 'Apr 3', text: 'The **Humble Administrator\'s Garden** at opening, then Pingjiang Road and a canal boat' },
          { label: 'Apr 4', text: 'A slow morning, then back to Shanghai **Hongqiao** for the 19:10 flight' },
        ]),
        block('suzhou', 'b3', '💰 Costs', ['Garden ¥90 · train ¥40 · hostel ¥420 (sample)']),
      ],
      recoBlocks: [],
      options: [
        block('suzhou', 'o0', '📌 The plan', ['Garden on Saturday, the rest of the city at walking pace']),
        block('suzhou', 'o1', '🌿 Sat 3 Apr — the gardens', [
          '⭐ **The Humble Administrator\'s Garden** at 07:30 opening',
          '**The Lingering Garden** in the afternoon *(verify the hours)*',
          '**Pingjiang Road** after dark',
        ]),
        block('suzhou', 'o2', '✈️ Sun 4 Apr — out via Hongqiao', ['Back to Shanghai Hongqiao by train, then the airport next door — **Hongqiao (SHA), not Pudong**']),
      ],
    },
    {
      ...base('huangshan', 4),
      kind: 'stop',
      name: 'Huangshan',
      emoji: '🏔',
      hue: 150,
      start: '2027-04-04',
      end: '2027-04-07',
      nights: 3,
      whenLabel: 'Sun Apr 4 → Wed Apr 7 · 2n mountain + 1n town',
      costNote: '≈$310',
      coord: c(30.1333, 118.1667),
      mapQuery: '黄山风景区',
      mapCity: '黄山',
      address: '安徽省黄山市黄山区汤口镇',
      metro: false,
      detail:
        'Granite peaks, crooked pines and a sea of cloud — the mountain every Chinese landscape painting is quietly about. Two nights at the foot of the mountain in Tangkou, one in the old town of Tunxi.\n\nThe park pass covers two days *(verify when buying)*. The cableways save the knees; the stone steps are the real way up and down. Spring mornings are the clear ones — start early.',
      blocks: [
        block('huangshan', 'b0', '✈️ Getting there', [
          'Sun Apr 4 eve: **MU5001, Shanghai Hongqiao (SHA) 19:10 → Huangshan Tunxi (TXN) 20:25** — ✅ booked (sample) · the earlier MU5003 from Pudong was cancelled · then ~50 min to Tangkou, in ≈21:30',
        ]),
        block('huangshan', 'b1', '🛏 Sleep — two bases (BOTH BOOKED)', [
          'Apr 4–6: **Sample Pine Lodge**, Tangkou — ✅ booked, ¥820 (2n) · 400 m to the Yungu cableway bus',
          'Apr 6–7: **Sample Old Street Hotel**, Tunxi — ✅ booked, ¥380',
        ]),
        block('huangshan', 'b2', '🗓 Day by day', [], [
          { label: 'Apr 5', text: 'Up on foot from the east steps to **Shixin Peak** and the **Bright Summit**' },
          { label: 'Apr 6', text: '**Yungu cableway** at 07:30 → the **West Sea Grand Canyon** → down to Tunxi' },
        ]),
        block('huangshan', 'b3', '💰 Costs', ['Park pass ¥190 (2 days, sample) · cableway ¥80 · beds ¥1,200']),
        block('huangshan', 'b4', '💡 Tips', ['Start at first entry so the steps finish in daylight', 'Fallback in fog: the low valley paths, and save the peaks for the first clearing']),
      ],
      recoBlocks: [
        block('huangshan', 'r0', '🎯 See & do', ['**West Sea Grand Canyon** — the loop on cliff-hung paths', '**Welcome Pine** — the most painted tree in China', '**Hongcun** — the water village at the foot of the range *(verify the bus)*']),
        block('huangshan', 'r1', '🍜 Food & drink', ['**Stinky mandarin fish** in Tunxi — better than it sounds', 'Huangshan Maofeng tea, from the slopes you walked']),
        block('huangshan', 'r2', '💡 Good to know', ['The cableways pause in high wind — never plan the last descent tight']),
      ],
      options: [
        block('huangshan', 'o0', '⭐ Our picks', ['⭐ **Bright Summit at sunrise**', '⭐ **West Sea Grand Canyon** loop', '⭐ **Shixin Peak** — the short climb with the long view']),
        block('huangshan', 'o1', '➕ More options', ['**Welcome Pine** on the way down', '**Tunxi Old Street** in the evening', '**Hongcun** water village, a half day *(verify the bus)*']),
        block('huangshan', 'o2', '🍜 Where to eat', ['**Sample Mountain Kitchen**, Tangkou — bamboo shoots and tea-smoked tofu']),
      ],
      spots: spots('huangshan', '黄山', [
        { slug: 'bright-summit', name: 'Bright Summit Peak', native: '光明顶', kind: 'sight', detail: 'Sunrise over the sea of cloud', pin: c(30.1355, 118.1669), rating: 5 },
        { slug: 'west-sea', name: 'West Sea Grand Canyon', native: '西海大峡谷', kind: 'sight', detail: 'The loop on cliff-hung paths', pin: c(30.1381, 118.1528) },
        { slug: 'shixin', name: 'Shixin Peak', native: '始信峰', kind: 'sight', pin: c(30.143, 118.177) },
        { slug: 'welcome-pine', name: 'Welcome Pine', native: '迎客松', kind: 'sight', detail: 'The most painted tree in China', pin: c(30.1236, 118.1725) },
        { slug: 'yungu', name: 'Yungu cableway', native: '云谷索道', kind: 'transport', detail: 'Ride up, walk down', pin: c(30.1218, 118.2005) },
        { slug: 'tunxi', name: 'Tunxi Old Street', native: '屯溪老街', kind: 'sight', pin: c(29.713, 118.318), address: '安徽省黄山市屯溪区老街' },
        { slug: 'hongcun', name: 'Hongcun', native: '宏村', kind: 'sight', detail: 'The water village at the foot of the range' },
      ]),
    },
    {
      ...base('chengdu', 5),
      kind: 'stop',
      name: 'Chengdu',
      emoji: '🐼',
      hue: 15,
      start: '2027-04-07',
      end: '2027-04-09',
      nights: 2,
      whenLabel: 'Wed Apr 7 → Fri Apr 9',
      costNote: '≈$260',
      coord: c(30.657, 104.066),
      mapQuery: '春熙路',
      mapCity: '成都',
      metro: true,
      detail:
        'Two nights of pandas, teahouses and the best food of the trip. The panda base is a morning-only place — the animals sleep after 10:00 — so go early. The **Sichuan opera** with its face-changing finale is the evening.\n\nHotpot: order **微辣** and know it is still hot.',
      blocks: [
        block('chengdu', 'b0', '✈️ Getting there', ['Wed Apr 7: **3U9001, Huangshan Tunxi (TXN) 14:30 → Chengdu (CTU) 17:10** — ✅ booked (sample)']),
        block('chengdu', 'b1', '🛏 Sleep', ['Apr 7–9: **Sample Teahouse Hotel**, Chunxi Road — ✅ booked, ¥640 (2n)']),
        block('chengdu', 'b2', '🗓 Day by day', [], [{ label: 'Apr 8', text: 'Pandas at 07:30 → Wenshu Monastery → People\'s Park teahouse → **Sichuan opera** at 20:00' }]),
        block('chengdu', 'b3', '💰 Costs', ['Pandas ¥55 · opera ¥180 · bed ¥640 (sample)']),
      ],
      recoBlocks: [
        block('chengdu', 'r0', '🎯 See & do', ['**Giant Panda Base** at opening', '**Kuanzhai Alley** in the evening', '**Wenshu Monastery** and its vegetarian canteen']),
        block('chengdu', 'r1', '🍜 Food & drink', ['**Hotpot**, ordered 微辣', '**Dan dan noodles** for breakfast']),
        block('chengdu', 'r2', '💡 Good to know', ['The metro reaches the panda base on Line 3 — a taxi is faster at dawn']),
      ],
      options: [
        block('chengdu', 'o0', '⭐ Our picks', ['⭐ **Pandas at 07:30**', '⭐ **People\'s Park teahouse** — an ear-cleaner, a pot of jasmine, an hour', '⭐ **Sichuan opera** at Shufeng Yayun']),
        block('chengdu', 'o1', '➕ More options', ['**Jinli** street after dark', '**Kuanzhai Alley**', '**Wenshu Monastery**']),
        block('chengdu', 'o2', '🍜 Where to eat', ['⭐ **Sample Hotpot House**, Chunxi Road — order a split pot', '**Dan dan noodles** at any counter with a queue']),
      ],
      spots: spots('chengdu', '成都', [
        { slug: 'pandas', name: 'Giant Panda Base', native: '成都大熊猫繁育研究基地', kind: 'sight', detail: 'Mornings only — the pandas sleep after 10:00', pin: c(30.7333, 104.146), rating: 5 },
        { slug: 'kuanzhai', name: 'Kuanzhai Alley', native: '宽窄巷子', kind: 'sight', pin: c(30.6694, 104.0577) },
        { slug: 'wenshu', name: 'Wenshu Monastery', native: '文殊院', kind: 'sight', detail: 'And its vegetarian canteen', pin: c(30.6748, 104.0784) },
        { slug: 'peoples-park', name: 'People\'s Park teahouse', native: '人民公园鹤鸣茶社', kind: 'food', detail: 'A pot of jasmine and an hour', pin: c(30.6575, 104.0581) },
        { slug: 'jinli', name: 'Jinli', native: '锦里', kind: 'sight', pin: c(30.6458, 104.0491) },
        { slug: 'opera', name: 'Shufeng Yayun theatre', native: '蜀风雅韵', kind: 'show', detail: 'Face-changing finale at 20:00', pin: c(30.6635, 104.043) },
      ]),
    },
    {
      ...base('yangshuo', 6),
      kind: 'stop',
      name: 'Yangshuo & the Li River',
      emoji: '🛶',
      hue: 180,
      start: '2027-04-09',
      end: '2027-04-11',
      nights: 2,
      whenLabel: 'Fri Apr 9 → Sun Apr 11 · late arrival',
      costNote: '≈$230',
      coord: c(24.7781, 110.4966),
      mapQuery: '阳朔西街',
      mapCity: '阳朔',
      address: '广西壮族自治区桂林市阳朔县',
      metro: false,
      detail:
        'Karst towers along a green river — the twenty-yuan-note view. There is **no metro**: bikes, bamboo rafts and the odd taxi. The evening flight lands at 22:00, so the lodge needs to know you arrive late.',
      blocks: [
        block('yangshuo', 'b0', '✈️ Getting there', ['Fri Apr 9: **3U9003, Chengdu (CTU) 20:20 → Guilin (KWL) 22:00** — ✅ booked (sample) · ~1 h 15 min by car to Yangshuo']),
        block('yangshuo', 'b1', '🛏 Sleep', ['Apr 9–11: **Sample River Lodge**, Yangshuo — ✅ booked, ¥560 (2n) · late check-in agreed']),
        block('yangshuo', 'b2', '🗓 Day by day', [], [{ label: 'Apr 10', text: '**Li River** raft from Yangdi → Xingping, then **Xianggong Hill** at sunset' }]),
      ],
      recoBlocks: [
        block('yangshuo', 'r0', '🎯 See & do', ['**Yulong River** by bamboo raft', '**Moon Hill** — 800 steps, a natural arch']),
        block('yangshuo', 'r1', '🍜 Food & drink', ['**Beer fish** — the Yangshuo dish, river fish braised in local beer']),
      ],
      options: [
        block('yangshuo', 'o0', '⭐ Our picks', ['⭐ **Li River raft**, Yangdi → Xingping', '⭐ **Xianggong Hill** at sunset']),
        block('yangshuo', 'o1', '➕ More options', ['**Moon Hill**', '**Yulong River** by bike', '**West Street** after dark']),
        block('yangshuo', 'o2', '🍜 Where to eat', ['**Sample Beer Fish House**, West Street — ¥90 a fish']),
      ],
      spots: spots('yangshuo', '阳朔', [
        { slug: 'west-street', name: 'West Street', native: '阳朔西街', kind: 'sight', pin: c(24.7781, 110.495) },
        { slug: 'xianggong', name: 'Xianggong Hill', native: '相公山', kind: 'sight', detail: 'The river bend at sunset', pin: c(24.9478, 110.4372) },
        { slug: 'yulong', name: 'Yulong River', native: '遇龙河', kind: 'sight', pin: c(24.765, 110.442) },
        { slug: 'moon-hill', name: 'Moon Hill', native: '月亮山', kind: 'sight', detail: '800 steps to a natural arch', pin: c(24.7353, 110.4815) },
        { slug: 'xingping', name: 'Xingping', native: '兴坪古镇', kind: 'sight', pin: c(24.9295, 110.518) },
      ]),
    },
    {
      ...base('longji', 7),
      kind: 'stop',
      name: 'Longji rice terraces',
      emoji: '🌾',
      hue: 95,
      start: '2027-04-11',
      end: '2027-04-12',
      nights: 1,
      whenLabel: 'Sun Apr 11 → Mon Apr 12 · 2-day hike',
      costNote: '≈$60',
      coord: c(25.7531, 110.1092),
      mapUrl: 'https://maps.example.invalid/longji-sample',
      metro: false,
      detail:
        'A two-day walk across the dragon\'s-backbone terraces between Ping\'an and Dazhai. The bed is a **walk-in guesthouse** — nothing is booked. A public bus goes in; a shared car comes out.',
      blocks: [
        block('longji', 'b0', '🚌 Getting there', ['Sun Apr 11: public bus Yangshuo → Guilin → Ping\'an, ~4 h (verify) · the bag rides with you']),
        block('longji', 'b1', '🛏 Sleep', ['Apr 11: **Sample Terrace Guesthouse**, Ping\'an — walk-in, ¥150 (sample)']),
        block('longji', 'b2', '🥾 The hike', ['Day 1: Ping\'an village → the **Nine Dragons Five Tigers** viewpoint', 'Day 2: the high path to Dazhai (~4 h), then the shared car out']),
      ],
      recoBlocks: [
        block('longji', 'r0', '🎯 See & do', ['**Nine Dragons Five Tigers** at sunset']),
        block('longji', 'r1', '🍜 Food & drink', ['**Bamboo-tube rice** in Ping\'an']),
        block('longji', 'r2', '💡 Good to know', ['No ATM on the trail — carry cash for the bed and the car']),
      ],
      options: [
        block('longji', 'o0', '⭐ Our picks', ['⭐ **Nine Dragons Five Tigers** viewpoint at sunset']),
        block('longji', 'o1', '➕ More options', ['**Dazhai** — the Golden Buddha Peak terraces']),
        block('longji', 'o2', '🍜 Where to eat', ['Bamboo-tube rice at the guesthouse']),
      ],
      spots: spots('longji', '龙胜', [
        { slug: 'pingan', name: 'Ping\'an village', native: '平安村', kind: 'sight', pin: c(25.7531, 110.1092) },
        { slug: 'nine-dragons', name: 'Nine Dragons Five Tigers', native: '九龙五虎', kind: 'sight', detail: 'The terraces at sunset', pin: c(25.756, 110.113) },
        { slug: 'dazhai', name: 'Dazhai', native: '大寨村', kind: 'sight', detail: 'The Golden Buddha Peak terraces' },
      ]),
    },
    {
      ...base('guilin', 8),
      kind: 'stop',
      name: 'Guilin — exit safety night',
      emoji: '🛂',
      hue: 260,
      start: '2027-04-12',
      end: '2027-04-13',
      nights: 1,
      whenLabel: 'Mon Apr 12 → Tue Apr 13',
      costNote: '≈$45',
      warn: '🛂 **The night before the visa exit sleeps by the airport** — tomorrow\'s flight leaves the mainland on day 24 of 25.',
      coord: c(25.2736, 110.29),
      mapQuery: '桂林',
      mapCity: '桂林',
      address: '广西壮族自治区桂林市',
      metro: false,
      detail: 'One night next to Guilin airport so the exit flight cannot be missed. If the shared car out of the terraces fails, the airport is still reachable by bus.',
      blocks: [
        block('guilin', 'b0', '🚗 Getting there', ['Mon Apr 12: shared car from Dazhai → Guilin airport hotel, ~2 h 30 (verify)']),
        block('guilin', 'b1', '🛏 Sleep', ['Apr 12: **Sample Airport Hotel**, Liangjiang — ✅ booked, ¥290 · free shuttle']),
        block('guilin', 'b2', '💡 Why here', ['A buffer night: the visa deadline is **Apr 14, 24:00**']),
        block('guilin', 'b3', '💰 Costs', ['¥290 (sample)']),
      ],
      recoBlocks: [],
      options: [
        block('guilin', 'o0', '⭐ If there is time', ['**Elephant Trunk Hill**, in town, an hour']),
        block('guilin', 'o1', '➕ More options', ['**Reed Flute Cave** *(verify the hours)*']),
        block('guilin', 'o2', '🍜 Where to eat', ['**Guilin rice noodles** — any counter, ¥10']),
      ],
      spots: spots('guilin', '桂林', [
        { slug: 'elephant-trunk', name: 'Elephant Trunk Hill', native: '象鼻山', kind: 'sight', pin: c(25.27, 110.296) },
        { slug: 'reed-flute', name: 'Reed Flute Cave', native: '芦笛岩', kind: 'sight', verify: true },
      ]),
    },
    {
      ...base('hongkong', 9),
      kind: 'stop',
      name: 'Hong Kong & Macau',
      emoji: '🌉',
      hue: 330,
      start: '2027-04-13',
      end: '2027-04-17',
      nights: 4,
      whenLabel: 'Tue Apr 13 → Sat Apr 17',
      costNote: '≈$980',
      coord: c(22.2934, 114.1751),
      mapQuery: 'Tsim Sha Tsui',
      mapCity: 'Hong Kong',
      address: '香港尖沙咀',
      metro: true,
      detail:
        'Four nights to finish: the harbour, the hills and a day in Macau. Hong Kong is outside the mainland visa count, takes **Hong Kong dollars**, writes in **Traditional characters** and speaks Cantonese. Google Maps works here; the MTR goes everywhere.\n\nMacau is an hour by ferry: the old Portuguese centre in the morning, Coloane village and its egg tarts in the afternoon.',
      blocks: [
        block('hongkong', 'b0', '✈️ Getting there', ['Tue Apr 13: **CZ9005, Guilin (KWL) 13:50 → Hong Kong (HKG) 15:35** — ✅ booked (sample) · the visa exit']),
        block('hongkong', 'b1', '🛏 Sleep', ['Apr 13–17: **Sample Harbour Hotel**, Tsim Sha Tsui — ✅ booked, HK$5,200 (4n)']),
        block('hongkong', 'b2', '🗓 Day by day', [], [
          { label: 'Apr 14', text: '**Dragon\'s Back** → Shek O → the **Happy Valley** races at night' },
          { label: 'Apr 15', text: '**Macau**: Ruins of St. Paul\'s, Senado Square, Coloane' },
          { label: 'Apr 16', text: '**The Peak**, Central, the Star Ferry · concert at 19:30' },
          { label: 'Apr 17', text: '**Lantau**: Ngong Ping 360 → the Big Buddha → fly home 23:55' },
        ]),
        block('hongkong', 'b3', '💰 Costs', ['Hotel HK$5,200 · concert HK$480 (booked) · ferry HK$350 · cable car HK$270 (sample)']),
      ],
      recoBlocks: [
        block('hongkong', 'r0', '🎯 See & do', ['**The Peak** in the morning for clarity', '**Tai Kwun** — free galleries in an old police compound', '**Star Ferry** — ten minutes, the best view in the city']),
        block('hongkong', 'r1', '🍜 Food & drink', ['**Roast goose** at the Sample Roast Goose Kitchen', '**Egg tarts** at Lord Stow\'s in Coloane']),
        block('hongkong', 'r2', '💡 Good to know', ['Octopus card on the phone from day 1 — no VPN needed here']),
      ],
      options: [
        block('hongkong', 'o0', '⭐ Our picks', ['⭐ **Dragon\'s Back** — the ridge walk, then Shek O', '⭐ **The Peak** at 08:00', '⭐ **Tai Kwun** after the Peak']),
        block('hongkong', 'o1', '➕ More options', ['**Temple Street** night market', '**Man Mo Temple**', '**Tai O** stilt village with the Big Buddha']),
        block('hongkong', 'o2', '🍜 Where to eat', ['⭐ **Sample Roast Goose Kitchen**, Central — cash only, closed Wednesdays', '**Sample Dairy Café**, Jordan — scrambled-egg toast · closed Fridays']),
      ],
      spots: spots('hongkong', 'Hong Kong', [
        { slug: 'the-peak', name: 'The Peak', native: '山頂', kind: 'sight', detail: 'Mornings are the clear ones', pin: c(22.27604, 114.14546), q: 'Victoria Peak', rating: 5 },
        { slug: 'peak-tram', name: 'Peak Tram · Garden Road', native: '山頂纜車', kind: 'transport', pin: c(22.2777, 114.1597), q: 'Peak Tram Lower Terminus' },
        { slug: 'tai-kwun', name: 'Tai Kwun', native: '大館', kind: 'sight', detail: 'Free galleries in a restored compound', pin: c(22.28116, 114.15401), q: 'Tai Kwun', address: '香港中環荷李活道10號' },
        { slug: 'star-ferry', name: 'Star Ferry · Tsim Sha Tsui pier', native: '尖沙咀天星碼頭', kind: 'transport', detail: 'Ten minutes, the best view in the city', pin: c(22.29354, 114.16799), q: 'Tsim Sha Tsui Star Ferry Pier' },
        { slug: 'dragons-back', name: 'Dragon\'s Back', native: '龍脊', kind: 'sight', detail: 'Bus 9 from Shau Kei Wan MTR', pin: c(22.23926, 114.24199), q: 'Dragon\'s Back' },
        { slug: 'shek-o', name: 'Shek O', native: '石澳', kind: 'sight', pin: c(22.23317, 114.25003), q: 'Shek O' },
        { slug: 'happy-valley', name: 'Happy Valley Racecourse', native: '跑馬地馬場', kind: 'sight', detail: 'Floodlit racing on Wednesday nights', pin: c(22.2726, 114.18064), q: 'Happy Valley Racecourse' },
        { slug: 'cultural-centre', name: 'Hong Kong Cultural Centre', native: '香港文化中心', kind: 'show', detail: 'A walk from the hotel along the waterfront', pin: c(22.29372, 114.17046), q: 'Hong Kong Cultural Centre' },
        { slug: 'roast-goose', name: 'Sample Roast Goose Kitchen', native: '樣本燒鵝', kind: 'food', detail: 'Cash only · closed Wednesdays', pin: c(22.2826, 114.1555), q: 'Sample Roast Goose Kitchen' },
        { slug: 'dairy-cafe', name: 'Sample Dairy Café', native: '樣本奶茶', kind: 'food', detail: 'Scrambled-egg toast · closed Fridays', pin: c(22.3046, 114.1706), q: 'Sample Dairy Café' },
        { slug: 'ngong-ping', name: 'Ngong Ping 360 · Tung Chung terminal', native: '東涌纜車站', kind: 'transport', detail: 'Be there by 09:30', pin: c(22.29017, 113.93864), q: 'Ngong Ping 360 Tung Chung' },
        { slug: 'big-buddha', name: 'Tian Tan Buddha', native: '天壇大佛', kind: 'sight', pin: c(22.25396, 113.90501), q: 'Tian Tan Buddha' },
        { slug: 'temple-street', name: 'Temple Street night market', native: '廟街', kind: 'sight', pin: c(22.307, 114.17), q: 'Temple Street Night Market' },
        { slug: 'macau-ferry', name: 'Macau ferry pier · Sheung Wan', native: '港澳客輪碼頭', kind: 'transport', detail: 'The Macau route sails from Sheung Wan', pin: c(22.28867, 114.15244), q: 'Hong Kong-Macau Ferry Terminal' },
        { slug: 'hzmb-hk', name: 'HZMB Hong Kong Port', native: '港珠澳大橋香港口岸', kind: 'transport', detail: 'The bridge bus, if the ferries are full', pin: c(22.31787, 113.95407), q: '港珠澳大桥香港口岸' },
        { slug: 'ruins-st-paul', name: 'Ruins of St. Paul\'s', native: '大三巴牌坊', kind: 'sight', detail: 'Before the crowds', pin: c(22.19752, 113.54126), q: 'Ruins of St. Paul\'s', city: 'Macau' },
        { slug: 'senado', name: 'Senado Square', native: '議事亭前地', kind: 'sight', pin: c(22.19383, 113.53999), q: 'Senado Square', city: 'Macau' },
        { slug: 'coloane', name: 'Coloane village', native: '路環村', kind: 'sight', detail: 'Quiet lanes and the egg-tart bakery', pin: c(22.11636, 113.55134), q: '路環村', city: 'Macau' },
        { slug: 'lord-stows', name: 'Lord Stow\'s Bakery', native: '安德魯餅店', kind: 'food', detail: 'The Macanese egg tart, at the source', pin: c(22.1182, 113.55133), q: 'Lord Stow\'s Bakery Coloane', city: 'Macau' },
        { slug: 'taipa-ferry', name: 'Taipa Ferry Terminal', native: '氹仔客運碼頭', kind: 'transport', detail: 'The ferry back leaves from here', q: 'Taipa Ferry Terminal', city: 'Macau' },
      ]),
    },
  ];
}
