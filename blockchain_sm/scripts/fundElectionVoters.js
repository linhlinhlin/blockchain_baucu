const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { ethers, network } = hre;
const { loadLatestDeployment } = require("./lib/deployments");
const { getOptionalEnv } = require("./lib/env");
const { writeJson } = require("./lib/io");

function deploymentsDir(networkName) {
  return path.resolve(process.cwd(), "deployments", networkName);
}

function loadElectionDeployment(networkName, identifier) {
  if (!identifier) {
    return loadLatestDeployment(networkName, "election")?.data ?? null;
  }

  const target = String(identifier).toLowerCase();
  const dir = deploymentsDir(networkName);
  if (!fs.existsSync(dir)) {
    return null;
  }

  const files = fs.readdirSync(dir).filter((name) => /^election-.*\.json$/i.test(name));
  for (const fileName of files) {
    const fullPath = path.join(dir, fileName);
    const record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    if (
      record.electionId === identifier ||
      String(record.electionAddress ?? "").toLowerCase() === target
    ) {
      return record;
    }
  }

  return null;
}

function readEligibleAddresses(deployment) {
  if (!deployment?.configPath) {
    throw new Error("Election deployment record does not contain configPath.");
  }

  const eligibilityPath = path.join(path.dirname(deployment.configPath), "eligibility-tree.json");
  if (!fs.existsSync(eligibilityPath)) {
    throw new Error(`Eligibility tree not found: ${eligibilityPath}`);
  }

  const eligibility = JSON.parse(fs.readFileSync(eligibilityPath, "utf8"));
  const addresses = (eligibility.values ?? []).map((entry) => entry?.[0]).filter(Boolean);
  if (addresses.length === 0) {
    throw new Error("Eligibility tree does not contain any voter addresses.");
  }

  return {
    addresses,
    eligibilityPath,
  };
}

async function main() {
  const identifier =
    getOptionalEnv("FUND_ELECTION_IDENTIFIER") ??
    getOptionalEnv("ELECTION_ADDRESS") ??
    process.argv[2] ??
    null;
  const targetEth =
    getOptionalEnv("FUND_TARGET_BALANCE_ETH") ?? process.argv[3] ?? "0.003";
  const targetWei = ethers.parseEther(targetEth);

  if (network.name !== "sepolia") {
    throw new Error("fundElectionVoters.js is intended for Sepolia only.");
  }

  const deployment = loadElectionDeployment(network.name, identifier);
  if (!deployment) {
    throw new Error(`Election deployment not found for '${identifier ?? "latest"}'.`);
  }

  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;
  const networkInfo = await provider.getNetwork();
  const deployerBalanceBefore = await provider.getBalance(deployer.address);
  const { addresses, eligibilityPath } = readEligibleAddresses(deployment);

  console.log("Funding election voters on:", network.name);
  console.log("Chain ID:", networkInfo.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Election ID:", deployment.electionId);
  console.log("Election address:", deployment.electionAddress);
  console.log("Target balance per voter (ETH):", targetEth);

  const transfers = [];
  for (const address of addresses) {
    const currentBalance = await provider.getBalance(address);
    if (currentBalance >= targetWei) {
      console.log(`Skipping ${address} (already funded: ${ethers.formatEther(currentBalance)} ETH)`);
      transfers.push({
        address,
        balanceBeforeEth: ethers.formatEther(currentBalance),
        topUpEth: "0.0",
        status: "skipped",
        txHash: null,
      });
      continue;
    }

    const topUpWei = targetWei - currentBalance;
    const tx = await deployer.sendTransaction({
      to: address,
      value: topUpWei,
    });
    await tx.wait();

    const newBalance = await provider.getBalance(address);
    console.log(
      `Funded ${address}: +${ethers.formatEther(topUpWei)} ETH -> ${ethers.formatEther(newBalance)} ETH`
    );
    transfers.push({
      address,
      balanceBeforeEth: ethers.formatEther(currentBalance),
      balanceAfterEth: ethers.formatEther(newBalance),
      topUpEth: ethers.formatEther(topUpWei),
      status: "funded",
      txHash: tx.hash,
    });
  }

  const deployerBalanceAfter = await provider.getBalance(deployer.address);
  const report = {
    createdAt: new Date().toISOString(),
    network: network.name,
    chainId: networkInfo.chainId.toString(),
    electionId: deployment.electionId,
    electionAddress: deployment.electionAddress,
    configPath: deployment.configPath,
    eligibilityPath,
    deployer: deployer.address,
    targetBalanceEth: targetEth,
    deployerBalanceBeforeEth: ethers.formatEther(deployerBalanceBefore),
    deployerBalanceAfterEth: ethers.formatEther(deployerBalanceAfter),
    transfers,
  };
  const reportPath = writeJson(
    path.join("tmp", "funding", `election-${deployment.electionId}-latest.json`),
    report
  );

  console.log("Funding report:", reportPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
