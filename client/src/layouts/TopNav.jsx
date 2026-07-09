import { Link } from 'react-router-dom';
import { buildMenuHref, resolveMenuLabel } from '../utils/legacyRoutes';

function NavItemLink({ link, className, children, title }) {
  const modern = buildMenuHref(link);
  if (modern) {
    return <Link to={modern} className={className}>{children}</Link>;
  }
  return (
    <a href={`#legacy-${link}`} className={className} title={title || 'Legacy module — migration pending'}>
      {children}
    </a>
  );
}

export default function TopNav({ menu = [], className = '' }) {
  return (
    <nav className={`navbar navbar-expand-lg cis-topnav ${className}`.trim()}>
      <div className="container-fluid">
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#cisNavbar"
          aria-controls="cisNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="cisNavbar">
          <ul className="navbar-nav flex-wrap">
            {menu.map((category) => (
              <li
                key={category.id}
                className={`nav-item ${category.type === 'dropdown' ? 'dropdown' : ''}`}
              >
                {category.type === 'dropdown' ? (
                  <>
                    <button
                      className="nav-link dropdown-toggle text-center cis-nav-item"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                      type="button"
                    >
                      <i className={`${category.icon} cis-nav-icon`} />
                      <span className="cis-nav-title">{category.name}</span>
                    </button>
                    <ul className="dropdown-menu">
                      {category.mainMenus.flatMap((main) => main.subMenus.map((sub) => (
                        <li key={sub.id}>
                          <span className="dropdown-item-text text-muted small">{main.name}</span>
                          <NavItemLink link={sub.link} className="dropdown-item">
                            {resolveMenuLabel(sub.link, sub.name || main.name)}
                          </NavItemLink>
                        </li>
                      )))}
                    </ul>
                  </>
                ) : (
                  <NavItemLink link={category.link} className="nav-link text-center cis-nav-item">
                    <i className={`${category.icon} cis-nav-icon`} />
                    <span className="cis-nav-title">{category.name}</span>
                  </NavItemLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
