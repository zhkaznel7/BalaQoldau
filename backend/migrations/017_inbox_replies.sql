-- Existing anonymous submissions remain anonymous; never infer ownership from email.
ALTER TABLE balaqoldau.contact_messages ADD COLUMN user_id uuid REFERENCES balaqoldau.user_accounts(id) ON DELETE SET NULL;
ALTER TABLE balaqoldau.program_reports ADD COLUMN user_id uuid REFERENCES balaqoldau.user_accounts(id) ON DELETE SET NULL;
CREATE INDEX contact_messages_user_idx ON balaqoldau.contact_messages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX program_reports_user_idx ON balaqoldau.program_reports(user_id) WHERE user_id IS NOT NULL;
CREATE TABLE balaqoldau.inbox_replies(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contact_id uuid REFERENCES balaqoldau.contact_messages(id) ON DELETE CASCADE,
 report_id uuid REFERENCES balaqoldau.program_reports(id) ON DELETE CASCADE,
 admin_id uuid NOT NULL REFERENCES balaqoldau.admin_users(id) ON DELETE RESTRICT,
 submission_id uuid NOT NULL UNIQUE,
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
 delivery_status text NOT NULL CHECK(delivery_status IN('account','saved_not_delivered','email_accepted')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 delivered_at timestamptz,
 CHECK(num_nonnulls(contact_id,report_id)=1),
 CHECK((delivery_status='saved_not_delivered')=(delivered_at IS NULL))
);
CREATE INDEX inbox_replies_contact_idx ON balaqoldau.inbox_replies(contact_id,created_at DESC,id) WHERE contact_id IS NOT NULL;
CREATE INDEX inbox_replies_report_idx ON balaqoldau.inbox_replies(report_id,created_at DESC,id) WHERE report_id IS NOT NULL;
REVOKE ALL ON balaqoldau.inbox_replies FROM PUBLIC;
ALTER TABLE balaqoldau.admin_audit_log DROP CONSTRAINT admin_audit_log_event_check;
ALTER TABLE balaqoldau.admin_audit_log ADD CONSTRAINT admin_audit_log_event_check CHECK(event IN(
 'auth.login_succeeded','auth.login_failed','auth.logout','rbac.denied','rbac.role_changed','admin.created','security.csrf_denied','audit.read',
 'program.created','program.updated','program.submitted','program.approved','program.rejected','program.published','program.unpublished',
 'program.archived','program.reopened','program.recheck_requested','program.eligibility_changed','report.reviewed','report.resolved','report.dismissed',
 'contact.inbox_viewed','contact.viewed','contact.read','contact.resolved','contact.reopened',
 'contact.replied','report.replied','contact.reply_email_accepted'));
