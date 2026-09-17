import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTextSize,
  TEXT_SIZE_MIN,
  TEXT_SIZE_MAX,
} from "../web/text-size.mjs";
test("continuous text slider spans 85 through 165, not four presets", () => {
  assert.equal(TEXT_SIZE_MIN, 85);
  assert.equal(TEXT_SIZE_MAX, 165);
  for (let i = 85; i <= 165; i++) assert.equal(normalizeTextSize(i), i);
});
test("saved slider values and previous presets are preserved exactly", () => {
  for (const n of [85, 100, 115, 120, 135, 140, 160, 165])
    assert.equal(normalizeTextSize(String(n)), n);
  assert.equal(normalizeTextSize(84), 85);
  assert.equal(normalizeTextSize(999), 165);
});
test("invalid preferences safely return to 100%", () => {
  for (const raw of [undefined, null, "", "bad", Infinity, NaN, -5, {}, []])
    assert.equal(normalizeTextSize(raw), 100);
});
