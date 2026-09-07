import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  subscribe,
  getPresence,
  normalizeUserId,
} from "../services/presenceService";

/*
|--------------------------------------------------------------------------
| usePresence
|--------------------------------------------------------------------------
|
| Usage:
|
| const presence = usePresence(userId);
|
| presence.isOnline
| presence.lastSeen
|
|--------------------------------------------------------------------------
*/

const EMPTY_PRESENCE = {
  userId: "",
  isOnline: false,
  lastSeen: null,
};

const usePresence = (
  userId
) => {
  const normalizedUserId =
    useMemo(
      () =>
        normalizeUserId(
          userId
        ),
      [userId]
    );

  const [
    presence,
    setPresence,
  ] = useState(() => {
    return (
      getPresence(
        normalizedUserId
      ) || {
        ...EMPTY_PRESENCE,
        userId:
          normalizedUserId,
      }
    );
  });

  useEffect(() => {
    /*
     * Reset when the requested user changes.
     */
    setPresence(
      getPresence(
        normalizedUserId
      ) || {
        ...EMPTY_PRESENCE,
        userId:
          normalizedUserId,
      }
    );

    if (!normalizedUserId) {
      return undefined;
    }

    const unsubscribe =
      subscribe(
        (presenceMap) => {
          const next =
            presenceMap.get(
              normalizedUserId
            );

          setPresence(
            next || {
              ...EMPTY_PRESENCE,
              userId:
                normalizedUserId,
            }
          );
        }
      );

    return unsubscribe;
  }, [
    normalizedUserId,
  ]);

  return presence;
};

export default usePresence;