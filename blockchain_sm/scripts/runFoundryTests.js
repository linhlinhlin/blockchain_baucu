const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();
const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${projectRoot}:/src`,
    "ghcr.io/crytic/echidna/echidna",
    "sh",
    "-lc",
    "cd /src && forge test -vv",
  ],
  {
    stdio: "inherit",
    cwd: path.resolve(projectRoot),
  }
);

process.exitCode = result.status ?? 1;
