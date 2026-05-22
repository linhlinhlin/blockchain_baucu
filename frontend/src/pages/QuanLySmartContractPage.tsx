import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldCheck,
  Vote,
  Wallet,
} from 'lucide-react';
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
      ? `/app/dashboard?group=${encodeURIComponent(groupKey)}&election=${firstPosition}`
      : `/app/dashboard?group=${encodeURIComponent(groupKey)}`;
    navigate(next);
    setSelectedGroupKey(groupKey);
    if (firstPosition) {
      setSelectedElectionAddress(firstPosition);
    }
  }

  // Đợt 10 US4: tab cho khu chi tiết (chỉ trình bày, không đụng logic on-chain).
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
  const maxResultCount = Math.max(1, ...(detail?.onChain?.results ?? []).map((item) => item.count));
  const currentPositionTitle = detail?.positionTitle || detail?.manifest?.positionTitle || detail?.title;
  const currentPositionLabel = currentPositionTitle ? String(currentPositionTitle) : null;
  const selectedGroup = groupItems.find((item) => item.groupKey === selectedGroupKey) ?? null;
  const selectedPositions = groupDetail?.positions ?? selectedGroup?.positions ?? [];
  const totalPositions = groupItems.reduce((sum, item) => sum + item.positionCount, 0);
  const selectedGroupTitle = groupDetail?.title ?? selectedGroup?.title ?? null;
  const selectedGroupVoterCount = groupDetail?.voterCount ?? selectedGroup?.voterCount ?? 0;
  const walletBalanceLabel = walletBalance ? `${Number.parseFloat(walletBalance).toFixed(4)} SEP` : 'Chưa có số dư';
  const dashboardMetrics = [
    {
      label: 'Ballot group',
      value: String(groupItems.length),
      sub: selectedGroupTitle ?? 'Chưa chọn ballot',
    },
    {
      label: 'Chức vụ đã deploy',
      value: String(totalPositions),
      sub: selectedGroup ? `${selectedPositions.length} chức vụ trong ballot đang chọn` : 'Chọn ballot để xem chức vụ',
    },
    {
      label: 'Giai đoạn hiện tại',
      value: detail ? phaseLabel : 'Chưa chọn',
      sub: currentPositionLabel ?? 'Mở một chức vụ để xem on-chain state',
    },
    {
      label: 'Ví MetaMask',
      value: connectedAccount ? shortenAddress(connectedAccount) : 'Chưa nối',
      sub: connectedAccount ? walletBalanceLabel : 'Cần ví Sepolia để thao tác',
    },
  ];
  const metricCellBorders = [
    'border-b md:border-r xl:border-b-0',
    'border-b xl:border-b-0 xl:border-r',
    'border-b md:border-b-0 md:border-r xl:border-r',
    '',
  ];
  const operationSteps = [
    {
      title: 'Chọn ballot group',
      done: Boolean(selectedGroup),
      body: selectedGroupTitle ?? 'Chọn một ballot ở danh sách bên trái hoặc tạo ballot mới.',
    },
    {
      title: 'Chọn chức vụ',
      done: Boolean(detail),
      body: currentPositionLabel ?? 'Mỗi chức vụ là một ElectionV1 contract độc lập.',
    },
    {
      title: 'Kiểm tra ví',
      done: Boolean(connectedAccount),
      body: connectedAccount ? `${shortenAddress(connectedAccount)} · ${walletBalanceLabel}` : 'Kết nối MetaMask ở mạng Sepolia.',
    },
    {
      title: 'Commit / reveal / finalize',
      done: Boolean(detail?.onChain?.finalized),
      body: detail ? `Đang ở giai đoạn ${phaseLabel}.` : 'Khi đã chọn chức vụ, dashboard sẽ mở đúng hành động khả dụng.',
    },
  ];

  const ballotList = (
    <Panel padded={false} className="overflow-hidden">
      <div className="border-b border-[var(--clay-border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--clay-text)]">Ballot group</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--clay-muted)]">
              Chọn ballot trước, sau đó chọn từng chức vụ để thao tác on-chain.
            </p>
          </div>
          <StatusBadge tone="neutral">{groupItems.length}</StatusBadge>
        </div>
      </div>

      <div className="max-h-[300px] space-y-2 overflow-auto p-3">
        {groupItems.length > 0 ? (
          groupItems.map((group) => {
            const active = selectedGroupKey === group.groupKey;
            return (
              <button
                key={group.groupKey}
                type="button"
                onClick={() => openGroup(group.groupKey)}
                className={`w-full rounded-[12px] border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)] ${
                  active
                    ? 'border-[var(--clay-primary)] bg-[var(--clay-primary-light)]'
                    : 'border-[var(--clay-border)] bg-[var(--clay-surface)] hover:bg-[var(--clay-surface-soft)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--clay-text)]">
                      {group.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--clay-muted)]">
                      {group.positionCount} chức vụ · {group.voterCount} cử tri
                    </p>
                  </div>
                  <span className="max-w-[112px] shrink-0 truncate rounded-full border border-[var(--clay-border)] bg-[var(--clay-surface)] px-2 py-0.5 text-[11px] text-[var(--clay-muted)]">
                    {group.groupKey}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-2 py-8 text-center">
            <ListChecks className="mx-auto h-8 w-8 text-[var(--clay-muted)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--clay-text)]">Chưa có ballot group</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--clay-muted)]">
              Tạo ballot mới để dashboard có dữ liệu vận hành.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--clay-border)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--clay-text)]">Chức vụ trong ballot</p>
            <p className="mt-1 text-xs text-[var(--clay-muted)]">
              {selectedGroup
                ? `${selectedGroupVoterCount} cử tri trong ballot đang chọn`
                : 'Chọn ballot group để xem danh sách chức vụ.'}
            </p>
          </div>
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
            {groupDetail
              ? 'Ballot này chưa có chức vụ được deploy.'
              : 'Sau khi chọn ballot, các chức vụ sẽ hiện ở đây để mở dashboard chi tiết.'}
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
              Trung tâm vận hành ballot: theo dõi cấu hình, chọn chức vụ, commit/reveal phiếu và finalize đúng giai đoạn.
            </p>
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
              {connectedAccount ? 'Đổi / kết nối lại MetaMask' : 'Kết nối MetaMask'}
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
            Chưa phát hiện MetaMask. Cần ví MetaMask để kết nối và bỏ phiếu on-chain.{' '}
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

        <Panel padded={false} className="mb-6 overflow-hidden">
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map((metric, index) => (
              <div
                key={metric.label}
                className={`border-[var(--clay-border)] p-4 ${metricCellBorders[index] ?? ''}`}
              >
                <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                  {metric.label}
                </p>
                <p className="mt-2 truncate text-2xl font-semibold text-[var(--clay-text)]">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--clay-muted)]">
                  {metric.sub}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {ballotList}
            <Panel className="p-4">
              <p className="text-[13px] font-semibold text-[var(--clay-text)]">Trạng thái</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--clay-muted)]" aria-live="polite">
                {message}
              </p>
            </Panel>
          </div>

          <div className="min-w-0">
            {detail ? (
              <Panel>
                <div className="-mx-5 mb-5 flex flex-col gap-3 border-b border-[var(--clay-border)] px-5 pb-4 md:-mx-6 md:px-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                      {groupDetail?.title ?? detail.groupTitle ?? 'Ballot group'}
                    </p>
                    <h2 className="mt-1 truncate text-2xl font-semibold text-[var(--clay-text)]">
                      {currentPositionLabel ?? 'Chưa rõ chức vụ'}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                      {detail.description || 'Không có mô tả.'}
                    </p>
                  </div>
                  <StatusBadge tone={phaseTone}>{phaseLabel}</StatusBadge>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Commit end', formatUnix(detail.commitEnd)],
                    ['Reveal end', formatUnix(detail.revealEnd)],
                    ['Commits', String(detail.onChain?.totalCommits ?? '0')],
                    ['Reveals', String(detail.onChain?.totalReveals ?? '0')],
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
                                  ? 'Đang commit…'
                                  : 'Commit cho ứng viên này'}
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
                              Viewer state
                            </p>
                            <div className="mt-3 space-y-2.5 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Wallet</span>
                                <span className="font-mono text-[12px]">
                                  {shortenAddress(connectedAccount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đủ điều kiện</span>
                                {yesNo(detail.onChain?.viewer?.eligible)}
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đã commit</span>
                                {yesNo(detail.onChain?.viewer?.hasCommitted)}
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[var(--clay-muted)]">Đã reveal</span>
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
                                Reveal vote
                              </Button>
                              <p className="text-xs text-[var(--clay-muted)]">
                                {revealReason ?? 'Sẵn sàng reveal cho chức vụ này.'}
                              </p>
                              <p className="text-[11px] text-[var(--state-warning)]">
                                Lưu ý: bí mật phiếu được mã hoá cục bộ bằng chữ ký ví. Reveal phải dùng{' '}
                                <strong>đúng ví và đúng trình duyệt/thiết bị</strong> đã commit; xoá
                                dữ liệu trình duyệt sẽ mất khả năng reveal.
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
                                Finalize election
                              </Button>
                              <p className="text-xs text-[var(--clay-muted)]">
                                {finalizeReason ?? 'Sẵn sàng finalize.'}
                              </p>
                            </div>
                          </Panel>

                          <Panel className="bg-[var(--clay-surface-soft)] lg:col-span-2">
                            <p className="text-sm font-semibold text-[var(--clay-text)]">Explorer</p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <a
                                href={detail.links?.contract ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] ${!detail.links?.contract ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Mở contract
                              </a>
                              <a
                                href={detail.links?.transaction ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)] ${!detail.links?.transaction ? 'pointer-events-none opacity-50' : ''}`}
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Mở giao dịch tạo election
                              </a>
                            </div>
                          </Panel>
                        </div>
                      ),
                    },
                  ]}
                />
              </Panel>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <EmptyState
                  className="min-h-[360px]"
                  icon={<Vote className="h-6 w-6" aria-hidden="true" />}
                  title={groupItems.length === 0 ? 'Chưa có ballot để vận hành' : 'Chọn ballot và chức vụ'}
                  description={
                    groupItems.length === 0
                      ? 'Dashboard sẽ có số liệu sau khi bạn tạo ballot group đầu tiên.'
                      : 'Mở một chức vụ trong ballot group để xem trạng thái on-chain, danh sách ứng viên và các hành động commit/reveal/finalize.'
                  }
                  action={
                    groupItems.length === 0 ? (
                      <Link
                        to="/app/elections/new"
                        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[var(--clay-primary)] px-4 text-sm text-white hover:bg-[var(--clay-primary-focus)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--clay-primary-focus)]"
                      >
                        Tạo bầu cử
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--clay-primary)]">
                        Chọn mục ở danh sách bên trái
                      </span>
                    )
                  }
                />
                <Panel className="p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
                    <p className="text-sm font-semibold text-[var(--clay-text)]">Luồng vận hành</p>
                  </div>
                  <div className="mt-4 space-y-4">
                    {operationSteps.map((step, index) => (
                      <div key={step.title} className="flex gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                            step.done
                              ? 'border-[var(--state-success)] bg-[var(--state-success-soft)] text-[var(--state-success)]'
                              : 'border-[var(--clay-border)] bg-[var(--clay-surface-soft)] text-[var(--clay-muted)]'
                          }`}
                        >
                          {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--clay-text)]">{step.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[var(--clay-muted)]">
                            {step.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
