export const TEXT_SIZE_MIN = 85;
export const TEXT_SIZE_MAX = 165;
// Retain exact saved slider/preset values, including 120/140/160 from cp002.
export function normalizeTextSize(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 100;
  return Math.max(TEXT_SIZE_MIN, Math.min(TEXT_SIZE_MAX, Math.round(value)));
}
