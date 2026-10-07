# Release checklist - `improvements/2026-10-04` (pull request #3)

For the owner. Short on purpose; the reasons are in [`ROLLOUT.md`](ROLLOUT.md). Nothing on the branch has touched production.

## Before you merge

- [ ] **Security first, whether or not you merge:** do section 0 of [`ROLLOUT.md`](ROLLOUT.md) / [`SECURITY-INCIDENT.md`](SECURITY-INCIDENT.md) - change the Atlas database password, the admin passwords, and consider making the repository private. The old values are in the public history.
- [ ] CI is green on the pull request (typecheck, lint, API tests, production build, browser tests).
- [ ] Read "Behaviour changes members may notice" in `ROLLOUT.md`. Decide whether to tell members first (larger text, new menu items, Settings save by themselves, the short welcome tour everyone sees once).
- [ ] Make the six owner decisions at the end of `ROLLOUT.md`, or consciously leave them: none blocks the merge, and every default keeps today's behaviour.
- [ ] Optional, 5 minutes, on your own computer - nothing real is used: `npm ci`, then `npm run smoke:prod`. It builds the site the way Railway does, starts the API with `NODE_ENV=production` against a throwaway database with stand-ins for S3 and Mailgun, and runs the core flows. It should end with `[smoke] PASSED`.
- [ ] Know that this pull request also updates libraries (security fixes only, no major versions - see section 2b of `ROLLOUT.md`). If you would rather ship those separately, revert commit `e4110e0` on the branch before merging; everything else works without it. If you merge with **"Create a merge commit"** (not squash), that commit can also be reverted by itself later.
- [ ] In Railway, note the **current deployment** of each service (Deployments tab; the one marked Active) - that is what you roll back to.
- [ ] In Railway → API service → Variables, confirm these exist (do not change them): `MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS` (must include the website's address), `FRONTEND_URL`, the `AWS_*` four, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `SMTP_FROM_EMAIL`. Website service: `NEXT_PUBLIC_API_URL`. **No new variable is required.**
- [ ] Pick a quiet time (a weekday morning). Members with the site open keep working, but live chat updates in an already-open tab stop until they reload.

## Deploy order

1. Mark the pull request ready and merge it into `main`.
2. Railway redeploys **both** services from the same commit. If they do not start by themselves, press Deploy on the **API first, then the website**. (New website + old API works. Old website + new API works except live chat updates. So the API can safely lead by a few minutes.)
3. No database step. Every change is an added field or collection with a default.
4. Wait until both show **Active**. In the API's deploy log you should see `Connected to MongoDB`, `Server running on port ...`, `Environment: production`. If it says `JWT_SECRET is not set. Refusing to start.` a variable is missing - Railway keeps the previous deployment serving, so members are not affected; fix the variable and redeploy.

## Check straight after (10 minutes)

- [ ] `https://<api address>/api/health` shows `{"status":"ok",...}`.
- [ ] Open the site in a private window: the login page appears, **no yellow "Development Mode" banner**.
- [ ] Sign in as yourself. Browse shows members with photos. Open Messages, send a message to a co-admin or a test match and see it arrive on their screen without reloading.
- [ ] My Profile → Manage Photos → add a photo (tips, then "Position your photo") → it appears. This proves S3 still works.
- [ ] Log out → "Forgot password?" → enter your own address → the email arrives and the link opens the site. This proves Mailgun still works.
- [ ] Admin area opens; Reports and Members load.
- [ ] Admin -> Activity log opens (it is empty until the first decision is taken after the deploy - that is expected).
- [ ] **Rate limits see real visitors, not the proxy.** From your computer run (PowerShell):
      `curl.exe -s -D - -o NUL https://<api address>/api/events | findstr /i ratelimit-remaining`
      then the same on your phone's mobile data (or ask someone elsewhere). Each should start near **1499** and count down separately. If both count down the same number, every member is sharing one allowance: set `TRUST_PROXY` on the API service (try `2` if there is a second proxy such as Cloudflare in front) and redeploy. (Use `/api/events`, not `/api/health` - the health check is never limited and carries no such header. Signed out, `/api/events` answers 401; that is expected, the header is still there.)

## Watch for in the first hour

Railway → API service → **Logs** (search box):

| Search for | Meaning | What to do |
|---|---|---|
| `[ERROR]` or `statusCode":5` | Server errors | A few is normal noise; a steady stream on one path → roll back |
| `Rate limit exceeded` | A visitor hit a limit | Several different members within minutes → `TRUST_PROXY` is wrong (see above) |
| `Mailgun API error` / `Mailgun credentials not configured` | Emails are not going out | Check the Mailgun variables; sign-up and password reset depend on it |
| `MongoDB connection error` | Database unreachable | Check `MONGODB_URI` (did the password change in step 0 get copied to Railway?) |
| `Not allowed by CORS` | The website's address is missing from `ALLOWED_ORIGINS` | Add it, redeploy the API |

Also: Railway → Metrics (memory and CPU roughly as before), and ask one or two members you trust to sign in, read a message and open Events on their phone. Expect a few "it looks different" messages: text is larger and the menu has three new entries.

Members who said they are going to an event today or tomorrow get one in-app reminder the first time they open the app after the deploy. That is intended.

## How to roll back on Railway

Rolling back is safe at any time: the database changes are additions only, the old code ignores them, and sign-ins stay valid (token format and secret are unchanged).

1. Railway → the **website** service → **Deployments** → find the deployment that was Active before the merge → the `⋮` menu → **Rollback** (or **Redeploy** if Rollback is not offered).
2. Do the same for the **API** service.
3. Check `/api/health` and sign in.
4. On GitHub, open the merged pull request and press **Revert**, then merge the revert, so the next push to `main` does not bring the change straight back. (If Railway is set to deploy on every push to `main`, the revert itself redeploys the old code - that is fine and has the same effect as steps 1-2.)

What stays behind after a rollback, harmlessly: the added collections and fields, and any moderation history written while the new version was live. Nothing needs deleting.

Things a rollback does **not** undo: the password changes from step 0 (good), and anything members did in the meantime (messages, likes, photos) - all of that is ordinary data the old version understands.
