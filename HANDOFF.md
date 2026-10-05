# Handoff - improvements/2026-10-04

Last updated: 2026-10-04 (evening). Branch `improvements/2026-10-04`, draft PR #3. Nothing here has touched production; `main` is untouched.

## Where things stand

- **Tests:** 122 unit/API/realtime (`npm test`) and 53 browser (`npm run test:e2e`) - all passing at the last run. Typecheck clean, ESLint 0 errors (21 warnings), production build passes.
- **Run it:** `npm run dev:local` - see `docs/LOCAL-DEVELOPMENT.md`.
- **Inventory:** `docs/FUNCTION-INVENTORY.md` - of 452 existing functions: 121 exercised by browser tests, 37 server-side only, 58 fixed, 6 changed, 7 still broken, **223 not yet verified by any test**.

## Urgent, for the owner (not something a branch can fix)

The repo is public and its history holds a production database connection string and admin passwords. See `docs/ROLLOUT.md` section 0.

## Not finished

1. **223 inventory rows have no test.** Biggest groups: onboarding form (46 rows), profile editor (~50), Browse filters, Matches page buttons, admin screens' individual buttons, Notifications page actions. Server routes behind most of them are tested; the buttons are not clicked.
2. **Seven known defects left** (search "Still broken" in the inventory): sign-up "back" strands the account; onboarding "remove photo" does not remove it; profile Cancel keeps edits; Unmatch / Unlike on the Matches page have no confirmation; Notifications marks everything read on open; admin event edit can shift the date by a day.
3. **Design review was partial** - see the "Limits" paragraph in `docs/DESIGN-REVIEW.md`. Onboarding, profile editor, admin and dialogs were not reviewed.
4. **Roadmap items not built:** profile-completeness helper, photo tips / cropping, in-app event reminders, interest groups. See `ROADMAP.md`.
5. **Not done:** removing unused UI components and unused root dependencies (`express`, `mongoose`, `@aws-sdk/client-s3`, `recharts`... are no longer imported by the website); `lib/mock-data.ts` and the `USE_MOCK_DATA` branches in `lib/api.ts` are dead but still there.
6. **CI workflow** (`.github/workflows/ci.yml`) ran green on the pull request (both jobs).
7. With `ENFORCE_EMAIL_VERIFICATION=true` the login page does not yet take the member to the code screen.

## Useful to know

- The Next dev server once kept serving an old stylesheet after a transient import error; restarting `dev:local` (and deleting `.next`) fixed it.
- On this Windows machine the in-memory MongoDB needs VC++ runtime files; `scripts/local-mongo.mjs` copies them from Edge into the user cache.
- Ports used during this work: 4120 (API), 4121 (web), 4122 (database). All stopped.
