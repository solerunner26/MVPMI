// No OS-version promises or continuous GPU probes. Unknown/limited devices keep
// full functionality; effects are independent of domain state and navigation.
export function materialCapability({
  enabled = true,
  reduceTransparency = false,
  forcedColors = false,
  saveData = false,
  memory,
  cores,
  blur = false,
} = {}) {
  if (
    !enabled ||
    reduceTransparency ||
    forcedColors ||
    saveData ||
    (memory > 0 && memory <= 2) ||
    (cores > 0 && cores <= 2)
  )
    return "opaque";
  return blur ? "blur" : "translucent";
}
