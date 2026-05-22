'use client';

import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { NewAccountForm, type RegistrationFormValues } from '../features/TaoTaiKhoanForm';
import { registerAccount, resetTrangThai } from '../store/slice/dangKyTaiKhoanSlice';
import type { TaoTaiKhoanTamThoi, TrangThaiDangKyTaiKhoan } from '../store/types';
import SEO from '../components/SEO';
import { isRecaptchaEnabled } from '../config/runtimeFlags';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Shield,
  Wallet,
  User,
  Fingerprint,
  ArrowLeft,
  Cpu,
  Database,
} from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';
import { Button, Panel } from '../components/ui/clay';

type RegistrationRootState = {
  dangKyTaiKhoan: TrangThaiDangKyTaiKhoan;
};

type RegistrationDispatch = ThunkDispatch<RegistrationRootState, unknown, UnknownAction>;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<RegistrationDispatch>();
  const { dangTai, loi, thanhCong, wallets } = useSelector(
    (state: RegistrationRootState) => state.dangKyTaiKhoan,
  );
  const [showDialog, setShowDialog] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (thanhCong) {
      setShowDialog(true);
      // Không reset state ngay để có thể hiển thị thông tin ví
    }
  }, [thanhCong, dispatch]);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handleSave = async (data: RegistrationFormValues, recaptchaToken: string) => {
    const newAccount: TaoTaiKhoanTamThoi = {
      ...data,
      id: '0',
      trangThai: true,
      ngayThamGia: formatDate(new Date()),
      lanDangNhapCuoi: formatDate(new Date()),
    };

    try {
      if (isRecaptchaEnabled && !recaptchaToken) {
        throw new Error('reCAPTCHA token is missing');
      }

      const result = await dispatch(
        registerAccount({ account: newAccount, recaptchaToken: recaptchaToken }),
      ).unwrap();

      // Lưu thông tin người dùng từ phản hồi
      if (result && result.user) {
        setUser(result.user);
      }
    } catch (error) {
      console.error('Đăng ký tài khoản thất bại:', error);
    }
  };

  const handleConfirm = () => {
    setShowDialog(false);
    dispatch(resetTrangThai());
    navigate('/login');
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Đợt 11 US2 — chỉ tái cấu trúc VỎ bằng clay. handleSave/registerAccount/
  // recaptcha + <NewAccountForm> giữ verbatim (research §INV / auth-otp-reference).
  const benefits = [
    {
      icon: <Database className="h-5 w-5" aria-hidden="true" />,
      title: 'Phi Tập Trung',
      desc: 'Dữ liệu lưu trên nhiều máy, không có điểm kiểm soát trung tâm, minh bạch.',
    },
    {
      icon: <Fingerprint className="h-5 w-5" aria-hidden="true" />,
      title: 'Bất Biến',
      desc: 'Dữ liệu đã ghi vào blockchain không thể bị thay đổi, đảm bảo toàn vẹn.',
    },
    {
      icon: <Cpu className="h-5 w-5" aria-hidden="true" />,
      title: 'Smart Contract',
      desc: 'Hợp đồng thông minh tự động thực thi quy tắc đã lập trình, công bằng.',
    },
    {
      icon: <Wallet className="h-5 w-5" aria-hidden="true" />,
      title: 'Ví Blockchain',
      desc: 'Mỗi người dùng có một ví để tương tác hệ thống và lưu tài sản số.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--clay-bg)] text-[var(--clay-text)]">
        <SEO
          title="Đăng Ký Tài Khoản | Nền Tảng Bầu Cử Blockchain"
          description="Trang đăng ký tài khoản cho nền tảng bầu cử blockchain. Tạo tài khoản để tham gia vào quá trình bầu cử an toàn và minh bạch."
          keywords="đăng ký, tài khoản, bầu cử, blockchain, an toàn, minh bạch"
          author="Nền Tảng Bầu Cử Blockchain"
          url={window.location.href}
          image={`${window.location.origin}/logo.png`}
        />

        {isRecaptchaEnabled && <div id="recaptcha-container" style={{ display: 'none' }}></div>}

        <div className="mx-auto max-w-[1200px] px-4 py-10">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-[8px] px-1 text-sm text-[var(--clay-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Quay lại trang chủ
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)] md:text-[2rem]">
              Đăng ký tài khoản blockchain
            </h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--clay-muted)]">
              Tạo tài khoản để tham gia nền tảng bầu cử blockchain an toàn, minh bạch. Mỗi tài khoản
              được cấp một ví blockchain để tham gia các hoạt động trên hệ thống.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div ref={formRef}>
              <Panel>
                {loi && (
                  <div
                    role="alert"
                    className="mb-5 flex items-center gap-2 rounded-[12px] border border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-3 py-2.5 text-sm text-[var(--state-danger)]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{loi}</span>
                  </div>
                )}
                <NewAccountForm onSave={handleSave} />
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel>
                <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--clay-text)]">
                  <Shield className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                  Công nghệ blockchain
                </h2>
                <div className="mt-4 space-y-3">
                  {benefits.map((b) => (
                    <div
                      key={b.title}
                      className="flex items-start gap-3 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                        {b.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--clay-text)]">{b.title}</h3>
                        <p className="mt-0.5 text-sm leading-relaxed text-[var(--clay-muted)]">
                          {b.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="bg-[var(--clay-surface-soft)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--clay-text)]">Đã có tài khoản?</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-[var(--clay-muted)]">
                      Đăng nhập để tham gia các cuộc bầu cử.
                    </p>
                    <Link
                      to="/login"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--clay-primary)] hover:underline"
                    >
                      Đăng nhập ngay
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>

        {showDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Panel className="relative w-full max-w-md">
              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--state-success-soft)]">
                  <CheckCircle className="h-8 w-8 text-[var(--state-success)]" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--clay-text)]">
                  Đăng ký thành công!
                </h3>
                <p className="mt-2 text-sm text-[var(--clay-muted)]">
                  Tài khoản blockchain của bạn đã được tạo. Bạn có thể đăng nhập ngay bây giờ.
                </p>
              </div>

              <div className="mt-4 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4">
                <h4 className="mb-3 flex items-center gap-2 font-medium text-[var(--clay-text)]">
                  <Wallet className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                  Thông tin ví blockchain của bạn
                </h4>

                {wallets && wallets.length > 0 ? (
                  wallets.map((wallet, index) => (
                    <div key={index} className="mb-3 last:mb-0">
                      <div className="mb-1 flex items-center gap-2">
                        <FaEthereum className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                        <span className="text-sm text-[var(--clay-muted)]">
                          {wallet.LoaiVi === 1 ? 'Smart Contract Wallet' : 'EOA Wallet'}
                        </span>
                      </div>
                      <div className="rounded-[10px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-2">
                        <p className="break-all font-mono text-xs text-[var(--clay-primary)]">
                          {wallet.DiaChiVi}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2">
                      <FaEthereum className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                      <span className="text-sm text-[var(--clay-muted)]">Smart Contract Wallet</span>
                    </div>
                    <div className="rounded-[10px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-2">
                      <p className="break-all font-mono text-xs text-[var(--clay-primary)]">
                        {user?.diaChiVi || 'Đang tải...'}
                      </p>
                    </div>
                  </div>
                )}

                {user?.diaChiViSCW && !wallets && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2">
                      <FaEthereum className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                      <span className="text-sm text-[var(--clay-muted)]">Smart Contract Wallet</span>
                    </div>
                    <div className="rounded-[10px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-2">
                      <p className="break-all font-mono text-xs text-[var(--clay-primary)]">
                        {user.diaChiViSCW}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-1 text-xs text-[var(--clay-muted)]">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--clay-primary)]" aria-hidden="true" />
                  <span>
                    Lưu thông tin ví này để dùng sau. Bạn cần địa chỉ ví để tham gia các hoạt động
                    trên blockchain.
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Button type="button" variant="primary" size="lg" onClick={handleConfirm}>
                  Đến trang đăng nhập
                </Button>
              </div>
            </Panel>
          </div>
        )}
      {isRecaptchaEnabled && <div id="recaptcha-container" className="fixed bottom-4 right-4 z-50"></div>}
      </div>
  );
};

export default RegisterPage;
