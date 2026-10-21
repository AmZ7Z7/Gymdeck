/* GymDeck : script de fond du téléphone, uniquement pour les notifications (aucune mise en cache du site). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "GymDeck", {
    body: data.body || "",
    icon: "/icon-192.png?v=2",
    badge: "/icon-192.png?v=2",
    tag: data.tag,
    data: { url: data.url || "/" },
  }));
});

// Toucher la notification : ouvre GymDeck (ou le remet au premier plan) sur la bonne page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ("navigate" in w) await w.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
