import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  isAddress,
  publicActions,
  toHex,
} from "viem";
import { sepolia } from "viem/chains";
import { electionAbi } from "./electionAbi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const TARGET_CHAIN_ID_HEX = "0xaa36a7";
const ZERO_HASH = `0x${"0".repeat(64)}`;
const FAUCET_LINKS = [
  {
    label: "Google Cloud Faucet",
    url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
  },
  {
    label: "Chainstack Faucet",
    url: "https://faucet.chainstack.com/",
  },
  {
    label: "Alchemy Faucet",
    url: "https://www.alchemy.com/faucets/ethereum-sepolia",
  },
];

function votePackageKey(electionAddress, account) {
  return `holihu.vote.${electionAddress.toLowerCase()}.${account.toLowerCase()}`;
}

function randomSalt() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function shortenAddress(value) {
  if (!value) {
    return "n/a";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "n/a";
  }

  return new Date(timestamp * 1000).toLocaleString("vi-VN");
}

function formatCountdown(timestamp) {
  if (!timestamp) {
    return "n/a";
  }

  const diff = timestamp - Math.floor(Date.now() / 1000);
  if (diff <= 0) {
    return "Đã qua";
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

async function switchToSepolia() {
  if (!window.ethereum) {
    throw new Error("MetaMask was not found.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (error.code !== 4902) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: TARGET_CHAIN_ID_HEX,
          chainName: "Ethereum Sepolia",
          nativeCurrency: {
            name: "Sepolia ETH",
            symbol: "SEP",
            decimals: 18,
          },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ],
    });
  }
}

function App() {
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
      }),
    []
  );

  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [proofState, setProofState] = useState(null);
  const [accountState, setAccountState] = useState({
    commitment: ZERO_HASH,
    hasRevealed: false,
  });
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready");

  useEffect(() => {
    void refreshElections();
  }, []);

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    const onAccountsChanged = (accounts) => {
      setConnectedAccount(accounts[0] ?? null);
      setMessage("Wallet account changed.");
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }

    void refreshElectionDetail(selectedElectionId);
  }, [selectedElectionId]);

  useEffect(() => {
    if (!selectedElectionId || !connectedAccount) {
      setProofState(null);
      setAccountState({
        commitment: ZERO_HASH,
        hasRevealed: false,
      });
      return;
    }

    void refreshWalletContext();
  }, [selectedElectionId, connectedAccount, detail?.electionAddress]);

  async function refreshElections() {
    const response = await fetch(`${API_BASE_URL}/api/elections`);
    const payload = await response.json();
    const items = payload.items ?? [];
    setElections(items);

    if (!selectedElectionId && items.length > 0) {
      setSelectedElectionId(items[0].electionId);
    }
  }

  async function refreshElectionDetail(identifier = selectedElectionId) {
    if (!identifier) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/elections/${identifier}`);
    const payload = await response.json();
    setDetail(payload);
    setCandidateIndex(0);
  }

  async function refreshWalletContext() {
    await Promise.all([loadProof(), loadWalletState(), loadBalance()]);
  }

  async function loadProof() {
    const response = await fetch(
      `${API_BASE_URL}/api/elections/${selectedElectionId}/proof?address=${encodeURIComponent(
        connectedAccount
      )}`
    );
    const payload = await response.json();
    setProofState(payload);
  }

  async function loadWalletState() {
    if (!detail?.electionAddress || !isAddress(connectedAccount)) {
      return;
    }

    const [commitment, hasRevealed] = await Promise.all([
      publicClient.readContract({
        address: detail.electionAddress,
        abi: electionAbi,
        functionName: "commitments",
        args: [connectedAccount],
      }),
      publicClient.readContract({
        address: detail.electionAddress,
        abi: electionAbi,
        functionName: "hasRevealed",
        args: [connectedAccount],
      }),
    ]);

    setAccountState({
      commitment,
      hasRevealed,
    });
  }

  async function loadBalance() {
    if (!connectedAccount) {
      setWalletBalance(null);
      return;
    }

    const value = await publicClient.getBalance({
      address: connectedAccount,
    });
    setWalletBalance(formatEther(value));
  }

  async function connectWallet() {
    try {
      await switchToSepolia();
      const [account] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setConnectedAccount(account);
      setMessage(`Connected ${account}`);
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    }
  }

  async function getWalletClient() {
    if (!window.ethereum) {
      throw new Error("MetaMask was not found.");
    }

    await switchToSepolia();
    const [account] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    return createWalletClient({
      account,
      chain: sepolia,
      transport: custom(window.ethereum),
    }).extend(publicActions);
  }

  function getStoredVotePackage() {
    if (!connectedAccount || !detail?.electionAddress) {
      return null;
    }

    const raw = localStorage.getItem(votePackageKey(detail.electionAddress, connectedAccount));
    return raw ? JSON.parse(raw) : null;
  }

  async function createVotePackage() {
    if (!connectedAccount || !detail || !proofState?.eligible) {
      throw new Error("The connected wallet is not eligible for this election.");
    }

    const candidate = detail.candidates[candidateIndex];
    const salt = randomSalt();
    const commitment = await publicClient.readContract({
      address: detail.electionAddress,
      abi: electionAbi,
      functionName: "computeCommitment",
      args: [connectedAccount, candidate.candidateId, salt],
    });

    return {
      candidateId: candidate.candidateId,
      candidateLabel: candidate.label,
      commitment,
      proof: proofState.proof ?? [],
      salt,
    };
  }

  async function handleCommit() {
    setBusy(true);
    try {
      const votePackage = await createVotePackage();
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        address: detail.electionAddress,
        abi: electionAbi,
        functionName: "commitVote",
        args: [votePackage.commitment, votePackage.proof],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      localStorage.setItem(
        votePackageKey(detail.electionAddress, connectedAccount),
        JSON.stringify(votePackage)
      );
      setMessage(`Commit confirmed: ${hash}`);
      await refreshElectionDetail();
      await refreshWalletContext();
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReveal() {
    setBusy(true);
    try {
      const votePackage = getStoredVotePackage();
      if (!votePackage) {
        throw new Error("No stored vote package found for this wallet.");
      }

      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        address: detail.electionAddress,
        abi: electionAbi,
        functionName: "revealVote",
        args: [votePackage.candidateId, votePackage.salt],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setMessage(`Reveal confirmed: ${hash}`);
      await refreshElectionDetail();
      await refreshWalletContext();
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setBusy(true);
    try {
      const walletClient = await getWalletClient();
      const hash = await walletClient.writeContract({
        address: detail.electionAddress,
        abi: electionAbi,
        functionName: "finalizeElection",
        args: [],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setMessage(`Finalize confirmed: ${hash}`);
      await refreshElectionDetail();
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyVotePackage() {
    try {
      const votePackage = getStoredVotePackage();
      if (!votePackage) {
        throw new Error("No stored vote package for this wallet.");
      }

      await navigator.clipboard.writeText(JSON.stringify(votePackage, null, 2));
      setMessage("Stored vote package copied to clipboard.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const storedVotePackage = getStoredVotePackage();
  const phase = detail?.onChain?.phase;
  const isOwner =
    connectedAccount &&
    detail?.onChain?.owner &&
    connectedAccount.toLowerCase() === detail.onChain.owner.toLowerCase();
  const recommendedTestBalance = Number(detail?.testing?.recommendedTestBalanceEth ?? 0);
  const connectedBalanceValue = Number(walletBalance ?? 0);
  const hasRecommendedGas = connectedBalanceValue >= recommendedTestBalance;
  const connectedVoter =
    detail?.testing?.voters?.find(
      (voter) => voter.address.toLowerCase() === connectedAccount?.toLowerCase()
    ) ?? null;
  const canCommit =
    !!connectedAccount &&
    !!proofState?.eligible &&
    phase === 1 &&
    accountState.commitment === ZERO_HASH &&
    !busy;
  const canReveal =
    !!connectedAccount &&
    !!storedVotePackage &&
    phase === 2 &&
    !accountState.hasRevealed &&
    !busy;
  const canFinalize = !!connectedAccount && !!isOwner && phase === 3 && !busy;
  const nextDeadline =
    phase === 1 ? detail?.onChain?.commitEnd : phase === 2 ? detail?.onChain?.revealEnd : null;
  const revealDisabledReason = !connectedAccount
    ? "Connect MetaMask first."
    : phase !== 2
      ? `Reveal opens after ${formatDateTime(detail?.onChain?.commitEnd)}.`
      : !storedVotePackage
        ? "No stored vote package was found in this browser for this wallet."
        : accountState.hasRevealed
          ? "This wallet has already revealed its vote."
          : null;
  const finalizeDisabledReason = !connectedAccount
    ? "Connect the owner wallet first."
    : phase !== 3
      ? `Finalize opens after ${formatDateTime(detail?.onChain?.revealEnd)}.`
      : !isOwner
        ? `Only the owner wallet ${shortenAddress(detail?.onChain?.owner)} can finalize.`
        : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Sepolia Test Console</p>
          <h1>HoLiHu Election Lab</h1>
          <p>
            Minimal BE/FE for real Sepolia testing of election #{detail?.electionId ?? "..."}. The
            current primary target is election #3 with 4 whitelisted MetaMask wallets.
          </p>
        </div>

        <button className="primary" onClick={connectWallet}>
          {connectedAccount ? "Reconnect MetaMask" : "Connect MetaMask"}
        </button>

        <section className="panel wallet-panel">
          <div className="panel-header">
            <h2>Wallet</h2>
            <span className={`pill ${connectedAccount ? "pill-ok" : "pill-muted"}`}>
              {connectedAccount ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="kv">
            <span>Address</span>
            <strong>{connectedAccount ?? "Not connected"}</strong>
          </div>
          <div className="kv">
            <span>Sepolia balance</span>
            <strong>{walletBalance ? `${walletBalance} ETH` : "n/a"}</strong>
          </div>
          <div className="kv">
            <span>Recommended minimum</span>
            <strong>{recommendedTestBalance ? `${recommendedTestBalance} ETH` : "n/a"}</strong>
          </div>
          <div className={`notice ${connectedAccount && hasRecommendedGas ? "notice-ok" : ""}`}>
            {connectedAccount
              ? hasRecommendedGas
                ? "Balance is sufficient for commit and reveal."
                : "Wallet balance is below the recommended testing threshold."
              : "Connect a whitelisted MetaMask account on Sepolia."}
          </div>
          <div className="link-list">
            {FAUCET_LINKS.map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Deployments</h2>
            <button className="ghost" onClick={() => void refreshElections()}>
              Refresh
            </button>
          </div>

          <div className="list-panel">
            {elections.map((item) => (
              <button
                key={item.electionAddress}
                className={`election-list-item ${
                  item.electionId === selectedElectionId ? "selected" : ""
                }`}
                onClick={() => setSelectedElectionId(item.electionId)}
              >
                <div className="list-item-top">
                  <span>#{item.electionId}</span>
                  <span className={`pill pill-${item.scheduleStatus.toLowerCase()}`}>
                    {item.scheduleStatus}
                  </span>
                </div>
                <strong>{item.manifest?.title ?? item.electionAddress}</strong>
                <small>{shortenAddress(item.electionAddress)}</small>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="content">
        {!detail ? (
          <section className="hero-card">
            <h2>Loading election data...</h2>
          </section>
        ) : (
          <>
            <section className="hero-card">
              <div className="hero-copy">
                <p className="eyebrow">Election #{detail.electionId}</p>
                <h2>{detail.manifest?.title ?? detail.electionAddress}</h2>
                <p>{detail.manifest?.description ?? "No manifest description."}</p>
                <div className="hero-links">
                  <a href={detail.links.contract} target="_blank" rel="noreferrer">
                    View Contract
                  </a>
                  <a href={detail.links.transaction} target="_blank" rel="noreferrer">
                    View Creation Tx
                  </a>
                </div>
              </div>
              <div className="hero-side">
                <div className="phase-badge">{detail.onChain?.phaseLabel ?? "Unknown"}</div>
                <div className="deadline-box">
                  <span>Next deadline</span>
                  <strong>{nextDeadline ? formatDateTime(nextDeadline) : "n/a"}</strong>
                  <small>{nextDeadline ? formatCountdown(nextDeadline) : "No active timer"}</small>
                </div>
              </div>
            </section>

            <section className="grid grid-three">
              <article className="card">
                <h3>Contract</h3>
                <div className="kv">
                  <span>Address</span>
                  <strong>{detail.electionAddress}</strong>
                </div>
                <div className="kv">
                  <span>Owner</span>
                  <strong>{detail.onChain?.owner}</strong>
                </div>
                <div className="kv">
                  <span>Created</span>
                  <strong>{new Date(detail.createdAt).toLocaleString("vi-VN")}</strong>
                </div>
                <div className="kv">
                  <span>Manifest voters</span>
                  <strong>{detail.testing?.totalCount ?? 0}</strong>
                </div>
              </article>

              <article className="card">
                <h3>Schedule</h3>
                <div className="kv">
                  <span>Commit start</span>
                  <strong>{formatDateTime(detail.onChain.commitStart)}</strong>
                </div>
                <div className="kv">
                  <span>Commit end</span>
                  <strong>{formatDateTime(detail.onChain.commitEnd)}</strong>
                </div>
                <div className="kv">
                  <span>Reveal end</span>
                  <strong>{formatDateTime(detail.onChain.revealEnd)}</strong>
                </div>
              </article>

              <article className="card">
                <h3>Testing Readiness</h3>
                <div className="kv">
                  <span>Connected wallet</span>
                  <strong>{connectedAccount ? shortenAddress(connectedAccount) : "n/a"}</strong>
                </div>
                <div className="kv">
                  <span>Eligible</span>
                  <strong>{proofState ? String(proofState.eligible) : "Unknown"}</strong>
                </div>
                <div className="kv">
                  <span>Stored package</span>
                  <strong>{storedVotePackage?.candidateLabel ?? "None"}</strong>
                </div>
                <div className="kv">
                  <span>Funding coverage</span>
                  <strong>
                    {detail.testing?.fundedCount ?? 0}/{detail.testing?.totalCount ?? 0}
                  </strong>
                </div>
              </article>
            </section>

            <section className="grid">
              <article className="card">
                <div className="panel-header">
                  <h3>Multi-Account Test Flow</h3>
                  <button className="ghost" onClick={() => void refreshElectionDetail()}>
                    Refresh State
                  </button>
                </div>

                <ol className="step-list">
                  <li>Connect one of the 4 whitelisted MetaMask accounts on Sepolia.</li>
                  <li>Check that the wallet is eligible and has enough Sepolia ETH.</li>
                  <li>Choose a candidate and click Commit Vote. Keep the same browser data.</li>
                  <li>Switch to the next MetaMask account and repeat commit during the Commit phase.</li>
                  <li>When the Reveal phase opens, return with each committed account and click Reveal Vote.</li>
                  <li>After Reveal ends, the owner account finalizes the election.</li>
                </ol>

                <div className="notice">
                  MetaMask shows a warning because this dev app runs on HTTP localhost. That is
                  expected for local testing. Only approve requests if the page is exactly
                  http://localhost:3000 and the contract matches election #3.
                </div>
              </article>

              <article className="card">
                <h3>Wallet Actions</h3>
                <div className="kv">
                  <span>Commitment</span>
                  <strong className="wrap">{accountState.commitment}</strong>
                </div>
                <div className="kv">
                  <span>Has revealed</span>
                  <strong>{String(accountState.hasRevealed)}</strong>
                </div>
                <div className="kv">
                  <span>Stored choice</span>
                  <strong>{storedVotePackage?.candidateLabel ?? "None"}</strong>
                </div>
                <div className="action-row">
                  <button className="primary" disabled={!canCommit} onClick={handleCommit}>
                    Commit Vote
                  </button>
                  <button className="secondary" disabled={!canReveal} onClick={handleReveal}>
                    Reveal Vote
                  </button>
                  <button className="secondary" disabled={!canFinalize} onClick={handleFinalize}>
                    Finalize
                  </button>
                </div>
                {!canReveal && revealDisabledReason ? (
                  <div className="notice">
                    <strong>Reveal locked.</strong> {revealDisabledReason}
                  </div>
                ) : null}
                {!canFinalize && finalizeDisabledReason ? (
                  <div className="notice">
                    <strong>Finalize locked.</strong> {finalizeDisabledReason}
                  </div>
                ) : null}
                <div className="action-row">
                  <button className="ghost" disabled={!storedVotePackage} onClick={copyVotePackage}>
                    Copy Stored Package
                  </button>
                </div>
                <div className="notice">
                  Reveal depends on the vote package stored in this browser. Do not clear
                  localStorage between commit and reveal.
                </div>
              </article>
            </section>

            <section className="grid">
              <article className="card">
                <h3>Candidates And Results</h3>
                <div className="candidate-list">
                  {detail.onChain.results.map((result, index) => (
                    <label className="candidate-row" key={result.candidateId}>
                      <input
                        type="radio"
                        name="candidate"
                        checked={candidateIndex === index}
                        onChange={() => setCandidateIndex(index)}
                      />
                      <span>{result.label}</span>
                      <strong>{result.count}</strong>
                    </label>
                  ))}
                </div>
              </article>

              <article className="card">
                <h3>Whitelisted Voters</h3>
                <div className="voter-list">
                  {(detail.testing?.voters ?? []).map((voter) => (
                    <div
                      key={voter.address}
                      className={`voter-row ${
                        voter.address.toLowerCase() === connectedAccount?.toLowerCase()
                          ? "current"
                          : ""
                      }`}
                    >
                      <div>
                        <strong>{shortenAddress(voter.address)}</strong>
                        <small>{voter.address}</small>
                      </div>
                      <div className="voter-meta">
                        <span>{voter.balanceEth} ETH</span>
                        <span className={`pill ${voter.fundedEnough ? "pill-ok" : "pill-warn"}`}>
                          {voter.fundedEnough ? "Funded" : "Needs ETH"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="card">
              <div className="panel-header">
                <h3>Manifest Snapshot</h3>
                {connectedVoter ? (
                  <span className="pill pill-ok">Connected wallet is whitelisted</span>
                ) : (
                  <span className="pill pill-muted">Connected wallet is not on this roster</span>
                )}
              </div>
              <pre>{JSON.stringify(detail.manifest, null, 2)}</pre>
            </section>
          </>
        )}

        <section className="message-bar">
          <strong>Status</strong>
          <span>{message}</span>
        </section>
      </main>
    </div>
  );
}

export default App;
