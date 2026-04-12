const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { ethers } = require("ethers");

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeAddress(value, label) {
  const address = requireString(value, label);
  if (!ethers.isAddress(address)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }

  return ethers.getAddress(address);
}

function normalizeAddressArray(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${label} must be a non-empty array.`);
  }

  const normalized = [];
  const seen = new Set();

  values.forEach((value, index) => {
    const address = normalizeAddress(value, `${label}[${index}]`);
    if (seen.has(address)) {
      throw new Error(`${label}[${index}] duplicates a previous voter address.`);
    }

    seen.add(address);
    normalized.push(address);
  });

  return normalized;
}

function parseUnixSeconds(value, label) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (parsed > 0) {
      return parsed;
    }
  }

  if (typeof value === "string") {
    const parsedMs = Date.parse(value);
    if (!Number.isNaN(parsedMs)) {
      return Math.floor(parsedMs / 1000);
    }
  }

  throw new Error(`${label} must be a positive Unix timestamp or ISO-8601 datetime string.`);
}

function normalizeCandidates(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("candidates must be a non-empty array.");
  }

  const seenSourceIds = new Set();
  const seenCandidateIds = new Set();

  return values.map((value, index) => {
    const candidate = typeof value === "string" ? { id: value } : requireObject(value, `candidates[${index}]`);
    const sourceId = requireString(candidate.id, `candidates[${index}].id`);

    if (seenSourceIds.has(sourceId)) {
      throw new Error(`candidates[${index}].id duplicates a previous candidate id.`);
    }

    const candidateId = ethers.id(sourceId);
    if (seenCandidateIds.has(candidateId)) {
      throw new Error(`candidates[${index}] collides after hashing. Use a different stable id.`);
    }

    seenSourceIds.add(sourceId);
    seenCandidateIds.add(candidateId);

    const manifestCandidate = {
      ...candidate,
      id: sourceId,
      candidateId,
    };

    return {
      sourceId,
      candidateId,
      manifestCandidate,
    };
  });
}

function buildEligibilityArtifacts(voters) {
  const values = voters.map((voterAddress) => [voterAddress]);
  const tree = StandardMerkleTree.of(values, ["address"]);

  const proofs = {};
  for (const [index, value] of tree.entries()) {
    proofs[value[0]] = tree.getProof(index);
  }

  return {
    root: tree.root,
    values,
    proofs,
    tree: tree.dump(),
  };
}

function buildElectionPackage(input) {
  const source = requireObject(input, "input");
  const admin = normalizeAddress(source.admin, "admin");
  const embedManifestAsDataUri = source.embedManifestAsDataUri === true;
  const electionURI = embedManifestAsDataUri
    ? "data:application/json;utf8,"
    : requireString(source.electionURI, "electionURI");
  const manifestMetadata = requireObject(source.manifest, "manifest");
  const schedule = requireObject(source.schedule, "schedule");
  const voters = normalizeAddressArray(source.voters, "voters");
  const candidates = normalizeCandidates(source.candidates);

  const commitStart = parseUnixSeconds(schedule.commitStart, "schedule.commitStart");
  const commitEnd = parseUnixSeconds(schedule.commitEnd, "schedule.commitEnd");
  const revealEnd = parseUnixSeconds(schedule.revealEnd, "schedule.revealEnd");

  if (!(commitStart < commitEnd && commitEnd < revealEnd)) {
    throw new Error("schedule must satisfy commitStart < commitEnd < revealEnd.");
  }

  const eligibility = buildEligibilityArtifacts(voters);
  const manifest = sortValue({
    ...manifestMetadata,
    admin,
    candidates: candidates.map((candidate) => candidate.manifestCandidate),
    eligibilityRoot: eligibility.root,
    schedule: {
      commitEnd,
      commitStart,
      revealEnd,
    },
    voterCount: voters.length,
  });
  const manifestCanonicalJson = canonicalJson(manifest);
  const electionMetadataHash = ethers.keccak256(ethers.toUtf8Bytes(manifestCanonicalJson));
  const resolvedElectionURI = embedManifestAsDataUri
    ? `data:application/json;utf8,${encodeURIComponent(manifestCanonicalJson)}`
    : electionURI;

  return {
    manifest,
    manifestCanonicalJson,
    electionMetadataHash,
    eligibility,
    config: {
      admin,
      electionURI: resolvedElectionURI,
      electionMetadataHash,
      eligibleVotersRoot: eligibility.root,
      commitStart,
      commitEnd,
      revealEnd,
      candidateIds: candidates.map((candidate) => candidate.candidateId),
    },
    summary: {
      admin,
      candidateCount: candidates.length,
      candidateIds: candidates.map((candidate) => candidate.candidateId),
      candidateSourceIds: candidates.map((candidate) => candidate.sourceId),
      commitEnd,
      commitStart,
      electionMetadataHash,
      electionURI: resolvedElectionURI,
      eligibleVotersRoot: eligibility.root,
      revealEnd,
      voterCount: voters.length,
    },
  };
}

module.exports = {
  buildElectionPackage,
};
