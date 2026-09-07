require("dotenv").config();

const http = require("http");
const {
  Server,
} = require("socket.io");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("./models/User");
const Conversation = require("./models/Conversation");

const userRoutes = require("./routes/userRoutes");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const messageStateRoutes = require("./routes/messageStateRoutes");
const conversationStateRoutes = require("./routes/conversationStateRoutes");
const postRoutes = require("./routes/postRoutes");
const blockRoutes = require("./routes/blockRoutes");
const conversationSettingRoutes = require("./routes/conversationSettingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const groupRoutes = require("./routes/groupRoutes");

const app = express();

const PORT =
  Number(process.env.PORT) || 5000;

/*
|--------------------------------------------------------------------------
| FRONTEND URL
|--------------------------------------------------------------------------
*/

const configuredFrontendUrl =
  process.env.FRONTEND_URL?.trim();

if (
  process.env.NODE_ENV ===
    "production" &&
  !configuredFrontendUrl
) {
  throw new Error(
    "FRONTEND_URL is required in production."
  );
}

const FRONTEND_URL = (
  configuredFrontendUrl ||
  "http://localhost:5173"
).replace(/\/$/, "");

/*
|--------------------------------------------------------------------------
| REQUIRED ENVIRONMENT VARIABLES
|--------------------------------------------------------------------------
*/

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is required."
  );
}

if (!process.env.MONGO_URI) {
  throw new Error(
    "MONGO_URI is required."
  );
}

/*
|--------------------------------------------------------------------------
| IMPORTANT FOR RENDER
|--------------------------------------------------------------------------
*/

app.set("trust proxy", 1);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const corsOptions = {
  origin: FRONTEND_URL,
  credentials: true,
};

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

connectDB();

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  next();
});

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/

app.use(
  "/api/conversations",
  conversationRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

app.use(
  "/api/message-state",
  messageStateRoutes
);

app.use(
  "/api/conversation-state",
  conversationStateRoutes
);

app.use(
  "/api/posts",
  postRoutes
);

app.use(
  "/api/blocks",
  blockRoutes
);

app.use(
  "/api/conversation-settings",
  conversationSettingRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/connections",
  connectionRoutes
);

app.use(
  "/api/groups",
  groupRoutes
);

/*
|--------------------------------------------------------------------------
| BASIC ROUTES
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    message:
      "CoChat API is running 🚀",

    environment:
      process.env.NODE_ENV ||
      "development",
  });
});

app.get(
  "/health",
  async (req, res) => {
    const dbReady =
      mongoose.connection
        .readyState === 1;

    res
      .status(
        dbReady ? 200 : 503
      )
      .json({
        success: dbReady,

        service:
          "cochat-api",

        database: dbReady
          ? "connected"
          : "disconnected",
      });
  }
);

/*
|--------------------------------------------------------------------------
| HTTP SERVER
|--------------------------------------------------------------------------
*/

const server =
  http.createServer(app);

/*
|--------------------------------------------------------------------------
| SOCKET.IO
|--------------------------------------------------------------------------
*/

const io = new Server(server, {
  cors: corsOptions,

  /*
   * Allow short connection interruptions to
   * recover without immediately requiring a
   * complete page reload.
   */
  connectionStateRecovery: {
    maxDisconnectionDuration:
      2 * 60 * 1000,

    skipMiddlewares: false,
  },
});

app.set("io", io);
global.io = io;

/*
|--------------------------------------------------------------------------
| COOKIE PARSER FOR SOCKET.IO
|--------------------------------------------------------------------------
*/

const parseCookies = (
  header = ""
) => {
  return header
    .split(";")
    .reduce(
      (cookies, part) => {
        const index =
          part.indexOf("=");

        if (index === -1) {
          return cookies;
        }

        const key = part
          .slice(0, index)
          .trim();

        const value = part
          .slice(index + 1)
          .trim();

        if (key) {
          try {
            cookies[key] =
              decodeURIComponent(
                value
              );
          } catch {
            cookies[key] =
              value;
          }
        }

        return cookies;
      },
      {}
    );
};

/*
|--------------------------------------------------------------------------
| IN-MEMORY PRESENCE
|--------------------------------------------------------------------------
|
| A user may have multiple browser tabs/devices.
|
| Map:
|
| userId -> Set(socketId)
|
| A user is online while at least one authenticated
| socket is connected.
|
| This is intentionally realtime/session state,
| not persistent user data.
|
*/

const onlineUsers =
  new Map();

const addOnlineSocket = (
  userId,
  socketId
) => {
  const normalizedUserId =
    userId.toString();

  let sockets =
    onlineUsers.get(
      normalizedUserId
    );

  if (!sockets) {
    sockets = new Set();

    onlineUsers.set(
      normalizedUserId,
      sockets
    );
  }

  const wasOffline =
    sockets.size === 0;

  sockets.add(socketId);

  return wasOffline;
};

const removeOnlineSocket = (
  userId,
  socketId
) => {
  const normalizedUserId =
    userId.toString();

  const sockets =
    onlineUsers.get(
      normalizedUserId
    );

  if (!sockets) {
    return false;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(
      normalizedUserId
    );

    return true;
  }

  return false;
};

const isUserOnline = (
  userId
) => {
  return onlineUsers.has(
    userId.toString()
  );
};

const emitPresence = (
  userId,
  isOnline
) => {
  if (!global.io) {
    return;
  }

  global.io.emit(
    "presence:update",
    {
      userId:
        userId.toString(),

      isOnline,

      lastSeen:
        isOnline
          ? null
          : new Date().toISOString(),
    }
  );
};

/*
|--------------------------------------------------------------------------
| SOCKET AUTHENTICATION
|--------------------------------------------------------------------------
*/

io.use(
  async (socket, next) => {
    try {
      const cookies =
        parseCookies(
          socket.handshake
            .headers.cookie
        );

      const token =
        cookies.token;

      if (!token) {
        return next(
          new Error(
            "Not authenticated."
          )
        );
      }

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      const user =
        await User.findById(
          decoded.userId
        ).select("-password");

      if (!user) {
        return next(
          new Error(
            "User no longer exists."
          )
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error(
        "Socket authentication error:",
        error.message
      );

      next(
        new Error(
          "Invalid or expired session."
        )
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| SOCKET CONNECTION
|--------------------------------------------------------------------------
*/

io.on(
  "connection",
  (socket) => {
    const userId =
      socket.user._id.toString();

    const becameOnline =
      addOnlineSocket(
        userId,
        socket.id
      );

    /*
     * Every authenticated user gets a private
     * room for direct realtime events.
     */
    socket.join(
      `user:${userId}`
    );

    console.log(
      "Socket connected:",
      socket.id,
      "user:",
      userId
    );

    /*
     * Only emit online when this was the first
     * active socket for the user.
     */
    if (becameOnline) {
      emitPresence(
        userId,
        true
      );
    }

    /*
     * Tell this client its own current presence
     * state immediately.
     */
    socket.emit(
      "presence:self",
      {
        userId,
        isOnline: true,
      }
    );

    /*
     |--------------------------------------------------------------------------
     | JOIN CONVERSATION
     |--------------------------------------------------------------------------
     */

    socket.on(
      "join-conversation",
      async (conversationId) => {
        try {
          if (
            !mongoose.Types.ObjectId.isValid(
              conversationId
            )
          ) {
            return;
          }

          const conversation =
            await Conversation.exists(
              {
                _id:
                  conversationId,

                participants:
                  socket.user._id,
              }
            );

          if (!conversation) {
            socket.emit(
              "socket:error",
              {
                message:
                  "You are not a member of this conversation.",
              }
            );

            return;
          }

          socket.join(
            `conversation:${conversationId}`
          );
        } catch (error) {
          console.error(
            "Socket conversation join failed:",
            error.message
          );
        }
      }
    );

    /*
     |--------------------------------------------------------------------------
     | LEAVE CONVERSATION
     |--------------------------------------------------------------------------
     */

    socket.on(
      "leave-conversation",
      (conversationId) => {
        if (
          mongoose.Types.ObjectId.isValid(
            conversationId
          )
        ) {
          socket.leave(
            `conversation:${conversationId}`
          );
        }
      }
    );

    /*
     |--------------------------------------------------------------------------
     | TYPING INDICATOR
     |--------------------------------------------------------------------------
     */

    socket.on(
      "conversation:typing",
      async (payload = {}) => {
        try {
          const conversationId =
            payload.conversationId;

          if (
            !mongoose.Types.ObjectId.isValid(
              conversationId
            )
          ) {
            return;
          }

          const conversation =
            await Conversation.exists(
              {
                _id:
                  conversationId,

                participants:
                  socket.user._id,
              }
            );

          if (!conversation) {
            return;
          }

          const isTyping =
            Boolean(
              payload.isTyping
            );

          socket
            .to(
              `conversation:${conversationId}`
            )
            .emit(
              "conversation:typing",
              {
                conversationId:
                  conversationId.toString(),

                userId:
                  socket.user._id.toString(),

                username:
                  socket.user.username ||
                  "Someone",

                isTyping,
              }
            );
        } catch (error) {
          console.error(
            "Socket typing event failed:",
            error.message
          );
        }
      }
    );

    /*
     |--------------------------------------------------------------------------
     | DISCONNECT
     |--------------------------------------------------------------------------
     */

    socket.on(
      "disconnect",
      (reason) => {
        const becameOffline =
          removeOnlineSocket(
            userId,
            socket.id
          );

        /*
         * Only announce offline when the user no
         * longer has ANY active socket.
         */
        if (becameOffline) {
          emitPresence(
            userId,
            false
          );
        }

        console.log(
          "Socket disconnected:",
          socket.id,
          "user:",
          userId,
          "reason:",
          reason
        );
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

server.listen(
  PORT,
  () => {
    console.log(
      `CoChat backend running on port ${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `Allowed frontend: ${FRONTEND_URL}`
    );
  }
);