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

---

# Round 3 (2026-10-06) - running notes

The first attempt at this round was cut off by an outage about an hour in; a second session picked it up. This section is kept up to date as the work goes.

## What the interrupted attempt left, and what happened to it

Pushed before the outage (all kept, all re-run): the suspension-notice fix (the intermittent test), the admin API (reasons required, activity log, server-side pages and search, local bulk seed), the rebuilt admin panel, the hygiene pass (mock data, 32 unused components and hooks, 41 unused dependencies removed), the onboarding crop step, the AUTH-07 switch build, the production-like smoke run and `docs/RELEASE-CHECKLIST.md`.

Six files were uncommitted:

| File | Decision |
|---|---|
| `components/admin/events-tab.tsx`, `news-tab.tsx` (each form box changes only its own value) | Kept - sound |
| `eslint.config.mjs` (ignore `test-results-*`) | Kept |
| `tests/e2e/a11y-admin.spec.ts`, `a11y-signup-onboarding.spec.ts` (new) | Kept and finished - 6 of their 8 tests failed as left |
| `components/ui/select.tsx` (page behind an open list made inert) | **Was broken**: it also ran for closed lists, which switched the whole page off (nothing could be clicked). Fixed to act only when the list is really open, then kept |

## Done so far in the second session

- Inventory: section 17 rewritten row by row for the rebuilt admin panel (a helper read every row against its test). That found 17 admin rows with no browser test; all 17 are now tested in `tests/e2e/admin-edges.spec.ts`. **0 not verified, 0 broken** (533 rows).
- Defects found while writing those tests, all fixed: a report about a closed account still offered Warn / Suspend / Ban; Warn offered for a banned member; Restore event had no confirmation; failed loads of notes and "who is going" read as "none"; an event under way was labelled Past; delete wording on a cancelled event; stale waiting number on the Reports tab; toast text 13px and below AA contrast.
- `npm audit`: 0 known vulnerabilities in website and API after non-breaking updates (commit `e4110e0`, on its own so it can be reverted alone; it is large because `server/node_modules` is committed).
- `npm run smoke:prod` 9 of 9 after the dependency updates.

## Still to do in this round (updated as it goes)

- Screenshot review of every screen and dialog at three widths, light and dark.
- Three consecutive full browser runs.
- Docs: design review, rollout, local development, PR description.
