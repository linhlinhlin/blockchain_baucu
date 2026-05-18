import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Plus, Search, ShieldCheck, Vote, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { listElectionV1Groups, type ElectionV1GroupListItem } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import { getErrorMessage, shortenAddress, formatUnix, getPhaseLabel, phaseClasses, normalizeAddress } from '../utils/electionHelpers';

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

      const matchesOwner = !mineOnly || knownWallets.size === 0 || knownWallets.has(normalizeAddress(item.admin));
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

  return (
    <div className="space-y-6">
      <div className="clay-section p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="clay-badge bg-[rgba(59,211,253,0.26)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Danh sách ballot
            </div>
            <div>
              <h1 className="clay-display text-4xl font-bold leading-tight text-black md:text-6xl">
                Quản lý ballot theo trạng thái thật.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--clay-muted)]">
                Mỗi ballot group đại diện cho một đợt bầu cử. Các chức vụ bên trong được tách
                thành từng election để dễ kiểm chứng, dễ theo dõi và hạn chế thao tác nhầm.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--clay-muted)]">
              <span className="clay-pill px-3 py-1">
                Người dùng: {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'}
              </span>
              <span className="clay-pill px-3 py-1">
                Ví: {shortenAddress(currentAccount ?? currentUser?.diaChiVi)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="clay-button clay-button--matcha inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Wallet className="h-4 w-4" />
              {currentAccount ? 'Đổi / kết nối lại MetaMask' : 'Kết nối MetaMask'}
            </button>
            <Link
              to="/app/tao-phien-bau-cu"
              className="clay-button clay-button--blueberry inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Tạo ballot mới
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="clay-panel bg-[rgba(248,204,101,0.24)] p-5">
          <p className="text-sm text-[var(--clay-muted)]">Tổng ballot</p>
          <p className="mt-2 text-3xl font-semibold text-black">{stats.total}</p>
        </div>
        <div className="clay-panel bg-[rgba(193,176,255,0.22)] p-5">
          <p className="text-sm text-[var(--clay-muted)]">Sắp diễn ra</p>
          <p className="mt-2 text-3xl font-semibold text-black">{stats.pending}</p>
        </div>
        <div className="clay-panel bg-[rgba(132,231,165,0.18)] p-5">
          <p className="text-sm text-[var(--clay-muted)]">Đang bỏ phiếu</p>
          <p className="mt-2 text-3xl font-semibold text-black">{stats.commit + stats.reveal}</p>
        </div>
        <div className="clay-panel bg-[rgba(252,121,129,0.16)] p-5">
          <p className="text-sm text-[var(--clay-muted)]">Đã kết thúc</p>
          <p className="mt-2 text-3xl font-semibold text-black">{stats.ended}</p>
        </div>
      </div>

      <div className="clay-panel clay-panel-dashed p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--clay-muted)]" />
            <input
              type="search"
              name="ballot-search"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo tên ballot, mô tả hoặc group key…"
              className="clay-input py-3 pl-10 pr-4"
            />
          </div>

          <label className="inline-flex items-center gap-3 rounded-[20px] border border-[var(--clay-border)] bg-white px-4 py-3 text-sm text-[var(--clay-text)] shadow-[var(--clay-shadow)]">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--clay-border)] text-[var(--clay-blueberry)]"
            />
            Chỉ hiện ballot của tôi
          </label>
        </div>

        <div aria-live="polite" className="mt-4 rounded-[20px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.76)] px-4 py-3 text-sm text-[var(--clay-muted)] shadow-[var(--clay-shadow)]">
          {message}
        </div>
      </div>

      {loading ? (
        <div role="status" className="clay-panel p-8 text-center text-[var(--clay-muted)]">
          Đang tải danh sách ballot…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="clay-panel p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(248,204,101,0.3)]">
            <Vote className="h-7 w-7 text-[var(--clay-lemon-deep)]" />
          </div>
          <h3 className="text-xl font-semibold text-black">Không tìm thấy ballot nào</h3>
          <p className="mt-2 text-[var(--clay-muted)]">Hãy tạo một ballot mới hoặc tắt bộ lọc "chỉ của tôi".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const phase = getPhaseLabel(item);
            const firstPosition = item.positions[0];
            return (
              <div key={item.groupKey} className="clay-panel p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-black">{item.title}</h3>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${phaseClasses(phase)}`}>
                      {phase}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-[var(--clay-muted)]">{item.description || 'Không có mô tả.'}</p>

                  <div className="grid gap-2 text-sm text-[var(--clay-muted)] sm:grid-cols-2">
                    <p>Admin: {shortenAddress(item.admin)}</p>
                    <p>Group key: {item.groupKey}</p>
                    <p>Kết thúc commit: {formatUnix(item.commitEnd)}</p>
                    <p>Kết thúc reveal: {formatUnix(item.revealEnd)}</p>
                    <p>Số chức vụ: {item.positionCount}</p>
                    <p>Số cử tri: {item.voterCount}</p>
                  </div>

                  <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.78)] p-4 shadow-[var(--clay-shadow)]">
                    <p className="mb-3 text-sm font-semibold text-black">Chức vụ trong ballot</p>
                    <div className="space-y-2">
                      {item.positions.map((position) => (
                        <div key={position.address} className="flex items-center justify-between gap-4 text-sm text-[var(--clay-muted)]">
                          <span>{position.positionTitle || position.title}</span>
                          <span>{position.candidates.length} ứng viên</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!firstPosition}
                    onClick={() =>
                      navigate(`/app/quan-ly-smart-contract?group=${encodeURIComponent(item.groupKey)}&election=${firstPosition.address}`)
                    }
                    className="clay-button clay-button--blueberry inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Xem ballot
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
