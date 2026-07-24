import type { CapacitorConfig } from '@capacitor/cli';

/* Sojourn as a native Android app. The built web assets are bundled INSIDE the
   apk (webDir) rather than loaded from a server, so the app works from first
   launch with no network, no cable and no hosting — and its data lives in the
   app's own sandbox, which Android protects far more strictly than browser
   storage. */
const config: CapacitorConfig = {
  appId: 'com.sojourn.travel',
  appName: 'Sojourn',
  webDir: 'dist',
  android: {
    /* https://localhost is a secure origin, so IndexedDB, clipboard and the
       wake lock all behave exactly as they do on the deployed site. */
    androidScheme: 'https',
    /* Nothing in this app benefits from a debuggable WebView in release. */
    webContentsDebuggingEnabled: false,
  },
};

export default config;
