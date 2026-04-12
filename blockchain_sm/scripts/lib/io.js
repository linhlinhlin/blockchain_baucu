const fs = require("node:fs");
const path = require("node:path");

function resolveFromCwd(targetPath) {
  if (!targetPath) {
    throw new Error("A file path is required.");
  }

  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);
}

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function readJson(targetPath) {
  const resolvedPath = resolveFromCwd(targetPath);
  return JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

function writeJson(targetPath, value) {
  const resolvedPath = resolveFromCwd(targetPath);
  ensureDir(path.dirname(resolvedPath));
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
  return resolvedPath;
}

function fileExists(targetPath) {
  try {
    fs.accessSync(resolveFromCwd(targetPath), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ensureDir,
  fileExists,
  readJson,
  resolveFromCwd,
  writeJson,
};
