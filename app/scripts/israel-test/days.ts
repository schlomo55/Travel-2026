/* Day plans, the two Galilee defaults, and the five runbooks.

   Explicit day plans cover 2026-07-25 → 2026-08-16 and 2026-08-31 → 2026-09-22.
   The Galilee fortnight in between carries only two explicit days — the arrival
   and one planned Saturday — so everything else falls through to a DayDefault.
   That is the whole reason the block is fifteen nights long.

   ORDER MATTERS in `buildDayDefaults`. `resolveDay()` in
   src/lib/logic/day.ts walks the defaults array and returns the FIRST whose
   weekday and stop both match, so the Saturday-specific default is emitted
   first or it would never fire. */
import type { DayDefault, DayPlan, Runbook } from '../../src/lib/model/types';
import { STOP_IDS, TRIP_ID } from './base';
import { bedFor } from './stops';

type RunKey = 'arrive' | 'desert' | 'move' | 'heat' | 'exit';

interface DaySpec {
  date: string;
  title: string;
  items: string[];
  run?: RunKey;
}

const DAYS: DaySpec[] = [
  /* ---- Tel Aviv, landing ---- */
  {
    date: '2026-07-25',
    title: 'Landing day',
    run: 'arrive',
    items: [
      'Sample Air SA 100 lands at Ben Gurion mid-afternoon. Passport control, then straight down to the train.',
      'Train into the city, check in, dump the bag. Do not unpack — it is one night.',
      'Walk to the sea before the light goes. That is the whole plan.',
      'Sleep early. The clock catches up tomorrow, not tonight.',
    ],
  },

  /* ---- Jerusalem ---- */
  {
    date: '2026-07-26',
    title: 'Up to Jerusalem',
    items: [
      'Late breakfast, then the sample train inland — about thirty-five minutes.',
      'Check into the guest house and get out again before the afternoon sets in.',
      '**Machane Yehuda market** for a long lunch, then the Old City walls at golden hour.',
      'Confirm the desert coach seat for Wednesday while it is still three days away.',
    ],
  },
  {
    date: '2026-07-27',
    title: 'The Old City, before the heat',
    items: [
      '**Out by 07:00.** The stone is unbearable by eleven and this is the only way to walk it properly.',
      'All four quarters on foot, ending at the Western Wall plaza. Shoulders and knees covered.',
      'Back indoors 11:00–17:00. This is not laziness, it is the schedule.',
      'Out again at 18:00 for dinner and the walls after dark.',
    ],
  },
  {
    date: '2026-07-28',
    title: 'Museum morning, then pack for the desert',
    items: [
      'One big air-conditioned museum in the morning. Pick it the night before, not on the doorstep.',
      'Afternoon: **pack for the desert**, which is a different bag from the city bag.',
      'Buy water and something warm — the crater rim is cold after dark, at nine hundred metres.',
      'Bag shut and by the door tonight. Tomorrow is the hardest move of the trip.',
    ],
  },

  /* ---- Negev ---- */
  {
    date: '2026-07-29',
    title: 'Jerusalem → the Negev',
    run: 'desert',
    items: [
      '**Sample coach south, roughly three hours with one change.** Read the runbook before you leave the guest house.',
      'Three litres of water in the bag before boarding, not bought at the change.',
      'Arrive Mitzpe Ramon, check in, and stop. No walk, no crater, no sunset mission.',
      'The lodge is **pending** — sort it or confirm you are happy without it.',
    ],
  },
  {
    date: '2026-07-30',
    title: 'First full desert day',
    items: [
      'Rim walk at first light, back before 09:00.',
      'Groceries and water for the week — the shops here are small and shut early.',
      'Nothing outdoors 11:00–16:00. Read, sleep, do the admin.',
      'Out again at sunset for the light going off the crater wall.',
    ],
  },
  {
    date: '2026-07-31',
    title: 'The rim walk, and Friday shopping',
    items: [
      'Longer rim section this morning, starting before the sun clears the far wall.',
      '**Shop today.** Tomorrow is Shabbat and half the town will be closed.',
      'Afternoon indoors. Charge everything.',
      'Stars after dark — there is almost no light pollution up here.',
    ],
  },
  {
    date: '2026-08-01',
    title: 'Shabbat on the rim',
    items: [
      'A properly quiet day. Assume the shops and most of the food are shut.',
      'Short walk at dawn, then nothing until the evening.',
      'Cook from what was bought yesterday.',
      'Early night — Sunday starts before sunrise.',
    ],
  },
  {
    date: '2026-08-02',
    title: 'Down into the makhtesh',
    items: [
      '**Leave before 06:00.** Descending into the crater is a morning job or it is not a job at all.',
      'Four litres each, a hat, and tell somebody the route.',
      'Back on the rim and indoors by 10:30. No exceptions.',
      'Rest of the day flat out under the air conditioning.',
    ],
  },
  {
    date: '2026-08-03',
    title: 'A day of nothing much',
    items: [
      'Deliberately empty. A week in the desert needs one of these in the middle.',
      'Laundry, journal, photos, and the long overdue admin.',
      'Short sunset walk if the heat has broken.',
    ],
  },
  {
    date: '2026-08-04',
    title: 'Last desert day',
    items: [
      'Last rim walk at first light.',
      'Repack: the desert layer comes off the top of the bag, the swimming kit goes on it.',
      'Confirm tomorrow morning\'s sample flight down to Eilat — it is still **pending**.',
      'Early night. The flight is not late.',
    ],
  },

  /* ---- Eilat ---- */
  {
    date: '2026-08-05',
    title: 'Negev → Eilat',
    run: 'move',
    items: [
      'Sample domestic flight down, about an hour. It is **pending** — check it before setting off.',
      'Sea level and thirty-eight degrees. Move slowly for the first day.',
      'Check in, then the first swim in the late afternoon.',
      'Eat somewhere with air conditioning and go to bed.',
    ],
  },
  {
    date: '2026-08-06',
    title: 'First reef morning',
    items: [
      'In the water by 07:00, while it is still glassy and the boats are in.',
      'Reef-safe sunscreen and a rash guard — reapplying every hour does not work here.',
      'Indoors from eleven. This is the hottest week of the trip.',
      'Back in at 17:00 for the second swim.',
    ],
  },
  {
    date: '2026-08-07',
    title: 'Reef, shade, reef',
    items: [
      'Same shape as yesterday, and that is the point of a week here.',
      '**Shop today** — tomorrow is Shabbat.',
      'Long afternoon indoors.',
      'Sunset walk along the shore.',
    ],
  },
  {
    date: '2026-08-08',
    title: 'Shabbat by the water',
    items: [
      'The beaches stay open even if the town slows down.',
      'Early swim, late swim, nothing in between.',
      'Cook or eat at the hotel — assume the good places are shut.',
    ],
  },
  {
    date: '2026-08-09',
    title: 'The boat day',
    items: [
      'One sample boat trip out to the deeper reef. Book it the day before at the marina.',
      'Water, hat, and more sunscreen than feels reasonable — there is no shade out there.',
      'Back by early afternoon and straight indoors.',
    ],
  },
  {
    date: '2026-08-10',
    title: 'Desert behind the town',
    items: [
      'Ten minutes inland and the resort strip disappears entirely.',
      'Short walk at first light only. The mountains here hold heat like an oven.',
      'Rest of the day in the water or under a roof.',
    ],
  },
  {
    date: '2026-08-11',
    title: 'Last Eilat day',
    items: [
      'Last morning on the reef.',
      'Repack for the Dead Sea: everything you swim in will end up covered in salt.',
      'Read the heat runbook tonight, not tomorrow morning.',
      'Early night — the transfer is a long one.',
    ],
  },

  /* ---- Dead Sea ---- */
  {
    date: '2026-08-12',
    title: 'Eilat → the Dead Sea',
    run: 'heat',
    items: [
      '**Sample road transfer up the Arava, roughly three hours.** Leave early; the road bakes by mid-morning.',
      'Four hundred metres below sea level and the hottest air of the whole trip.',
      'Check in, drink, sit still. The first float can wait until the light drops.',
      'Late afternoon: twenty minutes in the water, no more, then shower immediately.',
    ],
  },
  {
    date: '2026-08-13',
    title: 'Masada before dawn',
    items: [
      '**Leave at 04:00** or skip it. The eastern path in daylight in August is genuinely dangerous.',
      'Two litres each on the way up, and the cable car is the honest alternative.',
      'Back at the hotel by 09:00 and indoors for the rest of the day.',
      'Evening float, then an early night.',
    ],
  },
  {
    date: '2026-08-14',
    title: 'Float, shade, float',
    items: [
      'Morning float before 09:00. Never put your head under.',
      '**Shop today** — tomorrow is Shabbat and the strip goes quiet.',
      'Spa or air conditioning for the whole middle of the day.',
      'Second float at sunset, when the far shore turns pink.',
    ],
  },
  {
    date: '2026-08-15',
    title: 'Shabbat at the lowest point',
    items: [
      'Quiet day. Float early, float late, do nothing at all in between.',
      'Repack tonight — tomorrow is a four-hour move north.',
      'Rinse everything properly. Salt destroys fabric if you let it dry in.',
    ],
  },

  /* ---- Galilee: only two explicit days, the rest are defaults ---- */
  {
    date: '2026-08-16',
    title: 'Dead Sea → the Galilee',
    run: 'move',
    items: [
      'Sample road transfer north, roughly four hours with one stop.',
      'Green, high and cool by comparison. The hard part of the trip is over.',
      '**Unpack properly** — this bed is home for a fortnight, and living out of a bag for two weeks is a choice.',
      'Buy food tonight. Work out where the nearest real shop is.',
    ],
  },
  {
    date: '2026-08-22',
    title: 'The planned Saturday',
    items: [
      'The one explicit day inside the Galilee block — everything around it is a default day.',
      'Shabbat, so nothing is open. This is a walk-and-cook day by design.',
      'Long morning walk while it is cool, then a proper lunch outside.',
      'Plan the Golan car days for next week while there is nothing else to do.',
    ],
  },

  /* ---- Haifa ---- */
  {
    date: '2026-08-31',
    title: 'Galilee → Haifa',
    run: 'move',
    items: [
      'Sample road transfer down to the coast, about two hours.',
      'Check in halfway up the mountain and let the legs discover how steep it is.',
      'Walk down to the sea in the evening. September is already softer than August was.',
      'The apartment is **pending** — a second unbooked bed, live.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'The terraces',
    items: [
      'The terraced gardens from the top of the slope at opening time, before the coaches arrive.',
      'Fixed entry times and a dress code — check on the day.',
      'Downhill through the German Colony afterwards, and lunch at the bottom.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Down to the port',
    items: [
      'The working port and the lower city in the morning.',
      'It is a real port, not a promenade — it is more interesting for that.',
      'Afternoon on the beach north of the centre.',
    ],
  },
  {
    date: '2026-09-03',
    title: 'North to Akko',
    items: [
      'Short train up the coast. The walled old town and the sea walls are the whole point.',
      'Lunch in the market there, then back before the evening rush.',
      'Easy night in.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'Beach day, and Friday shopping',
    items: [
      'Long morning on the sand.',
      '**Shop today.** Haifa runs on Saturday but the shops still mostly do not.',
      'Sunset from the upper city, looking down the whole bay.',
    ],
  },
  {
    date: '2026-09-05',
    title: 'The one city that runs on Saturday',
    items: [
      'Buses and the underground funicular run today — that is unusual here and worth using.',
      'Ride the line up and walk back down.',
      'Beach again in the afternoon.',
    ],
  },
  {
    date: '2026-09-06',
    title: 'Up the Carmel',
    items: [
      'Morning in the pine forest above the city, which is ten degrees cooler than the port.',
      'Lunch in one of the villages on the ridge.',
      'Back down for the evening.',
    ],
  },
  {
    date: '2026-09-07',
    title: 'Admin day',
    items: [
      'Laundry, photos, backup, and the tasks that have been sliding since August.',
      '**Sort the last stretch**: the Tel Aviv flat is booked, the airport bed is still a walk-in.',
      'Short evening walk, nothing more.',
    ],
  },
  {
    date: '2026-09-08',
    title: 'Slow coast day',
    items: [
      'Deliberately empty. Ten nights in one place earns one of these.',
      'Sea in the morning, shade in the afternoon.',
      'Eat somewhere new.',
    ],
  },
  {
    date: '2026-09-09',
    title: 'Last Haifa day',
    items: [
      'Last walk down the mountain to the water.',
      'Repack — the coast bag becomes the city bag again.',
      'Confirm tomorrow\'s train down the coast.',
    ],
  },

  /* ---- Tel Aviv, the finale ---- */
  {
    date: '2026-09-10',
    title: 'Haifa → Tel Aviv',
    run: 'move',
    items: [
      'Sample train down the coast, about ninety minutes.',
      'Check into the city flat and unpack — it is ten nights.',
      'Straight to the beach for the first evening. This is the reward block.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'First beach morning',
    items: [
      'Swim before eight, coffee after.',
      '**Shop today** — the last Fridays of the trip are the ones that catch you out.',
      'Long evening out. September nights here are the best of the year.',
    ],
  },
  {
    date: '2026-09-12',
    title: 'Shabbat in Tel Aviv',
    items: [
      'The beaches and the cafés stay open even when the buses stop.',
      'Walk the promenade end to end.',
      'Nothing scheduled. That is the plan.',
    ],
  },
  {
    date: '2026-09-13',
    title: 'Jaffa',
    items: [
      'The old port and the flea market in the morning.',
      'Walk back north along the water as the light goes.',
      'Dinner somewhere in the old town.',
    ],
  },
  {
    date: '2026-09-14',
    title: 'Museum day',
    items: [
      'One big museum, unhurried, with the air conditioning as a bonus.',
      'Afternoon in the Bauhaus streets around Rothschild.',
      'Easy evening.',
    ],
  },
  {
    date: '2026-09-15',
    title: 'The market streets',
    items: [
      'Levinsky in the morning, the Carmel market after.',
      'This is where the food argument for giving the city two weeks gets made.',
      'Buy anything that has to be carried home now, not in the last week.',
    ],
  },
  {
    date: '2026-09-16',
    title: 'North of the river',
    items: [
      'The port district and the park along the Yarkon.',
      'Rent a bike for the day — the whole thing is flat and the path runs to the sea.',
      'Late swim.',
    ],
  },
  {
    date: '2026-09-17',
    title: 'A nothing day',
    items: [
      'Nothing scheduled, deliberately, five days from the end.',
      'Beach, book, long lunch.',
      'Start the mental list of what still needs doing.',
    ],
  },
  {
    date: '2026-09-18',
    title: 'Last Friday',
    items: [
      '**The last shopping day of the trip.** Tomorrow is Shabbat and Sunday is a moving day.',
      'Spend the loose shekels — there is no point carrying them home.',
      'Last big night out.',
    ],
  },
  {
    date: '2026-09-19',
    title: 'Last Shabbat',
    items: [
      'Quiet by design. Beach in the morning, promenade in the evening.',
      '**Pack tonight.** Tomorrow moves to the airport bed and Tuesday is the flight.',
      'Weigh the bag while there is still time to do something about it.',
    ],
  },
  {
    date: '2026-09-20',
    title: 'Move to the airport bed',
    items: [
      'Check out of the flat, short hop out to the airport hotel.',
      '**It is a walk-in — there is no reservation.** Sort a room on arrival or find another.',
      'Quiet afternoon. Everything that matters is done except the flight.',
    ],
  },
  {
    date: '2026-09-21',
    title: 'The last full day',
    items: [
      'Nothing ambitious. One more swim if the airport bed is near enough to the water.',
      'Final repack: documents and anything valuable into the daypack.',
      '**Read the exit runbook tonight.** Do not read it for the first time tomorrow.',
      'Early night. The flight is early.',
    ],
  },
  {
    date: '2026-09-22',
    title: '🛂 Exit day',
    run: 'exit',
    items: [
      '**Sample flight out of Ben Gurion. The sample permit expires tomorrow — this is the last clean day.**',
      'At the airport three hours early. Departure security here is slower than arrival.',
      'Last of the shekels spent or changed before the gate.',
      'Sixty days, and the counter reads day 59 of 60 on the way out.',
    ],
  },
];

export function buildDayPlans(): DayPlan[] {
  return DAYS.map((d) => ({
    id: `il26-day-${d.date}`,
    tripId: TRIP_ID,
    date: d.date,
    title: d.title,
    ...bedFor(d.date),
    planItems: d.items,
    ...(d.run ? { runbookId: `il26-run-${d.run}` } : {}),
  }));
}

/** SATURDAY FIRST — resolveDay() returns the first matching default. */
export function buildDayDefaults(): DayDefault[] {
  return [
    {
      id: 'il26-default-galilee-sat',
      tripId: TRIP_ID,
      stopId: STOP_IDS.galilee,
      weekdays: [6],
      title: 'Galilee — Shabbat, everything slows',
      bedEmoji: '🌿',
      bedLabel: 'Sample kibbutz guest house',
      planItems: [
        'Nothing is open. If the food was not bought yesterday, today is what is in the fridge.',
        'Long walk while it is cool, then a proper lunch outside and no plans after it.',
        'No buses. If anywhere needs reaching today it needs a car, arranged in advance.',
        'The one day of the week the valley is genuinely silent. Use it.',
      ],
    },
    {
      id: 'il26-default-galilee',
      tripId: TRIP_ID,
      stopId: STOP_IDS.galilee,
      title: 'Galilee — a working day',
      bedEmoji: '🌿',
      bedLabel: 'Sample kibbutz guest house',
      planItems: [
        'Walk before the heat — an hour out and back, up the ridge or down to the water.',
        'Middle of the day indoors: work, admin, photos, the trip journal.',
        'Something small in the late afternoon — a village, a spring, the next valley over.',
        'Eat outside. August evenings up here are warm and not hot, which is the point of being here.',
      ],
    },
  ];
}

export function buildRunbooks(): Runbook[] {
  return [
    {
      id: 'il26-run-arrive',
      tripId: TRIP_ID,
      title: 'Arrival runbook — sample landing day',
      severity: 'warn',
      steps: [
        'Passport out before the doors — passport control is the only queue that matters here.',
        'Draw a small amount of cash in arrivals. Cards work almost everywhere, but not on every bus.',
        'eSIM on and confirmed working **before leaving the terminal**, while there is still wifi to fix it.',
        'Down to the train station under the terminal. It is the fastest and cheapest way into the city.',
        'Check in, drop the bag, do not unpack — this is one night.',
        'Sea before dark, food, and an early night. The clock catches up tomorrow.',
        'Sample booking codes only — nothing in this trip is a real reservation.',
      ],
    },
    {
      id: 'il26-run-desert',
      tripId: TRIP_ID,
      title: '⚠️ Jerusalem → Negev — the desert transfer',
      severity: 'crit',
      steps: [
        '**Fill three litres of water before you leave the guest house.** Not at the change, not on arrival — the connection is short and the shop at the interchange may be shut.',
        '**Be at the station by 08:30** for the sample coach south. One change en route; total journey roughly three hours.',
        'Hat, long sleeves and sunglasses on the top of the bag, not buried in it. You will want them the moment you step off.',
        'Screenshot the lodge address and the coach times **now**, while there is still wifi. Assume no signal on the second leg.',
        '**The lodge is still pending.** Call it from Jerusalem this morning, before boarding — not from a roadside stop at 14:00.',
        'Eat before boarding. There is nothing on the coach and the arrival is in the worst heat of the day.',
        'On arrival: check in, drink, sit down in the shade. **Nothing outdoors today.** No rim walk, no sunset mission, no "quick look at the crater".',
        'Before bed, dig out a warm layer. Nine hundred metres up, the night drops far further than anyone expects after a day like this.',
      ],
    },
    {
      id: 'il26-run-move',
      tripId: TRIP_ID,
      title: 'Travel-day basics',
      severity: 'warn',
      steps: [
        'Bag shut and by the door the night before, not the morning of.',
        'Two litres of water per person in the bag before setting off.',
        'Screenshot tonight\'s address and the route while there is still wifi.',
        'Charge everything overnight — phone, power bank, headphones.',
        'Check the next bed\'s status in the app before leaving. A pending bed is a phone call, not a surprise.',
        'Nothing ambitious on arrival. Check in, eat, sleep — the new place is still there tomorrow.',
      ],
    },
    {
      id: 'il26-run-heat',
      tripId: TRIP_ID,
      title: 'Dead Sea — the heat day',
      severity: 'warn',
      steps: [
        '**Leave early.** The Arava road bakes from mid-morning and there is nowhere to stop.',
        'Four litres of water in the vehicle. This is the hottest air of the whole trip.',
        'On arrival: shade, water, and sit still for an hour before doing anything.',
        '**Treat 11:00–17:00 as indoors.** The afternoon sun four hundred metres below sea level is the most dangerous on this trip.',
        'First float late in the day, twenty minutes maximum, and **never put your head under** — the water blinds if it reaches your eyes.',
        'Shower immediately afterwards. Fresh-water showers are on the public beaches for exactly this reason.',
        'Do not shave today, and check for cuts before going in. Everybody learns this once.',
      ],
    },
    {
      id: 'il26-run-exit',
      tripId: TRIP_ID,
      title: '🛂 EXIT DAY — sample permit deadline',
      severity: 'crit',
      steps: [
        '**The sample 60-day permit expires 2026-09-23. Today is the last clean day to leave.** There is no buffer after this one.',
        'Passport and the sample flight details in the daypack, not the hold bag.',
        '**At the airport three hours before departure.** Departure security here is slower than arrival, and this is not the flight to be optimistic about.',
        'Weigh the bag before leaving the hotel. Fixing it at the desk costs money and time you will not have.',
        'Spend or change the last shekels before the gate.',
        'Check the counter in the app one final time: it should read day 59 of 60 today.',
        'If the flight is disrupted, **the permit still runs out tomorrow** — rebook for tomorrow at the latest, not for the day after.',
        'Sample trip, sample deadline. When this fires for real in China, it will look exactly like this.',
      ],
    },
  ];
}
