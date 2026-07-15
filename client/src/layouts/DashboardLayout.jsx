import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import TopNav from './TopNav';

const ShellLayoutContext = createContext(0);

function MainScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector('.cis-main');
    if (main) main.scrollTop = 0;
  }, [pathname]);

  return null;
}

export default function DashboardLayout({
  settings,
  dashboard,
  menu,
  children,
}) {
  const shellDepth = useContext(ShellLayoutContext);
  const [navOpen, setNavOpen] = useState(false);

  if (shellDepth > 0) {
    return children;
  }

  return (
    <ShellLayoutContext.Provider value={shellDepth + 1}>
      <div className="cis-app cis-app-topnav">
        <MainScrollReset />
        <div className="cis-body">
          <div className="cis-main-column">
            <main className="cis-main">
              <div className="cis-content-shell">
                <div className="cis-content-canvas">
                  <div className="cis-chrome-sticky">
                    <TopNav
                      settings={settings}
                      menu={menu}
                      lastLoginAt={dashboard?.lastLoginAt}
                      mobileOpen={navOpen}
                      onMobileClose={() => setNavOpen(false)}
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
    </ShellLayoutContext.Provider>
  );
}
