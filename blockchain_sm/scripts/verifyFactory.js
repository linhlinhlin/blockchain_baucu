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

  const deployment = loadLatestDeployment(network.name, "factory");
  const address = getOptionalEnv("FACTORY_ADDRESS") ?? deployment?.data?.address ?? null;

  if (!address) {
    throw new Error(
      `No factory address found. Set FACTORY_ADDRESS or deploy the factory first on '${network.name}'.`
    );
  }
  console.log("Verifying factory:", address);

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Factory verification completed.");
  } catch (error) {
    if (isAlreadyVerified(error.message)) {
      console.log("Factory is already verified.");
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
