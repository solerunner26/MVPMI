import assert from "node:assert/strict";
// axe 4.13 compares entire paint stacks before considering an opaque ancestor.
// With an inert page behind a bottom sheet, different hidden rows can produce
// elmPartiallyObscuring despite a solid reading surface. Keep the RAW axe result;
// independently verify ONLY this uncertainty, not violations or other checks.
export async function verifyOpaqueModalContrast(page, incomplete, name) {
  const verified = [];
  for (const rule of incomplete) {
    assert.equal(
      rule.id,
      "color-contrast",
      `${name}: unhandled incomplete rule`,
    );
    for (const node of rule.nodes) {
      assert(
        node.any.length &&
          node.any.every((c) => c.data?.messageKey === "elmPartiallyObscuring"),
        `${name}: unhandled contrast uncertainty`,
      );
      assert.equal(
        node.target.length,
        1,
        "Only simple document targets are supported",
      );
      const measurement = await page.locator(node.target[0]).evaluate((el) => {
        const dialog = el.closest('[role="dialog"][aria-modal="true"]');
        if (!dialog) return { error: "Not inside a modal" };
        const rgb = (s) => {
          const m = s.match(/^rgba?\(([^)]+)\)$/);
          return m ? m[1].split(",").map(Number) : null;
        };
        const fg = rgb(getComputedStyle(el).color);
        let bg, surface;
        for (let a = el; a; a = a.parentElement) {
          const style = getComputedStyle(a);
          if (Number(style.opacity) !== 1 || style.filter !== "none")
            return { error: "Translucent or filtered text ancestor" };
          if (!bg) {
            if (style.backgroundImage !== "none")
              return { error: "Image below text" };
            const color = rgb(style.backgroundColor);
            if (color && (color.length === 3 || color[3] === 1)) {
              bg = color;
              surface = a;
            } else if (color?.[3] > 0)
              return { error: "Blended reading surface" };
          }
          if (a === dialog) break;
        }
        if (!bg || !fg || (fg.length > 3 && fg[3] !== 1))
          return { error: "No opaque reading colors" };
        const r = el.getBoundingClientRect(),
          s = surface.getBoundingClientRect();
        if (
          r.x < s.x - 0.5 ||
          r.right > s.right + 0.5 ||
          r.y < s.y - 0.5 ||
          r.bottom > s.bottom + 0.5
        )
          return { error: "Text extends beyond its reading surface" };
        // Unlike axe's virtual grid, actual browser hit testing omits inert rows.
        // Confirm that visible text is not covered by any unrelated element.
        let tested = 0;
        for (const fx of [0.15, 0.5, 0.85])
          for (const fy of [0.15, 0.5, 0.85]) {
            const x = r.x + r.width * fx,
              y = r.y + r.height * fy;
            if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
            const top = document.elementFromPoint(x, y);
            if (!top || !(el.contains(top) || top.contains(el)))
              return { error: "Text is covered by another element" };
            tested++;
          }
        if (!tested) return { error: "Text is outside the viewport" };
        const luminance = (c) =>
          c
            .slice(0, 3)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const f = luminance(fg),
          b = luminance(bg);
        return {
          foreground: fg,
          background: bg,
          ratio: (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05),
          hitTestPoints: tested,
        };
      });
      assert(
        !measurement.error,
        `${name}: ${measurement.error} (${node.target[0]})`,
      );
      assert(
        measurement.ratio >= 4.5,
        `${name}: insufficient independently measured contrast ${measurement.ratio}`,
      );
      verified.push({ target: node.target[0], ...measurement });
    }
  }
  return verified;
}
