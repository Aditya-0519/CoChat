require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
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
const postRoutes = require("./routes/postRoutes");
const blockRoutes = require("./routes/blockRoutes");
const conversationSettingRoutes = require("./routes/conversationSettingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const groupRoutes = require("./routes/groupRoutes");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

/*
|--------------------------------------------------------------------------
| FRONTEND URL
|--------------------------------------------------------------------------
*/

const configuredFrontendUrl =
  process.env.FRONTEND_URL?.trim();

if (
  process.env.NODE_ENV === "production" &&
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
  throw new Error("JWT_SECRET is required.");
}

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required.");
}

/*
|--------------------------------------------------------------------------
| IMPORTANT FOR RENDER
|--------------------------------------------------------------------------
|
| Render runs Express behind a reverse proxy.
| This allows req.secure to correctly detect HTTPS.
|
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
    message: "CoChat API is running 🚀",
    environment:
      process.env.NODE_ENV || "development",
  });
});

app.get("/health", async (req, res) => {
  const dbReady =
    mongoose.connection.readyState === 1;

  res.status(
    dbReady ? 200 : 503
  ).json({
    success: dbReady,
    service: "cochat-api",
    database: dbReady
      ? "connected"
      : "disconnected",
  });
});

/*
|--------------------------------------------------------------------------
| HTTP SERVER
|--------------------------------------------------------------------------
*/

const server = http.createServer(app);

/*
|--------------------------------------------------------------------------
| SOCKET.IO
|--------------------------------------------------------------------------
*/

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);
global.io = io;

/*
|--------------------------------------------------------------------------
| COOKIE PARSER FOR SOCKET.IO
|--------------------------------------------------------------------------
*/

const parseCookies = (header = "") => {
  return header
    .split(";")
    .reduce((cookies, part) => {
      const index = part.indexOf("=");

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
        cookies[key] =
          decodeURIComponent(value);
      }

      return cookies;
    }, {});
};

/*
|--------------------------------------------------------------------------
| SOCKET AUTHENTICATION
|--------------------------------------------------------------------------
*/

io.use(async (socket, next) => {
  try {
    const cookies =
      parseCookies(
        socket.handshake.headers.cookie
      );

    const token = cookies.token;

    if (!token) {
      return next(
        new Error("Not authenticated.")
      );
    }

    const decoded = jwt.verify(
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
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

server.listen(PORT, () => {
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
});

/*
|--------------------------------------------------------------------------
| SOCKET CONNECTION
|--------------------------------------------------------------------------
*/

io.on("connection", (socket) => {
  const userId =
    socket.user._id.toString();

  socket.join(
    `user:${userId}`
  );

  console.log(
    "Socket connected:",
    socket.id,
    "user:",
    userId
  );

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
          await Conversation.exists({
            _id: conversationId,
            participants:
              socket.user._id,
          });

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

  socket.on(
    "disconnect",
    () => {
      console.log(
        "Socket disconnected:",
        socket.id,
        "user:",
        userId
      );
    }
  );
});