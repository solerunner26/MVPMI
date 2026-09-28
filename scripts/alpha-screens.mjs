// Alpha audit (Sections 2–8): the member-facing screens (login, registration,
// pending, directory, settings, profile, lock) are now rendered by the React
// components in web/alpha-*.mjs through {{ appScreen }} / {{ appOverlay }}.
// This step removes the old template screens they replace, including the
// hidden sun-logo gate, the admin login and the in-app password recovery, so
// no dead button or unreachable screen stays in the app.
function blockEnd(html, start, tag) {
  const re = new RegExp("</?" + tag + "\\b[^>]*>", "g");
  re.lastIndex = start;
  let depth = 0,
    m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (!depth) return re.lastIndex;
  }
  throw new Error("Unbalanced " + tag + " in template");
}
function removeBlock(html, marker, tag = "sc-if", required = true) {
  const start = html.indexOf(marker);
  if (start < 0) {
    if (required) throw new Error("Template marker missing: " + marker);
    return { html, at: -1 };
  }
  return { html: html.slice(0, start) + html.slice(blockEnd(html, start, tag)), at: start };
}

export function alphaScreens(html) {
  // 1. The old shared header (sun-logo gate, village-admin sign-in, theme and
  //    reading buttons) — every alpha screen has its own slim top bar.
  let r = removeBlock(html, '<header class="main-header"', "header");
  html = r.html;
  r = removeBlock(html, '<sc-if value="{{ isMainAdmin }}"><button class="workflow-launch"');
  html = r.html;
  html = html.replace("{{ villageLoginPanel }}", "");
  // Connection banner: the alpha screens show their own; keep it for the
  // admin dashboard only.
  html = html.replace('<sc-if value="{{ connectionError }}">', '<sc-if value="{{ adminConnectionError }}">');
  // 2. Old member-facing screens.
  let insertAt = -1;
  for (const screen of [
    "isSignup",
    "isPending",
    "isDirectory",
    "isMyProfile",
    "isEditProfile",
    "isGate",
    "isAppLock",
    "isAdminLogin",
    "isAdminForgot",
  ]) {
    r = removeBlock(html, '<sc-if value="{{ ' + screen + ' }}"');
    html = r.html;
    if (insertAt < 0 || r.at < insertAt) insertAt = r.at;
  }
  html = html.slice(0, insertAt) + "{{ appScreen }}" + html.slice(insertAt);
  // 3. Old sheets replaced by alpha dialogs (settings, village picker,
  //    recovery code, contact sheet).
  for (const marker of [
    '<sc-if value="{{ preferencesOpen }}">',
    '<sc-if value="{{ picker }}">',
    '<sc-if value="{{ recoveryNotice }}">',
    '<sc-if value="{{ dial }}">',
  ])
    html = removeBlock(html, marker, "sc-if", false).html;
  // 4. Admin dashboard: Back is always shown (home → Member Directory),
  //    no password-age reminder (it pointed at the removed recovery page),
  //    no recovery-code card.
  html = html.replace(
    /<sc-if value="\{\{ inSection \}\}">\s*<button aria-label="\{\{ ui\.backDashboard \}\}" onClick="\{\{ adminHome \}\}"([^>]*)>([\s\S]*?)<\/button>\s*<\/sc-if>/,
    (all, attrs, body) =>
      '<button class="alpha-admin-back" aria-label="{{ adminBackLabel }}" data-testid="Admin back" onClick="{{ adminBack }}"' + attrs + ">" + body + "</button>",
  );
  if (!html.includes('onClick="{{ adminBack }}"')) throw new Error("Admin back button not patched");
  html = html.replace(/<sc-if value="\{\{ passwordDue \}\}">[\s\S]*?<\/sc-if>/, "");
  const recovery = html.indexOf('onClick="{{ regenerateRecovery }}"');
  if (recovery >= 0) {
    const cardStart = html.lastIndexOf('<div style="background:var(--g);border:1px solid var(--gbd);border-radius:20px;padding:14px;display:flex;gap:12px;align-items:flex-start;box-shadow:var(--shadow)">', recovery);
    html = html.slice(0, cardStart) + html.slice(blockEnd(html, cardStart, "div"));
  }
  // Admin "Sign out" in the dashboard ends ADMIN mode only.
  html = html.replace('onClick="{{ logout }}" title="{{ ui.signout }}" data-testid="Sign out"', 'onClick="{{ logout }}" title="{{ adminLogoutLabel }}" aria-label="{{ adminLogoutLabel }}" data-testid="Admin logout"');
  // 5. Dialogs of the alpha screens sit above everything (after the toast).
  const toast = html.indexOf('<sc-if value="{{ toast }}">');
  if (toast < 0) throw new Error("Toast marker missing");
  // Toasts ("Saved", "PIN changed successfully") are announced and stay on
  // top of the new screens and dialogs.
  const toastBox = html.indexOf("<div ", toast);
  html =
    html.slice(0, toastBox) +
    '<div role="status" aria-live="polite" data-testid="Toast" class="alpha-toast-host" ' +
    html.slice(toastBox + 5);
  const afterToast = blockEnd(html, toast, "sc-if");
  html = html.slice(0, afterToast) + "{{ appOverlay }}" + html.slice(afterToast);
  for (const gone of ["secretTap", "goAdminForgot", "regenerateRecovery", "doLogin", "memberHelp", "openVillageAdminHeader", "openPreferences"])
    if (html.includes("{{ " + gone + " }}")) throw new Error("Removed handler still in template: " + gone);
  return html;
}
