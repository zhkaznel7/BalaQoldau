-- Regular accounts are deliberately independent of admin_users and admin RBAC.
CREATE TABLE balaqoldau.user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email=lower(email) AND length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$v=19$m=19456,t=2,p=1$%'),
  language text NOT NULL DEFAULT 'kk' CHECK (language IN ('kk','ru')),
  disabled boolean NOT NULL DEFAULT false,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version>0),
  login_attempts integer NOT NULL DEFAULT 0 CHECK (login_attempts>=0),
  login_window_ends timestamptz NOT NULL DEFAULT now(),
  reset_attempts integer NOT NULL DEFAULT 0 CHECK (reset_attempts>=0),
  reset_window_ends timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE balaqoldau.user_sessions (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid REFERENCES balaqoldau.user_accounts(id) ON DELETE CASCADE,
  csrf_token char(64) NOT NULL CHECK (csrf_token ~ '^[a-f0-9]{64}$'),
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK (expires_at>created_at)
);
CREATE INDEX user_sessions_user_idx ON balaqoldau.user_sessions(user_id);
CREATE INDEX user_sessions_expiry_idx ON balaqoldau.user_sessions(expires_at);
CREATE TABLE balaqoldau.user_reset_tokens (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES balaqoldau.user_accounts(id) ON DELETE CASCADE,
  credential_version integer NOT NULL CHECK (credential_version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK (expires_at>created_at)
);
CREATE INDEX user_reset_user_idx ON balaqoldau.user_reset_tokens(user_id);
CREATE INDEX user_reset_expiry_idx ON balaqoldau.user_reset_tokens(expires_at);
CREATE FUNCTION balaqoldau.user_credential_rotation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.disabled IS DISTINCT FROM OLD.disabled THEN
    NEW.credential_version := OLD.credential_version+1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_credential_rotation BEFORE UPDATE ON balaqoldau.user_accounts
FOR EACH ROW EXECUTE FUNCTION balaqoldau.user_credential_rotation();
REVOKE ALL ON FUNCTION balaqoldau.user_credential_rotation() FROM PUBLIC;
REVOKE ALL ON balaqoldau.user_accounts,balaqoldau.user_sessions,balaqoldau.user_reset_tokens FROM PUBLIC;
