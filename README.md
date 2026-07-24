# China 2026 — trip companion

Personal, single-user offline trip app for the China trip **21 Nov – 27 Dec 2026**.
Traveller: SALOMON CHALOM COHEN, French passport (the only passport used for China).

Private repo. It contains passport, ticket and gift-card numbers — **never make it public.**

## Layout

```
china-2026/
├── app/                          the PWA — this is what gets deployed
│   ├── index.html                the whole app: CSS + data + logic, all inline
│   ├── sw.js                     service worker (precaches everything for offline)
│   ├── manifest.webmanifest      install metadata
│   ├── icon-*.png                app icons (中国 2026 seal)
│   └── China-2026-Flights.pdf    the official flight manifest, cached offline
│
├── china-2026-trip-guide-v12.html   SOURCE — master itinerary (do not edit casually)
├── china-2026-handoff-prompt.md     SOURCE — planning state, next actions
├── insurance-quotes-comparison.md   SOURCE — Harel vs Phoenix
├── china-app-prompt.md              SOURCE — the app spec
└── China-2026-Flights.pdf           SOURCE — confirmed flights (authoritative for codes)
```

The app has **no dependencies and no build step**. `app/index.html` is a single self-contained
file — open it, edit it, done. Nothing is fetched from any external host at any time, which is
the point: Google and most CDNs are blocked in mainland China.

## The five tabs

| Tab | What it is for |
|---|---|
| 🏠 **Today** | Date-aware home. Countdown before the trip; during it: day N, today's plan, tonight's bed, next flight, next deadline. On the six hard travel days it shows a step-by-step runbook. |
| 📅 **Itinerary** | All 10 stops, expandable, with day-by-day detail and the researched recommendations. Auto-opens the stop you are in. |
| 🎫 **Wallet** | Boarding-pass cards with confirmation codes in huge tap-to-copy type, passport, gift card, insurance, hotels (booked vs pending). Second segment: the spending tracker. |
| ✅ **Tasks** | Merged action list (handoff + guide) with deadlines, the packing list, the before-you-fly app checklist, and the alarms to put in your phone calendar. |
| ⚠️ **Key info** | Visa clock, gotchas, emergency numbers, and full-screen Chinese address cards to show taxi drivers. |

## Deploy (Cloudflare Pages, free, keeps this repo private)

1. Go to **dash.cloudflare.com** → Workers & Pages → Create → Pages → **Upload assets**.
2. Name it (e.g. `china-2026`) and drag in the **contents of the `app/` folder**
   (index.html at the top level, not the folder itself).
3. Deploy. You get an HTTPS URL like `https://china-2026.pages.dev`.
4. To update later: edit `app/index.html`, bump `VERSION` in `app/sw.js`, re-upload the folder.

Direct upload means Cloudflare never connects to GitHub, so the repo stays private with nothing shared.

## Install on the phone

1. Open the URL in **Chrome on the S23 Ultra**.
2. Menu (⋮) → **Add to Home screen** → Install. It gets the 中国 2026 icon and runs fullscreen.
3. Open it once fully — visit every tab, and tap "Open the PDF" once so the manifest caches.
   The Wallet tab will then say **✓ Cached offline**.
4. **Test in airplane mode before the trip.** Turn on airplane mode, kill the app, reopen it.
   Everything must render. If it does, it will work in China.

The only things that need a network are the "📧 Find email" buttons (Gmail) and the booking
links. Inside mainland China those need NordVPN on an obfuscated protocol; everything else
works with no signal at all. No VPN needed in Hong Kong.

## Data lives on the device

Ticks, notes, expenses and the gift-card balance are in `localStorage`. They are **not** synced
anywhere. Use **Key info → Backup everything** to copy a restore blob somewhere safe
(a note to yourself, an email) — especially before and during the trip.

Expense backups from the old trip-guide artifact import too: paste one into Restore.

## Previewing another day

Append `?d=YYYY-MM-DD` to the URL to see the app as it will look on that date, e.g.
`…/index.html?d=2026-12-11` shows the Zhangjiajie travel-day runbook. Useful for checking
a day before you live it.

## Updating the trip data

Everything renders from one `DATA` object near the top of the `<script>` in `app/index.html`
— bookings, hotels, tasks, alarms, day plans, phrases. To record a booking, edit that object
(and bump `VERSION` in `sw.js` so installed copies pick up the change).

Items tagged `vfy:1` in the data (shown as **verify** in the UI) are general knowledge added
for convenience — mostly Chinese airport/station names and consulate numbers. They are not
from the trip documents; check them once before flying.
