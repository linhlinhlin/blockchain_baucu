import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { getElectionV1PublicConfig, type ElectionV1PublicConfig } from '../api/electionV1Api';
import { Panel, StatusBadge, type StatusTone } from '../components/ui/clay';
import {
  DEFAULT_SEPOLIA_RPC_URL,
  SEPOLIA_CHAIN_ID,
  buildExplorerTransactionUrl,
  buildVerifyTransactionUrl,
  isTransactionHash,
  normalizeChainId,
  normalizeExplorerBaseUrl,
} from '../utils/transactionVerification';

type ReceiptResult = Awaited<ReturnType<ethers.JsonRpcProvider['getTransactionReceipt']>>;
type TransactionResult = Awaited<ReturnType<ethers.JsonRpcProvider['getTransaction']>>;

type TransactionSnapshot = {
  receipt: ReceiptResult;
  transaction: TransactionResult;
  blockTimestamp: number | null;
};

function shorten(value?: string | null, head = 10, tail = 8) {
  if (!value) return 'Chưa có';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp) return 'Chưa xác nhận block';
  return new Date(timestamp * 1000).toLocaleString('vi-VN');
}

function formatSepoliaValue(value?: bigint | null) {
  if (value === null || value === undefined) return '0 SEP';
  const asNumber = Number(ethers.formatEther(value));
  if (!Number.isFinite(asNumber) || asNumber === 0) return '0 SEP';
  return `${asNumber.toLocaleString('vi-VN', { maximumFractionDigits: 8 })} SEP`;
}

function getStatus(snapshot: TransactionSnapshot | null): {
  label: string;
  tone: StatusTone;
  icon: JSX.Element;
  description: string;
} {
  if (!snapshot?.receipt && snapshot?.transaction) {
    return {
      label: 'Đang chờ xác nhận',
      tone: 'warning',
      icon: <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />,
      description: 'Giao dịch đã xuất hiện trên mạng nhưng chưa được ghi vào block.',
    };
  }

  if (!snapshot?.receipt && !snapshot?.transaction) {
    return {
      label: 'Chưa tìm thấy',
      tone: 'neutral',
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      description: 'RPC hiện tại chưa tìm thấy giao dịch này trên Sepolia.',
    };
  }

  if (snapshot.receipt?.status === 1) {
    return {
      label: 'Thành công',
      tone: 'success',
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
      description: 'Giao dịch đã được ghi nhận thành công trên blockchain.',
    };
  }

  return {
    label: 'Thất bại',
    tone: 'danger',
    icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
    description: 'Giao dịch đã lên block nhưng bị revert hoặc không hoàn tất.',
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-[var(--clay-border)] py-3 sm:grid-cols-[150px_minmax(0,1fr)]">
      <dt className="text-xs font-semibold uppercase text-[var(--clay-muted)]">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-sm text-[var(--clay-text)]">{value}</dd>
    </div>
  );
}

export default function VerifyTransactionPage() {
  const [searchParams] = useSearchParams();
  const txHash = searchParams.get('tx')?.trim() ?? '';
  const chainId = normalizeChainId(searchParams.get('chain') ?? searchParams.get('chainId'));
  const [publicConfig, setPublicConfig] = useState<ElectionV1PublicConfig | null>(null);
  const [snapshot, setSnapshot] = useState<TransactionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explorerBaseUrl = useMemo(
    () => normalizeExplorerBaseUrl(publicConfig?.explorerBaseUrl),
    [publicConfig?.explorerBaseUrl],
  );
  const explorerUrl = isTransactionHash(txHash)
    ? buildExplorerTransactionUrl(txHash, explorerBaseUrl)
    : null;
  const verifyUrl = isTransactionHash(txHash)
    ? buildVerifyTransactionUrl(txHash, chainId)
    : '';
  const status = getStatus(snapshot);
  const chainLabel = chainId === SEPOLIA_CHAIN_ID ? 'Ethereum Sepolia' : `Chain ${chainId}`;

  useEffect(() => {
    document.title = 'Kiểm chứng giao dịch | HoLiHu BlockVote';
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadTransaction() {
      setSnapshot(null);
      setError(null);

      if (!isTransactionHash(txHash)) {
        setError('Mã giao dịch không hợp lệ. Vui lòng kiểm tra lại QR hoặc mã tx.');
        return;
      }

      if (chainId !== SEPOLIA_CHAIN_ID) {
        setError('Hệ thống hiện chỉ kiểm chứng giao dịch ElectionV1 trên Ethereum Sepolia.');
        return;
      }

      setLoading(true);
      try {
        let config: ElectionV1PublicConfig | null = null;
        try {
          config = await getElectionV1PublicConfig();
          if (alive) setPublicConfig(config);
        } catch {
          if (alive) setPublicConfig(null);
        }

        const provider = new ethers.JsonRpcProvider(config?.rpcUrl || DEFAULT_SEPOLIA_RPC_URL);
        const [receipt, transaction] = await Promise.all([
          provider.getTransactionReceipt(txHash),
          provider.getTransaction(txHash),
        ]);
        const blockNumber = receipt?.blockNumber ?? transaction?.blockNumber ?? null;
        const block = blockNumber ? await provider.getBlock(blockNumber) : null;

        if (alive) {
          setSnapshot({
            receipt,
            transaction,
            blockTimestamp: block?.timestamp ?? null,
          });
        }
      } catch (loadError) {
        if (alive) {
          const message = loadError instanceof Error ? loadError.message : 'Không thể đọc giao dịch từ Sepolia.';
          setError(message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadTransaction();
    return () => {
      alive = false;
    };
  }, [chainId, txHash]);

  async function copyTxHash() {
    if (!txHash) return;
    await navigator.clipboard.writeText(txHash);
    toast.success('Đã sao chép mã giao dịch.');
  }

  async function copyVerifyUrl() {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    toast.success('Đã sao chép link kiểm chứng.');
  }

  const blockNumber = snapshot?.receipt?.blockNumber ?? snapshot?.transaction?.blockNumber ?? null;
  const fromAddress = snapshot?.transaction?.from ?? snapshot?.receipt?.from ?? null;
  const toAddress = snapshot?.receipt?.contractAddress ?? snapshot?.transaction?.to ?? snapshot?.receipt?.to ?? null;
  const value = snapshot?.transaction?.value ?? null;
  const gasUsed = snapshot?.receipt?.gasUsed ? snapshot.receipt.gasUsed.toString() : 'Chưa có';

  return (
    <main className="min-h-screen bg-[var(--clay-bg)] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--clay-muted)]">HoLiHu BlockVote</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--clay-text)]">
              Kiểm chứng giao dịch
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clay-muted)]">
              Kiểm tra mã tx trên Sepolia trước khi mở trình khám phá blockchain bên ngoài.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex min-h-10 items-center rounded-[12px] border border-[var(--clay-border)] px-4 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
          >
            Về trang chủ
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : status.icon}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--clay-text)]">
                    {loading ? 'Đang đọc blockchain' : status.label}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                    {loading ? 'Đang lấy receipt, block và thông tin giao dịch.' : status.description}
                  </p>
                </div>
              </div>
              <StatusBadge tone={error ? 'danger' : loading ? 'neutral' : status.tone}>
                {error ? 'Cần kiểm tra' : chainLabel}
              </StatusBadge>
            </div>

            {error && (
              <div className="mt-5 rounded-[14px] border border-[var(--state-danger)] bg-[var(--state-danger-soft)] p-4 text-sm leading-6 text-[var(--state-danger)]">
                {error}
              </div>
            )}

            <dl className="mt-6">
              <DetailRow label="Mã tx" value={isTransactionHash(txHash) ? txHash : 'Không hợp lệ'} />
              <DetailRow label="Block" value={blockNumber ? String(blockNumber) : 'Chưa xác nhận'} />
              <DetailRow label="Thời gian" value={formatTimestamp(snapshot?.blockTimestamp)} />
              <DetailRow label="Ví gửi" value={fromAddress ? shorten(fromAddress, 12, 10) : 'Chưa có'} />
              <DetailRow label="Đích đến" value={toAddress ? shorten(toAddress, 12, 10) : 'Chưa có'} />
              <DetailRow label="Giá trị" value={formatSepoliaValue(value)} />
              <DetailRow label="Gas đã dùng" value={gasUsed} />
            </dl>
          </Panel>

          <div className="space-y-5">
            <Panel>
              <div className="flex items-center gap-2 text-[var(--clay-text)]">
                <ShieldCheck className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Đối chiếu</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
                QR này mở lại trang kiểm chứng của HoLiHu. Etherscan là bước đối chiếu ngoài hệ thống.
              </p>
              {verifyUrl && (
                <div className="mt-4 flex justify-center rounded-[14px] border border-[var(--clay-border-light)] bg-white p-3">
                  <QRCode
                    value={verifyUrl}
                    size={178}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                    className="h-auto max-w-full"
                  />
                </div>
              )}
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => void copyTxHash()}
                  disabled={!isTransactionHash(txHash)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clipboard className="h-4 w-4" aria-hidden="true" />
                  Sao chép mã tx
                </button>
                <button
                  type="button"
                  onClick={() => void copyVerifyUrl()}
                  disabled={!verifyUrl}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  Sao chép link kiểm chứng
                </button>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Mở trên Etherscan
                  </a>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
