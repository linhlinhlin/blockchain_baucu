import type React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../logo.svg';
import { ThumbsUp, Home } from 'lucide-react';
import { Button, Panel } from '../components/ui/clay';

const CamOnPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[var(--clay-bg)] p-4 text-[var(--clay-text)]">
      <Panel className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-[var(--clay-surface-soft)]">
          <img src={logo || '/placeholder.svg'} alt="Logo" className="h-20 w-20" />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
          Cảm ơn bạn đã đến!
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--clay-muted)]">
          Chúng tôi đánh giá cao sự tham gia của bạn trong quá trình bầu cử. Sự đóng góp của bạn
          giúp xây dựng một tương lai dân chủ hơn.
        </p>
        <ThumbsUp
          className="mx-auto my-5 h-14 w-14 text-[var(--clay-primary)]"
          aria-hidden="true"
        />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleGoHome}
            iconLeft={<Home className="h-5 w-5" aria-hidden="true" />}
          >
            Quay về trang chủ
          </Button>
        </div>
      </Panel>
    </div>
  );
};

export default CamOnPage;
