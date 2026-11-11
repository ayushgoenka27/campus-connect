import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ComingSoon from "./pages/ComingSoon";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/connections" element={<Connections />} />
              <Route
                path="/messages"
                element={
                  <ComingSoon
                    title="Messages"
                    description="Real-time one-to-one messaging with your campus connections."
                  />
                }
              />
              <Route path="/community" element={<Community />} />
              <Route
                path="/events"
                element={
                  <ComingSoon
                    title="Campus Events"
                    description="Explore and keep track of workshops, hackathons, and gatherings."
                  />
                }
              />
              <Route
                path="/announcements"
                element={
                  <ComingSoon
                    title="Announcements"
                    description="Official department and university notices."
                  />
                }
              />
              <Route
                path="/resources"
                element={
                  <ComingSoon
                    title="Academic Resources"
                    description="Access syllabus materials, question papers, and shared guides."
                  />
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/settings"
                element={
                  <ComingSoon
                    title="Settings"
                    description="Configure your account preferences and credentials."
                  />
                }
              />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
