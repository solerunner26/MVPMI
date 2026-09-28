// Design and behaviour corrections from the September 2026 audit, applied to
// the frozen source design at build time (the original HTML stays unchanged).
// Every replacement is checked, so a changed design fails the build loudly
// instead of silently skipping a fix.

function once(text, from, to, label) {
  if (!text.includes(from)) throw new Error("Audit design contract changed: " + label);
  return text.replace(from, to);
}

// Reorder a three-part name block to First → Middle (father's) → Surname,
// one field per row, and make the middle name required.
function nameBlock(template, prefix) {
  const first = `{{ ${prefix}.firstName }}`;
  const at = template.indexOf(first);
  if (at < 0) throw new Error("Audit design contract changed: name block " + prefix);
  const rowStart = template.lastIndexOf('<div style="display:flex;gap:8px">', at);
  const rowEnd = template.indexOf("</div>\n", template.indexOf(`{{ ${prefix}.surname }}`)) + "</div>\n".length;
  const row = template.slice(rowStart, rowEnd);
  const labels = row.match(/<label[\s\S]*?<\/label>/g);
  if (!labels || labels.length !== 2)
    throw new Error("Audit design contract changed: name labels " + prefix);
  const middleStart = template.indexOf("<label", rowEnd);
  const middleEnd = template.indexOf("</label>", middleStart) + "</label>".length;
  let middle = template.slice(middleStart, middleEnd);
  if (!middle.includes(`{{ ${prefix}.middleName }}`))
    throw new Error("Audit design contract changed: middle name " + prefix);
  middle = middle
    .replace("મધ્ય નામ / પિતાનું નામ (વૈકલ્પિક)", "મધ્ય નામ / પિતાનું નામ")
    .replace("Middle name / father’s name (optional)", "Middle name / father’s name");
  const full = (label) =>
    label.replace(/<label style="flex:[\d.]+;/, '<label style="');
  return (
    template.slice(0, rowStart) +
    full(labels[0]) +
    "\n" +
    middle +
    "\n" +
    full(labels[1]) +
    template.slice(middleEnd)
  );
}

export function auditTemplate(template) {
  // Name order: First → Middle → Surname (signup and profile edit).
  template = nameBlock(template, "form");
  template = nameBlock(template, "edit");

  // Lock screen: title/help change for PIN creation vs unlock, the error
  // shows the server's message, keys are labelled for screen readers, and
  // the "Forgot PIN" panel is rendered inside the lock screen.
  template = once(
    template,
    '<span class="gu">એપ લોક · પિન નાખો</span><span class="en">App lock · Enter PIN</span></div>',
    '<span class="gu">{{ lockTitleGu }}</span><span class="en">{{ lockTitleEn }}</span></div><sc-if value="{{ showLockHint }}"><div class="bi lock-hint" style="align-items:center;text-align:center;font-size:var(--f-sm);color:var(--ink2);max-width:320px;text-wrap:pretty"><span class="gu">{{ lockHintGu }}</span><span class="en">{{ lockHintEn }}</span></div></sc-if>',
    "lock title",
  );
  template = once(
    template,
    '<span class="gu">ખોટો પિન. ફરી પ્રયાસ કરો.</span><span class="en">Wrong PIN. Try again.</span>',
    '<span class="gu">{{ lockErrorGu }}</span><span class="en">{{ lockErrorEn }}</span>',
    "lock error",
  );
  template = once(
    template,
    '<button onClick="{{ k.onClick }}" disabled="{{ k.disabled }}" style="height:64px',
    '<button onClick="{{ k.onClick }}" disabled="{{ k.disabled }}" aria-label="{{ k.accessibleLabel }}" style="height:64px',
    "lock keypad labels",
  );
  const forgot =
    '<button onClick="{{ lockForgot }}" class="en" style="border:0;background:none;color:var(--ink2);font:inherit;font-size:var(--f-sm);cursor:pointer;padding:10px"><span class="bi"><span class="gu">પિન ભૂલી ગયા?</span><span class="en">Forgot PIN?</span></span></button>';
  template = once(
    template,
    forgot,
    '<sc-if value="{{ showLockForgot }}">' +
      forgot.replace("padding:10px", "padding:14px 18px;font-weight:700;text-decoration:underline") +
      "</sc-if>{{ pinResetPanel }}",
    "lock forgot",
  );
  return template;
}

// Applied after the other design adapters (their markup is final by then).
export function auditTemplateLate(template) {
  // Liquid Glass design layer (web/liquid-ios.css) is scoped to .app.lq.
  template = once(template, 'class="app"', 'class="app lq"', "app root class");
  // Both keypads (hidden gate and app lock) share the PIN key design.
  template = template.replaceAll(
    '<div style="display:grid;grid-template-columns:repeat(3,72px);',
    '<div class="access-keypad" style="display:grid;grid-template-columns:repeat(3,72px);',
  );
  // Reading settings: the PIN section only for signed-in members/village
  // administrators; a notifications section for everyone.
  template = once(
    template,
    '<h3 class="settings-label">{{ copy.appLock }}</h3>{{ appLockPanel }}',
    '<sc-if value="{{ showPinSettings }}"><h3 class="settings-label">{{ copy.appLock }}</h3>{{ appLockPanel }}</sc-if><h3 class="settings-label">{{ copy.notifications }}</h3>{{ notificationPanel }}',
    "settings sections",
  );
  // Admin Backup tab: automatic encrypted Google Drive backup panel.
  const exportsGrid = /(<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">\s*<sc-for list="\{\{ exports \}\}")/;
  if (!exportsGrid.test(template)) throw new Error("Audit design contract changed: backup exports grid");
  template = template.replace(exportsGrid, '<div class="drive-backup-slot" data-glass="1" style="border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:6px">{{ driveBackupPanel }}</div>$1');
  return template;
}

export function auditLogic(logic) {
  // Pasted numbers keep the ten-digit mobile number (+91 / 0 prefixes are
  // removed instead of cutting the last digits off).
  logic = once(
    logic,
    "[k]: dg(e.target.value).slice(0, 10) } }))",
    "[k]: phoneDigits(e.target.value) } }))",
    "signup phone input",
  );
  logic = once(
    logic,
    "phone: dg(e.target.value).slice(0, 10) } }))",
    "phone: phoneDigits(e.target.value) } }))",
    "edit phone input",
  );
  logic = once(
    logic,
    "phone2: dg(e.target.value).slice(0, 10) } }))",
    "phone2: phoneDigits(e.target.value) } }))",
    "edit phone2 input",
  );
  // Middle (father's) name is required with first name and surname.
  logic = once(
    logic,
    "else if (!String(f.surname || '').trim()) e.name = this.L('અટક લખો', 'Enter the surname');",
    "else if (!String(f.middleName || '').trim()) e.name = this.L('મધ્ય નામ / પિતાનું નામ લખો', 'Enter the middle name / father’s name');\n      else if (!String(f.surname || '').trim()) e.name = this.L('અટક લખો', 'Enter the surname');",
    "middle name required",
  );
  return logic;
}
