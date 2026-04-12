const fs = require("node:fs");
const path = require("node:path");
const { Wallet, isAddress, getAddress } = require("ethers");
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

function readAddresses(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath);
  const raw = fs.readFileSync(resolved, "utf8").trim();
  if (!raw) {
    throw new Error("Address list file is empty.");
  }

  let values;
  if (raw.startsWith("[")) {
    values = JSON.parse(raw);
  } else {
    values = raw
      .split(/[\r\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Address list must contain at least one address.");
  }

  const normalized = [];
  const seen = new Set();
  values.forEach((value, index) => {
    if (!isAddress(value)) {
      throw new Error(`Invalid address at index ${index}: ${value}`);
    }

    const address = getAddress(value);
    if (seen.has(address)) {
      return;
    }

    seen.add(address);
    normalized.push(address);
  });

  return normalized;
}

function main() {
  const addressesPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!addressesPath || !outputPath) {
    throw new Error(
      "Usage: node scripts/generateMetaMaskElectionInput.js <addresses-file> <output.json> [commitHours] [revealHours] [startOffsetMinutes]"
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
  const voters = readAddresses(addressesPath);
  const commitHours = parseInteger(process.argv[4], 24);
  const revealHours = parseInteger(process.argv[5], 24);
  const startOffsetMinutes = parseInteger(process.argv[6], 10);
  const now = Math.floor(Date.now() / 1000);
  const commitStart = now + startOffsetMinutes * 60;
  const commitEnd = commitStart + commitHours * 3600;
  const revealEnd = commitEnd + revealHours * 3600;

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
    voters,
    manifest: {
      electionKey: `holihu-sepolia-metamask-${now}`,
      title: `HoLiHu MetaMask Test Election ${now}`,
      organization: "HoLiHu",
      description: "Sepolia test election generated from a provided MetaMask address list.",
    },
  };

  const writtenPath = writeJson(outputPath, payload);
  console.log("MetaMask election input written to:", writtenPath);
  console.log(
    JSON.stringify(
      {
        admin,
        voterCount: voters.length,
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
