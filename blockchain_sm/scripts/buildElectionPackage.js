const path = require("node:path");
const { buildElectionPackage } = require("./lib/electionPackage");
const fs = require("node:fs");
const { ensureDir, readJson, resolveFromCwd, writeJson } = require("./lib/io");

function main() {
  const inputPath = process.argv[2];
  const outputDirArg = process.argv[3] ?? path.join("tmp-election-package");

  if (!inputPath) {
    throw new Error(
      "Usage: node scripts/buildElectionPackage.js <election-package.json> [output-dir]"
    );
  }

  const input = readJson(inputPath);
  const outputDir = resolveFromCwd(outputDirArg);
  const electionPackage = buildElectionPackage(input);

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifestPrettyPath = path.join(outputDir, "manifest.pretty.json");
  const eligibilityPath = path.join(outputDir, "eligibility-tree.json");
  const configPath = path.join(outputDir, "election-config.json");
  const summaryPath = path.join(outputDir, "summary.json");

  ensureDir(outputDir);
  fs.writeFileSync(manifestPath, `${electionPackage.manifestCanonicalJson}\n`);
  writeJson(manifestPrettyPath, electionPackage.manifest);
  writeJson(eligibilityPath, electionPackage.eligibility);
  writeJson(configPath, electionPackage.config);
  writeJson(summaryPath, electionPackage.summary);

  console.log("Election package generated:");
  console.log("Manifest:", manifestPath);
  console.log("Manifest (pretty):", manifestPrettyPath);
  console.log("Eligibility tree:", eligibilityPath);
  console.log("Election config:", configPath);
  console.log("Summary:", summaryPath);
  console.log("Election metadata hash:", electionPackage.electionMetadataHash);
  console.log("Eligibility root:", electionPackage.eligibility.root);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
