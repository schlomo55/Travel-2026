# Pass

The booking pass: the most precious object in Pocket, showing one booking's route, times, warnings, allowances and its masked code, with Counter mode one tap away.

## Anatomy

- `card`, `radius-card`, 20px padding, `shadow-card`.
- Header: `caps` kind (FLIGHT, TRAIN, STAY), the carrier and number in `row`, a StatusChip.
- The route: airport or station codes in `hero-code` (Unbounded 40px), city names in `caption`, an arc between them (`route-lit` origin, dotted `route-future` path) over a `ridge-edge` horizon line. When this booking is your next leg, the arc Flows.
- Times in `mono` (`18:15 → 20:30`) with the date and duration between them.
- Warnings the trip file carries, as an amber note (`warn-soft`, `warn-line`, `warn-ink`): "Departs DAXING (PKX) — not Capital".
- Allowances and changes in a 3-column grid of `caps` labels over `mono` values; a warned value is `warn-ink` (Checked 20 kg).
- A dashed perforation in `line`, then the code strip on `card-2` (`radius-inner`): `caps` "Booking no." over the code in `mono`, `sunrise`, and the Counter mode button.

## Rules

- The code is masked in every image of the app; on the phone it is copied with one tap.
- An unbooked booking is drawn "unlit": dashed `warn-line` edge, no Flow, a Not booked chip.
- Actions under the pass: Counter mode (primary), Find email, Manage, Open in maps (secondary).
