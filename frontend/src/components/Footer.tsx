'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { FaDiscord, FaFacebook, FaGithub, FaTwitter } from 'react-icons/fa';
import { HiOutlineCube, HiOutlineLockClosed, HiOutlineShieldCheck } from 'react-icons/hi';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { resetState, subscribe } from '../store/slice/nhanThongTinSlice';
import type { AppDispatch, RootState } from '../store/store';
import type { SubscribeData } from '../store/types';

const quickLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/elections', label: 'Cuộc bầu cử' },
  { href: 'https://sepolia.etherscan.io', label: 'Sepolia Explorer', external: true },
  { href: '/faq', label: 'Câu hỏi thường gặp' },
  { href: '/lien-he', label: 'Liên hệ' },
];

const socialLinks = [
  { href: 'https://facebook.com', label: 'Facebook', icon: <FaFacebook /> },
  { href: 'https://twitter.com', label: 'Twitter', icon: <FaTwitter /> },
  { href: 'https://github.com', label: 'GitHub', icon: <FaGithub /> },
  { href: 'https://discord.com', label: 'Discord', icon: <FaDiscord /> },
];

export function Footer() {
  const currentYear = new Date().getFullYear();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, success, message, error } = useSelector(
    (state: RootState) => state.nhanThongTin,
  );
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      dispatch(resetState());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!success) {
      return;
    }

    setEmail('');
    const timer = window.setTimeout(() => {
      dispatch(resetState());
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [success, dispatch]);

  const validateEmail = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      setEmailError('Email không được để trống.');
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(normalized)) {
      setEmailError('Địa chỉ email không hợp lệ.');
      return false;
    }

    setEmailError(null);
    return true;
  };

  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateEmail(email)) {
      return;
    }

    const subscribeData: SubscribeData = { email: email.trim() };
    dispatch(subscribe(subscribeData));
  };

  return (
    <footer className="border-t border-[var(--clay-border)] bg-[var(--clay-surface)] text-[var(--clay-text)]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.75fr_0.8fr_1fr] lg:px-8">
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white">
              <HiOutlineCube className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[17px] font-semibold tracking-[-0.015em]">HoLiHu BlockVote</p>
              <p className="text-sm text-[var(--clay-muted)]">Bầu cử blockchain minh bạch</p>
            </div>
          </div>
          <p className="max-w-sm text-[17px] leading-[1.47] text-[var(--clay-muted)]">
            Nền tảng bầu cử blockchain tập trung vào luồng xác thực rõ ràng, thao tác an toàn và
            kết quả có thể kiểm chứng.
          </p>
          <div className="flex gap-2">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--clay-border)] text-[var(--clay-muted)] transition-colors hover:border-[var(--clay-primary)] hover:text-[var(--clay-primary)]"
                aria-label={item.label}
              >
                {item.icon}
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-black">Liên kết</h2>
          <ul className="mt-4 space-y-3">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="text-sm text-[var(--clay-muted)] hover:text-[var(--clay-primary)] hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-black">Tin cậy</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--clay-muted)]">
            <li className="flex items-start gap-2">
              <HiOutlineShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay-primary)]" />
              Xác thực cử tri bằng OTP/QR.
            </li>
            <li className="flex items-start gap-2">
              <HiOutlineLockClosed className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay-primary)]" />
              Tách hành động nghiệp vụ khỏi thao tác ký on-chain.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-black">Nhận cập nhật</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--clay-muted)]">
            Nhận thông tin thay đổi sản phẩm và lịch bảo trì hệ thống.
          </p>

          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-[rgba(0,102,204,0.22)] bg-[var(--clay-primary-light)] px-3 py-2 text-sm text-[var(--clay-primary)]">
              <CheckCircle2 className="h-4 w-4" />
              <span>{message}</span>
            </div>
          )}

          {(error || emailError) && (
            <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-[rgba(191,72,0,0.24)] bg-[#fff4ed] px-3 py-2 text-sm text-[var(--clay-pomegranate)]">
              <AlertCircle className="h-4 w-4" />
              <span>{error || emailError}</span>
            </div>
          )}

          <form onSubmit={handleSubscribe} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="Email của bạn"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) {
                  validateEmail(event.target.value);
                }
              }}
              className="clay-input min-h-11 px-4 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="clay-button clay-button--blueberry inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Đăng ký
            </button>
          </form>
        </section>
      </div>

      <div className="border-t border-[var(--clay-border)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-sm text-[var(--clay-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {currentYear} HoLiHu BlockVote. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/chinh-sach-bao-mat" className="hover:text-[var(--clay-primary)] hover:underline">
              Chính sách bảo mật
            </a>
            <a href="/dieu-khoan-su-dung" className="hover:text-[var(--clay-primary)] hover:underline">
              Điều khoản sử dụng
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
