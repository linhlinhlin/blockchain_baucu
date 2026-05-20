import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Search, Vote, Wallet } from 'lucide-react';
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
  Button,
  DataTable,
  EmptyState,
  Loader,
  Panel,
  StatusBadge,
  type Column,
  type StatusTone,
} from '../components/ui/clay';

// Đợt 10 (spec 010) US5 — phaseClasses tự chế thay bằng StatusBadge tone ngữ nghĩa.
function phaseTone(phase: string): StatusTone {
  if (phase === 'Đang bỏ phiếu') return 'info';
  if (phase === 'Kiểm phiếu') return 'warning';
  if (phase === 'Chờ bắt đầu') return 'neutral';
  return 'success';
}

export default function CuocBauCuCuaNguoiDungPage() {
  const navigate = useNavigate();
  const { currentAccount, connectWallet } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  const [items, setItems] = useState<ElectionV1GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Đang tải danh sách ballot…');
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
      setMessage(`Đã tải ${response.length} nhóm ballot từ ElectionV1.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.groupKey.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOwner =
        !mineOnly || knownWallets.size === 0 || knownWallets.has(normalizeAddress(item.admin));
      return matchesSearch && matchesOwner;
    });
  }, [items, mineOnly, knownWallets, searchTerm]);

  const stats = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        const phase = getPhaseLabel(item);
        acc.total++;
        if (phase === 'Chờ bắt đầu') acc.pending++;
        else if (phase === 'Đang bỏ phiếu') acc.commit++;
        else if (phase === 'Kiểm phiếu') acc.reveal++;
        else acc.ended++;
        return acc;
      },
      { total: 0, pending: 0, commit: 0, reveal: 0, ended: 0 },
    );
  }, [filteredItems]);

  // Đợt 10 US5 — DataTable client-side (sort/filter-phase/paginate). KHÔNG đổi API.
  const columns: Column<ElectionV1GroupListItem>[] = [
    {
      key: 'title',
      header: 'Ballot',
      sortable: true,
      value: (r) => r.title,
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--clay-text)]">{r.title}</p>
          <p className="truncate text-[12px] text-[var(--clay-muted)]">
            {r.description || 'Không có mô tả'}
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
        const p = getPhaseLabel(r);
        return <StatusBadge tone={phaseTone(p)}>{p}</StatusBadge>;
      },
    },
    {
      key: 'admin',
      header: 'Admin',
      sortable: true,
      value: (r) => r.admin,
      render: (r) => (
        <span className="font-mono text-[12px]">{shortenAddress(r.admin)}</span>
      ),
    },
    {
      key: 'positionCount',
      header: 'Chức vụ',
      sortable: true,
      align: 'right',
      value: (r) => r.positionCount,
    },
    {
      key: 'voterCount',
      header: 'Cử tri',
      sortable: true,
      align: 'right',
      value: (r) => r.voterCount,
    },
    {
      key: 'commitEnd',
      header: 'Kết thúc commit',
      sortable: true,
      value: (r) => r.commitEnd,
      render: (r) => <span className="text-[12px]">{formatUnix(r.commitEnd)}</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (r) => {
        const firstPosition = r.positions[0];
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!firstPosition}
            onClick={() =>
              navigate(
                `/app/dashboard?group=${encodeURIComponent(r.groupKey)}&election=${firstPosition.address}`,
              )
            }
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            Xem
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
            Danh sách bầu cử
          </h1>
          <p className="mt-1 text-[15px] text-[var(--clay-muted)]">
            Mỗi ballot group là một đợt bầu cử; các chức vụ tách thành election riêng để dễ kiểm
            chứng.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge tone="neutral">
              {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'}
            </StatusBadge>
            <StatusBadge tone={currentAccount ? 'success' : 'neutral'}>
              Ví: {shortenAddress(currentAccount ?? currentUser?.diaChiVi)}
            </StatusBadge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => void connectWallet()}
            iconLeft={<Wallet className="h-4 w-4" aria-hidden="true" />}
          >
            {currentAccount ? 'Đổi / kết nối lại MetaMask' : 'Kết nối MetaMask'}
          </Button>
          <Link
            to="/app/elections/new"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo bầu cử mới
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Tổng ballot', stats.total],
          ['Sắp diễn ra', stats.pending],
          ['Đang bỏ phiếu', stats.commit + stats.reveal],
          ['Đã kết thúc', stats.ended],
        ].map(([label, value]) => (
          <Panel key={label as string} className="p-5">
            <p className="text-sm text-[var(--clay-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-[var(--clay-text)]">
              {value}
            </p>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              name="ballot-search"
              autoComplete="off"
              aria-label="Tìm ballot"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên ballot, mô tả hoặc group key…"
              className="w-full rounded-[12px] border border-[rgba(0,0,0,0.08)] bg-[var(--clay-surface)] py-3 pl-10 pr-4 text-sm focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--clay-primary-focus)]"
            />
          </div>
          <label className="inline-flex min-h-[44px] items-center gap-3 rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface)] px-4 text-sm text-[var(--clay-text)]">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--clay-border)]"
            />
            Chỉ hiện ballot của tôi
          </label>
        </div>
        <p aria-live="polite" className="mt-3 text-[13px] text-[var(--clay-muted)]">
          {message}
        </p>
      </Panel>

      {loading ? (
        <Panel className="flex justify-center p-10">
          <Loader label="Đang tải danh sách ballot…" />
        </Panel>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Vote className="h-6 w-6" aria-hidden="true" />}
          title="Không tìm thấy ballot nào"
          description='Hãy tạo một ballot mới hoặc tắt bộ lọc "chỉ của tôi".'
          action={
            <Link
              to="/app/elections/new"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)]"
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
          initialSort={{ key: 'commitEnd', dir: 'desc' }}
          empty={<span className="text-sm text-[var(--clay-muted)]">Không có ballot khớp bộ lọc.</span>}
        />
      )}
    </div>
  );
}
