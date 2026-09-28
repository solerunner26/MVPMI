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

// ---- Shared words -------------------------------------------------------
Object.assign(STR, {
  "app.title": ["સમાજ સંપર્ક યાદી", "Community Directory"],
  "app.community": ["મહુવા ક્ષત્રિય રાજપૂત સમાજ", "Mahuva Kshatriya Rajput Samaj"],
  "common.back": ["પાછા જાઓ", "Back"],
  "common.close": ["બંધ કરો", "Close"],
  "common.cancel": ["રદ કરો", "Cancel"],
  "common.save": ["સાચવો", "Save"],
  "common.saved": ["સાચવ્યું", "Saved"],
  "common.done": ["થઈ ગયું", "Done"],
  "common.continue": ["આગળ વધો", "Continue"],
  "common.yes": ["હા", "Yes"],
  "common.no": ["ના", "No"],
  "common.show": ["બતાવો", "Show"],
  "common.hide": ["છુપાવો", "Hide"],
  "common.wait": ["કૃપા કરીને રાહ જુઓ…", "Please wait…"],
  "common.required": ["જરૂરી", "Required"],
  "common.optional": ["વૈકલ્પિક", "optional"],
  "field.mobile": ["મોબાઇલ નંબર", "Mobile number"],
  "field.mobileHint": ["૧૦ આંકડા, 6–9 થી શરૂ", "10 digits, starting with 6–9"],
  "field.name": ["નામ", "Name"],
  "field.fullName": ["પૂરું નામ", "Full name"],
  "field.firstName": ["પ્રથમ નામ", "First name"],
  "field.middleName": ["પિતાનું નામ", "Father’s name"],
  "field.surname": ["અટક", "Surname"],
  "field.phone2": ["બીજો નંબર", "Second number"],
  "field.village": ["ગામ", "Village"],
  "field.taluka": ["તાલુકો", "Taluka"],
  "field.district": ["જિલ્લો", "District"],
  "field.location": ["હાલનું સ્થળ", "Current location"],
  "field.locationHint": ["મંજૂર સભ્યોને દેખાશે. ઘરનું પૂરું સરનામું જરૂરી નથી.", "Visible to approved members. A full home address is not needed."],
  "field.chooseVillage": ["ગામ પસંદ કરો", "Choose village"],
  "field.noAdminYet": ["એડમિન નિયુક્ત નથી", "no admin yet"],
  "field.pin": ["પિન", "PIN"],
  "field.password": ["પાસવર્ડ", "Password"],
  "field.oldPin": ["જૂનો પિન", "Old PIN"],
  "field.newPin": ["નવો પિન", "New PIN"],
  "field.newPin2": ["નવો પિન ફરી લખો", "Re-enter new PIN"],
  "field.oldPassword": ["જૂનો પાસવર્ડ", "Old password"],
  "field.newPassword": ["નવો પાસવર્ડ", "New password"],
  "field.newPassword2": ["નવો પાસવર્ડ ફરી લખો", "Re-enter new password"],
  "field.pinHint": ["૪ આંકડા. 1111, 1234 જેવા સહેલા પિન નહીં.", "4 digits. Not an easy PIN like 1111 or 1234."],
  "field.passwordHint": ["ઓછામાં ઓછા ૮ અક્ષર: અક્ષરો, આંકડા અને ચિહ્નો.", "At least 8 characters: letters, numbers and symbols."],
  "err.NAME": ["પ્રથમ નામ અને અટક લખો (દરેક ઓછામાં ઓછા ૨ અક્ષર).", "Enter the first name and surname (at least 2 letters each)."],
  "err.VILLAGE": ["યાદીમાંથી ગામ પસંદ કરો.", "Choose a village from the list."],
  "err.PHONE2": ["બીજો નંબર ૧૦ આંકડાનો અને પહેલાથી અલગ હોવો જોઈએ.", "The second number must have 10 digits and differ from the first."],
  "err.TEMP_USED": ["આ કામચલાઉ પિન વપરાઈ ગયો છે. એડમિન પાસેથી નવો કામચલાઉ પિન મેળવો.", "This TEMP PIN was already used. Ask your admin for a new TEMP PIN."],
  "err.MEMBER_OTHER_VILLAGE": ["આ નંબર બીજા ગામના સભ્યનો છે.", "This number belongs to a member of another village."],
  "err.BIOMETRIC_FAILED": ["ફિંગરપ્રિન્ટથી ખૂલ્યું નહીં. પિન વાપરો.", "Fingerprint unlock failed. Use your PIN."],
  "err.LOCK_FORCED": ["એડમિન માટે એપ લોક હંમેશા ચાલુ રહે છે.", "The app lock is always on for admins."],
  "err.LOCK_OFF": ["પહેલા એપ લોક ચાલુ કરો.", "Turn on the app lock first."],
  "err.PIN_ALREADY_SET": ["પિન પહેલેથી બની ગયો છે.", "The PIN is already set."],
  "err.attemptsLeft": ["{n} પ્રયાસ બાકી.", "{n} attempts left."],
});

// ---- Section 2: Login and Main Admin profile ----------------------------
Object.assign(STR, {
  "login.title": ["લોગિન", "Log in"],
  "login.intro": ["તમારો મોબાઇલ નંબર અને ૪ આંકડાનો પિન નાખો.", "Enter your mobile number and 4-digit PIN."],
  "login.introPassword": ["મુખ્ય એડમિન: મોબાઇલ નંબર અને પાસવર્ડ નાખો.", "Main Admin: enter your mobile number and password."],
  "login.submit": ["લોગિન કરો", "Log in"],
  "login.usePassword": ["મુખ્ય એડમિન? પાસવર્ડથી લોગિન", "Main Admin? Log in with password"],
  "login.usePin": ["પિનથી લોગિન", "Log in with PIN"],
  "login.forgot": ["પિન ભૂલી ગયા?", "Forgot PIN?"],
  "login.register": ["નવા સભ્ય? નોંધણી કરો", "New member? Register"],
  "login.approvedNotice": ["તમારી નોંધણી મંજૂર થઈ! એડમિને વોટ્સએપ પર મોકલેલા કામચલાઉ પિનથી લોગિન કરો.", "Your registration is approved! Log in with the TEMP PIN your admin sent on WhatsApp."],
  "login.allAdmins": ["એડમિનનો સંપર્ક", "Contact an admin"],
  "profile.title": ["મારી પ્રોફાઇલ", "My Profile"],
  "profile.role": ["ભૂમિકા", "Role"],
  "profile.changePassword": ["પાસવર્ડ બદલો", "Change Password"],
  "profile.changePin": ["પિન બદલો", "Change PIN"],
  "profile.requestChange": ["માહિતી બદલવાની વિનંતી", "Request profile change"],
  "profile.requestRemoval": ["યાદીમાંથી દૂર થવાની વિનંતી", "Request removal"],
  "profile.pendingChange": ["તમારી ફેરફારની વિનંતી મંજૂરીની રાહમાં છે.", "Your change request is waiting for approval."],
  "profile.pendingRemoval": ["દૂર થવાની વિનંતી મંજૂરીની રાહમાં છે.", "Your removal request is waiting for approval."],
  "profile.mainAdminNote": ["પાસવર્ડ ભૂલી જાઓ તો સર્વર પરથી જ રીસેટ થાય છે (એપમાં નહીં).", "A forgotten password is reset on the server only (not in the app)."],
  "password.changed": ["પાસવર્ડ સફળતાપૂર્વક બદલાયો", "Password changed successfully"],
});

// ---- Section 3: Village Admins and TEMP PIN ------------------------------
Object.assign(STR, {
  "va.title": ["ગામ એડમિન વ્યવસ્થા", "Manage Village Admins"],
  "va.intro": ["દરેક ગામમાં એક જ સક્રિય ગામ એડમિન હોય છે.", "Each village has at most one active Village Admin."],
  "va.none": ["ગામ એડમિન નથી", "No Village Admin"],
  "va.active": ["સક્રિય", "Active"],
  "va.disabled": ["બંધ", "Disabled"],
  "va.waitingPin": ["પહેલું લોગિન બાકી (કામચલાઉ પિન)", "First login pending (TEMP PIN)"],
  "va.create": ["ગામ એડમિન બનાવો", "Create Village Admin"],
  "va.edit": ["ફેરફાર", "Edit"],
  "va.disable": ["બંધ કરો", "Disable"],
  "va.enable": ["ફરી ચાલુ કરો", "Enable"],
  "va.reset": ["પિન રીસેટ", "Reset PIN"],
  "va.formCreate": ["નવા ગામ એડમિન · {village}", "New Village Admin · {village}"],
  "va.formEdit": ["ગામ એડમિનમાં ફેરફાર · {village}", "Edit Village Admin · {village}"],
  "va.existingMember": ["આ ગામના હાલના સભ્યનો નંબર આપશો તો તે જ સભ્ય ગામ એડમિન બનશે.", "If the number belongs to an existing member of this village, that member becomes the Village Admin."],
  "va.confirmDisable": ["{name} ને ગામ એડમિન તરીકે બંધ કરવા છે? તેઓ સભ્ય તરીકે ચાલુ રહેશે.", "Disable {name} as Village Admin? They stay a member."],
  "va.confirmReset": ["{name} માટે નવો કામચલાઉ પિન બનાવવો છે? તેમનો હાલનો પિન તરત બંધ થશે.", "Create a new TEMP PIN for {name}? Their current PIN stops working at once."],
  "va.disabledDone": ["ગામ એડમિન બંધ કર્યા", "Village Admin disabled"],
  "va.enabledDone": ["ગામ એડમિન ફરી ચાલુ કર્યા", "Village Admin enabled"],
  "temp.title": ["કામચલાઉ પિન", "TEMP PIN"],
  "temp.once": ["આ પિન ફક્ત એક જ વાર બતાવવામાં આવે છે. હમણાં જ વોટ્સએપ પર મોકલો.", "This PIN is shown only once. Share it on WhatsApp now."],
  "temp.share": ["વોટ્સએપ પર મોકલો", "Share on WhatsApp"],
  "temp.sharedHint": ["પહેલા લોગિન પછી તેમને પોતાનો નવો પિન બનાવવો પડશે.", "After their first login they must set their own PIN."],
  "temp.msgVillageAdmin": ["{app}\nતમે {village} ગામના ગામ એડમિન છો.\nકામચલાઉ પિન: {pin}\nપહેલા લોગિન પછી પિન બદલો.\n—\n{appEn}\nYou are the Village Admin for {villageEn}.\nTEMP PIN: {pin}\nChange it after first login.", "{appEn}\nYou are the Village Admin for {villageEn}.\nTEMP PIN: {pin}\nChange it after first login.\n—\n{app}\nતમે {village} ગામના ગામ એડમિન છો.\nકામચલાઉ પિન: {pin}\nપહેલા લોગિન પછી પિન બદલો."],
  "temp.msgMember": ["{app}\nતમારી નોંધણી મંજૂર થઈ છે.\nમોબાઇલ: {phone}\nકામચલાઉ પિન: {pin}\nપહેલા લોગિન પછી પિન બદલો.\n—\n{appEn}\nYour registration is approved.\nMobile: {phone}\nTEMP PIN: {pin}\nChange it after first login.", "{appEn}\nYour registration is approved.\nMobile: {phone}\nTEMP PIN: {pin}\nChange it after first login.\n—\n{app}\nતમારી નોંધણી મંજૂર થઈ છે.\nમોબાઇલ: {phone}\nકામચલાઉ પિન: {pin}\nપહેલા લોગિન પછી પિન બદલો."],
  "temp.msgReset": ["{app}\nતમારો નવો કામચલાઉ પિન: {pin}\nમોબાઇલ: {phone}\nપહેલા લોગિન પછી પિન બદલો.\n—\n{appEn}\nYour new TEMP PIN: {pin}\nMobile: {phone}\nChange it after first login.", "{appEn}\nYour new TEMP PIN: {pin}\nMobile: {phone}\nChange it after first login.\n—\n{app}\nતમારો નવો કામચલાઉ પિન: {pin}\nમોબાઇલ: {phone}\nપહેલા લોગિન પછી પિન બદલો."],
  "review.forwardDone": ["મુખ્ય એડમિનને મોકલ્યું", "Forwarded to the Main Admin"],
  "review.rejectReason": ["નામંજૂરીનું કારણ (અરજદારને દેખાશે)", "Reason for rejection (the applicant sees it)"],
});

// ---- Section 4: Registration, pending, Forgot PIN ------------------------
Object.assign(STR, {
  "reg.title": ["નોંધણી", "Register"],
  "reg.intro": ["તમારી પોતાની વિગત ભરો. ગામના એડમિન ચકાસશે અને મુખ્ય એડમિન મંજૂરી આપશે.", "Fill in your own details. Your village admin checks them and the Main Admin approves."],
  "reg.consent": ["હું સંમત છું કે મારું નામ, મોબાઇલ નંબર અને ગામ મંજૂર થયેલા સમાજના સભ્યો જોઈ શકશે.", "I agree that my name, mobile number and village will be visible to approved community members."],
  "reg.submit": ["નોંધણી મોકલો", "Submit registration"],
  "reg.update": ["સુધારેલી વિગત મોકલો", "Send corrected details"],
  "reg.goLogin": ["લોગિન પર જાઓ", "Go to Login"],
  "reg.addPhone2": ["બીજો નંબર ઉમેરો", "Add a second number"],
  "reg.removePhone2": ["બીજો નંબર કાઢો", "Remove second number"],
  "pending.title": ["મંજૂરીની રાહમાં", "Pending approval"],
  "pending.village": ["તમારી નોંધણી મળી ગઈ છે. પહેલા તમારા ગામના એડમિન ચકાસશે.", "Your registration was received. Your village admin checks it first."],
  "pending.main": ["ગામના એડમિને ચકાસ્યું. હવે મુખ્ય એડમિનની મંજૂરી બાકી છે.", "Your village admin verified you. Now waiting for the Main Admin."],
  "pending.noDirectory": ["મંજૂરી મળે ત્યાં સુધી સંપર્ક યાદી દેખાશે નહીં. મંજૂરી પછી એડમિન વોટ્સએપ પર કામચલાઉ પિન મોકલશે.", "The directory stays closed until you are approved. After approval your admin sends a TEMP PIN on WhatsApp."],
  "pending.submitted": ["મોકલ્યાની તારીખ: {date}", "Submitted: {date}"],
  "pending.edit": ["વિગત સુધારો", "Edit details"],
  "pending.withdraw": ["વિનંતી પાછી ખેંચો", "Withdraw registration"],
  "pending.withdrawConfirm": ["તમારી નોંધણી રદ થશે. પછી ફરી નોંધણી કરી શકશો.", "Your registration will be cancelled. You can register again later."],
  "pending.withdrawn": ["નોંધણી રદ થઈ", "Registration withdrawn"],
  "pending.approved": ["તમારી નોંધણી મંજૂર થઈ! એડમિન વોટ્સએપ પર કામચલાઉ પિન મોકલશે.", "Your registration is approved! Your admin will send a TEMP PIN on WhatsApp."],
  "pending.rejected": ["તમારી નોંધણી મંજૂર થઈ નથી. તમારા ગામના એડમિનનો સંપર્ક કરો.", "Your registration was not approved. Contact your village admin."],
  "pending.reason": ["કારણ: {reason}", "Reason: {reason}"],
  "pending.sent": ["નોંધણી મોકલાઈ ગઈ", "Registration sent"],
  "forgot.title": ["પિન ભૂલી ગયા?", "Forgot PIN?"],
  "forgot.intro": ["તમારો મોબાઇલ નંબર નાખો. તમારા ગામના એડમિનને વિનંતી જશે. તેઓ તમારી ઓળખ ચકાસીને વોટ્સએપ પર નવો કામચલાઉ પિન મોકલશે.", "Enter your mobile number. A request goes to your village admin, who checks it is you and sends a new TEMP PIN on WhatsApp."],
  "forgot.send": ["વિનંતી મોકલો", "Send request"],
  "forgot.sent": ["વિનંતી મોકલાઈ. તમારા ગામના એડમિન સંપર્ક કરશે.", "Request sent. Your village admin will contact you."],
  "pinreq.title": ["પિન ભૂલી ગયાની વિનંતીઓ", "Forgot PIN requests"],
  "pinreq.none": ["કોઈ વિનંતી નથી.", "No requests."],
  "pinreq.create": ["કામચલાઉ પિન બનાવો", "Create TEMP PIN"],
  "pinreq.dismiss": ["રદ કરો", "Dismiss"],
  "pinreq.confirm": ["{name} સાથે વાત કરીને ખાતરી કરી? નવો કામચલાઉ પિન બનશે અને જૂનો પિન બંધ થશે.", "Did you confirm it is {name}? A new TEMP PIN is created and the old PIN stops working."],
  "rejoin.allow": ["ફરી નોંધણીની છૂટ આપો", "Allow to register again"],
  "rejoin.done": ["હવે આ નંબર ફરી નોંધણી કરી શકશે", "This number can register again"],
});

// ---- Section 5: TEMP PIN first login, app lock --------------------------
Object.assign(STR, {
  "setpin.title": ["તમારો નવો પિન બનાવો", "Set your new PIN"],
  "setpin.intro": ["તમે કામચલાઉ પિનથી લોગિન કર્યું છે. આગળ વધવા પોતાનો ૪ આંકડાનો પિન બનાવો. આ જ પિન લોગિન અને એપ લોક માટે છે.", "You logged in with a TEMP PIN. Set your own 4-digit PIN to continue. This PIN is for login and the app lock."],
  "setpin.submit": ["પિન સેટ કરો", "Set PIN"],
  "setpin.done": ["પિન સેટ થઈ ગયો", "PIN set"],
  "setpin.signout": ["આ ફોનમાંથી સાઇન આઉટ", "Sign out of this phone"],
  "lock.title": ["એપ લોક છે", "App locked"],
  "lock.enterPin": ["ખોલવા પિન નાખો", "Enter your PIN to open"],
  "lock.enterPassword": ["ખોલવા પાસવર્ડ નાખો", "Enter your password to open"],
  "lock.unlock": ["ખોલો", "Unlock"],
  "lock.fingerprint": ["ફિંગરપ્રિન્ટથી ખોલો", "Unlock with fingerprint"],
  "lock.forgot": ["પિન ભૂલી ગયા? સાઇન આઉટ કરો", "Forgot PIN? Sign out"],
  "lock.forgotConfirm": ["આ ફોનમાંથી સાઇન આઉટ થશે. પછી લોગિન સ્ક્રીન પર 'પિન ભૂલી ગયા?' વાપરો.", "This phone will be signed out. Then use 'Forgot PIN?' on the Login screen."],
  "lock.offline": ["ઑફલાઇન: આ ફોનમાં છેલ્લે વાપરેલા પિનથી ખુલશે.", "Offline: opens with the PIN last used on this phone."],
  "lock.offlineNoPin": ["ખોલવા ઇન્ટરનેટ જરૂરી છે.", "Internet is needed to unlock."],
  "lock.wait": ["{min}:{sec} પછી ફરી પ્રયાસ કરો", "Try again in {min}:{sec}"],
  "settings.lock": ["એપ ખોલતી વખતે પિન પૂછો", "Ask for PIN when opening the app"],
  "settings.lockHelp": ["ચાલુ હોય ત્યારે એપ ખોલતાં અને ૧ મિનિટથી વધુ પાછળ રહ્યા પછી યાદી લોક થાય છે.", "When on, the directory locks when the app opens and after 1 minute or more in the background."],
  "settings.lockForced": ["એડમિન માટે હંમેશા ચાલુ", "Always on for admins"],
  "settings.fingerprint": ["ફિંગરપ્રિન્ટથી ખોલવાની છૂટ", "Allow fingerprint unlock"],
  "settings.fingerprintHelp": ["ફોનની પોતાની ફિંગરપ્રિન્ટ વ્યવસ્થા વપરાય છે.", "Uses the phone's own fingerprint system."],
  "settings.lockOn": ["એપ લોક ચાલુ", "App lock on"],
  "settings.lockOffDone": ["એપ લોક બંધ", "App lock off"],
  "settings.fingerprintOn": ["ફિંગરપ્રિન્ટ ચાલુ", "Fingerprint unlock on"],
  "settings.fingerprintOff": ["ફિંગરપ્રિન્ટ બંધ", "Fingerprint unlock off"],
});

// ---- Section 6: change dialogs ------------------------------------------
Object.assign(STR, {
  "change.pinTitle": ["પિન બદલો", "Change PIN"],
  "change.passwordTitle": ["પાસવર્ડ બદલો", "Change Password"],
  "change.pinDone": ["પિન સફળતાપૂર્વક બદલાયો", "PIN changed successfully"],
  "change.passwordDone": ["પાસવર્ડ સફળતાપૂર્વક બદલાયો", "Password changed successfully"],
  "change.submit": ["બદલો", "Change"],
  "change.otherPhones": ["બીજા ફોનમાં ફરી લોગિન કરવું પડશે.", "Other phones will need to log in again."],
});

// ---- Section 7: navigation ----------------------------------------------
Object.assign(STR, {
  "nav.discardTitle": ["ફેરફાર છોડી દેવા છે?", "Discard changes?"],
  "nav.discardBody": ["તમે કરેલા ફેરફાર સચવાયા નથી.", "Your changes have not been saved."],
  "nav.discard": ["છોડી દો", "Discard"],
  "nav.keepEditing": ["ફેરફાર ચાલુ રાખો", "Keep editing"],
  "nav.admin": ["એડમિન", "Admin"],
  "nav.adminTools": ["એડમિન સાધનો", "Admin tools"],
  "nav.adminLogout": ["એડમિનમાંથી લોગ આઉટ", "Log out of admin"],
  "nav.adminLoggedOut": ["એડમિનમાંથી લોગ આઉટ થયા. તમે સભ્ય તરીકે ચાલુ છો.", "Logged out of admin. You are still logged in as a member."],
  "nav.adminEnterTitle": ["એડમિન સાધનો ખોલો", "Open admin tools"],
  "nav.adminEnterPin": ["એડમિન સાધનો ખોલવા તમારો પિન નાખો.", "Enter your PIN to open the admin tools."],
  "nav.adminEnterPassword": ["એડમિન સાધનો ખોલવા તમારો પાસવર્ડ નાખો.", "Enter your password to open the admin tools."],
  "nav.open": ["ખોલો", "Open"],
  "edit.title": ["માહિતી બદલવાની વિનંતી", "Request profile change"],
  "edit.adminTitle": ["સભ્યની માહિતી બદલો", "Edit member"],
  "edit.notice": ["મોબાઇલ નંબર કે ગામ બદલવાની વિનંતી પહેલા ગામના એડમિન ચકાસશે, પછી મુખ્ય એડમિન મંજૂર કરશે.", "A new mobile number or village is checked by your village admin, then approved by the Main Admin."],
  "edit.adminNotice": ["એડમિનનો ફેરફાર સીધો લાગુ થાય છે.", "Admin changes apply directly."],
  "edit.send": ["મંજૂરી માટે મોકલો", "Send for approval"],
  "edit.sent": ["ફેરફારની વિનંતી મોકલાઈ", "Change request sent"],
  "removal.confirmTitle": ["યાદીમાંથી દૂર થવાની વિનંતી?", "Request removal?"],
  "removal.confirmBody": ["એડમિન મંજૂરી આપશે પછી તમારી વિગત યાદીમાંથી દૂર થશે.", "After the admin approves, your details leave the directory."],
  "removal.send": ["વિનંતી મોકલો", "Send request"],
  "removal.sent": ["દૂર થવાની વિનંતી મોકલાઈ", "Removal request sent"],
  "settings.title": ["સેટિંગ્સ", "Settings"],
  "settings.language": ["ભાષા", "Language"],
  "settings.theme": ["દેખાવ", "Appearance"],
  "settings.light": ["આછો", "Light"],
  "settings.dark": ["ઘેરો", "Dark"],
  "settings.textSize": ["અક્ષરનું માપ", "Text size"],
  "settings.notifications": ["ફોન સૂચનાઓ", "Phone notifications"],
  "settings.admins": ["બધા એડમિન", "All admins"],
  "settings.signout": ["આ ફોનમાંથી સાઇન આઉટ", "Sign out of this phone"],
  "settings.signoutConfirm": ["આ ફોન પરથી બધી માહિતી સાફ થશે અને લોગિન સ્ક્રીન ખૂલશે.", "Everything is cleared from this phone and the Login screen opens."],
  "settings.security": ["સુરક્ષા", "Security"],
  "settings.account": ["ખાતું", "Account"],
  "settings.display": ["દેખાવ અને ભાષા", "Display & language"],
  "settings.version": ["આવૃત્તિ", "Version"],
});

// ---- Section 8: directory -----------------------------------------------
Object.assign(STR, {
  "dir.search": ["શોધો", "Search"],
  "dir.searchPlaceholder": ["નામ, નંબર કે ગામ (૩ અક્ષર)", "Name, number or village (3 letters)"],
  "dir.searchShort": ["શોધવા ઓછામાં ઓછા ૩ અક્ષર લખો", "Type at least 3 characters to search"],
  "dir.clear": ["શોધ બંધ કરો", "Close search"],
  "dir.filter": ["ગામ પ્રમાણે", "Filter by village"],
  "dir.allVillages": ["બધાં ગામ", "All villages"],
  "dir.settings": ["પ્રોફાઇલ અને સેટિંગ્સ", "Profile & settings"],
  "dir.count": ["{n} સભ્યો", "{n} members"],
  "dir.countOne": ["{n} સભ્ય", "{n} member"],
  "dir.found": ["{n} મળ્યા", "{n} found"],
  "dir.none": ["કોઈ સભ્ય મળ્યા નહીં.", "No members found."],
  "dir.empty": ["હજુ યાદીમાં કોઈ સભ્ય નથી.", "No members in the directory yet."],
  "dir.call": ["ફોન કરો", "Call"],
  "dir.whatsapp": ["વોટ્સએપ", "WhatsApp"],
  "dir.details": ["વિગત", "Details"],
  "dir.personal": ["પોતાનો નંબર", "Personal"],
  "dir.work": ["ધંધાનો નંબર", "Work"],
  "dir.other": ["બીજો નંબર", "Other"],
  "dir.hideChips": ["ગામની પટ્ટી છુપાવો", "Hide village bar"],
  "dir.showChips": ["ગામની પટ્ટી બતાવો", "Show village bar"],
  "dir.you": ["તમે", "You"],
  "dir.invalidNumber": ["આ નંબર બરાબર નથી.", "This phone number is invalid."],
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
