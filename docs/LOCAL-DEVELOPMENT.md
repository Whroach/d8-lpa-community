# Running D8-LPA on your own computer

Everything below uses **throwaway data**. It never reads your `.env`, and it cannot reach the production database, the S3 bucket, Mailgun or Railway.

## One command

```powershell
npm install        # first time only
npm run dev:local
```

Then open <http://localhost:3000>.

That one command:

1. starts a temporary MongoDB in memory (it disappears when you stop),
2. fills it with eight fictional members, one admin and four events,
3. starts the API on port 5001 - photos are saved to `server/.local-uploads`, emails are captured in memory and never sent,
4. starts the website on port 3000.

Press `Ctrl+C` to stop everything.

Ports busy? Choose others:

```powershell
$env:API_PORT = '4120'; $env:WEB_PORT = '4121'; npm run dev:local
```

**Windows note.** The temporary database needs Microsoft's Visual C++ runtime. If it is missing, the script borrows the copies that ship with Microsoft Edge (placing them beside the downloaded `mongod`, in your user cache only). If that is not possible it tells you to run `winget install Microsoft.VCRedist.2015+.x64`.

## Demo sign-ins

All made up. Every account uses the password in `server/src/dev/seed-demo.js` (`DEMO_PASSWORD`).

| Email | Who |
|---|---|
| `dana@example.test` | Member with two matches, a conversation, notifications |
| `marcus@example.test` | Dana's match - sign in here in a second browser to chat with her |
| `walt@example.test` | Matched with Dana, no messages yet (shows conversation starters) |
| `theo@example.test` | Has liked Dana (like him back as Dana to see a match) |
| `admin@example.test` | Administrator |

New sign-ups work too: the verification code and password-reset emails are captured, not sent. Read them at <http://localhost:5001/api/__test/outbox> (this address only exists in local runs).

## Tests

| Command | What it runs |
|---|---|
| `npm test` | 167 unit, API and realtime tests (in-memory database) |
| `npm run test:e2e` | 175 browser tests with Playwright: every screen and button, chat between two browser sessions, the admin area (also with 300 members and 250 reports), and axe accessibility checks on every screen and dialog. Starts the local stack itself if it is not already running on ports 4120/4121. About 25 minutes |
| `npm run test:e2e:switches` | 3 browser tests for the login screen as it is when the site is built with password reset switched off. Starts its own copy of the website on port 4126 |
| `npm run smoke:prod` | 9 tests against a production build: `next build` + `next start`, the API with `NODE_ENV=production`, a throwaway database, stand-ins for S3 and Mailgun, and a guard that fails the run if the API tries to reach the internet. Ends with `[smoke] PASSED`. Ports 5201 / 3201 / 5202 unless `SMOKE_API_PORT` / `SMOKE_WEB_PORT` / `SMOKE_FAKE_PORT` are set |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (0 errors, 0 warnings) |
| `npm run test:all` | Typecheck, lint, `npm test`, both browser suites |

First time only for the browser tests: `npx playwright install chromium`.

To use an already-running stack for the browser tests, start it on the ports they expect:

```powershell
$env:API_PORT = '4120'; $env:WEB_PORT = '4121'; npm run dev:local
```

## Many members, to try the admin area

With the local stack running, this adds 300 fictional members and 250 reports (and removes them again):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:5001/api/__test/bulk-admin-data -ContentType 'application/json' -Body '{"members":300,"reports":250}'
Invoke-RestMethod -Method Delete -Uri http://localhost:5001/api/__test/bulk-admin-data
```

The address only exists in local runs.

## Screenshots for design review

The accessibility tests visit every screen, step and dialog. Asked to, they also save a picture of each one, so the pictures are exactly the states that were measured:

```powershell
$env:SHOTS_DIR = 'docs/screenshots/tmp/round3'
foreach ($size in 'phone','tablet','desktop') { $env:SHOTS_SIZE = $size; npx playwright test tests/e2e/a11y- }
node scripts/contact-sheets.mjs docs/screenshots/tmp/round3
Remove-Item Env:SHOTS_DIR, Env:SHOTS_SIZE
```

That gives every state at 390, 820 and 1440 pixels wide, in light and dark, tiled into readable sheets under `docs/screenshots/tmp/round3/sheets` (not committed). The older scripts `scripts/screenshots.mjs` and `scripts/screenshots-round2.mjs` still work.

## Switches (local only)

All of these are ignored when `NODE_ENV=production`.

| Variable | Effect |
|---|---|
| `SKIP_DOTENV=1` | Do not read `.env` at all (the local runner always sets this) |
| `STORAGE_DRIVER=local` | Save photos to a folder instead of S3 |
| `MAIL_DRIVER=memory` | Capture emails instead of sending |
| `ENABLE_TEST_ROUTES=1` | Expose `/api/__test/outbox` |
| `RATE_LIMIT_DISABLED=1` | Switch rate limits off |
| `REQUIRE_EMAIL_VERIFICATION=true` | Make sign-up ask for the emailed code, as production does |

## Maintenance scripts

`server/src/clear.js`, `create-admin*.js`, `make-admin.js` and `toggle-admin.js` no longer contain a database address or password. They need `MONGODB_URI` (and `ADMIN_PASSWORD` where relevant) in the environment, and `clear.js` refuses anything but a local database unless `ALLOW_REMOTE_DB_WIPE=yes`.
