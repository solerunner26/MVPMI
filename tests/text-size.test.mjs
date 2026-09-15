import test from "node:test";
import assert from "node:assert/strict";
import { TEXT_SIZES, normalizeTextSize } from "../web/text-size.mjs";

test("text presets have one default and three strictly increasing larger sizes", () => {
  assert.deepEqual(
    TEXT_SIZES.map((x) => x.label),
    ["Default", "Big", "Bigger", "Biggest"],
  );
  assert.deepEqual(
    TEXT_SIZES.map((x) => x.value),
    [100, 120, 140, 160],
  );
  for (const size of TEXT_SIZES)
    assert.equal(normalizeTextSize(size.value), size.value);
});
test("legacy slider preferences migrate to a supported preset", () => {
  assert.equal(normalizeTextSize(85), 100);
  assert.equal(normalizeTextSize(115), 120);
  assert.equal(normalizeTextSize(135), 140);
  assert.equal(normalizeTextSize(165), 160);
  assert.equal(normalizeTextSize("140"), 140);
});
test("invalid font preferences safely return to Default", () => {
  for (const raw of [undefined, null, "", "bad", Infinity, NaN, -5, {}, []])
    assert.equal(normalizeTextSize(raw), 100);
});
