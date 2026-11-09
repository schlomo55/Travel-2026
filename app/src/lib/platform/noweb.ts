/* THE BROWSER HALF OF A CAPACITOR PLUGIN, WHICH THIS APP NEVER CALLS (10 Nov 2026).
   vite.config.ts (nativeOnlyPlugins) resolves each used plugin's `./web` here instead of its own web.js: every call
   into App, AppLauncher, Filesystem, LocalNotifications and Share is behind `isNative()`, so the browser halves were
   shipped and never run. Should a web path ever call one anyway, Capacitor finds no such method on this empty class
   and rejects the call with its own "not implemented on web" (UNIMPLEMENTED) error — the way a plugin without a web
   half always answers there. */
class NoWeb {}
export { NoWeb as AppWeb, NoWeb as AppLauncherWeb, NoWeb as FilesystemWeb, NoWeb as LocalNotificationsWeb, NoWeb as ShareWeb };
