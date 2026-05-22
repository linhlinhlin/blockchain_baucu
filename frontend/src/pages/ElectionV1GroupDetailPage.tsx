import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Hash,
  ListChecks,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
} from 'lucide-react';
import {
  getElectionV1GroupDetail,
  type ElectionV1GroupDetail,
  type ElectionV1ListItem,
} from '../api/electionV1Api';
import {
  Button,
  EmptyState,
  Loader,
  Panel,
  StatusBadge,
  type StatusTone,
} from '../components/ui/clay';
import { formatUnix, getErrorMessage, getPhaseLabel, normalizeAddress, shortenAddress } from '../utils/electionHelpers';
import {
  buildElectionConsolePath,
  describeGroupPositions,
  describePositionCount,
  describeVoterCount,
  getElectionGroupMilestone,
  getViewerRoleLabel,
  getViewerRoleTone,
} from '../utils/electionListPresentation';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import {
  DEFAULT_SEPOLIA_EXPLORER_BASE_URL,
  buildExplorerTransactionUrl,
  isTransactionHash,
} from '../utils/transactionVerification';

function decodeRouteParam(value?: string) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function phaseTone(label: string): StatusTone {
  if (label === 'Đang bỏ phiếu') return 'info';
  if (label === 'Kiểm phiếu') return 'warning';
  if (label === 'Chờ bắt đầu') return 'neutral';
  return 'success';
}

function formatCreatedAt(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildContractUrl(address: string, fallback?: string | null) {
  return fallback || `${DEFAULT_SEPOLIA_EXPLORER_BASE_URL}/address/${address}`;
}

function buildTxUrl(txHash?: string | null, fallback?: string | null) {
  if (fallback) return fallback;
  return txHash && isTransactionHash(txHash) ? buildExplorerTransactionUrl(txHash) : null;
}

function DetailMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-[var(--clay-border)] p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase text-[var(--clay-muted)]">{label}</p>
        <span className="text-[var(--clay-muted)]" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-2 truncate text-[18px] font-semibold text-[var(--clay-text)]" title={String(value)}>
        {value}
      </p>
    </div>
  );
}

function PositionCard({ position, index }: { position: ElectionV1ListItem; index: number }) {
  const contractUrl = buildContractUrl(position.address, position.links?.contract);
  const txUrl = buildTxUrl(position.txHash, position.links?.transaction);

  return (
    <article className="rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">Chức vụ {index + 1}</StatusBadge>
            <h3 className="text-[17px] font-semibold text-[var(--clay-text)]">
              {position.positionTitle || position.title}
            </h3>
          </div>
          {position.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--clay-muted)]">
              {position.description}
            </p>
          )}
          <p className="mt-3 break-all font-mono text-[12px] text-[var(--clay-muted)]">
            {position.address}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] border border-[var(--clay-border)] px-3 text-[13px] text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            Hợp đồng
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[10px] border border-[var(--clay-border)] px-3 text-[13px] text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
            >
              Giao dịch tạo
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {position.candidates.map((candidate, candidateIndex) => (
          <div
            key={candidate.candidateId || `${position.address}-${candidateIndex}`}
            className="rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-3"
          >
            <p className="text-[12px] font-semibold uppercase text-[var(--clay-muted)]">
              Ứng viên {candidateIndex + 1}
            </p>
            <p className="mt-1 font-semibold text-[var(--clay-text)]">{candidate.displayName}</p>
            <p className="mt-1 truncate font-mono text-[12px] text-[var(--clay-muted)]" title={candidate.walletAddress ?? candidate.candidateId}>
              {candidate.walletAddress ? shortenAddress(candidate.walletAddress) : candidate.sourceId || candidate.candidateId}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function ElectionV1GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentAccount } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const groupIdentifier = decodeRouteParam(id);
  const viewerAddress = useMemo(
    () => normalizeAddress(currentAccount ?? currentUser?.diaChiVi),
    [currentAccount, currentUser?.diaChiVi],
  );
  const [detail, setDetail] = useState<ElectionV1GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!groupIdentifier) {
        setError('Không tìm thấy mã bầu cử.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await getElectionV1GroupDetail(groupIdentifier, viewerAddress || null);
        if (active) {
          setDetail(response);
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err));
          setDetail(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [groupIdentifier, viewerAddress]);

  const phase = detail ? getPhaseLabel(detail) : 'Chờ bắt đầu';
  const milestone = detail ? getElectionGroupMilestone(detail) : null;
  const consolePath = useMemo(() => {
    if (!detail) return '/app/dashboard';
    return buildElectionConsolePath(detail.groupKey, detail.positions[0]?.address);
  }, [detail]);
  const consoleActionLabel =
    detail?.viewerRole === 'owner'
      ? 'Mở bảng điều khiển vận hành'
      : detail?.viewerRole === 'voter'
        ? 'Vào bỏ phiếu'
        : 'Xem kết quả và nhật ký';

  if (loading) {
    return (
      <Panel className="flex min-h-[360px] items-center justify-center">
        <Loader label="Đang tải chi tiết bầu cử..." />
      </Panel>
    );
  }

  if (error || !detail) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-6 w-6" aria-hidden="true" />}
        title="Không mở được bầu cử"
        description={error ?? 'Bầu cử không còn tồn tại hoặc chưa được đồng bộ từ ElectionV1.'}
        action={
          <Link
            to="/app/elections"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Về danh sách bầu cử
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 text-[var(--clay-text)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <Link
            to="/app/elections"
            className="inline-flex min-h-[34px] items-center gap-2 rounded-[10px] text-sm text-[var(--clay-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Danh sách bầu cử
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge tone={phaseTone(phase)}>{phase}</StatusBadge>
            <StatusBadge tone="info">ElectionV1 · Sepolia</StatusBadge>
            <StatusBadge tone={getViewerRoleTone(detail)}>{getViewerRoleLabel(detail)}</StatusBadge>
          </div>
          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-[var(--clay-text)]">
            {detail.title}
          </h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--clay-muted)]">
            {detail.description || 'Bầu cử chưa có mô tả.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => navigate(consolePath)}
            iconLeft={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            {consoleActionLabel}
          </Button>
          <Link
            to="/app/elections/new"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            Tạo bầu cử mới
          </Link>
        </div>
      </div>

      <Panel padded={false} className="overflow-hidden">
        <div className="grid md:grid-cols-4">
          <DetailMetric label="Chức vụ" value={describePositionCount(detail.positionCount)} icon={<ListChecks className="h-4 w-4" />} />
          <DetailMetric label="Cử tri" value={describeVoterCount(detail.voterCount)} icon={<Users className="h-4 w-4" />} />
          <DetailMetric label="Mốc tiếp theo" value={milestone?.label ?? '—'} icon={<CalendarClock className="h-4 w-4" />} />
          <DetailMetric label="Ví tạo" value={shortenAddress(detail.admin)} icon={<Wallet className="h-4 w-4" />} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Panel>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--clay-primary-light)] text-[var(--clay-primary)]">
                <Vote className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold text-[var(--clay-text)]">Tổng quan</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--clay-muted)]">
                  {describeGroupPositions(detail)}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              {[
                ['Mã bầu cử', detail.groupKey],
                ['Ví tạo', detail.admin],
                ['Block ghi nhận', detail.blockNumber ? String(detail.blockNumber) : '—'],
                ['Ngày tạo', formatCreatedAt(detail.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-[12px] bg-[var(--clay-surface-soft)] p-3">
                  <dt className="text-[12px] font-semibold uppercase text-[var(--clay-muted)]">{label}</dt>
                  <dd className="mt-1 break-all font-medium text-[var(--clay-text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--clay-text)]">Chức vụ và ứng viên</h2>
                <p className="mt-1 text-sm text-[var(--clay-muted)]">
                  Mỗi chức vụ là một hợp đồng ElectionV1 riêng để kiểm chứng kết quả độc lập.
                </p>
              </div>
              <StatusBadge tone="neutral">{describePositionCount(detail.positionCount)}</StatusBadge>
            </div>
            {detail.positions.length > 0 ? (
              <div className="space-y-3">
                {detail.positions.map((position, index) => (
                  <PositionCard key={position.address} position={position} index={index} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ListChecks className="h-6 w-6" aria-hidden="true" />}
                title="Chưa có chức vụ"
                description="Bầu cử này chưa có hợp đồng chức vụ để quản lý."
              />
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
              <h2 className="text-[18px] font-semibold text-[var(--clay-text)]">Trạng thái vận hành</h2>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['Trạng thái', phase],
                ['Mốc tiếp theo', milestone ? `${milestone.label} · ${formatUnix(milestone.timestamp)}` : '—'],
                ['Nhận phiếu từ', formatUnix(detail.commitStart)],
                ['Hết nhận phiếu', formatUnix(detail.commitEnd)],
                ['Hết kiểm phiếu', formatUnix(detail.revealEnd)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-[var(--clay-border)] pb-3 last:border-b-0 last:pb-0">
                  <dt className="text-[var(--clay-muted)]">{label}</dt>
                  <dd className="text-right font-medium text-[var(--clay-text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel>
            <div className="flex items-center gap-3">
              <Hash className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
              <h2 className="text-[18px] font-semibold text-[var(--clay-text)]">Kiểm chứng blockchain</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[var(--clay-muted)]">
              <p>
                Xem hợp đồng từng chức vụ hoặc mã giao dịch tạo bầu cử trên Sepolia để đối chiếu dữ liệu blockchain.
              </p>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => navigate(consolePath)}
                iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                {consoleActionLabel}
              </Button>
              <p className="text-[13px] leading-6 text-[var(--clay-muted)]">
                Kết quả từng chức vụ và nhật ký giao dịch ghi nhận phiếu, mở phiếu, chốt kết quả nằm trong màn
                này để người quản trị và cử tri đối chiếu cùng một nguồn dữ liệu.
              </p>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
