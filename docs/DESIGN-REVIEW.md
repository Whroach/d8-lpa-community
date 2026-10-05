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
