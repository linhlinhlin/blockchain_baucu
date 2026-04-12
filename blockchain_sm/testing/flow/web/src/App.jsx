import { useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, formatEther, http, publicActions } from "viem";
import { sepolia } from "viem/chains";
import { electionV1Abi } from "./simpleElectionAbi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3201";
const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const TARGET_CHAIN_ID_HEX = "0xaa36a7";
const TOKEN_KEY = "holihu.flow.token";
const VOTE_PACKAGE_PREFIX = "holihu.v1.vote";

function toLocalDateTimeInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function shortenAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "n/a";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "n/a";
}

function formatUnix(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toLocaleString("vi-VN") : "n/a";
}

function createEmptyCandidate(index) {
  return {
    displayName: `Candidate ${String.fromCharCode(65 + index)}`,
    walletAddress: "",
  };
}

function buildVotePackageKey(electionAddress, walletAddress) {
  return `${VOTE_PACKAGE_PREFIX}:${String(electionAddress).toLowerCase()}:${String(walletAddress).toLowerCase()}`;
}

function loadStoredVotePackage(electionAddress, walletAddress) {
  if (!electionAddress || !walletAddress) {
    return null;
  }

  const raw = window.localStorage.getItem(buildVotePackageKey(electionAddress, walletAddress));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStoredVotePackage(votePackage) {
  window.localStorage.setItem(
    buildVotePackageKey(votePackage.electionAddress, votePackage.voter),
    JSON.stringify(votePackage)
  );
}

function parseAddresses(value) {
  return value
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createRandomBytes32() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
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

  const [token, setToken] = useState(() => window.sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [me, setMe] = useState(null);
  const [publicConfig, setPublicConfig] = useState(null);
  const [elections, setElections] = useState([]);
  const [myElections, setMyElections] = useState([]);
  const [selectedElectionAddress, setSelectedElectionAddress] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [votePackageRevision, setVotePackageRevision] = useState(0);
  const [createForm, setCreateForm] = useState(() => {
    const now = new Date();
    const commitStart = new Date(now.getTime() + 5 * 60 * 1000);
    const commitEnd = new Date(commitStart.getTime() + 24 * 60 * 60 * 1000);
    const revealEnd = new Date(commitEnd.getTime() + 24 * 60 * 60 * 1000);

    return {
      title: "New Election V1",
      description: "Commit-reveal election created from the target UI.",
      commitStart: toLocalDateTimeInput(commitStart),
      commitEnd: toLocalDateTimeInput(commitEnd),
      revealEnd: toLocalDateTimeInput(revealEnd),
      candidates: [createEmptyCandidate(0), createEmptyCandidate(1)],
      votersText: "",
    };
  });

  useEffect(() => {
    void refreshPublicConfig();
    void refreshElections();
  }, []);

  useEffect(() => {
    if (!selectedElectionAddress) {
      return;
    }

    void refreshElection(selectedElectionAddress);
  }, [selectedElectionAddress, token]);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setMyElections([]);
      return;
    }

    void refreshMe();
    void refreshMyElections();
  }, [token]);

  useEffect(() => {
    if (!connectedAccount) {
      setWalletBalance(null);
      return;
    }

    void loadBalance(connectedAccount);
  }, [connectedAccount]);

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    const onAccountsChanged = (accounts) => {
      setConnectedAccount(accounts[0] ?? null);
      setVotePackageRevision((current) => current + 1);
      setMessage("Wallet account changed.");
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
    };
  }, []);

  async function apiFetch(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Request failed.");
    }

    return payload;
  }

  async function refreshPublicConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/public-config`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load public config.");
      }

      setPublicConfig(payload);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshElections() {
    try {
      const payload = await apiFetch("/api/elections", { headers: {} });
      setElections(payload.items ?? []);
      if (!selectedElectionAddress && payload.items?.length) {
        setSelectedElectionAddress(payload.items[0].address);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshMyElections() {
    if (!token) {
      setMyElections([]);
      return;
    }

    try {
      const payload = await apiFetch("/api/my/elections");
      setMyElections(payload.items ?? []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshElection(identifier = selectedElectionAddress) {
    if (!identifier) {
      return;
    }

    try {
      const payload = await apiFetch(`/api/elections/${identifier}`);
      setDetail(payload);
      setVotePackageRevision((current) => current + 1);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshMe() {
    try {
      const payload = await apiFetch("/api/me");
      setMe(payload);
    } catch (error) {
      setMessage(error.message);
      setToken("");
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  async function loadBalance(account) {
    const value = await publicClient.getBalance({ address: account });
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

  async function signIn() {
    setBusy(true);
    try {
      const account = connectedAccount ?? (await connectWallet(), null);
      const signerAddress =
        account ?? (await window.ethereum.request({ method: "eth_accounts" }))[0];

      if (!signerAddress) {
        throw new Error("No wallet account is connected.");
      }

      const noncePayload = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: signerAddress }),
      }).then((response) => response.json());

      if (!noncePayload.message) {
        throw new Error(noncePayload.error ?? "Failed to fetch nonce.");
      }

      const walletClient = await getWalletClient();
      const signature = await walletClient.signMessage({
        account: signerAddress,
        message: noncePayload.message,
      });

      const verifyPayload = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: signerAddress,
          signature,
        }),
      }).then((response) => response.json());

      if (!verifyPayload.token) {
        throw new Error(verifyPayload.error ?? "Wallet login failed.");
      }

      window.sessionStorage.setItem(TOKEN_KEY, verifyPayload.token);
      setToken(verifyPayload.token);
      setMessage(`Signed in as ${signerAddress}`);
      await refreshMyElections();
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!token) {
      return;
    }

    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // best effort
    } finally {
      window.sessionStorage.removeItem(TOKEN_KEY);
      setToken("");
      setMe(null);
      setMyElections([]);
      setMessage("Signed out.");
    }
  }

  async function createElection() {
    setBusy(true);
    try {
      const payload = await apiFetch("/api/admin/elections", {
        method: "POST",
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description.trim(),
          commitStart: Math.floor(new Date(createForm.commitStart).getTime() / 1000),
          commitEnd: Math.floor(new Date(createForm.commitEnd).getTime() / 1000),
          revealEnd: Math.floor(new Date(createForm.revealEnd).getTime() / 1000),
          candidates: createForm.candidates.map((candidate) => ({
            displayName: candidate.displayName.trim(),
            walletAddress: candidate.walletAddress.trim(),
          })),
          voters: parseAddresses(createForm.votersText),
        }),
      });

      await refreshElections();
      await refreshMyElections();
      setSelectedElectionAddress(payload.address);
      await refreshElection(payload.address);
      setMessage(`Election created: ${payload.address}`);
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function commitVote(candidate) {
    if (!detail?.address || !connectedAccount) {
      return;
    }

    setBusy(true);
    try {
      const proofPayload = await apiFetch(`/api/elections/${detail.address}/proof`);
      if (!proofPayload.eligible || !proofPayload.proof?.length) {
        throw new Error("This wallet is not in the eligible voter list.");
      }

      const walletClient = await getWalletClient();
      const salt = createRandomBytes32();
      const commitment = await publicClient.readContract({
        address: detail.address,
        abi: electionV1Abi,
        functionName: "computeCommitment",
        args: [connectedAccount, candidate.candidateId, salt],
      });

      const txHash = await walletClient.writeContract({
        address: detail.address,
        abi: electionV1Abi,
        functionName: "commitVote",
        args: [commitment, proofPayload.proof],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      saveStoredVotePackage({
        electionAddress: detail.address,
        voter: connectedAccount,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        commitment,
        proof: proofPayload.proof,
        salt,
        committedAt: new Date().toISOString(),
      });

      await apiFetch(`/api/elections/${detail.address}/sync`, { method: "POST" });
      await refreshElection(detail.address);
      setVotePackageRevision((current) => current + 1);
      await loadBalance(connectedAccount);
      setMessage(`Commit confirmed: ${txHash}`);
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function revealVote() {
    if (!detail?.address || !connectedAccount) {
      return;
    }

    const votePackage = loadStoredVotePackage(detail.address, connectedAccount);
    if (!votePackage) {
      setMessage("No local vote package was found for this election and wallet.");
      return;
    }

    setBusy(true);
    try {
      const walletClient = await getWalletClient();
      const txHash = await walletClient.writeContract({
        address: detail.address,
        abi: electionV1Abi,
        functionName: "revealVote",
        args: [votePackage.candidateId, votePackage.salt],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      saveStoredVotePackage({
        ...votePackage,
        revealedAt: new Date().toISOString(),
      });
      await apiFetch(`/api/elections/${detail.address}/sync`, { method: "POST" });
      await refreshElection(detail.address);
      setVotePackageRevision((current) => current + 1);
      await loadBalance(connectedAccount);
      setMessage(`Reveal confirmed: ${txHash}`);
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  async function finalizeElection() {
    if (!detail?.address || !connectedAccount) {
      return;
    }

    setBusy(true);
    try {
      const walletClient = await getWalletClient();
      const txHash = await walletClient.writeContract({
        address: detail.address,
        abi: electionV1Abi,
        functionName: "finalizeElection",
        args: [],
        account: connectedAccount,
        chain: sepolia,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await apiFetch(`/api/elections/${detail.address}/sync`, { method: "POST" });
      await refreshElection(detail.address);
      await loadBalance(connectedAccount);
      setMessage(`Finalize confirmed: ${txHash}`);
    } catch (error) {
      setMessage(error.shortMessage ?? error.message);
    } finally {
      setBusy(false);
    }
  }

  const loginAddress = me?.user?.address?.toLowerCase() ?? null;
  const walletMatchesSession =
    connectedAccount && loginAddress && connectedAccount.toLowerCase() === loginAddress;
  const candidateEntries = createForm.candidates.map((candidate) => ({
    displayName: candidate.displayName.trim(),
    walletAddress: candidate.walletAddress.trim(),
  }));
  const parsedVoters = parseAddresses(createForm.votersText);
  const scheduleValid =
    !!createForm.commitStart &&
    !!createForm.commitEnd &&
    !!createForm.revealEnd &&
    Number.isFinite(new Date(createForm.commitStart).getTime()) &&
    Number.isFinite(new Date(createForm.commitEnd).getTime()) &&
    Number.isFinite(new Date(createForm.revealEnd).getTime()) &&
    new Date(createForm.commitStart).getTime() < new Date(createForm.commitEnd).getTime() &&
    new Date(createForm.commitEnd).getTime() < new Date(createForm.revealEnd).getTime();
  const candidateWalletsValid = candidateEntries.every((candidate) => {
    return candidate.walletAddress.length === 0 || /^0x[a-fA-F0-9]{40}$/.test(candidate.walletAddress);
  });
  const votersValid =
    parsedVoters.length > 0 && parsedVoters.every((voter) => /^0x[a-fA-F0-9]{40}$/.test(voter));
  const createFormValid =
    createForm.title.trim().length > 0 &&
    candidateEntries.filter((candidate) => candidate.displayName.length > 0).length >= 2 &&
    candidateWalletsValid &&
    votersValid &&
    scheduleValid;
  const canCreateElections =
    !!me?.user?.canCreateElections && !!walletMatchesSession && createFormValid && !busy;
  const createDisableReason = busy
    ? "A request is still running."
    : !connectedAccount
      ? "Connect MetaMask first."
      : !token
        ? "Sign in with the connected wallet first."
        : !loginAddress
          ? "Session details are not available yet. Refresh and sign in again."
          : !walletMatchesSession
            ? "The connected MetaMask account must match the signed-in wallet."
            : !me?.user?.canCreateElections
              ? "Election creation is disabled for this session."
              : createForm.title.trim().length === 0
                ? "Title is required."
                : candidateEntries.filter((candidate) => candidate.displayName.length > 0).length < 2
                  ? "At least two candidates are required."
                  : !candidateWalletsValid
                    ? "Candidate wallet addresses must be valid EVM addresses or left blank."
                    : !votersValid
                      ? "Provide at least one valid voter address."
                      : !scheduleValid
                        ? "Schedule must satisfy commitStart < commitEnd < revealEnd."
                        : null;

  const storedVotePackage =
    detail?.address && connectedAccount
      ? loadStoredVotePackage(detail.address, connectedAccount)
      : null;
  const canCommit =
    !!detail &&
    !!connectedAccount &&
    !!token &&
    !!walletMatchesSession &&
    detail.onChain?.phaseLabel === "Commit" &&
    detail.onChain?.viewer?.eligible &&
    !detail.onChain?.viewer?.hasCommitted &&
    !busy;
  const canReveal =
    !!detail &&
    !!connectedAccount &&
    !!token &&
    !!walletMatchesSession &&
    detail.onChain?.phaseLabel === "Reveal" &&
    detail.onChain?.viewer?.hasCommitted &&
    !detail.onChain?.viewer?.hasRevealed &&
    !!storedVotePackage &&
    !busy;
  const canFinalize =
    !!detail &&
    !!connectedAccount &&
    !!token &&
    !!walletMatchesSession &&
    detail.onChain?.phaseLabel === "Ended" &&
    !busy;

  void votePackageRevision;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Election V1</p>
          <h1>HoLiHu Commit-Reveal Demo</h1>
          <p>Wallet login off-chain. Election creation, commit, reveal, and finalize on Sepolia through ElectionFactoryV1 and ElectionV1.</p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Wallet</h2>
            <button className="ghost" onClick={connectWallet}>Connect</button>
          </div>
          <div className="kv">
            <span>MetaMask</span>
            <strong>{connectedAccount ?? "Not connected"}</strong>
          </div>
          <div className="kv">
            <span>Sepolia balance</span>
            <strong>{walletBalance ? `${walletBalance} ETH` : "n/a"}</strong>
          </div>
          <div className="action-group">
            <button className="primary" disabled={busy} onClick={signIn}>
              Sign In With Wallet
            </button>
            <button className="ghost" disabled={!token} onClick={logout}>
              Logout
            </button>
          </div>
          <div className="notice">
            Reveal depends on the local vote package stored in this browser.
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Elections</h2>
            <button className="ghost" onClick={() => void refreshElections()}>Refresh</button>
          </div>
          <div className="list">
            {elections.map((item) => (
              <button
                key={item.address}
                className={`election-item ${selectedElectionAddress === item.address ? "selected" : ""}`}
                onClick={() => setSelectedElectionAddress(item.address)}
              >
                <strong>{item.title}</strong>
                <small>{shortenAddress(item.address)}</small>
                <span>{formatUnix(item.commitEnd)}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Target Contract Flow</p>
            <h2>{detail?.title ?? "Select an election"}</h2>
            <p>{detail?.description ?? "Choose an ElectionV1 instance from the sidebar to test commit-reveal voting."}</p>
          </div>
          <div className="pill">{detail?.onChain?.phaseLabel ?? "Idle"}</div>
        </section>

        <section className="grid">
          <article className="card">
            <h3>Create Election</h3>
            <div className="kv">
              <span>Factory</span>
              <strong>{publicConfig?.factoryAddress ?? "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Election owner</span>
              <strong>{me?.user?.address ?? "Sign in first"}</strong>
            </div>
            <label className="field">
              <span>Title</span>
              <input
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={3}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <div className="grid compact-grid">
              <label className="field">
                <span>Commit start</span>
                <input
                  type="datetime-local"
                  value={createForm.commitStart}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, commitStart: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Commit end</span>
                <input
                  type="datetime-local"
                  value={createForm.commitEnd}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, commitEnd: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Reveal end</span>
                <input
                  type="datetime-local"
                  value={createForm.revealEnd}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, revealEnd: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Candidates</span>
              <div className="candidate-editor-list">
                {createForm.candidates.map((candidate, index) => (
                  <div key={`candidate-editor-${index}`} className="candidate-editor-card">
                    <div className="panel-header">
                      <strong>Candidate {index + 1}</strong>
                      <button
                        className="ghost"
                        type="button"
                        disabled={createForm.candidates.length <= 2}
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...current,
                            candidates: current.candidates.filter((_, candidateIndex) => candidateIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <label className="field">
                      <span>Display name</span>
                      <input
                        value={candidate.displayName}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            candidates: current.candidates.map((item, candidateIndex) =>
                              candidateIndex === index
                                ? { ...item, displayName: event.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Candidate wallet (optional)</span>
                      <input
                        placeholder="0x..."
                        value={candidate.walletAddress}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            candidates: current.candidates.map((item, candidateIndex) =>
                              candidateIndex === index
                                ? { ...item, walletAddress: event.target.value }
                                : item
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button
                className="ghost"
                type="button"
                onClick={() =>
                  setCreateForm((current) => ({
                    ...current,
                    candidates: [...current.candidates, createEmptyCandidate(current.candidates.length)],
                  }))
                }
              >
                Add Candidate
              </button>
            </label>
            <label className="field">
              <span>Eligible voter addresses</span>
              <textarea
                rows={5}
                placeholder="One address per line, or separate by commas."
                value={createForm.votersText}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, votersText: event.target.value }))
                }
              />
            </label>
            <button className="primary" disabled={!canCreateElections} onClick={createElection}>
              Create Election
            </button>
            <div className="notice">
              {createDisableReason ??
                "The backend will generate the Merkle tree, manifest bundle, and create the election through the Sepolia factory."}
            </div>
          </article>

          <article className="card">
            <h3>Session</h3>
            <div className="kv">
              <span>Signed-in wallet</span>
              <strong>{me?.user?.address ?? "Not signed in"}</strong>
            </div>
            <div className="kv">
              <span>Wallet matches session</span>
              <strong>{walletMatchesSession ? "Yes" : "No"}</strong>
            </div>
            <div className="kv">
              <span>Recent logins</span>
              <strong>{me?.loginHistory?.length ?? 0}</strong>
            </div>
          </article>

          <article className="card">
            <div className="panel-header">
              <h3>My Elections</h3>
              <button className="ghost" onClick={() => void refreshMyElections()}>
                Refresh
              </button>
            </div>
            <div className="history-list">
              {myElections.map((item) => (
                <button
                  key={`my-election-${item.address}`}
                  className="election-item"
                  onClick={() => setSelectedElectionAddress(item.address)}
                >
                  <strong>{item.title}</strong>
                  <small>{shortenAddress(item.address)}</small>
                  <span>{item.voterCount} voter(s)</span>
                </button>
              ))}
              {!myElections.length ? (
                <div className="notice">This wallet has not created any ElectionV1 instances yet.</div>
              ) : null}
            </div>
          </article>

          <article className="card">
            <h3>Election</h3>
            <div className="kv">
              <span>Commit start</span>
              <strong>{detail ? formatUnix(detail.commitStart) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Commit end</span>
              <strong>{detail ? formatUnix(detail.commitEnd) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Reveal end</span>
              <strong>{detail ? formatUnix(detail.revealEnd) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Total commits / reveals</span>
              <strong>{detail ? `${detail.onChain?.totalCommits ?? 0} / ${detail.onChain?.totalReveals ?? 0}` : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Contract owner</span>
              <strong>{detail?.onChain?.owner ?? "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Eligible voters</span>
              <strong>{detail?.voterCount ?? "0"}</strong>
            </div>
          </article>
        </section>

        <section className="grid">
          <article className="card">
            <h3>Your Status</h3>
            <div className="kv">
              <span>Eligible</span>
              <strong>{detail?.onChain?.viewer ? String(detail.onChain.viewer.eligible) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Committed</span>
              <strong>{detail?.onChain?.viewer ? String(detail.onChain.viewer.hasCommitted) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Revealed</span>
              <strong>{detail?.onChain?.viewer ? String(detail.onChain.viewer.hasRevealed) : "n/a"}</strong>
            </div>
            <div className="kv">
              <span>Local vote package</span>
              <strong>{storedVotePackage ? storedVotePackage.candidateName : "Not found"}</strong>
            </div>
            <div className="action-group">
              <button className="primary" disabled={!canReveal} onClick={revealVote}>
                Reveal Vote
              </button>
              <button className="primary" disabled={!canFinalize} onClick={finalizeElection}>
                Finalize
              </button>
            </div>
            <div className="notice">
              {busy
                ? "A transaction or request is still running."
                : detail?.onChain?.phaseLabel === "Commit"
                  ? canCommit
                    ? "Choose one candidate below to commit your vote."
                    : "Commit is only available to eligible wallets that have not committed yet."
                  : detail?.onChain?.phaseLabel === "Reveal"
                    ? canReveal
                      ? "Reveal is ready. Use the same wallet and browser that created the local vote package."
                    : "Reveal requires a previously stored local vote package for this wallet."
                    : detail?.onChain?.phaseLabel === "Ended"
                      ? "Finalize is permissionless in ElectionV1 once the reveal window is over."
                      : "Follow the current phase shown above."}
            </div>
          </article>

          <article className="card">
            <div className="panel-header">
              <h3>Revealed Results</h3>
              <button className="ghost" onClick={() => void refreshElection()}>Refresh</button>
            </div>
            <div className="candidate-list">
              {(detail?.onChain?.results ?? []).map((candidate) => (
                <div key={candidate.candidateId} className="candidate-row">
                  <div>
                    <strong>{candidate.candidateName}</strong>
                    <small>{candidate.candidateSourceId ?? shortenAddress(candidate.candidateId)}</small>
                    {candidate.candidateWalletAddress ? (
                      <small>Wallet: {shortenAddress(candidate.candidateWalletAddress)}</small>
                    ) : null}
                    <small>{candidate.count} reveal(s)</small>
                  </div>
                  <button
                    className="primary"
                    disabled={!canCommit}
                    onClick={() => void commitVote(candidate)}
                  >
                    Commit Vote
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid">
          <article className="card">
            <h3>Election Activity</h3>
            <div className="history-list">
              {(detail?.activityHistory ?? []).map((item) => (
                <div key={item.txHash} className="history-row">
                  <div>
                    <strong>{item.actionType}</strong>
                    <small>{item.actorAddress ? shortenAddress(item.actorAddress) : "System action"}</small>
                    {item.candidateName ? <small>{item.candidateName}</small> : null}
                  </div>
                  <div className="history-meta">
                    <span>{formatDateTime(item.actionAt)}</span>
                    <a href={item.links.transaction} target="_blank" rel="noreferrer">
                      Tx
                    </a>
                  </div>
                </div>
              ))}
              {!detail?.activityHistory?.length ? (
                <div className="notice">No on-chain activity has been synced yet.</div>
              ) : null}
            </div>
          </article>

          <article className="card">
            <div className="panel-header">
              <h3>Login History</h3>
              <a href={detail?.links?.contract ?? "#"} target="_blank" rel="noreferrer">
                Contract
              </a>
            </div>
            <div className="history-list">
              {(me?.loginHistory ?? []).map((item) => (
                <div key={item.id} className="history-row">
                  <div>
                    <strong>{shortenAddress(item.address)}</strong>
                    <small>{item.address}</small>
                  </div>
                  <div className="history-meta">
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
              ))}
              {!me?.loginHistory?.length ? <div className="notice">No wallet-login history yet.</div> : null}
            </div>
          </article>
        </section>

        <section className="message-bar">
          <strong>Status</strong>
          <span>{message}</span>
        </section>
      </main>
    </div>
  );
}

export default App;
