const hre = require("hardhat");
const { network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");
const { readJson } = require("./lib/io");
const { verifyContractV2 } = require("./lib/etherscanV2");

async function main() {
  if (network.name === "hardhat" || network.name === "localhost") {
    throw new Error("Verification is only supported on public explorer-backed networks.");
  }

  const explicitDeploymentPath = getOptionalEnv("ELECTION_DEPLOYMENT_PATH");
  const deployment = explicitDeploymentPath
    ? { path: explicitDeploymentPath, data: readJson(explicitDeploymentPath) }
    : loadLatestDeployment(network.name, "election");
  const contractAddress =
    (explicitDeploymentPath ? null : getOptionalEnv("ELECTION_ADDRESS")) ??
    deployment?.data?.electionAddress ??
    null;
  const constructorArguments = deployment?.data?.constructorArguments ?? null;

  if (!contractAddress || !Array.isArray(constructorArguments)) {
    throw new Error(`No usable election deployment record found for network '${network.name}'.`);
  }

  const result = await verifyContractV2({
    networkName: network.name,
    contractAddress,
    dbgArtifactPath: "artifacts/contracts/ElectionV1.sol/ElectionV1.dbg.json",
    artifactJsonPath: "artifacts/contracts/ElectionV1.sol/ElectionV1.json",
    sourcePath: "contracts/ElectionV1.sol",
    contractName: "ElectionV1",
    constructorArguments,
  });

  if (result.mode === "already-verified") {
    console.log("Election is already verified.");
    return;
  }

  console.log("Election verification completed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
