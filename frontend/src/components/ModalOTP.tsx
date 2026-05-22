import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/InputOTP';
import { Button } from '../components/ui/Button';
import { X, ArrowRight, Mail, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  email: string;
  onResend: () => void;
  error: string | null;
  deliveryMode?: string | null;
  devOtpCode?: string | null;
  dispatchMessage?: string | null;
  expiresAt?: string | null;
}

const RESEND_SECONDS = 30;

const maskEmail = (email: string | undefined) => {
  if (!email) {
    return 'Email không hợp lệ';
  }

  if (email.includes('*')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const suffix = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : '';

  return `${visiblePrefix}***@${domainName.slice(0, 1)}***${suffix}`;
};

const formatExpiry = (expiresAt?: string | null) => {
  if (!expiresAt) {
    return null;
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ModalOTP: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  email,
  onResend,
  error,
  deliveryMode,
  devOtpCode,
  dispatchMessage,
  expiresAt,
}) => {
  const [otp, setOtp] = useState<string>('');
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const isDevelopmentPreview = deliveryMode === 'development-preview' && Boolean(devOtpCode);
  const expiryLabel = useMemo(() => formatExpiry(expiresAt), [expiresAt]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isOpen, timer]);

  useEffect(() => {
    if (!isOpen) {
      setOtp('');
      setTimer(RESEND_SECONDS);
    }
  }, [isOpen]);

  const handleVerify = useCallback(() => {
    if (otp.length === 6) {
      onVerify(otp);
    }
  }, [otp, onVerify]);

  const handleResend = useCallback(() => {
    setTimer(RESEND_SECONDS);
    setOtp('');
    onResend();
  }, [onResend]);

  const handleUseDevCode = useCallback(() => {
    if (devOtpCode) {
      setOtp(devOtpCode.slice(0, 6));
    }
  }, [devOtpCode]);

  // UX (spec 006/M2): Escape để đóng modal (a11y bàn phím).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-otp-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Đóng modal OTP"
        >
          <X size={24} />
        </button>

        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex rounded-full bg-blue-100 p-3 dark:bg-blue-900">
            {isDevelopmentPreview ? (
              <AlertTriangle size={32} className="text-amber-600 dark:text-amber-300" />
            ) : (
              <Mail size={32} className="text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <h3 id="modal-otp-title" className="mb-2 text-2xl font-bold text-gray-950 dark:text-white">
            {isDevelopmentPreview ? 'OTP kiểm thử' : 'Xác thực OTP'}
          </h3>
          {isDevelopmentPreview ? (
            <p className="mx-auto max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
              SMTP chưa gửi được email thật. Dùng mã preview bên dưới để kiểm thử luồng xác thực.
            </p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300">Chúng tôi đã gửi mã OTP đến email</p>
              <p className="text-gray-600 dark:text-gray-300">
                {expiryLabel ? `Mã OTP có hiệu lực đến ${expiryLabel}` : 'Mã OTP có hiệu lực trong 15 phút'}
              </p>
            </>
          )}
          <p className="mt-2 font-medium text-gray-800 dark:text-gray-200">{maskEmail(email)}</p>
        </div>

        {isDevelopmentPreview && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">Email thật chưa được gửi.</p>
            {dispatchMessage && <p className="mt-1 leading-6">{dispatchMessage}</p>}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 font-mono text-2xl font-bold tracking-[0.32em] text-gray-950 dark:bg-gray-900 dark:text-white">
              <span>{devOtpCode}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleUseDevCode}>
                Điền mã
              </Button>
            </div>
          </div>
        )}

        <InputOTP value={otp} onChange={setOtp} maxLength={6} className="mb-6">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        <Button onClick={handleVerify} className="mb-4 mt-4 w-full" disabled={otp.length !== 6}>
          Xác nhận
          <ArrowRight className="ml-2" size={18} />
        </Button>

        <div className="text-center">
          {timer > 0 ? (
            <p className="text-gray-600 dark:text-gray-400">Gửi lại mã sau {timer} giây</p>
          ) : (
            <Button
              type="button"
              variant="link"
              onClick={handleResend}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Gửi lại mã OTP
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default React.memo(ModalOTP);
