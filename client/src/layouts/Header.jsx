import ThemeControlMenu from '../components/ThemeControlMenu';
import UserMenu from '../components/UserMenu';

/**
 * Mobile-only top bar (hamburger + brand + theme + account). On desktop the
 * top navigation bar owns the brand, theme, and account menu, so this whole
 * strip is hidden (d-lg-none) to avoid a redundant second header row.
 */
export default function Header({ settings, onMenuToggle }) {
  const titleParts = (settings?.institutionShortName || 'CIS').split(' ');

  return (
    <header className="cis-header d-lg-none">
      <div className="cis-header-inner d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2 min-w-0">
          <button
            type="button"
            className="btn btn-link cis-menu-toggle"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
          >
            <span className="cis-menu-toggle-bar" />
            <span className="cis-menu-toggle-bar" />
            <span className="cis-menu-toggle-bar" />
          </button>

          <div className="cis-header-context-title">
            {titleParts.map((part, index) => (
              <span key={part} className={index % 2 === 1 ? 'cis-logo-accent' : ''}>
                {part}
                {' '}
              </span>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <ThemeControlMenu />
          <UserMenu variant="light" />
        </div>
      </div>
    </header>
  );
}
