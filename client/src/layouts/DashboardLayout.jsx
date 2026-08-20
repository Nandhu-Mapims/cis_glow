import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CommandPalette from '../components/CommandPalette';
import { CommandPaletteProvider } from '../components/CommandPaletteContext';
import Header from './Header';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const ShellLayoutContext = createContext(0);
const SIDEBAR_COLLAPSED_KEY = 'cis_sidebar_collapsed';

function MainScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector('.cis-main');
    if (main) main.scrollTop = 0;
  }, [pathname]);

  return null;
}

/** `--cis-header-height` drives every sticky-under-header offset (form
 * section nav, scroll-margin-top on jumped-to sections, toasts). The header
 * is two stacked bars whose height varies with content/breakpoint, so it's
 * measured live instead of hardcoded — a stale value silently reappears as
 * "sticky panel / scrolled-to section hidden under the header" bugs. */
function useChromeHeightVar(chromeRef) {
  useEffect(() => {
    const el = chromeRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const setVar = () => {
      document.documentElement.style.setProperty('--cis-header-height', `${el.offsetHeight}px`);
    };
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chromeRef]);
}

export default function DashboardLayout({
  settings,
  dashboard,
  menu,
  children,
}) {
  const shellDepth = useContext(ShellLayoutContext);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  );
  const chromeRef = useRef(null);
  useChromeHeightVar(chromeRef);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  if (shellDepth > 0) {
    return children;
  }

  return (
    <ShellLayoutContext.Provider value={shellDepth + 1}>
      <CommandPaletteProvider>
        <CommandPalette menu={menu} />
        <div className="cis-app cis-app-sidebar">
          <MainScrollReset />
          <Sidebar
            settings={settings}
            menu={menu}
            lastLoginAt={dashboard?.lastLoginAt}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((value) => !value)}
            mobileOpen={navOpen}
            onMobileClose={() => setNavOpen(false)}
          />
          <div className="cis-body">
            <div className="cis-main-column">
              <main className="cis-main">
                <div className="cis-content-shell">
                  <div className="cis-content-canvas">
                    <div className="cis-chrome-sticky" ref={chromeRef}>
                      <TopNav
                        menu={menu}
                        lastLoginAt={dashboard?.lastLoginAt}
                      />
                      <Header
                        settings={settings}
                        onMenuToggle={() => setNavOpen((open) => !open)}
                      />
                    </div>
                    <div className="cis-content-body">
                      {children}
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </CommandPaletteProvider>
    </ShellLayoutContext.Provider>
  );
}
