import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import UserAvatar from './UserAvatar';

/**
 * Account dropdown (avatar + name + role + menu). Used in the desktop top bar
 * and the mobile header. `variant` picks light/dark trigger styling.
 */
export default function UserMenu({ variant = 'light' }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className={`dropdown cis-usermenu cis-usermenu--${variant}`} ref={menuRef}>
      <button
        className="cis-usermenu-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <UserAvatar
          name={user?.memberName}
          photoUrl={user?.photoUrl}
          className="cis-header-avatar"
          size={36}
        />
        <span className="cis-usermenu-meta d-none d-sm-flex">
          <span className="cis-usermenu-name">{user?.memberName}</span>
          {user?.accessType ? (
            <small className="cis-usermenu-role">{user.accessType}</small>
          ) : null}
        </span>
        <i className="fa fa-angle-down cis-usermenu-caret" aria-hidden="true" />
      </button>
      <ul className={`dropdown-menu dropdown-menu-end cis-usermenu-panel${menuOpen ? ' show' : ''}`} role="menu">
        <li className="px-3 py-2">
          <div className="d-flex align-items-center gap-2">
            <UserAvatar
              name={user?.memberName}
              photoUrl={user?.photoUrl}
              size={42}
            />
            <div className="min-w-0">
              <div className="cis-usermenu-name text-truncate">{user?.memberName}</div>
              <small className="cis-usermenu-role">{user?.accessType}</small>
            </div>
          </div>
        </li>
        <li><hr className="dropdown-divider" /></li>
        <li>
          <Link className="dropdown-item" to="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </Link>
        </li>
        <li><hr className="dropdown-divider" /></li>
        <li>
          <button type="button" className="dropdown-item" onClick={logout}>
            Log Out
          </button>
        </li>
      </ul>
    </div>
  );
}
