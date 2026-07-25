# Living the dream — what it is, in one page

*The short version. For **why** it exists see [ABOUT.md](ABOUT.md); for **how to use** every screen
see [README.md](README.md); for **how it is built** see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).*

---

## What it is

A travel app that lives entirely on your phone.

It holds one trip — China 2026 today, any trip after it — and answers the questions you actually
have while travelling: *what am I doing today, where do I sleep tonight, what is my flight
reference, how many days of my visa are left, how do I tell this taxi driver where to go, what does
this city cost, what else could I do here.*

It has no account, no server and no cloud. Nothing you put in it is uploaded anywhere.

## What it is for

Planning documents are good for **deciding** and useless for **doing**. A 1,700-line trip guide
cannot help you at a check-in desk in Chongqing at six in the evening, tired, with no signal, being
asked for a booking reference.

Three facts about this trip drove every design decision:

- **The internet is hostile where you are going.** Mainland China blocks Google and most of the
  services a normal app assumes. So the app assumes none of them.
- **A number can end the trip.** The visa allows 30 days and the exit is planned for day 29. That
  clock is pinned to the top of every screen, because it is the one thing you cannot lose track of.
- **The old version leaked.** Its first incarnation had the passport number, every booking code and
  a gift-card number sitting inside a web page. This one cannot, by construction.

## How it works

**Everything is on the phone.** The app is installed as a real Android app; all its files live
inside the app package. Your trip lives in the phone's own database. Turn on airplane mode, kill
the app, reopen it — every screen still works. That is tested automatically before every release,
and by you on the actual phone before you fly.

**The app ships empty; your trip arrives as a file.** The installable app contains no passport
number, no booking codes, no addresses — nothing personal. The trip is a separate file you import
once. A build check greps every built file for your personal data and *fails the build* if any of
it appears.

**Facts come from your documents, never from invention.** Every booking, date and price traces
back to the original guide, the handoff notes or the flight PDF. Where something is unconfirmed it
says so — the academy address still reads *pending*, insurance still reads *not bought*. Anything
researched rather than documented carries a *verify* flag.

**Five tabs, one job each.**

| | |
|---|---|
| 🏠 **Today** | The date decides what you see: a countdown before the trip, and during it — day N, today's plan, tonight's bed, the next flight, the next deadline. On the six hard travel days a tickable runbook replaces prose. |
| 🗺 **Plan** | The route, then each city as a photo card. Open one and you get its guide: how you arrive and what it costs, the story, each day tappable, and every option researched for that city. |
| 🎫 **Wallet** | What you hold up at a counter. Confirmation codes in the biggest type in the app, tap to copy. Plus your beds, your cards, the money tracker and your files. |
| ✅ **Tasks** | Deadlines with their reasons, packing, checklists, and the timed moments you export to the phone's calendar. |
| ℹ️ **Info** | The visa clock, clocks in three time zones, the cards you show a driver in Chinese, emergency numbers, and every gotcha worth knowing. |

**The parts that touch the outside world, and their limits.**

- **Maps.** One button per place. It hands a place *name* to a map app — Amap in the mainland,
  Google in Hong Kong, chosen automatically because each is better where it is. Nothing is fetched
  by the app itself. Roughly one place in seven could not be verified and therefore has **no
  button at all**: a wrong pin is worse than none.
- **Addresses.** Where a place has one, it shows full screen in Chinese so you can simply hand the
  phone to a driver.
- **Weather.** The only thing that talks to the internet. When you are online it quietly fetches a
  forecast for the city you are in and the next one, and caches it. Offline it shows the last one
  it saved, with its date. It can be switched off entirely.

**Nothing is trusted until it is proven.** Before every release the app runs its own tests, a parity
audit that re-checks every critical value against the original documents, a privacy gate, and a
scripted dress rehearsal that walks a headless browser through every screen and every difficult day
with the network hard off. Map links were tested by firing them at the real phone and looking at
what actually opened — which is how three silent failures were found and fixed.

**Backups are your responsibility, and the app nags.** Phone storage can be cleared. One tap saves
everything to a file, documents included; mail it to yourself. The app reminds you when your
changes have outlived your last backup, because there is no second copy anywhere else.

## What it deliberately does not do

No account, no sync, no journal, no analytics, no ads, no notifications from a server. No feature
that needs a signal to work. If a thing cannot survive airplane mode in Chongqing, it does not go in.
