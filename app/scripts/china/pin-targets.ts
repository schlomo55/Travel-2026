/* THE PLACES THE MAP TAB WANTS A PIN FOR THAT NO MAP BUTTON HAS EVER ASKED ABOUT.

   Every other lookup `npm run verify:places` makes is a map button's own name
   (map-links.ts, spots.ts), and the coordinate pass reuses that answer. These
   entries are different: they exist ONLY so the Map tab (MAPS6.md) can draw a
   pin, and nothing here ever becomes a button. A bed never ships a dot — the
   rule in map-links.ts stands untouched — and a pin is not a dot: it is drawn,
   never opened. A bed's button keeps opening its address, its name or nothing,
   exactly as before.

   THE SAME DISCIPLINE AS EVERY OTHER NAME IN THIS REPO:
   · `query` is the trip's OWN name for the place — the Chinese name the
     accommodation document prints where it prints one, else the booked name.
   · `expect` are the tokens OpenStreetMap's answer must carry, and each one is
     a spelling the trip's own documents use. None is a guess at what OSM
     might call it.
   · `anchor` is a coordinate this repo ALREADY verified (coords.ts), chosen
     because the trip's own words tie the place to it, and `nearKm` is how far
     those words allow ("1.2 km to Taikoo Li" → 2 km from the Sanlitun card).
     A tight circle is the point: a hotel brand has branches, and the circle is
     what tells them apart.

   Anything the rules cannot confirm stays without a pin, and the Map tab lists
   it by name. The academy (cn26-stay-11, cn26-place-00) is not asked at all:
   it has never said where it is, and 昆嵛山自然保护区 names a conservation
   district, not a door. */
import type { Coord } from '../../src/lib/model/types';
import { PLACE_COORDS, STOP_COORDS } from './coords';
import type { PinKind } from './pin-rules';

export interface PinOnlyTarget {
  /** The verify:places row id — `stay:NN` for a bed, the card id for a card. */
  id: string;
  /** The seed entity the pin lands on. */
  entity: string;
  query: string;
  city?: string;
  expect: string[];
  anchor: Coord;
  nearKm: number;
  kind: PinKind;
  why: string;
}

const at = (c: Coord | undefined, what: string): Coord => {
  if (!c) throw new Error(`pin-targets: ${what} has no verified coordinate to anchor on`);
  return c;
};

export const PIN_ONLY: PinOnlyTarget[] = [
  /* ---- the beds ---- */
  {
    id: 'stay:00',
    entity: 'cn26-stay-00',
    query: '北京三里屯工体福朋喜来登酒店',
    city: '北京',
    expect: ['福朋喜来登', 'Four Points'],
    anchor: at(PLACE_COORDS['cn26-place-04'], 'Sanlitun'),
    nearKm: 2,
    kind: 'hotel',
    why: "the accommodation document's own Chinese name (§2); the stop's Sleep block puts it '1.2 km to Taikoo Li', so it is measured from the Sanlitun card (04, the Taikoo Li core) at 2 km — the circle, not the brand, tells it from Beijing's other Four Points",
  },
  {
    id: 'stay:01',
    entity: 'cn26-stay-01',
    query: 'Blossom House',
    city: '北京',
    expect: ['Blossom House'],
    anchor: at(PLACE_COORDS['cn26-place-05'], 'Houhai'),
    nearKm: 1.5,
    kind: 'hotel',
    why: "the booked name; the listings put it a 5-minute walk from Prince Kung's Mansion, on the lakes card 05 opens, so 1.5 km from that card. The 2026-07-28 re-attempt (map-links.ts) found no hotel under any name, only its hutong",
  },
  {
    id: 'stay:02',
    entity: 'cn26-stay-02',
    query: '张家口崇礼太舞威斯汀源宿酒店',
    city: '崇礼',
    expect: ['源宿', 'Element'],
    anchor: at(STOP_COORDS.chongli, 'the Chongli stop'),
    nearKm: 5,
    kind: 'hotel',
    why: "the Chinese property name printed on the Agoda confirmation (accommodation §4 — 源宿 is Marriott's Chinese name for Element); Thaiwoo is the resort 'closest to Taizicheng station' (spots.ts thaiwoo), so 5 km from the Taizicheng stop pin",
  },
  {
    id: 'stay:03',
    entity: 'cn26-stay-03',
    query: 'Pullman Zhangjiajie',
    city: '张家界',
    expect: ['Pullman'],
    anchor: at(PLACE_COORDS['cn26-place-10'], 'Wulingyuan'),
    nearKm: 5,
    kind: 'hotel',
    why: "the booked name (accommodation §5: 'Hotel Pullman Zhangjiajie'); its address is Gaoyun Road, Wulingyuan, so it is measured from the Wulingyuan card (10) at POI_KM, 5 km — Zhangjiajie city, 26 km away, is outside it",
  },
  {
    id: 'stay:05',
    entity: 'cn26-stay-05',
    query: 'Glenview ITC Plaza',
    city: '重庆',
    expect: ['Glenview'],
    anchor: at(PLACE_COORDS['cn26-place-26'], 'Jiefangbei'),
    nearKm: 1,
    kind: 'hotel',
    why: "the booked name; map-links.ts records Jiefangbei (card 26) as '390 m away', so 1 km from that card",
  },
  {
    id: 'stay:06',
    entity: 'cn26-stay-06',
    query: 'Yue Tu Inn',
    city: '丽江',
    expect: ['Yue Tu'],
    anchor: at(PLACE_COORDS['cn26-place-16'], 'Lijiang Old Town'),
    nearKm: 2,
    kind: 'hotel',
    why: "the booked name; its address is Yizheng Jinjia Street, Dayan Ancient Town, so 2 km from the old-town card (16)",
  },
  {
    id: 'stay:08',
    entity: 'cn26-stay-08',
    query: '大理晏清山居客栈',
    city: '大理',
    expect: ['晏清山居', 'Yanyuan'],
    anchor: at(PLACE_COORDS['cn26-place-18'], 'Dali Ancient City'),
    nearKm: 1.5,
    kind: 'hotel',
    why: "the Chinese name the booking itself prints (accommodation §10); map-links.ts records it '790 m from' the ancient city card (18), so 1.5 km",
  },
  {
    id: 'stay:09',
    entity: 'cn26-stay-09',
    query: '宜必思酒店(昆明长水国际机场店)',
    city: '昆明',
    expect: ['宜必思', 'ibis'],
    anchor: at(PLACE_COORDS['cn26-place-20'], 'Kunming Changshui Airport'),
    nearKm: 5,
    kind: 'hotel',
    why: "the Chinese name the booking prints (accommodation §11); map-links.ts records the terminal (card 20) as '3.4 km away', so 5 km from that card",
  },
  {
    id: 'stay:10',
    entity: 'cn26-stay-10',
    query: 'The Royal Garden',
    city: 'Hong Kong',
    expect: ['Royal Garden'],
    anchor: at(STOP_COORDS.hongkong, 'the Hong Kong stop'),
    nearKm: 1.5,
    kind: 'hotel',
    why: "the booked name; its own confirmation prints 69 Mody Road, Tsimshatsui East — 1.5 km from the TST harbourfront stop pin",
  },
  /* ---- the six place cards with no coordinate ---- */
  {
    id: 'cn26-place-06',
    entity: 'cn26-place-06',
    query: '曲水兰亭',
    city: '北京',
    expect: ['曲水兰亭'],
    anchor: at(PLACE_COORDS['cn26-place-04'], 'Sanlitun'),
    nearKm: 20,
    kind: 'spa',
    why: "the card's own Chinese name; Dec 5 reaches it on a '15–20-min DiDi' from the Sanlitun bars, so 20 km from the Sanlitun card. coords.ts records the 2026-07-28 collision (a development in Qingdao)",
  },
  {
    id: 'cn26-place-21',
    entity: 'cn26-place-21',
    query: '象山腊排骨',
    city: '丽江',
    expect: ['象山腊排骨'],
    anchor: at(STOP_COORDS.lijiang, 'the Lijiang stop'),
    nearKm: 10,
    kind: 'food',
    why: "the card's own Chinese name — a Lijiang restaurant; 10 km from the old-town stop pin",
  },
  {
    id: 'cn26-place-22',
    entity: 'cn26-place-22',
    query: '胡师傅三下锅',
    city: '张家界',
    expect: ['胡师傅三下锅'],
    anchor: at(STOP_COORDS.zhangjiajie, 'the Zhangjiajie stop'),
    nearKm: 30,
    kind: 'food',
    why: "the card's own Chinese name — a Zhangjiajie restaurant, city or park side; 30 km from the Wulingyuan stop pin covers both",
  },
  {
    id: 'cn26-place-23',
    entity: 'cn26-place-23',
    query: '滟设火锅',
    city: '重庆',
    expect: ['滟设火锅'],
    anchor: at(STOP_COORDS.chongqing, 'the Chongqing stop'),
    nearKm: 10,
    kind: 'food',
    why: "the card's own Chinese name; its meaning puts it on Nanbin Road, across the river from the Jiefangbei stop pin, so 10 km",
  },
  {
    id: 'cn26-place-25',
    entity: 'cn26-place-25',
    query: '太舞滑雪小镇',
    city: '崇礼',
    expect: ['太舞'],
    anchor: at(STOP_COORDS.chongli, 'the Chongli stop'),
    nearKm: 5,
    kind: 'sight',
    why: "the card's own Chinese name; Thaiwoo is the resort 'closest to Taizicheng station' (spots.ts thaiwoo), so 5 km from the stop pin. OSM carried neither spelling on 2026-07-25",
  },
];

/* MACAU IS ITS OWN CITY. Its seven spots hang off the Hong Kong stop — Dec 22
   is a day trip — and their buttons are gated at 75 km from the Tsim Sha Tsui
   pin, a circle that only the name can make mean anything (spots.ts). For a
   PIN the anchor is Macau itself: Senado Square, the coordinate the trip's own
   research cites for it (Wikipedia/Wikidata Q837935, spots.ts `senado`), and
   10 km — the peninsula, Taipa and Coloane, whose village sits 8.7 km south. */
const SENADO: Coord = { lat: 22.19358, lng: 113.53967 };
const MACAU = (spot: string) => ({
  [`hongkong/${spot}`]: {
    anchor: SENADO,
    nearKm: 10,
    why: 'Macau, measured from Senado Square (Wikidata Q837935, as spots.ts cites it) — the city it is in, not the Tsim Sha Tsui pin 65 km away',
  },
});

/** Where a map button's own lookup is reused for a pin but the trip's words tie
    the place to a CLOSER verified coordinate than the one the button is gated
    against. The button's gate is unchanged; only the pin is held to this. */
export const PIN_ANCHORS: Record<string, { anchor: Coord; nearKm: number; why: string }> = {
  'stay:04': {
    anchor: at(PLACE_COORDS['cn26-place-11'], 'the Tianmen cableway'),
    nearKm: 1,
    why: "the accommodation document puts Huatian '450 m from the Tianmen cableway', whose lower station is card 11's verified coordinate — so the pin is held to 1 km of it, not to the 30 km its button is gated with from Wulingyuan",
  },
  ...MACAU('ruins-st-paul'),
  ...MACAU('senado'),
  ...MACAU('coloane'),
  ...MACAU('lord-stows'),
  ...MACAU('outer-harbour-ferry'),
  ...MACAU('taipa-ferry'),
  /* Lijiang has TWO squares called 四方街 — Dayan's, and Shuhe's 6.5 km away —
     and the default 25 km circle holds both. The trip puts this one in the
     old town: "the Naxi courtyard houses, water channels and Sifang square",
     and Lion Hill "five minutes uphill from Sifang Square". */
  'lijiang/sifang': {
    anchor: at(STOP_COORDS.lijiang, 'Dayan old town'),
    nearKm: 1.5,
    why: "in Dayan old town, by the trip's own words ('the Naxi courtyard houses, water channels and Sifang square'), so 1.5 km from the old-town pin — Shuhe's own 四方街 is 6.5 km away",
  },
};

/** A place's own kinds (`class=type`, or `class=*`), where the trip says
    exactly what it is and the kind table would accept a namesake. */
export const PIN_FITS: Record<string, { fits: readonly string[]; why: string }> = {
  'hongkong/taipa-ferry': {
    fits: ['amenity=ferry_terminal'],
    why: "the FERRY terminal — spots.ts: 'a light-rail station of the same name is a separate item'; OSM's answers under this name are that station's nodes",
  },
  'hongkong/outer-harbour-ferry': {
    fits: ['amenity=ferry_terminal'],
    why: "the ferry terminal — OSM's answers under this name are the bus stop and the bus terminus in front of it",
  },
  'hongkong/macau-ferry': {
    fits: ['amenity=ferry_terminal', 'shop=mall'],
    why: "the terminal 'in the Shun Tak Centre' (spots.ts): OSM files the complex as a mall and links it to the terminal's own Wikidata item Q3207485",
  },
  'hongkong/hzmb-hk': {
    fits: ['amenity=bus_station', 'amenity=ferry_terminal', 'landuse=highway', 'building=*'],
    why: "a road border crossing: OSM files the port as landuse=highway and links it to the port's own Wikidata item Q57599408",
  },
  'kunming/guandu': {
    fits: ['tourism=*', 'historic=*', 'place=*'],
    why: "the ANCIENT TOWN — spots.ts: 'OSM only has the subdistrict of the same name that contains it', and a subdistrict is not the town",
  },
};
