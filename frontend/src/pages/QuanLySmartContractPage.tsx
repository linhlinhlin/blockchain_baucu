import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, RefreshCw, Vote, Wallet, XCircle } from 'lucide-react';
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

const TARGET_CHAIN_ID = 11155111;
const TARGET_CHAIN_ID_HEX = '0xaa36a7';
const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
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

function panelClasses() {
  return 'clay-panel p-5 md:p-6';
}

function commandButtonClasses(tone: 'dark' | 'accent' | 'outline') {
  const base =
    'clay-button inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40';
  if (tone === 'accent') {
    return `${base} clay-button--blueberry`;
  }
  if (tone === 'outline') {
    return `${base} clay-button--ghost`;
  }
  return `${base} clay-button--matcha`;
}

function messagePanelClasses(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('thanh cong') || normalized.includes('success')) {
    return 'border-[rgba(2,73,42,0.18)] bg-[rgba(132,231,165,0.24)] text-[var(--clay-matcha-dark)]';
  }
  if (normalized.includes('loi') || normalized.includes('error') || normalized.includes('fail') || normalized.includes('revert')) {
    return 'border-[rgba(252,121,129,0.22)] bg-[rgba(252,121,129,0.18)] text-[var(--clay-text)]';
  }
  return 'border-[rgba(59,211,253,0.22)] bg-[rgba(59,211,253,0.18)] text-[var(--clay-text)]';
}

function phaseAccentClasses(phaseLabel?: string) {
  switch (phaseLabel) {
    case 'Commit':
      return 'border-[rgba(208,138,17,0.22)] bg-[rgba(248,204,101,0.3)] text-[var(--clay-text)]';
    case 'Reveal':
      return 'border-[rgba(1,65,141,0.2)] bg-[rgba(59,211,253,0.24)] text-[var(--clay-text)]';
    case 'Ended':
      return 'border-[var(--clay-border)] bg-[rgba(255,255,255,0.78)] text-[var(--clay-text)]';
    case 'Finalized':
      return 'border-[rgba(2,73,42,0.18)] bg-[rgba(132,231,165,0.24)] text-[var(--clay-text)]';
    case 'Canceled':
      return 'border-[rgba(252,121,129,0.22)] bg-[rgba(252,121,129,0.18)] text-[var(--clay-text)]';
    default:
      return 'border-[rgba(67,8,159,0.2)] bg-[rgba(193,176,255,0.24)] text-[var(--clay-text)]';
  }
}

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

// UX (spec 006/M6): trạng thái không chỉ bằng màu — kèm icon + nhãn + aria.
function YesNoBadge({ value }: { value?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-right" aria-label={value ? 'Có' : 'Không'}>
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 text-[var(--clay-muted)]" aria-hidden />
      )}
      <span className="text-black">{value ? 'Có' : 'Không'}</span>
    </span>
  );
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

function getCommitReason(detail: ElectionV1Detail | null, walletAddress: string | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!detail?.onChain?.viewer?.eligible) return 'Ví hiện tại không nằm trong danh sách cử tri của chức vụ này.';
  if (detail.onChain.viewer.hasCommitted) return 'Ví này đã commit cho chức vụ này.';
  if (detail.onChain.phaseLabel !== 'Commit') return `Giai đoạn hiện tại là ${detail.onChain.phaseLabel}, chưa thể commit.`;
  return null;
}

function getRevealReason(detail: ElectionV1Detail | null, walletAddress: string | null, voteEnvelope: StoredVoteEnvelope | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!voteEnvelope) return 'Không tìm thấy vote package cục bộ cho ví/thiết bị này. Reveal phải dùng đúng ví và trình duyệt đã commit.';
  if (!detail?.onChain?.viewer?.hasCommitted) return 'Ví này chưa commit.';
  if (detail.onChain.viewer.hasRevealed) return 'Ví này đã reveal rồi.';
  if (detail.onChain.phaseLabel !== 'Reveal') return `Giai đoạn hiện tại là ${detail.onChain.phaseLabel}, chưa thể reveal.`;
  return null;
}

function getFinalizeReason(detail: ElectionV1Detail | null, walletAddress: string | null, busy: boolean) {
  if (busy) return 'Đang xử lý giao dịch hoặc tải dữ liệu.';
  if (!walletAddress) return 'Hãy kết nối MetaMask trước.';
  if (!detail?.onChain) return 'Chưa tải được trạng thái election.';
  if (detail.onChain.finalized) return 'Election đã finalized.';
  if (detail.onChain.canceled) return 'Election đã bị hủy.';
  if (detail.onChain.phaseLabel !== 'Ended') return `Giai đoạn hiện tại là ${detail.onChain.phaseLabel}, chưa thể finalize.`;
  return null;
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

  const storedVoteEnvelope = useMemo(() => {
    if (!detail?.address || !connectedAccount) {
      return null;
    }
    return loadStoredVoteEnvelope(detail.address, connectedAccount);
  }, [detail?.address, connectedAccount, votePackageRevision]);

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
  }, [selectedGroupKey]);

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
      return;
    }
    void refreshElection(selectedElectionAddress, connectedAccount);
  }, [selectedElectionAddress, connectedAccount]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return undefined;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const nextAccount = accounts[0] ?? null;
      setConnectedAccount(nextAccount);
      setVotePackageRevision((current) => current + 1);
      setMessage(nextAccount ? `Đã chuyển ví sang ${nextAccount}` : 'MetaMask đã ngắt kết nối.');
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
      const [config, groups] = await Promise.all([getElectionV1PublicConfig(), listElectionV1Groups()]);
      setPublicConfig(config);
      setGroupItems(groups);
      const requestedGroup = searchParams.get('group');
      const preferredGroup =
        groups.find((item) => item.groupKey.toLowerCase() === requestedGroup?.toLowerCase())?.groupKey ??
        groups[0]?.groupKey ??
        null;
      setSelectedGroupKey(preferredGroup);

      const ethereum = getEthereum();
      if (ethereum) {
        const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
        if (accounts.length > 0) {
          setConnectedAccount(accounts[0]);
          await loadWalletBalance(accounts[0], config.rpcUrl ?? DEFAULT_RPC_URL);
        }
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function refreshGroup(groupKey: string) {
    try {
      const payload = await getElectionV1GroupDetail(groupKey);
      setGroupDetail(payload);
    } catch (error) {
      setMessage(getErrorMessage(error));
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
          setMessage(`Không đồng bộ được on-chain state từ frontend: ${getErrorMessage(error)}`);
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

  async function refreshAll(addressToKeep?: string | null, groupToKeep?: string | null) {
    const groups = await listElectionV1Groups();
    setGroupItems(groups);
    const nextGroup = groupToKeep ?? selectedGroupKey ?? groups[0]?.groupKey ?? null;
    setSelectedGroupKey(nextGroup);
    if (nextGroup) {
      const group = await getElectionV1GroupDetail(nextGroup);
      setGroupDetail(group);
      const nextElection = addressToKeep ?? selectedElectionAddress ?? group.positions[0]?.address ?? null;
      setSelectedElectionAddress(nextElection);
      if (nextElection) {
        await refreshElection(nextElection, connectedAccount);
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
      setMessage(nextAccount ? `Đã kết nối ví ${nextAccount}` : 'Không tìm thấy tài khoản MetaMask.');
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
      const tx = await contract.commitVote(commitment, proofPayload.proof);
      await tx.wait();

      // S4: ma hoa secret bang khoa dan xuat tu chu ky vi truoc khi luu localStorage.
      const voteKey = await deriveVoteAesKey(signer, detail.address, address);
      const sealed = await encryptVoteSecret(voteKey, {
        candidateId: candidate.candidateId,
        salt,
        commitment: String(commitment),
      });
      saveStoredVoteEnvelope({
        electionAddress: detail.address,
        voter: address,
        candidateName: candidate.candidateName,
        committedAt: new Date().toISOString(),
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
      });

      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Commit thành công: ${tx.hash}`);
      toast.success('Commit phiếu thành công.');
    } catch (error) {
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
      // S5: vote package phai thuoc dung vi dang ket noi.
      if (!envelope || envelope.voter.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Vote package không thuộc ví đang kết nối. Hãy dùng đúng ví và trình duyệt đã commit.');
      }
      let secret: VoteSecret;
      try {
        const voteKey = await deriveVoteAesKey(signer, detail.address, address);
        secret = await decryptVoteSecret(voteKey, envelope.iv, envelope.ciphertext);
      } catch {
        throw new Error('Không giải mã được vote package. Phải dùng đúng ví và trình duyệt đã commit.');
      }
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const tx = await contract.revealVote(secret.candidateId, secret.salt);
      await tx.wait();

      saveStoredVoteEnvelope({
        ...envelope,
        revealedAt: new Date().toISOString(),
      });

      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Reveal thành công: ${tx.hash}`);
      toast.success('Reveal phiếu thành công.');
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
      await refreshElection(detail.address, address);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Finalize thành công: ${tx.hash}`);
      toast.success('Finalize election thành công.');
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
      ? `/app/quan-ly-smart-contract?group=${encodeURIComponent(groupKey)}&election=${firstPosition}`
      : `/app/quan-ly-smart-contract?group=${encodeURIComponent(groupKey)}`;
    navigate(next);
    setSelectedGroupKey(groupKey);
    if (firstPosition) {
      setSelectedElectionAddress(firstPosition);
    }
  }

  const commitReason = getCommitReason(detail, connectedAccount, busy);
  const revealReason = getRevealReason(detail, connectedAccount, storedVoteEnvelope, busy);
  const finalizeReason = getFinalizeReason(detail, connectedAccount, busy);
  const phaseLabel = detail?.onChain?.phaseLabel ?? 'Unknown';
  const maxResultCount = Math.max(1, ...(detail?.onChain?.results ?? []).map((item) => item.count));
  const currentPositionTitle = detail?.positionTitle || detail?.manifest?.positionTitle || detail?.title;

  return (
    <div className="min-h-screen overflow-hidden text-[var(--clay-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(248,204,101,0.3),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,211,253,0.18),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(193,176,255,0.15),_transparent_22%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_340px]">
          <div className={panelClasses()}>
            <div className="clay-badge bg-[rgba(193,176,255,0.42)]">
              <Vote className="h-3.5 w-3.5" />
              Group ballot console
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-extrabold tracking-[-0.05em] text-black md:text-5xl">Quản lý biểu bầu cử nhiều chức vụ</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--clay-muted)]">
              Chọn một ballot group, sau đó chọn từng chức vụ để commit, reveal và finalize. Mỗi chức vụ là một child election riêng trên ElectionV1.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(248,204,101,0.24)] p-4 shadow-[var(--clay-shadow)]">
                <p className="clay-label">Chain</p>
                <p className="mt-2 text-lg font-semibold text-black">{publicConfig?.chainId ?? TARGET_CHAIN_ID}</p>
              </div>
              <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(59,211,253,0.16)] p-4 shadow-[var(--clay-shadow)]">
                <p className="clay-label">Factory</p>
                <p className="mt-2 text-lg font-semibold text-black">{shortenAddress(publicConfig?.factoryAddress)}</p>
              </div>
              <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(132,231,165,0.18)] p-4 shadow-[var(--clay-shadow)]">
                <p className="clay-label">Wallet</p>
                <p className="mt-2 text-lg font-semibold text-black">{shortenAddress(connectedAccount)}</p>
              </div>
              <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(252,121,129,0.16)] p-4 shadow-[var(--clay-shadow)]">
                <p className="clay-label">Balance</p>
                <p className="mt-2 text-lg font-semibold text-black">{walletBalance ? `${walletBalance} SEP` : 'n/a'}</p>
              </div>
            </div>
          </div>

          <div className={panelClasses()}>
            <div className="space-y-3">
              <button type="button" onClick={() => void connectWallet()} className={`${commandButtonClasses('dark')} w-full`}>
                <Wallet className="h-4 w-4" />
                {connectedAccount ? 'Đổi / kết nối lại MetaMask' : 'Kết nối MetaMask'}
              </button>

              <button type="button" onClick={() => void refreshAll()} className={`${commandButtonClasses('outline')} w-full`}>
                <RefreshCw className="h-4 w-4" />
                Tải lại ballot
              </button>

              <Link to="/app/tao-phien-bau-cu" className={`${commandButtonClasses('accent')} w-full`}>
                <ArrowRight className="h-4 w-4" />
                Tạo ballot mới
              </Link>
            </div>

            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${messagePanelClasses(message)}`}>
              <p className="font-semibold text-black">Live status</p>
              <p className="mt-1">{message}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,240px)_minmax(0,1fr)]">
          <div className={panelClasses()}>
            <p className="text-sm font-semibold text-black">Danh sách ballot</p>
            <div className="mt-4 space-y-3">
              {groupItems.map((group) => {
                const active = selectedGroupKey === group.groupKey;
                return (
                  <button
                    key={group.groupKey}
                    type="button"
                    onClick={() => openGroup(group.groupKey)}
                    className={`w-full rounded-[24px] border p-4 text-left shadow-[var(--clay-shadow)] transition ${
                      active
                        ? 'border-[rgba(208,138,17,0.25)] bg-[rgba(248,204,101,0.34)]'
                        : 'border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] hover:bg-[rgba(132,231,165,0.16)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-black">{group.title}</p>
                        <p className="mt-1 text-xs text-[var(--clay-muted)]">{group.positionCount} chức vụ</p>
                      </div>
                      <span className="rounded-full border border-[var(--clay-border)] bg-white px-2 py-1 text-[11px] text-[var(--clay-muted)]">
                        {group.groupKey}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={panelClasses()}>
            <p className="text-sm font-semibold text-black">Chức vụ trong ballot</p>
            {groupDetail ? (
              <div className="mt-4 space-y-3">
                {groupDetail.positions.map((position) => {
                  const active = selectedElectionAddress?.toLowerCase() === position.address.toLowerCase();
                  return (
                    <button
                      key={position.address}
                      type="button"
                      onClick={() => openGroup(groupDetail.groupKey, position.address)}
                      className={`w-full rounded-[24px] border p-4 text-left shadow-[var(--clay-shadow)] transition ${
                        active
                          ? 'border-[rgba(1,65,141,0.22)] bg-[rgba(59,211,253,0.24)]'
                          : 'border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] hover:bg-[rgba(193,176,255,0.18)]'
                      }`}
                    >
                      <p className="text-sm font-semibold text-black">{position.positionTitle || position.title}</p>
                      <p className="mt-1 text-xs text-[var(--clay-muted)]">{position.candidates.length} ứng viên</p>
                      <p className="mt-2 text-xs text-[var(--clay-muted-soft)]">{shortenAddress(position.address)}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--clay-muted)]">Chọn một ballot để xem các chức vụ.</p>
            )}
          </div>

          <div className="space-y-6">
            <div className={panelClasses()}>
              {detail ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="clay-label">{groupDetail?.title ?? detail.groupTitle ?? 'Ballot group'}</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-black">{currentPositionTitle}</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--clay-muted)]">{detail.description || 'Không có mô tả.'}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${phaseAccentClasses(phaseLabel)}`}>
                      {phaseLabel}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--clay-shadow)]">
                      <p className="clay-label">Commit end</p>
                      <p className="mt-2 text-sm font-semibold text-black">{formatUnix(detail.commitEnd)}</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--clay-shadow)]">
                      <p className="clay-label">Reveal end</p>
                      <p className="mt-2 text-sm font-semibold text-black">{formatUnix(detail.revealEnd)}</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--clay-shadow)]">
                      <p className="clay-label">Commits</p>
                      <p className="mt-2 text-sm font-semibold text-black">{detail.onChain?.totalCommits ?? '0'}</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--clay-shadow)]">
                      <p className="clay-label">Reveals</p>
                      <p className="mt-2 text-sm font-semibold text-black">{detail.onChain?.totalReveals ?? '0'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-black">Ứng viên và kết quả đã reveal</p>
                      {(detail.onChain?.results ?? []).map((candidate) => (
                        <div key={candidate.candidateId} className="rounded-[24px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[var(--clay-shadow)]">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-black">{candidate.candidateName}</p>
                              <p className="mt-1 text-xs text-[var(--clay-muted)]">{candidate.candidateWalletAddress || candidate.candidateId}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-[rgba(1,65,141,0.12)]">
                                <div className="h-full rounded-full bg-[var(--clay-blueberry)]" style={{ width: `${(candidate.count / maxResultCount) * 100}%` }} />
                              </div>
                              <span className="min-w-10 text-right text-lg font-semibold text-black">{candidate.count}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleCommitVote(candidate)}
                            disabled={commitReason !== null || busy}
                            aria-busy={committingCandidateId === candidate.candidateId}
                            className={`${commandButtonClasses('accent')} mt-4 w-full`}
                          >
                            {committingCandidateId === candidate.candidateId ? (
                              <span className="inline-flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang commit…
                              </span>
                            ) : (
                              'Commit cho ứng viên này'
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-black">Viewer state</p>
                        <div className="mt-4 space-y-3 text-sm text-[var(--clay-muted)]">
                          <div className="flex items-center justify-between gap-4">
                            <span>Wallet</span>
                            <span className="text-right text-black">{shortenAddress(connectedAccount)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Đủ điều kiện</span>
                            <YesNoBadge value={detail.onChain?.viewer?.eligible} />
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Đã commit</span>
                            <YesNoBadge value={detail.onChain?.viewer?.hasCommitted} />
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Đã reveal</span>
                            <YesNoBadge value={detail.onChain?.viewer?.hasRevealed} />
                          </div>
                        </div>
                      </div>

                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-black">Action rail</p>
                        <div className="mt-4 space-y-3">
                          <button type="button" onClick={() => void handleRevealVote()} disabled={revealReason !== null} aria-busy={busy} className={`${commandButtonClasses('outline')} w-full`}>
                            {busy ? (
                              <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang xử lý giao dịch…</span>
                            ) : (
                              'Reveal vote'
                            )}
                          </button>
                          <p className="text-xs text-[var(--clay-muted)]">{revealReason ?? 'Sẵn sàng reveal cho chức vụ này.'}</p>
                          <p className="text-[11px] text-amber-600">
                            ⚠️ Bí mật phiếu được mã hoá cục bộ bằng chữ ký ví. Reveal phải dùng <strong>đúng ví và đúng trình duyệt/thiết bị</strong> đã commit; xoá dữ liệu trình duyệt sẽ mất khả năng reveal.
                          </p>

                          <button type="button" onClick={() => void handleFinalizeElection()} disabled={finalizeReason !== null} aria-busy={busy} className={`${commandButtonClasses('dark')} w-full`}>
                            {busy ? (
                              <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Đang xử lý giao dịch…</span>
                            ) : (
                              'Finalize election'
                            )}
                          </button>
                          <p className="text-xs text-[var(--clay-muted)]">{finalizeReason ?? 'Sẵn sàng finalize.'}</p>
                        </div>
                      </div>

                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-black">Explorer</p>
                        <div className="mt-4 space-y-3">
                          <a href={detail.links?.contract ?? '#'} target="_blank" rel="noreferrer" className={`${commandButtonClasses('outline')} w-full ${!detail.links?.contract ? 'pointer-events-none opacity-50' : ''}`}>
                            <ExternalLink className="h-4 w-4" />
                            Mở contract trên explorer
                          </a>
                          <a href={detail.links?.transaction ?? '#'} target="_blank" rel="noreferrer" className={`${commandButtonClasses('outline')} w-full ${!detail.links?.transaction ? 'pointer-events-none opacity-50' : ''}`}>
                            <ExternalLink className="h-4 w-4" />
                            Mở giao dịch tạo election
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--clay-muted)]">Chọn một ballot và một chức vụ để bắt đầu bỏ phiếu.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
