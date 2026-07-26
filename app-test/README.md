# `app-test/` — Israel TEST edition

A **deployable, self-contained copy of the trip app filled with invented data**, so the real
thing can be rehearsed on the real phone, on dates that are happening *right now*.

- Sample trip: **25 Jul → 22 Sep 2026**, 60 days, 8 stops, Israel.
- Sample permit: 60 days, entry 25 Jul, planned exit 22 Sep (day 59), deadline 23 Sep 24:00.
- Everything in it — flights, codes, prices, beds, tasks, addresses, the traveler — is **fiction**.

## Why it exists

The real app (`../legacy/`) is for a trip in **November–December 2026**. Every date-aware
mechanism in it — the status pill, the day-N counter, the you-are-here auto-open, tonight's bed,
the TONIGHT pill, overdue red flags, runbook go-live, TODAY/flown ticket pills, the mid→post-trip
transition, the midnight rollover — only proves itself on a live date. Waiting until November to
discover a bug is the wrong order.

This edition runs the **same code paths** against dates that are live today, so a real
install-and-walk-around rehearsal exercises them for real, offline, on the phone.

## Isolation guarantees

Nothing here can reach the real app, and nothing from the real app can reach here:

| Boundary | Real app | This edition |
|---|---|---|
| localStorage namespace | `china2026.` | **`iltest.`** |
| Backup blob tag | `app:'china2026'` | **`app:'iltest'`** — the importer accepts only this tag |
| Service-worker cache | `china2026-v1.1.0` | **`iltest-v1.0.0`** |
| SW scope | `/legacy/` (or its own site) | **its own directory** — see deployment below |
| Calendar UIDs | `china2026-…@trip.local` | **`iltest-…@trip.local`**, summaries prefixed `[TEST]` |
| Download filenames | `china-2026-*` | **`israel-test-*`** |
| Manifest identity | `中国 2026` | **`TEST — Israel 60`** / `IL TEST` |
| Icons | red/lacquer | **teal "IL TEST"** — four distinct PNGs |

Because a service worker's scope is its own directory, serving this folder anywhere other than
`legacy/`'s own path means the two never share a cache, a controller, or an update cycle.

## Unmistakable on sight

- A **fixed banner above the app bar on every screen**: `🧪 TEST EDITION — sample data, not a real trip`.
- The whole red/lacquer accent family is swapped for **teal/blue**; the browser theme colour is teal.
- Brand reads `ישראל TEST`, page title `ישראל TEST`, home-screen name `IL TEST`.
- The one warm colour left is the alarm colour (`--crit`) — deliberately, so overdue flags and the
  permit-critical cards still *look* like alarms rather than like the brand.

## No real personal data — by construction

- No passport or document number: the traveler card reads `SAMPLE TRAVELER` / `⏳ SAMPLE`.
- No real PNRs, ticket numbers, booking references, voucher numbers or balances. Codes are
  `TST123`, `SAMPLE9`, `RAILTST`, `PERMIT-SAMPLE-60`, `SAMPLE-VOUCHER-0000`.
- No flight-manifest PDF (the card is gone and the file is not in the service worker's optional list).
- Every carrier, hotel, address and price says *sample* somewhere on the card.

If you ever add data here, keep it that way. This folder must survive a grep for any real
booking code, ticket number or document number without a single hit.

## Deploying it side by side

Two options, both giving this edition **its own service-worker scope**:

**A. Its own Cloudflare Pages project (cleanest).**
1. New Pages project → connect the same repo.
2. Build command: none. **Build output directory: `app-test`.**
3. Deploy. It gets its own `*.pages.dev` hostname, so it is a completely separate origin: separate
   SW registration, separate cache storage, separate localStorage. Nothing can collide.

**B. A subdirectory of the existing site.**
Publish the repo root (or copy `app-test/` into the existing site's output) so the app is reachable
at `https://<your-site>/app-test/`. The service worker registers with `sw.js` relative to that
directory, so its scope is `/app-test/` and the real app's scope stays `/` (or `/legacy/`). Same
origin, so localStorage *is* shared between them — which is exactly why the namespace is `iltest.`
rather than `china2026.`, and why the backup blobs carry different app tags.

Option A is preferred for the rehearsal, because it also proves the install flow end to end
(two separate icons on the home screen, two separate PWAs).

### Installing on the phone
Open the URL in Chrome → menu → *Add to home screen*. You should end up with a **teal `IL TEST`
icon** next to the real one. If a change doesn't seem to install, it is almost always the service
worker still serving the old cached page: open the app, wait for the *Update ready* toast and tap
it, or clear the site data for that origin.

## What to exercise during the rehearsal

Open it offline (airplane mode) and check:

1. **Today** — day counter, permit day, tonight's bed, the 🚕 driver card, the overdue card.
2. **Runbooks** — preview `?d=2026-07-29`, `?d=2026-08-05`, `?d=2026-08-12`, `?d=2026-09-22`.
3. **Itinerary** — the current stop auto-opens with *you are here*.
4. **Wallet** — Tickets (a faded flown leg, a `TODAY` leg), Beds (`TONIGHT` / `done` / `⏳ pending` /
   `✋ walk-in`), Spending (add an entry in ₪, delete it, hit UNDO).
5. **Tasks** — red overdue flags, tick something, check the nav badge counts down.
6. **Key info** — Hebrew driver cards render right-to-left in both the list and the full-screen
   overlay; copy a line; the permit clock.
7. **Backup** — copy the blob, restore it, hit UNDO. Then try to import it into the real app: it
   **must** be rejected.
8. **Rollover** — leave it open past local midnight, or background it overnight and reopen.

Any date can be previewed with `?d=YYYY-MM-DD`.

## The rule

> **This folder is never merged into `legacy/`.**

It is a parallel edition, not a branch of the real app. Fixes discovered here get applied to
`legacy/index.html` by hand, deliberately, one at a time — never by copying files across. The two
apps share a shape, not a lineage, and the whole point of the isolation above is that they can
never be mistaken for each other.
