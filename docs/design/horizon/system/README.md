# Horizon

Horizon is the visual system of **Living the dream**, an offline travel app for one traveller on a
37-day trip. Its idea comes from the app's own icon, a sun rising behind mountains: a night-indigo
sky, one warm sunrise accent, layered ridges at the bottom of the screen, a luminous horizon line,
and a sun that climbs an arc as the day, the countdown or the trip moves on.

This system holds the tokens, the rules and reference previews. The app itself is written in
Svelte, so there is no component bundle here: the previews show how each component must look and
behave, and the tokens are the values the app's stylesheet uses.

## Content fundamentals

- **Plain, short English.** The reader is not a native English speaker and reads on a moving
  train. One idea per sentence. Say the next action first: *"Next: the train to Qinghe — not
  booked yet. Be in Qinghe by about 14:30."*
- **Facts are never invented.** Every time, price, place and name comes from the trip file. When
  the file says "verify", the screen shows a `verify` chip. When a place has no stored coordinates
  it gets no map pin ("No pin yet"), never a guessed one.
- **Codes are masked in every image of the app** (`•••• •••• •••• ••••`) and shown in full only on
  the phone. No passport number appears anywhere.
- **Dates and times**: `Fri 11 Dec`, 24-hour times (`18:15`), durations `2h 15m`, approximations
  with `~` and `≈` (`~1 h`, `≈21:30`). Money in the currency paid (`$124`, `¥165`).
- **Chinese beside English.** A place shown to someone else carries its Chinese name
  (`北京大兴国际机场`) set in the `zh` family, with the English line under it.
- **White = for other eyes.** Anything meant for a stranger to read — Counter mode for the airline
  desk, the driver card for a taxi, the driver-card chips in Pocket — is a plain `counter-paper`
  card with `counter-ink` type. Everything else lives on the sky.

## Visual foundations

**Surfaces.** Screens paint `sky`. Chrome that floats (nav, sheets, Find) uses `sky-2`. Cards and
tiles use `card` with `shadow-card`; raised controls on a card use `card-2`. Hairlines use `line`;
the outline of anything you can press uses `edge`.

**One accent.** `sunrise` is the only accent: the active nav item, the NOW marker, the countdown,
the primary button (`sunrise-fill` with `on-sunrise` text and `glow-sunrise`). `lilac` is the
quieter second voice for what is planned and still ahead.

**Opal is an edge, and there is only one.** The opal gradient (`opal-1` → `opal-2` → `opal-3` →
`opal-4` → back to `opal-1`) outlines the ONE most important card on a screen — on Now, the NEXT
tile — plus `glow-opal` around it. It also strokes the sun arc. Opal is never a fill and never
sits behind text.

**Status.** `ok` booked · `warn` not booked or pending · `crit` missing or a deadline · `lilac`
planned. Chips pair `*-ink` text on `*-soft` with a `*-line` border. They differ in lightness as
well as hue, and every chip also carries a word.

**The sun arc** is the progress indicator: a semicircle track in `line`, the progress arc stroked
in opal, and a `sunrise-fill` sun disc at the progress point. The flight countdown uses an arc
from the 12:00 check-out to the 18:15 take-off with the sun at 13:02 and `5h 13m` in the middle.

**The horizon line** is a 1px gradient (peach → lilac → aqua, fading at both ends) under a
photo's title, between days, and as the day/night line of the map.

**Mountains.** Two or three low ridges (`ridge-1`, `ridge-2`, `ridge-3`, front edge `ridge-edge`)
sit at the bottom of a screen over the `horizon-glow`, never behind text.

**Photos** of the real places are large, rounded `radius-photo`, with a bottom scrim from
transparent to `sky` at 92 %.

**Maps.** The home map is a constellation: each stop is a `star` placed from its real stored
latitude and longitude (north up), on a `map-grid` of faint dots and latitude lines. The road so
far is `route-lit`, today's leg runs `route-lit` → `route-today` → `route-future`, legs ahead are
dotted `route-future`. There is no street map and no country outline: the app is offline.

## Typography

| Family | Face | Role |
| --- | --- | --- |
| `display` | Unbounded | headlines, city names, airport codes. Weight 500–600, tracking −0.02em, never below 18px |
| `ui` | Figtree | everything you read: rows, labels, prose at 16/1.6 |
| `mono` | Martian Mono | every number, time, code and price. Always `font-stretch: 87.5%` and `tabular-nums` |
| `zh` | the phone's Chinese font | Chinese place names |

The styles in `tokens.json` are the only sizes. The loudest number on any screen is `countdown`
(28px) or, in Counter mode, `counter-code` (52px). `caps` (11px, 0.14em, uppercase) is for
micro-labels only; a sentence is never smaller than `caption` (13px).

## Layout

- Phone first: 412 points wide (Samsung S23 Ultra). Screen sides keep `space-4` (16px).
- Tiles in the glance rail and the bento sit `space-3` apart; sections `space-6`.
- Radii by role: `radius-pill` for anything pressable and chips, `radius-card` for cards and the
  pass, `radius-tile` for tiles, `radius-photo` for photos and sheet tops, `radius-inner` for a
  panel inside a card.
- Every target is at least 44 × 44px.

## Information architecture

Three places and a search, on every screen except the full-screen modes:

- **Now** — the constellation map with glance tiles; one plain sentence on top tells you what to
  do next. From it: the travel day (a metro line of today's steps, with one big Focus card for the
  current step), an ordinary day (a day line with free time and real picks), and To do.
- **Journey** — Replay the trip (a time scrubber from the first to the last day, the route drawing
  itself, the visa window as a bar) and every stop with its bookings; a city opens its close-up map
  and its guide.
- **Pocket** — everything you show someone or need in one tap, offline: today's code first, then
  passes, driver cards, phrases, documents, visa, emergency numbers and the converter.
- **Find** — searches the phone, no internet. Warnings come first (search "daxing" and the
  Capital-airport warning is the first card).

Full-screen modes, white for other eyes: **Counter mode** (a booking code for a desk agent) and
the **driver card** (a destination in Chinese for a taxi driver).

## Motion

The owner's favourite part of the design is the route animation, so every route motion has one
job, and a moving route always means something.

| Motion | Job | When it plays | Timing |
| --- | --- | --- | --- |
| **Flow** | live | always, on today's leg — the only route that loops | `duration-flow`, `ease-linear`, dashes `7 7` |
| **Comet** | moving through time | once, when you replay the trip or tap a leg; a flash on arrival | `duration-comet`, `ease-out` |
| **Ink** | done | once, when a leg or a day is finished — then it stays painted; also the road so far on the first open of a day | `duration-ink`, stays |
| **Relay** | check | once, when you open Journey: stops light in order, green when booked, pausing amber on a leg not booked, red on a missing bed; ends on a count | runs once (the demo loops every `duration-relay-demo`) |

Rules:

- Flow may loop while one other motion plays once. Never two one-shots together.
- Names, times and codes never move. Only lines, dots and glows do.
- Besides routes, only the you-are-here pulse (`duration-ping`), the sun's glow
  (`duration-sun`) and the opal edge (`duration-opal`) may breathe.
- Only `transform`, `opacity` and `stroke-dashoffset` animate. Leave the app and every motion
  pauses.
- **Calm motion** (a setting) and the phone's reduce-motion jump every motion to its end state:
  Flow becomes a solid line with an arrow, Comet lights the leg and its end, Ink is already
  painted, Relay shows its final colours and the count.

## Iconography

Inline stroke icons on a 24px grid, stroke width 1.8, round caps and joins, `currentColor`. The
nav uses a sun (Now), a route of two dots joined by a curve (Journey) and a pouch (Pocket), plus a
magnifier (Find). No emoji anywhere in the interface.

## Accessibility

- Text is at least 4.5:1 on its ground (3:1 only at 24px and up). `faint` on
  `card` and `sky` still passes.
- Controls are real buttons and links, 44px minimum, with a visible focus ring in `sunrise`.
- Icon-only buttons carry a label. Status is always a word as well as a colour.
- Nothing essential depends on motion.

## Theme

Horizon is dark only: the night sky is the app. There is no light theme (removed by the owner on
28 Sep 2026 — "we don't need Daylight"); the for-other-eyes white (`counter-paper`, `counter-ink`) is the
only bright surface, on purpose.
