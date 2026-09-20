import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bilingualView } from "../web/bilingual.mjs";
import { modernDesign } from "../scripts/modern-design.mjs";
globalThis.React = React;
const view = () => ({
  me: { rows: [], name: "Sample member", nameGu: "નમૂના સભ્ય" },
  ui: {},
  err: {},
  form: {},
  sections: [],
  villageTiles: [],
  updateRequests: [],
  members: [],
  tiles: [],
});
test("modern adapter fails closed when a structural contract is missing", () => {
  assert.throws(
    () => modernDesign("<div>Changed template</div>"),
    /Modern design contract missing/,
  );
});
test("modern profile shows the stored name in the selected language only", () => {
  const base = view();
  assert.equal(bilingualView(base, base, "gu").profileName, "નમૂના સભ્ય");
  assert.equal(bilingualView(base, base, "en").profileName, "Sample member");
  base.me.nameGu = base.me.name;
  assert.equal(bilingualView(base, base, "gu").profileName, "Sample member");
});
test("contact copy keeps both real explanations and link metadata without HTML injection", () => {
  const base = view();
  base.dial = {
    gu: "ફોન એપ ખોલો",
    en: "Open your phone app <script>",
    href: "tel:+919000000001",
    target: "_self",
    name: "Sample member",
  };
  const rendered = bilingualView(base, base, "en");
  assert.equal(rendered.contactCopy, "Open your phone app <script>");
  assert.equal(
    renderToStaticMarkup(
      React.createElement("span", null, rendered.contactCopy),
    ),
    "<span>Open your phone app &lt;script&gt;</span>",
  );
  assert.equal(rendered.dial.href, base.dial.href);
  assert.equal(rendered.dial.target, "_self");
});
