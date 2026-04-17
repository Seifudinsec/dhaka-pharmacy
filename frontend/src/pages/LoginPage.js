import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  faEye,
  faEyeSlash,
  faRightToBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/common/AppIcon";

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
    <div className="login-page cyber-login-page">
      <div className="glitch-form-wrapper">
        <div className="glitch-card">
          <div className="card-header">
            <div className="card-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={24}
                height={24}
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
            <div className="card-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="card-body">
            <div className="login-logo">
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

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} autoComplete="on">
              <div className="form-group glitch-field">
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="glitch-input"
                />
                <label
                  htmlFor="login-username"
                  className="form-label glitch-label"
                  data-text="USERNAME"
                >
                  USERNAME
                </label>
              </div>

              <div className="form-group glitch-field">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                  placeholder=" "
                  className="glitch-input"
                />
                <label
                  htmlFor="login-password"
                  className="form-label glitch-label"
                  data-text="ACCESS_KEY"
                >
                  ACCESS_KEY
                </label>

                <button
                  type="button"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  onClick={() => setShowPass((s) => !s)}
                  className="password-toggle-btn"
                >
                  <AppIcon icon={showPass ? faEyeSlash : faEye} />
                </button>
              </div>

              <button
                type="submit"
                className="submit-btn"
                data-text="INITIATE_CONNECTION"
                disabled={loading}
              >
                <span className="btn-text">
                  {loading ? (
                    <>
                      <span className="spinner spinner-sm" /> SIGNING IN...
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
      </div>

      <style>{`
        .cyber-login-page .glitch-form-wrapper {
          --bg-color: #0d0d0d;
          --primary-color: #00f2ea;
          --secondary-color: #a855f7;
          --text-color: #e5e5e5;
          --font-family: "Fira Code", Consolas, "Courier New", Courier, monospace;
          --glitch-anim-duration: 0.5s;
          min-height: 100vh;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: var(--font-family);
          padding: 20px;
          background-color: #050505;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(0, 242, 234, 0.08), transparent 30%),
            radial-gradient(circle at 80% 10%, rgba(168, 85, 247, 0.08), transparent 30%),
            linear-gradient(180deg, #070707 0%, #040404 100%);
        }

        .cyber-login-page .glitch-card {
          background-color: var(--bg-color);
          width: 100%;
          max-width: 430px;
          border: 1px solid rgba(0, 242, 234, 0.2);
          box-shadow:
            0 0 20px rgba(0, 242, 234, 0.1),
            inset 0 0 10px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          margin: 1rem;
          border-radius: 12px;
        }

        .cyber-login-page .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.3);
          padding: 0.65em 1em;
          border-bottom: 1px solid rgba(0, 242, 234, 0.2);
        }

        .cyber-login-page .card-title {
          color: var(--primary-color);
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 0.5em;
        }

        .cyber-login-page .card-title svg {
          width: 1.2em;
          height: 1.2em;
          stroke: var(--primary-color);
          flex-shrink: 0;
        }

        .cyber-login-page .card-dots span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #333;
          margin-left: 5px;
        }

        .cyber-login-page .card-body {
          padding: 1.7rem;
        }

        .cyber-login-page .login-logo {
          text-align: center;
          margin-bottom: 22px;
        }

        .cyber-login-page .login-logo h1 {
          font-size: 21px;
          font-weight: 800;
          color: #f6f9ff;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
        }

        .cyber-login-page .login-logo p {
          font-size: 12px;
          color: #93a4b8;
        }

        .cyber-login-page .glitch-field {
          position: relative;
          margin-bottom: 1.5rem;
        }

        .cyber-login-page .glitch-label {
          position: absolute;
          top: 0.75em;
          left: 0;
          font-size: 0.95rem;
          color: var(--primary-color);
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          pointer-events: none;
          transition: all 0.3s ease;
        }

        .cyber-login-page .glitch-input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 2px solid rgba(0, 242, 234, 0.3);
          padding: 0.75em 0;
          font-size: 1rem;
          color: var(--text-color);
          font-family: inherit;
          outline: none;
          transition: border-color 0.3s ease;
        }

        .cyber-login-page .glitch-input:focus {
          border-color: var(--primary-color);
        }

        .cyber-login-page .glitch-input:focus + .glitch-label,
        .cyber-login-page .glitch-input:not(:placeholder-shown) + .glitch-label {
          top: -1.2em;
          font-size: 0.75rem;
          opacity: 1;
        }

        .cyber-login-page .glitch-input:focus + .glitch-label::before,
        .cyber-login-page .glitch-input:focus + .glitch-label::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: var(--bg-color);
        }

        .cyber-login-page .glitch-input:focus + .glitch-label::before {
          color: var(--secondary-color);
          animation: glitch-anim var(--glitch-anim-duration)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        .cyber-login-page .glitch-input:focus + .glitch-label::after {
          color: var(--primary-color);
          animation: glitch-anim var(--glitch-anim-duration)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
        }

        .cyber-login-page .password-toggle-btn {
          position: absolute;
          right: 8px;
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
        }

        .cyber-login-page .password-toggle-btn:hover {
          color: var(--primary-color);
        }

        .cyber-login-page .submit-btn {
          width: 100%;
          padding: 0.9em;
          margin-top: 1rem;
          background-color: transparent;
          border: 2px solid var(--primary-color);
          color: var(--primary-color);
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          cursor: pointer;
          position: relative;
          transition: all 0.3s;
          overflow: hidden;
          border-radius: 10px;
          min-height: 48px;
        }

        .cyber-login-page .submit-btn:hover,
        .cyber-login-page .submit-btn:focus {
          background-color: var(--primary-color);
          color: var(--bg-color);
          box-shadow: 0 0 25px var(--primary-color);
          outline: none;
        }

        .cyber-login-page .submit-btn:active {
          transform: scale(0.985);
        }

        .cyber-login-page .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .cyber-login-page .submit-btn .btn-text {
          position: relative;
          z-index: 1;
          transition: opacity 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .cyber-login-page .submit-btn:hover .btn-text {
          opacity: 0;
        }

        .cyber-login-page .submit-btn::before,
        .cyber-login-page .submit-btn::after {
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
          background-color: var(--primary-color);
          transition: opacity 0.2s ease;
        }

        .cyber-login-page .submit-btn:hover::before,
        .cyber-login-page .submit-btn:focus::before {
          opacity: 1;
          color: var(--secondary-color);
          animation: glitch-anim var(--glitch-anim-duration)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        .cyber-login-page .submit-btn:hover::after,
        .cyber-login-page .submit-btn:focus::after {
          opacity: 1;
          color: var(--bg-color);
          animation: glitch-anim var(--glitch-anim-duration)
            cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both;
        }

        @keyframes glitch-anim {
          0% {
            transform: translate(0);
            clip-path: inset(0 0 0 0);
          }
          20% {
            transform: translate(-5px, 3px);
            clip-path: inset(50% 0 20% 0);
          }
          40% {
            transform: translate(3px, -2px);
            clip-path: inset(20% 0 60% 0);
          }
          60% {
            transform: translate(-4px, 2px);
            clip-path: inset(80% 0 5% 0);
          }
          80% {
            transform: translate(4px, -3px);
            clip-path: inset(30% 0 45% 0);
          }
          100% {
            transform: translate(0);
            clip-path: inset(0 0 0 0);
          }
        }

        @media (max-width: 520px) {
          .cyber-login-page .card-body {
            padding: 1.2rem;
          }
          .cyber-login-page .card-title {
            font-size: 0.68rem;
          }
          .cyber-login-page .login-logo h1 {
            font-size: 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cyber-login-page .glitch-input:focus + .glitch-label::before,
          .cyber-login-page .glitch-input:focus + .glitch-label::after,
          .cyber-login-page .submit-btn:hover::before,
          .cyber-login-page .submit-btn:focus::before,
          .cyber-login-page .submit-btn:hover::after,
          .cyber-login-page .submit-btn:focus::after {
            animation: none;
            opacity: 0;
          }

          .cyber-login-page .submit-btn:hover .btn-text {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
