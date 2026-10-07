# Design review - 2026-10-04

Audience: members aged roughly 40 to 65, in a community where reach and dexterity vary. The aim was calm, large, labelled and forgiving.

How it was reviewed: 13 screens were captured at phone (390px), tablet (820px) and desktop (1440px) widths in light and dark - 78 screenshots (`node scripts/screenshots.mjs`). Ten contact sheets are kept in [`docs/screenshots/`](screenshots/) (each sheet: light on top, dark below; phone, tablet, desktop left to right). Nine sheets were inspected by eye in the first pass and the chat sheet again after fixes; colour contrast and control labelling were measured with axe-core in the automated tests rather than judged by eye.

**Limits of this review, stated plainly.** Sign-up, Help, Safety and Saved sheets were generated but not individually inspected after the last round of fixes. Onboarding, the profile editor, the admin screens and every dialog were not screenshot-reviewed at all. No testing was done with real members, with a screen reader, or on a physical phone.

## What changed across the whole app

| Area | Before | After |
|---|---|---|
| Text size | Browser default 16px; many labels at 10-12px | 18px default; smallest text about 14.5px; a four-step text-size choice in Settings (kept per device) that scales text, buttons and spacing together |
| Contrast | White on the pink primary was about 3.3:1; field borders nearly invisible | Primary, secondary and destructive darkened (light) / lightened (dark) to pass WCAG AA; field borders 3:1. Measured by axe on Messages, Settings, Help, Safety, Saved and a member profile, light and dark: 0 failures |
| Buttons | `brightness-110` filter washed colours out; 40px high | Filter removed; about 45px high at the default size; icons 20px |
| Switches | 24px high | 32px high |
| Focus | Thin, low-contrast ring | 3px ring on every interactive element |
| Motion | Always on | `prefers-reduced-motion` honoured |
| Navigation | Collapsible sidebar that could become icons only; mobile "Chat" vs desktop "Messages" | Always icon + word; same names everywhere; Saved, Safety and Help added; skip-to-content link; `aria-current` on the current page |
| Feedback | Many actions ended silently | Toast after every action in the screens that were reworked, with Undo on block and on removing a saved profile |
| Errors | A failed load looked like "nothing here" | Load-error card with Try again (Messages, Settings, Saved, member profile, admin reports); error and not-found pages; offline banner |
| Theme | No way to choose | Light / Dark / Same as my device |
| Passwords | Show/hide on one field | Show / Hide (with the word) on sign-up confirm, reset and all Settings password fields |

## Screen by screen

**Messages** (most reworked). One clear primary action: Send, with the word on the button. Enter sends, Shift+Enter makes a new line. Edit / Unsend are words under the message, not hover icons. "Options" is a labelled button holding Report, Block, Unmatch, Clear conversation. Failed messages stay in the thread with "Try again". Empty chats offer three openers.
- Found in review, fixed: at tablet width the thread was squeezed to one word per line beside the menu and the list - two panes now start at 1024px. On a phone the name was truncated to "Ma..." - the avatar is dropped from the header there.
- Still open: in development the yellow banner pushes the message box partly below the fold; production has no banner, but this was not checked on a production build in a browser.

**Settings.** Auto-save replaces the Save button ("Saved" appears each time). New Display card first. Plain names: "Show my profile in Browse", "Only show me to people I have liked", "Show when I am online", "Show when I have read a message". Age boxes can be typed in normally.
- Still open: it is a long single page; sections are not collapsible.

**Member profile.** Hidden "..." menu replaced by visible Save / Report / Block. Like says who ("Like Dana"). "Email confirmed" badge; "You both like: ...".
- Still open: on a phone the photo fills the first screen and the Like button is below the fold.

**Browse.** Heading renamed from "Discover" to match the menu.
- Still open: filter chips are small; the remove-X on a chip has no accessible name; no "Pass" option.

**Events.** "Join Event / Leave Event" became "I'm going / I can't go". Calendar buttons, who's going, and a note field in the details.
- Still open: event cards are cramped at tablet width; date filters use the browser's small native date picker.

**Matches.** Grid no longer overflows at tablet width.
- Still open: Unmatch and Unlike here have no confirmation; the "..." options button is icon-only (it does have an accessible name).

**My Profile.** Header wraps instead of crushing the title on a phone; stat cards stack until there is room.
- Still open: Cancel does not discard edits; name, city and birthday cannot be edited after onboarding.

**Notifications.** Unchanged apart from global styles.
- Still open: opening the page marks everything read immediately; times say "Recently"; delete is an icon-only button (labelled for screen readers) with no confirmation.

**Login / sign-up.** Clear single action. Stretched checkbox (a side effect of the new minimum tap height) found in review and fixed.
- Still open: no "what is this site" sentence for a first-time visitor.

## Accessibility notes

- Landmarks and names: `main`, two labelled `nav`s, labelled chat regions, `role="log"` on the thread, live regions for new messages and typing.
- Badges announce "3 new", not just "3".
- Known gaps: several clickable cards (notifications, events, photo tiles, profile-editor badges) are `div`s that cannot be reached by keyboard; the emoji picker is mouse/touch oriented; no screen-reader pass was done.

---

# Round 2 - 2026-10-05

## What was covered this time

- **axe, full rule sets.** `tests/e2e/a11y-member.spec.ts` runs every WCAG 2.0/2.1 A and AA rule (not a hand-picked list) on 31 member screens and open dialogs - Browse (with a filter), Matches (with the unmatch, report and remove-like dialogs), Messages (with the options menu and emoji picker), Notifications, Events (with filters and details), Saved, My Profile (viewing, editing, discard prompt, photo manager, crop step, remove-photo prompt, preview), another member's profile (with photo viewer, report and block dialogs) and Settings (with its five dialogs) - in light and in dark. Result after fixes: **0 serious or critical findings, 0 contrast failures**. The sign-up, onboarding and admin screens are covered by the helper's own accessibility tests (see the pull request description).
- **Screenshots.** `node scripts/screenshots-round2.mjs` captures 12 changed screens and dialogs at phone, tablet and desktop widths in light and dark (72 captures) and tiles them into six contact sheets in [`docs/screenshots/round2/`](screenshots/round2/). **Inspected by eye this round: the two phone sheets (light and dark).** The tablet and desktop sheets were generated but not inspected - stated plainly, as before.
- **Keyboard-only passes** (as tests): Browse filters and chips, Matches dialogs (Escape keeps the match), Notifications actions, Events (Enter opens the details, Escape closes them and focus goes back to the card), the photo crop step (move, zoom, slider), the emoji picker, and the profile editor's choice chips.
- **Screen-reader semantics** (as tests and code): dialogs all have names; the chat thread is a `role="log"`; toasts sit in a live region; result counts and the unread summary are `role="status"`; errors are `role="alert"`; toggles carry `aria-pressed`; progress has a named `progressbar`. No pass was done with an actual screen reader.

## Found and fixed

| Where | Found | Fixed |
|---|---|---|
| Everywhere | Clickable "badges" (interest and choice chips) were mouse-and-touch only | Any badge with an action is now a focusable button, 36px high, usable with Enter and Space; choice chips say whether they are selected |
| Matches | The two tabs pointed at panels that do not exist (axe); "..." options was an icon; unlike was an icon with no name; text at 12px | Two plain labelled buttons; "Options" and "Remove like" in words; 14-16px text; confirmations before unmatch and remove-like |
| Messages | With the options menu open, the whole page behind it was hidden from assistive technology yet still focusable (axe) | Menu no longer hides the page |
| My Profile | Preview: five controls with no names (axe). Editor: no field had a programmatic label; header fields were 32px high with placeholder-only labels | Named controls; every field labelled; header fields are normal-height labelled fields in a grid |
| My Profile, phone | **Save was cut off the right edge** in edit mode (seen on the phone sheet) | Buttons wrap |
| My Profile, phone | Completeness card: the suggestion text was squeezed into a narrow column beside "Add this" (phone sheet) | Stacks on a phone |
| Notifications | Opening the page marked everything read; times said "Recently"; whole card was a clickable box; delete was an icon; on a phone the icon sat in a tall empty pill (phone sheet) | Per-item read, real times, real links, "Delete" with Undo, "New" in words, icon no longer stretches |
| Matches, phone | Name, last message and date were squeezed by space reserved for the Options button (phone sheet) | Only the name line leaves room for it |
| Browse | Filter chips small, remove-X unnamed; "You Liked This User" | 32px remove buttons with names; "You like {name}" |
| Events | Cards could not be opened by keyboard; date boxes unlabelled; only the small native date picker | Cards are buttons; labelled; "Next 7 days / Next 30 days / Any time" |
| Member profile | Gallery tiles were not keyboard reachable; viewer controls unnamed | Buttons with names, arrow keys, "Photo 2 of 3" |

## Still open

- Tablet and desktop sheets for round 2 were not inspected by eye.
- The profile editor is still one long page; sections are not collapsible and there is no sticky Save bar.
- On another member's profile, Like is still below the first screen on a phone.
- Settings is still one long page.
- The photo crop step is on My Profile only; the onboarding photo upload does not use it yet.
- Custom music / animal / pet-peeve entries are added with Enter only (no Add button).
- No testing with real members, a real screen reader, or a physical phone.

---

# Round 3 - 2026-10-06

## Exactly what was looked at

- **Captured:** every state the three accessibility specs visit - 31 member screens and dialogs, 19 signed-out screens (log in, sign up, verify, forgot / reset password, terms, privacy, not-found, offline), 23 onboarding steps, dialogs, tour cards, Help and Safety, and 36 admin tabs and dialogs: 109 states - at phone (390px), tablet (820px) and desktop (1440px) widths, in light and dark. In light mode a page longer than the screen was saved screen by screen (up to four screens deep), so content below the first screen is included; in dark mode the first screen of each state. Tiled into 268 sheets at a readable size (8 phone, 4 tablet or 2 desktop pictures per sheet).
- **Inspected, every picture on every sheet:** phone light (27 sheets) and dark (14), tablet light (49) and dark (28), desktop light (97). That is 215 sheets.
- **Not inspected:** desktop dark (55 sheets). Onboarding step 2 below its fourth screen (its Back / Next buttons) is not in any picture.
- **Not re-inspected:** the fixes below were made after the inspection and checked by tests, not by looking at new pictures.
- **axe:** full WCAG 2.0 / 2.1 A and AA rule sets on all 109 states in light and dark (admin also at phone size): 0 serious or critical findings. One rule (`scrollable-region-focusable`) is set aside for an open list of options, which is moved through with the arrow keys - the test checks that instead.
- Still no testing with real members, a real screen reader, or a physical phone.

## Found and fixed

| Where | Found | Fixed |
|---|---|---|
| Every dialog | Delete-account dialog ran off the right edge of a phone (button and "Show" cut off); tall dialogs (event form with a photo, position-your-photo, photo manager) hid their buttons below the screen; the phone menu bar showed over dialog bottoms | All dialogs are limited to the screen's height and width and scroll inside; long content wraps; the menu bar sits under dialogs |
| Tablet (820px) | With the side menu only about 435px was left: another member's profile buttons clipped ("Liked - tap to undc"), profile editor fields cut off, event cards squeezed, Saved card a narrow strip, admin tabs and tiles cramped | The side menu now needs 1024px; an upright tablet gets the full width and the bottom menu bar |
| Messages | The message box sat partly below the screen (open since round 1) | The development banner's height is taken off; in production there is no banner |
| Saved | A member without a photo showed a broken-image icon (the placeholder file was not a real image) | Uses the working placeholder |
| Settings, phone | "Notification Sound" text squeezed to one or two words a line; radio dots shrank where labels wrapped | Rows wrap; dots keep their size |
| Dark mode | Unselected radio buttons looked filled in; disabled buttons were dark text on muddy rose; "Warned", "Active" and category chips kept pale light-mode colours | Browser controls follow the theme; disabled buttons are plain grey; chips have dark colours |
| Toasts | 13px text at 4.25:1 contrast (axe); tiny close mark | 16px, darker text, larger Undo and close buttons |
| Onboarding step 1 | "Some required answers are missing" stayed on screen after everything was filled in | Goes away once nothing is missing |
| Reset password | "Invalid or expired reset token" with no way forward; page said only "at least 8 characters" | Plain words plus "Request New Reset Link"; the real rules are stated |
| Onboarding | "Error completing onboarding" shown to the member | Plain message saying nothing is lost |
| Events | Members saw "Local-Chapter" where admins chose "Local Chapter Event" | Same names |
| Welcome tour | Said Browse shows "one card at a time" (it shows a grid) | Corrected |
| Admin | Search placeholders cut off ("Name, email address or mem"); emails broke mid-word; Dismiss sat beside Ban when buttons wrapped | Hint written beside the box; emails wrap only when they must; Dismiss moves to the far side |
| Block dialog | Bullet dots detached from centred text on a phone | Left-aligned |
| Placeholders | Cut off on a phone in onboarding and change-password | Shortened |

## Found, still open (none blocks use; in rough order of worth)

- Position-your-photo and the admin event form are still taller than a small screen: they now scroll, but the buttons are not pinned in view.
- Tick boxes are small (16px); "Remember my email" and the "I understand" confirmations are easy to miss.
- Log in / sign up field labels, the password-rule checklist, Terms text, text typed into multi-line boxes and list options are smaller than the app's main text. Member-area confirmation dialogs use smaller text and smaller side-by-side buttons than the admin dialogs.
- The dialog close "x" is small, and its focus ring is a tall narrow pill.
- "Take a break" opens a red "Disable Your Account" dialog that looks like Delete; "Blocked Members" opens "Blocked Users".
- My Profile: in edit mode the subtitle still says "Choose Edit to change it"; Occupation appears in two places; Languages and Religion show an empty heading when blank; a lone briefcase icon in the preview when occupation is empty.
- A member's location is written four different ways across Browse, Liked, Saved, profile and preview.
- Lilac / purple is used beside the crimson scheme (interest chips, the Message button on match cards, "+ Add", the highlighted list option); interest chips come in three styles.
- Matches on a phone: the two tabs and the Active / History pills wrap to two lines. Notification and Saved buttons are smaller than buttons elsewhere.
- The welcome-tour dialog changes height between steps, so Next moves. Events dated next year show no year. Age range tops out at 99 in Settings and 100 in onboarding.
- Privacy link opens the combined page at the top (Terms first). The fraud-report address on the Safety page is not a link. The offline page uses another typeface. "Tap" is used on desktop. Spelling mixes British and American.
- Admin: raw server wording inside some error messages ("Error adding note"); the event photo field is the browser's plain file control; three styles of "nothing found".
- Earlier "still open" items from rounds 1 and 2 that this round did not change: Settings and the profile editor are long single pages; Like is below the first screen on a phone profile.
