const path = require("node:path");
const fs = require("node:fs");
const { Wallet } = require("ethers");

const FLOW_ROOT = path.resolve(__dirname, "..", "..");
const CONTRACTS_ROOT = path.resolve(FLOW_ROOT, "..", "..");
const deployerPrivateKey =
  process.env.FLOW_DEPLOYER_PRIVATE_KEY ??
  (process.env.SEPOLIA_PRIVATE_KEYS
    ? process.env.SEPOLIA_PRIVATE_KEYS.split(",").map((value) => value.trim()).filter(Boolean)[0]
    : "");
const deployerAddress = deployerPrivateKey ? new Wallet(deployerPrivateKey).address : null;
const rpcUrls = (
  process.env.RPC_URLS ??
  process.env.RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

module.exports = {
  apiPort: Number.parseInt(process.env.API_PORT ?? "3201", 10),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3200",
  authMessageUri: process.env.AUTH_MESSAGE_URI ?? "http://localhost:3200",
  chainId: Number.parseInt(process.env.CHAIN_ID ?? "11155111", 10),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/holihu_flow",
  allowSelfServiceElectionCreation:
    (process.env.FLOW_ALLOW_SELF_SERVICE_ELECTION_CREATION ?? "true").toLowerCase() !== "false",
  deployerAddress,
  deployerPrivateKey,
  electionArtifactPath:
    process.env.ELECTION_ARTIFACT_PATH ??
    path.join(CONTRACTS_ROOT, "artifacts", "contracts", "ElectionV1.sol", "ElectionV1.json"),
  factoryArtifactPath:
    process.env.FACTORY_ARTIFACT_PATH ??
    path.join(CONTRACTS_ROOT, "artifacts", "contracts", "ElectionFactoryV1.sol", "ElectionFactoryV1.json"),
  deploymentsDir:
    process.env.FLOW_DEPLOYMENTS_DIR ?? path.join(CONTRACTS_ROOT, "deployments", "sepolia"),
  explorerBaseUrl: process.env.EXPLORER_BASE_URL ?? "https://sepolia.etherscan.io",
  factoryAddress:
    process.env.FACTORY_ADDRESS ??
    (() => {
      const factoryDeploymentPath = path.join(
        process.env.FLOW_DEPLOYMENTS_DIR ?? path.join(CONTRACTS_ROOT, "deployments", "sepolia"),
        "factory-latest.json"
      );
      if (!fs.existsSync(factoryDeploymentPath)) {
        return null;
      }

      try {
        return JSON.parse(fs.readFileSync(factoryDeploymentPath, "utf8")).address ?? null;
      } catch {
        return null;
      }
    })(),
  migrationsPath:
    process.env.FLOW_MIGRATIONS_PATH ?? path.resolve(__dirname, "..", "..", "db", "init.sql"),
  tempDir:
    process.env.FLOW_TMP_DIR ?? path.resolve(__dirname, "..", "..", "tmp", "v1-elections"),
  rpcUrl: rpcUrls[0],
  rpcUrls,
  sessionTtlHours: Number.parseInt(process.env.SESSION_TTL_HOURS ?? "24", 10),
};
