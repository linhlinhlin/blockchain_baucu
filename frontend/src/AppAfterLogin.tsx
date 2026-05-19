'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './components/Sidebar';
import { useSidebar } from './utils/useSidebar';
import type { RootState } from './store/store';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';

const AppAfterLogin: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
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
          className="flex-1 mt-[60px] md:mt-0 md:ml-[var(--sidebar-w)]"
        >
          <div className="min-h-screen bg-[var(--clay-bg)] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
};

export default AppAfterLogin;
