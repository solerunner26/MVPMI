# MVPMl — Liquid Glass review build

17 September 2026 · Evolution of the existing app, not a replacement.

**Status:** implemented for design review; not production or real-device sign-off. This is a restrained CSS/WebView material implementation, **not native refractive glass**. No shader/UI library was added.

## Checkpoint and provenance

Before any upgrade edits, annotated tag **`Pre-LiquidGlass-Upgrade`** was created, pushed and verified against commit **`3179e92f44a7e1d2b5957c6ff75e791b030e81e2`**. A full tracked-source ZIP was also created at `/home/user/checkpoints/MVPMI-Pre-LiquidGlass-Upgrade.zip`.

The supplied dossier identifies its snapshot as **Best1 — 15 September 2026**, and lists the original prototype, handoff and Sun components. Those original files remain unedited. There is no separate Best1 tag or `checkpoints/Best1/` folder in this checkout; its independent identity cannot be verified. Nothing was created, renamed or substituted under that name. cp001 and cp002 were not changed.

### UNDO

“UNDO” means restore the pre-upgrade **source tree**, including layouts, styles, components, copy, interactions, motion and navigation—not approximate it with another theme.

After saving any later work, on the existing Arena branch:

```sh
git fetch origin tag Pre-LiquidGlass-Upgrade
git restore --source=Pre-LiquidGlass-Upgrade --staged --worktree -- .
git commit -m "Restore exact pre-Liquid Glass source"
npm ci
npm run build
```

Restart the server and reload the app. The new tracked material, bilingual and test files are removed by that source restoration. No reset of another branch is needed. The checkpoint does **not** back up live membership data, secrets, runtime settings or browser-local preferences. It must not be used to roll back real membership transactions.

## Design system

`web/liquid-glass.css` centralizes material tint, blur, saturation, rims, depth, shadows, radii, spacing, type and motion. `scripts/liquid-glass.mjs` adapts the existing renderer without editing the original prototype.

| Level | Treatment                                                                                | Use                                                    |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0     | Quiet ivory/espresso reading ground                                                      | Page and ungrouped text                                |
| 1     | Solid warm surface, quiet edge, minimal shadow                                           | Villages, members, forms, repeated content             |
| 2     | Warm high-opacity tint, reflected rim, internal edge, optional 12px/125% backdrop effect | Header, search, compact controls, reading controls     |
| 3     | Preserved selected/action colour, restrained tactile depth                               | All Members, primary/selected actions, confirmation    |
| 4     | Stronger rim and elevation with **solid reading scrim**                                  | Sheets, confirmation, recovery and preferences dialogs |

Terracotta `#B2402C`, marigold `#E9A13B`, ivory/espresso, warm inks and existing danger/confirmation meanings remain. Text itself is never blurred or refracted. Contrast testing takes precedence over transparency; specifically, dialog text is isolated from the contact rows behind it.

Repeated scrolling controls have no backdrop capture. Nested controls do not add another blur pass. The village Sun remains visible but does not continuously rotate; the original waiting Sun/sandwatch remains the emotional focal point. No animated decorative blobs or page-wide shader layer were introduced.

Press feedback uses restrained compression and a short settling curve, not a physics engine. Reduced motion removes animation and transitions. The existing reading panel now also exposes **Visual effects**, independent of business state and navigation.

### Capability ladder

1. **Full refractive/native optics:** deferred; no compatible native renderer has been integrated or device-profiled.
2. **Advanced optical/shader tier:** deferred for the same reason. No misleading high-fidelity flag.
3. **Blur material:** CSS support detected; tint, rims and restrained depth remain separate from content.
4. **Translucent fallback:** same component geometry and actions, without backdrop filtering.
5. **Opaque fallback:** explicit effects-off, reduced transparency, forced colours, save-data, or limited CPU/memory hints. No animated effects; forced-colour rendering uses system colours.

Capability hints are conservative, **not a GPU benchmark**. Android minSdk remains **21**; no older target was removed. This online WebView implementation still depends on a sufficiently modern WebView and connectivity. Android 9+ and older-device runtime performance are not certified by browser tests or compilation.

## Bilingual and elderly-friendly behaviour

- Gujarati remains the fresh-install default. Both languages are visible; switching changes primacy and sorting, not visibility.
- Original static pairs are restored. Generated copy uses language-tagged React text nodes supported by the existing renderer.
- A read-only alternate-language presentation pass supplies generated pairs. An explicit allowlist prevents it from replacing primary handlers, identifiers, input values or stored data. Member sections retain the primary language's sort order.
- Known place names have paired form hints and paired directory/profile/admin presentation. Timestamps, errors, request comparisons, archive statuses and recovery messages are included.
- PDF output keeps both names/headings/place spellings when supplied. Excel headers and place/number-type labels are bilingual. Export authorization and backup JSON semantics are unchanged.
- Names are not machine-translated. If only one spelling was supplied, the app does not invent another identity.
- Noto Sans Gujarati and Manrope remain locally bundled by the existing build.
- The slider is continuous **85–165%**, with one-percent keyboard steps, immediate percentage feedback, persistence and a 100% reset. Old 120/140/160 preferences remain exact values.
- Buttons have a 48px minimum, growing with text. Large-text grids collapse to a single column; controls and bilingual labels wrap. The overflowing waiting screen starts at its top rather than clipping the Sun through vertical centring.

## Screen and state coverage

The original eleven-screen inventory and its admin subsections remain: entry, pending, village directory, member list, profile, edit, hidden gate, admin login, reset, dashboard and admin sections. No new tabs, drawer, bottom navigation destinations or membership features were added. The pre-existing utility toolbar and preferences panel were reused.

| State/workflow                            | Treatment and evidence                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Loading                                   | Readable neutral busy surface; no generic replacement for the waiting Sun                                                |
| Initial server failure                    | Dedicated unavailable message and working Retry; no misleading stale-data claim                                          |
| Offline                                   | Bilingual connection guidance and retry                                                                                  |
| Lost connection after loading             | Explicit possibly-stale warning, last-connected timestamp and connection requirement for changes                         |
| No results / zero members                 | Existing counts and empty-result branches retained                                                                       |
| No requests / archive / alerts            | Existing empty states retained and bilingual; no invented queue behaviour                                                |
| Enrollment / approval / updates / removal | Existing server-backed flows, approval gate and consent retained                                                         |
| Admin edits / archive / backup / restore  | Existing immediate-edit and admin-only boundaries retained                                                               |
| Export / print / restore errors           | Existing error handling with paired UI copy; export remains admin-only                                                   |
| Call / WhatsApp                           | Actual user-activated handoffs and explanatory/retry sheets retained; OS availability is not falsely reported as success |
| Recovery / security                       | Existing verified assisted recovery, session revocation, hidden five-tap gate and release guards retained                |

## Checkpoint comparison

| Category                     | Result                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preserved**                | Original assets, warm brand, Sun identity, eleven-screen IA, seven villages plus All Members, eight admin tiles, API authorization, requests, archive, recovery and handoffs                                            |
| **Improved**                 | Purposeful material hierarchy, explicit effects fallback, visible bilingual pairs, exact slider, paired exports, readable status states and expanded checks                                                             |
| **Simplified**               | Quiet repeated content, no list blur, no nested blur, no continuously rotating village ornaments, no large moving background decorations                                                                                |
| **Changed**                  | cp002's selected-only text and four presets are intentionally superseded; pending Sun restored to 168px; timestamps are quieter metadata; dialogs use a solid reading scrim; large text changes grid density            |
| **Deferred**                 | Physical refraction, AGSL/Compose/Flutter libraries, haptics, measured low-end GPU tuning, offline-native storage and production-release backlog                                                                        |
| **Risks / remaining review** | Dense paired labels increase scrolling; native-speaker/elder review is needed; two-language presentation adds CPU work; native OS text scaling and TalkBack remain device checks; no full Android-version certification |

## Reference study and decisions

The references were studied as implementation inspiration, not installation instructions:

- [Liquid Glass Widgets](https://github.com/sdegenaar/liquid_glass_widgets): scoped materials, adaptive quality, theme resolution and accessibility separation. Adopted the separation and grouping principles, not Flutter or its shader engine.
- [ControlCenterForSwiftUI](https://github.com/alessiorubicini/ControlCenterForSwiftUI): immediate slider/value feedback and tactile controls. Kept the existing Android-appropriate layout, not an iOS control centre.
- [Liquid Glass Reference](https://github.com/veersr9/Liquid-Glass-Reference): navigation-layer materials rather than glass content cells; older-platform fallback. Applied this distinction without introducing tabs.
- [Liquid Glass Generator](https://github.com/yanglei1826877278/liquid-glass): independent blur, saturation, opacity, tint, glow and border controls. Used centralized optical tokens; rejected translucent typography.
- [Prismal](https://github.com/styropyr0/Prismal): refraction/Fresnel/inner-depth concepts and the cost of per-view backdrop capture. Used restrained rim/depth cues and avoided repeated capture; no OpenGL library installed.
- [AndroidLiquidGlass](https://github.com/Kyant0/AndroidLiquidGlass): inspected its Compose slider example, including value range, drag feedback, backdrop, lens/highlight and inner-shadow separation. Kept a native HTML range control rather than porting the stack or adding bottom tabs.
- [React Native Liquid Glass](https://himanshu-lal4.github.io/react-native-liquid-glassmorphism/): platform-specific shader capability, touch optics and graceful degradation. Did not equate CSS blur with Android 13+ AGSL refraction.

## Verification and reproduction

```sh
npm run check
CAPTURE_DESIGN=1 npm run test:accessibility
```

The check includes Node/security tests, full browser workflows/contact checks, three embedded-session modes, slider/layout coverage, language/recovery tests and material-specific checks. The capture run explicitly simulates higher capability hints to exercise the blur path; it is not a performance measurement.

Current evidence:

- **80 Node tests** including recovery/security, view pairing, capability selection, slider and export checks.
- **29 app accessibility states:** zero reported violations and zero incomplete checks in the capture/blur run; the regular run also covers the conservative default path.
- **20 material/accessibility states:** both themes, 85/165%, blur/translucent/opaque, reduced transparency and forced colours; zero violations or incomplete checks.
- Slider/layout matrix: 320/360/412px × Gujarati/English × 85/100/125/165%, across profile, village tiles and member list. Includes minimum button targets and unreachable-top checks.
- Actual Gujarati/English sort reversal with distinct synthetic names, seven Sun-mark tiles, recovery in cookie/no-cookie modes and old-device revocation.
- Initial server outage, Retry, stale timestamp and offline recovery exercised.
- Baseline screenshots: `test-results/pre-liquid-glass/`; upgraded captures: `test-results/liquid-glass/`. Generated artifacts stay out of Git.

Automated results do **not** replace real-device TalkBack, OS font-scale, low-end frame-time/battery, native dialler/WhatsApp, Gujarati proofreading or elderly-user acceptance checks. Visual approval is still required. No production-readiness claim is made.

## Refinement — 20 September 2026 (v0.2.0)

The modern redesign had quietly neutralised the glass layer (0.96-alpha tint,
shadows and rims stripped). This refinement restores genuine Liquid Glass on
the modern editorial palette, checkpointed at tag
`Pre-LiquidGlass-Refinement`:

- **Surfaces**: translucent white glass in light theme
  (`rgba(255,255,255,.6)` controls, `.88` reading sheets) and darker
  translucent glass in dark theme (`rgba(35,31,27,.62/.9)`), each with a thin
  bright inner rim, an inner light edge, a reflection hairline on modals and
  soft layered shadows.
- **Where glass lives**: header bar, header trigger chips, floating Dashboard
  and workflow buttons, search, reading slider, sheets/dialogs and the
  all-admins quick actions. Directory rows, member cards and forms stay on
  quiet opaque surfaces for scanning (no stacked glass).
- **Performance budget**: real `backdrop-filter` runs only on modal sheets
  and the reading control (0 layers while browsing, 1 with a sheet open);
  buttons use the translucent tint without blur so long lists never pay.
- **Accessibility fallbacks**: `prefers-reduced-transparency`, forced colors,
  save-data and ≤2-core devices keep fully opaque surfaces; measured text
  contrast on composited glass: ink 13.7–15.9:1, secondary 5.3–8.8:1, icons
  ≥6.5:1 (requirements 4.5:1 / 3:1).
- **States**: press (short settle scale), hover (rim brightens), disabled
  (dimmed, desaturated), selected/pressed toggles (accent ring), focus
  (3px outline).
- Verified by the full battery: 99 Node tests, UI, language, 29-screen
  accessibility, embedded, village workflow and 20-state material suites.
  Screenshots: `docs/modern-design/glass-refinement/`.
