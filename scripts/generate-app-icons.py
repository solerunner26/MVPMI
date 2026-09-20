#!/usr/bin/env python3
"""Generate the application icon set for the community directory.

Sources: one of the two devotional images uploaded to the repository root
(default i0lkualxlp3e1.jpeg; switch with --source images.jpg).

Treatment: the complete picture is fitted inside the icon (never cropped),
centered on a warm gradient built from the app's terracotta brand red
(#B2402C), so nothing of the uploaded artwork is lost.

Outputs (all committed to git; regenerate after switching --source):
  web/brand/favicon-32.png          browser favicon (rounded)
  web/brand/apple-touch-icon.png    180x180 iOS home-screen icon (opaque)
  web/brand/icon-192.png            large web/PWA-grade icon (rounded)
  web/brand/icon-512.png            512 web/Play-listing-grade (rounded)
  android/play-icon-512.png         Google Play listing icon (full bleed)
  android/app/src/main/res/mipmap-{mdpi..xxxhdpi}/ic_launcher.png        legacy square
  android/app/src/main/res/mipmap-{mdpi..xxxhdpi}/ic_launcher_round.png  legacy round
  android/app/src/main/res/mipmap-{mdpi..xxxhdpi}/ic_launcher_background.png  adaptive layer
  android/app/src/main/res/mipmap-{mdpi..xxxhdpi}/ic_launcher_foreground.png  adaptive layer
  android/app/src/main/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml   adaptive definition
  docs/modern-design/app-icon-options.png  side-by-side of both source options

Requires Python 3 with Pillow (pip install pillow). Node rebuild
(npm run build) is needed afterwards so dist/brand picks up new files.
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCES = {
    # key -> (filename, label)
    "1": ("i0lkualxlp3e1.jpeg", "Option 1 - i0lkualxlp3e1.jpeg"),
    "2": ("images.jpg", "Option 2 - images.jpg"),
}

# Brand palette (see web/modern-design.css --ind and the theme-color meta).
BRAND_TOP = (124, 38, 24)     # deep terracotta
BRAND_BOTTOM = (178, 64, 44)  # --ind #B2402C

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
LEGACY_SIZE = 48      # dp
ADAPTIVE_SIZE = 108   # dp (foreground/background layers)
SAFE_FRACTION = 0.54  # artwork height inside the 66dp adaptive safe zone


def gradient(size):
    """Vertical brand gradient with a faint radial glow behind the artwork."""
    base = Image.new("RGB", (size, size))
    px = base.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(BRAND_TOP[0] + (BRAND_BOTTOM[0] - BRAND_TOP[0]) * t)
        g = round(BRAND_TOP[1] + (BRAND_BOTTOM[1] - BRAND_TOP[1]) * t)
        b = round(BRAND_TOP[2] + (BRAND_BOTTOM[2] - BRAND_TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    glow = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse(
        [size * 0.18, size * 0.10, size * 0.82, size * 0.74],
        fill=42,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.09))
    white = Image.new("RGB", (size, size), (255, 235, 220))
    return Image.composite(white, base, glow)


def fitted_artwork(source, height):
    """The complete source image, resized to the given height, nothing cropped."""
    w = max(1, round(source.width * height / source.height))
    return source.resize((w, height), Image.LANCZOS)


def paste_with_shadow(canvas, art):
    """Center the artwork with a soft drop shadow for depth."""
    size = canvas.size[0]
    x = (size - art.width) // 2
    y = (size - art.height) // 2
    shadow = Image.new("L", (size, size), 0)
    ds = ImageDraw.Draw(shadow)
    ds.rectangle(
        [x + size * 0.015, y + size * 0.03, x + art.width - size * 0.015,
         y + art.height - size * 0.01],
        fill=110,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.035))
    dark = Image.new("RGBA", (size, size), (20, 6, 4, 255))
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba = Image.composite(
        dark, canvas_rgba, shadow.point(lambda v: min(v, 130))
    )
    canvas_rgba.alpha_composite(art.convert("RGBA"), (x, y))
    return canvas_rgba


def rounded_mask(size, radius_fraction=0.22):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=round(size * radius_fraction), fill=255
    )
    return mask


def circle_mask(size):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


def icon_canvas(source, size, art_fraction):
    """Gradient canvas with the complete artwork fitted (contain) and centered."""
    bg = gradient(size)
    art = fitted_artwork(source, round(size * art_fraction))
    return paste_with_shadow(bg, art)


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    print("wrote", os.path.relpath(path, ROOT))


def build_set(source_key, source, commit):
    tag = SOURCES[source_key][0]

    def path(*parts):
        return os.path.join(ROOT, *parts)

    if not commit:
        return build_preview(source_key, source)

    # Web favicons and large icons.
    for size, name in [
        (32, "favicon-32.png"),
        (180, "apple-touch-icon.png"),
        (192, "icon-192.png"),
        (512, "icon-512.png"),
    ]:
        icon = icon_canvas(source, size, 0.74).convert("RGB")
        if name != "apple-touch-icon.png":
            # Browsers and home screens without their own masking get
            # pre-rounded corners; iOS masks apple-touch-icon itself.
            icon.putalpha(rounded_mask(size))
        save(icon, "web", "brand", name)

    # Google Play listing icon (full bleed, opaque).
    play = icon_canvas(source, 512, 0.74).convert("RGB")
    save(play, "android", "play-icon-512.png")

    res = path("android", "app", "src", "main", "res")
    for density, scale in DENSITIES.items():
        folder = os.path.join(res, "mipmap-" + density)

        # Legacy (API 21-25) launcher icons.
        legacy = round(LEGACY_SIZE * scale)
        square = icon_canvas(source, legacy, 0.74).convert("RGBA")
        square.putalpha(rounded_mask(legacy))
        save(square, folder, "ic_launcher.png")
        circle = icon_canvas(source, legacy, 0.74).convert("RGBA")
        circle.putalpha(circle_mask(legacy))
        save(circle, folder, "ic_launcher_round.png")

        # Adaptive (API 26+) layers: background gradient + foreground art.
        adaptive = round(ADAPTIVE_SIZE * scale)
        save(
            gradient(adaptive).convert("RGB"),
            folder,
            "ic_launcher_background.png",
        )
        fg = Image.new("RGBA", (adaptive, adaptive), (0, 0, 0, 0))
        art = fitted_artwork(source, round(adaptive * SAFE_FRACTION))
        save(
            paste_with_shadow(fg, art),
            folder,
            "ic_launcher_foreground.png",
        )

    anydpi = os.path.join(res, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<adaptive-icon xmlns:android="
        '"http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    for name in ["ic_launcher.xml", "ic_launcher_round.xml"]:
        with open(os.path.join(anydpi, name), "w", encoding="utf-8") as fh:
            fh.write(adaptive_xml)
        print("wrote", os.path.relpath(os.path.join(anydpi, name), ROOT))

    build_preview(source_key, source)
    print("icon set complete for", tag)


def build_preview(source_key, source):
    """Render a labelled preview strip of this source's icon variants."""
    label = SOURCES[source_key][1]
    cells = []
    for size, art_fraction, mask_fn, caption in [
        (192, 0.74, rounded_mask, "Launcher 192"),
        (192, 0.74, circle_mask, "Round"),
        (180, 0.74, None, "apple-touch 180"),
        (32, 0.78, rounded_mask, "favicon 32 (4x)"),
    ]:
        icon = icon_canvas(source, size, art_fraction).convert("RGBA")
        if mask_fn:
            icon.putalpha(mask_fn(size))
        big = icon.resize((192, 192), Image.LANCZOS)
        cells.append((big, caption))

    pad, cap_h = 36, 34
    w = pad + len(cells) * (192 + pad)
    sheet = Image.new("RGB", (w, 192 + cap_h + pad * 2), (26, 24, 22))
    d = ImageDraw.Draw(sheet)
    x = pad
    for img, caption in cells:
        sheet.paste(img, (x, pad), img)
        d.text((x + 96, 192 + pad + 12), caption, fill=(225, 214, 200),
               anchor="mm")
        x += 192 + pad
    d.text((pad, 8), label, fill=(255, 244, 230), anchor="lm")
    out = os.path.join(ROOT, "docs", "modern-design",
                       "app-icon-%s.png" % source_key)
    save(sheet.convert("RGB"), "docs", "modern-design",
         "app-icon-%s.png" % source_key)
    return out


def options_sheet():
    """Side-by-side comparison of both source options as rendered icons."""
    from PIL import ImageFont

    pad, cap_h = 40, 56
    cell = 192
    fonts = "/usr/share/fonts/truetype/dejavu"
    try:
        fb = ImageFont.truetype(os.path.join(fonts, "DejaVuSans-Bold.ttf"), 26)
        fs = ImageFont.truetype(os.path.join(fonts, "DejaVuSans.ttf"), 17)
    except OSError:
        fb = fs = None

    cols = []
    for key in SOURCES:
        filename = SOURCES[key][0]
        source = Image.open(os.path.join(ROOT, filename)).convert("RGB")
        square = icon_canvas(source, cell, 0.74).convert("RGBA")
        square.putalpha(rounded_mask(cell))
        round_ = icon_canvas(source, cell, 0.74).convert("RGBA")
        round_.putalpha(circle_mask(cell))
        thumb = source.copy()
        thumb.thumbnail((cell, cell), Image.LANCZOS)
        cols.append((key, filename, square, round_, thumb))

    w = pad + len(cols) * (cell * 3 + pad * 2) + pad
    h = pad + cap_h + cell + cap_h + pad
    sheet = Image.new("RGB", (w, h), (26, 24, 22))
    d = ImageDraw.Draw(sheet)
    x = pad
    for key, filename, square, round_, thumb in cols:
        d.text((x, pad + 14), SOURCES[key][1], font=fb, fill=(255, 244, 230),
               anchor="lm")
        top = pad + cap_h
        sheet.paste(square, (x, top), square)
        sheet.paste(round_, (x + cell + pad // 2, top), round_)
        tx = x + cell * 2 + pad
        sheet.paste(thumb, (tx + (cell - thumb.width) // 2,
                            top + (cell - thumb.height) // 2))
        d.text((x + cell // 2, top + cell + 24), "Launcher icon",
               font=fs, fill=(210, 198, 186), anchor="mm")
        d.text((x + cell + pad // 2 + cell // 2, top + cell + 24), "Round",
               font=fs, fill=(210, 198, 186), anchor="mm")
        d.text((tx + cell // 2, top + cell + 24), "Source image",
               font=fs, fill=(210, 198, 186), anchor="mm")
        x += cell * 3 + pad * 2
    save(sheet, "docs", "modern-design", "app-icon-options.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        choices=sorted(SOURCES),
        default="1",
        help="which uploaded image to use (default: 1 = i0lkualxlp3e1.jpeg)",
    )
    parser.add_argument(
        "--preview-only",
        action="store_true",
        help="only render the documentation preview sheets",
    )
    args = parser.parse_args()

    if args.preview_only:
        for key in SOURCES:
            source = Image.open(
                os.path.join(ROOT, SOURCES[key][0])
            ).convert("RGB")
            build_preview(key, source)
        options_sheet()
        return

    source = Image.open(os.path.join(ROOT, SOURCES[args.source][0])).convert(
        "RGB"
    )
    build_set(args.source, source, commit=True)
    # Keep preview sheets for both options in sync, whichever is active.
    for key in SOURCES:
        if key != args.source:
            other = Image.open(
                os.path.join(ROOT, SOURCES[key][0])
            ).convert("RGB")
            build_preview(key, other)
    options_sheet()


if __name__ == "__main__":
    main()
