# App icon (v0.2.1)

The application icon comes from the devotional image the owner uploaded to
the repository root. Two uploads exist and both are devotional artwork, so
the generator can build the complete icon set from either one:

| Option | File | Resolution |
| --- | --- | --- |
| 1 (active) | `i0lkualxlp3e1.jpeg` | 736 × 1251 |
| 2 | `images.jpg` | 335 × 597 |

Option 1 is active because it has the higher resolution. A side-by-side of
both options rendered as icons is committed at
`docs/modern-design/app-icon-options.png` (per-option strips:
`docs/modern-design/app-icon-1.png`, `app-icon-2.png`).

## Treatment

The complete picture is always fitted inside the icon — **nothing is
cropped**. It sits centred on a warm gradient built from the app's
terracotta brand red (`#B2402C`, deepening to `#7C2618` at the top), with a
soft drop shadow for depth. Rounding is applied per surface:

- Web favicon and large web icons: pre-rounded corners (except
  `apple-touch-icon.png`, which iOS masks itself and must stay opaque).
- Android legacy icons (API 21–25): rounded `ic_launcher.png` and circular
  `ic_launcher_round.png`.
- Android adaptive icons (API 26+): `mipmap-anydpi-v26` XML combining a
  gradient background layer with the artwork foreground layer, sized to the
  66 dp safe zone so no launcher mask can clip it.
- Google Play listing: full-bleed 512 × 512 `android/play-icon-512.png`.

## Files

- `web/brand/` — `favicon-32.png`, `apple-touch-icon.png` (180),
  `icon-192.png`, `icon-512.png`. The build copies this folder to
  `dist/brand/` and `scripts/build.mjs` adds the `<link rel="icon">` and
  `<link rel="apple-touch-icon">` tags to the served HTML.
- `android/app/src/main/res/mipmap-*/` — legacy and adaptive layers for all
  five densities, plus `mipmap-anydpi-v26/*.xml`.
- `scripts/generate-app-icons.py` — the generator (Python 3 + Pillow).

## Switching to the other image or regenerating

```
python3 scripts/generate-app-icons.py                # option 1 (default)
python3 scripts/generate-app-icons.py --source 2     # option 2 (images.jpg)
npm run build                                        # refresh dist/brand
```

The script is idempotent, rewrites every icon file listed above, and always
refreshes the documentation previews. Generated icons are committed, so
builds and CI never depend on Python.
