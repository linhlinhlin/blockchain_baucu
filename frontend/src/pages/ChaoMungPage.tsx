'use client';

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Layers3,
  QrCode,
  ShieldCheck,
  Vote,
  WalletCards,
} from 'lucide-react';
import SEO from '../components/SEO';

const productCards = [
  {
    label: 'Cử tri',
    title: 'Nhận lời mời, xác thực OTP, liên kết ví.',
    description:
      'Mỗi bước có trạng thái, lý do và hành động kế tiếp rõ ràng để người dùng không phải đoán.',
    icon: <QrCode className="h-5 w-5" />,
  },
  {
    label: 'Ban tổ chức',
    title: 'Tạo ballot và quản lý danh sách trong một luồng.',
    description:
      'Từ cấu hình chức vụ, ứng viên, cử tri đến triển khai ElectionV1 đều nằm trong cùng tuyến nghiệp vụ.',
    icon: <Vote className="h-5 w-5" />,
  },
  {
    label: 'Kiểm chứng',
    title: 'Commit, reveal, finalize có nhịp trạng thái riêng.',
    description:
      'Giao diện tách dữ liệu, trạng thái chain và hành động ký để giảm rủi ro thao tác nhầm.',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const steps = [
  'Tạo ballot với chức vụ, ứng viên, thời gian và mô tả dễ hiểu.',
  'Mời cử tri bằng QR/OTP để xác thực trước khi liên kết ví.',
  'Triển khai ElectionV1 lên Sepolia khi danh sách đã sẵn sàng.',
  'Theo dõi commit, reveal và finalize trong trung tâm điều khiển.',
];

const principles = [
  'Một màu nhấn duy nhất cho hành động chính.',
  'Không dùng gradient trang trí, shadow nặng hoặc hiệu ứng gây nhiễu.',
  'Mỗi màn hình ưu tiên việc cần làm tiếp theo.',
  'Touch target tối thiểu 44px, nội dung đọc được trên mobile.',
];

export default function ChaoMungPage() {
  return (
    <div className="apple-page min-h-screen overflow-hidden">
      <SEO
        title="HoLiHu BlockVote | Bầu Cử Blockchain"
        description="Nền tảng bầu cử blockchain với luồng xác thực, bỏ phiếu và kiểm chứng rõ ràng cho người dùng Việt Nam."
        keywords="bầu cử blockchain, ElectionV1, Sepolia, bỏ phiếu trực tuyến, xác thực cử tri"
        author="HoLiHu BlockVote"
        url={window.location.href}
      />

      <section className="apple-tile">
        <div className="apple-container grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="apple-text-container mx-0 space-y-6 text-center lg:text-left">
            <p className="apple-eyebrow">HoLiHu BlockVote</p>
            <h1 className="apple-hero-title">
              Minh bạch như blockchain. Dễ dùng như một phiếu bầu giấy.
            </h1>
            <p className="apple-lead">
              Hệ thống gom OTP, ví, commit-reveal và kiểm chứng on-chain thành một luồng ít nhiễu:
              biết mình đang ở đâu, cần làm gì và kết quả đã được ghi nhận ra sao.
            </p>
            <div className="apple-cta-row justify-center lg:justify-start">
              <Link to="/login" className="apple-cta">
                Đăng nhập
              </Link>
              <Link to="/elections" className="apple-cta apple-cta--secondary">
                Xem cuộc bầu cử
              </Link>
            </div>
          </div>

          <div className="apple-product-surface p-5 md:p-8" aria-label="Minh họa luồng ballot">
            <div className="flex h-full flex-col justify-between rounded-[18px] border border-[var(--clay-border)] bg-white p-5">
              <div>
                <div className="inline-flex rounded-full bg-[var(--clay-primary-light)] px-3 py-1 text-sm text-[var(--clay-primary)]">
                  ElectionV1
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.015em] text-black">
                  Ballot Hội đồng 2026
                </h2>
                <p className="mt-2 apple-body">
                  Trạng thái hiện tại: đang bỏ phiếu. Cử tri còn 02 bước để hoàn tất.
                </p>
              </div>

              <div className="mt-6 grid gap-3">
                {steps.slice(0, 3).map((step, index) => (
                  <div
                    key={step}
                    className="flex min-h-11 items-center gap-3 rounded-full border border-[var(--clay-border)] px-4 py-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary)] text-sm text-white">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm text-[var(--clay-text)]">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="apple-tile apple-tile--dark">
        <div className="apple-container grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="space-y-5">
            <p className="apple-eyebrow">Luồng nghiệp vụ</p>
            <h2 className="apple-display-title">
              Một tuyến đường rõ ràng, không bắt người dùng hiểu Web3 trước.
            </h2>
            <p className="apple-body">
              Các khái niệm ví, gas, transaction và xác thực được đặt đúng thời điểm. Giao diện chỉ
              hỏi người dùng khi có đủ bối cảnh để quyết định.
            </p>
          </div>

          <ol className="grid gap-3 md:grid-cols-2">
            {steps.map((step, index) => (
              <li
                key={step}
                className="rounded-[18px] border border-white/15 bg-white/[0.04] p-5"
              >
                <span className="text-sm text-[var(--clay-primary-on-dark)]">0{index + 1}</span>
                <p className="mt-3 text-[17px] leading-[1.47] text-white">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="apple-tile apple-tile--parchment">
        <div className="apple-container">
          <div className="apple-text-container mb-10 text-center">
            <p className="apple-eyebrow">Thiết kế theo vai trò</p>
            <h2 className="apple-display-title mt-3">
              Mỗi người dùng nhìn thấy đúng việc của họ.
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {productCards.map((card) => (
              <article key={card.label} className="apple-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                  {card.icon}
                </div>
                <p className="apple-eyebrow mt-5">{card.label}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                  {card.title}
                </h3>
                <p className="apple-body mt-3">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="apple-tile">
        <div className="apple-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <p className="apple-eyebrow">Quy tắc giao diện</p>
            <h2 className="apple-display-title">
              Ít lớp trang trí hơn, nhiều tín hiệu quyết định hơn.
            </h2>
            <p className="apple-body">
              Hệ thống dùng cấu trúc, khoảng trắng và copywriting để dẫn đường. Màu xanh chỉ dành
              cho hành động chính hoặc liên kết có thể nhấn.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {principles.map((value) => (
              <div key={value} className="apple-card flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--clay-primary)]" />
                <p className="apple-body">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="apple-tile apple-tile--dark">
        <div className="apple-text-container text-center">
          <p className="apple-eyebrow">Sẵn sàng</p>
          <h2 className="apple-display-title mt-3">
            Bắt đầu bằng tài khoản hiện có hoặc ví MetaMask.
          </h2>
          <p className="apple-body mx-auto mt-4 max-w-3xl">
            Tài khoản phục vụ quản trị và nghiệp vụ. MetaMask chỉ xuất hiện khi cần xác minh ví hoặc
            ký thao tác on-chain.
          </p>
          <div className="apple-cta-row mt-7">
            <Link to="/login" className="apple-cta">
              <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Đăng nhập
            </Link>
            <Link to="/register" className="apple-cta apple-cta--secondary">
              Tạo tài khoản
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
