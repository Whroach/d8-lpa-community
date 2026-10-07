# Handoff - improvements/2026-10-04

Last updated: 2026-10-06 (round 3 stopped early at the owner's request - read the Round 3 section at the end first; the notes below it are from round 2 and partly out of date). Branch `improvements/2026-10-04`, draft PR #3. Nothing here has touched production; `main` is untouched.

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

# Round 3 (2026-10-06)

The first attempt at this round was cut off by an outage about an hour in; a second session picked it up and was then asked to wrap up before it had finished. Nothing touched production; `main` is untouched; the pull request is still a draft.

## Where things stand

- **Tests:** 167 unit/API/realtime (`npm test`, all pass), 175 browser tests (`npm run test:e2e`), 3 switch-build tests (`npm run test:e2e:switches`), 9 production-build smoke tests (`npm run smoke:prod`). Typecheck clean; ESLint 0 errors, 0 warnings. `npm audit`: 0 known vulnerabilities, website and API.
- **Inventory:** 533 rows - 369 work, 1 tested on the server only (nothing to click), 139 fixed, 24 changed, **0 broken, 0 not verified**.
- **No `test.fixme` or skipped tests.**

## Not finished - read this

- **Three consecutive full browser runs were not done.** One full run was made early in the session (166 of 167; the one failure, toast contrast, is fixed). After the last batch of design fixes only the most affected specs were re-run (72 of 72: admin-edges, admin-scale, settings, signup-login, chat, community, a11y sign-up/onboarding) plus the member accessibility spec at phone and tablet size. The whole suite has **not** been run on the final commit locally - check CI on the pull request, and run `npm run test:e2e` three times before merging.
- **The "suspending a member signs them out" test** was fixed by the interrupted attempt (commit `8daa6c7`: a real app race - signing out re-ran the page guard, which replaced the explanation with the login page; 8 failures in 30 before, 60 of 60 after, 30 of them under full CPU load, by that attempt's own count). In this session it passed in the one full run and in the community.spec re-run; it was not re-run repeatedly under load.
- **Design review, not finished:** the 55 desktop dark sheets were captured but not inspected. The fixes made after the review were not re-captured and looked at again (only checked by the tests above). Findings left open are listed in `docs/DESIGN-REVIEW.md`.
- `npm run smoke:prod` was last run (9 of 9) after the dependency updates but before the final design fixes.

## What the interrupted attempt left, and what happened to it

Pushed before the outage (all kept): the suspension-notice fix, the admin API (reasons required, activity log, server-side pages and search, local bulk seed), the rebuilt admin panel, the hygiene pass (mock data, 32 unused components and hooks, 41 unused dependencies removed, ESLint warnings cleared), the onboarding crop step, the AUTH-07 switch build, the production-like smoke run and `docs/RELEASE-CHECKLIST.md`.

Six files were uncommitted:

| File | Decision |
|---|---|
| `components/admin/events-tab.tsx`, `news-tab.tsx` (each form box changes only its own value) | Kept - sound |
| `eslint.config.mjs` (ignore `test-results-*`) | Kept |
| `tests/e2e/a11y-admin.spec.ts`, `a11y-signup-onboarding.spec.ts` (new) | Kept and finished - 6 of their 8 tests failed as left |
| `components/ui/select.tsx` (page behind an open list made inert) | **Was broken**: it also ran for closed lists, which switched the whole page off (nothing could be clicked). Fixed to act only when the list is really open, then kept |

## Done in the second session

- **Inventory:** section 17 rewritten row by row for the rebuilt admin panel, each row checked against the test linked from it. That found 17 admin rows with no browser test; all are now tested in `tests/e2e/admin-edges.spec.ts` (8 tests), with Previous-page checks added to `admin-scale.spec.ts`.
- **Admin defects found by those tests, fixed:** a report about a closed account still offered Warn / Suspend / Ban; Warn offered for a banned member; Restore event had no confirmation; failed loads of notes and "who is going" read as "none"; an event under way was labelled Past; delete wording on a cancelled event; stale waiting number on the Reports tab.
- **Accessibility:** axe (full WCAG 2.0/2.1 A + AA) now also covers log in, sign up, verify, forgot/reset password, terms, not-found, offline, every onboarding step and dialog, the welcome tour, Help, Safety, and every admin tab and dialog (desktop and phone), light and dark. 0 serious or critical findings.
- **Design review:** every state those specs visit (109 per theme) was captured at 390, 820 and 1440px in light and dark and tiled into readable sheets; 215 of 268 sheets were inspected (all phone and tablet sheets, all desktop light sheets). See `docs/DESIGN-REVIEW.md` for what was found, fixed and left.
- **Dependencies:** the non-breaking `npm audit` fixes, in a commit of their own (`e4110e0`).
- **Docs:** `docs/ROLLOUT.md` section 2b, `docs/RELEASE-CHECKLIST.md`, `docs/LOCAL-DEVELOPMENT.md`, this file.

## Useful to know (round 3)

- Screenshots for review: see "Screenshots for design review" in `docs/LOCAL-DEVELOPMENT.md`. In a full-page capture the side menu and bottom bar are drawn once, so later slices of a long page show a blank column - that is the capture, not the app.
- `npm run smoke:prod` builds into `.next-smoke`; Next.js then edits `tsconfig.json`. The script now puts it back - do not commit such a change.
- The side menu appears from 1024px wide (was 768px). Tablets held upright use the bottom menu bar.
- Ports used: 4120-4127. All stopped.

## Owner decisions - unchanged, still open (details in `docs/ROLLOUT.md` section 5)

1. Insist on verified email at sign-in? 2. Schedule the email summary? 3. What should "Delete account" mean? 4. Keep the committed `server/node_modules`? 5. Terms and Privacy text to be read by whoever is responsible for it. 6. LPA membership-number verification.
