import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { differenceInDays } from "date-fns";
import { useAuth } from "./AuthContext";
import api from "../utils/api";

const NotificationContext = createContext(null);
const STORAGE_KEY = "dhaka_notifications";

const makeNotification = (id, type, title, description, meta = {}) => ({
  id,
  type,
  title,
  description,
  isRead: false,
  createdAt: new Date().toISOString(),
  ...meta,
});

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notifications.slice(0, 100)),
    );
  }, [notifications]);

  const upsertNotifications = useCallback((incoming) => {
    if (!incoming.length) return;
    setNotifications((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      incoming.forEach((item) => {
        const existing = prevMap.get(item.id);
        if (!existing) {
          prevMap.set(item.id, item);
        } else {
          prevMap.set(item.id, {
            ...existing,
            ...item,
            isRead: existing.isRead,
            createdAt: existing.createdAt || item.createdAt,
          });
        }
      });
      return Array.from(prevMap.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100);
    });
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const [lowRes, expRes, statsRes] = await Promise.all([
          api.get("/medicines", { params: { filter: "low_stock", limit: 5 } }),
          api.get("/medicines", { params: { filter: "expired", limit: 5 } }),
          api.get("/dashboard/stats"),
        ]);

        const next = [];
        const lowItems = lowRes.data?.data || [];
        const expItems = expRes.data?.data || [];
        const stats = statsRes.data?.data || {};

        lowItems.forEach((m) => {
          next.push(
            makeNotification(
              `low-${m._id}`,
              "warning",
              "Low Stock",
              `${m.name}: ${m.stock} left.`,
              { route: `/inventory?highlight=${m._id}` },
            ),
          );
        });

        expItems.forEach((m) => {
          const days = differenceInDays(new Date(m.expiryDate), new Date());
          const msg = days < 0 ? `Expired ${Math.abs(days)}d ago` : "Expired";
          next.push(
            makeNotification(
              `exp-${m._id}`,
              "error",
              "Expiry Alert",
              `${m.name}: ${msg}.`,
              { route: `/inventory?highlight=${m._id}` },
            ),
          );
        });

        if (stats.outOfStockCount > 0) {
          next.push(
            makeNotification(
              "sys-oos",
              "info",
              "Out of Stock",
              `${stats.outOfStockCount} items out of stock.`,
              { route: "/inventory?filter=out_of_stock" },
            ),
          );
        }

        upsertNotifications(next);
      } catch {
        // Silent fail for polling
      }
    };

    poll();
    const timer = setInterval(poll, 60000);
    return () => clearInterval(timer);
  }, [user, upsertNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      dismissNotification,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      dismissNotification,
      markAsRead,
      markAllAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return ctx;
}
