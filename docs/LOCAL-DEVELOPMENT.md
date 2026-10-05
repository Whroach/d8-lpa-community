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
| `npm test` | 122 unit, API and realtime tests (in-memory database) |
| `npm run test:e2e` | 53 browser tests with Playwright, including chat between two browser sessions. Starts the local stack itself if it is not already running on ports 4120/4121 |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test:all` | All of the above |

First time only for the browser tests: `npx playwright install chromium`.

To use an already-running stack for the browser tests, start it on the ports they expect:

```powershell
$env:API_PORT = '4120'; $env:WEB_PORT = '4121'; npm run dev:local
```

## Screenshots for design review

```powershell
$env:WEB_URL = 'http://localhost:3000'; $env:API_URL = 'http://localhost:5001/api'
node scripts/screenshots.mjs docs/screenshots/tmp
```

13 screens x phone / tablet / desktop x light / dark.

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
