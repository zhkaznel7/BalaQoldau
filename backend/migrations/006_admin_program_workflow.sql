ALTER TABLE balaqoldau.programs DROP CONSTRAINT programs_status_check;
ALTER TABLE balaqoldau.programs ADD CONSTRAINT programs_status_check
  CHECK (status IN ('draft','review','verified','published'));
ALTER TABLE balaqoldau.programs DROP CONSTRAINT verification_required;
ALTER TABLE balaqoldau.programs ADD CONSTRAINT verification_required CHECK (status IN ('draft','review') OR
  (source_url IS NOT NULL AND source_name IS NOT NULL AND verified_at IS NOT NULL));
ALTER TABLE balaqoldau.programs
  ADD COLUMN created_by uuid REFERENCES balaqoldau.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN submitted_by uuid REFERENCES balaqoldau.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_by uuid REFERENCES balaqoldau.admin_users(id) ON DELETE RESTRICT,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_event_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_event_check CHECK (event IN (
  'auth.login_succeeded','auth.login_failed','auth.logout','rbac.denied','rbac.role_changed','admin.created','security.csrf_denied','audit.read',
  'program.created','program.updated','program.submitted','program.approved','program.rejected','program.published','program.unpublished'));
ALTER TABLE balaqoldau.admin_audit_log
  ADD COLUMN previous_status text CHECK (previous_status IN ('draft','review','verified','published')),
  ADD COLUMN new_status text CHECK (new_status IN ('draft','review','verified','published'));
CREATE FUNCTION balaqoldau.protect_published_program() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='published' THEN RAISE EXCEPTION 'Published programs cannot be deleted'; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER protect_published_program BEFORE DELETE ON balaqoldau.programs
  FOR EACH ROW EXECUTE FUNCTION balaqoldau.protect_published_program();
