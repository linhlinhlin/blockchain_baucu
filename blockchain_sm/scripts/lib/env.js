function getOptionalEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

module.exports = {
  getOptionalEnv,
};
