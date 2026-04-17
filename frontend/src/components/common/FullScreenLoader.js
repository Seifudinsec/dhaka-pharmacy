import React, { useEffect, useState } from 'react';

/**
 * Full-screen cyber-themed overlay loader that matches the login page.
 * Used during login to block interaction while authenticating.
 */
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,4,4,0.97)',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(0,242,234,0.07) 0%, transparent 40%), ' +
          'radial-gradient(circle at 80% 10%, rgba(168,85,247,0.07) 0%, transparent 40%)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      role="status"
      aria-live="assertive"
      aria-label={text}
    >
      <div
        style={{
          background: '#0d0d0d',
          border: '1px solid rgba(0,242,234,0.25)',
          boxShadow: '0 0 30px rgba(0,242,234,0.12), inset 0 0 10px rgba(0,0,0,0.5)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 340,
          margin: '0 20px',
          overflow: 'hidden',
          fontFamily: '"Fira Code", Consolas, "Courier New", monospace',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            padding: '0.6em 1em',
            borderBottom: '1px solid rgba(0,242,234,0.2)',
          }}
        >
          <div style={{ color: '#00f2ea', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" strokeWidth="1.5" stroke="#00f2ea" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M14 3v4a1 1 0 0 0 1 1h4" />
              <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
              <path d="M12 11.5a3 3 0 0 0 -3 2.824v1.176a3 3 0 0 0 6 0v-1.176a3 3 0 0 0 -3 -2.824z" />
            </svg>
            DHAKA_PHARMACY_SECURE
          </div>
          <div style={{ display: 'flex', gap: 4 }} aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#333' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '2rem 1.8rem', textAlign: 'center' }}>
          <img
            src="/dhaka-pharmacy-logo.png"
            alt="Dhaka Pharmacy"
            style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 8, margin: '0 auto 14px', display: 'block' }}
          />
          <div style={{ color: '#f6f9ff', fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', marginBottom: 4 }}>
            DHAKA PHARMACY
          </div>
          <div style={{ color: '#93a4b8', fontSize: 11, marginBottom: 28 }}>
            Inventory &amp; Billing System
          </div>

          {/* Cyber spinner */}
          <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 18px' }} aria-hidden="true">
            <div className="fsl-ring fsl-ring-outer" />
            <div className="fsl-ring fsl-ring-inner" />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00f2ea', boxShadow: '0 0 8px #00f2ea' }} />
            </div>
          </div>

          <div style={{ color: '#00f2ea', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
