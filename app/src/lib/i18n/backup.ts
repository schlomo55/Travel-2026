/* BACKUP AND DRIVE, IN WORDS (QA 9 Nov 2026) — a module of its own, like
   mapbuild.ts: only the Backup and Settings screens (both lazy) and the Drive
   card read these; in strings.ts's `S` they sat in the start-up bundle. */
export const SBK = {
  title: 'Backup',
  subtitle: 'everything stays on this phone',
  staleTitle: 'Your backup is out of date',
  staleBody:
    'You have changed things since the last export. Save one now — browser storage can be cleared, especially when the phone is low on space.',
  saveTitle: 'Save a copy',
  lastBackup: 'Last backup',
  /* A share sheet that came back with an app chosen proves only that the
     file was handed over, not that Drive finished — so it is worded as
     what it is (QA 9 Nov 2026). */
  lastShared: 'Last shared',
  lastCopied: 'Last copied',
  never: 'never',
  saveAll: 'Save everything',
  /* On the phone the file leaves through the share menu — to the Google
     Drive app, by the owner's choice (the Reminders run): no sign-in to
     set up, nothing to expire mid-trip, and Drive uploads when it can. */
  saveToDrive: 'Back up to Drive',
  driveHint: 'Pick Google Drive in the share menu; Android puts it first next time. Drive uploads it as soon as you’re online.',
  saved: 'Vault saved ✓',
  shared: 'Vault handed to the app you picked',
  sharedTrip: (title: string) => `${title} handed to the app you picked`,
  shareCancelled: 'Not shared — no backup was recorded',
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
  clearCancelled: 'No copy was shared — nothing was cleared',
  failed: 'That did not work',
};

/* Google Drive backup — opt-in, and every word of it has to be true.
   A phone lost in China must cost a device, not the trip; that is the only
   reason the app is allowed to talk to Google at all. */
export const SD = {
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
};
