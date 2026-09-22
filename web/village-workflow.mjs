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
      h("option", { value: "" }, lang === "gu" ? "ગામ પસંદ કરો" : "Select village"),
      ...villages.map((v) =>
        h(
          "option",
          {
            key: v.gu,
            value: v.gu,
            disabled: v.hasAdmin === false,
          },
          (lang === "gu" ? v.gu : v.en) +
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
// Public "All admins" page: the administrator hierarchy with direct contact
// actions, open to everyone including applicants who are still registering.
export function AllAdminDirectory({ data, lang, onClose }) {
  const h = React.createElement,
    B = (gu, en) => bilingual(gu, en, lang);
  const directory = data.adminDirectory || { main: null, villages: [] };
  // Compact contact row: avatar, name, role line, phone and two icon actions.
  const row = ({ key, name, role, phone, hint }) =>
    h(
      "article",
      { className: "admin-row" + (key === "main" ? " main-admin" : ""), key },
      h(
        "span",
        { className: "admin-avatar", "aria-hidden": true },
        key === "main"
          ? h("i", { className: "ph-duotone ph-shield-star" })
          : (name || role || "?").trim().charAt(0),
      ),
      h(
        "div",
        { className: "admin-detail" },
        h("p", { className: "admin-name" }, name),
        h("p", { className: "admin-role" }, role),
        phone &&
          h("p", { className: "admin-phone" }, h("i", { className: "ph-duotone ph-phone", "aria-hidden": true }), " +91 ", phone),
        hint,
      ),
      phone &&
        h(
          "div",
          { className: "admin-actions" },
          h(
            "a",
            {
              className: "admin-icon-action",
              href: "tel:+91" + phone,
              target: "_blank",
              rel: "noopener noreferrer",
              "data-testid": "Admin call " + key,
              "aria-label": B("ફોન કરો", "Call") + " " + name,
              title: B("ફોન કરો", "Call"),
            },
            h("i", { className: "ph-duotone ph-phone-call", "aria-hidden": true }),
          ),
          h(
            "a",
            {
              className: "admin-icon-action",
              href: "https://wa.me/91" + phone,
              target: "_blank",
              rel: "noopener noreferrer",
              "data-testid": "Admin whatsapp " + key,
              "aria-label": "WhatsApp " + name,
              title: "WhatsApp",
            },
            h("i", { className: "ph-duotone ph-whatsapp-logo", "aria-hidden": true }),
          ),
        ),
    );
  return h(
    "div",
    { className: "preferences-scrim" },
    h(
      "section",
      {
        className: "preferences-panel workflow-panel admin-directory",
        role: "dialog",
        "aria-modal": true,
        "aria-label": B("બધા એડમિન", "All admins"),
        tabIndex: -1,
      },
      h(
        "header",
        { className: "workflow-heading" },
        h("h2", null, B("બધા એડમિન", "All admins")),
        h("button", { type: "button", onClick: onClose }, B("પાછા જાઓ", "Back")),
      ),
      h(
        "p",
        { className: "admin-intro" },
        B(
          "કોઈપણ પ્રશ્ન કે જોડાવાની મુશ્કેલી હોય તો સીધા તમારા ગામના એડમિનનો સંપર્ક કરો.",
          "Contact your village administrator directly for any question or trouble joining.",
        ),
      ),
      h(
        "div",
        { className: "admin-list" },
        directory.main &&
          row({
            // Item 2: the main administrator is visually distinct.
            key: "main",
            name:
              lang === "en" && directory.main.nameEn
                ? directory.main.nameEn
                : directory.main.name,
            role: B("મુખ્ય એડમિન · સમગ્ર સમાજ", "Main administrator · whole community"),
            phone: directory.main.phone,
          }),
        ...directory.villages.map((v) => {
          // One language at a time: village names follow the selection.
          const villageName = lang === "gu" ? v.village : v.villageEn || v.village;
          return v.admin
            ? row({
                key: v.village,
                name: v.admin.name,
                role:
                  B("ગામ એડમિન · ", "Village administrator · ") + villageName,
                phone: v.admin.phone,
                hint:
                  v.admin.location &&
                  h(
                    "p",
                    { className: "admin-hint" },
                    h("i", { className: "ph-duotone ph-map-pin", "aria-hidden": true }),
                    " ",
                    B("હાલ : ", "Location: "),
                    v.admin.location,
                  ),
              })
            : h(
                "article",
                { className: "admin-row admin-row-empty", key: v.village },
                h(
                  "span",
                  { className: "admin-avatar", "aria-hidden": true },
                  villageName.charAt(0),
                ),
                h(
                  "div",
                  { className: "admin-detail" },
                  h("p", { className: "admin-name" }, villageName),
                  h(
                    "p",
                    { className: "admin-role" },
                    B("એડમિન નિયુક્ત નથી", "No administrator yet"),
                  ),
                ),
              );
        }),
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
        h(
          "h2",
          { className: "workflow-title" },
          B("ગામ એડમિન સાઇન ઇન", "Village administrator sign in"),
        ),
        h(
          "button",
          {
            type: "button",
            className: "workflow-chip workflow-back",
            title: B("પાછા જાઓ", "Back"),
            "aria-label": B("પાછા જાઓ", "Back"),
            onClick: onClose,
          },
          h("i", {
            className: "ph-duotone ph-arrow-left",
            "aria-hidden": true,
          }),
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
    openTab = setTab,
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
        ["villages", "પાસવર્ડ રીસેટ", "Password reset"],
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
          { className: "workflow-title" },
          main
            ? B("સમાજ વ્યવસ્થાપન", "Community management")
            : [
                B("ગામની ચકાસણી · ", "Village verification · "),
                data.villageAdminName || "",
              ],
        ),
      ),
      h(
        "div",
        { className: "workflow-toolbar" },
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
        // Back and (for village administrators) sign-out stay pinned to the
        // right end of the toolbar on every section — always one tap away.
        h(
          "div",
          { className: "workflow-controls" },
          !main &&
            h(
              "button",
              {
                type: "button",
                className: "workflow-chip workflow-signout",
                disabled: busy,
                title: B("સાઇન આઉટ", "Sign out"),
                "aria-label": B("સાઇન આઉટ", "Sign out"),
                onClick: () => act("village/logout", {}),
              },
              h("i", {
                className: "ph-duotone ph-sign-out",
                "aria-hidden": true,
              }),
            ),
          h(
            "button",
            {
              type: "button",
              className: "workflow-chip workflow-back",
              title: B("પાછા જાઓ", "Back to dashboard"),
              "aria-label": B("પાછા જાઓ", "Back to dashboard"),
              onClick: onClose,
            },
            h("i", {
              className: "ph-duotone ph-arrow-left",
              "aria-hidden": true,
            }),
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
                        ...(e.reason ? [h("p", null, e.reason)] : []),
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
                      ...(e.reason ? [" · ", e.reason] : []),
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
  // Password field with the show/hide "eye" control, so an entered password
  // can be read back in English characters before saving.
  const secretField = (label, value, setValue, props = {}) => {
    const [shown, setShown] = React.useState(false);
    return h(
      "label",
      { className: "workflow-field" },
      label,
      h(
        "div",
        { className: "workflow-secret" },
        h("input", {
          type: shown ? "text" : "password",
          value,
          autoComplete: "off",
          ...props,
          onChange: (e) => setValue(e.target.value),
        }),
        h(
          "button",
          {
            type: "button",
            className: "workflow-eye",
            title: shown
              ? B("પાસવર્ડ છુપાવો", "Hide password")
              : B("પાસવર્ડ બતાવો", "Show password"),
            "aria-label": shown
              ? B("પાસવર્ડ છુપાવો", "Hide password")
              : B("પાસવર્ડ બતાવો", "Show password"),
            "aria-pressed": shown,
            onClick: () => setShown(!shown),
          },
          h("i", {
            className: shown
              ? "ph-duotone ph-eye-slash"
              : "ph-duotone ph-eye",
            "aria-hidden": true,
          }),
        ),
      ),
    );
  };
  return { h, B, field, button, secretField };
}
function WorkflowDecision({ request: r, data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const main = data.role === "admin";
  const [confirmed, setConfirmed] = React.useState(false),
    [correcting, setCorrecting] = React.useState(false),
    [form, setForm] = React.useState({
      firstName: r.payload.firstName || "",
      middleName: r.payload.middleName || "",
      surname: r.payload.surname || "",
      phone: r.payload.phone,
      phone2: r.payload.phone2 || "",
      currentLocation: r.payload.currentLocation || "",
      village: r.payload.village,
    });
  const ready = r.stage === "main";
  const body = {
    identityConfirmed: confirmed,
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
    r.rejectedBefore
      ? h(
          "p",
          { className: "rejected-before", role: "alert" },
          h("i", {
            "aria-hidden": "true",
            className: "ph-duotone ph-warning-circle",
          }),
          " ",
          B(
            "આ નંબર પહેલા નામંજૂર થયો હતો — ચકાસીને નિર્ણય કરો.",
            "This number was rejected before — verify carefully before deciding.",
          ),
        )
      : null,
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
        (lang === "en" && r.verification.nameEn) || r.verification.name,
        ...(r.verification.reason ? [" · ", r.verification.reason] : []),
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
    r.corrections?.length > 0 &&
      h(
        "p",
        { className: "workflow-status" },
        B(
          "વિગત સુધારાઈ છે (" + r.corrections.length + " વખત)",
          "Details corrected (" + r.corrections.length + "×)",
        ),
      ),
    !correcting &&
      button(B("વિગત સુધારો", "Correct details"), () => setCorrecting(true)),
    correcting &&
      h(
        "div",
        { className: "workflow-correction" },
        h(
          "p",
          null,
          B(
            "જોડાનારની જોડણી કે માહિતી ખોટી હોય તો અહીં સુધારો; કારણ નોંધાય છે.",
            "Fix spelling or details here before deciding; the correction is recorded.",
          ),
        ),
        h(
          "div",
          null,
          field(B("પ્રથમ નામ", "First name"), {
            value: form.firstName,
            maxLength: 60,
            onChange: (e) => setForm({ ...form, firstName: e.target.value }),
          }),
          field(B("મધ્ય નામ / પિતાનું નામ", "Middle name / father's name"), {
            value: form.middleName,
            maxLength: 60,
            onChange: (e) => setForm({ ...form, middleName: e.target.value }),
          }),
          field(B("અટક", "Surname"), {
            value: form.surname,
            maxLength: 60,
            onChange: (e) => setForm({ ...form, surname: e.target.value }),
          }),
          field(B("ફોન નંબર", "Phone number"), {
            value: form.phone,
            inputMode: "numeric",
            maxLength: 13,
            onChange: (e) => setForm({ ...form, phone: e.target.value }),
          }),
          field(B("બીજો નંબર", "Second number"), {
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
              "data-testid": "Corrected location",
              onChange: (e) =>
                setForm({ ...form, currentLocation: e.target.value }),
            }),
          ),
          main &&
            h(
              "label",
              { className: "workflow-field" },
              B("ગામ (બદલાય તો નવા ગામની ચકાસણી ફરી થશે)", "Village (changing it restarts village verification)"),
              h(
                "select",
                {
                  value: form.village,
                  onChange: (e) => setForm({ ...form, village: e.target.value }),
                },
                ...data.villages.map((v) =>
                  h(
                    "option",
                    { key: v.gu, value: v.gu },
                    lang === "gu" ? v.gu : v.en || v.gu,
                  ),
                ),
              ),
            ),
        ),
        h(
          "div",
          { className: "workflow-actions" },
          button(
            B("સુધારો સાચવો", "Save correction"),
            () =>
              act(
                (main ? "admin" : "village") +
                  "/requests/" +
                  r.id +
                  "/correct",
                form,
              ),
            { disabled: busy },
          ),
          button(B("રદ કરો", "Cancel"), () => setCorrecting(false)),
        ),
      ),
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
      "div",
      { className: "workflow-actions" },
      main
        ? button(
            B("અંતિમ મંજૂરી", "Final approval"),
            () => act("admin/requests/" + r.id + "/approve", body),
            {
              disabled: busy || !ready || !confirmed,
            },
          )
        : button(
            B("ચકાસીને આગળ મોકલો", "Verify & forward"),
            () => act("village/requests/" + r.id + "/forward", body),
            { disabled: busy || !confirmed },
          ),
      button(
        B("નામંજૂર કરો", "Reject"),
        () =>
          act(
            (main ? "admin" : "village") + "/requests/" + r.id + "/reject",
            body,
          ),
        { disabled: busy },
      ),
      !main &&
        button(
          B("વિનંતી બંધ કરો", "Close request"),
          () => act("village/requests/" + r.id + "/close", body),
          { disabled: busy },
        ),
    ),
  );
}
// Village-administrator view of their own community members. Every proposal is
// sent to the main administrator for the final decision.
function WorkflowMembers({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const village = data.villageAdminVillage;
  const members = data.members
    .filter((m) => m.village === village)
    .sort(memberNameOrder(lang));
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
      firstName: m.firstName || "",
      middleName: m.middleName || "",
      surname: m.surname || "",
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
    // Server-confirmed proposal state: a clear "forwarded" confirmation so
    // the administrator sees the action was taken and where it is now.
    pending &&
      h(
        "p",
        { className: "workflow-forwarded", role: "status" },
        h("i", {
          className: "ph-duotone ph-check-circle",
          "aria-hidden": true,
        }),
        " ",
        B(
          "મુખ્ય એડમિનને મોકલી દીધું · " +
            (pending.kind === "delete"
              ? "દૂર કરવાની"
              : "માહિતી બદલવાની") +
            " સૂચના મંજૂરી માટે બાકી છે.",
          "Forwarded to the main administrator · the " +
            (pending.kind === "delete" ? "removal" : "change") +
            " proposal is awaiting their decision.",
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
        field(B("નવું પ્રથમ નામ", "New first name"), {
          value: form.firstName,
          maxLength: 60,
          onChange: (e) => setForm({ ...form, firstName: e.target.value }),
        }),
        field(B("નવું મધ્ય નામ / પિતાનું નામ", "New middle name / father's name"), {
          value: form.middleName,
          maxLength: 60,
          onChange: (e) => setForm({ ...form, middleName: e.target.value }),
        }),
        field(B("નવી અટક", "New surname"), {
          value: form.surname,
          maxLength: 60,
          onChange: (e) => setForm({ ...form, surname: e.target.value }),
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
            async () => {
              await act("village/members/" + m.id + "/update", {
                ...form,
                phone2: form.phone2 || "",
                reason,
                identityConfirmed: true,
              });
              // Close the form so the forwarded confirmation is visible.
              setMode(null);
              setReason("");
            },
            { disabled: busy },
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
            async () => {
              await act("village/members/" + m.id + "/delete", {
                reason,
                identityConfirmed: true,
              });
              setMode(null);
              setReason("");
            },
            { disabled: busy },
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
// Village administration: one dropdown selects the village; the card below
// shows that village's current administrator, members and the password reset
// controls. The village list itself is fixed (seven villages) — there is no
// add-village feature any more.
function WorkflowVillageManager({ data, lang, act, busy }) {
  const { h, B, field, button } = workflowTools(lang, busy);
  const [villageId, setVillageId] = React.useState("");
  const villages = data.villages || [];
  const selected = villages.find((x) => x.id === villageId) || villages[0];
  return h(
    "div",
    null,
    h(
      "p",
      null,
      B(
        "ગામ પસંદ કરો — તે ગામના સભ્યો, હાલના એડમિન અને પાસવર્ડ રીસેટ નીચે દેખાશે. ગામની યાદી સાત ગામમાં સ્થિર છે.",
        "Choose a village — its members, current administrator and password reset appear below. The village list is fixed at seven villages.",
      ),
    ),
    h(
      "label",
      { className: "workflow-field" },
      B("ગામ", "Village"),
      h(
        "select",
        {
          value: selected ? selected.id : "",
          "data-testid": "Village select",
          onChange: (e) => setVillageId(e.target.value),
        },
        ...villages.map((x) =>
          h("option", { key: x.id, value: x.id }, bilingual(x.gu, x.en, lang)),
        ),
      ),
    ),
    selected
      ? h(WorkflowAssignment, {
          key: selected.id,
          village: selected,
          data,
          lang,
          act,
          busy,
        })
      : h("p", null, B("ગામ નથી.", "No villages.")),
  );
}
function WorkflowAssignment({ village: v, data, lang, act, busy }) {
  const { h, B, field, button, secretField } = workflowTools(lang, busy);
  const a = data.villageAssignments.find((a) => a.id === v.id);
  const admin = a && data.members.find((m) => m.id === a.memberId);
  const members = data.members
    .filter((m) => m.village === v.gu)
    .sort(memberNameOrder(lang));
  const [selection, setSelection] = React.useState(""),
    [pass, setPass] = React.useState(""),
    [confirmed, setConfirmed] = React.useState(false),
    [firstName, setFirstName] = React.useState(""),
    [middleName, setMiddleName] = React.useState(""),
    [surname, setSurname] = React.useState(""),
    [phone, setPhone] = React.useState(""),
    [location, setLocation] = React.useState(""),
    [resetPass, setResetPass] = React.useState("");
  const name = [firstName, middleName, surname].filter(Boolean).join(" ");
  return h(
    "article",
    { className: "workflow-card" },
    h("h3", null, bilingual(v.gu, v.en, lang)),
    h(
      "p",
      null,
      B("હાલના એડમિન: ", "Current administrator: "),
      admin
        ? bilingual(admin.nameGu, admin.name, lang) + " · " + admin.phone
        : B("નિયુક્ત નથી", "Unassigned"),
    ),
    h(
      "p",
      { className: "workflow-memberlist" },
      members.length
        ? members
            .map((m) => bilingual(m.nameGu, m.name, lang))
            .join(" · ")
        : B("હજુ કોઈ સભ્ય નથી.", "No members yet."),
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
        field(B("પ્રથમ નામ", "First name"), {
          value: firstName,
          required: true,
          maxLength: 60,
          onChange: (e) => setFirstName(e.target.value),
        }),
        field(B("મધ્ય નામ / પિતાનું નામ", "Middle name / father's name"), {
          value: middleName,
          maxLength: 60,
          onChange: (e) => setMiddleName(e.target.value),
        }),
        field(B("અટક", "Surname"), {
          value: surname,
          required: true,
          maxLength: 60,
          onChange: (e) => setSurname(e.target.value),
        }),
        field(B("ફોન નંબર (સાઇન ઇન માટે)", "Phone number (used to sign in)"), {
          value: phone,
          required: true,
          inputMode: "numeric",
          maxLength: 13,
          onChange: (e) => setPhone(e.target.value),
        }),
        field(B("હાલ : સ્થળ (વૈકલપિક)", "Current location (optional)"), {
          value: location,
          maxLength: 240,
          onChange: (e) => setLocation(e.target.value),
        }),
        secretField(
          B("પ્રારંભિક પાસવર્ડ (વ્યક્તિને જણાવો)", "Initial password (share it with the person)"),
          pass,
          setPass,
          { required: true },
        ),
        h(
          "label",
          { className: "workflow-check" },
          h("input", {
            type: "checkbox",
            checked: confirmed,
            onChange: (e) => setConfirmed(e.target.checked),
          }),
          B("વ્યક્તિની ઓળખ ખાતરી કરી છે.", "I have confirmed this person's identity."),
        ),
        h(
          "button",
          { disabled: busy || !confirmed, type: "submit" },
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
            {
              value: selection,
              "data-testid": "New admin select",
              onChange: (e) => setSelection(e.target.value),
            },
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
                  (lang === "gu" ? m.nameGu : m.name) + " · " + m.phone,
                ),
              ),
          ),
        ),
        selection &&
          selection !== "remove" &&
          secretField(B("નવા એડમિનનો પાસવર્ડ", "New administrator's password"), pass, setPass),
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
                (selection !== "remove" && !pass),
            },
          ),
        ),
        h(
          "details",
          { className: "workflow-reset" },
          h("summary", null, B("પાસવર્ડ રીસેટ કરો", "Reset password")),
          secretField(B("નવો પાસવર્ડ", "New password"), resetPass, setResetPass),
          button(
            B("પાસવર્ડ રીસેટ કરો", "Reset password"),
            () =>
              act(
                "admin/village-admins/" +
                  encodeURIComponent(v.id) +
                  "/password",
                {
                  pass: resetPass,
                  identityConfirmed: confirmed,
                },
              ),
            { disabled: busy || !resetPass || !confirmed },
          ),
        ),
      ),
  );
}
