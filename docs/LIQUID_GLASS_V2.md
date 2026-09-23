# Liquid Glass UI — v0.5 (iOS style, light & dark)

Checkpoint before this redesign: git tag **`Pre-LiquidGlass-v2`** (v0.4.0).
All design work is on branch `design/liquid-glass-v2`. **No functionality
changed**: every screen, button, text, handler and API call is the same; only
presentation (CSS, icons, class names) and a small presentation script were
added.

References studied: Apple Liquid Glass guidance (glass for the navigation
layer, capsule shapes, interactive lensing, morphing tab indicator),
`liquid_glass_widgets` (tab-bar jelly indicator, specular sharpness,
content-adaptive glass), `AndroidLiquidGlass` (lens, highlight, bottom tabs),
`Prismal`, `liquid-glass`, `react-native-liquid-glassmorphism` and the iOS
Control Center reference.

![Before and after, light](liquid-ios/before-after-light.png)

![Before and after, dark](liquid-ios/before-after-dark.png)

## What the members see

| Element | Liquid Glass treatment (same in light and dark) |
|---|---|
| Page | Warm "aurora" of saffron, terracotta, rose and lilac light (dark: ember, plum and midnight blue) so glass has colour to refract |
| Header | Floating glass capsule that stays at the top while scrolling; circular glass lens buttons |
| Tabs (Villages / All members, all admin panel sections) | Swiggy-style glass track with a bright glass **lens** that slides to the selected tab with a jelly squash, icon pops on selection; every tab has an icon |
| Buttons | One capsule family: **primary** = brand glass with glossy highlight, **secondary** = clear glass, **destructive** = red-tinted glass, **text** = plain. Same everywhere, including admin panels |
| Call / WhatsApp | Call = primary brand glass capsule; WhatsApp = green-tinted glass capsule |
| Cards (members, tiles, requests) | Calm frosted glass, light rim on top, soft depth; highlight follows your finger |
| Inputs & dropdowns | Pressed-in glass wells; brand glow ring when active; custom chevron |
| Switch, slider, checkbox | iOS switch with springy knob; slider with glass knob and brand fill; glass checkbox with animated tick |
| Sheets & dialogs | Thick glass bottom sheets with grabber, rising with a spring |
| Keypads (admin gate, app lock) | Round iOS passcode keys, glowing progress dots |
| Badges, avatars | Brand glass with inner light |

## Uniform-control rules

1. Same control type ⇒ same shape, height (≥ 48 px touch target), radius and
   state colours on every screen.
2. Buttons are capsules; icon buttons are circles; cards use 24–26 px radii;
   fields 16 px.
3. Selected state is always the sliding lens (tabs) or brand fill
   (checkbox/switch) — never a changed border.
4. Press feedback everywhere: quick squash (0.955) and spring back.

## Both themes, three material levels

| `data-material` | When | Look |
|---|---|---|
| `blur` | Normal phones | Full glass: blur + tint + rim + sheen (blur only on the floating header, tabs, search and sheets — lists stay smooth) |
| `translucent` | Browser without backdrop blur | Same, denser tints |
| `opaque` | Low-end phones (≤ 2 cores/2 GB), "Visual effects" off, reduced transparency | Solid colours, same shapes and layout (maximum legibility, lowest battery) |

Windows/Android high-contrast (forced colours) uses the system palette.
Reduced-motion turns every animation off. The page background is static on
purpose (an animated backdrop would re-blur every surface each frame).

## Files

- `web/liquid-ios.css` — the whole design layer, loaded last, scoped to `.app.lq`.
- `web/liquid-ios.mjs` — tab lens placement, finger-following sheen, slider fill (DOM-only).
- `scripts/audit-design.mjs` — adds the `lq` class and keypad hooks at build time.
- `web/village-workflow.mjs`, `web/security-ui.mjs` — button variants and tab icons (class names only).

## Accessibility & test evidence

- `npm run check` — all suites green (unit, UI, lock, embedded, 29-screen
  axe scan, language, village workflow, 20 material states, audit).
- New `scripts/glass-contrast-checks.mjs`: axe cannot measure text on
  gradients/glass, so those texts are screenshotted and measured on the real
  pixels (WCAG AA 4.5:1, 3:1 for large text).
- New `npm run test:glass` (slow, ~1 hour in software rendering; run before
  a release): every main screen in full glass mode, light and dark, with axe +
  pixel contrast; also saves the screenshot gallery. This build: 21 screens ×
  2 themes passed with 0 violations; the last two screens (village-admin
  members tab, PIN setup) reuse already-checked components.
- Primary brand colours were darkened slightly so white text on buttons
  meets AA (≥ 4.5:1).

Undo: `git checkout Pre-LiquidGlass-v2 -- web scripts` (or reset the branch).
