const path = require("node:path");
const { ensureDir, fileExists, readJson, resolveFromCwd, writeJson } = require("../../lib/io");

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function deploymentDir(networkName) {
  return resolveFromCwd(path.join("deployments", "simple-flow", networkName));
}

function latestDeploymentPath(networkName) {
  return path.join(deploymentDir(networkName), "election-latest.json");
}

function saveDeployment(networkName, payload) {
  const targetDir = deploymentDir(networkName);
  ensureDir(targetDir);

  const timestamp = timestampForFile();
  const latestPath = latestDeploymentPath(networkName);
  const snapshotPath = path.join(targetDir, `election-${timestamp}.json`);

  writeJson(latestPath, payload);
  writeJson(snapshotPath, payload);

  return {
    latestPath,
    snapshotPath,
  };
}

function loadLatestDeployment(networkName) {
  const targetPath = latestDeploymentPath(networkName);
  if (!fileExists(targetPath)) {
    return null;
  }

  return {
    path: resolveFromCwd(targetPath),
    data: readJson(targetPath),
  };
}

module.exports = {
  deploymentDir,
  loadLatestDeployment,
  saveDeployment,
};
