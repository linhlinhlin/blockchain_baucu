import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  ListChecks,
  Plus,
  QrCode,
  ShieldCheck,
  Vote,
  Wallet,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import SEO from '../components/SEO';
import { listElectionV1Groups, type ElectionV1GroupListItem } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import { useSepoliaWalletSummary } from '../hooks/useSepoliaWalletSummary';
import type { RootState } from '../store/store';
import { getErrorMessage, shortenAddress, formatUnix, getPhaseLabel, phaseClasses, normalizeAddress } from '../utils/electionHelpers';

export default function HomePage() {
  const { currentAccount, connectWallet } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  const [items, setItems] = useState<ElectionV1GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Đang tải dashboard…');

  const primaryWallet = currentAccount ?? currentUser?.diaChiVi ?? null;
  const walletSummary = useSepoliaWalletSummary(primaryWallet);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await listElectionV1Groups();
      setItems(response);
      setMessage(`Đã tải ${response.length} nhóm ballot từ Sepolia.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const knownWallets = useMemo(() => {
    const values = [currentAccount, currentUser?.diaChiVi].map(normalizeAddress).filter(Boolean);
    return new Set(values);
  }, [currentAccount, currentUser?.diaChiVi]);

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const phase = getPhaseLabel(item);
        acc.total += 1;
        acc.positions += item.positionCount;
        acc.voters = Math.max(acc.voters, item.voterCount);
        if (phase === 'Chờ bắt đầu') acc.pending += 1;
        else if (phase === 'Đang bỏ phiếu') acc.commit += 1;
        else if (phase === 'Kiểm phiếu') acc.reveal += 1;
        else acc.ended += 1;
        if (knownWallets.has(normalizeAddress(item.admin))) {
          acc.mine += 1;
        }
        return acc;
      },
      { total: 0, positions: 0, voters: 0, pending: 0, commit: 0, reveal: 0, ended: 0, mine: 0 },
    );
  }, [items, knownWallets]);

  const recentItems = useMemo(() => items.slice(0, 6), [items]);
  const nextActions = [
    {
      to: '/app/tao-phien-bau-cu',
      title: 'Tạo ballot',
      description: 'Tạo đợt bầu cử, chức vụ, ứng viên và danh sách cử tri trong một luồng.',
      icon: <Plus className="h-5 w-5" />,
      tone: 'bg-[var(--clay-primary-light)]',
    },
    {
      to: '/app/user-elections',
      title: 'Theo dõi ballot',
      description: 'Xem trạng thái chờ, bỏ phiếu, kiểm phiếu và đã kết thúc.',
      icon: <ListChecks className="h-5 w-5" />,
      tone: 'bg-[var(--clay-primary-light)]',
    },
    {
      to: '/app/quet-ma-qr',
      title: 'Quét QR / OTP',
      description: 'Xác thực lời mời và liên kết ví cho cử tri trước khi bỏ phiếu.',
      icon: <QrCode className="h-5 w-5" />,
      tone: 'bg-[var(--clay-primary-light)]',
    },
  ];

  return (
    <div className="space-y-6">
      <SEO
        title="Dashboard ElectionV1 | HoLiHu BlockVote"
        description="Dashboard active path cho hệ thống bầu cử blockchain trên Ethereum Sepolia."
        url={window.location.href}
      />

      <section className="clay-section p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="clay-badge">
              <ShieldCheck className="h-3.5 w-3.5" />
              Đang hoạt động: ElectionV1
            </div>
            <div>
              <h1 className="clay-display text-4xl font-bold leading-tight text-balance text-black md:text-6xl">
                Việc cần làm tiếp theo, không phải một dashboard rối.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--clay-muted)]">
                Màn hình này ưu tiên hành động theo ngữ cảnh: tạo ballot, xác thực cử tri,
                theo dõi trạng thái và mở trung tâm điều khiển ElectionV1 trên Sepolia khi cần.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--clay-muted)]">
              <span className="clay-pill px-3 py-1">Người dùng: {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'}</span>
              <span className="clay-pill px-3 py-1">Ví: {shortenAddress(primaryWallet)}</span>
              <span className="clay-pill px-3 py-1">Số dư: {walletSummary.balance ?? 'n/a'} ETH</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="clay-button clay-button--matcha inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Wallet className="h-4 w-4" />
              {currentAccount ? 'Kết nối lại MetaMask' : 'Kết nối MetaMask'}
            </button>
            <Link
              to="/app/tao-phien-bau-cu"
              className="clay-button clay-button--blueberry inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Tạo ballot mới
            </Link>
            <Link
              to="/app/user-elections"
              className="clay-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Layers3 className="h-4 w-4" />
              Xem nhóm ballot
            </Link>
            <Link
              to="/app/quan-ly-smart-contract"
              className="clay-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Vote className="h-4 w-4" />
              Trung tâm điều khiển
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {nextActions.map((action) => (
          <Link key={action.to} to={action.to} className="ux-action-card p-5">
            <div className="flex h-full items-start gap-4">
              <div
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[var(--clay-border)] ${action.tone}`}
              >
                {action.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold tracking-[-0.035em] text-black">
                  {action.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-[var(--clay-blueberry)]" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Tổng ballot</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">{stats.total}</p>
        </div>
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Của tôi</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">{stats.mine}</p>
        </div>
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Đang bỏ phiếu</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">{stats.commit}</p>
        </div>
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Kiểm phiếu</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">{stats.reveal}</p>
        </div>
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Đã kết thúc</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">{stats.ended}</p>
        </div>
        <div className="clay-panel bg-white p-5">
          <p className="text-sm text-[var(--clay-muted)]">Vị trí / cử tri max</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-black">
            {stats.positions} / {stats.voters}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="clay-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="clay-badge">
                <Vote className="h-3.5 w-3.5" />
                Ballot gần đây
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-black">Nhóm ballot gần đây</h2>
              <p aria-live="polite" className="mt-2 text-sm text-[var(--clay-muted)]">{message}</p>
            </div>
            <Link to="/app/user-elections" className="clay-link">
              Xem tất cả
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {loading ? (
              <div role="status" className="clay-panel clay-panel-dashed md:col-span-2 p-6 text-sm text-[var(--clay-muted)]">
                Đang tải danh sách ballot…
              </div>
            ) : recentItems.length === 0 ? (
              <div className="clay-panel clay-panel-dashed md:col-span-2 p-6 text-sm text-[var(--clay-muted)]">
                Chưa có ballot nào. Tạo ballot đầu tiên từ trang Tạo phiên bầu cử.
              </div>
            ) : (
              recentItems.map((item) => {
                const phase = getPhaseLabel(item);
                const firstPosition = item.positions[0];
                const targetHref = firstPosition
                  ? `/app/quan-ly-smart-contract?group=${encodeURIComponent(item.groupKey)}&election=${encodeURIComponent(firstPosition.address)}`
                  : '/app/quan-ly-smart-contract';

                return (
                  <Link
                    key={item.groupKey}
                    to={targetHref}
                    className="clay-panel clay-panel-hover flex h-full flex-col gap-4 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-black">{item.title}</h3>
                        <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-[var(--clay-muted)]">
                          {item.groupKey}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${phaseClasses(phase)}`}>
                        {phase}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm text-[var(--clay-muted)]">
                      {item.description || 'Không có mô tả.'}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-[var(--clay-border)] bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--clay-muted)]">Chức vụ</p>
                        <p className="mt-1 text-lg font-semibold text-black">{item.positionCount}</p>
                      </div>
                      <div className="rounded-[18px] border border-[var(--clay-border)] bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--clay-muted)]">Cử tri</p>
                        <p className="mt-1 text-lg font-semibold text-black">{item.voterCount}</p>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-[var(--clay-muted)]">
                      <div className="flex items-center justify-between gap-3">
                        <span>Admin</span>
                        <span className="font-medium text-[var(--clay-text)]">{shortenAddress(item.admin)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Bắt đầu bỏ phiếu</span>
                        <span className="font-medium text-[var(--clay-text)]">{formatUnix(item.commitStart)}</span>
                      </div>
                    </div>

                    <div className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-[var(--clay-blueberry)]">
                      Xem ballot
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="clay-panel p-5">
            <div className="clay-badge">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Wallet status
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-black">Trạng thái ví Sepolia</h2>

            <div className="mt-4 space-y-3 text-sm text-[var(--clay-muted)]">
              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--clay-border)] bg-white px-4 py-3">
                <span>Ví đang kết nối</span>
                <span className="font-medium text-[var(--clay-text)]">{shortenAddress(currentAccount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--clay-border)] bg-white px-4 py-3">
                <span>Số dư</span>
                <span className="font-medium text-[var(--clay-text)]">
                  {walletSummary.isLoading ? 'Đang tải...' : walletSummary.balance ?? 'n/a'} ETH
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--clay-border)] bg-white px-4 py-3">
                <span>Mạng</span>
                <span className="font-medium text-[var(--clay-text)]">
                  {walletSummary.publicConfig?.chainId === 11155111 ? 'Ethereum Sepolia' : 'n/a'}
                </span>
              </div>
            </div>

            {walletSummary.error && (
              <div className="mt-4 rounded-[18px] border border-[rgba(252,121,129,0.25)] bg-[rgba(252,121,129,0.12)] px-4 py-3 text-sm text-[var(--clay-text)]">
                {walletSummary.error}
              </div>
            )}
          </div>

          <div className="clay-panel p-5">
            <div className="clay-badge">
              <Clock3 className="h-3.5 w-3.5" />
              Vận hành
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-black">Checklist hệ thống</h2>
            <ul className="mt-4 space-y-3 text-sm text-[var(--clay-muted)]">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay-matcha)]" />
                Đăng nhập thường và đăng nhập MetaMask đã tách khỏi flow cũ.
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay-matcha)]" />
                Tạo ballot mới và QR/OTP roster đã đi vào ElectionV1.
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--clay-matcha)]" />
                Commit, reveal và finalize được quản lý trong trung tâm điều khiển.
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-3">
              <Link
                to="/app/tao-phien-bau-cu"
                className="clay-button clay-button--blueberry inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Tạo đợt bầu mới
              </Link>
              <Link
                to="/app/quet-ma-qr"
                className="clay-button inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
              >
                <ShieldCheck className="h-4 w-4" />
                Quét mã QR / OTP
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
