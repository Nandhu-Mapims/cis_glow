import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { validateCharNum } from '../utils/validation';
import ThemeControlMenu from '../components/ThemeControlMenu';

const LOGIN_FEATURES = [
  { icon: 'fa fa-calendar-check-o', title: 'Today’s register' },
  { icon: 'fa fa-stethoscope', title: 'Academics & clinicals' },
  { icon: 'fa fa-shield', title: 'Scoped access only' },
];

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/api/settings/public')
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null));
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.user?.resetPasswordRequired) {
        setError('Password reset required. OTP flow will be migrated in a later phase.');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Wrong! Username or Password.');
    } finally {
      setLoading(false);
    }
  };

  const logoUrl = settings?.institutionLogoUrl || '/legacy/img/global_images/logo.png';
  const institutionName = settings?.institutionShortName || 'APDCH';
  const pageTitle = settings?.adminTitle || `${institutionName} Central Login`;

  // Server sends a fixed legacy-parity string here; rewrite it into a full sentence for display.
  const displayError = error === 'Wrong! Username or Password.'
    ? 'Incorrect Member ID or password. Check your details and try again.'
    : error;

  return (
    <div className="login-page">
      <div className="login-theme-slot">
        <ThemeControlMenu />
      </div>

      <main className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-brand">
            <img className="login-card-logo" src={logoUrl} alt="" />
            <div>
              <p className="login-card-eyebrow">Campus Information System</p>
              <p className="login-card-name">{institutionName}</p>
            </div>
          </div>

          <div className="login-card-head">
            <h1>Sign in</h1>
            <p>{pageTitle}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-field-label" htmlFor="login-username">Username</label>
              <div className="login-field-control">
                <i className="fa fa-user" aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  maxLength={20}
                  autoComplete="username"
                  autoFocus
                  placeholder="Member ID"
                  onChange={(e) => setUsername(validateCharNum(e.target.value))}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-field-label" htmlFor="login-password">Password</label>
              <div className="login-field-control">
                <i className="fa fa-lock" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  maxLength={50}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {displayError && (
            <div className="login-error" role="alert">
              {displayError}
            </div>
          )}

          <ul className="login-register-strip">
            {LOGIN_FEATURES.map((feature) => (
              <li key={feature.title}>
                <i className={feature.icon} aria-hidden="true" />
                <span>{feature.title}</span>
              </li>
            ))}
          </ul>

          <p className="login-footer-note">
            Authorized users only. Contact your administrator for access.
          </p>
        </div>
      </main>
    </div>
  );
}
