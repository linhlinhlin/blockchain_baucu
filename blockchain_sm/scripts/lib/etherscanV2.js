const fs = require("node:fs");
const path = require("node:path");
const { Interface } = require("ethers");
const { getOptionalEnv } = require("./env");
const { resolveFromCwd } = require("./io");

const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
const CHAIN_ID_BY_NETWORK = {
  sepolia: "11155111",
};

const SPDX_TO_ETHERSCAN_LICENSE = {
  NONE: "1",
  UNLICENSED: "2",
  MIT: "3",
  "GPL-2.0": "4",
  "GPL-3.0": "5",
  "LGPL-2.1": "6",
  "LGPL-3.0": "7",
  "BSD-2-Clause": "8",
  "BSD-3-Clause": "9",
  MPL: "10",
  "OSL-3.0": "11",
  "Apache-2.0": "12",
  AGPL: "13",
  "BUSL-1.1": "14",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey() {
  const apiKey = getOptionalEnv("ETHERSCAN_API_KEY");
  if (!apiKey) {
    throw new Error("ETHERSCAN_API_KEY is missing.");
  }

  return apiKey;
}

function getChainId(networkName) {
  const chainId = CHAIN_ID_BY_NETWORK[networkName];
  if (!chainId) {
    throw new Error(`Unsupported Etherscan V2 verify network: ${networkName}`);
  }

  return chainId;
}

function loadBuildInfoFromArtifactDebug(dbgArtifactPath) {
  const debugArtifact = JSON.parse(fs.readFileSync(resolveFromCwd(dbgArtifactPath), "utf8"));
  const buildInfoPath = path.resolve(path.dirname(resolveFromCwd(dbgArtifactPath)), debugArtifact.buildInfo);
  return JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
}

function getCompilerVersion(buildInfo) {
  return `v${buildInfo.solcLongVersion}`;
}

function getOptimizationUsed(buildInfo) {
  return buildInfo.input?.settings?.optimizer?.enabled ? "1" : "0";
}

function getOptimizationRuns(buildInfo) {
  return String(buildInfo.input?.settings?.optimizer?.runs ?? 200);
}

function getEvmVersion(buildInfo) {
  return buildInfo.input?.settings?.evmVersion ?? "default";
}

function getLicenseType(buildInfo, sourcePath) {
  const metadataJson =
    buildInfo.output?.contracts?.[sourcePath] &&
    Object.values(buildInfo.output.contracts[sourcePath])[0]?.metadata;

  if (!metadataJson) {
    return "1";
  }

  const metadata = JSON.parse(metadataJson);
  const license = metadata.sources?.[sourcePath]?.license ?? "NONE";
  return SPDX_TO_ETHERSCAN_LICENSE[license] ?? "1";
}

function encodeConstructorArguments(artifactJsonPath, constructorArguments) {
  const artifact = JSON.parse(fs.readFileSync(resolveFromCwd(artifactJsonPath), "utf8"));
  const iface = new Interface(artifact.abi);
  const deploy = iface.deploy;

  if (!deploy || !Array.isArray(deploy.inputs) || deploy.inputs.length === 0) {
    return "";
  }

  const encoded = iface.encodeDeploy(constructorArguments);
  return encoded.startsWith("0x") ? encoded.slice(2) : encoded;
}

async function postForm(queryParams, bodyParams = {}) {
  const url = new URL(ETHERSCAN_V2_URL);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: new URLSearchParams(bodyParams),
  });

  if (!response.ok) {
    throw new Error(`Etherscan HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function submitVerification({
  networkName,
  contractAddress,
  sourceCode,
  contractName,
  compilerVersion,
  optimizationUsed,
  runs,
  constructorArguments,
  evmVersion,
  licenseType,
}) {
  const result = await postForm(
    {
      apikey: getApiKey(),
      chainid: getChainId(networkName),
      module: "contract",
      action: "verifysourcecode",
    },
    {
      contractaddress: contractAddress,
      sourceCode,
      codeformat: "solidity-standard-json-input",
      contractname: contractName,
      compilerversion: compilerVersion,
      optimizationUsed,
      runs,
      constructorArguments,
      evmVersion,
      licenseType,
    }
  );

  return result;
}

async function checkVerificationStatus(networkName, guid) {
  return postForm({
    apikey: getApiKey(),
    chainid: getChainId(networkName),
    module: "contract",
    action: "checkverifystatus",
    guid,
  });
}

async function getSourceCode(networkName, contractAddress) {
  const query = new URLSearchParams({
    apikey: getApiKey(),
    chainid: getChainId(networkName),
    module: "contract",
    action: "getsourcecode",
    address: contractAddress,
  });
  const response = await fetch(`${ETHERSCAN_V2_URL}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Etherscan HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function isAlreadyVerifiedSubmission(result) {
  const message = String(result?.result ?? "");
  return /already verified|source code already verified/i.test(message);
}

async function waitForVerification(networkName, guid, attempts = 25, delayMs = 5000) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const status = await checkVerificationStatus(networkName, guid);
    const result = String(status?.result ?? "");

    if (status.status === "1" && /Pass - Verified/i.test(result)) {
      return status;
    }

    if (/already verified/i.test(result)) {
      return status;
    }

    if (!/Pending in queue/i.test(result)) {
      throw new Error(`Etherscan verification failed: ${result || JSON.stringify(status)}`);
    }

    console.log(`Verification pending (${attempt}/${attempts})...`);
    await sleep(delayMs);
  }

  throw new Error(`Etherscan verification is still pending after ${attempts} attempts.`);
}

async function verifyContractV2({
  networkName,
  contractAddress,
  dbgArtifactPath,
  artifactJsonPath,
  sourcePath,
  contractName,
  constructorArguments,
}) {
  const buildInfo = loadBuildInfoFromArtifactDebug(dbgArtifactPath);
  const sourceCode = JSON.stringify(buildInfo.input);
  const compilerVersion = getCompilerVersion(buildInfo);
  const optimizationUsed = getOptimizationUsed(buildInfo);
  const runs = getOptimizationRuns(buildInfo);
  const evmVersion = getEvmVersion(buildInfo);
  const licenseType = getLicenseType(buildInfo, sourcePath);
  const encodedConstructorArguments = encodeConstructorArguments(
    artifactJsonPath,
    constructorArguments
  );

  console.log("Submitting Etherscan V2 verification for:", contractAddress);
  const submission = await submitVerification({
    networkName,
    contractAddress,
    sourceCode,
    contractName: `${sourcePath}:${contractName}`,
    compilerVersion,
    optimizationUsed,
    runs,
    constructorArguments: encodedConstructorArguments,
    evmVersion,
    licenseType,
  });

  if (submission.status === "1") {
    const guid = submission.result;
    console.log("Verification GUID:", guid);
    await waitForVerification(networkName, guid);
    return {
      mode: "submitted",
      guid,
    };
  }

  if (isAlreadyVerifiedSubmission(submission)) {
    return {
      mode: "already-verified",
    };
  }

  throw new Error(`Etherscan submission failed: ${submission.result || JSON.stringify(submission)}`);
}

module.exports = {
  getSourceCode,
  verifyContractV2,
};
