import usePresence from "../hooks/usePresence";

function PresenceDot({
  userId,
  size = "medium",
  showOffline = false,
}) {
  const {
    isOnline,
  } = usePresence(userId);

  if (
    !isOnline &&
    !showOffline
  ) {
    return null;
  }

  return (
    <span
      className={`presence-dot presence-dot-${size} ${
        isOnline
          ? "presence-dot-online"
          : "presence-dot-offline"
      }`}
      aria-label={
        isOnline
          ? "Online"
          : "Offline"
      }
      title={
        isOnline
          ? "Online"
          : "Offline"
      }
    />
  );
}

export default PresenceDot;