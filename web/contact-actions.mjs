// Shared by the generated renderer and Node regression tests.
export function contactLinks(raw, nativeHost = false) {
  const text = String(raw ?? "").trim();
  if (!/^\+?[\d ()-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return {
    number: "+91" + digits,
    call: "tel:+91" + digits,
    whatsapp: "https://wa.me/91" + digits,
    target: nativeHost ? "_self" : "_blank",
  };
}
