'use client';

import type React from 'react';
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './components/Sidebar';
import { useSidebar } from './utils/useSidebar';
import type { RootState } from './store/store';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { resolveRouteMeta } from './routes/routeMeta';
import { Breadcrumb } from './components/ui/clay/Breadcrumb';
import { RouteFallback } from './components/RouteFallback';

const AppAfterLogin: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const routeMeta = resolveRouteMeta(location.pathname);
  const accessToken = useSelector((state: RootState) => state.dangNhapTaiKhoan.accessToken);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [accessToken, location.pathname]);

  useEffect(() => {
    document.title = `${routeMeta.title} | HoLiHu BlockVote`;
  }, [routeMeta.title]);

  return (
    <ThemeProvider>
      <Toaster position="top-right" />
      <div className="apple-page flex min-h-screen text-black">
        <a href="#main-content" className="skip-link">
          Bỏ qua điều hướng
        </a>
        <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        <main
          id="main-content"
          className="mt-[60px] min-w-0 flex-1 md:ml-[var(--sidebar-w)] md:mt-0 md:w-[calc(100%_-_var(--sidebar-w))] md:flex-none"
        >
          <div className="min-h-screen bg-[var(--clay-bg)] p-4 sm:p-5 lg:p-5">
            {routeMeta.breadcrumb.length > 1 && (
              <div className="mb-4">
                <Breadcrumb trail={routeMeta.breadcrumb} />
              </div>
            )}
            {/* Đợt 13.2: Suspense ngay trên Outlet — bắt suspend lazy route. */}
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
};

export default AppAfterLogin;
