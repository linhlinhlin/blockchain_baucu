'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from './store/store';
import { NavLink, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SEO from './components/SEO';
import { toast } from 'react-hot-toast';
import { logoutThat } from './store/slice/dangXuatTaiKhoanSlice';
import HexagonBackground from './components/ui/hexagon-background';
import BlockchainNodes from './components/ui/blockchain-nodes';
import {
  Layers,
  Vote,
  User,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Clock,
  Shield,
  CheckCircle2,
  Wallet,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';
import { useSepoliaWalletSummary } from './hooks/useSepoliaWalletSummary';
import { store } from './store/store';

function shortenAddress(value?: string | null) {
  if (!value) {
    return 'n/a';
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function Main() {
  const navigate = useNavigate();
  const { taiKhoan: user, accessToken } = useSelector((state: RootState) => state.dangNhapTaiKhoan);
  const { balance, error, isLoading, publicConfig, refresh } = useSepoliaWalletSummary(
    user?.diaChiVi ?? null,
  );
  const [greeting, setGreeting] = useState('Chào mừng');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Chào buổi sáng');
    } else if (hour >= 12 && hour < 18) {
      setGreeting('Chào buổi chiều');
    } else {
      setGreeting('Chào buổi tối');
    }
  }, [currentTime]);

  if (!user || !accessToken) {
    return <Navigate to="/" />;
  }

  const displayName = user.tenHienThi || user.tenDangNhap || 'Người dùng';
  const userRole = Array.isArray(user?.vaiTro)
    ? user?.vaiTro.map((vaiTro) => vaiTro.tenVaiTro).join(', ')
    : user?.vaiTro?.tenVaiTro || 'Cử tri';

  const refreshBalance = async () => {
    if (!user?.diaChiVi) {
      return;
    }

    setIsRefreshing(true);
    try {
      refresh();
      toast.success('Đã cập nhật thông tin ví Sepolia');
    } catch {
      toast.error('Không thể cập nhật thông tin ví Sepolia');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await store.dispatch(logoutThat());
      toast.success('Đăng xuất thành công');
      navigate('/');
    } catch {
      toast.error('Có lỗi xảy ra khi đăng xuất');
    }
  };

  const chainLabel = publicConfig?.chainId === 11155111 ? 'Ethereum Sepolia' : 'EVM Network';
  const explorerUrl = user?.diaChiVi && publicConfig?.explorerBaseUrl
    ? `${publicConfig.explorerBaseUrl}/address/${user.diaChiVi}`
    : null;

  return (
    <>
      <SEO
        title={`${greeting} | Nền Tảng Bầu Cử Blockchain`}
        description="Trang chính của nền tảng bầu cử blockchain. Bắt đầu tham gia vào quá trình bầu cử an toàn và minh bạch."
        keywords="bầu cử, blockchain, trang chính, an toàn, minh bạch"
        author="Nền Tảng Bầu Cử Blockchain"
        url={window.location.href}
        image={`${window.location.origin}/logo.png`}
      />

      <div className="min-h-screen bg-gradient-to-br from-[#0A0F18] via-[#121A29] to-[#0D1321] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <HexagonBackground density={10} opacity={0.05} />
          <BlockchainNodes nodeCount={10} />
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-blue-500 opacity-10 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-orange-500 opacity-10 blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          <header className="mb-8 flex flex-col items-center justify-between gap-4 md:mb-12 md:flex-row">
            <div className="flex items-center">
              <div className="mr-4 rounded-xl bg-gradient-to-r from-blue-600 to-orange-500 p-3">
                <Layers className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-blue-300 to-orange-300 bg-clip-text text-2xl font-bold text-transparent">
                  BlockVote HoLiHu
                </h1>
                <p className="text-sm text-blue-200/70">ElectionV1 active path trên Sepolia</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-[#334155]/50 bg-[#1E293B]/50 px-4 py-2 backdrop-blur-sm">
                <Clock className="mr-2 inline h-5 w-5 text-blue-400" />
                <span className="text-blue-100">
                  {currentTime.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/dashboard')}
                className="rounded-lg border border-blue-500/30 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-500/10"
              >
                Mở Console Sepolia
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 transition hover:bg-red-500/20"
                aria-label="Đăng xuất"
              >
                <LogOut className="h-5 w-5 text-red-400" />
              </button>
            </div>
          </header>

          <main className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-2xl border border-[#334155]/50 bg-[#1E293B]/30 p-8 backdrop-blur-md"
              >
                <div className="mb-8 flex flex-col items-center md:flex-row md:items-start">
                  <div className="mb-4 flex-shrink-0 md:mb-0 md:mr-6">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-orange-500 opacity-70 blur-md" />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#1E293B] bg-gradient-to-br from-blue-500 to-orange-600">
                        {user.anhDaiDien ? (
                          <img
                            src={user.anhDaiDien || '/placeholder.svg'}
                            alt={displayName}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl font-bold text-white">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-2 text-3xl font-bold text-white md:text-4xl">
                      {greeting},{' '}
                      <span className="bg-gradient-to-r from-blue-400 to-orange-300 bg-clip-text text-transparent">
                        {displayName}
                      </span>
                    </h2>
                    <p className="mb-4 text-blue-200/80">
                      Dashboard này đã được chuyển khỏi stack HLU/geth cũ và dùng dữ liệu on-chain từ ElectionV1 trên Sepolia.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      {user.diaChiVi && (
                        <div className="flex items-center rounded-full border border-[#334155]/50 bg-[#1E293B]/50 px-3 py-1.5">
                          <FaEthereum className="mr-2 h-4 w-4 text-orange-400" />
                          <span className="text-xs text-blue-200">{shortenAddress(user.diaChiVi)}</span>
                        </div>
                      )}
                      <div className="flex items-center rounded-full border border-[#334155]/50 bg-[#1E293B]/50 px-3 py-1.5">
                        <Shield className="mr-2 h-4 w-4 text-green-400" />
                        <span className="text-xs text-blue-200">{userRole}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {user.diaChiVi && (
                  <div className="mb-8 rounded-xl border border-[#334155]/50 bg-[#1E293B]/50 p-5 backdrop-blur-sm">
                    <div className="mb-4 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                      <div className="flex items-center">
                        <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600">
                          <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Thông tin ví</h3>
                          <p className="text-sm text-blue-200/70">{chainLabel}</p>
                        </div>
                      </div>

                      <button
                        onClick={refreshBalance}
                        disabled={isRefreshing || isLoading}
                        className="flex items-center space-x-2 rounded-lg border border-[#334155]/50 bg-[#1E293B]/70 px-3 py-1.5 transition hover:bg-[#1E293B] disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 text-blue-400 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
                        <span className="text-sm text-blue-200">Làm mới</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-[#334155]/50 bg-[#0D1321]/50 p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm text-blue-300">Địa chỉ ví</span>
                          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                            Sepolia
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FaEthereum className="mr-2 h-5 w-5 text-orange-400" />
                          <p className="break-all font-mono text-sm text-white">{user.diaChiVi}</p>
                        </div>
                        {explorerUrl && (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-xs text-blue-300 hover:text-blue-200"
                          >
                            Xem trên explorer
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="rounded-lg border border-[#334155]/50 bg-[#0D1321]/50 p-4">
                        <span className="mb-2 block text-sm text-blue-300">Số dư Sepolia ETH</span>
                        <div className="flex items-center">
                          <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-orange-500">
                            <span className="text-xs font-bold text-white">SEP</span>
                          </div>
                          <div>
                            <p className="text-xl font-semibold text-white">
                              {isLoading ? (
                                <span className="inline-block h-6 w-16 animate-pulse rounded bg-[#334155]/50" />
                              ) : (
                                balance ?? '0.00'
                              )}
                              <span className="ml-1 text-sm text-blue-300">ETH</span>
                            </p>
                            <p className="text-xs text-slate-400">Dùng để commit, reveal và finalize ElectionV1</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-3 flex items-center rounded-lg border border-red-800/30 bg-red-900/20 p-3">
                        <AlertTriangle className="mr-2 h-5 w-5 text-red-400" />
                        <p className="text-sm text-red-300">{error}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <NavLink
                    to="/app/dashboard"
                    className="group rounded-xl border border-[#334155]/50 bg-gradient-to-br from-[#1E293B]/50 to-[#1E293B]/30 p-6 transition hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  >
                    <div className="flex items-start">
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 transition group-hover:scale-110">
                        <Vote className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Bầu cử on-chain</h3>
                        <p className="mb-3 text-sm text-blue-200/70">
                          Mở console ElectionV1 để commit, reveal và finalize trực tiếp trên Sepolia.
                        </p>
                        <div className="flex items-center text-sm font-medium text-blue-400">
                          Mở console
                          <ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </NavLink>

                  <NavLink
                    to="/app/elections"
                    className="group rounded-xl border border-[#334155]/50 bg-gradient-to-br from-[#1E293B]/50 to-[#1E293B]/30 p-6 transition hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  >
                    <div className="flex items-start">
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 transition group-hover:scale-110">
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Cuộc bầu cử</h3>
                        <p className="mb-3 text-sm text-blue-200/70">
                          Xem danh sách cuộc bầu cử và tiếp cận các trang nghiệp vụ hiện tại.
                        </p>
                        <div className="flex items-center text-sm font-medium text-blue-400">
                          Mở danh sách
                          <ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </NavLink>

                  <NavLink
                    to="/app/elections"
                    className="group rounded-xl border border-[#334155]/50 bg-gradient-to-br from-[#1E293B]/50 to-[#1E293B]/30 p-6 transition hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  >
                    <div className="flex items-start">
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 transition group-hover:scale-110">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Kết quả</h3>
                        <p className="mb-3 text-sm text-blue-200/70">
                          Xem kết quả bầu cử hiện có trong hệ thống hiện tại.
                        </p>
                        <div className="flex items-center text-sm font-medium text-blue-400">
                          Xem thống kê
                          <ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </NavLink>

                  <NavLink
                    to="/app/account"
                    className="group rounded-xl border border-[#334155]/50 bg-gradient-to-br from-[#1E293B]/50 to-[#1E293B]/30 p-6 transition hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                  >
                    <div className="flex items-start">
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 transition group-hover:scale-110">
                        <Settings className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Tài khoản</h3>
                        <p className="mb-3 text-sm text-blue-200/70">
                          Quản lý thông tin cá nhân và cấu hình ứng dụng.
                        </p>
                        <div className="flex items-center text-sm font-medium text-blue-400">
                          Mở hồ sơ
                          <ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </NavLink>
                </div>
              </motion.div>
            </div>

            <div className="space-y-8 lg:col-span-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="rounded-2xl border border-[#334155]/50 bg-[#1E293B]/30 p-6 backdrop-blur-md"
              >
                <h2 className="mb-4 flex items-center text-xl font-semibold text-white">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-400" />
                  Trạng thái hệ thống
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-[#334155]/50 bg-[#1E293B]/50 p-3">
                    <div className="flex items-center">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-sm text-blue-200">ElectionV1 backend</span>
                    </div>
                    <span className="text-sm text-green-400">Hoạt động</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-[#334155]/50 bg-[#1E293B]/50 p-3">
                    <div className="flex items-center">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-sm text-blue-200">Sepolia RPC</span>
                    </div>
                    <span className="text-sm text-green-400">{chainLabel}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-[#334155]/50 bg-[#1E293B]/50 p-3">
                    <div className="flex items-center">
                      <div className="mr-2 h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-sm text-blue-200">Ví liên kết</span>
                    </div>
                    <span className="text-sm text-green-400">{shortenAddress(user.diaChiVi)}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-2xl border border-[#334155]/50 bg-[#1E293B]/30 p-6 backdrop-blur-md"
              >
                <h2 className="mb-4 text-xl font-semibold text-white">Ghi chú migration</h2>
                <ul className="space-y-3 text-sm leading-6 text-blue-200/80">
                  <li>Trang này không còn phụ thuộc vào HLU token, chain 210 hay geth.holihu.online.</li>
                  <li>Phần active path on-chain hiện dùng ElectionV1 và dữ liệu từ backend `api/election-v1`.</li>
                  <li>Route tham gia bầu cử đang được chuyển dần sang flow commit-reveal mới trên Sepolia.</li>
                </ul>
              </motion.div>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-[#334155] bg-[#1E293B] p-6"
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
                  onClick={handleLogout}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
                >
                  Đăng xuất
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
