export const TEXT_SIZES = [
  { label: "Default", gu: "મૂળ માપ", value: 100 },
  { label: "Big", gu: "મોટું", value: 120 },
  { label: "Bigger", gu: "વધુ મોટું", value: 140 },
  { label: "Biggest", gu: "સૌથી મોટું", value: 160 },
];

// Migrate saved slider values to the nearest supported preset.
export function normalizeTextSize(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 100;
  return TEXT_SIZES.reduce(
    (best, option) =>
      Math.abs(option.value - value) < Math.abs(best - value)
        ? option.value
        : best,
    100,
  );
}
