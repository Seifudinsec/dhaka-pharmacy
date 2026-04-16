import React, { useMemo, useRef, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { faBell, faCheckDouble, faCircleInfo, faTriangleExclamation, faCircleCheck, faCircleXmark, faXmark } from '@fortawesome/free-solid-svg-icons';
import AppIcon from './AppIcon';
import { useNotifications } from '../../context/NotificationContext';

const typeToIcon = {
  info: faCircleInfo,
  warning: faTriangleExclamation,
  success: faCircleCheck,
  error: faCircleXmark,
};

const typeToTone = {
  info: 'primary',
  warning: 'warning',
  success: 'success',
  error: 'danger',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead, markAsRead, dismissNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close panel when user clicks outside the notification root
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const ordered = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notifications]
  );

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setOpen(false);
    if (notification.route) navigate(notification.route);
  };

  return (
    <div className="notification-root" ref={rootRef}>
      <button className="notification-bell-btn" onClick={() => setOpen((v) => !v)} aria-label="Open notifications">
        <AppIcon icon={faBell} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      <div className={`notification-panel${open ? ' open' : ''}`}>
        <div className="notification-panel-header">
          <h3>Notifications</h3>
          <button className="btn btn-secondary btn-sm" onClick={markAllAsRead}>
            <AppIcon icon={faCheckDouble} /> Mark all read
          </button>
        </div>

        {!ordered.length ? (
          <div className="notification-empty">No active notifications.</div>
        ) : (
          <div className="notification-list">
            {ordered.map((n) => (
              <div
                key={n.id}
                className={`notification-item notification-${n.type}${n.isRead ? '' : ' unread'}`}
                onClick={() => handleNotificationClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(n); }}
              >
                <div className="notification-item-icon">
                  <AppIcon icon={typeToIcon[n.type] || faCircleInfo} tone={typeToTone[n.type] || 'primary'} />
                </div>
                <div className="notification-item-content">
                  <div className="notification-item-title">{n.title}</div>
                  <div className="notification-item-description">{n.description}</div>
                  <div className="notification-item-time">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <button
                  className="notification-dismiss"
                  onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                  aria-label="Dismiss notification"
                >
                  <AppIcon icon={faXmark} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
