// Liquid Glass runtime touches (presentation only — never changes state):
//  • slides the glass "lens" of every tab group to the selected tab
//    (Swiggy / iOS 26 style, with a jelly squash while it travels);
//  • moves each control's specular highlight toward the finger;
//  • paints the filled part of range sliders.
// Everything is observed from the DOM, so React components that re-render
// on their own (panels, sheets) are covered too.
const LQ_TABS = ".directory-segments, .workflow-tabs, .lq-tabs";
const LQ_SHEEN =
  "button, a[role='button'], .mvpmi-tile, .member-card, .workflow-card, .main-header, .directory-search, .admin-row";

function lqPlaceLens(group) {
  const active = group.querySelector(
    ":scope > button[aria-pressed='true'], :scope > * > button[aria-pressed='true']",
  );
  if (!active || !active.offsetWidth) {
    group.style.setProperty("--thumb-o", "0");
    return;
  }
  // The lens follows the tab in both directions: section tabs may sit in a
  // grid of two rows (every label fully visible, never cut off).
  const x = active.offsetLeft,
    w = active.offsetWidth,
    y = active.offsetTop,
    hh = active.offsetHeight;
  const previous = group.__lqLens;
  if (previous && previous.x === x && previous.w === w && previous.y === y && previous.h === hh) {
    group.classList.add("lq-ready");
    return;
  }
  group.__lqLens = { x, w, y, h: hh };
  group.style.setProperty("--thumb-x", x + "px");
  group.style.setProperty("--thumb-w", w + "px");
  group.style.setProperty("--thumb-y", y + "px");
  group.style.setProperty("--thumb-h", hh + "px");
  group.style.setProperty("--thumb-o", "1");
  if (previous) {
    group.classList.add("lq-moving");
    clearTimeout(group.__lqMoving);
    group.__lqMoving = setTimeout(() => group.classList.remove("lq-moving"), 240);
    if (group.scrollWidth > group.clientWidth && active.scrollIntoView)
      active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  } else {
    // First placement: appear in place without sliding in from the left.
    group.classList.add("lq-instant");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => group.classList.remove("lq-instant")),
    );
  }
  // Mark ready one frame later so the static fallback pill fades out
  // only once the lens is in place.
  requestAnimationFrame(() => group.classList.add("lq-ready"));
}

function lqRange(input) {
  const min = Number(input.min || 0),
    max = Number(input.max || 100),
    value = Number(input.value);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty("--lq-range", Math.max(0, Math.min(100, pct)) + "%");
}

export function liquidRefresh(root) {
  if (!root) return;
  for (const group of root.querySelectorAll(LQ_TABS)) lqPlaceLens(group);
  for (const input of root.querySelectorAll('input[type="range"]')) lqRange(input);
}

export function liquidInstall(root) {
  if (!root || root.__lqInstalled) return () => {};
  root.__lqInstalled = true;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      liquidRefresh(root);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "class", "data-lang"],
  });
  const onPointer = (event) => {
    if (event.pointerType === "mouse" && event.type === "pointermove" && event.buttons === 0 && !event.target.closest?.("button"))
      return;
    const el = event.target.closest?.(LQ_SHEEN);
    if (!el || !root.contains(el)) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    el.style.setProperty("--lx", (((event.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
    el.style.setProperty("--ly", (((event.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
  };
  const onInput = (event) => {
    if (event.target.type === "range") lqRange(event.target);
  };
  root.addEventListener("pointerdown", onPointer, { passive: true });
  root.addEventListener("pointermove", onPointer, { passive: true });
  root.addEventListener("input", onInput, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  document.fonts?.ready?.then(schedule).catch(() => {});
  schedule();
  return () => {
    observer.disconnect();
    root.removeEventListener("pointerdown", onPointer);
    root.removeEventListener("pointermove", onPointer);
    root.removeEventListener("input", onInput);
    window.removeEventListener("resize", schedule);
    root.__lqInstalled = false;
  };
}
