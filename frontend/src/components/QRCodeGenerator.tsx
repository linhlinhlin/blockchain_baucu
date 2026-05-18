import type React from 'react';
import { useId } from 'react';
import QRCode from 'react-qr-code';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Share2, Download } from 'lucide-react';

interface QRCodeGeneratorProps {
  inviteLink: string;
  title?: string;
  description?: string;
  downloadFileName?: string;
}

const QR_SIZE = 212;
const QR_COLORS = {
  background: '#ffffff',
  foreground: '#111827',
};

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  inviteLink,
  title = 'Mã QR mời cử tri',
  description,
  downloadFileName = 'holihu-qr-invite',
}) => {
  const qrId = useId();

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById(qrId) as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(
      new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }),
    );
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = QR_SIZE;
      canvas.height = QR_SIZE;
      if (ctx) {
        ctx.fillStyle = QR_COLORS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      URL.revokeObjectURL(svgUrl);
      const downloadLink = document.createElement('a');
      downloadLink.download = `${downloadFileName}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;
  };

  return (
    <div className="w-full rounded-[18px] border border-[var(--clay-border)] bg-white p-4 shadow-[var(--clay-shadow)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-black">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">{description}</p>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[260px] items-center justify-center rounded-[16px] border border-[var(--clay-border-light)] bg-white p-4">
        <QRCode
          id={qrId}
          value={inviteLink}
          size={QR_SIZE}
          bgColor={QR_COLORS.background}
          fgColor={QR_COLORS.foreground}
          level="M"
          className="block h-auto max-w-full bg-white"
          style={{ backgroundColor: QR_COLORS.background }}
        />
      </div>

      <Input
        value={inviteLink}
        readOnly
        aria-label="Đường dẫn QR"
        className="mt-4 h-11 truncate border-[var(--clay-border)] bg-white text-sm text-[var(--clay-text)]"
        onClick={(event) => event.currentTarget.select()}
      />

      <div className="mt-4 flex flex-col gap-3">
        <Button
          type="button"
          onClick={handleCopyLink}
          className="h-auto min-h-10 w-full min-w-0 whitespace-normal px-3 py-2.5 leading-5"
        >
          <Share2 className="h-4 w-4" />
          <span className="min-w-0 text-center">Sao chép liên kết</span>
        </Button>
        <Button
          type="button"
          onClick={handleDownloadQR}
          variant="outline"
          className="h-auto min-h-10 w-full min-w-0 whitespace-normal px-3 py-2.5 leading-5"
        >
          <Download className="h-4 w-4" />
          <span className="min-w-0 text-center">Tải mã QR</span>
        </Button>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
