self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = {}; }
  const publicId = typeof payload.public_id === "string" && /^[A-Za-z0-9_-]{12,160}$/.test(payload.public_id) ? payload.public_id : "";
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === "string" ? payload.title.slice(0, 80) : "Verity has an update",
    {
      body: typeof payload.body === "string" ? payload.body.slice(0, 140) : "Tap to view the evidence-backed result.",
      tag: typeof payload.notification_id === "string" ? payload.notification_id : `verity:${publicId || "update"}`,
      data: { publicId },
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const publicId = event.notification.data?.publicId;
  const target = new URL(publicId ? `/claims/${encodeURIComponent(publicId)}` : "/", self.location.origin).href;
  event.waitUntil((async () => {
    for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
