import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  Clipboard,
  ExternalLink,
  ListChecks,
  Plus,
  QrCode,
  RefreshCw,
  Vote,
  Wallet,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getElectionV1Detail,
  getElectionV1GroupDetail,
  getElectionV1Proof,
  getElectionV1PublicConfig,
  listElectionV1Groups,
  type ElectionV1Detail,
  type ElectionV1GroupDetail,
  type ElectionV1GroupListItem,
  type ElectionV1OnChainState,
  type ElectionV1PublicConfig,
  type ElectionV1Result,
} from '../api/electionV1Api';
// Đợt 10 (spec 010) US4: chỉ tái cấu trúc JSX. S4/S5 + handlers (dòng ~176-701)
// KHÔNG đụng — xem .specify/specs/010-ux-professionalization/s4s5-reference.md.
import {
  Button,
  EmptyState,
  Panel,
  StatusBadge,
  Tabs,
  type StatusTone,
} from '../components/ui/clay';
import { buildVerifyTransactionUrl } from '../utils/transactionVerification';
import {
  buildElectionDetailPath,
  getViewerRoleLabel,
  getViewerRoleTone,
} from '../utils/electionListPresentation';

const TARGET_CHAIN_ID = 11155111;
const TARGET_CHAIN_ID_HEX = '0xaa36a7';
const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_EXPLORER_BASE_URL = 'https://sepolia.etherscan.io';
const VOTE_PACKAGE_PREFIX = 'holihu.current.election-v1.vote';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const PHASE_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Commit',
  2: 'Reveal',
  3: 'Ended',
  4: 'Finalized',
  5: 'Canceled',
};

const electionV1Abi = [
  { type: 'function', name: 'currentPhase', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'totalCommits', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'totalReveals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'finalized', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'canceled', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'voteCounts', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'commitments', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'hasRevealed', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  {
    type: 'function',
    name: 'computeCommitment',
    stateMutability: 'view',
    inputs: [
      { name: 'voter', type: 'address' },
      { name: 'candidateId', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'commitVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'proof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revealVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'candidateId', type: 'bytes32' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'finalizeElection', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

const electionV1EventAbi = [
  {
    type: 'event',
    name: 'VoteCommitted',
    anonymous: false,
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'commitment', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoteRevealed',
    anonymous: false,
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'candidateId', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ElectionFinalized',
    anonymous: false,
    inputs: [
      { name: 'totalCommits', type: 'uint256', indexed: false },
      { name: 'totalReveals', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ElectionCanceled',
    anonymous: false,
    inputs: [{ name: 'reasonHash', type: 'bytes32', indexed: true }],
  },
] as const;

type ElectionV1TransactionKind = 'create' | 'commit' | 'reveal' | 'finalize' | 'cancel';

type ElectionV1TransactionEntry = {
  id: string;
  kind: ElectionV1TransactionKind;
  txHash: string;
  url: string;
  verifyUrl: string;
  source: 'deployment' | 'chain';
  electionAddress: string;
  actorAddress?: string | null;
  candidateId?: string | null;
  candidateName?: string | null;
  blockNumber?: number | null;
  timestamp?: number | null;
  createdAt?: string | null;
};

type VotePackage = {
  electionAddress: string;
  voter: string;
  candidateId: string;
  candidateName: string;
  salt: string;
  commitment: string;
  committedAt: string;
  revealedAt?: string;
};

// Đợt 11 cleanup (Đợt 10 follow-up): panelClasses/commandButtonClasses/
// messagePanelClasses/phaseAccentClasses là dead-code sau khi US4 chuyển sang
// clay — đã gỡ. KHÔNG đụng vùng S4/S5 (>=176). getEthereum giữ (đang dùng).

function getEthereum() {
  return (window as Window & { ethereum?: any }).ethereum;
}

function shortenAddress(value?: string | null) {
  if (!value) {
    return 'n/a';
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUnix(timestamp?: number | null) {
  if (!timestamp) {
    return 'Chưa thiết lập';
  }
  return new Date(timestamp * 1000).toLocaleString('vi-VN');
}

// Đợt 11 cleanup: YesNoBadge dead-code đã gỡ — US4 dùng clay StatusBadge (yesNo()).

function getExplorerBaseUrl(publicConfig?: ElectionV1PublicConfig | null) {
  return (publicConfig?.explorerBaseUrl || DEFAULT_EXPLORER_BASE_URL).replace(/\/+$/, '');
}

function buildTransactionUrl(explorerBaseUrl: string, txHash: string) {
  return `${explorerBaseUrl.replace(/\/+$/, '')}/tx/${txHash}`;
}

function shortenHash(value?: string | null) {
  if (!value) {
    return 'n/a';
  }
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function transactionKindLabel(kind: ElectionV1TransactionKind) {
  switch (kind) {
    case 'create':
      return 'Tạo chức vụ';
    case 'commit':
      return 'Ghi nhận phiếu';
    case 'reveal':
      return 'Mở phiếu';
    case 'finalize':
      return 'Chốt kết quả';
    case 'cancel':
      return 'Hủy bầu cử';
    default:
      return 'Giao dịch';
  }
}

function displayPhaseLabel(phase?: string | null) {
  switch ((phase ?? '').toLowerCase()) {
    case 'commit':
      return 'Đang nhận phiếu';
    case 'reveal':
      return 'Đang mở phiếu';
    case 'ended':
      return 'Chờ chốt kết quả';
    case 'finalized':
      return 'Đã chốt kết quả';
    case 'canceled':
      return 'Đã hủy';
    default:
      return phase || 'Chưa xác định';
  }
}

function formatTransactionTime(entry: ElectionV1TransactionEntry) {
  if (entry.timestamp) {
    return new Date(entry.timestamp * 1000).toLocaleString('vi-VN');
  }
  if (entry.createdAt) {
    return new Date(entry.createdAt).toLocaleString('vi-VN');
  }
  return entry.blockNumber ? `Block ${entry.blockNumber}` : 'Đang cập nhật';
}

function buildDeploymentTransaction(
  detail: ElectionV1Detail,
  explorerBaseUrl: string,
  chainId = TARGET_CHAIN_ID,
): ElectionV1TransactionEntry | null {
  if (!detail.txHash) {
    return null;
  }

  return {
    id: `deployment:${detail.txHash.toLowerCase()}`,
    kind: 'create',
    txHash: detail.txHash,
    url: buildTransactionUrl(explorerBaseUrl, detail.txHash),
    verifyUrl: buildVerifyTransactionUrl(detail.txHash, chainId),
    source: 'deployment',
    electionAddress: detail.address,
    actorAddress: detail.admin,
    blockNumber: detail.blockNumber,
    createdAt: detail.createdAt,
  };
}

function candidateNameById(detail: ElectionV1Detail, candidateId?: string | null) {
  if (!candidateId) {
    return null;
  }
  const normalized = candidateId.toLowerCase();
  const result = detail.onChain?.results?.find((item) => item.candidateId.toLowerCase() === normalized);
  const candidate = detail.candidates?.find((item) => item.candidateId.toLowerCase() === normalized);
  return result?.candidateName ?? candidate?.displayName ?? null;
}

function normalizeAddress(value?: string | null) {
  if (!value) {
    return null;
  }
  try {
    return ethers.getAddress(value);
  } catch {
    return value;
  }
}

// S4 (spec 001): localStorage chi luu envelope da MA HOA, khong luu salt plaintext.
type VoteSecret = Pick<VotePackage, 'candidateId' | 'salt' | 'commitment'>;

type StoredVoteEnvelope = {
  electionAddress: string;
  voter: string;
  candidateName: string;
  committedAt: string;
  revealedAt?: string;
  iv: string;
  ciphertext: string;
};

function buildVotePackageKey(electionAddress: string, walletAddress: string) {
  return `${VOTE_PACKAGE_PREFIX}:${electionAddress.toLowerCase()}:${walletAddress.toLowerCase()}`;
}

// Khoa AES duoc dan xuat tu CHU KY VI -> XSS / may chung khong giai ma duoc neu khong co vi.
function voteEncMessage(electionAddress: string, voter: string) {
  return `HoLiHu ElectionV1 vote secret\nelection: ${electionAddress.toLowerCase()}\nvoter: ${voter.toLowerCase()}`;
}

function bufToB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveVoteAesKey(signer: ethers.Signer, electionAddress: string, voter: string) {
  const signature = await signer.signMessage(voteEncMessage(electionAddress, voter));
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  return window.crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptVoteSecret(key: CryptoKey, secret: VoteSecret) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(secret));
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bufToB64(iv), ciphertext: bufToB64(ciphertext) };
}

async function decryptVoteSecret(key: CryptoKey, ivB64: string, ciphertextB64: string): Promise<VoteSecret> {
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(ciphertextB64),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as VoteSecret;
}

function loadStoredVoteEnvelope(electionAddress: string, walletAddress: string): StoredVoteEnvelope | null {
  const raw = window.localStorage.getItem(buildVotePackageKey(electionAddress, walletAddress));
  if (!raw) {
    return null;
  }
  try {
    const env = JSON.parse(raw) as StoredVoteEnvelope;
    // S5: chi chap nhan envelope dung chu so huu (vi) va dung election.
    if (!env || typeof env.ciphertext !== 'string' || typeof env.iv !== 'string') return null;
    if (env.electionAddress?.toLowerCase() !== electionAddress.toLowerCase()) return null;
    if (env.voter?.toLowerCase() !== walletAddress.toLowerCase()) return null;
    return env;
  } catch {
    return null;
  }
}

function saveStoredVoteEnvelope(env: StoredVoteEnvelope) {
  window.localStorage.setItem(buildVotePackageKey(env.electionAddress, env.voter), JSON.stringify(env));
}

function removeStoredVoteEnvelope(electionAddress: string, walletAddress: string) {
  window.localStorage.removeItem(buildVotePackageKey(electionAddress, walletAddress));
}

function createRandomBytes32() {
  return ethers.hexlify(ethers.randomBytes(32));
}

function getErrorMessage(error: unknown) {
  const maybeError = error as any;
  if (maybeError?.response?.data?.Error) {
    return maybeError.response.data.Error;
  }
  if (maybeError?.response?.data?.error) {
    return maybeError.response.data.error;
  }
  if (maybeError?.shortMessage) {
    return maybeError.shortMessage;
  }
  if (maybeError?.reason) {
    return maybeError.reason;
  }
  if (maybeError instanceof Error) {
    return maybeError.message;
  }
  return 'Có lỗi không xác định.';
}

async function switchToSepolia(rpcUrl: string) {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('MetaMask chưa được cài đặt.');
  }

  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TARGET_CHAIN_ID_HEX }] });
  } catch (error: any) {
    if (error.code !== 4902) {
      throw error;
    }

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: TARGET_CHAIN_ID_HEX,
          chainName: 'Ethereum Sepolia',
          nativeCurrency: { name: 'Sepolia ETH', symbol: 'SEP', decimals: 18 },
          rpcUrls: [rpcUrl || DEFAULT_RPC_URL],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        },
      ],
    });
  }
}

async function loadOnChainStateDirectly(detail: ElectionV1Detail, viewerAddress: string | null | undefined, rpcUrl: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl || DEFAULT_RPC_URL);
  const contract = new ethers.Contract(detail.address, electionV1Abi, provider);

  const [phaseRaw, ownerRaw, totalCommitsRaw, totalRevealsRaw, finalized, canceled] = await Promise.all([
    contract.currentPhase(),
    contract.owner(),
    contract.totalCommits(),
    contract.totalReveals(),
    contract.finalized(),
    contract.canceled(),
  ]);

  const results = await Promise.all(
    detail.candidates.map(async (candidate, index) => {
      const countRaw = await contract.voteCounts(candidate.candidateId);
      return {
        candidateIndex: index,
        candidateId: candidate.candidateId,
        candidateName: candidate.displayName ?? `Candidate ${index + 1}`,
        candidateSourceId: candidate.sourceId,
        candidateWalletAddress: candidate.walletAddress,
        count: Number(countRaw),
      };
    }),
  );

  let viewer: ElectionV1OnChainState['viewer'] = null;
  if (viewerAddress) {
    const normalizedViewer = normalizeAddress(viewerAddress) ?? viewerAddress;
    const [proofPayload, commitment, hasRevealed] = await Promise.all([
      getElectionV1Proof(detail.address, normalizedViewer),
      contract.commitments(normalizedViewer),
      contract.hasRevealed(normalizedViewer),
    ]);

    viewer = {
      address: normalizedViewer,
      eligible: proofPayload.eligible,
      hasCommitted: String(commitment).toLowerCase() !== ZERO_BYTES32,
      hasRevealed: Boolean(hasRevealed),
      commitment: String(commitment).toLowerCase() === ZERO_BYTES32 ? null : String(commitment),
      proofAvailable: proofPayload.eligible,
    };
  }

  const phase = Number(phaseRaw);
  return {
    address: detail.address,
    owner: normalizeAddress(String(ownerRaw)) ?? String(ownerRaw),
    phase,
    phaseLabel: PHASE_LABELS[phase] ?? 'Unknown',
    finalized: Boolean(finalized),
    canceled: Boolean(canceled),
    commitStart: detail.commitStart,
    commitEnd: detail.commitEnd,
    revealEnd: detail.revealEnd,
    totalCommits: String(totalCommitsRaw),
    totalReveals: String(totalRevealsRaw),
    results,
    viewer,
  } satisfies ElectionV1OnChainState;
}

async function loadElectionTransactions(
  detail: ElectionV1Detail,
  rpcUrl: string,
  explorerBaseUrl: string,
  chainId = TARGET_CHAIN_ID,
): Promise<ElectionV1TransactionEntry[]> {
  const provider = new ethers.JsonRpcProvider(rpcUrl || DEFAULT_RPC_URL);
  const eventInterface = new ethers.Interface(electionV1EventAbi);
  const topics = [
    ethers.id('VoteCommitted(address,bytes32)'),
    ethers.id('VoteRevealed(address,bytes32)'),
    ethers.id('ElectionFinalized(uint256,uint256)'),
    ethers.id('ElectionCanceled(bytes32)'),
  ];
  const fromBlock = Math.max(0, Number(detail.blockNumber || 0));
  const logs = await provider.getLogs({
    address: detail.address,
    fromBlock,
    toBlock: 'latest',
    topics: [topics],
  });

  const blockNumbers = Array.from(new Set(logs.map((log) => log.blockNumber).filter(Boolean)));
  const blockTimes = new Map<number, number>();
  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await provider.getBlock(blockNumber);
      if (block) {
        blockTimes.set(blockNumber, Number(block.timestamp));
      }
    }),
  );

  return logs
    .map((log): ElectionV1TransactionEntry | null => {
      const parsed = eventInterface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) {
        return null;
      }

      const txHash = log.transactionHash;
      const base = {
        id: `chain:${txHash.toLowerCase()}:${log.index}`,
        txHash,
        url: buildTransactionUrl(explorerBaseUrl, txHash),
        verifyUrl: buildVerifyTransactionUrl(txHash, chainId),
        source: 'chain' as const,
        electionAddress: detail.address,
        blockNumber: log.blockNumber,
        timestamp: blockTimes.get(log.blockNumber) ?? null,
      };

      if (parsed.name === 'VoteCommitted') {
        return {
          ...base,
          kind: 'commit',
          actorAddress: String(parsed.args.voter),
        };
      }
      if (parsed.name === 'VoteRevealed') {
        const candidateId = String(parsed.args.candidateId);
        return {
          ...base,
          kind: 'reveal',
          actorAddress: String(parsed.args.voter),
          candidateId,
          candidateName: candidateNameById(detail, candidateId),
        };
      }
      if (parsed.name === 'ElectionFinalized') {
        return {
          ...base,
          kind: 'finalize',
          actorAddress: detail.admin,
        };
      }
      if (parsed.name === 'ElectionCanceled') {
        return {
          ...base,
          kind: 'cancel',
          actorAddress: detail.admin,
        };
      }

      return null;
    })
    .filter((entry): entry is ElectionV1TransactionEntry => entry !== null);
}

function getCommitReason(detail: ElectionV1Detail | null, walletAddress: string | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!detail?.onChain?.viewer?.eligible) return 'Ví hiện tại không nằm trong danh sách cử tri của chức vụ này.';
  if (detail.onChain.viewer.hasCommitted) return 'Ví này đã ghi nhận phiếu cho chức vụ này.';
  if (detail.onChain.phaseLabel !== 'Commit') return `Giai đoạn hiện tại là ${displayPhaseLabel(detail.onChain.phaseLabel)}, chưa thể ghi nhận phiếu.`;
  return null;
}

function getRevealReason(detail: ElectionV1Detail | null, walletAddress: string | null, voteEnvelope: StoredVoteEnvelope | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!voteEnvelope) return 'Không tìm thấy gói phiếu cục bộ cho ví/thiết bị này. Bước mở phiếu phải dùng đúng ví và trình duyệt đã ghi nhận phiếu.';
  if (!detail?.onChain?.viewer?.hasCommitted) return 'Ví này chưa ghi nhận phiếu.';
  if (detail.onChain.viewer.hasRevealed) return 'Ví này đã mở phiếu rồi.';
  if (detail.onChain.phaseLabel !== 'Reveal') return `Giai đoạn hiện tại là ${displayPhaseLabel(detail.onChain.phaseLabel)}, chưa thể mở phiếu.`;
  return null;
}

function getFinalizeReason(detail: ElectionV1Detail | null, walletAddress: string | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!detail?.onChain) return 'Chưa tải được trạng thái bầu cử.';
  if (detail.onChain.finalized) return 'Bầu cử đã chốt kết quả.';
  if (detail.onChain.canceled) return 'Bầu cử đã bị hủy.';
  if (detail.onChain.phaseLabel !== 'Ended') return `Giai đoạn hiện tại là ${displayPhaseLabel(detail.onChain.phaseLabel)}, chưa thể chốt kết quả.`;
  return null;
}

function BlockchainTransactionHistory({
  entries,
  loading,
  error,
  selectedTxHash,
  onSelectTx,
  onCopyTx,
  onCopyUrl,
}: {
  entries: ElectionV1TransactionEntry[];
  loading: boolean;
  error: string | null;
  selectedTxHash: string | null;
  onSelectTx: (txHash: string) => void;
  onCopyTx: (txHash: string) => void;
  onCopyUrl: (url: string) => void;
}) {
  const selectedEntry =
    entries.find((entry) => entry.txHash.toLowerCase() === selectedTxHash?.toLowerCase()) ??
    entries[entries.length - 1] ??
    null;

  return (
    <Panel className="mt-5 bg-[var(--clay-surface)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--clay-muted)]">
            Nhật ký blockchain
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--clay-text)]">
            Giao dịch có thể kiểm chứng
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--clay-muted)]">
            Admin và cử tri quét QR để mở trang kiểm chứng của HoLiHu trước, sau đó có thể đối
            chiếu thêm trên Etherscan.
          </p>
        </div>
        <StatusBadge tone={error ? 'warning' : 'success'}>
          {loading ? 'Đang đồng bộ' : error ? 'Cần tải lại' : `${entries.length} giao dịch`}
        </StatusBadge>
      </div>

      {error && (
        <div className="mt-4 rounded-[14px] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] p-3 text-sm text-[var(--state-warning)]">
          {error}
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-[16px] border border-[var(--clay-border)]">
          {entries.length > 0 ? (
            <div className="divide-y divide-[var(--clay-border)]">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-3 bg-white p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={entry.kind === 'reveal' || entry.kind === 'finalize' ? 'success' : 'info'}>
                        {transactionKindLabel(entry.kind)}
                      </StatusBadge>
                      <span className="text-xs text-[var(--clay-muted)]">
                        {formatTransactionTime(entry)}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-sm font-semibold text-[var(--clay-text)]">
                      {shortenHash(entry.txHash)}
                    </p>
                    {entry.candidateName && (
                      <p className="mt-1 text-xs text-[var(--clay-muted)]">
                        Ứng viên: {entry.candidateName}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0 text-sm">
                    <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                      Ví ký
                    </p>
                    <p className="mt-1 truncate font-mono text-[13px] text-[var(--clay-text)]">
                      {shortenAddress(entry.actorAddress)}
                    </p>
                    {entry.blockNumber && (
                      <p className="mt-1 text-xs text-[var(--clay-muted)]">
                        Block {entry.blockNumber}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => onSelectTx(entry.txHash)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                    >
                      <QrCode className="h-4 w-4" aria-hidden="true" />
                      QR
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyTx(entry.txHash)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                    >
                      <Clipboard className="h-4 w-4" aria-hidden="true" />
                      Mã tx
                    </button>
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-3 text-sm font-semibold text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)]"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Etherscan
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-6 text-sm text-[var(--clay-muted)]">
              Chưa có giao dịch để hiển thị.
            </div>
          )}
        </div>

        <div className="rounded-[16px] border border-[var(--clay-border)] bg-white p-4">
          <p className="text-sm font-semibold text-[var(--clay-text)]">QR kiểm chứng</p>
          {selectedEntry ? (
            <>
              <div className="mt-3 flex justify-center rounded-[14px] border border-[var(--clay-border-light)] bg-white p-3">
                <QRCode
                  value={selectedEntry.verifyUrl}
                  size={184}
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                  className="h-auto max-w-full"
                />
              </div>
              <p className="mt-3 break-all font-mono text-xs text-[var(--clay-muted)]">
                {selectedEntry.txHash}
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => onCopyUrl(selectedEntry.verifyUrl)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-border)] px-3 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                >
                  <Clipboard className="h-4 w-4" aria-hidden="true" />
                  Sao chép link kiểm chứng
                </button>
                <a
                  href={selectedEntry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Mở trên Etherscan
                </a>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--clay-muted)]">
              Khi có giao dịch tạo, ghi nhận phiếu, mở phiếu hoặc chốt kết quả, mã QR sẽ hiện ở đây.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function QuanLySmartContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [publicConfig, setPublicConfig] = useState<ElectionV1PublicConfig | null>(null);
  const [groupItems, setGroupItems] = useState<ElectionV1GroupListItem[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<ElectionV1GroupDetail | null>(null);
  const [selectedElectionAddress, setSelectedElectionAddress] = useState<string | null>(null);
  const [detail, setDetail] = useState<ElectionV1Detail | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // UX (spec 006/H1): theo dõi ứng viên đang commit để hiện spinner đúng nút.
  const [committingCandidateId, setCommittingCandidateId] = useState<string | null>(null);
  const [message, setMessage] = useState('Sẵn sàng.');
  const [votePackageRevision, setVotePackageRevision] = useState(0);
  const [chainTransactions, setChainTransactions] = useState<ElectionV1TransactionEntry[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [selectedTxHash, setSelectedTxHash] = useState<string | null>(null);

  const storedVoteEnvelope = useMemo(() => {
    if (!detail?.address || !connectedAccount) {
      return null;
    }
    return loadStoredVoteEnvelope(detail.address, connectedAccount);
  }, [detail?.address, connectedAccount, votePackageRevision]);

  const explorerBaseUrl = useMemo(() => getExplorerBaseUrl(publicConfig), [publicConfig]);
  const configuredChainId = Number(publicConfig?.chainId ?? TARGET_CHAIN_ID);

  const transactionHistory = useMemo(() => {
    if (!detail) {
      return [];
    }

    const deployment = buildDeploymentTransaction(detail, explorerBaseUrl, configuredChainId);
    const entries = [
      ...(deployment ? [deployment] : []),
      ...chainTransactions.filter((entry) => entry.electionAddress.toLowerCase() === detail.address.toLowerCase()),
    ];
    const seen = new Set<string>();
    return entries
      .filter((entry) => {
        const key = entry.txHash.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const aBlock = a.blockNumber ?? 0;
        const bBlock = b.blockNumber ?? 0;
        if (aBlock !== bBlock) {
          return aBlock - bBlock;
        }
        return (a.timestamp ?? 0) - (b.timestamp ?? 0);
      });
  }, [chainTransactions, configuredChainId, detail, explorerBaseUrl]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const groupParam = searchParams.get('group');
    if (groupParam && groupItems.length > 0) {
      const matched = groupItems.find((item) => item.groupKey.toLowerCase() === groupParam.toLowerCase());
      if (matched && matched.groupKey !== selectedGroupKey) {
        setSelectedGroupKey(matched.groupKey);
      }
    }
  }, [groupItems, searchParams, selectedGroupKey]);

  useEffect(() => {
    if (!selectedGroupKey) {
      setGroupDetail(null);
      return;
    }
    void refreshGroup(selectedGroupKey);
  }, [selectedGroupKey, connectedAccount]);

  useEffect(() => {
    if (!groupDetail) {
      return;
    }

    const requestedElection = searchParams.get('election');
    const preferred =
      groupDetail.positions.find((item) => item.address.toLowerCase() === requestedElection?.toLowerCase())?.address ??
      groupDetail.positions[0]?.address ??
      null;

    if (preferred && preferred !== selectedElectionAddress) {
      setSelectedElectionAddress(preferred);
    }
  }, [groupDetail, searchParams, selectedElectionAddress]);

  useEffect(() => {
    if (!selectedElectionAddress) {
      setDetail(null);
      setChainTransactions([]);
      return;
    }
    void refreshElection(selectedElectionAddress, connectedAccount);
  }, [selectedElectionAddress, connectedAccount]);

  useEffect(() => {
    if (!detail?.address) {
      setChainTransactions([]);
      setTransactionsError(null);
      return;
    }
    void refreshTransactionHistory(detail);
  }, [detail?.address, detail?.blockNumber, explorerBaseUrl, publicConfig?.rpcUrl]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return undefined;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const nextAccount = accounts[0] ?? null;
      setConnectedAccount(nextAccount);
      setVotePackageRevision((current) => current + 1);
      setMessage(nextAccount ? `Đã chuyển ví sang ${shortenAddress(nextAccount)}.` : 'MetaMask đã ngắt kết nối.');
      void refreshAll(selectedElectionAddress, selectedGroupKey, nextAccount);
    };

    const handleChainChanged = () => {
      setMessage('Mạng blockchain đã thay đổi. Đang tải lại dữ liệu ballot.');
      if (selectedElectionAddress) {
        void refreshElection(selectedElectionAddress, getEthereum()?.selectedAddress ?? connectedAccount);
      }
    };

    ethereum.on?.('accountsChanged', handleAccountsChanged);
    ethereum.on?.('chainChanged', handleChainChanged);
    return () => {
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [selectedElectionAddress, connectedAccount]);

  async function bootstrap() {
    try {
      const config = await getElectionV1PublicConfig();
      setPublicConfig(config);

      let account: string | null = null;
      const ethereum = getEthereum();
      if (ethereum) {
        const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
        if (accounts.length > 0) {
          account = accounts[0];
          setConnectedAccount(account);
          await loadWalletBalance(account, config.rpcUrl ?? DEFAULT_RPC_URL);
        }
      }

      const groups = await listElectionV1Groups(account);
      setGroupItems(groups);
      const requestedGroup = searchParams.get('group');
      const preferredGroup =
        requestedGroup
          ? groups.find((item) => item.groupKey.toLowerCase() === requestedGroup.toLowerCase())?.groupKey ?? null
          : null;
      setSelectedGroupKey(preferredGroup);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function refreshGroup(groupKey: string) {
    try {
      const payload = await getElectionV1GroupDetail(groupKey, connectedAccount);
      setGroupDetail(payload);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function refreshTransactionHistory(targetDetail: ElectionV1Detail) {
    setTransactionsLoading(true);
    try {
      const entries = await loadElectionTransactions(
        targetDetail,
        publicConfig?.rpcUrl ?? DEFAULT_RPC_URL,
        explorerBaseUrl,
        configuredChainId,
      );
      setChainTransactions(entries);
      setTransactionsError(null);
    } catch (error) {
      setTransactionsError(`Không thể đồng bộ lịch sử giao dịch từ Sepolia: ${getErrorMessage(error)}`);
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function refreshElection(identifier: string, viewerAddress?: string | null) {
    const rpcUrl = publicConfig?.rpcUrl ?? DEFAULT_RPC_URL;
    try {
      let payload = await getElectionV1Detail(identifier, viewerAddress);
      try {
        const directOnChain = await loadOnChainStateDirectly(payload, viewerAddress, rpcUrl);
        payload = { ...payload, onChain: directOnChain };
      } catch (error) {
        if (!payload.onChain) {
      setMessage(`Không đồng bộ được trạng thái blockchain từ trình duyệt: ${getErrorMessage(error)}`);
        }
      }
      setDetail(payload);
      if (viewerAddress) {
        await loadWalletBalance(viewerAddress, rpcUrl);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function refreshAll(
    addressToKeep?: string | null,
    groupToKeep?: string | null,
    viewerAddress = connectedAccount,
  ) {
    const groups = await listElectionV1Groups(viewerAddress);
    setGroupItems(groups);
    const nextGroup = groupToKeep ?? selectedGroupKey ?? null;
    setSelectedGroupKey(nextGroup);
    if (nextGroup) {
      const group = await getElectionV1GroupDetail(nextGroup, viewerAddress);
      setGroupDetail(group);
      const nextElection = addressToKeep ?? selectedElectionAddress ?? group.positions[0]?.address ?? null;
      setSelectedElectionAddress(nextElection);
      if (nextElection) {
        await refreshElection(nextElection, viewerAddress);
      }
    } else {
      setGroupDetail(null);
      setDetail(null);
    }
  }

  async function loadWalletBalance(address: string, rpcUrl: string) {
    const provider = new ethers.JsonRpcProvider(rpcUrl || DEFAULT_RPC_URL);
    const balance = await provider.getBalance(address);
    setWalletBalance(ethers.formatEther(balance));
  }

  async function connectWallet() {
    try {
      const rpcUrl = publicConfig?.rpcUrl ?? DEFAULT_RPC_URL;
      await switchToSepolia(rpcUrl);
      const ethereum = getEthereum();
      if (!ethereum) {
        throw new Error('MetaMask chưa được cài đặt.');
      }
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const nextAccount = accounts[0] ?? null;
      setConnectedAccount(nextAccount);
      if (nextAccount) {
        await loadWalletBalance(nextAccount, rpcUrl);
      }
      setMessage(nextAccount ? `Đã kết nối ví ${shortenAddress(nextAccount)}.` : 'Không tìm thấy tài khoản MetaMask.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function getSignerContext() {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error('MetaMask chưa được cài đặt.');
    }

    await switchToSepolia(publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
    const provider = new ethers.BrowserProvider(ethereum);
    await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== TARGET_CHAIN_ID) {
      throw new Error('MetaMask chưa ở đúng mạng Sepolia.');
    }
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setConnectedAccount(address);
    return { signer, address };
  }

  async function handleCommitVote(candidate: ElectionV1Result) {
    if (!detail?.address) {
      return;
    }
    let savedEnvelope: StoredVoteEnvelope | null = null;
    let txSubmitted = false;
    setBusy(true);
    setCommittingCandidateId(candidate.candidateId);
    try {
      const { signer, address } = await getSignerContext();
      const proofPayload = await getElectionV1Proof(detail.address, address);
      if (!proofPayload.eligible || proofPayload.proof.length === 0) {
        throw new Error('Ví hiện tại không nằm trong Merkle whitelist của election này.');
      }
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const salt = createRandomBytes32();
      const commitment = await contract.computeCommitment(address, candidate.candidateId, salt);

      // S4: ma hoa secret bang khoa dan xuat tu chu ky vi truoc khi luu localStorage.
      // Chuan bi va luu goi mo phieu truoc khi gui tx de tranh commit thanh cong nhung mat salt.
      const voteKey = await deriveVoteAesKey(signer, detail.address, address);
      const sealed = await encryptVoteSecret(voteKey, {
        candidateId: candidate.candidateId,
        salt,
        commitment: String(commitment),
      });
      savedEnvelope = {
        electionAddress: detail.address,
        voter: address,
        candidateName: candidate.candidateName,
        committedAt: new Date().toISOString(),
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
      };
      saveStoredVoteEnvelope(savedEnvelope);
      setVotePackageRevision((current) => current + 1);

      const tx = await contract.commitVote(commitment, proofPayload.proof);
      txSubmitted = true;
      await tx.wait();
      setSelectedTxHash(tx.hash);

      saveStoredVoteEnvelope({
        ...savedEnvelope,
        committedAt: new Date().toISOString(),
      });
      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await refreshTransactionHistory(detail);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Đã ghi nhận phiếu: ${tx.hash}`);
      toast.success('Đã ghi nhận phiếu.');
    } catch (error) {
      if (savedEnvelope && !txSubmitted) {
        removeStoredVoteEnvelope(savedEnvelope.electionAddress, savedEnvelope.voter);
        setVotePackageRevision((current) => current + 1);
      }
      const msg = getErrorMessage(error);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setCommittingCandidateId(null);
    }
  }

  async function handleRevealVote() {
    if (!detail?.address || !storedVoteEnvelope) {
      return;
    }
    setBusy(true);
    try {
      const { signer, address } = await getSignerContext();
      const envelope = loadStoredVoteEnvelope(detail.address, address);
      // S5: goi phieu phai thuoc dung vi dang ket noi.
      if (!envelope || envelope.voter.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Gói phiếu không thuộc ví đang kết nối. Hãy dùng đúng ví và trình duyệt đã ghi nhận phiếu.');
      }
      let secret: VoteSecret;
      try {
        const voteKey = await deriveVoteAesKey(signer, detail.address, address);
        secret = await decryptVoteSecret(voteKey, envelope.iv, envelope.ciphertext);
      } catch {
        throw new Error('Không giải mã được gói phiếu. Phải dùng đúng ví và trình duyệt đã ghi nhận phiếu.');
      }
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const tx = await contract.revealVote(secret.candidateId, secret.salt);
      await tx.wait();
      setSelectedTxHash(tx.hash);

      saveStoredVoteEnvelope({
        ...envelope,
        revealedAt: new Date().toISOString(),
      });

      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await refreshTransactionHistory(detail);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Đã mở phiếu: ${tx.hash}`);
      toast.success('Đã mở phiếu.');
    } catch (error) {
      const msg = getErrorMessage(error);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalizeElection() {
    if (!detail?.address) {
      return;
    }
    setBusy(true);
    try {
      const { signer, address } = await getSignerContext();
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const tx = await contract.finalizeElection();
      await tx.wait();
      setSelectedTxHash(tx.hash);
      await refreshElection(detail.address, address);
      await refreshTransactionHistory(detail);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Đã chốt kết quả: ${tx.hash}`);
      toast.success('Đã chốt kết quả.');
    } catch (error) {
      const msg = getErrorMessage(error);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function openGroup(groupKey: string, electionAddress?: string | null) {
    const group = groupItems.find((item) => item.groupKey === groupKey);
    const firstPosition = electionAddress ?? group?.positions[0]?.address;
    const next = firstPosition
      ? `/app/dashboard?group=${encodeURIComponent(groupKey)}&election=${firstPosition}`
      : `/app/dashboard?group=${encodeURIComponent(groupKey)}`;
    navigate(next);
    setSelectedGroupKey(groupKey);
    if (firstPosition) {
      setSelectedElectionAddress(firstPosition);
    }
  }

  // Đợt 10 US4: tab cho khu chi tiết (chỉ trình bày, không đụng logic on-chain).
  async function copyTransactionHash(txHash: string) {
    await navigator.clipboard.writeText(txHash);
    toast.success('Đã sao chép mã giao dịch.');
  }

  async function copyTransactionUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success('Đã sao chép link kiểm chứng.');
  }

  const [detailTab, setDetailTab] = useState<'cand' | 'state'>('cand');
  const phaseTone: StatusTone = (() => {
    const p = (detail?.onChain?.phaseLabel ?? '').toLowerCase();
    if (p.includes('commit')) return 'info';
    if (p.includes('reveal')) return 'warning';
    if (p.includes('final')) return 'success';
    if (p.includes('cancel')) return 'danger';
    return 'neutral';
  })();

  const commitReason = getCommitReason(detail, connectedAccount, busy);
  const revealReason = getRevealReason(detail, connectedAccount, storedVoteEnvelope, busy);
  const finalizeReason = getFinalizeReason(detail, connectedAccount, busy);
  const phaseLabel = detail?.onChain?.phaseLabel ?? 'Unknown';
  const phaseDisplayLabel = displayPhaseLabel(phaseLabel);
  const maxResultCount = Math.max(1, ...(detail?.onChain?.results ?? []).map((item) => item.count));
  const viewerState = detail?.onChain?.viewer ?? null;
  const hasViewerCommitted = Boolean(viewerState?.hasCommitted);
  const hasViewerRevealed = Boolean(viewerState?.hasRevealed);
  const storedVoteCandidateName = storedVoteEnvelope?.candidateName?.trim() || null;
  const shouldShowLocalVoteState = Boolean(detail?.address && (hasViewerCommitted || storedVoteEnvelope));
  const currentPositionTitle = detail?.positionTitle || detail?.manifest?.positionTitle || detail?.title;
  const currentPositionLabel = currentPositionTitle ? String(currentPositionTitle) : null;
  const selectedGroup = groupItems.find((item) => item.groupKey === selectedGroupKey) ?? null;
  const selectedPositions = groupDetail?.positions ?? selectedGroup?.positions ?? [];
  const totalPositions = groupItems.reduce((sum, item) => sum + item.positionCount, 0);
  const hasGroups = groupItems.length > 0;
  const factoryAddress = publicConfig?.factoryAddress?.trim() || null;
  const chainLabel =
    Number(publicConfig?.chainId ?? TARGET_CHAIN_ID) === TARGET_CHAIN_ID
      ? 'Sepolia'
      : String(publicConfig?.chainId ?? TARGET_CHAIN_ID);
  const configLoaded = publicConfig !== null;
  const createReadinessLabel = !configLoaded
    ? 'Đang kiểm tra'
    : factoryAddress
      ? 'Sẵn sàng'
      : 'Chưa sẵn sàng';
  const createReadinessTone: StatusTone = !configLoaded
    ? 'neutral'
    : factoryAddress
      ? 'success'
      : 'warning';
  const dashboardMessage =
    configLoaded && !factoryAddress ? 'Thiếu cấu hình deploy ElectionV1.' : message;
  const selectedGroupDetailPath = selectedGroupKey ? buildElectionDetailPath(selectedGroupKey) : '/app/elections';
  const walletLabel = connectedAccount ? shortenAddress(connectedAccount) : 'Chưa nối';
  const walletBalanceLabel = walletBalance ? `${Number.parseFloat(walletBalance).toFixed(4)} SEP` : 'Chưa có số dư';
  const dashboardStats = [
    ['Bầu cử', String(groupItems.length)],
    ['Chức vụ', String(totalPositions)],
    ['Tạo bầu cử', createReadinessLabel],
    ['Ví', walletLabel],
  ];

  const ballotList = (
    <Panel padded={false} className="overflow-hidden">
      <div className="border-b border-[var(--clay-border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--clay-text)]">Bầu cử đang vận hành</p>
          {selectedGroup && (
            <StatusBadge tone={getViewerRoleTone(selectedGroup)}>
              {getViewerRoleLabel(selectedGroup)}
            </StatusBadge>
          )}
        </div>
        {selectedGroup ? (
          <div className="mt-3 rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-3">
            <p className="truncate text-sm font-semibold text-[var(--clay-text)]">
              {selectedGroup.title}
            </p>
            <p className="mt-1 text-xs text-[var(--clay-muted)]">
              {selectedGroup.positionCount} chức vụ · {selectedGroup.voterCount} cử tri
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[var(--clay-muted)]">
            Hãy chọn một bầu cử từ trang danh sách trước khi ghi nhận phiếu, mở phiếu hoặc
            chốt kết quả.
          </p>
        )}
      </div>

      <div className="border-b border-[var(--clay-border)] p-4">
        <Link
          to="/app/elections"
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
        >
          Đổi bầu cử từ danh sách
        </Link>
      </div>

      <div className="border-t border-[var(--clay-border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--clay-text)]">Chức vụ</p>
          <StatusBadge tone={selectedPositions.length > 0 ? 'info' : 'neutral'}>
            {selectedPositions.length}
          </StatusBadge>
        </div>
        {groupDetail && groupDetail.positions.length > 0 ? (
          <div className="mt-3 max-h-[280px] space-y-2 overflow-auto pr-1">
            {groupDetail.positions.map((position) => {
              const active =
                selectedElectionAddress?.toLowerCase() === position.address.toLowerCase();
              return (
                <button
                  key={position.address}
                  type="button"
                  onClick={() => openGroup(groupDetail.groupKey, position.address)}
                  className={`w-full rounded-[12px] border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)] ${
                    active
                      ? 'border-[var(--clay-primary)] bg-[var(--clay-primary-light)]'
                      : 'border-[var(--clay-border)] bg-[var(--clay-surface)] hover:bg-[var(--clay-surface-soft)]'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-[var(--clay-text)]">
                    {position.positionTitle || position.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--clay-muted)]">
                    {position.candidates.length} ứng viên · {shortenAddress(position.address)}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[var(--clay-muted)]">
            {groupDetail ? 'Bầu cử này chưa có chức vụ.' : 'Chọn bầu cử để xem chức vụ.'}
          </p>
        )}
      </div>
    </Panel>
  );

  const yesNo = (v?: boolean) => (
    <StatusBadge tone={v ? 'success' : 'neutral'}>{v ? 'Có' : 'Không'}</StatusBadge>
  );

  return (
    <div className="text-[var(--clay-text)]">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <StatusBadge tone="info">ElectionV1 · Sepolia</StatusBadge>
            <h1 className="mt-3 text-[1.75rem] font-semibold text-[var(--clay-text)]">
              Bảng điều khiển
            </h1>
            <p className="mt-1 text-[15px] text-[var(--clay-muted)]">
              Quản lý bầu cử ElectionV1, theo dõi giai đoạn và công bố kết quả trên Sepolia.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to={selectedGroupDetailPath}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-[var(--clay-primary)] px-5 text-[15px] text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              {selectedGroupKey ? 'Chi tiết bầu cử' : 'Danh sách bầu cử'}
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="whitespace-nowrap"
              onClick={() => void connectWallet()}
              iconLeft={<Wallet className="h-4 w-4" aria-hidden="true" />}
            >
              {connectedAccount ? 'Đổi ví' : 'Kết nối ví'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="whitespace-nowrap"
              onClick={() => void refreshAll()}
              iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
            >
              Tải lại
            </Button>
            <Link
              to="/app/elections/new"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tạo bầu cử
            </Link>
          </div>
        </div>

        {!getEthereum() && (
          <div
            role="alert"
            className="mb-4 rounded-[12px] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] p-3 text-xs text-[var(--state-warning)]"
          >
            Chưa phát hiện MetaMask. Cần ví MetaMask để kết nối và bỏ phiếu trên blockchain.{' '}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              Cài MetaMask
            </a>
          </div>
        )}

        <Panel padded={false} className="mb-5 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {dashboardStats.map(([label, value], index) => (
              <div
                key={label}
                className={`border-[var(--clay-border)] px-4 py-3 ${
                  index < 2 ? 'border-b md:border-b-0' : ''
                } ${index % 2 === 0 ? 'border-r' : 'md:border-r'} ${
                  index === dashboardStats.length - 1 ? 'md:border-r-0' : ''
                }`}
              >
                <p className="text-[11px] font-semibold uppercase text-[var(--clay-muted)]">
                  {label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--clay-text)]">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        {!hasGroups ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <EmptyState
              className="min-h-[360px]"
              icon={<ListChecks className="h-6 w-6" aria-hidden="true" />}
              title="Chưa có bầu cử"
              description="Tạo bầu cử đầu tiên để bắt đầu vận hành ElectionV1."
            />
            <Panel className="p-4">
              <p className="text-sm font-semibold text-[var(--clay-text)]">Trạng thái</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Mạng</span>
                  <span className="font-semibold" title={`Chain ${publicConfig?.chainId ?? TARGET_CHAIN_ID}`}>
                    {chainLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Tạo bầu cử</span>
                  <StatusBadge tone={createReadinessTone}>{createReadinessLabel}</StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Ví</span>
                  {connectedAccount ? (
                    <span className="max-w-[150px] truncate font-mono text-[12px]" title={connectedAccount}>
                      {walletLabel}
                    </span>
                  ) : (
                    <span className="text-[var(--clay-muted)]">Chưa nối</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Số dư</span>
                  <span className="font-semibold">{walletBalanceLabel}</span>
                </div>
              </div>
              <p className="mt-4 break-words border-t border-[var(--clay-border)] pt-3 text-[13px] leading-relaxed text-[var(--clay-muted)]" aria-live="polite">
                {dashboardMessage}
              </p>
            </Panel>
          </div>
        ) : !selectedGroupKey ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <EmptyState
              className="min-h-[360px]"
              icon={<ListChecks className="h-6 w-6" aria-hidden="true" />}
              title="Chọn bầu cử từ danh sách"
              description="Bảng điều khiển chỉ mở màn vận hành cho một bầu cử cụ thể. Hãy vào danh sách, lọc theo vai trò rồi chọn bầu cử cần xử lý."
              action={
                <Link
                  to="/app/elections"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-5 text-[15px] text-white hover:bg-[var(--clay-primary-focus)]"
                >
                  Danh sách bầu cử
                </Link>
              }
            />
            <Panel className="p-4">
              <p className="text-sm font-semibold text-[var(--clay-text)]">Tổng quan hệ thống</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Bầu cử đã triển khai</span>
                  <span className="font-semibold">{groupItems.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Chức vụ</span>
                  <span className="font-semibold">{totalPositions}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--clay-muted)]">Ví hiện tại</span>
                  <span className="max-w-[160px] truncate font-mono text-[12px]" title={connectedAccount ?? undefined}>
                    {walletLabel}
                  </span>
                </div>
              </div>
              <p className="mt-4 border-t border-[var(--clay-border)] pt-3 text-[13px] leading-relaxed text-[var(--clay-muted)]">
                Luồng đúng là Danh sách bầu cử → Chi tiết bầu cử → Bảng điều khiển. Màn này không tự chọn bầu cử đầu tiên để tránh thao tác nhầm khi có nhiều đợt.
              </p>
            </Panel>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              {ballotList}
              <Panel className="p-4">
                <p className="text-[13px] font-semibold text-[var(--clay-text)]">Trạng thái</p>
                <p className="mt-1 break-words text-[13px] leading-relaxed text-[var(--clay-muted)]" aria-live="polite">
                  {dashboardMessage}
                </p>
              </Panel>
            </div>

            <div className="min-w-0">
              {detail ? (
              <Panel>
                <div className="-mx-5 mb-5 flex flex-col gap-3 border-b border-[var(--clay-border)] px-5 pb-4 md:-mx-6 md:px-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                      {groupDetail?.title ?? detail.groupTitle ?? 'Nhóm bầu cử'}
                    </p>
                    <h2 className="mt-1 truncate text-2xl font-semibold text-[var(--clay-text)]">
                      {currentPositionLabel ?? 'Chưa rõ chức vụ'}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                      {detail.description || 'Không có mô tả.'}
                    </p>
                  </div>
                  <StatusBadge tone={phaseTone}>{phaseDisplayLabel}</StatusBadge>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Hết nhận phiếu', formatUnix(detail.commitEnd)],
                    ['Hết mở phiếu', formatUnix(detail.revealEnd)],
                    ['Đã ghi nhận', String(detail.onChain?.totalCommits ?? '0')],
                    ['Đã mở phiếu', String(detail.onChain?.totalReveals ?? '0')],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4"
                    >
                      <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                        {k}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-[var(--clay-text)]">{v}</p>
                    </div>
                  ))}
                </div>

                <Tabs
                  value={detailTab}
                  onValueChange={(k) => setDetailTab(k as 'cand' | 'state')}
                  items={[
                    {
                      key: 'cand',
                      label: 'Ứng viên & kết quả',
                      content: (
                        <div className="space-y-3">
                          {shouldShowLocalVoteState && (
                            <div className="rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--clay-text)]">
                                    Phiếu của ví này
                                  </p>
                                  {storedVoteCandidateName ? (
                                    <p className="mt-1 text-sm text-[var(--clay-muted)]">
                                      Bạn đã ghi nhận phiếu cho:{' '}
                                      <span className="font-semibold text-[var(--clay-text)]">
                                        {storedVoteCandidateName}
                                      </span>
                                    </p>
                                  ) : hasViewerCommitted ? (
                                    <p className="mt-1 text-sm leading-6 text-[var(--state-warning)]">
                                      Ví này đã có commitment trên chain, nhưng trình duyệt hiện tại không có gói mở phiếu cục bộ.
                                      Nếu gói này bị mất, không thể khôi phục salt để mở phiếu.
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                                      Trình duyệt này có gói phiếu cục bộ cho chức vụ này; hãy kết nối đúng ví để đồng bộ trạng thái on-chain.
                                    </p>
                                  )}
                                </div>
                                <StatusBadge tone={hasViewerRevealed ? 'success' : storedVoteEnvelope ? 'info' : 'warning'}>
                                  {hasViewerRevealed ? 'Đã mở phiếu' : storedVoteEnvelope ? 'Có gói mở phiếu' : 'Thiếu gói mở phiếu'}
                                </StatusBadge>
                              </div>
                              {hasViewerCommitted && !hasViewerRevealed && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => void handleRevealVote()}
                                    disabled={revealReason !== null}
                                    loading={busy}
                                  >
                                    Mở phiếu đã ghi nhận
                                  </Button>
                                  <p className="text-xs leading-5 text-[var(--clay-muted)]">
                                    {revealReason ?? 'Đang ở giai đoạn mở phiếu, có thể gửi giao dịch reveal ngay.'}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {(detail.onChain?.results ?? []).map((candidate) => (
                            <div
                              key={candidate.candidateId}
                              className="rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-4"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-[var(--clay-text)]">
                                    {candidate.candidateName}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-[var(--clay-muted)]">
                                    {candidate.candidateWalletAddress || candidate.candidateId}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--clay-primary-light)]">
                                    <div
                                      className="h-full rounded-full bg-[var(--clay-primary)]"
                                      style={{ width: `${(candidate.count / maxResultCount) * 100}%` }}
                                    />
                                  </div>
                                  <span className="min-w-10 text-right text-lg font-semibold text-[var(--clay-text)]">
                                    {candidate.count}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="primary"
                                size="lg"
                                className="mt-4 w-full"
                                onClick={() => void handleCommitVote(candidate)}
                                disabled={commitReason !== null || busy}
                                loading={committingCandidateId === candidate.candidateId}
                              >
                                {committingCandidateId === candidate.candidateId
                                  ? 'Đang ghi nhận phiếu…'
                                  : 'Ghi nhận phiếu cho ứng viên này'}
                              </Button>
                            </div>
                          ))}
                          {commitReason && (
                            <p className="text-xs text-[var(--clay-muted)]">{commitReason}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'state',
                      label: 'Trạng thái & hành động',
                      content: (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <Panel className="bg-[var(--clay-surface-soft)]">
                            <p className="text-sm font-semibold text-[var(--clay-text)]">
                              Trạng thái ví
                            </p>
                            <div className="mt-3 space-y-2.5 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Ví</span>
                                <span className="font-mono text-[12px]">
                                  {shortenAddress(connectedAccount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đủ điều kiện</span>
                                {yesNo(detail.onChain?.viewer?.eligible)}
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đã ghi nhận</span>
                                {yesNo(detail.onChain?.viewer?.hasCommitted)}
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đã mở phiếu</span>
                                {yesNo(detail.onChain?.viewer?.hasRevealed)}
                              </div>
                            </div>
                          </Panel>

                          <Panel className="bg-[var(--clay-surface-soft)]">
                            <p className="text-sm font-semibold text-[var(--clay-text)]">
                              Hành động
                            </p>
                            <div className="mt-3 space-y-2.5">
                              <Button
                                type="button"
                                variant="secondary"
                                size="lg"
                                className="w-full"
                                onClick={() => void handleRevealVote()}
                                disabled={revealReason !== null}
                                loading={busy}
                              >
                                Mở phiếu đã ghi nhận
                              </Button>
                              <p className="text-xs text-[var(--clay-muted)]">
                                {revealReason ?? 'Sẵn sàng mở phiếu cho chức vụ này.'}
                              </p>
                              <p className="text-[11px] text-[var(--state-warning)]">
                                Lưu ý: bí mật phiếu được mã hoá cục bộ bằng chữ ký ví. Bước mở phiếu phải dùng{' '}
                                <strong>đúng ví và đúng trình duyệt/thiết bị</strong> đã ghi nhận phiếu; xoá
                                dữ liệu trình duyệt sẽ mất khả năng mở phiếu.
                              </p>
                              <Button
                                type="button"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                onClick={() => void handleFinalizeElection()}
                                disabled={finalizeReason !== null}
                                loading={busy}
                              >
                                Chốt kết quả
                              </Button>
                              <p className="text-xs text-[var(--clay-muted)]">
                                {finalizeReason ?? 'Sẵn sàng chốt kết quả.'}
                              </p>
                            </div>
                          </Panel>

                          <Panel className="bg-[var(--clay-surface-soft)] lg:col-span-2">
                            <p className="text-sm font-semibold text-[var(--clay-text)]">Liên kết</p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <a
                                href={detail.links?.contract ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] ${!detail.links?.contract ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Mở hợp đồng
                              </a>
                              <a
                                href={detail.links?.transaction ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] ${!detail.links?.transaction ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Mở giao dịch tạo
                              </a>
                            </div>
                          </Panel>
                        </div>
                      ),
                    },
                  ]}
                />
                <BlockchainTransactionHistory
                  entries={transactionHistory}
                  loading={transactionsLoading}
                  error={transactionsError}
                  selectedTxHash={selectedTxHash}
                  onSelectTx={setSelectedTxHash}
                  onCopyTx={(txHash) => void copyTransactionHash(txHash)}
                  onCopyUrl={(url) => void copyTransactionUrl(url)}
                />
              </Panel>
            ) : (
              <EmptyState
                className="min-h-[360px]"
                icon={<Vote className="h-6 w-6" aria-hidden="true" />}
                title="Chọn chức vụ"
                description="Mở một chức vụ trong bầu cử để xem trạng thái blockchain và thao tác."
              />
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
