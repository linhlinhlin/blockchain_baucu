const crypto = require("node:crypto");
const { getAddress, recoverMessageAddress } = require("viem");
const config = require("./config");

function normalizeAddress(address) {
  return getAddress(address);
}

function createNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildAuthMessage(address, nonce) {
  return [
    "HoLiHu Election V1 Login",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Chain ID: ${config.chainId}`,
    `URI: ${config.authMessageUri}`,
  ].join("\n");
}

async function issueNonce(db, address) {
  const normalizedAddress = normalizeAddress(address);
  const nonce = createNonce();

  await db.query(
    `
      INSERT INTO auth_nonces(address, nonce, expires_at, issued_at)
      VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW())
      ON CONFLICT (address)
      DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at, issued_at = NOW()
    `,
    [normalizedAddress, nonce]
  );

  return {
    address: normalizedAddress,
    nonce,
    message: buildAuthMessage(normalizedAddress, nonce),
  };
}

async function verifyLogin(db, address, signature) {
  const normalizedAddress = normalizeAddress(address);
  const nonceRow = await db.query(
    `
      SELECT nonce
      FROM auth_nonces
      WHERE address = $1 AND expires_at > NOW()
    `,
    [normalizedAddress]
  );

  if (nonceRow.rowCount === 0) {
    throw new Error("Nonce is missing or expired.");
  }

  const nonce = nonceRow.rows[0].nonce;
  const message = buildAuthMessage(normalizedAddress, nonce);
  const recoveredAddress = await recoverMessageAddress({
    message,
    signature,
  });

  if (normalizeAddress(recoveredAddress) !== normalizedAddress) {
    throw new Error("Signature verification failed.");
  }

  const userResult = await db.query(
    `
      INSERT INTO wallet_users(address)
      VALUES ($1)
      ON CONFLICT (address)
      DO UPDATE SET address = EXCLUDED.address
      RETURNING id, address, created_at
    `,
    [normalizedAddress]
  );
  const user = userResult.rows[0];

  const sessionId = crypto.randomUUID();
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  await db.query(
    `
      INSERT INTO auth_sessions(id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval)
    `,
    [sessionId, user.id, tokenHash, config.sessionTtlHours]
  );
  await db.query(
    `
      INSERT INTO login_events(user_id, address, session_id, nonce)
      VALUES ($1, $2, $3, $4)
    `,
    [user.id, normalizedAddress, sessionId, nonce]
  );
  await db.query("DELETE FROM auth_nonces WHERE address = $1", [normalizedAddress]);

  return {
    token,
    user: {
      id: user.id,
      address: user.address,
      createdAt: user.created_at,
    },
  };
}

async function findSession(db, token) {
  const tokenHash = hashToken(token);
  const result = await db.query(
    `
      SELECT s.id, s.user_id, s.expires_at, u.address, u.created_at
      FROM auth_sessions s
      JOIN wallet_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  await db.query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1", [result.rows[0].id]);

  return {
    sessionId: result.rows[0].id,
    userId: result.rows[0].user_id,
    address: result.rows[0].address,
    createdAt: result.rows[0].created_at,
    expiresAt: result.rows[0].expires_at,
  };
}

async function loadLoginHistory(db, userId) {
  const result = await db.query(
    `
      SELECT id, address, created_at
      FROM login_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    address: row.address,
    createdAt: row.created_at,
  }));
}

async function revokeSession(db, token) {
  await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashToken(token)]);
}

module.exports = {
  buildAuthMessage,
  findSession,
  issueNonce,
  loadLoginHistory,
  normalizeAddress,
  revokeSession,
  verifyLogin,
};
