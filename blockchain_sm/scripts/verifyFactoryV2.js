const hre = require("hardhat");
const { network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");
const { verifyContractV2 } = require("./lib/etherscanV2");

async function main() {
  if (network.name === "hardhat" || network.name === "localhost") {
    throw new Error("Verification is only supported on public explorer-backed networks.");
  }

  const deployment = loadLatestDeployment(network.name, "factory");
  const contractAddress = getOptionalEnv("FACTORY_ADDRESS") ?? deployment?.data?.address ?? null;

  if (!contractAddress) {
    throw new Error(`No factory address found for network '${network.name}'.`);
  }

  const result = await verifyContractV2({
    networkName: network.name,
    contractAddress,
    dbgArtifactPath: "artifacts/contracts/ElectionFactoryV1.sol/ElectionFactoryV1.dbg.json",
    artifactJsonPath: "artifacts/contracts/ElectionFactoryV1.sol/ElectionFactoryV1.json",
    sourcePath: "contracts/ElectionFactoryV1.sol",
    contractName: "ElectionFactoryV1",
    constructorArguments: [],
  });

  if (result.mode === "already-verified") {
    console.log("Factory is already verified.");
    return;
  }

  console.log("Factory verification completed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
