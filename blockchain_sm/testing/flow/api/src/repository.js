const fs = require("node:fs");
const path = require("node:path");
const { getAddress } = require("viem");
const config = require("./config");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseManifestDataUri(uri) {
  if (typeof uri !== "string" || !uri.startsWith("data:application/json;utf8,")) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(uri.slice("data:application/json;utf8,".length)));
  } catch {
    return null;
  }
}

function readJsonIfExists(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return null;
  }

  return readJson(targetPath);
}

function loadElectionPackageArtifacts(rawRecord) {
  const configPath = rawRecord.configPath ? path.resolve(rawRecord.configPath) : null;
  const packageDir = configPath ? path.dirname(configPath) : null;
  const manifestPath = packageDir ? path.join(packageDir, "manifest.pretty.json") : null;
  const summaryPath = packageDir ? path.join(packageDir, "summary.json") : null;
  const eligibilityPath = packageDir ? path.join(packageDir, "eligibility-tree.json") : null;

  const configPayload =
    rawRecord.config ??
    (configPath && fs.existsSync(configPath) ? readJson(configPath) : null);
  const manifest =
    rawRecord.manifest ??
    readJsonIfExists(manifestPath) ??
    parseManifestDataUri(configPayload?.electionURI ?? null);
  const summary = rawRecord.summary ?? readJsonIfExists(summaryPath);
  const eligibility = rawRecord.eligibility ?? readJsonIfExists(eligibilityPath);

  return {
    configPath,
    packageDir,
    config: configPayload,
    manifest,
    manifestPath,
    summary,
    summaryPath,
    eligibility,
    eligibilityPath,
  };
}

function toCandidateSummary(candidate, index, configCandidateIds = []) {
  const candidateId = candidate?.candidateId ?? configCandidateIds[index] ?? null;
  return {
    candidateId,
    displayName: candidate?.name ?? candidate?.displayName ?? `Candidate ${index + 1}`,
    sourceId: candidate?.id ?? candidate?.sourceId ?? null,
    walletAddress: candidate?.walletAddress ?? null,
  };
}

function getPhasePriority(record) {
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(record.commitStart)) {
    return 1;
  }
  if (now < Number(record.commitEnd)) {
    return 0;
  }
  if (now < Number(record.revealEnd)) {
    return 2;
  }
  return 3;
}

function normalizeRecord(rawRecord, recordPath) {
  const assets = loadElectionPackageArtifacts(rawRecord);
  const electionAddress = getAddress(rawRecord.electionAddress ?? rawRecord.address);
  const admin = getAddress(rawRecord.config?.admin ?? rawRecord.admin);
  const manifestCandidates = Array.isArray(assets.manifest?.candidates) ? assets.manifest.candidates : [];
  const configCandidateIds = Array.isArray(assets.config?.candidateIds) ? assets.config.candidateIds : [];
  const candidates = manifestCandidates.map((candidate, index) =>
    toCandidateSummary(candidate, index, configCandidateIds)
  );

  return {
    ...rawRecord,
    address: electionAddress,
    admin,
    blockNumber: Number(rawRecord.blockNumber ?? 0),
    commitStart: Number(assets.config?.commitStart ?? assets.summary?.commitStart ?? 0),
    commitEnd: Number(assets.config?.commitEnd ?? assets.summary?.commitEnd ?? 0),
    revealEnd: Number(assets.config?.revealEnd ?? assets.summary?.revealEnd ?? 0),
    title: assets.manifest?.title ?? rawRecord.title ?? "Untitled Election",
    description: assets.manifest?.description ?? rawRecord.description ?? "",
    electionKey: assets.manifest?.electionKey ?? null,
    voterCount: Number(assets.summary?.voterCount ?? assets.manifest?.voterCount ?? 0),
    candidates,
    config: assets.config,
    packageDir: assets.packageDir,
    configPath: assets.configPath,
    eligibility: assets.eligibility,
    eligibilityPath: assets.eligibilityPath,
    manifest: assets.manifest,
    manifestPath: assets.manifestPath,
    summary: assets.summary,
    summaryPath: assets.summaryPath,
    recordPath,
  };
}

function listElectionRecords() {
  if (!fs.existsSync(config.deploymentsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(config.deploymentsDir)
    .filter((name) => /^election-.*\.json$/i.test(name))
    .sort();

  const byAddress = new Map();
  for (const fileName of files) {
    const fullPath = path.join(config.deploymentsDir, fileName);
    const rawRecord = readJson(fullPath);
    const record = normalizeRecord(rawRecord, fullPath);
    byAddress.set(record.address.toLowerCase(), record);
  }

  return Array.from(byAddress.values()).sort((left, right) => {
    const leftPriority = getPhasePriority(left);
    const rightPriority = getPhasePriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return right.blockNumber - left.blockNumber;
  });
}

function summarizeRecord(record) {
  return {
    address: record.address,
    admin: record.admin,
    title: record.title,
    description: record.description,
    electionKey: record.electionKey,
    commitStart: record.commitStart,
    commitEnd: record.commitEnd,
    revealEnd: record.revealEnd,
    voterCount: record.voterCount,
    candidates: record.candidates,
    blockNumber: record.blockNumber,
    txHash: record.txHash,
    createdAt: record.createdAt,
    recordPath: record.recordPath,
    packageDir: record.packageDir,
    links: {
      contract: `${config.explorerBaseUrl}/address/${record.address}`,
      transaction: `${config.explorerBaseUrl}/tx/${record.txHash}`,
    },
  };
}

function resolveElection(identifier) {
  const normalized = String(identifier).toLowerCase();
  return (
    listElectionRecords().find((record) => {
      return (
        record.address.toLowerCase() === normalized ||
        record.title.toLowerCase() === normalized ||
        String(record.electionId ?? "").toLowerCase() === normalized
      );
    }) ?? null
  );
}

function listElectionRecordsByAdmin(adminAddress) {
  const normalizedAdminAddress = getAddress(adminAddress).toLowerCase();
  return listElectionRecords().filter((record) => record.admin.toLowerCase() === normalizedAdminAddress);
}

function saveDeployment(payload) {
  ensureDir(config.deploymentsDir);
  const latestPath = path.join(config.deploymentsDir, "election-latest.json");
  const snapshotPath = path.join(config.deploymentsDir, `election-${timestampForFile()}.json`);

  fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);

  return {
    latestPath,
    snapshotPath,
  };
}

module.exports = {
  listElectionRecords,
  listElectionRecordsByAdmin,
  resolveElection,
  saveDeployment,
  summarizeRecord,
};
