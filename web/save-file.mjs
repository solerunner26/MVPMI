// File saving, sharing and printing that work both in ordinary browsers and
// inside the Android app. The Android WebView exposes window.mvpmiBridge:
//   saveFile(name, mime, base64) -> system "save as" sheet (phone or Drive)
//   printHtml(title, base64Html)  -> system print sheet (Save as PDF, any destination)
//   notify(title, text)           -> Android system notification
// In plain browsers these fall back to anchor downloads and window.print.

export function androidBridge() {
  return typeof window !== "undefined" && window.mvpmiBridge
    ? window.mvpmiBridge
    : null;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function stringToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(String(text)));
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(blob);
  });
}

export async function saveFile(name, mime, data) {
  const bridge = androidBridge();
  if (bridge) {
    const base64 =
      data instanceof Blob
        ? await blobToBase64(data)
        : stringToBase64(data);
    bridge.saveFile(name, mime, base64);
    return { saved: "android-picker" };
  }
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { saved: "download" };
}

export function printHtml(title, html) {
  const bridge = androidBridge();
  if (bridge) {
    bridge.printHtml(title, stringToBase64(html));
    return true;
  }
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  frame.onload = async () => {
    try {
      await frame.contentDocument.fonts.ready;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      /* printing unavailable */
    }
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
  frame.srcdoc = html;
  return true;
}

export function androidNotify(title, text) {
  try {
    androidBridge()?.notify(title, text);
  } catch {
    /* notifications are best-effort */
  }
}
