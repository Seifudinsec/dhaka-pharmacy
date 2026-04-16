import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const NotificationContext = createContext(null);
const STORAGE_KEY = 'dhaka_notifications';

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
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100)));
  }, [notifications]);

  const upsertNotifications = useCallback((incoming) => {
    if (!incoming.length) return;
    setNotifications((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      incoming.forEach((item) => {
        const existing = prevMap.get(item.id);
        if (!existing) {
          prevMap.set(item.id, item);
          return;
        }
        prevMap.set(item.id, {
          ...existing,
          ...item,
          isRead: existing.isRead,
          createdAt: existing.createdAt || item.createdAt,
        });
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
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  useEffect(() => {
    if (!user) return;

    const pollNotifications = async () => {
      try {
        const [lowRes, expRes, statsRes] = await Promise.all([
          api.get('/medicines', { params: { filter: 'low_stock', limit: 8 } }),
          api.get('/medicines', { params: { filter: 'expired', limit: 8 } }),
          api.get('/dashboard/stats'),
        ]);

        const lowItems = lowRes.data?.success ? lowRes.data.data || [] : [];
        const expItems = expRes.data?.success ? expRes.data.data || [] : [];
        const stats = statsRes.data?.success ? statsRes.data.data || {} : {};

        const next = [];

        lowItems.forEach((m) => {
          next.push(makeNotification(
            `low-${m._id}`,
            'warning',
            'Low Stock Alert',
            `${m.name} is below safe stock (${m.stock} units remaining).`,
            { medicineId: m._id, route: `/inventory?filter=low_stock&highlight=${m._id}` }
          ));
        });

        expItems.forEach((m) => {
          const expiryDate = new Date(m.expiryDate);
          const days = differenceInDays(expiryDate, new Date());
          const detail = days < 0 ? `expired ${Math.abs(days)} day(s) ago` : 'expired';
          next.push(makeNotification(
            `exp-${m._id}`,
            'error',
            'Expiry Alert',
            `${m.name} has ${detail}.`,
            { medicineId: m._id, route: `/inventory?filter=expired&highlight=${m._id}` }
          ));
        });

        if ((stats?.outOfStockCount || 0) > 0) {
          next.push(makeNotification(
            'sys-out-of-stock',
            'info',
            'System Warning',
            `${stats.outOfStockCount} medicine(s) are currently out of stock.`,
            { route: '/inventory?filter=out_of_stock' }
          ));
        }

        upsertNotifications(next);
      } catch {
        upsertNotifications([
          makeNotification(
            'sys-fetch-warning',
            'error',
            'Notification Service Warning',
            'Unable to refresh alerts. Retrying automatically.',
            { route: '/dashboard' }
          ),
        ]);
      }
    };

    pollNotifications();
    const timer = setInterval(pollNotifications, 60000);
    return () => clearInterval(timer);
  }, [user, upsertNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    dismissNotification,
    markAsRead,
    markAllAsRead,
  }), [notifications, unreadCount, dismissNotification, markAsRead, markAllAsRead]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
