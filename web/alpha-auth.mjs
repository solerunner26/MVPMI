// Login (Section 2), Forgot PIN (Section 4), first-login "Set new PIN" and the
// app lock (Section 5), and re-opening the admin tools (Section 7).

function ABrand({ lang }) {
  return ah(
    "div",
    { className: "alpha-brand" },
    ah("img", { src: "/brand/icon-192.png", alt: "", width: 72, height: 72, className: "alpha-brand-mark" }),
    ah("p", { className: "alpha-brand-community" }, t("app.community", lang)),
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

export function ALoginScreen({ lang, onLang, api, onLoggedIn, onRegister, onAdmins, approvedNotice, offline, onRetry, initialMobile = "" }) {
  const [mobile, setMobile] = React.useState(initialMobile);
  const [secret, setSecret] = React.useState("");
  const [mode, setMode] = React.useState("pin");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [forgot, setForgot] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const submit = async () => {
    if (busy) return;
    if (!validMobile(mobile)) return setError({ code: "MOBILE_FORMAT", field: "mobile" });
    if (mode === "pin" && !/^\d{4}$/.test(secret)) return setError({ code: "PIN_FORMAT", field: "secret" });
    if (mode === "password" && !secret) return setError({ code: "WRONG_PASSWORD", field: "secret" });
    setBusy(true);
    setError(null);
    try {
      const data = await api("login", { mobile, secret });
      setSecret("");
      onLoggedIn(data, secret);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, left: e.left, until: e.until, message: e.message, network: e.network });
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
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah("h2", null, t("login.title", lang)),
      ah("p", { className: "alpha-hint" }, t(mode === "pin" ? "login.intro" : "login.introPassword", lang)),
      ah(
        AField,
        { label: t("field.mobile", lang), invalid: error?.field === "mobile" },
        ah("input", {
          value: mobile,
          inputMode: "numeric",
          autoComplete: "tel-national",
          maxLength: 10,
          "data-testid": "Login mobile",
          "aria-invalid": error?.field === "mobile" ? "true" : undefined,
          onChange: (e) => {
            setMobile(digitsOnly(e.target.value));
            if (error?.field === "mobile") setError(null);
          },
        }),
      ),
      ah(
        AField,
        { label: t(mode === "pin" ? "field.pin" : "field.password", lang), invalid: error?.field === "secret" },
        ah(ASecretInput, {
          value: secret,
          onChange: (v) => {
            setSecret(v);
            if (error?.field === "secret") setError(null);
          },
          mode,
          lang,
          label: t(mode === "pin" ? "field.pin" : "field.password", lang),
          invalid: error?.field === "secret",
          testId: "Login secret",
          onEnter: submit,
        }),
      ),
      message
        ? ah(
            ANotice,
            { kind: "error", testId: "Login error" },
            message,
            status === "STATUS_APPROVED" ? null : null,
          )
        : null,
      ah(
        AButton,
        { kind: "primary", type: "submit", disabled: busy || (wait > 0), "data-testid": "Login submit" },
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
              setMode(mode === "pin" ? "password" : "pin");
              setSecret("");
              setError(null);
            },
          },
          t(mode === "pin" ? "login.usePassword" : "login.usePin", lang),
        ),
        mode === "pin"
          ? ah(AButton, { kind: "text", onClick: () => setForgot(true), "data-testid": "Forgot PIN" }, t("login.forgot", lang))
          : null,
      ),
    ),
    ah(
      "div",
      { className: "alpha-auth-footer" },
      ah(AButton, { onClick: onRegister, "data-testid": "Go to register" }, ah(AIcon, { name: "user-plus" }), " ", t("login.register", lang)),
      ah(AButton, { kind: "text", onClick: onAdmins, "data-testid": "Contact admins" }, ah(AIcon, { name: "users-three" }), " ", t("login.allAdmins", lang)),
    ),
    forgot ? ah(AForgotPinDialog, { lang, api, initialMobile: mobile, onClose: () => setForgot(false) }) : null,
  );
}

// Section 4: "Forgot PIN?" never resets a PIN by itself; it asks the village
// admin, who creates a TEMP PIN and shares it on WhatsApp.
export function AForgotPinDialog({ lang, api, initialMobile = "", onClose }) {
  const [mobile, setMobile] = React.useState(initialMobile);
  const [error, setError] = React.useState(null);
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const send = async () => {
    if (!validMobile(mobile)) return setError({ code: "MOBILE_FORMAT", field: "mobile" });
    setBusy(true);
    setError(null);
    try {
      await api("pin/forgot", { mobile });
      setSent(true);
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  return ah(
    ASheet,
    { title: t("forgot.title", lang), onClose, closeLabel: t("common.close", lang), testId: "Forgot PIN dialog" },
    sent
      ? ah(
          React.Fragment,
          null,
          ah(ANotice, { kind: "ok", testId: "Forgot sent" }, t("forgot.sent", lang)),
          ah("div", { className: "alpha-actions" }, ah(AButton, { kind: "primary", onClick: onClose, "data-testid": "Forgot done" }, t("common.done", lang))),
        )
      : ah(
          "form",
          {
            className: "alpha-form",
            noValidate: true,
            onSubmit: (e) => {
              e.preventDefault();
              send();
            },
          },
          ah("p", { className: "alpha-sheet-body" }, t("forgot.intro", lang)),
          ah(
            AField,
            { label: t("field.mobile", lang), invalid: !!error },
            ah("input", {
              value: mobile,
              inputMode: "numeric",
              maxLength: 10,
              "data-testid": "Forgot mobile",
              onChange: (e) => setMobile(digitsOnly(e.target.value)),
            }),
          ),
          error ? ah(ANotice, { kind: "error" }, alphaError(error, lang)) : null,
          ah(
            "div",
            { className: "alpha-actions" },
            ah(AButton, { kind: "primary", type: "submit", disabled: busy, "data-testid": "Forgot send" }, t("forgot.send", lang)),
            ah(AButton, { onClick: onClose }, t("common.cancel", lang)),
          ),
        ),
  );
}

// Section 5: after logging in with a TEMP PIN nothing else is possible until
// the person sets their own PIN.
// The Main Admin's first-time password works for ONE login only: this same
// screen then asks for his own new password (new + re-enter).
export function ASetPinScreen({ lang, onLang, api, onDone, onSignOut, account }) {
  const password = account?.role === "MAIN_ADMIN";
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (busy) return;
    if (password) {
      if (pin.length < 8) return setError({ code: "PASSWORD_FORMAT", field: "next" });
      if (confirm !== pin) return setError({ code: "PASSWORD_MISMATCH", field: "confirm" });
    } else {
      if (!/^\d{4}$/.test(pin)) return setError({ code: "PIN_FORMAT", field: "next" });
      if (ALPHA_WEAK_PINS.includes(pin)) return setError({ code: "PIN_WEAK", field: "next" });
      if (confirm !== pin) return setError({ code: "PIN_MISMATCH", field: "confirm" });
    }
    setBusy(true);
    setError(null);
    try {
      const data = password ? await api("password/set", { next: pin, confirm }) : await api("pin/set", { pin, confirm });
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
        onSubmit: (e) => {
          e.preventDefault();
          submit();
        },
      },
      ah("h2", null, t(password ? "setpw.title" : "setpin.title", lang)),
      account ? ah("p", { className: "alpha-hint" }, (lang === "en" ? account.name : account.nameGu || account.name) + " · " + formatMobile(account.phone)) : null,
      ah("p", { className: "alpha-hint" }, t(password ? "setpw.intro" : "setpin.intro", lang)),
      ah(
        AField,
        { label: t(password ? "field.newPassword" : "field.newPin", lang), invalid: error?.field === "next", hint: t(password ? "field.passwordHint" : "field.pinHint", lang) },
        ah(ASecretInput, { value: pin, mode: password ? "password" : "pin", onChange: (v) => { setPin(v); setError(null); }, lang, label: t(password ? "field.newPassword" : "field.newPin", lang), invalid: error?.field === "next", testId: "Set PIN new", autoFocus: true }),
      ),
      ah(
        AField,
        { label: t(password ? "field.newPassword2" : "field.newPin2", lang), invalid: error?.field === "confirm" },
        ah(ASecretInput, { value: confirm, mode: password ? "password" : "pin", onChange: (v) => { setConfirm(v); setError(null); }, lang, label: t(password ? "field.newPassword2" : "field.newPin2", lang), invalid: error?.field === "confirm", testId: "Set PIN confirm", onEnter: submit }),
      ),
      error ? ah(ANotice, { kind: "error", testId: "Set PIN error" }, alphaError(error, lang)) : null,
      ah(AButton, { kind: "primary", type: "submit", disabled: busy, "data-testid": "Set PIN submit" }, busy ? t("common.wait", lang) : t(password ? "setpw.submit" : "setpin.submit", lang)),
      ah(AButton, { kind: "text", onClick: onSignOut, "data-testid": "Set PIN sign out" }, t("setpin.signout", lang)),
    ),
  );
}

// Section 5: the lock screen. The same PIN as the login (the Main Admin uses
// the PASSWORD). Works offline with the verifier saved on this phone.
export function ALockScreen({ lang, onLang, account, offline, unlock, onBiometric, biometricAvailable, onForgot }) {
  const password = account?.role === "MAIN_ADMIN";
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const submit = async (value = secret) => {
    if (busy || wait > 0) return;
    if (!password && !/^\d{4}$/.test(value)) return setError({ code: "PIN_FORMAT" });
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
        { label: t(password ? "lock.enterPassword" : "lock.enterPin", lang), invalid: !!error },
        ah(ASecretInput, {
          value: secret,
          mode: password ? "password" : "pin",
          lang,
          label: t(password ? "field.password" : "field.pin", lang),
          invalid: !!error,
          testId: "Unlock secret",
          autoFocus: true,
          onEnter: () => submit(),
          onChange: (v) => {
            setSecret(v);
            if (error && error.code !== "LOCKED_OUT") setError(null);
            if (!password && v.length === 4) submit(v);
          },
        }),
      ),
      message ? ah(ANotice, { kind: "error", testId: "Unlock error" }, message) : null,
      ah(AButton, { kind: "primary", type: "submit", disabled: busy || wait > 0, "data-testid": "Unlock submit" }, busy ? t("common.wait", lang) : t("lock.unlock", lang)),
      biometricAvailable
        ? ah(AButton, { onClick: onBiometric, disabled: busy || wait > 0, "data-testid": "Unlock fingerprint" }, ah(AIcon, { name: "fingerprint" }), " ", t("lock.fingerprint", lang))
        : null,
      password ? null : ah(AButton, { kind: "text", onClick: onForgot, "data-testid": "Lock forgot" }, t("lock.forgot", lang)),
    ),
  );
}

// Section 7: re-opening the admin tools after "Log out" from admin mode.
export function AAdminEnterDialog({ lang, account, api, onDone, onClose }) {
  const password = account?.role === "MAIN_ADMIN";
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const wait = useCountdown(error?.code === "LOCKED_OUT" ? error.until : 0);
  const submit = async () => {
    if (busy) return;
    if (!password && !/^\d{4}$/.test(secret)) return setError({ code: "PIN_FORMAT" });
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
      ah("p", { className: "alpha-sheet-body" }, t(password ? "nav.adminEnterPassword" : "nav.adminEnterPin", lang)),
      ah(
        AField,
        { label: t(password ? "field.password" : "field.pin", lang), invalid: !!error },
        ah(ASecretInput, { value: secret, onChange: (v) => { setSecret(v); setError(null); }, mode: password ? "password" : "pin", lang, label: t(password ? "field.password" : "field.pin", lang), testId: "Admin enter secret", autoFocus: true, onEnter: submit }),
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
