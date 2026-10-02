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
          { kind: "text", className: "alpha-reset-button", onClick: () => p.onFs(100), disabled: p.fsPct === 100, "data-testid": "Settings text size reset" },
          ah(AIcon, { name: "arrow-counter-clockwise" }),
          " ",
          t("settings.textReset", lang),
        ),
      ),
      p.notificationPanel
        ? ah(
            "section",
            { className: "alpha-section" },
            ah("h2", { className: "settings-label" }, t("settings.notifications", lang)),
            ah("div", { className: "alpha-card lq-glass alpha-notif-card" }, p.notificationPanel),
          )
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
  const other = lang === "en" ? "gu" : "en";
  const nameIn = (l) => (l === "en" ? m.name : m.nameGu || m.name) || "";
  const name = nameIn(lang);
  const second = nameIn(other);
  const label = (key) => ah("small", { className: "alpha-md-label" }, t(key, lang), ah("span", null, " • " + t(key, other)));
  const item = (icon, cls, key, value, sub, testId) =>
    ah(
      "div",
      { className: "alpha-md-item", "data-testid": testId },
      ah("span", { className: "alpha-md-ico " + cls }, ah(AIcon, { name: icon })),
      ah("span", { className: "alpha-md-text" }, label(key), ah("strong", null, value), sub ? ah("small", { className: "alpha-md-sub" }, sub) : null),
    );
  const vOther = villageName(m.village, other);
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": main ? "Main Admin profile" : "Profile screen" },
    ah(ATopBar, { title: t("profile.title", lang), onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll alpha-md-scope" },
      // Same sun-crowned card as Member Details, so the two pages match.
      ah(
        "article",
        { className: "alpha-md-card alpha-profile-card" },
        ah("img", { src: "/brand/sun-logo-192.png", alt: "", className: "alpha-md-watermark", "aria-hidden": true }),
        ah(
          "div",
          { className: "alpha-md-hero" },
          ah("span", { className: "alpha-md-avatar", "aria-hidden": true }, ah("span", null, name.trim().charAt(0) || "?")),
          ah("h3", { className: "alpha-md-name" }, name),
          second && second !== name ? ah("p", { className: "alpha-md-name2" }, second) : null,
          ah(
            "span",
            { className: "alpha-md-role role-" + String(account.role || "MEMBER").toLowerCase() },
            ah(AIcon, { name: account.role === "MEMBER" ? "user" : "shield-check" }),
            " " + t("role." + account.role, lang) + " • " + t("role." + account.role, other),
          ),
        ),
        ah(
          "section",
          { className: "alpha-md-box" },
          item("device-mobile", "phone", "dir.primaryPhone", "+91 " + formatMobile(m.phone), null, "Profile mobile"),
          m.phone2 ? item(m.label2 === "other" ? "phone" : "briefcase", "phone", m.label2 === "other" ? "dir.other" : "dir.work", "+91 " + formatMobile(m.phone2)) : null,
        ),
        ah(
          "section",
          { className: "alpha-md-box" },
          item(
            "house-line",
            "place",
            "dir.nativeVillage",
            villageName(m.village, lang) + (vOther !== villageName(m.village, lang) ? " (" + vOther + ")" : ""),
            t("dir.talukaDistrict", lang, { taluka: lang === "en" ? "Mahuva" : "મહુવા", district: lang === "en" ? "Bhavnagar" : "ભાવનગર" }),
            "Profile village",
          ),
          item("map-pin", "home", "dir.currentResidence", m.currentLocation || "—"),
        ),
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
        ASection,
        { title: t("profile.actions", lang) },
        main ? ah(AMenuItem, { icon: "password", label: t("profile.changePassword", lang), onClick: onChangePassword, testId: "Profile change password" }) : null,
        ah(AMenuItem, { icon: "gear-six", label: t("settings.title", lang), onClick: onSettings, testId: "Profile settings" }),
        main ? null : ah(AMenuItem, { icon: "pencil-simple", label: t("profile.requestChange", lang), onClick: onRequestChange, testId: "Profile request change" }),
        main ? null : ah(AMenuItem, { icon: "user-minus", label: t("profile.requestRemoval", lang), onClick: onRequestRemoval, testId: "Profile request removal", danger: true }),
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
