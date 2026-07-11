self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data.json(); }
  catch { payload = {}; }
  const receivedAt = new Date().toISOString();
  event.waitUntil(self.registration.showNotification(payload.title || "Verity probe", {
    body: payload.body || "Synthetic Phase 0 notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `verity-phase0-${payload.url || "unknown"}`,
    data: { url: payload.url || "/", sent_at: payload.sent_at || null, received_at: receivedAt },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data.url, self.location.origin);
  target.searchParams.set("push_sent_at", event.notification.data.sent_at || "");
  target.searchParams.set("push_received_at", event.notification.data.received_at || "");
  target.searchParams.set("push_opened_at", new Date().toISOString());
  event.waitUntil(self.clients.openWindow(target.href));
});
