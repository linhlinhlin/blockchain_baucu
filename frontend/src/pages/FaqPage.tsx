'use client';

import { ArrowLeft, Github, Twitter, Linkedin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { Accordion, Panel } from '../components/ui/clay';

// Định nghĩa kiểu dữ liệu cho FAQ
type FAQItem = {
  question: string;
  answer: string;
};

export default function FAQ() {
  // Thêm SEO component
  const seoData = {
    title: 'Câu Hỏi Thường Gặp | Blockchain Election Hub',
    description:
      'Giải đáp các thắc mắc về hệ thống bầu cử blockchain, cách thức hoạt động, tính bảo mật và minh bạch của công nghệ blockchain trong bầu cử.',
    keywords:
      'blockchain, bầu cử, FAQ, câu hỏi thường gặp, bảo mật, minh bạch, token, phiếu bầu, MetaMask',
    author: 'Blockchain Election Hub',
    image:
      'https://images.unsplash.com/photo-1639762681057-408e52192e55?q=80&w=1200&auto=format&fit=crop',
    url: 'https://blockchain-election-hub.com/faq',
  };

  // Danh sách câu hỏi và câu trả lời
  const faqItems: FAQItem[] = [
    {
      question: 'Blockchain bầu cử là gì?',
      answer:
        'Đây là một nền tảng sử dụng công nghệ blockchain để tổ chức các cuộc bầu cử trực tuyến, đảm bảo tính bảo mật, minh bạch, và không thể thay đổi kết quả. Mọi phiếu bầu được mã hóa và lưu trữ trên blockchain, không ai có thể can thiệp.',
    },
    {
      question: 'Làm thế nào để tham gia một cuộc bầu cử?',
      answer:
        "Bạn cần đăng nhập bằng tài khoản hoặc ví MetaMask, đồng ý với điều lệ của cuộc bầu cử, chọn phiên bầu cử, và bỏ phiếu. Quy trình được hướng dẫn chi tiết trong trang 'Tham Gia Cuộc Bầu Cử'.",
    },
    {
      question: 'Tôi cần ví MetaMask để tham gia không?',
      answer:
        'Không bắt buộc. Bạn có thể đăng nhập bằng username/password truyền thống hoặc ví MetaMask. Tuy nhiên, MetaMask cho phép bạn kết nối trực tiếp với blockchain để nhận token phiếu bầu.',
    },
    {
      question: 'Phiếu bầu của tôi có được bảo mật không?',
      answer:
        'Có. Phiếu bầu được mã hóa trên blockchain, chỉ bạn và hệ thống biết bạn đã bỏ phiếu cho ai. Không ai, kể cả admin, có thể truy cập thông tin này.',
    },
    {
      question: 'Làm thế nào để kiểm tra tính minh bạch của kết quả?',
      answer:
        'Kết quả được lưu trên blockchain công khai. Với luồng hiện tại, bạn có thể kiểm tra giao dịch qua Sepolia Etherscan tại https://sepolia.etherscan.io.',
    },
    {
      question: 'Tôi quên mật khẩu thì phải làm sao?',
      answer:
        "Nhấn 'Forgot Password?' trên trang đăng nhập, nhập email hoặc địa chỉ ví MetaMask để khôi phục tài khoản qua quy trình xác minh.",
    },
    {
      question: 'Admin có thể thay đổi kết quả bầu cử không?',
      answer:
        'Không. Một khi phiếu bầu được ghi lên blockchain, nó không thể bị thay đổi, ngay cả bởi admin. Hệ thống đảm bảo tính bất biến.',
    },
    {
      question: 'Token phiếu bầu là gì?',
      answer:
        'Đây là các token kỹ thuật số được phát cho cử tri để bỏ phiếu. Mỗi token đại diện cho một phiếu và được ghi lại trên blockchain khi bạn sử dụng nó.',
    },
    {
      question: 'Làm sao để trở thành admin của một cuộc bầu cử?',
      answer:
        'Bạn cần được cấp quyền `QUANTRI_CUOCBAUCU` hoặc `BANTOCHUC` bởi hệ thống. Liên hệ đội ngũ hỗ trợ để biết thêm chi tiết.',
    },
    {
      question: 'Hệ thống có hỗ trợ trên mobile không?',
      answer:
        'Có. Trang web được thiết kế responsive, hoạt động mượt mà trên cả desktop và mobile, bao gồm đăng nhập, bỏ phiếu, và xem kết quả.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--clay-bg)] text-[var(--clay-text)]">
      <SEO {...seoData} />

      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)] md:text-[2rem]">
            Câu hỏi thường gặp
          </h1>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>

        <Accordion
          items={faqItems.map((item, index) => ({
            key: `q${index}`,
            trigger: <span className="pr-2">{item.question}</span>,
            content: item.answer,
          }))}
        />

        <Panel className="mt-12 text-center">
          <h2 className="font-semibold text-[var(--clay-text)]">Blockchain HoLiHu</h2>
          <div className="mt-4 flex justify-center gap-6">
            <a href="#" aria-label="Twitter" className="text-[var(--clay-primary)] hover:opacity-80">
              <Twitter className="h-6 w-6" />
            </a>
            <a href="#" aria-label="GitHub" className="text-[var(--clay-primary)] hover:opacity-80">
              <Github className="h-6 w-6" />
            </a>
            <a href="#" aria-label="LinkedIn" className="text-[var(--clay-primary)] hover:opacity-80">
              <Linkedin className="h-6 w-6" />
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--clay-muted)]">Powered by Web3 Technology</p>
        </Panel>
      </div>
    </div>
  );
}
