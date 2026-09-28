// Section 8: the Member Directory — contacts fill the screen, not controls.
//   Top bar (one slim row): title | Search | Village filter | Profile/Settings
//   | Admin (admins only). Search expands inside the bar; results from 3
//   characters on name (Gujarati/English), mobile digits, village, taluka
//   and district. Optional village chips. Compact 64 dp rows with Call and
//   WhatsApp; tapping a row opens the full details.
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
        ah("strong", { className: "alpha-row-name" }, name, isMe ? ah("span", { className: "alpha-you" }, " · " + t("dir.you", lang)) : null),
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
  searchOpen,
  village,
  chipsVisible,
  onQuery,
  onSearchOpen,
  onVillage,
  onToggleChips,
  onOpenContact,
  onSettings,
  showAdmin,
  adminBadge,
  onAdmin,
  offline,
  lastUpdated,
  onRetry,
}) {
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);
  const ordered = [...members].sort(memberNameOrder(lang));
  const filtered = village ? ordered.filter((m) => m.village === village) : ordered;
  const { active, list } = directorySearch(searchOpen ? filtered : filtered, searchOpen ? query : "", villages);
  const short = searchOpen && query.trim().length > 0 && query.trim().length < 3;
  const count = (n) => t(n === 1 ? "dir.countOne" : "dir.count", lang, { n });
  const title = village ? villageName(village, lang) : t("app.title", lang);
  const bar = searchOpen
    ? ah(
        "header",
        { className: "alpha-topbar lq-glass alpha-searchbar", "data-testid": "Top bar" },
        ah(AIcon, { name: "magnifying-glass", className: "alpha-search-icon" }),
        ah("input", {
          ref: searchRef,
          type: "search",
          value: query,
          placeholder: t("dir.searchPlaceholder", lang),
          "aria-label": t("dir.search", lang),
          "data-testid": "Search input",
          enterKeyHint: "search",
          onChange: (e) => onQuery(e.target.value),
        }),
        ah(AIconButton, { icon: "x", label: t("dir.clear", lang), onClick: () => onSearchOpen(false), testId: "Search clear" }),
      )
    : ah(
        "header",
        { className: "alpha-topbar lq-glass", "data-testid": "Top bar" },
        ah("div", { className: "alpha-topbar-title" }, ah("h1", null, title)),
        ah(
          "div",
          { className: "alpha-topbar-actions" },
          ah(AIconButton, { icon: "magnifying-glass", label: t("dir.search", lang), onClick: () => onSearchOpen(true), testId: "Search" }),
          ah(AIconButton, {
            icon: "funnel",
            label: t(chipsVisible ? "dir.hideChips" : "dir.showChips", lang),
            onClick: onToggleChips,
            pressed: chipsVisible,
            badge: village ? "1" : null,
            testId: "Village filter",
          }),
          ah(AIconButton, { icon: "user-circle", label: t("dir.settings", lang), onClick: onSettings, testId: "Profile and settings" }),
          showAdmin ? ah(AIconButton, { icon: "shield-check", label: t("nav.adminTools", lang), onClick: onAdmin, badge: adminBadge, testId: "Admin" }) : null,
        ),
      );
  return ah(
    "main",
    { className: "alpha-screen alpha-directory", "data-testid": "Directory screen" },
    bar,
    offline ? ah(AOfflineBanner, { lang, onRetry, lastUpdated }) : null,
    chipsVisible
      ? ah(
          "nav",
          { className: "alpha-chips", "aria-label": t("dir.filter", lang), "data-testid": "Village chips" },
          ah("button", { type: "button", "aria-pressed": !village, onClick: () => onVillage(""), "data-testid": "Chip all" }, t("dir.allVillages", lang)),
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
