# CounterMode

A full-screen, maximum-contrast white screen that shows one booking code to a stranger at a desk — the rule "white = for other eyes" in its purest form.

## Anatomy

- The whole screen is `counter-paper`; text is `counter-ink`, secondary lines `counter-ink-2`. Identical in the dark and the daylight theme.
- The airline and flight in `display` ("AIR CHINA · CA 8609"), the `caps` label "Booking no.", the code in `counter-code` (Martian Mono 52px on the phone, `font-stretch: 87.5%`, `tabular-nums`).
- A quiet band on `counter-paper-2` with the route, date and time.
- One button: Close, `counter-ink` ground, 52px tall.

## Rules

- No nav, no map, no motion, no accent colours: a desk agent must read it in one look.
- Opened from the pass or the TODAY card in Pocket; the phone's brightness goes to maximum while it is shown.
- The driver card follows the same rules: the destination in Chinese as large as fits (`zh` family), the English line under it, the phrase 请带我去这里 "Please take me here", Open in maps and Copy.
- The code is masked in every image of the app.
