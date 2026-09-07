const DEFAULT_ICON = "/icons/icon-192.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("Unable to parse push payload:", error);
  }

  const title = data.title || "CoChat";
  const url = data.url || "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "You have a new notification.",
      icon: data.icon || DEFAULT_ICON,
      badge: data.badge || DEFAULT_ICON,
      tag: data.tag || "cochat-notification",
      renotify: Boolean(data.renotify),
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const existingClient = clientList.find((client) =>
          client.url.startsWith(self.location.origin)
        );

        if (existingClient) {
          return existingClient.navigate(targetUrl).then(() => existingClient.focus());
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});
