/* THE ONLINE MAP AND "BUILD MAP FOR THIS TRIP", IN WORDS (7 Nov 2026) — a module of its own, like photos.ts: only
   the Map tab and Settings read these, and both are lazy screens; in strings.ts's `S` they would sit in the start-up
   bundle every cold start loads and parses. */
export const SB = {
  /* the Map tab's badge: which source drew what is on screen */
  offlineMap: 'Offline map',
  online: 'Online',
  badgeAria: (online: boolean) => (online ? 'Streets here come from the internet' : 'Streets here come from the map on this phone'),

  /* the button and what stands in for it on the web */
  build: 'Build map for this trip',
  buildAria: (trip: string) => `Build the map for ${trip}`,
  webOnly: 'Building a map needs the LTD app on Android — in a browser, import a map pack file instead.',

  /* planning */
  planning: 'Finding today’s map of the world…',
  planningIndex: 'Reading the map’s index…',
  noPlaces: 'This trip has no place with a position yet — there is nothing to build a map of.',

  /* the confirm sheet */
  confirmTitle: (trip: string) => `Build the map for ${trip}`,
  download: (size: string) => `About ${size} to download`,
  onPhone: (size: string) => `The finished map takes ${size} on this phone.`,
  network: 'On Wi-Fi or mobile data (working this out read a few MB already). You can cancel and carry on later.',
  areas: (n: number, names: string) => `${n === 1 ? '1 area' : `${n} areas`}: ${names}`,
  areasNote: 'Every stop with at least 25 km round it, and every place of the trip with its streets.',
  source: (date: string) => `OpenStreetMap, from the Protomaps build of ${date}.`,
  replaces: 'This REPLACES the map pack on this phone completely',
  /* phase 2 (8 Nov 2026): a pack's photos for this trip come along into the new map */
  replacesWhat: (photos: number, carried: number) =>
    carried > 0
      ? `— its streets; its ${carried === 1 ? 'place photo comes' : `${carried} place photos come`} along into the new map.`
      : photos > 0
        ? `— its streets and its ${photos} place photos, which are another trip’s. The new map has no place photos.`
        : '— its streets. The new map has no place photos.',
  firstPack: 'The new map has no place photos.',
  go: 'Build it',
  notNow: 'Not now',

  /* under way */
  building: (pct: number) => `Building the map… ${pct} %`,
  checking: 'Checking the new map…',
  cancel: 'Cancel',
  paused: (pct: number) => `The map build stopped at ${pct} % — the part already downloaded is kept.`,
  resume: 'Carry on',
  discard: 'Discard',
  ready: 'The new map is ready',
  /* phase 2: a photo pack's photos into the map on this phone */
  addPhotos: 'Add place photos from a pack file',
  noPhotosIn: 'That file carries no place photos — the map is as it was.',
  photosGone: 'The map pack whose photos were to come along has changed — build again.',

  /* why it stopped */
  noConnection: 'No connection to the map server — carry on when the phone is online.',
  gone: (date: string) => `The map build of ${date} is no longer on the server — start again with today’s.`,
  changed: 'The trip or the map server changed since this build started — start it again.',
  partGone: 'The half-built map was removed from this phone — start again.',
  rangeIgnored: 'This network will not download a map in parts (a hotel or office proxy?) — carry on over another Wi-Fi or mobile data.',
  noRoom: (free: string) => `Not enough room on this phone for the new map (${free} free). Nothing changed.`,
  noOpfs: 'This phone’s browser cannot keep a map pack.',
  busy: 'A map pack is being copied — wait for it to finish.',
  failed: 'The map build did not finish — the map pack from before is still here.',
  failedNone: 'The map build did not finish — no map pack was saved.',
  invalid: 'The new map did not check out — the map pack from before is still here.',
};
