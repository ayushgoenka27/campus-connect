import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Full-screen loading state shown while the AuthContext
 * determines whether a valid token is present.
 */
function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
      <div className="text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
          <span className="text-lg font-bold">C</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        </div>
        <p className="mt-3 text-xs text-slate-400">Loading Campus Connect</p>
      </div>
    </div>
  );
}

/**
 * Wraps protected routes.
 *
 * - Shows a loading screen while auth state is being determined.
 * - Redirects unauthenticated users to /login.
 * - Renders child routes (via <Outlet />) for authenticated users.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

