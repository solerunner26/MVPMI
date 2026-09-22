// Device app lock: a four-digit PIN that gates the whole app, managed by
// the user in Reading settings. The PIN never leaves the device: it is
// stored only as a PBKDF2-SHA256 hash with a random salt in localStorage.
// A pure-JS SHA-256 is used so the lock also works on the phone-testing
// LAN origin (http://...), where Web Crypto's subtle API is unavailable.

// ---- SHA-256 (FIPS 180-4), Uint8Array in / Uint8Array out ----
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function sha256(bytes) {
  const l = bytes.length;
  const bitLen = l * 8;
  const withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[l] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bitLen >>> 0);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Int32Array(64);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getInt32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  h.forEach((x, i) => odv.setUint32(i * 4, x >>> 0));
  return out;
}
const textBytes = (s) => new TextEncoder().encode(s);
const hex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) =>
  new Uint8Array((s.match(/../g) || []).map((x) => parseInt(x, 16)));

// ---- PBKDF2-HMAC-SHA256 ----
function hmacSha256(key, msg) {
  let k = key.length > 64 ? sha256(key) : key;
  const padded = new Uint8Array(64);
  padded.set(k);
  const inner = new Uint8Array(64 + msg.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(msg, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}
// Single-block PBKDF2-HMAC-SHA256 (32-byte output is all the lock needs).
// Exposed for unit tests against Node's crypto.
export const APP_LOCK_ITERATIONS = 50000;
export const APP_LOCK_KEY = "mvpmi.appLock";

export function readAppLock() {
  try {
    const raw = localStorage.getItem(APP_LOCK_KEY);
    const cfg = raw ? JSON.parse(raw) : null;
    return cfg && cfg.enabled && cfg.salt && cfg.hash ? cfg : null;
  } catch {
    return null;
  }
}
function writeAppLock(cfg) {
  try {
    localStorage.setItem(APP_LOCK_KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable (embedded restricted mode): lock stays off */
  }
}
export function clearAppLock() {
  try {
    localStorage.removeItem(APP_LOCK_KEY);
  } catch {
    /* nothing to clear */
  }
}
export function randomSaltHex() {
  const salt = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(salt);
  else for (let i = 0; i < salt.length; i++) salt[i] = (Math.random() * 256) | 0;
  return hex(salt);
}
export function derivePinHash(pin, saltHex, iterations = APP_LOCK_ITERATIONS) {
  // PBKDF2 block 1: U1 = HMAC(pin, salt || 0x00000001), then XOR the chain.
  let block = hmacSha256(textBytes(pin), unhex(saltHex + "00000001"));
  const first = block.slice();
  for (let i = 1; i < iterations; i++) {
    block = hmacSha256(textBytes(pin), block);
    for (let j = 0; j < 32; j++) first[j] ^= block[j];
  }
  return hex(first);
}
export function enableAppLock(pin) {
  const salt = randomSaltHex();
  const hash = derivePinHash(pin, salt);
  const cfg = { enabled: true, salt, hash };
  writeAppLock(cfg);
  return cfg;
}
export function verifyAppLock(pin, cfg = readAppLock()) {
  if (!cfg) return false;
  return derivePinHash(pin, cfg.salt) === cfg.hash;
}

// ---- Settings panel (rendered inside Reading settings) ----
function AppLockSecret({ label, value, setValue, lang, testId }) {
  const h = React.createElement;
  const [shown, setShown] = React.useState(false);
  const B = (gu, en) => bilingual(gu, en, lang);
  return h(
    "label",
    { className: "workflow-field" },
    label,
    h(
      "div",
      { className: "workflow-secret" },
      h("input", {
        type: shown ? "text" : "password",
        value,
        inputMode: "numeric",
        autoComplete: "off",
        maxLength: 4,
        "data-testid": testId,
        onChange: (e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4)),
      }),
      h(
        "button",
        {
          type: "button",
          className: "workflow-eye",
          title: shown
            ? B("પિન છુપાવો", "Hide PIN")
            : B("પિન બતાવો", "Show PIN"),
          "aria-label": shown
            ? B("પિન છુપાવો", "Hide PIN")
            : B("પિન બતાવો", "Show PIN"),
          "aria-pressed": shown,
          onClick: () => setShown(!shown),
        },
        h("i", {
          className: shown ? "ph-duotone ph-eye-slash" : "ph-duotone ph-eye",
          "aria-hidden": true,
        }),
      ),
    ),
  );
}
export function AppLockSettings({ lang, onChange }) {
  const h = React.createElement;
  const B = (gu, en) => bilingual(gu, en, lang);
  const enabled = !!readAppLock();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const reset = () => {
    setCurrent("");
    setNext("");
    setAgain("");
  };
  const invalid = B("ચાર આંકડાનો પિન નાખો.", "Enter a four-digit PIN.");
  const mismatch = B("બંને પિન એક જ નથી.", "The two PINs do not match.");
  const wrong = B("હાલનો પિન ખોટો છે.", "The current PIN is wrong.");
  async function enable() {
    if (busy) return;
    if (!/^\d{4}$/.test(next)) return setMsg(invalid);
    if (next !== again) return setMsg(mismatch);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    enableAppLock(next);
    setBusy(false);
    reset();
    setMsg(B("એપ લોક ચાલુ થયો.", "App lock enabled."));
    onChange();
  }
  async function change() {
    if (busy) return;
    if (!/^\d{4}$/.test(next)) return setMsg(invalid);
    if (next !== again) return setMsg(mismatch);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const ok = verifyAppLock(current);
    setBusy(false);
    if (!ok) return setMsg(wrong);
    const cfg = enableAppLock(next);
    setMsg(B("નવો પિન સેવ થયો.", "New PIN saved."));
    reset();
    onChange();
    void cfg;
  }
  async function disable() {
    if (busy) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const ok = verifyAppLock(current);
    setBusy(false);
    if (!ok) return setMsg(wrong);
    clearAppLock();
    setMsg(B("એપ લોક બંધ થયો.", "App lock disabled."));
    reset();
    onChange();
  }
  return h(
    "div",
    { className: "applock-settings", "data-testid": "App lock settings" },
    h(
      "p",
      { className: "applock-note" },
      B(
        "એપ લોક ચાલુ હોય તો એપ ખોલવા માટે ચાર આંકડાનો પિન જોઈશે — સમાજની સંપર્ક યાદી સુરક્ષિત રહે.",
        "With the app lock on, opening the app asks for a four-digit PIN — the community contact list stays protected.",
      ),
    ),
    enabled
      ? h(
          "div",
          null,
          h(AppLockSecret, {
            label: B("હાલનો પિન", "Current PIN"),
            value: current,
            setValue: setCurrent,
            lang,
            testId: "Current PIN",
          }),
          h(AppLockSecret, {
            label: B("નવો પિન", "New PIN"),
            value: next,
            setValue: setNext,
            lang,
            testId: "New PIN",
          }),
          h(AppLockSecret, {
            label: B("નવો પિન ફરી નાખો", "Repeat new PIN"),
            value: again,
            setValue: setAgain,
            lang,
            testId: "Repeat PIN",
          }),
          h(
            "div",
            { className: "workflow-actions" },
            h(
              "button",
              { type: "button", disabled: busy, onClick: change },
              B("પિન બદલો", "Change PIN"),
            ),
            h(
              "button",
              {
                type: "button",
                className: "applock-danger",
                disabled: busy || !current,
                onClick: disable,
              },
              B("એપ લોક બંધ કરો", "Turn off app lock"),
            ),
          ),
        )
      : h(
          "div",
          null,
          h(AppLockSecret, {
            label: B("નવો પિન", "New PIN"),
            value: next,
            setValue: setNext,
            lang,
            testId: "New PIN",
          }),
          h(AppLockSecret, {
            label: B("નવો પિન ફરી નાખો", "Repeat new PIN"),
            value: again,
            setValue: setAgain,
            lang,
            testId: "Repeat PIN",
          }),
          h(
            "div",
            { className: "workflow-actions" },
            h(
              "button",
              {
                type: "button",
                disabled: busy || !next || !again,
                onClick: enable,
              },
              B("એપ લોક ચાલુ કરો", "Turn on app lock"),
            ),
          ),
        ),
    msg && h("p", { role: "status", className: "applock-msg" }, msg),
  );
}
