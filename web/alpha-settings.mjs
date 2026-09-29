// Settings (opened from the profile icon), My Profile (Section 2 Main Admin
// profile page too) and the profile-change form (Section 7 navigation rules:
// Save returns to the list, Back with unsaved changes asks "Discard changes?").

function ASection({ title, children }) {
  return ah("section", { className: "alpha-section" }, ah("h2", { className: "settings-label" }, title), ah("div", { className: "alpha-card lq-glass alpha-menu" }, children));
}
function AMenuItem({ icon, label, detail, onClick, testId, danger }) {
  return ah(
    "button",
    { type: "button", className: "alpha-menu-item" + (danger ? " danger" : ""), onClick, "data-testid": testId || label },
    ah(AIcon, { name: icon }),
    ah("span", null, label, detail ? ah("small", null, detail) : null),
    ah(AIcon, { name: "caret-right", className: "alpha-caret" }),
  );
}
function ASwitch({ label, help, on, onToggle, disabled, testId, note }) {
  return ah(
    "div",
    { className: "alpha-switch-row" },
    ah(
      "button",
      { type: "button", role: "switch", "aria-checked": !!on, disabled, onClick: onToggle, "data-testid": testId, className: "alpha-switch" },
      ah("span", { className: "alpha-switch-text" }, label, note ? ah("small", null, note) : null),
      ah("span", { className: "switch-track", "aria-hidden": true }, ah("span", null)),
    ),
    help ? ah("p", { className: "alpha-hint" }, help) : null,
  );
}

export function ASettingsScreen(p) {
  const { lang, account } = p;
  const main = account?.role === "MAIN_ADMIN";
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": "Settings screen" },
    ah(ATopBar, { title: t("settings.title", lang), onBack: p.onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll" },
      ah(
        ASection,
        { title: t("settings.account", lang) },
        ah(AMenuItem, {
          icon: "identification-card",
          label: t("profile.title", lang),
          detail: (lang === "en" ? account.name : account.nameGu || account.name) + " · " + t("role." + account.role, lang),
          onClick: p.onProfile,
          testId: "Settings my profile",
        }),
        main
          ? null
          : ah(AMenuItem, { icon: "pencil-simple", label: t("profile.requestChange", lang), detail: p.pendingChange ? t("profile.pendingChange", lang) : "", onClick: p.onRequestChange, testId: "Settings request change" }),
        main
          ? null
          : ah(AMenuItem, { icon: "user-minus", label: t("profile.requestRemoval", lang), detail: p.pendingRemoval ? t("profile.pendingRemoval", lang) : "", onClick: p.onRequestRemoval, testId: "Settings request removal" }),
      ),
      ah(
        ASection,
        { title: t("settings.display", lang) },
        ah(
          "label",
          { className: "alpha-range" },
          ah("span", null, t("settings.textSize", lang), ah("output", null, p.fsPct + "%")),
          ah("input", { type: "range", min: 85, max: 165, step: 5, value: p.fsPct, onChange: (e) => p.onFs(Number(e.target.value)), "aria-label": t("settings.textSize", lang), "data-testid": "Settings text size" }),
        ),
        ah(
          AButton,
          { onClick: () => p.onFs(100), disabled: p.fsPct === 100, "data-testid": "Settings text size reset" },
          ah(AIcon, { name: "arrow-counter-clockwise" }),
          " ",
          t("settings.textReset", lang),
        ),
      ),
      p.notificationPanel
        ? ah("section", { className: "alpha-section" }, ah("h2", { className: "settings-label" }, t("settings.notifications", lang)), p.notificationPanel)
        : null,
      ah(
        ASection,
        { title: t("settings.admins", lang) },
        ah(AMenuItem, { icon: "users-three", label: t("settings.admins", lang), onClick: p.onAdmins, testId: "Settings all admins" }),
      ),
      ah(
        "div",
        { className: "alpha-actions alpha-actions-column" },
        ah(AButton, { kind: "danger", onClick: p.onSignOut, "data-testid": "Sign out of this phone" }, ah(AIcon, { name: "sign-out" }), " ", t("settings.signout", lang)),
      ),
      p.version ? ah("p", { className: "alpha-version" }, t("settings.version", lang) + " " + p.version) : null,
    ),
  );
}

export function AProfileScreen({ lang, account, member, onBack, onChangePassword, onSettings, onRequestChange, onRequestRemoval, pendingChange, pendingRemoval, offline, onToggleLock, onChangeLockPin, biometricAvailable, onToggleBiometric }) {
  const main = account.role === "MAIN_ADMIN";
  const m = member || account;
  const rows = [
    [t("field.name", lang), lang === "en" ? m.name : m.nameGu || m.name],
    [t("field.mobile", lang), "+91 " + formatMobile(m.phone)],
    ...(m.phone2 ? [[t("field.phone2", lang), "+91 " + formatMobile(m.phone2)]] : []),
    [t("field.village", lang), villageName(m.village, lang)],
    [t("field.taluka", lang), lang === "en" ? "Mahuva" : "મહુવા"],
    [t("field.district", lang), lang === "en" ? "Bhavnagar" : "ભાવનગર"],
    [t("field.location", lang), m.currentLocation || "—"],
    [t("profile.role", lang), t("role." + account.role, lang)],
  ];
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": main ? "Main Admin profile" : "Profile screen" },
    ah(ATopBar, { title: t("profile.title", lang), onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll" },
      ah(
        "section",
        { className: "alpha-card lq-glass" },
        ah("dl", { className: "alpha-details alpha-profile-details" }, ...rows.flatMap(([k, v]) => [ah("dt", { key: k + "t" }, k), ah("dd", { key: k + "d" }, v)])),
      ),
      pendingChange ? ah(ANotice, { kind: "info" }, t("profile.pendingChange", lang)) : null,
      pendingRemoval ? ah(ANotice, { kind: "info" }, t("profile.pendingRemoval", lang)) : null,
      main ? ah("p", { className: "alpha-hint" }, t("profile.mainAdminNote", lang)) : null,
      ah(
        ASection,
        { title: t("profile.lockSection", lang) },
        ah(ASwitch, {
          label: t("lock.toggle", lang),
          help: t("lock.toggleHelp", lang),
          on: account.lockOn,
          disabled: offline,
          onToggle: onToggleLock,
          testId: "Profile PIN lock",
        }),
        account.lockOn ? ah(AMenuItem, { icon: "password", label: t("lock.change", lang), onClick: onChangeLockPin, testId: "Profile change lock PIN" }) : null,
        biometricAvailable && account.lockOn
          ? ah(ASwitch, {
              label: t("lock.fingerprint2", lang),
              on: account.biometricOn,
              disabled: offline,
              onToggle: onToggleBiometric,
              testId: "Profile fingerprint",
            })
          : null,
      ),
      ah(
        "div",
        { className: "alpha-actions alpha-actions-column" },
        main
          ? ah(
              AButton,
              { kind: "primary", onClick: onChangePassword, "data-testid": "Profile change password" },
              ah(AIcon, { name: "password" }),
              " ",
              t("profile.changePassword", lang),
            )
          : null,
        ah(AButton, { onClick: onSettings, "data-testid": "Profile settings" }, ah(AIcon, { name: "gear" }), " ", t("settings.title", lang)),
        main ? null : ah(AButton, { onClick: onRequestChange, "data-testid": "Profile request change" }, t("profile.requestChange", lang)),
        main ? null : ah(AButton, { kind: "danger", onClick: onRequestRemoval, "data-testid": "Profile request removal" }, t("profile.requestRemoval", lang)),
      ),
    ),
  );
}

// Profile change form: a member's request, or the Main Admin editing a member
// directly. The parent is told whether there are unsaved changes so the phone's
// Back button can ask "Discard changes?".
export function AEditProfileScreen({ lang, villages, member, adminEdit, api, onBack, onSaved, onDirtyChange }) {
  const initial = React.useMemo(
    () => ({
      firstName: member.firstName || "",
      middleName: member.middleName || "",
      surname: member.surname || "",
      phone: member.phone || "",
      phone2: member.phone2 || "",
      label2: member.label2 || "work",
      village: member.village || "",
      currentLocation: member.currentLocation || "",
    }),
    [member.id],
  );
  const [form, setForm] = React.useState(initial);
  const [errors, setErrors] = React.useState({});
  const [serverError, setServerError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty]);
  React.useEffect(() => () => onDirtyChange?.(false), []);
  const set = (key, clean = (v) => v) => (e) => {
    const value = clean(e.target.value);
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((x) => ({ ...x, [key === "firstName" || key === "surname" ? "name" : key]: undefined }));
    setServerError(null);
  };
  const save = async () => {
    if (busy) return;
    const e = registrationErrors(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setServerError(null);
    try {
      const payload = { ...form, nameGu: member.nameGu && member.nameGu !== member.name ? member.nameGu : undefined };
      const data = await api(adminEdit ? "admin/members/" + member.id : "profile/update", payload);
      onDirtyChange?.(false);
      onSaved(data);
    } catch (err) {
      setServerError({ code: err.code || (err.network ? "NETWORK" : undefined), message: err.message, network: err.network });
    } finally {
      setBusy(false);
    }
  };
  const err = (key) => (errors[key] ? t("err." + errors[key], lang) : "");
  const input = (key, opts = {}) =>
    ah("input", {
      value: form[key],
      "data-testid": "Edit " + key,
      onChange: set(key, opts.clean),
      maxLength: opts.maxLength || 60,
      inputMode: opts.inputMode,
      autoComplete: "off",
    });
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": adminEdit ? "Admin edit member" : "Edit profile screen" },
    ah(ATopBar, { title: t(adminEdit ? "edit.adminTitle" : "edit.title", lang), subtitle: adminEdit ? (lang === "en" ? member.name : member.nameGu || member.name) : "", onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll" },
      ah(ANotice, { kind: "info" }, t(adminEdit ? "edit.adminNotice" : "edit.notice", lang)),
      ah(
        "form",
        {
          className: "alpha-card lq-glass alpha-form",
          noValidate: true,
          onSubmit: (e) => {
            e.preventDefault();
            save();
          },
        },
        ah(AField, { label: t("field.firstName", lang), invalid: !!errors.name }, input("firstName")),
        ah(AField, { label: t("field.middleName", lang) + " (" + t("common.optional", lang) + ")" }, input("middleName")),
        ah(AField, { label: t("field.surname", lang), invalid: !!errors.name, error: err("name") }, input("surname")),
        ah(AField, { label: t("field.mobile", lang), invalid: !!errors.phone, error: err("phone") }, input("phone", { clean: (v) => digitsOnly(v), maxLength: 10, inputMode: "numeric" })),
        ah(AField, { label: t("field.phone2", lang) + " (" + t("common.optional", lang) + ")", invalid: !!errors.phone2, error: err("phone2") }, input("phone2", { clean: (v) => digitsOnly(v), maxLength: 10, inputMode: "numeric" })),
        ah(
          AField,
          { label: t("field.village", lang), invalid: !!errors.village, error: err("village") },
          ah(
            "select",
            { value: form.village, onChange: set("village"), "data-testid": "Edit village", disabled: adminEdit },
            ...(villages || []).map((v) => ah("option", { key: v.gu, value: v.gu }, lang === "en" ? v.en : v.gu)),
          ),
        ),
        ah(AField, { label: t("field.location", lang) + " (" + t("common.optional", lang) + ")" }, input("currentLocation", { maxLength: 240 })),
        serverError ? ah(ANotice, { kind: "error", testId: "Edit error" }, alphaError(serverError, lang)) : null,
        ah(
          "div",
          { className: "alpha-actions" },
          ah(AButton, { kind: "primary", type: "submit", disabled: busy || !dirty, "data-testid": "Edit save" }, busy ? t("common.wait", lang) : t(adminEdit ? "common.save" : "edit.send", lang)),
          ah(AButton, { onClick: onBack, "data-testid": "Edit cancel" }, t("common.cancel", lang)),
        ),
      ),
    ),
  );
}
