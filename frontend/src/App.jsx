import { BrowserRouter, Routes, Route } from "react-router-dom";

import PublicProfile from "./pages/PublicProfile";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";
import Messages from "./pages/Messages";
import MessageRequests from "./pages/MessageRequests";
import Groups from "./pages/Groups";
import GroupChat from "./pages/GroupChat";
import Notifications from "./pages/Notifications";

import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Landing />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<Signup />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/onboarding"
            element={<Onboarding />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/discover"
            element={<Discover />}
          />

          <Route
            path="/u/:username"
            element={<PublicProfile />}
          />

          <Route
            path="/groups"
            element={<Groups />}
          />

          <Route
            path="/groups/:groupId"
            element={<GroupChat />}
          />

          <Route
            path="/messages"
            element={<Messages />}
          />

          <Route
            path="/messages/:conversationId"
            element={<Messages />}
          />

          <Route
  path="/message-requests"
  element={<MessageRequests />}
/>

          <Route
            path="/notifications"
            element={<Notifications />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;