import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("dhaka_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(
    () => Boolean(sessionStorage.getItem("dhaka_token")),
  );

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("dhaka_token");
    if (!token) {
      setLoading(false);
      setUser(null);
      return () => {
        active = false;
      };
    }

    api.get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        const verifiedUser = {
          ...data.user,
          _id: data.user?._id || data.user?.id,
        };
        sessionStorage.setItem("dhaka_user", JSON.stringify(verifiedUser));
        setUser(verifiedUser);
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem("dhaka_token");
        sessionStorage.removeItem("dhaka_user");
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      if (data.success) {
        const authenticatedUser = {
          ...data.user,
          _id: data.user?._id || data.user?.id,
        };
        sessionStorage.setItem("dhaka_token", data.token);
        sessionStorage.setItem("dhaka_user", JSON.stringify(authenticatedUser));
        setUser(authenticatedUser);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Login failed.",
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("dhaka_token");
    sessionStorage.removeItem("dhaka_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
