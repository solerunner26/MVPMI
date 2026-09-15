# MVPMl — Complete Design Dossier & Self-Assessment Brief
**Community Contact Directory · Android app · Gujarati/English**
Snapshot: checkpoint "Best1", 15 September 2026

---

## 0. How to use this document

This is a complete record of what has been designed so far, plus an honest list of what has **not** been decided. Paste it into ChatGPT and ask it to write a critique/self-assessment prompt for the designer (Claude). The most valuable sections for that purpose are **§11 (Known gaps)** and **§12 (Questions never asked)** — those are where a reviewer should push hardest.

Nothing here is production code. It is a high-fidelity interactive **prototype in HTML** that demonstrates the intended Android app. A developer builds the real app from this.

---

## 1. Product brief (from the client, verbatim intent)

A small, closed community in a rural town needs to share contact details among its members. Social media is unsuitable: many members are elderly, technologically inexperienced, and the client does not want to push addictive platforms on them. The app does one thing — it shares **name, phone number, village, tehsil, district** among **admin-approved community members only**.

**Two user types:**
1. **Normal user** — a community member, only after admin approval.
2. **Admin** — one privileged operator who approves, edits, removes and backs up.

**Non-negotiable constraints given by the client:**
- Must run on **old Android phones**, independent of Android version.
- Primary language is **Gujarati**; English is secondary.
- Elderly-friendly: large readable text, large touch targets, minimal cognitive load.
- The community is **fixed at 7 villages** today, extensible later.
- Admin panel must be **hidden** from ordinary users to prevent brute-force discovery, and intrusion attempts must be logged and reported to the admin.

---

## 2. The three modules (client's own structure)

### Module 1 — New User Profile Entry
- First-time user fills their own profile: name, phone, village, tehsil, district.
- They can see **nothing else** until the admin approves them.
- Until approval, **every launch** lands on a "request under process" screen.
- They may **edit** the request (re-sending replaces the old request in the admin queue — never two open requests for one phone).
- They may **withdraw** the request. Withdrawn data is **retained in a separate admin-only archive**, never shown in the directory.

### Module 2 — User View (the core module)
- Default screen after approval, forever after.
- Read-only directory of approved members.
- Search by name or mobile number.
- Per-contact **Call** (hands the number to the phone's native dialler, pre-filled, user presses dial) and **WhatsApp** (opens a direct chat).
- Own profile viewable; any edit becomes an **update request** requiring admin approval before it appears to others.
- Account removal is a **request** to the admin, not a self-service delete.

### Module 3 — Admin View
- Username + password login, with show/hide password, strength meter, forgot/reset password, lockout, change reminders.
- Manage: new requests, update requests, delete requests, all members, archive, security, backup/restore.
- Export the whole directory as **PDF** and **Excel**, shareable to WhatsApp.

---

## 3. Every screen in the prototype

The prototype ships **11 screens**, all reachable from a side index in the preview:

| # | Screen | Purpose |
|---|---|---|
| 1 | Entry form | First-time profile submission |
| 1b | Request pending | Locked-out waiting state |
| 2 | Directory — village tiles | Default landing for approved members |
| 2 | Directory — member list | Per-village or All Members list |
| 2b | My profile | Own card, settings, privacy |
| 2c | Edit my details | Change request form |
| 3 | Access code keypad | Hidden gate to the admin area |
| 3b | Admin login | Credentials |
| 3c | Reset password | OTP + new password |
| 3d | Admin dashboard | 8-tile command grid |
| 3d… | 7 admin sections | Statistics, new, update, delete, members, archive, security, backup |

### 3.1 Entry form
- Header: sun logo (tappable — see §8), "MVPMl" wordmark, "Community Directory" subtitle.
- Title block: "Fill your details" + a one-sentence explanation of the approval flow.
- Fields, each with a bilingual label:
  - **Full name** — required, minimum 3 characters.
  - **Personal number** — `+91` prefix shown as static text, digits-only input, hard-capped at 10 digits, live `n/10` counter, green tick at 10, must start 6–9.
  - **Second number** (optional) — revealed by an "Add second number" dashed button; carries a **Work / Other** label chooser; must be 10 digits and must differ from the first.
  - **Village** — required; spell-checked (see §5).
  - **Tehsil** — prefilled and fixed to **Mahuva**.
  - **District** — prefilled and fixed to **Bhavnagar**.
- Primary action: "Send request" (gradient button with a sweeping sheen).
- Privacy note: only approved members can see your number.
- Validation is **on submit**, not on every keystroke: errors appear under the offending field, the field border turns red, and a toast says to fix them. This was chosen deliberately so elderly users are not scolded mid-typing.

### 3.2 Request pending
- Large animated **sun with a sandwatch at its core** (see §7).
- A live **waiting clock** under the sun — minutes:seconds, rolling to hours:minutes after an hour.
- The client's exact message, bilingual: "Your request is under process, please wait… Once the admin approves it you can see everybody's contact information."
- Three breathing dots and a **3-step progress trail**: Sent → Checking → Approval.
- A summary card of exactly what was submitted (name, both numbers, place).
- Two actions: **Edit** and **Withdraw**. Withdraw opens a confirmation sheet explaining the consequence, and on confirm archives the record.

### 3.3 Directory
Redesigned at the client's request from a flat list into a **village-first** experience.

- Sticky header: sun logo + "MVPMl" + "Directory", profile avatar button.
- **Search bar** — activates at 3 characters, matches Gujarati name, Latin name, or either phone number (digits only, so spacing is irrelevant). Search spans **all villages** regardless of which tile is open. A callout appears when exactly one member matches. Below 3 characters it shows "Type 3 letters to search…" rather than a misleading empty list.
- **All Members** button with the live total; highlights when active.
- **7 village tiles** in a 2-column grid. Each tile: the sun mark bleeding off its top-right corner at 50% opacity, a drag handle, the village name (large, in the active language) with the other spelling beneath, and the live member count.
  - Villages: **Thorala (થોરાળા), Sathra (સથરા), Taredi (તરેડી), Lilvan (લીલવણ), Dudhala No 1 (દૂધાળા નં 1), Talgajarada (તલગાજરડા), Zinzaka (ઝીંજકા)** — all in Mahuva tehsil, Bhavnagar district.
  - Tiles are **drag-reorderable** with live gap-shifting; the dragged tile dims and takes an accent border.
  - Tapping a tile filters the list to that village and shows a "back to Villages" chip.
- **Member list** — alphabetically sorted by the active language, with sticky A–Z letter headers.
- **Member card** — square gradient avatar with the first letter, name (active language large, other beneath), place line with a pin icon, then **one row per phone number**: label (Personal / Work / Other), the formatted number, a filled **Call** button and an outlined **WhatsApp** button.
- Call/WhatsApp open an explanatory bottom sheet in the prototype, describing exactly what the real app will do.
- Footer line: result count on the left, the active place context (village · Mahuva · Bhavnagar) on the right.

### 3.4 My profile
- Own card: avatar, name, then rows for Personal, Work, Village, Tehsil, District.
- Pending-state banners when an update or removal request is awaiting the admin.
- A settings group: **Edit my details** (chevron row) and **Language** (showing the current choice).
- **Text size** card — a live **slider from 85% to 165%** with a draggable ball. Dragging it rescales every font size and every touch target in the app instantly through one root multiplier. Replaced an earlier on/off "large fonts" toggle at the client's request.
- **Account & privacy** card — explains in plain language what removal means, then an outlined danger button: "Request removal from directory". This replaced an orphaned red text link; the request opens a confirmation sheet before sending.

### 3.5 Edit my details
- Same fields as the entry form, prefilled, with the same phone validation.
- A standing notice: changes appear in the directory only after the admin approves.
- Reachable from My profile (the client specifically asked for that link).

### 3.6 Access code gate (hidden)
- Not reachable by any visible navigation. **Tap the app logo 5 times within 2.5 seconds.**
- A fingerprint icon, "Enter access code", 4 dots, and a 12-key glass keypad.
- Correct code (prototype: **2468**) → admin login.
- Wrong code → the dots clear, an error line says the attempt has been logged, and a **security alert row is written** with the device, OS and — when known — the device holder's phone number. The user is returned to the normal app with no hint that an admin area exists.

### 3.7 Admin login
- A **3D "ADMIN PANEL" logo**: chiselled white→marigold→terracotta gradient type, floating on a dark midnight-glass plate with a warm glow, a shadow ellipse beneath, and a "RESTRICTED ACCESS" lock line.
- Username, password with show/hide eye, a **5-level strength meter** with a written verdict and a password-policy hint, and a 60-day change reminder note once the password is strong.
- Failed login writes a security alert and shows a bilingual error.
- Links: Forgot password, Leave.
- Prototype credentials: **admin / Samaj@2026**.

### 3.8 Reset password
- Registered mobile (read-only), 6-digit OTP field, new password field.
- Written policy: codes expire in 10 minutes; 5 wrong attempts lock the account for 15 minutes.
- Resend countdown.

### 3.9 Admin dashboard
Redesigned from a scrolling tab strip — the client could not see all tabs at once — into an **8-tile grid, everything visible in one glance**, with a back arrow out of each section.

- Greeting card: shield icon, "N items need action" (or "Everything is up to date"), last backup time.
- Tiles, each with an icon, a live count badge, a bilingual name and a one-line hint:
  1. **Total members** → statistics screen
  2. **New requests**
  3. **Update requests**
  4. **Delete requests**
  5. **Members**
  6. **Backup & export**
  7. **Archive**
  8. **Security alerts**
- Header also carries a **bell** with an alert count, and a sign-out button.

### 3.10 The admin sections
- **Total members / statistics** — big total, three counters (villages, tehsils, districts), then ranked breakdowns **by village, by tehsil, by district**, each row with a count and a proportion bar. Added at the client's request.
- **New requests** — one card per pending sign-up: avatar, name, submitted time, both numbers, place, then **Approve** (marigold) and **Reject** (terracotta). Approving inserts the member into the live directory immediately; rejecting archives them.
- **Update requests** — side-by-side **Current vs Requested** panels showing only the changed fields, with **Authorize** and **Reject**. Authorizing rewrites the member record and the directory updates instantly.
- **Delete requests** — name, number, place, stated reason, then **Remove from list** or **Keep**.
- **Members** — the full roster with per-row edit and delete icon buttons; admin edits apply directly, without approval.
- **Archive** — dashed-border cards for withdrawn, rejected, removed and admin-deleted entries, each with its status and date. Admin-only; never joined into any member-facing view.
- **Security** — one card per intrusion attempt: what happened, who (number when known), device and OS, when, and a **Block** action.
- **Backup & export** — a database summary card, then four export tiles and a restore button:
  - **Generate PDF book** — builds a print-ready A4 contact table (numbered, Gujarati name over Latin, both numbers, village/tehsil/district, generated timestamp) and opens the print dialog.
  - **Export Excel** — downloads a real `.xls` file.
  - **Share to WhatsApp** — explains the Android share-sheet hand-off.
  - **Full JSON backup** — downloads the entire database including all queues and the archive.
  - **Restore system data** — replaces the local database from a backup file.

---

## 4. Rules that govern what a user can see

1. No request and no member record → **entry form**.
2. Open request, unapproved → **pending screen on every launch**. The directory is not merely hidden; the server query must return nothing. Only Edit and Withdraw are available.
3. Edit + re-send → the old request is withdrawn, archived, and replaced by a fresh open request. Never two open requests per phone.
4. Withdraw → the request leaves the queue, the payload is copied to the admin-only archive, and the device returns to the empty form.
5. Approved → **the directory becomes the launch screen** from then on. The only writes a member can make are an update request and a delete request, and neither changes anything until the admin authorizes it.
6. Admin edits and admin deletes apply immediately — no approval loop for the admin's own actions.
7. Every failed access code and every failed admin login writes a security alert and notifies the admin.

---

## 5. Validation and data-entry intelligence

- Every field is required; nothing can be submitted blank.
- Phone numbers: digits-only filtering at the input, hard cap of 10, must start 6–9, formatted as `NNNNN NNNNN` for display, stored unformatted.
- The second number must differ from the first.
- **Village and tehsil spell-check** — a dictionary of the community's real villages holds both the Gujarati and Latin spelling of each. A normalised Levenshtein distance (threshold 0.42) against both spellings suggests the correct name: "Did you mean 'થોરાળા' (Thorala)?" Tapping the suggestion fills the village and auto-fills tehsil and district. This is the mechanism that keeps the village field clean enough for the tiles and statistics to work — without it, one member typing "થોરાલા" creates a phantom village.
- Forms can be filled in **Gujarati or English**; both are accepted and stored.

---

## 6. Bilingual system

This is the most heavily reworked part of the design, and the part most likely to be got wrong by a developer.

- Every piece of copy exists as a **pair**, not as a translated build. Both languages are visible at once — the active language large and bold, the other small and muted beneath or beside it. This lets a Gujarati-first elder and an English-comfortable younger relative use the same screen together.
- Pairs render **inline on one line** where they are short (labels, buttons, rows) to save vertical space, and **stacked** where they are full sentences.
- Switching language **swaps primacy, not content**: order, size, weight, opacity and font all flip. Both languages render at the same weight when primary — neither looks like an afterthought.
- Fonts: **Noto Sans Gujarati** for Gujarati, **Manrope** for Latin. Gujarati must be bundled with the app — older Android builds clip conjuncts with system fonts.
- Everything generated in code also flips: validation messages, password-strength verdicts, counts and summaries, dashboard tile hints, screen titles, security-alert text, archive statuses, request timestamps, delete reasons, comparison-panel field prefixes, input placeholders, and the Work/Other chips.
- **Place names translate** — village, tehsil and district all render in the active language everywhere they appear (tiles, header, profile rows, comparison panels, statistics), from the same dictionary.
- **Sort order and A–Z headers follow the active language.**
- **English plurals are correct** — village/villages, tehsil/tehsils, member/members.
- The language control is a compact circular FAB: a translate icon over **EN** (or **ગુ**).

---

## 7. Visual design system

The client rejected two earlier directions (a blue/teal Material scheme, then a cool-toned one) and asked for an Apple-like "crystal clear" feel with a strict two-tone palette and no blue.

**Final system — liquid glass over a warm two-tone ground:**

| Role | Light | Dark |
|---|---|---|
| Tone 1 (primary) | Terracotta `#B2402C` | lightened to `#FF9D74` for text |
| Tone 2 (secondary) | Marigold `#E9A13B` | `#F3BC6A` |
| Gradient | 135° terracotta → marigold | Same, over espresso |
| Ink | `#241413` | `#F7EDE4` |
| Muted ink | `#6B4F48` | `#C3A79C` |
| Ground | Ivory `#FFFBF6` with warm radial blooms | Espresso `#1B0F0D` |
| Glass surface | 66% white + 24px blur + saturation | 7.5% white + same blur |
| Danger | `#9E2B1E` | `#FF9A86` |
| Confirm | `#8A5512` on marigold tint | `#F3BC6A` |

- **Every surface is frosted glass**: translucent white over the gradient ground, a 1px light border, a soft two-layer shadow, and backdrop blur with saturation. No flat cards, no hard dividers.
- **Radii**: 30px sheets, 24–26px cards, 16–18px fields and small buttons, 12–14px icon chips.
- **Type scale** (multiplied live by the text-size slider): 11 / 13 / 15 / 19 / 24 / 30 px. Touch targets: 48px standard, up to 70px at maximum text size.
- **Icons**: Phosphor **duotone** throughout, at a consistent size per context (14px inline, 17–21px in controls, 26–29px in feature tiles).
- **Hover and press states** are themed: buttons lift 1px on a spring curve and settle 1px down on press; gradient buttons deepen their glow and gain slight saturation; inputs warm their border; tiles and export cards lift 3px with a terracotta shadow and an accent border. Keyboard focus is a 2px accent ring — never the browser default.
- **Contrast** was audited in both themes; count badges use dedicated deep fills with white ink to stay legible on dark grounds.
- **Aesthetic layer** — all decoration is gathered behind one toggle called `aesthetic`, so it can be removed in a single switch: a slow-rotating sun-ray corona bleeding off the top-right corner, a marigold and a terracotta bloom drifting behind the content, a fine diagonal weave texture, a warm light-pool at the bottom edge, a gold sheen sweeping across primary buttons.

---

## 8. The sun — the community's symbol

The community is Rajputana/Kshatriya Samaj, whose emblem is the sun. Two reference emblems were supplied and the mark was rebuilt as clean vector art rather than traced.

- **The mark**: 16 gold flame-shaped rays in a wavy, curling silhouette taken from the emblems, around a solid disc with a radial highlight and a maroon rim. The ray ring rotates once every 90 seconds — slow enough to feel alive, not animated.
- **Where it appears**: the app logo in every header (and it is the hidden admin door — 5 taps); at 50% opacity bleeding off the corner of each village tile; as the rotating corona in the background aesthetic layer; as the glow behind the admin panel logo.
- **The pending screen sun**: a larger build with two counter-rotating ray rings (12 long rays outward at 60s, 12 short rays inward at 40s), a halo, a spherical disc with highlight and inner shadow, breathing gently up and down.
- **The sandwatch** at the sun's core: a maroon glass hourglass with gold sand that drains from the top chamber into the bottom over 9 seconds, then **flips 180° and drains again**, endlessly, with a falling grain animating through the neck. Replaced a digital timer inside the sun at the client's request; the clock now sits below the sun.

---

## 9. Data model (for the developer)

```
member
  id, name, name_gu, phone (E.164, unique), phone2, phone2_label (work|other),
  village, tehsil, district,
  status (pending|approved|removed), created_at, approved_at, approved_by

enrollment_request      one open request per phone
  id, member_payload, phone, created_at, state (open|approved|rejected|withdrawn)

update_request
  id, member_id, changed_fields, created_at, state (open|authorized|rejected)

delete_request
  id, member_id, reason, created_at, state (open|approved|declined)

archive                 admin-only, never joined into member queries
  id, snapshot, source_phone, reason, archived_at

security_alert
  id, kind, device, os, phone_if_known, created_at, blocked

admin
  username, password_hash, phone, password_changed_at, failed_attempts, locked_until

app_config              admin-editable, so villages can be added without a release
  villages[] (gu + latin), tehsil, district, access_code_hash
```

**Server rules:** a member record is readable only when the requesting phone belongs to an `approved` member. The archive and all request tables are admin-read-only. Nothing in the client app can set `status = approved`.

---

## 10. Platform recommendations made in the spec

- Native Android, Kotlin. **minSdk 21** (Android 5.0) / targetSdk 36 — covers every phone realistically still in use.
- Local store **Room/SQLite** so the directory works offline; server **Firebase Firestore + Firebase Auth (admin only)**, or a small REST + Postgres host if Google services are undesirable.
- No login for members — device identity is the phone number, verified once by SMS OTP.
- Layout scales by window size class; text in `sp`; the app honours the OS font setting **on top of** the in-app slider.
- **Call**: `ACTION_DIAL` with `tel:` — needs no permission and never places the call itself; the number is also copied to the clipboard.
- **WhatsApp**: `https://wa.me/<number>` via `ACTION_VIEW`, with a bilingual "WhatsApp is not installed" fallback.
- **Export/restore**: Storage Access Framework (`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`) so no storage permission is required on any version. Restore validates the schema version, shows a diff count, and replaces the database in one transaction. A weekly automatic export to the admin's Drive was recommended, because a small-town admin will not remember to press the button.

---

## 11. Known gaps — things the design has NOT solved

**A reviewer should attack these hardest. They are unresolved by choice or by omission, not by accident of implementation.**

1. **No phone-number verification is designed.** Anyone can type any number and claim it. SMS OTP was recommended but never specified — no screen, no rate limit, no cost model, no fallback for a member whose number changed.
2. **Identity is the device, not an account.** If a member changes phone or reinstalls, nothing in the design explains how they prove they are the same person. Approval could be silently duplicated.
3. **Single admin, single point of failure.** No co-admin, no delegation, no recovery path if the admin loses the phone and the password and the OTP number. No audit trail of *which* admin did what (there is only one).
4. **The hidden admin door is obscurity, not security.** Five taps plus a 4-digit code is guessable in 10,000 attempts; only exponential back-off was recommended, never designed. The code is stored in app config — a determined person with the APK can read it. Real security has to be server-side.
5. **Intrusion reporting is cosmetic in the prototype.** "The admin is notified" has no delivery mechanism designed — no push service, no SMS, no email.
6. **No privacy consent screen.** The app publishes members' phone numbers to every other member. There is no consent text, no policy, no explanation of who can see what, and no legal basis recorded. For Play Store publication this is a blocker.
7. **No abuse story.** Nothing prevents an approved member from exporting the directory, or from harassing another member. There is no block, no report, no way for a member to hide their number from the list while staying a member.
8. **No offline conflict resolution.** Two devices editing while offline, or an approval landing while a member's edit is in flight, is undefined.
9. **Scale is untested.** The design assumes a few hundred members. The A–Z list, the village tiles and the PDF export were never designed for 5,000 members or for 60 villages. There is no pagination, no lazy loading, no indexed search strategy.
10. **Accessibility beyond text size.** No screen-reader labels were specified, no TalkBack pass, no colour-blind check on the terracotta/marigold pair (they are close in hue — a red-green deficiency may flatten Approve vs Reject, which currently rely partly on colour).
11. **Glassmorphism on old hardware.** Backdrop blur is expensive. On an Android 5–7 budget phone the frosted surfaces may stutter or fall back to flat translucency, which would change the whole look. No degraded visual mode was designed.
12. **Gujarati rendering on old Android.** Bundling Noto Sans Gujarati was recommended, but the conjunct-clipping risk on Android 5–6 was never actually tested, nor was the app size cost of bundling the font.
13. **No onboarding or help.** A first-time elderly user gets a form. There is no walkthrough, no illustrated explanation of what the app does, no "ask your grandson" path, no support contact.
14. **No notification design for members.** A member whose request is approved has no idea until they open the app again. No push, no SMS, no "you're in" moment.
15. **The prototype's data is in memory.** Nothing persists across reload: no localStorage, no backend. Tile order, text size and language are per-session only in the prototype, though the spec says to persist them.
16. **PDF/Excel export is browser-based in the prototype.** The real Android implementation (print framework vs server-rendered PDF, and a genuine `.xlsx` rather than the HTML-table `.xls` trick) is unspecified.
17. **No empty-community state.** The directory, tiles and statistics were all designed with 8 members present. Day one, with zero approved members, is undesigned.
18. **No error/offline states.** No "no internet", no "server unreachable", no retry, no stale-data indicator anywhere in 11 screens.
19. **Search does not handle transliteration.** Typing "Thorala" finds the Latin name; typing "થોરાળા" finds the Gujarati. Typing "torala" or a phonetic variant finds nothing.
20. **The 3-character search minimum is arbitrary** and untested with Gujarati, where three characters can already be a whole word.

---

## 12. Questions that were never asked (and should have been)

- How many members, realistically, in year one and year five?
- Who else, besides the admin, must be able to see or export the list?
- Should the directory be printable by ordinary members, or admin-only?
- Is it acceptable for every member to see every number, or should some members be able to opt out of visibility?
- What happens when a member dies, marries out, or moves away — is there a status beyond approved/removed?
- Should families be grouped, given that the village is often shared by relatives?
- Does the community have a written membership rule the admin applies, or is approval by personal recognition?
- Is there budget for SMS costs, a server, or a Play Store account?
- Who maintains this app in two years?

---

## 13. Deliverables at this checkpoint

| File | What it is |
|---|---|
| `Community Directory.dc.html` | The full interactive prototype, all 11 screens, real state flow |
| `Handoff Spec.dc.html` | Developer specification: platform, data model, rules, intents, tokens, exports |
| `SunMark.dc.html` | The sun emblem as a reusable vector component |
| `SunWait.dc.html` | The pending-screen sun with the animated sandwatch |
| `checkpoints/Best1/` | Frozen snapshot of all of the above |

**The prototype is genuinely interactive, not clickable mockups.** Submitting a request puts it in the admin queue; approving it inserts the person into the directory; authorizing an update rewrites their card; withdrawing or rejecting moves the record to the archive; entering a wrong access code writes a real security alert; exports download real files. State flows end to end.

---

## 14. What to ask ChatGPT for

Suggested framing:

> "Below is a complete design dossier for an Android community contact-directory app, written by the designer. I am the client and I do not have a design or Android background. Read §11 and §12 especially. Write me a rigorous self-assessment prompt I can give back to the designer that forces them to (a) justify every unresolved decision, (b) design the missing states and flows listed as gaps, (c) stress-test the accessibility, security, privacy and low-end-device assumptions, and (d) tell me what they would cut. Be specific and cite the section numbers."
