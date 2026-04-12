const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { ethers } = hre;
const { getOptionalEnv } = require("./lib/env");

async function main() {
  const votePackagePath = getOptionalEnv("VOTE_PACKAGE_PATH") ?? process.argv[2] ?? path.join("tmp", "vote-package.json");
  const votePackage = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), votePackagePath), "utf8"));
  const election = await ethers.getContractAt("ElectionV1", votePackage.electionAddress);
  const tx = await election.commitVote(votePackage.commitment, votePackage.proof);
  const receipt = await tx.wait();

  console.log("Commit tx:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
