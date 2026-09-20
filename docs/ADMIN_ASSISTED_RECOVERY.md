> **Retired 20 September 2026.** Access codes no longer grant access. Deleted members reapply through village verification and main-administrator approval; active members on a new device need a main-administrator-confirmed replacement. See [VILLAGE_APPROVAL.md](VILLAGE_APPROVAL.md). The text below is the historical record of the removed feature.

# Administrator-assisted member recovery

This is the recovery method selected by the owner. It is a manual, administrator-assisted identity process, **not SMS verification** and not a way to recover an administrator password.

## Administrator steps

1. Sign in through the existing admin gate.
2. Open **Members** and find the approved member.
3. Independently verify the person using your trusted community procedures. Knowing a name or phone number is not sufficient. Do not issue codes in response to an unverified message.
4. Select **Issue recovery code** and confirm **I verified identity — issue code**.
5. Privately give the displayed code to that verified member using a trusted channel. Avoid sending it to a lost/compromised device or posting it to a group. The application does not require storing identity-document photos.
6. Close the dialog. The plaintext code is not retrievable again. If necessary, issue a new code; this immediately invalidates the previous one.

## Member steps

1. Open the app on the new device, or a fresh browser session with no pending enrollment/member/admin identity.
2. Select **Already a member?** or **Member help**.
3. Enter the registered **10-digit personal number** and the code supplied by the administrator. A secondary/work number does not authenticate the account.
4. Select **Recover access**. Do not submit a duplicate enrollment to try to reclaim the existing profile.
5. Directory access returns, and all previous sessions for this membership are revoked. Outstanding member requests stay associated with the profile. No admin permissions transfer.

Both Gujarati and English interfaces are supported. The language selection, text-size choices and existing community design remain in place.

## Security properties

- Issuance requires an authenticated administrator and explicit identity-verification attestation.
- The random code contains 128 bits of entropy, expires in 15 minutes and can be redeemed only once.
- Only a hash is stored. Plaintext codes do not appear in state responses, directory backups or audit events; the code is returned once to the issuing administrator.
- Redemption is tied to an existing approved member, their owner identity and current primary number. Archived/deleted entries cannot regain membership this way.
- Invalid/unknown-number responses do not reveal whether a member exists.
- IP/session/global rate limits and a five-wrong-attempt lock apply. Reissue requires the administrator.
- Successful redemption atomically consumes the grant, rotates the caller's cookie/preview transport, revokes old devices, and grants member access only. Concurrent redemption has only one winner.
- Member deletion and directory restore invalidate outstanding grants. Grants are excluded from backups.
- The administrator's judgment and the private delivery channel remain trust dependencies. A code handed to an impostor can restore access to the wrong person; software cannot independently validate an offline identity check.

## Verification executed

Nine new automated API/security tests cover permissions, attestation, hash-only storage, code/phone binding, expiry, reissue, attempt limits, session rotation/revocation, privilege separation, pending-request preservation, replay, concurrent redemption, removal and restore.

Browser tests exercise issuance through the actual admin UI, wrong-code feedback, successful recovery, code clearing, reload persistence, cookie-blocked transport, old-device revocation and recovery-dialog accessibility. No real member credentials or phone contacts are used.

The complete Node suite now has **75 passing tests**. The full browser/embedded/language suite was rerun during this change; the final concurrent-redemption test was then added and the Node suite rerun. Device/OS behavior, independent security review and real-world administrator verification procedures are not certified by this automation.

## Other design-review work completed in this continuation

- Removed the frozen pending-screen shimmer that overlapped text.
- Fixed modal focus handoff and made background content inert/hidden to assistive technology while a dialog is open.
- Replaced uncertain gradient text surfaces with opaque colors, preserving the warm light/dark palette.
- Corrected faded selected-count contrast and replaced glyph-only backspace/reordering decorations with labeled icon controls.
- Translated the remaining English-only admin sign-in heading.
- The 29-state axe suite now reports **0 violations and 0 incomplete checks**, down from the prior 196 unresolved node checks. The suite now fails if incomplete checks return. Recovery dialogs receive additional axe checks.

## Still requires a person/device

- Native-speaker approval of Gujarati terminology and community-specific wording.
- TalkBack/switch-access and OS font/display scaling on the intended phones.
- Visual comfort and low-end-device performance checks with community users.

Production hosting, SMS enrollment, retention/erasure policy, native exports and Play release requirements remain outside this agreed design-review scope. Production/release guards stay enabled. **cp001 is unchanged.**
