# Call / WhatsApp fix and test evidence

Date: 16 September 2026

## What was wrong

The web controller used a scripted `tel:` location change and `window.open` for WhatsApp, without restoring the supplied design's contact sheet as a visible fallback. Browser/iframe restrictions or a missing desktop protocol handler could therefore leave no useful feedback. A synchronous clipboard exception could also interrupt Call before the navigation statement. The prior browser suite checked that Call buttons existed, but did not activate either action. That was a regression-coverage gap.

## Changes

- Preserve the original directory layout, button dimensions, colours and icons. Build the two actions as real, user-activated links, retaining button semantics and Enter/Space keyboard operation.
- Validate/normalize Indian mobile numbers into `tel:+91…` and `https://wa.me/91…`; reject invalid numbers, USSD, non-Indian numbers and URL injection. Avoid duplicate country codes.
- Use a separate browsing context for web/embedded previews, and same-frame navigation for the Android WebView's existing allowlisted intent router.
- Reuse the existing contact sheet with truthful "Requested" feedback, a clickable number for retry, and instructions if the browser blocks the handoff. Do not claim that an external app actually opened or that clipboard copying succeeded.
- Clipboard missing/denied/synchronously throwing cannot block the web action. Android's optional clipboard copy is also isolated from SecurityException; an OS policy blocking the external activity gets a visible message.
- External browser links use `noopener noreferrer`. No direct-call permission, JS native bridge, permissive URL handler or preview-token workaround was added.

## Executed checks

| Category | Evidence / result |
|---|---|
| Unit, API authorization, lifecycle and validation regression | `npm run check`: **56 Node tests passed**. Includes new contact-number normalization/security cases and existing approval/archive/access-control tests. |
| Functional browser regression | Real signup → approval → directory → edit/approval flows passed through the supplied renderer. |
| Contact activation / keyboard | Real rendered links activated with Enter (Call), Space (WhatsApp), and pointer clicks on retry links. Verified exact destinations, targets and security attributes. |
| Clipboard failure integration | Missing API, synchronous exception and rejected Promise: contact action and fallback continue, no uncaught page errors. |
| Embedded compatibility | Restricted sandbox iframe tested. Actual WhatsApp popup was blocked without `allow-popups`, while the fallback sheet stayed visible. With popups permitted, actual link navigation opened a mocked WhatsApp destination with `window.opener === null`. No synthetic phone number was contacted. |
| Android web routing | Android-user-agent browser fixture verified same-frame links. This is **not** an Android device/emulator test. |
| Embedded authentication | All three existing modes passed: cookies, no cookies, no browser storage; admin gate, login, export and logout. |
| Automated accessibility | **25 screens/states, zero reported axe rule violations**, including the two contact sheets. Incomplete checks still require manual review; this is not certification. |
| Dependency security | `npm audit`: **0 known vulnerabilities** at test time. Not an independent penetration test. |
| Layout / injection regression | Existing 320/360/412/800-width overflow checks, unsafe member-name rendering and preferences tests passed. Original supplied HTML exports remain unchanged. |
| Preview deployment smoke | Running server returned generated HTML containing the new contact link bindings; preview database was not replaced. |

Commands: `npm run check`, followed by `npm run test:ui && npm run test:accessibility` after adding Space-key handling and the two contact-sheet scans. GitHub Actions reruns browser/server checks and Android compile/lint/unit/assembly/signature checks on the pushed branch; use that run's status/artifacts for the corresponding build evidence.

## Still required before professional release approval

- Actual Android phone/emulator: tap each primary/secondary number, verify the dialer receives the correct number **without placing a call**, verify WhatsApp handling with installed/not-installed apps, managed-device restrictions, return-to-app and lifecycle behaviour.
- Cross-browser/platform checks on actual Chrome Android, Samsung Internet, Firefox, Safari/iOS (if supported), Windows/macOS protocol-handler configurations, and the live Arena frame's own restrictions.
- Manual TalkBack, large fonts, contrast, touch accessibility, and visual comparison against the supplied design on real devices.
- Real-network interruptions, low-end-device memory/performance, sustained concurrent backend load, battery, installation/upgrade/signing, SMS provider and privacy/deletion-policy acceptance.
- Independent security assessment and Play pre-launch/closed testing.

An embedded browser cannot override its host's sandbox policy. A desktop with no phone handler cannot act as an Android dialer. The fix provides the correct handoff and visible fallback, not a guarantee that an external app exists. Use the preview's open-in-new-tab control or the Android app when a sandbox blocks external navigation. **Production remains NOT READY TO PUBLISH.**

## Successful CI build for this fix

Source `076ed80`: [GitHub Actions run 35010521845](https://github.com/solerunner26/MVPMI/actions/runs/35010521845) passed both jobs: server/browser/embedded/accessibility/audit, and Android compilation/lint/unit tests/debug assembly/signature verification. [Updated debug APK ZIP](https://github.com/solerunner26/MVPMI/actions/runs/35010521845/artifacts/10413323453), 14-day retention. APK installation and OS-app launching remain manual device checks. Update the computer backend source as well as the APK when testing outside Arena; the contact renderer is served by the backend.
