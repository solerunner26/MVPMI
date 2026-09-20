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
          {
            key: v.gu,
            value: v.gu,
            disabled: v.hasAdmin === false,
          },
          (lang === "gu" ? v.gu + " · " + v.en : v.en + " · " + v.gu) +
            (v.hasAdmin === false
              ? lang === "gu"
                ? " · એડમિન નિયુક્ત નથી"
                : " · no admin yet"
              : ""),
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
// Separate, visible sign-in for village administrators. The hidden sun-tap
// gate and the main-administrator password are never part of this flow.
export function VillageAdminLogin({ lang, onAction, onClose }) {
  const h = React.createElement,
    B = (gu, en) => bilingual(gu, en, lang);
  const [phone, setPhone] = React.useState(""),
    [pass, setPass] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
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
          lang === "gu" ? "ગામ એડમિન સાઇન ઇન" : "Village administrator sign in",
        tabIndex: -1,
      },
      h(
        "header",
        { className: "workflow-heading" },
        h("h2", null, B("ગામ એડમિન સાઇન ઇન", "Village administrator sign in")),
        h(
          "button",
          { type: "button", onClick: onClose },
          B("પાછા જાઓ", "Back"),
        ),
      ),
      h(
        "p",
        null,
        B(
          "આ સાઇન ઇન ફક્ત ગામના એડમિન માટે છે. મુખ્ય એડમિનનો પ્રવેશ અલગ અને છુપાવેલો રહે છે.",
          "This sign-in is for village administrators only. The main administrator's access stays separate and hidden.",
        ),
      ),
      error && h("p", { role: "alert" }, error),
      h(
        "form",
        {
          onSubmit: async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await onAction("village/login", { phone, pass });
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          },
        },
        h(
          "label",
          { className: "workflow-field" },
          B("ફોન નંબર", "Phone number"),
          h("input", {
            value: phone,
            inputMode: "numeric",
            autoComplete: "off",
            maxLength: 13,
            onChange: (e) => setPhone(e.target.value),
          }),
        ),
        h(
          "label",
          { className: "workflow-field" },
          B("પાસવર્ડ", "Password"),
          h("input", {
            type: "password",
            value: pass,
            autoComplete: "off",
            onChange: (e) => setPass(e.target.value),
          }),
        ),
        h(
          "button",
          { type: "submit", disabled: busy },
          B("સાઇન ઇન", "Sign in"),
        ),
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
  const tabs = main
    ? [
        ["requests", "વિનંતીઓ", "Requests"],
        ["villages", "ગામ અને એડમિન", "Villages & admins"],
        ["rejections", "નામંજૂર / બંધ વિનંતીઓ", "Rejected / closed requests"],
        ["removed", "દૂર કરેલા સભ્યો", "Removed members"],
      ]
    : [
        ["requests", "વિનંતીઓ", "Requests"],
        ["members", "મારા ગામના સભ્યો", "My village members"],
        ["account", "ખાતું", "Account"],
      ];
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
            : [
                B("ગામની ચકાસણી · ", "Village verification · "),
                data.villageAdminName || "",
              ],
        ),
        h(
          "button",
          { type: "button", onClick: onClose },
          B("પાછા જાઓ", "Back to dashboard"),
        ),
      ),
      h(
        "nav",
        {
          "aria-label": lang === "gu" ? "વિભાગ" : "Sections",
          className: "workflow-tabs",
        },
        ...tabs.map(([id, gu, en]) =>
          h(
            "button",
            {
              key: id,
              "aria-pressed": tab === id,
              onClick: () => {
                setTab(id);
                setError("");
              },
            },
            B(gu, en),
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
      !main &&
        tab === "members" &&
        h(WorkflowMembers, { data, lang, act, busy }),
      !main &&
        tab === "account" &&
        h(WorkflowAccount, { data, lang, act, busy }),
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
                        h(
                          "small",
                          null,
                          e.category,
                          " · ",
                          e.actorName || e.actor,
                        ),
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
    r.kind === "update" && r.old
      ? h(
          "p",
          null,
          B("ગામ બદલવાની વિનંતી: ", "Village change request: "),
          r.old.village,
          " → ",
          r.payload.village,
        )
      : h(
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
        ].map(([v, gu, en]) =>
          h(
            "option",
            { key: v, value: v },
            lang === "gu" ? gu + " · " + en : en + " · " + gu,
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
// Village-administrator view of their own community members. Every proposal is
// sent to the main administrator for the final decision.
function WorkflowMembers({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const village = data.villageAdminVillage;
  const members = data.members.filter((m) => m.village === village);
  const pending = new Map(data.villageProposals.map((p) => [p.memberId, p]));
  return h(
    "div",
    null,
    h(
      "p",
      null,
      B(
        "ફેરફાર કે દૂર કરવાની દરેક સૂચના મુખ્ય એડમિન પાસે અંતિમ મંજૂરી માટે જાય છે. ગામ એડમની પોતાની વિગત મુખ્ય એડમિન જ બદલી શકે.",
        "Every change or removal proposal goes to the main administrator for the final decision. Your own administrator record can only be changed by the main administrator.",
      ),
    ),
    members.length
      ? members.map((m) =>
          h(WorkflowMemberCard, {
            key: m.id,
            member: m,
            data,
            lang,
            act,
            busy,
            pending: pending.get(m.id),
          }),
        )
      : h("p", null, B("હજુ કોઈ સભ્ય નથી.", "No members yet.")),
  );
}
function WorkflowMemberCard({ member: m, data, lang, act, busy, pending }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const [mode, setMode] = React.useState(null),
    [reason, setReason] = React.useState(""),
    [form, setForm] = React.useState({
      name: m.name,
      nameGu: m.nameGu,
      phone: m.phone,
      phone2: m.phone2 || "",
      village: m.village,
      currentLocation: m.currentLocation || "",
    });
  return h(
    "article",
    { className: "workflow-card" },
    h("h3", null, bilingual(m.nameGu, m.name, lang)),
    h("p", null, m.phone, m.phone2 ? " · " + m.phone2 : ""),
    m.currentLocation && h("p", null, "હાલ : ", m.currentLocation),
    pending &&
      h(
        "p",
        { className: "workflow-status" },
        B(
          "મુખ્ય એડમિનની મંજૂરી બાકી (" +
            (pending.kind === "delete" ? "દૂર કરવાની" : "ફેરફારની") +
            " સૂચના)",
          "Awaiting main-administrator decision (" +
            (pending.kind === "delete" ? "removal" : "change") +
            " proposal)",
        ),
      ),
    !pending &&
      mode !== "update" &&
      button(B("માહિતી બદલવાની સૂચના", "Propose change"), () =>
        setMode("update"),
      ),
    !pending &&
      mode !== "delete" &&
      button(B("દૂર કરવાની સૂચના", "Propose removal"), () => setMode("delete")),
    mode === "update" &&
      h(
        "div",
        null,
        field(B("નવું નામ", "New name"), {
          value: form.name,
          maxLength: 120,
          onChange: (e) =>
            setForm({ ...form, name: e.target.value, nameGu: e.target.value }),
        }),
        field(B("નવો ફોન નંબર", "New phone number"), {
          value: form.phone,
          inputMode: "numeric",
          maxLength: 13,
          onChange: (e) => setForm({ ...form, phone: e.target.value }),
        }),
        field(B("બીજો નંબર (ખાલી રાખી શકાય)", "Second number (can be empty)"), {
          value: form.phone2,
          inputMode: "numeric",
          maxLength: 13,
          onChange: (e) => setForm({ ...form, phone2: e.target.value }),
        }),
        h(
          "label",
          { className: "workflow-field" },
          B("હાલ : સ્થળ", "Current location"),
          h("input", {
            value: form.currentLocation,
            maxLength: 240,
            "data-testid": "Current location",
            onChange: (e) =>
              setForm({ ...form, currentLocation: e.target.value }),
          }),
        ),
        field(B("સૂચનાનું કારણ", "Proposal reason"), {
          value: reason,
          maxLength: 500,
          onChange: (e) => setReason(e.target.value),
        }),
        h(
          "div",
          { className: "workflow-actions" },
          button(
            B("મુખ્ય એડમિનને મોકલો", "Send to main administrator"),
            () =>
              act("village/members/" + m.id + "/update", {
                ...form,
                phone2: form.phone2 || "",
                reason,
                identityConfirmed: true,
              }),
            { disabled: busy || reason.trim().length < 5 },
          ),
          button(B("રદ કરો", "Cancel"), () => setMode(null)),
        ),
      ),
    mode === "delete" &&
      h(
        "div",
        null,
        field(B("દૂર કરવાનું કારણ", "Removal reason"), {
          value: reason,
          maxLength: 500,
          onChange: (e) => setReason(e.target.value),
        }),
        h(
          "div",
          { className: "workflow-actions" },
          button(
            B("દૂર કરવાની સૂચના મોકલો", "Send removal proposal"),
            () =>
              act("village/members/" + m.id + "/delete", {
                reason,
                identityConfirmed: true,
              }),
            { disabled: busy || reason.trim().length < 5 },
          ),
          button(B("રદ કરો", "Cancel"), () => setMode(null)),
        ),
      ),
  );
}
function WorkflowAccount({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const [current, setCurrent] = React.useState(""),
    [next, setNext] = React.useState("");
  return h(
    "div",
    null,
    h(
      "p",
      null,
      B(
        "સાઇન ઇન 12 કલાક માટે યાદ રહે છે. ગામ એડમિનને મુખ્ય એડમિનનો છુપો પ્રવેશ મળતો નથી.",
        "Sign-in lasts 12 hours. Village administrators never receive the main administrator's hidden access.",
      ),
    ),
    h(
      "article",
      { className: "workflow-card" },
      h("h3", null, B("પાસવર્ડ બદલો", "Change password")),
      field(B("હાલનો પાસવર્ડ", "Current password"), {
        type: "password",
        value: current,
        autoComplete: "off",
        onChange: (e) => setCurrent(e.target.value),
      }),
      field(B("નવો પાસવર્ડ", "New password"), {
        type: "password",
        value: next,
        autoComplete: "off",
        onChange: (e) => setNext(e.target.value),
      }),
      h(
        "div",
        { className: "workflow-actions" },
        button(
          B("પાસવર્ડ બદલો", "Change password"),
          () => act("village/password", { current, next }),
          { disabled: busy || !current || !next },
        ),
      ),
    ),
    h(
      "article",
      { className: "workflow-card" },
      h("h3", null, B("સાઇન આઉટ", "Sign out")),
      button(B("ગામ એડમિન સાઇન આઉટ", "Sign out village administrator"), () =>
        act("village/logout", {}),
      ),
    ),
  );
}
function WorkflowVillageManager({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const [gu, setGu] = React.useState(""),
    [en, setEn] = React.useState("");
  return h(
    "div",
    null,
    h(
      "p",
      null,
      B(
        "દરેક ગામ માટે પહેલા એક એડમિન નોંધાવો. એડમિન નોંધાયા પછી જ એ ગામના સભ્યો જોડાઈ શકે.",
        "Enroll one administrator per village first. Community members can join a village only after its administrator is enrolled.",
      ),
    ),
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
  const admin = a && data.members.find((m) => m.id === a.memberId);
  const members = data.members.filter((m) => m.village === v.gu);
  const [selection, setSelection] = React.useState(""),
    [pass, setPass] = React.useState(""),
    [reason, setReason] = React.useState(""),
    [confirmed, setConfirmed] = React.useState(false),
    [name, setName] = React.useState(""),
    [phone, setPhone] = React.useState(""),
    [location, setLocation] = React.useState(""),
    [resetPass, setResetPass] = React.useState("");
  return h(
    "article",
    { className: "workflow-card" },
    h("h3", null, B(v.gu, v.en)),
    h(
      "p",
      null,
      B("હાલના એડમિન: ", "Current administrator: "),
      admin
        ? bilingual(admin.nameGu, admin.name, lang)
        : B("નિયુક્ત નથી", "Unassigned"),
    ),
    !a &&
      h(
        "form",
        {
          onSubmit: (e) => {
            e.preventDefault();
            act("admin/village-admins/" + encodeURIComponent(v.id), {
              name,
              phone,
              currentLocation: location,
              pass,
              reason,
              identityConfirmed: confirmed,
            });
          },
        },
        h(
          "p",
          null,
          B(
            "પહેલો ગામ એડમિન નોંધાવો (વ્યક્તિગત ઓળખ ખાતરી કરીને):",
            "Enroll this village's first administrator (verify the person in person):",
          ),
        ),
        field(B("નામ", "Name"), {
          value: name,
          required: true,
          maxLength: 120,
          onChange: (e) => setName(e.target.value),
        }),
        field(B("ફોન નંબર (સાઇન ઇન માટે)", "Phone number (used to sign in)"), {
          value: phone,
          required: true,
          inputMode: "numeric",
          maxLength: 13,
          onChange: (e) => setPhone(e.target.value),
        }),
        field(B("હાલ : સ્થળ (વૈકલ્પિક)", "Current location (optional)"), {
          value: location,
          maxLength: 240,
          onChange: (e) => setLocation(e.target.value),
        }),
        field(
          B(
            "પ્રારંભિક પાસવર્ડ (વ્યક્તિને જણાવો)",
            "Initial password (share it with the person)",
          ),
          {
            type: "password",
            value: pass,
            required: true,
            autoComplete: "off",
            onChange: (e) => setPass(e.target.value),
          },
        ),
        field(B("નિયુક્તિનું કારણ", "Enrollment reason"), {
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
            "વ્યક્તિની ઓળખ ખાતરી કરી છે.",
            "I have confirmed this person's identity.",
          ),
        ),
        h(
          "button",
          {
            disabled: busy || !confirmed || reason.trim().length < 5,
            type: "submit",
          },
          B("ગામ એડમિન નોંધાવો", "Enroll administrator"),
        ),
      ),
    a &&
      h(
        "div",
        null,
        h(
          "label",
          { className: "workflow-field" },
          B("નવો એડમિન પસંદ કરો", "Choose a new administrator"),
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
            ...members
              .filter((m) => m.id !== a.memberId)
              .map((m) =>
                h(
                  "option",
                  { key: m.id, value: m.id },
                  m.nameGu + " · " + m.name + " · " + m.phone,
                ),
              ),
          ),
        ),
        selection &&
          selection !== "remove" &&
          field(B("નવા એડમિનનો પાસવર્ડ", "New administrator's password"), {
            type: "password",
            value: pass,
            autoComplete: "off",
            onChange: (e) => setPass(e.target.value),
          }),
        field(B("બદલાવનું કારણ", "Change reason"), {
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
        h(
          "div",
          { className: "workflow-actions" },
          button(
            B("નિયુક્તિ સાચવો", "Save assignment"),
            () =>
              act("admin/village-admins/" + encodeURIComponent(v.id), {
                reason,
                identityConfirmed: confirmed,
                ...(selection === "remove"
                  ? { memberId: null }
                  : selection
                    ? { memberId: selection, pass }
                    : {}),
              }),
            {
              disabled:
                busy ||
                !selection ||
                !confirmed ||
                reason.trim().length < 5 ||
                (selection !== "remove" && !pass),
            },
          ),
        ),
        h(
          "details",
          null,
          h("summary", null, B("પાસવર્ડ રીસેટ કરો", "Reset password")),
          field(B("નવો પાસવર્ડ", "New password"), {
            type: "password",
            value: resetPass,
            autoComplete: "off",
            onChange: (e) => setResetPass(e.target.value),
          }),
          button(
            B("પાસવર્ડ રીસેટ કરો", "Reset password"),
            () =>
              act(
                "admin/village-admins/" +
                  encodeURIComponent(v.id) +
                  "/password",
                {
                  pass: resetPass,
                  reason,
                  identityConfirmed: confirmed,
                },
              ),
            {
              disabled:
                busy || !resetPass || !confirmed || reason.trim().length < 5,
            },
          ),
        ),
      ),
  );
}
