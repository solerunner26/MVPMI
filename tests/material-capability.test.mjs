import test from "node:test";
import assert from "node:assert/strict";
import { materialCapability } from "../web/material-capability.mjs";
test("unknown/no-blur devices get the deliberate translucent fallback", () => {
  assert.equal(materialCapability(), "translucent");
  assert.equal(materialCapability({ blur: true }), "blur");
});
test("accessibility, explicit simplicity, data and low-resource hints win over blur", () => {
  for (const option of [
    { enabled: false },
    { reduceTransparency: true },
    { forcedColors: true },
    { saveData: true },
    { memory: 2 },
    { cores: 2 },
  ])
    assert.equal(materialCapability({ blur: true, ...option }), "opaque");
});
