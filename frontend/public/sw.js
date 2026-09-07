const CACHE_NAME = "cochat-shell-v1";

const DEFAULT_ICON =
  "/icons/icon-192.png";

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/*
  =====================================================
  INSTALL
  =====================================================
  Cache the minimum PWA shell required for offline
  navigation/fallback.
*/

self.addEventListener(
  "install",
  (event) => {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(
            SHELL_ASSETS
          )
        )
    );

    self.skipWaiting();
  }
);

/*
  =====================================================
  ACTIVATE
  =====================================================
  Remove old CoChat caches.
*/

self.addEventListener(
  "activate",
  (event) => {
    event.waitUntil(
      Promise.all([
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter(
                  (key) =>
                    key !==
                    CACHE_NAME
                )
                .map((key) =>
                  caches.delete(
                    key
                  )
                )
            )
          ),

        self.clients.claim(),
      ])
    );
  }
);

/*
  =====================================================
  FETCH
  =====================================================
  API requests are deliberately not cached.
  Navigation requests fall back to the app shell.
  Static resources use cache-first behavior.
*/

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !==
      "GET"
    ) {
      return;
    }

    const url =
      new URL(
        request.url
      );

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
      Never cache authenticated/API
      responses in this service worker.
    */
    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      return;
    }

    /*
      SPA navigation:
      network first, then cached app shell.
    */
    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(request)
          .then(
            (response) =>
              response
          )
          .catch(
            () =>
              caches.match(
                "/"
              )
          )
      );

      return;
    }

    /*
      Static assets:
      cache first, then network.
    */
    event.respondWith(
      caches
        .match(request)
        .then(
          (cached) => {
            if (cached) {
              return cached;
            }

            return fetch(request).then(
              (response) => {
                if (
                  !response ||
                  response.status !==
                    200 ||
                  response.type !==
                    "basic"
                ) {
                  return response;
                }

                const copy =
                  response.clone();

                caches
                  .open(
                    CACHE_NAME
                  )
                  .then(
                    (cache) =>
                      cache.put(
                        request,
                        copy
                      )
                  );

                return response;
              }
            );
          }
        )
    );
  }
);

/*
  =====================================================
  WEB PUSH
  =====================================================
*/

self.addEventListener(
  "push",
  (event) => {
    let data = {};

    try {
      data =
        event.data
          ? event.data.json()
          : {};
    } catch (error) {
      console.error(
        "Unable to parse push payload:",
        error
      );
    }

    const title =
      data.title ||
      "CoChat";

    const url =
      data.url ||
      "/notifications";

    event.waitUntil(
      self.registration.showNotification(
        title,
        {
          body:
            data.body ||
            "You have a new notification.",

          icon:
            data.icon ||
            DEFAULT_ICON,

          badge:
            data.badge ||
            DEFAULT_ICON,

          tag:
            data.tag ||
            "cochat-notification",

          renotify:
            Boolean(
              data.renotify
            ),

          data: {
            url,
          },
        }
      )
    );
  }
);

/*
  =====================================================
  NOTIFICATION CLICK
  =====================================================
*/

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification?.data
        ?.url ||
      "/notifications";

    const absoluteTarget =
      new URL(
        targetUrl,
        self.location.origin
      ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(
          (clientList) => {
            const existingClient =
              clientList.find(
                (client) =>
                  client.url.startsWith(
                    self.location.origin
                  )
              );

            if (
              existingClient
            ) {
              return existingClient
                .navigate(
                  absoluteTarget
                )
                .then(() =>
                  existingClient.focus()
                );
            }

            return self.clients.openWindow(
              absoluteTarget
            );
          }
        )
    );
  }
);