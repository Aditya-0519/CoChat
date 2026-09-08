/*
|--------------------------------------------------------------------------
| CoChat Service Worker
|--------------------------------------------------------------------------
|
| Handles:
|
| 1. PWA installation
| 2. Offline shell
| 3. Web Push
| 4. Notification clicks
| 5. Push subscription changes
|
|--------------------------------------------------------------------------
*/

const CACHE_NAME = "cochat-shell-v2";

const DEFAULT_ICON =
  "/icons/icon-192.png";

const DEFAULT_BADGE =
  "/icons/icon-192.png";

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/*
|--------------------------------------------------------------------------
| INSTALL
|--------------------------------------------------------------------------
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
        .catch((error) => {
          console.error(
            "CoChat service worker cache install failed:",
            error
          );
        })
    );

    /*
     * Activate the new worker immediately.
     */
    self.skipWaiting();
  }
);

/*
|--------------------------------------------------------------------------
| ACTIVATE
|--------------------------------------------------------------------------
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
|--------------------------------------------------------------------------
| FETCH
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    /*
     * Only handle GET.
     */
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

    /*
     * Never interfere with requests
     * going to another origin.
     */
    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    /*
     * Never cache API responses.
     */
    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      return;
    }

    /*
     * Never cache the service worker
     * itself.
     */
    if (
      url.pathname ===
      "/sw.js"
    ) {
      return;
    }

    /*
     * SPA navigation.
     *
     * Network first.
     * Cached shell as fallback.
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
     * Static resources.
     *
     * Cache first.
     */
    event.respondWith(
      caches
        .match(request)
        .then(
          (cachedResponse) => {
            if (
              cachedResponse
            ) {
              return cachedResponse;
            }

            return fetch(request)
              .then(
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

                  const responseCopy =
                    response.clone();

                  caches
                    .open(
                      CACHE_NAME
                    )
                    .then(
                      (cache) =>
                        cache.put(
                          request,
                          responseCopy
                        )
                    )
                    .catch(
                      () => {}
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
|--------------------------------------------------------------------------
| PUSH EVENT
|--------------------------------------------------------------------------
|
| This is the most important part.
|
| The browser can be completely closed/minimized and this
| service worker can still receive a Web Push event.
|
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "push",
  (event) => {
    console.log(
      "CoChat push event received."
    );

    let data = {};

    /*
     * Try JSON first.
     */
    if (event.data) {
      try {
        data =
          event.data.json();
      } catch (jsonError) {
        /*
         * Some push providers may send plain text.
         */
        try {
          data = {
            body:
              event.data.text(),
          };
        } catch (textError) {
          console.error(
            "Unable to read push payload:",
            textError
          );
        }
      }
    }

    /*
     * Normalize payload.
     */
    const title =
      data?.title ||
      "CoChat";

    const body =
      data?.body ||
      "You have a new notification.";

    const targetUrl =
      data?.url ||
      "/notifications";

    const icon =
      data?.icon ||
      DEFAULT_ICON;

    const badge =
      data?.badge ||
      DEFAULT_BADGE;

    /*
     * Use a unique tag by default.
     *
     * This prevents unrelated notifications from
     * replacing each other.
     */
    const tag =
      data?.tag ||
      `cochat-${Date.now()}`;

    const renotify =
      data?.renotify !== false;

    /*
     * Notification options.
     */
    const notificationOptions = {
      body,

      icon,

      badge,

      tag,

      renotify,

      requireInteraction:
        Boolean(
          data?.requireInteraction
        ),

      timestamp:
        Date.now(),

      vibrate: [
        100,
        50,
        100,
      ],

      data: {
        url:
          targetUrl,

        type:
          data?.type ||
          "general",

        conversationId:
          data?.conversationId ||
          null,

        notificationId:
          data?.notificationId ||
          null,
      },
    };

    /*
     * IMPORTANT:
     *
     * waitUntil keeps the service worker alive
     * until showNotification has finished.
     */
    event.waitUntil(
      self.registration
        .showNotification(
          title,
          notificationOptions
        )
        .then(() => {
          console.log(
            "CoChat notification displayed:",
            title
          );
        })
        .catch((error) => {
          console.error(
            "CoChat showNotification failed:",
            error
          );
        })
    );
  }
);

/*
|--------------------------------------------------------------------------
| NOTIFICATION CLICK
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const notificationData =
      event.notification?.data ||
      {};

    const targetUrl =
      notificationData.url ||
      "/notifications";

    let absoluteTarget;

    try {
      absoluteTarget =
        new URL(
          targetUrl,
          self.location.origin
        ).href;
    } catch (error) {
      absoluteTarget =
        new URL(
          "/notifications",
          self.location.origin
        ).href;
    }

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(
          async (
            clientList
          ) => {
            /*
             * Prefer an existing CoChat tab.
             */
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
              try {
                await existingClient.navigate(
                  absoluteTarget
                );
              } catch (error) {
                console.warn(
                  "Unable to navigate existing client:",
                  error
                );
              }

              try {
                await existingClient.focus();
              } catch (error) {
                console.warn(
                  "Unable to focus existing client:",
                  error
                );
              }

              return;
            }

            /*
             * No existing window.
             *
             * Open CoChat.
             */
            await self.clients.openWindow(
              absoluteTarget
            );
          }
        )
    );
  }
);

/*
|--------------------------------------------------------------------------
| NOTIFICATION CLOSE
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "notificationclose",
  () => {
    /*
     * Reserved for future analytics.
     */
  }
);

/*
|--------------------------------------------------------------------------
| PUSH SUBSCRIPTION CHANGE
|--------------------------------------------------------------------------
|
| Browsers can rotate push subscriptions.
|
| When that happens the old endpoint becomes invalid.
|
| We notify the currently open CoChat page so the frontend
| can create and synchronize a new subscription.
|
|--------------------------------------------------------------------------
*/

self.addEventListener(
  "pushsubscriptionchange",
  (event) => {
    console.log(
      "CoChat push subscription changed."
    );

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(
          (clients) => {
            for (
              const client of clients
            ) {
              client.postMessage({
                type:
                  "PUSH_SUBSCRIPTION_CHANGED",
              });
            }
          }
        )
    );
  }
);