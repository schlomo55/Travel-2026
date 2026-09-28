# RouteLine

A leg of the trip drawn on the map, whose motion always means one thing: Flow is live, Comet is moving through time, Ink is done, Relay is a check.

## The four motions

| Motion | Job | Plays | Drawing | Timing |
| --- | --- | --- | --- | --- |
| Flow | live | always on today's leg, the only loop | gradient `route-lit` → `route-today` → `route-future`, dashes `7 7` streaming in the travel direction | `duration-flow`, `ease-linear` |
| Comet | through time | once: replaying the trip, tapping a leg | a short bright head in `route-lit` travels the leg; the end star flashes | `duration-comet`, `ease-out` |
| Ink | done | once: a leg or a day is finished (and the road so far on the first open of a day) | the leg paints itself in `route-lit` with a soft under-stroke, then stays painted | `duration-ink` |
| Relay | check | once: opening Journey | stops light in order — `ok` booked, pause on `warn` for a leg not booked, `crit` for a missing bed — ending on a count | runs once; the demo loops every `duration-relay-demo` |

Legs still ahead are dotted `route-future`; stops are `star`, drawn only where the trip file stores real coordinates.

## Rules

- One looping route (Flow) plus at most one one-shot at a time. Never two one-shots together.
- Only `stroke-dashoffset`, `opacity` and `transform` animate; nothing moves while the app is hidden.
- Calm motion and reduce-motion show the end state: Flow = a solid line with an arrow, Comet = the leg and its end lit, Ink = painted, Relay = the final colours and the count. The preview draws the end state by default and adds motion only when the viewer allows it.
- Labels (names, times, codes) never move.
