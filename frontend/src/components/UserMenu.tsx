'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  History,
  Wallet,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';
import { logoutThat } from '../store/slice/dangXuatTaiKhoanSlice';
import { store } from '../store/store';
import { useSepoliaWalletSummary } from '../hooks/useSepoliaWalletSummary';

interface UserMenuProps {
  isCollapsed?: boolean;
  inMobileMenu?: boolean;
}

function shortenAddress(value?: string | null) {
  if (!value) {
    return 'n/a';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

const UserMenu: React.FC<UserMenuProps> = ({ isCollapsed = false, inMobileMenu = false }) => {
  const { taiKhoan: user } = useSelector((state: RootState) => state.dangNhapTaiKhoan);
  const { balance, error, isLoading, publicConfig, refresh } = useSepoliaWalletSummary(
    user?.diaChiVi ?? null,
  );
  const navigate = useNavigate();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (isAccountMenuOpen && buttonRef.current && !isMobile) {
      const rect = buttonRef.current.getBoundingClientRect();

      if (isCollapsed) {
        setMenuPosition({
          top: rect.top,
          left: rect.right + 8,
        });
        return;
      }

      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isAccountMenuOpen, isCollapsed, isMobile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  const displayName = user?.tenHienThi || user?.diaChiVi || user?.email || 'Khách';
  const userRole = Array.isArray(user?.vaiTro)
    ? user?.vaiTro.map((vaiTro) => vaiTro.tenVaiTro).join(', ')
    : user?.vaiTro?.tenVaiTro || 'Cử tri';
  const explorerUrl = user?.diaChiVi && publicConfig?.explorerBaseUrl
    ? `${publicConfig.explorerBaseUrl}/address/${user.diaChiVi}`
    : null;

  const formatName = (name: string) =>
    name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const toggleAccountMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAccountMenuOpen((current) => !current);
  };

  const confirmLogout = async () => {
    try {
      setShowLogoutConfirm(false);
      setIsAccountMenuOpen(false);
      await store.dispatch(logoutThat());
      toast.success('Đăng xuất thành công');
      navigate('/');
    } catch {
      toast.error('Có lỗi xảy ra khi đăng xuất');
    }
  };

  const refreshBalance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.diaChiVi) {
      return;
    }

    setIsRefreshing(true);
    try {
      refresh();
      toast.success('Đã cập nhật ví Sepolia');
    } catch {
      toast.error('Không thể cập nhật ví Sepolia');
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép địa chỉ ví');
    } catch {
      toast.error('Không thể sao chép địa chỉ ví');
    }
  };

  const mobileMenuClasses = inMobileMenu
    ? 'w-full bg-transparent hover:bg-transparent focus:bg-transparent border-0'
    : '';

  return (
    <div className={`relative user-menu-container ${inMobileMenu ? 'w-full' : ''}`} ref={menuRef}>
      {isCollapsed ? (
        <button
          ref={buttonRef}
          onClick={toggleAccountMenu}
          className="flex w-full items-center justify-center p-2"
          aria-expanded={isAccountMenuOpen}
          aria-haspopup="true"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-orange-500">
            {user?.anhDaiDien ? (
              <img
                src={user.anhDaiDien || '/placeholder.svg?height=48&width=48'}
                alt={displayName}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
        </button>
      ) : (
        <button
          ref={buttonRef}
          onClick={toggleAccountMenu}
          className={`flex w-full items-center space-x-2 rounded-lg border border-[#334155]/50 bg-[#1E293B]/50 px-4 py-2 backdrop-blur-sm transition hover:bg-[#1E293B]/80 ${mobileMenuClasses}`}
          aria-expanded={isAccountMenuOpen}
          aria-haspopup="true"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-orange-500">
            {user?.anhDaiDien ? (
              <img
                src={user.anhDaiDien || '/placeholder.svg?height=40&width=40'}
                alt={displayName}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-white">{formatName(displayName)}</p>
            <p className="truncate text-xs text-blue-300">{userRole}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-blue-300 transition-transform duration-200 ${
              isAccountMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      <AnimatePresence>
        {isAccountMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`${inMobileMenu ? 'w-full' : isMobile ? 'absolute right-0 z-[100]' : 'fixed z-[100] w-72'}`}
            style={{
              transformOrigin: isMobile ? 'top right' : isCollapsed ? 'left center' : 'top left',
              ...(isMobile
                ? { top: '100%', right: '0', marginTop: '0.5rem' }
                : { top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-xl border border-[#334155]/70 bg-[#1E293B]/90 shadow-lg backdrop-blur-md">
              <div className="border-b border-[#334155]/70 p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-orange-500">
                    {user?.anhDaiDien ? (
                      <img
                        src={user.anhDaiDien || '/placeholder.svg?height=40&width=40'}
                        alt={displayName}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-white">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{formatName(displayName)}</p>
                    <p className="truncate text-xs text-blue-300">{userRole}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {user?.diaChiVi && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyToClipboard(user.diaChiVi!);
                      }}
                      className="group flex items-center rounded-full border border-[#334155]/50 bg-[#0D1321]/50 px-2 py-1 transition hover:border-blue-500/50 hover:bg-[#0D1321]/70"
                      title="Nhấn để sao chép địa chỉ ví"
                    >
                      <FaEthereum className="mr-1 h-3 w-3 text-orange-400" />
                      <span className="text-xs text-blue-200 group-hover:text-blue-300">
                        {shortenAddress(user.diaChiVi)}
                      </span>
                    </button>
                  )}

                  <div className="flex items-center rounded-full border border-[#334155]/50 bg-[#0D1321]/50 px-2 py-1">
                    <Shield className="mr-1 h-3 w-3 text-green-400" />
                    <span className="text-xs text-blue-200">Sepolia active</span>
                  </div>
                </div>

                {user?.diaChiVi && (
                  <div className="mt-3 rounded-lg border border-[#334155]/70 bg-[#0D1321]/70 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Wallet className="mr-2 h-4 w-4 text-blue-400" />
                        <div>
                          <span className="text-xs text-blue-300">Số dư Sepolia ETH</span>
                          <p className="text-sm font-medium text-white">
                            {isLoading ? (
                              <span className="inline-block h-4 w-12 animate-pulse rounded bg-[#334155]/50" />
                            ) : (
                              `${balance ?? '0.00'} ETH`
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={refreshBalance}
                        disabled={isRefreshing || isLoading}
                        className="rounded-md bg-[#334155]/50 p-1.5 transition hover:bg-[#334155] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 text-blue-300 ${isRefreshing || isLoading ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>

                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200"
                      >
                        Explorer
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
                  </div>
                )}
              </div>

              <div className="py-1">
                <NavLink
                  to="/app/account-info"
                  className="flex items-center px-4 py-2.5 text-sm text-blue-100 transition hover:bg-blue-600/20"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <User className="mr-3 h-4 w-4 text-blue-400" />
                  Thông tin tài khoản
                </NavLink>

                <NavLink
                  to="/app/quan-ly-smart-contract"
                  className="flex items-center px-4 py-2.5 text-sm text-blue-100 transition hover:bg-blue-600/20"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <Wallet className="mr-3 h-4 w-4 text-blue-400" />
                  Console Sepolia
                </NavLink>

                <NavLink
                  to="/app/upcoming-elections"
                  className="flex items-center px-4 py-2.5 text-sm text-blue-100 transition hover:bg-blue-600/20"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <History className="mr-3 h-4 w-4 text-blue-400" />
                  Lịch sử hoạt động
                </NavLink>

                <NavLink
                  to="/app/settings"
                  className="flex items-center px-4 py-2.5 text-sm text-blue-100 transition hover:bg-blue-600/20"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <Settings className="mr-3 h-4 w-4 text-blue-400" />
                  Cài đặt
                </NavLink>

                <div className="my-1 border-t border-[#334155]/70" />

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="flex w-full items-center px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-600/20"
                >
                  <LogOut className="mr-3 h-4 w-4 text-red-400" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-[#334155] bg-[#1E293B] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-xl font-semibold text-white">Xác nhận đăng xuất</h3>
              <p className="mb-6 text-blue-200/80">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?</p>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-lg bg-[#334155] px-4 py-2 text-white transition hover:bg-[#475569]"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmLogout}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
                >
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserMenu;
