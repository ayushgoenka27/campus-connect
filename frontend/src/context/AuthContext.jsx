import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("campus_connect_token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("campus_connect_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/users/me");
      setUser(response.data);
    } catch {
      localStorage.removeItem("campus_connect_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("campus_connect_token");

    if (!token) {
      // Defer loading state to avoid synchronous effect re-render warning
      const timer = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    api
      .get("/users/me")
      .then((res) => {
        if (isMounted) setUser(res.data);
      })
      .catch(() => {
        if (isMounted) {
          localStorage.removeItem("campus_connect_token");
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (newToken) => {
    localStorage.setItem("campus_connect_token", newToken);
    setToken(newToken);
    setLoading(true);
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
    } catch {
      localStorage.removeItem("campus_connect_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("campus_connect_token");
    setToken(null);
    setUser(null);
  }, []);

  const updateToken = useCallback((newToken) => {
    localStorage.setItem("campus_connect_token", newToken);
    setToken(newToken);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    updateToken,
    refreshUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


