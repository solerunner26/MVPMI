function end(html, start, tag = "div") {
  if (start < 0) throw new Error("Village workflow template marker missing");
  const re = new RegExp("</?" + tag + "\\b[^>]*>", "g");
  re.lastIndex = start;
  let depth = 0,
    m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (!depth) return re.lastIndex;
  }
  throw new Error("Unbalanced village workflow template");
}
function remove(html, start, tag) {
  return html.slice(0, start) + html.slice(end(html, start, tag));
}
export function villageWorkflow(html) {
  for (const c of ["language-options", "theme-options"]) {
    const at = html.indexOf('<div class="' + c + '"');
    const heading = html.lastIndexOf('<h3 class="settings-label"', at);
    html = html.slice(0, heading) + html.slice(end(html, at));
  }
  html = html.replace(
    '<button class="preferences-trigger" onClick="{{ openPreferences }}"',
    '<button class="theme-trigger" data-testid="Theme" onClick="{{ toggleTheme }}" title="{{ ui.theme }}" aria-label="{{ ui.theme }}"><i aria-hidden="true" class="{{ themeIcon }}"></i></button><button class="preferences-trigger" onClick="{{ openPreferences }}"',
  );
  const headerEnd =
    html.indexOf("</header>", html.indexOf('<header class="main-header"')) + 9;
  html =
    html.slice(0, headerEnd) +
    '<sc-if value="{{ isMainAdmin }}"><button class="workflow-launch" data-testid="Village management" onClick="{{ openWorkflow }}">{{ workflowLabel }}</button></sc-if>{{ villageLoginPanel }}{{ allAdminsPanel }}{{ workflowPanel }}' +
    html.slice(headerEnd);
  for (const [handler, value] of [
    ["setVillage", "signupVillage"],
    ["setEditVillage", "editVillageField"],
  ]) {
    const input = html.indexOf('onInput="{{ ' + handler + ' }}"');
    if (input < 0) throw new Error("Missing village input " + handler);
    const start = html.lastIndexOf("<label", input),
      finish = end(html, start, "label");
    html = html.slice(0, start) + "{{ " + value + " }}" + html.slice(finish);
  }
  // Location is independent of whether a secondary phone was supplied.
  html = html
    .replace("{{ signupVillage }}", "{{ signupLocation }}{{ signupVillage }}")
    .replace(
      "{{ editVillageField }}",
      "{{ editLocation }}{{ editVillageField }}",
    );
  html = html.replace(
    '<div class="entry-intro">',
    '{{ applicationFeedback }}<div class="entry-intro">',
  );
  const pending = html.indexOf('<sc-if value="{{ isPending }}"');
  const scroll = html.indexOf('<div class="noscroll"', pending),
    body = html.indexOf(">", scroll) + 1;
  html = html.slice(0, body) + "{{ applicationFeedback }}" + html.slice(body);
  html = html.replace(
    '<div class="member-name">{{ m.primaryName }}</div>',
    '<div class="member-name">{{ m.primaryName }}</div><sc-if value="{{ m.currentLocation }}"><div class="current-location">હાલ : {{ m.currentLocation }}</div></sc-if>',
  );
  for (const state of ["recoveryOpen", "recoveryIssued"]) {
    const start = html.indexOf('<sc-if value="{{ ' + state + ' }}">');
    if (start >= 0) html = remove(html, start, "sc-if");
  }
  html = html.replace(
    /<button class="recovery-issue-button"[\s\S]*?<\/button>/,
    "",
  );
  return html;
}
