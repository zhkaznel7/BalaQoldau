-- Additive lifecycle/verification/reporting. Existing records and decisions are preserved.
ALTER TABLE balaqoldau.programs DROP CONSTRAINT programs_status_check;
ALTER TABLE balaqoldau.programs ADD CONSTRAINT programs_status_check
  CHECK(status IN ('draft','review','verified','published','rejected','archived'));
ALTER TABLE balaqoldau.programs DROP CONSTRAINT demo_stays_draft;
ALTER TABLE balaqoldau.programs ADD CONSTRAINT demo_stays_draft CHECK(NOT is_demo OR status IN('draft','archived'));
ALTER TABLE balaqoldau.programs DROP CONSTRAINT verification_required;
ALTER TABLE balaqoldau.programs ADD CONSTRAINT verification_required CHECK(status NOT IN('verified','published') OR
  (source_url IS NOT NULL AND source_name IS NOT NULL AND verified_at IS NOT NULL));
ALTER TABLE balaqoldau.programs ADD COLUMN expires_on date,
  ADD COLUMN source_needs_recheck boolean NOT NULL DEFAULT false;
CREATE INDEX programs_expiration_idx ON balaqoldau.programs(expires_on,id);
CREATE INDEX programs_verification_date_idx ON balaqoldau.programs(verified_at,id);
CREATE INDEX programs_modified_idx ON balaqoldau.programs(updated_at DESC,id);
CREATE TABLE balaqoldau.program_verifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES balaqoldau.programs(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  program_version integer NOT NULL CHECK(program_version>0),
  decision text NOT NULL CHECK(decision IN('approve','reject','recheck')),
  source_reviewed boolean NOT NULL,information_reviewed boolean NOT NULL,eligibility_reviewed boolean NOT NULL,
  notes varchar(1000) NOT NULL DEFAULT '',
  source_url varchar(2048),source_name varchar(200),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(decision<>'approve' OR (source_reviewed AND information_reviewed AND eligibility_reviewed))
);
CREATE INDEX program_verifications_program_idx ON balaqoldau.program_verifications(program_id,created_at DESC,id);
CREATE TRIGGER program_verifications_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON balaqoldau.program_verifications
  FOR EACH STATEMENT EXECUTE FUNCTION balaqoldau.reject_audit_mutation();
CREATE TABLE balaqoldau.program_reports(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES balaqoldau.programs(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK(reason IN('incorrect','outdated','source_broken','other')),
  explanation varchar(1000),status text NOT NULL DEFAULT 'open' CHECK(status IN('open','reviewed','resolved','dismissed')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  moderated_by uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX program_reports_status_idx ON balaqoldau.program_reports(status,created_at DESC,id);
CREATE INDEX program_reports_program_idx ON balaqoldau.program_reports(program_id,status);
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_event_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_event_check CHECK(event IN(
 'auth.login_succeeded','auth.login_failed','auth.logout','rbac.denied','rbac.role_changed','admin.created','security.csrf_denied','audit.read',
 'program.created','program.updated','program.submitted','program.approved','program.rejected','program.published','program.unpublished',
 'program.archived','program.reopened','program.recheck_requested','program.eligibility_changed','report.reviewed','report.resolved','report.dismissed'));
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_previous_status_check;
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_new_status_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_previous_status_check
 CHECK(previous_status IN('draft','review','verified','published','rejected','archived')),
 ADD CONSTRAINT admin_audit_log_new_status_check CHECK(new_status IN('draft','review','verified','published','rejected','archived'));
CREATE OR REPLACE VIEW balaqoldau.published_programs WITH(security_barrier=true) AS
 SELECT id,slug,category_id,title,description,source_url,source_name,verified_at,age_min,age_max,deadline,apply_url,eligibility_complete
 FROM balaqoldau.programs WHERE status='published' AND NOT is_demo AND NOT source_needs_recheck
 AND (deadline IS NULL OR deadline>=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Almaty')::date)
 AND (expires_on IS NULL OR expires_on>=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Almaty')::date);
REVOKE ALL ON balaqoldau.program_verifications,balaqoldau.program_reports FROM PUBLIC;
