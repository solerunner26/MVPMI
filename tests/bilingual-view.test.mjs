import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bilingual, bilingualView } from "../web/bilingual.mjs";
globalThis.React = React;
test("one language at a time: the selected script is shown alone", () => {
  assert.equal(bilingual("ગામ", "Village", "gu"), "ગામ");
  assert.equal(bilingual("ગામ", "Village", "en"), "Village");
  assert.equal(bilingual("9000000001", "9000000001"), "9000000001");
  assert.equal(bilingual("only", ""), "only");
  assert.equal(bilingual("ગામ", "Village"), "ગામ");
});
test("rendered copy escapes untrusted names and never injects HTML", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      "span",
      null,
      bilingual("<img src=x onerror=attack()>", "Test"),
    ),
  );
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
});
test("presentation merge retains primary callbacks, canonical inputs and list order", () => {
  const click = () => {},
    base = {
      me: { rows: [] },
      err: {},
      sections: [],
      form: { name: "Raw name", village: "થોરાળા", place: "થોરાળા" },
      ui: { help: "મદદ" },
      villageTiles: [],
      updateRequests: [],
      members: [],
      tiles: [],
      onClick: click,
    };
  const other = {
    ...base,
    form: { ...base.form, village: "Thorala", place: "Thorala" },
    ui: { help: "Help" },
    onClick: () => {},
  };
  const out = bilingualView(base, other, "gu");
  assert.equal(out.onClick, click);
  assert.equal(out.form.village, "થોરાળા");
  assert.equal(out.form.name, "Raw name");
  assert.equal(base.form.place, "થોરાળા");
  assert.equal(other.form.place, "Thorala");
  assert.equal(out.copy.help, "મદદ");
});
