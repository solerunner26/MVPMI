// React presentation inside the existing renderer; all authority stays on the server.
export function VillageField({ villages, value, onChange, lang }) {
  const h = React.createElement;
  return h(
    "label",
    { className: "workflow-field" },
    bilingual("ગામ", "Village", lang),
    h(
      "select",
      {
        "aria-label": lang === "gu" ? "ગામ" : "Village",
        value: value || "",
        onChange: (e) => onChange(e.target.value),
      },
      h(
        "option",
        { value: "" },
        lang === "gu"
          ? "ગામ પસંદ કરો · Select village"
          : "Select village · ગામ પસંદ કરો",
      ),
      ...villages.map((v) =>
        h(
          "option",
          { key: v.gu, value: v.gu },
          lang === "gu" ? v.gu + " · " + v.en : v.en + " · " + v.gu,
        ),
      ),
    ),
  );
}
export function LocationField({ value, onChange, lang }) {
  return React.createElement(
    "label",
    { className: "workflow-field" },
    bilingual(
      "હાલ : સ્થળ / સરનામું (વૈકલ્પિક)",
      "Current location / address (optional)",
      lang,
    ),
    React.createElement("input", {
      value: value || "",
      maxLength: 240,
      "data-testid": "Current location",
      onChange: (e) => onChange(e.target.value),
    }),
    React.createElement(
      "small",
      null,
      bilingual(
        "મંજૂર સભ્યોને દેખાશે. ચોક્કસ ઘરનું સરનામું આપવું જરૂરી નથી.",
        "Visible to approved members. A precise home address is not required.",
        lang,
      ),
    ),
  );
}
export function VillageWorkflow({
  data,
  lang,
  onAction,
  onClose,
  initialTab = "requests",
}) {
  const h = React.createElement,
    B = (gu, en) => bilingual(gu, en, lang);
  const [tab, setTab] = React.useState(initialTab),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const main = data.role === "admin";
  async function act(path, body) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onAction(path, body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const button = (label, onClick, props = {}) =>
    h("button", { type: "button", disabled: busy, onClick, ...props }, label);
  const field = (label, props) =>
    h("label", { className: "workflow-field" }, label, h("input", props));
  return h(
    "div",
    { className: "preferences-scrim" },
    h(
      "section",
      {
        className: "preferences-panel workflow-panel",
        role: "dialog",
        "aria-modal": true,
        "aria-label":
          lang === "gu"
            ? "ગામની ચકાસણી અને વ્યવસ્થાપન"
            : "Village review and management",
        tabIndex: -1,
      },
      h(
        "header",
        { className: "workflow-heading" },
        h(
          "h2",
          null,
          main
            ? B("સમાજ વ્યવસ્થાપન", "Community management")
            : B("ગામની ચકાસણી", "Village verification"),
        ),
        button(B("પાછા જાઓ", "Back to dashboard"), onClose),
      ),
      main &&
        h(
          "nav",
          {
            "aria-label":
              lang === "gu" ? "વ્યવસ્થાપન વિભાગ" : "Management sections",
            className: "workflow-tabs",
          },
          ...[
            ["requests", "વિનંતીઓ", "Requests"],
            ["villages", "ગામ અને એડમિન", "Villages & admins"],
            [
              "rejections",
              "નામંજૂર / બંધ વિનંતીઓ",
              "Rejected / closed requests",
            ],
            ["removed", "દૂર કરેલા સભ્યો", "Removed members"],
          ].map(([id, g, e]) =>
            button(
              B(g, e),
              () => {
                setTab(id);
                setError("");
              },
              { key: id, "aria-pressed": tab === id },
            ),
          ),
        ),
      error &&
        h(
          "p",
          { role: "alert" },
          B("વિનંતી પૂર્ણ થઈ નથી.", "Could not complete this action."),
          " ",
          error,
        ),
      tab === "requests" &&
        h(
          "div",
          null,
          h(
            "p",
            null,
            B(
              "ગામની ચકાસણી પછી જ મુખ્ય એડમિન અંતિમ મંજૂરી આપી શકે.",
              "Final approval requires village verification first.",
            ),
          ),
          data.reviewQueue.length
            ? data.reviewQueue.map((r) =>
                h(WorkflowDecision, {
                  key: r.id,
                  request: r,
                  data,
                  lang,
                  act,
                  busy,
                }),
              )
            : h("p", null, B("કોઈ વિનંતી બાકી નથી.", "No requests waiting.")),
        ),
      main &&
        tab === "villages" &&
        h(WorkflowVillageManager, { data, lang, act, busy }),
      main &&
        tab === "rejections" &&
        h(
          "div",
          null,
          h(
            "p",
            null,
            B(
              "આ યાદી દૂર કરેલા મંજૂર સભ્યોથી અલગ છે.",
              "These applications are separate from removed approved members.",
            ),
          ),
          data.rejectedApplications.length
            ? data.rejectedApplications.map((r) =>
                h(
                  "article",
                  { className: "workflow-card", key: r.id },
                  h("h3", null, r.name),
                  h("p", null, r.phone, r.phone2 ? " · " + r.phone2 : ""),
                  ...r.events
                    .slice()
                    .reverse()
                    .map((e, i) =>
                      h(
                        "div",
                        { key: i },
                        h(
                          "p",
                          null,
                          new Date(e.at).toLocaleString(
                            lang === "gu" ? "gu-IN" : "en-IN",
                          ),
                          " · ",
                          e.level,
                          " · ",
                          e.action,
                        ),
                        h("p", null, e.reason),
                        h("small", null, e.category, " · ", e.actor),
                      ),
                    ),
                ),
              )
            : h("p", null, B("હજુ કોઈ નોંધ નથી.", "No records yet.")),
        ),
      main &&
        tab === "removed" &&
        h(
          "div",
          null,
          data.archive.length
            ? data.archive.map((a) =>
                h(
                  "article",
                  { className: "workflow-card", key: a.id },
                  h("h3", null, a.name),
                  h("p", null, a.phone, a.phone2 ? " · " + a.phone2 : ""),
                  h("p", null, a.status),
                  ...(a.history || []).map((e, i) =>
                    h(
                      "p",
                      { key: i },
                      new Date(e.at).toLocaleDateString(
                        lang === "gu" ? "gu-IN" : "en-IN",
                      ),
                      " · ",
                      e.reason,
                    ),
                  ),
                ),
              )
            : h(
                "p",
                null,
                B("દૂર કરેલા સભ્યની નોંધ નથી.", "No removed members."),
              ),
        ),
      busy && h("p", { role: "status" }, B("સાચવી રહ્યું છે…", "Saving…")),
    ),
  );
}

function workflowTools(lang, busy) {
  const h = React.createElement,
    B = (gu, en) => bilingual(gu, en, lang);
  const button = (label, onClick, props = {}) =>
    h("button", { type: "button", disabled: busy, onClick, ...props }, label);
  const field = (label, props) =>
    h("label", { className: "workflow-field" }, label, h("input", props));
  return { h, B, field, button };
}
function WorkflowDecision({ request: r, data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const main = data.role === "admin";
  const [reason, setReason] = React.useState(""),
    [confirmed, setConfirmed] = React.useState(false),
    [category, setCategory] = React.useState("insufficient");
  const ready = r.stage === "main";
  const body = {
    reason,
    identityConfirmed: confirmed,
    category,
    replaceExistingMemberId: r.existingMember,
    archiveId: r.archiveMatches?.[0]?.id,
  };
  return h(
    "article",
    { className: "workflow-card", "data-request-id": r.id },
    h("h3", null, bilingual(r.payload.nameGu, r.payload.name, lang)),
    h(
      "p",
      null,
      r.payload.phone,
      r.payload.phone2 ? " · " + r.payload.phone2 : "",
    ),
    h(
      "p",
      null,
      data.villages.find((v) => v.gu === r.payload.village)?.[lang] ||
        r.payload.village,
    ),
    r.payload.currentLocation &&
      h("p", null, "હાલ : ", r.payload.currentLocation),
    h(
      "p",
      { className: "workflow-status" },
      ready
        ? B(
            "ગામની ચકાસણી પૂર્ણ · મુખ્ય મંજૂરી બાકી",
            "Village verified · main approval pending",
          )
        : B("ગામની ચકાસણી બાકી", "Waiting for village verification"),
    ),
    !r.hasVillageAdmin &&
      h(
        "p",
        null,
        B(
          "આ ગામ માટે એડમિન નિયુક્ત કરો.",
          "Assign an administrator for this village.",
        ),
      ),
    r.verification &&
      h(
        "p",
        null,
        B("ચકાસનાર: ", "Verified by: "),
        r.verification.name,
        " · ",
        r.verification.reason,
      ),
    r.reviewHistory?.length > 0 &&
      h(
        "details",
        null,
        h("summary", null, B("જૂની ચકાસણી", "Previous verification")),
        r.reviewHistory.map((v, i) =>
          h("p", { key: i }, v.name, " · ", v.reason),
        ),
      ),
    r.existingMember &&
      h(
        "p",
        null,
        B(
          "આ નંબરનો સભ્ય પહેલેથી છે. મંજૂરીથી જૂના ઉપકરણનો પ્રવેશ બંધ થશે.",
          "An active member matches this number. Approval replaces their old device access.",
        ),
      ),
    r.archiveMatches?.length > 0 &&
      h(
        "p",
        null,
        B(
          "આર્કાઇવમાં મેળ છે. વ્યક્તિની ઓળખ ખાતરી કરો; નવો ડુપ્લિકેટ સભ્ય બનશે નહીં.",
          "Archive match: confirm the same person before rejoining; do not create a duplicate identity.",
        ),
      ),
    field(B("ચકાસણી / નિર્ણયનું કારણ", "Verification / decision reason"), {
      value: reason,
      maxLength: 500,
      onChange: (e) => setReason(e.target.value),
    }),
    h(
      "label",
      { className: "workflow-check" },
      h("input", {
        type: "checkbox",
        checked: confirmed,
        onChange: (e) => setConfirmed(e.target.checked),
      }),
      B(
        "વ્યક્તિની ઓળખ સ્વતંત્ર રીતે ખાતરી કરી છે.",
        "I independently confirmed this person’s identity.",
      ),
    ),
    h(
      "label",
      { className: "workflow-field" },
      B("નામંજૂરીનું વર્ગીકરણ", "Rejection category"),
      h(
        "select",
        { value: category, onChange: (e) => setCategory(e.target.value) },
        ...[
          [
            "not-community",
            "સમાજના સભ્ય તરીકે ઓળખ નથી",
            "Not recognised as a community member",
          ],
          ["duplicate", "ડુપ્લિકેટ વિનંતી", "Duplicate request"],
          ["insufficient", "અપૂરતી માહિતી", "Insufficient information"],
          ["other", "અન્ય", "Other"],
        ].map(([v, g, e]) =>
          h(
            "option",
            { key: v, value: v },
            lang === "gu" ? g + " · " + e : e + " · " + g,
          ),
        ),
      ),
    ),
    h(
      "div",
      { className: "workflow-actions" },
      main
        ? button(
            B("અંતિમ મંજૂરી", "Final approval"),
            () => act("admin/requests/" + r.id + "/approve", body),
            {
              disabled:
                busy || !ready || !confirmed || reason.trim().length < 5,
            },
          )
        : button(
            B("ચકાસીને આગળ મોકલો", "Verify & forward"),
            () => act("village/requests/" + r.id + "/forward", body),
            { disabled: busy || !confirmed || reason.trim().length < 5 },
          ),
      button(
        B("નામંજૂર કરો", "Reject"),
        () =>
          act(
            (main ? "admin" : "village") + "/requests/" + r.id + "/reject",
            body,
          ),
        { disabled: busy || reason.trim().length < 5 },
      ),
      !main &&
        button(
          B("વિનંતી બંધ કરો", "Close request"),
          () => act("village/requests/" + r.id + "/close", body),
          { disabled: busy || reason.trim().length < 5 },
        ),
    ),
  );
}
function WorkflowVillageManager({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const main = data.role === "admin";
  const [gu, setGu] = React.useState(""),
    [en, setEn] = React.useState("");
  return h(
    "div",
    null,
    h(
      "form",
      {
        className: "workflow-card",
        onSubmit: (e) => {
          e.preventDefault();
          act("admin/villages", { gu, en });
        },
      },
      h("h3", null, B("નવું ગામ ઉમેરો", "Add village")),
      field(B("ગુજરાતી નામ", "Gujarati name"), {
        value: gu,
        required: true,
        maxLength: 80,
        onChange: (e) => setGu(e.target.value),
      }),
      field(B("અંગ્રેજી નામ", "English name"), {
        value: en,
        required: true,
        maxLength: 80,
        onChange: (e) => setEn(e.target.value),
      }),
      h(
        "button",
        { disabled: busy, type: "submit" },
        B("ગામ ઉમેરો", "Add village"),
      ),
    ),
    ...data.villages.map((v) =>
      h(WorkflowAssignment, { key: v.id, village: v, data, lang, act, busy }),
    ),
  );
}
function WorkflowAssignment({ village: v, data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const a = data.villageAssignments.find((a) => a.id === v.id);
  const [selection, setSelection] = React.useState(""),
    [reason, setReason] = React.useState(""),
    [confirmed, setConfirmed] = React.useState(false);
  const members = data.members.filter((m) => m.village === v.gu);
  const applicants = data.reviewQueue.filter(
    (r) =>
      r.kind === "new" &&
      r.payload.village === v.gu &&
      !r.existingMember &&
      !r.archiveMatches?.length,
  );
  const appointment = selection.startsWith("request:");
  return h(
    "article",
    { className: "workflow-card" },
    h("h3", null, B(v.gu, v.en)),
    h(
      "p",
      null,
      B("હાલના એડમિન: ", "Current administrator: "),
      members.find((m) => m.id === a?.memberId)?.name ||
        B("નિયુક્ત નથી", "Unassigned"),
    ),
    h(
      "label",
      { className: "workflow-field" },
      B("એડમિન પસંદ કરો", "Choose administrator"),
      h(
        "select",
        { value: selection, onChange: (e) => setSelection(e.target.value) },
        h("option", { value: "" }, "—"),
        h(
          "option",
          { value: "remove" },
          lang === "gu"
            ? "નિયુક્તિ દૂર કરો · Remove assignment"
            : "Remove assignment · નિયુક્તિ દૂર કરો",
        ),
        ...members.map((m) =>
          h(
            "option",
            { key: m.id, value: m.id },
            m.nameGu + " · " + m.name + " · " + m.phone,
          ),
        ),
        ...(!a ? applicants : []).map((r) =>
          h(
            "option",
            { key: r.id, value: "request:" + r.id },
            (lang === "gu"
              ? "પ્રથમ પ્રતિનિધિ નિયુક્ત કરો: "
              : "Appoint first representative: ") +
              r.payload.name +
              " · " +
              r.payload.phone,
          ),
        ),
      ),
    ),
    appointment &&
      h(
        "p",
        { className: "workflow-warning" },
        B(
          "આ ખાસ નિયુક્તિથી અરજદાર મંજૂર સભ્ય અને ગામના એડમિન બનશે. વ્યક્તિને જાતે ઓળખીને જ કરો. સામાન્ય સભ્યની મંજૂરી માટે આ માર્ગ વાપરશો નહીં.",
          "This explicit appointment grants membership and village-admin access. Personally verify this trusted representative; do not use it for ordinary approvals.",
        ),
      ),
    field(B("નિયુક્તિ / બદલાવનું કારણ", "Assignment / change reason"), {
      value: reason,
      maxLength: 500,
      onChange: (e) => setReason(e.target.value),
    }),
    h(
      "label",
      { className: "workflow-check" },
      h("input", {
        type: "checkbox",
        checked: confirmed,
        onChange: (e) => setConfirmed(e.target.checked),
      }),
      B(
        "ઓળખ અને આ અધિકારની ખાતરી કરું છું.",
        "I confirm the identity and this permission change.",
      ),
    ),
    button(
      B("નિયુક્તિ સાચવો", "Save assignment"),
      () =>
        act("admin/village-admins/" + encodeURIComponent(v.id), {
          reason,
          identityConfirmed: confirmed,
          ...(appointment
            ? { requestId: selection.slice(8) }
            : { memberId: selection === "remove" ? null : selection }),
        }),
      {
        disabled: busy || !selection || !confirmed || reason.trim().length < 5,
      },
    ),
  );
}
