import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  faEye,
  faEyeSlash,
  faRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/common/AppIcon";
import FullScreenLoader from "../components/common/FullScreenLoader";

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isDark, setIsDark] = useState(
    () =>
      (document.documentElement.getAttribute("data-theme") || "light") ===
      "dark",
  );

  // Reactively track theme changes made anywhere in the app
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(
        (document.documentElement.getAttribute("data-theme") || "light") ===
          "dark",
      );
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError("Please enter both username and password.");
      return;
    }
    const result = await login(form.username, form.password);
    if (!result.success) setError(result.message || "Login failed.");
  };

  return (
    <div className={`lp-root ${isDark ? "lp-dark" : "lp-light"}`}>
      <FullScreenLoader visible={loading} text="Signing you in..." />

      {/* Animated background orbs — visible only in dark mode via CSS */}
      <div className="lp-orb lp-orb-1" aria-hidden="true" />
      <div className="lp-orb lp-orb-2" aria-hidden="true" />
      <div className="lp-orb lp-orb-3" aria-hidden="true" />
      <div className="lp-orb lp-orb-4" aria-hidden="true" />

      {isDark ? (
        /* ===================== DARK MODE CARD ===================== */
        <div className="lp-dark-card">
          <div className="lp-dark-header">
            <div className="lp-dark-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={14}
                height={14}
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="#60a5fa"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                <path d="M12 11.5a3 3 0 0 0 -3 2.824v1.176a3 3 0 0 0 6 0v-1.176a3 3 0 0 0 -3 -2.824z" />
              </svg>
              DHAKA_PHARMACY_SECURE
            </div>
            <div className="lp-dark-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="lp-dark-body">
            <div className="lp-dark-logo">
              <img
                src="/dhaka-pharmacy-logo.png"
                alt="Dhaka Pharmacy logo"
                style={{
                  width: "100%",
                  maxWidth: 260,
                  margin: "0 auto 10px",
                  display: "block",
                  borderRadius: 8,
                }}
              />
              <h1>DHAKA PHARMACY</h1>
              <p>Inventory &amp; Billing System</p>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="lp-dark-field">
                <input
                  id="d-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="lp-dark-input"
                  disabled={loading}
                />
                <label
                  htmlFor="d-username"
                  className="lp-dark-label"
                  data-text="USERNAME"
                >
                  USERNAME
                </label>
              </div>

              <div className="lp-dark-field">
                <input
                  id="d-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="lp-dark-input"
                  disabled={loading}
                />
                <label
                  htmlFor="d-password"
                  className="lp-dark-label"
                  data-text="ACCESS_KEY"
                >
                  ACCESS_KEY
                </label>
                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="lp-dark-eye"
                >
                  <AppIcon icon={showPass ? faEyeSlash : faEye} />
                </button>
              </div>

              <button
                type="submit"
                className="lp-dark-submit"
                data-text="INITIATE_CONNECTION"
                disabled={loading}
              >
                <span className="lp-dark-btn-text">
                  {loading ? (
                    <>
                      <span className="spinner spinner-sm" aria-hidden="true" />{" "}
                      SIGNING IN...
                    </>
                  ) : (
                    <>
                      <AppIcon icon={faRightToBracket} /> SIGN_IN
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ===================== LIGHT MODE CARD ===================== */
        <div className="lp-light-card">
          <div className="lp-light-stripe" aria-hidden="true" />

          <div className="lp-light-body">
            <div className="lp-light-logo">
              <img
                src="/dhaka-pharmacy-logo.png"
                alt="Dhaka Pharmacy logo"
                style={{
                  width: 84,
                  height: 84,
                  objectFit: "contain",
                  borderRadius: 14,
                  display: "block",
                  margin: "0 auto 14px",
                  boxShadow: "0 4px 16px rgba(37,99,235,0.14)",
                }}
              />
              <h1>Dhaka Pharmacy</h1>
              <p>Inventory &amp; Billing System</p>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="form-group">
                <label
                  htmlFor="l-username"
                  className="form-label"
                  style={{ fontWeight: 600 }}
                >
                  Username
                </label>
                <input
                  id="l-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                  className="form-control"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label
                  htmlFor="l-password"
                  className="form-label"
                  style={{ fontWeight: 600 }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="l-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    required
                    className="form-control"
                    placeholder="Enter your password"
                    style={{ paddingRight: 44 }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    aria-label={showPass ? "Hide password" : "Show password"}
                    onClick={() => setShowPass((s) => !s)}
                    className="lp-light-eye"
                  >
                    <AppIcon icon={showPass ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary lp-light-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <AppIcon icon={faRightToBracket} /> Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* ============================================================
           ROOT — shared shell
        ============================================================ */
        .lp-root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          padding: 20px;
          box-sizing: border-box;
        }

        /* ============================================================
           LIGHT MODE — background
        ============================================================ */
        .lp-light {
          background: #f0f7ff;
          background-image:
            radial-gradient(ellipse at 8% 8%,   rgba(37,99,235,0.09)  0%, transparent 50%),
            radial-gradient(ellipse at 92% 92%,  rgba(14,165,233,0.09) 0%, transparent 50%),
            linear-gradient(155deg, #eff6ff 0%, #f8fafc 55%, #dbeafe 100%);
        }

        /* Hide orbs completely in light mode */
        .lp-light .lp-orb { display: none; }

        /* ============================================================
           LIGHT MODE — card
        ============================================================ */
        .lp-light-card {
          background: #ffffff;
          width: 100%;
          max-width: 420px;
          border-radius: 18px;
          box-shadow:
            0 0 0 1px rgba(37,99,235,0.08),
            0 4px 6px -1px rgba(37,99,235,0.06),
            0 20px 50px -10px rgba(37,99,235,0.15);
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .lp-light-stripe {
          height: 4px;
          background: linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #0ea5e9 100%);
        }

        .lp-light-body {
          padding: 2.2rem 2rem 2rem;
        }

        .lp-light-logo {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-light-logo h1 {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 5px;
          letter-spacing: -0.02em;
        }
        .lp-light-logo p {
          font-size: 13px;
          color: #64748b;
        }

        .lp-light-eye {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          transition: color 0.2s;
          line-height: 1;
        }
        .lp-light-eye:hover { color: #2563eb; }

        .lp-light-submit {
          width: 100%;
          margin-top: 8px;
          padding: 0.78em;
          font-size: 0.95rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 10px;
        }

        /* ============================================================
           DARK MODE — background
        ============================================================ */
        .lp-dark {
          background: #030b18;
          background-image:
            radial-gradient(ellipse at 15% 50%, rgba(10,30,80,0.75)  0%, transparent 55%),
            radial-gradient(ellipse at 85% 20%, rgba(15,23,90,0.65)  0%, transparent 50%),
            radial-gradient(ellipse at 50% 85%, rgba(7,20,60,0.55)   0%, transparent 45%);
        }

        /* ============================================================
           DARK MODE — animated orbs
        ============================================================ */
        @keyframes lpOrb1 {
          0%,100% { transform: translate(0px,   0px)   scale(1);    }
          33%     { transform: translate(80px, -110px) scale(1.15); }
          66%     { transform: translate(-60px, 60px)  scale(0.9);  }
        }
        @keyframes lpOrb2 {
          0%,100% { transform: translate(0px,   0px)   scale(1);    }
          40%     { transform: translate(-90px, 75px)  scale(1.1);  }
          75%     { transform: translate(65px, -85px)  scale(1.05); }
        }
        @keyframes lpOrb3 {
          0%,100% { transform: translate(0px,  0px)   scale(1);    }
          50%     { transform: translate(55px, 95px)  scale(1.12); }
        }
        @keyframes lpOrb4 {
          0%,100% { transform: translate(0px,   0px)   scale(1);   }
          30%     { transform: translate(-45px, -65px) scale(0.92);}
          65%     { transform: translate(75px,  35px)  scale(1.08);}
        }

        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
          will-change: transform;
        }
        .lp-orb-1 {
          width: 520px; height: 520px;
          background: radial-gradient(circle at 40% 40%,
            rgba(29,78,216,0.55), rgba(30,64,175,0.12));
          top: -160px; left: -160px;
          animation: lpOrb1 20s ease-in-out infinite;
        }
        .lp-orb-2 {
          width: 460px; height: 460px;
          background: radial-gradient(circle at 55% 35%,
            rgba(37,99,235,0.45), rgba(79,70,229,0.15));
          top: 5%; right: -130px;
          animation: lpOrb2 24s ease-in-out infinite;
        }
        .lp-orb-3 {
          width: 400px; height: 400px;
          background: radial-gradient(circle at 50% 60%,
            rgba(7,89,133,0.5), rgba(12,74,110,0.12));
          bottom: -90px; left: 18%;
          animation: lpOrb3 17s ease-in-out infinite;
        }
        .lp-orb-4 {
          width: 320px; height: 320px;
          background: radial-gradient(circle at 50% 50%,
            rgba(67,56,202,0.35), rgba(99,102,241,0.1));
          bottom: 12%; right: 4%;
          animation: lpOrb4 28s ease-in-out infinite;
        }

        /* ============================================================
           DARK MODE — card shell
        ============================================================ */
        .lp-dark-card {
          background: rgba(8,13,25,0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          width: 100%;
          max-width: 430px;
          border: 1px solid rgba(59,130,246,0.22);
          box-shadow:
            0 0 0 1px rgba(59,130,246,0.07),
            0 0 40px rgba(37,99,235,0.14),
            0 0 80px rgba(37,99,235,0.06),
            inset 0 0 20px rgba(0,0,0,0.4);
          overflow: hidden;
          border-radius: 14px;
          position: relative;
          z-index: 1;
          font-family: "Fira Code", Consolas, "Courier New", monospace;
        }

        /* terminal header bar */
        .lp-dark-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0,0,0,0.28);
          padding: 0.6em 1em;
          border-bottom: 1px solid rgba(59,130,246,0.18);
        }
        .lp-dark-title {
          color: #60a5fa;
          font-size: 0.73rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lp-dark-dots span {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #1e3a5f;
          margin-left: 5px;
        }

        /* card body */
        .lp-dark-body { padding: 1.8rem; }

        .lp-dark-logo { text-align: center; margin-bottom: 22px; }
        .lp-dark-logo h1 {
          font-size: 20px; font-weight: 800;
          color: #e2e8f0; letter-spacing: 0.03em; margin-bottom: 4px;
        }
        .lp-dark-logo p { font-size: 12px; color: #64748b; }

        /* ============================================================
           DARK MODE — underline inputs with floating labels
        ============================================================ */
        .lp-dark-field { position: relative; margin-bottom: 1.7rem; }

        .lp-dark-input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 2px solid rgba(59,130,246,0.28);
          padding: 0.75em 2.2rem 0.75em 0;
          font-size: 1rem;
          color: #e2e8f0;
          font-family: inherit;
          outline: none;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }
        .lp-dark-input:focus { border-color: #3b82f6; }
        .lp-dark-input::placeholder { color: transparent; }
        .lp-dark-input:disabled { opacity: 0.55; cursor: not-allowed; }

        .lp-dark-label {
          position: absolute;
          top: 0.75em; left: 0;
          font-size: 0.9rem;
          color: #3b82f6;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          pointer-events: none;
          transition: top 0.28s ease, font-size 0.28s ease, opacity 0.28s ease;
          font-family: inherit;
        }
        .lp-dark-input:focus + .lp-dark-label,
        .lp-dark-input:not(:placeholder-shown) + .lp-dark-label {
          top: -1.25em; font-size: 0.71rem; opacity: 1;
        }

        /* glitch effect when label lifts */
        .lp-dark-input:focus + .lp-dark-label::before,
        .lp-dark-input:focus + .lp-dark-label::after {
          content: attr(data-text);
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(8,13,25,0.88);
        }
        .lp-dark-input:focus + .lp-dark-label::before {
          color: #818cf8;
          animation: lpGlitch 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both;
        }
        .lp-dark-input:focus + .lp-dark-label::after {
          color: #3b82f6;
          animation: lpGlitch 0.5s cubic-bezier(0.25,0.46,0.45,0.94) reverse both;
        }

        @keyframes lpGlitch {
          0%   { transform: translate(0);         clip-path: inset(0 0 0 0);   }
          20%  { transform: translate(-4px, 3px); clip-path: inset(50% 0 20% 0); }
          40%  { transform: translate(3px, -2px); clip-path: inset(20% 0 60% 0); }
          60%  { transform: translate(-3px, 2px); clip-path: inset(80% 0 5%  0); }
          80%  { transform: translate(3px, -2px); clip-path: inset(30% 0 45% 0); }
          100% { transform: translate(0);         clip-path: inset(0 0 0 0);   }
        }

        /* eye toggle */
        .lp-dark-eye {
          position: absolute; right: 0; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #475569;
          min-height: 40px; min-width: 36px;
          display: inline-flex; align-items: center; justify-content: center;
          transition: color 0.2s;
        }
        .lp-dark-eye:hover { color: #3b82f6; }

        /* ============================================================
           DARK MODE — submit button
        ============================================================ */
        .lp-dark-submit {
          width: 100%; padding: 0.9em; margin-top: 1rem;
          background: transparent;
          border: 2px solid #3b82f6;
          color: #3b82f6;
          font-family: inherit; font-size: 0.95rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em;
          cursor: pointer; position: relative; overflow: hidden;
          border-radius: 10px; min-height: 48px;
          transition: background 0.28s, color 0.28s, box-shadow 0.28s;
        }
        .lp-dark-submit:hover,
        .lp-dark-submit:focus {
          background: #3b82f6;
          color: #030b18;
          box-shadow: 0 0 28px rgba(59,130,246,0.55);
          outline: none;
        }
        .lp-dark-submit:active  { transform: scale(0.984); }
        .lp-dark-submit:disabled { opacity: 0.62; cursor: not-allowed; }

        .lp-dark-btn-text {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; transition: opacity 0.2s;
        }
        .lp-dark-submit:hover .lp-dark-btn-text,
        .lp-dark-submit:focus .lp-dark-btn-text { opacity: 0; }

        .lp-dark-submit::before,
        .lp-dark-submit::after {
          content: attr(data-text);
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; background: #3b82f6; transition: opacity 0.2s;
        }
        .lp-dark-submit:hover::before,
        .lp-dark-submit:focus::before {
          opacity: 1; color: #818cf8;
          animation: lpGlitch 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both;
        }
        .lp-dark-submit:hover::after,
        .lp-dark-submit:focus::after {
          opacity: 1; color: #030b18;
          animation: lpGlitch 0.5s cubic-bezier(0.25,0.46,0.45,0.94) reverse both;
        }

        /* ============================================================
           RESPONSIVE
        ============================================================ */
        @media (max-width: 520px) {
          .lp-dark-body  { padding: 1.4rem 1.2rem; }
          .lp-light-body { padding: 1.8rem 1.3rem 1.5rem; }
          .lp-dark-title { font-size: 0.64rem; }
          .lp-dark-logo h1  { font-size: 17px; }
          .lp-light-logo h1 { font-size: 18px; }
          .lp-orb-1 { width: 280px; height: 280px; }
          .lp-orb-2 { width: 260px; height: 260px; }
          .lp-orb-3 { width: 230px; height: 230px; }
          .lp-orb-4 { width: 180px; height: 180px; }
        }

        /* ============================================================
           REDUCED MOTION
        ============================================================ */
        @media (prefers-reduced-motion: reduce) {
          .lp-orb { animation: none !important; }
          .lp-dark-input:focus + .lp-dark-label::before,
          .lp-dark-input:focus + .lp-dark-label::after,
          .lp-dark-submit:hover::before,
          .lp-dark-submit:focus::before,
          .lp-dark-submit:hover::after,
          .lp-dark-submit:focus::after {
            animation: none;
            opacity: 0;
          }
          .lp-dark-submit:hover .lp-dark-btn-text,
          .lp-dark-submit:focus .lp-dark-btn-text { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
