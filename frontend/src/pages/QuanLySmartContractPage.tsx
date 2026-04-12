import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { ArrowRight, ExternalLink, RefreshCw, Vote, Wallet } from 'lucide-react';
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
  return 'rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl md:p-6';
}

function commandButtonClasses(tone: 'dark' | 'accent' | 'outline') {
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

function messagePanelClasses(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('thanh cong') || normalized.includes('success')) {
    return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50';
  }
  if (normalized.includes('loi') || normalized.includes('error') || normalized.includes('fail') || normalized.includes('revert')) {
    return 'border-rose-400/40 bg-rose-500/10 text-rose-50';
  }
  return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-50';
}

function phaseAccentClasses(phaseLabel?: string) {
  switch (phaseLabel) {
    case 'Commit':
      return 'border-amber-400/40 bg-amber-400/10 text-amber-100';
    case 'Reveal':
      return 'border-sky-400/40 bg-sky-400/10 text-sky-100';
    case 'Ended':
      return 'border-slate-400/40 bg-slate-400/10 text-slate-100';
    case 'Finalized':
      return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100';
    case 'Canceled':
      return 'border-rose-400/40 bg-rose-400/10 text-rose-100';
    default:
      return 'border-violet-400/40 bg-violet-400/10 text-violet-100';
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
    return 'n/a';
  }
  return new Date(timestamp * 1000).toLocaleString('vi-VN');
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

function buildVotePackageKey(electionAddress: string, walletAddress: string) {
  return `${VOTE_PACKAGE_PREFIX}:${electionAddress.toLowerCase()}:${walletAddress.toLowerCase()}`;
}

function loadStoredVotePackage(electionAddress: string, walletAddress: string) {
  const raw = window.localStorage.getItem(buildVotePackageKey(electionAddress, walletAddress));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as VotePackage;
  } catch {
    return null;
  }
}

function saveStoredVotePackage(votePackage: VotePackage) {
  window.localStorage.setItem(buildVotePackageKey(votePackage.electionAddress, votePackage.voter), JSON.stringify(votePackage));
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
  return 'Co loi khong xac dinh.';
}

async function switchToSepolia(rpcUrl: string) {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('MetaMask chua duoc cai dat.');
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
  if (busy) return 'Dang xu ly giao dich hoac tai du lieu.';
  if (!walletAddress) return 'Hay ket noi MetaMask truoc.';
  if (!detail?.onChain?.viewer?.eligible) return 'Vi hien tai khong nam trong danh sach cu tri cua chuc vu nay.';
  if (detail.onChain.viewer.hasCommitted) return 'Vi nay da commit cho chuc vu nay.';
  if (detail.onChain.phaseLabel !== 'Commit') return `Phase hien tai la ${detail.onChain.phaseLabel}, chua the commit.`;
  return null;
}

function getRevealReason(detail: ElectionV1Detail | null, walletAddress: string | null, votePackage: VotePackage | null, busy: boolean) {
  if (busy) return 'Dang xu ly giao dich hoac tai du lieu.';
  if (!walletAddress) return 'Hay ket noi MetaMask truoc.';
  if (!votePackage) return 'Khong tim thay vote package cuc bo cho vi nay.';
  if (!detail?.onChain?.viewer?.hasCommitted) return 'Vi nay chua commit.';
  if (detail.onChain.viewer.hasRevealed) return 'Vi nay da reveal roi.';
  if (detail.onChain.phaseLabel !== 'Reveal') return `Phase hien tai la ${detail.onChain.phaseLabel}, chua the reveal.`;
  return null;
}

function getFinalizeReason(detail: ElectionV1Detail | null, walletAddress: string | null, busy: boolean) {
  if (busy) return 'Dang xu ly giao dich hoac tai du lieu.';
  if (!walletAddress) return 'Hay ket noi MetaMask truoc.';
  if (!detail?.onChain) return 'Chua tai duoc trang thai election.';
  if (detail.onChain.finalized) return 'Election da finalized.';
  if (detail.onChain.canceled) return 'Election da bi huy.';
  if (detail.onChain.phaseLabel !== 'Ended') return `Phase hien tai la ${detail.onChain.phaseLabel}, chua the finalize.`;
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
  const [message, setMessage] = useState('San sang.');
  const [votePackageRevision, setVotePackageRevision] = useState(0);

  const storedVotePackage = useMemo(() => {
    if (!detail?.address || !connectedAccount) {
      return null;
    }
    return loadStoredVotePackage(detail.address, connectedAccount);
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
      setMessage(nextAccount ? `Da chuyen vi sang ${nextAccount}` : 'MetaMask da ngat ket noi.');
    };

    const handleChainChanged = () => {
      setMessage('Mang blockchain da thay doi. Dang tai lai du lieu ballot.');
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
          setMessage(`Khong dong bo duoc on-chain state tu frontend: ${getErrorMessage(error)}`);
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
        throw new Error('MetaMask chua duoc cai dat.');
      }
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const nextAccount = accounts[0] ?? null;
      setConnectedAccount(nextAccount);
      if (nextAccount) {
        await loadWalletBalance(nextAccount, rpcUrl);
      }
      setMessage(nextAccount ? `Da ket noi vi ${nextAccount}` : 'Khong tim thay tai khoan MetaMask.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function getSignerContext() {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error('MetaMask chua duoc cai dat.');
    }

    await switchToSepolia(publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
    const provider = new ethers.BrowserProvider(ethereum);
    await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== TARGET_CHAIN_ID) {
      throw new Error('MetaMask chua o dung mang Sepolia.');
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
    try {
      const { signer, address } = await getSignerContext();
      const proofPayload = await getElectionV1Proof(detail.address, address);
      if (!proofPayload.eligible || proofPayload.proof.length === 0) {
        throw new Error('Vi hien tai khong nam trong Merkle whitelist cua election nay.');
      }
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const salt = createRandomBytes32();
      const commitment = await contract.computeCommitment(address, candidate.candidateId, salt);
      const tx = await contract.commitVote(commitment, proofPayload.proof);
      await tx.wait();

      saveStoredVotePackage({
        electionAddress: detail.address,
        voter: address,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        salt,
        commitment: String(commitment),
        committedAt: new Date().toISOString(),
      });

      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Commit thanh cong: ${tx.hash}`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevealVote() {
    if (!detail?.address || !storedVotePackage) {
      return;
    }
    setBusy(true);
    try {
      const { signer, address } = await getSignerContext();
      const contract = new ethers.Contract(detail.address, electionV1Abi, signer);
      const tx = await contract.revealVote(storedVotePackage.candidateId, storedVotePackage.salt);
      await tx.wait();

      saveStoredVotePackage({
        ...storedVotePackage,
        voter: address,
        revealedAt: new Date().toISOString(),
      });

      setVotePackageRevision((current) => current + 1);
      await refreshElection(detail.address, address);
      await loadWalletBalance(address, publicConfig?.rpcUrl ?? DEFAULT_RPC_URL);
      setMessage(`Reveal thanh cong: ${tx.hash}`);
    } catch (error) {
      setMessage(getErrorMessage(error));
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
      setMessage(`Finalize thanh cong: ${tx.hash}`);
    } catch (error) {
      setMessage(getErrorMessage(error));
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
  const revealReason = getRevealReason(detail, connectedAccount, storedVotePackage, busy);
  const finalizeReason = getFinalizeReason(detail, connectedAccount, busy);
  const phaseLabel = detail?.onChain?.phaseLabel ?? 'Unknown';
  const maxResultCount = Math.max(1, ...(detail?.onChain?.results ?? []).map((item) => item.count));
  const currentPositionTitle = detail?.positionTitle || detail?.manifest?.positionTitle || detail?.title;

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.14),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.32),_rgba(2,6,23,0.96))]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_340px]">
          <div className={panelClasses()}>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-100">
              <Vote className="h-3.5 w-3.5" />
              Group ballot console
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Quan ly bieu bau cu nhieu chuc vu</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Chon mot ballot group, sau do chon tung chuc vu de commit, reveal va finalize. Moi chuc vu la mot child election rieng tren ElectionV1.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Chain</p>
                <p className="mt-2 text-lg font-semibold text-white">{publicConfig?.chainId ?? TARGET_CHAIN_ID}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Factory</p>
                <p className="mt-2 text-lg font-semibold text-white">{shortenAddress(publicConfig?.factoryAddress)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Wallet</p>
                <p className="mt-2 text-lg font-semibold text-white">{shortenAddress(connectedAccount)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Balance</p>
                <p className="mt-2 text-lg font-semibold text-white">{walletBalance ? `${walletBalance} SEP` : 'n/a'}</p>
              </div>
            </div>
          </div>

          <div className={panelClasses()}>
            <div className="space-y-3">
              <button type="button" onClick={() => void connectWallet()} className={`${commandButtonClasses('dark')} w-full`}>
                <Wallet className="h-4 w-4" />
                {connectedAccount ? 'Doi / ket noi lai MetaMask' : 'Ket noi MetaMask'}
              </button>

              <button type="button" onClick={() => void refreshAll()} className={`${commandButtonClasses('outline')} w-full`}>
                <RefreshCw className="h-4 w-4" />
                Tai lai ballot
              </button>

              <Link to="/app/tao-phien-bau-cu" className={`${commandButtonClasses('accent')} w-full`}>
                <ArrowRight className="h-4 w-4" />
                Tao ballot moi
              </Link>
            </div>

            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${messagePanelClasses(message)}`}>
              <p className="font-semibold text-white/95">Live status</p>
              <p className="mt-1">{message}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,240px)_minmax(0,1fr)]">
          <div className={panelClasses()}>
            <p className="text-sm font-semibold text-white">Danh sach ballot</p>
            <div className="mt-4 space-y-3">
              {groupItems.map((group) => {
                const active = selectedGroupKey === group.groupKey;
                return (
                  <button
                    key={group.groupKey}
                    type="button"
                    onClick={() => openGroup(group.groupKey)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-orange-400/40 bg-orange-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{group.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{group.positionCount} chuc vu</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
                        {group.groupKey}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={panelClasses()}>
            <p className="text-sm font-semibold text-white">Chuc vu trong ballot</p>
            {groupDetail ? (
              <div className="mt-4 space-y-3">
                {groupDetail.positions.map((position) => {
                  const active = selectedElectionAddress?.toLowerCase() === position.address.toLowerCase();
                  return (
                    <button
                      key={position.address}
                      type="button"
                      onClick={() => openGroup(groupDetail.groupKey, position.address)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-sky-400/40 bg-sky-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'}`}
                    >
                      <p className="text-sm font-semibold text-white">{position.positionTitle || position.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{position.candidates.length} ung vien</p>
                      <p className="mt-2 text-xs text-slate-500">{shortenAddress(position.address)}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Chon mot ballot de xem cac chuc vu.</p>
            )}
          </div>

          <div className="space-y-6">
            <div className={panelClasses()}>
              {detail ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">{groupDetail?.title ?? detail.groupTitle ?? 'Ballot group'}</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{currentPositionTitle}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{detail.description || 'Khong co mo ta.'}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${phaseAccentClasses(phaseLabel)}`}>
                      {phaseLabel}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Commit end</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatUnix(detail.commitEnd)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reveal end</p>
                      <p className="mt-2 text-sm font-semibold text-white">{formatUnix(detail.revealEnd)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Commits</p>
                      <p className="mt-2 text-sm font-semibold text-white">{detail.onChain?.totalCommits ?? '0'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Reveals</p>
                      <p className="mt-2 text-sm font-semibold text-white">{detail.onChain?.totalReveals ?? '0'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-white">Ung vien va ket qua da reveal</p>
                      {(detail.onChain?.results ?? []).map((candidate) => (
                        <div key={candidate.candidateId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-white">{candidate.candidateName}</p>
                              <p className="mt-1 text-xs text-slate-400">{candidate.candidateWalletAddress || candidate.candidateId}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full bg-orange-400" style={{ width: `${(candidate.count / maxResultCount) * 100}%` }} />
                              </div>
                              <span className="min-w-10 text-right text-lg font-semibold text-white">{candidate.count}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleCommitVote(candidate)}
                            disabled={commitReason !== null}
                            className={`${commandButtonClasses('accent')} mt-4 w-full`}
                          >
                            Commit cho ung vien nay
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-white">Viewer state</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-300">
                          <div className="flex items-center justify-between gap-4">
                            <span>Wallet</span>
                            <span className="text-right text-white">{shortenAddress(connectedAccount)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Eligible</span>
                            <span className="text-right text-white">{detail.onChain?.viewer?.eligible ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Has committed</span>
                            <span className="text-right text-white">{detail.onChain?.viewer?.hasCommitted ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span>Has revealed</span>
                            <span className="text-right text-white">{detail.onChain?.viewer?.hasRevealed ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>

                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-white">Action rail</p>
                        <div className="mt-4 space-y-3">
                          <button type="button" onClick={() => void handleRevealVote()} disabled={revealReason !== null} className={`${commandButtonClasses('outline')} w-full`}>
                            Reveal vote
                          </button>
                          <p className="text-xs text-slate-400">{revealReason ?? 'San sang reveal cho chuc vu nay.'}</p>

                          <button type="button" onClick={() => void handleFinalizeElection()} disabled={finalizeReason !== null} className={`${commandButtonClasses('dark')} w-full`}>
                            Finalize election
                          </button>
                          <p className="text-xs text-slate-400">{finalizeReason ?? 'San sang finalize.'}</p>
                        </div>
                      </div>

                      <div className={panelClasses()}>
                        <p className="text-sm font-semibold text-white">Explorer</p>
                        <div className="mt-4 space-y-3">
                          <a href={detail.links?.contract ?? '#'} target="_blank" rel="noreferrer" className={`${commandButtonClasses('outline')} w-full ${!detail.links?.contract ? 'pointer-events-none opacity-50' : ''}`}>
                            <ExternalLink className="h-4 w-4" />
                            Mo contract tren explorer
                          </a>
                          <a href={detail.links?.transaction ?? '#'} target="_blank" rel="noreferrer" className={`${commandButtonClasses('outline')} w-full ${!detail.links?.transaction ? 'pointer-events-none opacity-50' : ''}`}>
                            <ExternalLink className="h-4 w-4" />
                            Mo giao dich tao election
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Chon mot ballot va mot chuc vu de bat dau bo phieu.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
