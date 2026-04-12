const { ZeroAddress, getAddress, id } = require("ethers");

function isBytes32(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

function createCandidateId(displayName, index) {
  return id(`holihu:candidate:${index}:${displayName.trim().toLowerCase()}`);
}

function normalizeCandidate(candidate, index) {
  const candidateObject =
    typeof candidate === "string"
      ? {
          displayName: candidate,
        }
      : candidate ?? {};

  const displayName = String(
    candidateObject.displayName ?? candidateObject.name ?? candidateObject.candidateName ?? ""
  ).trim();
  if (!displayName) {
    throw new Error(`Candidate ${index + 1} display name is required.`);
  }

  const candidateId = isBytes32(candidateObject.candidateId)
    ? candidateObject.candidateId.trim()
    : createCandidateId(displayName, index);

  const rawWalletAddress =
    candidateObject.walletAddress ?? candidateObject.address ?? candidateObject.candidateWalletAddress;
  const walletAddress =
    rawWalletAddress === undefined || rawWalletAddress === null || String(rawWalletAddress).trim() === ""
      ? null
      : getAddress(String(rawWalletAddress).trim());

  return {
    candidateId,
    displayName,
    walletAddress,
  };
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    throw new Error("Candidates must be an array.");
  }

  const normalized = candidates
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .filter(Boolean);

  if (normalized.length < 2) {
    throw new Error("At least two candidates are required.");
  }

  const seenIds = new Set();
  for (const candidate of normalized) {
    const normalizedId = candidate.candidateId.toLowerCase();
    if (seenIds.has(normalizedId)) {
      throw new Error(`Duplicate candidateId detected: ${candidate.candidateId}`);
    }

    seenIds.add(normalizedId);
  }

  return normalized;
}

function toContractCandidates(candidates) {
  return normalizeCandidates(candidates).map((candidate) => [
    candidate.candidateId,
    candidate.displayName,
    candidate.walletAddress ?? ZeroAddress,
  ]);
}

module.exports = {
  ZeroAddress,
  createCandidateId,
  isBytes32,
  normalizeCandidate,
  normalizeCandidates,
  toContractCandidates,
};
