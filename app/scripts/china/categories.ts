/* WHAT EACH PLACE IS FOR — the Map tab's category (icon, colour, filter chip).

   One of eight (PlaceCategory, model/types.ts), decided in this order:

   1. THE TRIP'S OWN WORDS, where they say what the place is for the
      traveller. OVERRIDES below, each with the words it rests on. The
      Beijing Massage Hospital is a spa — "blind massage / tuina, not
      bone-setting" — though OpenStreetMap files it as a hospital; the Huguosi
      TCM Hospital is medical — "骨伤科 bone-setting".
   2. OPENSTREETMAP'S TAGS, but only those of a PIN — the answer the
      coordinate pass found to BE the place (pins.ts). An answer that failed
      the checks, or a button gate's first answer (for 后海 that is the metro
      station), says nothing about the place.
   3. THE ENTITY'S OWN KIND: a spot's kind, a booking's kind, and for a driver
      card — which has none — the card's own meaning (CARD_KIND). A card's
      category never comes from OSM: its meaning already says what it is.

   Nothing here is looked up; it is read from pins.ts and the trip. */
import type { Booking, PlaceCategory } from '../../src/lib/model/types';

export const PLACE_CATEGORIES: readonly PlaceCategory[] = ['food', 'spa', 'sight', 'show', 'hotel', 'transport', 'medical', 'shopping'];

/* Rule 2 — OSM class=type → category. The brief's table (MAP-5A.md), with
   the classes it implies spelled out: aerialways, ferry terminals and bus
   stations move you; a bakery or a tea shop is somewhere you eat, so the food
   shops are food and every other shop is shopping. Anything not listed (a
   road, a building, a boundary, a pier) says nothing, and the kind decides. */
const FOOD_SHOPS = ['bakery', 'pastry', 'confectionery', 'deli', 'tea', 'coffee', 'dairy', 'seafood', 'food'];

export function categoryFromOsm(osmClass: string): PlaceCategory | null {
  const [cls = '', type = ''] = osmClass.split('=');
  if (cls === 'amenity' && ['restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub', 'biergarten', 'ice_cream'].includes(type)) return 'food';
  if (cls === 'shop' && FOOD_SHOPS.includes(type)) return 'food';
  if ((cls === 'leisure' && ['spa', 'sauna'].includes(type)) || (cls === 'amenity' && type === 'public_bath') || (cls === 'natural' && type === 'hot_spring') || (cls === 'shop' && type === 'massage')) return 'spa';
  if (cls === 'amenity' && ['theatre', 'arts_centre', 'concert_hall'].includes(type)) return 'show';
  if (cls === 'tourism' && ['hotel', 'guest_house', 'hostel', 'motel'].includes(type)) return 'hotel';
  if (['railway', 'aeroway', 'public_transport', 'aerialway'].includes(cls) || (cls === 'amenity' && ['ferry_terminal', 'bus_station'].includes(type))) return 'transport';
  if (cls === 'amenity' && ['hospital', 'clinic', 'pharmacy', 'doctors'].includes(type)) return 'medical';
  if (cls === 'healthcare') return 'medical';
  if (cls === 'shop' || (cls === 'amenity' && type === 'marketplace')) return 'shopping';
  if ((cls === 'tourism' && ['attraction', 'museum', 'viewpoint', 'gallery', 'zoo', 'theme_park', 'artwork'].includes(type)) || cls === 'historic' || (cls === 'leisure' && ['park', 'garden', 'nature_reserve'].includes(type)) || cls === 'natural') return 'sight';
  if (cls === 'amenity' && type === 'place_of_worship') return 'sight';
  return null;
}

/* Rule 3 — a spot's kind. 'other' has no category of its own; the one
   spot of that kind (the Dounan flower market) is placed by its tags. */
const SPOT_KIND: Record<string, PlaceCategory> = { sight: 'sight', food: 'food', show: 'show', transport: 'transport', other: 'sight' };

export function bookingKindCategory(b: Booking): PlaceCategory {
  if (b.kind === 'hotel') return 'hotel';
  if (b.kind === 'flight' || b.kind === 'train' || b.kind === 'other') return 'transport';
  return 'sight';
}

/* Rule 3 for a driver card — what its own meaning says it is. */
export const CARD_KIND: Record<string, { category: PlaceCategory; why: string }> = {
  'cn26-place-00': { category: 'hotel', why: "the academy — the Nov 23 – Dec 5 bed (cn26-stay-11), 'accommodation is inside the $840'" },
  'cn26-place-01': { category: 'transport', why: 'Beijing Daxing International Airport' },
  'cn26-place-02': { category: 'transport', why: 'Beijing Capital Airport Terminal 3' },
  'cn26-place-03': { category: 'transport', why: 'Beijing South Railway Station' },
  'cn26-place-04': { category: 'sight', why: 'Sanlitun — a district: Taikoo Li, the bars' },
  'cn26-place-05': { category: 'sight', why: 'Houhai — the lakes' },
  'cn26-place-06': { category: 'spa', why: "'Qushui Lanting spa — the Dec 5 midnight massage'" },
  'cn26-place-07': { category: 'spa', why: "'blind massage / tuina, not bone-setting'" },
  'cn26-place-09': { category: 'transport', why: 'Zhangjiajie Hehua Airport' },
  'cn26-place-10': { category: 'sight', why: "'Zhangjiajie park gate'" },
  'cn26-place-11': { category: 'sight', why: "'Tianmen Mountain cableway' — the mountain is the visit; the Dec 14 ticket is the mountain's" },
  'cn26-place-12': { category: 'transport', why: 'Chongqing Jiangbei Airport Terminal 3' },
  'cn26-place-13': { category: 'sight', why: 'Hongya Cave' },
  'cn26-place-14': { category: 'sight', why: 'Ciqikou old quarter' },
  'cn26-place-15': { category: 'transport', why: 'Lijiang Sanyi Airport' },
  'cn26-place-16': { category: 'sight', why: 'Lijiang Old Town' },
  'cn26-place-17': { category: 'sight', why: "'Tiger Leaping Gorge trailhead'" },
  'cn26-place-18': { category: 'sight', why: 'Dali Ancient City' },
  'cn26-place-19': { category: 'transport', why: 'Kunming South Railway Station' },
  'cn26-place-20': { category: 'transport', why: 'Kunming Changshui Airport' },
  'cn26-place-21': { category: 'food', why: "'cured pork-rib hotpot'" },
  'cn26-place-22': { category: 'food', why: "'Tujia dry pot'" },
  'cn26-place-23': { category: 'food', why: "'Yanshe Hot Pot'" },
  'cn26-place-24': { category: 'medical', why: "'Shan Clinic'" },
  'cn26-place-26': { category: 'sight', why: 'Jiefangbei Monument' },
  'cn26-place-27': { category: 'medical', why: "'骨伤科 bone-setting'" },
  'cn26-place-28': { category: 'hotel', why: "'the Shanghai bed, Dec 9–11' — the Hi Cozy hostel (cn26-stay-13)" },
};

/* Rule 1 — where the trip's own words say what a place is for, and OSM's
   tags (or the kind) would say something else. Keyed by seed entity id. */
export const OVERRIDES: Record<string, { category: PlaceCategory; why: string }> = {
  'cn26-place-07': { category: 'spa', why: "the card: 'blind massage / tuina, not bone-setting' — OSM files it amenity=hospital" },
  'cn26-spot-beijing-jiuhua': { category: 'spa', why: "Dec 8: 'All-day hot springs at Jiuhua Resort' — a day pass to 70+ pools, not a bed" },
  'cn26-spot-beijing-chunhuiyuan': { category: 'spa', why: "Dec 8: the 'quieter alternative' for the hot springs" },
  'cn26-spot-chongqing-ronghui': { category: 'spa', why: "Dec 15: 'Ronghui Hot Springs soak'" },
  'cn26-spot-beijing-laoshe': { category: 'show', why: "'90-min variety night: opera, acrobatics, face-changing, kung fu' — a teahouse by name, a show by what you go for" },
  'cn26-spot-hongkong-peninsula': { category: 'show', why: "the trip lists 'Afternoon tea at The Peninsula Lobby … with a live string ensemble' under Shows & music — not a bed" },
  'cn26-spot-gorge-tea-horse': { category: 'food', why: "Dec 18: 'lunch stop: Tea Horse Guesthouse terrace' — the bed is Halfway" },
  'cn26-spot-lijiang-zhongyi': { category: 'food', why: "'the food stalls at the edge are the cheap breakfast' — listed under Where to eat" },
  'cn26-spot-hongkong-lord-stows': { category: 'food', why: "Dec 22: 'Lord Stow's egg tarts'" },
  'cn26-spot-hongkong-tai-kwun': { category: 'sight', why: "'free galleries and courtyards in a restored Victorian compound' — OSM files it amenity=arts_centre, which would read as a show" },
  'cn26-spot-hongkong-macau-ferry': { category: 'transport', why: "'check the terminal: Macau route currently sails from Sheung Wan' — the ferry; OSM files the Shun Tak Centre as a mall" },
  'cn26-spot-beijing-panjiayuan': { category: 'shopping', why: "'antique market … bargaining expected'" },
  'cn26-spot-kunming-dounan': { category: 'shopping', why: "'The Dounan flower market — the largest in Asia'" },
};

/** The category of a spot, a card or a booking — rule 1, then 2, then 3. */
export function categoryOf(entity: string, confirmedOsmClass: string | undefined, fallback: PlaceCategory): { category: PlaceCategory; from: 'trip' | 'osm' | 'kind' } {
  const o = OVERRIDES[entity];
  if (o) return { category: o.category, from: 'trip' };
  const byOsm = confirmedOsmClass ? categoryFromOsm(confirmedOsmClass) : null;
  if (byOsm) return { category: byOsm, from: 'osm' };
  return { category: fallback, from: 'kind' };
}

export const spotKindCategory = (kind: string): PlaceCategory => SPOT_KIND[kind] ?? 'sight';
