import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  faCircleInfo,
  faTriangleExclamation,
  faCircleCheck,
  faCircleXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AppIcon from "./AppIcon";
import { useNotifications } from "../../context/NotificationContext";

const AUTO_DISMISS_MS = 6000;

const typeConfig = {
  info: { icon: faCircleInfo, className: "popup-info" },
  warning: { icon: faTriangleExclamation, className: "popup-warning" },
  success: { icon: faCircleCheck, className: "popup-success" },
  error: { icon: faCircleXmark, className: "popup-error" },
};

function PopupItem({ popup, onDismiss }) {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const config = typeConfig[popup.type] || typeConfig.info;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(popup.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timerRef.current);
  }, [popup.id, onDismiss]);

  const handleClick = () => {
    onDismiss(popup.id);
    if (popup.route) navigate(popup.route);
  };

  return (
    <div
      className={`notification-popup-item ${config.className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
      aria-label={`${popup.title}: ${popup.description}`}
    >
      <div className="popup-item-icon">
        <AppIcon icon={config.icon} />
      </div>
      <div className="popup-item-body">
        <div className="popup-item-title">{popup.title}</div>
        <div className="popup-item-description">{popup.description}</div>
      </div>
      <button
        className="popup-item-close"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(popup.id);
        }}
        aria-label="Dismiss"
      >
        <AppIcon icon={faXmark} />
      </button>
      <div className="popup-item-progress">
        <div
          className="popup-item-progress-bar"
          style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
        />
      </div>
    </div>
  );
}

export default function NotificationPopup() {
  const { popups, dismissPopup } = useNotifications();

  if (!popups.length) return null;

  return (
    <div className="notification-popup-container" aria-live="polite">
      {popups.map((popup) => (
        <PopupItem key={popup.id} popup={popup} onDismiss={dismissPopup} />
      ))}
    </div>
  );
}
