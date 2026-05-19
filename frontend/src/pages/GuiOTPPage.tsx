import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import SEO from '../components/SEO';
import { TaiKhoan } from '../store/types';
import ModalOTP from '../components/ModalOTP';
import { guiOtp, xacMinhOtp, resetTrangThai } from '../store/slice/maOTPSlice';
import { RootState, AppDispatch } from '../store/store';
import { Button, Panel } from '../components/ui/clay';

const GuiOTPPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, randomCode } = useParams<{ username: string; randomCode: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const user = location.state?.user as TaiKhoan;
  const [selectedOption, setSelectedOption] = useState<string>('email');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const { dangTai, loi, xacMinhOtpThanhCong } = useSelector((state: RootState) => state.maOTP);

  useEffect(() => {
    if (xacMinhOtpThanhCong) {
      navigate(`/tim-tai-khoan/${username}/${randomCode}/tuy-chon/gui-otp/dat-lai-mat-khau`);
    }
  }, [xacMinhOtpThanhCong, navigate, username, randomCode]);

  useEffect(() => {
    return () => {
      dispatch(resetTrangThai());
    };
  }, [dispatch]);

  if (!user) {
    navigate('/tim-tai-khoan');
    return null;
  }

  const handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedOption(event.target.value);
  };

  const handleContinue = () => {
    dispatch(guiOtp(user.email ?? ''));
    setIsModalOpen(true);
  };

  const handleVerifyOtp = (otp: string) => {
    dispatch(xacMinhOtp({ otp, email: user.email ?? '' }));
  };

  const handleResendOtp = () => {
    dispatch(guiOtp(user.email ?? ''));
  };

  const handleTryAnotherMethod = () => {
    dispatch(resetTrangThai());
    navigate(`/tim-tai-khoan/${username}/${randomCode}/tuy-chon`, { state: { user } });
  };

  const maskPhoneNumber = (phone: string | undefined) => {
    if (!phone) return 'Số điện thoại không hợp lệ';
    return phone.replace(/(\d{2})(\d+)(\d{3})/, '+$1*******$3');
  };

  const maskEmail = (email: string | undefined) => {
    if (!email || !email.includes('@')) return 'Email không hợp lệ';
    const [localPart, domain] = email.split('@');
    return `${localPart[0]}${localPart[1]}***@***${domain.slice(-1)}`;
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[var(--clay-bg)] p-4 text-[var(--clay-text)]">
      <SEO
        title="Gửi OTP | Nền Tảng Bầu Cử Blockchain"
        description="Trang gửi OTP cho tài khoản của bạn trên hệ thống Bầu Cử Blockchain."
        keywords="đặt lại mật khẩu, bầu cử, blockchain, tài khoản"
        author="Nền Tảng Bầu Cử Blockchain"
        url={window.location.href}
        image={`${window.location.origin}/logo.png`}
      />
      <Panel className="w-full max-w-md space-y-5">
        <h1 className="text-xl font-semibold tracking-[-0.015em] text-[var(--clay-text)] md:text-2xl">
          Đặt lại mật khẩu của bạn
        </h1>
        <div className="flex items-center gap-4 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4">
          <img
            src={user.avatar}
            alt={user.tenDangNhap}
            className="h-14 w-14 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h4 className="font-semibold text-[var(--clay-text)]">{user.tenDangNhap}</h4>
            <p className="text-sm text-[var(--clay-muted)]">{maskEmail(user.email ?? '')}</p>
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="sr-only">Chọn phương thức nhận OTP</legend>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]">
            <input
              type="radio"
              name="reset-option"
              value="sms"
              checked={selectedOption === 'sms'}
              onChange={handleOptionChange}
              className="h-4 w-4"
            />
            <span>Gửi SMS đến {maskPhoneNumber(user.sdt ?? '')}</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]">
            <input
              type="radio"
              name="reset-option"
              value="email"
              checked={selectedOption === 'email'}
              onChange={handleOptionChange}
              className="h-4 w-4"
            />
            <span>Gửi email đến {maskEmail(user.email ?? '')}</span>
          </label>
        </fieldset>
        <div className="space-y-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleContinue}
            disabled={!selectedOption || dangTai}
            loading={dangTai}
          >
            Tiếp tục
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={handleTryAnotherMethod}
          >
            Thử cách khác
          </Button>
        </div>
        {loi && (
          <p role="alert" className="text-sm text-[var(--state-danger)]">
            {loi}
          </p>
        )}
      </Panel>

      <ModalOTP
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          dispatch(resetTrangThai());
        }}
        onVerify={handleVerifyOtp}
        email={user.email ?? ''}
        onResend={handleResendOtp}
        error={loi}
      />
    </div>
  );
};

export default GuiOTPPage;
