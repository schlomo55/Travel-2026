/* Every user-facing string lives here (docs/ARCHITECTURE.md §2).
   Single language today by decision; the shape makes a second one cheap. */
export const S = {
  app: {
    name: 'Living the dream',
  },
  /* States the phone itself is in. Quiet where the state is normal on this
     trip (offline), loud where it is danger (a database that will not read). */
  system: {
    offline: '⚡ Offline · showing saved data',
    /* the same state in Horizon's voice: an icon, never an emoji */
    offlineQuiet: 'Offline · showing saved data',
    dataUnreadable: 'Your trip data could not be read on this phone — open Backup',
    openBackup: 'Open Backup',
    saveFailed: 'Could not save — try again',
  },
  shelf: {
    summary: (trips: number, enRoute: number) =>
      `${trips} ${trips === 1 ? 'trip' : 'trips'} on this phone${enRoute ? ` · ${enRoute} en route` : ''}`,
    active: 'Active',
    upcoming: 'Upcoming',
    past: 'Past',
    archived: 'Archived',
    newTrip: 'Start a new trip',
    /* The board's hint here is the repo loop ("Fill the trip brief — Claude
       builds it"); this door opens the in-app wizard, so it says what the
       wizard does. The brief path is named inside the wizard. */
    newTripHint: 'Name, dates and money — the rest as you go',
    importTrip: 'Import a trip',
    importHint: 'Open a trip file on this phone',
    daysToGo: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} to go`,
    toGo: (n: number) => (n <= 0 ? 'Last day' : `${n} ${n === 1 ? 'day' : 'days'} to go`),
    dayOf: (n: number, total: number) => `Day ${n} of ${total}`,
    completed: (total: number) => `${total} days · complete`,
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    stops: (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`,
    tonight: 'Tonight',
    tonightLine: 'Tonight:',
    continue: 'Continue the trip',
    openTrip: 'Open the trip',
    open: (title: string) => `Open ${title}`,
    options: (title: string) => `Options for ${title}`,
    cardAria: (title: string, status: string, day: string) => `${title} · ${status} · ${day}`,
    backupTitle: 'Save a backup',
    backupBody: 'Your trips live only on this phone — keep a copy.',
    backupStale: 'You changed things since the last copy — save one now.',
    backupBtn: 'Back up',
    across: 'Across every trip',
    xtrips: 'trips',
    xdays: 'days away',
    xspent: (currency: string) => `spent · ${currency}`,
    yearDays: (n: number) => `${n}d`,
    restored: 'Trip restored',
    archivedToast: 'Trip archived',
    saveFailedNothingDeleted: 'Could not save a copy — nothing was deleted',
    stamps: { active: 'En route', upcoming: 'Upcoming', done: 'Done', archived: 'Archived' },
  },
  wizard: {
    createTitle: 'New trip',
    editTitle: 'Edit trip',
    name: 'Trip name',
    namePh: 'Japan, spring',
    subtitle: 'Subtitle (optional)',
    subtitlePh: 'Temples, trains & tonkotsu',
    emoji: 'Emoji (optional)',
    start: 'First day',
    end: 'Last day',
    currency: 'Home currency',
    currencyHint: 'Budgets and totals are kept in this currency.',
    accent: 'Trip color',
    create: 'Create trip',
    save: 'Save changes',
    errName: 'Give the trip a name.',
    errDates: 'The last day must not be before the first.',
    created: 'Trip created',
    updated: 'Trip updated',
    /* The fuller way in, named where a new trip starts (docs/NEW-TRIP.md). */
    briefTitle: 'Or build it from the brief',
    briefBody:
      'Fill the trip brief — Claude builds the whole trip file, bookings and days included — then open it here with Import a trip.',
  },
  /* ---------- HORIZON (Run 1) ---------- */
  appbar: {
    allTrips: 'All trips',
    starts: 'Starts in',
    trip: 'Trip',
    done: 'done',
    entry: 'entry',
    over: 'OVER',
    notYet: 'not yet',
    day: 'Day',
  },
  shell: {
    notFound: 'Trip not found',
    notFoundBody: 'It may have been deleted on this phone.',
    stopNotFound: 'Stop not found',
    backToJourney: 'Back to the journey',
  },
  journey: {
    route: 'The route',
    subtitle: 'Route · stops · is it booked',
    stops: 'Every stop',
  },
  /* Now in Run 1: the day and To do, one tap apart. */
  nowbridge: {
    label: 'Now',
    day: 'The day',
    todo: 'To do',
  },
  /* THE STATUS CHIP — a word and a colour, computed, never typed. */
  chip: {
    booked: 'Booked',
    pending: 'Pending',
    walkin: 'Walk-in',
    cancelled: 'Cancelled',
  },
  counter: {
    title: 'Counter mode',
    brightness: 'Screen at full brightness',
    hand: 'Hand the phone to the desk agent.',
    aria: (title: string) => `Counter mode: ${title}`,
    copy: (label: string) => `Copy the ${label.toLowerCase()}`,
  },
  driver: {
    title: 'Driver card',
    phraseTitle: 'Phrase',
    of: (i: number, n: number) => `${i} of ${n}`,
    aria: (i: number, n: number, name: string) => `Driver card ${i} of ${n}: ${name}`,
    phraseAria: (i: number, n: number, meaning: string) => `Phrase ${i} of ${n}: ${meaning}`,
    watchOut: 'Watch out —',
    copyZh: 'Copy the Chinese',
    prev: 'Previous card',
    next: 'Next card',
    show: 'Show this screen to the driver',
    showPhrase: 'Show this screen',
  },
  pass: {
    flight: 'Flight pass',
    train: 'Train pass',
    road: 'Road pass',
    stay: 'Stay pass',
    ticket: 'Ticket',
    departs: 'Departs',
    checkIn: 'Check-in',
    starts: 'Starts',
    fare: (p: string) => `Fare ${p}`,
    checkInLabel: 'Check-in',
    checkOutLabel: 'Check-out',
    bookingNo: 'Booking no.',
    copyCode: 'Copy the booking number',
    counterMode: 'Counter mode — show it at the desk',
    findEmail: 'Find email',
    manage: 'Manage',
    bookingLink: 'Booking link',
    needsNet: 'Find email, Manage and the booking link need a network. Everything else here works with no signal.',
    edit: 'Edit',
  },
  pocket: {
    subtitle: 'Offline · one tap away',
    emergency: 'Emergency',
    todayAria: (title: string) => `Next: ${title}`,
    whenCaps: (word: 'today' | 'tomorrow' | 'date', date: string, kind: string) =>
      word === 'today' ? `Today · ${kind}` : word === 'tomorrow' ? `Tomorrow · ${kind}` : `${date} · ${kind}`,
    kindWord: { flight: 'flight', train: 'train', road: 'on the road', stay: 'check-in', ticket: 'ticket' },
    counterMode: 'Counter mode',
    pass: 'Pass',
    driverTitle: 'Show the driver',
    driverScreen: 'Driver cards',
    cardsCount: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
    whiteHint: 'white = for other eyes',
    driverChip: (meaning: string) => `Driver card: ${meaning}`,
    walletTitle: 'Wallet',
    walletHint: 'every booking, offline',
    inWallet: 'Pocket · Wallet',
    ticketAria: (label: string, n: number) => `${label}: ${n}`,
    moneyAria: (amount: string) => `Money: ${amount} logged so far`,
    logSpend: 'Log a spend',
    logged: 'logged',
    moreAria: 'More in the Pocket',
    phrasesAria: (n: number, meaning: string) => `Phrases: ${n}, for example ${meaning}`,
    phraseAria: (meaning: string) => `Show full screen: ${meaning}`,
    convertAria: 'Converter — works with no signal',
    fromTrip: 'rates from your trip file',
    visa: 'Visa',
    visaScreen: 'Visa',
    visaAria: (name: string, value: string, line: string) => `${name}: ${value}, ${line}`,
    sosAria: (nums: string) => `Emergency: ${nums}`,
    more: (n: number) => `+ ${n} more`,
    dial: 'tap to dial',
    call: (v: string) => `Call ${v}`,
    documents: 'Documents',
    docsAria: (n: number) => `Documents: ${n} on this phone`,
    photos: 'Place photos',
    files: 'Files',
    placePhotos: 'Place photos',
    rename: 'Rename',
    packingAria: (n: number, packed: number) => `Packing list: ${n} items, ${packed} packed`,
    packed: (n: number) => `${n} packed`,
    onTheList: 'items on the list',
    health: 'Health',
    healthSub: 'insurance · 24 h line',
    goodToKnow: 'Good to know',
    infoAria: (n: number) => `Good to know: ${n} cards`,
    other: 'Other',
    legs: (n: number, pending: number) =>
      `${n} ${n === 1 ? 'leg' : 'legs'}${pending ? ` · ${pending} not booked yet` : ''}`,
    number: 'Number',
    copyNumber: 'Copy the number',
    balance: 'Balance remaining',
    noCounters: 'No visa or stay counter',
    noCountersBody: 'A counter keeps the days you may legally stay somewhere — the entry day, the limit, the hard deadline.',
    pinned: 'Pinned',
    overBy: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} over the limit`,
    countStarts: 'Count starts',
    dayAfter: '(day after)',
    plannedExit: 'Planned exit',
    untilDeadline: 'Until the deadline',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    noDriverCards: 'No driver cards yet',
    noDriverCardsBody: 'A driver card is a destination in Chinese, big enough to hold up in a taxi.',
    noPhrases: 'No phrases yet',
    noPhrasesBody: 'A phrase is a sentence to show someone — in their language, with yours under it.',
    noteSaved: 'Note saved ✓',
    notePh: 'Anything this trip should remember…',
    noNote: 'No notes yet',
    noNoteBody: 'Turn on edit mode to write one. It stays on this phone and rides in every backup.',
    noClocks: 'No clocks set',
    noClocksBody: 'A trip file can name the time zones you live between; they show here, offline.',
    backToPocket: 'Back',
    passSub: (section: string) => `Pocket · ${section}`,
    gone: 'Not on this phone',
    goneBody: 'This booking is not on this phone any more — it may have been deleted or replaced.',
    deleted: {
      flight: 'Flight deleted',
      stay: 'Stay deleted',
      booking: 'Booking deleted',
      card: 'Card deleted',
      contact: 'Contact deleted',
      counter: 'Counter deleted',
    },
  },
  /* Money — the quick-add and the spending view. */
  spend: {
    totalSpent: 'Total spent',
    log: 'Log a spend',
    date: 'Date',
    category: 'Category',
    what: 'What was it?',
    whatPh: 'Dumplings, the cable car…',
    amount: 'Amount',
    currency: 'Currency',
    paid: 'Paid',
    card: 'Card',
    cash: 'Cash',
    refund: 'refund',
    confirm: 'Confirm',
    add: 'Add',
    delete: 'Delete this entry',
    deleted: 'Entry deleted',
    enterAmount: 'Enter an amount',
    really: (x: string) => `Really ${x}? Tap Add again.`,
    logged: (x: string) => `${x} logged`,
    exported: (n: number) => `${n} entries exported`,
    budgetFor: (label: string, cur: string) => `Budget for ${label} (${cur})`,
    notANumber: 'Not a number',
    budgetUpdated: 'Budget updated',
    rates: (list: string) => `Rates: ${list}. Each entry keeps the rate it was logged with.`,
    footer: (n: number, cash: string) => `${n} ${n === 1 ? 'entry' : 'entries'} · cash ${cash}`,
    detail: 'The money in detail',
    avgDay: 'Average spending day',
    projected: 'At this rate, whole trip',
    refunded: 'Refunded',
    biggestDay: 'Biggest day',
    biggestSingle: 'Biggest single',
    whereItWent: 'Where it went',
    burn: 'Daily burn',
    burnAria: 'Spending per day across the trip',
    peak: (x: string) => `peak ${x}`,
  },
  /* FIND — searches the phone, no internet (f-find). */
  find: {
    aria: 'Find anything',
    label: 'Find anything in your trip',
    placeholder: 'Bookings, cards, places, steps…',
    clear: 'Clear the search',
    scopes: 'What to search',
    resultsFor: (q: string) => `Results for ${q}`,
    hint: 'Type a word — a flight number, a hotel, a station, a street, a sentence you remember.',
    nothing: (q: string) => `Nothing on this phone matches “${q}”.`,
    warnAria: (title: string) => `Watch out: ${title} is not the place to go`,
    watchOut: 'Watch out · not this place',
    shownFirst: 'Shown first',
    notThis: 'Not this one',
    showInstead: (code: string) => (code ? `Show the ${code} driver card` : 'Show the right driver card'),
    openPass: (title: string) => `Open the pass: ${title}`,
    bookings: 'Bookings',
    driverCards: 'Driver cards',
    phrases: 'Phrases',
    todaySteps: 'Today’s steps',
    steps: 'Steps',
    stops: 'Stops',
    places: 'Places',
    todo: 'To do',
    info: 'Good to know',
    emergency: 'Emergency',
    cards: 'Cards',
    docs: 'Documents',
    notes: 'Notes',
    scope: { all: 'All', bookings: 'Bookings', cards: 'Cards', steps: 'Steps', places: 'Places', more: 'More' },
    show: 'Show',
    stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
    offline: 'Searches this phone — no internet needed.',
  },
  /* HORIZON'S NAV (system/components/NavBar): three places and a search. */
  nav: {
    label: 'Main',
    now: 'Now',
    journey: 'Journey',
    pocket: 'Pocket',
    find: 'Find anything',
  },
  /* The five tabs of the Lantern pill. Kept for the words the Run 2–3 screens
     still print ("Open lists", "Plans") until those screens are rebuilt. */
  tabs: {
    plans: 'Plans',
    lists: 'Lists',
  },
  plan: {
    readMore: 'Read more',
    stopOf: (n: number, total: number) => `Stop ${n} of ${total}`,
    addPhoto: 'Add a photo',
    replacePhoto: 'Replace the photo',
    photoAdded: 'Photo saved to this stop',
    gettingThere: 'Getting there & money',
    theStory: 'About this place',
    dayByDay: 'Day-by-day',
    options: 'All the options',
    optionsHint: '⭐ = recommended',
    budgetFor: 'Budget for this stop —',
    bookedHere: 'Booked for this stop',
    eatAndSee: 'Where to eat & what to see',
    openInMaps: 'Open in Maps',
    verify: 'verify',
    share: 'Share this guide',
    /* The guide's jump bar — Info's chips, on the longest page in the app. */
    jump: {
      there: 'Getting there',
      about: 'About',
      booked: 'Booked',
      days: 'Day by day',
      sleep: 'Sleep',
      /* Home's free blocks link straight into this section, so it earned a
         chip of its own rather than being reached by fourteen thumb flicks. */
      options: 'Options',
      eat: 'Eat & see',
    },
    backToTop: '↑ Top',
    /* IS THIS LEG OF THE TRIP ACTUALLY BOOKED? — logic/coverage.ts derives it;
       these are the words it says it in. A missing bed is named before a
       missing move on purpose: you can buy a ticket standing in the station
       and you cannot do that with a room at midnight. */
    cover: {
      ok: 'All booked ✓',
      pending: (n: number) => `${n} pending`,
      bedMissing: (n: number) => (n === 1 ? '⚠ bed missing' : `⚠ ${n} beds missing`),
      legMissing: (n: number) => (n === 1 ? '⚠ move unbooked' : `⚠ ${n} moves unbooked`),
      heading: 'Is it booked?',
      allNights: (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}, all held`,
      nightMissing: 'no bed booked',
      nightPending: 'not held yet',
      nightWalkin: 'walk-in — deliberate',
      nightTransit: 'night in transit',
      legIn: 'Getting here',
      legOut: 'Moving on',
      legNone: 'nothing booked yet',
      legPlanned: 'planned — nothing held',
      legPartial: 'part booked',
      legBooked: 'booked',
    },
  },
  money: {
    bookedHint: 'What is reserved, and what each one costs',
    flights: 'Flights',
    travel: 'Travel',
    stays: 'Stays',
    /* The things you go TO, kept apart from the legs that get you there: a
       concert ticket inside a "Travel" total reads as a fare. */
    experiences: 'Experiences',
    fromDocs: 'From the trip documents',
    fromNote: (name: string) => `the budget note for ${name}`,
    booked1: 'Booked ✓',
    /* The two ends of a rail leg. A flight needs no such labels — its row is
       two airport codes — but a train end can carry two stations or none, and
       then which end you are looking at stops being obvious. */
    railFrom: 'Leaves',
    railTo: 'Arrives',
    pending: 'Pending',
    walkin: 'Walk-in',
    cancelled: 'Cancelled',
    noPrice: 'price not recorded',
    groupUnpriced: (n: number) => `${n} not priced`,
    addPrice: 'Add the price',
    nights: (n: number) => `${n} ${n === 1 ? 'night' : 'nights'}`,
    countedSoFar: 'Counted so far',
    ofBudget: (total: string) => `of a ${total} budget`,
    noPriceYet: (n: number) => `${n} ${n === 1 ? 'item has' : 'items have'} no price yet — not in this total.`,
    allPriced: 'Every item here has a price.',
    notSpent: 'This is what the bookings cost, not what you have spent. Spending is logged below.',
    /* An either/or leg. Only one of the two will happen, so the fallback is
       shown and never added up — counting both would invent a journey. */
    orInstead: 'Or instead',
    orInsteadHint: 'Only one of these will happen — none of it is counted above.',
    /* The Money segment's disclosure. Committed money is the answer to a
       different question from "am I on budget", so it waits behind a tap. */
    committedDisclosure: (n: number) => `What’s already committed (${n})`,
    committedBeside: (amount: string) => `+ ${amount} committed`,
  },
  maps: {
    open: 'Open in maps',
    /* one of a row of pass actions */
    short: 'Maps',
    /* The toast label after a long-press: copyText prints "Copied ✓ …". */
    copied: 'the place name',
    copiedAddress: 'the address',
    copyAddress: 'Copy the address',
    /* The visible twin of the long-press. The gesture stays; it stops being
       the only way to get the string you paste into a ride-hailing app. */
    copyAddressBtn: 'Copy address',
    openIn: (name: string) => `Open ${name} in a map`,
    /* The day's own chip row. Same voice as placesHere, and it never appears
       over an empty list — a day that goes nowhere renders no header. */
    placesToday: '📍 Places today',
    placesHint: 'Every one of these was checked against OpenStreetMap.',
    hintTitle: 'Maps in China',
    hint1:
      'The first time you tap **Open in maps**, Android asks which app to use. Pick one, tick *always*, and the phone keeps using it.',
    hint2:
      'Install **Amap (高德地图)** before you fly — it is the map that works everywhere in the mainland. Google Maps only works in Hong Kong, or with the VPN on.',
    hint3: '**Organic Maps** downloads whole regions and works with no signal at all — a good backup.',
    hint4:
      'Some places have no button. That means the name could not be confirmed on a real map, and a button that opened the wrong place would be worse than none.',
  },
  weather: {
    from: (when: string) => `weather from ${when}`,
    /* Settings has to admit when the switch is on and nothing is happening —
       inside the Firewall that is every single fetch. */
    lastFetch: (when: string) => `Last successful fetch: ${when}`,
    lastFetchNever: 'Last successful fetch: never',
  },
  today: {
    departureIn: 'Departure in',
    day: 'day',
    days: 'days',
    tripComplete: 'Trip complete.',
    anytime: 'Anytime',
    usualDay: 'usual day',
    tonight: 'Tonight',
    nextLeg: 'Next leg',
    /* The other shape the next hard commitment takes: the day a stay begins. */
    checkIn: 'Check in',
    /* THE COUNTDOWN. Minute granularity and nothing finer — seconds would tick
       sixty times a minute on a phone at 8 % battery to tell you nothing you
       did not already know. */
    countdownNow: 'now',
    countdownHm: (h: number, m: number) => (h ? (m ? `in ${h} h ${m} m` : `in ${h} h`) : `in ${m} m`),
    /* Beyond the live window a day count is the honest unit — the same phrasing
       Home has always used for a leg that is still days out. */
    countdownDays: (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`),
    entryDay: 'Entry day — the count starts tomorrow',
    counterComplete: (name: string) => `${name} — complete ✓`,
    counterOver: (name: string) => `${name} — OVER THE LIMIT`,
    counterBefore: (name: string, d: string) => `${name} — the count starts ${d}`,
    mustLeaveBy: (d: string) => `must exit by ${d}`,
    /* The visa card's headline. The number a border officer counts, at the size
       it is worth — a 13.5 px line was not it. */
    counterDayOf: (day: number, limit: number) => `DAY ${day} OF ${limit}`,
    /* Absence of a stamp is not a state the eye reads. Every tonight row now
       carries exactly one of BOOKED / PENDING / WALK-IN / NO BOOKING. */
    noBooking: 'No booking on file',
    /* …unless the night is spent moving. A night aboard an overnight leg has no
       bed to book, so NO BOOKING ON FILE was the app crying wolf on the two
       nights it is least able to act — 21 Nov, AUH → PKX, is the live one. */
    nightInTransit: 'Night in transit ✈',
    overdueCount: (n: number) => (n === 1 ? '⚠️ 1 overdue' : `⚠️ ${n} overdue`),
    nextDeadline: 'Next deadline',
    openItems: (n: number) => `${n} open item${n === 1 ? '' : 's'}`,
    /* A label like "NOW" hides how late a thing is; the real date goes beside it. */
    wasDue: (d: string) => `was ${d}`,
    prevDay: 'The day before',
    nextDay: 'The day after',
    /* ---------- free blocks (Gap B) ----------
       The gap between the things that are already fixed, and the researched
       options that could fill it. Every word here is about the SHAPE of the
       offer; the facts inside a candidate come from the trip file's own line
       and never from this file. */
    free: {
      /* "3 h 20 m free · 14:10–17:30" — duration first, because that is the
         question ("how long have I got?"); the span answers "when". */
      head: (duration: string, span: string) => `${duration} free · ${span}`,
      /* Where the block opens: behind the last fixed thing, or at the start of
         the day when nothing has happened yet. */
      after: (what: string) => `after ${what}`,
      openDay: 'nothing timed yet today',
      /* The card that is only an offer. */
      add: '＋ Add to the day',
      added: 'In the day ✓',
      remove: 'Take it out',
      /* What the pick's own row says once it has joined the day. */
      pickedTag: 'you picked this',
      /* Straight line, and it says so. Never a travel time. */
      distance: (km: string, from: string) => `≈ ${km} from ${from}`,
      /* The recorded facts, each drawn only where the line records one. */
      prebook: 'book ahead',
      hours: (h: string) => `hours ${h}`,
      /* The wet-weather / no-legs-left row. */
      fallback: 'rain / too tired',
      /* Four is the cap; the guide holds the rest. */
      allOptions: (n: number) => `All ${n} options →`,
      planned: 'Planned',
    },
    /* The long jump: every date of the trip, one tap away from the title. */
    jumpTitle: 'Go to a day',
    jumpToday: 'today',
    jumpShowing: 'showing',
  },
  wallet: {
    /* "Total spent" was a lie by omission: it is the sum of what has been
       LOGGED, and two taps away the same tab prints a bigger, committed
       figure against the same budget. It says which number it is now. */
    totalSpent: 'Logged so far',
    ofBudget: (total: string) => `budget ${total}`,
    tapToCopy: 'Tap to copy',
    /* A boarding pass prints both ends in local time and never says the two
       clocks are different — so "21:20 → 08:45+1" reads as eleven hours in
       the air when it is seven and a half. Derived from the airline's own
       flying time (logic/zones.ts), never from a guessed timezone. */
    zoneBoth: (there: string, back: string, origin: string, shift: string) =>
      `${there} where you land · ${back} back in ${origin} (${shift})`,
    travel: 'Travel',
    stays: 'Stays',
    /* The fifth segment, added 2026-08-06. Not "Other": it holds the things you
       DO — tickets, attractions, guided days, a table that must be reserved —
       and a segment named for what it is not is a segment nobody opens. */
    experiences: 'Experiences',
    cards: 'Cards',
    money: 'Money',
    beds: (n: number, pending: number) =>
      `${n} bed${n === 1 ? '' : 's'}${pending ? ` · ${pending} still to book` : ''}`,
    tickets: (n: number, pending: number) =>
      `${n} ticket${n === 1 ? '' : 's'}${pending ? ` · ${pending} still to buy` : ''}`,
  },
  lists: {
    title: 'Lists',
    todo: 'To do',
    packing: 'Packing',
    checklists: 'Checklists',
    packed: 'packed',
    /* The label under the to-do and checklist rings. "done" over "checked"
       because done is the word the rest of the app already uses for a ticked
       box — the chip, the stamp, every aria-label. */
    done: 'done',
    open: (n: number) => `${n} open`,
    addItem: 'Add an item',
    actionList: 'Action list',
    byDeadline: 'by deadline',
    why: 'why this matters',
    hideWhy: 'hide',
    openLink: 'Open booking link ↗',
    alarms: 'Set these as phone alarms',
    alarmsHint:
      'Living the dream can’t ring while it’s closed. These are the miss-it-lose-it moments — put them in the phone calendar, which does ring.',
    /* Moments whose hour has gone. Kept — a trip's record is not tidied away —
       but collapsed, so "upcoming" only ever means upcoming. */
    alreadyPassed: (n: number) => `${n} already passed`,
    exportIcs: (n: number) => `Add all ${n} to the calendar (.ics)`,
    exported: (n: number) => `${n} moment${n === 1 ? '' : 's'} exported`,
    addAlarm: 'a timed moment',
    templates: 'Templates',
    templatesSub: 'reuse across trips',
    templatesHint: 'Save this list once and the next trip starts from it instead of from nothing.',
    saveTemplate: 'Save this list as a template',
    nameTemplate: 'Name this template',
    templateSaved: 'Template saved ✓',
    apply: 'Apply',
    applied: (n: number) => `${n} item${n === 1 ? '' : 's'} added`,
    alreadyThere: 'Everything was already on the list',
    itemCount: (n: number) => `${n} item${n === 1 ? '' : 's'}`,
  },
  info: {
    vaultHint: 'stored on this phone · readable offline',
    vaultStoring: 'Storing…',
    vaultRename: 'Name this document',
    vaultAdded: (n: number) => `${n} file${n === 1 ? '' : 's'} added ✓`,
    vaultLarge: (name: string, size: string) => `${name} is ${size} — large files make backups slow`,
    vaultStoreFailed: 'Could not store that file',
    vaultMissing: 'The file is missing from this device',
    tripStatistics: 'Trip statistics',
    /* No continent count: nothing in the trip data says which continent a stop
       is on, and a bounding box that called Israel African would be exactly
       the invented fact §RULES 2 forbids. Stops are counted, continents are
       not claimed. */
    stopsSub: (stops: number) => `${stops} stop${stops === 1 ? '' : 's'}`,
    stat: {
      days: 'Days traveled',
      stops: 'Stops',
      nights: 'Nights booked',
      distance: 'Distance, stop to stop',
      spent: 'Total spent',
      packed: 'Packed',
      bookings: 'Bookings confirmed',
    },
    notes: 'Notes',
    deepMoney: 'The money in detail lives in Wallet → Money.',
    clocks: 'Clocks',
    clocksSub: 'the hours you are living between',
    driverVerify: 'Lines marked *verify* came from general knowledge, not your trip documents.',
    phrases: 'Useful phrases',
    emergencySub: 'the numbers you would want at 3 a.m.',
    call: 'Call',
    copy: 'Copy',
    /* the compliance counter, spelled out */
    counterStarts: (d: string) => `Starts ${d}`,
    counterDayAfter: ' — the count begins the day after',
    counterDone: (d: string, day: number, limit: number) =>
      `Complete ✓ — you left on ${d}, day ${day} of ${limit}`,
    counterOnSchedule: 'schedule',
    counterDay: 'Day',
    counterLeft: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} of legal stay left`,
    hardDeadline: 'Hard deadline',
  },
  settings: {
    title: 'Settings',
    calmMotion: 'Calm motion',
    /* The theme switch came back on 2026-08-12 (owner: "make them 2, optional,
       and by default dark"); in Horizon it is the night sky and Daylight. */
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    preview: 'Preview a date',
    previewHint: 'See the app as it will look on another day. The address bar carries ?d=YYYY-MM-DD — remove it or tap the pill to come back to today.',
    previewNow: (d: string) => `Previewing ${d} — tap to exit`,
    previewBtn: 'Preview',
    previewExit: 'Exit',
    weather: 'Weather',
    storage: 'Storage',
    persisted: 'Protected against cleanup ✓',
    notPersisted: 'Not yet protected — install the app to your home screen',
    usedOf: (used: string, quota: string) => `${used} used of ${quota}`,
    backupBtn: 'Backup & restore',
    about: 'About',
    /* ---------- Horizon (f-settings) ---------- */
    back: 'Back to your trips',
    appearance: 'Appearance',
    onPhone: 'On this phone',
    needsInternet: 'Needs internet',
    themeLine: 'Dark is the default · light is made for daylight',
    calmLine: 'Holds every animation still',
    routeAnimations: 'Route animations',
    /* three states, because "on" that does nothing is a lie (logic/motion.ts) */
    routeNote: (state: 'on' | 'off' | 'calm') =>
      `Flow, comet, ink and relay — ${state === 'on' ? 'on' : state === 'off' ? 'off, the map stays still' : 'paused by Calm motion'}`,
    weatherRow: 'Update the forecast when online',
    /* The board said "at most twice a day"; the code refreshes a forecast once
       it is six hours old (logic/weather.ts STALE_AFTER_MS), so this says so. */
    weatherLine: 'At most every six hours · only your stops’ coordinates are sent',
    backupSection: 'Backup',
    drive: 'Google Drive',
    optional: '· optional',
    driveUnconfigured: 'Not set up',
    driveDisconnected: 'Not connected',
    driveConnected: 'Connected',
    /* the row opens the Backup screen, where the Drive card tells the truth
       about each state — no button here pretends to connect */
    driveHow: 'How',
    driveSetUp: 'Set up',
    driveOpen: 'Open',
    saveFile: 'Save a backup file',
    saveFileSub: 'Keep or send a copy',
    save: 'Save',
    thisTrip: (title: string) => `This trip · ${title}`,
    exportTrip: 'Export the trip file',
    archive: 'Archive',
    unarchive: 'Bring it back from the archive',
    version: (v: string) => `Version ${v}`,
    footer: 'Living the dream · works offline · no account',
  },
  edit: {
    add: (what: string) => `＋ Add ${what}`,
    turnOn: 'Edit',
    turnOff: 'Done',
  },
  /* ---------------------------------------------------------------------
     Empty states — one per surface that can be empty (plan §PHASES Phase 2).

     Rules the copy follows, in order:
       1. Name what is missing, in the traveller's words, not the schema's.
       2. Say what would fill it — concretely enough to picture ("a visa
          appointment, a deposit, a call you keep putting off").
       3. Offer the action that fills it, when the screen honestly has one.
     A shallow trip is a normal trip (§DECISIONS), so none of these apologise
     and none of them imply something broke.
     --------------------------------------------------------------------- */
  empty: {
    shelf: {
      glyph: 'pouch',
      title: 'The shelf is empty',
      body: 'Start a trip from scratch, or import a trip file you already have. Everything you build stays on this phone.',
    },
    today: {
      glyph: 'calendar',
      title: 'No plan for this day yet',
      body: 'Write the day in Plans, or let the stop’s usual day cover it — a usual day fills every date you never wrote down.',
      action: 'Open Plans',
    },
    plans: {
      glyph: 'route',
      title: 'No stops yet',
      body: 'A stop is a place you sleep in and travel from. Add the first one, or import a trip file that already has them.',
      action: 'Add the first stop',
    },
    guide: {
      glyph: 'doc',
      title: 'This guide is still blank',
      body: 'A guide fills from your own trip file: how to get there, the story of the place, the days, where to eat. Nothing here is ever invented for you.',
    },
    travel: {
      glyph: 'plane',
      title: 'No flights or trains yet',
      body: 'Add the leg you have booked — number, times, and the confirmation code you will be asked for at the counter.',
      action: 'Add a flight',
      alt: 'Add a train or activity',
    },
    stays: {
      glyph: 'bed',
      title: 'No beds yet',
      body: 'Add tonight’s hotel, or import your trip file. A bed you have only chosen counts too — mark it PENDING and it stays visible until it is booked.',
      action: 'Add a stay',
    },
    experiences: {
      glyph: 'ticket',
      title: 'Nothing booked to do yet',
      body: 'A ticket, an attraction, a guided day, a table that has to be reserved — anything you go to rather than travel on. Add it PENDING while it is still something to buy.',
      action: 'Add a ticket',
    },
    cards: {
      glyph: 'card',
      title: 'No cards yet',
      body: 'A card holds the numbers you read out at a counter: the insurance policy, the visa, a gift-card balance.',
      action: 'Add a card',
    },
    spend: {
      glyph: 'coins',
      title: 'Nothing logged yet',
      body: 'Log the first spend and the totals, the daily burn and the CSV export all start working.',
      action: 'Log a spend',
    },
    spendFiltered: {
      glyph: 'search',
      title: 'Nothing in this category',
      body: 'No spending has been filed here yet. Tap the category chip again to see everything.',
      action: 'Show everything',
    },
    tasks: {
      glyph: 'list',
      title: 'Nothing to do yet',
      body: 'Add the first thing you must not forget — a visa appointment, a deposit, the call you keep putting off.',
      action: 'Add a to-do',
    },
    alarms: {
      glyph: 'clock',
      title: 'No timed moments yet',
      body: 'The app cannot ring while it is closed. Add the miss-it-lose-it moments here, then export them to the phone calendar, which does ring.',
      action: 'Add a timed moment',
    },
    packing: {
      glyph: 'pack',
      title: 'Nothing on the packing list yet',
      body: 'Add a bag’s worth by hand, or apply a template you saved on an earlier trip.',
      action: 'Add an item',
    },
    templates: {
      glyph: 'download',
      title: 'No templates saved',
      body: 'Save this packing list once and every trip after it starts from something instead of from nothing.',
    },
    checklists: {
      glyph: 'device',
      title: 'No checklists yet',
      body: 'A checklist is the list you run once, before you fly: apps installed, cash drawn, VPN tested.',
      action: 'Add a checklist',
    },
    vault: {
      glyph: 'doc',
      title: 'No documents yet',
      body: 'The passport scan, the insurance PDF, the ticket you were emailed. They live on this phone and open with no signal.',
      action: 'Add files',
    },
    route: {
      glyph: 'route',
      title: 'No route to draw yet',
      body: 'The map draws itself from your stops. Add the first stop in Plans and the line appears here.',
      action: 'Open Plans',
    },
    info: {
      glyph: 'info',
      title: 'Nothing filed yet',
      body: 'Info is where the route, the papers, the numbers and the phone calls you might need live. It fills up as the trip does.',
    },
    /* Info's other sections stay quiet when empty — the hub's own empty state
       above covers the honest case and edit mode carries an ＋ for each of
       them. Emergency is the exception: it is offered even when it is empty. */
    emergency: {
      glyph: 'phone',
      title: 'No emergency numbers yet',
      body: 'The three worth having: local emergency, your embassy, and your insurer’s 24-hour line.',
      action: 'Add a contact',
    },
    backupTrips: {
      glyph: 'pouch',
      title: 'No trips to save yet',
      body: 'Create or import a trip and it will appear here, ready to export as a single file.',
    },
  },
  /* Schema-driven sheets — one vocabulary for every editor in the app. */
  forms: {
    newTitle: (what: string) => `New ${what}`,
    editTitle: (what: string) => `Edit ${what}`,
    save: 'Save',
    saving: 'Saving…',
    saveFailed: 'Could not save',
    delete: 'Delete',
    deleteArm: 'Tap again to delete',
    required: 'required',
    addLine: 'Add line',
    addRow: 'Add row',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    unsaved: 'Unsaved changes',
    unsavedHint: 'Press back again to discard them.',
    keyPh: 'Label',
    valuePh: 'Value',
  },
  importer: {
    title: 'Restore',
    intro:
      'Import a trip file, a Living the dream backup, or a backup from the old China app. Everything stays on this phone — nothing is uploaded.',
    choose: 'Choose a file…',
    orPaste: 'or paste the text',
    pastePh: 'Paste a backup blob…',
    readPaste: 'Read pasted text',
    back: 'Back',
    import: 'Import',
    importing: 'Importing…',
    replaceImport: 'Replace & import',
    replaces: 'Replaces',
    replaceWarn: 'This replaces a trip you already have',
    replaceWarnBody:
      'The existing copy is deleted first, then the file is written in. Ticks and expenses stored only on this device — and not present in the file — would be lost.',
    legacyTitle: 'From the old China app',
    legacyBody:
      'Expenses, ticks, notes, custom packing items and the gift-card balance are matched back onto the imported trip. Anything already there is kept.',
    legacyNeedsTrip:
      'This looks like a backup from the old China app. Import the China trip first, then load this on top of it.',
    restore: 'Restore',
    restoring: 'Restoring…',
    unreadable: 'Could not read that file',
    unparseable: 'That did not parse',
    failed: 'Import failed',
    nothingMatched: 'Nothing in that file could be matched.',
    imported: (n: number) => `Imported ${n} trip${n === 1 ? '' : 's'} ✓`,
  },
  backup: {
    title: 'Backup',
    subtitle: 'everything stays on this phone',
    staleTitle: 'Your backup is out of date',
    staleBody:
      'You have changed things since the last export. Save one now — browser storage can be cleared, especially when the phone is low on space.',
    saveTitle: 'Save a copy',
    lastBackup: 'Last backup',
    never: 'never',
    saveAll: 'Save everything',
    saved: 'Vault saved ✓',
    copyText: 'Copy as text',
    copyTextSub: 'no documents · fits in a note',
    saveNote:
      'The text form fits in a note or an email to yourself. The file form carries your documents with it.',
    oneTrip: 'One trip only',
    oneTripSub: 'a file you can send to someone travelling with you',
    save: 'Save',
    savedTrip: (title: string) => `${title} saved ✓`,
    restoreTitle: 'Restore',
    restoreBody:
      'Load a Living the dream backup, a trip file, or a backup from the old China app. You see what is in it before anything is written.',
    restoreBtn: 'Import a file',
    storage: 'Storage',
    protected: 'Protected against automatic cleanup',
    notProtected: 'Not yet protected against cleanup',
    askProtection: 'Ask for protection',
    askedProtection: 'Asked the browser to protect this data',
    protectionHint: 'Installing Living the dream to the home screen is what usually earns it.',
    usage: (used: string, quota: string) => `${used} used of ${quota} available`,
    vaultLine: (trips: number, docs: number, bytes: string) =>
      `${trips} trip${trips === 1 ? '' : 's'} · ${docs} document${docs === 1 ? '' : 's'} · ${bytes}`,
    clearTitle: 'Clear everything',
    clearBody: 'Deletes every trip on this device. A backup file is downloaded first, automatically.',
    clear: 'Clear the vault',
    clearArm: 'Tap again to clear the vault',
    cleared: 'Vault cleared — a backup was downloaded first',
    failed: 'That did not work',
  },
  /* Google Drive backup — opt-in, and every word of it has to be true.
     A phone lost in China must cost a device, not the trip; that is the only
     reason the app is allowed to talk to Google at all. */
  drive: {
    title: 'Drive backup',
    subtitle: 'a copy that survives the phone',
    /* Said before anyone taps anything: exactly what leaves, and where to. */
    explainer:
      'Sends the same backup file this screen already saves — your trips, days, bookings, spending and documents — to a private folder in your own Google Drive. Only while online, and only after you connect.',
    privacy:
      'The app is given access to its own folder and nothing else: it cannot see your Drive, your photos or your other files, and Google does not show that folder in a file picker.',
    nothingElse: 'Nothing else is ever sent. No analytics, no location, no crash reports.',
    /* The honest state while the owner has not done the one-time console step.
       There is no button to tap here, because there is nothing a tap could do. */
    unconfigured: 'Not connected — needs a one-time Google setup',
    unconfiguredBody:
      'Google will only issue the sign-in credential to a person, not to a build, so this app ships without one. The steps are in docs/DRIVE-SETUP.md — about five minutes, once.',
    notConnected: 'Not connected',
    connect: 'Connect Google Drive',
    connecting: 'Opening Google…',
    connected: 'Connected',
    disconnect: 'Disconnect',
    disconnected: 'Disconnected — the copies already in Drive are untouched',
    backupNow: 'Back up now',
    backingUp: 'Backing up…',
    backedUp: 'Backed up to Drive ✓',
    lastBackup: 'Last Drive backup',
    never: 'never',
    /* Offline is NOT an error: it is the normal condition of this trip. */
    offline: 'Offline — the next backup happens when you are back online',
    autoNote: 'Backs up by itself after you change something, when online. Keeps the last 10 copies.',
    restoreTitle: 'Restore from Drive',
    restoreBody: 'You see what is in a copy before anything is written, exactly like a file restore.',
    listVersions: 'Show saved copies',
    loading: 'Reading the list…',
    noVersions: 'No copies in Drive yet',
    use: 'Restore',
    /* A failure surfaces once, quietly, and never nags again. */
    failedAt: (what: string, when: string) => `Last attempt failed (${what}) · ${when}`,
  },
  /* The offline converter. A converter that needs a network is blank in the
     one country it was bought for, so this one never fetches — and it says
     where each rate came from instead of pretending to be live. */
  convert: {
    title: 'Convert',
    subtitle: 'works with no signal',
    amount: 'Amount',
    swap: 'Swap',
    fromCur: 'Convert from',
    toCur: 'Convert to',
    /* Provenance, in the order the app trusts it. */
    fromYou: (when: string) => `your rate, set ${when}`,
    fromSpending: (when: string) => `from what you spent on ${when}`,
    fromTrip: 'the rate this trip was planned with',
    editRate: 'Set your own rate',
    ratePh: 'e.g. 7.15',
    saveRate: 'Save',
    clear: 'Use the trip’s rate again',
    noRate: 'No rate for that pair',
    neverFetches: 'Never fetches a rate. Type the one on the board and it is yours until you change it.',
  },
  /* Health & insurance — one place for what the trip data already carries.
     Every line here is pulled from a card, a contact or a note that exists;
     nothing about medicine or cover is invented. */
  health: {
    title: 'Health & insurance',
    emergencyLine: '24-hour emergency line',
    localHelp: 'Local emergency numbers',
    medicine: 'Medicine rules',
    /* The failure this section exists to prevent: a policy that lives only in
       an email, on a phone with no signal, in a hospital. */
    pdfMissing: 'Is your insurance PDF on this phone?',
    pdfMissingBody:
      'A policy you can only reach through email is a policy you do not have when the phone has no signal. Save it into Documents while you can.',
    pdfPresent: (n: number) => `${n} insurance document${n === 1 ? '' : 's'} saved on this phone ✓`,
    openDocs: 'Open Documents',
    nothing: 'This trip carries no insurance or health details yet.',
  },
  misc: {
    close: 'Close',
    back: 'Back',
    archive: 'Archive trip',
    unarchive: 'Unarchive',
    archiveHint: 'Archived trips stay on the phone, just out of the way.',
    deleteTrip: 'Delete trip',
    deleteArm: 'Tap again to delete for good',
    deleteHint: 'Deleting removes the trip and everything in it — days, bookings, spending, photos and files. A copy is saved first.',
    deleteSaving: 'Saving a copy first…',
    deleted: (title: string) => `${title} deleted · the saved copy can restore it`,
    editTrip: 'Edit trip',
    localOnly: 'Offline-first · your data stays on this phone',
  },
} as const;
