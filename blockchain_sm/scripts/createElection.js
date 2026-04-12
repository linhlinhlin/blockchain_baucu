const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { ethers, network } = hre;
const { loadLatestDeployment, saveDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");

async function main() {
  const latestFactoryDeployment = loadLatestDeployment(network.name, "factory");
  const factoryAddress =
    getOptionalEnv("FACTORY_ADDRESS") ?? latestFactoryDeployment?.data?.address ?? null;
  const configPath = getOptionalEnv("ELECTION_CONFIG_PATH") ?? process.argv[2];

  if (!factoryAddress) {
    throw new Error(
      `Set FACTORY_ADDRESS or deploy the factory first so deployments/${network.name}/factory-latest.json exists.`
    );
  }
  if (!configPath) {
    throw new Error(
      "Set ELECTION_CONFIG_PATH or pass the config path as the first script argument."
    );
  }

  const rawConfig = fs.readFileSync(path.resolve(process.cwd(), configPath), "utf8");
  const config = JSON.parse(rawConfig);

  const factory = await ethers.getContractAt("ElectionFactoryV1", factoryAddress);
  const tx = await factory.createElection(config);
  const receipt = await tx.wait();
  const provider = factory.runner.provider;
  const networkInfo = await provider.getNetwork();

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
    throw new Error("ElectionCreated event not found in receipt.");
  }

  console.log("Election ID:", event.args.electionId.toString());
  console.log("Election address:", event.args.electionAddress);

  const constructorArguments = [
    config.admin,
    config.electionURI,
    config.electionMetadataHash,
    config.eligibleVotersRoot,
    config.commitStart,
    config.commitEnd,
    config.revealEnd,
    config.candidateIds,
  ];
  const record = {
    blockNumber: receipt.blockNumber,
    chainId: networkInfo.chainId.toString(),
    config,
    configPath: path.resolve(process.cwd(), configPath),
    constructorArguments,
    createdAt: new Date().toISOString(),
    electionAddress: event.args.electionAddress,
    electionId: event.args.electionId.toString(),
    factoryAddress,
    network: network.name,
    txHash: receipt.hash,
  };
  const stored = saveDeployment(network.name, "election", record);
  console.log("Deployment record:", stored.latestPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
