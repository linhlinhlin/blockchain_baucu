const hre = require("hardhat");
const { network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");

function isAlreadyVerified(errorMessage) {
  return /already verified|source code already verified/i.test(errorMessage);
}

async function main() {
  if (network.name === "hardhat" || network.name === "localhost") {
    throw new Error("Verification is only supported on public explorer-backed networks.");
  }

  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY is missing. Verification cannot proceed.");
  }

  const deployment = loadLatestDeployment(network.name, "election");
  const electionAddress =
    getOptionalEnv("ELECTION_ADDRESS") ?? deployment?.data?.electionAddress ?? null;
  const constructorArguments = deployment?.data?.constructorArguments ?? null;

  if (!electionAddress || !constructorArguments) {
    throw new Error(
      `No usable election deployment record found for network '${network.name}'. Create the election first.`
    );
  }

  if (!Array.isArray(constructorArguments)) {
    throw new Error("Latest election deployment record is incomplete. Recreate the election deployment record.");
  }

  console.log("Verifying election:", electionAddress);

  try {
    await hre.run("verify:verify", {
      address: electionAddress,
      constructorArguments,
    });
    console.log("Election verification completed.");
  } catch (error) {
    if (isAlreadyVerified(error.message)) {
      console.log("Election is already verified.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
