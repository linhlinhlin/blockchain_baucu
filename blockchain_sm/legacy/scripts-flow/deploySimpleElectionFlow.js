const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { ethers, network } = hre;
const { saveDeployment } = require("./lib/simpleFlowDeployments");
const { getOptionalEnv } = require("../lib/env");
const { normalizeCandidates, toContractCandidates } = require("../../shared/simpleFlowCandidates");

function readConfig() {
  const configPath = getOptionalEnv("FLOW_ELECTION_CONFIG_PATH") ?? process.argv[2];
  if (!configPath) {
    throw new Error(
      "Set FLOW_ELECTION_CONFIG_PATH or pass the config path as the first script argument."
    );
  }

  const resolvedPath = path.resolve(process.cwd(), configPath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  return {
    configPath: resolvedPath,
    config: JSON.parse(raw),
  };
}

async function main() {
  const { config, configPath } = readConfig();
  const candidates = normalizeCandidates(config.candidates);
  const Factory = await ethers.getContractFactory("SimpleElectionFlow");
  const contract = await Factory.deploy(
    config.admin,
    config.title,
    config.description,
    config.startAt,
    config.endAt,
    toContractCandidates(candidates)
  );

  const deployment = await contract.deploymentTransaction()?.wait();
  const address = await contract.getAddress();
  const provider = contract.runner.provider;
  const networkInfo = await provider.getNetwork();

  const record = {
    address,
    admin: config.admin,
    title: config.title,
    description: config.description,
    startAt: config.startAt,
    endAt: config.endAt,
    candidates,
    contractVersion: "2",
    chainId: networkInfo.chainId.toString(),
    network: network.name,
    blockNumber: deployment?.blockNumber ?? null,
    txHash: deployment?.hash ?? null,
    configPath,
    constructorArguments: [
      config.admin,
      config.title,
      config.description,
      config.startAt,
      config.endAt,
      toContractCandidates(candidates),
    ],
    deployedAt: new Date().toISOString(),
  };

  const stored = saveDeployment(network.name, record);
  console.log("SimpleElectionFlow deployed at:", address);
  console.log("Deployment record:", stored.latestPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
