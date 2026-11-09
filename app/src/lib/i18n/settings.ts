/* THE SETTINGS SCREEN, IN WORDS (QA 10 Nov 2026) — a module of its own, like backup.ts, mapbuild.ts and
   reminders.ts: only the Settings screen reads these, and it is a lazy screen; in strings.ts's `S` they sat in the
   start-up bundle every cold start loads and parses. The few Settings words other screens read stay in
   `S.settings`: the shelf's gear (title), the date-preview bar and its row, and the storage line the Backup
   screen shares. */
export const SS = {
  calmMotion: 'Calm motion',
  navGroup: 'Turn-by-turn',
  navLead: 'Directions open in',
  navOpt: { auto: 'Automatic', amap: 'Amap', google: 'Google' } as Record<'auto' | 'amap' | 'google', string>,
  navSub: {
    auto: 'Amap in mainland China, Google in Hong Kong and Macau',
    amap: 'Always Amap: no VPN needed, thin in Hong Kong',
    google: 'Always Google: needs a VPN in mainland China',
  } as Record<'auto' | 'amap' | 'google', string>,
  weather: 'Weather',
  storage: 'Storage',
  notPersisted: 'Not yet protected — install the app to your home screen',
  usedOf: (used: string, quota: string) => `${used} used of ${quota}`,
  backupBtn: 'Backup & restore',
  about: 'About',
  /* ---------- Horizon (f-settings) ---------- */
  back: 'Back to your trips',
  appearance: 'Appearance',
  onPhone: 'On this phone',
  needsInternet: 'Needs internet',
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
  /* the outcome of a save from here, said as what happened (QA 9 Nov 2026):
     a dismissed share sheet recorded nothing */
  saveToDrive: 'Back up to Drive',
  savedOut: (what: string) => `${what} saved ✓`,
  sharedOut: (what: string) => `${what} handed to the app you picked`,
  notShared: 'Not shared — no backup was recorded',
  saveFileSub: 'Keep or send a copy',
  save: 'Save',
  thisTrip: (title: string) => `This trip · ${title}`,
  exportTrip: 'Export the trip file',
  archive: 'Archive',
  unarchive: 'Bring it back from the archive',
  version: (v: string) => `Version ${v}`,
  footer: 'Living the dream · works offline · no account',
  /* the Danger zone at the foot of the page: what cannot be undone, apart from the routine rows (QA 10 Nov 2026) */
  dangerTitle: 'Danger zone',
  deletePack: 'Delete the map pack',
  deletePackCost: (size: string) => `Frees ${size} on this phone. Building the map again needs a Wi-Fi download.`,
};
