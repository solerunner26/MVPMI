import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  UI_COPY,
  uiText,
  fieldText,
  singleLanguageStatus,
  canSearch,
  errorText,
} from "../web/ui-copy.mjs";
import { printDocument } from "../web/print-document.mjs";

test("all interface copy has Gujarati and English versions, default Gujarati", () => {
  for (const [key, pair] of Object.entries(UI_COPY)) {
    assert.equal(pair.length, 2);
    assert.match(pair[0], /[\u0a80-\u0aff]/);
    assert.ok(pair[1]);
    assert.equal(uiText(key), pair[0]);
    assert.equal(uiText(key, "en"), pair[1]);
  }
});
test("system status uses one language without changing ordinary device names", () => {
  assert.equal(singleLanguageStatus("કેન્સલ · Withdrawn by user"), "કેન્સલ");
  assert.equal(
    singleLanguageStatus("કેન્સલ · Withdrawn by user", "en"),
    "Withdrawn by user",
  );
  assert.equal(
    singleLanguageStatus("Android 13 · Phone X", "en"),
    "Android 13 · Phone X",
  );
});
test("names may be short, phone search still needs three digits", () => {
  for (const q of ["Te", "રમ", "A", "900"]) assert.equal(canSearch(q), true, q);
  for (const q of ["", "  ", "90", "+91", "---"])
    assert.equal(canSearch(q), false, q);
});
test("comparison labels and authentication failures are translated", () => {
  assert.equal(fieldText("phone2", "en"), "Second number");
  assert.equal(fieldText("phone2", "gu"), "બીજો નંબર");
  assert.match(errorText("Wrong username or password"), /પાસવર્ડ/);
  assert.equal(
    errorText("Wrong username or password", "en"),
    "Wrong username or password",
  );
});
test("printed directory follows language and escapes member content", () => {
  const members = [
    {
      name: '<img src=x onerror="alert(1)">',
      nameGu: "ગુજરાતી નામ",
      phone: "9000000001",
    },
  ];
  const en = printDocument(members, "en"),
    gu = printDocument(members);
  assert.match(en, /lang="en"/);
  assert.match(gu, /lang="gu"/);
  assert.ok(!en.includes("<img"));
  assert.ok(en.includes("&lt;img"));
  assert.ok(!en.includes("ગુજરાતી નામ"));
  assert.ok(gu.includes("ગુજરાતી નામ"));
});
test("original design stays intact and refined template removes corrupted copy", async () => {
  const { refineDesign } = await import("../scripts/refine-design.mjs");
  const original = readFileSync("Community Directory.dc.html", "utf8");
  const source = original.slice(
    original.indexOf('<div class="app"'),
    original.indexOf("</x-import>"),
  );
  const current = refineDesign(source);
  assert.ok(!current.includes("ફરી ��ોકલશો"));
  assert.ok(current.includes('class="utility-bar"'));
  assert.ok(current.includes("v.moveEarlier"));
  assert.ok(!current.includes('draggable="true"'));
  assert.ok(current.includes("preferencesOpen"));
});

test("Excel headers follow the requested language and remain admin-only", async (t) => {
  const { createApp } = await import("../server/app.mjs");
  const { default: ExcelJS } = await import("exceljs");
  const { app, store } = createApp({
    dbPath: ":memory:",
    adminPassword: "LanguageTest@2026",
    gateCode: "5831",
    development: true,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    store.db.close();
  });
  let cookie = "";
  const request = async (path, body) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          cookie,
          "X-MVPMI-Client": "1",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return response;
  };
  assert.equal((await request("admin/export.xlsx?lang=en")).status, 403);
  assert.equal((await request("admin/gate", { code: "5831" })).status, 200);
  assert.equal(
    (await request("admin/login", { user: "admin", pass: "LanguageTest@2026" }))
      .status,
    200,
  );
  for (const [lang, heading] of [
    ["en", "Name (Gujarati)"],
    ["gu", "ગુજરાતી નામ"],
  ]) {
    const response = await request("admin/export.xlsx?lang=" + lang);
    assert.equal(response.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    assert.equal(book.worksheets[0].getCell("A1").value, heading);
  }
});
