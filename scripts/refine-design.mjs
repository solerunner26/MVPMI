import { UI_COPY } from "../web/ui-copy.mjs";

export function refineDesign(template) {
  template = template.replace(
    '<div role="main" class="app"',
    '<div role="main" class="app" data-screen="{{ screenName }}"',
  );
  template = template.replaceAll("ફરી ��ોકલશો", "ફરી મોકલશો");
  template = template.replace(
    "મૂળ માપ માટે Default દબાવો.",
    "મૂળ માપ માટે મૂળ માપ બટન દબાવો.",
  );
  template = template.replace(
    /<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">(\s*<sc-for list="\{\{ tiles \}\}")/,
    '<div class="admin-dashboard-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">$1',
  );
  // Real human-review status, not a simulated loading timer.
  template = template
    .replace("{{ waitClock }}", "{{ submittedDate }}")
    .replace("{{ waitUnit }}", "{{ ui.submitted }}")
    .replace("રિક્વેસ્ટ પ્રોસેસમાં છે", "એડમિનની મંજૂરીની રાહમાં")
    .replace("Request under process", "Waiting for admin approval")
    .replace(
      "તમારી રિક્વેસ્ટ પ્રોસેસમાં છે, પ્લીઝ થોડી રાહ જુઓ… એકવાર એડમિન અપ્રૂવલ આપશે એટલે તમે બધાની ડિટેલ જોઈ શકશો.",
      "{{ waitBodyGu }}",
    )
    .replace(
      "Your request is under process, please wait… Once the admin approves it you can see everybody's contact information.",
      "{{ waitBodyEn }}",
    );
  template = template
    .replace("width:206px;height:206px;", "width:88px;height:88px;")
    .replace('hint-size="206px,206px"', 'hint-size="88px,88px"');
  template = template
    .replace(
      "એક જ વાર ભરવાનું છે. એડમિન ચેક કરીને મંજૂરી આપશે, પછી તમે બધા સભ્યોના નંબર જોઈ શકશો.",
      "તમારી પોતાની વિગત મોકલો. એડમિન મંજૂરી આપશે પછી તમે સમાજની સંપર્ક યાદી જોઈ શકશો.",
    )
    .replace(
      "Fill it once. After the admin approves you, every member's number is yours to see.",
      "Submit your own details. After admin approval, you can access the community directory.",
    );
  template = template
    .replace("શોધવા માટે ૩ અક્ષર લખો…", "નંબરથી શોધવા ઓછામાં ઓછા ૩ આંકડા લખો.")
    .replace(
      "Type 3 letters to search…",
      "Enter at least 3 digits to search by phone.",
    );
  template = template.replace(
    '<sc-if value="{{ isEditingRequest }}">',
    '<button class="returning-member" onClick="{{ memberHelp }}">{{ ui.returning }}</button><sc-if value="{{ isEditingRequest }}">',
  );
  // Use full-width values: keep a readable phone number on one line at large sizes.
  template = template.replace(
    '<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">',
    '<div class="profile-detail-row" style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">',
  );
  template = template.replace(
    '<div class="en" style="font-size:var(--f-md);font-weight:600;letter-spacing:.05em">{{ n.phone }}</div>',
    '<div class="en phone-number" style="font-size:var(--f-md);font-weight:600">{{ n.phone }}</div>',
  );
  template = template.replace(
    '<div style="display:flex;align-items:center;gap:10px;background:var(--g2);',
    '<div class="contact-number-row" style="display:flex;align-items:center;gap:10px;background:var(--g2);',
  );
  template = template.replace("{{ v.secondary }}", "");
  template = template
    .replace(
      "ગામ પસંદ કરો. ટાઇલ દબાવીને ખેંચીને ક્રમ બદલી શકાય છે.",
      "સંપર્ક જોવા ગામ પસંદ કરો. ક્રમ બદલવા નીચેનું બટન વાપરો.",
    )
    .replace(
      "Pick a village — drag a tile to reorder.",
      "Choose a village to view contacts. Use the reorder controls to change the order.",
    );
  template = template.replace(
    /<div draggable="true"[^>]*>([\s\S]*?)<\/div>\s*<\/sc-for>/,
    (all, body) =>
      `<div class="village-entry"><button class="village-tile" onClick="{{ v.onClick }}" disabled="{{ reordering }}">${body}</button><sc-if value="{{ reordering }}"><div class="reorder-controls"><button onClick="{{ v.moveEarlier }}" disabled="{{ v.first }}" aria-label="{{ v.earlierLabel }}"><i class="ph-duotone ph-arrow-up"></i> {{ ui.earlier }}</button><button onClick="{{ v.moveLater }}" disabled="{{ v.last }}" aria-label="{{ v.laterLabel }}"><i class="ph-duotone ph-arrow-down"></i> {{ ui.later }}</button></div></sc-if></div></sc-for>`,
  );
  template = template.replace(
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">',
    '<div class="reorder-toolbar"><button onClick="{{ toggleReorder }}">{{ reorderLabel }}</button><sc-if value="{{ reordering }}"><button onClick="{{ resetOrder }}">{{ ui.resetOrder }}</button></sc-if><span role="status">{{ reorderStatus }}</span></div><div class="village-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">',
  );
  const start = template.indexOf('<sc-if value="{{ showFabs }}">');
  const end = template.indexOf('<sc-if value="{{ picker }}">', start);
  if (start < 0 || end < 0) throw new Error("Utility navigation not found");
  template =
    template.slice(0, start) +
    `
    <nav class="utility-bar" aria-label="{{ ui.preferences }}">
      <button onClick="{{ toggleLang }}" title="Language"><i class="ph-duotone ph-translate"></i> {{ languageSwitch }}</button>
      <button onClick="{{ openPreferences }}" data-testid="Reading settings">{{ ui.textSize }}</button>
      <button onClick="{{ toggleTheme }}" title="Theme">{{ themeLabel }}</button>
      <button onClick="{{ memberHelp }}" data-testid="Member help">{{ ui.help }}</button>
    </nav>
    <sc-if value="{{ preferencesOpen }}"><div class="preferences-scrim"><section role="dialog" aria-modal="true" aria-label="{{ ui.preferences }}" class="preferences-panel" tabindex="-1">
      <h2>{{ ui.preferences }}</h2><div class="language-options" role="group" aria-label="{{ ui.language }}"><button onClick="{{ chooseGujarati }}" aria-pressed="{{ guSelected }}">ગુજરાતી</button><button onClick="{{ chooseEnglish }}" aria-pressed="{{ enSelected }}">English</button></div>
      <h3>{{ ui.textSize }}</h3><div class="text-size-options" role="group" aria-label="{{ ui.textSize }}"><sc-for list="{{ textSizes }}" as="size"><button class="text-size-option" aria-label="{{ size.accessibleLabel }}" aria-pressed="{{ size.active }}" onClick="{{ size.onClick }}">{{ size.accessibleLabel }}</button></sc-for></div>
      <button class="close-preferences" onClick="{{ closePreferences }}">{{ ui.close }}</button>
    </section></div></sc-if>
  ` +
    template.slice(end);
  template = template.replace(
    'aria-label="{{ size.label }}"',
    'aria-label="{{ size.accessibleLabel }}"',
  );
  template = template
    .replace(
      "પાસવર્ડ બદલો · Your password is over 60 days old. Reset it.",
      "{{ ui.passwordDue }}",
    )
    .replace(
      "કનેક્શન તપાસો · Connection lost — tap to retry",
      "{{ ui.connection }}",
    )
    .replace("રાહ જુઓ · Please wait…", "{{ ui.busy }}");
  template = template.replace(
    "લોગિન થઈ શક્યું નથી. નીચેનો સંદેશ તપાસો.",
    "{{ loginErrorMessageGu }}",
  );
  // Translate tooltips, accessibility names, and placeholders, not just visible labels.
  template = template.replace(
    /(title|aria-label|placeholder)="([^"{}]+)"/g,
    (all, attr, raw) => {
      if (raw === "MVPMl") return all;
      const english = raw.includes(" · ") ? raw.split(" · ").at(-1) : raw;
      const key = Object.keys(UI_COPY).find(
        (key) => UI_COPY[key][1] === english,
      );
      if (!key) return all;
      return (
        `${attr}="{{ ui.${key} }}"` +
        (attr === "title" ? ` data-testid="${english}"` : "")
      );
    },
  );
  // Remove a frozen shimmer overlay that obscured the waiting-state text.
  template = template.replace(
    /<div style="position:absolute;top:0;left:0;width:60%;height:100%;background:linear-gradient[^"]*"><\/div>/,
    "",
  );
  const headingStart = template.indexOf(
    '<div style="width:100%;box-sizing:border-box;padding:26px 18px 22px;',
  );
  const headingEnd = template.indexOf(
    '<div class="bi" style="align-items:center;text-align:center;font-size:var(--f-sm);',
    headingStart,
  );
  if (headingStart >= 0 && headingEnd > headingStart)
    template =
      template.slice(0, headingStart) +
      '<section class="admin-signin-heading"><i class="ph-duotone ph-lock-key"></i><h1>{{ ui.adminPanel }}</h1><p>{{ ui.restricted }}</p></section>' +
      template.slice(headingEnd);
  template = template.replace(
    "{{ k.label }}</button>",
    '<sc-if value="{{ k.isBackspace }}"><i class="ph-duotone ph-backspace"></i></sc-if><sc-if value="{{ !k.isBackspace }}">{{ k.label }}</sc-if></button>',
  );
  template = template.replace(
    'class="en" style="font-weight:800;opacity:.75">{{ statTotal }}',
    'class="en directory-count" style="font-weight:800;opacity:1">{{ statTotal }}',
  );
  const memberStart = template.indexOf('<sc-for list="{{ members }}"');
  const memberEnd = template.indexOf("</sc-for>", memberStart);
  let memberPart = template.slice(memberStart, memberEnd);
  memberPart = memberPart.replace(
    "<div style=",
    '<div class="admin-member-row" style=',
  );
  memberPart = memberPart.replace(
    '<button onClick="{{ m.onAdminEdit }}"',
    '<button class="recovery-issue-button" onClick="{{ m.onRecover }}" data-testid="Issue recovery">{{ ui.issueRecovery }}</button><button onClick="{{ m.onAdminEdit }}"',
  );
  template =
    template.slice(0, memberStart) + memberPart + template.slice(memberEnd);
  template = template.replace(
    '<sc-if value="{{ preferencesOpen }}">',
    `
    <sc-if value="{{ recoveryOpen }}"><div class="preferences-scrim"><section role="dialog" aria-modal="true" aria-label="{{ ui.help }}" class="preferences-panel recovery-panel" tabindex="-1">
      <h2>{{ ui.help }}</h2><p>{{ ui.helpBody }}</p>
      <sc-if value="{{ recoveryEligible }}"><label>{{ ui.recoveryPhone }}<input data-testid="Recovery phone" value="{{ recoveryPhone }}" onInput="{{ setRecoveryPhone }}" inputmode="numeric" autocomplete="tel-national" maxlength="10"></label>
      <label>{{ ui.recoveryCode }}<input data-testid="Recovery code" value="{{ recoveryCode }}" onInput="{{ setRecoveryCode }}" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="48"></label>
      <button class="close-preferences" onClick="{{ redeemRecovery }}" disabled="{{ busy }}">{{ ui.recoverAccess }}</button></sc-if>
      <sc-if value="{{ recoveryError }}"><p role="alert">{{ recoveryError }}</p></sc-if>
      <button class="close-preferences" onClick="{{ closeRecovery }}">{{ ui.helpAction }}</button>
    </section></div></sc-if>
    <sc-if value="{{ showRecoveryIssued }}"><div class="preferences-scrim"><section role="dialog" aria-modal="true" aria-label="{{ ui.recoveryIssued }}" class="preferences-panel recovery-panel" tabindex="-1">
      <h2>{{ ui.recoveryIssued }}</h2><p>{{ recoveryMember }}</p><p>{{ ui.recoveryWarning }}</p>
      <output class="recovery-token" data-testid="Issued recovery code">{{ recoveryIssued }}</output>
      <p>{{ ui.recoveryExpires }}: {{ recoveryExpiry }}</p><sc-if value="{{ recoveryCodeExpired }}"><p role="alert">{{ ui.recoveryExpired }}</p></sc-if><button class="close-preferences" onClick="{{ copyRecovery }}" disabled="{{ recoveryCodeExpired }}">{{ ui.copyCode }}</button>
      <p role="status">{{ copyStatus }}</p><button class="close-preferences" onClick="{{ closeIssuedRecovery }}">{{ ui.close }}</button>
    </section></div></sc-if>
    <sc-if value="{{ preferencesOpen }}">`,
  );
  return template.replace(/<i\b/g, '<i aria-hidden="true"');
}
