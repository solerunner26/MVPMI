// Section 3: "Manage Village Admins" (Main Admin) and Section 4: "Forgot PIN"
// requests (Village Admin for their village, Main Admin for every village).
// Every call returns fresh state; a TEMP PIN in the answer opens the one-time
// TEMP PIN dialog (see controller).

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
  const assignments = new Map((data.villageAssignments || []).map((a) => [a.id, a]));
  const g = (v) => encodeURIComponent(v.gu);
  const personName = (a) => (lang === "en" ? a.name : a.nameGu || a.name);
  return ah(
    "div",
    { className: "alpha-va-list", "data-testid": "Manage Village Admins" },
    ah("p", { className: "alpha-hint" }, t("va.intro", lang)),
    ...(data.villages || []).map((v) => {
      const a = assignments.get(v.gu);
      const status = !a ? t("va.none", lang) : a.disabled ? t("va.disabled", lang) : a.mustSetPin ? t("va.waitingPin", lang) : t("va.active", lang);
      return ah(
        "article",
        { key: v.gu, className: "workflow-card alpha-va-card", "data-testid": "Village admin " + v.en },
        ah("h3", null, lang === "en" ? v.en : v.gu),
        a ? ah("p", null, ah("strong", null, personName(a)), " · +91 " + formatMobile(a.phone)) : null,
        ah("p", { className: "workflow-status", "data-state": !a ? "none" : a.disabled ? "disabled" : "active" }, status),
        a && !a.disabled && a.tempPin
          ? ah(
              "div",
              { className: "alpha-va-handover", "data-testid": "VA handover " + v.en },
              ah("span", null, t("va.handover", lang)),
              ah("strong", { className: "alpha-va-pin", "data-testid": "VA temp pin " + v.en, "aria-label": t("va.handover", lang) + " " + a.tempPin.split("").join(" ") }, a.tempPin),
              ah(
                "div",
                { className: "workflow-actions" },
                ah(ACallLink, { phone: a.phone, lang, testId: "VA call " + v.en }),
                ah(AWhatsAppLink, {
                  issued: { kind: "village-admin", pin: a.tempPin, phone: a.phone, village: v.gu, villageEn: v.en },
                  lang,
                  testId: "VA share " + v.en,
                }),
              ),
            )
          : null,
        ah(
          "div",
          { className: "workflow-actions" },
          !a || a.disabled
            ? ah(AButton, { kind: "primary", onClick: () => setForm({ village: v }), "data-testid": "VA create " + v.en }, ah(AIcon, { name: "user-plus" }), " ", t("va.create", lang))
            : null,
          a && !a.disabled ? ah(AButton, { onClick: () => setForm({ village: v, assignment: a }), "data-testid": "VA edit " + v.en }, t("va.edit", lang)) : null,
          a && !a.disabled
            ? ah(AButton, { onClick: () => setConfirm({ kind: "reset", v, a }), "data-testid": "VA reset " + v.en }, t("va.reset", lang))
            : null,
          a && !a.disabled
            ? ah(AButton, { kind: "danger", onClick: () => setConfirm({ kind: "disable", v, a }), "data-testid": "VA disable " + v.en }, t("va.disable", lang))
            : null,
          a && a.disabled
            ? ah(
                AButton,
                {
                  onClick: async () => {
                    await act("admin/village-admins/" + g(v) + "/enable", {});
                    flash(t("va.enabledDone", lang));
                  },
                  "data-testid": "VA enable " + v.en,
                },
                t("va.enable", lang),
              )
            : null,
        ),
      );
    }),
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
          title: t(confirm.kind === "reset" ? "va.reset" : "va.disable", lang),
          body: t(confirm.kind === "reset" ? "va.confirmReset" : "va.confirmDisable", lang, { name: personName(confirm.a) }),
          yes: t(confirm.kind === "reset" ? "va.reset" : "va.disable", lang),
          no: t("common.cancel", lang),
          danger: confirm.kind === "disable",
          onNo: () => setConfirm(null),
          onYes: async () => {
            const c = confirm;
            setConfirm(null);
            await act("admin/village-admins/" + g(c.v) + "/" + c.kind, {});
            if (c.kind === "disable") flash(t("va.disabledDone", lang));
          },
        })
      : null,
  );
}

export function APinRequests({ lang, data, act, main }) {
  const [confirm, setConfirm] = React.useState(null);
  const rows = data.pinResetRequests || [];
  const create = (r) => {
    if (main && r.isVillageAdmin) return act("admin/village-admins/" + encodeURIComponent(r.village) + "/reset", {});
    return act((main ? "admin" : "village") + "/members/" + r.memberId + "/pin-reset", {});
  };
  return ah(
    "div",
    { "data-testid": "Forgot PIN requests" },
    rows.length
      ? rows.map((r) =>
          ah(
            "article",
            { key: r.id, className: "workflow-card", "data-testid": "PIN request" },
            ah("h3", null, lang === "en" ? r.name : r.nameGu || r.name),
            ah("p", null, "+91 " + formatMobile(r.phone) + " · " + villageName(r.village, lang) + (r.isVillageAdmin ? " · " + t("role.VILLAGE_ADMIN", lang) : "")),
            ah("p", { className: "workflow-status" }, new Date(r.at).toLocaleString(lang === "gu" ? "gu-IN" : "en-IN", { dateStyle: "medium", timeStyle: "short" })),
            ah(
              "div",
              { className: "workflow-actions" },
              ah(AButton, { kind: "primary", onClick: () => setConfirm(r), "data-testid": "PIN request create" }, t("pinreq.create", lang)),
              ah(AButton, { onClick: () => act("village/pin-requests/" + r.id + "/dismiss", {}), "data-testid": "PIN request dismiss" }, t("pinreq.dismiss", lang)),
            ),
          ),
        )
      : ah("p", { className: "alpha-empty" }, t("pinreq.none", lang)),
    confirm
      ? ah(AConfirm, {
          title: t("pinreq.create", lang),
          body: t("pinreq.confirm", lang, { name: lang === "en" ? confirm.name : confirm.nameGu || confirm.name }),
          yes: t("pinreq.create", lang),
          no: t("common.cancel", lang),
          onNo: () => setConfirm(null),
          onYes: async () => {
            const r = confirm;
            setConfirm(null);
            await create(r);
          },
        })
      : null,
  );
}
