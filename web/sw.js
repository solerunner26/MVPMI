// MVPMI service worker: offline app shell, Web Push notifications and
// home-screen install.
//
// Only the app itself (page, scripts, styles, fonts, icons) is cached, so the
// app can open without internet. API answers — and so every phone number —
// are NEVER cached here. The member list for offline use is kept separately
// by the page (web/offline-store.mjs) and only for a logged-in account.
const SHELL = "mvpmi-shell-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith("mvpmi-") && n !== SHELL).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);

const isShellAsset = (url) =>
  url.pathname === "/support.js" ||
  url.pathname === "/manifest.webmanifest" ||
  url.pathname.startsWith("/vendor/") ||
  url.pathname.startsWith("/brand/");

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  // The page: always try the network first (updates arrive at once), fall
  // back to the saved copy when offline.
  if (request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.open(SHELL).then((cache) => cache.match("/")).then((hit) => hit || Response.error())),
    );
    return;
  }
  // Versioned scripts, styles, fonts and icons: saved copy first.
  if (isShellAsset(url)) {
    event.respondWith(
      caches.open(SHELL).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "મહુવા વાળા રાજપૂત સમાજ";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || data.id || undefined,
      icon: "/brand/icon-192.png",
      badge: "/brand/favicon-32.png",
      lang: "gu",
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const w of windows) if ("focus" in w) return w.focus();
        return self.clients.openWindow("/");
      }),
  );
});
