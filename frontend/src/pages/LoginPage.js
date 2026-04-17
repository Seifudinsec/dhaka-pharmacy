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
    <div className="lp-page">
      <FullScreenLoader visible={loading} text="Signing you in..." />

      <div className="glitch-form-wrapper">
        <div className="glitch-card">
          {/* ── Terminal header bar ── */}
          <div className="glitch-card-header">
            <div className="glitch-card-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={20}
                height={20}
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
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
              <span>DHAKA_PHARMACY_SECURE</span>
            </div>
            <div className="glitch-card-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          {/* ── Card body ── */}
          <div className="glitch-card-body">
            {/* Logo + branding */}
            <div className="glitch-logo">
              <img
                src="/dhaka-pharmacy-logo.png"
                alt="Dhaka Pharmacy logo"
                style={{
                  width: "100%",
                  maxWidth: 280,
                  margin: "0 auto 10px",
                  display: "block",
                  borderRadius: 8,
                }}
              />
              <h1>DHAKA PHARMACY</h1>
              <p>Inventory &amp; Billing System</p>
            </div>

            {/* Error alert */}
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on">
              {/* Username */}
              <div className="glitch-field">
                <input
                  id="gf-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="glitch-input"
                  disabled={loading}
                />
                <label
                  htmlFor="gf-username"
                  className="glitch-label"
                  data-text="USERNAME"
                >
                  USERNAME
                </label>
              </div>

              {/* Password */}
              <div className="glitch-field">
                <input
                  id="gf-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="glitch-input"
                  style={{ paddingRight: "2.4rem" }}
                  disabled={loading}
                />
                <label
                  htmlFor="gf-password"
                  className="glitch-label"
                  data-text="ACCESS_KEY"
                >
                  ACCESS_KEY
                </label>
                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="glitch-eye-btn"
                >
                  <AppIcon icon={showPass ? faEyeSlash : faEye} />
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="glitch-submit-btn"
                data-text="INITIATE_CONNECTION"
                disabled={loading}
              >
                <span className="glitch-btn-text">
                  {loading ? (
                    <>
                      <span className="spinner spinner-sm" aria-hidden="true" />
                      SIGNING IN...
                    </>
                  ) : (
                    <>
                      <AppIcon icon={faRightToBracket} />
                      SIGN_IN
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`

        /* ============================================================
           PAGE SHELL
           Background is the ONLY thing that changes between themes.
           Everything else is identical in light and dark mode.
        ============================================================ */

        .lp-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          box-sizing: border-box;
          background: #e8e8e8;
          transition: background 0.3s ease;
        }

        [data-theme='dark'] .lp-page {
          background: #212121;
        }

        /* ============================================================
           GLITCH FORM WRAPPER — CSS variables
        ============================================================ */

        .glitch-form-wrapper {
          --gf-bg:        #0d0d0d;
          --gf-primary:   #00f2ea;
          --gf-secondary: #a855f7;
          --gf-text:      #e5e5e5;
          --gf-font:      "Fira Code", Consolas, "Courier New", Courier, monospace;
          --gf-dur:       0.5s;

          display: flex;
          justify-content: center;
          align-items: center;
          font-family: var(--gf-font);
          width: 100%;
        }

        /* ============================================================
           CARD SHELL
        ============================================================ */

        .glitch-card {
          background-color: var(--gf-bg);
          width: 100%;
          max-width: 430px;
          border: 1px solid rgba(0, 242, 234, 0.2);
          box-shadow:
            0 0 20px rgba(0, 242, 234, 0.1),
            inset 0 0 10px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          margin: 0;
          border-radius: 12px;
        }

        /* ── Terminal header ── */
        .glitch-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.3);
          padding: 0.65em 1em;
          border-bottom: 1px solid rgba(0, 242, 234, 0.2);
        }

        .glitch-card-title {
          color: var(--gf-primary);
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 0.5em;
        }

        .glitch-card-title svg {
          width: 1.2em;
          height: 1.2em;
          stroke: var(--gf-primary);
          flex-shrink: 0;
        }

        .glitch-card-dots span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #333;
          margin-left: 5px;
        }

        /* ── Card body ── */
        .glitch-card-body {
          padding: 1.7rem;
        }

        /* ============================================================
           LOGO / BRANDING
        ============================================================ */

        .glitch-logo {
          text-align: center;
          margin-bottom: 22px;
        }

        .glitch-logo h1 {
          font-size: 21px;
          font-weight: 800;
          color: #f6f9ff;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
          font-family: var(--gf-font);
        }

        .glitch-logo p {
          font-size: 12px;
          color: #93a4b8;
          font-family: var(--gf-font);
        }

        /* ============================================================
           FORM FIELDS — floating label + underline
        ============================================================ */

        .glitch-field {
          position: relative;
          margin-bottom: 1.5rem;
        }

        .glitch-label {
          position: absolute;
          top: 0.75em;
          left: 0;
          font-size: 0.95rem;
          color: var(--gf-primary);
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          pointer-events: none;
          transition: all 0.3s ease;
          font-family: var(--gf-font);
        }

        .glitch-input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 2px solid rgba(0, 242, 234, 0.3);
          padding: 0.75em 0;
          font-size: 1rem;
          color: var(--gf-text);
          font-family: var(--gf-font);
          outline: none;
          transition: border-color 0.3s ease;
          box-sizing: border-box;
        }

        .glitch-input:focus {
          border-color: var(--gf-primary);
        }

        .glitch-input:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* Label floats up when field is active or filled */
        .glitch-input:focus       + .glitch-label,
        .glitch-input:not(:placeholder-shown) + .glitch-label {
          top: -1.2em;
          font-size: 0.75rem;
          opacity: 1;
        }

        /* Glitch pseudo-elements on focused label */
        .glitch-input:focus + .glitch-label::before,
        .glitch-input:focus + .glitch-label::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: var(--gf-bg);
        }

        .glitch-input:focus + .glitch-label::before {
          color: var(--gf-secondary);
          animation: gf-glitch var(--gf-dur)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        .glitch-input:focus + .glitch-label::after {
          color: var(--gf-primary);
          animation: gf-glitch var(--gf-dur)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
        }

        @keyframes gf-glitch {
          0%   { transform: translate(0);          clip-path: inset(0 0 0 0);    }
          20%  { transform: translate(-5px,  3px); clip-path: inset(50% 0 20% 0); }
          40%  { transform: translate( 3px, -2px); clip-path: inset(20% 0 60% 0); }
          60%  { transform: translate(-4px,  2px); clip-path: inset(80% 0  5% 0); }
          80%  { transform: translate( 4px, -3px); clip-path: inset(30% 0 45% 0); }
          100% { transform: translate(0);          clip-path: inset(0 0 0 0);    }
        }

        /* ── Password eye toggle ── */
        .glitch-eye-btn {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #89a2b8;
          min-height: 40px;
          min-width: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .glitch-eye-btn:hover {
          color: var(--gf-primary);
        }

        /* ============================================================
           SUBMIT BUTTON
        ============================================================ */

        .glitch-submit-btn {
          width: 100%;
          padding: 0.9em;
          margin-top: 1rem;
          background-color: transparent;
          border: 2px solid var(--gf-primary);
          color: var(--gf-primary);
          font-family: var(--gf-font);
          font-size: 0.95rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          cursor: pointer;
          position: relative;
          transition: background-color 0.3s, color 0.3s, box-shadow 0.3s;
          overflow: hidden;
          border-radius: 10px;
          min-height: 48px;
        }

        .glitch-submit-btn:hover,
        .glitch-submit-btn:focus {
          background-color: var(--gf-primary);
          color: var(--gf-bg);
          box-shadow: 0 0 25px var(--gf-primary);
          outline: none;
        }

        .glitch-submit-btn:active {
          transform: scale(0.985);
        }

        .glitch-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* Button text layer */
        .glitch-btn-text {
          position: relative;
          z-index: 1;
          transition: opacity 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .glitch-submit-btn:hover  .glitch-btn-text,
        .glitch-submit-btn:focus  .glitch-btn-text {
          opacity: 0;
        }

        /* Glitch layers on hover */
        .glitch-submit-btn::before,
        .glitch-submit-btn::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          background-color: var(--gf-primary);
          transition: opacity 0.2s ease;
        }

        .glitch-submit-btn:hover::before,
        .glitch-submit-btn:focus::before {
          opacity: 1;
          color: var(--gf-secondary);
          animation: gf-glitch var(--gf-dur)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        .glitch-submit-btn:hover::after,
        .glitch-submit-btn:focus::after {
          opacity: 1;
          color: var(--gf-bg);
          animation: gf-glitch var(--gf-dur)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
        }

        /* ============================================================
           RESPONSIVE
        ============================================================ */

        @media (max-width: 520px) {
          .glitch-card-body {
            padding: 1.2rem;
          }
          .glitch-card-title {
            font-size: 0.68rem;
          }
          .glitch-logo h1 {
            font-size: 18px;
          }
        }

        /* ============================================================
           REDUCED MOTION
        ============================================================ */

        @media (prefers-reduced-motion: reduce) {
          .glitch-input:focus + .glitch-label::before,
          .glitch-input:focus + .glitch-label::after,
          .glitch-submit-btn:hover::before,
          .glitch-submit-btn:focus::before,
          .glitch-submit-btn:hover::after,
          .glitch-submit-btn:focus::after {
            animation: none;
            opacity: 0;
          }
          .glitch-submit-btn:hover  .glitch-btn-text,
          .glitch-submit-btn:focus  .glitch-btn-text {
            opacity: 1;
          }
        }

      `}</style>
    </div>
  );
}
