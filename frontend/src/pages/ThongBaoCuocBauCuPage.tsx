import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  History,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Vote,
  WalletCards,
} from 'lucide-react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { listElectionV1Groups, type ElectionV1GroupListItem } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import {
  formatUnix,
  getErrorMessage,
  getPhaseLabel,
  normalizeAddress,
} from '../utils/electionHelpers';
import {
  buildElectionConsolePath,
  buildElectionDetailPath,
  describePositionCount,
  describeVoterCount,
  getElectionGroupMilestone,
  getViewerRoleLabel,
  getViewerRoleTone,
} from '../utils/electionListPresentation';
import {
  Button,
  EmptyState,
  Loader,
  Panel,
  StatusBadge,
  type StatusTone,
} from '../components/ui/clay';

function phaseTone(phase: string): StatusTone {
  if (phase === 'Đang bỏ phiếu') return 'info';
  if (phase === 'Kiểm phiếu') return 'warning';
  if (phase === 'Đã kết thúc') return 'success';
  return 'neutral';
}

function isActive(item: ElectionV1GroupListItem, nowSeconds: number) {
  return nowSeconds >= item.commitStart && nowSeconds < item.revealEnd;
}

function isFinal(item: ElectionV1GroupListItem, nowSeconds: number) {
  return nowSeconds >= item.revealEnd;
}

function signalRank(item: ElectionV1GroupListItem, nowSeconds: number) {
  if (item.viewerRole === 'voter' && isActive(item, nowSeconds)) return 0;
  if (item.viewerRole === 'owner' && isActive(item, nowSeconds)) return 1;
  if (isFinal(item, nowSeconds)) return 2;
  return 3;
}

function buildSignalText(item: ElectionV1GroupListItem, nowSeconds: number) {
  const milestone = getElectionGroupMilestone(item, nowSeconds);
  if (item.viewerRole === 'voter' && isActive(item, nowSeconds)) {
    return `Bạn có quyền bỏ phiếu trong ${item.viewerEligiblePositionCount || 1} chức vụ.`;
  }
  if (item.viewerRole === 'owner' && isActive(item, nowSeconds)) {
    return 'Bạn đang quản trị đợt bầu cử này.';
  }
  if (isFinal(item, nowSeconds)) {
    return 'Kết quả đã có thể đối chiếu cùng nhật ký blockchain.';
  }
  return `${milestone.label}: ${formatUnix(milestone.timestamp)}.`;
}

function matchesSearch(item: ElectionV1GroupListItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    item.title,
    item.description,
    item.groupKey,
    item.admin,
    ...item.positions.map((position) => position.positionTitle ?? position.title),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function statusSummary(items: ElectionV1GroupListItem[], nowSeconds: number) {
  return items.reduce(
    (acc, item) => {
      if (isActive(item, nowSeconds)) acc.active += 1;
      if (isFinal(item, nowSeconds)) acc.finalized += 1;
      if (item.viewerRole === 'owner') acc.managed += 1;
      if (item.viewerRole === 'voter') acc.eligible += 1;
      return acc;
    },
    { active: 0, finalized: 0, managed: 0, eligible: 0 },
  );
}

export default function ElectionNotifications() {
  const { currentAccount, connectWallet } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  const [items, setItems] = useState<ElectionV1GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const viewerAddress = useMemo(
    () => normalizeAddress(currentAccount ?? currentUser?.diaChiVi),
    [currentAccount, currentUser?.diaChiVi],
  );

  useEffect(() => {
    void load();
  }, [viewerAddress]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await listElectionV1Groups(viewerAddress || null);
      setItems(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const filteredItems = useMemo(() => {
    return [...items]
      .filter((item) => matchesSearch(item, searchTerm))
      .sort((a, b) => {
        const rankDiff = signalRank(a, nowSeconds) - signalRank(b, nowSeconds);
        if (rankDiff !== 0) return rankDiff;
        return getElectionGroupMilestone(a, nowSeconds).timestamp - getElectionGroupMilestone(b, nowSeconds).timestamp;
      });
  }, [items, nowSeconds, searchTerm]);

  const stats = useMemo(() => statusSummary(items, nowSeconds), [items, nowSeconds]);

  return (
    <HelmetProvider>
      <Helmet>
        <title>Thông báo | HoLiHu BlockVote</title>
        <meta
          name="description"
          content="Theo dõi trạng thái, kết quả và nhật ký blockchain của các đợt bầu cử ElectionV1."
        />
        <link rel="canonical" href={`${window.location.origin}/app/notifications`} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--clay-border)] bg-[var(--clay-surface)] px-3 py-1 text-xs font-semibold text-[var(--clay-muted)]">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              Theo dõi ElectionV1
            </div>
            <h1 className="text-[1.75rem] font-semibold text-[var(--clay-text)]">
              Thông báo và lịch sử
            </h1>
            <p className="mt-1 max-w-3xl text-[15px] text-[var(--clay-muted)]">
              Tập trung các mốc cần chú ý, kết quả đã chốt và đường dẫn kiểm chứng giao dịch cho
              các đợt bầu cử bạn quản trị hoặc có quyền bỏ phiếu.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => void connectWallet()}
              iconLeft={<WalletCards className="h-4 w-4" aria-hidden="true" />}
            >
              {currentAccount ? 'Đổi ví' : 'Kết nối ví'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              loading={loading}
              onClick={() => void load()}
              iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              Tải lại
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Đang cần theo dõi', value: stats.active, icon: CalendarClock },
            { label: 'Đã có kết quả', value: stats.finalized, icon: CheckCircle2 },
            { label: 'Tôi quản trị', value: stats.managed, icon: ShieldCheck },
            { label: 'Tôi bỏ phiếu', value: stats.eligible, icon: Vote },
          ].map(({ label, value, icon: Icon }) => (
            <Panel key={label} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--clay-muted)]">{label}</p>
                <Icon className="h-4 w-4 text-[var(--clay-muted)]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-3xl font-semibold text-[var(--clay-text)]">{value}</p>
            </Panel>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--clay-text)]">
                  Dòng sự kiện bầu cử
                </h2>
                <p className="mt-1 text-[13px] text-[var(--clay-muted)]">
                  Sắp xếp theo việc cần xử lý trước, sau đó đến các đợt đã chốt kết quả.
                </p>
              </div>
              <div className="relative w-full md:max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo tên, chức vụ hoặc ví..."
                  aria-label="Tìm thông báo bầu cử"
                  className="w-full rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[var(--clay-surface)] py-3 pl-10 pr-4 text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--clay-primary-focus)]"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader label="Đang tải thông báo..." />
              </div>
            ) : error ? (
              <EmptyState
                icon={<Bell className="h-6 w-6" aria-hidden="true" />}
                title="Chưa tải được thông báo"
                description={error}
                action={
                  <Button type="button" variant="secondary" onClick={() => void load()}>
                    Tải lại
                  </Button>
                }
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-6 w-6" aria-hidden="true" />}
                title="Không có thông báo phù hợp"
                description="Hãy thử đổi từ khóa, kết nối ví hoặc xem danh sách bầu cử đầy đủ."
                action={
                  <Link
                    to="/app/elections"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)]"
                  >
                    Danh sách bầu cử
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[var(--clay-border)]">
                {filteredItems.map((item) => {
                  const phase = getPhaseLabel(item);
                  const milestone = getElectionGroupMilestone(item, nowSeconds);
                  const firstPosition = item.positions[0]?.address;
                  const canOpenConsole = item.viewerRole === 'owner' || item.viewerRole === 'voter';

                  return (
                    <article
                      key={item.groupKey}
                      className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={phaseTone(phase)}>{phase}</StatusBadge>
                          <StatusBadge tone={getViewerRoleTone(item)}>
                            {getViewerRoleLabel(item)}
                          </StatusBadge>
                        </div>
                        <h3 className="truncate text-[17px] font-semibold text-[var(--clay-text)]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--clay-muted)]">
                          {buildSignalText(item, nowSeconds)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[var(--clay-muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                            {describePositionCount(item.positionCount)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            {describeVoterCount(item.voterCount)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            {milestone.label}: {formatUnix(milestone.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
                        <Link
                          to={buildElectionDetailPath(item.groupKey)}
                          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[8px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)]"
                        >
                          Xem bầu cử
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                        {canOpenConsole && (
                          <Link
                            to={buildElectionConsolePath(item.groupKey, firstPosition)}
                            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[8px] bg-[var(--clay-primary)] px-4 text-sm text-white hover:bg-[var(--clay-primary-focus)]"
                          >
                            {item.viewerRole === 'owner' ? 'Vận hành' : 'Bỏ phiếu'}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel>
              <h2 className="text-[17px] font-semibold text-[var(--clay-text)]">Nơi xem lại</h2>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--state-success)]" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[var(--clay-text)]">Kết quả chức vụ</p>
                    <p className="mt-1 text-[var(--clay-muted)]">
                      Mở trang bầu cử để xem từng chức vụ, ứng viên và số phiếu đã chốt.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <History className="mt-0.5 h-4 w-4 text-[var(--state-info)]" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[var(--clay-text)]">Nhật ký blockchain</p>
                    <p className="mt-1 text-[var(--clay-muted)]">
                      Bảng điều khiển của một bầu cử hiển thị mã giao dịch, QR kiểm chứng và Etherscan.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <WalletCards className="mt-0.5 h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-[var(--clay-text)]">Vai trò theo ví</p>
                    <p className="mt-1 text-[var(--clay-muted)]">
                      Kết nối ví để phân biệt bầu cử bạn quản trị, được mời bỏ phiếu hoặc chỉ xem công khai.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <Link
              to="/app/elections"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--clay-primary)] px-5 text-[15px] text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)]"
            >
              Danh sách bầu cử
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </HelmetProvider>
  );
}
