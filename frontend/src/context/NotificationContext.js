import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { differenceInDays } from "date-fns";
import { toast } from "react-hot-toast";
import { useAuth } from "./AuthContext";
import api from "../utils/api";
import NotificationPopup from "../components/common/NotificationPopup";

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

  // Popup queue: each item is { id, type, title, description }
  const [popups, setPopups] = useState([]);
  const popupIdRef = useRef(0);

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

  // Show a real-time popup and also save to the notification panel
  const showPopup = useCallback((type, title, description, meta = {}) => {
    const uid = `popup-${Date.now()}-${++popupIdRef.current}`;
    const notification = makeNotification(uid, type, title, description, meta);

    // Add to notification panel
    setNotifications((prev) => {
      const next = [notification, ...prev].slice(0, 100);
      return next;
    });

    // Add to popup queue
    setPopups((prev) => [...prev, { id: uid, type, title, description }]);
  }, []);

  const dismissPopup = useCallback((id) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
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

    const socket = io(
      process.env.REACT_APP_SOCKET_URL || window.location.origin,
    );

    socket.on("inventory_updated", ({ stockAlerts } = {}) => {
      // Show real-time popups for affected medicines
      if (Array.isArray(stockAlerts) && stockAlerts.length > 0) {
        stockAlerts.forEach((alert) => {
          if (alert.alertType === "out_of_stock") {
            showPopup(
              "error",
              "Out of Stock",
              `${alert.name} is now out of stock.`,
              { route: `/inventory?highlight=${alert.id}` },
            );
          } else if (alert.alertType === "low_stock") {
            showPopup(
              "warning",
              "Low Stock Alert",
              `${alert.name}: only ${alert.stock} unit${alert.stock !== 1 ? "s" : ""} remaining.`,
              { route: `/inventory?highlight=${alert.id}` },
            );
          }
        });
      }
      // Also poll to refresh general notification panel
      poll();
    });

    socket.on("notification", (data) => {
      // Add to list
      setNotifications(prev => {
        const alreadyExists = prev.some(n => n.id === data.id);
        if (alreadyExists) return prev;
        return [data, ...prev].slice(0, 100);
      });

      // Show popup
      toast.custom((t) => (
        <NotificationPopup t={t} notification={data} />
      ), {
        duration: 5000,
        position: 'top-right'
      });
    });

    const timer = setInterval(poll, 60000);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [user, upsertNotifications, showPopup]);

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
      popups,
      showPopup,
      dismissPopup,
    }),
    [
      notifications,
      unreadCount,
      dismissNotification,
      markAsRead,
      markAllAsRead,
      popups,
      showPopup,
      dismissPopup,
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
