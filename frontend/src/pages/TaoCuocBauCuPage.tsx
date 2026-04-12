import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, ShieldCheck, Trash2, Users, Vote, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { createElectionV1Group } from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';

type CandidateDraft = {
  id: string;
  displayName: string;
  walletAddress: string;
};

type PositionDraft = {
  id: string;
  title: string;
  description: string;
  candidates: CandidateDraft[];
};

function panelClasses() {
  return 'rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl md:p-6';
}

function inputClasses() {
  return 'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-400/70 focus:bg-white/[0.06]';
}

function actionButtonClasses(tone: 'accent' | 'dark' | 'outline') {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80 disabled:cursor-not-allowed disabled:opacity-40';

  if (tone === 'accent') {
    return `${base} bg-orange-500 text-slate-950 hover:-translate-y-0.5 hover:bg-orange-400`;
  }

  if (tone === 'outline') {
    return `${base} border border-white/15 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:bg-white/10`;
  }

  return `${base} bg-slate-900 text-white hover:-translate-y-0.5 hover:bg-slate-800`;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function splitWalletEntries(value: string) {
  return value
    .split(/[\s,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCandidateDraft(index: number): CandidateDraft {
  return {
    id: `candidate-${Date.now()}-${Math.random()}-${index}`,
    displayName: '',
    walletAddress: '',
  };
}

function createPositionDraft(index: number): PositionDraft {
  return {
    id: `position-${Date.now()}-${Math.random()}-${index}`,
    title: '',
    description: '',
    candidates: [createCandidateDraft(1), createCandidateDraft(2)],
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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
  return 'Co loi khong xac dinh khi tao nhom bau cu.';
}

function messagePanelClasses(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('thanh cong') || normalized.includes('success')) {
    return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50';
  }
  if (normalized.includes('loi') || normalized.includes('error') || normalized.includes('fail')) {
    return 'border-rose-400/40 bg-rose-500/10 text-rose-50';
  }
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50';
}

export default function TaoCuocBauCuPage() {
  const navigate = useNavigate();
  const { currentAccount, connectWallet, ensureNetworkAndToken, isNetworkConnected, isMetaMaskInstalled } =
    useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const accessToken = useSelector((state: RootState) => state.dangNhapTaiKhoan.accessToken);

  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [commitStart, setCommitStart] = useState(toDateTimeLocalValue(new Date(now.getTime() + 60 * 60 * 1000)));
  const [commitEnd, setCommitEnd] = useState(
    toDateTimeLocalValue(new Date(now.getTime() + 25 * 60 * 60 * 1000)),
  );
  const [revealEnd, setRevealEnd] = useState(
    toDateTimeLocalValue(new Date(now.getTime() + 49 * 60 * 60 * 1000)),
  );
  const [voterWalletsInput, setVoterWalletsInput] = useState('');
  const [positions, setPositions] = useState<PositionDraft[]>([createPositionDraft(1), createPositionDraft(2)]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('San sang tao mot ballot gom nhieu chuc vu tren Sepolia.');

  const parsedVoterWallets = useMemo(() => splitWalletEntries(voterWalletsInput), [voterWalletsInput]);
  const scheduleIsValid = useMemo(() => {
    const commitStartValue = Date.parse(commitStart);
    const commitEndValue = Date.parse(commitEnd);
    const revealEndValue = Date.parse(revealEnd);
    return (
      !Number.isNaN(commitStartValue) &&
      !Number.isNaN(commitEndValue) &&
      !Number.isNaN(revealEndValue) &&
      commitStartValue < commitEndValue &&
      commitEndValue < revealEndValue
    );
  }, [commitEnd, commitStart, revealEnd]);

  const normalizedPositions = useMemo(
    () =>
      positions
        .map((position, positionIndex) => ({
          ...position,
          title: position.title.trim(),
          description: position.description.trim(),
          candidates: position.candidates
            .map((candidate, candidateIndex) => ({
              ...candidate,
              displayName: candidate.displayName.trim(),
              walletAddress: candidate.walletAddress.trim(),
              sourceId: `candidate:${slugify(candidate.displayName || `candidate-${candidateIndex + 1}`)}:${candidateIndex + 1}`,
            }))
            .filter((candidate) => candidate.displayName.length > 0),
          positionId: `position:${slugify(position.title || `position-${positionIndex + 1}`)}:${positionIndex + 1}`,
        }))
        .filter((position) => position.title.length > 0),
    [positions],
  );

  const allPositionsValid = normalizedPositions.length > 0 && normalizedPositions.every((position) => position.candidates.length >= 2);

  const canSubmit =
    Boolean(accessToken) &&
    Boolean(currentAccount) &&
    isNetworkConnected &&
    title.trim().length > 0 &&
    parsedVoterWallets.length > 0 &&
    scheduleIsValid &&
    allPositionsValid &&
    !submitting;

  function updatePosition(id: string, patch: Partial<PositionDraft>) {
    setPositions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addPosition() {
    setPositions((current) => [...current, createPositionDraft(current.length + 1)]);
  }

  function removePosition(id: string) {
    setPositions((current) => (current.length <= 1 ? current : current.filter((item) => item.id !== id)));
  }

  function updateCandidate(positionId: string, candidateId: string, patch: Partial<CandidateDraft>) {
    setPositions((current) =>
      current.map((position) =>
        position.id !== positionId
          ? position
          : {
              ...position,
              candidates: position.candidates.map((candidate) =>
                candidate.id === candidateId ? { ...candidate, ...patch } : candidate,
              ),
            },
      ),
    );
  }

  function addCandidate(positionId: string) {
    setPositions((current) =>
      current.map((position) =>
        position.id !== positionId
          ? position
          : {
              ...position,
              candidates: [...position.candidates, createCandidateDraft(position.candidates.length + 1)],
            },
      ),
    );
  }

  function removeCandidate(positionId: string, candidateId: string) {
    setPositions((current) =>
      current.map((position) =>
        position.id !== positionId || position.candidates.length <= 2
          ? position
          : {
              ...position,
              candidates: position.candidates.filter((candidate) => candidate.id !== candidateId),
            },
      ),
    );
  }

  async function ensureWalletReady() {
    if (!isMetaMaskInstalled) {
      throw new Error('May hien tai chua co MetaMask.');
    }

    const account = currentAccount ?? (await connectWallet());
    if (!account) {
      throw new Error('Chua ket noi duoc vi MetaMask.');
    }

    const ready = await ensureNetworkAndToken();
    if (!ready) {
      throw new Error('Vi chua o dung mang Sepolia.');
    }

    return account;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const adminWalletAddress = await ensureWalletReady();
      const payload = {
        adminWalletAddress,
        title: title.trim(),
        description: description.trim() || null,
        groupKey: groupKey.trim() || null,
        commitStart: new Date(commitStart).toISOString(),
        commitEnd: new Date(commitEnd).toISOString(),
        revealEnd: new Date(revealEnd).toISOString(),
        voterWalletAddresses: parsedVoterWallets,
        positions: normalizedPositions.map((position) => ({
          positionId: position.positionId,
          title: position.title,
          description: position.description || null,
          candidates: position.candidates.map((candidate) => ({
            displayName: candidate.displayName,
            sourceId: candidate.sourceId,
            walletAddress: candidate.walletAddress || null,
          })),
        })),
      };

      const response = await createElectionV1Group(payload);
      const firstElectionAddress = response.created.created[0]?.address;
      setMessage(`Tao nhom bau cu thanh cong: ${response.created.groupKey}`);
      if (firstElectionAddress) {
        navigate(`/app/quan-ly-smart-contract?group=${response.created.groupKey}&election=${firstElectionAddress}`);
      } else {
        navigate('/app/quan-ly-smart-contract');
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.32),_rgba(2,6,23,0.96))]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_340px]">
          <div className={panelClasses()}>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-100">
              <Vote className="h-3.5 w-3.5" />
              Group ballot create flow
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Tao mot cuoc bau cu gom nhieu chuc vu</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Moi chuc vu se deploy thanh mot child election tren ElectionV1, nhung nguoi dung chi thay mot ballot
              chung de bo phieu lan luot cho tung vi tri: lop truong, lop pho, bi thu, chi doan truong...
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Current user</p>
                <p className="mt-2 truncate text-lg font-semibold text-white">
                  {currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">JWT</p>
                <p className="mt-2 text-lg font-semibold text-white">{accessToken ? 'ready' : 'missing'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Admin wallet</p>
                <p className="mt-2 text-lg font-semibold text-white">{currentAccount ?? 'not connected'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Network</p>
                <p className="mt-2 text-lg font-semibold text-white">{isNetworkConnected ? 'Sepolia' : 'Mismatch'}</p>
              </div>
            </div>
          </div>

          <div className={panelClasses()}>
            <div className="space-y-3">
              <p className="text-sm font-semibold text-white">Quick actions</p>
              <button type="button" onClick={() => void connectWallet()} className={actionButtonClasses('dark')}>
                <Wallet className="h-4 w-4" />
                {currentAccount ? 'Doi / ket noi lai MetaMask' : 'Ket noi MetaMask'}
              </button>

              <Link to="/app/quan-ly-smart-contract" className={actionButtonClasses('outline')}>
                <ArrowRight className="h-4 w-4" />
                Ve console ElectionV1
              </Link>
            </div>

            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${messagePanelClasses(message)}`}>
              <p className="font-semibold text-white/95">Live status</p>
              <p className="mt-1">{message}</p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">Dieu kien submit</p>
              <ul className="mt-3 space-y-2">
                <li>- Dang nhap app bang JWT.</li>
                <li>- MetaMask dang o Sepolia.</li>
                <li>- It nhat 1 chuc vu, moi chuc vu it nhat 2 ung vien.</li>
                <li>- Co it nhat 1 cu tri duoc whitelist.</li>
                <li>- Lich hop le: commit start &lt; commit end &lt; reveal end.</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className={panelClasses()}>
              <div className="mb-5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-orange-300" />
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Ballot</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Thong tin cuoc bau cu</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Ten cuoc bau cu</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={inputClasses()}
                    placeholder="Bau cu can bo lop Hang Hai K66"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Mo ta</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className={inputClasses()}
                    placeholder="Mo ta ngan ve pham vi va quy tac cua dot bau cu."
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Group key (tuy chon)</span>
                  <input
                    value={groupKey}
                    onChange={(event) => setGroupKey(event.target.value)}
                    className={inputClasses()}
                    placeholder="De trong de backend tu sinh."
                  />
                </label>
              </div>
            </div>

            <div className={panelClasses()}>
              <div className="mb-5 flex items-center gap-3">
                <Users className="h-5 w-5 text-sky-300" />
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Timeline and voters</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Lich va danh sach cu tri</h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Commit start</span>
                  <input type="datetime-local" value={commitStart} onChange={(event) => setCommitStart(event.target.value)} className={inputClasses()} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Commit end</span>
                  <input type="datetime-local" value={commitEnd} onChange={(event) => setCommitEnd(event.target.value)} className={inputClasses()} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Reveal end</span>
                  <input type="datetime-local" value={revealEnd} onChange={(event) => setRevealEnd(event.target.value)} className={inputClasses()} />
                </label>
              </div>

              {!scheduleIsValid && (
                <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  Lich phai thoa man CommitStart &lt; CommitEnd &lt; RevealEnd.
                </div>
              )}

              <label className="mt-5 block space-y-2">
                <span className="text-sm font-medium text-slate-200">Danh sach vi cu tri</span>
                <textarea
                  value={voterWalletsInput}
                  onChange={(event) => setVoterWalletsInput(event.target.value)}
                  rows={5}
                  className={inputClasses()}
                  placeholder="Moi dong mot dia chi vi hoac ngan cach bang dau phay."
                />
              </label>
            </div>

            <div className={panelClasses()}>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Vote className="h-5 w-5 text-violet-300" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Positions</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Chuc vu va ung vien</h2>
                  </div>
                </div>

                <button type="button" onClick={addPosition} className={actionButtonClasses('outline')}>
                  <Plus className="h-4 w-4" />
                  Them chuc vu
                </button>
              </div>

              <div className="space-y-5">
                {positions.map((position, positionIndex) => (
                  <div key={position.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Chuc vu {positionIndex + 1}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{position.title || 'Chua dat ten chuc vu'}</p>
                      </div>
                      <button type="button" onClick={() => removePosition(position.id)} className={actionButtonClasses('outline')}>
                        <Trash2 className="h-4 w-4" />
                        Xoa chuc vu
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Ten chuc vu</span>
                        <input
                          value={position.title}
                          onChange={(event) => updatePosition(position.id, { title: event.target.value })}
                          className={inputClasses()}
                          placeholder="Lop truong"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Mo ta chuc vu</span>
                        <input
                          value={position.description}
                          onChange={(event) => updatePosition(position.id, { description: event.target.value })}
                          className={inputClasses()}
                          placeholder="Bau 1 nguoi cho vai tro nay"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Ung vien cho {position.title || `chuc vu ${positionIndex + 1}`}</p>
                      <button type="button" onClick={() => addCandidate(position.id)} className={actionButtonClasses('outline')}>
                        <Plus className="h-4 w-4" />
                        Them ung vien
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {position.candidates.map((candidate, candidateIndex) => (
                        <div key={candidate.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                          <label className="space-y-2">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Ten ung vien {candidateIndex + 1}</span>
                            <input
                              value={candidate.displayName}
                              onChange={(event) =>
                                updateCandidate(position.id, candidate.id, { displayName: event.target.value })
                              }
                              className={inputClasses()}
                              placeholder="Nguyen Van A"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Vi ung vien (tuy chon)</span>
                            <input
                              value={candidate.walletAddress}
                              onChange={(event) =>
                                updateCandidate(position.id, candidate.id, { walletAddress: event.target.value })
                              }
                              className={inputClasses()}
                              placeholder="0x..."
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeCandidate(position.id, candidate.id)}
                              className={actionButtonClasses('outline')}
                            >
                              <Trash2 className="h-4 w-4" />
                              Xoa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={panelClasses()}>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Summary</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Tom tat payload</h2>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-4">
                  <span>Admin wallet</span>
                  <span className="truncate text-right text-white">{currentAccount ?? 'n/a'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>So chuc vu</span>
                  <span className="text-white">{normalizedPositions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Cu tri hop le</span>
                  <span className="text-white">{parsedVoterWallets.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Mang vi</span>
                  <span className="text-white">{isNetworkConnected ? 'Sepolia' : 'Mismatch'}</span>
                </div>
              </div>
            </div>

            <div className={panelClasses()}>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Submit</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Tao group ballot</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sau khi tao xong, he thong se chuyen sang command center va mo san child election dau tien trong ballot.
              </p>

              <button type="submit" disabled={!canSubmit} className={`${actionButtonClasses('accent')} mt-5 w-full`}>
                {submitting ? 'Dang deploy tren Sepolia...' : 'Tao election tren Sepolia'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
