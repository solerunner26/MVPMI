# Village verification and management — 20 September 2026

Two-stage community approval with separate village-administrator sign-in,
managed villages and identity-safe rejoining. Pre-edit checkpoints:
**`Pre-Village-Approval`** (first version) and commit `9111cc7` (before the
admin-first/login separation). `cp001`, `cp002`, the dossier and the modern
redesign remain unchanged.

## Setup order: administrators come first

1. The **main administrator** launches the app and enrolls one administrator
   per village after confirming the person's identity in person. The
   enrollment form takes the name in **three parts** (first, middle/father's,
   surname) plus phone, current location and the initial password; a change
   reason is no longer required — only the identity attestation. Enrollment
   creates the administrator's membership and credentials in one audited step.
2. **Joining stays closed until a village has an administrator.** The server
   rejects applications for administrator-less villages, and the village
   dropdown marks them "એડમિન નિયુક્ત નથી · no admin yet". New villages added
   later follow the same rule.
3. Once enrolled, community members of that village can apply; applications
   wait in that village's queue.

## Separate logins

|              | Village administrator                                                                                                                       | Main administrator                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Entrance     | Visible **"ગામ એડમિન સાઇન ઇન / Village admin sign in"** button                                                                              | Hidden: 5 taps on the sun logo + gate code + password |
| Credentials  | Phone number + password (set at enrollment, 12-hour session)                                                                                | Username + password (30-minute session)               |
| Scope        | Only their own village                                                                                                                      | Everything                                            |
| Sun-tap gate | **Sealed** — the hidden entrance never opens for a signed-in village administrator, and only the main administrator knows the code/password | Owner                                                 |

- Being the assigned member is not enough: the review facility requires the
  explicit sign-in, so an ordinary browser session of the same person (family
  member, borrowed phone) has no admin power.
- The **"ગામ એડમિન સાઇન ઇન / Village admin sign in"** entry is visible to every
  session that is not already signed in as an administrator (main or village)
  — including approved members, so a member promoted to village administrator
  can reach it on their own device. The sheet itself rejects anyone without
  valid credentials.
- Passwords: administrators change their own (Account tab); the main
  administrator can reset any village's administrator password after
  re-confirming identity. Hashes are scrypt, never exported in backups, and
  all sign-ins are rate-limited and audited.
- Replacing or removing an administrator revokes live sessions immediately
  (authority is re-checked against the current assignment on every request)
  and returns pending verifications to the queue for independent review.

## Application lifecycle

1. Applicant submits the joining form. Names are entered in **three parts**
   (first, middle/father's — optional, surname) and composed into the stored
   full name; numbers, optional **હાલ :** current location and the village
   complete the application.
2. The village administrator of that village verifies the person and
   **forwards** with a mandatory reason (5–500 characters) and an explicit
   identity attestation. Self-verification (own session or own phone number)
   is refused. Typos spotted along the way can be **corrected before
   forwarding** — the correction updates the request, is appended to its
   `corrections[]` history and shows a badge in the queue.
3. The main administrator gives **final approval**; the server re-checks the
   verification against the _current_ assignment before granting access. The
   main administrator can also **correct details before approving** (useful
   when a request arrives forwarded with a small error), and may move a
   request to another village, which restarts verification there.
- Corrections are strictly scoped: a village administrator can only correct
  requests in their own village and only before forwarding (409 after); the
  main administrator's correct endpoint is the only one allowed afterwards.
  Every correction is audited (`village.request.correct`).
4. Rejection/closing (by either administrator) requires a reason and category,
   and records the decision in a separate **rejection ledger** (table
   `rejections`), never in the removed-member archive. The applicant sees the
   reason; only the main administrator sees the ledger (one row per phone
   number with the full decision history).

## Member changes and removals — both admins, one decision

Village administrators can **propose** changes (name, numbers, હાલ location)
and removals for members of their own village from the "My village members"
tab. Every proposal becomes a request that only the **main administrator** can
approve or reject; a village administrator can never change or remove a member
alone, cannot touch other villages' members, and cannot propose changes to
their own administrator record (the main administrator handles that). Members'
own self-service requests continue to work the same way. Village changes
always route through the destination village's verification and then the main
administrator.

## Deleted members, archived identity, new devices

- **Access codes are retired** (old endpoints answer 410; pre-existing codes
  are deleted at migration). Deleted members reapply through both stages.
- The archive keeps **one identity per person** (`personId`) with a unique set
  of phone numbers; rejoining requires the main administrator to confirm the
  matching archived identity, and the restored member keeps the original id.
- An active member on a new device also gets no automatic access: the main
  administrator explicitly confirms the replacement, which revokes the old
  device's membership in the same transaction.
- Phone collisions (primary and secondary) block enrollment and are reviewed
  by the main administrator; nothing is auto-merged or auto-blacklisted.

## Villages, location, header controls

- The village table is seeded with the original seven villages. Only the main
  administrator adds villages (Gujarati + English names, duplicates refused);
  they appear immediately in signup and profile edits.
- **હાલ :** current location/address is a single optional field (max 240
  characters) next to the secondary number, visible to approved members.
- Language and dark/light theme are header-only controls; the duplicates in
  reading settings are gone. The 85–165% slider and other preferences remain.
- The header carries the community name **મહુવા ક્ષત્રિય રાજપૂત સમાજ** and one
  uniform row of same-shaped buttons: **All admins**, the village-admin
  shield (sign-in, or "ગામની વિનંતીઓ તપાસો" once signed in), **language**,
  **dark/light theme** and **reading settings**.
- **One language at a time.** The app starts in Gujarati; the header language
  button toggles Gujarati/English, and only the selected script is rendered.
  Directory sorting follows the visible script.
- The **All-admins page is public**: any visitor, signed in or not, sees the
  main administrator and every village administrator with call and WhatsApp
  links (config entry `main-admin-contact`; villages without an administrator
  are marked unassigned).

## Data, migration and backup

- New tables in the same SQLite database: `villages`, `villageAdmins`
  (including credential hashes, which are stripped from every export),
  `rejections`.
- Backup schema version 2 validates villages, assignments (without hashes),
  rejection events, archive numbers and per-person history; restores drop
  staged verifications so requests need fresh village review; the original
  seven villages must be present.
- Demo data: `node scripts/seed-demo.mjs` (synthetic only, idempotent);
  logins listed in [DEMO_LOGINS.md](DEMO_LOGINS.md).

## Verification

- `npm run check` passes: **97 Node tests** (19 in
  `tests/village-approval.test.mjs`, including three-part names, scoped
  corrections, village moves, reasonless administrator changes and the
  all-admins directory), UI, embedded, 29-state accessibility, language, the
  `scripts/village-workflow-test.mjs` browser suite (admin-first enrollment,
  separate sign-in, sealed gate, forwarding, final approval, proposals,
  rejection ledger, removal, closed new villages) and materials, plus
  `npm audit` (0 vulnerabilities).

## Limits

- Identity still relies on administrators personally knowing the applicant;
  there is no SMS phone-ownership proof (disclosed in the consent dialog).
- The main administrator's confirmations (enrollment, archive identity,
  device replacement) are trust decisions, not cryptographic proof.
- No push/SMS notifications; applicants must reopen the app to see status.
