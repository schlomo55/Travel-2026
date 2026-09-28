# D · HORIZON — the new look (round 2), exact recipes

Idea: the app's own icon — a sun rising behind mountains — becomes the whole visual system.
Night-indigo sky, one warm SUNRISE accent, an OPAL (iridescent) edge on the few things that matter,
a luminous horizon line, layered mountain silhouettes, and a sun arc that IS the progress indicator
(the sun rises as the day / countdown / trip advances). Solid surfaces (no heavy blur → fast on the phone).

## Fonts (one Google Fonts css2 link, in <helmet>)
`https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700&amp;family=Figtree:ital,wght@0,400..700;1,400..700&amp;family=Martian+Mono:wdth,wght@75..112.5,400..600&amp;display=swap`
- DISPLAY `'Unbounded', ui-sans-serif, sans-serif` — wide geometric; headings, city names, hero numbers. weight 500–600, letter-spacing -0.02em. Never below 18px.
- UI/BODY `'Figtree', ui-sans-serif, system-ui, sans-serif` — everything else; prose 16/1.6.
- NUMBERS/CODES `'Martian Mono', ui-monospace, monospace` + `font-stretch: 87.5%` + `font-variant-numeric: tabular-nums` — times, codes, counts, prices.
- Chinese: `system-ui, 'Noto Sans SC', sans-serif`.
- Caps micro-labels: Figtree 11px/600, letter-spacing 0.14em, uppercase.

## Colour tokens (literal hex inline — never CSS variables)
| token | value | use |
|---|---|---|
| sky (ground) | `#0B0C16` | screen background |
| sky-2 | `#10121F` | chrome: nav bar, sheets |
| card | `#161829` | card surface |
| card-2 | `#1D2035` | raised: chips, inputs, buttons |
| line | `rgba(255,255,255,0.08)` | dividers (decorative) |
| edge | `#6A7099` | interactive outline (≥3:1) |
| ink | `#F4F2FA` | text |
| ink-2 | `#B4B3C8` | secondary text |
| faint | `#8E8DA6` | tertiary text / captions (still ≥4.5:1 on card) |
| sunrise | `#FF9F6B` | THE accent: primary actions, active nav, the NOW marker, key numbers |
| on-sunrise | `#1A0F08` | text on a sunrise fill |
| lilac | `#B69CFF` | secondary accent (text-safe), the future / planned |
| ok | `#6FE3A5` | booked |
| warn | `#FFC46B` | pending / not booked (amber) |
| crit | `#FF6B7A` | missing / deadline |
| opal gradient | `linear-gradient(120deg, #FFB38A, #FF7EB6, #B69CFF, #7FE3F0, #FFB38A)` | EDGES + the sun arc only — never a fill behind text |

Status chips: `height:26px; padding:0 10px; border-radius:999px; font:600 12px Figtree; display:inline-flex; align-items:center; gap:6px;`
- ok: `color:#8FF0BC; background:rgba(111,227,165,0.12); border:1px solid rgba(111,227,165,0.34);`
- warn: `color:#FFD08A; background:rgba(255,196,107,0.12); border:1px solid rgba(255,196,107,0.38);`
- crit: `color:#FF95A0; background:rgba(255,107,122,0.12); border:1px solid rgba(255,107,122,0.38);`

## Signature recipes
- **Sky**: root `background:#0B0C16` + a low sunrise glow at the BOTTOM of the screen (behind the nav):
  `<div aria-hidden="true" style="position:absolute; left:-20%; right:-20%; bottom:-180px; height:420px; border-radius:50%; background: radial-gradient(closest-side, rgba(255,159,107,0.30), rgba(255,126,182,0.10) 55%, rgba(11,12,22,0) 100%); pointer-events:none;"></div>`
- **Mountains** (decorative, above the glow, below content): 2–3 layered SVG ridgelines, fills `#12142A` / `#171A31` / `#1D2038`, a 1px top stroke `rgba(255,179,138,0.25)` on the front ridge. Keep them low (≤140px) at the screen bottom or under a hero.
- **Horizon line**: `height:1px; background: linear-gradient(90deg, rgba(255,179,138,0), rgba(255,179,138,0.7), rgba(182,156,255,0.7), rgba(127,227,240,0));`
- **Sun arc (progress)**: SVG semicircle track `stroke:rgba(255,255,255,0.10)` + progress arc stroked with an SVG linearGradient (#FFB38A → #FF7EB6 → #B69CFF), `stroke-linecap:round`, and a small sun disc (`fill:#FF9F6B`, glow `filter: drop-shadow(0 0 10px rgba(255,159,107,0.9))`) sitting at the progress point.
- **Opal edge** (only the ONE most important card per screen): `border:1px solid transparent; background: linear-gradient(#161829,#161829) padding-box, linear-gradient(120deg,#FFB38A,#FF7EB6,#B69CFF,#7FE3F0,#FFB38A) border-box; background-size: 100% 100%, 300% 300%; animation: opal 9s linear infinite;` with `@keyframes opal{0%{background-position:0 0,0% 50%}100%{background-position:0 0,100% 50%}}` in helmet. Add `box-shadow: 0 30px 60px -30px rgba(0,0,0,0.8), 0 0 50px -20px rgba(255,126,182,0.35);`
- **Card**: `background:#161829; border:1px solid rgba(255,255,255,0.07); border-radius:28px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);`
- **Primary button**: `height:52px; border-radius:999px; background:#FF9F6B; color:#1A0F08; font:600 15px Figtree; border:none; box-shadow:0 12px 30px -12px rgba(255,159,107,0.8);`
- **Secondary button**: `height:48px; border-radius:999px; background:#1D2035; color:#F4F2FA; border:1px solid #6A7099; font:600 14px Figtree;`
- **Icon button**: 44×44 circle, `background:#1D2035; border:1px solid rgba(255,255,255,0.10); color:#F4F2FA`.
- **Photos**: large, `border-radius:32px`, bottom scrim `linear-gradient(180deg, rgba(11,12,22,0) 40%, rgba(11,12,22,0.92) 100%)`; a thin horizon line under the photo's title.
- Icons: inline stroke SVG (Lucide geometry), `stroke-width:1.8`, `currentColor`. No emoji.

## Navigation (round 2 — the new information architecture)
Three destinations + search, everywhere (a structure may present them differently):
- **Now** (sun icon: circle + rays) · **Journey** (route icon: two dots joined by a curve) · **Pocket** (wallet/pouch icon)
- **Find** (magnifier) — a round 52px button beside the nav, or a search field on top.
Default nav recipe: floating bar `left:16px; right:84px; bottom:16px; height:64px; border-radius:32px; background:#10121F; border:1px solid rgba(255,255,255,0.08); box-shadow:0 20px 40px -12px rgba(0,0,0,0.9);` with 3 equal items (icon 22 + label 11/600); active item: `color:#FF9F6B` + a 4px sun dot under the label with glow. Search button: 52×52 circle at `right:16px; bottom:22px`, `background:#1D2035; border:1px solid #6A7099`.

## Motion (helmet keyframes; always add `@media (prefers-reduced-motion: reduce){*{animation:none !important}}`)
- `opal` edge drift (9s linear), `sunrise` (the sun disc pulses its glow 3s), `rise` for a sheet/card entering (translateY(24px)→0, 600ms cubic-bezier(.16,1,.3,1)) — use sparingly.

## Rules
- 44px min targets; real <button>/<a href>; aria-label on icon-only buttons; no fake status bar; no emoji.
- Text contrast ≥4.5:1 (captions use #8E8DA6 or lighter); never text on the opal gradient.
- Booking refs always masked `•••• •••• •••• ••••`.
