/* The demo trip's bookings — every kind the model has: flights (a two-leg
   long haul each way, domestic hops, one CANCELLED and rebooked), trains (one
   booked with stations, one pending with no station named, one ALTERNATIVE),
   road legs (a bus in and a shared car out of the hike), beds (booked, a
   walk-in, a cancelled one, a long held stay, native names, local-script
   addresses, phones) and tickets (pending, booked, timed, multi-day).

   Every code starts with DEMO and every business is a "Sample …" one. The
   airlines and airports are real names so the links and codes behave; the
   flight numbers and times are invented. */
import type { Booking } from '../../src/lib/model/types';
import { c, STOP_IDS, TRIP_ID, stamp } from './base';

const t = TRIP_ID;

export function buildBookings(): Booking[] {
  return [
    /* ---------- flights ---------- */
    {
      id: 'dm27-flight-ay1501', tripId: t, kind: 'flight', status: 'booked', title: 'Finnair · AY 1501', category: 'transport',
      groupLabel: 'Finnair · ref DEMOAY', date: '2027-03-19', code: 'DEMOAY', codeLabel: 'Finnair booking', codeSub: 'E-ticket DEMO-000-0001',
      manageUrl: 'https://www.finnair.com/en/my-trips', meta: [{ k: 'Cabin', v: 'Economy' }, { k: 'Checked', v: '23 kg' }],
      carrier: 'Finnair', flightNo: 'AY 1501', from: { code: 'CDG', name: 'Paris Charles de Gaulle · T2D' }, to: { code: 'HEL', name: 'Helsinki Airport' },
      dep: '11:05', arr: '15:20', arrDayOffset: 0, duration: '3h 15m', coord: c(49.0097, 2.5479), mapQuery: 'Paris Charles de Gaulle Airport', mapCity: 'Paris',
      paidMinor: 115000, priceNote: '$1,150', ...stamp,
    },
    {
      id: 'dm27-flight-ay9057', tripId: t, kind: 'flight', status: 'booked', title: 'Finnair · AY 9057', category: 'transport',
      groupLabel: 'Finnair · ref DEMOAY', date: '2027-03-19', code: 'DEMOAY', codeLabel: 'Finnair booking', codeSub: 'E-ticket DEMO-000-0001',
      manageUrl: 'https://www.finnair.com/en/my-trips', meta: [{ k: 'Cabin', v: 'Economy' }, { k: 'Seat', v: '31A' }, { k: 'Checked', v: '23 kg' }],
      note: 'Lands at **Pudong (PVG)** — the train to Hangzhou leaves from **Hongqiao**, across the city.',
      carrier: 'Finnair', flightNo: 'AY 9057', from: { code: 'HEL', name: 'Helsinki Airport' }, to: { code: 'PVG', name: 'Shanghai Pudong Intl · T1' },
      dep: '17:30', arr: '08:50', arrDayOffset: 1, duration: '9h 20m', coord: c(60.3172, 24.9633), mapQuery: 'Helsinki Airport', mapCity: 'Helsinki', ...stamp,
    },
    {
      id: 'dm27-flight-mu5003', tripId: t, kind: 'flight', status: 'cancelled', title: 'China Eastern · MU 5003', category: 'transport',
      groupLabel: 'Domestic · cancelled', date: '2027-04-04', code: 'DEMO-MU-5003', codeLabel: 'Sample booking',
      meta: [{ k: 'Status', v: 'cancelled — refunded (sample)' }],
      note: 'The first plan flew from **Pudong**; it was cancelled and replaced by MU5001 from Hongqiao.',
      carrier: 'China Eastern', flightNo: 'MU 5003', from: { code: 'PVG', name: 'Shanghai Pudong Intl · T1' }, to: { code: 'TXN', name: 'Huangshan Tunxi' },
      dep: '18:00', arr: '19:15', arrDayOffset: 0, duration: '1h 15m', coord: c(31.1443, 121.8083), mapQuery: '上海浦东国际机场', mapCity: '上海', ...stamp,
    },
    {
      id: 'dm27-flight-mu5001', tripId: t, kind: 'flight', status: 'booked', title: 'China Eastern · MU 5001', category: 'transport',
      groupLabel: 'Domestic · sample agency', date: '2027-04-04', code: 'DEMO-MU-5001', codeLabel: 'Sample booking', codeSub: 'airline ref DEMOMU',
      manageUrl: 'https://www.ceair.com/', paidMinor: 9800, priceNote: '$98',
      meta: [
        { k: 'Checked', v: '20 kg', warn: true },
        { k: 'From', v: 'HONGQIAO T2 — NOT Pudong', warn: true },
        { k: 'Be at SHA', v: 'by 17:10', warn: true },
        { k: 'Meals', v: 'none' },
      ],
      note: '🛫 **From Hongqiao (SHA) T2 — not Pudong.** Eat before you fly: you land 20:25 and Tangkou kitchens close early.',
      carrier: 'China Eastern', flightNo: 'MU 5001', from: { code: 'SHA', name: 'Shanghai Hongqiao · T2' }, to: { code: 'TXN', name: 'Huangshan Tunxi' },
      dep: '19:10', arr: '20:25', arrDayOffset: 0, duration: '1h 15m', coord: c(31.1979, 121.3363), mapQuery: '上海虹桥国际机场', mapCity: '上海', ...stamp,
    },
    {
      id: 'dm27-flight-3u9001', tripId: t, kind: 'flight', status: 'booked', title: 'Sichuan Airlines · 3U 9001', category: 'transport',
      groupLabel: 'Domestic · sample agency', date: '2027-04-07', code: 'DEMO-3U-9001', codeLabel: 'Sample booking', paidMinor: 14200, priceNote: '$142',
      meta: [{ k: 'Checked', v: '20 kg', warn: true }],
      carrier: 'Sichuan Airlines', flightNo: '3U 9001', from: { code: 'TXN', name: 'Huangshan Tunxi' }, to: { code: 'CTU', name: 'Chengdu Shuangliu · T2' },
      dep: '14:30', arr: '17:10', arrDayOffset: 0, duration: '2h 40m', coord: c(29.7333, 118.2561), mapQuery: '黄山屯溪国际机场', mapCity: '黄山', ...stamp,
    },
    {
      id: 'dm27-flight-3u9003', tripId: t, kind: 'flight', status: 'booked', title: 'Sichuan Airlines · 3U 9003', category: 'transport',
      groupLabel: 'Domestic · sample agency', date: '2027-04-09', code: 'DEMO-3U-9003', codeLabel: 'Sample booking', codeSub: 'airline ref DEMO3U',
      paidMinor: 12600, priceNote: '$126',
      meta: [{ k: 'Checked', v: '20 kg', warn: true }, { k: 'Lands', v: '22:00 — the lodge knows', warn: true }],
      carrier: 'Sichuan Airlines', flightNo: '3U 9003', from: { code: 'CTU', name: 'Chengdu Shuangliu · T2' }, to: { code: 'KWL', name: 'Guilin Liangjiang' },
      dep: '20:20', arr: '22:00', arrDayOffset: 0, duration: '1h 40m', coord: c(30.5785, 103.9471), mapQuery: '成都双流国际机场', mapCity: '成都', ...stamp,
    },
    {
      id: 'dm27-flight-cz9005', tripId: t, kind: 'flight', status: 'booked', title: 'China Southern · CZ 9005', category: 'transport',
      groupLabel: 'Exit flight · sample agency', date: '2027-04-13', code: 'DEMO-CZ-9005', codeLabel: 'Sample booking', paidMinor: 18900, priceNote: '$189',
      meta: [{ k: 'Checked', v: '23 kg' }, { k: 'Visa', v: 'leaves the mainland on day 24 of 25', warn: true }],
      carrier: 'China Southern', flightNo: 'CZ 9005', from: { code: 'KWL', name: 'Guilin Liangjiang' }, to: { code: 'HKG', name: 'Hong Kong Intl · T1' },
      dep: '13:50', arr: '15:35', arrDayOffset: 0, duration: '1h 45m', coord: c(25.2181, 110.0392), mapQuery: '桂林两江国际机场', mapCity: '桂林',
      address: '广西壮族自治区桂林市临桂区两江镇', ...stamp,
    },
    {
      id: 'dm27-flight-ay9070', tripId: t, kind: 'flight', status: 'booked', title: 'Finnair · AY 9070', category: 'transport',
      groupLabel: 'Finnair · ref DEMOAY', date: '2027-04-17', code: 'DEMOAY', codeLabel: 'Finnair booking', codeSub: 'E-ticket DEMO-000-0001',
      meta: [{ k: 'Checked', v: '23 kg' }],
      carrier: 'Finnair', flightNo: 'AY 9070', from: { code: 'HKG', name: 'Hong Kong Intl · T1' }, to: { code: 'HEL', name: 'Helsinki Airport' },
      dep: '23:55', arr: '06:05', arrDayOffset: 1, duration: '11h 10m', coord: c(22.308, 113.9185), mapQuery: 'Hong Kong International Airport', mapCity: 'Hong Kong',
      address: '香港大嶼山赤鱲角', ...stamp,
    },
    {
      id: 'dm27-flight-ay1506', tripId: t, kind: 'flight', status: 'booked', title: 'Finnair · AY 1506', category: 'transport',
      groupLabel: 'Finnair · ref DEMOAY', date: '2027-04-18', code: 'DEMOAY', codeLabel: 'Finnair booking', codeSub: 'E-ticket DEMO-000-0001',
      meta: [{ k: 'Checked', v: '23 kg' }],
      carrier: 'Finnair', flightNo: 'AY 1506', from: { code: 'HEL', name: 'Helsinki Airport' }, to: { code: 'CDG', name: 'Paris Charles de Gaulle · T2D' },
      dep: '08:00', arr: '09:40', arrDayOffset: 0, duration: '2h 40m', coord: c(60.3172, 24.9633), mapQuery: 'Helsinki Airport', mapCity: 'Helsinki', ...stamp,
    },

    /* ---------- trains ---------- */
    {
      id: 'dm27-train-mar20', tripId: t, kind: 'train', status: 'booked', title: 'HSR · Shanghai Hongqiao → Hangzhou East', category: 'transport',
      groupLabel: 'Trains · sample agency', date: '2027-03-20', code: 'DEMO-G-7501', codeLabel: 'Sample booking', trainNo: 'G7501', paidMinor: 1100, priceNote: '¥73',
      from: { name: 'Shanghai Hongqiao', stations: [{ name: '上海虹桥站', coord: c(31.1945, 121.3204), mapQuery: '上海虹桥站', mapCity: '上海' }] },
      to: { name: 'Hangzhou East', stations: [{ name: '杭州东站', coord: c(30.2905, 120.2128), mapQuery: '杭州东站', mapCity: '杭州' }] },
      dep: '13:00', arr: '13:55', duration: '55 min',
      meta: [{ k: 'Seat', v: '2nd class, 08C' }, { k: 'ID', v: 'the passport is the ticket' }],
      note: 'Pudong (PVG) → Hongqiao is **Line 2 end to end, ~70 min**. Arrive 45 min early for the manual passport lane.', ...stamp,
    },
    {
      id: 'dm27-train-mar20-late', tripId: t, kind: 'train', status: 'pending', alternative: true, title: 'If AY 9057 is late · a later train to Hangzhou', category: 'transport',
      groupLabel: 'Trains · only if needed', date: '2027-03-20',
      from: { name: 'Shanghai Hongqiao', stations: [{ name: '上海虹桥站', coord: c(31.1945, 121.3204), mapQuery: '上海虹桥站', mapCity: '上海' }] },
      to: { name: 'Hangzhou East', stations: [{ name: '杭州东站', coord: c(30.2905, 120.2128), mapQuery: '杭州东站', mapCity: '杭州' }] },
      duration: '~1 h',
      meta: [{ k: 'Only if', v: 'AY 9057 lands late and the G7501 is lost', warn: true }, { k: 'Trains', v: 'every 15–20 min all afternoon' }],
      note: '**FALLBACK ONLY — the plan is booked.** Any later train that day; the inn holds the room.', ...stamp,
    },
    {
      id: 'dm27-train-mar29', tripId: t, kind: 'train', status: 'booked', title: 'HSR · Hangzhou East → Shanghai Hongqiao', category: 'transport',
      groupLabel: 'Trains · sample agency', date: '2027-03-29', code: 'DEMO-G-7520', codeLabel: 'Sample booking', trainNo: 'G7520', paidMinor: 1100, priceNote: '¥73',
      from: { name: 'Hangzhou East', stations: [{ name: '杭州东站', coord: c(30.2905, 120.2128), mapQuery: '杭州东站', mapCity: '杭州' }] },
      to: { name: 'Shanghai Hongqiao', stations: [{ name: '上海虹桥站', coord: c(31.1945, 121.3204), mapQuery: '上海虹桥站', mapCity: '上海' }] },
      dep: '10:10', arr: '11:05', duration: '55 min',
      meta: [{ k: 'Seat', v: '2nd class' }],
      ...stamp,
    },
    {
      id: 'dm27-train-apr02', tripId: t, kind: 'train', status: 'pending', title: 'HSR · Shanghai → Suzhou', category: 'transport',
      groupLabel: 'Trains · none booked yet', date: '2027-04-02',
      from: { name: 'Shanghai', why: 'any Shanghai station has trains to Suzhou — the plan names none, so no button guesses which' },
      to: { name: 'Suzhou', why: 'Suzhou has several stations far apart; the plan names the city only' },
      duration: '~30 min (verify)',
      meta: [{ k: 'Fare', v: '~¥40 (planned)' }, { k: 'Booked', v: 'NO — any train that day', warn: true }],
      bookingLinkUrl: 'https://www.12306.cn/', ...stamp,
    },

    /* ---------- road legs ---------- */
    {
      id: 'dm27-road-apr11', tripId: t, kind: 'other', status: 'pending', title: 'Public bus · Yangshuo → Ping\'an (bag rides with you)', category: 'transport',
      groupLabel: 'Road · arranged on the day', date: '2027-04-11',
      from: { name: 'Yangshuo', why: 'The plan names a public bus but no bus station — Yangshuo has two.' },
      to: { name: 'Ping\'an', why: 'The village is named as a destination and never as a stop.' },
      dep: '07:30', duration: '~4 h',
      meta: [{ k: 'Booked', v: 'NO — walk-up, verify the time', warn: true }, { k: 'Change', v: 'at Guilin' }, { k: 'Fare', v: '~¥60 (verify)' }],
      note: 'A public bus via Guilin, ~4 h *(verify)*. The bag rides with you.', ...stamp,
    },
    {
      id: 'dm27-road-apr12', tripId: t, kind: 'other', status: 'pending', title: 'Shared car · Dazhai → Guilin airport hotel', category: 'transport',
      groupLabel: 'Road · arranged on the day', date: '2027-04-12',
      from: { name: 'Dazhai', why: 'Cars wait at the village gate; there is no address to open.' },
      to: { name: 'Guilin airport', stations: [{ name: '桂林两江国际机场', coord: c(25.2181, 110.0392), mapQuery: '桂林两江国际机场', mapCity: '桂林' }] },
      dep: '14:00', duration: '~2 h 30',
      meta: [{ k: 'Booked', v: 'NO — the guesthouse calls one', warn: true }, { k: 'Fare', v: '~¥400 the car (verify)' }],
      ...stamp,
    },

    /* ---------- beds ---------- */
    {
      id: 'dm27-stay-01', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Station Inn, Hangzhou East', category: 'hotel', native: '样本站前客栈',
      date: '2027-03-20', city: 'Hangzhou', checkIn: '2027-03-20', checkOut: '2027-03-21', stopId: STOP_IDS.hangzhou,
      code: 'DEMO-H-0001', codeLabel: 'Sample booking', priceNote: '¥260', paidMinor: 3600,
      address: '浙江省杭州市上城区样本路1号', phone: '+86 571 0000 0001',
      meta: [{ k: 'Check-in', v: 'from 14:00' }, { k: 'Pickup', v: 'the school collects you here Sun 10:30' }], ...stamp,
    },
    {
      id: 'dm27-stay-02', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Tai-chi School dormitory', category: 'hotel',
      date: '2027-03-21', city: 'Hangzhou', checkIn: '2027-03-21', checkOut: '2027-03-29', stopId: STOP_IDS.hangzhou,
      priceNote: '$720', meta: [{ k: 'Paid', v: 'cash on arrival' }, { k: 'Room', v: 'twin, shared bathroom' }],
      note: 'Held for the whole week; the fee is paid in cash on arrival.', ...stamp,
    },
    {
      id: 'dm27-stay-03', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Bund Hotel', category: 'hotel', native: '样本外滩酒店',
      date: '2027-03-29', city: 'Shanghai', checkIn: '2027-03-29', checkOut: '2027-03-31', stopId: STOP_IDS.shanghai,
      code: 'DEMO-H-0003', codeLabel: 'Sample booking', priceNote: '¥1,180 (2n)', paidMinor: 16500,
      address: '上海市黄浦区样本路3号', meta: [{ k: 'Free cancel', v: 'to Mar 27', warn: true }], ...stamp,
    },
    {
      id: 'dm27-stay-04', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Lane House, Xintiandi', category: 'hotel',
      date: '2027-03-31', city: 'Shanghai', checkIn: '2027-03-31', checkOut: '2027-04-02', stopId: STOP_IDS.shanghai,
      code: 'DEMO-H-0004', codeLabel: 'Sample booking', priceNote: '¥960 (2n)', paidMinor: 13400, meta: [], ...stamp,
    },
    {
      id: 'dm27-stay-05', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Canal Hostel, Pingjiang Road', category: 'hotel',
      date: '2027-04-02', city: 'Suzhou', checkIn: '2027-04-02', checkOut: '2027-04-04', stopId: STOP_IDS.suzhou,
      code: 'DEMO-H-0005', codeLabel: 'Sample booking', priceNote: '¥420 (2n)', paidMinor: 5900, meta: [{ k: 'Room', v: 'private double' }], ...stamp,
    },
    {
      id: 'dm27-stay-06', tripId: t, kind: 'hotel', status: 'cancelled', title: 'Sample Lakeside Resort, Suzhou', category: 'hotel',
      date: '2027-04-02', city: 'Suzhou', checkIn: '2027-04-02', checkOut: '2027-04-04', stopId: STOP_IDS.suzhou,
      meta: [{ k: 'Status', v: 'cancelled — nothing charged' }], ...stamp,
    },
    {
      id: 'dm27-stay-07', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Pine Lodge, Tangkou', category: 'hotel', native: '样本松林山庄',
      detail: '400 m to the Yungu cableway bus', pin: c(30.0956, 118.1786),
      date: '2027-04-04', city: 'Huangshan', checkIn: '2027-04-04', checkOut: '2027-04-06', stopId: STOP_IDS.huangshan,
      code: 'DEMO-H-0007', codeLabel: 'Sample booking', priceNote: '¥820 (2n)', paidMinor: 11500,
      meta: [{ k: 'Late arrival', v: '≈21:30 — they know', warn: true }], ...stamp,
    },
    {
      id: 'dm27-stay-08', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Old Street Hotel, Tunxi', category: 'hotel',
      pin: c(29.7142, 118.3165),
      date: '2027-04-06', city: 'Huangshan', checkIn: '2027-04-06', checkOut: '2027-04-07', stopId: STOP_IDS.huangshan,
      code: 'DEMO-H-0008', codeLabel: 'Sample booking', priceNote: '¥380', paidMinor: 5300, meta: [], ...stamp,
    },
    {
      id: 'dm27-stay-09', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Teahouse Hotel, Chunxi Road', category: 'hotel', native: '样本茶馆酒店',
      pin: c(30.6558, 104.0812),
      date: '2027-04-07', city: 'Chengdu', checkIn: '2027-04-07', checkOut: '2027-04-09', stopId: STOP_IDS.chengdu,
      code: 'DEMO-H-0009', codeLabel: 'Sample booking', priceNote: '¥640 (2n)', paidMinor: 9000,
      address: '四川省成都市锦江区样本街9号', phone: '+86 28 0000 0009', meta: [], ...stamp,
    },
    {
      id: 'dm27-stay-10', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample River Lodge, Yangshuo', category: 'hotel',
      date: '2027-04-09', city: 'Yangshuo', checkIn: '2027-04-09', checkOut: '2027-04-11', stopId: STOP_IDS.yangshuo,
      code: 'DEMO-H-0010', codeLabel: 'Sample booking', priceNote: '¥560 (2n)', paidMinor: 7800,
      address: '广西壮族自治区桂林市阳朔县样本村10号', meta: [{ k: 'Late check-in', v: 'agreed — ≈23:15', warn: true }], ...stamp,
    },
    {
      id: 'dm27-stay-11', tripId: t, kind: 'hotel', status: 'walkin', title: 'Sample Terrace Guesthouse, Ping\'an', category: 'hotel',
      pin: c(25.7526, 110.1101),
      date: '2027-04-11', city: 'Longji', checkIn: '2027-04-11', checkOut: '2027-04-12', stopId: STOP_IDS.longji,
      priceNote: '~¥150', meta: [{ k: 'Booked', v: 'NO — walk-in', warn: true }], ...stamp,
    },
    {
      id: 'dm27-stay-12', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Airport Hotel, Liangjiang', category: 'hotel',
      date: '2027-04-12', city: 'Guilin', checkIn: '2027-04-12', checkOut: '2027-04-13', stopId: STOP_IDS.guilin,
      code: 'DEMO-H-0012', codeLabel: 'Sample booking', priceNote: '¥290', paidMinor: 4100,
      address: '广西壮族自治区桂林市临桂区样本路12号', meta: [{ k: 'Shuttle', v: 'free, every 20 min' }], ...stamp,
    },
    {
      id: 'dm27-stay-13', tripId: t, kind: 'hotel', status: 'booked', title: 'Sample Harbour Hotel, Tsim Sha Tsui', category: 'hotel', native: '樣本海港酒店',
      pin: c(22.2985, 114.1772),
      date: '2027-04-13', city: 'Hong Kong', checkIn: '2027-04-13', checkOut: '2027-04-17', stopId: STOP_IDS.hongkong,
      code: 'DEMO-H-0013', codeLabel: 'Sample booking', priceNote: 'HK$5,200 (4n)', paidMinor: 66700,
      address: '香港九龍尖沙咀樣本道13號', phone: '+852 0000 0013', meta: [{ k: 'Check-out', v: '12:00 — the bag stays till evening' }], ...stamp,
    },

    /* ---------- tickets & experiences ---------- */
    {
      id: 'dm27-ticket-museum', tripId: t, kind: 'activity', status: 'pending', title: 'Shanghai Museum East · timed entry', category: 'sight',
      detail: 'Booked against the passport', pin: c(31.2213, 121.5531), groupLabel: 'Still to buy', date: '2027-03-30',
      venue: 'Shanghai Museum East 上海博物馆东馆', mapQuery: '上海博物馆东馆', mapCity: '上海', bookingLinkUrl: 'https://www.shanghaimuseum.net/',
      meta: [{ k: 'Price', v: 'free with a booking' }, { k: 'Released', v: '7 days ahead, 20:00 Shanghai', warn: true }, { k: 'Closed', v: 'Mondays — so Tue Mar 30' }], ...stamp,
    },
    {
      id: 'dm27-ticket-zhujiajiao', tripId: t, kind: 'activity', status: 'pending', title: 'Zhujiajiao water town · guided walk', category: 'sight',
      groupLabel: 'Still to buy', date: '2027-03-31', venue: 'Sample Walks Shanghai — meet at Zhujiajiao bus station',
      meta: [{ k: 'Price', v: '¥380 (sample)' }, { k: 'Meet', v: '09:00' }], ...stamp,
    },
    {
      id: 'dm27-ticket-garden', tripId: t, kind: 'activity', status: 'pending', title: 'Humble Administrator\'s Garden · timed entry', category: 'sight',
      groupLabel: 'Still to buy', date: '2027-04-03', venue: 'Humble Administrator\'s Garden 拙政园',
      meta: [{ k: 'Price', v: '¥90' }, { k: 'Sells out', v: 'spring weekends', warn: true }], ...stamp,
    },
    {
      id: 'dm27-ticket-park-pass', tripId: t, kind: 'activity', status: 'pending', title: 'Huangshan · park pass', category: 'sight',
      groupLabel: 'Still to buy', date: '2027-04-05', venue: 'Huangshan park gate 汤口 — for Apr 5–6',
      coord: c(30.0947, 118.1758), mapQuery: '黄山风景区南大门', mapCity: '黄山', address: '安徽省黄山市黄山区汤口镇',
      meta: [{ k: 'Price', v: '¥190 (sample)' }, { k: 'Valid', v: '2 days (verify)' }], ...stamp,
    },
    {
      id: 'dm27-ticket-cableway', tripId: t, kind: 'activity', status: 'pending', title: 'Yungu cableway · morning ride', category: 'sight',
      detail: 'The lodge is 400 m from the cableway bus', groupLabel: 'Still to buy', date: '2027-04-06',
      venue: 'Yungu cableway 云谷索道 — the lodge is 400 m from the bus', time: '07:30',
      coord: c(30.1218, 118.2005), mapQuery: '云谷索道', mapCity: '黄山',
      meta: [{ k: 'Price', v: '¥80' }, { k: 'Wind', v: 'it pauses in high wind — ask the desk', warn: true }], ...stamp,
    },
    {
      id: 'dm27-ticket-opera', tripId: t, kind: 'activity', status: 'pending', title: '蜀风雅韵 · Sichuan opera', category: 'show',
      pin: c(30.6635, 104.043), groupLabel: 'Still to buy', date: '2027-04-08', venue: 'Shufeng Yayun theatre 蜀风雅韵',
      mapQuery: '蜀风雅韵', mapCity: '成都', meta: [{ k: 'Price', v: '¥180 (sample)' }, { k: 'Show', v: '20:00' }], ...stamp,
    },
    {
      id: 'dm27-ticket-li-river', tripId: t, kind: 'activity', status: 'pending', title: 'Li River raft · Yangdi → Xingping', category: 'sight',
      pin: c(24.9295, 110.518), groupLabel: 'Still to buy', date: '2027-04-10', venue: 'Yangdi pier 杨堤码头',
      mapQuery: '杨堤码头', mapCity: '阳朔', meta: [{ k: 'Price', v: '¥210 (sample)' }], ...stamp,
    },
    {
      id: 'dm27-ticket-races', tripId: t, kind: 'activity', status: 'pending', title: 'Happy Valley races · public enclosure', category: 'sight',
      groupLabel: 'Still to buy', date: '2027-04-14', venue: 'Happy Valley Racecourse — the public enclosure', time: '19:15',
      meta: [{ k: 'Price', v: 'HK$10 at the gate' }], ...stamp,
    },
    {
      id: 'dm27-ticket-macau-ferry', tripId: t, kind: 'activity', status: 'pending', title: 'Macau ferry · both legs', category: 'transport',
      pin: c(22.28867, 114.15244), groupLabel: 'Still to buy', date: '2027-04-15', venue: 'Sheung Wan ⇄ Taipa',
      mapQuery: 'Hong Kong-Macau Ferry Terminal', mapCity: 'Hong Kong', meta: [{ k: 'Price', v: 'HK$350 return (sample)' }, { k: 'Return', v: '~16:15' }], ...stamp,
    },
    {
      id: 'dm27-ticket-concert', tripId: t, kind: 'activity', status: 'booked', title: 'Sample Orchestra · spring concert', category: 'show',
      pin: c(22.29372, 114.17046), groupLabel: 'Booked', date: '2027-04-16', venue: 'Hong Kong Cultural Centre Concert Hall', time: '19:30',
      code: 'DEMO-TIX-0001', codeLabel: 'Sample ticket ref', codeSub: 'Stalls, row K', paidMinor: 6200, priceNote: 'HK$480',
      mapQuery: 'Hong Kong Cultural Centre', mapCity: 'Hong Kong', address: '香港尖沙咀梳士巴利道10號',
      meta: [{ k: 'Seat', v: 'K21' }, { k: 'Doors', v: '19:00' }], ...stamp,
    },
    {
      id: 'dm27-ticket-ngong-ping', tripId: t, kind: 'activity', status: 'pending', title: 'Ngong Ping 360 cable car', category: 'transport',
      pin: c(22.29017, 113.93864), groupLabel: 'Still to buy', date: '2027-04-17', venue: 'Tung Chung terminal → Ngong Ping, Lantau',
      mapQuery: 'Ngong Ping 360 Tung Chung', mapCity: 'Hong Kong', meta: [{ k: 'Price', v: 'HK$270 return (sample)' }], ...stamp,
    },
    {
      id: 'dm27-ticket-dim-sum', tripId: t, kind: 'activity', status: 'pending', title: 'Sample Harbour Dim Sum · optional splurge (not booked)', category: 'food',
      pin: c(22.2865, 114.1569), groupLabel: 'Optional', date: '2027-04-17', venue: 'Sample Harbour Dim Sum, Central',
      mapQuery: 'Sample Harbour Dim Sum', mapCity: 'Hong Kong', meta: [{ k: 'Price', v: '~HK$600pp (sample)' }], ...stamp,
    },
  ] as Booking[];
}
