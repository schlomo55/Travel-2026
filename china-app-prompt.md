# BUILD MY PERSONAL CHINA TRIP APP — PWA for Samsung S23 Ultra

## What you are building

A **personal, single-user trip companion app** for my China trip (Nov 21 – Dec 27, 2026). It is for ME ONLY — no accounts, no backend, no other users. It must feel like a polished native Android app on my **Samsung S23 Ultra** and work **100% offline inside China** (Google, Gmail web, and most CDNs are blocked there — the app must never depend on the network to render).

**Tech (fixed — do not substitute):**
- **PWA**: `index.html` (ALL CSS and JS inline, zero external dependencies, no frameworks, no CDN links), plus `manifest.webmanifest`, `sw.js` (service worker that precaches everything for full offline use), and a generated app icon (inline SVG → PNG, dark background, "中国 2026" or 🇨🇳 motif).
- Vanilla JavaScript only. `localStorage` for persistence (checklist state, notes).
- After building, give me one-paragraph instructions: deploy to GitHub Pages (or any free HTTPS host), open in Chrome on the S23 Ultra, **Add to Home Screen**, then test in **airplane mode** BEFORE the trip to confirm the cache works.

## Source of truth — READ THESE FIRST

Both files are in this folder (`C:\Source\China`):
1. `china-2026-trip-guide-v12.html` — the master trip guide: full day-by-day route, all bookings, budget, packing list, per-city recommendations, links. **All itinerary content comes from here.** Do not invent or alter any plan detail.
2. `china-2026-handoff-prompt.md` — current planning state: what's booked, what's pending (NEXT ACTIONS), key gotchas, open decisions.

If anything in the two files conflicts, ask me. **Never invent bookings** — anything not yet booked is shown as "⏳ pending" with its booking link from the guide.

## Critical data (must be in the app, verbatim)

- **Traveler:** SALOMON CHALOM COHEN, FRENCH passport **[redacted]** (the only passport used for China — never the Israeli one).
- **Etihad open-jaw, PNR `8CR7MR`** — OUT: TLV 14:00 Nov 21 → PKX 08:45 Nov 22 (EY608 + EY888 via Abu Dhabi). BACK: HKG 19:35 Dec 26 → TLV 04:35 Dec 27 (EY871 + EY609). Economy Deluxe, 40 kg.
- **Air China CA1953**, Dec 11, PEK T3 17:00 → Zhangjiajie 19:40 — Trip.com `1653716183770225`.
- **Sichuan Airlines**, Dec 16, CKG T3 20:20 → Lijiang 22:00 — Trip.com `1653716249124273`, PIN `2786`.
- **China Eastern MU733 (Business)**, Dec 21, Kunming 13:50 → HKG 16:05 — Trip.com `1653716248615345`, airline ref `MZ904B`.
- **Kunyu Academy** Nov 22 – Dec 5, deposit paid.
- **Trip.com gift card** `2870 6769 9755`, ~$297.70 remaining, valid to 2029-07-23 — earmarked for mainland hotels.
- ⚠️ All 3 domestic flights: **20 kg** checked-bag cap (vs Etihad 40 kg).
- ⚠️ **Visa math:** French 30-day visa-free; count starts the day AFTER entry → entry Nov 22 = legal deadline **Dec 22 24:00**; planned exit to HK Dec 21 = day 29.

## App structure (bottom tab bar, 5 tabs)

1. **🏠 Today** (home) — date-aware. Before the trip: countdown to Nov 21 + the next pending deadline from the task list. During the trip: "Day N of 36", current city, tonight's accommodation, next transport leg with time/terminal, and that day's plan pulled from the guide. After Dec 27: trip-complete summary.
2. **📅 Itinerary** — the full route stop-by-stop (Kunyu/Yantai → Beijing → Chongli → Zhangjiajie → Chongqing → Lijiang → Tiger Leaping Gorge → Dali → Kunming → Hong Kong), each stop expandable to its day-by-day detail, exactly as in the guide HTML. Include the per-city recommendations.
3. **🎫 Wallet** — every booking as a card I can show at a counter: airline, flight number, date/time, terminal, confirmation code in **huge type**, one-tap **copy to clipboard**, and a **Gmail deep link** (see below). Also: passport details card, gift-card card with balance, hotel cards (booked vs ⏳ pending with booking link).
4. **✅ Tasks** — interactive checklists with persisted checkbox state: (a) the NEXT ACTIONS list from the handoff file, each with its deadline and any relevant link, sorted by due date, with overdue/upcoming highlighting; (b) the packing list from the guide, with the 20 kg warning pinned on top; (c) pre-flight apps list (Alipay, WeChat Pay, eSIM, CDAC…, and **NordVPN** — my VPN: it must be installed, logged in, and set to an **obfuscated protocol (NordWhisper)** with a few servers favorited BEFORE landing in China, since nordvpn.com is blocked there).
5. **⚠️ Key info** — the gotchas, always one tap away: visa day-count with the Dec 22 deadline, CDAC reminder, 20 kg rule, Kunyu no-Sunday-pickup + taxi info, evening-flight note for Dec 16, emergency numbers (110/120), and a big-type section of **addresses in Chinese** to show taxi drivers (pull every Chinese-language address/name available in the guide).

## Gmail links (important feature)

For each booking card, a "📧 Find email" button that opens the Gmail app searching for that booking's confirmation. Use `https://mail.google.com/mail/u/0/#search/<query>` URLs (on Android these open the Gmail app via app-links). Queries: `8CR7MR`, each Trip.com booking number, `Kunyu`, and each hotel's name once booked. Note in the UI (small print) that in mainland China these only work with **NordVPN connected** — everything else in the app works offline. (No VPN needed in Hong Kong.)

## UX requirements — this must feel amazing

- Designed for the S23 Ultra: ~412 dp wide viewport, tall screen, big thumb-friendly touch targets, bottom navigation reachable one-handed, generous type sizes (confirmation codes readable at arm's length).
- **Dark theme by default** (battery + night use), tasteful China-trip accent palette; smooth but subtle transitions; no clutter — every screen answers "what do I need right now?".
- Instant load, zero network requests after install. Test target: everything renders in airplane mode.
- Copy-to-clipboard on every code/number with a brief "Copied ✓" toast.
- A small "last updated" stamp in a footer, so I know which version is installed.

## Working style

- Build it fully, then walk me through install on the phone.
- If any content in the source files is ambiguous or missing, **ask — don't assume or invent.**
- Keep everything on the French passport name. Never surface the Israeli passport in the app.
