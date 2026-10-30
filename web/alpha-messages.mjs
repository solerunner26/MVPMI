// Greetings and the Message Centre (owner, 21 Oct 2026; pictures, likes and
// editing 30 Oct 2026).
//   AGreetingComposer — Main Admin only: a floating text box (any language)
//                       plus an optional picture, to everyone or to members
//                       picked by name. Also edits a sent greeting.
//   AGreetingStats    — Main Admin only: who saw it and who liked it.
//   AFlashMessage     — what every recipient sees when the app opens; it
//                       stays until closed with X. Pictures show only in the
//                       Message Centre.
//   AMessageCentre    — every greeting received, newest first, with its
//                       picture, Like (and the like count) and Save.

const msgWhen = (at, lang) =>
  new Date(at).toLocaleString(lang === "en" ? "en-IN" : "gu-IN", { dateStyle: "medium", timeStyle: "short" });

export const greetingImageUrl = (m) => (m && m.image ? "/api/greetings/" + encodeURIComponent(m.id) + "/image?v=" + m.image : "");

// A picture for a greeting: made smaller on the phone (longest side 1600 px,
// JPEG) before it is sent, so one copy is small for everyone.
export function pickGreetingImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const c = canvas.getContext("2d");
          c.fillStyle = "#fff";
          c.fillRect(0, 0, w, h);
          c.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          let q = 0.86, data = canvas.toDataURL("image/jpeg", q);
          while (data.length > 2.5e6 && q > 0.4) data = canvas.toDataURL("image/jpeg", (q -= 0.12));
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(Object.assign(new Error("This file is not a picture"), { code: "PHOTO_BAD" }));
      };
      img.src = url;
    };
    input.click();
  });
}

export function AGreetingComposer({ lang, members, sent = [], busy, editing, onClose, onSend, onSaveEdit, onEdit, onRemove, onStats, onError }) {
  const [text, setText] = React.useState(editing ? editing.text || "" : "");
  // image: undefined = unchanged (edit) / none (new); string = new picture; null = removed.
  const [image, setImage] = React.useState(undefined);
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
  const preview = typeof image === "string" ? image : image === null ? "" : editing ? greetingImageUrl(editing) : "";
  const count = editing ? editing.count : mode === "all" ? members.length : picked.size;
  const ready = (text.trim().length > 0 || !!preview) && count > 0 && !busy;
  const choose = () =>
    pickGreetingImage()
      .then((data) => data && setImage(data))
      .catch((e) => onError && onError(e));
  return ah(
    ASheet,
    {
      title: t(editing ? "greet.editTitle" : "greet.title", lang),
      onClose,
      closeLabel: t("common.close", lang),
      testId: editing ? "Greeting editor" : "Greeting composer",
      className: "alpha-greet",
    },
    editing ? null : ah("p", { className: "alpha-hint" }, t("greet.hint", lang)),
    ah("textarea", {
      className: "alpha-greet-text",
      value: text,
      maxLength: 2000,
      rows: 5,
      placeholder: t("greet.placeholder", lang),
      "aria-label": t("greet.title", lang),
      "data-testid": "Greeting text",
      onChange: (e) => setText(e.target.value),
    }),
    ah("small", { className: "alpha-greet-count" }, text.length + " / 2000"),
    // Picture (optional): one copy on the server, shown in the Message Centre.
    preview
      ? ah(
          "div",
          { className: "alpha-greet-photo" },
          ah("img", { src: preview, alt: "", "data-testid": "Greeting photo preview" }),
          ah(
            "div",
            { className: "alpha-greet-photo-actions" },
            ah(AButton, { kind: "text", onClick: choose, "data-testid": "Greeting photo change" }, ah(AIcon, { name: "image" }), " ", t("greet.changePhoto", lang)),
            ah(AButton, { kind: "text", onClick: () => setImage(editing && editing.image ? null : undefined), "data-testid": "Greeting photo remove" }, ah(AIcon, { name: "trash" }), " ", t("greet.removePhoto", lang)),
          ),
        )
      : ah(AButton, { kind: "secondary", onClick: choose, "data-testid": "Greeting photo add" }, ah(AIcon, { name: "image" }), " ", t("greet.addPhoto", lang)),
    ah("p", { className: "alpha-hint alpha-greet-note" }, t("greet.photoNote", lang)),
    editing
      ? null
      : ah(
          "div",
          { className: "alpha-seg", role: "radiogroup", "aria-label": t("greet.to", lang) },
          ah("button", { type: "button", role: "radio", "aria-checked": mode === "all", onClick: () => setMode("all"), "data-testid": "Greeting to all" }, t("greet.toAll", lang)),
          ah("button", { type: "button", role: "radio", "aria-checked": mode === "some", onClick: () => setMode("some"), "data-testid": "Greeting to some" }, t("greet.toSome", lang)),
        ),
    !editing && mode === "some"
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
    editing
      ? ah(
          AButton,
          { kind: "primary", disabled: !ready, onClick: () => onSaveEdit({ text: text.trim(), ...(image !== undefined ? { image } : {}) }), "data-testid": "Greeting save" },
          ah(AIcon, { name: "check" }),
          " ",
          t("greet.save", lang),
        )
      : ah(
          AButton,
          {
            kind: "primary",
            disabled: !ready,
            onClick: () => onSend({ text: text.trim(), to: mode, ids: [...picked], ...(typeof image === "string" ? { image } : {}) }),
            "data-testid": "Greeting send",
          },
          ah(AIcon, { name: "paper-plane-tilt" }),
          " ",
          t("greet.send", lang, { n: count }),
        ),
    !editing && sent.length
      ? ah(
          "div",
          { className: "alpha-greet-sent" },
          ah("h3", { className: "settings-label" }, t("greet.sent", lang)),
          ...sent.slice(0, 20).map((g) =>
            ah(
              "div",
              { key: g.id, className: "alpha-greet-sent-item", "data-testid": "Sent greeting" },
              g.image ? ah("img", { src: greetingImageUrl(g), alt: "", className: "alpha-greet-thumb" }) : null,
              ah(
                "div",
                { className: "alpha-greet-sent-body" },
                ah("small", null, msgWhen(g.at, lang) + " · " + t("greet.reached", lang, { n: g.count }) + (g.edited ? " · " + t("msg.edited", lang) : "")),
                ah("span", null, g.text ? (g.text.length > 120 ? g.text.slice(0, 117) + "…" : g.text) : t("greet.photoOnly", lang)),
                ah("small", { className: "alpha-greet-stats", "data-testid": "Sent greeting counts" }, t("greet.seenLiked", lang, { seen: g.seen || 0, liked: g.liked || 0 })),
                ah(
                  "div",
                  { className: "alpha-greet-sent-actions" },
                  ah(AButton, { kind: "text", onClick: () => onStats(g), "data-testid": "Sent greeting details" }, ah(AIcon, { name: "eye" }), " ", t("greet.details", lang)),
                  ah(AButton, { kind: "text", onClick: () => onEdit(g), "data-testid": "Sent greeting edit" }, ah(AIcon, { name: "pencil-simple" }), " ", t("greet.edit", lang)),
                  ah(AButton, { kind: "text", onClick: () => onRemove(g), "data-testid": "Sent greeting remove" }, ah(AIcon, { name: "trash" }), " ", t("greet.remove", lang)),
                ),
              ),
            ),
          ),
        )
      : null,
  );
}

export function AGreetingStats({ lang, stats, onClose }) {
  const list = (rows, testId) =>
    rows.length
      ? ah(
          "ul",
          { className: "alpha-greet-people", "data-testid": testId },
          ...rows.map((p) =>
            ah(
              "li",
              { key: p.id },
              ah("span", null, nameFor(p, lang), ah("small", null, villageName(p.village, lang))),
              ah("small", null, msgWhen(p.at, lang)),
            ),
          ),
        )
      : ah("p", { className: "alpha-hint" }, t("greet.nobody", lang));
  return ah(
    ASheet,
    { title: t("greet.statsTitle", lang), onClose, closeLabel: t("common.close", lang), testId: "Greeting stats" },
    ah("h3", { className: "settings-label" }, "❤ " + t("greet.likedBy", lang, { n: stats.liked.length })),
    list(stats.liked, "Greeting liked list"),
    ah("h3", { className: "settings-label" }, "👁 " + t("greet.seenBy", lang, { n: stats.seen.length })),
    list(stats.seen, "Greeting seen list"),
    stats.notSeen > 0 ? ah("p", { className: "alpha-hint" }, t("greet.notSeen", lang, { n: stats.notSeen })) : null,
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
      message.text ? ah("div", { className: "alpha-flash-text", "data-testid": "Flash text" }, message.text) : null,
      // The picture itself is shown in the Message Centre only.
      message.image ? ah("p", { className: "alpha-flash-photo", "data-testid": "Flash photo note" }, t("msg.photoInCentre", lang)) : null,
      more > 0 ? ah("p", { className: "alpha-hint" }, t("msg.more", lang, { n: more })) : null,
      ah(AButton, { kind: "secondary", onClick: onOpen, "data-testid": "Flash open centre" }, ah(AIcon, { name: "envelope-simple" }), " ", t("msg.openCentre", lang)),
    ),
  );
}

export function AMessageCentre({ lang, messages, onBack, onRead, onDelete, onLike, onSave }) {
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
              const img = greetingImageUrl(m);
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
                    ah("small", null, (m.read ? "" : t("msg.new", lang) + " · ") + msgWhen(m.at, lang) + (m.edited ? " · " + t("msg.edited", lang) : "")),
                    m.text ? ah("span", { className: "alpha-msg-text" }, m.text) : null,
                  ),
                ),
                // The picture: one shared copy, loaded from the server.
                img
                  ? ah(
                      "button",
                      {
                        type: "button",
                        className: "alpha-msg-photo",
                        onClick: () => {
                          setOpen(m.id);
                          if (!m.read) onRead(m.id);
                        },
                        "aria-label": t("greet.photoOnly", lang),
                      },
                      ah("img", { src: img, alt: "", loading: "lazy", "data-testid": "Message photo" }),
                    )
                  : null,
                ah(
                  "div",
                  { className: "alpha-msg-actions" },
                  ah(
                    "button",
                    {
                      type: "button",
                      className: "alpha-msg-like" + (m.liked ? " is-liked" : ""),
                      "aria-pressed": !!m.liked,
                      onClick: () => onLike(m.id, !m.liked),
                      "data-testid": "Message like",
                    },
                    ah(AIcon, { name: "heart" }),
                    " ",
                    t(m.liked ? "msg.liked" : "msg.like", lang),
                  ),
                  ah("small", { className: "alpha-msg-likes", "data-testid": "Message likes" }, m.likes ? t("msg.likes", lang, { n: m.likes }) : ""),
                  img ? ah(AButton, { kind: "text", onClick: () => onSave(m), "data-testid": "Message save" }, ah(AIcon, { name: "download-simple" }), " ", t("msg.save", lang)) : null,
                  isOpen ? ah(AButton, { kind: "text", onClick: () => onDelete(m.id), "data-testid": "Message delete" }, ah(AIcon, { name: "trash" }), " ", t("msg.delete", lang)) : null,
                ),
              );
            }),
          )
        : ah("div", { className: "alpha-msg-empty" }, ah("img", { src: "/brand/sun-logo-192.png", alt: "", width: 72, height: 72 }), ah("p", null, t("msg.empty", lang))),
    ),
  );
}
