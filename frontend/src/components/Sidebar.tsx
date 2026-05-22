'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  Bell,
  FolderClosed,
  Home,
  Layers,
  ListChecks,
  Menu,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import UserMenu from './UserMenu';

interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

type NavItem = { to: string; label: string; icon: React.ReactNode; end?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Đợt 10 (spec 010) FR-002/FR-013 — drawer a11y: Esc đóng + focus-trap + khôi phục tiêu điểm.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const getFocusable = () => {
      const node = drawerRef.current;
      if (!node) return [] as HTMLElement[];
      return Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    };
    const focusTimer = window.setTimeout(() => getFocusable()[0]?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        const f = getFocusable();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      prevActive?.focus?.();
    };
  }, [isMobileMenuOpen]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const search = event.target.value.trim();
    setSearchParams(search ? { search } : {});
  };

  const roleNames = Array.isArray(currentUser?.vaiTro)
    ? currentUser.vaiTro.map((role) => role.tenVaiTro).join(', ')
    : currentUser?.vaiTro?.tenVaiTro ?? '';
  const isAdmin = roleNames.includes('Quan Tri Vien') || roleNames.includes('Quản Trị Viên');

  const groups = useMemo<NavGroup[]>(() => {
    // Đợt 10 (spec 010) — IA gọn theo data-model §1; thuật ngữ thống nhất "bầu cử"
    // đồng bộ routeMeta.ts. KHÔNG xoá route; mục non-active gom nhóm "Khác".
    const base: NavGroup[] = [
      {
        title: 'Bầu cử',
        items: [
          { to: '/app/dashboard', label: 'Bảng điều khiển', icon: <Home className="h-[18px] w-[18px]" /> },
          { to: '/app/elections/new', label: 'Tạo bầu cử', icon: <Plus className="h-[18px] w-[18px]" /> },
          { to: '/app/elections', label: 'Danh sách bầu cử', icon: <ListChecks className="h-[18px] w-[18px]" /> },
        ],
      },
      {
        title: 'Cử tri',
        items: [
          { to: '/app/verify-voter', label: 'Xác minh cử tri', icon: <UserCheck className="h-[18px] w-[18px]" /> },
          { to: '/app/scan', label: 'Quét mã QR', icon: <QrCode className="h-[18px] w-[18px]" /> },
        ],
      },
      {
        title: 'Khác',
        items: [
          { to: '/app/notifications', label: 'Thông báo', icon: <Bell className="h-[18px] w-[18px]" /> },
          { to: '/app/files', label: 'Quản lý file', icon: <FolderClosed className="h-[18px] w-[18px]" /> },
        ],
      },
    ];
    if (isAdmin) {
      base.push({
        title: 'Quản trị',
        items: [
          { to: '/app/admin/roles', label: 'Quản lý vai trò', icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
          { to: '/app/admin/permissions', label: 'Phân quyền', icon: <UserCog className="h-[18px] w-[18px]" /> },
        ],
      });
    }
    return base;
  }, [isAdmin]);

  const closeMobileMenu = () => isMobile && setIsMobileMenuOpen(false);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors',
      isActive
        ? 'bg-[var(--clay-primary-light)] font-semibold text-[var(--clay-primary)]'
        : 'text-[var(--clay-muted)] hover:bg-[var(--clay-surface-soft)] hover:text-[var(--clay-text)]',
    ].join(' ');

  const SidebarBody = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--clay-text)] text-white">
          <Layers className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--clay-text)]">
            HoLiHu
          </p>
          <p className="text-xs leading-tight text-[var(--clay-muted)]">BlockVote</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]" />
          <input
            type="search"
            name="search"
            autoComplete="off"
            aria-label="Tìm ballot, cử tri"
            defaultValue={searchParams.get('search') ?? ''}
            onChange={handleSearch}
            placeholder="Tìm ballot, cử tri..."
            className="w-full rounded-[10px] border border-[var(--clay-border)] bg-[var(--clay-surface)] py-2 pl-9 pr-3 text-sm text-[var(--clay-text)] placeholder:text-[var(--clay-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--clay-primary-focus)]"
          />
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--clay-muted-soft)]">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={`${group.title}-${item.to}-${item.label}`}>
                  <NavLink to={item.to} end={item.end} onClick={closeMobileMenu} className={navItemClass}>
                    <span className="shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-[var(--clay-border)] p-3">
        <div className="rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface)] px-2 py-1.5">
          <UserMenu isCollapsed={false} inMobileMenu={isMobile} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[var(--clay-border)] bg-[var(--clay-surface)] px-4 md:hidden">
        <NavLink to="/app/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--clay-text)] text-white">
            <Layers className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-[var(--clay-text)]">HoLiHu</span>
        </NavLink>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--clay-border)] text-[var(--clay-text)]"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.aside
              ref={drawerRef}
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Điều hướng chính"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full w-[84vw] max-w-[300px] bg-[var(--clay-surface)]"
              onClick={(event) => event.stopPropagation()}
            >
              {SidebarBody}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop fixed rail */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[var(--sidebar-w)] border-r border-[var(--clay-border)] bg-[var(--clay-surface)] md:block">
        {SidebarBody}
      </aside>

      {/* keep prop referenced (collapse retained for API compatibility) */}
      <span hidden aria-hidden="true" data-sidebar-open={isSidebarOpen} onClick={toggleSidebar} />
    </>
  );
};

export default Sidebar;
