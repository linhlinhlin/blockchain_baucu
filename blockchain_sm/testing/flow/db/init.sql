CREATE TABLE IF NOT EXISTS wallet_users (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES wallet_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES wallet_users(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL,
  session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
  nonce VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS election_activity_history (
  id BIGSERIAL PRIMARY KEY,
  election_address VARCHAR(42) NOT NULL,
  action_type VARCHAR(32) NOT NULL,
  actor_address VARCHAR(42),
  candidate_id VARCHAR(66),
  candidate_name TEXT,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  action_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_election_activity_history_election_address ON election_activity_history(election_address);
CREATE INDEX IF NOT EXISTS idx_election_activity_history_actor_address ON election_activity_history(actor_address);
