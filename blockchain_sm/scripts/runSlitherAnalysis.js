const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = process.cwd();
const command =
  "cd /src && slither contracts/ElectionFactoryV1.sol " +
  "--solc-remaps '@openzeppelin/contracts-v5=node_modules/@openzeppelin/contracts-v5 @openzeppelin=node_modules/@openzeppelin' " +
  "--exclude timestamp,pragma,solc-version,dead-code,assembly";

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
    command,
  ],
  {
    stdio: "inherit",
    cwd: path.resolve(projectRoot),
  }
);

process.exitCode = result.status ?? 1;
