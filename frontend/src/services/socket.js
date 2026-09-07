
import { io } from "socket.io-client";

import { SOCKET_URL } from "./apiConfig";


/*
|--------------------------------------------------------------------------
| Shared Socket.IO client
|--------------------------------------------------------------------------
|
| One socket instance is used throughout the authenticated application.
|
| Phase 3 responsibilities:
|
| - automatic reconnection
| - exponential-ish reconnect delay
| - cookie-based authentication
| - stable socket path
| - support for presence
| - support for typing indicators
| - support for missed-message recovery
|
| The backend authenticates the socket using the HTTP auth cookie, so we
| intentionally keep withCredentials enabled.
|
|--------------------------------------------------------------------------
*/

export const socket = io(SOCKET_URL, {
  autoConnect: false,

  withCredentials: true,

  /*
   * Reconnect automatically when the network/server becomes available
   * again.
   */
  reconnection: true,

  /*
   * Never permanently give up because of a temporary network outage.
   */
  reconnectionAttempts: Infinity,

  /*
   * Start reconnecting quickly.
   */
  reconnectionDelay: 500,

  /*
   * Prevent reconnect attempts from becoming excessively slow.
   */
  reconnectionDelayMax: 5000,

  /*
   * Avoid every client reconnecting at exactly the same time after a
   * server/network outage.
   */
  randomizationFactor: 0.5,

  /*
   * Explicit Socket.IO endpoint.
   */
  socketPath: "/socket.io",
});


/*
|--------------------------------------------------------------------------
| Optional connection helpers
|--------------------------------------------------------------------------
|
| Keeping these tiny helpers here prevents components from having to know
| how the shared socket is configured.
|--------------------------------------------------------------------------
*/

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};


export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};


export const isSocketConnected = () => {
  return socket.connected;
};
