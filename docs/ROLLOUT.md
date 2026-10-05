# Rolling this branch out to production

Nothing on this branch touched production. These are the steps and decisions for the owner.

## 0. Do now, whether or not this branch is merged

The repository is **public** and its history contains a production MongoDB connection string (with password) and admin account passwords (see the pull request description for the files).

1. In MongoDB Atlas: change the database user's password, update `MONGODB_URI` in Railway, and review Network Access and recent activity.
2. Change the password of every admin account (and of any account the old `seed.js` created, such as `admin@d8lpa.com` if it exists in production).
3. Rotate `JWT_SECRET` in Railway if it was ever shared the same way. This signs every member out once.
4. Consider making the repository private. Removing the files does not remove them from history.

## 1. Environment (Railway)

No new variable is required. Optional ones:

| Variable | Service | Purpose |
|---|---|---|
| `TRUST_PROXY` | API | Defaults to `1` in production (one proxy in front, which is how Railway works). Rate limits are per visitor address, so this must be right: if every visitor shared the proxy's address, they would all be limited together. Check after deploy that `/api/health` responses carry sensible `RateLimit-Remaining` values from two different networks |
| `ENFORCE_EMAIL_VERIFICATION=true` | API | Refuse sign-in until the email address is verified. **Off by default** - see decision 1 |
| `COMMUNITY_TIME_ZONE` | API | For quiet hours on the email summary. Default `America/Chicago` |

`ALLOWED_ORIGINS` behaves as before.

## 2. Database

**No migration is needed.** All model changes are additive, with defaults that match today's behaviour:

- new collection `favorites`
- `userprivacysettings`: `show_online` (default on), `read_receipts` (default on)
- `usernotificationsettings`: `quiet_hours_enabled` (off), `quiet_hours_start`, `quiet_hours_end`, `email_digest` (off), `email_digest_last_sent`
- `events`: `rsvp_notes`, `is_hidden` (off)
- `reports`: `category`, `source`, `match_id`
- `events`: `reminders_sent` (round 2; a list, empty by default) - which in-app reminders have already been given
- `users`: `has_seen_tour` (default false, so **every existing member sees the short welcome tour once** on their next visit; they can skip it)

Preferences saved as `non-binary` by older versions are understood as `non_binary` when read; nothing is rewritten.

Round 2 adds no collection and no index.

## 2a. Round 2: event reminders

Members who said "I'm going" get an in-app notification the day before an event and on the day. **Nothing needs scheduling**: a member's due reminders are created when they open the app. "Today" and "tomorrow" follow `COMMUNITY_TIME_ZONE` (default `America/Chicago`), and the time in the reminder is written with its zone ("6:30 PM CST"). Optional: to have reminders waiting before members open the app, add a Railway cron service running `node src/jobs/run-event-reminders.js` hourly. No email is sent. Right after deploy, members going to an event that is today or tomorrow will get that reminder once.

## 3. Deploy order

Deploy the API and the website **together** (same commit). The live chat connection now requires the member's token:

- new website + old API: works (the old API ignores the token)
- old website (a tab left open) + new API: live updates stop in that tab until it is reloaded; sending and reading messages still work

Existing sign-ins stay valid: the token format and secret are unchanged.

## 4. Behaviour changes members may notice

- Text is larger by default; there is a text-size choice in Settings.
- Settings save by themselves; the Save button is gone.
- The menu has Saved, Safety and Help; the collapsible icon-only sidebar is gone.
- "Report & Block" is now two separate actions.
- Login says "That email or password is not right" for both mistakes.
- Round 2: Notifications are no longer all marked read just by opening the page - members will see "New" on items until they open or mark them, and a "Mark all as read" button.
- Round 2: Unmatch and "Remove like" on the Matches page now ask first.
- Round 2: adding a photo shows tips and a "position your photo" step; photos are made smaller in the browser before upload. The screen now says 9 photos (what the server always allowed), not 10.
- Round 2: first name, last name and city can be edited on My Profile. Birthday cannot.
- Round 2: My Profile shows the member (only) a "Your profile is N% complete" card with suggestions; "Hide for now" removes it on that device.
- Vercel Analytics was removed from the page (the site is hosted on Railway, and it sent page views to a third party).

## 5. Decisions for the owner

1. **Insist on verified email at sign-in?** Today an unverified account can sign in. Turning on `ENFORCE_EMAIL_VERIFICATION` closes that, but any existing member who never verified would be asked for a code at next sign-in - only do this once you are confident Mailgun delivery is reliable. (The login screen does not yet lead them to the code screen; that needs a small follow-up.)
2. **Email summary.** The opt-in switch and the job exist (`server/src/jobs/run-digest.js`), but nothing schedules it. To use it, add a Railway cron service that runs `node src/jobs/run-digest.js` once a day.
3. **"Delete account"** only closes the account (soft delete); the email stays registered. The wording now says so. Decide whether to offer real erasure.
4. **`server/node_modules` is committed** (10,820 files). Left alone because the Railway build may rely on it; removing it and letting Railway run `npm ci` in `server/` would shrink the repository.
5. **Terms and Privacy text** now also appears at `/terms` (moved, not rewritten). It should be read by whoever is responsible for it.
6. **"LPA member" verification.** The app records a membership number but does not check it with LPA. Profiles therefore show "Email confirmed" only, not "Verified member".
