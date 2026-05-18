'use client';

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  FaBars,
  FaBell,
  FaCode,
  FaFileAlt,
  FaHome,
  FaPlus,
  FaPoll,
  FaQrcode,
  FaSearch,
  FaUserShield,
  FaUserTag,
} from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import SidebarItem from './SidebarItem';
import UserMenu from './UserMenu';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

type MenuGroup = {
  title: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.ReactNode;
  }>;
};

const basePanel = 'rounded-[18px] border border-[var(--clay-border)] bg-white';

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const search = event.target.value.trim();
    setSearchParams(search ? { search } : {});
  };

  const roleNames = Array.isArray(currentUser?.vaiTro)
    ? currentUser.vaiTro.map((role) => role.tenVaiTro).join(', ')
    : currentUser?.vaiTro?.tenVaiTro ?? '';

  const isAdmin = roleNames.includes('Quan Tri Vien') || roleNames.includes('Quản Trị Viên');

  const menuGroups = useMemo<MenuGroup[]>(
    () => [
      {
        title: 'Điều hướng',
        items: [
          { to: '/app', label: 'Bảng điều khiển', icon: <FaHome /> },
          { to: '/app/tao-phien-bau-cu', label: 'Tạo ballot', icon: <FaPlus /> },
          { to: '/app/user-elections', label: 'Danh sách ballot', icon: <FaPoll /> },
          { to: '/app/upcoming-elections', label: 'Thông báo', icon: <FaBell /> },
        ],
      },
      {
        title: 'Công cụ',
        items: [
          { to: '/app/quan-ly-file', label: 'Quản lý file', icon: <FaFileAlt /> },
          { to: '/app/quet-ma-qr', label: 'Quét mã QR', icon: <FaQrcode /> },
        ],
      },
    ],
    [],
  );

  const adminGroup = useMemo<MenuGroup | null>(
    () =>
      isAdmin
        ? {
            title: 'Quản trị',
            items: [
              { to: '/app/role-management', label: 'Quản lý vai trò', icon: <FaUserShield /> },
              { to: '/app/role-assignment', label: 'Phân quyền', icon: <FaUserTag /> },
              { to: '/app/quan-ly-smart-contract', label: 'Smart Contract', icon: <FaCode /> },
            ],
          }
        : null,
    [isAdmin],
  );

  const closeMobileMenu = () => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const renderBrand = (collapsed: boolean) =>
    collapsed ? (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
        <Layers className="h-5 w-5" aria-hidden="true" />
      </div>
    ) : (
      <NavLink to="/app" className="flex min-w-0 items-center gap-3" onClick={closeMobileMenu}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Layers className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-tight tracking-[-0.015em] text-black">
            HoLiHu
          </p>
          <p className="mt-0.5 text-xs leading-tight text-[var(--clay-muted)]">BlockVote · Trung tâm</p>
        </div>
      </NavLink>
    );

  const renderMenu = (collapsed: boolean) => (
    <div className="flex h-full flex-col gap-3">
      <div
        className={`${basePanel} ${collapsed ? 'px-2 py-3' : 'px-4 py-4'} flex items-center ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {renderBrand(collapsed)}

        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="clay-button clay-button--ghost inline-flex h-11 w-11 items-center justify-center"
            aria-label="Thu gọn thanh bên"
          >
            <FaBars className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className={`${basePanel} px-4 py-4`}>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
            Tìm nhanh
          </label>
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--clay-muted)]" />
            <input
              type="search"
              name="search"
              autoComplete="off"
              defaultValue={searchParams.get('search') ?? ''}
              onChange={handleSearch}
              placeholder="Tìm ballot, cử tri, phiên…"
              className="clay-input min-h-11 py-2 pl-11 pr-4 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {menuGroups.map((group) => (
          <section key={group.title} className={`${basePanel} ${collapsed ? 'px-2 py-3' : 'px-3 py-3.5'}`}>
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isCollapsed={collapsed}
                  onClick={closeMobileMenu}
                />
              ))}
            </ul>
          </section>
        ))}

        {adminGroup && (
          <section className={`${basePanel} ${collapsed ? 'px-2 py-3' : 'px-3 py-3.5'}`}>
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                Quản trị
              </p>
            )}
            <ul className="space-y-1">
              {adminGroup.items.map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  isCollapsed={collapsed}
                  onClick={closeMobileMenu}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className={`${basePanel} px-3 py-3.5`}>
        <UserMenu isCollapsed={collapsed} inMobileMenu={isMobile && !collapsed} />

        {collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="clay-button mt-3 inline-flex h-11 w-full items-center justify-center"
            aria-label="Mở rộng thanh bên"
          >
            <FaBars className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 bg-black px-4 py-2 text-white md:hidden">
        <div className="flex h-11 items-center justify-between gap-3">
          <NavLink to="/app" className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.01em]">HoLiHu BlockVote</p>
              <p className="text-[11px] text-white/70">Trung tâm di động</p>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            <FaBars className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full w-[86vw] max-w-[340px] border-r border-[var(--clay-border)] bg-[var(--clay-bg)] p-4"
              onClick={(event) => event.stopPropagation()}
            >
              {renderMenu(false)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.aside
        className="fixed left-0 top-0 z-40 hidden h-screen overflow-y-auto border-r border-[var(--clay-border)] bg-[var(--clay-bg)] p-4 md:block"
        initial={false}
        animate={{ width: isSidebarOpen ? 296 : 104 }}
        transition={{ duration: 0.24, ease: 'easeInOut' }}
      >
        {renderMenu(!isSidebarOpen)}
      </motion.aside>
    </>
  );
};

export default Sidebar;
