/* THE THEME — there is one, and it is the night (Horizon Run 4).

   The owner removed Daylight on 2026-09-28 ("we dont need Daylight" … "remove
   it"): the night sky is the app. There is nothing to choose, store or apply
   any more — no `data-theme` attribute, no boot script, no mirror in
   localStorage — so a cold boot paints the one palette app.css declares on
   :root, with nothing to wait for and nothing that could flash.

   An older install may still hold the choice it made: `theme: 'light'` in its
   settings record, and 'light' under the localStorage key its boot script
   read. Nothing reads either any more; both are simply ignored, and the app
   is dark.

   What is left is the colour the OS chrome paints: the status bar and the task
   switcher take the sky itself, because every Horizon screen paints its top
   edge with it. index.html's theme-color meta and the web manifest
   (vite.config.ts) carry it, and theme.test.ts proves all three agree with
   app.css's --sky. */

/** The night sky — app.css `--sky` — and what the OS chrome paints. */
export const THEME_COLOR = '#0b0c16';

/** The key an older install's boot script read ('light' for a Daylight
    user). Nothing reads it now — theme.test.ts proves it, and the rehearsal
    boots with it set to 'light' and finds the night. */
export const LEGACY_THEME_KEY = 'ltd:theme';
