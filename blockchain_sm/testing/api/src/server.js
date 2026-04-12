const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createPublicClient, formatEther, http, parseEther } = require("viem");
const { sepolia } = require("viem/chains");
const electionAbi = require("./electionAbi");
const {
  DEPLOYMENTS_DIR,
  getProofForAddress,
  listEligibleVoters,
  listElectionRecords,
  resolveElection,
  summarizeRecord,
} = require("./repository");

dotenv.config({
  path: process.env.TESTING_ENV_PATH,
});

const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
const rpcUrl = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const explorerBaseUrl = process.env.EXPLORER_BASE_URL ?? "https://sepolia.etherscan.io";
const recommendedTestBalanceEth = process.env.RECOMMENDED_TEST_BALANCE_ETH ?? "0.002";
const recommendedTestBalanceWei = parseEther(recommendedTestBalanceEth);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

const phaseLabels = {
  0: "Pending",
  1: "Commit",
  2: "Reveal",
  3: "Ended",
  4: "Finalized",
  5: "Canceled",
};

async function loadOnChainState(electionAddress) {
  const [
    owner,
    currentPhase,
    commitStart,
    commitEnd,
    revealEnd,
    finalized,
    totalCommits,
    totalReveals,
    [resultCandidateIds, resultCounts],
  ] = await Promise.all([
    publicClient.readContract({ address: electionAddress, abi: electionAbi, functionName: "owner" }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "currentPhase",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "commitStart",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "commitEnd",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "revealEnd",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "finalized",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "totalCommits",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "totalReveals",
    }),
    publicClient.readContract({
      address: electionAddress,
      abi: electionAbi,
      functionName: "getResults",
    }),
  ]);

  return {
    owner,
    phase: Number(currentPhase),
    phaseLabel: phaseLabels[Number(currentPhase)] ?? "Unknown",
    commitStart: Number(commitStart),
    commitEnd: Number(commitEnd),
    revealEnd: Number(revealEnd),
    finalized,
    totalCommits: totalCommits.toString(),
    totalReveals: totalReveals.toString(),
    resultCandidateIds,
    resultCounts: resultCounts.map((value) => value.toString()),
  };
}

function withLinks(payload) {
  return {
    ...payload,
    links: {
      contract: `${explorerBaseUrl}/address/${payload.electionAddress}`,
      transaction: payload.txHash ? `${explorerBaseUrl}/tx/${payload.txHash}` : null,
    },
  };
}

async function loadVoterTestingState(record) {
  const voters = listEligibleVoters(record);
  const rows = await Promise.all(
    voters.map(async (address, index) => {
      const balanceWei = await publicClient.getBalance({ address });
      return {
        index: index + 1,
        address,
        balanceEth: formatEther(balanceWei),
        fundedEnough: balanceWei >= recommendedTestBalanceWei,
        proof: getProofForAddress(record, address).proof,
        links: {
          address: `${explorerBaseUrl}/address/${address}`,
        },
      };
    })
  );

  return {
    recommendedTestBalanceEth,
    fundedCount: rows.filter((row) => row.fundedEnough).length,
    totalCount: rows.length,
    voters: rows,
  };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    rpcUrl,
    deploymentsDir: DEPLOYMENTS_DIR,
    explorerBaseUrl,
    recommendedTestBalanceEth,
  });
});

app.get("/api/elections", (_request, response) => {
  response.json({
    items: listElectionRecords().map((record) => withLinks(summarizeRecord(record))),
  });
});

app.get("/api/elections/:identifier", async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  try {
    const onChain = await loadOnChainState(record.electionAddress);
    const candidateMap = new Map(
      summarizeRecord(record).candidates.map((candidate) => [candidate.candidateId, candidate])
    );
    const testing = await loadVoterTestingState(record);

    response.json({
      ...withLinks(summarizeRecord(record)),
      testing,
      onChain: {
        ...onChain,
        results: onChain.resultCandidateIds.map((candidateId, index) => ({
          candidateId,
          label: candidateMap.get(candidateId)?.label ?? candidateId,
          count: onChain.resultCounts[index],
        })),
      },
    });
  } catch (error) {
    response.status(500).json({
      error: "Failed to read on-chain state.",
      detail: error.message,
    });
  }
});

app.get("/api/elections/:identifier/testing", async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  try {
    const [onChain, testing] = await Promise.all([
      loadOnChainState(record.electionAddress),
      loadVoterTestingState(record),
    ]);

    response.json({
      electionId: record.electionId,
      electionAddress: record.electionAddress,
      title: record.manifest?.title ?? record.electionAddress,
      phase: onChain.phase,
      phaseLabel: onChain.phaseLabel,
      links: {
        contract: `${explorerBaseUrl}/address/${record.electionAddress}`,
      },
      testing,
    });
  } catch (error) {
    response.status(500).json({
      error: "Failed to build testing summary.",
      detail: error.message,
    });
  }
});

app.get("/api/elections/:identifier/proof", (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  const voterAddress = request.query.address;
  if (!voterAddress) {
    response.status(400).json({ error: "Query parameter 'address' is required." });
    return;
  }

  try {
    response.json({
      address: voterAddress,
      ...getProofForAddress(record, voterAddress),
    });
  } catch (error) {
    response.status(400).json({
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Testing API listening on http://localhost:${port}`);
});
