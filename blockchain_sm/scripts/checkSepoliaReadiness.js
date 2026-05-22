const { ethers } = require("ethers");
const dotenv = require("dotenv");
const path = require("node:path");
const { fileExists, resolveFromCwd } = require("./lib/io");

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config({ override: true });

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const privateKeys = (process.env.SEPOLIA_PRIVATE_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (privateKeys.length === 0) {
    throw new Error("SEPOLIA_PRIVATE_KEYS is missing. Add at least one funded Sepolia private key.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 11155111) {
    throw new Error(`Connected RPC is chainId ${chainId}, expected Sepolia (11155111).`);
  }

  const latestBlock = await provider.getBlock("latest");
  const deployerWallet = new ethers.Wallet(privateKeys[0], provider);
  const balance = await provider.getBalance(deployerWallet.address);
  const balanceEther = ethers.formatEther(balance);

  console.log("Sepolia RPC check: OK");
  console.log("Chain ID:", chainId);
  console.log("Latest block:", latestBlock.number);
  console.log("Deployer:", deployerWallet.address);
  console.log("Balance (ETH):", balanceEther);
  console.log(
    "Etherscan API key:",
    process.env.ETHERSCAN_API_KEY ? "configured" : "missing (verify scripts will not work)"
  );

  if (process.env.ELECTION_CONFIG_PATH) {
    const configPath = resolveFromCwd(process.env.ELECTION_CONFIG_PATH);
    if (!fileExists(configPath)) {
      throw new Error(`ELECTION_CONFIG_PATH does not exist: ${configPath}`);
    }
    console.log("Election config:", configPath);
  }

  if (balance === 0n) {
    console.log("Warning: deployer balance is zero. Fund this account with Sepolia ETH before deployment.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
