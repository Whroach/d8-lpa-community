# D8-LPA front-end function inventory

Inventory of every user-facing function in the Next.js front end, written by reading the code in the worktree `C:\Users\whroa\lpa-work` (branch `improvements/2026-10-04`) on 2026-10-04. Nothing was run: every statement below comes from the source, and anything that could only be confirmed in a browser is marked **unverified**.

Use it to write Playwright end-to-end tests and tick each row off in the `Status` / `Test` columns.

## Status summary (updated 2026-10-05, end of round 2)

452 existing functions were inventoried, plus 28 added on this branch (480 rows).

| Status | Count | Meaning |
|---|---|---|
| Works | 327 | Exercised by an automated browser test |
| Works (API test) | 11 | Tested on the server side; rows marked "nothing more to click" have no separate control, the admin ones still lack a browser click |
| Fixed | 116 | Was broken or misleading; fixed on this branch, test linked |
| Changed | 14 | Deliberately replaced or removed (explained in the row) |
| Still broken | 0 | Known defect |
| Not verified | 12 | No automated test yet: AUTH-07, ADM-31, ADM-41, ADM-43, ADM-44, ADM-46, ADM-47, ADM-48, ADM-49, ADM-51, ADM-54, ADM-55 |

Not verified, in plain words: the "Feature Disabled" dialog on the login screen (only appears with a build-time switch) and part of the admin screens - member notes, some event-form fields, event photo, cancel / restore / delete, the attendee list. Their server routes are all tested in `server/tests/admin.test.js`; two browser tests for them exist but are switched off (`test.fixme` in `tests/e2e/admin.spec.ts`) because a selector is wrong.

### Added on this branch

| ID | Function | Status | Test |
|---|---|---|---|
| NEW-01 | Welcome tour on first sign-in; replay from Help | Works | [auth.spec](../tests/e2e/auth.spec.ts) |
| NEW-02 | Help page with plain how-tos | Works | [community.spec](../tests/e2e/community.spec.ts) |
| NEW-03 | Safety Centre (romance scams, meeting safely, block/report, privacy) | Works | [community.spec](../tests/e2e/community.spec.ts) |
| NEW-04 | Private scam reminder under a received message that mentions money, gift cards, crypto or moving apps | Works | [chat.spec](../tests/e2e/chat.spec.ts) [lib.test](../tests/unit/lib.test.ts) |
| NEW-05 | Typing indicator | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| NEW-06 | Read receipts ("Seen"), with a privacy switch | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) [core.test](../server/tests/core.test.js) |
| NEW-07 | Online status, with a privacy switch | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| NEW-08 | Message drafts kept per conversation | Works | [chat.spec](../tests/e2e/chat.spec.ts) |
| NEW-09 | Failed-send retry | Works | [chat.spec](../tests/e2e/chat.spec.ts) |
| NEW-10 | Conversation starters from shared interests | Works | [chat.spec](../tests/e2e/chat.spec.ts) [lib.test](../tests/unit/lib.test.ts) |
| NEW-11 | Saved profiles (private bookmark) and Saved page | Works | [community.spec](../tests/e2e/community.spec.ts) [core.test](../server/tests/core.test.js) |
| NEW-12 | Block with Undo; Report with reasons - from profile and chat | Works | [chat.spec](../tests/e2e/chat.spec.ts) [community.spec](../tests/e2e/community.spec.ts) |
| NEW-13 | Text-size setting (4 sizes, per device) | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| NEW-14 | Quiet hours | Works | [chat.spec](../tests/e2e/chat.spec.ts) [settings.spec](../tests/e2e/settings.spec.ts) |
| NEW-15 | Email summary opt-in and digest job (mail seam only) | Works | [settings.spec](../tests/e2e/settings.spec.ts) [digest.test](../server/tests/digest.test.js) |
| NEW-16 | Events: add to calendar (.ics / Google) | Works | [community.spec](../tests/e2e/community.spec.ts) [lib.test](../tests/unit/lib.test.ts) |
| NEW-17 | Events: who's going, and lift / meet-up notes | Works | [community.spec](../tests/e2e/community.spec.ts) [core.test](../server/tests/core.test.js) |
| NEW-18 | Admin: member report queue with warn / suspend / ban / dismiss | Works | [community.spec](../tests/e2e/community.spec.ts) [core.test](../server/tests/core.test.js) |
| NEW-19 | "Email confirmed" badge and "You both like" on profiles | Works | [community.spec](../tests/e2e/community.spec.ts) |
| NEW-20 | Installable app (manifest, icons, offline page) | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| NEW-21 | Terms and Privacy page reachable before sign-in | Works | [auth.spec](../tests/e2e/auth.spec.ts) |
| NEW-22 | Error, not-found, offline and load-error states instead of blank screens | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| NEW-23 | In-app event reminders: the day before and on the day, once each, for members who said "I'm going" | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) [reminders.test](../server/tests/reminders.test.js) |
| NEW-24 | Profile-completeness helper on My Profile, with example answers | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [profile-completeness.test](../tests/unit/profile-completeness.test.ts) |
| NEW-25 | Photo tips and a crop step before upload (move, zoom, or use the whole picture) | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| NEW-26 | Notifications: read one at a time, "Mark all as read", real times, Delete with Undo | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NEW-27 | Events: "Next 7 days / Next 30 days / Any time" choices beside the date boxes; a link can open one event | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| NEW-28 | My Profile: first name, last name and city can be edited after sign-up | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |

## Baseline - read this first

- **Front end:** every `file:line` under `app/`, `components/` and `lib/` matches commit `560d254`. Those files were unmodified in the working tree for the whole review.
- **Back end:** the Express server was being rewritten by another session in the same worktree while this was written (uncommitted changes to almost every file under `server/src`, new files such as `server/src/app.js`, `realtime.js`, `routes/favorites.js`, `routes/test-support.js`). It was read twice: once as committed (`560d254`) and once as it stood in the working tree at about 21:37 on 2026-10-04. Where the two differ, the text says which is which. The working-tree backend was still changing when the review ended, so re-check anything marked "working tree".
- Error texts that come from the server (for example the login error) are quoted from the working-tree backend and may change again.

## How to read the tables

- **Where** is `file:line` at commit `560d254`.
- **API call** is the path relative to the API base (`NEXT_PUBLIC_API_URL`, falling back to `/api`, see `lib/api.ts:18`). All of them are served by the Express server in `server/src/routes`. `none` means the control only changes client state. The `app/api` Next.js route handlers are deleted in the working tree, so the `/api` fallback only works behind a proxy to the Express server.
- **How a test finds it** quotes the visible text, placeholder, `aria-label` or `id` exactly as written in the code. "label not associated" means there is a visible `<Label>` but no `htmlFor`/`id` link, so `getByLabel()` will not work.

Things that apply everywhere:

- Every `Dialog` renders a built-in X button whose only name is the screen-reader text `Close` (`components/ui/dialog.tsx:49`); the mobile `Sheet` does the same (`components/ui/sheet.tsx:71`). Where a dialog also has a visible "Close" button, `getByRole('button', { name: 'Close' })` matches two elements.
- Radix controls: `Switch` is `role="switch"`, `Select` trigger is `role="combobox"` with options `role="option"`, dropdown items are `role="menuitem"` (checkbox items `role="menuitemcheckbox"`), `Tabs` triggers are `role="tab"`.
- Admin errors use the native `alert()`; handle them with `page.on('dialog')`.
- In development a yellow "Development Mode" banner sits above every page (`components/dev-banner.tsx:11`).
- Session state lives in `localStorage` key `spark-auth` (`lib/store/auth-store.ts:225`); a test can seed it to skip the login screen.
- Whether the email-verification step appears in the browser depends on `NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION` (`app/signup/page.tsx:18`). On the server, the committed backend auto-verifies new accounts whenever `NODE_ENV` is not `production`; the working-tree backend does the same unless `REQUIRE_EMAIL_VERIFICATION=true` (`server/src/config/env.js:41`).
- Rate limits: the committed backend defines limiters but never applies them. The working-tree backend applies them (`server/src/app.js:111`): 10 failed sign-ins per address and email per 15 minutes, 10 sign-ups per address per hour, 8 emails per hour. They are switched off outside production with `RATE_LIMIT_DISABLED=1` - a test run needs that.
- The working-tree backend also has a test-only mail outbox, `GET /api/__test/outbox?to={email}` and `DELETE /api/__test/outbox`, mounted when `ENABLE_TEST_ROUTES=1` outside production (`server/src/routes/test-support.js:18`). With `MAIL_DRIVER=memory` this is how a test can read a verification code or reset link.

---

## 1. Sign up

File: `app/signup/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| SIGN-01 | Sign-up screen heading and tagline | app/signup/page.tsx:175 | `h1` `Create your account`; text `Join D8-LPA and find your perfect match`; logo text `D8-LPA` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| SIGN-02 | Email field with live format validation | app/signup/page.tsx:189 | Label `Email` (`#email`), placeholder `you@example.com`; error text `Please enter a valid email address` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-03 | Password field | app/signup/page.tsx:205 | Label `Password` (`#password`), placeholder `Create a strong password` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-04 | Show / hide password toggle | app/signup/page.tsx:216 | Buttons named `Show password` / `Hide password` (visible words `Show` / `Hide`) on both password boxes | none | Fixed - the password box now has a worded Show / Hide button with an accessible name (it was an unnamed eye icon); the confirm box has one too | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| SIGN-05 | Password requirement checklist (5 rules, each turns green when met) | app/signup/page.tsx:48, 224 | List `Password rules` (five items; each ends with screen-reader text `- done` or `- not yet`); visible once the password is non-empty | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| SIGN-06 | Confirm password field with match indicator | app/signup/page.tsx:243 | Label `Confirm Password` (`#confirmPassword`); `Passwords match` / `Passwords do not match`; has its own Show / Hide button | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-07 | Accept terms checkbox (required) | app/signup/page.tsx:271 | Checkbox `#terms`, label starts `I agree to the` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-08 | Terms of Service link | app/signup/page.tsx:279 | Link `Terms of Service` (href `/terms`) | none | Fixed - links went to pages that did not exist; /terms added | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-09 | Privacy Policy link | app/signup/page.tsx:283 | Link `Privacy Policy` (href `/privacy`) | none | Fixed - links went to pages that did not exist; /terms added | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-10 | Create Account submit (disabled until email valid, all 5 rules met, passwords match, terms ticked) | app/signup/page.tsx:289 | Button `Create Account`; while loading `Creating account...` | `POST /auth/signup` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| SIGN-11 | Sign-up error banner | app/signup/page.tsx:182 | `role="alert"` box with the server message | none | Fixed - the message is kept on this screen only (a stale one from another screen can no longer show), is announced (`role="alert"`), and "Email already registered" now offers Sign in / reset your password | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| SIGN-12 | Straight to onboarding when verification is disabled | app/signup/page.tsx:83 | URL becomes `/onboarding` when the sign-up answer says `requiresVerification: false` (or the build flag is set) | none | Fixed - when the server has verification switched off, the form waited for a code that was never sent; it now goes straight to onboarding | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| SIGN-13 | Link back to login | app/signup/page.tsx:307 | Text `Already have an account?`; link `Sign in` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |

## 2. Email verification

File: `app/signup/page.tsx` (second step of the same page; only shown when `NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION` is not `true`)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| VER-01 | Verification step shown after a successful sign-up | app/signup/page.tsx:79, 314 | Heading `Verify your email`; text `We sent a 6-digit code to` followed by the email in bold | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| VER-02 | Six single-digit code boxes (auto-advance, Backspace moves back) | app/signup/page.tsx:347 | Six `input[maxlength="1"]` named `Digit {n} of 6` | none | Fixed - each box now has a name (`Digit 1 of 6`...), the first is focused, letters are ignored, and pasting the whole code fills every box | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| VER-03 | Verify Code submit (disabled until all six boxes filled) | app/signup/page.tsx:367 | Button `Verify Code`; Enter in a box also submits once all six are filled | `POST /auth/verify-email` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| VER-04 | Verification error banner | app/signup/page.tsx:338 | `role="alert"` box, e.g. `Invalid verification code`, `Verification code expired` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| VER-05 | Resend Code | app/signup/page.tsx:386 | Button `Resend Code`; then status text `A new code is on its way...` | `POST /auth/resend-verification` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.test](../server/tests/auth.test.js) |
| VER-06 | 60-second resend cooldown | app/signup/page.tsx:405 | Text `Resend code in` + `{n}s`; the Resend button is hidden during the cooldown | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| VER-07 | Back to sign-up form | app/signup/page.tsx:316 | Button `Back to signup` | none | Fixed - the email is kept when going back; signing up again with the same email and password returns to the code screen with a fresh code (a different password still gets "Email already registered") | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.test](../server/tests/auth.test.js) |
| VER-08 | Help text under the form | app/signup/page.tsx:411 | `Didn't receive the code?`, `Check your spam folder`, `Make sure you entered the correct email - choose "Back to signup" to change it`, `Try requesting a new code above` | none | Fixed - developer hint removed | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| VER-09 | Success sends the member to onboarding | app/signup/page.tsx:153 | URL becomes `/onboarding` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |

## 3. Log in / Log out

Files: `app/login/page.tsx`, `app/page.tsx`, `components/app-sidebar.tsx`, `components/mobile-nav.tsx`, `lib/api.ts`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| AUTH-01 | Email field | app/login/page.tsx:106 | Label `Email` (`#email`), placeholder `you@example.com` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-02 | Password field | app/login/page.tsx:119 | Label `Password` (`#password`), placeholder `Enter your password` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-03 | Show / hide password toggle | app/login/page.tsx:130 | Button `aria-label="Show password"` / `aria-label="Hide password"` | none | Works | [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-04 | Remember my email checkbox | app/login/page.tsx:143 | Checkbox `#remember`, label `Remember my email`; stored in `localStorage` key `db-lpa-remember-me` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-05 | Remembered email is pre-filled on the next visit | app/login/page.tsx:32 | `#email` has the saved value and `#remember` is checked | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-06 | Forgot password link (normal mode) | app/login/page.tsx:161 | Link `Forgot password?` (href `/forgot-password`) | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-07 | Forgot password button and "Feature Disabled" dialog (when email verification is disabled by env) | app/login/page.tsx:152, 195 | Button `Forgot password?`; dialog title `Feature Disabled`; text `Forgot Password has been disabled for now. Please contact support if you need assistance with your account.`; button `Close` (plus the built-in X, also named `Close`) | none | Not verified |  |
| AUTH-08 | Sign In submit | app/login/page.tsx:170 | Button `Sign In`; while loading `Signing in...` | `POST /auth/login` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-09 | Login error banner | app/login/page.tsx:99 | Red box with the server message. Wrong email or password: `That email or password is not right. Please check both and try again.` (working-tree backend; the committed backend says `Invalid email` or `Invalid password`). Also `Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.` and `Your account has been deleted. Please contact d8lpa.community@gmail.com if you believe this is an error.` | none | Fixed - one message for wrong email or wrong password; the box is now announced (`role="alert"`). Banned, suspended and deleted accounts are told why | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) [auth.test](../server/tests/auth.test.js) |
| AUTH-10 | Redirect after login: onboarding if not completed, otherwise My Profile | app/login/page.tsx:81 | URL becomes `/onboarding` or `/profile` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| AUTH-11 | Logging in reactivates an account that was put on "Take a Break" | server/src/routes/auth.js:285 | Log in with a disabled account; it lands on `/profile` as normal | `POST /auth/login` | Works | [settings.spec](../tests/e2e/settings.spec.ts) [auth.test](../server/tests/auth.test.js) |
| AUTH-12 | Link to sign up | app/login/page.tsx:188 | Text `Don't have an account?`; link `Sign up` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-13 | Root URL `/` splash and redirect | app/page.tsx:12 | Splash text `D8-LPA` with a spinner; after 500 ms URL becomes `/browse` (signed in) or `/login` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-14 | Log out, desktop sidebar expanded | components/app-sidebar.tsx:249 | Button `Log Out` in the sidebar | none (client only) | Fixed - log out now also closes the live connection and clears badges | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-15 | Log out, desktop sidebar collapsed | components/app-sidebar.tsx:204 | Icon-only button with **no accessible name**; hover tooltip `Logout` | none (client only) | Changed - collapsed icon-only sidebar removed | [auth.spec](../tests/e2e/auth.spec.ts) |
| AUTH-16 | Log out, mobile | components/mobile-nav.tsx:158 | Button `Log Out` inside the `More` sheet | none (client only) | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| AUTH-17 | Any API call answering 401 clears the session and returns to login | lib/api.ts:54 | URL becomes `/login`; `localStorage` key `spark-auth` removed | n/a | Fixed - wrong password in Settings no longer signs the member out | [settings.spec](../tests/e2e/settings.spec.ts) [auth.test](../server/tests/auth.test.js) |

## 4. Forgot + reset password

Files: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| PWD-01 | Back to login link (top of forgot-password page) | app/forgot-password/page.tsx:53 | Link `Back to login` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-02 | Email field with live format validation | app/forgot-password/page.tsx:78 | Heading `Forgot password?`; label `Email` (`#email`), placeholder `you@example.com`; error `Please enter a valid email address` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-03 | Send Reset Link submit (disabled until the email is valid) | app/forgot-password/page.tsx:93 | Button `Send Reset Link`; while loading `Sending...` | `POST /auth/forgot-password` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-04 | Request error banner | app/forgot-password/page.tsx:71 | `role="alert"` box with the server message | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-05 | "Check your email" confirmation | app/forgot-password/page.tsx:110 | Heading `Check your email`; text `We've sent a password reset link to` + the email | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-06 | Try again (returns to the form) | app/forgot-password/page.tsx:121 | Button `try again` (inline, lower case) | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-07 | Back to login button on the confirmation | app/forgot-password/page.tsx:128 | Button `Back to login` (the top link with the same text is also still present) | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-08 | Reset page opened without a `token` query parameter | app/reset-password/page.tsx:50 | Text `Invalid or expired reset link. Please request a new password reset.`; button `Request New Reset Link` (goes to `/forgot-password`) | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-09 | New password field with length validation | app/reset-password/page.tsx:100 | Heading `Reset your password`; label `New Password` (`#password`), placeholder `Enter new password`; error `Password must be at least 8 characters`. No show-password toggle | none | Fixed - form now applies the same rules as the server | [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-10 | Confirm password field with mismatch message | app/reset-password/page.tsx:116 | Label `Confirm Password` (`#confirmPassword`), placeholder `Confirm new password`; error `Passwords do not match`. No show-password toggle | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-11 | Reset Password submit | app/reset-password/page.tsx:131 | Button `Reset Password`; while loading `Resetting...` | `POST /auth/reset-password` | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |
| PWD-12 | Reset error banner | app/reset-password/page.tsx:93 | `role="alert"` box: `Invalid or expired reset token` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| PWD-13 | Success message and automatic return to login after 2 seconds | app/reset-password/page.tsx:45, 148 | Heading `Password reset successfully!`; text `Redirecting to login...`; URL becomes `/login` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) |

## 5. Onboarding

File: `app/onboarding/page.tsx` (three steps on one page; not wrapped in the protected-route guard)

### 5.0 Shell (all steps)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ONB-01 | Progress bar, step counter and step labels | app/onboarding/page.tsx:445 | `Step 1 of 3` (2, 3); `33% complete` / `67% complete` / `100% complete`; `role="progressbar"`; step list items `Personal Info`, `Profile Setup`, `Get to Know Me` (current one has `aria-current="step"`) | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-02 | Step heading with Required / Optional chip | app/onboarding/page.tsx:397, 490 | `h1` headings `Personal Info`, `Profile Setup`, `Get to Know Me`; chip `Required` (step 1) or `Optional` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-03 | Error banner | app/onboarding/page.tsx:482 | `role="alert"` box above the Back / Next buttons; photo problems in a `role="alert"` line under the upload box | none | Fixed - messages now appear beside the buttons (and beside the photo box), not out of sight at the top of a long page | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-04 | Back button (disabled on step 1) | app/onboarding/page.tsx:1347 | Button `Back` (steps 2 and 3) | none | Changed - Back is not shown on step 1 (it used to be shown but disabled); works on steps 2 and 3 and keeps every answer | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-05 | Next button (disabled until step 1 is valid) | app/onboarding/page.tsx:1369 | Button `Next`; messages such as `Please enter your first name` | none | Changed - Next is always available; pressing it with required answers missing shows a message under each one and moves to the first (it used to be greyed out with no explanation) | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-06 | Skip to Profile (header; appears once step 1 has been passed) | app/onboarding/page.tsx:433 | Removed | `PUT /auth/complete-onboarding` | Changed - removed: it duplicated "Skip All". One button, `Skip for now`, remains on step 2 | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-07 | Skip All (steps 2 and 3) | app/onboarding/page.tsx:1358 | Button `Skip for now`; helper text explains that it saves what has been entered | `PUT /auth/complete-onboarding` | Changed - renamed `Skip for now` (step 2 only; step 3 has `Complete Setup`, which does the same). Fixed - a failed save was ignored and the member was sent on anyway | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-08 | Complete Setup (step 3) | app/onboarding/page.tsx:1378 | Button `Complete Setup`; while loading `Completing...`; then URL `/profile` | `PUT /auth/complete-onboarding` | Fixed - someone who had logged in before finishing was sent straight back to onboarding after completing it; every value entered is now checked on the saved profile | [onboarding.spec](../tests/e2e/onboarding.spec.ts) [auth.test](../server/tests/auth.test.js) |

### 5.1 Step 1 - Personal Info (required)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ONB-10 | First name (required) | app/onboarding/page.tsx:507 | Label `First Name` (`#first_name`), placeholder `e.g. Mary`; message `Please enter your first name` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-11 | Last name (required) | app/onboarding/page.tsx:517 | Label `Last Name` (`#last_name`), placeholder `e.g. Johnson`; message `Please enter your last name` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-12 | Birthday with 18+ validation | app/onboarding/page.tsx:529 | Label `Birthday` (`#birthdate`, `type="date"`); message `You must be at least 18 years old` | none | Fixed - the age was worked out from a UTC date (a day out around birthdays), and the 18+ rule could be skipped on the server by leaving the date out | [onboarding.spec](../tests/e2e/onboarding.spec.ts) [auth.test](../server/tests/auth.test.js) |
| ONB-13 | Gender choice (4 buttons, single select) | app/onboarding/page.tsx:48, 544 | Group `Gender`; buttons `Male`, `Female`, `Non-binary`, `Prefer not to say` with `aria-pressed` | none | Fixed - the chosen option is now announced (`aria-pressed`) and shown with a tick, in a labelled group | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-14 | State dropdown (required) | app/onboarding/page.tsx:565 | Combobox named `State` (`#location_state`); 50 options. New optional field `City or town` (`#location_city`) beside it | none | Fixed - the label is now tied to the dropdown | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-15 | District dropdown (required) | app/onboarding/page.tsx:584 | Combobox named `District Number` (`#district_number`); options `District 1` to `District 14` | none | Fixed - the label is now tied to the dropdown | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-16 | Agree to Community Guidelines checkbox (required) | app/onboarding/page.tsx:639 | Checkbox `#guidelines`, label `I agree to the Community Guidelines *` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-17 | Read Community Guidelines link | app/onboarding/page.tsx:648 | Button `Read Community Guidelines` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-18 | Community Guidelines dialog (7 sections) and its close button | app/onboarding/page.tsx:1402 | Dialog title `D8-LPA Community Guidelines`; description `Please read and agree to our community guidelines`; section headings `1. Respect & Kindness` to `7. Consequences`; button `I Understand` (plus built-in X `Close`) | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-19 | LPA Membership ID field | app/onboarding/page.tsx:602 | **Not in the UI** - the whole block is commented out | none | Fixed - membership check called an address that did not exist | [auth.test](../server/tests/auth.test.js) |

### 5.2 Step 2 - Profile Setup (optional)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ONB-20 | Bio with 300-character counter | app/onboarding/page.tsx:665 | Label `Short bio about yourself` (`#bio`); counter `{n}/300` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-21 | Interest chips (16, multi-select) | app/onboarding/page.tsx:55, 699 | Group `Pick a few interests/hobbies`; 16 buttons with `aria-pressed` | none | Fixed - chips are larger (44px), say whether they are chosen (`aria-pressed`) and sit in a labelled group | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-22 | Selected-interests summary with remove chips | app/onboarding/page.tsx:682 | Removed | none | Changed - the separate "Selected" box is gone; chosen chips (including ones you add) show a tick in place and are removed by tapping them again | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-23 | Add a custom interest (button or Enter) | app/onboarding/page.tsx:716 | Input labelled `Add your own interest`; button `Add` (accessible name `Add your own interest - add`); Enter also adds | none | Fixed - the box now has a label, and a custom entry cannot be added twice | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-24 | Looking For (Gender) chips; "Everyone" clears the others | app/onboarding/page.tsx:753 | Group `Looking For (Gender)`; buttons `Women`, `Men`, `Non-binary`, `Everyone` with `aria-pressed` | none | Fixed - "Non-binary" was stored with a hyphen and never matched | [onboarding.spec](../tests/e2e/onboarding.spec.ts) [core.test](../server/tests/core.test.js) |
| ONB-25 | What I'm Looking For dropdown | app/onboarding/page.tsx:60, 795 | Combobox named `What I'm Looking For` (`#looking_for_description`) | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-26 | Preferred age range (min / max) | app/onboarding/page.tsx:814 | Inputs labelled `Min Age` (`#age_min`) and `Max Age` (`#age_max`); summary `Age range: {min} - {max}` | none | Fixed - typing an age was rewritten half-way (typing 45 could give 185); boxes are labelled and tidied on leaving them | [onboarding.spec](../tests/e2e/onboarding.spec.ts) [auth.test](../server/tests/auth.test.js) |
| ONB-27 | Life Goals dropdown | app/onboarding/page.tsx:68, 845 | Combobox named `Life Goals` (`#life_goals`) | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-28 | Languages chips (12, multi-select) | app/onboarding/page.tsx:78, 864 | Group `Languages`; 12 buttons with `aria-pressed` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-29 | Cultural background | app/onboarding/page.tsx:891 | Label `Cultural Background` (`#cultural_background`), placeholder `e.g., Italian-American, South Asian, etc.` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-30 | Religion dropdown | app/onboarding/page.tsx:93, 902 | Combobox named `Religion` (`#religion`) | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-31 | Occupation | app/onboarding/page.tsx:921 | Label `Occupation` (`#occupation`), placeholder `e.g. Teacher, nurse, business owner, retired` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-32 | Education | app/onboarding/page.tsx:932 | Label `Education` (`#education`), placeholder `e.g. High school, trade school, college degree` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-33 | Personal preferences with 500-character counter | app/onboarding/page.tsx:943 | Label `Personal Preferences` (`#personal_preferences`), placeholder starts `What are you looking for in a partner?`; counter `{n}/500` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-34 | Favorite music chips (16), selected summary, custom entry | app/onboarding/page.tsx:108, 959 | Group `Favorite Music`; chip buttons; input labelled `Add your own music`; button `Add` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-35 | Favorite animals chips, selected summary, custom entry | app/onboarding/page.tsx:113, 1032 | Group `Favorite Animals`; chip buttons; input labelled `Add your own animal`; button `Add` | none | Fixed - "Ferrets" was listed twice | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-36 | Pet peeves chips (16), selected summary, custom entry | app/onboarding/page.tsx:118, 1105 | Group `Pet Peeves`; chip buttons; input labelled `Add your own pet peeve`; button `Add` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-37 | Profile picture upload | app/onboarding/page.tsx:1178 | Text `Click to upload profile picture`; `input[type="file"]` (use `setInputFiles`); status `Picture added.` | `POST /users/photos` (multipart, field `photo`) | Fixed - the upload box could not be reached with the keyboard, and its note wrongly said a profile without a picture is hidden from others | [onboarding.spec](../tests/e2e/onboarding.spec.ts) [core.test](../server/tests/core.test.js) |
| ONB-38 | Remove the uploaded picture | app/onboarding/page.tsx:1209 | Button `Remove photo` beside `img[alt="Your profile picture"]`; then status text `Picture removed.` | `DELETE /users/photos` | Fixed - the picture is now really deleted from the profile; the button has a visible word | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-39 | Upload validation messages | app/onboarding/page.tsx:337 | `role="alert"` under the upload box: `That file is not a picture we can use...`, `That picture is too large (over 5 MB)...`, or the server's `That file does not look like a picture...` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |

### 5.3 Step 3 - Get to Know Me (optional)

Each prompt is a textarea with a `{n}/500` counter.

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ONB-40 | Prompt: weirdly good at | app/onboarding/page.tsx:1230 | Label `I'm weirdly good at...` (`#prompt_good_at`), placeholder `e.g., Remembering song lyrics from the 90s` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-41 | Prompt: perfect weekend | app/onboarding/page.tsx:1244 | Label `A perfect weekend looks like...` (`#prompt_weekend`), placeholder `e.g., Morning coffee, afternoon hike, evening movie marathon` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-42 | Prompt: message me if | app/onboarding/page.tsx:1258 | Label `You should message me if...` (`#prompt_message`), placeholder `e.g., You want to debate the best pizza toppings` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-43 | Prompt: ideal connection | app/onboarding/page.tsx:1274 | Label `My ideal type of connection is...` (`#hoping_to_find`), placeholder `e.g., Someone who loves spontaneous road trips and deep conversations` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-44 | Prompt: great day | app/onboarding/page.tsx:1288 | Label `A great day for me includes...` (`#great_day`), placeholder `e.g., Good food, laughter, and quality time with someone special` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-45 | Prompt: relationship values | app/onboarding/page.tsx:1302 | Label `In a relationship, I value...` (`#relationship_values`), placeholder `e.g., Honesty, humor, and supporting each other's dreams` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-46 | Prompt: show I care | app/onboarding/page.tsx:1316 | Label `I show I care by...` (`#show_affection`), placeholder `e.g., Thoughtful messages, acts of service, and quality time` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |
| ONB-47 | Prompt: vision for the future | app/onboarding/page.tsx:1330 | Label `My vision for the future is...` (`#build_with_person`), placeholder `e.g., A life full of adventure, growth, and meaningful moments together` | none | Works | [onboarding.spec](../tests/e2e/onboarding.spec.ts) |

## 6. Navigation

### 6.1 Desktop sidebar

File: `components/app-sidebar.tsx` (hidden below the `md` breakpoint)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| NAV-01 | Logo | components/app-sidebar.tsx:73 | Text `D8-LPA` (not a link; text hidden when collapsed) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-02 | Collapse / expand the sidebar (remembered in `localStorage` key `sidebar-storage`) | components/app-sidebar.tsx:82 | Icon-only chevron button with **no accessible name**; first `button` inside `aside` | none | Changed - collapsed icon-only mode removed: every item always has a word beside it | [community.spec](../tests/e2e/community.spec.ts) |
| NAV-03 | Profile link | components/app-sidebar.tsx:35, 103 | Link `Profile` (href `/profile`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-04 | Browse link | components/app-sidebar.tsx:36 | Link `Browse` (href `/browse`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-05 | Messages link with unread badge | components/app-sidebar.tsx:37 | Link `Messages` (href `/messages`); badge number inside the link | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-06 | Matches link with new-match badge | components/app-sidebar.tsx:38 | Link `Matches` (href `/matches`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-07 | Notifications link with unread badge | components/app-sidebar.tsx:39 | Link `Notifications` (href `/notifications`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-08 | Events link with badge | components/app-sidebar.tsx:40 | Link `Events` (href `/events`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-09 | Current page is highlighted | components/app-sidebar.tsx:98, 112 | Active link has classes `bg-primary text-white`; there is no `aria-current` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-10 | Badge rules: capped at `99+` expanded and `9+` collapsed; clicking a link zeroes its badge locally | components/app-sidebar.tsx:106, 123, 133 | Badge text inside the link | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-11 | Collapsed mode: icons only, label in a hover tooltip | components/app-sidebar.tsx:120, 143 | Links have **no accessible name** when collapsed; tooltip text is the label, plus ` ({count})` when there is a badge; locate by `href` | none | Changed - collapsed icon-only mode removed: every item always has a word beside it | [community.spec](../tests/e2e/community.spec.ts) |
| NAV-12 | Admin link (only when `user.role` is `admin`) | components/app-sidebar.tsx:164, 222 | Link `Admin` inside `nav[aria-label="Help and settings"]`, admins only; `aria-current="page"` when open | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| NAV-13 | Settings link | components/app-sidebar.tsx:186, 237 | Link `Settings` (href `/settings`); icon-only with tooltip `Settings` when collapsed | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |

### 6.2 Mobile bottom nav

File: `components/mobile-nav.tsx` (shown below the `md` breakpoint)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| NAV-20 | Browse tab | components/mobile-nav.tsx:33, 74 | Link `Browse` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-21 | Matches tab with badge | components/mobile-nav.tsx:34 | Link `Matches` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-22 | Chat tab with unread badge | components/mobile-nav.tsx:35 | Link `Chat` (href `/messages`; the desktop label is `Messages`) | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-23 | Profile tab | components/mobile-nav.tsx:36 | Link `Profile` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-24 | More button with combined events + notifications badge | components/mobile-nav.tsx:95 | Button `More` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-25 | More sheet | components/mobile-nav.tsx:110 | Sheet title `More`; built-in X named `Close` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-26 | Events item with badge | components/mobile-nav.tsx:40, 120 | Link `Events` inside the sheet | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-27 | Notifications item with badge | components/mobile-nav.tsx:41 | Link `Notifications` inside the sheet | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-28 | Settings item | components/mobile-nav.tsx:42 | Link `Settings` inside the sheet | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-29 | Admin item (admins only) | components/mobile-nav.tsx:142 | Link `Admin` inside the sheet | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| NAV-30 | Badge caps: `9+` on the tab bar, `99+` inside the sheet | components/mobile-nav.tsx:58, 133 | Badge text | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| NAV-31 | Current tab is highlighted | components/mobile-nav.tsx:81 | Active link has class `text-primary`; no `aria-current` | none | Works | [community.spec](../tests/e2e/community.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |

## 7. Browse

File: `app/browse/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| BRW-01 | Page heading | app/browse/page.tsx:288 | Heading `Discover`; text `Find your perfect match` | none | Fixed - heading renamed from "Discover" to match the menu | [screenshots](screenshots/) |
| BRW-02 | Load profiles (6 skeleton cards while loading) | app/browse/page.tsx:103, 460 | Grid of profile cards replaces the skeletons | `GET /browse` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| BRW-03 | State filter (multi-select) | app/browse/page.tsx:300 | Button `State`; menu of `menuitemcheckbox` items, one per US state (`Alabama` ... `Wyoming`) | none (client filter) | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-04 | District filter (multi-select) | app/browse/page.tsx:327 | Button `District`; items `District 1` to `District 15` | none (client filter) | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-05 | Activities filter (multi-select) | app/browse/page.tsx:72, 353 | Button `Activities`; 35 items written in lower case in the DOM (`art`, `astronomy`, ... `yoga`), shown capitalised by CSS | none (client filter) | Fixed - the list was a fixed set that left out most interests offered at sign-up; it is now built from members' real interests (button renamed "Interests") | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-06 | Count badge on each filter button | app/browse/page.tsx:305, 331, 358 | Number inside the `State` / `District` / `Activities` button | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-07 | Clear all filters | app/browse/page.tsx:381 | Button `Clear all` (only when a filter is active) | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-08 | Active-filter chips with a remove X | app/browse/page.tsx:394 | Chip text is the state name, `District {n}`, or the activity; the X inside each chip is an icon-only button with **no accessible name** | none | Fixed - the remove buttons had no names and were tiny | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-09 | Load-error banner with retry | app/browse/page.tsx:445 | Text `Something went wrong` + the error; button `Try again` | `GET /browse` | Fixed - a failed load also showed "No more profiles"; now only the error with Try again | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-10 | Like / unlike error banner | app/browse/page.tsx:445 | Same banner, `Something went wrong` + the error, without the retry button | none | Fixed - error can be dismissed and is announced | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-11 | Empty state, no filters | app/browse/page.tsx:477 | `No more profiles`; `Check back later for new matches!` | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-12 | Empty state, filters active | app/browse/page.tsx:481 | `No profiles match your filters`; `Try adjusting your filters to see more people`; button `Clear Filters` | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-13 | Profile card: photo, name and age, state and district, bio, up to 4 interest badges and a `+N` badge | app/browse/page.tsx:507 | Card image is a link to `/profile/{id}` whose image `alt` is the first name; heading `{first_name}, {age}`; location `{state}, District {n}` | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| BRW-14 | Like a member | app/browse/page.tsx:598 | Button `Like` on the card (spinner with no text while in flight) | `POST /browse/{userId}/like` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| BRW-15 | Liked state and Unlike | app/browse/page.tsx:568 | Button `You Liked This User`; clicking opens a popover with button `Unlike` | `DELETE /browse/liked/{likeId}` | Fixed - "You Liked This User" is now "You like {name}"; Remove like confirms with a message | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-16 | "It's a match" dialog after a mutual like | app/browse/page.tsx:636 | Heading `It's a match!`; text `You and {name} liked each other. Say hello.`; link `Go to Matches`; button `Keep Browsing` | none | Fixed - dialog had no accessible name | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-17 | Show more (12 at a time; also triggers on scroll) | app/browse/page.tsx:175, 622 | Button `Show more profiles` | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |
| BRW-18 | Results count | app/browse/page.tsx:631 | Text `Showing {x} of {y} profiles` | none | Works | [browse.spec](../tests/e2e/browse.spec.ts) |

## 8. Profile view (other member)

File: `app/profile/[id]/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| PRV-01 | Load the member (skeleton while loading); also loads my likes and matches to set the button states | app/profile/[id]/page.tsx:45, 85, 163 | Heading (h1) with the member's first name | `GET /users/{id}`, `GET /browse/liked`, `GET /matches` | Fixed - age was computed from a birth date other members should not receive; one request instead of three | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-02 | Not-found state | app/profile/[id]/page.tsx:182 | `Profile not found`; `This user may have deleted their account.`; button `Go Back` | none | Fixed - load failures and "not available" are now told apart | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-03 | Back button | app/profile/[id]/page.tsx:205 | Button `Back` (browser history back) | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-04 | Main photo, or a person icon when there are no photos | app/profile/[id]/page.tsx:217 | Image with `alt` = first name | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-05 | Header facts: age, city and state, district | app/profile/[id]/page.tsx:239 | Age number; `{city}, {state}`; `District {n}` | none | Fixed - age was computed from a birth date other members should not receive; one request instead of three | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-06 | Like / unlike toggle | app/profile/[id]/page.tsx:142, 268 | Button `Like` (not liked) or `Liked` (liked) | `POST /browse/{id}/like` then `GET /browse/liked`; `DELETE /browse/liked/{likeId}` | Fixed - like result was ignored; a new match was silent | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-07 | Message button (only when matched) | app/profile/[id]/page.tsx:128, 262 | Button `Message`; goes to `/messages?match={matchId}` | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-08 | More menu | app/profile/[id]/page.tsx:287 | Icon-only (three dots) button with **no accessible name**; menu item `Report` | none | Changed - hidden "..." menu replaced by visible Save / Report / Block buttons | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-09 | Report dialog | app/profile/[id]/page.tsx:495, 509 | Heading `Report {first_name}`; text `Tell us what happened. Reports are private and reviewed by our team.`; label `Reason` (`#report-reason`), placeholder `Please describe the issue...` | none | Fixed - shared report dialog with reasons; failures are shown; block added | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-10 | Report dialog: Cancel | app/profile/[id]/page.tsx:531 | Button `Cancel` | none | Fixed - shared report dialog with reasons; failures are shown; block added | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-11 | Report dialog: Submit (disabled while the reason is empty) | app/profile/[id]/page.tsx:132, 534 | Button `Submit Report`; while sending `Submitting...` | `POST /browse/{id}/report` | Fixed - shared report dialog with reasons; failures are shown; block added | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-12 | Report submitted confirmation | app/profile/[id]/page.tsx:497 | `Report submitted`; `Thank you. Our team will review this and take action if needed.`; button `Close` (plus built-in X `Close`) | none | Fixed - shared report dialog with reasons; failures are shown; block added | [community.spec](../tests/e2e/community.spec.ts) |
| PRV-13 | About section | app/profile/[id]/page.tsx:312 | Heading `About`; bio text or `No bio added yet` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-14 | Photo Gallery grid (only with 2+ photos; first 6, `+N` on the sixth) | app/profile/[id]/page.tsx:320 | Heading `Photo Gallery`; images `alt="Photo {n}"`; tiles are clickable `div`s, not buttons | none | Fixed - photo tiles were not reachable by keyboard | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-15 | Photo viewer: close, previous, next, jump dots | app/profile/[id]/page.tsx:435 | All four kinds of control are icon-only buttons with **no accessible name** (the built-in dialog X named `Close` is also present); image `alt="Photo {n}"` | none | Fixed - viewer buttons had no names; arrow keys and a "Photo n of m" line added | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-16 | Details: occupation, education, LPA Member ID, state | app/profile/[id]/page.tsx:368 | Heading `Details`; labels `Occupation`, `Education`, `LPA Member ID`, `State` (each shown only when it has a value) | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-17 | Interests list | app/profile/[id]/page.tsx:414 | Heading `Interests`; badges, or `No interests added yet` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-18 | Favorites: music, animals, pet peeves | app/profile/[id]/page.tsx:548 | Heading `Favorites`; sub-headings contain `Favorite Music`, `Favorite Animals`, `Pet Peeves`; empty text `Not specified` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-19 | What I'm Looking For: connection type, life goals, languages | app/profile/[id]/page.tsx:599 | Heading `What I'm Looking For`; labels `Connection Type`, `Life Goals`, `Languages`; empty text `Not specified` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-20 | Get to Know Me prompts | app/profile/[id]/page.tsx:656 | Heading `Get to Know Me`; `I'm weirdly good at...`, `My perfect weekend...`, `Message me if...`; empty text `Not answered yet` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |
| PRV-21 | About You & Your Future answers | app/profile/[id]/page.tsx:683 | Heading `About You & Your Future`; five question headings starting `What are you hoping to find on this site?`; empty text `Not answered yet` | none | Works | [profile-view.spec](../tests/e2e/profile-view.spec.ts) |

## 9. My profile

File: `app/profile/page.tsx`

### 9.1 View and edit

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| PRO-01 | Load my profile | app/profile/page.tsx:227, 593 | Spinner with text `Loading profile...`, then heading `My Profile` and text `Manage your dating profile` | `GET /users/profile` | Works | [auth.spec](../tests/e2e/auth.spec.ts) |
| PRO-02 | "Complete Your Profile" banner (only when onboarding is not completed) | app/profile/page.tsx:603 | `Complete Your Profile`; `Add more details to your profile to increase your visibility and get more matches.` | none | Changed - banner removed: members who have not finished onboarding are sent to onboarding, so it could never show. Replaced by the completeness helper (NEW-24) | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-03 | Preview button | app/profile/page.tsx:624 | Button `Preview` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-04 | Enter edit mode | app/profile/page.tsx:629 | Button `Edit` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-05 | Cancel edit mode | app/profile/page.tsx:426, 635 | Button `Cancel` | none | Fixed - Cancel restores every field to what is saved, asks before discarding changes, and warns before leaving the page | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-06 | Save profile | app/profile/page.tsx:372, 638 | Button `Save` (spinner icon while saving) | `PUT /users/profile`, then `GET /users/profile` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-07 | Save error banner | app/profile/page.tsx:651 | `We couldn't save your profile` + the error | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-08 | Header card: main photo, name and age, district, state, occupation | app/profile/page.tsx:662 | Heading `{first} {last}, {age}`; `District #{value}`; image `alt` = first name | none | Fixed - district shown as "District #district_3" | [screenshots](screenshots/) |
| PRO-09 | Camera button on the main photo (edit mode) opens the photo manager | app/profile/page.tsx:677 | Icon-only button with **no accessible name** | none | Fixed - camera button had no name ("Change photos") | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-10 | District number (edit mode) | app/profile/page.tsx:696 | Text `District #` next to an input with placeholder `e.g. 5` (no label) | none | Fixed - labelled field; digits only | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-11 | State (edit mode, free text) | app/profile/page.tsx:713 | Input with placeholder `State` (no label) | none | Fixed - labelled field; city or town can now be edited too | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-12 | Occupation in the header (edit mode) | app/profile/page.tsx:731 | Input with placeholder `Occupation (optional)` (no label) | none | Fixed - labelled field | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-13 | Stat card: Total Matches (links to Matches) | app/profile/page.tsx:754 | Link containing `Total Matches` and a number | `GET /matches` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-14 | Stat card: New Messages (links to Messages) | app/profile/page.tsx:770 | Link containing `New Messages` and a number | `GET /messages` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-15 | Stat card: Upcoming Events (links to Events) | app/profile/page.tsx:786 | Link containing `Upcoming Events` and a number | `GET /events` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-16 | About / bio with 500-character counter | app/profile/page.tsx:806 | Card title `About`; edit mode: textarea with placeholder `Tell others about yourself...` (no label), counter `{n}/500` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-17 | Details: occupation | app/profile/page.tsx:896 | Label `Occupation` (not associated); edit mode input with placeholder `Enter your occupation`; view mode value or `Not specified` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-18 | Details: education dropdown | app/profile/page.tsx:915 | Label `Education` (not associated); combobox with placeholder `Select your education level`; options `High school`, `Some college`, `Bachelors`, `Masters`, `Doctorate`, `Trade school`, `Other` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-19 | Interests: selected list with remove X (max 10) | app/profile/page.tsx:951 | Text `Select up to 10 interests or add your own`; `Your Interests ({n}/10)`; each badge has an icon-only X button with **no accessible name** | none | Fixed - remove buttons had no names | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-20 | Interests: add a custom one (button or Enter) | app/profile/page.tsx:975 | Text `Add Custom Interest`; placeholder `Type an interest and press Enter`; button `Add` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-21 | Interests: suggested badges | app/profile/page.tsx:171, 1001 | Text `Suggested Interests`; clickable badges (not buttons) `Travel`, `Music`, ... `Food` | none | Fixed - suggested interests could not be reached by keyboard | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-22 | What I'm Looking For (multi-select badges) | app/profile/page.tsx:78, 1040 | Label `What I'm Looking For`; badges `Serious relationship`, `Casual dating`, `Friendship`, `Not sure yet`, `Prefer not to say`; view mode empty text `Not specified` | none | Fixed - choices could not be reached by keyboard and did not say whether they were selected | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-23 | Life Goals (multi-select badges) | app/profile/page.tsx:86, 1082 | Label `Life Goals`; badges `Career focused`, `Family oriented`, `Adventure seeker`, `Personal growth`, `Work-life balance`, `Making a difference`, `Prefer not to say` | none | Fixed - choices could not be reached by keyboard and did not say whether they were selected | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-24 | Languages (multi-select badges) | app/profile/page.tsx:141, 1124 | Label `Languages`; 13 badges `English` ... `Other` | none | Fixed - choices could not be reached by keyboard and did not say whether they were selected | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-25 | Cultural background | app/profile/page.tsx:1160 | Label `Cultural Background` (not associated); input placeholder `Enter your cultural background`; view empty text `Not specified` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-26 | Religion dropdown | app/profile/page.tsx:157, 1176 | Label `Religion` (not associated); combobox placeholder `Select your religion`; 11 options `Christian` ... `Prefer not to say` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-27 | Personal preferences with 500-character counter | app/profile/page.tsx:1202 | Label `Personal Preferences`; textarea placeholder `Share what you value in a partner and relationship...`; counter `{n}/500` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-28 | Favorite music: badges, custom entries (Enter only), remove custom | app/profile/page.tsx:96, 1238 | Label `Favorite Music`; 15 badges `Pop` ... `Folk`; text `Or add custom:`; placeholder `Add custom music genre or artist...`; custom badges show the value followed by `✕` | none | Fixed - choices could not be reached by keyboard; custom entries can be removed by name | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-29 | Favorite animals: badges, custom entries (Enter only) | app/profile/page.tsx:114, 1316 | Label `Favorite Animals`; 9 badges `Dogs` ... `Snakes`; placeholder `Add custom animal...` | none | Fixed - choices could not be reached by keyboard; custom entries can be removed by name | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-30 | Pet peeves: badges, custom entries (Enter only) | app/profile/page.tsx:126, 1394 | Label `Pet Peeves`; 12 badges `Lateness` ... `Being fake`; placeholder `Add custom pet peeve...` | none | Fixed - choices could not be reached by keyboard; custom entries can be removed by name | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-31 | Prompt: weirdly good at (250 characters) | app/profile/page.tsx:1478 | Label `I'm weirdly good at...` (not associated); placeholder `Share something you're uniquely good at...`; view empty text `Not answered yet` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-32 | Prompt: perfect weekend (250) | app/profile/page.tsx:1496 | Label `My perfect weekend...`; placeholder `Describe your ideal weekend...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-33 | Prompt: message me if (250) | app/profile/page.tsx:1514 | Label `Message me if...`; placeholder `What should someone mention when they message you?` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-34 | Question: hoping to find (250) | app/profile/page.tsx:1536 | Label `What are you hoping to find on this site?`; placeholder `Share what you're looking for...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-35 | Question: great day (250) | app/profile/page.tsx:1554 | Label `What does a great day look like for you?`; placeholder `Describe your ideal day...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-36 | Question: relationship values (250) | app/profile/page.tsx:1572 | Label `What values matter most to you in a relationship?`; placeholder `Share the values that are important to you...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-37 | Question: appreciation or affection (250) | app/profile/page.tsx:1590 | Label `How do you like to show appreciation or affection?`; placeholder `Describe how you express care and appreciation...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-38 | Question: life to build (250) | app/profile/page.tsx:1608 | Label `What kind of life do you want to build with the right person?`; placeholder `Share your vision for the future...` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-39 | Profile preview dialog | app/profile/page.tsx:1745, 1768 | Text `Profile Preview`; shows name and age, state, occupation, bio, `Looking for`, `Interests` (6 + `+N`); close X is icon-only with **no accessible name** (built-in X named `Close` is also present); photo arrows and dots have **no accessible name** | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |

### 9.2 Photos

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| PRO-50 | Photos card and Manage Photos button | app/profile/page.tsx:831 | Card title `Photos`; button `Manage Photos` (available without edit mode) | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-51 | Empty state: add your first photo | app/profile/page.tsx:847 | Button containing `Add your first photo` and `Members with photos get far more responses` | none | Fixed - unsupported claim about responses replaced by a plain reason | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-52 | Photo grid (first 6; blurred `+N` tile when more than 6); any tile opens the manager | app/profile/page.tsx:858 | Images `alt="Photo {n}"`; tiles are clickable `div`s | none | Fixed - photo tiles were not reachable by keyboard | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-53 | Photo manager dialog | app/profile/page.tsx:1627 | Dialog title `Manage Photos`; text starts `Your first photo is your main profile picture.` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-54 | Add a photo (up to 10) | app/profile/page.tsx:529, 1693 | Button `Add Photo`; while uploading `Uploading...`. The file input is created in script and never attached to the page, so use `page.waitForEvent('filechooser')` | `POST /users/photos` (multipart, field `photo`) | Changed - choosing a picture now opens photo tips and a crop step before upload (NEW-25) | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [core.test](../server/tests/core.test.js) |
| PRO-55 | Upload validation messages | app/profile/page.tsx:540 | `That file is not a photo. Please choose a JPG or PNG image.`; `That photo is too large. Please choose an image under 5MB.`; `You can have up to 10 photos. Remove one to add another.` | none | Fixed - the screen allowed 10 photos but the server allows 9, so the tenth always failed; large phone photos are now made smaller instead of refused | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-56 | Remove a photo | app/profile/page.tsx:513, 1660 | Button `aria-label="Remove photo {n}"` | `DELETE /users/photos` (body `{ url }`) | Fixed - removing a photo now asks first | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [core.test](../server/tests/core.test.js) |
| PRO-57 | Move a photo earlier | app/profile/page.tsx:504, 1669 | Button `aria-label="Move photo {n} earlier"` (disabled on the first) | `PUT /users/profile` (body `{ photos }`) then `PUT /users/profile-picture` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [core.test](../server/tests/core.test.js) |
| PRO-58 | Move a photo later | app/profile/page.tsx:1677 | Button `aria-label="Move photo {n} later"` (disabled on the last) | `PUT /users/profile` then `PUT /users/profile-picture` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [core.test](../server/tests/core.test.js) |
| PRO-59 | Drag-and-drop reorder | app/profile/page.tsx:481, 1639 | Each tile is `draggable`; saves on drop | `PUT /users/profile` then `PUT /users/profile-picture` | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-60 | "Main" badge on the first photo | app/profile/page.tsx:1686 | Text `Main` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) [core.test](../server/tests/core.test.js) |
| PRO-61 | Save status line | app/profile/page.tsx:1726 | `Saving...` then `All changes saved` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-62 | Upload / save error line | app/profile/page.tsx:1719 | Red text with the error inside the dialog | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-63 | Empty-manager hint | app/profile/page.tsx:1713 | Text starts `You have no photos yet.` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |
| PRO-64 | Done (close the manager) | app/profile/page.tsx:1736 | Button `Done` | none | Works | [my-profile.spec](../tests/e2e/my-profile.spec.ts) |

## 10. Matches

File: `app/matches/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| MAT-01 | Page heading and counts | app/matches/page.tsx:432 | Heading `Matches & Likes`; text `{n} active match` or `{n} active matches`, then `• {m} profiles you liked` | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| MAT-02 | Load matches and liked profiles (skeletons while loading); visiting clears the Matches nav badge | app/matches/page.tsx:82 | Cards replace the skeletons; `localStorage` key `lastViewedMatches` is set | `GET /matches`, `GET /browse/liked` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| MAT-03 | Main tab: Matches | app/matches/page.tsx:444 | Tab `Matches` | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| MAT-04 | Main tab: Profiles You Liked | app/matches/page.tsx:448 | Tab `Profiles You Liked` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-05 | Search matches by first name | app/matches/page.tsx:461 | Placeholder `Search matches...` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-06 | Sort matches | app/matches/page.tsx:468 | Combobox (no label); options `Most Recent`, `Alphabetical` | none | Fixed - sort box had no name | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-07 | Sub-tab: Active Matches | app/matches/page.tsx:487 | Button `Active Matches ({n})` (a plain button, not `role="tab"`) | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-08 | Sub-tab: History | app/matches/page.tsx:499 | Button `History ({n})` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-09 | Match card: avatar, name and age, last message, matched date | app/matches/page.tsx:316 | Heading `{first_name}, {age}`; last message or `Start a conversation!`; `Today` / `Yesterday` / `{n} days ago` / a date | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| MAT-10 | Card: open the member's profile | app/matches/page.tsx:340 | Link `Profile` (href `/profile/{id}`) | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-11 | Card: message (active matches) | app/matches/page.tsx:352 | Link `Message` (href `/messages?match={matchId}`) | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-12 | Card: view chat (history) | app/matches/page.tsx:364 | Link `View Chat` (href `/messages?match={matchId}`) | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-13 | Card options menu | app/matches/page.tsx:275 | Button `aria-label="Options for {first_name}"` | none | Fixed - the options button now has the word "Options" | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-14 | Menu: Unmatch (active matches only; no confirmation) | app/matches/page.tsx:174, 288 | Menu item `Unmatch`; the card moves to History | `DELETE /matches/{matchId}` | Fixed - Unmatch asks first ("Keep match" is the safe choice) and confirms afterwards. No Undo: the server removes both members' likes and only the other member can give theirs back | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-15 | Menu: Block | app/matches/page.tsx:298 | Menu item `Block` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) [core.test](../server/tests/core.test.js) |
| MAT-16 | Block dialog: confirm | app/matches/page.tsx:212, 624 | Title `Block {first_name}?`; text starts `They will be removed from your matches`; button `Block`; while sending `Blocking...` | `POST /browse/{userId}/block` | Works | [matches.spec](../tests/e2e/matches.spec.ts) [core.test](../server/tests/core.test.js) |
| MAT-17 | Block dialog: cancel | app/matches/page.tsx:640 | Button `Cancel` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-18 | Menu: Report | app/matches/page.tsx:305 | Menu item `Report` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) [core.test](../server/tests/core.test.js) |
| MAT-19 | Report dialog: reason and submit | app/matches/page.tsx:227, 650 | Title `Report {first_name}`; textarea placeholder `Please describe the issue...` (no label); button `Submit Report`; while sending `Submitting...` | `POST /browse/{userId}/report` | Fixed - the reason box had no name | [matches.spec](../tests/e2e/matches.spec.ts) [core.test](../server/tests/core.test.js) |
| MAT-20 | Report dialog: cancel | app/matches/page.tsx:671 | Button `Cancel` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-21 | Report submitted confirmation | app/matches/page.tsx:685 | `Report submitted`; `Thank you for helping keep our community safe.`; button `Close` (plus built-in X `Close`) | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-22 | Error text inside the block / report dialog | app/matches/page.tsx:636, 667 | Red text with the server message | none | Fixed - errors inside the dialogs are announced | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-23 | Empty state: no active matches | app/matches/page.tsx:407 | `No matches yet`; `Start browsing profiles to find your matches`; link `Start Browsing` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-24 | Empty state: no history | app/matches/page.tsx:399 | `No match history`; `Unliked matches will appear here` | none | Fixed - wording ("People you have unmatched will appear here") | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-25 | Empty state: search with no results | app/matches/page.tsx:384 | `No results found`; `No matches found for "{query}"` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-26 | Liked-profile card: photo, Liked / Super Liked badge, name and age, city, bio, liked date | app/matches/page.tsx:534 | Image link to `/profile/{id}` (`alt` = first name); badge `Liked` or `Super Liked`; text `Liked Today` etc. | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-27 | Liked card: open profile | app/matches/page.tsx:585 | Link `Profile` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-28 | Liked card: unlike (no confirmation) | app/matches/page.tsx:101, 596 | Icon-only (crossed heart) button with **no accessible name** | `DELETE /browse/liked/{likeId}`, then `GET /matches` | Fixed - button now says "Remove like" and asks first. No Undo: liking again would send the other member a second notice | [matches.spec](../tests/e2e/matches.spec.ts) |
| MAT-29 | Empty state: no likes | app/matches/page.tsx:610 | `No likes yet`; `Start browsing to like profiles`; link `Browse Profiles` | none | Works | [matches.spec](../tests/e2e/matches.spec.ts) |

## 11. Messages / chat

File: `app/messages/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| MSG-01 | Load the conversation list (skeleton rows while loading) | app/messages/page.tsx:286, 643 | Heading `Messages`; one button per conversation | `GET /messages` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-02 | Search conversations by first name | app/messages/page.tsx:632 | Placeholder `Search conversations...` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-03 | Conversation row: avatar, name, last message, time, unread count | app/messages/page.tsx:657 | Button containing the first name; preview text or `Start a conversation`; time like `5m`, `2h`, `3d`; unread number on the avatar | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-04 | Select a conversation (URL becomes `/messages?match={id}`, unread badge cleared) | app/messages/page.tsx:412 | Click the row; chat header shows the name | `GET /messages/{matchId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-05 | Deep link `?match={id}` and auto-select of the first conversation on load | app/messages/page.tsx:246, 292 | Open `/messages?match={id}`; that thread is shown | `GET /messages/{matchId}` | Fixed - a chat no longer re-opens itself when the list changes | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-06 | Empty state: no conversations | app/messages/page.tsx:713 | `No conversations yet`; `Match with someone to start chatting` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-07 | Empty state: search with no results | app/messages/page.tsx:705 | `No results for "{query}"` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-08 | Placeholder when nothing is selected (desktop) | app/messages/page.tsx:1083 | `Select a conversation`; `Choose a chat from the sidebar to start messaging` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-09 | Chat header: avatar and name | app/messages/page.tsx:742 | Heading (h2) with the first name | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-10 | Back to the list (mobile only) | app/messages/page.tsx:733 | Icon-only chevron button with **no accessible name**; first button in the chat header | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-11 | Chat options menu | app/messages/page.tsx:757 | Icon-only (three dots) button with **no accessible name**; last button in the chat header | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-12 | Menu: View Profile | app/messages/page.tsx:764 | Menu item `View Profile`; goes to `/profile/{userId}` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-13 | Menu: Unmatch (hidden once unmatched) | app/messages/page.tsx:767 | Menu item `Unmatch` | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-14 | Unmatch dialog: confirm | app/messages/page.tsx:547, 1153 | Title `Unmatch with {first_name}?`; text starts `You will still be able to read your past messages`; button `Unmatch`; while sending `Unmatching...` | `DELETE /matches/{matchId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-15 | Unmatch dialog: cancel | app/messages/page.tsx:1166 | Button `Cancel` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-16 | Menu: Delete Conversation | app/messages/page.tsx:772 | Menu item `Delete Conversation` | none | Fixed - renamed "Clear conversation"; failures shown; stays cleared after reload | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-17 | Delete Conversation dialog: confirm | app/messages/page.tsx:510, 1192 | Title `Delete Conversation`; text `Are you sure you want to delete this conversation with {first_name}?`; note starts `Note: This will only delete the conversation on your end.`; button `Delete Conversation`; while sending `Deleting...` | `DELETE /messages/{matchId}` | Fixed - renamed "Clear conversation"; failures shown; stays cleared after reload | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-18 | Delete Conversation dialog: cancel | app/messages/page.tsx:1213 | Button `Cancel` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-19 | Menu: Report & Block | app/messages/page.tsx:778 | Menu item `Report & Block` | none | Fixed - Report and Block are separate; a report is always filed; block has Undo | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-20 | Report & Block dialog: reason | app/messages/page.tsx:1098 | Title `Report & Block User`; text `Report {first_name} for inappropriate behavior`; label `Reason for reporting (optional)` (`#report-reason`), placeholder `Please describe the issue...` | none | Fixed - Report and Block are separate; a report is always filed; block has Undo | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-21 | Report & Block dialog: "just block" checkbox | app/messages/page.tsx:1121 | Checkbox `#block-only`, label `Just block without reporting` | none | Fixed - Report and Block are separate; a report is always filed; block has Undo | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-22 | Report & Block dialog: confirm | app/messages/page.tsx:578, 1142 | Button `Report & Block`, or `Block User` when the checkbox is ticked | `POST /browse/{userId}/report` (only when a reason is typed and the checkbox is off), then `POST /browse/{userId}/block` | Fixed - Report and Block are separate; a report is always filed; block has Undo | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-23 | Report & Block dialog: cancel | app/messages/page.tsx:1132 | Button `Cancel` | none | Fixed - Report and Block are separate; a report is always filed; block has Undo | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-24 | Load a thread (also marks it read on the server) | app/messages/page.tsx:317 | Message bubbles appear | `GET /messages/{matchId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-25 | Date dividers | app/messages/page.tsx:499, 804 | `Today`, `Yesterday`, or e.g. `Monday, Sep 28` | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-26 | Message bubble: own on the right, theirs on the left with avatar on the last of a run; time under the text | app/messages/page.tsx:829 | Message text; time like `09:41 PM` | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-27 | Empty thread | app/messages/page.tsx:794 | `No messages yet. Start the conversation!` | none | Fixed - empty chat now offers conversation starters | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-28 | Message input | app/messages/page.tsx:1058 | Placeholder `Type a message...` (no label) | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-29 | Send (button or Enter; disabled when empty) | app/messages/page.tsx:423, 1065 | Button with screen-reader name `Send message` | `POST /messages/{matchId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-30 | Send failure: bubble removed, text restored, error shown | app/messages/page.tsx:463, 1010 | Red line above the input with the error, or `Your message could not be sent. Please try again.` | none | Fixed - failed message stays in the thread with Try again | [chat.spec](../tests/e2e/chat.spec.ts) |
| MSG-31 | Emoji picker | app/messages/page.tsx:114, 1017 | Button with screen-reader name `Add emoji`; popover text `Emojis`; groups `Smileys`, `Gestures`, `Fun`; each emoji is a button whose name is the emoji itself; picking one appends it and closes the popover | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-32 | Edit my message: open the editor | app/messages/page.tsx:329, 959 | Button `Edit` under my own bubble | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-33 | Edit my message: save (button or Enter) | app/messages/page.tsx:341, 899 | Label `Edit your message` (`#edit-{messageId}`); button `Save Changes`; while saving `Saving...` | `PUT /messages/{matchId}/{messageId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-34 | Edit my message: cancel (button or Escape) | app/messages/page.tsx:336, 890 | Button `Cancel` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-35 | "Edited" marker | app/messages/page.tsx:948 | Text `Edited` next to the time | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-36 | Unsend my message: open the confirmation | app/messages/page.tsx:968 | Button `Unsend` under my own bubble | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-37 | Unsend dialog: confirm | app/messages/page.tsx:378, 1243 | Title `Unsend Message`; text starts `This removes the message text for both of you.`; a preview of the message; button `Unsend`; while sending `Unsending...` | `DELETE /messages/{matchId}/{messageId}` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-38 | Unsend dialog: cancel | app/messages/page.tsx:1269 | Button `Cancel` | none | Works | [chat-more.spec](../tests/e2e/chat-more.spec.ts) |
| MSG-39 | Unsent tombstone | app/messages/page.tsx:926 | `You unsent a message` or `{first_name} unsent a message` | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-40 | Unmatched thread is read-only | app/messages/page.tsx:998 | Text `No Longer Matched - You can view past messages but cannot send new ones`; no input, no `Edit` / `Unsend` buttons | none | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-41 | Incoming message arrives live (second browser context) | app/messages/page.tsx:155 | New bubble appears without reload; list preview and unread count update | socket event `new-message` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-42 | Edit / unsend by the other person arrives live | app/messages/page.tsx:199 | Bubble text changes in place, or becomes the tombstone | socket event `message-updated` | Works | [chat.spec](../tests/e2e/chat.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| MSG-43 | Mobile layout: the list hides while a thread is open, and the reverse | app/messages/page.tsx:623, 725 | At a mobile viewport only one of the two panes is visible | none | Fixed - two-pane layout only from 1024px | [screenshots](screenshots/) |

## 12. Notifications

File: `app/notifications/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| NOT-01 | Load notifications (5 skeleton rows while loading) | app/notifications/page.tsx:50, 244 | Heading `Notifications`; one card per notification | `GET /notifications` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| NOT-02 | Opening the page marks everything read automatically | app/notifications/page.tsx:39 | After load the summary reads `All caught up!` and the nav badge clears | `PUT /notifications/mark-all-read` | Fixed - opening the page no longer marks anything read; items are read when opened or marked, with "Mark all as read" | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-03 | Unread summary line | app/notifications/page.tsx:212 | `You have {n} unread notification` / `notifications`, or `All caught up!` | none | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-04 | Mark all as read button (only while something is unread) | app/notifications/page.tsx:202 | Button `Mark all as read` | `PUT /notifications/mark-all-read` | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) [core.test](../server/tests/core.test.js) |
| NOT-05 | Filter: All, with count | app/notifications/page.tsx:221 | Button `All` followed by the count | none | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-06 | Filter: Unread, with count | app/notifications/page.tsx:231 | Button `Unread` followed by the count | none | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-07 | Notification card: icon, type badge, title, message, relative date | app/notifications/page.tsx:267 | Type badge is the server type capitalised (`Match`, `Like`, `Message`, `Event`, `News`, `System`); date `Recently`, `Today`, `Yesterday`, `{n} Days Ago` | none | Fixed - real times ("5 minutes ago", "Yesterday at 3:15 PM") instead of "Recently"; unread items carry the word "New" | [notifications.spec](../tests/e2e/notifications.spec.ts) [community.spec](../tests/e2e/community.spec.ts) |
| NOT-08 | Click a card to open what it is about (message thread, Matches, the liker's profile, Events) | app/notifications/page.tsx:164, 183 | Click the card (a `div`, not a link or button); URL becomes `/messages?match={id}`, `/matches`, `/profile/{id}` or `/events`. `News` and `System` cards do nothing | `PUT /notifications/{id}/read` when unread | Fixed - each card has a real link ("Open the conversation", "See the event"...) instead of a clickable box | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-09 | Mark one notification read | app/notifications/page.tsx:308 | Button `aria-label="Mark as read"` (only on unread cards) | `PUT /notifications/{id}/read` | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) [core.test](../server/tests/core.test.js) |
| NOT-10 | Delete one notification (no confirmation) | app/notifications/page.tsx:321 | Button `aria-label="Delete notification"` | `DELETE /notifications/{id}` | Fixed - Delete has a word and an Undo | [notifications.spec](../tests/e2e/notifications.spec.ts) [core.test](../server/tests/core.test.js) |
| NOT-11 | Empty state, All | app/notifications/page.tsx:250 | `No notifications`; `No notifications yet. You will be notified here when you get matches, messages, likes, and more.` | none | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-12 | Empty state, Unread | app/notifications/page.tsx:256 | `No notifications`; `You're all caught up! No unread notifications.` | none | Works | [notifications.spec](../tests/e2e/notifications.spec.ts) |
| NOT-13 | Unread cards are visually distinct | app/notifications/page.tsx:273, 292 | Unread card has classes `border-primary/50 bg-primary/5` and a bold title | none | Fixed - unread is shown by the word "New", not by colour alone | [notifications.spec](../tests/e2e/notifications.spec.ts) |

## 13. Events

File: `app/events/page.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| EVT-01 | Load events (full-page spinner while loading) | app/events/page.tsx:170, 237 | Text `Loading events...`, then heading `Events` and text `Meet new people at local events` | `GET /events` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| EVT-02 | Visiting clears the Events badge and marks event notifications read | app/events/page.tsx:102 | Events nav badge disappears | `GET /notifications`, then `PUT /notifications/{id}/read` for each unread event notification | Fixed - the Events badge could come back after it was cleared | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-03 | Tab: Upcoming Events | app/events/page.tsx:263 | Button `Upcoming Events` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-04 | Tab: Past Events | app/events/page.tsx:269 | Button `Past Events` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-05 | Search by title or location | app/events/page.tsx:282 | Placeholder `Search events...` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-06 | Filters button with active-filter count | app/events/page.tsx:289 | Button `Filters` (count badge inside when filters are set) | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-07 | Filter: event type | app/events/page.tsx:44, 313 | In the popover: label `Event Type` (not associated); combobox with options `All Types`, `Local Chapter`, `Regional`, `National` | none | Fixed - filter compared a field that does not exist and hid every event | [community.spec](../tests/e2e/community.spec.ts) |
| EVT-08 | Filter: from date | app/events/page.tsx:333 | Label `From` (not associated); first `input[type="date"]` in the popover | none | Fixed - "From" let in the previous evening's events (date read as London midnight); labelled | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-09 | Filter: to date | app/events/page.tsx:342 | Label `To` (not associated); second `input[type="date"]` in the popover | none | Fixed - "To" left out events on the chosen day; labelled | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-10 | Apply Filters (closes the popover; filters already apply live) | app/events/page.tsx:354 | Button `Apply Filters` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-11 | Clear all filters (inside the popover) | app/events/page.tsx:305 | Button `Clear all` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-12 | Active-filter chips with a remove X | app/events/page.tsx:363 | Chip text: the type label, `From: {date}`, `To: {date}`; the X is an icon-only button with **no accessible name** | none | Fixed - date chips showed the day before; remove buttons had no names | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-13 | Event card: image or calendar placeholder, badges, title, date, time, location, attendance | app/events/page.tsx:397 | Heading with the title; badges for the category, `Cancelled`, `Attending`; text `{n} attending` or `{n} / {max} attending`. The card is a clickable `div` | none | Fixed - cards could not be opened by keyboard | [events-more.spec](../tests/e2e/events-more.spec.ts) [community.spec](../tests/e2e/community.spec.ts) |
| EVT-14 | Event details dialog | app/events/page.tsx:505 | Dialog title = event title; description; `{date} at {time}`; location; attendance; built-in X `Close` | none | Works | [community.spec](../tests/e2e/community.spec.ts) |
| EVT-15 | Join an event | app/events/page.tsx:179, 585 | Button `Join Event` | `POST /events/{id}/join` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| EVT-16 | Leave an event | app/events/page.tsx:585 | Button `Leave Event` | `POST /events/{id}/leave` | Works | [community.spec](../tests/e2e/community.spec.ts) |
| EVT-17 | Join / leave error inside the dialog | app/events/page.tsx:570 | Red text: `Event is full`, `Event has been cancelled`, `Already joined this event` | none | Fixed - an error from one event stayed on screen for the next one opened | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-18 | Cancelled event is read-only | app/events/page.tsx:576 | Text `This event has been cancelled.`; no join button | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) [core.test](../server/tests/core.test.js) |
| EVT-19 | Past event is read-only | app/events/page.tsx:580 | Text `This event has already taken place.`; no join button | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-20 | "Attending" highlight on joined events | app/events/page.tsx:401, 444 | Badge `Attending`; card has class `ring-2 ring-primary` | none | Changed - badge now reads "You're going" | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-21 | Empty state: upcoming | app/events/page.tsx:491 | `No upcoming events`; `Check back later for upcoming events` | none | Fixed - a failed load looked like "No upcoming events" | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-22 | Empty state: past | app/events/page.tsx:494 | `No past events`; `Past events will appear here` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |
| EVT-23 | Empty state: search with no results | app/events/page.tsx:482 | `No events found`; `No events match "{query}"` | none | Works | [events-more.spec](../tests/e2e/events-more.spec.ts) |

## 14. Settings

File: `app/settings/page.tsx`. Toggles, Looking For and the age range are only sent to the server when **Save Changes** is pressed.

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| SET-01 | Load my settings | app/settings/page.tsx:125 | Heading `Settings`; text `Manage your app preferences`; switches reflect the saved values | `GET /settings` | Fixed - a failed load no longer shows defaults that could be saved over the real settings | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-02 | Save Changes (appears after any change) | app/settings/page.tsx:157, 426 | Button `Save Changes`; while saving `Saving...` | `PUT /settings` | Changed - no Save button: every change saves itself | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-03 | "Saved" confirmation (3 seconds) | app/settings/page.tsx:446 | Text `Saved` | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-04 | Save error toast | app/settings/page.tsx:164 | Toast with the server message | none | Fixed - a failed load no longer shows defaults that could be saved over the real settings | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-05 | Notification toggle: New Matches | app/settings/page.tsx:466 | Switch `#matches`, label `New Matches`; help `Get notified when you match with someone`; state text `On` / `Off` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-06 | Notification toggle: Messages | app/settings/page.tsx:485 | Switch `#messages`, label `Messages`; help `Get notified when you receive a message` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-07 | Notification toggle: Likes | app/settings/page.tsx:504 | Switch `#likes`, label `Likes`; help `Get notified when someone likes your profile` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-08 | Notification toggle: Events | app/settings/page.tsx:523 | Switch `#events`, label `Events`; help `Get notified about event updates` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-09 | Notification toggle: Admin Announcements | app/settings/page.tsx:542 | Switch `#admin_news`, label `Admin Announcements`; help `Get notified about admin news and announcements` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-10 | Notification Sound toggle (takes effect immediately; plays the chime when switched on) | app/settings/page.tsx:319, 561 | Switch `#sound`, label `Notification Sound`; help starts `Play a chime when a message or alert arrives` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-11 | Test the chime (disabled while sound is off) | app/settings/page.tsx:331, 570 | Button `Test` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-12 | Looking For: Women | app/settings/page.tsx:607 | Checkbox `#lookingFor-female`, label `Women`; card title `Looking For`; help `Choose who you want to see in Browse` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-13 | Looking For: Men | app/settings/page.tsx:609 | Checkbox `#lookingFor-male`, label `Men` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-14 | Looking For: Non-binary | app/settings/page.tsx:610 | Checkbox `#lookingFor-non-binary`, label `Non-binary` | none until Save | Fixed - "Non-binary" was dropped / never matched | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-15 | Looking For: Everyone (clears the other three) | app/settings/page.tsx:349, 611 | Checkbox `#lookingFor-everyone`, label `Everyone`; note `Selecting "Everyone" will clear other selections.` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-16 | Age range: minimum | app/settings/page.tsx:659 | Label `Minimum Age` (`#ageMin`, `type="number"`) | none until Save | Fixed - boxes fought the keyboard | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-17 | Age range: maximum, and summary line | app/settings/page.tsx:671 | Label `Maximum Age` (`#ageMax`, `type="number"`); text `Age range: {min} - {max}` | none until Save | Fixed - boxes fought the keyboard | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-18 | Privacy: Profile Visibility | app/settings/page.tsx:701 | Switch `#profileVisible`, label `Profile Visibility`; help starts `Make your profile visible in Browse.` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-19 | Privacy: Selective Mode | app/settings/page.tsx:720 | Switch `#selectiveMode`, label `Selective Mode`; help starts `Only show your profile to users you have liked.` | none until Save | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-20 | View Blocked Users | app/settings/page.tsx:391, 753 | Button `View Blocked Users` | `GET /browse/blocked-list` | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-21 | Blocked Users dialog: list | app/settings/page.tsx:1034 | Dialog title `Blocked Users`; description `You have blocked {n} user` / `users`; each row `{first} {last}` and `Blocked on {date}`; only the built-in X `Close` closes it | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-22 | Unblock a member | app/settings/page.tsx:396, 1085 | Button `Unblock`; while sending `Unblocking...` | `DELETE /browse/{userId}/unblock` | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-23 | Blocked Users dialog: empty state | app/settings/page.tsx:1042, 1052 | Description `You haven't blocked anyone yet`; text `No blocked users` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-24 | Blocked Users error toasts | app/settings/page.tsx:380, 402 | Toast starting `Error loading blocked users` or `Error unblocking user` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-25 | Contact Us email link | app/settings/page.tsx:779 | Card title `Contact Us`; text `Email Support`; link `d8lpa.community@gmail.com` (`mailto:`) | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-26 | Terms & Privacy Policy row | app/settings/page.tsx:799 | Button `Terms & Privacy Policy` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-27 | Terms & Privacy Policy dialog | app/settings/page.tsx:1112 | Dialog title `Terms & Privacy Policy`; headings `Terms of Service`, `Privacy Policy`; text `Last updated: February 2026`; button `Close` (plus built-in X `Close`) | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-28 | Change Password row | app/settings/page.tsx:809 | Button `Change Password` | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-29 | Change Password dialog: current password | app/settings/page.tsx:1225, 1257 | Dialog title `Change Your Password`; label `Current Password *` (`#current-password`), placeholder `Enter your current password`. No show-password toggle | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-30 | Change Password dialog: new password with length hint | app/settings/page.tsx:1272 | Label `New Password *` (`#new-password`), placeholder `Enter a new password (min 8 characters)`; hint `Password must be at least 8 characters`. No show-password toggle | none | Fixed - rules now match the server | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-31 | Change Password dialog: confirm with match indicator | app/settings/page.tsx:1290 | Label `Confirm New Password *` (`#confirm-password`), placeholder `Confirm your new password`; `Passwords match` / `Passwords do not match`. No show-password toggle | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-32 | Change Password dialog: client-side validation messages | app/settings/page.tsx:244 | Red box: `Current password is required`, `New password is required`, `New password must be at least 8 characters`, `New passwords do not match`, `New password must be different from current password` | none | Fixed - rules now match the server | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-33 | Change Password dialog: submit | app/settings/page.tsx:239, 1324 | Button `Change Password`; while sending `Changing...`; success box `Password changed successfully!`, dialog closes after 2 seconds | `POST /auth/change-password` | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| SET-34 | Change Password dialog: server error | app/settings/page.tsx:1246 | Red box with the server message, e.g. `Your current password is not right. Please try again.` (working-tree backend; the committed backend says `Current password is incorrect` and signs the member out, see defect 38) | none | Fixed - changing password used to lock the member out (double hashing) | [settings.spec](../tests/e2e/settings.spec.ts) [auth.test](../server/tests/auth.test.js) |
| SET-35 | Change Password dialog: cancel | app/settings/page.tsx:1317 | Button `Cancel` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| SET-36 | Version footer | app/settings/page.tsx:855 | Text `D8-LPA v1.0.0` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |

## 15. Theme

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| THM-01 | Dark / light theme switch | components/theme-provider.tsx:9; app/layout.tsx:44; app/settings/page.tsx:98 | **Not in the UI.** `ThemeProvider` is defined but never mounted in `app/layout.tsx`; the settings page holds `theme: "light"` in state but renders no control for it. `dark:` classes exist in the pages but nothing sets the `dark` class | none | Fixed - there was no theme switch; Light / Dark / Same as my device added | [settings.spec](../tests/e2e/settings.spec.ts) |
| THM-02 | Favicon follows the operating-system colour scheme | app/layout.tsx:19 | `<link rel="icon">` entries with `media="(prefers-color-scheme: light)"` / `dark` | none | Changed - single icon set for the installable app |  |

## 16. Account (take a break / delete)

File: `app/settings/page.tsx` ("More" card)

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ACC-01 | Take a Break row | app/settings/page.tsx:826 | Button containing `Take a Break (Disable Account)` and `Hide your profile. Log back in any time to reactivate.` | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-02 | Disable dialog: reason (optional) | app/settings/page.tsx:860, 877 | Dialog title `Disable Your Account`; note starts `Note: You can reactivate your account anytime`; label `Why are you disabling your account? (optional)` (`#disable-reason`), placeholder `Help us improve by telling us why...` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| ACC-03 | Disable dialog: password | app/settings/page.tsx:889 | Label `Enter your password to confirm` (`#disable-password`), placeholder `••••••••`. No show-password toggle | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-04 | Disable dialog: "I'm sure" checkbox | app/settings/page.tsx:902 | Checkbox `#disable-confirm`, label `I understand that my profile will be hidden and I'm 100% sure I want to disable my account` | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-05 | Disable dialog: confirm (disabled until password typed and box ticked) | app/settings/page.tsx:175, 924 | Button `Disable Account`; while sending `Disabling...`; toast `Your account has been disabled. You will be logged out.`; URL becomes `/login` | `POST /settings/disable` | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-06 | Disable dialog: cancel | app/settings/page.tsx:913 | Button `Cancel` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| ACC-07 | A disabled account is signed out of other open sessions on their next request | lib/api.ts:73; server/src/middleware/auth.js:38 | In a second context any API call redirects to `/login` | n/a | Works (API test - nothing more to click) | [core.test](../server/tests/core.test.js) |
| ACC-08 | Delete Account row | app/settings/page.tsx:841 | Button `Delete Account` (red) | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-09 | Delete dialog: warning and reason (optional) | app/settings/page.tsx:944, 967 | Dialog title `Delete Your Account`; text `This will permanently delete your account and all associated data. This action cannot be undone.`; link `d8lpa.community@gmail.com`; label `Why are you deleting your account? (optional)` (`#delete-reason`) | none | Fixed - wording now says what really happens (the account is closed, not erased) | [screenshots](screenshots/) |
| ACC-10 | Delete dialog: password | app/settings/page.tsx:979 | Label `Enter your password to confirm` (`#delete-password`), placeholder `••••••••`. No show-password toggle | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-11 | Delete dialog: "I'm sure" checkbox | app/settings/page.tsx:992 | Checkbox `#delete-confirm`, label `I understand this is permanent and I'm 100% sure I want to delete my account` | none | Works | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-12 | Delete dialog: confirm (disabled until password typed and box ticked) | app/settings/page.tsx:207, 1014 | Button `Delete Account Permanently`; while sending `Deleting...`; toast `Your account has been deleted. You will be logged out.`; URL becomes `/login` | `POST /settings/delete` | Fixed - a wrong password no longer closes the dialog and wipes what was typed | [settings.spec](../tests/e2e/settings.spec.ts) |
| ACC-13 | Delete dialog: cancel | app/settings/page.tsx:1003 | Button `Cancel` | none | Works | [settings-more.spec](../tests/e2e/settings-more.spec.ts) |
| ACC-14 | A deleted account can no longer log in | server/src/routes/auth.js:278 | Login error `Your account has been deleted. Please contact d8lpa.community@gmail.com if you believe this is an error.` | `POST /auth/login` | Works | [settings.spec](../tests/e2e/settings.spec.ts) |

## 17. Admin

File: `app/admin/page.tsx` (three tabs: Users, Events, News)

### 17.0 Access and tabs

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ADM-01 | Non-admin is refused | app/admin/page.tsx:147 | `Access Denied`; `You don't have admin privileges.`; button `Return to Browse` | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [auth.spec](../tests/e2e/auth.spec.ts) [core.test](../server/tests/core.test.js) |
| ADM-02 | Admin panel heading | app/admin/page.tsx:700 | Heading `Admin Panel`; text `Manage users, events, and take moderation actions` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-03 | Tab: Users (default) | app/admin/page.tsx:711 | Tab `Users` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-04 | Tab: Events | app/admin/page.tsx:715 | Tab `Events` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-05 | Tab: News | app/admin/page.tsx:719 | Tab `News` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |

### 17.1 Users tab

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ADM-10 | Load all users | app/admin/page.tsx:223 | Card title `User Management`; one row per user | `GET /admin/users` | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-11 | Search users by name, email or ID | app/admin/page.tsx:731 | Placeholder `Search users by name, email, or ID...` | none (client filter) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-12 | Stat card / filter: Total Users | app/admin/page.tsx:743 | Clickable card (a `div`) with the count and text `Total Users` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-13 | Stat card / filter: Active | app/admin/page.tsx:755 | Clickable card with text `Active` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-14 | Stat card / filter: Suspended | app/admin/page.tsx:769 | Clickable card with text `Suspended` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-15 | Stat card / filter: Banned | app/admin/page.tsx:783 | Clickable card with text `Banned` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-16 | User row: avatar, name, status badge, email, joined and last-active dates | app/admin/page.tsx:298, 807 | Status badge `Active`, `Warned ({n})`, `Suspended` or `Banned`; text `Joined {date}` and `Last active {date}` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-17 | Actions menu on a user row | app/admin/page.tsx:833 | Button `Actions` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-18 | Warn a user | app/admin/page.tsx:311, 841 | Menu item `Warning` (shows the current warning count); dialog title `Issue Warning`; label `Reason for action` (`#reason`), placeholder `Provide a reason for this action...`; button `Confirm` | `POST /admin/users/{id}/action` (`action: "warn"`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-19 | Suspend a user | app/admin/page.tsx:855 | Menu item `Suspend`; dialog title `Suspend User`; reason; button `Confirm` | `POST /admin/users/{id}/action` (`action: "suspend"`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-20 | Unsuspend a user (immediate, no dialog) | app/admin/page.tsx:420, 857 | On a suspended user the same menu item `Suspend` shows a tick; clicking it lifts the suspension | `POST /admin/users/{id}/action` (`action: "unsuspend"`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-21 | Ban a user | app/admin/page.tsx:874 | Menu item `Ban`; dialog title `Ban User`; reason; button `Confirm` | `POST /admin/users/{id}/action` (`action: "ban"`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-22 | Unban a user (immediate, no dialog) | app/admin/page.tsx:876 | On a banned user the same menu item `Ban` shows a tick; clicking it lifts the ban | `POST /admin/users/{id}/action` (`action: "unban"`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-23 | Remove a warning | app/admin/page.tsx:420 | **Not in the UI.** `removeAction` supports `"warning"` but no control calls it; the `Warning` menu item only ever adds one | would be `POST /admin/users/{id}/action` (`action: "remove_warning"`) | Works | [admin.test](../server/tests/admin.test.js) [core.test](../server/tests/core.test.js) |
| ADM-24 | Action dialog: cancel; Confirm stays disabled until a reason is typed | app/admin/page.tsx:1282 | Button `Cancel`; button `Confirm` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-25 | Action error | app/admin/page.tsx:378, 434 | Native `alert()` starting `Error performing action:` or `Error removing action:` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-26 | Open notes for a user | app/admin/page.tsx:323, 899 | Button `Notes` (count badge after the notes have been opened once); dialog title `Admin Notes` | `GET /admin/users/{id}/notes` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-27 | Add a note | app/admin/page.tsx:337, 1323 | Label `Add a note` (`#new-note`), placeholder `Write a note about this user...`; the add button is icon-only (plus) with **no accessible name** | `POST /admin/users/{id}/notes` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-28 | Edit a note | lib/api.ts:702 | **Not in the UI.** `api.admin.updateNote` exists in the client but nothing calls it | would be `PUT /admin/users/{id}/notes` (no such route in the committed backend; the working-tree backend adds one at `server/src/routes/admin.js:438`) | Fixed - the edit endpoint did not exist | [core.test](../server/tests/core.test.js) |
| ADM-29 | Delete a note (no confirmation) | app/admin/page.tsx:353, 1356 | Icon-only trash button with **no accessible name** on each note | `DELETE /admin/users/{id}/notes?noteId={noteId}` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-30 | Notes list and empty state | app/admin/page.tsx:1347 | Each note: its text, `By: {admin email}`, date and time; empty text `No notes for this user` | none | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-31 | Note error | app/admin/page.tsx:342, 358 | Native `alert()` starting `Could not save note:` or `Could not delete note:` | none | Not verified |  |
| ADM-32 | Action history for a user | app/admin/page.tsx:318, 914, 1384 | Button `History`; dialog title `Action History`; each entry: action name, date and time, reason, `By: {admin email}`; empty text `No action history for this user` | none (comes with `GET /admin/users`) | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-33 | Empty state: no users match | app/admin/page.tsx:926 | Text `No users found` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |

### 17.2 Events tab

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ADM-40 | Load events and event statistics | app/admin/page.tsx:238, 939 | Card title `Event Management`; stat cards `Total Events`, `Upcoming`, `Past`, `Cancelled` | `GET /events` | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-41 | Event row: image, title, category badge, Cancelled / Past badge, description, date range, location, attendance | app/admin/page.tsx:983 | Title text (struck through when cancelled); badges `Cancelled`, `Past`; text `{n} attending` or `{n}/{max} attending` | none | Not verified |  |
| ADM-42 | Open the create-event dialog | app/admin/page.tsx:476, 976 | Button `Create Event`; in the empty state `Create Your First Event`; dialog title `Create New Event` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-43 | Event form: title (required) | app/admin/page.tsx:1451 | Label `Event Title *` (`#event-title`), placeholder `e.g., Speed Dating Night` | none | Not verified |  |
| ADM-44 | Event form: description | app/admin/page.tsx:1462 | Label `Description` (`#event-description`), placeholder `Describe the event...` | none | Not verified |  |
| ADM-45 | Event form: start date and time (required) | app/admin/page.tsx:1474 | Labels `Start Date *` (`#event-start-date`), `Start Time *` (`#event-start-time`) | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-46 | Event form: end date and time | app/admin/page.tsx:1496 | Labels `End Date` (`#event-end-date`), `End Time` (`#event-end-time`) | none | Not verified |  |
| ADM-47 | Event form: location (required) | app/admin/page.tsx:1518 | Label `Location *` (`#event-location`), placeholder `e.g., The Lounge Bar, San Francisco` | none | Not verified |  |
| ADM-48 | Event form: category | app/admin/page.tsx:1530 | Label `Category`; combobox `#event-category`; options `Local Chapter Event`, `Regional`, `National`, `Dating`, `Outdoor`, `Food & Drink`, `Social`, `Fitness`, `Arts & Culture` | none | Not verified |  |
| ADM-49 | Event form: maximum attendees | app/admin/page.tsx:1552 | Label `Max Attendees` (`#event-max-attendees`), placeholder `Leave blank for unlimited` | none | Not verified |  |
| ADM-50 | Event form: upload a photo | app/admin/page.tsx:512, 1565 | Label `Upload Event Photo (optional)` (`#event-photo`, `type="file"`); text `Uploading...`; preview image `alt="Event preview"` | `POST /admin/events/photo` (multipart, field `photo`) | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-51 | Event form: remove the uploaded photo | app/admin/page.tsx:1589 | Icon-only trash button with **no accessible name** on the preview | none | Not verified |  |
| ADM-52 | Create the event (disabled until title, start date, start time and location are filled) | app/admin/page.tsx:533, 1606 | Button `Create Event` inside the dialog | `POST /admin/events`, then `GET /events` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-53 | Edit an event | app/admin/page.tsx:493, 1080 | Row button `Actions`, menu item `Edit`; dialog title `Edit Event`; button `Save Changes` | `PUT /admin/events/{id}`, then `GET /events` | Fixed - the edit form filled the date from the UTC day; date and time now both use the device clock (convention in `lib/event-dates.ts`); tested in six time zones on both clock-change days | [admin.spec](../tests/e2e/admin.spec.ts) |
| ADM-54 | Event dialog: cancel | app/admin/page.tsx:1603 | Button `Cancel` | none | Not verified - the test that opens and cancels this dialog is switched off (test.fixme) | |
| ADM-55 | Event save error | app/admin/page.tsx:566, 577 | Native `alert()` starting `Error updating event:` or `Error creating event:` | none | Not verified |  |
| ADM-56 | Cancel an event (no confirmation) | app/admin/page.tsx:612, 1090 | Menu item `Cancel Event` | `PUT /admin/events/{id}/cancel`, then `GET /events` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-57 | Restore a cancelled event | app/admin/page.tsx:619, 1085 | Menu item `Restore` | `PUT /admin/events/{id}/uncancel`, then `GET /events` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-58 | Delete an event (no confirmation) | app/admin/page.tsx:605, 1099 | Menu item `Delete` | `DELETE /admin/events/{id}`, then `GET /events` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-59 | View attendees | app/admin/page.tsx:628, 1057, 1618 | Button `Attendees` (count badge when above zero); dialog title `Event Attendees`; text `{n} attending` plus `of {max} spots`; each row name and email; empty text `No attendees yet` | `GET /admin/events/{id}/attendees` | Works (API test only) | [core.test](../server/tests/core.test.js) |
| ADM-60 | Hide / show an event | lib/api.ts:749 | **Not in the UI.** `api.admin.toggleEventVisibility` exists in the client but nothing calls it | would be `PUT /admin/events/{id}/toggle-visibility` (no such route in the committed backend; the working-tree backend adds one at `server/src/routes/admin.js:591`) | Fixed - the hide/show endpoint did not exist | [admin.test](../server/tests/admin.test.js) [core.test](../server/tests/core.test.js) |
| ADM-61 | Empty state: no events | app/admin/page.tsx:1113 | Text `No events yet` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |

### 17.3 News tab

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| ADM-70 | Announcement title | app/admin/page.tsx:1139 | Card title `Post News to All Users`; label `Title` (`#news-title`), placeholder `e.g., New Feature Announcement` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-71 | Announcement message | app/admin/page.tsx:1148 | Label `Message` (`#news-message`), placeholder `Write your announcement message here...` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-72 | Post to all users (disabled until both fields are filled; no confirmation) | app/admin/page.tsx:1157 | Button `Post to All Users` | `POST /admin/news` | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-73 | Post error | app/admin/page.tsx:1173 | Native `alert()` starting `Error posting announcement:` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-74 | Previous announcements list | app/admin/page.tsx:245, 1191 | Card title `Previous Announcements`; each item: title, message, date and time | `GET /admin/news` | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-75 | Delete an announcement | app/admin/page.tsx:1222 | Icon-only trash button with **no accessible name** on each item | none (removes it from the screen only) | Fixed - only removed the row on screen; the announcement stayed in every inbox | [admin.spec](../tests/e2e/admin.spec.ts) [community.spec](../tests/e2e/community.spec.ts) |
| ADM-76 | Empty state: no announcements | app/admin/page.tsx:1233 | Text `No announcements posted yet` | none | Works | [admin.spec](../tests/e2e/admin.spec.ts) [admin.test](../server/tests/admin.test.js) |
| ADM-77 | Review member reports | server/src/routes/admin.js:750 | **Not in the UI.** The server has `GET /admin/reports` and `PUT /admin/reports/{id}` but the admin page has no Reports tab and `lib/api.ts` has no client for them | none | Fixed - reports had no admin screen at all | [community.spec](../tests/e2e/community.spec.ts) |

## 18. Global

Files: `components/protected-route.tsx`, `components/realtime-provider.tsx`, `lib/store/auth-store.ts`, `lib/store/notification-store.ts`, `lib/notification-sound.ts`, `lib/api.ts`, `app/layout.tsx`

| ID | Function | Where (file:line) | How a test finds it (visible text / aria-label / role / placeholder, exactly as in the code) | API call it makes | Status | Test |
|---|---|---|---|---|---|---|
| GLB-01 | Signed-out visitor to any app page is sent to login | components/protected-route.tsx:40 | Spinner, then URL becomes `/login` | none | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-02 | Session timeout after 8 hours (checked when a protected page mounts) | lib/store/auth-store.ts:114, 207; components/protected-route.tsx:37 | Seed `spark-auth` with a `sessionTimestamp` more than 8 hours old, open `/browse`; URL becomes `/login?expired=1` with `For your security you were signed out after a while...` | none | Fixed - the time-out signed the member out but the explanation was lost (a second redirect replaced it); it now lands on the login screen with the notice | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| GLB-03 | Banned / suspended modal | components/protected-route.tsx:50, 78 | Alert dialog title `Account Suspended or Banned`; text `Your account has been suspended or banned. Please contact d8lpa.community@gmail.com for more info.`; button `Go to Login` (no cancel, no X) | `GET /auth/me` | Fixed - the explanation dialog never appeared (message mismatch + redirect race) | [community.spec](../tests/e2e/community.spec.ts) |
| GLB-04 | Session is cleared when the server says the account is suspended or banned | lib/api.ts:64 | `localStorage` key `spark-auth` removed after a 403 containing `suspended or banned` | n/a | Fixed - the explanation dialog never appeared (message mismatch + redirect race) | [community.spec](../tests/e2e/community.spec.ts) |
| GLB-05 | Session elsewhere is ended when the account is disabled or deleted | lib/api.ts:73 | URL becomes `/login` after a 403 containing `disabled` or `deleted` | n/a | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) [core.test](../server/tests/core.test.js) |
| GLB-06 | Nav badge counts are loaded at sign-in / page load | components/realtime-provider.tsx:51, 97 | Badges on `Messages`, `Matches`, `Notifications`, `Events` | `GET /matches`, `GET /messages`, `GET /notifications` | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-07 | Live badge: a new message bumps the Messages badge (or re-reads the true count when already on Messages) | components/realtime-provider.tsx:147, 154 | Send a message from a second context; the badge on `Messages` / `Chat` increases without reload | socket event `new-notification` (`type: "message"`) | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-08 | Live badge: a new match bumps Matches and Notifications | components/realtime-provider.tsx:163 | Like back from a second context; the badges on `Matches` and `Notifications` increase without reload. The committed backend never sends this ping; the working-tree backend does (see defects 39 and 49) | socket event `new-notification` (`type: "match"`) | Fixed - the server never sent the live "match" ping | [community.spec](../tests/e2e/community.spec.ts) [sockets.test](../server/tests/sockets.test.js) |
| GLB-09 | Live badge: a new event bumps Events and Notifications | components/realtime-provider.tsx:167 | Client handler exists, but no version of the backend that was read sends an `event` ping (see defect 39) | socket event `new-notification` (`type: "event"`) | Fixed - the server never sent the live "event" ping | [admin.spec](../tests/e2e/admin.spec.ts) [core.test](../server/tests/core.test.js) |
| GLB-10 | Badges clear when the matching page is visited | components/realtime-provider.tsx:187 | Window events `notificationsRead`, `messagesViewed`, `matchesViewed`, `eventsViewed` fired by the pages | `GET /matches`, `GET /messages`, `GET /notifications` on the first two events | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-11 | Notification chime on a live ping, when sound is on | components/realtime-provider.tsx:149; lib/notification-sound.ts:50 | No DOM output; stub `window.AudioContext` and assert an oscillator is created | `GET /settings` (reads the preference at sign-in) | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-12 | Audio is unlocked on the first click or key press | components/realtime-provider.tsx:123 | No DOM output; count `AudioContext` constructions before and after the first click | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| GLB-13 | Realtime connection joins the member's room and re-joins after a reconnect | components/realtime-provider.tsx:135 | Socket emits `join` with the user id | socket | Fixed - anyone could join any member's room; connection now needs the member's token | [sockets.test](../server/tests/sockets.test.js) |
| GLB-14 | Network failure message | lib/api.ts:88 | Any screen that shows API errors displays `Network error. Please try again.` | n/a | Fixed - plain-language network message; load-error states | [settings.spec](../tests/e2e/settings.spec.ts) |
| GLB-15 | Toast container | app/layout.tsx:48 | Sonner toaster; toasts are only raised from the Settings page | none | Works | [auth.spec](../tests/e2e/auth.spec.ts) [chat.spec](../tests/e2e/chat.spec.ts) |
| GLB-16 | Development banner | components/dev-banner.tsx:11 | Text `Development Mode` and `- This is a development environment` (only when `NODE_ENV` is `development`) | none | Works | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |
| GLB-17 | Browser tab title | app/layout.tsx:16 | Title `D8-LPA - Find Your Connection` | none | Fixed - title no longer says "generator: v0" | [signup-login.spec](../tests/e2e/signup-login.spec.ts) |

---

## Suspected defects found while reading

Found by reading only; none was reproduced in a browser. "Unverified" marks the ones where the code makes the problem likely but a run is needed to be sure. Front-end line numbers are at commit `560d254`. For the back end, "committed" means commit `560d254` and "working tree" means the uncommitted rewrite as it stood at about 21:37 on 2026-10-04 (see Baseline).

### A. In the front end (true whichever backend is running)

1. **"Skip All" leaves an endless spinner.** `app/onboarding/page.tsx:412` sets the shared `isLoading` flag and never clears it, and `components/protected-route.tsx:63` shows a spinner while that flag is set, so the profile page it navigates to never appears until a full reload; the same handler also ignores a failed save and navigates anyway.
2. **Cancel does not discard profile edits.** `app/profile/page.tsx:426` only leaves edit mode; the form state is not reset, so the unsaved text stays on screen in view mode and is saved by the next Save.
3. **District shows as `District #district_3`.** `app/profile/page.tsx:707` prints the stored value raw, and onboarding stores `district_N` (`app/onboarding/page.tsx:44`).
4. **Deleting an announcement only hides it on screen.** `app/admin/page.tsx:1226` filters local state and never calls `api.admin.deleteAnnouncement` (`lib/api.ts:739`), so it is back after a reload and stays in every member's inbox.
5. **Member reports go nowhere an admin can see.** Reports are filed from `app/profile/[id]/page.tsx:135`, `app/matches/page.tsx:230` and `app/messages/page.tsx:584`, but the admin page has no Reports tab and `lib/api.ts` has no client for `GET /admin/reports`.
6. **"Report & Block" in chat often files no report.** `app/messages/page.tsx:583` only reports when a reason was typed, yet the reason is labelled optional and the button still says `Report & Block`; both API results are ignored, so the conversation is removed from the list even if blocking failed.
7. **Terms of Service and Privacy Policy links are dead.** `app/signup/page.tsx:279` and `:283` link to `/terms` and `/privacy`, and no such pages exist under `app/`.
8. **Liking from a member's profile fails silently and hides a new match.** `app/profile/[id]/page.tsx:142` ignores the like/unlike result, shows no "It's a match" message, and does not refresh the match state, so the `Message` button only appears after a reload. There is also no Block option on this page (only Report).
9. **A failed report on a member's profile gives no feedback.** `app/profile/[id]/page.tsx:137` does nothing when the request errors; the dialog just stays open.
10. **Error banners leak between screens.** Login, sign-up and onboarding share one `error` value in the auth store (`app/login/page.tsx:21`, `app/signup/page.tsx:23`, `app/onboarding/page.tsx:216`), so a failed login message is still showing after clicking through to Sign up.
11. **"Back to signup" strands the new account.** The account already exists by the time the code screen shows (`app/signup/page.tsx:69`), so going back (`:316`) and submitting again answers `Email already registered` with no way back to the code screen.
12. **Sign-up shows a developer hint to everyone and starts the resend cooldown after a failed resend.** `app/signup/page.tsx:420` always renders "(In development mode, check the terminal...)"; `:133` starts the 60-second cooldown even when the resend request failed.
13. **Opening Notifications marks everything read at once.** `app/notifications/page.tsx:39` calls mark-all-read as soon as the list loads, so the `Unread` filter, `Mark as read` and `Mark all as read` are on screen for a moment at most; the mark/delete handlers (`:59`, `:70`, `:75`) also update the screen without checking that the request worked.
14. **A failed load looks like "nothing here".** Matches (`app/matches/page.tsx:151`), Messages (`app/messages/page.tsx:286`), Notifications (`app/notifications/page.tsx:50`), Events (`app/events/page.tsx:170`) and Admin (`app/admin/page.tsx:223`) show their empty state with no error; a member's profile says "This user may have deleted their account." for any failure (`app/profile/[id]/page.tsx:189`); Settings silently keeps the defaults (`app/settings/page.tsx:125`), and pressing Save then overwrites the real settings with them.
15. **The take-a-break and delete dialogs close and clear on failure.** The `finally` blocks at `app/settings/page.tsx:198` and `:230` run after an error too, so a wrong password throws away the reason the member typed.
16. **"Delete Account" promises more than it does.** `app/settings/page.tsx:952` says the account and all data are permanently deleted, but the screen calls `POST /settings/delete`, which in both backend versions only flags the account as deleted; the email address stays registered, so the member cannot sign up again with it.
17. **Age boxes fight the keyboard.** `app/settings/page.tsx:666`, `:678` and `app/onboarding/page.tsx:824`, `:835` clamp on every keystroke, so typing "2" into the minimum becomes 18 and the next digit makes "185"; clearing a box snaps it to 18 or 100.
18. **Looking For rows have two click handlers (unverified).** In `app/settings/page.tsx:622` the row and the checkbox inside it (`:633`) both toggle the same value, so clicking the label text may toggle twice and leave it unchanged.
19. **Profile edit offers different choices from onboarding, so some answers cannot be changed.** Religion (`app/profile/page.tsx:157` against `app/onboarding/page.tsx:93`), education (a fixed list at `app/profile/page.tsx:929` against free text at `app/onboarding/page.tsx:932`), life goals and "what I'm looking for" use different lists, so a value picked in onboarding has no badge or option to deselect; prompts allowed 500 characters in onboarding are cut to 250 on the first keystroke (`app/profile/page.tsx:1483`); religion shows blank instead of "Not specified" (`:1195`).
20. **Name, city, gender and birthday cannot be edited after onboarding.** `app/profile/page.tsx` keeps first and last name in form state (`:291`) but renders no input for them, and has no control for city, gender or birthday; state is free text there (`:713`) although Browse filters on exact state names, and Browse offers District 15 (`app/browse/page.tsx:56`) while onboarding stops at 14.
21. **Removing the onboarding photo does not remove it.** `app/onboarding/page.tsx:365` clears local state only; the upload at `:353` has already saved the picture to the profile.
22. **A chat can re-open itself (unverified).** The effect at `app/messages/page.tsx:246` re-selects the conversation named in the URL whenever the conversation list changes, which happens on every incoming message, so on a phone the Back button is undone and the thread is re-fetched.
23. **Unmatch and Unlike leave stale cards, and Unlike quietly ends a match.** After `Unmatch` (`app/matches/page.tsx:174`) the server also deletes both likes but the "Profiles You Liked" tab is not reloaded; `Unlike` (`app/matches/page.tsx:596`, `app/browse/page.tsx:587`) deactivates an existing match on the server with no warning in the UI.
24. **Destructive actions with no confirmation.** Unmatch on the Matches page (`app/matches/page.tsx:288`), unlike (`app/matches/page.tsx:596`), delete notification (`app/notifications/page.tsx:321`), remove photo (`app/profile/page.tsx:1660`), admin delete event (`app/admin/page.tsx:1099`), cancel event (`:1090`), delete note (`:1356`), unsuspend / unban (`:857`, `:876`) and "Post to All Users" (`:1157`).
25. **Icon-only buttons with no accessible name.** Sign-up show-password (`app/signup/page.tsx:216`); sidebar collapse and collapsed logout and links (`components/app-sidebar.tsx:82`, `:204`, `:120`); onboarding remove photo (`app/onboarding/page.tsx:1209`); Browse filter-chip X (`app/browse/page.tsx:403`); profile menu and photo viewer controls (`app/profile/[id]/page.tsx:289`, `:438`, `:458`, `:465`, `:475`); my-profile camera, interest X and preview controls (`app/profile/page.tsx:677`, `:962`, `:1804`, `:1822`, `:1839`, `:1845`); liked-card unlike (`app/matches/page.tsx:596`); chat back and menu (`app/messages/page.tsx:733`, `:759`); event filter-chip X (`app/events/page.tsx:368`); admin add note, delete note, delete announcement, remove event photo (`app/admin/page.tsx:1333`, `:1356`, `:1222`, `:1589`).
26. **Clickable things that are not buttons or links.** Notification cards (`app/notifications/page.tsx:267`), event cards (`app/events/page.tsx:397`), admin filter cards (`app/admin/page.tsx:743`), photo tiles (`app/profile/page.tsx:860`, `app/profile/[id]/page.tsx:332`) and every badge picker in profile edit (for example `app/profile/page.tsx:1005`) cannot be reached or operated from the keyboard.
27. **Text below 14px on primary content.** Message time and "Edited" at 11px (`app/messages/page.tsx:939`); 12px for the conversation time (`app/messages/page.tsx:691`), match date (`app/matches/page.tsx:334`), "Liked ..." date (`:581`), notification date (`app/notifications/page.tsx:298`), onboarding step labels and counters (`app/onboarding/page.tsx:470`, `:1231`), the take-a-break explanation (`app/settings/page.tsx:834`) and admin user dates (`app/admin/page.tsx:826`); nav badges at 10px and 11px (`components/app-sidebar.tsx:124`, `components/mobile-nav.tsx:60`).
28. **Editing an event can move it by a day and cannot remove its photo.** `app/admin/page.tsx:501` takes the date from the UTC ISO string but the time from local time (`:502`), so an evening event in a US time zone re-opens on the next day; `:553` sends `undefined` for an emptied image, so the old photo is kept.
29. **Admin user list rough edges.** The `Suspend` and `Ban` items lift the action when it is already applied but keep the same label (`app/admin/page.tsx:855`, `:874`); `Warning` can only add (`:842`); the history icon looks for `warning` but the server records `warn` (`:464`); local state assumes suspend and ban cancel each other (`:399`), which the server does not do.
30. **Session handling.** The 8-hour timeout is only checked when a protected page mounts (`components/protected-route.tsx:37`), `refreshSession` is never called (`lib/store/auth-store.ts:220`), and every profile load resets the clock through `setUser` (`:178`); logging out (`components/app-sidebar.tsx:205`, `components/mobile-nav.tsx:159`) never calls `disconnectSocket` (`lib/socket.ts:36`) or resets the badge store (`lib/store/notification-store.ts:51`), so the next account in the same tab inherits the old connection and counts.
31. **The token is written to the browser console.** `lib/api.ts:44` logs every request with the first 20 characters of the session token.
32. **Realtime URL fallback differs from the API fallback.** `lib/socket.ts:8` falls back to `http://localhost:5001/api` while `lib/api.ts:18` falls back to `/api`, so without `NEXT_PUBLIC_API_URL` the two point at different hosts.
33. **Onboarding is not enforced.** `app/onboarding/page.tsx` is outside the protected-route guard, and nothing in `components/protected-route.tsx` checks `onboarding_completed`, so a signed-in member can use every page with an empty profile by typing the URL.
34. **Paste into the code boxes probably does nothing (unverified).** The paste branch at `app/signup/page.tsx:94` needs a value longer than one character, but each box has `maxLength={1}` (`:352`).
35. **Unused and dead client code.** `api.stats.get` (`lib/api.ts:587`, no `/stats` route in either backend), `api.users.deleteAccount` (`:265`), `api.browse.pass` / `superLike`, `api.matches.getOne`, `api.events.getOne`, `checkMembershipId` (`app/onboarding/page.tsx:241`, with a hard-coded `/api/...` URL), `components/profile-card.tsx`, `components/theme-provider.tsx`, and `MOCK_PHOTOS` / `BODY_TYPES` / `FREQUENCY_OPTIONS` (`app/profile/page.tsx:66`, `:177`, `:185`). No screen currently renders anything from `lib/mock-data.ts` (`USE_MOCK_DATA` is `false` at `lib/api.ts:14` and `lib/store/auth-store.ts:6`).
36. **Type errors do not fail the build.** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.

### B. Between the front end and the back end

37. **Changing your password locked you out (committed backend).** `server/src/routes/auth.js:687-691` at `560d254` hashed the new password and then saved it through a model hook that hashes again; the working tree assigns the plain password instead. Needs a regression test: change password, log out, log in with the new one.
38. **A wrong password in Settings signed you out (committed backend).** Change password, take a break and delete answered 401, and `lib/api.ts:54` treats any 401 as an expired session and redirects to login; the working tree answers 400. Needs a regression test for all three dialogs.
39. **Live badges only ever fired for messages (committed backend).** `components/realtime-provider.tsx:163` and `:167` handle `match` and `event` pings, but the committed backend only emitted for messages; the working tree also emits for matches and likes (`server/src/routes/browse.js:56`, `:347`). No version emits an `event` ping, so the Events badge never updates live.
40. **The age range chosen in onboarding is never saved.** `app/onboarding/page.tsx:819` collects it and sends `age_preference_min` / `age_preference_max`, but `PUT /auth/complete-onboarding` does not read those fields in either backend version (`server/src/routes/auth.js:320` in the working tree).
41. **"Non-binary" never matches anyone.** Looking For sends `non-binary` (`app/onboarding/page.tsx:760`, `app/settings/page.tsx:610`) but a member's own gender is stored as `non_binary` (`app/onboarding/page.tsx:51`), and Browse compares the two directly; the working-tree settings route now only accepts `non_binary` (`server/src/routes/settings.js:73`), so the Settings checkbox is silently dropped on save.
42. **The Events "Event Type" filter hides everything.** `app/events/page.tsx:139` filters on `event.event_type` with values such as `local_chapter`, but neither backend version returns an `event_type`; events only have a `category` spelled `local-chapter` (`server/src/models/Event.js:40`).
43. **A deleted conversation comes back.** `app/messages/page.tsx:510` removes it from the list, but `GET /messages` returns every match, so after a reload the conversation is listed again, empty (the committed backend even kept the last-message preview).
44. **A newly posted announcement appeared blank (committed backend).** `app/admin/page.tsx:1163` builds the new row from `title`, `message` and `created_at` in the response, which the committed backend did not return; the working tree returns title and message (date unverified).
45. **Email verification is not enforced by the server.** The committed login never checks `email_verified`; the working tree only does when `ENFORCE_EMAIL_VERIFICATION=true` (`server/src/routes/auth.js:237`), and then the login page has no way to reach the code screen because it ignores the `requiresVerification` answer.
46. **Reset password accepts a password the server rejects.** `app/reset-password/page.tsx:24` only checks for 8 characters while the server requires upper case, lower case, a number and a symbol in both versions, and the page shows only "Password does not meet security requirements" without saying which rule failed.
47. **Client enum values that the database would reject (latent).** The types at `lib/store/auth-store.ts:33-54` and the unused lists at `app/profile/page.tsx:177-190` use values such as `thin`, `other`, `occasionally`, `often`, `sometimes`, `maybe`, `unsure`, `dating`, `hookup`, `relationship`, none of which are in the enums at `server/src/models/Profile.js:19`, `:37`, `:41`, `:45`, `:91`. Nothing is broken today because no screen has a control for body type, drinking, smoking, wants kids or relationship type; gender values match `server/src/models/User.js:32`.
48. **Things the committed backend got wrong that the working tree appears to fix (worth a regression test each).** Sockets needed no login and any client could join any member's room; `GET /users/{id}` returned banned, paused and blocked members; the login error said whether the email existed; an admin could suspend or ban themselves or another admin; Browse stopped at the first 50 accounts before filtering; `profile_views` and `distance` were random numbers (never displayed).

### C. New mismatches between the working-tree backend and the unchanged front end

49. **Realtime will not connect.** The working-tree server rejects any socket that does not send the session token (`server/src/realtime.js:35`), and `lib/socket.ts:11` does not send one, so live messages, live badges and the chime all stop until the client passes `auth: { token }`.
50. **Other members' ages disappear.** The working-tree `GET /users/{id}` no longer returns `birthdate` (`server/src/routes/users.js:409`), but `app/profile/[id]/page.tsx:98` works the age out from it and ignores the `age` field the server now sends.
51. **The Change Password dialog under-states the rules.** It says "at least 8 characters" (`app/settings/page.tsx:1233`, `:1278`), while the working-tree server now applies all five sign-up rules (`server/src/routes/auth.js:619`).
52. **Back-end features with no screen yet.** The working tree adds saved profiles (`server/src/routes/favorites.js`), a typing relay (`server/src/realtime.js:81`), read receipts (`messages-read`, `server/src/routes/messages.js:166`), online status, quiet hours and email digest settings (`server/src/routes/settings.js:42`), RSVP notes and a member-visible attendee list (`server/src/routes/events.js`), hidden events, a guided-tour flag (`has_seen_tour`, `server/src/routes/users.js:146`) and report categories (`server/src/routes/browse.js:808`); nothing in `app/`, `components/` or `lib/` uses any of them.

## Things the UI does not have

Checked against the front end at commit `560d254`.

| Feature | In the UI? | Notes |
|---|---|---|
| Typing indicator | No | No typing state or socket listener in `app/messages/page.tsx`. The working-tree backend relays a `typing` event (`server/src/realtime.js:81`). |
| Read receipts | No | Messages carry a `read` flag (`app/messages/page.tsx:65`) but it is never shown. The working-tree backend emits `messages-read` and has a `readReceipts` privacy setting. |
| Theme (dark / light) switch | No | `components/theme-provider.tsx` is never mounted; see THM-01. |
| Text-size setting | No | Nothing in Settings or elsewhere. |
| Help page | No | Only the `Contact Us` email link in Settings (`app/settings/page.tsx:779`). |
| Safety centre | No | Only the Community Guidelines dialog in onboarding (`app/onboarding/page.tsx:1402`) and the Terms & Privacy dialog in Settings. |
| Guided tour | No | The working-tree backend stores a `has_seen_tour` flag, unused by the client. |
| Favourites | No | The "Favorites" headings on profiles are music / animals / pet peeves. The nearest thing is "Profiles You Liked". The working-tree backend has `/favorites` routes, unused by the client. |
| Event create by members | No | Only admins, from the Admin page (`app/admin/page.tsx:976`). |
| Report from chat | Partly | Only as the combined `Report & Block` (`app/messages/page.tsx:778`); a member cannot report without blocking, and a report is only filed when a reason is typed. |
| Block from chat | Partly | Through the same dialog, by ticking `Just block without reporting` (`app/messages/page.tsx:1121`). There is no separate Block item. |
| Show-password toggle on each password field | No | Present on login (`app/login/page.tsx:130`, with an aria-label) and on the first sign-up password (`app/signup/page.tsx:216`, no accessible name). Missing on sign-up confirm, both reset-password fields, the three change-password fields, and the take-a-break and delete password fields. |

