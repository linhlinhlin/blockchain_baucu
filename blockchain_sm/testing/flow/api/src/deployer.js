const fs = require("node:fs");
const path = require("node:path");
const { Contract, JsonRpcProvider, Wallet, getAddress, isAddress } = require("ethers");
const config = require("./config");
const { saveDeployment } = require("./repository");
const { buildElectionPackage } = require("../../../../scripts/lib/electionPackage");

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function writeJson(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function createSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeCandidates(payloadCandidates, electionKey) {
  if (!Array.isArray(payloadCandidates)) {
    throw new Error("Candidates must be an array.");
  }

  const normalized = payloadCandidates
    .map((candidate, index) => {
      const displayName = String(
        candidate?.displayName ?? candidate?.name ?? candidate?.candidateName ?? ""
      ).trim();
      if (!displayName) {
        return null;
      }

      const walletAddress = String(candidate?.walletAddress ?? "").trim();
      if (walletAddress && !isAddress(walletAddress)) {
        throw new Error(`Candidate ${index + 1} walletAddress is invalid.`);
      }

      return {
        id:
          String(candidate?.id ?? "").trim() ||
          `${electionKey}:candidate:${index + 1}:${createSlug(displayName) || "candidate"}`,
        name: displayName,
        walletAddress: walletAddress || undefined,
      };
    })
    .filter(Boolean);

  if (normalized.length < 2) {
    throw new Error("At least two candidates are required.");
  }

  return normalized;
}

function normalizeVoters(payloadVoters) {
  if (!Array.isArray(payloadVoters)) {
    throw new Error("Voters must be an array.");
  }

  const seen = new Set();
  const normalized = payloadVoters
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .map((value, index) => {
      if (!isAddress(value)) {
        throw new Error(`Voter ${index + 1} is not a valid EVM address.`);
      }

      return getAddress(value);
    })
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });

  if (normalized.length === 0) {
    throw new Error("At least one eligible voter is required.");
  }

  return normalized;
}

function validatePayload(requesterAddress, payload) {
  const title = String(payload.title ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const commitStart = Number(payload.commitStart);
  const commitEnd = Number(payload.commitEnd);
  const revealEnd = Number(payload.revealEnd);
  const electionKey =
    String(payload.electionKey ?? "").trim() ||
    `holihu-${createSlug(title) || "election"}-${Math.floor(Date.now() / 1000)}`;

  if (!title) {
    throw new Error("Title is required.");
  }
  if (!Number.isFinite(commitStart) || !Number.isFinite(commitEnd) || !Number.isFinite(revealEnd)) {
    throw new Error("Invalid schedule.");
  }
  if (!(commitStart < commitEnd && commitEnd < revealEnd)) {
    throw new Error("Schedule must satisfy commitStart < commitEnd < revealEnd.");
  }

  const candidates = normalizeCandidates(payload.candidates ?? [], electionKey);
  const voters = normalizeVoters(payload.voters ?? []);

  return {
    admin: getAddress(requesterAddress),
    electionKey,
    title,
    description,
    commitStart,
    commitEnd,
    revealEnd,
    organization: String(payload.organization ?? "HoLiHu").trim() || "HoLiHu",
    candidates,
    voters,
  };
}

function writeElectionPackageArtifacts(packageDir, electionPackage) {
  ensureDir(packageDir);
  const manifestPath = path.join(packageDir, "manifest.json");
  const manifestPrettyPath = path.join(packageDir, "manifest.pretty.json");
  const eligibilityPath = path.join(packageDir, "eligibility-tree.json");
  const configPath = path.join(packageDir, "election-config.json");
  const summaryPath = path.join(packageDir, "summary.json");

  fs.writeFileSync(manifestPath, `${electionPackage.manifestCanonicalJson}\n`);
  writeJson(manifestPrettyPath, electionPackage.manifest);
  writeJson(eligibilityPath, electionPackage.eligibility);
  writeJson(configPath, electionPackage.config);
  writeJson(summaryPath, electionPackage.summary);

  return {
    configPath,
    eligibilityPath,
    manifestPath,
    manifestPrettyPath,
    packageDir,
    summaryPath,
  };
}

async function deployElection(requesterAddress, payload) {
  if (!config.deployerPrivateKey) {
    throw new Error("Server deployer key is not configured.");
  }
  if (!config.factoryAddress) {
    throw new Error("Election factory address is not configured.");
  }

  const validated = validatePayload(requesterAddress, payload);
  const electionPackage = buildElectionPackage({
    admin: validated.admin,
    embedManifestAsDataUri: true,
    schedule: {
      commitStart: validated.commitStart,
      commitEnd: validated.commitEnd,
      revealEnd: validated.revealEnd,
    },
    candidates: validated.candidates,
    voters: validated.voters,
    manifest: {
      electionKey: validated.electionKey,
      title: validated.title,
      organization: validated.organization,
      description: validated.description,
    },
  });

  const packageDir = path.join(config.tempDir, `${validated.electionKey}-${Date.now()}`);
  const packageFiles = writeElectionPackageArtifacts(packageDir, electionPackage);

  const factoryArtifact = JSON.parse(fs.readFileSync(config.factoryArtifactPath, "utf8"));
  const provider = new JsonRpcProvider(config.rpcUrl);
  const deployer = new Wallet(config.deployerPrivateKey, provider);
  const factory = new Contract(config.factoryAddress, factoryArtifact.abi, deployer);

  const tx = await factory.createElection(electionPackage.config);
  const receipt = await tx.wait();

  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "ElectionCreated");

  if (!event) {
    throw new Error("ElectionCreated event not found in receipt.");
  }

  const networkInfo = await provider.getNetwork();
  const record = {
    blockNumber: receipt.blockNumber,
    chainId: networkInfo.chainId.toString(),
    config: electionPackage.config,
    configPath: packageFiles.configPath,
    constructorArguments: [
      electionPackage.config.admin,
      electionPackage.config.electionURI,
      electionPackage.config.electionMetadataHash,
      electionPackage.config.eligibleVotersRoot,
      electionPackage.config.commitStart,
      electionPackage.config.commitEnd,
      electionPackage.config.revealEnd,
      electionPackage.config.candidateIds,
    ],
    createdAt: new Date().toISOString(),
    electionAddress: event.args.electionAddress,
    electionId: event.args.electionId.toString(),
    eligibility: electionPackage.eligibility,
    factoryAddress: config.factoryAddress,
    manifest: electionPackage.manifest,
    network: "sepolia",
    requesterAddress: validated.admin,
    summary: electionPackage.summary,
    txHash: receipt.hash,
  };
  const stored = saveDeployment(record);

  return {
    electionPackage,
    packageFiles,
    record,
    stored,
  };
}

module.exports = {
  deployElection,
};
