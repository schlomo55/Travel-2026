/* Show cards (phrases + driver cards), emergency numbers and info cards.

   Phrases come in both scripts: Simplified (the mainland, the default) and
   Traditional (`script: 'Hant'`, `region: 'HK'`), with pinyin and phrase sets,
   and one phrase with a "___" gap to fill by hand. Place cards are public
   places — airports, stations, sights — plus a few "Sample …" businesses. The
   one long card is a sample school's own taxi text. */
import type { EmergencyContact, InfoCard, ShowCard } from '../../src/lib/model/types';
import { c, TRIP_ID } from './base';

const t = TRIP_ID;
type Card = Omit<ShowCard, 'id' | 'tripId' | 'order' | 'verify' | 'pending' | 'isKey'> & Partial<Pick<ShowCard, 'verify' | 'pending' | 'isKey'>>;

const phrases: Card[] = [
  { kind: 'phrase', native: '请带我去这里', meaning: 'Please take me here', pinyin: 'qǐng dài wǒ qù zhèlǐ', isKey: true },
  { kind: 'phrase', native: '我有预订，名字是 ___', meaning: 'I have a reservation, the name is ___', pinyin: 'wǒ yǒu yùdìng, míngzi shì ___' },
  { kind: 'phrase', native: '请写下来', meaning: 'Please write it down', pinyin: 'qǐng xiě xiàlái' },
  { kind: 'phrase', native: '微辣', meaning: 'Mildly spicy — order hotpot like this', pinyin: 'wēi là', set: 'food' },
  { kind: 'phrase', native: '不要香菜', meaning: 'No coriander, please', pinyin: 'bú yào xiāngcài', set: 'food' },
  { kind: 'phrase', native: '买单', meaning: 'The bill, please', pinyin: 'mǎidān', set: 'food' },
  { kind: 'phrase', native: '我对花生过敏', meaning: 'I am allergic to peanuts (sample)', pinyin: 'wǒ duì huāshēng guòmǐn', set: 'medical' },
  { kind: 'phrase', native: '最近的医院在哪里？', meaning: 'Where is the nearest hospital?', pinyin: 'zuìjìn de yīyuàn zài nǎlǐ', set: 'medical' },
  { kind: 'phrase', native: '人工通道', meaning: 'Manual channel — the passport lane at train stations', pinyin: 'réngōng tōngdào', set: 'travel' },
  { kind: 'phrase', native: '請帶我去呢度', meaning: 'Please take me here (Cantonese)', script: 'Hant', region: 'HK', set: 'Hong Kong' },
  { kind: 'phrase', native: '唔該，埋單', meaning: 'The bill, please (Cantonese)', script: 'Hant', region: 'HK', set: 'Hong Kong' },
  { kind: 'phrase', native: '多謝', meaning: 'Thank you (for a gift or a favour)', script: 'Hant', region: 'HK', set: 'Hong Kong' },
];

const places: Card[] = [
  {
    kind: 'place', category: 'hotel',
    native: '师傅您好，请导航到"样本太极学校"。请打表，走正常路线，开发票。谢谢！',
    meaning: 'Hello driver, please navigate to the Sample Tai-chi School. Please use the meter, take the normal route and give a receipt. Thank you!',
    note: 'The sample school wrote this card itself — the navigation name and the request for the meter are theirs.',
  },
  { kind: 'place', category: 'transport', native: '上海浦东国际机场', meaning: 'Shanghai Pudong Airport (PVG)', coord: c(31.1443, 121.8083), mapQuery: '上海浦东国际机场', mapCity: '上海', verify: true },
  { kind: 'place', category: 'transport', native: '上海虹桥国际机场 2号航站楼', meaning: 'Shanghai Hongqiao Airport Terminal 2 (SHA)', coord: c(31.1979, 121.3363), mapQuery: '上海虹桥国际机场T2', mapCity: '上海', address: '上海市长宁区虹桥路2550号', verify: true },
  { kind: 'place', category: 'transport', native: '上海虹桥站', meaning: 'Shanghai Hongqiao Railway Station', coord: c(31.1945, 121.3204), mapQuery: '上海虹桥站', mapCity: '上海', address: '上海市闵行区申贵路1500号', verify: true },
  { kind: 'place', category: 'transport', native: '杭州东站', meaning: 'Hangzhou East Railway Station', coord: c(30.2905, 120.2128), mapQuery: '杭州东站', mapCity: '杭州', verify: true },
  { kind: 'place', category: 'sight', native: '新天地', meaning: 'Xintiandi, Shanghai — the lane house district', coord: c(31.2196, 121.4752), mapQuery: '新天地', mapCity: '上海', verify: true },
  { kind: 'place', category: 'spa', native: '样本盲人按摩', meaning: 'Sample Blind Massage — tuina, not bone-setting', detail: 'Tuina by blind therapists, not bone-setting', coord: c(31.2242, 121.4691), mapQuery: '样本盲人按摩', mapCity: '上海', address: '上海市黄浦区样本路7号' },
  { kind: 'place', category: 'medical', native: '样本国际诊所', meaning: 'Sample International Clinic — English-speaking doctors', coord: c(31.2155, 121.4467), mapQuery: '样本国际诊所', mapCity: '上海', address: '上海市静安区样本路8号', verify: true },
  { kind: 'place', category: 'transport', native: '黄山屯溪国际机场', meaning: 'Huangshan Tunxi Airport (TXN)', coord: c(29.7333, 118.2561), mapQuery: '黄山屯溪国际机场', mapCity: '黄山', address: '安徽省黄山市屯溪区机场大道', verify: true },
  { kind: 'place', category: 'sight', native: '汤口', meaning: 'Tangkou — Huangshan park gate, Apr 5', coord: c(30.0947, 118.1758), mapQuery: '黄山风景区南大门', mapCity: '黄山', address: '安徽省黄山市黄山区汤口镇', verify: true },
  { kind: 'place', category: 'sight', native: '云谷索道', meaning: 'Yungu cableway, Apr 6', coord: c(30.1218, 118.2005), mapQuery: '云谷索道', mapCity: '黄山', verify: true },
  { kind: 'place', category: 'transport', native: '成都双流国际机场 T2', meaning: 'Chengdu Shuangliu Airport Terminal 2 (CTU)', coord: c(30.5785, 103.9471), mapQuery: '成都双流国际机场T2', mapCity: '成都', verify: true },
  { kind: 'place', category: 'sight', native: '春熙路', meaning: 'Chunxi Road, Chengdu — the Sample Teahouse Hotel', coord: c(30.656, 104.08), mapQuery: '春熙路', mapCity: '成都', verify: true },
  { kind: 'place', category: 'transport', native: '桂林两江国际机场', meaning: 'Guilin Liangjiang Airport (KWL) — the Apr 13 exit flight', coord: c(25.2181, 110.0392), mapQuery: '桂林两江国际机场', mapCity: '桂林', address: '广西壮族自治区桂林市临桂区两江镇', verify: true },
  { kind: 'place', category: 'sight', native: '阳朔西街', meaning: 'West Street, Yangshuo — the river lodge', coord: c(24.7781, 110.495), mapQuery: '阳朔西街', mapCity: '阳朔', verify: true },
  { kind: 'place', category: 'sight', native: '平安村 龙脊梯田', meaning: 'Ping\'an — Longji terraces trailhead, Apr 11', coord: c(25.7531, 110.1092), mapQuery: '龙脊梯田平安寨', mapCity: '桂林', verify: true },
  { kind: 'place', category: 'food', native: '样本火锅', meaning: 'Sample Hotpot House, Chunxi Road, Chengdu', mapQuery: '样本火锅', mapCity: '成都' },
  { kind: 'place', category: 'food', native: '样本啤酒鱼', meaning: 'Sample Beer Fish House — Yangshuo\'s river fish', mapQuery: '样本啤酒鱼', mapCity: '阳朔' },
  { kind: 'place', category: 'hotel', native: '样本运河青旅(平江路)', meaning: 'Sample Canal Hostel, Pingjiang Road — the Suzhou bed' },
  { kind: 'place', category: 'transport', native: '香港國際機場', meaning: 'Hong Kong International Airport (HKG)', coord: c(22.308, 113.9185), mapQuery: 'Hong Kong International Airport', mapCity: 'Hong Kong', script: 'Hant', region: 'HK', verify: true },
  { kind: 'place', category: 'show', native: '香港文化中心', meaning: 'Hong Kong Cultural Centre — the Apr 16 concert', coord: c(22.29372, 114.17046), mapQuery: 'Hong Kong Cultural Centre', mapCity: 'Hong Kong', address: '香港尖沙咀梳士巴利道10號', script: 'Hant', region: 'HK', verify: true },
  { kind: 'place', category: 'hotel', native: '樣本海港酒店', meaning: 'Sample Harbour Hotel, Tsim Sha Tsui', coord: c(22.2985, 114.1772), mapQuery: 'Tsim Sha Tsui', mapCity: 'Hong Kong', address: '香港九龍尖沙咀樣本道13號', phone: '+852 0000 0013', script: 'Hant', region: 'HK' },
  { kind: 'place', category: 'medical', native: '樣本診所', meaning: 'Sample Clinic, Central — walk-in GP', coord: c(22.2819, 114.1577), mapQuery: 'Central Hong Kong', mapCity: 'Hong Kong', script: 'Hant', region: 'HK', pending: true },
];

export function buildShowCards(): ShowCard[] {
  const out: ShowCard[] = [];
  phrases.forEach((p, i) => out.push({ id: `dm27-phrase-${String(i).padStart(2, '0')}`, tripId: t, verify: false, pending: false, isKey: false, order: i, ...p }));
  places.forEach((p, i) => out.push({ id: `dm27-place-${String(i).padStart(2, '0')}`, tripId: t, verify: false, pending: false, isKey: false, order: 100 + i, ...p }));
  return out;
}

export function buildEmergency(): EmergencyContact[] {
  const rows: [string, string, EmergencyContact['kind']][] = [
    ['Police (mainland China)', '110', 'phone'],
    ['Ambulance / medical (mainland)', '120', 'phone'],
    ['Fire (mainland)', '119', 'phone'],
    ['All emergencies — Hong Kong & Macau', '999', 'phone'],
    ['Sample insurer · 24h assistance', '+33 1 00 00 00 00', 'phone'],
    ['Sample embassy hotline', '+86 10 0000 0000', 'phone'],
    ['Finnair — Manage booking', 'https://www.finnair.com/en/my-trips', 'url'],
  ];
  return rows.map(([label, value, kind], i) => ({
    id: `dm27-emg-${String(i).padStart(2, '0')}`,
    tripId: t,
    label,
    value,
    kind,
    verify: i === 5,
    pending: false,
    order: i,
  }));
}

export function buildInfoCards(): InfoCard[] {
  const cards: Omit<InfoCard, 'id' | 'tripId' | 'order'>[] = [
    {
      emoji: '🛂', heading: 'Visa — the one number that matters', severity: 'crit',
      items: [
        'Sample rule: **25 days visa-free** on the mainland (a demo figure, not a real policy).',
        'The count starts **the day AFTER entry**. Entry Mar 20 → day 1 is Mar 21.',
        '**Deadline: Apr 14, 24:00.** Planned exit Apr 13 = day 24, a one-day buffer.',
        'Hong Kong and Macau are separate and do not count.',
      ],
    },
    { emoji: '🧳', heading: 'The 20 kg rule', severity: 'normal', items: ['Every domestic flight allows **20 kg** checked — pack to 20, not 23.'] },
    { emoji: '🔋', heading: 'Power banks', severity: 'normal', items: ['Carry-on only, with a visible capacity label (3C mark on the mainland).'] },
    { emoji: '✈️', heading: 'Airport traps', severity: 'normal', items: ['Apr 4 flies from **Hongqiao (SHA)**, not Pudong.', 'Shanghai has two airports far apart — check the code, every time.'] },
    { emoji: '🚄', heading: 'Trains', severity: 'normal', items: ['The passport IS the ticket. Use the manual lane 人工通道, arrive 45 min early.'] },
    { emoji: '💴', heading: 'Money', severity: 'normal', items: ['Phone payments everywhere on the mainland; carry ¥500 cash for the hike.', 'Hong Kong: Octopus card; Macau takes HKD at par.'] },
    { emoji: '📶', heading: 'Internet', severity: 'normal', items: ['A roaming eSIM avoids most blocks; download maps before leaving wifi.'] },
  ];
  return cards.map((x, i) => ({ id: `dm27-info-${String(i).padStart(2, '0')}`, tripId: t, order: i, ...x }));
}
