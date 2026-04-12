const hre = require("hardhat");
const { ethers, network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");

async function main() {
  const deployment = loadLatestDeployment(network.name, "election");
  const electionAddress = getOptionalEnv("ELECTION_ADDRESS") ?? deployment?.data?.electionAddress ?? null;

  if (!electionAddress) {
    throw new Error("Set ELECTION_ADDRESS or create an election first.");
  }

  const election = await ethers.getContractAt("ElectionV1", electionAddress);
  const tx = await election.finalizeElection();
  const receipt = await tx.wait();

  console.log("Finalize tx:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
