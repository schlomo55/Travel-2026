# Drive backup — the one-time Google setup

**Who can do this: only you.** Google issues an OAuth client id to a person signed into a Google
account, in a web console, after agreeing to terms. It cannot be scripted, and it must not be
invented — so the app ships with the credential set to `null`, the Backup screen says
*"Not connected — needs a one-time Google setup"*, and nothing in the feature can reach the
network until the two blanks below are filled in.

Budget about five minutes in the console, then two minutes on the phone.

**Why bother:** everything else in this app is deliberately local. The one thing local storage
cannot survive is the phone not existing any more. A lost, stolen or drowned phone in Chongqing
should cost a device, not the trip.

---

## 0. What the app will actually do once this is done

| | |
|---|---|
| **Scope requested** | `https://www.googleapis.com/auth/drive.appdata` — the app-private folder, and *nothing else*. The app cannot see your Drive, your photos or your documents, and Google does not show this folder in a file picker. |
| **What is uploaded** | Exactly the bytes the Backup screen already writes to Downloads: the `livingthedream/backup` envelope (trips, days, bookings, spending, documents), gzipped. |
| **What is never uploaded** | Anything else. No analytics, no telemetry, no location, no crash reports, no "which screens you opened". |
| **When** | After you opt in, and only while online. Offline it silently does nothing — no spinner, no error. |
| **How often** | Debounced ~20 s after a change, at most once every 5 minutes, plus the "Back up now" button. |
| **How many kept** | The last 10. Older ones are deleted after each successful upload. Files the app did not name are never touched. |
| **Where the tokens live** | Dexie's `meta` table on the phone. They are not in `app/src`, not in the bundle, and not in any backup file — the export envelope has no field that could carry them (proved in `src/tests/drive.test.ts`). |

---

## 1. Create the project and turn on the API

1. Go to <https://console.cloud.google.com/> and sign in with the Google account whose Drive
   should hold the backups.
2. **Create a project.** Name it anything — `living-the-dream` is fine. Wait for it to be
   selected in the project picker at the top.
3. Go to **APIs & Services → Library**, search for **Google Drive API**, open it, press
   **Enable**.

## 2. The OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External**. (Internal is only offered to Workspace domains. External is correct
   for a personal account.)
3. App name: `Living the dream`. User support email and developer contact email: your own
   address. Nothing else on this page is required.
4. **Scopes:** press *Add or remove scopes*, then paste this into the filter and tick it:

   ```
   https://www.googleapis.com/auth/drive.appdata
   ```

   This is a **non-sensitive** scope — it needs no verification and no review. Do not add
   `drive` or `drive.file`; they would let the app see your real Drive, and it must not be able
   to.
5. **Test users:** add your own Google address. While the app is in "Testing" only listed test
   users can sign in — which is exactly what you want. You never need to publish it.

   > A "Testing" app's refresh tokens expire after 7 days. That is fine for the trip if you
   > reconnect before flying, but if you would rather it never expire, press **Publish app** on
   > this page. With only a non-sensitive scope, publishing needs no verification — you will get
   > an "unverified app" interstitial on the consent screen, which you click through once.

## 3. The Android client (the phone that goes to China)

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Android**.
3. Name: `LTD Android`.
4. **Package name** — exactly:

   ```
   com.livingthedream.travel
   ```

5. **SHA-1 certificate fingerprint** — the release keystore is committed to this repo, so this
   value is fixed and already known:

   ```
   A6:59:06:4E:09:D1:11:42:A6:3D:66:70:25:DF:38:35:64:C4:15:28
   ```

   To print it again yourself (from `app/android/`):

   ```sh
   keytool -list -v -keystore ltd-release.keystore -alias livingthedream -storepass livingthedream-local
   ```

   The credentials are in `app/android/keystore.properties`. If you ever re-generate the
   keystore, this fingerprint changes and the Android client must be updated to match, or
   sign-in fails with `invalid_client`.

6. Create it, and copy the client id — it looks like `1234567890-abc….apps.googleusercontent.com`.

## 4. The Web client (the PWA)

1. **Create credentials → OAuth client ID** again. Application type: **Web application**.
2. Name: `LTD Web`.
3. **Authorised JavaScript origins** — add the origin you actually serve the PWA from (check the
   address bar; for the Cloudflare Pages deploy that is `https://living-the-dream.pages.dev`),
   and, if you want to test locally, `http://localhost:4173`.
4. You do **not** need an authorised redirect URI: the PWA uses Google Identity Services' token
   client, which is popup-based.
5. Create it and copy that client id too.

## 5. Paste the ids into the app

Open `app/src/lib/data/driveConfig.ts` and replace the two nulls:

```ts
export const DRIVE_CONFIG: DriveConfig = {
  webClientId: '…apps.googleusercontent.com',      // from step 4
  androidClientId: '…apps.googleusercontent.com',  // from step 3
  redirectScheme: 'com.livingthedream.travel',
  redirectPath: '/oauth2redirect',
};
```

Then rebuild: `npm run build` (from `app/`). The Backup screen's Drive card stops saying
"needs a one-time Google setup" and grows a **Connect Google Drive** button.

> Client ids are not secrets — they ship in the source of every page that offers Google sign-in —
> but they identify *you*. If this repo is ever made public, that is the line to think about.

### 5b. The one native step this run could not finish

Google refuses OAuth inside a WebView, so on the APK the consent screen opens in the **system
browser** and the answer comes back through the custom scheme
`com.livingthedream.travel:/oauth2redirect`. The intent filter for that is already in
`app/android/app/src/main/AndroidManifest.xml`. What is still missing is the four lines that
hand the returning URL from Android into the WebView — that needs a native build, which the
build run could not run or verify.

Pick **either** option; both end at the same JavaScript entry point, `window.__ltdOAuthRedirect(url)`,
which the app already exposes at startup.

**Option A — the Capacitor plugin (recommended, no Java).**

```sh
cd app
npm i @capacitor/app
npx cap sync android
```

That is all. The app already listens for `appUrlOpen` through Capacitor's global plugin proxy,
so it starts working the moment the plugin is present. (It is deliberately *not* a static import:
a static import of a package that is not installed does not compile.)

**Option B — four lines of Java**, if you would rather not add a dependency. In
`app/android/app/src/main/java/com/livingthedream/travel/MainActivity.java`:

```java
@Override
public void onNewIntent(Intent intent) {
  super.onNewIntent(intent);
  android.net.Uri data = intent.getData();
  if (data != null && "com.livingthedream.travel".equals(data.getScheme())) {
    final String url = data.toString().replace("'", "");
    getBridge().getWebView().post(() ->
      getBridge().getWebView().evaluateJavascript("window.__ltdOAuthRedirect('" + url + "')", null));
  }
}
```

(`import android.content.Intent;` at the top.) The activity is already `launchMode="singleTask"`,
so the redirect lands in the running app rather than a second copy of it.

Until one of these is done, the **PWA path works fully** and the APK's Connect button will open
Google correctly but never hear the answer back.

---

## 6. The two-minute test on the phone — the part only you can do

This has never been run against a live Google account. Nothing in this repo has ever talked to
Google, deliberately: no test fakes a real login, and the rehearsal proves the opposite property
(zero requests while not connected). So this is the first real proof, and it is yours to take.

1. Install the rebuilt APK (or open the redeployed PWA) **with the phone online**.
2. **Settings → Backup**. The Drive card should now read **"Not connected"** with a *Connect
   Google Drive* button, and the explainer above it should say the appdata-folder sentence.
3. Tap **Connect Google Drive**.
   - APK: the *system browser* must open (Chrome, not a page inside the app). If you see a
     Google error saying `disallowed_useragent`, the browser did not open — the flow is being
     run in the WebView.
   - PWA: a Google popup appears.
   - Choose your account. The consent screen must ask for **"See, edit, create and delete only
     the specific Google Drive files you use with this app"** — if it asks for anything broader,
     stop, and check the scope in step 2.4.
4. Back in the app, the card should say **✓ Connected**, *Last Drive backup: never*.
5. Tap **Back up now**. Within a couple of seconds: a *"Backed up to Drive ✓"* toast, and the
   line becomes *Last Drive backup: <today, the time>*.
6. Tap **Show saved copies**. One entry, timestamped now.
7. **Prove the restore path**: tap *Restore* on that entry. It must open the same staged preview
   an imported file opens — *"10 stops + 1 transit · 27 days written · …"* — **and it must not
   write anything until you press the confirm button.** Press *Back*, not the confirm: you have
   what you needed.
8. **Prove offline is silent.** Turn on airplane mode, change something (tick a packing item),
   wait a minute. There must be no spinner, no error and no toast; the card should say
   *"Offline — the next backup happens when you are back online"* and *Last Drive backup* must
   still show the earlier time, unchanged. Turn the network back on, change something again, and
   within about 20 seconds the timestamp should move by itself.
9. **Verify at Google's end** (optional but reassuring): <https://myaccount.google.com/permissions>
   should list *Living the dream* with access to *"only the specific files you use with it"*.
   That page is also where you can withdraw access from outside the app.
10. Tap **Disconnect** and confirm the card returns to *"Not connected"*. The copies already in
    Drive are deliberately left alone.

### If something goes wrong

| Symptom | Cause |
|---|---|
| `disallowed_useragent` | The consent screen opened in the WebView, not the system browser (native path only). |
| `invalid_client` | Package name or SHA-1 in the Android client does not match the APK that is installed — re-check step 3. |
| `redirect_uri_mismatch` | The scheme in `driveConfig.ts` and the manifest intent filter disagree. |
| Connect opens Google, you approve, nothing happens (APK) | Step 5b was not done. |
| `access_denied` after approving | Your account is not in the test-user list (step 2.5). |
| Connected, but "Back up now" fails with 403 | The Drive API is not enabled on the project (step 1.3). |

---

## 7. Turning it off, for good

- **In the app:** *Disconnect* deletes the tokens from the phone and asks Google to revoke the
  grant. Files already in Drive are untouched.
- **At Google:** <https://myaccount.google.com/permissions> → *Living the dream* → *Remove access*.
- **In the code:** set both ids back to `null` in `driveConfig.ts` and rebuild. The feature
  returns to the state this repo ships in: visible, honest, and incapable of reaching the network.
- **The files themselves** live in a hidden app-data folder. Google exposes it at
  <https://drive.google.com/drive/u/0/settings> → *Manage apps* → *Living the dream* →
  *Delete hidden app data*.
