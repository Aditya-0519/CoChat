# CoChat

> A modern social platform for college students to discover people, build connections, chat, create groups, and stay connected through real-time communication.

<p align="center">
  <strong>Connect through common interests. Start better conversations. Build real connections.</strong>
</p>

---

## 🌐 Live Links

### 🚀 Frontend
https://cochat-alpha.vercel.app/

### ⚙️ Backend API
https://cochat-g7qi.onrender.com/

### 💻 GitHub Repository
https://github.com/Aditya-0519/CoChat

---

## 📖 About CoChat

CoChat is a full-stack social networking platform designed especially for college students.

The idea behind CoChat is simple:

> Help students discover people, connect through shared interests, communicate safely, and build meaningful communities.

Instead of relying only on existing social networks, WhatsApp groups, or random online communities, CoChat provides a dedicated platform where students can:

- Create their own student profile
- Discover other students
- Connect with people who share similar interests
- Send and receive connection requests
- Start conversations
- Send message requests
- Create group conversations
- Communicate in real time
- Receive notifications
- Install the platform as a Progressive Web App
- Block unwanted users
- Report inappropriate content or users

---

# ✨ Features

## 🔐 Authentication

CoChat provides secure authentication using:

- Email and password
- Google Sign-In
- JWT-based authentication
- HTTP-only authentication cookies
- Password hashing with bcrypt
- Protected routes

Google authentication uses Google Identity Services on the frontend and server-side token verification on the backend.

---

## 👤 Student Profiles

Users can create personalized profiles containing information such as:

- Name
- Username
- College
- Branch
- Bio
- Interests
- Personality
- Profile picture

Users can also:

- Update their profile
- Change their avatar
- View their own profile
- View public profiles of other users

---

## 🔎 Discover Students

The Discover section allows users to find other students on the platform.

Students can discover people based on profile information and shared interests.

This makes it easier to find:

- College friends
- Study partners
- People with similar interests
- Potential communities
- New connections

---

## 🤝 Connections

CoChat includes a complete connection system.

Users can:

- Send connection requests
- Receive connection requests
- Accept requests
- Reject requests
- View connection status
- Manage existing connections

Direct conversations can be restricted to accepted connections for safer communication.

---

# 💬 Messaging

CoChat provides direct messaging between users.

Users can:

- Start conversations
- Send messages
- Receive messages
- View conversation history
- Continue previous conversations
- Receive real-time updates

Messaging is powered by Socket.IO for real-time communication.

---

# 📨 Message Requests

Users can receive message requests from people who are not yet connected with them.

This provides an additional safety layer before allowing unrestricted communication.

Users can:

- Send message requests
- Receive message requests
- Accept requests
- Reject requests
- Manage incoming communication

---

# 👥 Groups

CoChat supports group conversations.

Users can:

- Create groups
- Add connections to groups
- View groups
- Open group conversations
- Manage group members
- Leave groups
- Manage group administration

Group creation and membership are handled by the backend with appropriate access controls.

---

# ⚡ Real-Time Communication

CoChat uses Socket.IO to provide real-time communication.

The Socket.IO system handles:

- Real-time messages
- Conversation updates
- Group messages
- Online communication
- User-specific socket rooms
- Conversation-specific socket rooms

The backend authenticates Socket.IO connections using the user's authentication cookie.

---

# 🔔 Notifications

CoChat includes an in-app notification system.

Notifications can be generated for events such as:

- Connection requests
- Accepted connections
- Messages
- Group activity
- Other important account events

Users can:

- View notifications
- See unread notification count
- Mark notifications as read
- Mark all notifications as read

---

# 📲 Push Notifications

CoChat also supports browser push notifications.

The implementation uses:

- Web Push API
- Service Workers
- VAPID keys
- Browser push subscriptions

This allows users to receive notifications even when the application is not actively open in the browser, depending on browser and operating-system support.

---

# 🛡️ Blocking

Users can block other users.

Blocking helps prevent unwanted interaction.

Users can:

- Block users
- Unblock users
- Check block status
- View blocked users

Blocked users are prevented from interacting in supported areas of the platform.

---

# 🚩 Reporting

CoChat includes reporting functionality for inappropriate users or content.

Users can submit reports that can be reviewed by the application's moderation/admin system.

---

# ☁️ Image Uploads

Profile images are stored using Cloudinary.

The application uses:

- Cloudinary
- Multer
- Multer Storage Cloudinary

This keeps image storage separate from the application server.

---

# 📱 Progressive Web App

CoChat includes Progressive Web App functionality.

The frontend includes:

- Web App Manifest
- Service Worker
- Application icons
- Installable application experience
- Push notification support

Users can install CoChat on supported devices and browsers.

---

# 🏗️ Technology Stack

## Frontend

- React
- React 19
- Vite
- React Router
- Socket.IO Client
- `@react-oauth/google`
- CSS

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO
- JWT
- bcrypt
- Google OAuth / Google Identity Services verification

## Authentication

- JWT
- HTTP-only cookies
- Google Identity Services
- Google OAuth client verification
- bcrypt password hashing

## Database

- MongoDB
- Mongoose

## File Storage

- Cloudinary
- Multer
- Multer Storage Cloudinary

## Notifications

- Web Push API
- Service Worker
- VAPID

## Deployment

### Frontend

- Vercel

### Backend

- Render

---

# 📂 Project Structure

```text
CoChat/
│
├── frontend/
│   │
│   ├── public/
│   │   └── ...
│   │
│   ├── src/
│   │   │
│   │   ├── components/
│   │   │
│   │   ├── context/
│   │   │
│   │   ├── pages/
│   │   │
│   │   ├── services/
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   │
│   ├── config/
│   │
│   ├── controllers/
│   │
│   ├── middleware/
│   │
│   ├── models/
│   │
│   ├── routes/
│   │
│   ├── services/
│   │
│   ├── utils/
│   │
│   ├── app.js
│   ├── package.json
│   └── .env.example
│
├── .gitignore
├── README.md
└── ...