// Greetings and the Message Centre (owner, 21 Oct 2026).
//   AGreetingComposer — Main Admin only: a floating text box (any language),
//                       to everyone or to members picked by name.
//   AFlashMessage     — what every recipient sees when the app opens; it
//                       stays until closed with X.
//   AMessageCentre    — every greeting received, newest first; open to read,
//                       delete to remove it from this phone's list.

const msgWhen = (at, lang) =>
  new Date(at).toLocaleString(lang === "en" ? "en-IN" : "gu-IN", { dateStyle: "medium", timeStyle: "short" });

export function AGreetingComposer({ lang, members, sent = [], busy, onClose, onSend }) {
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState("all");
  const [picked, setPicked] = React.useState(() => new Set());
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const shown = members
    .filter((m) => !q || [m.name, m.nameGu, m.village].some((x) => String(x || "").toLowerCase().includes(q)))
    .slice(0, 200);
  const toggle = (id) =>
    setPicked((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const count = mode === "all" ? members.length : picked.size;
  const ready = text.trim().length > 0 && count > 0 && !busy;
  return ah(
    ASheet,
    { title: t("greet.title", lang), onClose, closeLabel: t("common.close", lang), testId: "Greeting composer", className: "alpha-greet" },
    ah("p", { className: "alpha-hint" }, t("greet.hint", lang)),
    ah("textarea", {
      className: "alpha-greet-text",
      value: text,
      maxLength: 2000,
      rows: 6,
      placeholder: t("greet.placeholder", lang),
      "aria-label": t("greet.title", lang),
      "data-testid": "Greeting text",
      onChange: (e) => setText(e.target.value),
    }),
    ah("small", { className: "alpha-greet-count" }, text.length + " / 2000"),
    ah(
      "div",
      { className: "alpha-seg", role: "radiogroup", "aria-label": t("greet.to", lang) },
      ah("button", { type: "button", role: "radio", "aria-checked": mode === "all", onClick: () => setMode("all"), "data-testid": "Greeting to all" }, t("greet.toAll", lang)),
      ah("button", { type: "button", role: "radio", "aria-checked": mode === "some", onClick: () => setMode("some"), "data-testid": "Greeting to some" }, t("greet.toSome", lang)),
    ),
    mode === "some"
      ? ah(
          "div",
          { className: "alpha-greet-pick" },
          ah("input", {
            type: "search",
            value: query,
            placeholder: t("greet.search", lang),
            "aria-label": t("greet.search", lang),
            "data-testid": "Greeting search",
            onChange: (e) => setQuery(e.target.value),
          }),
          ah(
            "ul",
            { className: "alpha-greet-list" },
            ...shown.map((m) =>
              ah(
                "li",
                { key: m.id },
                ah(
                  "label",
                  null,
                  ah("input", { type: "checkbox", checked: picked.has(m.id), onChange: () => toggle(m.id), "data-testid": "Greeting pick" }),
                  ah("span", null, nameFor(m, lang), ah("small", null, villageName(m.village, lang))),
                ),
              ),
            ),
          ),
        )
      : null,
    ah(
      AButton,
      { kind: "primary", disabled: !ready, onClick: () => onSend({ text: text.trim(), to: mode, ids: [...picked] }), "data-testid": "Greeting send" },
      ah(AIcon, { name: "paper-plane-tilt" }),
      " ",
      t("greet.send", lang, { n: count }),
    ),
    sent.length
      ? ah(
          "div",
          { className: "alpha-greet-sent" },
          ah("h3", { className: "settings-label" }, t("greet.sent", lang)),
          ...sent.slice(0, 5).map((g) =>
            ah(
              "p",
              { key: g.id },
              ah("small", null, msgWhen(g.at, lang) + " · " + t("greet.reached", lang, { n: g.count })),
              g.text.length > 120 ? g.text.slice(0, 117) + "…" : g.text,
            ),
          ),
        )
      : null,
  );
}

export function AFlashMessage({ lang, message, more, onClose, onOpen }) {
  return ah(
    "div",
    { className: "alpha-flash-scrim" },
    ah(
      "section",
      { className: "alpha-flash", role: "dialog", "aria-modal": true, "aria-label": t("msg.flashTitle", lang), "data-testid": "Flash message" },
      ah(
        "button",
        { type: "button", className: "alpha-flash-x", onClick: onClose, "aria-label": t("common.close", lang), "data-testid": "Flash close" },
        ah(AIcon, { name: "x" }),
      ),
      ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 56, height: 56, className: "alpha-flash-sun" }),
      ah("h2", null, t("msg.flashTitle", lang)),
      ah("small", { className: "alpha-flash-when" }, msgWhen(message.at, lang)),
      ah("div", { className: "alpha-flash-text", "data-testid": "Flash text" }, message.text),
      more > 0 ? ah("p", { className: "alpha-hint" }, t("msg.more", lang, { n: more })) : null,
      ah(AButton, { kind: "secondary", onClick: onOpen, "data-testid": "Flash open centre" }, ah(AIcon, { name: "envelope-simple" }), " ", t("msg.openCentre", lang)),
    ),
  );
}

export function AMessageCentre({ lang, messages, onBack, onRead, onDelete }) {
  const [open, setOpen] = React.useState(null);
  return ah(
    "main",
    { className: "alpha-screen", "data-testid": "Message centre" },
    ah(ATopBar, { title: t("msg.title", lang), onBack, backLabel: t("common.back", lang) }),
    ah(
      "div",
      { className: "alpha-scroll alpha-msgs" },
      messages.length
        ? ah(
            "ul",
            { className: "alpha-msg-list" },
            ...messages.map((m) => {
              const isOpen = open === m.id;
              return ah(
                "li",
                { key: m.id, className: "alpha-msg" + (m.read ? "" : " is-unread") + (isOpen ? " is-open" : ""), "data-testid": "Message" },
                ah(
                  "button",
                  {
                    type: "button",
                    className: "alpha-msg-main",
                    "aria-expanded": isOpen,
                    onClick: () => {
                      setOpen(isOpen ? null : m.id);
                      if (!m.read) onRead(m.id);
                    },
                  },
                  ah("img", { src: "/brand/sun-logo-96.png", alt: "", width: 36, height: 36 }),
                  ah(
                    "span",
                    { className: "alpha-msg-body" },
                    ah("small", null, (m.read ? "" : t("msg.new", lang) + " · ") + msgWhen(m.at, lang)),
                    ah("span", { className: "alpha-msg-text" }, m.text),
                  ),
                ),
                isOpen
                  ? ah(
                      "div",
                      { className: "alpha-msg-actions" },
                      ah(AButton, { kind: "danger", onClick: () => onDelete(m.id), "data-testid": "Message delete" }, ah(AIcon, { name: "trash" }), " ", t("msg.delete", lang)),
                    )
                  : null,
              );
            }),
          )
        : ah("div", { className: "alpha-msg-empty" }, ah("img", { src: "/brand/sun-logo-192.png", alt: "", width: 72, height: 72 }), ah("p", null, t("msg.empty", lang))),
    ),
  );
}
