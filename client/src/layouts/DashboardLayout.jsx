import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import TopNav from './TopNav';
import Sidebar from './Sidebar';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (shellDepth > 0) {
    return children;
  }

  return (
    <ShellLayoutContext.Provider value={shellDepth + 1}>
      <div className="cis-app">
        <MainScrollReset />
        <div className="cis-body d-flex">
          <Sidebar
            settings={settings}
            menu={menu}
            mobileOpen={sidebarOpen}
            onMobileClose={() => setSidebarOpen(false)}
          />
          <div className="cis-main-column flex-grow-1 min-vw-0">
            <main className="cis-main">
              <div className="cis-content-shell">
                <div className="cis-content-canvas">
                  <Header
                    settings={settings}
                    lastLoginAt={dashboard?.lastLoginAt}
                    onMenuToggle={() => setSidebarOpen((open) => !open)}
                  />
                  <div className="cis-content-body">
                    <TopNav menu={menu} className="d-lg-none" />
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
