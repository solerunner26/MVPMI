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
  onQuery,
  onVillage,
  onOpenContact,
  offline,
  lastUpdated,
  onRetry,
}) {
  const ordered = [...members].sort(memberNameOrder(lang));
  const filtered = village ? ordered.filter((m) => m.village === village) : ordered;
  const { active, list } = directorySearch(filtered, query, villages);
  const short = query.trim().length > 0 && query.trim().length < 3;
  const count = (n) => t(n === 1 ? "dir.countOne" : "dir.count", lang, { n });
  const inputRef = React.useRef(null);
  // The long hint ("Search name, number or village") falls back to "Search"
  // when large text sizes leave no room for it on narrow phones.
  const [shortHint, setShortHint] = React.useState(false);
  const longHint = t("dir.searchPlaceholderLong", lang);
  React.useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const fit = () => {
      const cs = getComputedStyle(el);
      const c = document.createElement("canvas").getContext("2d");
      if (!c) return;
      c.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setShortHint(c.measureText(longHint).width > room - 2);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [longHint]);
  // The bottom bar's Search tab focuses this box (window.mvpmiFocusSearch).
  React.useEffect(() => {
    window.mvpmiFocusSearch = () => {
      const el = inputRef.current;
      if (!el) return;
      el.scrollIntoView({ block: "nearest" });
      el.focus();
    };
    return () => {
      delete window.mvpmiFocusSearch;
    };
  }, []);
  return ah(
    "main",
    { className: "alpha-screen alpha-directory", "data-testid": "Directory screen" },
    ah(
      "header",
      { className: "alpha-dirhead lq-glass", "data-testid": "Top bar" },
      // Line 1: the sun (the community's holy symbol) + the community name,
      // always on ONE line in both languages (AOneLine shrinks it to fit).
      ah(
        "div",
        { className: "alpha-dirline alpha-dirbrand" },
        ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 36, height: 36, className: "alpha-dirlogo" }),
        ah(AOneLine, { className: "alpha-dirname", testId: "Community name", text: t("app.community", lang), max: 20, min: 12 }),
      ),
      // Line 2: search (the bottom bar's centre button jumps here).
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
        ah(ANavIcon, { name: "magnifying-glass" }),
        ah("input", {
          ref: inputRef,
          type: "search",
          value: query,
          placeholder: shortHint ? t("dir.searchPlaceholder", lang) : longHint,
          "aria-label": t("dir.search", lang),
          "data-testid": "Search input",
          enterKeyHint: "search",
          autoComplete: "off",
          onChange: (e) => onQuery(e.target.value),
        }),
      ),
    ),
    offline ? ah(AOfflineBanner, { lang, onRetry, lastUpdated }) : null,
    ah(
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
        ),
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
