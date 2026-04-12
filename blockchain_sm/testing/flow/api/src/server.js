const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("node:path");

dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", "..", ".env"),
});

const config = require("./config");
const db = require("./db");
const {
  findSession,
  issueNonce,
  loadLoginHistory,
  revokeSession,
  verifyLogin,
} = require("./auth");
const {
  callWithRpcFallback,
  getViewerProof,
  loadElectionActivityHistory,
  loadElectionOnChain,
  syncElectionActivity,
} = require("./chain");
const { listElectionRecords, listElectionRecordsByAdmin, resolveElection, summarizeRecord } = require("./repository");
const { deployElection } = require("./deployer");

const app = express();
app.use(
  cors({
    origin: config.appOrigin,
  })
);
app.use(express.json());

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

app.use(async (request, _response, next) => {
  const authorization = request.headers.authorization ?? "";
  if (!authorization.startsWith("Bearer ")) {
    request.session = null;
    next();
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    request.session = null;
    next();
    return;
  }

  try {
    request.session = await findSession(db, token);
  } catch {
    request.session = null;
  }

  next();
});

function requireAuth(request, response, next) {
  if (!request.session) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  next();
}

function isAdminSession(session) {
  return (
    !!session &&
    !!config.deployerAddress &&
    session.address.toLowerCase() === config.deployerAddress.toLowerCase()
  );
}

function canCreateElections(session) {
  return !!session && (config.allowSelfServiceElectionCreation || isAdminSession(session));
}

app.get("/health", asyncHandler(async (_request, response) => {
  const blockNumber = await callWithRpcFallback((client) => client.getBlockNumber());
  response.json({
    ok: true,
    blockNumber: Number(blockNumber),
    chainId: config.chainId,
    deploymentsDir: config.deploymentsDir,
    adminAddress: config.deployerAddress,
    factoryAddress: config.factoryAddress,
    rpcUrls: config.rpcUrls,
  });
}));

app.get("/api/public-config", (_request, response) => {
  response.json({
    admin: {
      address: config.deployerAddress,
    },
    features: {
      allowSelfServiceElectionCreation: config.allowSelfServiceElectionCreation,
    },
    chainId: config.chainId,
    explorerBaseUrl: config.explorerBaseUrl,
    factoryAddress: config.factoryAddress,
  });
});

app.post("/api/auth/nonce", asyncHandler(async (request, response) => {
  try {
    const payload = await issueNonce(db, request.body.address);
    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}));

app.post("/api/auth/verify", asyncHandler(async (request, response) => {
  try {
    const payload = await verifyLogin(db, request.body.address, request.body.signature);
    response.json(payload);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (request, response) => {
  const authorization = request.headers.authorization;
  const token = authorization.slice("Bearer ".length).trim();
  await revokeSession(db, token);
  response.json({ ok: true });
}));

app.get("/api/me", requireAuth, asyncHandler(async (request, response) => {
  const loginHistory = await loadLoginHistory(db, request.session.userId);
  response.json({
    user: {
      id: request.session.userId,
      address: request.session.address,
      createdAt: request.session.createdAt,
      expiresAt: request.session.expiresAt,
      canCreateElections: canCreateElections(request.session),
    },
    loginHistory,
    admin: {
      address: config.deployerAddress,
    },
    features: {
      allowSelfServiceElectionCreation: config.allowSelfServiceElectionCreation,
    },
  });
}));

app.get("/api/elections", (_request, response) => {
  response.json({
    items: listElectionRecords().map(summarizeRecord),
  });
});

app.get("/api/my/elections", requireAuth, (request, response) => {
  response.json({
    items: listElectionRecordsByAdmin(request.session.address).map(summarizeRecord),
  });
});

app.get("/api/elections/:identifier", asyncHandler(async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  await syncElectionActivity(db, record);
  const [onChain, activityHistory] = await Promise.all([
    loadElectionOnChain(record, request.session?.address ?? null),
    loadElectionActivityHistory(db, record.address),
  ]);

  response.json({
    ...summarizeRecord(record),
    manifest: record.manifest,
    summary: record.summary,
    onChain,
    activityHistory,
  });
}));

app.get("/api/elections/:identifier/history", asyncHandler(async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  await syncElectionActivity(db, record);
  const history = await loadElectionActivityHistory(db, record.address);
  response.json({
    items: history,
  });
}));

app.get("/api/elections/:identifier/proof", requireAuth, asyncHandler(async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  const proof = getViewerProof(record, request.session.address);
  response.json({
    address: request.session.address,
    eligible: Array.isArray(proof),
    proof: proof ?? [],
  });
}));

app.post("/api/elections/:identifier/sync", requireAuth, asyncHandler(async (request, response) => {
  const record = resolveElection(request.params.identifier);
  if (!record) {
    response.status(404).json({ error: "Election not found." });
    return;
  }

  await syncElectionActivity(db, record);
  const [onChain, activityHistory] = await Promise.all([
    loadElectionOnChain(record, request.session.address),
    loadElectionActivityHistory(db, record.address),
  ]);

  response.json({
    ok: true,
    onChain,
    activityHistory,
  });
}));

app.post("/api/admin/elections", requireAuth, asyncHandler(async (request, response) => {
  if (!canCreateElections(request.session)) {
    response.status(403).json({ error: "Election creation is disabled for this session." });
    return;
  }

  try {
    const { record } = await deployElection(request.session.address, request.body);
    const resolvedRecord = resolveElection(record.electionAddress) ?? record;
    let onChain = null;
    let warning = null;

    try {
      onChain = await loadElectionOnChain(resolvedRecord, request.session.address);
    } catch (error) {
      warning = `Election deployed, but live chain read is temporarily unavailable: ${error.shortMessage ?? error.message}`;
    }

    response.status(201).json({
      ...summarizeRecord(resolvedRecord),
      onChain,
      warning,
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}));

app.use((error, _request, response, _next) => {
  console.error(error);
  if (response.headersSent) {
    return;
  }

  response.status(502).json({
    error: error.shortMessage ?? error.message ?? "Unexpected server error.",
  });
});

async function main() {
  await db.runMigrations();
  app.listen(config.apiPort, () => {
    console.log(`Flow API listening on http://localhost:${config.apiPort}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
