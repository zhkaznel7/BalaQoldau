-- 014 is already applied: preserve its submission columns/index and all messages.
ALTER TABLE balaqoldau.contact_messages
 ADD COLUMN status text NOT NULL DEFAULT 'unread' CHECK(status IN('unread','read','resolved')),
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE INDEX contact_messages_status_created_idx ON balaqoldau.contact_messages(status,created_at DESC,id);
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_permission_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_permission_check CHECK(permission IN(
 'programs:read','programs:draft:write','programs:review','programs:publish','taxonomy:manage','users:roles:manage','audit:read','contacts:manage'));
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_event_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_event_check CHECK(event IN(
 'auth.login_succeeded','auth.login_failed','auth.logout','rbac.denied','rbac.role_changed','admin.created','security.csrf_denied','audit.read',
 'program.created','program.updated','program.submitted','program.approved','program.rejected','program.published','program.unpublished',
 'program.archived','program.reopened','program.recheck_requested','program.eligibility_changed','report.reviewed','report.resolved','report.dismissed',
 'contact.inbox_viewed','contact.viewed','contact.read','contact.resolved','contact.reopened'));
