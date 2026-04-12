const { Wallet } = require("ethers");
const dotenv = require("dotenv");
const { getOptionalEnv } = require("./lib/env");
const { writeJson } = require("./lib/io");

dotenv.config();

function parseInteger(value, fallback) {
  if (value == null) {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error(
      "Usage: node scripts/generateQuickElectionInput.js <output.json> [commitSeconds] [revealSeconds] [startOffsetSeconds]"
    );
  }

  const privateKey = (getOptionalEnv("SEPOLIA_PRIVATE_KEYS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  if (!privateKey) {
    throw new Error("SEPOLIA_PRIVATE_KEYS must contain at least one private key.");
  }

  const admin = new Wallet(privateKey).address;
  const commitSeconds = parseInteger(process.argv[3], 120);
  const revealSeconds = parseInteger(process.argv[4], 120);
  const startOffsetSeconds = parseInteger(process.argv[5], -30);
  const now = Math.floor(Date.now() / 1000);
  const commitStart = now + startOffsetSeconds;
  const commitEnd = commitStart + commitSeconds;
  const revealEnd = commitEnd + revealSeconds;

  if (!(commitStart < commitEnd && commitEnd < revealEnd)) {
    throw new Error("Generated schedule is invalid.");
  }

  const payload = {
    admin,
    embedManifestAsDataUri: true,
    schedule: {
      commitStart,
      commitEnd,
      revealEnd,
    },
    candidates: [
      {
        id: "candidate:SV001",
        name: "Nguyen Van A",
      },
      {
        id: "candidate:SV002",
        name: "Tran Thi B",
      },
    ],
    voters: [admin],
    manifest: {
      electionKey: `holihu-sepolia-smoke-${now}`,
      title: `HoLiHu Sepolia Smoke Election ${now}`,
      organization: "HoLiHu",
      description: "Short-lived Sepolia smoke test election generated automatically.",
    },
  };

  const writtenPath = writeJson(outputPath, payload);
  console.log("Quick election input written to:", writtenPath);
  console.log(
    JSON.stringify(
      {
        admin,
        commitStart,
        commitEnd,
        revealEnd,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
