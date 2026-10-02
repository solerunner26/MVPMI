// The Member Directory — contacts fill the screen, not controls.
//   Line 1: sun logo + community name (one line).
//   Line 2: the search box.   Line 3: "All" + the village names.
//   Navigation (profile, settings/admin, search, theme, language) is in the
//   bottom bar.
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

// Member details: a full page, not a bottom sheet (owner, 2 Oct 2026, from
// "sample member contact page"). Sun-crowned card: name in both languages,
// role, big Call / WhatsApp, every number, native village and current
// residence, and a link to everyone from the same village.
export function AContactSheet({ m, lang, onClose, members = [], meId, onShowVillage }) {
  const other = lang === "en" ? "gu" : "en";
  const nameIn = (l) => (l === "en" ? m.name : m.nameGu || m.name) || "";
  const name = nameIn(lang);
  const second = nameIn(other);
  const both = (key) => [t(key, lang), t(key, other)];
  const role = m.adminRole || "MEMBER";
  const isMe = meId && m.id === meId;
  const links = contactLinks(m.phone, nativeHost());
  const sameVillage = members.filter((x) => x.village === m.village).length;
  const villageLine = villageName(m.village, lang) + (villageName(m.village, other) !== villageName(m.village, lang) ? " (" + villageName(m.village, other) + ")" : "");
  const numbers = [{ key: "dir.primaryPhone", phone: m.phone, icon: "device-mobile" }];
  if (m.phone2) numbers.push({ key: m.label2 === "other" ? "dir.other" : "dir.work", phone: m.phone2, icon: m.label2 === "other" ? "phone" : "briefcase" });
  const label = (key) =>
    ah("small", { className: "alpha-md-label" }, t(key, lang), ah("span", null, " • " + t(key, other)));
  React.useEffect(() => {
    const prev = document.activeElement;
    return () => prev && prev.focus && prev.focus();
  }, []);
  return ah(
    "div",
    { className: "alpha-md-page", role: "dialog", "aria-modal": true, "aria-label": name, "data-testid": "Contact details" },
    ah(
      "header",
      { className: "alpha-md-top" },
      ah(AIconButton, { icon: "arrow-left", label: t("common.close", lang), onClick: onClose, className: "alpha-md-back", testId: "Close dialog" }),
      ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 28, height: 28, className: "alpha-md-toplogo" }),
      ah("h2", null, t("dir.memberDetails", lang)),
    ),
    ah(
      "div",
      { className: "alpha-md-scroll" },
      ah(
        "article",
        { className: "alpha-md-card" },
        ah("img", { src: "/brand/sun-logo-192.png", alt: "", className: "alpha-md-watermark", "aria-hidden": true }),
        ah(
          "div",
          { className: "alpha-md-eyebrow" },
          ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 18, height: 18 }),
          ah(AOneLine, { as: "span", text: t("app.community", lang), max: 12, min: 9 }),
        ),
        ah(
          "div",
          { className: "alpha-md-hero" },
          ah("span", { className: "alpha-md-avatar", "aria-hidden": true }, ah("span", null, name.trim().charAt(0) || "?")),
          ah("h3", { className: "alpha-md-name", "data-testid": "Member name" }, name),
          second && second !== name ? ah("p", { className: "alpha-md-name2" }, second) : null,
          ah(
            "span",
            { className: "alpha-md-role role-" + role.toLowerCase(), "data-testid": "Member role" },
            ah(AIcon, { name: role === "MEMBER" ? "user" : "shield-check" }),
            " " + t("role." + role, lang) + " • " + t("role." + role, other),
            isMe ? " · " + t("dir.thisIsYou", lang) : "",
          ),
        ),
        links
          ? ah(
              "div",
              { className: "alpha-md-actions" },
              ah(
                "a",
                { className: "alpha-md-btn call", href: links.call, target: links.target, rel: "noopener noreferrer", "data-testid": "Call", "aria-label": t("dir.call", lang) + " " + name },
                ah(AIcon, { name: "phone" }),
                ah("span", null, t("dir.call", lang)),
              ),
              ah(
                "a",
                { className: "alpha-md-btn whatsapp", href: links.whatsapp, target: links.target, rel: "noopener noreferrer", "data-testid": "WhatsApp", "aria-label": t("dir.whatsapp", lang) + " " + name },
                ah(AIcon, { name: "whatsapp-logo" }),
                ah("span", null, t("dir.whatsapp", lang)),
              ),
            )
          : null,
        ah(
          "section",
          { className: "alpha-md-box" },
          ...numbers.map((n) => {
            const l = contactLinks(n.phone, nativeHost());
            return ah(
              "div",
              { key: n.phone, className: "alpha-md-item", "data-testid": "Member number" },
              ah("span", { className: "alpha-md-ico phone" }, ah(AIcon, { name: n.icon })),
              ah("span", { className: "alpha-md-text" }, label(n.key), ah("strong", { className: "alpha-phone" }, "+91 " + formatMobile(n.phone))),
              l && n.phone !== m.phone
                ? ah("a", { className: "alpha-md-mini", href: l.call, target: l.target, rel: "noopener noreferrer", "aria-label": t("dir.call", lang) }, ah(AIcon, { name: "phone" }))
                : null,
            );
          }),
        ),
        ah(
          "section",
          { className: "alpha-md-box" },
          ah(
            "div",
            { className: "alpha-md-item" },
            ah("span", { className: "alpha-md-ico place" }, ah(AIcon, { name: "house-line" })),
            ah(
              "span",
              { className: "alpha-md-text" },
              label("dir.nativeVillage"),
              ah("strong", null, villageLine),
              ah("small", { className: "alpha-md-sub" }, t("dir.talukaDistrict", lang, { taluka: lang === "en" ? TALUKA.en : TALUKA.gu, district: lang === "en" ? DISTRICT.en : DISTRICT.gu })),
            ),
          ),
          ah(
            "div",
            { className: "alpha-md-item" },
            ah("span", { className: "alpha-md-ico home" }, ah(AIcon, { name: "map-pin" })),
            ah(
              "span",
              { className: "alpha-md-text" },
              label("dir.currentResidence"),
              ah("strong", null, m.currentLocation || "—"),
            ),
          ),
        ),
        onShowVillage && sameVillage > 0
          ? ah(
              "button",
              { type: "button", className: "alpha-md-link", onClick: () => onShowVillage(m.village), "data-testid": "Member village list" },
              ah("span", { className: "alpha-md-ico group" }, ah(AIcon, { name: "users-three" })),
              ah(
                "span",
                { className: "alpha-md-text" },
                ah("strong", null, t("dir.villageMembers", lang, { village: villageName(m.village, lang) })),
                ah("small", { className: "alpha-md-sub" }, t("dir.villageMembersCount", lang, { n: sameVillage })),
              ),
              ah(AIcon, { name: "caret-right" }),
            )
          : null,
        ah("div", { className: "alpha-md-foot", "aria-hidden": true }, ah("span"), ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 26, height: 26 }), ah("span")),
      ),
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
  onSun,
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
        ah(
          "button",
          { type: "button", className: "alpha-dirlogo-btn", onClick: onSun, "aria-label": t("splash.open", lang), "data-testid": "Sun logo" },
          ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 38, height: 38, className: "alpha-dirlogo" }),
        ),
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
