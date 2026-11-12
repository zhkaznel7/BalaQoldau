ALTER TABLE balaqoldau.admin_users ADD COLUMN role text NOT NULL DEFAULT 'editor'
  CHECK (role IN ('editor','reviewer','admin'));

CREATE TABLE balaqoldau.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('auth.login_succeeded','auth.login_failed','auth.logout',
    'rbac.denied','rbac.role_changed','admin.created','security.csrf_denied','audit.read')),
  actor_id uuid,
  target_id uuid,
  permission text CHECK (permission IN ('programs:read','programs:draft:write','programs:review',
    'programs:publish','taxonomy:manage','users:roles:manage','audit:read')),
  previous_role text CHECK (previous_role IN ('editor','reviewer','admin')),
  new_role text CHECK (new_role IN ('editor','reviewer','admin'))
);
-- No FK actions: immutable history survives account removal without rewriting audit rows.
CREATE INDEX admin_audit_log_created_idx ON balaqoldau.admin_audit_log(created_at,id);
CREATE INDEX admin_audit_log_actor_idx ON balaqoldau.admin_audit_log(actor_id);
CREATE FUNCTION balaqoldau.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is append-only';
END;
$$;
CREATE TRIGGER admin_audit_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON balaqoldau.admin_audit_log FOR EACH STATEMENT EXECUTE FUNCTION balaqoldau.reject_audit_mutation();
REVOKE ALL ON balaqoldau.admin_audit_log FROM PUBLIC;
