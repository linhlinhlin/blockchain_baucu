'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FaEthereum } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import type { AppDispatch, RootState } from '../store/store';
import { login, loginWithMetaMask, refreshJwtToken } from '../store/slice/dangNhapTaiKhoanSlice';
import { fetchLatestSession } from '../store/slice/phienDangNhapSlice';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../components/ui/Use-toast';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { isRecaptchaEnabled } from '../config/runtimeFlags';
import { clearAllAccessCache, resetSecurityState } from '../utils/authUtils';
import { normalizeLoginRedirect } from '../utils/loginRedirect';
import SEO from '../components/SEO';

declare global {
  interface Window {
    ethereum: any;
  }
}

type LoginMode = 'credentials' | 'metamask';
type MetaMaskPhase = 'idle' | 'connecting' | 'signing' | 'submitting';

const trustNotes = [
  'Phiên đăng nhập dùng cookie refresh token, không lưu access token lâu dài.',
  'MetaMask chỉ được yêu cầu khi người dùng chủ động chọn đăng nhập bằng ví.',
  'Các thao tác on-chain được tách riêng để tránh ký nhầm giao dịch.',
];

const metaMaskSteps = [
  {
    title: 'Kết nối ví',
    description: 'Hệ thống chỉ đọc địa chỉ ví để xác định tài khoản đã liên kết.',
  },
  {
    title: 'Ký thông điệp',
    description: 'Chữ ký xác minh quyền sở hữu ví, không tạo giao dịch và không tốn gas.',
  },
];

const getMetaMaskLoginError = (error: any) => {
  if (error?.code === 4001) {
    return 'Bạn đã hủy yêu cầu trong MetaMask. Bấm lại nút đăng nhập và ký thông điệp để tiếp tục.';
  }

  if (error?.code === -32002) {
    return 'MetaMask đang có một yêu cầu chờ xử lý. Hãy mở MetaMask và hoàn tất hoặc hủy yêu cầu đó trước.';
  }

  const message = typeof error?.message === 'string' ? error.message : '';
  if (message.toLowerCase().includes('user rejected')) {
    return 'Bạn đã hủy yêu cầu ký trong MetaMask.';
  }

  return message || 'Không thể đăng nhập bằng MetaMask. Vui lòng thử lại.';
};

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { connectWallet, currentAccount, isConnecting, isMetaMaskInstalled } = useWeb3();
  const { dangTai } = useSelector(
    (state: RootState) => state.dangNhapTaiKhoan as { dangTai: boolean },
  );
  const { phienDangNhapChiTiet } = useSelector((state: RootState) => state.phienDangNhap);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<LoginMode>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);
  const [metaMaskPhase, setMetaMaskPhase] = useState<MetaMaskPhase>('idle');

  const redirectAfterLogin = useCallback(() => {
    const redirectTo = searchParams.get('redirectTo');
    navigate(normalizeLoginRedirect(redirectTo));
  }, [navigate, searchParams]);

  const getRecaptchaToken = useCallback(async () => {
    if (!isRecaptchaEnabled) {
      return '';
    }

    if (!executeRecaptcha) {
      return null;
    }

    try {
      const token = await executeRecaptcha('login_page');
      setRecaptchaToken(token);
      return token;
    } catch {
      return null;
    }
  }, [executeRecaptcha]);

  const handleAutoLogin = useCallback(async () => {
    try {
      setIsAutoLoggingIn(true);
      const result = await dispatch(refreshJwtToken());

      if (refreshJwtToken.fulfilled.match(result) && result.payload.accessToken) {
        const { user } = result.payload;
        resetSecurityState(user.id);
        localStorage.setItem(
          'user_data',
          JSON.stringify({
            id: user.id,
            username: user.tenDangNhap,
            role: user.vaiTro?.tenVaiTro || 'Nguoi Dung',
          }),
        );
        localStorage.setItem('isLoggedOut', 'false');
        void dispatch(fetchLatestSession(user.id.toString()));
        redirectAfterLogin();
      }
    } catch {
      // Silent: users should not see an error before they actively submit the form.
    } finally {
      setIsAutoLoggingIn(false);
    }
  }, [dispatch, redirectAfterLogin]);

  useEffect(() => {
    void handleAutoLogin();

    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, [handleAutoLogin]);

  useEffect(() => {
    if (!isRecaptchaEnabled) {
      setRecaptchaToken('');
      return;
    }

    void getRecaptchaToken();
  }, [getRecaptchaToken]);

  useEffect(() => {
    if (phienDangNhapChiTiet) {
      redirectAfterLogin();
    }
  }, [phienDangNhapChiTiet, redirectAfterLogin]);

  async function handleCredentialsLogin(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Nhập tên đăng nhập để tiếp tục.');
      usernameRef.current?.focus();
      return;
    }

    if (!password) {
      setError('Nhập mật khẩu để tiếp tục.');
      passwordRef.current?.focus();
      return;
    }

    const token = recaptchaToken ?? (await getRecaptchaToken());
    if (isRecaptchaEnabled && !token) {
      setError('Không thể xác minh reCAPTCHA. Vui lòng thử lại.');
      return;
    }

    try {
      clearAllAccessCache();
      const result = await dispatch(
        login({
          tenDangNhap: username.trim(),
          matKhau: password,
          recaptchaToken: token ?? '',
        }),
      );

      if (!login.fulfilled.match(result) || !result.payload.accessToken) {
        setError('Tên đăng nhập hoặc mật khẩu chưa đúng.');
        passwordRef.current?.focus();
        return;
      }

      const { user } = result.payload;
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username.trim());
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      resetSecurityState(user.id);
      localStorage.setItem(
        'user_data',
        JSON.stringify({
          id: user.id,
          username: user.tenDangNhap,
          role: user.vaiTro?.tenVaiTro || 'Nguoi Dung',
        }),
      );
      localStorage.setItem('isLoggedOut', 'false');
      void dispatch(fetchLatestSession(user.id.toString()));

      addToast({
        title: 'Đăng nhập thành công',
        description: user.isMetaMask
          ? 'Tài khoản đã liên kết ví. Bạn có thể kết nối ví khi cần thao tác on-chain.'
          : 'Bạn đang được chuyển vào bảng điều khiển.',
        variant: 'success',
        duration: 3200,
      });

      redirectAfterLogin();
    } catch {
      setError('Không thể đăng nhập lúc này. Kiểm tra kết nối và thử lại.');
    }
  }

  async function handleMetaMaskLogin() {
    if (metaMaskPhase !== 'idle' || (isConnecting && !currentAccount)) {
      return;
    }

    setError('');

    try {
      if (!isMetaMaskInstalled || !window.ethereum) {
        window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer');
        setError('MetaMask chưa được cài đặt. Hãy cài MetaMask rồi quay lại đăng nhập.');
        return;
      }

      const token = recaptchaToken ?? (await getRecaptchaToken());
      if (isRecaptchaEnabled && !token) {
        setError('Không thể xác minh reCAPTCHA. Vui lòng thử lại.');
        return;
      }

      clearAllAccessCache();
      let walletAddress = currentAccount;
      if (!walletAddress) {
        setMetaMaskPhase('connecting');
        walletAddress = await connectWallet();
      }

      if (!walletAddress) {
        setError('Không thể kết nối MetaMask. Vui lòng kiểm tra ví và thử lại.');
        return;
      }

      setMetaMaskPhase('signing');
      addToast({
        title: 'Đang chờ chữ ký',
        description: 'Ký thông điệp trong MetaMask để xác minh bạn sở hữu ví.',
        duration: 10000,
      });

      const authNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nonce = `HoLiHu BlockVote Login\nAddress: ${walletAddress}\nNonce: ${authNonce}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [nonce, walletAddress],
      });

      if (typeof signature !== 'string' || !signature) {
        throw new Error('MetaMask không trả về chữ ký.');
      }

      setMetaMaskPhase('submitting');
      const result = await dispatch(
        loginWithMetaMask({
          diaChiVi: walletAddress,
          nonce,
          signature,
          recaptchaToken: token ?? '',
        }),
      );

      if (!loginWithMetaMask.fulfilled.match(result)) {
        throw new Error((result.payload as string) || 'Đăng nhập MetaMask thất bại.');
      }

      const { user } = result.payload;
      resetSecurityState(user.id);
      localStorage.setItem(
        'user_data',
        JSON.stringify({
          id: user.id,
          username: user.tenDangNhap,
          role: user.vaiTro?.tenVaiTro || 'Nguoi Dung',
          walletAddress,
        }),
      );
      localStorage.setItem('isLoggedOut', 'false');

      addToast({
        title: 'Ví đã xác minh',
        description: 'Bạn đang được chuyển vào bảng điều khiển.',
        variant: 'success',
        duration: 3200,
      });
      redirectAfterLogin();
    } catch (err: any) {
      setError(getMetaMaskLoginError(err));
    } finally {
      setMetaMaskPhase('idle');
    }
  }

  const isBusy = dangTai || isAutoLoggingIn;
  const isMetaMaskConnecting = metaMaskPhase === 'connecting' || (isConnecting && !currentAccount);
  const isMetaMaskSigning = metaMaskPhase === 'signing';
  const isMetaMaskSubmitting = metaMaskPhase === 'submitting';
  const isMetaMaskActionPending = metaMaskPhase !== 'idle' || (isConnecting && !currentAccount);
  const metaMaskActionLabel = !isMetaMaskInstalled
    ? 'Cài MetaMask'
    : isMetaMaskConnecting
      ? 'Đang mở MetaMask để kết nối…'
      : isMetaMaskSigning
        ? 'Mở MetaMask để ký thông điệp…'
        : isMetaMaskSubmitting
          ? 'Đang xác minh chữ ký…'
          : currentAccount
            ? 'Ký để đăng nhập bằng MetaMask'
            : 'Kết nối MetaMask để tiếp tục';
  const metaMaskStatusLabel = currentAccount
    ? 'Ví đã kết nối'
    : isMetaMaskInstalled
      ? 'Chưa kết nối ví'
      : 'Cần cài MetaMask';

  return (
    <div className="min-h-screen bg-[var(--clay-bg)] px-4 py-10 text-[var(--clay-text)] sm:px-6 lg:px-8">
      <SEO
        title="Đăng Nhập | HoLiHu BlockVote"
        description="Đăng nhập vào HoLiHu BlockVote bằng tài khoản hoặc MetaMask."
        keywords="đăng nhập, MetaMask, bầu cử blockchain, HoLiHu"
        author="HoLiHu BlockVote"
        url={window.location.href}
      />

      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[18px] border border-[var(--clay-border)] bg-white lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden min-h-[680px] overflow-hidden bg-[var(--surface-black)] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Secure Access
            </div>
            <h1 className="clay-display mt-6 text-balance text-5xl font-bold leading-[0.96]">
              Vào hệ thống bằng cách ít gây rối nhất.
            </h1>
            <p className="mt-5 text-pretty text-sm leading-7 text-white/70">
              Tài khoản dùng cho quản trị và nghiệp vụ. MetaMask dùng khi bạn muốn xác minh ví hoặc
              thao tác on-chain. Hai luồng được tách rõ để tránh ký nhầm.
            </p>
          </div>

          <div className="relative z-10 grid gap-3">
            {trustNotes.map((note) => (
              <div key={note} className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--state-success)]" />
                <p className="text-sm leading-6 text-white/70">{note}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-xl">
            <div className="mb-8">
              <Link to="/" className="clay-link">
                Về trang giới thiệu
              </Link>
              <h2 className="clay-display mt-5 text-4xl font-bold leading-tight md:text-5xl">
                Đăng nhập
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--clay-muted)]">
                Chọn đúng cách vào hệ thống. Nếu chỉ quản lý dữ liệu, dùng tài khoản. Nếu cần xác
                minh ví, dùng MetaMask.
              </p>
            </div>

            <div className="mb-6 grid rounded-[22px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('credentials')}
                aria-pressed={mode === 'credentials'}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                  mode === 'credentials'
                    ? 'bg-white text-black'
                    : 'text-[var(--clay-muted)] hover:text-black'
                }`}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Tài khoản
              </button>
              <button
                type="button"
                onClick={() => setMode('metamask')}
                aria-pressed={mode === 'metamask'}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                  mode === 'metamask'
                    ? 'bg-white text-black'
                    : 'text-[var(--clay-muted)] hover:text-black'
                }`}
              >
                <FaEthereum className="h-4 w-4" aria-hidden="true" />
                MetaMask
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mode === 'credentials' ? (
                <motion.form
                  key="credentials"
                  onSubmit={handleCredentialsLogin}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div>
                    <label htmlFor="username" className="mb-2 block text-sm font-semibold text-black">
                      Tên đăng nhập
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]" />
                      <input
                        ref={usernameRef}
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        spellCheck={false}
                        required
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        aria-invalid={!!error && !username.trim()}
                        className="clay-input min-h-12 pl-11 pr-4 text-sm"
                        placeholder="Ví dụ: nguyenvana…"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-2 block text-sm font-semibold text-black">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]" />
                      <input
                        ref={passwordRef}
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={!!error && !!username.trim() && !password}
                        className="clay-input min-h-12 pl-11 pr-12 text-sm"
                        placeholder="Nhập mật khẩu…"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--clay-muted)] hover:bg-[var(--clay-border-light)] hover:text-black"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-[var(--clay-muted)]">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="h-4 w-4 rounded border-[var(--clay-border)] text-[var(--clay-blueberry)]"
                      />
                      Ghi nhớ tên đăng nhập
                    </label>
                    <Link to="/forgot-password" className="clay-link text-sm">
                      Quên mật khẩu?
                    </Link>
                  </div>

                  {error && <InlineError message={error} />}

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="clay-button clay-button--blueberry inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {isBusy ? 'Đang kiểm tra phiên…' : 'Đăng nhập vào bảng điều khiển'}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="metamask"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="rounded-[24px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                        <WalletCards className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold tracking-[-0.035em] text-black">
                          Đăng nhập bằng ví
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
                          Bạn sẽ ký một thông điệp xác minh. Không có giao dịch và không tốn gas ở
                          bước đăng nhập.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[18px] border border-[var(--clay-border)] bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--clay-muted)]">
                            {metaMaskStatusLabel}
                          </p>
                          <p
                            className="clay-mono mt-1 max-w-full truncate text-sm font-semibold text-black"
                            title={currentAccount || undefined}
                          >
                            {currentAccount
                              ? `${currentAccount.slice(0, 6)}…${currentAccount.slice(-4)}`
                              : 'MetaMask sẽ mở khi bạn bấm nút bên dưới'}
                          </p>
                        </div>
                        {currentAccount ? (
                          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--clay-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--clay-primary)]">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Sẵn sàng ký
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {error && <InlineError message={error} />}

                    <button
                      id="metamask-login-button"
                      type="button"
                      onClick={handleMetaMaskLogin}
                      disabled={isMetaMaskActionPending}
                      aria-busy={isMetaMaskActionPending}
                      className="metamask-login-action mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
                    >
                      {isMetaMaskActionPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <FaEthereum className="h-4 w-4" aria-hidden="true" />
                      )}
                      {metaMaskActionLabel}
                    </button>

                    <p className="mt-3 text-center text-xs leading-5 text-[var(--clay-muted)]">
                      Ký xong hệ thống sẽ xác minh ví, tạo phiên đăng nhập và chuyển vào bảng điều khiển.
                    </p>

                    <ol className="mt-5 grid gap-2">
                      {metaMaskSteps.map((step, index) => (
                        <li
                          key={step.title}
                          className="flex gap-3 rounded-[18px] border border-[var(--clay-border)] bg-white px-4 py-3"
                        >
                          <span className="clay-mono mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary-light)] text-xs font-bold text-[var(--clay-primary)]">
                            {index + 1}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-black">{step.title}</span>
                            <span className="mt-1 block text-sm leading-6 text-[var(--clay-muted)]">
                              {step.description}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 rounded-[24px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-5">
              <p className="text-sm font-semibold text-black">Chưa có tài khoản?</p>
              <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                Tạo tài khoản nếu bạn muốn dùng tên đăng nhập và mật khẩu cho nghiệp vụ quản trị.
              </p>
              <Link
                to="/register"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--clay-blueberry)] hover:underline"
              >
                Tạo tài khoản
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-[14px] border border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--state-danger)]"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--state-danger)]" />
      <p>{message}</p>
    </div>
  );
}
