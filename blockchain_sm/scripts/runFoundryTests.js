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
} else {
  console.warn(
    "[runFoundryTests] Bo qua Foundry tests vi Docker daemon va forge deu khong san sang tren may nay."
  );
  process.exitCode = 0;
  process.exit();
}

process.exitCode = result.status ?? 1;
