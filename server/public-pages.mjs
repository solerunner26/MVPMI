// Public information pages required for app stores and for members:
//   /privacy          — privacy policy (Gujarati + English)
//   /delete-account   — how to remove your data
//   /download         — link to install the Android app (when uploaded)
// Contact details come from the live configuration (main administrator's
// number set in the admin panel, optional PRIVACY_CONTACT_EMAIL), never from
// sample data.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The shared APK lives outside dist/ so rebuilding the site never removes it.
const DOWNLOADS = fileURLToPath(new URL("../downloads", import.meta.url));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(title, body) {
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#B2402C"><title>${esc(title)}</title><link rel="icon" href="/brand/favicon-32.png"><style>
:root{color-scheme:light dark;--bg:#faf5f0;--ink:#2a1a14;--ink2:#5a4740;--card:#fff;--line:#eadfd6;--brand:#a93b25}
@media(prefers-color-scheme:dark){:root{--bg:#141010;--ink:#f6ece6;--ink2:#c9b6ad;--card:#1f1816;--line:#3a2c27;--brand:#ff9d74}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Noto Sans Gujarati",sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 18px 60px}h1{font-size:26px;line-height:1.25;margin:0 0 6px}h2{font-size:19px;margin:28px 0 8px;color:var(--brand)}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px 20px;margin:16px 0}.en{color:var(--ink2)}p,li{overflow-wrap:anywhere}
a{color:var(--brand)}.btn{display:inline-block;background:var(--brand);color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:999px;margin:8px 0}
small{color:var(--ink2)}</style></head><body><main>${body}</main></body></html>`;
}

export function installPublicPages(app, store, { env = process.env, downloadDir = DOWNLOADS } = {}) {
  const community = { gu: "મહુવા ક્ષત્રિય રાજપૂત સમાજ", en: "Mahuva Kshatriya Rajput Samaj" };
  const contact = () => {
    // The Main Admin's name and number, exactly as on the "All admins" page.
    const id = store.get("config", "main-admin")?.memberId;
    const m = id ? store.get("members", id) : null;
    const c = m ? { name: m.nameGu || m.name, phone: m.phone } : null;
    const email = String(env.PRIVACY_CONTACT_EMAIL || "").trim();
    const lines = [];
    if (c?.phone) lines.push(`${esc(c.name || "મુખ્ય એડમિન")} · <a href="tel:+91${esc(c.phone)}">+91 ${esc(c.phone)}</a>`);
    if (email) lines.push(`<a href="mailto:${esc(email)}">${esc(email)}</a>`);
    return lines.length ? lines.join("<br>") : "એપમાં «બધા એડમિન» જુઓ · See “All admins” in the app.";
  };
  const send = (res, html) => {
    res.set("Cache-Control", "no-cache");
    res.type("html").send(html);
  };

  app.get(["/privacy", "/privacy.html"], (req, res) =>
    send(
      res,
      page(
        "Privacy policy · " + community.en,
        `<h1>ગોપનીયતા નીતિ<br><span class="en">Privacy policy</span></h1>
<small>${community.gu} · ${community.en} — Community directory app · Updated 27 Sep 2026</small>
<div class="card"><p>આ એપ સમાજના મંજૂર સભ્યો માટેની ખાનગી ફોન ડિરેક્ટરી છે. અમે જાહેરાત, ટ્રેકિંગ કે ડેટા વેચાણ કરતા નથી.</p>
<p class="en">This app is a private phone directory for approved members of the community. There are no ads, no tracking and no sale of data.</p></div>
<h2>અમે કઈ માહિતી રાખીએ છીએ · What we store</h2>
<ul><li>નામ (પ્રથમ, પિતાનું, અટક), મોબાઇલ નંબર, બીજો નંબર (વૈકલ્પિક), ગામ, હાલનું સ્થળ (વૈકલ્પિક).<br><span class="en">Name (first, father's/middle, surname), mobile number, optional second number, village and optional current location.</span></li>
<li>સુરક્ષા માટે: લોગિન સત્ર, એપ-લોક પિનનો હેશ (પિન પોતે નહીં), ખોટા પ્રયાસોની નોંધ, ઉપકરણનું બ્રાઉઝર નામ.<br><span class="en">For security: sign-in session, a hash of your app-lock PIN (never the PIN), a log of failed attempts and the device's browser name.</span></li>
<li>સૂચનાઓ ચાલુ કરો તો સૂચના મોકલવા માટેનું ઉપકરણ-ટોકન. સૂચનામાં ક્યારેય ફોન નંબર હોતા નથી.<br><span class="en">If you turn on notifications, a device token used only to deliver them. Notifications never contain phone numbers.</span></li></ul>
<h2>કોણ જોઈ શકે · Who can see it</h2>
<p>ગામના એડમિન ચકાસે અને મુખ્ય એડમિન મંજૂરી આપે પછી જ તમારી વિગત બીજા મંજૂર સભ્યોને દેખાય છે. ગામના એડમિન ફક્ત પોતાના ગામની વિનંતીઓ જુએ છે.</p>
<p class="en">Your details become visible to other approved members only after your village administrator verifies you and the main administrator approves. Village administrators see only their own village's requests.</p>
<h2>સુરક્ષા · Security</h2>
<p>બધું HTTPS પર એન્ક્રિપ્ટેડ જાય છે. ડિરેક્ટરી પિનથી લોક છે, એપમાં સ્ક્રીનશોટ બંધ છે, અને સર્વરનો બેકઅપ એન્ક્રિપ્ટ કરીને એડમિનના Google Drive માં રાખવામાં આવે છે.</p>
<p class="en">All traffic is encrypted (HTTPS). The directory is PIN-locked, screenshots are blocked in the app, and server backups are encrypted before they are stored in the administrator's Google Drive.</p>
<h2>માહિતી કાઢવી · Deleting your data</h2>
<p>એપમાં «મારી પ્રોફાઇલ → યાદીમાંથી મારી માહિતી કાઢવા વિનંતી» વાપરો, અથવા નીચેના સંપર્ક પર જણાવો. વિગતો: <a href="/delete-account">/delete-account</a>.</p>
<p class="en">Use “Settings → Request removal from directory” in the app, or contact us below. Details: <a href="/delete-account">/delete-account</a>.</p>
<h2>સંપર્ક · Contact</h2><div class="card">${contact()}</div>`,
      ),
    ),
  );

  app.get(["/delete-account", "/delete-account.html"], (req, res) =>
    send(
      res,
      page(
        "Delete your data · " + community.en,
        `<h1>તમારી માહિતી કાઢો<br><span class="en">Delete your account and data</span></h1>
<small>${community.gu} · ${community.en}</small>
<h2>એપમાંથી · In the app</h2>
<ol><li>એપ ખોલો અને પિન નાખો. <span class="en">Open the app and enter your PIN.</span></li>
<li>ઉપર જમણે «મારી પ્રોફાઇલ». <span class="en">Tap “My profile” (top right).</span></li>
<li>«યાદીમાંથી મારી માહિતી કાઢવા વિનંતી» → કારણ લખો → મોકલો. <span class="en">“Request removal from directory” → give a reason → send.</span></li></ol>
<p>મુખ્ય એડમિન મંજૂર કરે એટલે તમારું નામ અને નંબર ડિરેક્ટરીમાંથી તરત દૂર થાય છે અને તમારા બધા લોગિન બંધ થાય છે.</p>
<p class="en">Once the main administrator approves, your name and numbers are removed from the directory immediately and all your signed-in devices are signed out.</p>
<h2>એપ વગર · Without the app</h2><p>નીચેના સંપર્ક પર તમારું નામ, ગામ અને નંબર જણાવો. <span class="en">Contact us below with your name, village and number.</span></p><div class="card">${contact()}</div>
<h2>શું રહે છે · What is kept</h2>
<p>ખોટી કે બેવડી નોંધણી રોકવા માટે દૂર કરેલા સભ્યનો રેકોર્ડ ફક્ત મુખ્ય એડમિન જોઈ શકે એવા આર્કાઇવમાં રહે છે; તે કોઈ સભ્યને દેખાતો નથી. સંપૂર્ણ કાયમી ભૂંસવા માટે ઉપરના સંપર્ક પર લખો. સુરક્ષા-સૂચનાઓ 60 દિવસે અને એન્ક્રિપ્ટેડ બેકઅપ 30 દિવસે આપમેળે ભૂંસાય છે.</p>
<p class="en">To prevent false or duplicate registrations, a removed member's record stays in an archive that only the main administrator can see; no member can see it. For permanent erasure, contact us above. Notifications are deleted after 60 days and encrypted backups roll over after 30 days.</p>`,
      ),
    ),
  );

  // APK_URL (e.g. the GitHub release asset) keeps large downloads off the
  // server; a local file in downloadDir is used when APK_URL is not set.
  const apkUrl = String(env.APK_URL || "").trim();
  app.get(["/download", "/app"], (req, res) => {
    const apk = join(downloadDir, "mvpmi.apk");
    const local = existsSync(apk);
    const has = local || /^https:\/\//.test(apkUrl);
    const size = local ? " (" + (statSync(apk).size / 1048576).toFixed(1) + " MB)" : "";
    send(
      res,
      page(
        "Android app · " + community.en,
        `<h1>${community.gu}<br><span class="en">${community.en} · Android app</span></h1>
${
  has
    ? `<p><a class="btn" href="/download/mvpmi.apk" download>એપ ડાઉનલોડ કરો · Download app${size}</a></p>
<div class="card"><ol><li>ડાઉનલોડ પૂરું થાય પછી ફાઇલ ખોલો. <span class="en">Open the file when the download finishes.</span></li>
<li>ફોન પૂછે તો «આ સ્રોતમાંથી મંજૂરી આપો» ચાલુ કરો. <span class="en">If asked, allow installing from this source (Chrome).</span></li>
<li>«ઇન્સ્ટોલ» દબાવો અને એપ ખોલો. <span class="en">Tap Install, then open the app.</span></li></ol></div>`
    : `<p>એપ ટૂંક સમયમાં ઉપલબ્ધ થશે. ત્યાં સુધી આ સાઇટ Chrome માં વાપરી શકો છો. <span class="en">The app will be available soon. Meanwhile you can use this site in Chrome.</span></p>`
}
<p><a href="/">વેબ પર ખોલો · Open on the web</a> · <a href="/privacy">ગોપનીયતા · Privacy</a></p>`,
      ),
    );
  });
  // The APK is served with the right type so phones offer to install it.
  app.get("/download/mvpmi.apk", (req, res, next) => {
    const apk = join(downloadDir, "mvpmi.apk");
    if (!existsSync(apk)) return /^https:\/\//.test(apkUrl) ? res.redirect(302, apkUrl) : next();
    res.set("Content-Type", "application/vnd.android.package-archive");
    res.set("Cache-Control", "no-cache");
    res.download(apk, "mvpmi.apk");
  });
}
