// Presentation only: never translate stored names, input values, identifiers,
// sort keys or event handlers. The alternate view is read-only and discarded.
// One language at a time: the header language control decides which script is
// shown; nothing is displayed bilingually. Gujarati is the default.
export function bilingual(gu, en, lang = "gu") {
  if (gu === en || !gu || !en) return gu || en || "";
  return String(lang === "en" ? en : gu);
}
const labels = new Set([
  "adminTitle",
  "directoryHeading",
  "placeLabel",
  "countLabel",
  "footerStats",
  "footerPlace",
  "dirSummary",
  "dirContext",
  "memberCountLabel",
  "backupStat",
  "pwLabel",
  "resendLabel",
  "submittedDate",
  "lastBackup",
  "lastConfirmed",
  "recoveryExpiry",
  "recoveryError",
  "recoveryMember",
  "copyStatus",
  "reorderStatus",
  "reorderLabel",
  "themeLabel",
  "place",
  "when",
  "status",
  "reason",
  "hint",
  "sub",
  "village",
  "tehsil",
  "district",
  "phones",
  "pendingPhones",
  "msg",
  "title",
  "who",
  "device",
  "label",
  "value",
]);
export function bilingualView(primary, alternate, lang) {
  const pair = (a, b) =>
    lang === "gu" ? bilingual(a, b, lang) : bilingual(b, a, lang);
  function merge(a, b, key = "") {
    if (typeof a === "string" && typeof b === "string")
      return labels.has(key) ? pair(a, b) : a;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return a;
    if (Array.isArray(a))
      return a.map((item, i) => {
        const other = item?.id ? b.find((x) => x?.id === item.id) : b[i];
        return merge(item, other, key);
      });
    const out = { ...a };
    for (const k of Object.keys(a)) out[k] = merge(a[k], b[k], k);
    return out;
  }
  const out = { ...primary };
  // Deliberate allowlist. Do not traverse form/edit/ph/style/transport/session data.
  for (const key of [
    ...labels,
    "locationHints",
    "tiles",
    "statGroups",
    "newRequests",
    "updateRequests",
    "deleteRequests",
    "archive",
    "alerts",
    "members",
    "labelOpts",
    "vSuggest",
    "tSuggest",
  ])
    if (key in primary) out[key] = merge(primary[key], alternate[key], key);
  out.copy = Object.fromEntries(
    Object.keys(primary.ui).map((key) => [
      key,
      pair(primary.ui[key], alternate.ui[key]),
    ]),
  );
  out.err = Object.fromEntries(
    Object.keys(primary.err || {}).map((key) => [
      key,
      pair(primary.err[key], alternate.err[key]),
    ]),
  );
  out.me = { ...primary.me, rows: merge(primary.me.rows, alternate.me.rows) };
  out.form = {
    ...primary.form,
    place: pair(primary.form.place, alternate.form.place),
  };
  const alternateMembers = new Map(
    alternate.sections.flatMap((x) => x.items).map((x) => [x.id, x]),
  );
  out.sections = primary.sections.map((section) => ({
    ...section,
    items: section.items.map((member) => {
      const other = alternateMembers.get(member.id);
      return {
        ...member,
        primaryName: bilingual(member.nameGu, member.name, lang),
        place: pair(member.place, other?.place || member.place),
      };
    }),
  }));
  for (const key of ["updateRequests"])
    out[key] = out[key].map((row, i) => ({
      ...row,
      oldRows: row.oldRows.map((value, j) =>
        pair(value, alternate[key][i].oldRows[j]),
      ),
      newRows: row.newRows.map((value, j) =>
        pair(value, alternate[key][i].newRows[j]),
      ),
    }));
  out.villageTiles = primary.villageTiles.map((row) => ({
    ...row,
    primary: bilingual(row.gu, row.en, lang),
  }));
  if (primary.dial)
    out.dial = {
      ...primary.dial,
      name: bilingual(
        primary.dial.nameGu || primary.dial.name,
        primary.dial.nameEn || primary.dial.name,
        lang,
      ),
    };
  out.profileName = bilingual(primary.me.nameGu, primary.me.name, lang);
  out.contactCopy = primary.dial
    ? bilingual(primary.dial.gu, primary.dial.en, lang)
    : "";
  out.languageSwitch = bilingual("ગુજરાતી", "English", lang);
  return out;
}

// Alphabetical member ordering that follows the selected script: Gujarati
// collation in Gujarati, English collation in English. Missing translations
// fall back to the other spelling so no member is left unordered.
export function memberNameOrder(lang) {
  const key = lang === "en" ? "name" : "nameGu";
  const locale = lang === "en" ? "en" : "gu";
  const visible = (m) => String((m && (m[key] || m.name)) || "");
  return (a, b) =>
    visible(a).localeCompare(visible(b), locale, { sensitivity: "base" });
}
