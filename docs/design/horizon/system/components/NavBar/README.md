# NavBar

The floating bar that holds the app's three places — Now, Journey, Pocket — with the round Find button beside it.

## Anatomy

- Bar: 64px tall, `sky-2`, `line` edge, `shadow-float`, 32px radius, 16px from the screen's left and bottom, leaving room on the right for Find.
- Items: a 22px stroke icon over an 11px label, `ink-2`; the current place is `sunrise`, semibold, with a 4px `sunrise-fill` dot under the label.
- Icons: a sun (Now), two dots joined by a curve (Journey), a pouch (Pocket), a magnifier (Find).
- Find: a 52px circle on `card-2` with an `edge` outline and `shadow-float`, labelled "Find anything".
- Behind the bar sits the `horizon-glow` and, on map screens, the ridges.

## Rules

- Shown on every screen except the full-screen modes (Counter mode, the driver card, the guide at full height).
- The current item carries `aria-current="page"`; each item is a real link; focus ring `sunrise`.
- Never more than three places. Lists live inside Now (To do) and Pocket (packing).
