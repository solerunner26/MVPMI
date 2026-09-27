# Changelog

## 1.0.0 — 27 September 2026 (first public release)

- Live server on a Google Cloud e2-micro VM with automatic HTTPS, nightly
  backups (local + encrypted Google Drive copy) and automatic updates to
  tested GitHub releases.
- Google Drive backup: admin → Backup & export → Connect Google Drive.
  Uses the `drive.file` permission only; backups are AES-256 encrypted.
- Privacy policy (`/privacy`), account-deletion page (`/delete-account`)
  and app download page (`/download`) — needed for Google Play.
- Faster loading: 10 MB → 2.4 MB site, first page 518 KB → 87 KB
  (Brotli), unused icons and font files removed, long browser caching.
- Android: signed APK and Play-ready AAB from CI, version name from the
  release tag, recovery when Android stops the WebView renderer.
- Repository cleanup: design-tool leftovers, demo data seeder, demo logins
  and outdated reports removed.

## 0.6.0 — Liquid Glass precision pass

No clipped or overlapping text; uniform controls in light and dark; tab
bar with icons; layout audit tool.

## 0.5.0 — iOS-style Liquid Glass design

## 0.4.0 — Full audit fixes, server-enforced PIN lock, notifications
