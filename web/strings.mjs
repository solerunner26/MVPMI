// Bilingual string resources for every screen added in the alpha audit
// (Gujarati first, English second). Screens call t(key, lang); no screen
// text is hard-coded in the components. Keys are grouped by screen.
export const STR = {
  // ---- Section 0: terms -------------------------------------------------
  "term.password": ["પાસવર્ડ", "Password"],
  "term.pin": ["પિન", "PIN"],
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
  "err.WRONG_OLD_PASSWORD": ["જૂનો પાસવર્ડ ખોટો છે.", "The old password is wrong."],
  "err.PIN_FORMAT": ["પિન બરાબર ૪ આંકડાનો હોવો જોઈએ.", "The PIN must be exactly 4 digits."],
  "err.PIN_MISMATCH": ["બંને નવા પિન એકસરખા નથી.", "The two new PINs do not match."],
  "err.PASSWORD_FORMAT": ["પાસવર્ડ ઓછામાં ઓછો ૪ અક્ષરનો હોવો જોઈએ.", "The password must be at least 4 characters."],
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
  "err.FORBIDDEN": ["આ કામ કરવાની પરવાનગી નથી.", "You are not allowed to do this."],
  "err.GENERIC": [
    "કામ પૂર્ણ થઈ શક્યું નથી. ફરી પ્રયાસ કરો.",
    "Could not complete this. Please try again.",
  ],
  "err.bannerTitle": ["કાર્ય પૂર્ણ થયું નથી", "Could not complete this"],
  "err.technical": ["તકનીકી વિગત", "Technical details"],
  "err.VERIFY_FIRST": ["પહેલા ગામ એડમિને ચકાસણી કરવી પડશે, પછી જ મુખ્ય એડમિન અંતિમ મંજૂરી આપી શકે.", "The Village Admin must verify this request first; only then can the Main Admin give final approval."],
  "err.VERIFY_FIRST_WHO": ["પહેલા {name} ({phone}) એ ચકાસણી કરીને આગળ મોકલવું પડશે. તેમને ફોન કરો: એડમિન સાધનો → વિનંતીઓ → ‘ચકાસીને આગળ મોકલો’.", "{name} ({phone}) must verify and forward this request first. Call them: Admin tools → Requests → “Verify & forward”."],
  "err.PASSWORD_REQUIRED": ["આ મુખ્ય એડમિનનો નંબર છે. પાસવર્ડ નાખો.", "This is the Main Admin number. Enter the password."],
  "approve.done": ["સભ્ય મંજૂર થયા. તેઓ મોબાઇલ નંબરથી લોગિન કરી શકે છે.", "Member approved. They can log in with their mobile number."],
  "err.bannerClose": ["બંધ કરો", "Dismiss"],
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
  "field.oldPassword": ["જૂનો પાસવર્ડ", "Old password"],
  "field.newPassword": ["નવો પાસવર્ડ", "New password"],
  "field.newPassword2": ["નવો પાસવર્ડ ફરી લખો", "Re-enter new password"],
  "field.passwordHint": ["ઓછામાં ઓછા ૪ અક્ષર. કોઈ પણ પાસવર્ડ ચાલશે.", "At least 4 characters. Any password is fine."],
  "err.NAME": ["પ્રથમ નામ અને અટક લખો (દરેક ઓછામાં ઓછા ૨ અક્ષર).", "Enter the first name and surname (at least 2 letters each)."],
  "err.VILLAGE": ["યાદીમાંથી ગામ પસંદ કરો.", "Choose a village from the list."],
  "err.PHONE2": ["બીજો નંબર ૧૦ આંકડાનો અને પહેલાથી અલગ હોવો જોઈએ.", "The second number must have 10 digits and differ from the first."],
  "err.MEMBER_OTHER_VILLAGE": ["આ નંબર બીજા ગામના સભ્યનો છે.", "This number belongs to a member of another village."],
  "err.BIOMETRIC_FAILED": ["ફિંગરપ્રિન્ટથી ખૂલ્યું નહીં. પિન વાપરો.", "Fingerprint unlock failed. Use your PIN."],
  "err.LOCK_OFF": ["પહેલા એપ લોક ચાલુ કરો.", "Turn on the app lock first."],
  "err.attemptsLeft": ["{n} પ્રયાસ બાકી.", "{n} attempts left."],
});

// ---- Section 2: Login and Main Admin profile ----------------------------
Object.assign(STR, {
  "login.title": ["લોગિન", "Log in"],
  "login.intro": ["લોગિન કરવા તમારો મોબાઇલ નંબર નાખો.", "Enter your mobile number to log in."],
  "login.introPassword": ["મુખ્ય એડમિન: મોબાઇલ નંબર અને પાસવર્ડ નાખો.", "Main Admin: enter your mobile number and password."],
  "login.submit": ["લોગિન કરો", "Log in"],
  "login.useMobile": ["મોબાઇલ નંબરથી લોગિન", "Log in with mobile number only"],
  "login.usePassword": ["મુખ્ય એડમિન? પાસવર્ડથી લોગિન", "Main Admin? Log in with password"],
  "login.register": ["નવા સભ્ય? નોંધણી કરો", "New member? Register"],
  "login.approvedNotice": ["તમારી નોંધણી મંજૂર થઈ! ‘લોગિન કરો’ દબાવો.", "Your registration is approved! Tap “Log in”."],
  "login.allAdmins": ["એડમિનનો સંપર્ક", "Contact an admin"],
  "profile.title": ["મારી પ્રોફાઇલ", "My Profile"],
  "profile.role": ["ભૂમિકા", "Role"],
  "profile.changePassword": ["પાસવર્ડ બદલો", "Change Password"],
  "profile.requestChange": ["માહિતી બદલવાની વિનંતી", "Request profile change"],
  "profile.requestRemoval": ["યાદીમાંથી દૂર થવાની વિનંતી", "Request removal"],
  "profile.mainAdminNote": ["પાસવર્ડ ભૂલી જાઓ તો સર્વર પરથી જ રીસેટ થાય છે (એપમાં નહીં).", "A forgotten password is reset on the server only (not in the app)."],
  "profile.lockSection": ["ફોન લોક (વૈકલ્પિક)", "Phone lock (optional)"],
  "profile.pendingChange": ["તમારી ફેરફારની વિનંતી મંજૂરીની રાહમાં છે.", "Your change request is waiting for approval."],
  "profile.pendingRemoval": ["દૂર થવાની વિનંતી મંજૂરીની રાહમાં છે.", "Your removal request is waiting for approval."],
  "password.changed": ["પાસવર્ડ સફળતાપૂર્વક બદલાયો", "Password changed successfully"],
});

// ---- Section 3: Village Admins and TEMP PIN ------------------------------
Object.assign(STR, {
  "va.title": ["ગામ એડમિન વ્યવસ્થા", "Manage Village Admins"],
  "va.intro": ["ગામ પસંદ કરો. દરેક ગામમાં એક જ સક્રિય ગામ એડમિન હોય છે. ગામ એડમિન ફક્ત મોબાઇલ નંબરથી લોગિન કરે છે.", "Choose a village. Each village has one active Village Admin, who logs in with the mobile number only."],
  "va.none": ["ગામ એડમિન નથી", "No Village Admin"],
  "va.active": ["સક્રિય", "Active"],
  "va.disabled": ["બંધ", "Disabled"],
  "va.pick": ["ગામ પસંદ કરો", "Choose a village"],
  "va.pickHint": ["ગામ પસંદ કરો — તેના ગામ એડમિન અહીં દેખાશે.", "Choose a village to see and manage its Village Admin."],
  "va.statusLabel": ["સ્થિતિ", "Status"],
  "va.create": ["ગામ એડમિન બનાવો", "Create Village Admin"],
  "va.edit": ["ફેરફાર", "Edit"],
  "va.disable": ["બંધ કરો", "Disable"],
  "va.enable": ["ફરી ચાલુ કરો", "Enable"],
  "va.formCreate": ["નવા ગામ એડમિન · {village}", "New Village Admin · {village}"],
  "va.formEdit": ["ગામ એડમિનમાં ફેરફાર · {village}", "Edit Village Admin · {village}"],
  "va.existingMember": ["આ ગામના હાલના સભ્યનો નંબર આપશો તો તે જ સભ્ય ગામ એડમિન બનશે.", "If the number belongs to an existing member of this village, that member becomes the Village Admin."],
  "va.confirmDisable": ["{name} ને ગામ એડમિન તરીકે બંધ કરવા છે? તેઓ સભ્ય તરીકે ચાલુ રહેશે.", "Disable {name} as Village Admin? They stay a member."],
  "va.disabledDone": ["ગામ એડમિન બંધ કર્યા", "Village Admin disabled"],
  "va.enabledDone": ["ગામ એડમિન ફરી ચાલુ કર્યા", "Village Admin enabled"],
  "vac.title": ["ગામ એડમિન બની ગયા", "Village Admin created"],
  "vac.body": ["{name} હવે મોબાઇલ નંબર {phone} થી લોગિન કરી શકશે. પિન કે પાસવર્ડ જરૂરી નથી.", "{name} can now log in with the mobile number {phone}. No PIN or password is needed."],
  "vac.share": ["વોટ્સએપ પર જણાવો", "Tell on WhatsApp"],
  "vac.call": ["ફોન કરો", "Call"],
  "vac.msg": ["{app}\nતમે {village} ગામના ગામ એડમિન છો.\nએપમાં તમારા મોબાઇલ નંબર {phone} થી લોગિન કરો.\n—\n{appEn}\nYou are the Village Admin for {villageEn}.\nLog in to the app with your mobile number {phone}.", "{appEn}\nYou are the Village Admin for {villageEn}.\nLog in to the app with your mobile number {phone}.\n—\n{app}\nતમે {village} ગામના ગામ એડમિન છો.\nએપમાં તમારા મોબાઇલ નંબર {phone} થી લોગિન કરો."],
  "temp.call": ["ફોન કરો", "Call"],
  "temp.share": ["વોટ્સએપ પર મોકલો", "Share on WhatsApp"],
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
  "pending.noDirectory": ["મંજૂરી મળે ત્યાં સુધી સંપર્ક યાદી દેખાશે નહીં. મંજૂરી પછી અહીંથી જ લોગિન થઈ જશે.", "The directory stays closed until you are approved. After approval you can log in right here."],
  "pending.submitted": ["મોકલ્યાની તારીખ: {date}", "Submitted: {date}"],
  "pending.edit": ["વિગત સુધારો", "Edit details"],
  "pending.withdraw": ["વિનંતી પાછી ખેંચો", "Withdraw registration"],
  "pending.withdrawConfirm": ["તમારી નોંધણી રદ થશે. પછી ફરી નોંધણી કરી શકશો.", "Your registration will be cancelled. You can register again later."],
  "pending.withdrawn": ["નોંધણી રદ થઈ", "Registration withdrawn"],
  "pending.approved": ["તમારી નોંધણી મંજૂર થઈ! લોગિન કરી રહ્યા છીએ…", "Your registration is approved! Logging you in…"],
  "pending.rejected": ["તમારી નોંધણી મંજૂર થઈ નથી. તમારા ગામના એડમિનનો સંપર્ક કરો.", "Your registration was not approved. Contact your village admin."],
  "pending.reason": ["કારણ: {reason}", "Reason: {reason}"],
  "pending.sent": ["નોંધણી મોકલાઈ ગઈ", "Registration sent"],
  "rejoin.allow": ["ફરી નોંધણીની છૂટ આપો", "Allow to register again"],
  "rejoin.done": ["હવે આ નંબર ફરી નોંધણી કરી શકશે", "This number can register again"],
});

// ---- Section 5: TEMP PIN first login, app lock --------------------------
Object.assign(STR, {
  "setpw.title": ["તમારો નવો પાસવર્ડ બનાવો", "Set your new password"],
  "setpw.intro": ["તમે પહેલી વારના પાસવર્ડથી લોગિન કર્યું છે. તે ફક્ત પહેલા લોગિન માટે છે. આગળ વધવા પોતાનો નવો પાસવર્ડ બનાવો (ઓછામાં ઓછા ૪ અક્ષર).", "You logged in with the first-time password. It is for the first login only. Choose your own new password to continue (at least 4 characters)."],
  "setpw.submit": ["પાસવર્ડ સેટ કરો", "Set password"],
  "setpw.done": ["પાસવર્ડ સેટ થઈ ગયો", "Password set"],
  "setpin.signout": ["આ ફોનમાંથી સાઇન આઉટ", "Sign out of this phone"],
  "lock.title": ["એપ લોક છે", "App locked"],
  "lock.enterPin": ["ખોલવા પિન નાખો", "Enter your PIN to open"],
  "lock.unlock": ["ખોલો", "Unlock"],
  "lock.fingerprint": ["ફિંગરપ્રિન્ટથી ખોલો", "Unlock with fingerprint"],
  "lock.forgot": ["પિન ભૂલી ગયા? સાઇન આઉટ કરો", "Forgot PIN? Sign out"],
  "lock.offline": ["ઑફલાઇન: આ ફોનમાં છેલ્લે વાપરેલા પિનથી ખુલશે.", "Offline: opens with the PIN saved on this phone."],
  "lock.wait": ["{min}:{sec} પછી ફરી પ્રયાસ કરો", "Try again in {min}:{sec}"],
  "lock.toggle": ["આ એપને પિનથી લોક કરો", "Lock this app with a PIN"],
  "lock.toggleHelp": ["વૈકલ્પિક — તમે ઇચ્છો તો જ. એપ ખોલતી વખતે અને ૧ મિનિટથી વધુ પાછળ રહ્યા પછી ૪ આંકડાનો પિન પૂછશે. પિન ભૂલી જાઓ તો સાઇન આઉટ કરી ફરી લોગિન કરો — એડમિનની જરૂર નથી.", "Optional — only if you want it. Asks for a 4-digit PIN when the app opens and after 1 minute or more in the background. Forgot the PIN? Sign out and log in again — no admin needed."],
  "lock.on": ["પિન લોક ચાલુ", "PIN lock is on"],
  "lock.setTitle": ["એપ માટે પિન બનાવો", "Set a PIN for this app"],
  "lock.changeTitle": ["એપનો પિન બદલો", "Change the app PIN"],
  "lock.change": ["પિન બદલો", "Change PIN"],
  "lock.set": ["પિન સેટ કરો", "Set PIN"],
  "lock.newPin": ["નવો પિન (૪ આંકડા)", "New PIN (4 digits)"],
  "lock.newPin2": ["પિન ફરી લખો", "Re-enter PIN"],
  "lock.setDone": ["પિન લોક ચાલુ થયું", "PIN lock is on"],
  "lock.offDone": ["પિન લોક બંધ", "PIN lock is off"],
  "lock.fingerprint2": ["ફિંગરપ્રિન્ટથી ખોલવાની છૂટ", "Allow fingerprint unlock"],
  "lock.fingerprintOn": ["ફિંગરપ્રિન્ટ ચાલુ", "Fingerprint unlock on"],
  "lock.fingerprintOff": ["ફિંગરપ્રિન્ટ બંધ", "Fingerprint unlock off"],
  "settings.fingerprint": ["ફિંગરપ્રિન્ટથી ખોલવાની છૂટ", "Allow fingerprint unlock"],
  "settings.fingerprintHelp": ["ફોનની પોતાની ફિંગરપ્રિન્ટ વ્યવસ્થા વપરાય છે.", "Uses the phone's own fingerprint system."],
});

// ---- Section 6: change dialogs ------------------------------------------
Object.assign(STR, {
  "change.passwordTitle": ["પાસવર્ડ બદલો", "Change Password"],
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
  "settings.textSize": ["અક્ષરનું માપ", "Text size"],
  "settings.textReset": ["૧૦૦% પર પાછા", "Reset to 100%"],
  "settings.textResetDone": ["અક્ષરનું માપ ૧૦૦%", "Text size reset to 100%"],
  "settings.notifications": ["ફોન સૂચનાઓ", "Phone notifications"],
  "settings.admins": ["બધા એડમિન", "All admins"],
  "settings.signout": ["આ ફોનમાંથી સાઇન આઉટ", "Sign out of this phone"],
  "settings.signoutConfirm": ["આ ફોન પરથી બધી માહિતી સાફ થશે અને લોગિન સ્ક્રીન ખૂલશે.", "Everything is cleared from this phone and the Login screen opens."],
  "settings.account": ["ખાતું", "Account"],
  "settings.display": ["દેખાવ", "Display"],
  "settings.version": ["આવૃત્તિ", "Version"],
});

// ---- Section 8: directory -----------------------------------------------
Object.assign(STR, {
  "dir.search": ["નામ, નંબર કે ગામ શોધો", "Search by name, number or village"],
  "dir.searchPlaceholder": ["શોધો", "Search"],
  "dir.searchPlaceholderLong": ["નામ, નંબર કે ગામ શોધો", "Search name, number or village"],
  "bar.label": ["મુખ્ય મેનુ", "Main menu"],
  "bar.profile": ["પ્રોફાઇલ", "Profile"],
  "bar.admin": ["એડમિન", "Admin"],
  "bar.settings": ["સેટિંગ્સ", "Settings"],
  "bar.search": ["શોધો", "Search"],
  "bar.dark": ["ઘેરો", "Dark"],
  "bar.light": ["આછો", "Light"],
  "bar.lang": ["English", "ગુજરાતી"],
  "bar.langLabel": ["ભાષા: English કરો", "Language: switch to ગુજરાતી"],
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
  "dir.memberDetails": ["સભ્યની વિગત", "Member Details"],
  "dir.primaryPhone": ["મોબાઇલ નંબર", "Primary Phone"],
  "dir.nativeVillage": ["મૂળ ગામ", "Native Village"],
  "dir.currentResidence": ["હાલ રહેઠાણ", "Current Residence"],
  "dir.talukaDistrict": ["તા. {taluka}, જિ. {district}", "Taluka {taluka}, District {district}"],
  "dir.villageMembers": ["{village} ગામના સભ્યોની યાદી જુઓ", "See all members from {village}"],
  "dir.villageMembersCount": ["કુલ {n} નોંધાયેલ સભ્યો", "{n} registered members"],
  "dir.thisIsYou": ["તમે", "You"],
  "dir.whatsapp": ["વોટ્સએપ", "WhatsApp"],
  "dir.details": ["વિગત", "Details"],
  "dir.personal": ["પોતાનો નંબર", "Personal"],
  "dir.work": ["ધંધાનો નંબર", "Work"],
  "dir.other": ["બીજો નંબર", "Other"],
  "dir.hideChips": ["ગામની પટ્ટી છુપાવો", "Hide village bar"],
  "dir.allShort": ["બધા", "All"],
  "dir.filterBtn": ["ફિલ્ટર", "Filter"],
  "dir.profileBtn": ["મારી પ્રોફાઇલ", "My Profile"],
  "dir.darkOn": ["ઘેરો દેખાવ", "Dark theme"],
  "dir.lightOn": ["આછો દેખાવ", "Light theme"],
  "dir.languageBtn": ["ભાષા બદલો", "Change language"],
  "dir.searchBtn": ["શોધો", "Search"],
  "dir.showChips": ["ગામની પટ્ટી બતાવો", "Show village bar"],
  "dir.invalidNumber": ["આ નંબર બરાબર નથી.", "This phone number is invalid."],
});

export function t(key, lang = "gu", vars) {
  const row = STR[key];
  let text = row ? row[lang === "en" ? 1 : 0] : key;
  if (vars)
    for (const [k, v] of Object.entries(vars))
      text = text.split("{" + k + "}").join(String(v)); // replaceAll needs Chrome 85
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
  if (error.code === "VERIFY_FIRST" && error.info?.admin) {
    const a = error.info.admin;
    return t("err.VERIFY_FIRST_WHO", lang, {
      name: lang === "en" ? a.name : a.nameGu || a.name,
      phone: a.phone,
    });
  }
  if (error.code && STR["err." + error.code]) return t("err." + error.code, lang);
  if (error.network) return t("err.NETWORK", lang);
  if (typeof errorText !== "function") return t("err.GENERIC", lang);
  const raw = String(error.message || error);
  const shown = errorText(raw, lang);
  // Gujarati falls back to a generic sentence for English-only server
  // messages; keep the real reason next to it so the person can see what is
  // wrong.
  const plain = typeof singleLanguageStatus === "function" ? singleLanguageStatus(raw, "en") : raw;
  return lang === "gu" && !/[\u0a80-\u0aff]/.test(raw) && shown !== plain ? shown + " (" + plain + ")" : shown;
}
