import type React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import { Footer } from './components/Footer';
import { ThemeProvider } from './context/ThemeContext';

const AppBeforeLogin: React.FC = () => {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          Bỏ qua điều hướng
        </a>
        <Header />
        <main id="main-content" className="flex-grow">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
};

export default AppBeforeLogin;
