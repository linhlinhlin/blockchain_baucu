const fs = require("node:fs");
const path = require("node:path");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? path.resolve(process.cwd(), "eligibility-tree.json");

  if (!inputPath) {
    throw new Error("Usage: node scripts/buildEligibilityTree.js <addresses.json> [output.json]");
  }

  const raw = fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf8");
  const addresses = JSON.parse(raw);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error("Input JSON must be a non-empty array of addresses.");
  }

  const values = addresses.map((address) => [address]);
  const tree = StandardMerkleTree.of(values, ["address"]);

  const proofs = {};
  for (const [index, value] of tree.entries()) {
    proofs[value[0]] = tree.getProof(index);
  }

  const output = {
    root: tree.root,
    values,
    proofs,
    tree: tree.dump(),
  };

  fs.writeFileSync(path.resolve(process.cwd(), outputPath), JSON.stringify(output, null, 2));
  console.log(`Eligibility tree written to ${outputPath}`);
  console.log(`Merkle root: ${tree.root}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
