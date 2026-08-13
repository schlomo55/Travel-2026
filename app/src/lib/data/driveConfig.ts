/* The one credential this app cannot ship.
 *
 * Google will not issue an OAuth client id to a build script. Only a human
 * signed into the owner's own Google account can create one, in the Cloud
 * console, bound to this app's package name and to the SHA-1 of the release
 * signing key. So the whole Drive feature is built against a config that is
 * NULL here, and every screen that would use it says "needs a one-time Google
 * setup" in plain words instead of pretending to be one tap from working.
 *
 * A client id is not a secret — it ships in the source of every web page that
 * offers Google sign-in — but it belongs to a person, not to this code, and an
 * invented one would be a fact the app states without knowing it. The exact
 * console steps, including how to print the keystore's SHA-1, are in
 * docs/DRIVE-SETUP.md. Filling in the two nulls below is the whole install.
 *
 * `check:dist` runs on every build: these must still be null when the APK and
 * the PWA are cut for anyone but the owner.
 */

export interface DriveConfig {
  /** Google Cloud "Web application" client — the PWA's Google Identity
      Services token client. Null until the owner creates one. */
  webClientId: string | null;
  /** Google Cloud "Android" client — the APK's PKCE flow. Null likewise.
      Android clients carry no secret; the package name + signing-key SHA-1
      are what identify the app, which is why the keystore matters. */
  androidClientId: string | null;
  /** The custom scheme Google redirects back to after the system browser has
      done the consent. Must equal the app id, and must match the intent
      filter in android/app/src/main/AndroidManifest.xml. */
  redirectScheme: string;
  /** The path half of the redirect. Together: com.livingthedream.travel:/oauth2redirect */
  redirectPath: string;
}

export const DRIVE_CONFIG: DriveConfig = {
  webClientId: null,
  androidClientId: null,
  redirectScheme: 'com.livingthedream.travel',
  redirectPath: '/oauth2redirect',
};

/** The full redirect URI handed to Google and declared in the console. */
export function driveRedirectUri(cfg: DriveConfig = DRIVE_CONFIG): string {
  return `${cfg.redirectScheme}:${cfg.redirectPath}`;
}

/**
 * Is there a credential for THIS platform?
 *
 * Deliberately platform-aware: the owner may well fill in the Android client
 * first (that is the phone that goes to China) and the web one later, and the
 * PWA must keep saying "not set up" rather than failing at the Google end.
 */
export function driveConfigured(native: boolean, cfg: DriveConfig = DRIVE_CONFIG): boolean {
  return (native ? cfg.androidClientId : cfg.webClientId) !== null;
}

export function driveClientId(native: boolean, cfg: DriveConfig = DRIVE_CONFIG): string | null {
  return native ? cfg.androidClientId : cfg.webClientId;
}
