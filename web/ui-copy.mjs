// Interface copy only. Names and other member-entered content are never machine-translated.
export const UI_COPY = {
  exploreVillages: ["ગામ પસંદ કરો", "Explore villages"],
  dismissSettings: ["પાછા જાઓ", "Dismiss settings"],
  communityName: ["મહુવા વાળા રાજપૂત સમાજ", "Mahuva Vala Rajput Samaj"],
  welcome: ["સમાજમાં તમારું સ્વાગત છે", "A place for our people"],
  directoryView: ["યાદીનો દેખાવ", "Directory view"],
  villages: ["ગામો", "Villages"],
  allMembers: ["બધા સભ્યો", "All Members"],
  lightTheme: ["આછો", "Light"],
  darkTheme: ["ઘેરો", "Dark"],

  offline: [
    "ઇન્ટરનેટ નથી. જોડાણ તપાસો અને ફરી પ્રયાસ કરવા દબાવો.",
    "You’re offline. Check your connection and tap to retry.",
  ],
  stale: [
    "જોડાણ તૂટ્યું. દેખાતી માહિતી જૂની હોઈ શકે છે. ફેરફાર માટે જોડાણ જરૂરી છે. ફરી પ્રયાસ કરો.",
    "Connection lost. Displayed information may be out of date. Changes need a connection. Tap to retry.",
  ],
  unavailable: [
    "સર્વર સાથે જોડાઈ શકાયું નથી. ફરી પ્રયાસ કરવા દબાવો.",
    "The server is unavailable. Tap to retry.",
  ],
  lastConfirmed: ["છેલ્લે જોડાણ થયું", "Last connected"],

  effects: ["દૃશ્ય અસરો", "Visual effects"],
  effectsHelp: [
    "બંધ કરવાથી સાદો દેખાવ મળે છે.",
    "Switch off for a simpler appearance.",
  ],
  resetSize: ["મૂળ માપ", "Reset to 100%"],
  sliderHelp: [
    "સરકાવો અથવા તીર કી વાપરો.",
    "Drag or use arrow keys. Applies across the app.",
  ],

  adminPanel: ["એડમિન પેનલ", "Admin panel"],
  restricted: ["ફક્ત અધિકૃત પ્રવેશ", "Restricted access"],
  call: ["ફોન કરો", "Call"],
  whatsapp: ["વોટ્સએપ", "WhatsApp"],
  edit: ["ફેરફાર કરો", "Edit"],
  delete: ["દૂર કરો", "Delete"],
  language: ["ભાષા", "Language"],
  allAdmins: ["બધા એડમિન", "All admins"],
  villageAdmin: ["ગામ એડમિન", "Village admin"],
  profile: ["મારી પ્રોફાઇલ", "My profile"],
  security: ["સુરક્ષા ચેતવણીઓ", "Security alerts"],
  password: ["પાસવર્ડ બતાવો અથવા છુપાવો", "Show or hide password"],
  signout: ["સાઇન આઉટ", "Sign out"],
  theme: ["દેખાવ", "Theme"],
  choose: ["વિકલ્પ પસંદ કરો", "Choose an option"],
  confirm: ["કાર્યની ખાતરી કરો", "Confirm action"],
  contact: ["સંપર્ક વિકલ્પ", "Contact action"],
  textSize: ["અક્ષરનું માપ", "Text size"],
  notifications: ["ફોન સૂચનાઓ", "Phone notifications"],
  backDashboard: ["ડેશબોર્ડ પર પાછા જાઓ", "Back to dashboard"],
  backDirectory: ["યાદીમાં પાછા જાઓ", "Back to directory"],
  backLogin: ["લોગિન પર પાછા જાઓ", "Back to login"],
  removeSecond: ["બીજો નંબર કાઢો", "Remove second number"],
  clearSearch: ["શોધ સાફ કરો", "Clear search"],
  preferences: ["તમારી પસંદગી", "Make it yours"],
  close: ["બંધ કરો", "Close"],
  light: ["આછો દેખાવ", "Light"],
  dark: ["ઘેરો દેખાવ", "Dark"],
  help: ["સભ્ય સહાય", "Member help"],
  reorder: ["ગામનો ક્રમ બદલો", "Reorder villages"],
  done: ["પૂર્ણ", "Done"],
  earlier: ["આગળ લાવો", "Move earlier"],
  later: ["પાછળ ખસેડો", "Move later"],
  resetOrder: ["મૂળ ક્રમ", "Reset order"],
  savedOrder: ["ગામનો ક્રમ સાચવ્યો", "Village order saved"],
  submitted: ["મોકલ્યાની તારીખ", "Submitted"],
  waiting: ["એડમિનની મંજૂરીની રાહમાં", "Waiting for admin approval"],
  waitBody: [
    "આ વિનંતી એડમિન તપાસશે. તમે એપ બંધ કરી શકો છો અને પછી આ જ ફોન કે બ્રાઉઝરમાં પાછા આવી શકો છો. મંજૂરીનો સમય નિશ્ચિત નથી. વધુ મદદ માટે સભ્ય સહાય જુઓ.",
    "An administrator will review your request. You can close the app and return on this same phone or browser. Approval time is not guaranteed. See Member help if you need assistance.",
  ],
  connection: [
    "કનેક્શન તૂટ્યું — ફરી પ્રયાસ કરવા દબાવો",
    "Connection lost — tap to retry",
  ],
  busy: ["કૃપા કરીને રાહ જુઓ…", "Please wait…"],
};
export const FIELD_COPY = {
  name: ["નામ", "Name"],
  nameGu: ["ગુજરાતી નામ", "Gujarati name"],
  phone: ["પોતાનો નંબર", "Personal number"],
  phone2: ["બીજો નંબર", "Second number"],
  label2: ["નંબરનો પ્રકાર", "Number type"],
  village: ["ગામ", "Village"],
  tehsil: ["તાલુકો", "Tehsil"],
  district: ["જિલ્લો", "District"],
  work: ["ધંધાનો", "Work"],
  other: ["બીજો", "Other"],
};
export function uiText(key, lang = "gu") {
  return UI_COPY[key]?.[lang === "en" ? 1 : 0] || key;
}
export function fieldText(key, lang = "gu") {
  return FIELD_COPY[key]?.[lang === "en" ? 1 : 0] || key;
}
export function singleLanguageStatus(raw, lang = "gu") {
  const value = String(raw || "");
  const parts = value.split(/\s+·\s+/);
  if (
    parts.length >= 2 &&
    /[\u0a80-\u0aff]/.test(parts[0]) &&
    /[a-z]/i.test(parts[1])
  )
    return lang === "en" ? parts.slice(1).join(" · ") : parts[0];
  return value;
}
export function canSearch(raw) {
  const text = String(raw || "").trim();
  return /[\p{L}]/u.test(text)
    ? text.length > 0
    : text.replace(/\D/g, "").length >= 3;
}

export function errorText(message, lang = "gu") {
  const text = singleLanguageStatus(message, lang);
  if (lang === "en") return text;
  const exact = {
    "Use a new browser session to recover access":
      "પ્રવેશ પાછો મેળવવા નવા ફોન કે ખાનગી બ્રાઉઝર વિન્ડોમાં આ ફોર્મ ખોલો.",
    "Invalid or expired recovery code. Ask your administrator for a new code":
      "કોડ ખોટો છે અથવા મુદત પૂરી થઈ છે. એડમિન પાસેથી નવો કોડ મેળવો.",
    "Wrong username or password": "યુઝરનેમ અથવા પાસવર્ડ ખોટો છે.",
    "Incorrect access code": "પ્રવેશ કોડ ખોટો છે.",
    "Incorrect recovery code": "રિકવરી કોડ ખોટો છે.",
    "Access code required": "પ્રવેશ કોડ દાખલ કરો.",
    "Admin authentication required": "એડમિન તરીકે લોગિન કરો.",
    "Admin approval required": "એડમિનની મંજૂરી જરૂરી છે.",
    "Code expired. Request a new code": "કોડની મુદત પૂરી થઈ. નવો કોડ મંગાવો.",
    "Incorrect code": "કોડ ખોટો છે.",
    "Reset temporarily locked. Try again in 15 minutes.":
      "રીસેટ થોડા સમય માટે બંધ છે. ૧૫ મિનિટ પછી પ્રયત્ન કરો.",
    "Too many attempts. Reset locked for 15 minutes.":
      "ઘણા પ્રયાસો થયા. ૧૫ મિનિટ પછી પ્રયત્ન કરો.",
    "Use 10+ characters, upper/lowercase, a number and a symbol":
      "૧૦થી વધુ અક્ષર, નાના-મોટા અંગ્રેજી અક્ષર, આંકડો અને ચિહ્ન વાપરો.",
    "Request already processed. Refresh and try again":
      "આ વિનંતી પર કાર્યવાહી થઈ ગઈ છે. ફરી લોડ કરીને પ્રયત્ન કરો.",
    "Both numbers must be different": "બંને ફોન નંબર જુદા હોવા જોઈએ.",
    "Cannot block your current admin session":
      "તમે તમારી ચાલુ એડમિન બેઠકને અવરોધિત કરી શકતા નથી.",
    "Backup exceeds 10 MB": "બેકઅપ ફાઇલ ૧૦ MBથી મોટી છે.",
    "Notifications are not supported in this browser":
      "આ બ્રાઉઝર સૂચનાઓ આપી શકતું નથી.",
    "Notification permission was not granted":
      "સૂચનાઓની પરવાનગી મળી નથી.",
    "Only an approved member's own phone can use a reset code":
      "રીસેટ કોડ ફક્ત સભ્યના પોતાના ફોન પર જ ચાલે છે.",
    "Confirm you spoke with this member first":
      "પહેલા સભ્ય સાથે વાત કરીને ખાતરી કરો.",
    "Ask the main administrator for your own reset code":
      "તમારો પોતાનો કોડ મુખ્ય એડમિન પાસેથી મેળવો.",
    "A PIN is already set. Use Change PIN.":
      "પિન પહેલેથી છે. 'પિન બદલો' વાપરો.",
    "Unlock the app first": "પહેલા એપ ખોલો.",
    "Set a PIN first": "પહેલા પિન બનાવો.",
    "Confirm independent identity verification":
      "ઓળખ ખાતરીનું ખાનું પસંદ કરો.",
  };
  if (exact[text]) return exact[text];
  if (/[\u0a80-\u0aff]/.test(text)) return text;
  if (/phone.*(use|exist)|number.*(use|exist)/i.test(text))
    return "આ નંબર પહેલેથી નોંધાયેલો છે. સભ્ય સહાય જુઓ.";
  if (/network|fetch|timeout|connect/i.test(text))
    return "કનેક્શન તપાસો અને ફરી પ્રયત્ન કરો.";
  if (/backup|restore/i.test(text))
    return "બેકઅપની વિગતો અથવા પુષ્ટિ માન્ય નથી. ફાઇલ તપાસીને ફરી પ્રયત્ન કરો.";
  return "કાર્ય પૂર્ણ થઈ શક્યું નથી. વિગતો તપાસીને ફરી પ્રયત્ન કરો અથવા એડમિનનો સંપર્ક કરો.";
}
