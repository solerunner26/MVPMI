// MVPMI service worker: Web Push notifications and home-screen install.
// It deliberately caches NOTHING — community phone numbers never stay in a
// browser cache, and every screen always comes from the live server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "મહુવા ક્ષત્રિય રાજપૂત સમાજ";
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
