# The signing key — do not lose this

`ltd-release.keystore` and `keystore.properties` are committed on purpose.

Android identifies an app by its signing key. If a future build is signed with a
different key, the phone **refuses to install the update** and the only way
forward is uninstalling first — which deletes every trip, expense and document
stored on the device. Keeping the key in the repository is what guarantees you
can always install an update over the top, even after a new PC.

The password is deliberately weak and the certificate is self-signed. That is
fine here and only here, because:

- the app is never published to the Play Store or distributed to anyone,
- the repository is private and already holds far more sensitive material
  (passport number, booking references, the flight manifest),
- the worst a leaked key allows is signing an app that pretends to be this one,
  and nothing anywhere trusts it.

If the app ever *were* to be published, generate a fresh key, keep it out of
version control, and accept that the first published build starts a new
identity.

## Rebuilding

```bash
cd app
npm run android:apk     # build + sync + assemble a signed release apk
npm run android:install # push it to a phone connected over USB
```

The apk lands at `android/app/build/outputs/apk/release/app-release.apk`.
