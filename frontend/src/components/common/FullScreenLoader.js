import React, { useEffect, useState } from 'react';

export default function FullScreenLoader({ visible, text = 'Signing you in...' }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={`login-loading-overlay${visible ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={text}
      aria-hidden={!visible}
    >
      <div className="login-loading-card">
        <div className="login-loading-brand">
          <img src="/dhaka-pharmacy-logo.jpg" alt="" />
          <div>
            <strong>Dhaka Pharmacy</strong>
            <span>Inventory &amp; billing workspace</span>
          </div>
        </div>
        <div className="login-loading-indicator" aria-hidden="true">
          <span />
        </div>
        <p>{text}</p>
        <div className="login-loading-track" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
