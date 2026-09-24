// Layout audit used by the screenshot gallery (GALLERY_AUDIT=1): finds text
// that is clipped, escapes its control, wraps inside a capsule, or overlaps
// other text, and lists the sizes of every control family so that the same
// kind of control can be kept identical everywhere. Presentation only.
export async function layoutAudit(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const app = document.querySelector(".app");
    const out = { clipped: [], escaped: [], wrapped: [], overlap: [], families: {} };
    const visible = (el) => {
      if (!el.getClientRects().length) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && Number(s.opacity) > 0.05;
    };
    const label = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const path = (el) => {
      const parts = [];
      for (let n = el; n && n !== app && parts.length < 3; n = n.parentElement)
        parts.unshift(n.tagName.toLowerCase() + (n.classList.length ? "." + [...n.classList].slice(0, 2).join(".") : ""));
      return parts.join(">");
    };
    const all = [...app.querySelectorAll("*")].filter((el) => !el.closest(".sr-only") && visible(el));
    // 1. Clipped text: a box that hides part of its text.
    for (const el of all) {
      if (!el.textContent.trim() || el.matches("input,textarea,select,svg,svg *")) continue;
      const s = getComputedStyle(el);
      const hides = s.overflowX !== "visible" || s.overflowY !== "visible" || s.textOverflow === "ellipsis";
      if (!hides || s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowY === "auto" || s.overflowY === "scroll") continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        out.clipped.push({ el: path(el), text: label(el), w: [el.clientWidth, el.scrollWidth], h: [el.clientHeight, el.scrollHeight] });
    }
    const textRects = (root) => {
      const rects = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.data.trim() || !t.parentElement || !visible(t.parentElement) || t.parentElement.closest(".sr-only")) continue;
        const r = document.createRange();
        r.selectNodeContents(t);
        for (const q of r.getClientRects()) {
          if (q.width <= 1 || q.height <= 1) continue;
          // Skip text hidden under another layer (a sheet over the page).
          const x = Math.min(Math.max(q.left + q.width / 2, 0), innerWidth - 1);
          const y = Math.min(Math.max(q.top + q.height / 2, 0), innerHeight - 1);
          const hit = document.elementFromPoint(x, y);
          const on = hit && (t.parentElement.contains(hit) || hit.contains(t.parentElement));
          rects.push({ q, t, on });
        }
      }
      return rects;
    };
    // 2/3. Controls: text escaping the control, or a capsule label on 2+ lines.
    const controls = all.filter((el) => el.matches("button,a[role=button],[role=tab],.chip,.badge,.segment-count,.workflow-chip,.pill,label.workflow-check"));
    for (const c of controls) {
      const box = c.getBoundingClientRect();
      const rs = textRects(c);
      for (const { q, t } of rs)
        if (q.left < box.left - 1 || q.right > box.right + 1 || q.top < box.top - 1 || q.bottom > box.bottom + 1) {
          out.escaped.push({ el: path(c), text: label(c), part: t.data.trim().slice(0, 30) });
          break;
        }
      if (c.matches("button,a[role=button],[role=tab]")) {
        // Lines per visible text node (a two-language stack is 2 nodes, fine).
        const tops = new Map();
        for (const { q, t } of rs) {
          const set = tops.get(t) || new Set();
          set.add(Math.round(q.top / 4));
          tops.set(t, set);
        }
        const lines = Math.max(0, ...[...tops.values()].map((s) => s.size));
        if (lines > 1) out.wrapped.push({ el: path(c), text: label(c), lines, h: Math.round(box.height), w: Math.round(box.width) });
      }
      const s = getComputedStyle(c);
      const key = (c.className && typeof c.className === "string" ? c.className.split(/\s+/).filter((x) => !/^(lq-|active|on|sel)/.test(x)).slice(0, 2).join(".") : "") || c.tagName.toLowerCase();
      const fam = (out.families[key] ||= {});
      const size = `${Math.round(box.height)}h r${parseFloat(s.borderTopLeftRadius) >= box.height / 2 - 1 ? "pill" : Math.round(parseFloat(s.borderTopLeftRadius))} ${s.fontSize}/${s.fontWeight}`;
      (fam[size] ||= []).push(label(c).slice(0, 24));
    }
    // 4. Overlapping text from different nodes.
    const rs = textRects(app).filter((r) => r.on && r.q.bottom > 0 && r.q.top < innerHeight);
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i].q, b = rs[j].q;
        if (rs[i].t === rs[j].t) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 3 && h > 4)
          out.overlap.push({ a: rs[i].t.data.trim().slice(0, 30), b: rs[j].t.data.trim().slice(0, 30), at: [Math.round(a.left), Math.round(a.top)] });
      }
    if (document.documentElement.scrollWidth > innerWidth + 1) out.pageOverflow = document.documentElement.scrollWidth;
    return out;
  });
}
