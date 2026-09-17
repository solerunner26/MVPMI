import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bilingual, bilingualView } from "../web/bilingual.mjs";
globalThis.React = React;
test("paired copy keeps both languages, correct language tags and preferred order", () => {
  for (const lang of ["gu", "en"]) {
    const html = renderToStaticMarkup(bilingual("ગામ", "Village", lang));
    assert.match(html, /lang="gu"/);
    assert.match(html, /lang="en"/);
    assert.equal(
      html.indexOf(lang === "gu" ? "ગામ" : "Village") <
        html.indexOf(lang === "gu" ? "Village" : "ગામ"),
      true,
    );
  }
  assert.equal(bilingual("9000000001", "9000000001"), "9000000001");
  assert.equal(bilingual("only", ""), "only");
});
test("pair renderer escapes untrusted names and never injects HTML", () => {
  const html = renderToStaticMarkup(
    bilingual("<img src=x onerror=attack()>", "Test"),
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
  assert.match(renderToStaticMarkup(out.copy.help), /મદદ.*Help/);
});
