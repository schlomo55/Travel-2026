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

**Recovery:** the old commits still contain the key (`git show <commit>:app/android/ltd-release.keystore`),
so it cannot be lost with this PC while the repository exists. Never publish it again.

## Rebuilding

```bash
cd app
npm run android:apk     # build + sync + assemble a signed release apk
npm run android:install # push it to a phone connected over USB
```

The apk lands at `android/app/build/outputs/apk/release/app-release.apk`. Check the
signer before delivering it (the digest must stay the same as the installed app's):
`apksigner verify --print-certs app-release.apk`.
