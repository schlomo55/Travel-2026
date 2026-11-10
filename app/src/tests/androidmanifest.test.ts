/* THE ANDROID APP KNOWS WHEN IT IS OFFLINE (7 Nov 2026). Android's WebView
   reports navigator.onLine from the network's state, which it may only read
   with ACCESS_NETWORK_STATE; without it navigator.onLine stays true in
   airplane mode, and every "online only" path — the online map's tiles
   (lib/map/street/online.ts), the weather, the Drive checks — would try the
   network it does not have. A normal permission: Android grants it at install,
   with no prompt. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);

describe('the Android manifest', () => {
  it('may read the network’s state, so navigator.onLine is false in airplane mode', () => {
    expect(permissions).toContain('android.permission.ACCESS_NETWORK_STATE');
    expect(permissions).toContain('android.permission.INTERNET');
  });

  /* Reminders ring on the minute only with an exact-alarm permission: Android 13+ grants USE_EXACT_ALARM at install,
     Android 12/12L SCHEDULE_EXACT_ALARM (capped there, so 14+ never shows an "Alarms & reminders" switch that would
     be off by default). The plugin's own manifest brings POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED. */
  it('can set exact alarms, so a reminder rings on the minute (Android 12 and 13+)', () => {
    expect(permissions).toContain('android.permission.USE_EXACT_ALARM');
    expect(manifest).toMatch(/android\.permission\.SCHEDULE_EXACT_ALARM"\s+android:maxSdkVersion="32"/);
  });
});
