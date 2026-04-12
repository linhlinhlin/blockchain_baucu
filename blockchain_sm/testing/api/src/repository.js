const fs = require("node:fs");
const path = require("node:path");
const { isAddress } = require("viem");

const TESTING_ROOT = path.resolve(__dirname, "..");
const CONTRACTS_ROOT = path.resolve(TESTING_ROOT, "..", "..");
const DEPLOYMENTS_DIR = process.env.DEPLOYMENTS_DIR
  ? path.resolve(process.env.DEPLOYMENTS_DIR)
  : path.join(CONTRACTS_ROOT, "deployments", "sepolia");

function decodeManifestFromUri(uri) {
  if (typeof uri !== "string" || !uri.startsWith("data:application/json;utf8,")) {
    return null;
  }

  const [, encoded] = uri.split(",", 2);
  return JSON.parse(decodeURIComponent(encoded));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findEligibilityPath(configPath) {
  return path.join(path.dirname(configPath), "eligibility-tree.json");
}

function loadManifest(record) {
  const manifestFromUri = decodeManifestFromUri(record.config?.electionURI);
  if (manifestFromUri) {
    return manifestFromUri;
  }

  const manifestPath = path.join(path.dirname(record.configPath), "manifest.json");
  if (fs.existsSync(manifestPath)) {
    return readJson(manifestPath);
  }

  return null;
}

function loadEligibility(record) {
  if (!record?.eligibilityPath || !fs.existsSync(record.eligibilityPath)) {
    return null;
  }

  return readJson(record.eligibilityPath);
}

function listElectionRecords() {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(DEPLOYMENTS_DIR)
    .filter((name) => /^election-.*\.json$/i.test(name))
    .sort();

  const byAddress = new Map();
  files.forEach((fileName) => {
    const fullPath = path.join(DEPLOYMENTS_DIR, fileName);
    const record = readJson(fullPath);
    byAddress.set(record.electionAddress.toLowerCase(), {
      ...record,
      recordPath: fullPath,
      manifest: loadManifest(record),
      eligibilityPath: findEligibilityPath(record.configPath),
    });
  });

  return Array.from(byAddress.values()).sort((left, right) => {
    const leftPriority = getSchedulePriority(left);
    const rightPriority = getSchedulePriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftBlock = Number(left.blockNumber ?? 0);
    const rightBlock = Number(right.blockNumber ?? 0);
    return rightBlock - leftBlock;
  });
}

function getSchedulePriority(record) {
  const now = Math.floor(Date.now() / 1000);
  const commitStart = Number(record.config?.commitStart ?? 0);
  const commitEnd = Number(record.config?.commitEnd ?? 0);
  const revealEnd = Number(record.config?.revealEnd ?? 0);

  if (now >= commitStart && now < commitEnd) {
    return 0;
  }
  if (now >= commitEnd && now < revealEnd) {
    return 1;
  }
  if (now < commitStart) {
    return 2;
  }
  return 3;
}

function buildCandidateView(record) {
  const manifestCandidates = new Map(
    (record.manifest?.candidates ?? []).map((candidate) => [candidate.candidateId, candidate])
  );

  return (record.config?.candidateIds ?? []).map((candidateId, index) => {
    const manifestCandidate = manifestCandidates.get(candidateId);
    return {
      candidateId,
      index,
      label: manifestCandidate?.name ?? manifestCandidate?.id ?? `Candidate ${index + 1}`,
      manifestId: manifestCandidate?.id ?? null,
    };
  });
}

function summarizeRecord(record) {
  return {
    electionId: record.electionId,
    electionAddress: record.electionAddress,
    recordPath: record.recordPath,
    createdAt: record.createdAt,
    txHash: record.txHash,
    blockNumber: record.blockNumber,
    admin: record.config?.admin,
    commitStart: record.config?.commitStart,
    commitEnd: record.config?.commitEnd,
    revealEnd: record.config?.revealEnd,
    scheduleStatus:
      getSchedulePriority(record) === 0
        ? "Commit"
        : getSchedulePriority(record) === 1
          ? "Reveal"
          : getSchedulePriority(record) === 2
            ? "Pending"
            : "Ended",
    manifest: record.manifest,
    candidates: buildCandidateView(record),
    configPath: record.configPath,
    electionURI: record.config?.electionURI,
  };
}

function resolveElection(identifier) {
  const normalized = String(identifier).toLowerCase();
  return (
    listElectionRecords().find((item) => {
      return item.electionId === identifier || item.electionAddress.toLowerCase() === normalized;
    }) ?? null
  );
}

function getProofForAddress(record, voterAddress) {
  if (!isAddress(voterAddress)) {
    throw new Error("Invalid address.");
  }

  if (!fs.existsSync(record.eligibilityPath)) {
    return {
      eligible: false,
      proof: null,
    };
  }

  const eligibility = readJson(record.eligibilityPath);
  const normalized = voterAddress.toLowerCase();
  const proofEntry = Object.entries(eligibility.proofs ?? {}).find(
    ([address]) => address.toLowerCase() === normalized
  );

  if (!proofEntry) {
    return {
      eligible: false,
      proof: null,
    };
  }

  return {
    eligible: true,
    proof: proofEntry[1],
  };
}

function listEligibleVoters(record) {
  const eligibility = loadEligibility(record);
  if (!eligibility) {
    return [];
  }

  return (eligibility.values ?? []).map((entry) => entry?.[0]).filter(Boolean);
}

module.exports = {
  DEPLOYMENTS_DIR,
  getProofForAddress,
  listEligibleVoters,
  listElectionRecords,
  resolveElection,
  summarizeRecord,
};
