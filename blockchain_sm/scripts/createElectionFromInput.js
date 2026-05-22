const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { buildElectionPackage } = require("./lib/electionPackage");
const { getOptionalEnv } = require("./lib/env");
const { loadLatestDeployment, saveDeployment } = require("./lib/deployments");
const { ensureDir, readJson, resolveFromCwd, writeJson } = require("./lib/io");

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config({ override: true });

function requireEnv(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  return value;
}

function getNetworkName() {
  return getOptionalEnv("ELECTION_NETWORK") ?? "sepolia";
}

function getPrivateKey() {
  const raw = requireEnv("SEPOLIA_PRIVATE_KEYS");
  const first = raw
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  if (!first) {
    throw new Error("SEPOLIA_PRIVATE_KEYS does not contain a usable private key.");
  }

  return first;
}

function writeElectionPackageArtifacts(outputDir, electionPackage, requestPayload) {
  ensureDir(outputDir);

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifestPrettyPath = path.join(outputDir, "manifest.pretty.json");
  const eligibilityPath = path.join(outputDir, "eligibility-tree.json");
  const configPath = path.join(outputDir, "election-config.json");
  const summaryPath = path.join(outputDir, "summary.json");
  const requestPath = path.join(outputDir, "request.json");

  fs.writeFileSync(manifestPath, `${electionPackage.manifestCanonicalJson}\n`);
  writeJson(manifestPrettyPath, electionPackage.manifest);
  writeJson(eligibilityPath, electionPackage.eligibility);
  writeJson(configPath, electionPackage.config);
  writeJson(summaryPath, electionPackage.summary);
  writeJson(requestPath, requestPayload);

  return {
    manifestPath,
    manifestPrettyPath,
    eligibilityPath,
    configPath,
    summaryPath,
    requestPath,
  };
}

async function main() {
  const inputPath = getOptionalEnv("ELECTION_INPUT_PATH") ?? process.argv[2];
  const outputDirArg =
    getOptionalEnv("ELECTION_OUTPUT_DIR") ?? process.argv[3] ?? path.join("tmp", "generated-election");

  if (!inputPath) {
    throw new Error(
      "Usage: node scripts/createElectionFromInput.js <election-input.json> [output-dir]"
    );
  }

  const networkName = getNetworkName();
  const requesterAddress = getOptionalEnv("ELECTION_REQUESTER_ADDRESS");
  const requesterUserId = getOptionalEnv("ELECTION_REQUESTER_USER_ID");
  const factoryAddress =
    getOptionalEnv("FACTORY_ADDRESS") ?? loadLatestDeployment(networkName, "factory")?.data?.address ?? null;
  const artifactPath =
    getOptionalEnv("ELECTION_FACTORY_ARTIFACT_PATH") ??
    path.join(
      process.cwd(),
      "artifacts",
      "contracts",
      "ElectionFactoryV1.sol",
      "ElectionFactoryV1.json"
    );

  if (!factoryAddress) {
    throw new Error("Factory address was not found. Set FACTORY_ADDRESS or deploy the factory first.");
  }

  const requestPayload = readJson(inputPath);
  const electionPackage = buildElectionPackage(requestPayload);
  const outputDir = resolveFromCwd(outputDirArg);
  const writtenArtifacts = writeElectionPackageArtifacts(outputDir, electionPackage, requestPayload);

  const artifact = JSON.parse(fs.readFileSync(resolveFromCwd(artifactPath), "utf8"));
  const rpcUrl = getOptionalEnv("SEPOLIA_RPC_URL") ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 11155111);
  const wallet = new ethers.Wallet(getPrivateKey(), provider);
  const factory = new ethers.Contract(factoryAddress, artifact.abi, wallet);

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
    .find((parsed) => parsed && parsed.name === "ElectionCreated");

  if (!event) {
    throw new Error("ElectionCreated event not found in transaction receipt.");
  }

  const network = await provider.getNetwork();
  const record = {
    blockNumber: receipt.blockNumber,
    chainId: network.chainId.toString(),
    config: electionPackage.config,
    configPath: writtenArtifacts.configPath,
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
    eligibility: {
      proofs: electionPackage.eligibility.proofs,
      root: electionPackage.eligibility.root,
    },
    factoryAddress,
    manifest: electionPackage.manifest,
    network: networkName,
    requesterAddress,
    requesterUserId,
    summary: electionPackage.summary,
    txHash: receipt.hash,
  };

  const stored = saveDeployment(networkName, "election", record);
  const output = {
    ...record,
    latestPath: stored.latestPath,
    outputDir,
    snapshotPath: stored.snapshotPath,
  };

  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
