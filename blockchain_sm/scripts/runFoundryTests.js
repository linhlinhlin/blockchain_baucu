const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();

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

function runDockerForge() {
  return runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${projectRoot}:/src`,
    "ghcr.io/crytic/echidna/echidna",
    "sh",
    "-lc",
    "cd /src && forge test -vv",
  ]);
}

function runNativeForge() {
  return runCommand("forge", ["test", "-vv"]);
}

let result;
if (commandExists("docker", ["info"])) {
  result = runDockerForge();
} else if (commandExists("forge")) {
  console.warn("[runFoundryTests] Docker khong san sang, chuyen sang forge native.");
  result = runNativeForge();
} else if (process.env.SKIP_FOUNDRY === "1") {
  // S17 (spec 004): chi bo qua khi opt-out TUONG MINH, in canh bao to.
  console.warn(
    "\n[runFoundryTests] !!! BO QUA Foundry tests (SKIP_FOUNDRY=1). " +
      "Khong co phan tich Foundry nao chay. !!!\n"
  );
  process.exitCode = 0;
  process.exit();
} else {
  // S17: KHONG silent-pass. Thieu tool => FAIL (non-zero) de `validate`/CI bat duoc.
  console.error(
    "\n[runFoundryTests] LOI: Docker daemon va forge deu khong san sang. " +
      "Foundry tests KHONG chay. Cai Foundry (foundryup) hoac Docker, " +
      "hoac dat SKIP_FOUNDRY=1 de bo qua co chu y.\n"
  );
  process.exitCode = 1;
  process.exit(1);
}

process.exitCode = result.status ?? 1;
