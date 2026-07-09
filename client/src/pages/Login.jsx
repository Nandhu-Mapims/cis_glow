import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { validateCharNum } from '../utils/validation';
import ThemeControlMenu from '../components/ThemeControlMenu';

const LOGIN_FEATURES = [
  {
    icon: 'fa fa-dashboard',
    title: 'Live dashboards',
    desc: 'Attendance, strength, and faculty widgets',
  },
  {
    icon: 'fa fa-graduation-cap',
    title: 'Campus operations',
    desc: 'Students, staff, fees, exams, and more',
  },
  {
    icon: 'fa fa-shield',
    title: 'Secure access',
    desc: 'Role-based sign-in for your institution',
  },
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

  return (
    <div className="login-page">
      <div className="login-theme-slot">
        <ThemeControlMenu />
      </div>
      <div className="login-shell">
        <aside className="login-showcase" aria-hidden="false">
          <div className="login-showcase-brand">
            <div className="login-showcase-logo">
              <img src={logoUrl} alt="" />
            </div>
            <div>
              <h1 className="login-showcase-name">{institutionName}</h1>
              <p className="login-showcase-tagline">Campus Information System</p>
            </div>
          </div>

          <div className="login-showcase-copy">
            <h2 className="login-showcase-headline">Well begun is half done</h2>
            <p className="login-showcase-desc">
              Sign in to manage attendance, academics, payroll, and every module
              in one modern campus workspace.
            </p>
          </div>

          <div className="login-showcase-features">
            {LOGIN_FEATURES.map((feature) => (
              <div key={feature.title} className="login-feature-card">
                <span className="login-feature-icon" aria-hidden="true">
                  <i className={feature.icon} />
                </span>
                <div className="login-feature-text">
                  <strong>{feature.title}</strong>
                  <span>{feature.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="login-main">
          <div className="login-form-wrap">
            <div className="login-mobile-brand d-lg-none">
              <div className="login-showcase-logo">
                <img src={logoUrl} alt="" />
              </div>
              <div>
                <div className="login-showcase-name">{institutionName}</div>
                <p className="login-showcase-tagline">Campus Information System</p>
              </div>
            </div>

            <div className="login-form-header">
              <h2 className="login-form-title">Sign in</h2>
              <p className="login-form-subtitle">{pageTitle}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label className="form-label" htmlFor="login-username">Username</label>
                <div className="login-input-wrap">
                  <i className="fa fa-user login-input-icon" aria-hidden="true" />
                  <input
                    id="login-username"
                    type="text"
                    className="form-control"
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
                <label className="form-label" htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <i className="fa fa-lock login-input-icon" aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    className="form-control"
                    value={password}
                    maxLength={50}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {error && (
              <div className="login-error" role="alert">
                {error.replace(/^Wrong!\s*/i, '')}
              </div>
            )}

            <p className="login-footer-note">
              Authorized users only. Contact your administrator for access.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
