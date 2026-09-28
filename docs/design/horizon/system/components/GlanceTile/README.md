# GlanceTile

A tile in the rail under the map on Now that answers one question at a glance and opens its full screen when tapped.

## The rail on Now

NEXT · TONIGHT · VISA · DRIVER CARD · TO DO, scrolling sideways, `space-3` apart, over `sky-2`. There is no NOW tile: the one plain sentence above the rail is the "now".

## Anatomy

- `card` ground, `radius-tile`, `line` edge, `shadow-card`, 16px padding.
- A `caps` label on top (`faint`; `sunrise` on NEXT).
- One live mini-visual: the sun arc (NEXT), a photo or ridge (TONIGHT), a ring (VISA), large Chinese in the `zh` family (DRIVER CARD).
- A `row` line and a `caption` or `time` line.

## NEXT — the one opal tile

- The opal edge (`opal-1` → `opal-4`) and `glow-opal` mark it as the most important thing on the screen. Only one opal edge per screen.
- The sun arc runs from the previous fixed point (12:00 check-out) to the commitment (18:15 take-off); the `sunrise-fill` sun sits at now (13:02); the countdown (`5h 13m`) is `mono`.

## Rules

- Each tile is a real link to its screen (NEXT → the pass, TONIGHT → the city, VISA → its details).
- Values come from the trip file; a tile with nothing to say is not shown.
- Text never below `caption` except the `caps` label.
