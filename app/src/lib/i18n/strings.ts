/* Every user-facing string lives here (docs/ARCHITECTURE.md §2).
   Single language today by decision; the shape makes a second one cheap. */
export const S = {
  app: {
    name: 'Living the dream',
    updateReady: 'Update ready',
    reload: 'Reload',
    offlineReady: 'Precached — ready for airplane mode ✓',
    dismiss: 'Dismiss',
  },
  /* States the phone itself is in. Quiet where the state is normal on this
     trip (offline), loud where it is danger (a database that will not read). */
  system: {
    offline: '⚡ Offline · showing saved data',
    dataUnreadable: 'Your trip data could not be read on this phone — open Backup',
    openBackup: 'Open Backup',
    saveFailed: 'Could not save — try again',
  },
  shelf: {
    title: 'My Trips',
    active: 'Active',
    upcoming: 'Upcoming',
    past: 'Past',
    archived: 'Archived',
    newTrip: 'Start a New Trip',
    newTripHint: 'Plan your next adventure offline.',
    importTrip: 'Import a trip',
    daysToGo: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} to go`,
    dayOf: (n: number, total: number) => `Day ${n} of ${total}`,
    completed: (total: number) => `${total} days · complete`,
    across: 'Across every trip',
    stamps: { active: 'En route', upcoming: 'Upcoming', done: 'Done ✓', archived: 'Archived' },
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
    cancel: 'Cancel',
    errName: 'Give the trip a name.',
    errDates: 'The last day must not be before the first.',
    created: 'Trip created',
    updated: 'Trip updated',
  },
  /* The five tabs of the floating pill. Renamed with the Lantern redesign
     (plan §SCREENS): Today→Home, Plan→Plans, Tasks→Lists. */
  tabs: {
    home: 'Home',
    plans: 'Plans',
    wallet: 'Wallet',
    lists: 'Lists',
    info: 'Info',
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
    routeMoved: 'The route map lives in Info now',
    /* The guide's jump bar — Info's chips, on the longest page in the app. */
    jump: {
      there: 'Getting there',
      about: 'About',
      booked: 'Booked',
      days: 'Day by day',
      sleep: 'Sleep',
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
    booked: 'Booked & committed',
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
    open: '🗺 Open in maps',
    /* The toast label after a long-press: copyText prints "Copied ✓ …". */
    copied: 'the place name',
    copiedAddress: 'the address',
    copyAddress: 'Copy the address',
    /* The visible twin of the long-press. The gesture stays; it stops being
       the only way to get the string you paste into a ride-hailing app. */
    copyAddressBtn: '⧉ Copy address',
    openIn: (name: string) => `Open ${name} in a map`,
    placesHere: '📍 Places here',
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
    noApp: 'No map app could open this.',
  },
  weather: {
    setting: 'Fetch weather when online',
    settingHint:
      'Sends only the coordinates of your current and next stop to open-meteo.com, and only when the phone is online. Nothing else ever leaves the device.',
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
    onTheRoad: 'On the road',
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
    counterLine: (name: string, day: number, limit: number) => `${name} — day ${day} of ${limit}`,
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
  },
  wallet: {
    title: 'Wallet',
    subtitle: 'show this at the counter',
    /* "Total spent" was a lie by omission: it is the sum of what has been
       LOGGED, and two taps away the same tab prints a bigger, committed
       figure against the same budget. It says which number it is now. */
    totalSpent: 'Logged so far',
    ofBudget: (total: string) => `budget ${total}`,
    tapToCopy: 'Tap to copy',
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
    gmailNote:
      '📧 "Find email" opens Gmail — the only thing here that needs a network. Everything else works with no signal at all.',
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
    title: 'Trip info',
    subtitle: 'route, papers, numbers',
    journeyOverview: 'Journey overview',
    documentVault: 'Document vault',
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
    counterPill: (name: string, day: number, limit: number) => `${name} · day ${day} of ${limit}`,
    exitBy: (d: string) => `exit by ${d}`,
    jump: {
      route: 'Route',
      docs: 'Docs',
      stats: 'Stats',
      clocks: 'Clocks',
      driver: 'Driver',
      emergency: 'Emergency',
      notes: 'Notes',
    },
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
    driverTitle: 'Show the driver',
    driverSub: 'tap for full screen',
    driverVerify: 'Lines marked *verify* came from general knowledge, not your trip documents.',
    phrases: 'Useful phrases',
    emergency: 'Emergency',
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
    counterOf: (limit: number) => `of ${limit}`,
    counterLeft: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} of legal stay left`,
    hardDeadline: 'Hard deadline',
  },
  stub: {
    title: (module: string) => `${module} arrives soon`,
    body: 'This part of Living the dream is still being built — it lands with the next milestones, before anything travel-critical needs it.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'four switches, no accounts',
    motion: 'Motion',
    calmMotion: 'Calm motion',
    calmMotionHint:
      'Turns off the entrances, fills and crossfades. The app looks and works the same, it just stops moving. Your phone’s own “reduce motion” setting already does this on its own.',
    /* The theme switch came back on 2026-08-12 (owner: "make them 2, optional,
       and by default dark"). The swatches beside it are drawn from the live
       tokens, so the row is its own preview of whichever theme is on. */
    look: 'Look',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeDefault: 'default',
    themeDarkName: 'Warm light on true black',
    themeLightName: 'The same materials, in daylight',
    themeHint:
      'Dark reads at arm’s length at 22:00 and costs the OLED almost nothing. Light is drawn for daylight rather than inverted — cream paper, manila tags, ink you can read on a bright train. Neither follows your phone: this is the app’s own setting.',
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
  },
  edit: {
    on: 'Editing — tap ✎ to change anything',
    add: (what: string) => `＋ Add ${what}`,
    empty: (what: string) => `No ${what} yet.`,
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
      glyph: '🧳',
      title: 'The shelf is empty',
      body: 'Start a trip from scratch, or import a trip file you already have. Everything you build stays on this phone.',
    },
    today: {
      glyph: '🗓',
      title: 'No plan for this day yet',
      body: 'Write the day in Plans, or let the stop’s usual day cover it — a usual day fills every date you never wrote down.',
      action: 'Open Plans',
    },
    plans: {
      glyph: '🧭',
      title: 'No stops yet',
      body: 'A stop is a place you sleep in and travel from. Add the first one, or import a trip file that already has them.',
      action: 'Add the first stop',
    },
    guide: {
      glyph: '📔',
      title: 'This guide is still blank',
      body: 'A guide fills from your own trip file: how to get there, the story of the place, the days, where to eat. Nothing here is ever invented for you.',
    },
    travel: {
      glyph: '✈️',
      title: 'No flights or trains yet',
      body: 'Add the leg you have booked — number, times, and the confirmation code you will be asked for at the counter.',
      action: 'Add a flight',
      alt: 'Add a train or activity',
    },
    stays: {
      glyph: '🛏',
      title: 'No beds yet',
      body: 'Add tonight’s hotel, or import your trip file. A bed you have only chosen counts too — mark it PENDING and it stays visible until it is booked.',
      action: 'Add a stay',
    },
    experiences: {
      glyph: '🎟',
      title: 'Nothing booked to do yet',
      body: 'A ticket, an attraction, a guided day, a table that has to be reserved — anything you go to rather than travel on. Add it PENDING while it is still something to buy.',
      action: 'Add a ticket',
    },
    cards: {
      glyph: '🗂',
      title: 'No cards yet',
      body: 'A card holds the numbers you read out at a counter: the insurance policy, the visa, a gift-card balance.',
      action: 'Add a card',
    },
    spend: {
      glyph: '💰',
      title: 'Nothing logged yet',
      body: 'Log the first spend and the totals, the daily burn and the CSV export all start working.',
      action: 'Log a spend',
    },
    spendFiltered: {
      glyph: '🔍',
      title: 'Nothing in this category',
      body: 'No spending has been filed here yet. Tap the category chip again to see everything.',
      action: 'Show everything',
    },
    tasks: {
      glyph: '📋',
      title: 'Nothing to do yet',
      body: 'Add the first thing you must not forget — a visa appointment, a deposit, the call you keep putting off.',
      action: 'Add a to-do',
    },
    alarms: {
      glyph: '⏰',
      title: 'No timed moments yet',
      body: 'The app cannot ring while it is closed. Add the miss-it-lose-it moments here, then export them to the phone calendar, which does ring.',
      action: 'Add a timed moment',
    },
    packing: {
      glyph: '🎒',
      title: 'Nothing on the packing list yet',
      body: 'Add a bag’s worth by hand, or apply a template you saved on an earlier trip.',
      action: 'Add an item',
    },
    templates: {
      glyph: '💾',
      title: 'No templates saved',
      body: 'Save this packing list once and every trip after it starts from something instead of from nothing.',
    },
    checklists: {
      glyph: '📱',
      title: 'No checklists yet',
      body: 'A checklist is the list you run once, before you fly: apps installed, cash drawn, VPN tested.',
      action: 'Add a checklist',
    },
    vault: {
      glyph: '📄',
      title: 'No documents yet',
      body: 'The passport scan, the insurance PDF, the ticket you were emailed. They live on this phone and open with no signal.',
      action: 'Add files',
    },
    route: {
      glyph: '🗺',
      title: 'No route to draw yet',
      body: 'The map draws itself from your stops. Add the first stop in Plans and the line appears here.',
      action: 'Open Plans',
    },
    info: {
      glyph: 'ℹ️',
      title: 'Nothing filed yet',
      body: 'Info is where the route, the papers, the numbers and the phone calls you might need live. It fills up as the trip does.',
    },
    /* Info's other sections stay quiet when empty — the hub's own empty state
       above covers the honest case and edit mode carries an ＋ for each of
       them. Emergency is the exception: it is offered even when it is empty. */
    emergency: {
      glyph: '🆘',
      title: 'No emergency numbers yet',
      body: 'The three worth having: local emergency, your embassy, and your insurer’s 24-hour line.',
      action: 'Add a contact',
    },
    backupTrips: {
      glyph: '🧳',
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
      'Import a trip file, a Living the dream backup, or a backup from the old China app. Everything stays on this device — nothing is uploaded.',
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
    subtitle: 'everything stays on this device',
    staleTitle: 'Your backup is out of date',
    staleBody:
      'You have changed things since the last export. Save one now — browser storage can be cleared, especially when the phone is low on space.',
    saveTitle: 'Save a copy',
    lastBackup: 'Last backup',
    never: 'never',
    saveAll: 'Save everything',
    saveAllSub: (name: string) => `one file · ${name}`,
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
    localOnly: 'Offline-first · your data stays on this device',
  },
} as const;
