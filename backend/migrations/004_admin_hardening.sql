ALTER TABLE balaqoldau.admin_users
  ADD COLUMN login_attempts smallint NOT NULL DEFAULT 0 CHECK (login_attempts BETWEEN 0 AND 10),
  ADD COLUMN login_window_ends timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN credential_version integer NOT NULL DEFAULT 0 CHECK (credential_version >= 0);
ALTER TABLE balaqoldau.admin_sessions
  ADD COLUMN credential_version integer NOT NULL DEFAULT 0 CHECK (credential_version >= 0);

CREATE FUNCTION balaqoldau.rotate_credential_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.credential_version := OLD.credential_version + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER admin_password_rotation BEFORE UPDATE OF password_hash
  ON balaqoldau.admin_users FOR EACH ROW EXECUTE FUNCTION balaqoldau.rotate_credential_version();
