// Section 4: registration (with the server's number check and the consent
// checkbox) and the "Pending approval" screen. No path from here leads to the
// directory: only an approved login does.

const emptyRegistration = () => ({
  firstName: "",
  middleName: "",
  surname: "",
  phone: "",
  phone2: "",
  label2: "work",
  village: "",
  currentLocation: "",
});

function registrationErrors(f) {
  const e = {};
  if (String(f.firstName).trim().length < 2 || String(f.surname).trim().length < 2) e.name = "NAME";
  if (!validMobile(f.phone)) e.phone = "MOBILE_FORMAT";
  if (f.phone2 && (!validMobile(f.phone2) || f.phone2 === f.phone)) e.phone2 = "PHONE2";
  if (!f.village) e.village = "VILLAGE";
  return e;
}

export function ARegisterScreen({ lang, onLang, villages, api, initial, editing, onBack, onSubmitted, onGoLogin }) {
  const [form, setForm] = React.useState(() => ({ ...emptyRegistration(), ...(initial || {}) }));
  const [consent, setConsent] = React.useState(!!editing);
  const [showPhone2, setShowPhone2] = React.useState(!!initial?.phone2);
  const [errors, setErrors] = React.useState({});
  const [serverError, setServerError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const set = (key, clean = (v) => v) => (e) => {
    const value = clean(e.target.value);
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((x) => ({ ...x, [key === "firstName" || key === "surname" ? "name" : key]: undefined }));
    setServerError(null);
  };
  const submit = async () => {
    if (busy) return;
    const e = registrationErrors(form);
    if (!consent) e.consent = "CONSENT";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setServerError(null);
    try {
      const data = await api("enrollment", { ...form, phone2: showPhone2 ? form.phone2 : "", consent: true });
      onSubmitted(data);
    } catch (err) {
      setServerError({ code: err.code || (err.network ? "NETWORK" : undefined), field: err.field, message: err.message, network: err.network });
    } finally {
      setBusy(false);
    }
  };
  const err = (key) => (errors[key] ? t("err." + errors[key], lang) : "");
  const input = (key, props = {}) =>
    ah("input", {
      value: form[key],
      "data-testid": "Register " + key,
      "aria-invalid": errors[key] || (key.endsWith("Name") || key === "surname" ? errors.name : null) ? "true" : undefined,
      onChange: set(key, props.clean),
      maxLength: props.maxLength || 60,
      inputMode: props.inputMode,
      autoComplete: "off",
    });
  const status = serverError?.code;
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": "Register screen" },
    ah(ATopBar, { title: t(editing ? "pending.edit" : "reg.title", lang), onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll" },
      ah("p", { className: "alpha-intro" }, t("reg.intro", lang)),
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
        ah(AField, { label: t("field.firstName", lang), invalid: !!errors.name }, input("firstName")),
        ah(AField, { label: t("field.middleName", lang) + " (" + t("common.optional", lang) + ")" }, input("middleName")),
        ah(AField, { label: t("field.surname", lang), invalid: !!errors.name, error: err("name") }, input("surname")),
        ah(
          AField,
          { label: t("field.mobile", lang), invalid: !!errors.phone || serverError?.field === "phone", error: err("phone"), hint: t("field.mobileHint", lang) },
          input("phone", { clean: (v) => digitsOnly(v), maxLength: 10, inputMode: "numeric" }),
        ),
        showPhone2
          ? ah(
              AField,
              { label: t("field.phone2", lang) + " (" + t("common.optional", lang) + ")", invalid: !!errors.phone2, error: err("phone2") },
              input("phone2", { clean: (v) => digitsOnly(v), maxLength: 10, inputMode: "numeric" }),
            )
          : null,
        ah(
          AButton,
          {
            kind: "text",
            "data-testid": showPhone2 ? "Remove second number" : "Add second number",
            onClick: () => {
              setShowPhone2(!showPhone2);
              if (showPhone2) setForm((f) => ({ ...f, phone2: "" }));
            },
          },
          ah(AIcon, { name: showPhone2 ? "minus-circle" : "plus-circle" }),
          " ",
          t(showPhone2 ? "reg.removePhone2" : "reg.addPhone2", lang),
        ),
        ah(
          AField,
          { label: t("field.village", lang), invalid: !!errors.village || serverError?.field === "village", error: err("village") },
          ah(
            "select",
            {
              value: form.village,
              "data-testid": "Register village",
              onChange: set("village"),
            },
            ah("option", { value: "" }, t("field.chooseVillage", lang)),
            ...(villages || []).map((v) =>
              ah(
                "option",
                { key: v.gu, value: v.gu, disabled: v.hasAdmin === false },
                (lang === "en" ? v.en : v.gu) + (v.hasAdmin === false ? " · " + t("field.noAdminYet", lang) : ""),
              ),
            ),
          ),
        ),
        ah(
          AField,
          { label: t("field.location", lang) + " (" + t("common.optional", lang) + ")", hint: t("field.locationHint", lang) },
          input("currentLocation", { maxLength: 240 }),
        ),
        ah(
          "label",
          { className: "alpha-consent", "data-invalid": errors.consent ? "true" : undefined },
          ah("input", {
            type: "checkbox",
            checked: consent,
            "data-testid": "Register consent",
            onChange: (e) => {
              setConsent(e.target.checked);
              setErrors((x) => ({ ...x, consent: undefined }));
            },
          }),
          ah("span", null, t("reg.consent", lang)),
        ),
        errors.consent ? ah(ANotice, { kind: "error", testId: "Consent error" }, t("err.CONSENT", lang)) : null,
        serverError
          ? ah(
              "div",
              { className: "alpha-status-box", "data-testid": "Register status" },
              ah(ANotice, { kind: status === "STATUS_PENDING" ? "info" : "error" }, alphaError(serverError, lang)),
              status === "STATUS_APPROVED"
                ? ah(
                    "div",
                    { className: "alpha-actions" },
                    ah(AButton, { kind: "primary", onClick: () => onGoLogin(form.phone), "data-testid": "Status go to login" }, t("reg.goLogin", lang)),
                  )
                : null,
            )
          : null,
        ah(
          AButton,
          { kind: "primary", type: "submit", disabled: busy, "data-testid": "Register submit" },
          busy ? t("common.wait", lang) : t(editing ? "reg.update" : "reg.submit", lang),
        ),
      ),
    ),
  );
}

export function APendingScreen({ lang, onLang, data, onEdit, onWithdraw, onGoLogin, onAdmins, offline, onRetry }) {
  const approved = !!data.approvedHere;
  const rejected = !data.myRequest && data.lastDecision?.action === "reject";
  const when = data.requestAt
    ? new Date(data.requestAt).toLocaleString(lang === "gu" ? "gu-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
  return ah(
    "main",
    { className: "alpha-screen alpha-auth", "data-testid": "Pending screen" },
    ah("div", { className: "alpha-auth-top" }, ah(ALanguageSwitch, { lang, onLang })),
    ah(ABrand, { lang }),
    offline ? ah(AOfflineBanner, { lang, onRetry }) : null,
    ah(
      "section",
      { className: "alpha-card lq-glass" },
      ah("h2", null, ah(AIcon, { name: approved ? "check-circle" : rejected ? "x-circle" : "hourglass-medium" }), " ", t(approved ? "status.APPROVED" : rejected ? "status.REJECTED" : "pending.title", lang)),
      approved
        ? ah(ANotice, { kind: "ok", testId: "Pending approved" }, t("pending.approved", lang))
        : rejected
          ? ah(
              ANotice,
              { kind: "error", testId: "Pending rejected" },
              t("pending.rejected", lang),
              data.lastDecision.reason ? ah("div", null, t("pending.reason", lang, { reason: data.lastDecision.reason })) : null,
            )
          : ah(
              React.Fragment,
              null,
              ah(ANotice, { kind: "info", testId: "Pending stage" }, t(data.applicationStage === "main" ? "pending.main" : "pending.village", lang)),
              ah("p", { className: "alpha-hint" }, t("pending.noDirectory", lang)),
              when ? ah("p", { className: "alpha-hint" }, t("pending.submitted", lang, { date: when })) : null,
              data.myRequest
                ? ah(
                    "dl",
                    { className: "alpha-details" },
                    ah("dt", null, t("field.name", lang)),
                    ah("dd", null, data.myRequest.name),
                    ah("dt", null, t("field.mobile", lang)),
                    ah("dd", null, formatMobile(data.myRequest.phone)),
                    ah("dt", null, t("field.village", lang)),
                    ah("dd", null, villageName(data.myRequest.village, lang)),
                  )
                : null,
            ),
      ah(
        "div",
        { className: "alpha-actions alpha-actions-column" },
        approved || rejected
          ? ah(AButton, { kind: "primary", onClick: onGoLogin, "data-testid": "Pending go to login" }, t("reg.goLogin", lang))
          : ah(AButton, { onClick: onEdit, "data-testid": "Pending edit" }, ah(AIcon, { name: "pencil-simple" }), " ", t("pending.edit", lang)),
        approved || rejected
          ? null
          : ah(AButton, { kind: "danger", onClick: onWithdraw, "data-testid": "Pending withdraw" }, t("pending.withdraw", lang)),
        ah(AButton, { kind: "text", onClick: onAdmins, "data-testid": "Contact admins" }, ah(AIcon, { name: "users-three" }), " ", t("login.allAdmins", lang)),
        approved || rejected ? null : ah(AButton, { kind: "text", onClick: onGoLogin, "data-testid": "Pending login" }, t("login.title", lang)),
      ),
    ),
  );
}

// Village name in the chosen language.
export function villageName(gu, lang) {
  const v = VILLAGE_LIST.find((x) => x.gu === gu || x.en === gu);
  return v ? (lang === "en" ? v.en : v.gu) : gu || "";
}
