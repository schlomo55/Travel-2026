/* Day plans, the school week's day defaults, and the travel-day runbooks.

   placeIds are the explicit day→place join (see types.ts DayPlan): ids of
   spots, driver cards and bookings, in the day's own order. Several are
   CROSS-NAME on purpose — the day says "Yu Garden" and the place is
   "Yuyuan Garden" — and two days name a restaurant only to say it is shut,
   which must NOT become a chip. */
import type { DayDefault, DayPlan, Runbook } from '../../src/lib/model/types';
import { STOP_IDS, TRIP_ID } from './base';

const t = TRIP_ID;
const S = (stop: string, slug: string): string => `dm27-spot-${stop}-${slug}`;
const card = (n: number): string => `dm27-place-${String(n).padStart(2, '0')}`;

interface DayIn {
  date: string;
  title: string;
  bed: [string, string];
  items: string[];
  places?: string[];
  runbook?: string;
}

const DAYS: DayIn[] = [
  {
    date: '2027-03-19', title: 'Departure day', bed: ['✈️', 'Overnight in the air (HEL → PVG)'], runbook: 'dm27-run-dep',
    items: ['Leave for **Paris CDG T2D** by 08:00', '**AY1501** CDG 11:05 → Helsinki 15:20', '**AY9057** Helsinki 17:30 → **Shanghai Pudong (PVG)** 08:50 tomorrow', 'Sleep on the plane — the first day is long'],
    places: ['dm27-flight-ay1501', 'dm27-flight-ay9057'],
  },
  {
    date: '2027-03-20', title: 'Land in China → a night by Hangzhou East', bed: ['🛏', 'Sample Station Inn, Hangzhou East'], runbook: 'dm27-run-arrive',
    items: [
      '🛬 **Pudong (PVG) 08:50** — the visa-free entry stamp; the visa count starts tomorrow',
      'Metro **Line 2** from Pudong to **Hongqiao station**, ~70 min',
      '🚄 **G7501 Hongqiao 13:00 → Hangzhou East 13:55** · ✅ booked',
      'Taxi to the **Sample Station Inn** · early night',
      'Tomorrow: the school collects you from the lobby **from 10:30**',
    ],
    places: [card(1), card(3), card(4)],
  },
  {
    date: '2027-03-21', title: '🥋 Up the hill — school day 1', bed: ['🥋', 'Sample Tai-chi School (first night)'],
    items: ['10:30 pickup from the inn lobby', 'Settle in, the uniform fitting, the first evening form', 'Pay the fee in cash — **US$720**', 'Lights out ~21:30'],
  },
  {
    date: '2027-03-27', title: 'Saturday — half a day, and a free class', bed: ['🥋', 'Sample Tai-chi School, Hangzhou'],
    items: ['Morning session only', 'Afternoon: the free calligraphy class', 'Evening: Hefang Street for snacks'],
    places: [S('hangzhou', 'hefang')],
  },
  {
    date: '2027-03-29', title: 'School → Shanghai', bed: ['🌃', 'Sample Bund Hotel'], runbook: 'dm27-run-mar29',
    items: [
      'Goodbyes after breakfast; the school drives you to **Hangzhou East** by ~09:30',
      '🚄 **G7520 Hangzhou East 10:10 → Shanghai Hongqiao 11:05** · ✅ booked',
      'Metro to the **Sample Bund Hotel** · the Bund after dark',
      'The museum is closed today (Monday) — tomorrow it is',
    ],
    places: [card(4), card(3), S('shanghai', 'bund')],
  },
  {
    date: '2027-03-30', title: 'Museum Tuesday', bed: ['🌃', 'Sample Bund Hotel'],
    items: [
      '**The big museum** in Pudong — booked against the passport, released 7 days ahead at 20:00',
      '🍜 Lunch in the museum café',
      '**Lujiazui** at dusk — the towers from below',
      'Grey-day swap: the Sample Blind Massage, ten minutes from the hotel',
    ],
    places: [S('shanghai', 'museum-east'), S('shanghai', 'lujiazui')],
  },
  {
    date: '2027-03-31', title: 'Zhujiajiao water town → the lane house', bed: ['🏮', 'Sample Lane House, Xintiandi'],
    items: ['09:00 meet the **guided walk** at Zhujiajiao bus station', 'Back by 15:00 · move to the **Sample Lane House**', 'Dinner in Xintiandi'],
    places: [card(5)],
  },
  {
    date: '2027-04-01', title: 'Old town on foot', bed: ['🏮', 'Sample Lane House, Xintiandi'],
    items: [
      '**Yu Garden** at 08:30, before the groups',
      '🍜 **Xiaolongbao at Nanxiang**, by the garden gate',
      'Tianzifang lanes → **Jing\'an Temple**',
      'Early night — the Suzhou train is tomorrow',
    ],
    places: [S('shanghai', 'yuyuan'), S('shanghai', 'nanxiang'), S('shanghai', 'tianzifang'), S('shanghai', 'jingan')],
  },
  {
    date: '2027-04-02', title: 'Shanghai → Suzhou', bed: ['🏯', 'Sample Canal Hostel, Pingjiang Road'], runbook: 'dm27-run-move',
    items: ['Check out by 12:00', '🚄 Any HSR to Suzhou, ~30 min — not booked yet', 'Evening on **Pingjiang Road**'],
  },
  {
    date: '2027-04-03', title: 'The gardens', bed: ['🏯', 'Sample Canal Hostel, Pingjiang Road'],
    items: ['**The Humble Administrator\'s Garden** at 07:30 opening — timed ticket', 'A canal boat after lunch', 'The Lingering Garden if the feet allow *(verify the hours)*'],
  },
  {
    date: '2027-04-04', title: 'Suzhou → Huangshan', bed: ['🏔', 'Sample Pine Lodge, Tangkou'], runbook: 'dm27-run-apr04',
    items: [
      'Leave the bag at the hostel · a slow Suzhou morning',
      '**Back for the bag ~14:00** · train to Shanghai **Hongqiao** — the airport is next to the station · at SHA by 17:10',
      '✈️ **MU5001 · Shanghai Hongqiao (SHA) T2 19:10 → Huangshan Tunxi (TXN) 20:25** · ✅ booked · ~50 min to Tangkou, in ≈21:30',
      '🍜 **Eat before you fly** — Tangkou kitchens close early',
    ],
    places: [card(2), card(8)],
  },
  {
    date: '2027-04-05', title: 'Huangshan on foot', bed: ['🏔', 'Sample Pine Lodge, Tangkou'],
    items: ['First bus from the park gate at 06:30', 'The east steps up to **Shixin Peak**, ~3 h', '**Bright Summit** for the late light', 'Down by the cableway if the knees say so'],
    places: [card(9), S('huangshan', 'shixin'), S('huangshan', 'bright-summit')],
  },
  {
    date: '2027-04-06', title: 'Cableway + West Sea → Tunxi', bed: ['🏘', 'Sample Old Street Hotel, Tunxi'],
    items: ['**Yungu cableway at 07:30** — ask the desk about the wind', 'The **West Sea Grand Canyon** loop, ~4 h', 'Past the **Welcome Pine** on the way down', 'Evening bus to Tunxi · **Tunxi Old Street**'],
    places: [card(10), S('huangshan', 'west-sea'), S('huangshan', 'welcome-pine'), S('huangshan', 'tunxi')],
  },
  {
    date: '2027-04-07', title: 'Tunxi → Chengdu', bed: ['🐼', 'Sample Teahouse Hotel, Chunxi Road'], runbook: 'dm27-run-move',
    items: ['A slow morning on the old street', '✈️ **3U9001 TXN 14:30 → Chengdu (CTU) 17:10** · ✅ booked', 'Metro to Chunxi Road · a first, mild hotpot'],
    places: [card(8), card(11), card(12)],
  },
  {
    date: '2027-04-08', title: 'Chengdu full day', bed: ['🐼', 'Sample Teahouse Hotel, Chunxi Road'],
    items: [
      'Pandas at 07:30 — they sleep after ten',
      'Wenshu Monastery and its vegetarian canteen',
      'A pot of jasmine at the **People\'s Park teahouse**',
      '*Optional:* Kuanzhai Alley if the legs allow',
      '**Sichuan opera** at 20:00 — the face-changing finale',
    ],
    places: [S('chengdu', 'pandas'), S('chengdu', 'wenshu'), S('chengdu', 'peoples-park'), S('chengdu', 'kuanzhai'), S('chengdu', 'opera')],
  },
  {
    date: '2027-04-09', title: 'Chengdu → Guilin (evening flight)', bed: ['🛶', 'Sample River Lodge, Yangshuo — late arrival'], runbook: 'dm27-run-apr09',
    items: ['Late check-out 14:00 · Jinli in the afternoon', 'At CTU by 18:20', '✈️ **3U9003 · Chengdu (CTU) 20:20 → Guilin (KWL) 22:00** · ✅ booked', '~1 h 15 min by car to Yangshuo — the lodge knows'],
    places: [S('chengdu', 'jinli'), card(11), card(13), card(14)],
  },
  {
    date: '2027-04-10', title: 'Li River day', bed: ['🛶', 'Sample River Lodge, Yangshuo'],
    items: ['The **Li River raft**, Yangdi → Xingping — ticket still to buy', 'Lunch in Xingping', '**Xianggong Hill** at sunset', 'West Street after dark'],
    places: ['dm27-ticket-li-river', S('yangshuo', 'xingping'), S('yangshuo', 'xianggong'), S('yangshuo', 'west-street')],
  },
  {
    date: '2027-04-11', title: 'Longji terraces — day 1', bed: ['🌾', 'Sample Terrace Guesthouse (walk-in, cash)'], runbook: 'dm27-run-apr11',
    items: ['Public bus via Guilin, ~07:30 *(verify)*', 'Walk up into **Ping\'an village**', '**Nine Dragons Five Tigers** at sunset', 'Find a bed — walk-in, cash'],
    places: [card(15), S('longji', 'pingan'), S('longji', 'nine-dragons')],
  },
  {
    date: '2027-04-12', title: 'Terraces day 2 → Guilin (exit safety night)', bed: ['🛂', 'Sample Airport Hotel, Liangjiang'], runbook: 'dm27-run-apr12',
    items: ['The high path to **Dazhai**, ~4 h', 'Shared car from the Dazhai gate at 14:00', '**Elephant Trunk Hill** if there is light', 'Sleep by the airport — tomorrow is the exit'],
    places: [S('longji', 'dazhai'), S('guilin', 'elephant-trunk'), card(13)],
  },
  {
    date: '2027-04-13', title: '🛂 EXIT DAY — Guilin → Hong Kong', bed: ['🌉', 'Sample Harbour Hotel, Tsim Sha Tsui'], runbook: 'dm27-run-exit',
    items: ['Shuttle to KWL at 10:45', '✈️ **CZ9005 KWL 13:50 → Hong Kong 15:35** · ✅ booked — day 24 of 25', 'Octopus card on the phone · Airport Express → TST', 'The harbour at night from the promenade'],
    places: [card(13)],
  },
  {
    date: '2027-04-14', title: 'Dragon\'s Back + the races', bed: ['🌉', 'Sample Harbour Hotel, Tsim Sha Tsui'],
    items: [
      'Bus 9 from Shau Kei Wan → the **Dragon\'s Back** ridge',
      'Down to **Shek O** for lunch by the beach',
      '✅ **It IS a race night** — Happy Valley, Wednesday, public enclosure HK$10',
      'Not the roast goose today: the Sample Roast Goose Kitchen is closed on Wednesdays',
    ],
    places: [S('hongkong', 'dragons-back'), S('hongkong', 'shek-o'), S('hongkong', 'happy-valley')],
  },
  {
    date: '2027-04-15', title: 'Macau day trip', bed: ['🌉', 'Sample Harbour Hotel, Tsim Sha Tsui'],
    items: [
      '⛴ The 08:30 ferry from Sheung Wan',
      'The **Ruins of St. Paul\'s** before the crowds → **Senado Square**',
      'Bus to **Coloane village** · egg tarts at **Lord Stow\'s**',
      'Ferry back from **Taipa** ~16:15 — if full, the bridge bus to the **HZMB Hong Kong Port**',
    ],
    places: [S('hongkong', 'macau-ferry'), S('hongkong', 'ruins-st-paul'), S('hongkong', 'senado'), S('hongkong', 'coloane'), S('hongkong', 'lord-stows'), S('hongkong', 'taipa-ferry'), S('hongkong', 'hzmb-hk')],
  },
  {
    date: '2027-04-16', title: 'The Peak + the concert', bed: ['🌉', 'Sample Harbour Hotel, Tsim Sha Tsui'],
    items: [
      '**The Peak** at 08:00 by bus 15 — not the tram queue',
      '**Tai Kwun** on the way down',
      '🍜 **Roast goose** at the Sample Roast Goose Kitchen (cash)',
      'Not the Sample Dairy Café — it is closed on Fridays',
      '**Star Ferry** back to TST · the concert at 19:30',
    ],
    places: [S('hongkong', 'the-peak'), S('hongkong', 'tai-kwun'), S('hongkong', 'roast-goose'), S('hongkong', 'star-ferry'), S('hongkong', 'cultural-centre')],
  },
  {
    date: '2027-04-17', title: 'Lantau → fly home', bed: ['✈️', 'Overnight in the air (HKG → HEL)'], runbook: 'dm27-run-home',
    items: ['Check out by 12:00 — the bag stays at the desk', '**Ngong Ping 360** from Tung Chung by 09:30', 'The **Big Buddha**', 'Back for the bag by 19:30 · Airport Express · **AY9070 23:55**'],
    places: [S('hongkong', 'ngong-ping'), S('hongkong', 'big-buddha'), card(19)],
  },
  {
    date: '2027-04-18', title: 'Home', bed: ['🏠', 'Home, Paris'],
    items: ['**AY1506** Helsinki 08:00 → Paris CDG 09:40', 'Unpack, sleep'],
    places: ['dm27-flight-ay1506'],
  },
];

export function buildDayPlans(): DayPlan[] {
  return DAYS.map((d) => ({
    id: `dm27-day-${d.date}`,
    tripId: t,
    date: d.date,
    title: d.title,
    bedEmoji: d.bed[0],
    bedLabel: d.bed[1],
    planItems: d.items,
    ...(d.places ? { placeIds: d.places } : {}),
    ...(d.runbook ? { runbookId: d.runbook } : {}),
  }));
}

export function buildDayDefaults(): DayDefault[] {
  return [
    {
      id: 'dm27-daydef-school-week',
      tripId: t,
      stopId: STOP_IDS.hangzhou,
      weekdays: [1, 2, 3, 4, 5, 6],
      title: 'Tai-chi school — training day',
      bedEmoji: '🥋',
      bedLabel: 'Sample Tai-chi School, Hangzhou',
      planItems: ['06:30 qigong → breakfast', 'Morning block: the long form, stances', 'Lunch → afternoon block: push-hands', 'Evening free · lights out ~21:30'],
    },
    {
      id: 'dm27-daydef-school-sunday',
      tripId: t,
      stopId: STOP_IDS.hangzhou,
      weekdays: [0],
      title: 'School — Sunday off',
      bedEmoji: '🥋',
      bedLabel: 'Sample Tai-chi School, Hangzhou',
      planItems: ['Rest day: the lake, laundry, recover', 'Options: West Lake · Lingyin Temple · Longjing village · Hefang Street'],
      placeIds: [S('hangzhou', 'west-lake'), S('hangzhou', 'lingyin'), S('hangzhou', 'longjing'), S('hangzhou', 'hefang')],
    },
  ];
}

export function buildRunbooks(): Runbook[] {
  const rb = (id: string, title: string, severity: Runbook['severity'], steps: string[]): Runbook => ({ id, tripId: t, title, severity, steps });
  return [
    rb('dm27-run-dep', 'Departure runbook — Mar 19', 'warn', [
      'Passport, phone, the cash envelope (**US$720** for the school) — in the day bag',
      'eSIM installed and switched on for arrival',
      'Offline maps for Shanghai and Hangzhou downloaded',
      'AY1501 · Paris CDG T2D 11:05 → Helsinki 15:20 · booking DEMOAY',
      'AY9057 · Helsinki 17:30 → Shanghai Pudong (PVG) 08:50 next day',
      'Bag 20 kg — the domestic legs allow no more',
    ]),
    rb('dm27-run-arrive', 'Arrival runbook — Mar 20, PVG', 'warn', [
      'Land at **Pudong (PVG) T1 08:50** · the passport lane for visa-free entry · photograph the entry stamp',
      'Metro **Line 2** Pudong → **Hongqiao** station, ~70 min — **into Hongqiao by ~12:15**',
      'G7501 · Shanghai Hongqiao 13:00 → Hangzhou East 13:55 · the passport is the ticket',
      'Taxi from **Hangzhou East** to the inn, ~10 min — **Station Inn ≈14:30**',
      'Tomorrow the school collects you from the lobby **from 10:30**',
      'If AY 9057 is late: any later train to Hangzhou — they run every 15–20 min',
    ]),
    rb('dm27-run-move', 'Travel-day basics', 'warn', [
      'Bag under 20 kg if a domestic flight is involved',
      'Passport in hand — it IS your train ticket (manual channel 人工通道, arrive ~45 min early)',
      'Screenshot tonight\'s address in Chinese before leaving wifi',
      'Charge everything the night before — power bank with the 3C mark',
    ]),
    rb('dm27-run-mar29', '🚄 Mar 29 runbook — off the hill, into Shanghai', 'warn', [
      'Return the uniform, settle the room deposit',
      'The school drives you to **Hangzhou East by ~09:30**',
      'G7520 · Hangzhou East 10:10 → Shanghai Hongqiao 11:05 · booking DEMO-G-7520',
      'Metro from Hongqiao to the Bund, ~45 min — **Bund Hotel ≈12:30** (check-in from 14:00, leave the bag)',
    ]),
    rb('dm27-run-apr04', '⚠️ Apr 4 runbook — the Hongqiao flight', 'crit', [
      'Breakfast, check out by 12:00 and **leave the bag at the Canal Hostel** · Suzhou until ~14:00 — Pingjiang Road, the Lingering Garden *(verify)*',
      '**Back at the hostel ~14:00** for the bag, then the train to **Hongqiao (SHA) — NOT Pudong**: the airport is next to Hongqiao station · **at SHA by 17:10**',
      '🍜 **Eat properly before security** — no meal on board, and Tangkou kitchens close early',
      'MU5001 · Shanghai Hongqiao (SHA) T2 · 19:10 → Huangshan Tunxi 20:25 · booking DEMO-MU-5001',
      'Checked bag 20 kg + one 7 kg carry-on — on the booking',
      'Fallback if MU5001 is cancelled — a morning train to Huangshan North, ~3 h *verify*',
      'On landing 20:25: ~50 min by taxi to Tangkou — Pine Lodge ≈21:30, told in advance',
    ]),
    rb('dm27-run-apr09', 'Apr 9 runbook — the late arrival', 'warn', [
      'Late check-out 14:00 — leave the bag at the desk',
      'Taxi to **Chengdu Shuangliu (CTU) T2 by ~18:20**',
      '3U9003 · Chengdu (CTU) 20:20 → Guilin (KWL) 22:00 · booking DEMO-3U-9003',
      'The lodge\'s car waits at KWL arrivals — ~1 h 15 min to Yangshuo, **River Lodge ≈23:15**',
      'If the flight is late: message the lodge; the car waits',
    ]),
    rb('dm27-run-apr11', '⚠️ Apr 11 runbook — into the terraces, with the fallback', 'warn', [
      'Cash: ¥500 at least — no ATM on the trail',
      'Public bus Yangshuo → Guilin → Ping\'an, ~07:30 *verify* · the bag rides with you',
      'Not in Ping\'an by ~13:00 → sleep in Guilin and walk the terraces as a day trip tomorrow',
      'Walk-in bed: ask at two guesthouses before taking one',
    ]),
    rb('dm27-run-apr12', '🛂 Apr 12 runbook — the car before the visa exit', 'crit', [
      '**The exit flight is tomorrow, day 24 of 25.** Nothing today may slip.',
      'Walk to Dazhai by ~13:00 · the guesthouse calls the shared car',
      'Shared car · Dazhai 14:00 → Guilin airport, ~2 h 30 — **Airport Hotel ≈16:45**',
      'If no car: the 15:30 bus to Guilin, then a taxi — still in by 20:00',
    ]),
    rb('dm27-run-exit', '🛂 Apr 13 runbook — VISA EXIT DAY', 'crit', [
      '**This flight leaves the mainland on day 24 of 25. The legal deadline is Apr 14, 24:00.**',
      '**Shuttle at 10:45, at the terminal by 11:00** — three hours before a border-crossing flight',
      'CZ9005 · Guilin (KWL) 13:50 → Hong Kong (HKG) 15:35 · booking DEMO-CZ-9005',
      'If CZ9005 is disrupted: two later flights to Hong Kong are the buffer',
      'Absolute last resort: Apr 14 is still a legal exit day — never overstay',
      'In Hong Kong: Octopus card on the phone · Airport Express to Kowloon',
    ]),
    rb('dm27-run-home', 'Apr 17 runbook — flying home', 'warn', [
      'Check out by 12:00 — the bag stays at the desk',
      'Back for the bag by 19:30 · Airport Express from Kowloon',
      'AY9070 · Hong Kong (HKG) 23:55 → Helsinki 06:05 · booking DEMOAY',
      'AY1506 · Helsinki 08:00 → Paris CDG 09:40',
    ]),
  ];
}
