import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  faArrowRight,
  faEye,
  faEyeSlash,
  faLock,
  faRightToBracket,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import AppIcon from "../components/common/AppIcon";
import FullScreenLoader from "../components/common/FullScreenLoader";

const demoAccounts = [
  { label: "Administrator", username: "demo-admin", password: "DemoAdmin2026!" },
  {
    label: "Pharmacist",
    username: "demo-pharmacist",
    password: "DemoPharmacy2026!",
  },
];

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError("Please enter both username and password.");
      return;
    }
    const result = await login(form.username, form.password);
    if (!result.success) setError(result.message || "Login failed.");
  };

  return (
    <main className="login-experience">
      <FullScreenLoader visible={loading} text="Signing you in..." />

      <section className="login-visual" aria-label="Dhaka Pharmacy">
        <img
          className="login-visual-image"
          src="/loginimage.webp"
          alt="Medicine tablets in blister packs"
          fetchPriority="high"
        />
        <div className="login-visual-shade" />
        <div className="login-visual-content">
          <a className="login-brand" href="/" aria-label="Dhaka Pharmacy home">
            <img src="/dhaka-pharmacy-logo.jpg" alt="" />
            <span>
              <strong>Dhaka Pharmacy</strong>
              <small>Care, managed with clarity</small>
            </span>
          </a>
          <div className="login-story">
            <span className="login-story-kicker">
              <span className="login-story-dot" />
              EVERYDAY CARE, MADE SIMPLER
            </span>
            <h1>Better visibility.<br />Better pharmacy care.</h1>
            <p>
              A thoughtful workspace for the people who keep a pharmacy moving:
              inventory, billing, and the details in between.
            </p>
          </div>
          <div className="login-visual-footer">
            <span>Inventory</span>
            <span>Billing</span>
            <span>Reporting</span>
            <span className="login-visual-caption">Built for pharmacy teams</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <img src="/dhaka-pharmacy-logo.jpg" alt="" />
            <span>Dhaka Pharmacy</span>
          </div>

          <header className="login-heading">
            <span className="login-heading-kicker">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Enter your account details to continue.</p>
          </header>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value }))
                }
                required
                disabled={loading}
                placeholder="Your username"
              />
            </div>

            <div className="login-field">
              <div className="login-field-label-row">
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                  disabled={loading}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  aria-pressed={showPass}
                  onClick={() => setShowPass((shown) => !shown)}
                  disabled={loading}
                >
                  <AppIcon icon={showPass ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              <span>
                <AppIcon icon={loading ? faLock : faRightToBracket} />
                {loading ? "Signing in..." : "Sign in"}
              </span>
              {!loading && <AppIcon icon={faArrowRight} className="login-submit-arrow" />}
            </button>
          </form>

          <div className="login-secure-note">
            <AppIcon icon={faShieldHalved} />
            <span>Your session is protected with secure sign-in.</span>
          </div>

          <section className="login-demo" aria-labelledby="login-demo-title">
            <div className="login-demo-heading">
              <div>
                <span className="login-heading-kicker">TAKE A LOOK AROUND</span>
                <h3 id="login-demo-title">Explore the demo</h3>
              </div>
              <span className="login-demo-badge">Portfolio</span>
            </div>
            <p>Choose a role to fill in its public demo credentials.</p>
            <div className="login-demo-options">
              {demoAccounts.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className="login-demo-option"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setForm({
                      username: account.username,
                      password: account.password,
                    });
                  }}
                >
                  <span className="login-demo-role">{account.label}</span>
                  <span className="login-demo-username">{account.username}</span>
                  <span className="login-demo-password">{account.password}</span>
                  <span className="login-demo-action">
                    Use account <AppIcon icon={faArrowRight} />
                  </span>
                </button>
              ))}
            </div>
            <small>Shared demo accounts are intended for isolated demo environments.</small>
          </section>

          <footer className="login-footer">
            <span>Dhaka Pharmacy</span>
            <span>Inventory &amp; billing workspace</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
