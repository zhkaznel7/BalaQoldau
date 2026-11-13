import type { Database } from '../api/repository.ts';

// Read-only startup gate. Never grants privileges, changes roles or exposes catalog details.
export const adminPrivilegeQuery = `SELECT
      NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
      AND current_setting('session_replication_role')='origin'
      AND NOT has_parameter_privilege('session_replication_role','SET')
      AND (SELECT count(*) FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled IN ('O','A')
        AND ((t.tgrelid='balaqoldau.admin_users'::regclass AND t.tgname IN ('admin_password_rotation','admin_disable_revocation'))
          OR (t.tgrelid='balaqoldau.admin_audit_log'::regclass AND t.tgname='admin_audit_log_append_only')
          OR (t.tgrelid='balaqoldau.programs'::regclass AND t.tgname='protect_published_program')))=4
      AND NOT has_database_privilege(current_database(),'CREATE')
      AND NOT EXISTS(SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND pg_has_role(d.datdba,'MEMBER'))
      AND NOT EXISTS(SELECT 1 FROM pg_roles elevated WHERE elevated.rolname IN
        ('pg_read_all_data','pg_write_all_data','pg_read_server_files','pg_write_server_files',
         'pg_execute_server_program','pg_signal_backend','pg_checkpoint','pg_maintain')
        AND pg_has_role(elevated.oid,'MEMBER'))
      AND NOT EXISTS(SELECT 1 FROM pg_roles elevated
        WHERE (elevated.rolsuper OR elevated.rolbypassrls OR elevated.rolcreaterole OR elevated.rolcreatedb OR elevated.rolreplication)
        AND pg_has_role(elevated.oid,'MEMBER'))
      AND NOT has_schema_privilege('balaqoldau','CREATE')
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='balaqoldau' AND pg_has_role(c.relowner,'MEMBER'))
      AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='balaqoldau' AND pg_has_role(p.proowner,'MEMBER'))
      AND NOT has_table_privilege('balaqoldau.admin_users','INSERT,DELETE,TRUNCATE,TRIGGER')
      AND NOT has_table_privilege('balaqoldau.admin_sessions','UPDATE,TRUNCATE,TRIGGER')
      AND NOT has_table_privilege('balaqoldau.admin_audit_log','UPDATE,DELETE,TRUNCATE,TRIGGER')
      AND NOT has_any_column_privilege('balaqoldau.admin_users','INSERT')
      AND NOT has_any_column_privilege('balaqoldau.admin_sessions','UPDATE')
      AND NOT has_any_column_privilege('balaqoldau.admin_audit_log','UPDATE')
      AND NOT has_column_privilege('balaqoldau.admin_audit_log','id','INSERT')
      AND NOT has_column_privilege('balaqoldau.admin_audit_log','created_at','INSERT')
      AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='balaqoldau.admin_users'::regclass
        AND a.attnum>0 AND NOT a.attisdropped AND a.attname NOT IN ('role','login_attempts','login_window_ends')
        AND has_column_privilege(a.attrelid,a.attnum,'UPDATE'))
      AND has_schema_privilege('balaqoldau','USAGE')
      AND has_table_privilege('balaqoldau.admin_sessions','SELECT')
      AND has_table_privilege('balaqoldau.admin_sessions','INSERT')
      AND has_table_privilege('balaqoldau.admin_sessions','DELETE')
      AND has_table_privilege('balaqoldau.admin_audit_log','SELECT')
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['id','email','password_hash','disabled','role','credential_version','login_attempts','login_window_ends']) AS c(name)
        WHERE NOT has_column_privilege('balaqoldau.admin_users',c.name,'SELECT'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['role','login_attempts','login_window_ends']) AS c(name)
        WHERE NOT has_column_privilege('balaqoldau.admin_users',c.name,'UPDATE'))
      AND has_table_privilege('balaqoldau.programs','SELECT')
      AND NOT has_table_privilege('balaqoldau.programs','DELETE,TRUNCATE,TRIGGER')
      AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='balaqoldau.programs'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND ((a.attname NOT IN ('slug','category_id','title','description','is_demo','source_url','source_name','apply_url','age_min','age_max','deadline','created_by','status')
          AND has_column_privilege(a.attrelid,a.attnum,'INSERT'))
          OR (a.attname NOT IN ('slug','category_id','title','description','source_url','source_name','apply_url','age_min','age_max','deadline',
            'submitted_by','reviewed_by','verified_at','updated_at','version','status') AND has_column_privilege(a.attrelid,a.attnum,'UPDATE'))))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['slug','category_id','title','description','is_demo','source_url','source_name','apply_url','age_min','age_max','deadline','created_by','status']) AS c(name)
        WHERE NOT has_column_privilege('balaqoldau.programs',c.name,'INSERT'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['slug','category_id','title','description','source_url','source_name','apply_url','age_min','age_max','deadline','submitted_by','reviewed_by','verified_at','updated_at','version','status']) AS c(name)
        WHERE NOT has_column_privilege('balaqoldau.programs',c.name,'UPDATE'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['balaqoldau.categories','balaqoldau.regions','balaqoldau.family_categories']) AS t(name)
        WHERE NOT has_table_privilege(t.name,'SELECT'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['balaqoldau.program_regions','balaqoldau.program_family_categories']) AS t(name)
        WHERE NOT has_table_privilege(t.name,'SELECT') OR NOT has_table_privilege(t.name,'INSERT') OR NOT has_table_privilege(t.name,'DELETE')
          OR has_table_privilege(t.name,'TRUNCATE,TRIGGER') OR has_any_column_privilege(t.name,'UPDATE'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['event','actor_id','target_id','permission','previous_role','new_role','previous_status','new_status']) AS c(name)
        WHERE NOT has_column_privilege('balaqoldau.admin_audit_log',c.name,'INSERT')) AS safe
      FROM pg_roles r WHERE r.rolname=current_user`;
export async function adminDatabaseSafe(db?: Database): Promise<boolean> {
  if (!db) return false;
  try {
    const result = await db.query<{ safe: boolean }>(adminPrivilegeQuery);
    return result.rows[0]?.safe === true;
  } catch { return false; }
}
