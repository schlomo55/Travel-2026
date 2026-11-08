# The signing key — do not lose this

Android identifies an app by its signing key. If a future build is signed with a
different key, the phone **refuses to install the update** and the only way
forward is uninstalling first — which deletes every trip, expense and document
stored on the device. So the key must never be lost and never change by accident.

## Where it lives (since 2026-09-29)

**Outside the repository**, in the owner's private folder on the build PC — next to
the private files the privacy gates read:

```
~/.ltd-private/android/keystore.properties   (storeFile, storePassword, keyAlias, keyPassword)
~/.ltd-private/android/ltd-release.keystore
```

`app/build.gradle` looks for the properties file in this order and uses the first
it finds: `$LTD_KEYSTORE_PROPERTIES`, `~/.ltd-private/android/keystore.properties`,
then `keystore.properties` next to this project (only for checkouts made before the
move). `storeFile` is read relative to the properties file's own folder. Both files
are git-ignored here (`keystore.properties`, `*.keystore`, `*.jks`).

**Why it moved:** until 2026-09-28 the key and its password were committed in this
repository, and the repository was **public** on GitHub until that day. The key must
therefore be treated as exposed: someone could sign an app that installs as an update
of this one. The owner's decision (2026-09-29): keep this key until after the trip
(changing it means one uninstall + reinstall), install LTD builds only from the
owner's own Google Drive folder, and after the trip generate a new key — kept out of
version control from day one — and do one clean reinstall (back up first, then
import the trip file and the backup).

**Recovery:** the old commits that contained the key were purged from the repository's history
(Nov 2026), so the copy in `~/.ltd-private/android/` is now the only one — keep a backup of that
folder somewhere else. Never publish it again.

## Rebuilding

```bash
cd app
npm run android:apk     # build:android + sync + assemble a signed release apk
npm run android:install # push it to a phone connected over USB
```

**The app is built into `dist-android/`, not `dist/`** (since 7 Nov 2026): `npm run build:android`
(`vite build --mode android`) builds in the online map's Protomaps key from
`~/.ltd-private/protomaps.key`, and `dist/` is committed to a public repository, so the key must
never be in it. `capacitor.config.ts` points `webDir` at `dist-android/`; copying the web files
into the Android project by hand means copying `dist-android/`, never `dist/` (a `dist/` copy is
an app without online tiles). No key file: the app builds without online tiles, nothing else
changes.

The apk lands at `android/app/build/outputs/apk/release/app-release.apk`. Check the
signer before delivering it (the digest must stay the same as the installed app's):
`apksigner verify --print-certs app-release.apk`.

## Delivering it

Upload it to the owner's Google Drive as **apps › LTD Horizon › `LTD-real-app.apk`** —
one copy, under that name, next to the `China 2026` folder that holds the trip file. The
phone installs LTD builds only from there.
