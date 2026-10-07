# Roadmap

Ranked by value to members aged 40-65 in a small, trust-based community, against effort and risk.

## Built on the `improvements/2026-10-04` branch

| # | Feature | Why it ranked high |
|---|---|---|
| 1 | Safety: separate Block (with Undo) and Report (with reasons) on every profile and chat; Safety Centre; private scam reminders in chat; admin report queue | Romance scams target this age group; reports previously reached nobody |
| 2 | Readability: larger text, text-size setting, AA contrast, labelled navigation, dark/light choice | Affects every screen, every visit |
| 3 | Chat: typing indicator, "Seen", drafts, failed-send retry | Chat is the heart of the app; lost or doubted messages destroy trust |
| 4 | Conversation starters from shared interests | The blank first message is where most matches stall |
| 5 | Welcome tour and Help page | Reduces "how do I..." emails to volunteers |
| 6 | Events: add to calendar, who's going, lift / meet-up notes | Events are where the community actually meets; lifts matter when driving is harder |
| 7 | Privacy controls: pause profile, online status, read receipts | Control is what makes people comfortable staying |
| 8 | Saved profiles | A low-pressure way to keep track without liking |
| 9 | Quiet hours | Asked for by anyone who keeps a phone by the bed |
| 10 | Email summary (opt-in; job exists, not scheduled) | Brings back members who do not open the app daily |
| 11 | Installable app (manifest, icons, offline page) | "Tap the icon" beats "type the address" |

## Built in round 2 (2026-10-05)

| Feature | Notes |
|---|---|
| Profile-completeness helper with examples | "Your profile is 60% complete", next three suggestions with plain reasons, tappable example answers written for this age group; seen only by the member |
| Photo tips and simple cropping | Tips, then a frame the shape of a profile card: move (drag or buttons), zoom, or "Use the whole picture". My Profile only - not yet in onboarding |
| In-app event reminders | The day before and on the day, once each; no scheduler needed |
| Keyboard access for clickable cards and chips | Notifications, event cards, photo tiles, profile chips |
| Notifications read one at a time; Delete with Undo; real times | |

**Interest groups / tags: not built, on purpose.** Members' free-text interests already work as tags - Browse can now filter on any interest members actually have. Named groups ("Gardeners", "New members") with their own pages would be new shared spaces, and those need the moderation plan the roadmap already asked for.

**"Not for me" in Browse: not built, on purpose.** The server can hide a profile, but there is no screen to bring a hidden member back, so one mis-tap would hide someone for good. It needs a "Hidden profiles" list first.

## Next (not built)

| # | Feature | Notes |
|---|---|---|
| 1 | Finish the "Not verified" half of the function inventory | Onboarding fields, profile editor, Browse filters, admin buttons need browser tests |
| 2 | Fix the seven "Still broken" items | Listed in `docs/FUNCTION-INVENTORY.md` |
| 3 | Profile-completeness helper with examples | "Your profile is 60% complete - add a photo" with sample answers; not started |
| 4 | Photo tips and simple cropping | Upload works; tips and a square-crop step would help; not started |
| 5 | Event reminders | The calendar file carries reminders; in-app / email reminders the day before are not built |
| 6 | Interest tags / community groups | E.g. "Gardeners", "New members"; needs a moderation plan first |
| 7 | Keyboard access for clickable cards | Notifications, event cards, photo tiles, profile badges |
| 8 | Verified-member badge | Needs a real check of the LPA membership number with LPA |
| 9 | Push notifications | The service worker is in place; needs VAPID keys and member consent |
| 10 | Pass / "not for me" in Browse | The server supports it; the screen does not offer it |

## Decided against, for now

- **Read-aloud / voice messages** - large effort, unclear demand.
- **Automatic scam blocking** - reminders are private and never block; blocking on patterns would silence innocent messages ("I gave my niece a gift card").
- **Location-based distance** - the previous "distance" was a random number and was removed; real distance needs location consent and adds little within one district.
