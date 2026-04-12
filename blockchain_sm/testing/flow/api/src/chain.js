const fs = require("node:fs");
const { createPublicClient, getAddress, http } = require("viem");
const { sepolia } = require("viem/chains");
const config = require("./config");

const zeroBytes32 = `0x${"0".repeat(64)}`;
const statusLabels = {
  0: "Pending",
  1: "Commit",
  2: "Reveal",
  3: "Ended",
  4: "Finalized",
  5: "Canceled",
};

const artifact = JSON.parse(fs.readFileSync(config.electionArtifactPath, "utf8"));
const abi = artifact.abi;
const blockTimestampCache = new Map();

const publicClients = config.rpcUrls.map((rpcUrl) =>
  createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl, {
      retryCount: 1,
      timeout: 10_000,
    }),
  })
);

const publicClient = publicClients[0];

async function callWithRpcFallback(run) {
  let lastError = null;

  for (const client of publicClients) {
    try {
      return await run(client);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No Sepolia RPC client is configured.");
}

function findEvent(name) {
  return abi.find((entry) => entry.type === "event" && entry.name === name);
}

function findCandidate(record, candidateId) {
  return (
    record.candidates.find(
      (candidate) => candidate.candidateId?.toLowerCase() === String(candidateId).toLowerCase()
    ) ?? null
  );
}

async function getBlockTimestamp(blockNumber) {
  const cacheKey = Number(blockNumber);
  if (blockTimestampCache.has(cacheKey)) {
    return blockTimestampCache.get(cacheKey);
  }

  const block = await callWithRpcFallback((client) =>
    client.getBlock({
      blockNumber: BigInt(cacheKey),
    })
  );
  const timestamp = Number(block.timestamp);
  blockTimestampCache.set(cacheKey, timestamp);
  return timestamp;
}

function getViewerProof(record, viewerAddress) {
  if (!viewerAddress || !record.eligibility?.proofs) {
    return null;
  }

  const normalized = getAddress(viewerAddress);
  return record.eligibility.proofs[normalized] ?? null;
}

async function loadElectionOnChain(record, viewerAddress = null) {
  const address = getAddress(record.address);
  const [phase, owner, totalCommits, totalReveals, finalized, canceled, [candidateIds, counts]] =
    await Promise.all([
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "currentPhase" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "owner" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "totalCommits" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "totalReveals" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "finalized" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "canceled" })),
      callWithRpcFallback((client) => client.readContract({ address, abi, functionName: "getResults" })),
    ]);

  let viewer = null;
  if (viewerAddress) {
    const normalized = getAddress(viewerAddress);
    const proof = getViewerProof(record, normalized);
    const [commitment, hasRevealed] = await Promise.all([
      callWithRpcFallback((client) =>
        client.readContract({
          address,
          abi,
          functionName: "commitments",
          args: [normalized],
        })
      ),
      callWithRpcFallback((client) =>
        client.readContract({
          address,
          abi,
          functionName: "hasRevealed",
          args: [normalized],
        })
      ),
    ]);

    viewer = {
      address: normalized,
      eligible: Array.isArray(proof),
      hasCommitted: commitment !== zeroBytes32,
      hasRevealed,
      commitment: commitment !== zeroBytes32 ? commitment : null,
      proofAvailable: Array.isArray(proof),
    };
  }

  return {
    address,
    owner,
    phase: Number(phase),
    phaseLabel: statusLabels[Number(phase)] ?? "Unknown",
    finalized,
    canceled,
    commitStart: Number(record.commitStart),
    commitEnd: Number(record.commitEnd),
    revealEnd: Number(record.revealEnd),
    totalCommits: totalCommits.toString(),
    totalReveals: totalReveals.toString(),
    results: candidateIds.map((candidateId, index) => {
      const candidate = findCandidate(record, candidateId);
      return {
        candidateIndex: index,
        candidateId,
        candidateName: candidate?.displayName ?? `Candidate ${index + 1}`,
        candidateSourceId: candidate?.sourceId ?? null,
        candidateWalletAddress: candidate?.walletAddress ?? null,
        count: Number(counts[index]),
      };
    }),
    viewer,
  };
}

async function syncElectionActivity(db, record) {
  const electionAddress = getAddress(record.address);
  const eventSpecs = [
    { name: "VoteCommitted", actionType: "COMMIT" },
    { name: "VoteRevealed", actionType: "REVEAL" },
    { name: "ElectionFinalized", actionType: "FINALIZE" },
    { name: "ElectionCanceled", actionType: "CANCEL" },
  ];

  for (const eventSpec of eventSpecs) {
    const logs = await callWithRpcFallback((client) =>
      client.getLogs({
        address: electionAddress,
        event: findEvent(eventSpec.name),
        fromBlock: BigInt(record.blockNumber ?? 0),
        toBlock: "latest",
      })
    );

    for (const log of logs) {
      const timestamp =
        log.args.timestamp !== undefined
          ? Number(log.args.timestamp)
          : await getBlockTimestamp(log.blockNumber);

      const actorAddress = log.args.voter ? getAddress(log.args.voter) : null;
      const candidateId = log.args.candidateId ?? null;
      const candidate = candidateId ? findCandidate(record, candidateId) : null;
      const payload = {
        commitment: log.args.commitment ?? null,
        reasonHash: log.args.reasonHash ?? null,
        totalCommits:
          log.args.totalCommits !== undefined ? Number(log.args.totalCommits) : null,
        totalReveals:
          log.args.totalReveals !== undefined ? Number(log.args.totalReveals) : null,
      };

      await db.query(
        `
          INSERT INTO election_activity_history(
            election_address,
            action_type,
            actor_address,
            candidate_id,
            candidate_name,
            tx_hash,
            block_number,
            action_at,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9::jsonb)
          ON CONFLICT (tx_hash) DO NOTHING
        `,
        [
          electionAddress,
          eventSpec.actionType,
          actorAddress,
          candidateId,
          candidate?.displayName ?? null,
          log.transactionHash,
          Number(log.blockNumber),
          timestamp,
          JSON.stringify(payload),
        ]
      );
    }
  }
}

async function loadElectionActivityHistory(db, electionAddress) {
  const result = await db.query(
    `
      SELECT election_address, action_type, actor_address, candidate_id, candidate_name, tx_hash, block_number, action_at, payload, synced_at
      FROM election_activity_history
      WHERE election_address = $1
      ORDER BY action_at DESC, id DESC
    `,
    [getAddress(electionAddress)]
  );

  return result.rows.map((row) => ({
    electionAddress: row.election_address,
    actionType: row.action_type,
    actorAddress: row.actor_address,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name,
    txHash: row.tx_hash,
    blockNumber: Number(row.block_number),
    actionAt: row.action_at,
    payload: row.payload ?? {},
    syncedAt: row.synced_at,
    links: {
      actor: row.actor_address ? `${config.explorerBaseUrl}/address/${row.actor_address}` : null,
      transaction: `${config.explorerBaseUrl}/tx/${row.tx_hash}`,
    },
  }));
}

module.exports = {
  abi,
  callWithRpcFallback,
  getViewerProof,
  loadElectionActivityHistory,
  loadElectionOnChain,
  publicClient,
  syncElectionActivity,
};
