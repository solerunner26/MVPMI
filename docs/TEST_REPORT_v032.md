# MVPMI v0.3.2 — Test & Verification Report

**Date:** 22 September 2026
**Version:** 0.3.2 (Android versionCode 6)
**Purpose:** summary of every change and every test executed for the
v0.3.2 work items, written so an independent reviewer (human or AI) can
re-run and verify each claim. Nothing here is a certification; the honest
limits are listed at the end.

## How to verify everything in this report

```sh
git clone https://github.com/solerunner26/MVPMI && cd MVPMI
git checkout v0.3.2-beta.1        # the exact tag this report covers
npm ci                             # installs the pinned lockfile
npm run check                      # ALL suites below in one command
```

`npm run check` runs, in order: `npm test` (Node), `test:ui`, `test:embedded`,
`test:accessibility`, `test:language`, `test:village`, `test:materials`,
and `npm audit --audit-level=moderate`.

## 1. What changed in v0.3.2 (the 8 requested items)

| # | Requested | Implemented as |
|---|---|---|
| 1 | Village-admin update/removal proposals gave no feedback and the form stayed open | Submitting "માહિતી બદલવાની સૂચના"/"દૂર કરવાની સૂચના" now closes the form and shows a server-confirmed green notice "મુખ્ય એડમિનને મોકલી દીધું · Forwarded to the main administrator…" on the member card (`web/village-workflow.mjs`, class `workflow-forwarded`) |
| 2 | A "Total members" tile that lists all members | The Total-members stats screen now leads with a "કુલ સભ્યો / Total members" tile; tapping it lists every member with Edit and Delete actions |
| 3 | Tile redesign with the community's rotating Sun mark instead of the Home icon | One uniform tile component `.mvpmi-tile` used by admin dashboard, stats villages, Total members, backup/export options and the directory village tiles. Every tile carries the Sun mark slowly rotating (36 s/turn; disabled when the app's motion setting is off or the OS requests reduced motion). The Home icon in the directory "Villages" segment was replaced with the Sun mark as well |
| 4 | Reports: serial numbers, community letterhead, date | Every PDF report (`reportDocument`, `printDocument`) prints on a letterhead: Sun symbol + "મહુવા ક્ષત્રિય રાજપૂત સમાજ / Mahuva Kshatriya Rajput Samaj" + "મહુવા-ભાવનગર જિલ્લો / Mahuva-Bhavnagar District" with the date at the right, and every table starts with a ક્રમ/# column. CSV exports number their data rows; the Excel export gained a ક્રમ/# first column |
| 5 | Fold the Members tile into Total members | The standalone Members tile was removed (7 dashboard tiles now); its edit/delete list lives behind the Total members tile |
| 6 | Tiles were too big | Dashboard tiles shrank from 170 px to 110 px minimum height (measured); all tile grids use one compact size |
| 7 | Full testing + remove unnecessary spaces + a report for another AI | All suites re-run (below); a rendered-text sweep removed 12 double-space separators; this document is the report |
| 8 | Yellow/off-theme icons | The success colour was amber/gold (`#8A5512` light, `#F3BC6A` dark) — it is now true green (`#2F7A44` light, `#8FD3A0` dark). Aqua/gold icon accents were re-pointed to the brand accent. Per-tile coloured icon squares are gone (Sun mark). A live sweep verified every visible Phosphor icon renders in the theme family colours |

Key files: `Community Directory.dc.html` (template markup + base logic),
`web/controller.js` (live logic: all-members actions, report icons),
`web/village-workflow.mjs` (+css) (VA confirmation), `web/modern-design.css`
+ `scripts/modern-design.mjs` + `scripts/refine-design.mjs` (tile system),
`web/print-document.mjs` (letterhead + serials), `server/app.mjs`
(CSV/XLSX serials).

## 2. Automated suites executed (all green)

| Suite | Command | Result |
|---|---|---|
| Node API/security/store/localisation | `npm test` | **101/101 pass, 0 fail** — includes CSV BOM + serial-column tests, XLSX header test, rejected-number flagging, backup atomicity, session handling |
| Browser workflow | `npm run test:ui` | PASS — signup → pending → admin approval → directory → profile edit → admin edit via the **new Total-members → all-members flow** (incl. hostile-name injection safety at 4 widths × both languages) |
| Embedded sessions | `npm run test:embedded` | PASS ×3 modes (cookies / no-cookies / no-storage) |
| Accessibility (axe WCAG A/AA) | `npm run test:accessibility` | **29 screens scanned, 0 rule violations** (now includes the all-members list screen) |
| Language | `npm run test:language` | PASS — one language at a time on every screen incl. the new all-members list; 7 Sun-mark village tiles retained |
| Village workflow | `npm run test:village` | PASS — incl. **new regression**: after sending a change/removal proposal the confirmation appears and the form closes; 165 % English dark scan |
| Materials/a11y fallback | `npm run test:materials` | PASS — 20 states: both themes, 85/165 % text, blur/translucent/opaque, OS preferences, outage/retry/offline |
| Dependency audit | `npm audit --audit-level=moderate` | 0 vulnerabilities |

## 3. Live verification beyond the suites (probe on the running app)

A headless-browser probe (`probe-v032.mjs`, since deleted) verified on the
running preview, in **both themes**:

1. **Dashboard tiles:** exactly 7; every tile contains the Sun mark
   (`<svg>` with gradient defs) and **no Phosphor icon**; every tile has the
   brand stripe element; measured height 110 px (was 170 px); the Sun's
   computed `animation-name` is `tileSunTurn` with motion on, `none` with
   motion off (accessibility fallback respected).
2. **Stats screen:** 8 tiles — "કુલ સભ્યો/Total members" first, then the
   7 villages with counts; tapping Total members lists **all 15 members**,
   each with Edit and Delete buttons; Back returns to the village list and
   then the dashboard.
3. **Icon colour sweep:** every visible `i.ph-duotone` element's computed
   colour falls inside the theme family (brand accent, ink, muted ink,
   danger red, success green, white) — zero foreign colours.
4. **Text spacing sweep:** no double spaces between words and no leading
   padding in any visible text node (after normalising 12 double-space
   separators in the source).
5. **Village-admin proposal:** sending "માહિતી બદલવાની સૂચના" shows the
   forwarded confirmation, closes the form, and the card shows the
   awaiting-decision state; the dashboard badge counts it.
6. **Reports:** `reportDocument`/`printDocument` output contains the
   letterhead (Sun SVG, community name, Mahuva-Bhavnagar District, date on
   the right) and serial cells `<td>1</td>…<td>N</td>` in Gujarati and
   English.
7. **Zero page errors** in every probed session.

## 4. Regression caught and fixed during this work

Removing the Members tab exposed a latent bug: `scripts/refine-design.mjs`
spliced the template with an unguarded `indexOf` result, silently doubling
the rendered template (the rejected utility dock reappeared). Fixed by
guarding the removed-list hook; the `test:ui` "dock must be absent" check
and the doubling are now impossible. A second regression (deleted
`archive`/`alerts` render values) was caught by the app's own error
surface and restored; all suites then passed.

## 5. Android-specific testing status

- **CI builds the debug APK** on every push (Kotlin compile, Android Lint,
  Kotlin unit tests, assembleDebug, apksigner signature verification):
  green on the release tag; APK attached to the GitHub release
  (versionCode 6).
- **In-sandbox Android checks:** manifest/config contract tests
  (`tests/android-config.test.mjs`) — WebView hardening, no broad
  permissions, exactly-3-method JS bridge, POST_NOTIFICATIONS.
- **Not tested here (needs a real device/emulator):** installation,
  upgrade-over-previous, Back/predictive-Back, TalkBack, 200 % OS font,
  notched/cutout layouts, Android System WebView versions, system
  save/print sheets, background notifications. Manual checklist:
  `docs/BETA_TEST_CHECKLIST.md` items 1–20.

## 6. Honest limits

- Automated accessibility covers WCAG A/AA rules only; manual review with
  elderly users is still required (glass contrast combinations).
- The APK is a debug test build; Play-Store release work remains blocked
  by the release audit (`docs/RELEASE_AUDIT.md`).
- Direct Google Drive API sync and closed-app push notifications still
  need owner-provided infrastructure (documented in the beta checklist).
- Performance was smoke-tested earlier (1,001 members, ~11 ms median
  read); no new load test was run for v0.3.2 (no server data-path changes
  beyond CSV/XLSX column additions).

## 7. Reproduction fingerprints

- Tag: `v0.3.2-beta.1` · version 0.3.2 · versionCode 6
- Node suite: `# pass 101 / # fail 0`
- Accessibility: `29 screens scanned; 0 rule violations`
- Materials: `20 material/a11y states` PASS
- Audit: `found 0 vulnerabilities`
- Dashboard tile height: 110 px (both themes, 412 px viewport)
