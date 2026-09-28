import { villageWorkflow } from "./village-workflow.mjs";
import { modernDesign } from "./modern-design.mjs";
import { liquidGlass } from "./liquid-glass.mjs";
import { refineDesign } from "./refine-design.mjs";
import { auditTemplate, auditTemplateLate, auditLogic } from "./audit-design.mjs";
import { alphaScreens } from "./alpha-screens.mjs";
import {
  readFileSync as read,
  writeFileSync as write,
  mkdirSync,
  cpSync,
} from "node:fs";
const source = read("Community Directory.dc.html", "utf8");
mkdirSync("dist/vendor", { recursive: true });
for (const [from, to] of [
  ["react/umd/react.production.min.js", "react.js"],
  ["react-dom/umd/react-dom.production.min.js", "react-dom.js"],
])
  cpSync("node_modules/" + from, "dist/vendor/" + to);
// Fonts: only the five weights the app uses (the browser then downloads just
// the unicode subsets a page needs).
const FONT_WEIGHTS = [400, 500, 600, 700, 800];
for (const font of ["manrope", "noto-sans-gujarati"]) {
  mkdirSync(`dist/vendor/${font}/files`, { recursive: true });
  for (const w of FONT_WEIGHTS) {
    const css = read(`node_modules/@fontsource/${font}/${w}.css`, "utf8");
    write(`dist/vendor/${font}/${w}.css`, css);
    for (const [, file] of css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g))
      cpSync(`node_modules/@fontsource/${font}/files/${file}`, `dist/vendor/${font}/files/${file}`);
  }
}
let helmet = source.slice(
  source.indexOf("<helmet>") + 8,
  source.indexOf("</helmet>"),
);
helmet = helmet.replace(/<link[^>]*>/g, "");
let template = source.slice(
  source.indexOf('<div class="app"'),
  source.indexOf("</x-import>") + "</x-import>".length,
);
template =
  template
    .replace(/<x-import[^>]*>/, '<div class="screen-frame">')
    .replace("</x-import>", "</div>") + "</div>";
template = auditTemplate(template);
// Remove the editor's screen-jump sidebar, credentials and device mock chrome, not the app design.
template = template
  .replace("Try admin / Samaj@2026", "Please check your credentials.")
  .replace("admin / Samaj@2026 વાપરો.", "વિગતો તપાસો.")
  .replace("પાસવર્ડ ભ���લી ગયા?", "પાસવર્ડ ભૂલી ગયા?");
template = template
  .replace(
    "Wrong credentials — attempt logged. Please check your credentials.",
    "{{ loginErrorMessage }}",
  )
  .replace(
    "યુઝરનેમ કે પાસવર્ડ ખોટો — પ્રયાસ નોંધાયો. વિગતો તપાસો.",
    "લોગિન થઈ શક્યું નથી. નીચેનો સંદેશ તપાસો.",
  );
// Keep the supplied button styling, but use real user-activated external links.
for (const [handler, href] of [
  ["onCall", "callHref"],
  ["onWhats", "whatsHref"],
]) {
  template = template.replace(
    new RegExp(
      '<button onClick="\\{\\{ n\\.' +
        handler +
        ' \\}\\}"([^>]+)>([\\s\\S]*?)</button>',
    ),
    '<a role="button" href="{{ n.' +
      href +
      ' }}" target="{{ n.externalTarget }}" rel="noopener noreferrer" onKeyDown="{{ n.onContactKey }}" onClick="{{ n.' +
      handler +
      ' }}"$1>$2</a>',
  );
}
// Reuse the original dial sheet. Its number is a retry link, not a new screen.
template = template.replace(
  "{{ dial.phone }}</div>",
  '<sc-if value="{{ dial.href }}"><a href="{{ dial.href }}" target="{{ dial.target }}" rel="noopener noreferrer" style="color:inherit">{{ dial.phone }}</a></sc-if><sc-if value="{{ !dial.href }}">{{ dial.phone }}</sc-if></div>',
);
// Restore Best1's continuous 85–165% slider; input and keyboard share one handler.
// Preserve square icons/avatars when neighbouring labels need more room.
template = template.replace(
  /<(div|button)\b([^>]*style="[^"]*")[^>]*>/g,
  (tag) => {
    const style = tag.match(/style="([^"]*)"/)?.[1] || "";
    const width = style.match(/(?:^|;)width:(\d+)px(?:;|$)/)?.[1];
    const height = style.match(/(?:^|;)height:(\d+)px(?:;|$)/)?.[1];
    return width && width === height
      ? tag.replace('style="', 'style="flex-shrink:0;')
      : tag;
  },
);
// Text-bearing buttons grow, while icon-only controls keep their existing geometry.
template = template.replace(
  /<button\b([^>]*)>([\s\S]*?)<\/button>/g,
  (all, attrs, body) => {
    if (!body.includes('class="bi')) return all;
    const height = attrs.match(/(?:[;" ])height:([^;" ]+)/)?.[1] || "48px";
    attrs = attrs.includes('class="')
      ? attrs.replace('class="', 'class="text-control ')
      : attrs + ' class="text-control"';
    attrs = attrs.includes('style="')
      ? attrs.replace('style="', 'style="--control-height:' + height + ";")
      : attrs + ' style="--control-height:' + height + '"';
    return "<button" + attrs + ">" + body + "</button>";
  },
);
const resetStart = template.indexOf('<sc-if value="{{ isAdminForgot }}">'),
  resetEnd = template.indexOf('<sc-if value="{{ isAdmin }}">');
if (resetStart < 0 || resetEnd < 0 || resetStart > resetEnd)
  throw new Error("Admin recovery screen markup is missing or out of order");
template = template
  .replace('onInput="{{ setEditTehsil }}"', "readonly")
  .replace('onInput="{{ setEditDistrict }}"', "readonly");
template = template.replace(
  '<span class="gu">એડમિન મંજૂરી આપશે પછી જ ફેરફાર યાદીમાં દેખાશે.</span><span class="en">Changes show in the directory only after the admin approves.</span>',
  '<span class="gu">{{ editNoticeGu }}</span><span class="en">{{ editNoticeEn }}</span>',
);
template = template.replace(
  '<span class="gu">મંજૂરી માટે મોકલો</span><span class="en">Send for approval</span>',
  '<span class="gu">{{ editSubmitGu }}</span><span class="en">{{ editSubmitEn }}</span>',
);
// Semantic accessibility additions do not change the supplied visual design.
template = template
  .replaceAll('class="noscroll"', 'class="noscroll" tabindex="0"')
  .replace(
    'onClick="{{ k.onClick }}"',
    'onClick="{{ k.onClick }}" disabled="{{ k.disabled }}" aria-label="{{ k.accessibleLabel }}"',
  );
template = template
  .replace('<div class="app"', '<div role="main" class="app"')
  .replace(
    'class="rng" type="range"',
    'class="rng" aria-label="અક્ષરનું માપ · Text size" type="range"',
  );
for (const [action, label] of Object.entries({
  goDirectory: "સંપર્ક યાદી · Back to directory",
  goMyProfile: "મારી પ્રોફાઇલ · My profile",
  goAdminLogin: "લોગિન · Back to login",
  adminHome: "ડેશબોર્ડ · Back to dashboard",
  clearQuery: "શોધ સાફ કરો · Clear search",
  removePhone2: "બીજો નંબર કાઢો · Remove second number",
})) {
  template = template.replaceAll(
    'onClick="{{ ' + action + ' }}"',
    'aria-label="' + label + '" onClick="{{ ' + action + ' }}"',
  );
}
for (const [state, title] of [
  ["confirm", "Confirm action"],
  ["picker", "Choose an option"],
  ["dial", "Contact action"],
]) {
  const start = template.indexOf('<sc-if value="{{ ' + state + ' }}">');
  const end = template.indexOf("</sc-if>", start);
  let part = template.slice(start, end);
  const first = part.indexOf("<div"),
    second = part.indexOf("<div", first + 4);
  part =
    part.slice(0, second) +
    part
      .slice(second)
      .replace(
        "<div ",
        '<div role="dialog" aria-modal="true" aria-label="' +
          title +
          '" tabindex="-1" ',
      );
  template = template.slice(0, start) + part + template.slice(end);
}
// Operational states reuse the existing glass surface and bilingual typography.
const bodyStart = template.indexOf('<div style="height:100%');
const insertAt = template.indexOf(">", bodyStart) + 1;
template =
  template.slice(0, insertAt) +
  `<sc-if value="{{ connectionError }}"><button onClick="{{ retry }}" role="alert" style="z-index:40;position:absolute;top:8px;left:8px;right:8px;padding:12px;border-radius:16px;background:var(--sheet);color:var(--dan);border:1px solid var(--dan);font:inherit">કનેક્શન તપાસો · Connection lost — tap to retry</button></sc-if><sc-if value="{{ busy }}"><div role="status" style="position:absolute;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:center;justify-content:center;color:white">રાહ જુઓ · Please wait…</div></sc-if>` +
  template.slice(insertAt);
template = alphaScreens(
  auditTemplateLate(
    villageWorkflow(modernDesign(liquidGlass(refineDesign(template)))),
  ),
);
let logic = source.match(
  /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/,
)[1];
logic = logic.replace(/const GATE_CODE = .*?;/, "const GATE_CODE = null;");
logic = logic.replace(
  /const SEED = \{[\s\S]*?\n\};/,
  "const SEED = {members:[],newRequests:[],updateRequests:[],deleteRequests:[],archive:[],alerts:[]};",
);
logic = logic
  .replace(
    "class Component extends DCLogic",
    "class DesignComponent extends DCLogic",
  )
  .replace("myRequest: null, meId: 1", "myRequest: null, meId: null")
  .replace("lastBackup: '10 Sep 2026, 8:05 pm'", "lastBackup: '—'");
logic = logic.replaceAll("'Samaj@2026'", "null");
logic = logic.replace(
  "const searching = q.length >= 3 || dg(q).length >= 3;",
  "const searching = canSearch(q);",
);
logic = logic.replace(
  "shortQuery: q.length > 0 && q.length < 3",
  "shortQuery: q.length > 0 && !canSearch(q)",
);
logic = logic.replace(
  "s.members.find((m) => m.id === s.meId) || s.members[0] ||",
  "s.members.find((m) => m.id === s.meId) ||",
);
logic = logic.replace(
  /else if \(p2 && p2 === p\)/,
  "else if (p2 && !/^[6-9]/.test(p2)) e.phone2 = this.L('નંબર 6–9 થી શરૂ થાય', 'Numbers start with 6–9');\n    else if (p2 && p2 === p)",
);
logic = logic.replace(
  '\'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;700&display=swap">\'',
  '\'<link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css">\'',
);
logic = auditLogic(logic);
logic +=
  "\n" +
  read("web/contact-actions.mjs", "utf8").replace(
    "export function",
    "function",
  );
logic += "\n" + read("web/text-size.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/ui-copy.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/strings.mjs", "utf8").replaceAll("export ", "");
logic +=
  "\n" + read("web/print-document.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/save-file.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/app-lock.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/offline-store.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/security-ui.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/liquid-ios.mjs", "utf8").replaceAll("export ", "");
for (const file of ["bilingual.mjs", "material-capability.mjs"])
  logic += "\n" + read("web/" + file, "utf8").replaceAll("export ", "");
for (const file of [
  "alpha-ui.mjs",
  "alpha-auth.mjs",
  "alpha-register.mjs",
  "alpha-directory.mjs",
  "alpha-settings.mjs",
  "alpha-admin.mjs",
])
  logic += "\n" + read("web/" + file, "utf8").replaceAll("export ", "");
logic +=
  "\n" + read("web/village-workflow.mjs", "utf8").replaceAll("export ", "");
logic += "\n" + read("web/controller.js", "utf8");
new Function(logic); // Syntax-check generated browser logic without executing it.
const extra = `<style>html,body{height:100%}body{background:#17100E}.app{margin:0 auto;width:100%;max-width:412px}.screen-frame{height:100vh;height:100dvh;min-height:480px;overflow:hidden;position:relative;background:var(--page)}@media(min-width:600px){.app{padding:24px 0}.screen-frame{height:892px;max-height:calc(100dvh - 48px);border-radius:18px;box-shadow:0 30px 80px #0004}}a[role="button"]:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--ind);outline-offset:3px}@media(prefers-reduced-motion:reduce){.app *{animation:none!important;scroll-behavior:auto!important}}.app button{touch-action:manipulation}.noscroll>div,.noscroll>button{flex-shrink:0}</style>`;
write(
  "dist/index.html",
  `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#B2402C"><link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><title>મહુવા ક્ષત્રિય રાજપૂત સમાજ · Community Directory</title><meta name="description" content="મહુવા ક્ષત્રિય રાજપૂત સમાજની ખાનગી સભ્ય ડિરેક્ટરી · Private member directory of the Mahuva Kshatriya Rajput Samaj."><link rel="stylesheet" href="/vendor/app-fonts.css"><script src="/vendor/react.js"></script><script src="/vendor/react-dom.js"></script><script src="/support.js"></script></head><body><x-dc><helmet><link rel="stylesheet" href="/vendor/app-fonts.css">${helmet}${extra}<style>${read("web/text-size.css", "utf8")}\n${read("web/usability.css", "utf8")}\n${read("web/liquid-glass.css", "utf8")}\n${read("web/modern-design.css", "utf8")}
${read("web/village-workflow.css", "utf8")}
${read("web/liquid-ios.css", "utf8")}
${read("web/alpha.css", "utf8")}</style></helmet>${template}</x-dc><script type="text/x-dc" data-dc-script>${logic}</script></body></html>`,
);
// Icons: keep only the Phosphor rules the app actually uses (the full sheet
// lists 1,500 icons) and serve the WOFF2 font only.
{
  const used = new Set();
  const sources = [
    read("Community Directory.dc.html", "utf8"),
    read("dist/index.html", "utf8"),
  ];
  for (const text of sources)
    for (const [name] of text.matchAll(/ph-[a-z0-9-]+/g)) used.add(name);
  // Alpha screens name their icons without the "ph-" prefix
  // (AIcon { name: "funnel" }, AIconButton { icon: "funnel" }).
  for (const file of ["alpha-ui", "alpha-auth", "alpha-register", "alpha-directory", "alpha-settings", "alpha-admin"])
    for (const [, name] of read("web/" + file + ".mjs", "utf8").matchAll(/"([a-z][a-z0-9-]*)"/g))
      used.add("ph-" + name);
  const full = read("node_modules/@phosphor-icons/web/src/duotone/style.css", "utf8");
  const kept = [];
  for (const block of full.match(/[^{}]+\{[^{}]*\}/g) || []) {
    const selector = block.slice(0, block.indexOf("{"));
    const names = [...selector.matchAll(/\.(ph-[a-z0-9-]+)/g)].map((m) => m[1]).filter((n) => n !== "ph-duotone");
    if (names.length === 0 || names.some((n) => used.has(n))) kept.push(block.trim());
  }
  let css = kept.join("\n").replace(/src:[^;]+;/, 'src: url("./Phosphor-Duotone.woff2") format("woff2");');
  if (!/Phosphor-Duotone\.woff2/.test(css) || kept.length < 20) throw new Error("Icon subset failed");
  mkdirSync("dist/vendor/icons", { recursive: true });
  write("dist/vendor/icons/style.css", css);
  cpSync("node_modules/@phosphor-icons/web/src/duotone/Phosphor-Duotone.woff2", "dist/vendor/icons/Phosphor-Duotone.woff2");
}
// One stylesheet for all fonts and icons (11 requests → 1).
{
  let css = read("dist/vendor/icons/style.css", "utf8").replaceAll("./Phosphor-Duotone", "/vendor/icons/Phosphor-Duotone");
  for (const font of ["manrope", "noto-sans-gujarati"])
    for (const w of FONT_WEIGHTS)
      css += "\n" + read(`dist/vendor/${font}/${w}.css`, "utf8").replaceAll("url(./files/", `url(/vendor/${font}/files/`);
  write("dist/vendor/app-fonts.css", css);
}
cpSync("support.js", "dist/support.js");
// Installable home-screen app and Web Push service worker.
cpSync("web/sw.js", "dist/sw.js");
cpSync("web/manifest.webmanifest", "dist/manifest.webmanifest");
cpSync("web/brand", "dist/brand", { recursive: true });
for (const file of ["SunMark.dc.html", "SunWait.dc.html"])
  cpSync(file, "dist/" + file);
// Versioned asset links (long browser caching; a new build changes the link).
{
  const { createHash } = await import("node:crypto");
  let html = read("dist/index.html", "utf8");
  html = html.replace(/(href|src)="(\/(?:vendor|support\.js)[^"?]*)"/g, (m, attr, path) => {
    const file = "dist" + path;
    const v = createHash("sha256").update(read(file)).digest("hex").slice(0, 10);
    return `${attr}="${path}?v=${v}"`;
  });
  write("dist/index.html", html);
}
// Pre-compressed copies (Brotli + gzip) so pages load fast on slow mobile data.
{
  const { brotliCompressSync, gzipSync, constants } = await import("node:zlib");
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const f = dir + "/" + n;
      return statSync(f).isDirectory() ? walk(f) : [f];
    });
  for (const file of walk("dist")) {
    if (!/\.(html|css|js|webmanifest|svg|json)$/.test(file)) continue;
    const data = read(file);
    if (data.length < 1024) continue;
    write(file + ".br", brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    write(file + ".gz", gzipSync(data, { level: 9 }));
  }
}
console.log(
  "Built modern community UI, preserving the original identity and server-backed workflows.",
);
