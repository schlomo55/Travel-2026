# StatusChip

A small pill that states whether something is booked, still to book, missing, or only planned — always as a word and a colour.

## States

| State | Text | Ground | Border | Used for |
| --- | --- | --- | --- | --- |
| Booked | `ok-ink` | `ok-soft` | `ok-line` | a booking that exists (CA 8609, Pullman) |
| Not booked | `warn-ink` | `warn-soft` | `warn-line`, dashed | a leg or ticket still to buy (the train Taizicheng → Qinghe) |
| Missing | `crit-ink` | `crit-soft` | `crit-line` | a night with no bed at all, a hard deadline |
| Planned | `lilac-ink` | `lilac-soft` | `lilac-line` | an idea or a day still ahead |

## Rules

- 26px tall, `radius-pill`, `chip` type (12px, 600), a 13px icon before the word.
- The word is required: colour never carries the status alone. The four states also differ in lightness.
- "Part booked" (a move with one leg booked and one not) uses the Not booked style with the words "Part booked".
- Never invent a status: it is computed from the bookings, never typed.
