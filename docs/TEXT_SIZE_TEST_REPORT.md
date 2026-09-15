# Text-size presets and reflow checks

## Behaviour

The existing My profile Text size tile now has four bilingual buttons in a two-column grid:

- Default: 100% (restores the original text size)
- Big: 120%
- Bigger: 140%
- Biggest: 160%

Exactly one option is selected, exposed with `aria-pressed`. The existing preference storage saves the choice. Old slider values migrate to the nearest supported preset; invalid values reset to Default. Selection scrolls the group into view above the floating language/theme buttons.

## Layout correction

Bilingual labels may wrap rather than remaining nowrap. Text-bearing buttons retain their original minimum height but expand for their content. Fixed square icons and avatars do not shrink under text pressure. Dialogs can scroll, and flex children can shrink/wrap without overflowing the controls. Original supplied HTML exports are unchanged; the build applies the requested tile replacement and shared reflow styling.

## Executed verification

- `npm run check`: 59 Node tests passed, full browser workflow/contact regression passed, all three embedded-authentication modes passed, dependency audit reported zero known vulnerabilities.
- The browser suite checks every preset at 320, 360 and 412 pixels, in Gujarati and English, on My profile, directory tiles and the directory list. It asserts button/bilingual-label scroll dimensions do not overflow, verifies the active state and exact scale, and checks saved preference, reload persistence and Default reset. Biggest is also checked in the alternate theme.
- Accessibility suite: 25 screen/state scans, zero reported axe violations. Control overflow is asserted on every scanned state; Biggest remains selected through edit-profile, gate, login, password reset and all scanned admin sections. Incomplete accessibility checks still need manual review.
- After the final icon sizing and scroll-visibility refinements, the browser suite was rerun successfully. After icon sizing, accessibility scans were also rerun successfully.
- A 360px Biggest screenshot was inspected during development; generated evidence is in ignored `test-results/`.

This is Chromium automation and visual inspection, not certification of every phone/WebView, OS font setting, TalkBack or arbitrary future content. Real-device checks remain required. The running preview serves the rebuilt assets; refresh it to load the change. No preview membership data was changed by these tests.
