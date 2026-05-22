import type React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import { Footer } from './components/Footer';
import { ThemeProvider } from './context/ThemeContext';
import { RouteFallback } from './components/RouteFallback';

const AppBeforeLogin: React.FC = () => {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-[var(--clay-bg)] text-[var(--clay-text)]">
        <a href="#main-content" className="skip-link">
          Bỏ qua điều hướng
        </a>
        <Header />
        <main id="main-content" className="flex-grow">
          {/* Đợt 13.2: Suspense ngay trên Outlet — bắt suspend lazy route. */}
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
};

export default AppBeforeLogin;
