const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");
const { Wallet } = require("ethers");
const { execSync } = require("node:child_process");
const { getOptionalEnv } = require("../lib/env");
const { ensureDir, writeJson } = require("../lib/io");
const { normalizeCandidates } = require("../../shared/simpleFlowCandidates");

dotenv.config();

function getAdminAddress() {
  const privateKey = (getOptionalEnv("SEPOLIA_PRIVATE_KEYS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  if (!privateKey) {
    throw new Error("SEPOLIA_PRIVATE_KEYS must contain at least one private key.");
  }

  return new Wallet(privateKey).address;
}

function buildConfigs() {
  const admin = getAdminAddress();
  const now = Math.floor(Date.now() / 1000);
  const startAt = now - 120;
  const endAt = startAt + 86400;

  return [
    {
      admin,
      title: "Class President Demo",
      description: "Simple one-wallet-one-vote election for frontend flow testing.",
      startAt,
      endAt,
      candidates: normalizeCandidates([
        { displayName: "Tran Minh" },
        { displayName: "Le Anh" },
        { displayName: "Pham Nhi" },
      ]),
    },
    {
      admin,
      title: "Class Secretary Demo",
      description: "Second election to test multi-election selection in the flow app.",
      startAt,
      endAt,
      candidates: normalizeCandidates([
        { displayName: "Nguyen Thu" },
        { displayName: "Hoang Nam" },
      ]),
    },
  ];
}

function deployConfig(configPath) {
  const command =
    process.platform === "win32"
      ? "cmd /c npm run deploy:flow:election -- --network sepolia"
      : "npm run deploy:flow:election -- --network sepolia";
  execSync(command, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FLOW_ELECTION_CONFIG_PATH: configPath,
    },
    stdio: "inherit",
  });
}

function main() {
  const outputDir = path.resolve(process.cwd(), "tmp", "simple-flow-seed");
  ensureDir(outputDir);

  const configs = buildConfigs();
  configs.forEach((config, index) => {
    const configPath = path.join(outputDir, `election-${index + 1}.json`);
    writeJson(configPath, config);
    deployConfig(configPath);
  });

  fs.writeFileSync(
    path.join(outputDir, "README.txt"),
    "Seeded simple-flow election configs used for Sepolia deployments.\n"
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
