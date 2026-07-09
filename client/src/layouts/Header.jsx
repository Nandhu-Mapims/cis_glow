import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemeControlMenu from '../components/ThemeControlMenu';

export default function Header({ settings, lastLoginAt, onMenuToggle }) {
  const { user, logout } = useAuth();
  const titleParts = (settings?.institutionShortName || 'CIS').split(' ');

  return (
    <header className="cis-header">
      <div className="cis-header-inner d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2 min-w-0">
          <button
            type="button"
            className="btn btn-link cis-menu-toggle d-lg-none"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
          >
            <span className="cis-menu-toggle-bar" />
            <span className="cis-menu-toggle-bar" />
            <span className="cis-menu-toggle-bar" />
          </button>

          <div className="cis-header-context min-w-0">
            <div className="cis-header-context-title d-lg-none">
              {titleParts.map((part, index) => (
                <span key={part} className={index % 2 === 1 ? 'cis-logo-accent' : ''}>
                  {part}
                  {' '}
                </span>
              ))}
            </div>
            <div className="d-none d-lg-flex align-items-center gap-2 flex-wrap">
              <span className="cis-header-context-label">Campus Information System</span>
              {user?.accessType && (
                <span className="cis-header-badge">{user.accessType}</span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 gap-md-3 flex-shrink-0">
          {lastLoginAt && (
            <span className="cis-header-last-login d-none d-xl-inline">
              Last login
              {' '}
              {new Date(lastLoginAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          <Link to="/dashboard" className="cis-header-link d-none d-md-inline">
            Dashboard
          </Link>

          <ThemeControlMenu />

          <div className="dropdown">
            <button
              className="btn btn-link text-decoration-none dropdown-toggle d-flex align-items-center gap-2 cis-header-user-btn"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <img
                src={user?.photoUrl || '/legacy/img/profile-avatar.jpg'}
                alt="Profile"
                className="cis-header-avatar"
                onError={(e) => { e.currentTarget.src = '/legacy/img/profile-avatar.jpg'; }}
              />
              <span className="cis-header-user d-none d-sm-inline">{user?.memberName}</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li className="px-3 py-2 d-sm-none">
                <div className="cis-header-user">{user?.memberName}</div>
                <small className="cis-header-user-role">{user?.accessType}</small>
              </li>
              <li className="d-sm-none"><hr className="dropdown-divider" /></li>
              <li><Link className="dropdown-item" to="/dashboard">Dashboard</Link></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button type="button" className="dropdown-item" onClick={logout}>Log Out</button></li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
