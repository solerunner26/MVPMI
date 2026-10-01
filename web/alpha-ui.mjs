// Building blocks for the alpha screens (login, directory, settings, admin
// tools). They reuse the existing Liquid Glass classes (lq-primary, lq-btn,
// workflow-chip, workflow-field, preferences-panel …) so the look stays the
// same; every text comes from web/strings.mjs through t().
const ah = (...args) => React.createElement(...args);

export const digitsOnly = (value, max = 10) => String(value ?? "").replace(/\D/g, "").slice(0, max);
export const validMobile = (value) => /^[6-9]\d{9}$/.test(String(value ?? ""));
export const formatMobile = (value) => {
  const d = String(value ?? "").replace(/\D/g, "");
  return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : d;
};

export function AIcon({ name, className = "" }) {
  return ah("i", { className: "ph-duotone ph-" + name + (className ? " " + className : ""), "aria-hidden": true });
}

// Text kept on ONE line: the font shrinks (max → min px, scaled by the
// text-size setting) until it fits the space; only then would it end in "…".
// Used for the community name in both languages (owner, 2 Oct 2026).
export function AOneLine({ text, className = "", testId, max = 20, min = 12, as = "strong" }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const fs = parseFloat(getComputedStyle(el).getPropertyValue("--fs")) || 1;
      let size = max * Math.min(fs, 1.25);
      el.style.fontSize = size + "px";
      while (el.scrollWidth > el.clientWidth + 0.5 && size > min) {
        size -= 0.5;
        el.style.fontSize = size + "px";
      }
    };
    fit();
    let ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(fit);
      ro.observe(el);
    } else window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});
    return () => (ro ? ro.disconnect() : window.removeEventListener("resize", fit));
  }, [text, max, min]);
  return ah(as, { ref, className: "alpha-oneline " + className, "data-testid": testId, title: text }, text);
}

// Floating glass bottom bar (browsers; the Android app draws the same bar
// natively in Jetpack Compose and hides this one). Five tabs, Search in the
// middle: Profile · Admin tools (Settings for members) · Search · Theme ·
// Language. Outline icon when inactive, filled icon in a pill when active.
export function ABottomNav({ lang, active, isAdmin, adminBadge, dark, onProfile, onAdmin, onSettings, onSearch, onTheme, onLang }) {
  const item = (key, icon, label, onClick, opts = {}) =>
    ah(
      "button",
      {
        key,
        type: "button",
        className: "alpha-navitem" + (opts.center ? " is-center" : "") + (active === key ? " is-active" : ""),
        "aria-label": opts.aria || label,
        "aria-current": active === key ? "page" : undefined,
        "data-testid": opts.testId,
        onClick,
      },
      ah(
        "span",
        { className: "alpha-navpill" },
        ah(ANavIcon, { name: icon, filled: active === key || !!opts.filled }),
        opts.badge ? ah("span", { className: "alpha-badge", "aria-hidden": true }, opts.badge > 99 ? "99+" : String(opts.badge)) : null,
      ),
      ah("span", { className: "alpha-navlabel" }, label),
    );
  return ah(
    "nav",
    { className: "alpha-bottomnav", "aria-label": t("bar.label", lang), "data-testid": "Bottom bar" },
    ah(
      "div",
      { className: "alpha-bottomnav-glass" },
      item("profile", "user-circle", t("bar.profile", lang), onProfile, { testId: "Profile and settings", aria: t("dir.profileBtn", lang) }),
      isAdmin
        ? item("admin", "shield-check", t("bar.admin", lang), onAdmin, { testId: "Admin", aria: t("nav.adminTools", lang), badge: adminBadge })
        : item("settings", "gear-six", t("bar.settings", lang), onSettings, { testId: "Settings tab", aria: t("settings.title", lang) }),
      item("search", "magnifying-glass", t("bar.search", lang), onSearch, { testId: "Search", center: true, aria: t("dir.search", lang) }),
      item("theme", dark ? "sun" : "moon", t(dark ? "bar.light" : "bar.dark", lang), onTheme, { testId: "Theme toggle", aria: t(dark ? "dir.lightOn" : "dir.darkOn", lang) }),
      item("lang", "translate", t("bar.lang", lang), onLang, { testId: "Language toggle", aria: t("bar.langLabel", lang) }),
    ),
  );
}

// 48 px round glass icon button with an accessible name.
export function AIconButton({ icon, label, onClick, badge, testId, pressed, disabled, className = "", type = "button" }) {
  return ah(
    "button",
    {
      type,
      className: "workflow-chip alpha-icon-button " + className,
      "aria-label": label,
      title: label,
      "data-testid": testId || label,
      "aria-pressed": pressed === undefined ? undefined : !!pressed,
      disabled,
      onClick,
    },
    ah(AIcon, { name: icon }),
    badge ? ah("span", { className: "alpha-badge", "aria-hidden": true }, badge > 99 ? "99+" : String(badge)) : null,
  );
}

export function AButton({ kind = "secondary", children, className = "", ...props }) {
  const cls =
    kind === "primary"
      ? "lq-primary lq-btn"
      : kind === "danger"
        ? "lq-danger lq-btn"
        : kind === "text"
          ? "lq-text alpha-text-button"
          : "lq-btn";
  return ah("button", { type: "button", className: cls + " alpha-button " + className, ...props }, children);
}

// Slim glass top bar used by every alpha screen.
export function ATopBar({ title, subtitle, onBack, backLabel, actions = [], testId = "Top bar" }) {
  return ah(
    "header",
    { className: "alpha-topbar lq-glass", "data-testid": testId },
    onBack ? ah(AIconButton, { icon: "arrow-left", label: backLabel, onClick: onBack, testId: "Back" }) : null,
    ah(
      "div",
      { className: "alpha-topbar-title" },
      ah("h1", null, title),
      subtitle ? ah("p", null, subtitle) : null,
    ),
    ah("div", { className: "alpha-topbar-actions" }, ...actions),
  );
}

export function AField({ label, hint, error, children, invalid, className = "" }) {
  return ah(
    "label",
    { className: "workflow-field alpha-field " + className, "data-invalid": invalid ? "true" : undefined },
    ah("span", { className: "alpha-field-label" }, label),
    children,
    error ? ah("span", { className: "alpha-field-error", role: "alert" }, error) : hint ? ah("small", null, hint) : null,
  );
}

// PIN (4 digits, number keyboard) or PASSWORD field with a show/hide eye.
// `autoComplete` lets a password field take part in Google Password Manager
// ("current-password" / "new-password"); the PIN field never does.
export function ASecretInput({ value, onChange, mode = "pin", invalid, testId, autoFocus, lang, label, onEnter, autoComplete, name }) {
  const [shown, setShown] = React.useState(false);
  const pin = mode === "pin";
  return ah(
    "span",
    { className: "alpha-secret" },
    ah("input", {
      type: shown ? "text" : "password",
      value,
      name,
      "aria-label": label,
      "aria-invalid": invalid ? "true" : undefined,
      "data-testid": testId,
      autoFocus,
      autoComplete: autoComplete || "off",
      inputMode: pin ? "numeric" : undefined,
      pattern: pin ? "[0-9]*" : undefined,
      maxLength: pin ? 4 : 128,
      onChange: (e) => onChange(pin ? digitsOnly(e.target.value, 4) : e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      },
    }),
    ah(
      "button",
      {
        type: "button",
        className: "alpha-eye",
        "aria-label": t(shown ? "common.hide" : "common.show", lang) + " · " + label,
        onClick: () => setShown(!shown),
      },
      ah(AIcon, { name: shown ? "eye-slash" : "eye" }),
    ),
  );
}

// A persistent error at the very TOP of the screen (over every panel and
// dialog). It stays until dismissed or the next action starts, so nobody has
// to guess why "Save" or "Final approval" did nothing.
export function AErrorBanner({ error, lang, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    try {
      ref.current?.scrollIntoView?.({ block: "nearest" });
      ref.current?.focus?.();
    } catch {}
  }, [error]);
  if (!error) return null;
  const e = error.error || {};
  const message = error.message || alphaError(e, lang);
  const technical = [e.status ? "HTTP " + e.status : "", e.code || "", error.action || ""].filter(Boolean).join(" · ");
  // Rendered straight into <body> so no panel or dialog can cover it.
  let fs = "1";
  try {
    fs = getComputedStyle(document.querySelector(".app")).getPropertyValue("--fs").trim() || "1";
  } catch {}
  const banner = ah(
    "div",
    { className: "alpha-error-banner", role: "alert", "aria-live": "assertive", tabIndex: -1, ref, "data-testid": "Error banner", style: { "--fs": fs } },
    ah(AIcon, { name: "warning-circle" }),
    ah(
      "div",
      { className: "alpha-error-body" },
      ah("strong", null, error.title || t("err.bannerTitle", lang)),
      ah("p", { "data-testid": "Error banner message" }, message),
      technical ? ah("small", null, t("err.technical", lang) + ": " + technical) : null,
    ),
    ah("button", { type: "button", className: "alpha-error-close", onClick: onClose, "aria-label": t("err.bannerClose", lang), "data-testid": "Error banner close" }, ah(AIcon, { name: "x" })),
  );
  return typeof ReactDOM !== "undefined" && ReactDOM.createPortal ? ReactDOM.createPortal(banner, document.body) : banner;
}

// Dialog sheet on the existing glass scrim.
export function ASheet({ title, onClose, closeLabel, children, testId, className = "" }) {
  return ah(
    "div",
    { className: "preferences-scrim alpha-scrim" },
    ah(
      "section",
      {
        className: "preferences-panel alpha-sheet " + className,
        role: "dialog",
        "aria-modal": true,
        "aria-label": title,
        "data-testid": testId || title,
        tabIndex: -1,
      },
      ah(
        "header",
        { className: "sheet-heading" },
        ah("h2", null, title),
        onClose ? ah(AIconButton, { icon: "x", label: closeLabel, onClick: onClose, className: "sheet-close", testId: "Close dialog" }) : null,
      ),
      children,
    ),
  );
}

export function AConfirm({ title, body, yes, no, danger, onYes, onNo, testId = "Confirm" }) {
  return ah(
    ASheet,
    { title, onClose: onNo, closeLabel: no, testId },
    body ? ah("p", { className: "alpha-sheet-body" }, body) : null,
    ah(
      "div",
      { className: "alpha-actions" },
      ah(AButton, { kind: danger ? "danger" : "primary", onClick: onYes, "data-testid": "Confirm yes" }, yes),
      ah(AButton, { onClick: onNo, "data-testid": "Confirm no" }, no),
    ),
  );
}

export function ANotice({ kind = "info", children, testId }) {
  return ah(
    "div",
    { className: "alpha-notice alpha-notice-" + kind, role: kind === "error" ? "alert" : "status", "data-testid": testId },
    ah(AIcon, { name: kind === "error" ? "warning-circle" : kind === "ok" ? "check-circle" : "info" }),
    ah("div", null, children),
  );
}

// Live countdown for "locked for 5 minutes" messages.
export function useCountdown(until) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    if (!until || until <= Date.now()) return undefined;
    const id = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
}

// Human text for an API error, with the number of attempts left.
export function alphaError(error, lang) {
  if (!error) return "";
  const main = errorMessage(error, lang);
  return Number.isFinite(error.left) && error.left > 0 && error.left < 5
    ? main + " " + t("err.attemptsLeft", lang, { n: error.left })
    : main;
}

// ---- Main Admin: change password (any password, at least 4 characters) ----
export function AChangeSecretDialog({ lang, api, onDone, onClose }) {
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error && error.code !== "LOCKED_OUT") setError(null);
  };
  const check = () => {
    if (!form.current) return { code: "WRONG_OLD_PASSWORD", field: "current" };
    if (form.next.length < 4) return { code: "PASSWORD_FORMAT", field: "next" };
    if (form.next === form.current) return { code: "PASSWORD_SAME", field: "next" };
    if (form.confirm !== form.next) return { code: "PASSWORD_MISMATCH", field: "confirm" };
    return null;
  };
  const submit = async () => {
    if (busy) return;
    const local = check();
    if (local) {
      setError(local);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("password/change", form);
      onDone(t("change.passwordDone", lang), form.next);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, left: e.left, until: e.until, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const field = (key, label, complete) =>
    ah(
      AField,
      { label, invalid: error?.field === key, className: "alpha-secret-field" },
      ah(ASecretInput, {
        value: form[key],
        onChange: set(key),
        mode: "password",
        invalid: error?.field === key,
        testId: "Change " + key,
        label,
        lang,
        autoFocus: key === "current",
        autoComplete: complete,
        name: complete === "current-password" ? "password" : "new-password",
        onEnter: submit,
      }),
    );
  const message =
    error?.code === "LOCKED_OUT"
      ? t("lock.wait", lang, { min: Math.floor(wait / 60), sec: String(wait % 60).padStart(2, "0") })
      : alphaError(error, lang);
  return ah(
    ASheet,
    { title: t("change.passwordTitle", lang), onClose, closeLabel: t("common.close", lang), testId: "Change Password dialog" },
    ah(
      "form",
      {
        className: "alpha-form",
        noValidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      field("current", t("field.oldPassword", lang), "current-password"),
      field("next", t("field.newPassword", lang), "new-password"),
      field("confirm", t("field.newPassword2", lang), "new-password"),
      ah("p", { className: "alpha-hint" }, t("field.passwordHint", lang), " ", t("change.otherPhones", lang)),
      message ? ah(ANotice, { kind: "error", testId: "Change error" }, message) : null,
      ah(
        "div",
        { className: "alpha-actions" },
        ah(AButton, { kind: "primary", type: "submit", disabled: busy || (error?.code === "LOCKED_OUT" && wait > 0), "data-testid": "Change submit" }, busy ? t("common.wait", lang) : t("change.submit", lang)),
        ah(AButton, { onClick: onClose, "data-testid": "Change cancel" }, t("common.cancel", lang)),
      ),
    ),
  );
}

// ---- My Profile: turn the optional phone PIN lock on / change its PIN ------
// The PIN belongs to this phone only; nobody else (no admin) ever needs it.
export function ALockPinDialog({ lang, changing, api, onDone, onClose }) {
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) return setError({ code: "PIN_FORMAT", field: "pin" });
    if (confirm !== pin) return setError({ code: "PIN_MISMATCH", field: "confirm" });
    setBusy(true);
    setError(null);
    try {
      const data = await api("lock/preference", { on: true, pin, confirm });
      onDone(data, pin);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  return ah(
    ASheet,
    { title: t(changing ? "lock.changeTitle" : "lock.setTitle", lang), onClose, closeLabel: t("common.close", lang), testId: "Lock PIN dialog" },
    ah(
      "form",
      {
        className: "alpha-form",
        noValidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah(AField, { label: t("lock.newPin", lang), invalid: error?.field === "pin" }, ah(ASecretInput, { value: pin, mode: "pin", lang, label: t("lock.newPin", lang), invalid: error?.field === "pin", testId: "Lock pin", autoFocus: true, onChange: (v) => { setPin(v); setError(null); } })),
      ah(AField, { label: t("lock.newPin2", lang), invalid: error?.field === "confirm" }, ah(ASecretInput, { value: confirm, mode: "pin", lang, label: t("lock.newPin2", lang), invalid: error?.field === "confirm", testId: "Lock pin confirm", onChange: (v) => { setConfirm(v); setError(null); }, onEnter: submit })),
      ah("p", { className: "alpha-hint" }, t("lock.toggleHelp", lang)),
      error ? ah(ANotice, { kind: "error", testId: "Lock pin error" }, alphaError(error, lang)) : null,
      ah(
        "div",
        { className: "alpha-actions" },
        ah(AButton, { kind: "primary", type: "submit", disabled: busy, "data-testid": "Lock pin save" }, busy ? t("common.wait", lang) : t("lock.set", lang)),
        ah(AButton, { onClick: onClose }, t("common.cancel", lang)),
      ),
    ),
  );
}

// ---- Village Admin created: hand-over by call or WhatsApp (no PIN) ---------
export function villageAdminMessage(issued, lang) {
  return t("vac.msg", lang, {
    app: t("app.community", "gu") + " · " + t("app.title", "gu"),
    appEn: t("app.community", "en") + " · " + t("app.title", "en"),
    village: issued.village || "",
    villageEn: issued.villageEn || issued.village || "",
    phone: formatMobile(issued.phone),
  });
}
export function AVillageAdminCreatedDialog({ issued, lang, onClose }) {
  const who = lang === "en" ? issued.name : issued.nameGu || issued.name;
  return ah(
    ASheet,
    { title: t("vac.title", lang), onClose, closeLabel: t("common.done", lang), testId: "Village Admin created dialog" },
    ah("p", { className: "alpha-sheet-body", "data-testid": "Village Admin created text" }, t("vac.body", lang, { name: who, phone: formatMobile(issued.phone) })),
    ah(
      "div",
      { className: "alpha-actions" },
      ah(AWhatsAppLink, { issued, lang, testId: "Share on WhatsApp" }),
      ah(ACallLink, { phone: issued.phone, lang, testId: "Village Admin call" }),
      ah(AButton, { onClick: onClose, "data-testid": "Village Admin created done" }, t("common.done", lang)),
    ),
  );
}
export function AWhatsAppLink({ issued, lang, testId }) {
  return ah(
    "a",
    {
      role: "button",
      className: "lq-btn alpha-button alpha-whatsapp",
      href: "https://wa.me/91" + issued.phone + "?text=" + encodeURIComponent(villageAdminMessage(issued, lang)),
      target: "_blank",
      rel: "noopener noreferrer",
      "data-testid": testId,
    },
    ah(AIcon, { name: "whatsapp-logo" }),
    " ",
    t("vac.share", lang),
  );
}
export function ACallLink({ phone, lang, testId }) {
  return ah(
    "a",
    { role: "button", className: "lq-btn alpha-button", href: "tel:+91" + phone, "data-testid": testId },
    ah(AIcon, { name: "phone" }),
    " ",
    t("vac.call", lang),
  );
}

// The waiting sun from the earlier build (SunWait): rays turning in two
// directions around the sun disc with an hourglass inside. Shown while a
// registration waits for approval.
const SUN_WAIT_SVG = `<svg viewBox="-100 -100 200 200" style="display:block;overflow:visible">
  <defs>
    <radialGradient id="swDisc" cx="34%" cy="25%" r="80%">
      <stop offset="0%" stop-color="#FFEECB"></stop>
      <stop offset="30%" stop-color="#F3BC6A"></stop>
      <stop offset="66%" stop-color="#E9A13B"></stop>
      <stop offset="100%" stop-color="#B2402C"></stop>
    </radialGradient>
    <linearGradient id="swRay" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#B2402C"></stop>
      <stop offset="40%" stop-color="#E9A13B"></stop>
      <stop offset="100%" stop-color="#FFE1A6"></stop>
    </linearGradient>
    <linearGradient id="swSand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE1A6"></stop>
      <stop offset="100%" stop-color="#E9A13B"></stop>
    </linearGradient>
    <radialGradient id="swHalo" r="50%">
      <stop offset="60%" stop-color="#E9A13B" stop-opacity=".34"></stop>
      <stop offset="100%" stop-color="#E9A13B" stop-opacity="0"></stop>
    </radialGradient>
    <path id="swFlame" fill="#E9A13B" d="M -5.6,-47 C -12,-57 2,-64 -2.6,-78 C 7.8,-67.5 14,-55 5.6,-47 Z"></path>
    <path id="swFlameS" fill="#F3BC6A" d="M -3.4,-47 C -7.6,-53 1.2,-57.5 -1.4,-65 C 4.8,-58 8.4,-52 3.4,-47 Z"></path>
    <g id="swRaysA">
      <use href="#swFlame" transform="rotate(0)"></use><use href="#swFlame" transform="rotate(30)"></use>
      <use href="#swFlame" transform="rotate(60)"></use><use href="#swFlame" transform="rotate(90)"></use>
      <use href="#swFlame" transform="rotate(120)"></use><use href="#swFlame" transform="rotate(150)"></use>
      <use href="#swFlame" transform="rotate(180)"></use><use href="#swFlame" transform="rotate(210)"></use>
      <use href="#swFlame" transform="rotate(240)"></use><use href="#swFlame" transform="rotate(270)"></use>
      <use href="#swFlame" transform="rotate(300)"></use><use href="#swFlame" transform="rotate(330)"></use>
    </g>
    <clipPath id="swGlass"><path d="M -12,-20.6 L 12,-20.6 L 1.7,0 L 12,20.6 L -12,20.6 L -1.7,0 Z"></path></clipPath>
    <g id="swRaysB">
      <use href="#swFlameS" transform="rotate(15)"></use><use href="#swFlameS" transform="rotate(45)"></use>
      <use href="#swFlameS" transform="rotate(75)"></use><use href="#swFlameS" transform="rotate(105)"></use>
      <use href="#swFlameS" transform="rotate(135)"></use><use href="#swFlameS" transform="rotate(165)"></use>
      <use href="#swFlameS" transform="rotate(195)"></use><use href="#swFlameS" transform="rotate(225)"></use>
      <use href="#swFlameS" transform="rotate(255)"></use><use href="#swFlameS" transform="rotate(285)"></use>
      <use href="#swFlameS" transform="rotate(315)"></use><use href="#swFlameS" transform="rotate(345)"></use>
    </g>
  </defs>

  <circle r="88" fill="#E9A13B" opacity=".12"></circle>
  <circle r="66" fill="#E9A13B" opacity=".1"></circle>
  <g style="transform-origin:0 0;animation:swTurn 60s linear infinite">
    <use href="#swRaysA" fill="#E9A13B"></use>
  </g>
  <g style="transform-origin:0 0;animation:swTurn 40s linear infinite reverse">
    <use href="#swRaysB" fill="#F3BC6A" opacity=".95"></use>
  </g>
  <circle r="48" fill="#B2402C" opacity=".92"></circle>
  <circle r="45" fill="url(#swDisc)"></circle>
  <ellipse cx="-15" cy="-19" rx="17" ry="9" fill="#FFFFFF" opacity=".4" style="filter:blur(3px)"></ellipse>

  <g style="transform-origin:0 0;animation:swFlip 9s cubic-bezier(.7,0,.3,1) infinite">
    <rect x="-16" y="-25" width="32" height="4.4" rx="2.2" fill="#6B2A1C"></rect>
    <rect x="-16" y="20.6" width="32" height="4.4" rx="2.2" fill="#6B2A1C"></rect>
    <path d="M -12,-20.6 L 12,-20.6 L 1.7,0 L 12,20.6 L -12,20.6 L -1.7,0 Z" fill="#7B2D1B" opacity=".82"></path>
    <path d="M -12,-20.6 L 12,-20.6 L 1.7,0 L 12,20.6 L -12,20.6 L -1.7,0 Z" fill="none" stroke="#6B2A1C" stroke-width="2.2" stroke-linejoin="round"></path>
    <g clip-path="url(#swGlass)">
      <rect x="-13" y="-21" width="26" height="21.4" fill="#F0AE4D" style="animation:swTop 9s cubic-bezier(.55,0,.45,1) infinite"></rect>
      <rect x="-13" y="-.4" width="26" height="21.4" fill="#F0AE4D" style="animation:swBot 9s cubic-bezier(.55,0,.45,1) infinite"></rect>
    </g>
    <rect x="-.8" y="-2" width="1.6" height="7" rx=".8" fill="#F0AE4D" style="animation:swGrain 1.05s linear infinite"></rect>
  </g>
</svg>`;
export function ASunWait({ size = 132, testId = "Waiting sun" }) {
  return ah("div", {
    className: "alpha-sunwait",
    style: { width: size, height: size },
    "aria-hidden": true,
    "data-testid": testId,
    dangerouslySetInnerHTML: { __html: SUN_WAIT_SVG },
  });
}
