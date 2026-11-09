# NavBar

The one solid bar on the bottom edge that holds the app's places — Now, Journey, Map, Pocket — and Find, as five equal items.

## Anatomy

- Bar: full width, anchored to the bottom edge, 56px tall plus the safe-area inset (`--nav-bar-h`), opaque `sky-2`, a 1px `line` hairline on top, no shadow. Nothing scrolls visible through it.
- Items: five equal, at least 48px tall; a 22px stroke icon over a 12px label, `ink-2`; the current place is `sunrise` on a `sunrise-soft` wash, with a 4px `sunrise-fill` dot under the label. Find is the fifth item and is lit the same way while its screen is open.
- Icons: a sun (Now), two dots joined by a curve (Journey), a map (Map), a pouch (Pocket), a magnifier (Find). Find's spoken name is "Find anything".
- Fade: a 20px non-interactive gradient (`sky` to transparent) just above the bar, so content does not end in a hard line. Not on the Map.
- Clearance: `--nav-h` (bar + 8px) is what content, toasts and sticky cards clear, each adding the safe-area inset; `html`'s `scroll-padding-bottom` clears bar + fade.
- Behind the bar sits the `horizon-glow` and, on map screens, the ridges.

## Rules

- Shown on every screen except the full-screen modes (Counter mode, the driver card, the guide at full height).
- The current item carries `aria-current="page"`; each item is a real link; focus ring `sunrise`.
- Never more than five items. Lists live inside Now (To do) and Pocket (packing).
- While a text field has the keyboard up, the bar steps aside.
