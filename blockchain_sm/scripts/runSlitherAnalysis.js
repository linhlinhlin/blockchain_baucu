const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();
const slitherCommand =
  "cd /src && slither contracts/ElectionFactoryV1.sol " +
  "--foundry-compile-all " +
  "--solc-remaps '@openzeppelin/contracts-v5=node_modules/@openzeppelin/contracts-v5 @openzeppelin=node_modules/@openzeppelin' " +
  "--exclude timestamp,pragma,solc-version,dead-code,assembly";

function runCommand(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    cwd: path.resolve(projectRoot),
  });
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    cwd: path.resolve(projectRoot),
    shell: process.platform === "win32",
  });

  return result.status === 0;
}

function runDockerSlither() {
  return runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${projectRoot}:/src`,
    "ghcr.io/crytic/echidna/echidna",
    "sh",
    "-lc",
    slitherCommand,
  ]);
}

function runNativeSlither() {
  return runCommand("slither", [
    "contracts/ElectionFactoryV1.sol",
    "--foundry-compile-all",
    "--solc-remaps",
    "@openzeppelin/contracts-v5=node_modules/@openzeppelin/contracts-v5 @openzeppelin=node_modules/@openzeppelin",
    "--exclude",
    "timestamp,pragma,solc-version,dead-code,assembly",
  ]);
}

let result;
if (commandExists("docker", ["info"])) {
  result = runDockerSlither();
} else if (commandExists("slither")) {
  console.warn("[runSlitherAnalysis] Docker khong san sang, chuyen sang slither native.");
  result = runNativeSlither();
} else if (process.env.SKIP_SLITHER === "1") {
  // S17 (spec 004): chi bo qua khi opt-out TUONG MINH, in canh bao to.
  console.warn(
    "\n[runSlitherAnalysis] !!! BO QUA Slither (SKIP_SLITHER=1). " +
      "Khong co phan tich tinh nao chay. !!!\n"
  );
  process.exitCode = 0;
  process.exit();
} else {
  // S17: KHONG silent-pass. Thieu tool => FAIL (non-zero).
  console.error(
    "\n[runSlitherAnalysis] LOI: Docker daemon va slither deu khong san sang. " +
      "Slither KHONG chay. Cai Slither hoac Docker, " +
      "hoac dat SKIP_SLITHER=1 de bo qua co chu y.\n"
  );
  process.exitCode = 1;
  process.exit(1);
}

process.exitCode = result.status ?? 1;
