// Building blocks for the alpha screens (login, directory, settings, admin
// tools). They reuse the existing Liquid Glass classes (lq-primary, lq-btn,
// workflow-chip, workflow-field, preferences-panel …) so the look stays the
// same; every text comes from web/strings.mjs through t().
const ah = (...args) => React.createElement(...args);

export const ALPHA_WEAK_PINS = [
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321",
];
export const digitsOnly = (value, max = 10) => String(value ?? "").replace(/\D/g, "").slice(0, max);
export const validMobile = (value) => /^[6-9]\d{9}$/.test(String(value ?? ""));
export const formatMobile = (value) => {
  const d = String(value ?? "").replace(/\D/g, "");
  return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : d;
};

export function AIcon({ name, className = "" }) {
  return ah("i", { className: "ph-duotone ph-" + name + (className ? " " + className : ""), "aria-hidden": true });
}

// 48 px round glass icon button with an accessible name.
export function AIconButton({ icon, label, onClick, badge, testId, pressed, disabled, className = "" }) {
  return ah(
    "button",
    {
      type: "button",
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
export function ASecretInput({ value, onChange, mode = "pin", invalid, testId, autoFocus, lang, label, onEnter }) {
  const [shown, setShown] = React.useState(false);
  const pin = mode === "pin";
  return ah(
    "span",
    { className: "alpha-secret" },
    ah("input", {
      type: shown ? "text" : "password",
      value,
      "aria-label": label,
      "aria-invalid": invalid ? "true" : undefined,
      "data-testid": testId,
      autoFocus,
      autoComplete: "off",
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

// ---- Section 6: one dialog for every PIN / PASSWORD change ----------------
// Keeps the dialog open on every error, keeps what was typed, highlights the
// wrong field and shows the exact reason in the chosen language.
export function AChangeSecretDialog({ lang, mode = "pin", api, onDone, onClose }) {
  const pin = mode === "pin";
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error && error.code !== "LOCKED_OUT") setError(null);
  };
  const check = () => {
    if (pin) {
      if (!/^\d{4}$/.test(form.current)) return { code: "PIN_FORMAT", field: "current" };
      if (!/^\d{4}$/.test(form.next)) return { code: "PIN_FORMAT", field: "next" };
      if (ALPHA_WEAK_PINS.includes(form.next)) return { code: "PIN_WEAK", field: "next" };
      if (form.next === form.current) return { code: "PIN_SAME", field: "next" };
      if (form.confirm !== form.next) return { code: "PIN_MISMATCH", field: "confirm" };
    } else {
      if (!form.current) return { code: "WRONG_OLD_PASSWORD", field: "current" };
      if (form.next.length < 8) return { code: "PASSWORD_FORMAT", field: "next" };
      if (form.next === form.current) return { code: "PASSWORD_SAME", field: "next" };
      if (form.confirm !== form.next) return { code: "PASSWORD_MISMATCH", field: "confirm" };
    }
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
      await api(pin ? "pin/change" : "password/change", form);
      onDone(t(pin ? "change.pinDone" : "change.passwordDone", lang));
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, left: e.left, until: e.until, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const field = (key, label) =>
    ah(
      AField,
      { label, invalid: error?.field === key, className: "alpha-secret-field" },
      ah(ASecretInput, {
        value: form[key],
        onChange: set(key),
        mode: pin ? "pin" : "password",
        invalid: error?.field === key,
        testId: "Change " + key,
        label,
        lang,
        autoFocus: key === "current",
        onEnter: submit,
      }),
    );
  const message =
    error?.code === "LOCKED_OUT"
      ? t("lock.wait", lang, { min: Math.floor(wait / 60), sec: String(wait % 60).padStart(2, "0") })
      : alphaError(error, lang);
  return ah(
    ASheet,
    {
      title: t(pin ? "change.pinTitle" : "change.passwordTitle", lang),
      onClose,
      closeLabel: t("common.close", lang),
      testId: pin ? "Change PIN dialog" : "Change Password dialog",
    },
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
      field("current", t(pin ? "field.oldPin" : "field.oldPassword", lang)),
      field("next", t(pin ? "field.newPin" : "field.newPassword", lang)),
      field("confirm", t(pin ? "field.newPin2" : "field.newPassword2", lang)),
      ah("p", { className: "alpha-hint" }, t(pin ? "field.pinHint" : "field.passwordHint", lang), " ", t("change.otherPhones", lang)),
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

// ---- Section 3/5: the TEMP PIN is shown ONCE, with a WhatsApp button -------
export function tempPinMessage(issued, lang) {
  const key =
    issued.kind === "village-admin"
      ? "temp.msgVillageAdmin"
      : issued.kind === "member"
        ? "temp.msgMember"
        : "temp.msgReset";
  return t(key, lang, {
    app: t("app.community", "gu") + " · " + t("app.title", "gu"),
    appEn: t("app.community", "en") + " · " + t("app.title", "en"),
    village: issued.village || "",
    villageEn: issued.villageEn || issued.village || "",
    pin: issued.pin,
    phone: formatMobile(issued.phone),
  });
}
export function ATempPinDialog({ issued, lang, onClose }) {
  const href = "https://wa.me/91" + issued.phone + "?text=" + encodeURIComponent(tempPinMessage(issued, lang));
  const who = (lang === "en" ? issued.name : issued.nameGu || issued.name) + " · " + formatMobile(issued.phone);
  return ah(
    ASheet,
    { title: t("temp.title", lang), onClose, closeLabel: t("common.done", lang), testId: "TEMP PIN dialog" },
    ah("p", { className: "alpha-sheet-body" }, who),
    ah("div", { className: "alpha-temp-pin", "data-testid": "TEMP PIN value", "aria-label": t("temp.title", lang) + " " + issued.pin.split("").join(" ") }, issued.pin),
    ah(ANotice, { kind: "info" }, t("temp.once", lang), " ", t("temp.sharedHint", lang)),
    ah(
      "div",
      { className: "alpha-actions" },
      ah(
        "a",
        {
          role: "button",
          className: "lq-primary lq-btn alpha-button alpha-whatsapp",
          href,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-testid": "Share on WhatsApp",
        },
        ah(AIcon, { name: "whatsapp-logo" }),
        " ",
        t("temp.share", lang),
      ),
      ah(AButton, { onClick: onClose, "data-testid": "TEMP PIN done" }, t("common.done", lang)),
    ),
  );
}
