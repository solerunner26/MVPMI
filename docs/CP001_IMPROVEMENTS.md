# Approved usability changes after cp001

Baseline: Git tag **cp001**, source `0bb8e7e60b1b22b0b2562a4f63e4fde6d78b7efa`. The tag is unchanged. It is a source/design checkpoint, not a database or credential backup.

## Language contract

- Fresh sessions start in Gujarati. A previously saved English choice remains English.
- Switching language shows only the chosen interface language: headings, buttons, validation, tooltips/accessibility names, confirmations, status copy and settings. The other language name remains visible only as the switch destination/selection option.
- Member-entered names, unknown places, phone numbers, filenames and technical device information are data, not machine-translated UI. Known villages/tehsil/district names use the existing translations.
- Gujarati consent and restore explanations include the actual consequences, rather than a generic instruction to check details.
- Print headers and Excel column headings follow the selected language. JSON backup field names stay stable for compatibility.
- Preferences are written only when they change; idle tabs no longer overwrite another tab's saved language/font choice on every clock tick.

## Disposition of all 15 review items

| # | Item | Result |
|---|---|---|
| 1 | Repeated bilingual labels and names | Single-language presentation; name fallbacks prevent blank names when the original design suppressed identical duplicates. |
| 2 | Split phone numbers | Full-width profile values and contact number rows; phone values remain unbroken at the tested sizes. |
| 3 | Floating controls over content | Replaced by a reserved bottom toolbar; content scrolls above it, not behind floating controls. |
| 4 | Small touch targets | Buttons and contact links have 48px minimum dimensions. Decorative icon glyphs are hidden from assistive technology. |
| 5 | Text-size unavailable before enrollment | Reading settings are reachable from signup, pending, gate/login and the rest of the app. |
| 6 | Incomplete Gujarati confirmations | Complete Gujarati consent/retention, restore, removal and rejection consequences. |
| 7 | Misleading approval animation/timer | Submitted date/time and truthful human-review status; smaller static illustration, close-and-return guidance and member-help route. No invented approval deadline. |
| 8 | Returning member recovery | Added an explicit Already a member entry and honest member-help dialog. **Automatic identity recovery is NOT implemented**: verified identity, SMS provider and an approved support contact are still needed. No membership is recovered solely by typing a known phone number. |
| 9 | Three-character name search | Short names now match; phone-number searches still need three digits. |
| 10 | Drag-only village ordering | Explicit reorder mode, labeled earlier/later buttons, disabled end controls, reset and persistence. Keyboard-compatible village buttons replace draggable click-only divs. |
| 11 | Technical comparison keys | Translated field labels/values in matched Current and Requested columns. |
| 12 | Generic/destructive confirmations | Action-specific submission/restore/removal labels; rejection and deletion approval require confirmation with consequences. |
| 13 | Competing effects / contrast concerns | Quieter opaque surfaces, reduced shadows, darker primary gradient, removed continuous motion and blur. **Actual device performance and manual contrast assessment remain required.** |
| 14 | Broken Gujarati characters | Removed remaining replacement characters in generated interface copy; automated encoding check added. **Native-speaker proofreading is still recommended.** |
| 15 | Phone-width desktop admin | Admin expands on wide screens; desktop dashboard uses three columns. Phone layouts remain compact. |

## Verification actually executed

- `npm run check` passed before the final Excel-language test was added; the Node suite was then rerun with **66 passing tests**. Executed checks include: existing browser/approval/contact flows, 3 embedded-authentication modes, dedicated language/usability journey, accessibility, and dependency audit.
- Accessibility suite extended and rerun: **29 states, zero reported axe rule violations**. Includes early reading settings in both languages, member help and village reordering. **196 incomplete node checks remain**, requiring manual evaluation; this is not accessibility certification.
- Language journey starts with a genuinely fresh Gujarati context (no seeded language preference), changes language in settings, checks persistence, consent/pending screens, both-language admin sections, populated update comparisons, rejection confirmation, 1024px admin width, saved village ordering and two-letter search.
- Existing font regression checks all four presets at 320/360/412px in Gujarati and English. Phone-number width is separately checked at Biggest. Rendered Gujarati profile screenshot inspected.
- External dialer/WhatsApp destinations are intercepted or mocked during automated tests; no synthetic number is contacted.
- Tests use isolated in-memory databases. No production member data was used.

The Windows/Mac desktop launchers, actual Android/iOS/desktop browser matrix, OS font settings, TalkBack, real SMS delivery/recovery, independent penetration testing and production load testing are not certified by these runs. Android native setup/debug chrome and external dialer/WhatsApp UI are outside the community renderer's language setting.

## Rollback

Ask the agent to restore **cp001**. Restore the source on the existing Arena branch and create a new rollback commit; do not switch branches or rewrite shared history. Reinstall dependencies/build after source restoration. A source rollback does not restore database contents.
