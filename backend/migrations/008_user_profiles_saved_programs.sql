ALTER TABLE balaqoldau.user_accounts
  ADD COLUMN full_name varchar(100) CHECK (full_name IS NULL OR (length(btrim(full_name)) BETWEEN 1 AND 100 AND full_name !~ '[[:cntrl:]]')),
  ADD COLUMN location varchar(100) CHECK (location IS NULL OR (length(btrim(location)) BETWEEN 1 AND 100 AND location !~ '[[:cntrl:]]'));
CREATE TABLE balaqoldau.user_saved_programs (
  user_id uuid NOT NULL REFERENCES balaqoldau.user_accounts(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES balaqoldau.programs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,program_id)
);
CREATE INDEX user_saved_programs_program_idx ON balaqoldau.user_saved_programs(program_id);
CREATE INDEX user_saved_programs_user_created_idx ON balaqoldau.user_saved_programs(user_id,created_at DESC,program_id);
REVOKE ALL ON balaqoldau.user_saved_programs FROM PUBLIC;
