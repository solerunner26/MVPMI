// "Manage Village Admins" (Main Admin): choose a village from the drop-down,
// then create / edit / call / disable its Village Admin. Village Admins log in
// with their mobile number only. Every call returns fresh state; creating one
// opens a hand-over dialog (call or WhatsApp) — see controller.

function AVillageAdminForm({ lang, village, assignment, onSubmit, onClose }) {
  const editing = !!assignment;
  const [name, setName] = React.useState(assignment?.name || "");
  const [mobile, setMobile] = React.useState(assignment?.phone || "");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (busy) return;
    if (name.trim().split(/\s+/).filter((x) => x.length >= 2).length < 2) return setError({ code: "NAME", field: "name" });
    if (!validMobile(mobile)) return setError({ code: "MOBILE_FORMAT", field: "mobile" });
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), mobile });
    } catch (e) {
      setError({ code: e.code || (e.network ? "NETWORK" : undefined), field: e.field, message: e.message, network: e.network });
    } finally {
      setBusy(false);
    }
  };
  const villageLabel = lang === "en" ? village.en : village.gu;
  return ah(
    ASheet,
    { title: t(editing ? "va.formEdit" : "va.formCreate", lang, { village: villageLabel }), onClose, closeLabel: t("common.close", lang), testId: "Village admin form" },
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
      ah(AField, { label: t("field.fullName", lang), invalid: error?.field === "name" }, ah("input", { value: name, maxLength: 120, "data-testid": "VA name", onChange: (e) => { setName(e.target.value); setError(null); } })),
      ah(
        AField,
        { label: t("field.mobile", lang), invalid: error?.field === "mobile", hint: t("field.mobileHint", lang) },
        ah("input", { value: mobile, inputMode: "numeric", maxLength: 10, "data-testid": "VA mobile", onChange: (e) => { setMobile(digitsOnly(e.target.value)); setError(null); } }),
      ),
      ah(AField, { label: t("field.village", lang) }, ah("input", { value: villageLabel, readOnly: true, "data-testid": "VA village" })),
      editing ? null : ah("p", { className: "alpha-hint" }, t("va.existingMember", lang)),
      error ? ah(ANotice, { kind: "error", testId: "VA form error" }, alphaError(error, lang)) : null,
      ah(
        "div",
        { className: "alpha-actions" },
        ah(AButton, { kind: "primary", type: "submit", disabled: busy, "data-testid": "VA form save" }, editing ? t("common.save", lang) : t("va.create", lang)),
        ah(AButton, { onClick: onClose }, t("common.cancel", lang)),
      ),
    ),
  );
}

export function AManageVillageAdmins({ lang, data, act, flash }) {
  const [form, setForm] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const [selected, setSelected] = React.useState("");
  const assignments = new Map((data.villageAssignments || []).map((a) => [a.id, a]));
  const g = (v) => encodeURIComponent(v.gu);
  const personName = (a) => (lang === "en" ? a.name : a.nameGu || a.name);
  const v = (data.villages || []).find((x) => x.gu === selected) || null;
  const a = v ? assignments.get(v.gu) : null;
  const status = !a ? t("va.none", lang) : a.disabled ? t("va.disabled", lang) : t("va.active", lang);
  return ah(
    "div",
    { className: "alpha-va-list", "data-testid": "Manage Village Admins" },
    ah("p", { className: "alpha-hint" }, t("va.intro", lang)),
    ah(
      AField,
      { label: t("field.village", lang) },
      ah(
        "select",
        { value: selected, onChange: (e) => setSelected(e.target.value), "data-testid": "VA village select" },
        ah("option", { value: "" }, t("va.pick", lang)),
        ...(data.villages || []).map((x) => {
          const xa = assignments.get(x.gu);
          const label = (lang === "en" ? x.en : x.gu) + " — " + (xa && !xa.disabled ? personName(xa) : t("va.none", lang));
          return ah("option", { key: x.gu, value: x.gu }, label);
        }),
      ),
    ),
    !v ? ah("p", { className: "alpha-hint" }, t("va.pickHint", lang)) : null,
    v
      ? ah(
          "article",
          { className: "workflow-card alpha-va-card", "data-testid": "Village admin " + v.en },
          ah("h3", null, lang === "en" ? v.en : v.gu),
          a ? ah("p", null, ah("strong", null, personName(a)), " · +91 " + formatMobile(a.phone)) : null,
          ah("p", { className: "workflow-status", "data-state": !a ? "none" : a.disabled ? "disabled" : "active" }, status),
          ah(
            "div",
            { className: "workflow-actions" },
            !a || a.disabled
              ? ah(AButton, { kind: "primary", onClick: () => setForm({ village: v }), "data-testid": "VA create " + v.en }, ah(AIcon, { name: "user-plus" }), " ", t("va.create", lang))
              : null,
            a && !a.disabled ? ah(AButton, { onClick: () => setForm({ village: v, assignment: a }), "data-testid": "VA edit " + v.en }, t("va.edit", lang)) : null,
            a && !a.disabled ? ah(ACallLink, { phone: a.phone, lang, testId: "VA call " + v.en }) : null,
            a && !a.disabled
              ? ah(AButton, { kind: "danger", onClick: () => setConfirm({ kind: "disable", v, a }), "data-testid": "VA disable " + v.en }, t("va.disable", lang))
              : null,
            a && a.disabled
              ? ah(
                  AButton,
                  {
                    onClick: async () => {
                      if (await act("admin/village-admins/" + g(v) + "/enable", {})) flash(t("va.enabledDone", lang));
                    },
                    "data-testid": "VA enable " + v.en,
                  },
                  t("va.enable", lang),
                )
              : null,
          ),
        )
      : null,
    form
      ? ah(AVillageAdminForm, {
          lang,
          village: form.village,
          assignment: form.assignment,
          onClose: () => setForm(null),
          onSubmit: async (body) => {
            await act.strict("admin/village-admins/" + g(form.village) + (form.assignment ? "/edit" : "/create"), body);
            setForm(null);
            if (form.assignment) flash(t("common.saved", lang));
          },
        })
      : null,
    confirm
      ? ah(AConfirm, {
          title: t("va.disable", lang),
          body: t("va.confirmDisable", lang, { name: personName(confirm.a) }),
          yes: t("va.disable", lang),
          no: t("common.cancel", lang),
          danger: true,
          onNo: () => setConfirm(null),
          onYes: async () => {
            const c = confirm;
            setConfirm(null);
            if (await act("admin/village-admins/" + g(c.v) + "/disable", {})) flash(t("va.disabledDone", lang));
          },
        })
      : null,
  );
}
