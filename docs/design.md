# Design — MVPMI Community Directory

Design reference for the Mahuva Vala Rajput Samaj community directory
(Android app + web, version 1.3.0-alpha.2). It describes the app **as built**;
values come from the source (`Community Directory.dc.html`, `web/liquid-ios.css`,
`web/alpha.css`, `web/village-workflow.css`). When this file and the code
disagree, the code wins — update this file.

---

## 1. Principles

1. **Private and trusted.** Only approved members see the directory. Nothing
   personal is shown before login, behind the lock screen, or in notifications.
2. **Simple for every age.** Large tap targets (48 px minimum), plain words,
   one main action per screen, text size up to 165%.
3. **Gujarati first.** The app opens in Gujarati; one tap switches every text
   to English. Both languages are designed, not machine-swapped.
4. **Warm glass, not decoration.** A saffron/brick identity on soft frosted
   "liquid glass" surfaces. Glass is for navigation and sheets; content stays
   calm and readable.
5. **Errors say what happened and what to do**, at the top of the screen, with
   the real reason (e.g. "Village Admin must verify first — call …").

---

## 2. Colour

### Brand

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ind` (brand) | `#B2402C` brick | `#FF9D74` | Primary buttons, active tab, links, icons |
| `--aqua` (saffron) | `#E9A13B` | `#F3BC6A` | Gradient end, sun mark, highlights |
| `--grad` | `135deg, #B2402C → #E9A13B` | same | Avatars, primary capsule buttons, count badges |
| `--lq-brand` | `#C4492F` | `#E0664A` | Liquid-glass accent (lens glow, focus ring) |

### Text and surfaces

| Token | Light | Dark |
|---|---|---|
| `--ink` (text) | `#241413` | `#F7EDE4` |
| `--ink2` (secondary text) | `#6B4F48` | `#C3A79C` |
| `--lq-base` (page) | `#F7EEE5` warm paper + soft radial glow | `#120B0A` + brick glow |
| `--sheet` (dialogs) | `rgba(255,250,244,.92)` | `rgba(32,20,17,.92)` |
| `--field` (inputs) | `rgba(255,255,255,.72)` | `rgba(255,255,255,.06)` |
| `--lq-hairline` (dividers) | `rgba(84,46,30,.10)` | `rgba(255,240,225,.10)` |
| `--scrim` (behind dialogs) | `rgba(36,20,19,.42)` | `rgba(4,7,18,.60)` |

### Meaning (semantic, never used as decoration)

| Meaning | Light | Dark | Where |
|---|---|---|---|
| Success / own name | `#17692F` (names), `--ok #2F7A44` | `#5EE08A`, `#8FD3A0` | "Saved", own name in directory, Call icon |
| Danger / admin names | `#C62828` (names), `--dan #9E2B1E` | `#FF7B7B`, `#FF9A86` | Reject, Remove, Sign out, admin names |
| Error banner | `#B3261E` background, white text | same | Top error banner |
| WhatsApp | `#128C4B` | `#6BD49A` | WhatsApp icon only |

**Name colours (owner decision):** your own name is **green**, every admin
(Main or Village) is **red**, everyone else uses `--ink`. There is no "You" label.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Gujarati (default) | **Noto Sans Gujarati** (400–800, self-hosted) | All Gujarati text |
| English | **Manrope** (400–800, self-hosted) | Applied with `.en` / `data-lang="en"` |
| Fallback | `-apple-system, system-ui, sans-serif` | |

**Scale** — every size multiplies by `--fs` (the text-size setting):

| Token | Base | Use |
|---|---|---|
| `--f-xs` | 11 px | Village · taluka line, hints, labels |
| `--f-sm` | 13 px | Secondary text, tab labels, captions |
| `--f-md` | 15 px | Body, names in lists, inputs (inputs never below 16 px) |
| `--f-lg` | 19 px | Card titles |
| `--f-xl` | 24 px | Screen titles |
| `--f-2xl` | 30 px | Big numbers (dashboard counts) |

**Text size setting:** 85% – 165% in 5% steps (Settings → Display), with a
**Reset to 100%** button. At every size, long names wrap to two lines and end in
"…"; text never runs under the Call/WhatsApp buttons. The header community name
grows only to 115% so search keeps its width.

Weights: 800 for names and titles, 700 for buttons and labels, 500–600 for body.

---

## 4. Shape, depth and motion

| Token | Value | Use |
|---|---|---|
| `--lq-r-card` | 26 px | Cards, sheets |
| `--lq-r-inner` | 18 px | Rows inside cards, notices |
| `--lq-r-field` | 16 px | Inputs |
| Capsule | 999 px | Buttons, chips, tabs, search box |
| Circle | 50% | Avatars (40 px), round icon buttons (44–48 px) |
| `--lq-drop` | soft warm shadow | Floating glass (header, sheets) |
| `--lq-blur` | `blur(22px) saturate(185%)` | Header, tab bars, sheets only (performance budget) |
| `--lq-spring` | `cubic-bezier(.34,1.45,.52,1)` | Tab lens slide, button press |
| `--lq-ease` | `cubic-bezier(.22,1,.36,1)` | Sheets, fades |
| `--lq-press` | 160 ms | Press feedback |

Motion respects `prefers-reduced-motion`. Nothing animates while idle.

**Liquid glass:** translucent fill + light rim (top/left brighter) + inner glow
+ a sheen that follows the finger. Scrolling content cards keep the tint and rim
but no real blur, so low-end phones stay smooth. An "opaque" material mode
exists for readability.

---

## 5. Layout

- Phone-first: designed at **360 × 728** (6-inch phone), tested at 320, 360
  and 412 px, portrait and landscape; max content width 412 px on larger
  screens. No sideways scrolling anywhere.
- Side gutter 10–16 px. Spacing between groups with `gap`, not margins.
- Tap targets ≥ **48 px** (`--tap` grows with text size up to 70 px).
- Android status and navigation bars are coloured strips (brick top, dark
  bottom) so the app draws edge-to-edge safely on Android 15+.

### Directory header (owner-specified, 3 lines)

```
Line 1  (☀ sun logo)  Mahuva Vala Rajput Samaj      ← always ONE line
Line 2  [ 🔍 Search name, number or village            ]
Line 3  [All] [Thorala] [Sathra] [Taredi] [Lilvan] …   ← scrolls sideways
```

The community name never wraps: it shrinks (20 → 12 px) until it fits, in
both languages. The search hint falls back to "Search" when a large text
size leaves no room. The village chips are always visible (the old Filter
icon was removed — the chips do that job).

### Bottom navigation bar (floating glass capsule)

```
 ╭──────────────────────────────────────────────────╮
 │ (👤)      (⚙/🛡)      ( 🔍 )      (🌙)      (अ/A) │
 │ Profile  Settings*   Search     Dark    English  │
 ╰──────────────────────────────────────────────────╯
   * Admins see "Admin" (shield, with request badge) instead of Settings
```

- Five tabs, Search raised in the centre on the brand gradient. Theme and
  Language are toggles (they act, they don't navigate); the language tab
  names the language you switch TO.
- Inactive icons are outlined, the active one is filled inside a rounded
  pill; icon swap and pill use spring motion (bouncy spatial, calm effects);
  light haptic tick on tap.
- "Liquid crystal" glass: the page is blurred live behind the bar (34 dp on
  Android 12+, 28 px backdrop-filter in browsers), a white 15 % overlay, a
  glossy top highlight and a thin glowing rim. Android 10–11 get a solid
  tinted glass.
- Floats 10–12 dp above the system navigation bar (window insets); the
  member list scrolls under it. Hidden on the splash, while the keyboard is
  open, and under sheets and dialogs. Shown on Directory, My Profile,
  Settings and Admin.
- Android: native Jetpack Compose (`AdvancedBottomNavigationBar`, Material 3
  `NavigationBar` + Haze). Browsers: the same design in HTML/CSS.

### Splash screen (Android app)

The deity image in a tall arch with a gold rim and a slow glow, the sun
medallion overlapping its foot (slowly turning), the community name on one
line, "Bhavnagar district • Sangathan, Sanskar ane Seva", member counts
(village / total, when known), a big **"પ્રવેશ કરો • Enter Directory"**
button — the app opens only when it is pressed — and Main Admin / Village
Admin contact chips. Brand saffron and brick (not the sample's green).
Shown once per app start; Back on the splash leaves the app.

### Sun symbol

The sun is the community's holy symbol ("community logo 2": a gold sun on
deep red). It is the app icon (launcher, web icons, favicon), the logo on
Login/Register, in the directory header and on the member page, and the
medallion on the splash. In the app it is shown as a round badge with a thin
gold rim. While a registration waits for approval, the animated "waiting sun"
(rays turning both ways, hourglass in the disc) replaces the logo.

### Member details page

Full page (not a sheet): back arrow + sun + "Member Details", then one card
crowned by a faint turning sun: gold-ringed initial medallion, name (other
language below), role pill (admins on the brick gradient), **Call** (brick
gradient) and **WhatsApp** (saffron gradient), numbers, native village with
taluka/district, current residence, and "see all members from <village>"
which filters the directory. Two tones only — brick and saffron; no green on
this page.

### Contact row

```
(A)  Asha Patel                         (📞) (🟢 WhatsApp)
     Thorala • Mahuva
```
Avatar 40 px with the first letter on the brand gradient; name (wraps to 2
lines max); village • taluka in `--ink2`; two 44 px round actions. Tapping the
row opens the contact sheet with full details.

---

## 6. Components

| Component | Description |
|---|---|
| **Top bar** | Glass bar: Back (left), title, optional action (right). Admin screens show "ADMIN PANEL" eyebrow. |
| **Buttons** | Primary = brand gradient capsule, white text; Secondary = glass capsule; Danger = red text/outline; Text button = brand-coloured label. Disabled primary = calm neutral capsule. |
| **Icon button** | 44–48 px glass circle with a Phosphor duotone icon and an accessible name; optional count badge. |
| **Chips** | Village filters; selected chip = brand fill, white text. |
| **Segmented tabs** | Glass track with a sliding "lens" on the active tab; icon beside label, 48 px tall; wraps into rows of 2–3 (Main Admin: 2 × 2). |
| **Cards / tiles** | Dashboard tiles: rounded rectangle, sun mark, count badge, title + one-line description. |
| **Sheets / dialogs** | Bottom sheet on glass with title, close (×), body and actions; scrim behind. Used for confirmations, contact details, PIN, password. |
| **Switch** | Label + note on the left, track on the right; `role="switch"`. Used for PIN lock and fingerprint. |
| **Fields** | Label above, 52 px well, focus ring in brand; error text below and field outlined red; typing is kept on error. |
| **Toast** | Dark rounded bar near the bottom: "Saved", "PIN lock is on" (`role="status"`). |
| **Error banner** | Full-width red banner fixed at the very top: title, plain reason, technical code, Close. Stays until dismissed. |
| **Offline banner** | "No internet / Server not reachable — Retry" with "Last updated …"; saved directory stays usable. |
| **Notice** | Inline info/error box inside forms ("Wrong PIN", "Offline: opens with the PIN saved on this phone"). |
| **Status pill** | Small coloured dot + text: "Waiting for village verification", "Active", "No Village Admin". |

Icons: **Phosphor Duotone** (subset built into the app). Every icon-only
control has an accessible label in both languages.

---

## 7. Screens

| Area | Screens |
|---|---|
| Entry | Login (mobile only; "Main Admin? Log in with password"), Register, Pending approval, Set first password (Main Admin) |
| Member | Directory, Contact sheet, My Profile, Request profile change, Request removal, Settings, All admins |
| Lock (optional) | Set PIN dialog, Lock screen (PIN, fingerprint, "Forgot PIN? Sign out") |
| Village Admin | Review panel: Requests (verify & forward / reject / correct), My village members (propose change / removal) |
| Main Admin | Dashboard (Total members, Requests, Reports, Backup & export, Archive, Security alerts, Manage Village Admins, My Profile), village lists, Edit member, review panel with Manage Village Admins / Rejected-closed / Removed members, Change Password |

See the screenshot walkthrough (63 steps) for every screen in order.

---

## 8. Themes and language

- **Light** (default) and **Dark**, switched from the bottom bar; the
  choice is remembered. Every colour is a token with both values.
- **Gujarati** (default) and **English**, switched from the bottom bar (and on
  Login/Lock). The choice is remembered; the Android system prompts
  (fingerprint, save sheet) use the same language.

---

## 9. Accessibility

- Contrast: text meets WCAG AA in both themes; automated axe scan (no serious
  or critical issues) runs on every main screen in CI.
- Every control has an accessible name; dialogs are `role="dialog"` with
  `aria-modal`; toasts and the error banner are live regions.
- Works with system font scaling plus the in-app 85–165% setting.
- Focus is visible (brand outline); reduced motion is honoured.
- Old Android System WebView (from version 74) is supported; very old
  WebViews get slightly tighter spacing (no flex `gap` before version 84).

---

## 10. Privacy in the design

- Screenshots and the recent-apps preview are blocked **only** while the
  optional PIN lock is on.
- Nothing is visible behind the lock screen; dialogs close when the lock
  engages (but a dialog opened on the lock screen stays until answered).
- Notifications never contain phone numbers.
- Numbers are never copied to the clipboard; Call opens the dialler, WhatsApp
  opens wa.me.

---

## 11. Known design issues (30 Sep 2026)

- The "Your registration is approved! Logging you in…" toast reappears for
  members approved earlier, including over the lock screen.
- "Create Village Admin" button wraps onto three lines in the new Village
  Admin form at 360 px.
