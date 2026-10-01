// Login (mobile number only; password for the Main Admin), the Main Admin's
// first-password screen, the optional PIN lock screen, and re-opening the admin
// tools.

function ABrand({ lang, waiting }) {
  return ah(
    "div",
    { className: "alpha-brand" + (waiting ? " is-waiting" : "") },
    waiting
      ? ah(ASunWait, { size: 128 })
      : ah("img", { src: "/brand/sun-logo-192.png", alt: "", width: 72, height: 72, className: "alpha-brand-mark" }),
    ah(AOneLine, { as: "p", className: "alpha-brand-community", text: t("app.community", lang), max: 17, min: 11 }),
    ah("h1", { className: "alpha-brand-title" }, t("app.title", lang)),
  );
}

function ALanguageSwitch({ lang, onLang }) {
  return ah(
    "div",
    { className: "alpha-lang", role: "group", "aria-label": t("settings.language", lang) },
    ah("button", { type: "button", "aria-pressed": lang === "gu", onClick: () => onLang("gu"), "data-testid": "Language Gujarati" }, "ગુજરાતી"),
    ah("button", { type: "button", "aria-pressed": lang === "en", onClick: () => onLang("en"), "data-testid": "Language English" }, "English"),
  );
}

// Login: Members and Village Admins log in with the MOBILE NUMBER ONLY (no PIN,
// no password). Only the Main Admin has a password; the field appears when
// the person taps "Main Admin? Log in with password" or the server asks for
// it. The password field is a real, autofill-friendly form so the phone can
// offer to save it in Google Password Manager.
export function ALoginScreen({ lang, onLang, api, onLoggedIn, onRegister, onAdmins, approvedNotice, offline, onRetry, initialMobile = "" }) {
  const [mobile, setMobile] = React.useState(initialMobile);
  const [secret, setSecret] = React.useState("");
  const [withPassword, setWithPassword] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const submit = async () => {
    if (busy) return;
    if (!validMobile(mobile)) return setError({ code: "MOBILE_FORMAT", field: "mobile" });
    if (withPassword && !secret) return setError({ code: "PASSWORD_REQUIRED", field: "secret" });
    setBusy(true);
    setError(null);
    try {
      const data = await api("login", withPassword ? { mobile, secret } : { mobile });
      const used = secret;
      setSecret("");
      onLoggedIn(data, used);
    } catch (e) {
      // The Main Admin's number asks for the password: show the field.
      if (e.code === "PASSWORD_REQUIRED") setWithPassword(true);
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.code === "PASSWORD_REQUIRED" ? "secret" : e.field, left: e.left, until: e.until, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const status = error?.code?.startsWith("STATUS_") ? error.code : null;
  const message =
    error?.code === "LOCKED_OUT"
      ? t("lock.wait", lang, { min: Math.floor(wait / 60), sec: String(wait % 60).padStart(2, "0") })
      : alphaError(error, lang);
  return ah(
    "main",
    { className: "alpha-screen alpha-auth", "data-testid": "Login screen" },
    ah("div", { className: "alpha-auth-top" }, ah(ALanguageSwitch, { lang, onLang })),
    ah(ABrand, { lang }),
    offline ? ah(AOfflineBanner, { lang, onRetry }) : null,
    approvedNotice ? ah(ANotice, { kind: "ok", testId: "Approved notice" }, t("login.approvedNotice", lang)) : null,
    ah(
      "form",
      {
        className: "alpha-card lq-glass alpha-form",
        noValidate: true,
        method: "post",
        action: "#",
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah("h2", null, t("login.title", lang)),
      ah("p", { className: "alpha-hint" }, t(withPassword ? "login.introPassword" : "login.intro", lang)),
      ah(
        AField,
        { label: t("field.mobile", lang), invalid: error?.field === "mobile" },
        ah("input", {
          value: mobile,
          name: "username",
          type: "tel",
          inputMode: "numeric",
          autoComplete: withPassword ? "username" : "tel-national",
          maxLength: 10,
          "data-testid": "Login mobile",
          "aria-invalid": error?.field === "mobile" ? "true" : undefined,
          onChange: (e) => {
            setMobile(digitsOnly(e.target.value));
            if (error?.field === "mobile") setError(null);
          },
        }),
      ),
      withPassword
        ? ah(
            AField,
            { label: t("field.password", lang), invalid: error?.field === "secret" },
            ah(ASecretInput, {
              value: secret,
              onChange: (v) => {
                setSecret(v);
                if (error?.field === "secret") setError(null);
              },
              mode: "password",
              lang,
              name: "password",
              autoComplete: "current-password",
              label: t("field.password", lang),
              invalid: error?.field === "secret",
              testId: "Login secret",
              autoFocus: true,
              onEnter: submit,
            }),
          )
        : null,
      message ? ah(ANotice, { kind: "error", testId: "Login error" }, message) : null,
      ah(
        AButton,
        { kind: "primary", type: "submit", disabled: busy || wait > 0, "data-testid": "Login submit" },
        busy ? t("common.wait", lang) : t("login.submit", lang),
      ),
      ah(
        "div",
        { className: "alpha-links" },
        ah(
          AButton,
          {
            kind: "text",
            "data-testid": "Toggle password mode",
            onClick: () => {
              setWithPassword(!withPassword);
              setSecret("");
              setError(null);
            },
          },
          t(withPassword ? "login.useMobile" : "login.usePassword", lang),
        ),
      ),
    ),
    ah(
      "div",
      { className: "alpha-auth-footer" },
      ah(AButton, { onClick: onRegister, "data-testid": "Go to register" }, ah(AIcon, { name: "user-plus" }), " ", t("login.register", lang)),
      ah(AButton, { kind: "text", onClick: onAdmins, "data-testid": "Contact admins" }, ah(AIcon, { name: "users-three" }), " ", t("login.allAdmins", lang)),
    ),
  );
}

// The Main Admin's first-time password works for ONE login only: this screen
// then asks for his own new password (new + re-enter, at least 4 characters).
export function ASetPinScreen({ lang, onLang, api, onDone, onSignOut, account }) {
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (busy) return;
    if (pin.length < 4) return setError({ code: "PASSWORD_FORMAT", field: "next" });
    if (confirm !== pin) return setError({ code: "PASSWORD_MISMATCH", field: "confirm" });
    setBusy(true);
    setError(null);
    try {
      const data = await api("password/set", { next: pin, confirm });
      onDone(data, pin);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  return ah(
    "main",
    { className: "alpha-screen alpha-auth", "data-testid": "Set PIN screen" },
    ah("div", { className: "alpha-auth-top" }, ah(ALanguageSwitch, { lang, onLang })),
    ah(ABrand, { lang }),
    ah(
      "form",
      {
        className: "alpha-card lq-glass alpha-form",
        noValidate: true,
        method: "post",
        action: "#",
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah("h2", null, t("setpw.title", lang)),
      account ? ah("p", { className: "alpha-hint" }, (lang === "en" ? account.name : account.nameGu || account.name) + " · " + formatMobile(account.phone)) : null,
      // The account name lets Google Password Manager save the new password.
      ah("input", { type: "text", name: "username", autoComplete: "username", value: account?.phone || "", readOnly: true, tabIndex: -1, className: "alpha-sr-only", "aria-hidden": true }),
      ah("p", { className: "alpha-hint" }, t("setpw.intro", lang)),
      ah(
        AField,
        { label: t("field.newPassword", lang), invalid: error?.field === "next", hint: t("field.passwordHint", lang) },
        ah(ASecretInput, { value: pin, mode: "password", name: "new-password", autoComplete: "new-password", onChange: (v) => { setPin(v); setError(null); }, lang, label: t("field.newPassword", lang), invalid: error?.field === "next", testId: "Set PIN new", autoFocus: true }),
      ),
      ah(
        AField,
        { label: t("field.newPassword2", lang), invalid: error?.field === "confirm" },
        ah(ASecretInput, { value: confirm, mode: "password", name: "confirm-password", autoComplete: "new-password", onChange: (v) => { setConfirm(v); setError(null); }, lang, label: t("field.newPassword2", lang), invalid: error?.field === "confirm", testId: "Set PIN confirm", onEnter: submit }),
      ),
      error ? ah(ANotice, { kind: "error", testId: "Set PIN error" }, alphaError(error, lang)) : null,
      ah(AButton, { kind: "primary", type: "submit", disabled: busy, "data-testid": "Set PIN submit" }, busy ? t("common.wait", lang) : t("setpw.submit", lang)),
      ah(AButton, { kind: "text", onClick: onSignOut, "data-testid": "Set PIN sign out" }, t("setpin.signout", lang)),
    ),
  );
}

// The lock screen exists only for people who turned on the optional PIN lock
// in My Profile. "Forgot PIN?" signs out of this phone; logging in again with
// the mobile number removes the lock — no administrator is involved.
export function ALockScreen({ lang, onLang, account, offline, unlock, onBiometric, biometricAvailable, onForgot }) {
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async (value = secret) => {
    if (busy) return;
    if (!/^\d{4}$/.test(value)) return setError({ code: "PIN_FORMAT" });
    setBusy(true);
    setError(null);
    try {
      await unlock(value);
      setSecret("");
    } catch (e) {
      setSecret("");
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), left: e.left, until: e.until, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const message =
    error?.code === "LOCKED_OUT"
      ? t("lock.wait", lang, { min: Math.floor(wait / 60), sec: String(wait % 60).padStart(2, "0") })
      : alphaError(error, lang);
  return ah(
    "main",
    { className: "alpha-screen alpha-auth", "data-testid": "Lock screen" },
    ah("div", { className: "alpha-auth-top" }, ah(ALanguageSwitch, { lang, onLang })),
    ah(ABrand, { lang }),
    ah(
      "form",
      {
        className: "alpha-card lq-glass alpha-form",
        noValidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah("h2", null, ah(AIcon, { name: "lock-key" }), " ", t("lock.title", lang)),
      account ? ah("p", { className: "alpha-hint" }, (lang === "en" ? account.name : account.nameGu || account.name) + " · " + formatMobile(account.phone)) : null,
      offline ? ah(ANotice, { kind: "info" }, t("lock.offline", lang)) : null,
      ah(
        AField,
        { label: t("lock.enterPin", lang), invalid: !!error },
        ah(ASecretInput, {
          value: secret,
          mode: "pin",
          lang,
          label: t("field.pin", lang),
          invalid: !!error,
          testId: "Unlock secret",
          autoFocus: true,
          onEnter: () => submit(),
          onChange: (v) => {
            setSecret(v);
            if (error && error.code !== "LOCKED_OUT") setError(null);
            if (v.length === 4) submit(v);
          },
        }),
      ),
      message ? ah(ANotice, { kind: "error", testId: "Unlock error" }, message) : null,
      ah(AButton, { kind: "primary", type: "submit", disabled: busy || wait > 0, "data-testid": "Unlock submit" }, busy ? t("common.wait", lang) : t("lock.unlock", lang)),
      biometricAvailable
        ? ah(AButton, { onClick: onBiometric, disabled: busy || wait > 0, "data-testid": "Unlock fingerprint" }, ah(AIcon, { name: "fingerprint" }), " ", t("lock.fingerprint", lang))
        : null,
      ah(AButton, { kind: "text", onClick: onForgot, "data-testid": "Lock forgot" }, t("lock.forgot", lang)),
    ),
  );
}

// Re-opening the admin tools after "Log out" from admin mode. Only the Main
// Admin is asked (his password); a Village Admin opens the tools directly.
export function AAdminEnterDialog({ lang, api, onDone, onClose }) {
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const submit = async () => {
    if (busy) return;
    if (!secret) return setError({ code: "WRONG_PASSWORD" });
    setBusy(true);
    setError(null);
    try {
      const data = await api("admin/enter", { secret });
      onDone(data);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), left: e.left, until: e.until, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const message =
    error?.code === "LOCKED_OUT"
      ? t("lock.wait", lang, { min: Math.floor(wait / 60), sec: String(wait % 60).padStart(2, "0") })
      : alphaError(error, lang);
  return ah(
    ASheet,
    { title: t("nav.adminEnterTitle", lang), onClose, closeLabel: t("common.close", lang), testId: "Admin enter dialog" },
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
      ah("p", { className: "alpha-sheet-body" }, t("nav.adminEnterPassword", lang)),
      ah(
        AField,
        { label: t("field.password", lang), invalid: !!error },
        ah(ASecretInput, { value: secret, onChange: (v) => { setSecret(v); setError(null); }, mode: "password", name: "password", autoComplete: "current-password", lang, label: t("field.password", lang), testId: "Admin enter secret", autoFocus: true, onEnter: submit }),
      ),
      message ? ah(ANotice, { kind: "error" }, message) : null,
      ah(
        "div",
        { className: "alpha-actions" },
        ah(AButton, { kind: "primary", type: "submit", disabled: busy || wait > 0, "data-testid": "Admin enter submit" }, t("nav.open", lang)),
        ah(AButton, { onClick: onClose }, t("common.cancel", lang)),
      ),
    ),
  );
}

// Section 1: app-wide "No internet / Server not reachable — Retry".
export function AOfflineBanner({ lang, onRetry, lastUpdated }) {
  return ah(
    "button",
    { type: "button", className: "alpha-offline lq-glass", role: "alert", onClick: onRetry, "data-testid": "Offline banner" },
    ah(AIcon, { name: "wifi-slash" }),
    ah(
      "span",
      null,
      ah("strong", null, t("offline.banner", lang)),
      lastUpdated
        ? ah(
            "small",
            { "data-testid": "Last updated" },
            t("offline.lastUpdated", lang, {
              time: new Date(lastUpdated).toLocaleString(lang === "gu" ? "gu-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" }),
            }),
          )
        : null,
    ),
  );
}
