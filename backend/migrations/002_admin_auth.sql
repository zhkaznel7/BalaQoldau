CREATE TABLE balaqoldau.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$v=19$m=19456,t=2,p=1$%'),
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE balaqoldau.admin_sessions (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  admin_id uuid REFERENCES balaqoldau.admin_users(id) ON DELETE CASCADE,
  csrf_token char(64) NOT NULL CHECK (csrf_token ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX admin_sessions_admin_idx ON balaqoldau.admin_sessions(admin_id);
CREATE INDEX admin_sessions_expiry_idx ON balaqoldau.admin_sessions(expires_at);
REVOKE ALL ON balaqoldau.admin_users, balaqoldau.admin_sessions FROM PUBLIC;
