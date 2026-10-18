/* ONE LINE ABOUT EACH PLACE, IN THE TRIP'S OWN WORDS — the Map tab's `detail`.

   THE RULE, without exception: every line below is a VERBATIM stretch of the
   trip's own text about that place — an option line, a See & do line, a day's
   plan, a stop's Sleep block, a driver card's meaning, a ticket's note —
   trimmed to one clause, never composed, never general knowledge, at most
   DETAIL_MAX characters. The only liberty taken is a capital first letter,
   because a clause cut from mid-sentence starts in lower case.

   The build proves it (assert.ts → detailProblems): each line must be found,
   whole, in `ownText()` of its entity — the texts below, read as plain words
   (md-lite markers stripped, spaces collapsed). A line that is not there
   fails the seed build, so nothing here can drift into paraphrase.

   A place the trip does not describe has NO line, and that is the honest
   answer: flights, trains and road legs are movements, not places; and some
   places are named but never described (the Outer Harbour ferry terminal,
   Senado Square, Big Wave Bay, Po Lin Monastery). Picked by hand, as spots.ts names
   its places by hand: matching names back out of prose is a guessing machine. */
import type { TripBundle } from '../../src/lib/model/types';
import { mdliteToText } from '../../src/lib/logic/mdlite';

export const DETAIL_MAX = 90;

/** Keyed by seed entity id. */
export const DETAILS: Record<string, string> = {
  /* ---- Kunyu ---- */
  'cn26-spot-kunyu-park': 'Granite ridges, pine and old Taoist temple sites',
  'cn26-spot-kunyu-yantaishan': '1905 lighthouse + old treaty-port consulates, free',
  'cn26-spot-kunyu-penglai': 'Sea-cliff tower from 1061, near-empty in December',
  'cn26-spot-kunyu-suochengli': '600-year walled-town lanes, black-tiled Shandong courtyards',
  'cn26-spot-kunyu-changyu': "China's oldest winery (1892), tasting included; indoor Sunday option",
  'cn26-spot-kunyu-yangma': 'A low coastal loop east of Muping, close to the academy',
  'cn26-spot-kunyu-zhifu': 'The headland north of Yantai with a cliff path and a small fishing harbour',
  'cn26-spot-kunyu-museum': 'Carved timber and sea-goddess halls, indoors and warm',
  'cn26-spot-kunyu-weihai': 'The seafront park, the Happiness Gate and the Liugong Island ferry',
  /* ---- Beijing ---- */
  'cn26-spot-beijing-798': 'Bauhaus factory halls turned into galleries and cafés',
  'cn26-spot-beijing-beihai': 'The White Dagoba above a frozen lake, ten minutes on foot from Jingshan',
  'cn26-spot-beijing-drum-tower': 'Climb the Drum or Bell Tower for the hutong rooftops',
  'cn26-spot-beijing-bell-tower': 'Climb the Drum or Bell Tower for the hutong rooftops',
  'cn26-spot-beijing-national-museum': 'Free, enormous and warm; the grey-day answer that never disappoints',
  'cn26-spot-beijing-nanluoguxiang': 'The parallel hutongs east and west are where the quiet courtyard bars are',
  'cn26-spot-beijing-observatory': 'Ming and Qing bronze instruments on a surviving city-wall tower',
  'cn26-spot-beijing-ming-tombs': 'The tree-lined spirit road with its stone animals',
  'cn26-spot-beijing-panjiayuan': 'The real version happens on weekend mornings; bargaining expected',
  'cn26-spot-beijing-capital-museum': "The city's own story, quieter than the national one and just as warm",
  'cn26-spot-beijing-wangfujing': 'The church, the bookshop street and an indoor hour when the wind is unbearable',
  'cn26-spot-beijing-palace-museum': 'The one thing in Beijing you cannot improvise: tickets are released seven days ahead',
  'cn26-spot-beijing-temple-heaven': 'Imperial altar in winter frost, morning tai chi crowds',
  'cn26-spot-beijing-lama-temple': '18m sandalwood Buddha, walkable from the hutongs; winter hours to 16:30',
  'cn26-spot-beijing-summer-palace': 'Off-season quiet, Kunming Lake starts freezing over',
  'cn26-spot-beijing-shichahai': 'Willow-lined hutong lakesides, free',
  'cn26-spot-beijing-mutianyu': "The first-timer's right answer in winter: further than Badaling but far quieter",
  'cn26-spot-beijing-yaoji': 'One of the last places doing the real Beijing breakfast stew',
  'cn26-spot-beijing-donglaishun': 'Copper-pot mutton hotpot since 1903',
  'cn26-spot-beijing-sijiminfu': "The Peking duck locals name, five minutes from the Forbidden City's east exit",
  'cn26-spot-beijing-laoshe': '90-min variety night: opera, acrobatics, face-changing, kung fu + snacks, ¥180–580',
  'cn26-spot-beijing-ncpa': 'Early-Dec orchestra/opera, start of New Year concert season',
  'cn26-spot-beijing-concert-hall': 'Vienna-style Strauss/New Year and chamber programs in December',
  'cn26-spot-beijing-jingshan': 'The view over the whole golden-roofed city — best in the last hour before sunset',
  'cn26-spot-beijing-jinshanling': 'In-gate → East Five-Window Tower ("Tower 22"), ~7km / 3.5–5h',
  'cn26-spot-beijing-jiuhua': 'All-day hot springs at Jiuhua Resort, Xiaotangshan (~1h north, ¥138 day pass, 70+ pools)',
  'cn26-spot-beijing-chunhuiyuan': 'Quieter alternative: Chunhuiyuan 春晖园',
  /* ---- Chongli ---- */
  /* ---- Zhangjiajie ---- */
  'cn26-spot-zhangjiajie-yuanjiajie': 'The Hallelujah pillar and the First Bridge are the view you came for',
  'cn26-spot-zhangjiajie-tianzishan': 'The pillar sea with low sun, and on a good day the fog sits below you',
  'cn26-spot-zhangjiajie-yangjiajie': 'The quietest of the four areas and the best ridge walking',
  'cn26-spot-zhangjiajie-bailong': 'Take the Bailong lift up and walk down',
  'cn26-spot-zhangjiajie-golden-whip': 'The flat 7 km walk along the valley floor between the pillars',
  'cn26-spot-zhangjiajie-shili': 'Ten minutes under the "ten-mile" pillar wall, almost no effort',
  'cn26-spot-zhangjiajie-glass-bridge': '380m span, 300m over the gorge, quiet in December',
  'cn26-spot-zhangjiajie-huanglong': 'Giant karst cave with an underground river boat — the all-weather backup day',
  'cn26-spot-zhangjiajie-baofeng': 'Boat ride between the karst peaks, ~¥110',
  'cn26-spot-zhangjiajie-puguang': 'Puguang Temple and the riverside are ten minutes from the Tianmen cableway base',
  'cn26-spot-zhangjiajie-zjj-west': "The hotel's driver runs you to Zhangjiajie West",
  /* ---- Chongqing ---- */
  'cn26-spot-chongqing-liziba': 'The monorail that runs straight through an apartment block',
  'cn26-spot-chongqing-nanbin': 'The whole skyline in one frame from the far bank',
  'cn26-spot-chongqing-three-gorges-museum': 'Free, warm and genuinely good on a fog day',
  'cn26-spot-chongqing-huguang': 'Restored Qing merchant halls and opera stages above the river',
  'cn26-spot-chongqing-chaotianmen': 'A two-rivers night cruise from Chaotianmen — the lazy version of the skyline',
  'cn26-spot-chongqing-one-tree': 'The high panorama, a taxi up and a taxi back',
  'cn26-spot-chongqing-sichuan-fine-arts': 'A whole street of painted buildings; the odd, good, rainy-afternoon choice',
  'cn26-spot-chongqing-cableway': 'Buy one-way from the Jiefangbei side late evening, walk back over Dongshuimen Bridge',
  'cn26-spot-chongqing-shibati': 'Ming/Qing stone steps lit by lanterns from ~18:00, near Jiefangbei',
  'cn26-spot-chongqing-eling': 'Banknote-factory arts quarter with a free two-rivers panorama',
  'cn26-spot-chongqing-grand-theatre': 'December = New Year Concert season + visiting orchestras',
  'cn26-spot-chongqing-qiansimen': 'The cyberpunk shot',
  'cn26-spot-chongqing-ronghui': 'If the legs are still complaining about Zhangjiajie',
  'cn26-spot-chongqing-theatre-1949': 'English earpiece free, ¥150 refundable deposit — cash/WeChat/Alipay',
  /* ---- Lijiang ---- */
  'cn26-spot-lijiang-black-dragon': 'Jade Dragon Snow Mountain reflected in the pond is the Lijiang photograph',
  'cn26-spot-lijiang-lion-hill': 'Five minutes uphill from Sifang Square for the whole grey-tiled roofscape',
  'cn26-spot-lijiang-jade-dragon': 'The big day out: in December the peak is properly snowbound and the air is thin',
  'cn26-spot-lijiang-mufu': "The Naxi chieftains' compound, rebuilt after the 1996 earthquake",
  'cn26-spot-lijiang-dongba': 'The pictographic script, which is the genuinely unusual thing here',
  'cn26-spot-lijiang-baisha': 'Ming temple paintings, older and far quieter than anything in Dayan',
  'cn26-spot-lijiang-yuhu': "Joseph Rock's old house and a stone village almost nobody visits",
  'cn26-spot-lijiang-lashihai': 'Birdlife and riding, half a day',
  'cn26-spot-lijiang-blue-moon': 'Much cheaper, much easier, and in winter nearly as good',
  'cn26-spot-lijiang-zhongyi': 'The food stalls at the edge are the cheap breakfast',
  'cn26-spot-lijiang-shuhe': "Dayan's older, calmer canal-side sister 4km away",
  'cn26-spot-lijiang-sifang': 'Best before 9am, before the day-trip crowds',
  'cn26-spot-lijiang-naxi-music': 'The small Naxi music evenings inside the old town are warmer, shorter and closer',
  /* ---- Tiger Leaping Gorge ---- */
  'cn26-spot-gorge-tea-horse': 'The one warm meal between Qiaotou and bed, and the terrace is the view',
  'cn26-spot-gorge-shangri-la': 'On to Shangri-La instead of back to Lijiang',
  /* ---- Dali ---- */
  'cn26-spot-dali-xizhou': 'Painted courtyard mansions and open fields. The best half day out of Dali',
  'cn26-spot-dali-caicun': 'The closest piece of lake to the old town, about fifteen minutes by taxi',
  'cn26-spot-dali-three-pagodas': '1,000-year Dali Kingdom icon, 10 min from the old town',
  'cn26-spot-dali-zhonghe': 'Closer to the old town, cheaper, lower, and it keeps running when the top is windy',
  'cn26-spot-dali-ximatan': 'To ~3,900m — snow-dusted peaks + Erhai views',
  'cn26-spot-dali-museum': 'In the old Qing yamen — small, warm and free or nearly so',
  'cn26-spot-dali-church': 'A Bai-style timber church with upturned eaves. An odd and lovely five minutes',
  'cn26-spot-dali-zhoucheng': 'Indigo dyeing you do yourself',
  'cn26-spot-dali-shuanglang': "Prettier than Caicun, but an hour's drive; only if a whole morning is free",
  'cn26-spot-dali-foreigner-street': 'The old backpacker strip, now mostly cafés. Good coffee, no illusions',
  'cn26-spot-dali-renmin-road': '饵块 erkuai, grilled cheese, 凉鸡米线',
  'cn26-spot-dali-jade-belt': 'The flat 18km Jade Belt Road at 2,600m',
  'cn26-spot-dali-longkan': "Sunrise at Longkan Wharf's red-metasequoia boardwalk + baba pancake",
  /* ---- Kunming ---- */
  'cn26-spot-kunming-cuihu': 'The Siberian gulls are the whole reason this night is more than a hotel',
  'cn26-spot-kunming-wenlin': 'Yunnan coffee, crossing-the-bridge noodles, and no tourist mark-up',
  'cn26-spot-kunming-yuantong': "Kunming's oldest, built down into a hollow so the halls sit at water level",
  'cn26-spot-kunming-guandu': 'A restored temple quarter with real snack streets, out on the line towards the airport',
  'cn26-spot-kunming-dounan': 'The largest in Asia and it trades late into the night',
  'cn26-spot-kunming-nanping': 'For the evening crowds if the lake is too cold to linger',
  'cn26-spot-kunming-zhengyi': 'For the evening crowds if the lake is too cold to linger',
  'cn26-spot-kunming-yunnan-university': 'Relaxed cafés and Yunnan coffee',
  /* ---- Hong Kong and Macau ---- */
  'cn26-spot-hongkong-man-mo': 'One continuous walk through the oldest part of the island',
  'cn26-spot-hongkong-hollywood-road': 'Incense to antiques to bars',
  'cn26-spot-hongkong-tai-kwun': 'Free galleries and courtyards in a restored Victorian compound',
  'cn26-spot-hongkong-lamma': 'An hour out of the city for the price of a coffee',
  'cn26-spot-hongkong-cheung-chau': 'The island villages are the antidote to Christmas crowds',
  'cn26-spot-hongkong-big-buddha': 'Free, 10:00–17:30; village 10:00–18:00, festive hours may shift',
  'cn26-spot-hongkong-sham-shui-po': 'Fabric, electronics and the best cheap food in the city',
  'cn26-spot-hongkong-wong-tai-sin': 'Fortune sticks and incense smoke, one stop from Chi Lin on the same line',
  'cn26-spot-hongkong-mplus': 'The big modern museum, walkable from TST along the harbour',
  'cn26-spot-hongkong-pmq': 'Design studios in a former police quarters, an easy hour off Hollywood Road',
  'cn26-spot-hongkong-tai-o': 'Fishing houses on poles over the water, best combined with the Big Buddha',
  'cn26-spot-hongkong-star-ferry': 'A few dollars, ten minutes, and still the best view in the city',
  'cn26-spot-hongkong-chi-lin': 'Free Tang-style nunnery and garden',
  'cn26-spot-hongkong-nan-lian': 'The quiet counterpoint to Christmas crowds',
  'cn26-spot-hongkong-happy-valley': 'HK$10 entry, floodlit racing under skyscrapers',
  'cn26-spot-hongkong-dragons-back': 'December is peak hiking weather; bus 9 from Shau Kei Wan MTR',
  'cn26-spot-hongkong-australia-dairy': 'Scrambled-egg toast + steamed milk pudding · closed Thursdays = Dec 24',
  'cn26-spot-hongkong-yat-lok': 'Michelin-starred roast goose leg, ~HK$100–200, cash only · closed Wednesdays = Dec 23',
  'cn26-spot-hongkong-kau-kee': '90-year-old beef brisket noodles (try curry tendon), expect a queue',
  'cn26-spot-hongkong-peninsula': "HK's tea ritual since 1928 with a live string ensemble; walk-in only, queue early",
  'cn26-spot-hongkong-cultural-centre': '~1 km from the bed, straight walk home along the waterfront',
  'cn26-spot-hongkong-the-peak': 'The Peak in the morning for clarity — winter mornings are the clear ones',
  'cn26-spot-hongkong-ngong-ping': 'By ~09:30 at the Tung Chung terminal — public holiday, it will be full',
  'cn26-spot-hongkong-lung-king-heen': 'First Chinese restaurant ever to hold three stars; dim sum lunch with harbour views',
  'cn26-spot-hongkong-macau-ferry': 'Check the terminal: Macau route currently sails from Sheung Wan',
  'cn26-spot-hongkong-shek-o': "Seafood straight off the Dragon's Back, bus 9 from Shau Kei Wan",
  'cn26-spot-hongkong-shau-kei-wan': 'Bus 9 from Shau Kei Wan MTR',
  'cn26-spot-hongkong-winterfest': 'Free, nightly, light and music: 4K 3D projection mapped onto eight landmark buildings',
  'cn26-spot-hongkong-hzmb-hk': 'Fallback if ferries are full: HZMB Golden Bus HK$65, 24h, no pre-book',
  'cn26-spot-hongkong-symphony': 'Free, five minutes from the hotel, and the skyline is the show',
  'cn26-spot-hongkong-ruins-st-paul': "Historic Centre + Ruins of St. Paul's before the crowds",
  'cn26-spot-hongkong-coloane': "Quiet Coloane village + Lord Stow's egg tarts",
  'cn26-spot-hongkong-lord-stows': 'The original bakery, where the Macanese egg tart was invented in 1989',
  'cn26-spot-hongkong-taipa-ferry': 'Leave Coloane ~15:15, Taipa terminal ~15:45',

  /* ---- the driver cards: their own meaning, or the stop's words about them ---- */
  'cn26-place-01': 'Arrival Nov 22, and the CA8641 to Yantai',
  /* since 28 Sep the card's meaning opens on its new job — CA1560 lands here;
     its "NOT the Dec 11 airport any more" warning is still the rest of it */
  'cn26-place-02': 'The Dec 5 arrival (CA1560, 16:15)',
  'cn26-place-04': 'Modern Beijing, international food, and the district your first hotel is in',
  'cn26-place-05': 'Blossom House district',
  'cn26-place-06': 'Treatment + pools + midnight buffet (~¥1,500–2,500 all-in)',
  'cn26-place-07': 'Blind massage / tuina, not bone-setting',
  'cn26-place-10': 'Zhangjiajie park gate, Dec 11–13',
  'cn26-place-11': 'The way up is cable car → shuttle bus → escalators',
  'cn26-place-13': 'A cliff of stacked wooden pavilions in lantern light',
  'cn26-place-14': 'The back lanes and the river steps, not the souvenir street everyone photographs',
  'cn26-place-16': 'The old town is a maze on purpose. Getting lost is the activity',
  'cn26-place-17': 'Tiger Leaping Gorge trailhead, Dec 18',
  'cn26-place-18': 'A walled old town between the Cangshan range and Erhai lake, at a gentler 1,900 m',
  'cn26-place-19': 'The Dec 20 FALLBACK arrival (the plan is Kunming Station 昆明站), NOT the bed',
  'cn26-place-20': 'The Dec 20 airport hotel and the Dec 21 exit',
  'cn26-place-21': 'Lijiang cured pork-rib hotpot',
  'cn26-place-22': 'Zhangjiajie Tujia dry pot',
  'cn26-place-23': 'Black Pearl 6 years running: tasting-menu hotpot, own yin-yang pot',
  'cn26-place-24': 'Futian, Shenzhen (undecided side trip)',
  'cn26-place-26': 'Glenview ITC Plaza, 390 m',
  'cn26-place-27': '骨伤科 bone-setting, Dec 8 morning',

  /* ---- the beds: each stop's own Sleep block ---- */
  'cn26-stay-00': '1.2 km to Taikoo Li · the Great Wall driver picks you up here on Dec 7',
  'cn26-stay-01': 'Heating confirmed before booking',
  'cn26-stay-02': 'CANCELLED by the owner on Agoda, 17 Oct 2026',
  'cn26-stay-03': 'Breakfast for 2, 900 m to Forest Park East Gate',
  'cn26-stay-04': '450 m to the Tianmen cableway',
  'cn26-stay-05': '390 m to Jiefangbei, 810 m to Hongyadong',
  'cn26-stay-06': '520 m to Sifang Square',
  'cn26-stay-07': 'Terrace over the gorge · walk-in cash, do not pre-book',
  'cn26-stay-08': '790 m to the old-town centre',
  'cn26-stay-09': 'One free airport transfer is itemised on the order · 3.4 km to the terminal',
  'cn26-stay-10': '920 m to the promenade, 1.1 km to the Star Ferry',
  'cn26-stay-11': 'Accommodation is inside the $840',
  /* the Muping night (booked 28 Sep) belongs to no stop's Sleep block — Nov 22
     is before the Kunyu stop starts — so its line is the school's own words
     about its lobby, from the Nov 23 plan */
  'cn26-stay-12': 'Earliest pickup 10:30, wait in the lobby',

  /* ---- the tickets: their own notes and venues ---- */
  'cn26-ticket-forbidden-city': 'The passport IS the ticket, so it has to be the one you travel on',
  'cn26-ticket-wall-guide': '~7 km / 3.5–5 h, heading down by ~13:30 and out the East Gate before 15:00',
  'cn26-ticket-forest-park': 'The park ticket is ¥165, passport real-name, valid 4 consecutive days',
  'cn26-ticket-tianmen': 'The hotel is 450 m from the cableway',
  'cn26-ticket-cq1949': 'Roughly an hour, a 360° rotating auditorium with water, fire and live staging',
  'cn26-ticket-jade-dragon': "Yue Tu's ¥550 tour is RESERVED for Dec 17",
  'cn26-ticket-ngong-ping': 'HK$270 Standard / HK$350 Crystal round trip',
  'cn26-ticket-lung-king-heen': 'The one meal on this trip that needs a reservation',
};

/** md-lite read as plain words, spaces collapsed — how a detail is matched. */
export const plainText = (s: string | undefined): string => mdliteToText(s ?? '').replace(/\s+/g, ' ').trim();

/* WHAT "THE TRIP'S OWN TEXT" IS, per entity — the only texts a detail may be
   cut from.
   · A spot: its own stop's options, blocks (and their day rows), See & do
     blocks and read-more text, and the plans of the days spent there — the
     day you leave included, since that day's plan is where its departure
     station is described.
   · A driver card: its own meaning and note, and the stops' and days' text —
     a card belongs to a city, not to one stop's list.
   · A booking: its own title, venue, note and chips, and the stops' and days'
     text (a bed is described in its stop's Sleep block). */
export function ownText(bundle: TripBundle, entity: string): string[] {
  const stopText = (st: TripBundle['stops'][number]): string[] => [
    ...(st.options ?? []).flatMap((b) => b.items),
    ...st.blocks.flatMap((b) => [...b.items, ...(b.dayRows ?? []).map((d) => d.text)]),
    ...st.recoBlocks.flatMap((b) => b.items),
    ...(st.detail ?? '').split(/\n+/),
  ];
  const dayText = (from?: string, to?: string): string[] => [
    ...bundle.dayPlans.filter((d) => (!from || d.date >= from) && (!to || d.date <= to)).flatMap((d) => d.planItems),
    ...bundle.dayDefaults.flatMap((d) => d.planItems),
  ];
  const everywhere = (): string[] => [...bundle.stops.flatMap(stopText), ...dayText()];

  let raw: string[] = [];
  const stop = bundle.stops.find((s) => (s.spots ?? []).some((sp) => sp.id === entity));
  if (stop) raw = [...stopText(stop), ...dayText(stop.start, stop.end)];
  else {
    const card = bundle.showCards.find((c) => c.id === entity);
    const booking = bundle.bookings.find((b) => b.id === entity);
    if (card) raw = [card.meaning, card.note ?? '', ...everywhere()];
    else if (booking)
      raw = [
        booking.title,
        booking.kind === 'activity' ? (booking.venue ?? '') : '',
        booking.note ?? '',
        ...booking.meta.map((m) => m.v),
        ...everywhere(),
      ];
  }
  return raw.map(plainText).filter(Boolean);
}

/** Is `detail` a verbatim stretch of one of `texts`? The first letter may have
    been capitalised; nothing else may differ. */
export function isVerbatim(detail: string, texts: string[]): boolean {
  const d = detail.trim();
  const lower = d.charAt(0).toLowerCase() + d.slice(1);
  return texts.some((t) => t.includes(d) || t.includes(lower));
}

/** Every broken promise in the table, as readable lines; [] when all hold. */
export function detailProblems(bundle: TripBundle): string[] {
  const out: string[] = [];
  const ids = new Set([
    ...bundle.stops.flatMap((s) => (s.spots ?? []).map((sp) => sp.id)),
    ...bundle.showCards.map((c) => c.id),
    ...bundle.bookings.map((b) => b.id),
  ]);
  for (const [id, d] of Object.entries(DETAILS)) {
    if (!ids.has(id)) out.push(`${id}: no such spot, card or booking`);
    else if (d.length > DETAIL_MAX) out.push(`${id}: ${d.length} characters, over ${DETAIL_MAX}`);
    else if (d !== d.trim() || !d) out.push(`${id}: blank or untrimmed`);
    else if (!isVerbatim(d, ownText(bundle, id))) out.push(`${id}: not found verbatim in its own text — "${d}"`);
  }
  return out;
}
