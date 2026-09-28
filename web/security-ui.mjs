// Notification and Google Drive backup controls (the app lock and PIN
// screens live in web/alpha-auth.mjs and web/alpha-ui.mjs).
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

// ---- Google Drive backup (admin Backup tab) ----
export function DriveBackupPanel({ lang, api }) {
  const h = React.createElement;
  const B = (gu, en) => bilingual(gu, en, lang);
  const [info, setInfo] = React.useState(null);
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = () =>
    api("admin/drive")
      .then(setInfo)
      .catch((e) => setMsg(errorText(e.message, lang)));
  React.useEffect(() => {
    load();
  }, []);
  async function run(path, done) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api(path, {});
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      setInfo(r);
      if (done) setMsg(done);
    } catch (e) {
      setMsg(errorText(e.message, lang));
    } finally {
      setBusy(false);
    }
  }
  const when = (t) =>
    t
      ? new Date(t).toLocaleString(lang === "gu" ? "gu-IN" : "en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const inApp = !!androidBridge();
  let body;
  if (!info) body = h("p", { className: "applock-note" }, B("તપાસી રહ્યા છીએ…", "Checking…"));
  else if (!info.configured)
    body = h(
      "p",
      { className: "applock-note" },
      B(
        "સર્વર પર Google Drive બેકઅપ ગોઠવાયેલું નથી (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_PASSPHRASE, PUBLIC_URL).",
        "Google Drive backup is not set up on the server (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKUP_PASSPHRASE, PUBLIC_URL).",
      ),
    );
  else if (!info.connected)
    body = [
      h(
        "p",
        { key: "n", className: "applock-note" },
        inApp
          ? B(
              "Google Drive એકવાર જોડવા માટે આ સાઇટ કમ્પ્યુટર કે ફોનના Chrome બ્રાઉઝરમાં ખોલો અને એડમિન તરીકે લોગિન કરો. એપની અંદર Google લોગિન શક્ય નથી.",
              "To connect Google Drive once, open this site in Chrome (computer or phone) and sign in as administrator. Google sign-in is not possible inside the app.",
            )
          : B(
              "દરરોજ રાત્રે ડેટાબેઝની એન્ક્રિપ્ટેડ નકલ તમારા Google Drive માં સચવાશે. એપ ફક્ત પોતે બનાવેલી ફાઇલો જ જોઈ શકે છે.",
              "An encrypted copy of the database is saved to your Google Drive every night. The app can only see the files it creates.",
            ),
      ),
      !inApp &&
        h(
          "div",
          { key: "a", className: "workflow-actions" },
          h(
            "button",
            { type: "button", className: "lq-primary", disabled: busy, onClick: () => run("admin/drive/connect") },
            B("Google Drive જોડો", "Connect Google Drive"),
          ),
        ),
    ];
  else
    body = [
      h(
        "p",
        { key: "s", className: "applock-note" },
        B("જોડાયેલ: ", "Connected: "),
        h("strong", null, info.account || "Google Drive"),
        h("br"),
        B("છેલ્લું સફળ બેકઅપ: ", "Last successful backup: "),
        when(info.lastSuccess),
        h("br"),
        B("છેલ્લી " + info.kept + " નકલો રાખવામાં આવે છે.", "The newest " + info.kept + " copies are kept."),
      ),
      info.lastError &&
        h(
          "p",
          { key: "e", className: "rejected-before", role: "alert" },
          B("છેલ્લો પ્રયાસ નિષ્ફળ: ", "Last attempt failed: "),
          info.lastError,
        ),
      h(
        "div",
        { key: "a", className: "workflow-actions" },
        h(
          "button",
          { type: "button", className: "lq-primary", disabled: busy, onClick: () => run("admin/drive/backup", B("બેકઅપ Google Drive માં સચવાયું.", "Backup saved to Google Drive.")) },
          busy ? B("બેકઅપ થઈ રહ્યું છે…", "Backing up…") : B("હમણાં બેકઅપ લો", "Back up now"),
        ),
        h(
          "button",
          { type: "button", className: "lq-danger", disabled: busy, onClick: () => run("admin/drive/disconnect") },
          B("Drive છૂટું કરો", "Disconnect Drive"),
        ),
      ),
      info.cronCommand &&
        h(
          "details",
          { key: "c" },
          h("summary", null, B("રોજનું cPanel Cron Job", "Daily cPanel cron job")),
          h(
            "p",
            { className: "applock-note" },
            B("cPanel → Cron Jobs માં દિવસમાં એકવાર આ આદેશ ઉમેરો:", "Add this command in cPanel → Cron Jobs, once a day:"),
          ),
          h("code", { className: "drive-cron", style: { display: "block", overflowWrap: "anywhere", fontSize: "12px", userSelect: "all" } }, info.cronCommand),
        ),
    ];
  return h(
    "div",
    { className: "applock-settings", "data-testid": "Drive backup" },
    h("h3", { className: "settings-label" }, B("Google Drive બેકઅપ", "Google Drive backup")),
    body,
    msg && h("p", { role: "status", className: "applock-msg" }, msg),
  );
}
