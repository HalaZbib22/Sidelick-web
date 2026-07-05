/* Sidelick service worker — Phase 0 baseline.
 * Makes the app installable and provides a hook for web push later.
 * Caching strategy intentionally minimal for now. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Web push — show a notification even when the app is closed/backgrounded.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "Sidelick", body: "", url: "/", tag: undefined };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      renotify: !!payload.tag,
      data: { url: payload.url || "/" },
    })
  );
});

// Click-through: focus an existing app tab if one is open, else open a new one,
// navigating to the notification's deep link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
