import { socket } from "./socket";

/*
|--------------------------------------------------------------------------
| PRESENCE SERVICE
|--------------------------------------------------------------------------
|
| Presence is realtime socket state.
|
| The backend emits:
|
| presence:update
|
| {
|   userId,
|   isOnline,
|   lastSeen
| }
|
| This service keeps the socket-specific details out of
| individual pages/components.
|--------------------------------------------------------------------------
*/

const listeners = new Set();

const presenceCache = new Map();

let initialized = false;

const normalizeUserId = (
  userId
) => {
  if (!userId) {
    return "";
  }

  if (
    typeof userId ===
    "string"
  ) {
    return userId;
  }

  if (userId._id) {
    return userId._id.toString();
  }

  if (userId.id) {
    return userId.id.toString();
  }

  return userId.toString();
};

const notifyListeners = () => {
  const snapshot = new Map(
    presenceCache
  );

  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error(
        "Presence listener error:",
        error
      );
    }
  }
};

const handlePresenceUpdate = (
  payload
) => {
  const userId =
    normalizeUserId(
      payload?.userId
    );

  if (!userId) {
    return;
  }

  presenceCache.set(
    userId,
    {
      userId,
      isOnline:
        Boolean(
          payload?.isOnline
        ),
      lastSeen:
        payload?.lastSeen ||
        null,
    }
  );

  notifyListeners();
};

const handleSelfPresence = (
  payload
) => {
  const userId =
    normalizeUserId(
      payload?.userId
    );

  if (!userId) {
    return;
  }

  presenceCache.set(
    userId,
    {
      userId,
      isOnline:
        Boolean(
          payload?.isOnline
        ),
      lastSeen:
        payload?.lastSeen ||
        null,
    }
  );

  notifyListeners();
};

const initialize = () => {
  if (initialized) {
    return;
  }

  initialized = true;

  socket.on(
    "presence:update",
    handlePresenceUpdate
  );

  socket.on(
    "presence:self",
    handleSelfPresence
  );
};

const subscribe = (
  listener
) => {
  if (
    typeof listener !==
    "function"
  ) {
    return () => {};
  }

  initialize();

  listeners.add(listener);

  /*
   * Immediately provide the current cache.
   */
  try {
    listener(
      new Map(presenceCache)
    );
  } catch (error) {
    console.error(
      "Initial presence listener error:",
      error
    );
  }

  return () => {
    listeners.delete(listener);
  };
};

const getPresence = (
  userId
) => {
  const normalizedUserId =
    normalizeUserId(userId);

  if (!normalizedUserId) {
    return null;
  }

  return (
    presenceCache.get(
      normalizedUserId
    ) || null
  );
};

const isOnline = (
  userId
) => {
  return Boolean(
    getPresence(userId)
      ?.isOnline
  );
};

const getLastSeen = (
  userId
) => {
  return (
    getPresence(userId)
      ?.lastSeen || null
  );
};

const clear = () => {
  presenceCache.clear();
  notifyListeners();
};

export {
  subscribe,
  getPresence,
  isOnline,
  getLastSeen,
  clear,
  normalizeUserId,
};