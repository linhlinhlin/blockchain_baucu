const path = require("node:path");
const { ensureDir, fileExists, readJson, resolveFromCwd, writeJson } = require("./io");

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function networkDeploymentDir(networkName) {
  return resolveFromCwd(path.join("deployments", networkName));
}

function latestDeploymentPath(networkName, kind) {
  return path.join(networkDeploymentDir(networkName), `${kind}-latest.json`);
}

function saveDeployment(networkName, kind, payload) {
  const targetDir = networkDeploymentDir(networkName);
  ensureDir(targetDir);

  const timestamp = timestampForFile();
  const latestPath = latestDeploymentPath(networkName, kind);
  const snapshotPath = path.join(targetDir, `${kind}-${timestamp}.json`);

  writeJson(latestPath, payload);
  writeJson(snapshotPath, payload);

  return {
    latestPath,
    snapshotPath,
  };
}

function loadLatestDeployment(networkName, kind) {
  const targetPath = latestDeploymentPath(networkName, kind);
  if (!fileExists(targetPath)) {
    return null;
  }

  return {
    path: resolveFromCwd(targetPath),
    data: readJson(targetPath),
  };
}

module.exports = {
  loadLatestDeployment,
  saveDeployment,
};
