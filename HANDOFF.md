# Handoff - improvements/2026-10-04

Last updated: 2026-10-05 (end of round 2). Branch `improvements/2026-10-04`, draft PR #3. Nothing here has touched production; `main` is untouched.

## Where things stand

- **Tests:** 153 unit/API/realtime (`npm test`) and 145 browser tests (`npm run test:e2e`; 2 of them switched off with `test.fixme`). Last full run: 153/153 after one fix, and 144 of 145 browser tests - the one failure ("ADM: suspending a member signs them out of the app", `community.spec`) passed every time it was re-run alone and with its neighbours, so it is intermittent under load and still needs a look. Typecheck clean; ESLint 0 errors, 19 warnings.
- **Run it:** `npm run dev:local` - see `docs/LOCAL-DEVELOPMENT.md`. Several stacks can now run side by side (`NEXT_DIST_DIR`, `MONGO_PORT`).
- **Inventory:** `docs/FUNCTION-INVENTORY.md` - 480 rows: 327 work (browser-tested), 11 tested on the server side, 116 fixed, 14 changed, **0 still broken, 12 not verified** (AUTH-07, ADM-31, ADM-41, ADM-43, ADM-44, ADM-46, ADM-47, ADM-48, ADM-49, ADM-51, ADM-54, ADM-55).
- **All seven defects from round 1 are fixed**, each with a test.

## Urgent, for the owner (not something a branch can fix)

The repo is public and its history holds a production database connection string and admin passwords. Follow `docs/SECURITY-INCIDENT.md` step by step.

## Not finished

1. **Admin screens, browser tests:** AUTH-07, ADM-31, ADM-41, ADM-43, ADM-44, ADM-46, ADM-47, ADM-48, ADM-49, ADM-51, ADM-54, ADM-55. Two tests in `tests/e2e/admin.spec.ts` are `test.fixme` (they look for icon buttons by `svg.lucide-trash-2`; the selector is probably wrong).
2. **Admin polish not done:** native `alert()` / `confirm()` are still used (except event-save errors); Suspend / Ban in the report queue act on one click with no confirmation; tables are not reworked for a 390px phone.
3. **Design review gaps:** sign-up, onboarding and admin were rebuilt for labels and semantics but were **not** screenshot-reviewed and have no axe test file; of the six round-2 contact sheets only the two phone sheets were inspected. See "Still open" in `docs/DESIGN-REVIEW.md`.
4. **Hygiene not done:** `lib/mock-data.ts` and the `USE_MOCK_DATA` branches in `lib/api.ts`, unused UI components and unused root dependencies are still there; 19 ESLint warnings remain (all React-hooks advisories).
5. **Photo crop step** is on My Profile only; onboarding uploads without it.
6. **Roadmap items decided against for now:** interest groups and "Not for me" in Browse - reasons in `ROADMAP.md`.
7. The intermittent browser test named above.
8. With `ENFORCE_EMAIL_VERIFICATION=true` the login page does not yet take the member to the code screen (owner decision 1 - left alone).

## Useful to know

- Event times are stored as exact moments, typed on the admin's own clock, and shown on each viewer's own clock (`lib/event-dates.ts`). Reminders use the community clock (`COMMUNITY_TIME_ZONE`).
- Creating an event notifies every member, so tests that count notifications must not create events in the same test.
- The API process does not hot-reload: restart `dev:local` after changing anything under `server/`.
- The Next dev server may rewrite `tsconfig.json` when `NEXT_DIST_DIR` is used - do not commit that.
- Ports used in round 2: 4120-4125. All stopped.
