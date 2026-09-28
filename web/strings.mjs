// Bilingual string resources for every screen added in the alpha audit
// (Gujarati first, English second). Screens call t(key, lang); no screen
// text is hard-coded in the components. Keys are grouped by screen.
export const STR = {
  // ---- Section 0: terms -------------------------------------------------
  "term.password": ["પાસવર્ડ", "Password"],
  "term.pin": ["પિન", "PIN"],
  "term.tempPin": ["કામચલાઉ પિન", "TEMP PIN"],
  "role.MAIN_ADMIN": ["મુખ્ય એડમિન", "Main Admin"],
  "role.VILLAGE_ADMIN": ["ગામ એડમિન", "Village Admin"],
  "role.MEMBER": ["સભ્ય", "Member"],
  "status.PENDING": ["મંજૂરી બાકી", "Pending"],
  "status.APPROVED": ["મંજૂર", "Approved"],
  "status.REJECTED": ["નામંજૂર", "Rejected"],
  "status.REMOVED": ["દૂર કરેલ", "Removed"],

  // ---- Errors returned by the server (matched by error code) -------------
  "err.NETWORK": [
    "ઇન્ટરનેટ નથી અથવા સર્વર મળતું નથી. ફરી પ્રયાસ કરો.",
    "No internet or the server is not reachable. Please try again.",
  ],
  "err.WRONG_PIN": ["પિન ખોટો છે.", "Wrong PIN."],
  "err.WRONG_PASSWORD": ["પાસવર્ડ ખોટો છે.", "Wrong password."],
  "err.WRONG_OLD_PIN": ["જૂનો પિન ખોટો છે.", "The old PIN is wrong."],
  "err.WRONG_OLD_PASSWORD": ["જૂનો પાસવર્ડ ખોટો છે.", "The old password is wrong."],
  "err.PIN_FORMAT": ["પિન બરાબર ૪ આંકડાનો હોવો જોઈએ.", "The PIN must be exactly 4 digits."],
  "err.PIN_WEAK": [
    "આ પિન ખૂબ સહેલો છે (જેમ કે 1111, 1234). બીજો પિન પસંદ કરો.",
    "This PIN is too easy (like 1111 or 1234). Choose another PIN.",
  ],
  "err.PIN_MISMATCH": ["બંને નવા પિન એકસરખા નથી.", "The two new PINs do not match."],
  "err.PIN_SAME": ["નવો પિન જૂના પિન જેવો જ છે.", "The new PIN is the same as the old PIN."],
  "err.PASSWORD_FORMAT": [
    "પાસવર્ડ ઓછામાં ઓછો ૮ અક્ષરનો હોવો જોઈએ.",
    "The password must be at least 8 characters.",
  ],
  "err.PASSWORD_MISMATCH": ["બંને નવા પાસવર્ડ એકસરખા નથી.", "The two new passwords do not match."],
  "err.PASSWORD_SAME": [
    "નવો પાસવર્ડ જૂના પાસવર્ડ જેવો જ છે.",
    "The new password is the same as the old password.",
  ],
  "err.LOCKED_OUT": [
    "ઘણા ખોટા પ્રયાસો. {min} મિનિટ {sec} સેકન્ડ પછી ફરી પ્રયાસ કરો.",
    "Too many wrong attempts. Try again in {min} min {sec} s.",
  ],
  "err.MOBILE_FORMAT": [
    "૧૦ આંકડાનો મોબાઇલ નંબર લખો (6–9 થી શરૂ થતો).",
    "Enter a 10-digit mobile number (starting with 6–9).",
  ],
  "err.NOT_REGISTERED": [
    "આ નંબર નોંધાયેલો નથી. પહેલા નોંધણી કરો.",
    "This number is not registered. Please register first.",
  ],
  "err.STATUS_APPROVED": [
    "આ નંબર પહેલેથી સભ્ય છે. કૃપા કરીને લોગિન કરો.",
    "This number is already a member. Please log in.",
  ],
  "err.STATUS_PENDING": [
    "તમારી નોંધણી મંજૂરીની રાહમાં છે.",
    "Your registration is waiting for approval.",
  ],
  "err.STATUS_REJECTED": [
    "તમારી નોંધણી મંજૂર થઈ નથી. તમારા ગામના એડમિનનો સંપર્ક કરો.",
    "Your registration was not approved. Contact your village admin.",
  ],
  "err.STATUS_REMOVED": [
    "આ નંબર યાદીમાંથી દૂર કરાયો છે. તમારા ગામના એડમિનનો સંપર્ક કરો.",
    "This number was removed. Contact your village admin.",
  ],
  "err.NO_PIN_YET": [
    "તમારો પિન હજુ બન્યો નથી. ગામના એડમિન પાસેથી કામચલાઉ પિન મેળવો.",
    "Your PIN has not been created yet. Ask your village admin for a TEMP PIN.",
  ],
  "err.ACCOUNT_DISABLED": [
    "આ એડમિન ખાતું બંધ કરેલ છે. મુખ્ય એડમિનનો સંપર્ક કરો.",
    "This admin account is disabled. Contact the Main Admin.",
  ],
  "err.CONSENT": ["આગળ વધવા સંમતિનું ખાનું પસંદ કરો.", "Tick the consent box to continue."],
  "err.NO_VILLAGE_ADMIN": [
    "આ ગામ માટે ગામ એડમિન હજુ નિયુક્ત નથી. મુખ્ય એડમિનનો સંપર્ક કરો.",
    "This village has no Village Admin yet. Contact the Main Admin.",
  ],
  "err.VILLAGE_TAKEN": [
    "આ ગામમાં પહેલેથી સક્રિય ગામ એડમિન છે.",
    "This village already has an active Village Admin.",
  ],
  "err.PHONE_IN_USE": [
    "આ મોબાઇલ નંબર બીજા સભ્ય કે વિનંતીમાં વપરાયો છે.",
    "This mobile number is already used by another member or request.",
  ],
  "err.SESSION": ["ફરી લોગિન કરો.", "Please log in again."],
  "err.LOCKED": ["એપ લોક છે. પિન નાખો.", "The app is locked. Enter your PIN."],
  "err.SET_PIN_FIRST": ["પહેલા તમારો નવો પિન બનાવો.", "Set your new PIN first."],
  "err.FORBIDDEN": ["આ કામ કરવાની પરવાનગી નથી.", "You are not allowed to do this."],
  "err.GENERIC": [
    "કામ પૂર્ણ થઈ શક્યું નથી. ફરી પ્રયાસ કરો.",
    "Could not complete this. Please try again.",
  ],
};

// ---- Section 1: offline ------------------------------------------------
Object.assign(STR, {
  "offline.banner": [
    "ઇન્ટરનેટ નથી / સર્વર મળતું નથી — ફરી પ્રયાસ કરો",
    "No internet / Server not reachable — Retry",
  ],
  "offline.lastUpdated": ["છેલ્લે અપડેટ: {time}", "Last updated: {time}"],
  "offline.readOnly": [
    "ઑફલાઇન: સંપર્ક જોઈ અને ફોન કરી શકાય છે. ફેરફાર માટે ઇન્ટરનેટ જરૂરી છે.",
    "Offline: you can view and call contacts. Changes need internet.",
  ],
  "offline.retry": ["ફરી પ્રયાસ કરો", "Retry"],
});

export function t(key, lang = "gu", vars) {
  const row = STR[key];
  let text = row ? row[lang === "en" ? 1 : 0] : key;
  if (vars)
    for (const [k, v] of Object.entries(vars))
      text = text.replaceAll("{" + k + "}", String(v));
  return text;
}

// Text for a server error: the error code wins, then the old bilingual
// "ગુ · En" message, then a generic line.
export function errorMessage(error, lang = "gu") {
  if (!error) return "";
  if (error.code === "LOCKED_OUT" && error.until) {
    const left = Math.max(0, Math.ceil((error.until - Date.now()) / 1000));
    return t("err.LOCKED_OUT", lang, { min: Math.floor(left / 60), sec: left % 60 });
  }
  if (error.code && STR["err." + error.code]) return t("err." + error.code, lang);
  if (error.network) return t("err.NETWORK", lang);
  return typeof errorText === "function"
    ? errorText(error.message || String(error), lang)
    : t("err.GENERIC", lang);
}
