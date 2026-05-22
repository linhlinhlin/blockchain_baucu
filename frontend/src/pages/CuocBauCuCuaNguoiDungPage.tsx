import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { listElectionV1Groups, type ElectionV1GroupListItem } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import {
  getErrorMessage,
  shortenAddress,
  formatUnix,
  getPhaseLabel,
  normalizeAddress,
} from '../utils/electionHelpers';
import {
  buildElectionConsolePath,
  describeGroupPositions,
  describePositionCount,
  describeVoterCount,
  filterElectionGroups,
  getElectionGroupMilestone,
  getElectionListLoadMessage,
  getElectionListStats,
} from '../utils/electionListPresentation';
import {
  Button,
  DataTable,
  EmptyState,
  Loader,
  Panel,
  StatusBadge,
  type Column,
  type StatusTone,
} from '../components/ui/clay';

function phaseTone(phase: string): StatusTone {
  if (phase === 'Đang bỏ phiếu') return 'info';
  if (phase === 'Kiểm phiếu') return 'warning';
  if (phase === 'Chờ bắt đầu') return 'neutral';
  return 'success';
}

function ownerLabel(item: ElectionV1GroupListItem, knownWallets: ReadonlySet<string>) {
  return knownWallets.has(normalizeAddress(item.admin)) ? 'Bạn tạo' : shortenAddress(item.admin);
}

export default function CuocBauCuCuaNguoiDungPage() {
  const navigate = useNavigate();
  const { currentAccount, connectWallet } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  const [items, setItems] = useState<ElectionV1GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Đang tải danh sách bầu cử...');
  const [searchTerm, setSearchTerm] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const knownWallets = useMemo(() => {
    const values = [currentAccount, currentUser?.diaChiVi].map(normalizeAddress).filter(Boolean);
    return new Set(values);
  }, [currentAccount, currentUser?.diaChiVi]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await listElectionV1Groups();
      setItems(response);
      setMessage(getElectionListLoadMessage(response.length));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(
    () => filterElectionGroups(items, searchTerm, mineOnly, knownWallets),
    [items, knownWallets, mineOnly, searchTerm],
  );

  const stats = useMemo(() => getElectionListStats(filteredItems), [filteredItems]);
  const canFilterMine = knownWallets.size > 0;

  const columns: Column<ElectionV1GroupListItem>[] = [
    {
      key: 'title',
      header: 'Đợt bầu cử',
      sortable: true,
      value: (r) => r.title,
      render: (r) => (
        <div className="min-w-[260px]">
          <p className="font-semibold text-[var(--clay-text)]">{r.title}</p>
          <p className="mt-1 line-clamp-1 text-[12px] text-[var(--clay-muted)]">
            {r.description || 'Chưa có mô tả'}
          </p>
          <p className="mt-2 text-[12px] text-[var(--clay-muted)]">
            {describeGroupPositions(r)}
          </p>
        </div>
      ),
    },
    {
      key: 'phase',
      header: 'Trạng thái',
      filter: 'select',
      value: (r) => getPhaseLabel(r),
      render: (r) => {
        const phase = getPhaseLabel(r);
        return <StatusBadge tone={phaseTone(phase)}>{phase}</StatusBadge>;
      },
    },
    {
      key: 'scale',
      header: 'Quy mô',
      sortable: true,
      value: (r) => r.positionCount * 100000 + r.voterCount,
      render: (r) => (
        <div className="space-y-1 text-[12px] text-[var(--clay-muted)]">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-[var(--clay-text)]">
              {describePositionCount(r.positionCount)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{describeVoterCount(r.voterCount)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'admin',
      header: 'Ví tạo',
      sortable: true,
      value: (r) => r.admin,
      render: (r) => (
        <span className="font-mono text-[12px]" title={r.admin}>
          {ownerLabel(r, knownWallets)}
        </span>
      ),
    },
    {
      key: 'nextMilestone',
      header: 'Mốc tiếp theo',
      sortable: true,
      value: (r) => getElectionGroupMilestone(r).timestamp,
      render: (r) => {
        const milestone = getElectionGroupMilestone(r);
        return (
          <div className="min-w-[170px] text-[12px]">
            <p className="font-medium text-[var(--clay-text)]">{milestone.label}</p>
            <p className="mt-1 text-[var(--clay-muted)]">{formatUnix(milestone.timestamp)}</p>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (r) => {
        const firstPosition = r.positions[0];
        const consolePath = buildElectionConsolePath(r.groupKey, firstPosition?.address);
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!firstPosition}
            onClick={() => navigate(consolePath)}
            aria-label={`Mở bảng điều khiển cho ${r.title}`}
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            Mở điều khiển
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold text-[var(--clay-text)]">
            Danh sách bầu cử
          </h1>
          <p className="mt-1 max-w-3xl text-[15px] text-[var(--clay-muted)]">
            Theo dõi các đợt đã triển khai trên Sepolia, kiểm tra trạng thái và mở bảng điều
            khiển khi cần commit, kiểm phiếu hoặc xem kết quả.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge tone="neutral">
              {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'Chưa có tài khoản'}
            </StatusBadge>
            <StatusBadge tone={currentAccount ? 'success' : 'neutral'}>
              Ví đang dùng: {shortenAddress(currentAccount ?? currentUser?.diaChiVi)}
            </StatusBadge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="whitespace-nowrap"
            onClick={() => void connectWallet()}
            iconLeft={<Wallet className="h-4 w-4" aria-hidden="true" />}
          >
            {currentAccount ? 'Đổi ví' : 'Kết nối ví'}
          </Button>
          <Link
            to="/app/elections/new"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[8px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo bầu cử mới
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Tất cả đợt', value: stats.total, icon: Vote },
          { label: 'Sắp mở', value: stats.pending, icon: CalendarClock },
          { label: 'Đang xử lý', value: stats.commit + stats.reveal, icon: ShieldCheck },
          { label: 'Hoàn tất', value: stats.ended, icon: ListChecks },
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

      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-2xl flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              name="election-search"
              autoComplete="off"
              aria-label="Tìm đợt bầu cử"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên, mô tả, chức vụ hoặc ví tạo..."
              className="w-full rounded-[8px] border border-[rgba(0,0,0,0.08)] bg-[var(--clay-surface)] py-3 pl-10 pr-4 text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--clay-primary-focus)]"
            />
          </div>
          <label className="inline-flex min-h-[44px] items-center gap-3 rounded-[8px] border border-[var(--clay-border)] bg-[var(--clay-surface)] px-4 text-sm text-[var(--clay-text)]">
            <input
              type="checkbox"
              checked={mineOnly}
              disabled={!canFilterMine}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--clay-border)] disabled:opacity-40"
            />
            Chỉ hiện đợt tôi tạo
          </label>
        </div>
        <p aria-live="polite" className="mt-3 text-[13px] text-[var(--clay-muted)]">
          {!canFilterMine
            ? 'Kết nối hoặc đăng nhập bằng ví để dùng bộ lọc theo ví tạo.'
            : message}
        </p>
      </Panel>

      {loading ? (
        <Panel className="flex justify-center p-10">
          <Loader label="Đang tải danh sách bầu cử..." />
        </Panel>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Vote className="h-6 w-6" aria-hidden="true" />}
          title="Không tìm thấy đợt bầu cử"
          description="Hãy kiểm tra lại từ khóa, tắt bộ lọc theo ví hoặc tạo một đợt bầu cử mới."
          action={
            <Link
              to="/app/elections/new"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[8px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tạo bầu cử mới
            </Link>
          }
        />
      ) : (
        <DataTable
          rows={filteredItems}
          columns={columns}
          pageSize={10}
          getRowKey={(r) => r.groupKey}
          initialSort={{ key: 'nextMilestone', dir: 'desc' }}
          empty={<span className="text-sm text-[var(--clay-muted)]">Không có đợt nào khớp bộ lọc.</span>}
        />
      )}
    </div>
  );
}
