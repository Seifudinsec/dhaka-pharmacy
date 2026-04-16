import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { faEye, faEyeSlash, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/common/AppIcon';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/'); }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) {
      setError('Please enter both username and password.');
      return;
    }
    const result = await login(form.username, form.password);
    if (!result.success) setError(result.message || 'Login failed.');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/dhaka-pharmacy-logo.png" alt="Dhaka Pharmacy logo" style={{ width: '100%', maxWidth: 360, margin: '0 auto 10px', display: 'block', borderRadius: 8 }} />
          <h1>DHAKA PHARMACY</h1>
          <p>Inventory &amp; Billing System</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label htmlFor="login-username" className="form-label">Username <span className="required">*</span></label>
            <input
              id="login-username"
              className="form-control"
              type="text"
              autoComplete="username"
              placeholder="Enter username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-control"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ paddingRight: 42 }}
                required
              />
              <button
                type="button"
                aria-label={showPass ? "Hide password" : "Show password"}
                onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gray-500)', minHeight: 44, padding: '0 8px' }}
              ><AppIcon icon={showPass ? faEyeSlash : faEye} tone="muted" /></button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Signing in...</> : <><AppIcon icon={faRightToBracket} /> Sign In</>}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--gray-400)' }}>
          Default: admin / admin123
        </p>
      </div>
    </div>
  );
}
