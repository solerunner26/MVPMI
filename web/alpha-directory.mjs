// The Member Directory — contacts fill the screen, not controls.
//   Line 1: small logo + community name + search box + search button.
//   Line 2: icons in this order — Filter, My Profile, Admin Tools (admins
//           only), Dark/Light theme, Language.
//   Line 3: "All" + the village names (the Filter icon shows/hides it).
//   Then the member list. Results appear from 3 characters on name
//   (Gujarati/English), mobile digits, village, taluka and district.
//   Own name is GREEN, every admin's name is RED. Rows have Call and WhatsApp;
//   tapping a row opens the full details.
const nativeHost = () => typeof navigator !== "undefined" && navigator.userAgent.includes("MVPMlAndroid");
const TALUKA = { gu: "મહુવા", en: "Mahuva" };
const DISTRICT = { gu: "ભાવનગર", en: "Bhavnagar" };
const lower = (x) => String(x || "").toLowerCase();

export function directorySearch(members, query, villages = VILLAGE_LIST) {
  const q = String(query || "").trim();
  if (q.length < 3) return { active: false, list: members };
  const ql = lower(q);
  const digits = q.replace(/\D/g, "");
  const byDigits = digits.length >= 3 && digits.length === q.replace(/[\s+()-]/g, "").length;
  const list = members.filter((m) => {
    if (byDigits) return String(m.phone || "").includes(digits) || String(m.phone2 || "").includes(digits);
    const v = villages.find((x) => x.gu === m.village || x.en === m.village) || { gu: m.village, en: m.village };
    return [m.name, m.nameGu, m.firstName, m.surname, v.gu, v.en, m.tehsil, TALUKA.en, m.district, DISTRICT.en, m.currentLocation]
      .some((field) => lower(field).includes(ql));
  });
  return { active: true, list };
}

function AContactActions({ phone, name, lang, compact }) {
  const links = contactLinks(phone, nativeHost());
  if (!links) return null;
  return ah(
    "div",
    { className: "alpha-contact-actions" + (compact ? " compact" : "") },
    ah(
      "a",
      {
        className: "alpha-round-action call",
        href: links.call,
        target: links.target,
        rel: "noopener noreferrer",
        "aria-label": t("dir.call", lang) + " " + name,
        title: t("dir.call", lang),
        "data-testid": "Call",
        onClick: (e) => e.stopPropagation(),
      },
      ah(AIcon, { name: "phone" }),
    ),
    ah(
      "a",
      {
        className: "alpha-round-action whatsapp",
        href: links.whatsapp,
        target: links.target,
        rel: "noopener noreferrer",
        "aria-label": t("dir.whatsapp", lang) + " " + name,
        title: t("dir.whatsapp", lang),
        "data-testid": "WhatsApp",
        onClick: (e) => e.stopPropagation(),
      },
      ah(AIcon, { name: "whatsapp-logo" }),
    ),
  );
}

function AContactRow({ m, lang, onOpen, isMe }) {
  // Own name green; every admin (Main or Village) red.
  const nameClass = "alpha-row-name" + (isMe ? " is-me" : m.adminRole ? " is-admin" : "");
  const name = lang === "en" ? m.name : m.nameGu || m.name;
  const place = villageName(m.village, lang) + " • " + (lang === "en" ? TALUKA.en : TALUKA.gu);
  return ah(
    "li",
    { className: "alpha-row", "data-testid": "Contact row" },
    ah(
      "button",
      {
        type: "button",
        className: "alpha-row-main",
        onClick: () => onOpen(m),
        "aria-label": t("dir.details", lang) + ": " + name,
      },
      ah("span", { className: "alpha-avatar", "aria-hidden": true }, (name || "?").trim().charAt(0)),
      ah(
        "span",
        { className: "alpha-row-text" },
        ah("strong", { className: nameClass, "data-role": isMe ? "me" : m.adminRole ? "admin" : undefined }, name),
        ah("small", { className: "alpha-row-place" }, place),
      ),
    ),
    ah(AContactActions, { phone: m.phone, name, lang, compact: true }),
  );
}

export function AContactSheet({ m, lang, onClose }) {
  const name = lang === "en" ? m.name : m.nameGu || m.name;
  const other = lang === "en" ? m.nameGu : m.name;
  const numbers = [{ label: t("dir.personal", lang), phone: m.phone }];
  if (m.phone2) numbers.push({ label: t(m.label2 === "other" ? "dir.other" : "dir.work", lang), phone: m.phone2 });
  return ah(
    ASheet,
    { title: name, onClose, closeLabel: t("common.close", lang), testId: "Contact details", className: "alpha-contact-sheet" },
    other && other !== name ? ah("p", { className: "alpha-hint" }, other) : null,
    ah(
      "ul",
      { className: "alpha-number-list" },
      ...numbers.map((n) =>
        ah(
          "li",
          { key: n.phone, className: "alpha-number lq-glass" },
          ah("span", null, ah("small", null, n.label), ah("strong", { className: "alpha-phone" }, "+91 " + formatMobile(n.phone))),
          ah(AContactActions, { phone: n.phone, name, lang }),
        ),
      ),
    ),
    ah(
      "dl",
      { className: "alpha-details" },
      ah("dt", null, t("field.village", lang)),
      ah("dd", null, villageName(m.village, lang)),
      ah("dt", null, t("field.taluka", lang)),
      ah("dd", null, lang === "en" ? TALUKA.en : TALUKA.gu),
      ah("dt", null, t("field.district", lang)),
      ah("dd", null, lang === "en" ? DISTRICT.en : DISTRICT.gu),
      m.currentLocation ? ah("dt", null, t("field.location", lang)) : null,
      m.currentLocation ? ah("dd", null, m.currentLocation) : null,
    ),
  );
}

export function ADirectoryScreen({
  lang,
  members,
  villages,
  meId,
  query,
  village,
  chipsVisible,
  theme,
  onQuery,
  onVillage,
  onToggleChips,
  onOpenContact,
  onProfile,
  onTheme,
  onLang,
  showAdmin,
  adminBadge,
  onAdmin,
  offline,
  lastUpdated,
  onRetry,
}) {
  const ordered = [...members].sort(memberNameOrder(lang));
  const filtered = village ? ordered.filter((m) => m.village === village) : ordered;
  const { active, list } = directorySearch(filtered, query, villages);
  const short = query.trim().length > 0 && query.trim().length < 3;
  const count = (n) => t(n === 1 ? "dir.countOne" : "dir.count", lang, { n });
  const dark = theme === "dark";
  const inputRef = React.useRef(null);
  return ah(
    "main",
    { className: "alpha-screen alpha-directory", "data-testid": "Directory screen" },
    ah(
      "header",
      { className: "alpha-dirhead lq-glass", "data-testid": "Top bar" },
      ah(
        "form",
        {
          className: "alpha-dirline alpha-dirline-search",
          role: "search",
          onSubmit: (e) => {
            e.preventDefault();
            inputRef.current?.blur();
          },
        },
        ah("img", { src: "/brand/icon-192.png", alt: "", width: 32, height: 32, className: "alpha-dirlogo" }),
        ah("strong", { className: "alpha-dirname", "data-testid": "Community name" }, t("app.community", lang)),
        ah("input", {
          ref: inputRef,
          type: "search",
          value: query,
          placeholder: t("dir.searchPlaceholder", lang),
          "aria-label": t("dir.search", lang),
          "data-testid": "Search input",
          enterKeyHint: "search",
          autoComplete: "off",
          onChange: (e) => onQuery(e.target.value),
        }),
        ah(AIconButton, { icon: "magnifying-glass", label: t("dir.searchBtn", lang), onClick: () => inputRef.current?.blur(), testId: "Search", type: "submit" }),
      ),
      ah(
        "div",
        { className: "alpha-dirline alpha-diricons", role: "toolbar", "aria-label": t("dir.settings", lang) },
        ah(AIconButton, {
          icon: "funnel",
          label: t("dir.filterBtn", lang),
          onClick: onToggleChips,
          pressed: chipsVisible,
          badge: village ? "1" : null,
          testId: "Village filter",
        }),
        ah(AIconButton, { icon: "user-circle", label: t("dir.profileBtn", lang), onClick: onProfile, testId: "Profile and settings" }),
        showAdmin ? ah(AIconButton, { icon: "shield-check", label: t("nav.adminTools", lang), onClick: onAdmin, badge: adminBadge, testId: "Admin" }) : null,
        ah(AIconButton, { icon: dark ? "sun" : "moon", label: t(dark ? "dir.lightOn" : "dir.darkOn", lang), onClick: () => onTheme(dark ? "light" : "dark"), testId: "Theme toggle" }),
        ah(AIconButton, { icon: "translate", label: t("dir.languageBtn", lang), onClick: () => onLang(lang === "gu" ? "en" : "gu"), testId: "Language toggle" }),
      ),
    ),
    offline ? ah(AOfflineBanner, { lang, onRetry, lastUpdated }) : null,
    chipsVisible
      ? ah(
          "nav",
          { className: "alpha-chips", "aria-label": t("dir.filter", lang), "data-testid": "Village chips" },
          ah("button", { type: "button", "aria-pressed": !village, onClick: () => onVillage(""), "data-testid": "Chip all" }, t("dir.allShort", lang)),
          ...(villages || []).map((v) =>
            ah(
              "button",
              { key: v.gu, type: "button", "aria-pressed": village === v.gu, onClick: () => onVillage(village === v.gu ? "" : v.gu), "data-testid": "Chip " + v.en },
              lang === "en" ? v.en : v.gu,
            ),
          ),
        )
      : null,
    ah(
      "p",
      { className: "alpha-count", role: "status", "aria-live": "polite", "data-testid": "Directory count" },
      short ? t("dir.searchShort", lang) : active ? t("dir.found", lang, { n: list.length }) : count(list.length),
    ),
    list.length
      ? ah(
          "ul",
          { className: "alpha-list", "data-testid": "Directory list" },
          ...list.map((m) => ah(AContactRow, { key: m.id, m, lang, onOpen: onOpenContact, isMe: m.id === meId })),
        )
      : ah("p", { className: "alpha-empty" }, t(active ? "dir.none" : "dir.empty", lang)),
  );
}
