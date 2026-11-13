import type { Database } from '../api/repository.ts';

// Fail closed in production; never grant rights or change a database role.
export async function userDatabaseSafe(db?: Database): Promise<boolean> {
  if (!db) return false;
  try {
    return (await db.query<{ safe: boolean }>(`SELECT
      NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
      AND NOT has_database_privilege(current_database(),'CREATE')
      AND NOT has_schema_privilege('balaqoldau','CREATE')
      AND NOT EXISTS(SELECT 1 FROM pg_roles elevated WHERE
        (elevated.rolsuper OR elevated.rolbypassrls OR elevated.rolcreaterole OR elevated.rolcreatedb OR elevated.rolreplication
          OR elevated.rolname IN ('pg_read_all_data','pg_write_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program'))
        AND pg_has_role(elevated.oid,'MEMBER'))
      AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='balaqoldau' AND pg_has_role(c.relowner,'MEMBER'))
      AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='balaqoldau' AND pg_has_role(p.proowner,'MEMBER'))
      AND NOT has_table_privilege('balaqoldau.user_accounts','DELETE,TRUNCATE,TRIGGER')
      AND NOT has_table_privilege('balaqoldau.user_sessions','UPDATE,TRUNCATE,TRIGGER')
      AND NOT has_table_privilege('balaqoldau.user_reset_tokens','UPDATE,TRUNCATE,TRIGGER')
      AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='balaqoldau.user_accounts'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND ((a.attname NOT IN ('email','password_hash','language') AND has_column_privilege(a.attrelid,a.attnum,'INSERT'))
          OR (a.attname NOT IN ('full_name','location','family_context','password_hash','credential_version','login_attempts','login_window_ends','reset_attempts','reset_window_ends') AND has_column_privilege(a.attrelid,a.attnum,'UPDATE'))))
      AND has_table_privilege('balaqoldau.user_accounts','SELECT')
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['balaqoldau.user_sessions','balaqoldau.user_reset_tokens']) t(name),
        unnest(ARRAY['SELECT','INSERT','DELETE']) p(name) WHERE NOT has_table_privilege(t.name,p.name))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['email','password_hash','language']) c(name)
        WHERE NOT has_column_privilege('balaqoldau.user_accounts',c.name,'INSERT'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['full_name','location','family_context','password_hash','credential_version','login_attempts','login_window_ends','reset_attempts','reset_window_ends']) c(name)
        WHERE NOT has_column_privilege('balaqoldau.user_accounts',c.name,'UPDATE'))
      AND NOT has_table_privilege('balaqoldau.user_saved_programs','UPDATE,TRUNCATE,TRIGGER')
      AND NOT has_any_column_privilege('balaqoldau.user_saved_programs','UPDATE')
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','DELETE']) p(name)
        WHERE NOT has_table_privilege('balaqoldau.user_saved_programs',p.name))
      AND has_table_privilege('balaqoldau.inbox_replies','SELECT')
      AND NOT has_table_privilege('balaqoldau.inbox_replies','DELETE,TRUNCATE,TRIGGER')
      AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='balaqoldau.inbox_replies'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND a.attname NOT IN('delivery_status','delivered_at') AND has_column_privilege(a.attrelid,a.attnum,'UPDATE'))
      AND has_column_privilege('balaqoldau.contact_messages','user_id','INSERT')
      AND has_column_privilege('balaqoldau.program_reports','user_id','INSERT')
      AND has_column_privilege('balaqoldau.contact_messages','user_id','SELECT')
      AND has_table_privilege('balaqoldau.program_reports','SELECT')
      AND current_setting('session_replication_role')='origin'
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['balaqoldau.child_profiles','balaqoldau.child_preferences']) t(name)
        WHERE NOT has_table_privilege(t.name,'SELECT') OR NOT has_table_privilege(t.name,'DELETE') OR has_table_privilege(t.name,'TRUNCATE,TRIGGER'))
      AND NOT has_any_column_privilege('balaqoldau.child_preferences','UPDATE')
      AND has_column_privilege('balaqoldau.child_preferences','child_id','INSERT')
      AND has_column_privilege('balaqoldau.child_preferences','category_id','INSERT')
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['user_id','slot','nickname','age','region_id','family_context','full_name','gender','interests']) c(name)
        WHERE NOT has_column_privilege('balaqoldau.child_profiles',c.name,'INSERT'))
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['nickname','age','region_id','version','updated_at','family_context','full_name','gender','interests']) c(name)
        WHERE NOT has_column_privilege('balaqoldau.child_profiles',c.name,'UPDATE'))
      AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='balaqoldau.child_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
        AND ((a.attname NOT IN ('user_id','slot','nickname','age','region_id','family_context','full_name','gender','interests') AND has_column_privilege(a.attrelid,a.attnum,'INSERT'))
          OR (a.attname NOT IN ('nickname','age','region_id','version','updated_at','family_context','full_name','gender','interests') AND has_column_privilege(a.attrelid,a.attnum,'UPDATE'))))
      AND NOT has_parameter_privilege('session_replication_role','SET')
      AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='balaqoldau.user_accounts'::regclass
        AND tgname='user_credential_rotation' AND tgenabled IN ('O','A')) AS safe
      FROM pg_roles r WHERE r.rolname=current_user`)).rows[0]?.safe === true;
  } catch { return false; }
}
