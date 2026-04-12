import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Plus, Search, ShieldCheck, Vote, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { listElectionV1Groups, type ElectionV1GroupListItem } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';

function getErrorMessage(error: unknown) {
  const maybeError = error as any;
  if (maybeError?.response?.data?.Error) {
    return maybeError.response.data.Error;
  }
  if (maybeError?.response?.data?.error) {
    return maybeError.response.data.error;
  }
  if (maybeError instanceof Error) {
    return maybeError.message;
  }
  return 'Khong the tai danh sach nhom bau cu.';
}

function normalizeAddress(value?: string | null) {
  return value?.trim().toLowerCase() ?? '';
}

function shortenAddress(value?: string | null) {
  if (!value) {
    return 'n/a';
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUnix(timestamp?: number | null) {
  if (!timestamp) {
    return 'n/a';
  }

  return new Date(timestamp * 1000).toLocaleString('vi-VN');
}

function getPhaseLabel(item: ElectionV1GroupListItem) {
  const now = Math.floor(Date.now() / 1000);
  if (now < item.commitStart) {
    return 'Pending';
  }
  if (now < item.commitEnd) {
    return 'Commit';
  }
  if (now < item.revealEnd) {
    return 'Reveal';
  }
  return 'Ended';
}

function phaseClasses(label: string) {
  switch (label) {
    case 'Commit':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    case 'Reveal':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
    case 'Ended':
      return 'border-slate-400/30 bg-slate-500/10 text-slate-100';
    default:
      return 'border-violet-400/30 bg-violet-500/10 text-violet-100';
  }
}

export default function CuocBauCuCuaNguoiDungPage() {
  const navigate = useNavigate();
  const { currentAccount, connectWallet } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  const [items, setItems] = useState<ElectionV1GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Dang tai danh sach ballot...');
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
      setMessage(`Da tai ${response.length} ballot group tu ElectionV1.`);
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
        if (phase === 'Pending') acc.pending++;
        else if (phase === 'Commit') acc.commit++;
        else if (phase === 'Reveal') acc.reveal++;
        else acc.ended++;
        return acc;
      },
      { total: 0, pending: 0, commit: 0, reveal: 0, ended: 0 },
    );
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-900/30 bg-gradient-to-r from-gray-900 to-blue-950/40 p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Group ballots
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-white">Quan ly cuoc bau cu</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/80">
                Moi ballot group dai dien cho mot dot bau can bo. Moi chuc vu ben trong se duoc bo phieu tren mot child election rieng.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                User: {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Wallet: {shortenAddress(currentAccount ?? currentUser?.diaChiVi)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void connectWallet()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Wallet className="h-4 w-4" />
              {currentAccount ? 'Doi / ket noi lai MetaMask' : 'Ket noi MetaMask'}
            </button>
            <Link
              to="/app/tao-phien-bau-cu"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Tao ballot moi
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-5">
          <p className="text-sm text-blue-300">Tong ballot</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-5">
          <p className="text-sm text-blue-300">Sap dien ra</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-5">
          <p className="text-sm text-blue-300">Dang bo phieu</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.commit + stats.reveal}</p>
        </div>
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-5">
          <p className="text-sm text-blue-300">Da ket thuc</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats.ended}</p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tim theo ten ballot, mo ta hoac group key..."
              className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <label className="inline-flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(event) => setMineOnly(event.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
            />
            Chi hien ballot cua toi
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-8 text-center text-slate-300">
          Dang tai danh sach ballot...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-blue-900/20 bg-[#162033] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10">
            <Vote className="h-7 w-7 text-yellow-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Khong tim thay ballot nao</h3>
          <p className="mt-2 text-slate-300">Hay tao mot ballot moi hoac tat bo loc "chi cua toi".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const phase = getPhaseLabel(item);
            const firstPosition = item.positions[0];
            return (
              <div key={item.groupKey} className="rounded-2xl border border-blue-900/20 bg-[#162033] p-6 shadow-lg">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${phaseClasses(phase)}`}>
                      {phase}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-slate-300">{item.description || 'Khong co mo ta.'}</p>

                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p>Admin: {shortenAddress(item.admin)}</p>
                    <p>Group key: {item.groupKey}</p>
                    <p>Commit end: {formatUnix(item.commitEnd)}</p>
                    <p>Reveal end: {formatUnix(item.revealEnd)}</p>
                    <p>So chuc vu: {item.positionCount}</p>
                    <p>So cu tri: {item.voterCount}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="mb-3 text-sm font-semibold text-white">Chuc vu trong ballot</p>
                    <div className="space-y-2">
                      {item.positions.map((position) => (
                        <div key={position.address} className="flex items-center justify-between gap-4 text-sm text-slate-300">
                          <span>{position.positionTitle || position.title}</span>
                          <span>{position.candidates.length} ung vien</span>
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mo ballot
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
