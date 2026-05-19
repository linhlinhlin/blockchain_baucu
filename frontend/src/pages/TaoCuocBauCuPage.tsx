import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  Users,
  Vote,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import {
  createElectionV1Group,
  createElectionV1RosterDraft,
  deployElectionV1RosterDraft,
  getElectionV1RosterDraft,
  type ElectionV1CreateRosterDraftRequest,
  type ElectionV1RosterDraft,
} from '../api/electionV1Api';
import QRCodeGenerator from '../components/QRCodeGenerator';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import {
  buildCreateFlowRequirements,
  createCandidateDraft,
  createPositionDraft,
  getDuplicateWalletEntries,
  getFirstInvalidRequirement,
  getInvalidCandidateWallets,
  getInvalidRosterRows,
  getInvalidWalletEntries,
  getScheduleState,
  normalizePositions,
  parseRosterEntries,
  shortenAddress,
  splitWalletEntries,
  toDateTimeLocalValue,
  type CandidateDraft,
  type PositionDraft,
  type Requirement,
  type RosterMode,
} from '../utils/electionCreateFlow';

function panelClasses(extra = '') {
  return `clay-panel p-5 md:p-6 ${extra}`.trim();
}

function inputClasses(extra = '') {
  return `clay-input min-h-11 px-4 py-3 text-sm ${extra}`.trim();
}

function actionButtonClasses(tone: 'accent' | 'outline' = 'outline') {
  const base =
    'clay-button inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)] disabled:cursor-not-allowed disabled:opacity-65';

  if (tone === 'accent') {
    return `${base} clay-button--blueberry`;
  }

  return `${base} clay-button--matcha`;
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
  return 'Có lỗi không xác định khi tạo nhóm bầu cử.';
}

function messagePanelClasses(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('thành công') ||
    normalized.includes('đã tạo') ||
    normalized.includes('đã deploy')
  ) {
    return 'border-[rgba(0,102,204,0.24)] bg-[var(--clay-primary-light)] text-[var(--clay-text)]';
  }
  if (
    normalized.includes('lỗi') ||
    normalized.includes('error') ||
    normalized.includes('fail') ||
    normalized.includes('không') ||
    normalized.includes('chưa') ||
    normalized.includes('cần')
  ) {
    return 'border-[rgba(191,72,0,0.24)] bg-[#fff4ed] text-[var(--clay-text)]';
  }
  return 'border-[var(--clay-border)] bg-[var(--clay-surface-soft)] text-[var(--clay-text)]';
}

function MetricCard({
  label,
  value,
  title,
  mono = false,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <article className="min-w-0 rounded-[18px] border border-[var(--clay-border)] bg-white p-4">
      <p className="clay-label">{label}</p>
      <p
        className={`mt-2 truncate text-lg font-semibold tracking-[-0.01em] text-black ${mono ? 'clay-mono text-base' : ''}`}
        title={title ?? value}
        translate={mono ? 'no' : undefined}
      >
        {value}
      </p>
    </article>
  );
}

function RequirementList({ requirements }: { requirements: Requirement[] }) {
  return (
    <ul className="mt-3 space-y-2" aria-live="polite">
      {requirements.map((requirement) => (
        <li
          key={requirement.id}
          className="grid grid-cols-[auto_1fr] items-start gap-2 text-sm leading-6 text-[var(--clay-muted)]"
        >
          <span
            className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${
              requirement.ok
                ? 'bg-[var(--clay-primary-light)] text-[var(--clay-primary)]'
                : 'bg-[#fff4ed] text-[var(--clay-pomegranate)]'
            }`}
            aria-hidden="true"
          >
            {requirement.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
          </span>
          <span>
            <span className="sr-only">{requirement.ok ? 'Đã đạt: ' : 'Chưa đạt: '}</span>
            {requirement.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-2 flex items-start gap-2 text-sm text-[var(--clay-pomegranate)]">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function SummaryRow({
  label,
  value,
  fullValue,
}: {
  label: string;
  value: string | number;
  fullValue?: string | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-4">
      <span className="text-[var(--clay-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right text-black" title={fullValue ?? String(value)}>
        {value}
      </span>
    </div>
  );
}

function buildSharedRosterInviteUrl(draft: ElectionV1RosterDraft) {
  if (draft.sharedInviteUrl) {
    return draft.sharedInviteUrl;
  }

  const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
  return `${origin}/verify-voter?groupKey=${encodeURIComponent(draft.groupKey)}`;
}

export default function TaoCuocBauCuPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    currentAccount,
    connectWallet,
    ensureNetworkAndToken,
    isNetworkConnected,
    isMetaMaskInstalled,
  } = useWeb3();
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const accessToken = useSelector((state: RootState) => state.dangNhapTaiKhoan.accessToken);

  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [commitStart, setCommitStart] = useState(
    toDateTimeLocalValue(new Date(now.getTime() + 60 * 60 * 1000)),
  );
  const [commitEnd, setCommitEnd] = useState(
    toDateTimeLocalValue(new Date(now.getTime() + 25 * 60 * 60 * 1000)),
  );
  const [revealEnd, setRevealEnd] = useState(
    toDateTimeLocalValue(new Date(now.getTime() + 49 * 60 * 60 * 1000)),
  );
  const [voterMode, setVoterMode] = useState<RosterMode>('wallets');
  const [voterWalletsInput, setVoterWalletsInput] = useState('');
  const [rosterInput, setRosterInput] = useState('');
  const [positions, setPositions] = useState<PositionDraft[]>([
    createPositionDraft(1),
    createPositionDraft(2),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [activeDraft, setActiveDraft] = useState<ElectionV1RosterDraft | null>(null);
  const [message, setMessage] = useState('Sẵn sàng tạo một ballot gồm nhiều chức vụ trên Sepolia.');
  const draftKeyFromUrl = searchParams.get('draft')?.trim() ?? '';

  const parsedVoterWallets = useMemo(
    () => splitWalletEntries(voterWalletsInput),
    [voterWalletsInput],
  );
  const invalidVoterWallets = useMemo(
    () => getInvalidWalletEntries(parsedVoterWallets),
    [parsedVoterWallets],
  );
  const duplicateVoterWallets = useMemo(
    () => getDuplicateWalletEntries(parsedVoterWallets),
    [parsedVoterWallets],
  );
  const parsedRosterVoters = useMemo(() => parseRosterEntries(rosterInput), [rosterInput]);
  const invalidRosterRows = useMemo(
    () => getInvalidRosterRows(parsedRosterVoters),
    [parsedRosterVoters],
  );
  const scheduleState = useMemo(
    () => getScheduleState(commitStart, commitEnd, revealEnd),
    [commitEnd, commitStart, revealEnd],
  );
  const normalizedPositions = useMemo(() => normalizePositions(positions), [positions]);
  const invalidCandidateWallets = useMemo(
    () => getInvalidCandidateWallets(normalizedPositions),
    [normalizedPositions],
  );
  const requirements = useMemo(
    () =>
      buildCreateFlowRequirements({
        accessToken,
        currentAccount,
        isNetworkConnected,
        voterMode,
        title,
        scheduleIsValid: scheduleState.isValid,
        positions: normalizedPositions,
        invalidCandidateWalletCount: invalidCandidateWallets.length,
        voterWalletCount: parsedVoterWallets.length,
        invalidVoterWalletCount: invalidVoterWallets.length,
        duplicateVoterWalletCount: duplicateVoterWallets.length,
        rosterVoterCount: parsedRosterVoters.length,
        invalidRosterRowCount: invalidRosterRows.length,
      }),
    [
      accessToken,
      currentAccount,
      duplicateVoterWallets.length,
      invalidCandidateWallets.length,
      invalidRosterRows.length,
      invalidVoterWallets.length,
      isNetworkConnected,
      normalizedPositions,
      parsedRosterVoters.length,
      parsedVoterWallets.length,
      scheduleState.isValid,
      title,
      voterMode,
    ],
  );
  const firstInvalidRequirement = useMemo(
    () => getFirstInvalidRequirement(requirements),
    [requirements],
  );
  const isReadyToSubmit = !firstInvalidRequirement;
  const showInlineErrors = submitAttempted;

  useEffect(() => {
    if (!draftKeyFromUrl || !accessToken) {
      return;
    }

    if (activeDraft?.groupKey === draftKeyFromUrl) {
      return;
    }

    let active = true;

    async function loadDraft() {
      try {
        const draft = await getElectionV1RosterDraft(draftKeyFromUrl);
        if (!active) {
          return;
        }

        setActiveDraft(draft);
        setVoterMode('roster');
        setGroupKey(draft.groupKey);
        setTitle(draft.title);
        setDescription(draft.description || '');
        setCommitStart(toDateTimeLocalValue(new Date(draft.commitStart)));
        setCommitEnd(toDateTimeLocalValue(new Date(draft.commitEnd)));
        setRevealEnd(toDateTimeLocalValue(new Date(draft.revealEnd)));
        setPositions(
          draft.positions.map((position, positionIndex) => ({
            id: `${position.positionId}-${positionIndex + 1}`,
            title: position.title,
            description: position.description || '',
            candidates: position.candidates.map((candidate, candidateIndex) => ({
              id: `${position.positionId}-candidate-${candidateIndex + 1}`,
              displayName: candidate.displayName,
              walletAddress: candidate.walletAddress || '',
            })),
          })),
        );
        setMessage(`Đã nạp lại bản nháp roster xác thực ${draft.groupKey}.`);
      } catch (error) {
        if (active) {
          setMessage(getErrorMessage(error));
        }
      }
    }

    void loadDraft();

    return () => {
      active = false;
    };
  }, [accessToken, activeDraft?.groupKey, draftKeyFromUrl]);

  function focusRequirement(requirement: Requirement) {
    if (!requirement.targetId) {
      return;
    }

    window.requestAnimationFrame(() => {
      const target = document.getElementById(requirement.targetId);
      target?.focus({ preventScroll: false });
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function updatePosition(id: string, patch: Partial<PositionDraft>) {
    setPositions((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addPosition() {
    setPositions((current) => [...current, createPositionDraft(current.length + 1)]);
  }

  function removePosition(id: string) {
    setPositions((current) =>
      current.length <= 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  function updateCandidate(
    positionId: string,
    candidateId: string,
    patch: Partial<CandidateDraft>,
  ) {
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
              candidates: [
                ...position.candidates,
                createCandidateDraft(position.candidates.length + 1),
              ],
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    const invalidRequirement = getFirstInvalidRequirement(requirements);
    if (invalidRequirement) {
      setMessage(`Cần hoàn tất: ${invalidRequirement.label}.`);
      focusRequirement(invalidRequirement);
      return;
    }

    setSubmitting(true);

    try {
      if (!currentAccount) {
        throw new Error('Chưa kết nối được ví MetaMask.');
      }

      if (voterMode === 'wallets') {
        if (!isMetaMaskInstalled) {
          throw new Error('Máy hiện tại chưa có MetaMask.');
        }

        const ready = await ensureNetworkAndToken();
        if (!ready) {
          throw new Error('Ví chưa ở đúng mạng Sepolia.');
        }
      }

      const basePositions = normalizedPositions.map((position) => ({
        positionId: position.positionId,
        title: position.title,
        description: position.description || null,
        candidates: position.candidates.map((candidate) => ({
          displayName: candidate.displayName,
          sourceId: candidate.sourceId,
          walletAddress: candidate.walletAddress || null,
        })),
      }));

      if (voterMode === 'wallets') {
        const response = await createElectionV1Group({
          adminWalletAddress: currentAccount,
          title: title.trim(),
          description: description.trim() || null,
          groupKey: groupKey.trim() || null,
          commitStart: new Date(commitStart).toISOString(),
          commitEnd: new Date(commitEnd).toISOString(),
          revealEnd: new Date(revealEnd).toISOString(),
          voterWalletAddresses: parsedVoterWallets,
          positions: basePositions,
        });
        const firstElectionAddress = response.created.created[0]?.address;
        setMessage(`Tạo nhóm bầu cử thành công: ${response.created.groupKey}`);
        if (firstElectionAddress) {
          navigate(
            `/app/quan-ly-smart-contract?group=${response.created.groupKey}&election=${firstElectionAddress}`,
          );
        } else {
          navigate('/app/quan-ly-smart-contract');
        }
      } else {
        const payload: ElectionV1CreateRosterDraftRequest = {
          adminWalletAddress: currentAccount,
          title: title.trim(),
          description: description.trim() || null,
          groupKey: groupKey.trim() || null,
          commitStart: new Date(commitStart).toISOString(),
          commitEnd: new Date(commitEnd).toISOString(),
          revealEnd: new Date(revealEnd).toISOString(),
          positions: basePositions,
          voters: parsedRosterVoters.map((voter) => ({
            fullName: voter.fullName,
            email: voter.email,
            studentCode: voter.studentCode || null,
          })),
        };
        const response = await createElectionV1RosterDraft(payload);
        setActiveDraft(response.draft);
        setMessage(
          `Đã tạo bản nháp roster xác thực ${response.draft.groupKey}. Gửi QR chung cho cử tri, sau đó deploy ballot khi đã bind ví.`,
        );
        navigate(`/app/tao-phien-bau-cu?draft=${encodeURIComponent(response.draft.groupKey)}`, {
          replace: true,
        });
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeployVerifiedRoster() {
    if (!activeDraft) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await deployElectionV1RosterDraft(activeDraft.groupKey);
      const refreshedDraft = {
        ...activeDraft,
        status: 'deployed',
        includedVoterCount: response.created.includedVoterCount,
        deployment: {
          deployedAt: new Date().toISOString(),
          includedVoterCount: response.created.includedVoterCount,
          groupKey: response.created.groupKey,
          created: response.created.created,
        },
      };
      setActiveDraft(refreshedDraft);
      setMessage(`Đã deploy ballot từ roster đã xác thực ${response.created.groupKey}.`);
      const firstElectionAddress = response.created.created[0]?.address;
      if (firstElectionAddress) {
        navigate(
          `/app/quan-ly-smart-contract?group=${response.created.groupKey}&election=${firstElectionAddress}`,
        );
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--clay-text)]">
      <div className="mx-auto max-w-[1440px] px-0 py-2 sm:px-2 lg:px-4">
        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className={panelClasses()}>
            <p className="clay-label">Tạo Ballot</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.015em] text-black md:text-3xl">
              Tạo đợt bầu cử
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-[var(--clay-muted)]">
              Thiết lập thông tin, lịch và danh sách cử tri cho đợt bầu cử trên Sepolia.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="clay-pill px-3 py-1 text-xs text-[var(--clay-text)]">
                ElectionV1 · Sepolia
              </span>
              <span className="clay-pill inline-flex items-center px-3 py-1 text-xs text-[var(--clay-text)]">
                <span
                  className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
                    currentAccount ? 'bg-emerald-500' : 'bg-[var(--clay-muted-soft)]'
                  }`}
                  aria-hidden="true"
                />
                {currentAccount ? 'Ví đã kết nối' : 'Chưa kết nối ví'}
              </span>
              <span
                className="clay-pill px-3 py-1 font-mono text-xs text-[var(--clay-text)]"
                title={currentAccount ?? 'not connected'}
              >
                {shortenAddress(currentAccount)}
              </span>
              <span className="clay-pill px-3 py-1 text-xs text-[var(--clay-text)]">
                {isNetworkConnected ? 'Sepolia' : 'Sai mạng'}
              </span>
              <span className="clay-pill px-3 py-1 text-xs text-[var(--clay-text)]">
                JWT: {accessToken ? 'Sẵn sàng' : 'Thiếu'}
              </span>
            </div>
          </section>

          <aside className={panelClasses()}>
            <p className="text-sm font-semibold text-black">Tóm tắt</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                ['Mạng', isNetworkConnected ? 'Ethereum Sepolia' : 'Sai mạng'],
                ['Hợp đồng', 'ElectionV1'],
                ['Ví', shortenAddress(currentAccount)],
                ['Tài khoản', currentUser?.tenHienThi ?? currentUser?.tenDangNhap ?? 'n/a'],
                ['JWT', accessToken ? 'Sẵn sàng' : 'Thiếu'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <dt className="text-[var(--clay-muted)]">{k}</dt>
                  <dd className="truncate text-right font-medium text-[var(--clay-text)]">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 space-y-3 border-t border-[var(--clay-border)] pt-5">
              <p className="text-sm font-semibold text-black">Hành động</p>
              <button
                id="connect-wallet-button"
                type="button"
                onClick={() => void connectWallet()}
                className={`${actionButtonClasses('outline')} w-full`}
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                {currentAccount ? 'Đổi / kết nối lại MetaMask' : 'Kết nối MetaMask'}
              </button>

              <Link
                to="/app/quan-ly-smart-contract"
                className={`${actionButtonClasses('outline')} w-full`}
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Về console ElectionV1
              </Link>
            </div>

            <div
              className={`mt-5 rounded-[18px] border px-4 py-3 text-sm leading-6 ${messagePanelClasses(message)}`}
              aria-live="polite"
            >
              <p className="font-semibold text-black">Live status</p>
              <p className="mt-1">{message}</p>
            </div>

            <div className="mt-5 rounded-[18px] border border-[var(--clay-border)] bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-black">Điều kiện submit</p>
                  <p className="mt-1 text-xs text-[var(--clay-muted)]">
                    {isReadyToSubmit
                      ? 'Sẵn sàng tạo ballot.'
                      : `Cần xử lý: ${firstInvalidRequirement?.label}.`}
                  </p>
                </div>
                <ClipboardList className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
              </div>
              <RequirementList requirements={requirements} />
            </div>
          </aside>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className={panelClasses()}>
              <div className="mb-5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                <div>
                  <p className="clay-label">Ballot</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                    Thông tin cuộc bầu cử
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="ballot-title" className="text-sm font-semibold text-black">
                    Tên cuộc bầu cử
                  </label>
                  <input
                    id="ballot-title"
                    name="ballot-title"
                    autoComplete="off"
                    spellCheck={false}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={inputClasses()}
                    placeholder="Ví dụ: Bầu cử cán bộ lớp Hàng Hải K66…"
                  />
                  {showInlineErrors && title.trim().length === 0 && (
                    <FieldError message="Nhập tên cuộc bầu cử để người dùng nhận diện ballot." />
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="ballot-description" className="text-sm font-semibold text-black">
                    Mô tả
                  </label>
                  <textarea
                    id="ballot-description"
                    name="ballot-description"
                    autoComplete="off"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className={inputClasses('rounded-[18px]')}
                    placeholder="Mô tả ngắn về phạm vi và quy tắc của đợt bầu cử…"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="group-key" className="text-sm font-semibold text-black">
                    Group key (tùy chọn)
                  </label>
                  <input
                    id="group-key"
                    name="group-key"
                    autoComplete="off"
                    spellCheck={false}
                    value={groupKey}
                    onChange={(event) => setGroupKey(event.target.value)}
                    className={inputClasses()}
                    placeholder="Để trống để backend tự sinh…"
                  />
                </div>
              </div>
            </section>

            <section className={panelClasses()}>
              <div className="mb-5 flex items-center gap-3">
                <Users className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                <div>
                  <p className="clay-label">Timeline & voters</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                    Lịch và danh sách cử tri
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="commit-start" className="text-sm font-semibold text-black">
                    Commit start
                  </label>
                  <input
                    id="commit-start"
                    name="commit-start"
                    type="datetime-local"
                    autoComplete="off"
                    value={commitStart}
                    onChange={(event) => setCommitStart(event.target.value)}
                    className={inputClasses()}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="commit-end" className="text-sm font-semibold text-black">
                    Commit end
                  </label>
                  <input
                    id="commit-end"
                    name="commit-end"
                    type="datetime-local"
                    autoComplete="off"
                    value={commitEnd}
                    onChange={(event) => setCommitEnd(event.target.value)}
                    className={inputClasses()}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="reveal-end" className="text-sm font-semibold text-black">
                    Reveal end
                  </label>
                  <input
                    id="reveal-end"
                    name="reveal-end"
                    type="datetime-local"
                    autoComplete="off"
                    value={revealEnd}
                    onChange={(event) => setRevealEnd(event.target.value)}
                    className={inputClasses()}
                  />
                </div>
              </div>

              {showInlineErrors && !scheduleState.isValid && (
                <FieldError message="Lịch phải thỏa mãn Commit start ở tương lai và Commit start < Commit end < Reveal end." />
              )}

              <fieldset className="mt-5 space-y-2">
                <legend className="text-sm font-semibold text-black">Chế độ cử tri</legend>
                <div
                  className="grid gap-3 md:grid-cols-2"
                  role="group"
                  aria-label="Chọn chế độ nhập cử tri"
                >
                  <button
                    type="button"
                    onClick={() => setVoterMode('wallets')}
                    className={`${actionButtonClasses(voterMode === 'wallets' ? 'accent' : 'outline')} w-full`}
                    aria-pressed={voterMode === 'wallets'}
                    title="Nhập trực tiếp danh sách địa chỉ ví cử tri"
                  >
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Nhập ví trực tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoterMode('roster')}
                    className={`${actionButtonClasses(voterMode === 'roster' ? 'accent' : 'outline')} w-full`}
                    aria-pressed={voterMode === 'roster'}
                    title="Tạo danh sách cử tri bằng link mời, QR và OTP"
                  >
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    Roster QR / OTP
                  </button>
                </div>
              </fieldset>

              {voterMode === 'wallets' ? (
                <div className="mt-5 space-y-2">
                  <label htmlFor="voter-wallets-input" className="text-sm font-semibold text-black">
                    Danh sách ví cử tri
                  </label>
                  <textarea
                    id="voter-wallets-input"
                    name="voter-wallets-input"
                    autoComplete="off"
                    spellCheck={false}
                    value={voterWalletsInput}
                    onChange={(event) => setVoterWalletsInput(event.target.value)}
                    rows={5}
                    className={inputClasses('rounded-[18px] clay-mono')}
                    placeholder="Mỗi dòng một địa chỉ ví, ví dụ: 0x1234…abcd"
                  />
                  {showInlineErrors && parsedVoterWallets.length === 0 && (
                    <FieldError message="Thêm ít nhất 1 địa chỉ ví cử tri." />
                  )}
                  {showInlineErrors && invalidVoterWallets.length > 0 && (
                    <FieldError
                      message={`Có ${invalidVoterWallets.length} địa chỉ ví cử tri sai định dạng.`}
                    />
                  )}
                  {showInlineErrors && duplicateVoterWallets.length > 0 && (
                    <FieldError
                      message={`Có ${duplicateVoterWallets.length} địa chỉ ví cử tri bị trùng.`}
                    />
                  )}
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  <label htmlFor="roster-input" className="text-sm font-semibold text-black">
                    Danh sách cử tri
                  </label>
                  <textarea
                    id="roster-input"
                    name="roster-input"
                    autoComplete="off"
                    spellCheck={false}
                    value={rosterInput}
                    onChange={(event) => setRosterInput(event.target.value)}
                    rows={7}
                    className={inputClasses('rounded-[18px]')}
                    placeholder="Mỗi dòng: Họ tên,email,mã sinh viên…"
                  />
                  <p className="text-sm leading-6 text-[var(--clay-muted)]">
                    Hệ thống tạo bản nháp roster và một QR chung để cử tri tự xác thực email bằng
                    OTP, sau đó bind MetaMask trước khi admin deploy ballot on-chain.
                  </p>
                  {showInlineErrors && parsedRosterVoters.length === 0 && (
                    <FieldError message="Thêm ít nhất 1 dòng roster." />
                  )}
                  {showInlineErrors && invalidRosterRows.length > 0 && (
                    <FieldError
                      message={`Dòng roster cần có họ tên và email hợp lệ: ${invalidRosterRows
                        .slice(0, 4)
                        .map((row) => row.rowNumber)
                        .join(', ')}${invalidRosterRows.length > 4 ? '…' : ''}.`}
                    />
                  )}
                </div>
              )}
            </section>

            <section id="positions-section" tabIndex={-1} className={panelClasses()}>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Vote className="h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                  <div>
                    <p className="clay-label">Positions</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                      Chức vụ và ứng viên
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addPosition}
                  className={actionButtonClasses('outline')}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Thêm chức vụ
                </button>
              </div>

              {showInlineErrors && normalizedPositions.length === 0 && (
                <FieldError message="Thêm ít nhất 1 chức vụ có tên và từ 2 ứng viên." />
              )}
              {showInlineErrors && invalidCandidateWallets.length > 0 && (
                <FieldError
                  message={`Có ${invalidCandidateWallets.length} ví ứng viên sai định dạng.`}
                />
              )}

              <div className="mt-5 space-y-5">
                {positions.map((position, positionIndex) => (
                  <article
                    key={position.id}
                    className="rounded-[18px] border border-[var(--clay-border)] bg-white p-4 md:p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="clay-label">Chức vụ {positionIndex + 1}</p>
                        <p className="mt-1 truncate text-lg font-semibold text-black">
                          {position.title || 'Chưa đặt tên chức vụ'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePosition(position.id)}
                        className={actionButtonClasses('outline')}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Xóa chức vụ
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor={`${position.id}-title`}
                          className="text-sm font-semibold text-black"
                        >
                          Tên chức vụ
                        </label>
                        <input
                          id={`${position.id}-title`}
                          name={`${position.id}-title`}
                          autoComplete="off"
                          value={position.title}
                          onChange={(event) =>
                            updatePosition(position.id, { title: event.target.value })
                          }
                          className={inputClasses()}
                          placeholder="Ví dụ: Lớp trưởng…"
                        />
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor={`${position.id}-description`}
                          className="text-sm font-semibold text-black"
                        >
                          Mô tả chức vụ
                        </label>
                        <input
                          id={`${position.id}-description`}
                          name={`${position.id}-description`}
                          autoComplete="off"
                          value={position.description}
                          onChange={(event) =>
                            updatePosition(position.id, { description: event.target.value })
                          }
                          className={inputClasses()}
                          placeholder="Ví dụ: Bầu 1 người cho vai trò này…"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-black">
                        Ứng viên cho {position.title || `chức vụ ${positionIndex + 1}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => addCandidate(position.id)}
                        className={actionButtonClasses('outline')}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Thêm ứng viên
                      </button>
                    </div>

                    {showInlineErrors &&
                      position.title.trim().length > 0 &&
                      position.candidates.filter(
                        (candidate) => candidate.displayName.trim().length > 0,
                      ).length < 2 && (
                        <FieldError message="Mỗi chức vụ cần ít nhất 2 ứng viên có tên." />
                      )}

                    <div className="mt-4 space-y-3">
                      {position.candidates.map((candidate, candidateIndex) => (
                        <div
                          key={candidate.id}
                          className="grid gap-3 rounded-[18px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <div className="space-y-2">
                            <label htmlFor={`${candidate.id}-name`} className="clay-label">
                              Tên ứng viên {candidateIndex + 1}
                            </label>
                            <input
                              id={`${candidate.id}-name`}
                              name={`${candidate.id}-name`}
                              autoComplete="off"
                              value={candidate.displayName}
                              onChange={(event) =>
                                updateCandidate(position.id, candidate.id, {
                                  displayName: event.target.value,
                                })
                              }
                              className={inputClasses()}
                              placeholder="Ví dụ: Nguyễn Văn A…"
                            />
                          </div>

                          <div className="space-y-2">
                            <label htmlFor={`${candidate.id}-wallet`} className="clay-label">
                              Ví ứng viên (tùy chọn)
                            </label>
                            <input
                              id={`${candidate.id}-wallet`}
                              name={`${candidate.id}-wallet`}
                              autoComplete="off"
                              spellCheck={false}
                              value={candidate.walletAddress}
                              onChange={(event) =>
                                updateCandidate(position.id, candidate.id, {
                                  walletAddress: event.target.value,
                                })
                              }
                              className={inputClasses('clay-mono')}
                              placeholder="0x1234…abcd"
                            />
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeCandidate(position.id, candidate.id)}
                              className={actionButtonClasses('outline')}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className={panelClasses()}>
              <p className="clay-label">Summary</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                Tóm tắt payload
              </h2>

              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow
                  label="Admin wallet"
                  value={shortenAddress(currentAccount)}
                  fullValue={currentAccount}
                />
                <SummaryRow label="Số chức vụ" value={normalizedPositions.length} />
                <SummaryRow
                  label={voterMode === 'wallets' ? 'Cử tri hợp lệ' : 'Dòng roster'}
                  value={
                    voterMode === 'wallets' ? parsedVoterWallets.length : parsedRosterVoters.length
                  }
                />
                <SummaryRow label="Mạng ví" value={isNetworkConnected ? 'Sepolia' : 'Mismatch'} />
              </div>
            </section>

            <section className={panelClasses()}>
              <p className="clay-label">Submit</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                {voterMode === 'wallets' ? 'Tạo group ballot' : 'Tạo roster xác thực'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--clay-muted)]">
                {voterMode === 'wallets'
                  ? 'Sau khi tạo xong, hệ thống chuyển sang command center và mở child election đầu tiên.'
                  : 'Ở chế độ roster, hệ thống chỉ tạo bản nháp xác thực và QR mời cử tri. Ballot on-chain chỉ được deploy sau khi cử tri OTP và bind ví.'}
              </p>

              <button
                type="submit"
                disabled={submitting}
                className={`${actionButtonClasses(isReadyToSubmit ? 'accent' : 'outline')} mt-5 w-full`}
              >
                {submitting
                  ? voterMode === 'wallets'
                    ? 'Đang deploy trên Sepolia…'
                    : 'Đang tạo roster xác thực…'
                  : !isReadyToSubmit
                    ? 'Kiểm tra điều kiện submit'
                    : voterMode === 'wallets'
                      ? 'Tạo election trên Sepolia'
                      : 'Tạo roster + QR xác thực'}
              </button>
            </section>
          </aside>
        </form>

        {activeDraft && voterMode === 'roster' && (
          <div className="mt-6 space-y-6">
            <section className={panelClasses()}>
              {activeDraft.status === 'deployed' ? (
                <div className="rounded-[18px] border border-[rgba(132,231,165,0.28)] bg-[rgba(132,231,165,0.14)] p-5">
                  <p className="clay-label">Hướng dẫn QR / OTP</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                    Ballot đã deploy on-chain
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--clay-text)]">
                    QR onboarding đã hoàn tất nhiệm vụ xác thực roster. Từ thời điểm này admin nên
                    quản lý ballot ở command center và không phát tiếp QR xác thực trước deploy.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <QRCodeGenerator
                    inviteLink={buildSharedRosterInviteUrl(activeDraft)}
                    title="QR mời xác thực cử tri"
                    description="QR chỉ dùng cho bước xác thực roster trước deploy; chưa phải QR của ballot on-chain."
                    downloadFileName={`${activeDraft.groupKey}-shared-qr`}
                  />

                  <div className="min-w-0">
                    <p className="clay-label">Hướng dẫn QR / OTP</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.015em] text-black">
                      Bước 1/2: xác thực cử tri trước deploy
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--clay-muted)]">
                      QR này được tạo sau khi admin bấm{' '}
                      <span className="font-semibold text-black">Tạo roster + QR xác thực</span>. Nó
                      chỉ mở luồng onboarding cho roster, giúp không phải phát từng mã cho từng cử
                      tri. Token riêng vẫn được backend cấp sau bước nhập email để chống nhận nhầm
                      định danh, chống bind ví thay người khác và giữ audit trail. Phiên bầu cử
                      on-chain chỉ được tạo ở bước deploy bên dưới.
                    </p>
                    <ol className="mt-5 grid gap-3 text-sm text-[var(--clay-muted)] md:grid-cols-2">
                      <li className="rounded-[16px] border border-[var(--clay-border)] bg-white p-4">
                        <span className="font-semibold text-black">1. Tạo bản nháp roster</span>
                        <p className="mt-1 leading-6">
                          Admin nhập danh sách cử tri, lịch commit/reveal và các chức vụ.
                        </p>
                      </li>
                      <li className="rounded-[16px] border border-[var(--clay-border)] bg-white p-4">
                        <span className="font-semibold text-black">2. Công bố một QR chung</span>
                        <p className="mt-1 leading-6">
                          In hoặc gửi một QR theo roster này cho toàn bộ cử tri đủ điều kiện.
                        </p>
                      </li>
                      <li className="rounded-[16px] border border-[var(--clay-border)] bg-white p-4">
                        <span className="font-semibold text-black">3. Cử tri tự định danh</span>
                        <p className="mt-1 leading-6">
                          Cử tri nhập email trong roster; hệ thống chỉ gửi OTP về email đó.
                        </p>
                      </li>
                      <li className="rounded-[16px] border border-[var(--clay-border)] bg-white p-4">
                        <span className="font-semibold text-black">4. Bind ví rồi deploy</span>
                        <p className="mt-1 leading-6">
                          Chỉ ví đã bind sau OTP mới được đưa vào ballot khi admin deploy.
                        </p>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </section>

            <section className={panelClasses()}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="clay-label">Bản nháp danh sách cử tri</p>
                  <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.015em] text-black">
                    {activeDraft.title}
                  </h2>
                  <p className="mt-2 break-all text-sm text-[var(--clay-muted)]">
                    Group key: {activeDraft.groupKey}
                  </p>
                  {activeDraft.status === 'deployed' ? (
                    <p className="mt-1 text-sm text-[var(--clay-muted)]">
                      Onboarding đã chốt; không phát tiếp QR xác thực trước deploy.
                    </p>
                  ) : (
                    <p className="mt-1 break-all text-sm text-[var(--clay-muted)]">
                      QR xác thực trước deploy: {buildSharedRosterInviteUrl(activeDraft)}
                    </p>
                  )}
                  <span className="mt-3 inline-flex rounded-full border border-[var(--clay-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--clay-muted)]">
                    {activeDraft.status === 'deployed'
                      ? 'Đã deploy ballot on-chain'
                      : 'Chưa deploy ballot on-chain'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeployVerifiedRoster()}
                  disabled={
                    submitting ||
                    activeDraft.walletBoundCount === 0 ||
                    activeDraft.status === 'deployed'
                  }
                  className={actionButtonClasses('accent')}
                >
                  {activeDraft.status === 'deployed'
                    ? 'Đã deploy'
                    : 'Deploy ballot từ cử tri đã xác thực'}
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <MetricCard label="Tổng invite" value={String(activeDraft.totalInviteCount)} />
                <MetricCard label="OTP verified" value={String(activeDraft.otpVerifiedCount)} />
                <MetricCard label="Wallet bound" value={String(activeDraft.walletBoundCount)} />
              </div>

              <div className="mt-5 space-y-4">
                {activeDraft.invites.map((invite) => (
                  <article
                    key={invite.inviteId}
                    className="rounded-[18px] border border-[var(--clay-border)] bg-white p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-black">
                          {invite.fullName}
                        </p>
                        <p className="mt-1 truncate text-sm text-[var(--clay-muted)]">
                          {invite.email}
                        </p>
                        {invite.studentCode && (
                          <p className="text-sm text-[var(--clay-muted)]">
                            MSSV: {invite.studentCode}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="clay-label">Link riêng dự phòng</p>
                        <p className="mt-2 break-all text-xs leading-5 text-[var(--clay-muted)]">
                          {invite.inviteUrl}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs lg:justify-end">
                        <span className="clay-badge">
                          OTP {invite.otpVerified ? 'verified' : 'pending'}
                        </span>
                        <span className="clay-badge" title={invite.walletAddress ?? undefined}>
                          {invite.walletAddress
                            ? shortenAddress(invite.walletAddress)
                            : 'Chưa bind wallet'}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
