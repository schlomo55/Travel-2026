# Button

A pill-shaped control in three kinds: the one primary sunrise action per screen, quiet secondary actions, and round icon buttons such as Find.

## Kinds

- **Primary** — `sunrise-fill` ground, `on-sunrise` text, `glow-sunrise` underneath, 52px tall, `radius-pill`, `label` type at 15px. At most one per screen, for the thing you came to do ("Show code", "Continue the trip").
- **Secondary** — `card-2` ground, `ink` text, 1px `edge` outline, 48px tall ("Open in maps", "Copy", "Find email").
- **Icon** — 52 × 52 circle, `card-2`, `edge` outline, `shadow-float` when it floats over the map (the Find button beside the nav). Always has an `aria-label`.

## Rules

- Minimum target 44 × 44px; the focus ring is 2px `sunrise`, offset 3px.
- Text says exactly what happens. No "OK", no "Submit".
- In Counter mode and on the driver card the only button is Close, drawn on `counter-paper` with `counter-ink`.
- Icons: stroke 1.8, `currentColor`, 20px inside the button.
