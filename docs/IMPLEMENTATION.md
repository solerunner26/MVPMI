# Implementation notes · 15 September 2026

## Visual source of truth

`Community Directory.dc.html`, `SunMark.dc.html`, `SunWait.dc.html` and `MVPMl-design-dossier.md` are preserved as uploaded. The generic `styles.css` / `readme.md` describe a different, newsprint design system; they are not applied to the terracotta/marigold community app.

`scripts/build.mjs` extracts the original app markup and CSS, removes the external prototype preview frame/sidebar, disables sample-data initialization, and adds `web/controller.js` as its API-backed controller. The supplied DC renderer is reused, with locally bundled React, fonts, icons and sun components. No CDN is required at runtime. This is an incremental development adapter, not the final native architecture. The old design handlers remain in the reference-derived base class but every domain mutation and export handler is overridden by the controller. Server authorization is authoritative even if a user modifies the JavaScript or invents API requests.

Visible changes are operational rather than a redesign: loading/retry states, consent disclosure using the existing confirmation sheet, reset form bindings, truthful direct-admin-save copy and a scroll fix preventing the original profile settings card from collapsing. No replacement visual theme was introduced.

## Backend

`server/store.mjs` wraps a local SQLite database in WAL mode. Each table currently stores validated JSON records keyed by opaque IDs. This favors quick preservation of the supplied data structure; indexed columns and migrations are a later scalability step. Do not run several application instances against a network-mounted SQLite file.

- `members`: approved profiles and private device ownership IDs.
- `requests`: typed new/update/delete requests. Member APIs ignore client-provided IDs, owners, roles and approval status.
- `archive`: snapshots of replaced, withdrawn, rejected and removed enrollment/profile details. Never queried into the public directory.
- `sessions`: SHA-256 digests of 256-bit random bearer cookies, ownership IDs, admin expiry, gate expiry, OTP state and blocking status. Tokens themselves are not in SQLite.
- `config`: scrypt admin password/gate hashes and last backup metadata.
- `alerts`: failed gate/login attempts, actual submitted user agent, known member number if available and blocked state. A user-agent string is self-reported, not trusted device attestation.
- `audit`: admin login, approval/rejection, direct edits/removals, export, block and restore events.
- `limits`: persisted counters with expiry. Expired rows are reset on reuse; a background cleanup policy is still needed.

The current admin role is stored on the authenticated session, never inferred from hidden screen navigation. The gate is rate-limited server-side but is **not** a substitute for the admin password. JSON POSTs require a non-simple same-origin custom header; CORS is not enabled. Member and admin responses have `Cache-Control: no-store`.

## Request lifecycle

| Action | Directory effect | Queue/archive effect |
|---|---|---|
| Enroll | None | New open request |
| Edit enrollment | None | Old payload archived; exactly one replacement request |
| Withdraw | None | Request removed, snapshot archived |
| Approve enrollment | Adds approved member | Request consumed |
| Reject enrollment | None | Snapshot archived, request consumed |
| Request update | Existing profile unchanged | One pending update; captures base version |
| Approve update | Applies validated requested fields | Rejects stale base version or phone collision |
| Reject update | None | Request consumed |
| Request deletion | Existing profile remains visible | One pending deletion |
| Approve deletion | Removes member/access | Snapshot archived; dependent requests removed |
| Admin edit/delete | Immediate | Audit event; removed profiles archived |

Polling every eight seconds discovers approvals/rejections/removals without a push dependency. Member preferences alone are stored in localStorage. No contact database is stored in localStorage or a service-worker cache.

## Backup semantics

JSON schema version 1 contains approved members, open requests, archive and export timestamp. Members retain private ownership IDs so restore works for existing sessions on the same installation. Passwords, cookies, OTPs, authentication settings and security/audit history are deliberately excluded. This is **not** disaster recovery of the whole server. Server operators should also make encrypted infrastructure backups with a documented credential recovery procedure.

Restore first validates schema/version, counts, duplicate IDs/phones, canonical profiles, one request per kind/owner and request-to-member references. The UI shows replacement counts and requires confirmation. The confirmed SHA-256 digest ties the submitted restore payload to that preview. Replacement of all three tables is one SQLite transaction. Audit history survives restore. Bad or partially valid files cannot partially overwrite the database.

## SMS reset integration contract

Optional environment variables: `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN`, `ADMIN_PHONE`.

The server POSTs JSON `{ "phone": "+91…", "message": "MVPMl password reset code: …" }` with `Authorization: Bearer <token>`. The delivery service must return a successful HTTP status. Use a trusted HTTPS provider endpoint that sends messages and does not log OTP content. There is no default delivery service, public test code, or client-exposed recovery secret. Unit tests inject an in-memory fake delivery callback solely to test expiry/verification logic.

Member OTP enrollment and reinstallation recovery are **not implemented**. Non-development enrollment rejects unverified numbers; the executable production entrypoint is separately disabled until there is a real verification/recovery implementation.

## Next milestones

1. Confirm Android/native versus hybrid delivery, oldest actual devices, SMS budget/provider, membership consent and archive-retention duration.
2. Specify member OTP and lost-device/new-phone recovery screens using the existing design language; implement verified identities before enabling real data.
3. Implement native Kotlin/Room or complete and validate the hybrid host, including offline strategy, lifecycle/back handling, storage/export/sharing and touch reordering.
4. Add dynamic village management, admin recovery/co-admin options, intrusion/approval delivery and scheduled encrypted backups.
5. Add accessibility and device-matrix tests, load testing, relational indexes/pagination, security review, release signing and installation/distribution documentation.

## Validation scope

API tests exercise approval gating, ownership isolation, replacement/withdrawal archives, update authorization, stale update rejection, deletion revocation, restore atomicity, XLSX file structure, input validation, server-side security alerts and blocking, OTP reset and rate limits. A disk-store test checks reopening persisted data.

The browser test performs actual clicks through the original signup, waiting, hidden gate, login, admin approval, directory, member edit and update-approval screens using isolated contexts. It checks no JavaScript errors, preference persistence and basic overflow. It does not substitute for Android device/TalkBack testing, SMS delivery testing, cross-browser print testing, a complete visual regression suite or a penetration test.


## Release-audit update

See `RELEASE_AUDIT.md` for the current status and evidence. The current code includes `server/session.mjs` (cookie-independent development transport), `server/sms.mjs` (HTTPS-only recovery delivery), strict public response allowlists and backup validation, consent metadata, restore concurrency checking and modal/Back semantics. The 12-hour development transport token is stored only as a digest on the server and in tab sessionStorage (or memory) on the client, never in URLs or contact backups. An explicit invalid/expired token fails closed. Admin authorization still expires independently after 30 minutes. This browser-readable transport must not be treated as a production authentication design.

The shared browser test harness uses synthetic fixtures. The published audit deliberately separates server/browser results, static Android declarations, executed Kotlin unit/lint/build checks and device/Play Console checks that cannot be performed here.

### Debug APK follow-up

GitHub Actions build [35005276099](https://github.com/solerunner26/MVPMI/actions/runs/35005276099) passed server/browser checks and Android compilation, lint, unit tests, assembly and debug signature verification at `336e359`. See [PHONE_TESTING.md](PHONE_TESTING.md) for the artifact and local computer backend instructions. Device/emulator installation and production readiness remain unverified; all release guards remain in place.
