import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faCircleExclamation, 
  faTriangleExclamation, 
  faCircleCheck, 
  faCircleInfo,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-hot-toast";

const NotificationPopup = ({ t, notification }) => {
  const navigate = useNavigate();

  const getIcon = () => {
    switch (notification.type) {
      case "error": return faCircleExclamation;
      case "warning": return faTriangleExclamation;
      case "success": return faCircleCheck;
      default: return faCircleInfo;
    }
  };

  const getIconColor = () => {
    switch (notification.type) {
      case "error": return "var(--danger)";
      case "warning": return "var(--warning)";
      case "success": return "var(--secondary)";
      default: return "var(--primary)";
    }
  };

  const handleView = () => {
    toast.dismiss(t.id);
    if (notification.meta?.route) {
      navigate(notification.meta.route);
    }
  };

  return (
    <div
      className={`notification-popup-card ${t.visible ? 'animate-enter' : 'animate-leave'}`}
      style={{
        background: 'var(--gray-900)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '320px',
        maxWidth: '400px',
        border: '1px solid var(--gray-800)',
        pointerEvents: 'auto',
      }}
    >
      <div 
        style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '10px', 
          background: 'rgba(255,255,255,0.05)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: getIconColor(),
          fontSize: '18px',
          flexShrink: 0
        }}
      >
        <FontAwesomeIcon icon={getIcon()} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{notification.title}</h4>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notification.description}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleView}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          View
        </button>
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{
            background: 'transparent',
            color: 'var(--gray-500)',
            border: 'none',
            padding: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </div>
  );
};

export default NotificationPopup;
