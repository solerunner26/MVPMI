import { existsSync, readFileSync } from "node:fs";

// The community logo (goddess image) is embedded as a data URI at build time;
// until the artwork is supplied the sixteen-ray Sun mark remains in place.
const logoAsset = "web/assets/community-logo.png";
let brandLogo =
  '<dc-import name="SunMark" hint-size="46px,46px" style="width:46px;height:46px"></dc-import>';
if (existsSync(logoAsset))
  brandLogo =
    '<img class="brand-logo" alt="" src="data:image/png;base64,' +
    readFileSync(logoAsset).toString("base64") +
    '">';
// Structural redesign layered over the functional renderer, not a new app.
function find(html, needle, from = 0) {
  const index = html.indexOf(needle, from);
  if (index < 0) throw new Error("Modern design contract missing: " + needle);
  return index;
}
function before(html, needle, from) {
  const index = html.lastIndexOf(needle, from);
  if (index < 0)
    throw new Error("Modern design preceding contract missing: " + needle);
  return index;
}
function endOfElement(html, start, tag = "div") {
  const re = new RegExp("</?" + tag + "\\b[^>]*>", "g");
  re.lastIndex = start;
  let depth = 0,
    match;
  while ((match = re.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (!depth) return re.lastIndex;
  }
  throw new Error("Unbalanced redesign element: " + tag);
}
function replaceElement(html, start, replacement, tag = "div") {
  if (start < 0) throw new Error("Missing redesign element");
  return (
    html.slice(0, start) +
    replacement +
    html.slice(endOfElement(html, start, tag))
  );
}
export function modernDesign(html) {
  // Remove the rejected permanent bottom utility bar completely.
  const utility = find(html, '<nav class="utility-bar"');
  html = replaceElement(html, utility, "", "nav");
  // The global header replaces the signup/pending headers and directory brand row.
  for (const screen of ["isSignup", "isPending"]) {
    const section = find(html, '<sc-if value="{{ ' + screen + ' }}"');
    const header = find(html, '<div class="app-header"', section);
    html = replaceElement(html, header, "");
  }
  let directory = find(html, '<sc-if value="{{ isDirectory }}">');
  let logo = find(html, 'onClick="{{ secretTap }}"', directory);
  const brandRow = before(html, "<div ", logo);
  html = replaceElement(
    html,
    brandRow,
    `<div class="directory-heading"><div><h1>{{ directoryHeading }}</h1><sc-if value="{{ heroVillage }}"><p class="hero-village"><i aria-hidden="true" class="ph-duotone ph-shield-check"></i>{{ heroVillage }}</p></sc-if></div><div class="directory-actions"><sc-if value="{{ showDashboard }}"><button class="dashboard-trigger" onClick="{{ openWorkflow }}" data-testid="Dashboard" title="{{ dashboardLabel }}" aria-label="{{ dashboardLabel }}"><i aria-hidden="true" class="ph-duotone ph-squares-four"></i><sc-if value="{{ pendingCount }}"><span class="dash-badge">{{ pendingCount }}</span></sc-if></button></sc-if><button class="profile-trigger" onClick="{{ goMyProfile }}" data-testid="My profile" title="{{ ui.profile }}" aria-label="{{ ui.profile }}"><i aria-hidden="true" class="ph-duotone ph-user-circle"></i></button></div></div>`,
  );
  // Make the directory tooling a coherent search + filter region.
  directory = find(html, '<sc-if value="{{ isDirectory }}">');
  const toolsStart = find(
    html,
    '<div style="padding:14px 16px 10px;',
    directory,
  );
  html =
    html.slice(0, toolsStart) +
    html.slice(toolsStart).replace("<div ", '<div class="directory-tools" ');
  const search = find(html, 'onInput="{{ setQuery }}"', directory);
  const searchBox = before(html, "<div ", search);
  html =
    html.slice(0, searchBox) +
    html.slice(searchBox).replace("<div ", '<div class="directory-search" ');
  // Replace the old all-members button with a real two-state navigation segment.
  const all = find(html, 'onClick="{{ showAllMembers }}"');
  const allButtonStart = before(html, "<button", all);
  const previousIf = before(
    html,
    '<sc-if value="{{ inVillageView }}">',
    allButtonStart,
  );
  const segmentStart = before(html, "<div ", previousIf);
  html = replaceElement(
    html,
    segmentStart,
    `<div class="directory-segments" role="group" aria-label="{{ ui.directoryView }}"><button onClick="{{ backToTiles }}" aria-pressed="{{ villagesSelected }}"><span class="segment-sun" aria-hidden="true"><dc-import name="SunMark" hint-size="17px,17px" style="width:17px;height:17px"></dc-import></span>{{ copy.villages }}</button><button onClick="{{ showAllMembers }}" aria-pressed="{{ allMembersSelected }}"><i aria-hidden="true" class="ph-duotone ph-users-three"></i>{{ copy.allMembers }}<span class="segment-count">{{ statTotal }}</span></button></div>`,
  );
  // The summary row has only count and place; the place already leads the page.
  const count = find(html, "{{ countLabel }}", directory);
  const countDiv = before(html, "<div ", count);
  const summary = before(html, "<div ", countDiv - 1);
  html = replaceElement(
    html,
    summary,
    '<div class="directory-summary">{{ countLabel }}</div>',
  );
  const reorder = find(html, '<div class="reorder-toolbar"');
  const toolbar = html
    .slice(reorder, endOfElement(html, reorder))
    .replace(
      '<button onClick="{{ toggleReorder }}" data-glass="2">{{ reorderLabel }}</button>',
      '<button class="reorder-trigger" onClick="{{ toggleReorder }}" aria-pressed="{{ reordering }}" aria-label="{{ reorderActionLabel }}" title="{{ reorderActionLabel }}"><i aria-hidden="true" class="ph-duotone ph-arrows-down-up"></i><sc-if value="{{ reordering }}">{{ copy.done }}</sc-if></button>',
    );
  const intro = before(html, '<div class="bi"', reorder);
  const introEnd = endOfElement(html, reorder);
  html =
    html.slice(0, intro) +
    `<div class="collection-heading"><h2>{{ copy.exploreVillages }}</h2>${toolbar}</div>` +
    html.slice(introEnd);
  // Replace plain village rectangles with the uniform community tile: the
  // rotating Sun mark, name, member count — same design as every other tile.
  const tile = find(html, '<button class="village-tile"');
  html = replaceElement(
    html,
    tile,
    `<button class="village-tile collection-tile mvpmi-tile" onClick="{{ v.onClick }}" disabled="{{ reordering }}"><i class="tile-stripe" aria-hidden="true"></i>
    <div class="tile-top"><span class="tile-sun" aria-hidden="true"><dc-import name="SunMark" hint-size="30px,30px" style="width:30px;height:30px"></dc-import></span><span class="tile-count">{{ v.count }}</span></div>
    <div class="bi tile-label">{{ v.primary }}</div>
    <div class="bi tile-hint"><span class="gu" lang="gu">સભ્યો</span><span class="en" lang="en">{{ v.unitEn }}</span></div>
  </button>`,
    "button",
  );
  // Member rows become editorial identity cards with labelled contact actions.
  const members = find(html, '<sc-for list="{{ sec.items }}"');
  const card = find(html, '<div style="background:var(--g)', members);
  html =
    html.slice(0, card) +
    html.slice(card).replace("<div ", '<div class="member-card" ');
  for (const [action, key] of [
    ["onCall", "call"],
    ["onWhats", "whatsapp"],
  ]) {
    const at = find(html, 'onClick="{{ n.' + action + ' }}"');
    const start = before(html, "<a ", at),
      end = find(html, "</a>", at);
    let link = html.slice(start, end);
    link =
      link.replace("<a ", `<a class="contact-action contact-${key}" `) +
      `<span>{{ copy.${key} }}</span>`;
    html = html.slice(0, start) + link + html.slice(end);
  }
  html = html.replace(
    '<div class="bi" style="font-weight:700;font-size:var(--f-md)"><span class="gu" lang="gu">{{ m.nameGu }}</span><span class="en" lang="en">{{ m.name }}</span></div>',
    '<div class="member-name">{{ m.primaryName }}</div>',
  );
  // Classify the remaining screens for a unified design system, without changing handlers.
  html = html.replace(
    /<div([^>]*style="[^"]*border-bottom:1px solid var\(--gbd\)[^"]*"[^>]*)>/g,
    (tag, attrs) =>
      tag.includes("class=")
        ? tag
        : '<div class="context-header"' + attrs + ">",
  );
  html = html.replace(
    '<div style="flex:1;display:flex;flex-direction:column;min-height:0;align-items:center;justify-content:center;padding:24px;',
    '<div class="access-gate" style="flex:1;display:flex;flex-direction:column;min-height:0;align-items:center;justify-content:center;padding:24px;',
  );
  html = html.replace(
    '<div style="display:grid;grid-template-columns:repeat(3,72px);',
    '<div class="access-keypad" style="display:grid;grid-template-columns:repeat(3,72px);',
  );
  // Add a strong editorial introduction to enrollment, rather than another panel.
  const signup = find(html, '<sc-if value="{{ isSignup }}"');
  const title = find(
    html,
    '<div class="bi" style="padding:2px 4px 6px;',
    signup,
  );
  html = replaceElement(
    html,
    title,
    `<div class="entry-intro"><p class="eyebrow">{{ copy.welcome }}</p><h1>{{ copy.communityName }}</h1></div>`,
  );
  // Preferences use native segmented buttons, not four permanently-visible tools.
  const prefs = find(html, '<sc-if value="{{ preferencesOpen }}">');
  const panel = find(html, '<section role="dialog"', prefs);
  const panelEnd = endOfElement(html, panel, "section");
  let content = html.slice(panel, panelEnd);
  content = content.replace(
    "<h2>{{ copy.preferences }}</h2>",
    '<header class="sheet-heading"><div><h2>{{ copy.preferences }}</h2></div><button class="sheet-close" aria-label="{{ ui.dismissSettings }}" onClick="{{ closePreferences }}"><i aria-hidden="true" class="ph-duotone ph-x"></i></button></header><h3 class="settings-label">{{ copy.language }}</h3>',
  );
  content = content
    .replace(
      '<p class="reading-hint">',
      '<p id="preferences-size-help" class="reading-hint sr-only">',
    )
    .replace(
      'aria-valuetext="{{ fsLabel }}"',
      'aria-valuetext="{{ fsLabel }}" aria-describedby="preferences-size-help"',
    )
    .replace(
      "<p>{{ copy.effectsHelp }}</p>",
      '<p id="preferences-effects-help" class="sr-only">{{ copy.effectsHelp }}</p>',
    )
    .replace(
      'role="switch"',
      'role="switch" aria-describedby="preferences-effects-help"',
    );
  const languageEnd =
    find(content, "</div>", find(content, 'class="language-options"')) + 6;
  content =
    content.slice(0, languageEnd) +
    `<h3 class="settings-label">{{ copy.theme }}</h3><div class="theme-options" role="group" aria-label="{{ ui.theme }}"><button onClick="{{ chooseLight }}" aria-pressed="{{ !isDark }}" data-testid="Light theme"><i aria-hidden="true" class="ph-duotone ph-sun"></i>{{ copy.lightTheme }}</button><button onClick="{{ chooseDark }}" aria-pressed="{{ isDark }}" data-testid="Dark theme"><i aria-hidden="true" class="ph-duotone ph-moon"></i>{{ copy.darkTheme }}</button></div>` +
    content.slice(languageEnd);
  content = content.replace(
    '<button class="close-preferences"',
    '<button class="settings-help" onClick="{{ memberHelp }}" data-testid="Member help"><i aria-hidden="true" class="ph-duotone ph-question"></i>{{ copy.help }}<i aria-hidden="true" class="ph-duotone ph-arrow-up-right"></i></button><button class="close-preferences"',
  );
  html = html.slice(0, panel) + content + html.slice(panelEnd);
  const frame = find(html, '<div style="height:100%;');
  const frameStart = find(html, ">", frame) + 1;
  html =
    html.slice(0, frameStart) +
    `<header class="main-header"><div class="brand-lockup"><button class="brand-sun" title="{{ communityName }}" data-testid="Brand logo" onClick="{{ secretTap }}">${brandLogo}</button></div><div class="header-actions"><sc-if value="{{ showAllAdmins }}"><button class="preferences-trigger" data-testid="All admins" onClick="{{ openAllAdmins }}" title="{{ ui.allAdmins }}" aria-label="{{ ui.allAdmins }}"><i aria-hidden="true" class="ph-duotone ph-users-three"></i></button></sc-if><sc-if value="{{ showVillageAdminButton }}"><button class="preferences-trigger" data-testid="Village admin sign in" onClick="{{ openVillageAdminHeader }}" title="{{ villageAdminButtonLabel }}" aria-label="{{ villageAdminButtonLabel }}"><i aria-hidden="true" class="ph-duotone ph-shield-check"></i></button></sc-if><button class="language-trigger" onClick="{{ toggleLang }}" data-testid="Language" aria-label="{{ ui.language }}" title="{{ ui.language }}"><span class="lang-target" aria-hidden="true">{{ languageSwitchShort }}</span></button><button class="preferences-trigger" onClick="{{ openPreferences }}" data-testid="Reading settings" title="{{ ui.preferences }}" aria-label="{{ ui.preferences }}"><i aria-hidden="true" class="ph-duotone ph-sliders-horizontal"></i></button></div></header>` +
    html.slice(frameStart);
  html = html.replace(
    '<div class="bi" style="font-weight:700;font-size:var(--f-lg)"><span class="gu" lang="gu">{{ me.nameGu }}</span><span class="en" lang="en">{{ me.name }}</span></div>',
    '<div class="profile-name">{{ profileName }}</div>',
  );
  const repeatedRestriction = before(
    html,
    "<div",
    find(html, "Authorised admins only"),
  );
  html = replaceElement(html, repeatedRestriction, "");
  const dialStart = find(
    html,
    "<div ",
    find(html, '<sc-if value="{{ dial }}">'),
  );
  html = replaceElement(
    html,
    dialStart,
    `<div class="preferences-scrim"><section class="preferences-panel contact-sheet" role="dialog" aria-modal="true" aria-label="{{ ui.contact }}" tabindex="-1"><div class="contact-sheet-heading"><span class="contact-sheet-icon"><i aria-hidden="true" class="{{ dial.icon }}"></i></span><div><h2>{{ dial.name }}</h2><sc-if value="{{ dial.href }}"><a onClick="{{ closeDial }}" href="{{ dial.href }}" target="{{ dial.target }}" rel="noopener noreferrer">{{ dial.phone }}</a></sc-if><sc-if value="{{ !dial.href }}"><span>{{ dial.phone }}</span></sc-if></div></div><div class="contact-explanation">{{ contactCopy }}</div><button class="close-preferences" onClick="{{ closeDial }}"><span class="bi"><span class="gu" lang="gu">બરાબર</span><span class="en" lang="en">OK</span></span></button></section></div>`,
  );
  return html;
}
