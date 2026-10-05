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
