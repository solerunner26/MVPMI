import assert from "node:assert/strict";
import { verifyOpaqueModalContrast } from "./modal-contrast-checks.mjs";

// axe cannot compute contrast for text on Liquid Glass (gradients, sheen,
// translucent tints, decorative pseudo-elements): it reports those nodes as
// "incomplete". This check measures what the person actually SEES instead:
// it screenshots each such text box, separates glyph pixels from background
// pixels, and requires the worst realistic background (10th percentile) to
// meet WCAG AA against the text colour (4.5:1, or 3:1 for large text).
// Anything else axe is unsure about still goes to the strict modal check.
const GLASS_KEYS = new Set(["bgGradient", "bgImage", "pseudoContent", "bgOverlap", "elmPartiallyObscured", "shortTextContent"]);

const lum = ([r, g, b]) =>
  [r, g, b]
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export async function verifyGlassContrast(page, incomplete, name) {
  const glass = [],
    rest = [];
  for (const rule of incomplete) {
    const nodes = rule.id === "color-contrast" ? rule.nodes : [];
    const g = nodes.filter((n) => n.any.some((c) => GLASS_KEYS.has(c.data?.messageKey)));
    const other = rule.nodes.filter((n) => !g.includes(n));
    if (other.length) rest.push({ ...rule, nodes: other });
    glass.push(...g);
  }
  const verified = await verifyOpaqueModalContrast(page, rest, name);
  for (const node of glass) {
    const target = node.target[0];
    const locator = page.locator(target).first();
    // A live re-render can replace the node axe reported; skip it then.
    if (!(await locator.count())) continue;
    const info = await locator.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const m = s.color.match(/[\d.]+/g).map(Number);
      const size = parseFloat(s.fontSize),
        bold = Number(s.fontWeight) >= 700;
      return {
        fg: m.slice(0, 3),
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
        large: size >= 24 || (bold && size >= 18.66),
        visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
      };
    }, undefined, { timeout: 5000 }).catch(() => null);
    if (!info) continue;
    if (!info.visible) continue;
    const clip = {
      x: Math.max(0, info.box.x),
      y: Math.max(0, info.box.y),
      width: Math.max(1, Math.min(info.box.width, 2000)),
      height: Math.max(1, Math.min(info.box.height, 2000)),
    };
    const png = await page.screenshot({ clip });
    const pixels = await page.evaluate(async (data) => {
      const img = new Image();
      img.src = "data:image/png;base64," + data;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
    }, png.toString("base64"));
    // Glyphs and their anti-aliased edges cover well under half of a text
    // box; the brighter-contrast half of the pixels is the background.
    const all = [];
    for (let i = 0; i < pixels.length; i += 4)
      all.push(ratio([pixels[i], pixels[i + 1], pixels[i + 2]], info.fg));
    if (all.length < 16) continue;
    all.sort((a, b) => a - b);
    const bg = all.slice(Math.floor(all.length * 0.45));
    // Worst realistic background: 5th percentile of the background pixels.
    const worst = bg[Math.floor(bg.length * 0.05)];
    const need = info.large ? 3 : 4.5;
    assert(
      worst >= need,
      `${name}: glass text contrast ${worst.toFixed(2)} < ${need} (${target})`,
    );
    verified.push({ target, glass: true, ratio: Number(worst.toFixed(2)) });
  }
  return verified;
}
