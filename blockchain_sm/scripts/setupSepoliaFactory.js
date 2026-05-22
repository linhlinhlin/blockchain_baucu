const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { saveDeployment } = require("./lib/deployments");

function loadEnvFiles() {
  const rootEnvPath = path.resolve(process.cwd(), "..", ".env");
  const localEnvPath = path.resolve(process.cwd(), ".env");

  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
  }

  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
  }
}

function getOptionalEnv(name) {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function getFirstPrivateKey() {
  return (getOptionalEnv("SEPOLIA_PRIVATE_KEYS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) ?? null;
}

function artifactPath() {
  return path.resolve(
    process.cwd(),
    "artifacts",
    "contracts",
    "ElectionFactoryV1.sol",
    "ElectionFactoryV1.json"
  );
}

function readFactoryArtifact() {
  const targetPath = artifactPath();
  if (!fs.existsSync(targetPath)) {
    throw new Error("ElectionFactoryV1 artifact is missing. Run `npm run compile` first.");
  }

  return JSON.parse(fs.readFileSync(targetPath, "utf8"));
}

async function requireSepolia(provider) {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 11155111) {
    throw new Error(`Connected RPC is chainId ${chainId}, expected Sepolia (11155111).`);
  }
  return network;
}

async function validateFactoryAddress(provider, address) {
  if (!ethers.isAddress(address)) {
    throw new Error("FACTORY_ADDRESS is not a valid Ethereum address.");
  }

  const checksumAddress = ethers.getAddress(address);
  const code = await provider.getCode(checksumAddress);
  if (!code || code === "0x") {
    throw new Error("FACTORY_ADDRESS has no contract code on Sepolia.");
  }

  return checksumAddress;
}

function saveFactoryRecord(record) {
  const stored = saveDeployment("sepolia", "factory", record);
  console.log("Factory ready:", record.address);
  console.log("Deployment record:", stored.latestPath);
}

async function main() {
  loadEnvFiles();

  const rpcUrl = getOptionalEnv("SEPOLIA_RPC_URL") ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await requireSepolia(provider);
  const explicitFactoryAddress = getOptionalEnv("FACTORY_ADDRESS");

  if (explicitFactoryAddress) {
    const factoryAddress = await validateFactoryAddress(provider, explicitFactoryAddress);
    saveFactoryRecord({
      address: factoryAddress,
      blockNumber: null,
      chainId: network.chainId.toString(),
      deployer: null,
      network: "sepolia",
      source: "FACTORY_ADDRESS",
      timestamp: new Date().toISOString(),
      txHash: null,
    });
    return;
  }

  const privateKey = getFirstPrivateKey();
  if (!privateKey) {
    throw new Error(
      "Factory is not ready. Set FACTORY_ADDRESS to an existing Sepolia ElectionFactoryV1 contract, " +
        "or set SEPOLIA_PRIVATE_KEYS to a funded Sepolia deployer key and run this command again."
    );
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  if (balance === 0n) {
    throw new Error("Sepolia deployer balance is zero. Fund the deployer with Sepolia ETH first.");
  }

  const artifact = readFactoryArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying ElectionFactoryV1 to Sepolia with deployer:", wallet.address);
  const contract = await factory.deploy();
  const receipt = await contract.deploymentTransaction()?.wait();
  const factoryAddress = await contract.getAddress();

  saveFactoryRecord({
    address: factoryAddress,
    blockNumber: receipt?.blockNumber ?? null,
    chainId: network.chainId.toString(),
    deployer: wallet.address,
    network: "sepolia",
    source: "deployed",
    timestamp: new Date().toISOString(),
    txHash: receipt?.hash ?? null,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
