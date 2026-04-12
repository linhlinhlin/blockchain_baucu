const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { ethers, network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");
const { resolveFromCwd, writeJson } = require("./lib/io");

async function main() {
  const deployment = loadLatestDeployment(network.name, "election");
  const electionAddress = getOptionalEnv("ELECTION_ADDRESS") ?? deployment?.data?.electionAddress ?? null;
  const configPath = getOptionalEnv("ELECTION_CONFIG_PATH") ?? deployment?.data?.configPath ?? null;
  const outputPath = getOptionalEnv("VOTE_PACKAGE_PATH") ?? path.join("tmp", "vote-package.json");
  const candidateIndex = Number.parseInt(getOptionalEnv("CANDIDATE_INDEX") ?? "0", 10);

  if (!electionAddress) {
    throw new Error("Set ELECTION_ADDRESS or create an election first.");
  }
  if (!configPath) {
    throw new Error("Set ELECTION_CONFIG_PATH or create an election first.");
  }
  if (!Number.isInteger(candidateIndex) || candidateIndex < 0) {
    throw new Error("candidateIndex must be a non-negative integer.");
  }

  const config = JSON.parse(fs.readFileSync(resolveFromCwd(configPath), "utf8"));
  if (!Array.isArray(config.candidateIds) || candidateIndex >= config.candidateIds.length) {
    throw new Error("candidateIndex is out of bounds for config.candidateIds.");
  }

  const packageDir = path.dirname(resolveFromCwd(configPath));
  const eligibilityPath =
    getOptionalEnv("ELIGIBILITY_TREE_PATH") ?? path.join(packageDir, "eligibility-tree.json");
  const eligibility = JSON.parse(fs.readFileSync(resolveFromCwd(eligibilityPath), "utf8"));

  const [signer] = await ethers.getSigners();
  const voter = signer.address;
  const proof = eligibility.proofs?.[voter];
  if (!Array.isArray(proof)) {
    throw new Error(`No Merkle proof found for voter ${voter} in ${eligibilityPath}.`);
  }

  const candidateId = config.candidateIds[candidateIndex];
  const election = await ethers.getContractAt("ElectionV1", electionAddress);
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const commitment = await election.computeCommitment(voter, candidateId, salt);
  const provider = signer.provider;
  const networkInfo = await provider.getNetwork();

  const votePackage = {
    candidateId,
    candidateIndex,
    chainId: networkInfo.chainId.toString(),
    commitment,
    createdAt: new Date().toISOString(),
    electionAddress,
    proof,
    salt,
    voter,
  };
  const writtenPath = writeJson(outputPath, votePackage);

  console.log("Vote package written to:", writtenPath);
  console.log(JSON.stringify(votePackage, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
