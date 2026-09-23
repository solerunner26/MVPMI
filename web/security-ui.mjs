// App-lock (server-enforced PIN) and notification controls.
// Plain React.createElement components, concatenated into the generated app.

// Mobile numbers: accept pasted "+91 98250 14523", "91-98250-14523" or
// "098250 14523" and keep the ten-digit Indian mobile number.
export function phoneDigits(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

// ---- Forgot PIN (shown on the lock screen) ----
export function PinResetPanel({ lang, frozen, onReset, onSignOut, onClose }) {
  const h = React.createElement;
  const B = (gu, en) => bilingual(gu, en, lang);
  const [code, setCode] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function submit() {
    if (busy) return;
    if (!/^\d{6}$/.test(code))
      return setMsg(B("છ આંકડાનો કોડ નાખો.", "Enter the six-digit code."));
    setBusy(true);
    setMsg("");
    try {
      await onReset(code);
    } catch (e) {
      setMsg(errorText(e.message, lang));
    } finally {
      setBusy(false);
    }
  }
  return h(
    "div",
    { className: "preferences-scrim" },
    h(
      "section",
      {
        className: "preferences-panel workflow-panel pin-reset-panel",
        role: "dialog",
        "aria-modal": true,
        "aria-label": lang === "gu" ? "પિન ભૂલી ગયા" : "Forgot PIN",
        tabIndex: -1,
      },
      h("h2", { className: "workflow-title" }, B("પિન ભૂલી ગયા?", "Forgot your PIN?")),
      frozen &&
        h(
          "p",
          { role: "alert", className: "rejected-before" },
          B(
            "ઘણા ખોટા પ્રયાસો થયા છે. હવે ફક્ત રીસેટ કોડથી જ ખૂલશે.",
            "Too many wrong PINs. The app now opens only with a reset code.",
          ),
        ),
      h(
        "ol",
        { className: "pin-steps" },
        h("li", null, B("તમારા ગામના એડમિનને ફોન કરો.", "Call your village administrator.")),
        h(
          "li",
          null,
          B(
            "તેઓ તમને ઓળખીને છ આંકડાનો કોડ આપશે (૧૫ મિનિટ માટે માન્ય).",
            "After recognising you they give you a six-digit code (valid for 15 minutes).",
          ),
        ),
        h("li", null, B("કોડ અહીં નાખો અને નવો પિન બનાવો.", "Enter it here and choose a new PIN.")),
      ),
      h(
        "label",
        { className: "workflow-field" },
        B("રીસેટ કોડ", "Reset code"),
        h("input", {
          value: code,
          inputMode: "numeric",
          autoComplete: "one-time-code",
          maxLength: 6,
          "data-testid": "PIN reset code",
          onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)),
        }),
      ),
      h(
        "div",
        { className: "workflow-actions" },
        h(
          "button",
          { type: "button", className: "lq-primary", disabled: busy || code.length !== 6, onClick: submit },
          B("કોડ ચકાસો", "Check code"),
        ),
        h("button", { type: "button", disabled: busy, onClick: onClose }, B("પાછા જાઓ", "Back")),
      ),
      msg && h("p", { role: "alert", className: "applock-msg" }, msg),
      h(
        "details",
        { className: "pin-signout" },
        h("summary", null, B("બીજો રસ્તો: આ ફોન પરથી સાઇન આઉટ", "Other option: sign out of this phone")),
        h(
          "p",
          null,
          B(
            "સાઇન આઉટ કર્યા પછી ફરી જોડાવા માટે ગામ અને મુખ્ય એડમિનની મંજૂરી ફરીથી લેવી પડશે.",
            "After signing out you must apply again and be approved by the village and main administrators.",
          ),
        ),
        h(
          "button",
          { type: "button", className: "applock-danger", disabled: busy, onClick: onSignOut },
          B("આ ફોન પરથી સાઇન આઉટ કરો", "Sign out of this phone"),
        ),
      ),
    ),
  );
}

// ---- Change PIN (Reading settings) ----
export function PinSettings({ lang, api }) {
  const h = React.createElement;
  const B = (gu, en) => bilingual(gu, en, lang);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pinInput = (label, value, set, testId) =>
    h(
      "label",
      { className: "workflow-field" },
      label,
      h("input", {
        type: "password",
        value,
        inputMode: "numeric",
        autoComplete: "off",
        maxLength: 4,
        "data-testid": testId,
        onChange: (e) => set(e.target.value.replace(/\D/g, "").slice(0, 4)),
      }),
    );
  async function change() {
    if (busy) return;
    if (!/^\d{4}$/.test(next)) return setMsg(B("ચાર આંકડાનો પિન નાખો.", "Enter a four-digit PIN."));
    if (next !== again) return setMsg(B("બંને પિન એક જ નથી.", "The two PINs do not match."));
    setBusy(true);
    try {
      await api("lock/change", { current, next });
      setMsg(B("નવો પિન સેવ થયો.", "New PIN saved."));
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (e) {
      setMsg(errorText(e.message, lang));
    } finally {
      setBusy(false);
    }
  }
  return h(
    "div",
    { className: "applock-settings", "data-testid": "App lock settings" },
    h(
      "p",
      { className: "applock-note" },
      B(
        "સમાજની યાદી સુરક્ષિત રાખવા એપ હંમેશાં પિનથી ખૂલે છે — એપ ખોલતાં, ૩૦ સેકન્ડ બહાર રહ્યા પછી અને ૩ મિનિટ કંઈ ન કરો ત્યારે.",
        "To protect the community list the app always asks for your PIN — when it opens, after 30 seconds in the background and after 3 idle minutes.",
      ),
    ),
    pinInput(B("હાલનો પિન", "Current PIN"), current, setCurrent, "Current PIN"),
    pinInput(B("નવો પિન", "New PIN"), next, setNext, "New PIN"),
    pinInput(B("નવો પિન ફરી નાખો", "Repeat new PIN"), again, setAgain, "Repeat PIN"),
    h(
      "div",
      { className: "workflow-actions" },
      h(
        "button",
        { type: "button", className: "lq-primary", disabled: busy || !current || !next || !again, onClick: change },
        B("પિન બદલો", "Change PIN"),
      ),
    ),
    msg && h("p", { role: "status", className: "applock-msg" }, msg),
  );
}

// ---- Notifications ----
export const pushSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const base64ToBytes = (value) => {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

// Registers the service worker (also makes the site installable) and, if
// permission is granted, subscribes this browser to Web Push.
export async function enableWebPush(api, lang) {
  if (!pushSupported()) throw new Error("Notifications are not supported in this browser");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted");
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const { publicKey } = await api("push/key");
  let sub = await registration.pushManager.getSubscription();
  if (!sub)
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(publicKey),
    });
  await api("push/subscribe", { subscription: sub.toJSON(), lang });
  return true;
}

export function NotificationSettings({ lang, api }) {
  const h = React.createElement;
  const B = (gu, en) => bilingual(gu, en, lang);
  const android = !!androidBridge();
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const state = android
    ? "android"
    : !pushSupported()
      ? "unsupported"
      : Notification.permission;
  async function turnOn() {
    setBusy(true);
    setMsg("");
    try {
      await enableWebPush(api, lang);
      setMsg(B("સૂચનાઓ ચાલુ થઈ.", "Notifications are on."));
    } catch (e) {
      setMsg(
        Notification.permission === "denied"
          ? B(
              "બ્રાઉઝરમાં સૂચનાઓ બંધ છે. સાઇટ સેટિંગ્સમાંથી ચાલુ કરો.",
              "Notifications are blocked. Allow them in the browser's site settings.",
            )
          : errorText(e.message, lang),
      );
    } finally {
      setBusy(false);
    }
  }
  return h(
    "div",
    { className: "applock-settings", "data-testid": "Notification settings" },
    h(
      "p",
      { className: "applock-note" },
      state === "android"
        ? B(
            "એપ ફોનની સૂચનાઓ મોકલે છે: મંજૂરી, નવી વિનંતીઓ અને ફેરફારો. બંધ કરવા માટે ફોનના સેટિંગ્સ વાપરો.",
            "The app sends phone notifications for approvals, new requests and changes. Use the phone's settings to turn them off.",
          )
        : state === "unsupported"
          ? B(
              "આ બ્રાઉઝર સૂચનાઓ આપી શકતું નથી. Chrome માં ખોલીને 'Home screen પર ઉમેરો' વાપરો.",
              "This browser cannot show notifications. Open the site in Chrome and use 'Add to Home screen'.",
            )
          : B(
              "મંજૂરી, નવી વિનંતીઓ અને ફેરફારોની જાણ ફોનમાં મેળવો. સૂચનામાં ફોન નંબર ક્યારેય હોતા નથી.",
              "Get approvals, new requests and changes as phone notifications. Notifications never contain phone numbers.",
            ),
    ),
    state !== "android" &&
      state !== "unsupported" &&
      h(
        "div",
        { className: "workflow-actions" },
        h(
          "button",
          { type: "button", className: "lq-primary", disabled: busy, onClick: turnOn },
          state === "granted"
            ? B("સૂચનાઓ ફરી જોડો", "Reconnect notifications")
            : B("સૂચનાઓ ચાલુ કરો", "Turn on notifications"),
        ),
      ),
    msg && h("p", { role: "status", className: "applock-msg" }, msg),
  );
}
