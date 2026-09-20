# Village verification and management — 20 September 2026

This change adds the community's own two-stage approval flow and the related
functional changes requested after the modern redesign. The pre-edit checkpoint
is the tag **`Pre-Village-Approval`** (and
`/home/user/checkpoints/MVPMI-Pre-Village-Approval.zip` in the development
workspace). The original dossier, `cp001`, `cp002` and the modern redesign
remain unchanged.

## Who can do what

| Ability                                              | Village administrator                         | Main administrator                                                |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| See new applications                                 | Only for their own assigned village           | All villages                                                      |
| Verify identity and forward for final approval       | Yes (mandatory reason + identity attestation) | No — forwards always come from the village admin                  |
| Final approval that grants directory access          | No                                            | Yes, and only after a live village verification                   |
| Reject / close an application (mandatory reason)     | Yes, their village                            | Yes, any village                                                  |
| Assign or remove village administrators              | No                                            | Yes, any time                                                     |
| Add villages                                         | No                                            | Yes; immediately available for signup and profile village changes |
| Read the rejection ledger and removed-member archive | No                                            | Yes                                                               |

- One active administrator per village. Assigning a replacement immediately
  revokes the previous administrator's authority, returns their pending queue
  to the unverified state and moves any outstanding verification into a
  review-history list, so a replacement must verify independently.
- A village administrator cannot verify their own request (matched by session
  owner or by phone number).
- Authority is tied to live membership: deleting or village-changing the member
  record removes their assignment the same way.

## Application lifecycle

1. Applicant submits the joining form (name, numbers, optional **હાલ :** current
   location, village). The village list is seeded with the original seven
   villages and can be extended only by the main administrator.
2. The request waits in the **village queue**. Guests and pending applicants
   still receive no directory records.
3. The village administrator verifies the person and **forwards** the request
   with a mandatory reason (5–500 characters) and an explicit identity
   attestation. Forwarding is refused when the village has no administrator —
   there is no silent bypass.
4. The main administrator gives **final approval**. The server independently
   re-checks the verification against the current assignment before granting
   access.
5. Rejection or closing (by either administrator) records a mandatory reason
   and category, and moves the application to a separate **rejection ledger**
   (new table `rejections`), not the removed-member archive. The applicant sees
   the reason and may submit a new application; the ledger keeps one row per
   phone number with the full decision history, and is visible only to the main
   administrator.

## First village administrator

A village with no administrator cannot forward anything. To bootstrap, the main
administrator may appoint a **trusted representative** directly from that
village's pending applications after confirming the person's identity. This
explicit appointment creates the member and the assignment in one audited step
(`representative.appoint`). It is the only path that grants membership without a
separate village verification, it is refused when an assignment already exists,
and it must not be used for ordinary approvals.

## Deleted members, archived identity, new devices

- **Access codes are retired.** The old issue/redeem endpoints answer
  `410 Gone`, and codes that existed before migration are deleted. A member who
  wants to return submits a new application and passes both stages again.
- The removed-member archive keeps **one identity per person** (`personId`) and
  a unique set of phone numbers (`numbers`, primary and secondary merged). A
  rejoin is only approved after the main administrator explicitly confirms the
  matching archived identity, and the restored member keeps the original member
  id instead of creating a duplicate person.
- An **active** member who loses their device/reinstalls also gets no automatic
  access. Their new application reaches the main administrator with a visible
  "existing member matches this number" notice; approving it requires
  explicitly confirming the replacement, which revokes the previous device's
  membership in the same transaction (one member, one live device identity).
- Phone collisions are checked against primary and secondary numbers of members
  and open requests. Archived numbers never auto-grant anything and conflicting
  archives require main-administrator review.

## Villages, location and header controls

- Village dropdowns (signup, profile edit, admin selection) read the managed
  `villages` table. Adding a village requires both Gujarati and English names
  and rejects duplicates; the original seven can never be removed by restore
  validation.
- Profile village changes create update requests that now pass through the
  **destination** village administrator and then the main administrator; the
  previous approved details stay live until then. Direct admin edits cannot
  change a member's village out from under an assignment — those also go
  through review.
- **હાલ :** current location / address is a single optional text field (max 240
  characters) next to the secondary number. It is independent of the secondary
  number and shown to approved members in the directory and profile.
- Language and dark/light theme are header-only controls. The duplicates inside
  reading settings were removed, and a theme toggle now sits beside the language
  button. The 85–165% slider and all other preferences remain unchanged.

## Data, migration and backup

- New tables in the same SQLite database: `villages`, `villageAdmins`,
  `rejections`. "Separate records" means separate tables and admin-only API
  surfaces, not a separate physical database.
- On first launch after the change, the seven villages are seeded, legacy
  rejected-application archive rows move into the rejection ledger, and any
  pre-existing recovery codes are deleted. Approved-member archive rows are
  preserved.
- Backup format is now **schema version 2** (adds the three governance tables
  and strict validation of assignments, rejection events, archive numbers and
  per-person history). Restores re-require village verification for staged
  requests; restoring is refused if the original villages are missing.

## Verification

- `npm run check` passes: **88 Node tests** (including the new
  `tests/village-approval.test.mjs`), UI, embedded, 29-state accessibility,
  language, the new `scripts/village-workflow-test.mjs` browser suite and
  material suites, plus `npm audit` (0 vulnerabilities).
- The retired access-code suite (`tests/member-recovery.test.mjs`) was removed
  with the feature; retired endpoints and identity-safe reapplication are
  covered by the new tests.
- The workflow suite exercises the real UI in a browser: enrollment with
  location, first-admin appointment, village forwarding, main approval, the
  rejection ledger, dynamic village addition, edit-form location, both
  themes/languages and 165% text. Screenshots and raw axe results are kept in
  ignored `test-results/village-workflow/`.

## Limits

- Verification still relies on administrators personally knowing the applicant;
  there is no SMS phone-ownership proof (unchanged, disclosed in the consent
  dialog).
- The main administrator's explicit confirmations (representative appointment,
  archive identity match, device replacement) are trust decisions, not
  cryptographic identity proof.
- No push/SMS notifications: applicants must reopen the app to see status.
