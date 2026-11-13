import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../api/repository.ts';
import type { Permission, Role } from './authorization.ts';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export interface Session { adminId: string | null; csrf: string; role: Role | null }
type Event = 'auth.login_failed' | 'rbac.denied' | 'security.csrf_denied' | 'audit.read';
export function adminRepository(db: Database) {
  return {
    async session(token: string): Promise<Session | undefined> {
      return (await db.query<Session>(`SELECT s.admin_id AS "adminId",s.csrf_token AS csrf,u.role
        FROM balaqoldau.admin_sessions s LEFT JOIN balaqoldau.admin_users u ON u.id=s.admin_id
        WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp()
        AND (s.admin_id IS NULL OR (NOT u.disabled AND s.credential_version=u.credential_version))`, [tokenHash(token)])).rows[0];
    },
    async user(email: string) {
      return (await db.query<{ id: string; hash: string; disabled: boolean }>(
        `WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS at)
          UPDATE balaqoldau.admin_users SET
          login_attempts=CASE WHEN login_window_ends<=instant.at THEN 1 ELSE login_attempts+1 END,
          login_window_ends=CASE WHEN login_window_ends<=instant.at THEN instant.at+interval '15 minutes' ELSE login_window_ends END
          FROM instant WHERE email=$1 AND NOT disabled AND (login_window_ends<=instant.at OR login_attempts<10)
          RETURNING id,password_hash AS hash,disabled`, [email])).rows[0];
    },
    async create(token: string, csrf: string) {
      await db.query(`INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,expires_at)
        VALUES($1,$2,now()+interval '10 minutes')`, [tokenHash(token), csrf]);
    },
    async authenticate(old: string, token: string, csrf: string, admin: string, seconds: number, expectedHash: string) {
      const result = await db.query(`WITH consumed AS (
        DELETE FROM balaqoldau.admin_sessions WHERE token_hash=$1 AND admin_id IS NULL AND expires_at>clock_timestamp() RETURNING token_hash)
        , eligible AS MATERIALIZED (SELECT id,credential_version FROM balaqoldau.admin_users
          WHERE id=$4 AND NOT disabled AND password_hash=$6 FOR SHARE), authenticated AS (
        INSERT INTO balaqoldau.admin_sessions(token_hash,csrf_token,admin_id,expires_at,credential_version)
        SELECT $2,$3,u.id,clock_timestamp()+($5::integer*interval '1 second'),u.credential_version FROM consumed,eligible u
        RETURNING admin_id)
        INSERT INTO balaqoldau.admin_audit_log(event,actor_id) SELECT 'auth.login_succeeded',admin_id
        FROM authenticated RETURNING id`, [tokenHash(old), tokenHash(token), csrf, admin, seconds, expectedHash]);
      return result.rowCount === 1;
    },
    async remove(token: string) {
      await db.query(`WITH removed AS (DELETE FROM balaqoldau.admin_sessions WHERE token_hash=$1 RETURNING admin_id)
        INSERT INTO balaqoldau.admin_audit_log(event,actor_id) SELECT 'auth.logout',admin_id FROM removed WHERE admin_id IS NOT NULL`, [tokenHash(token)]);
    },
    async audit(event: Event, actor: string | null, permission: Permission | null = null) {
      await db.query('INSERT INTO balaqoldau.admin_audit_log(event,actor_id,permission) VALUES($1,$2,$3)', [event, actor, permission]);
    },
    async auditLog(token: string, limit: number, offset: number) {
      return (await db.query<{ authorized: boolean; data: unknown[] }>(`WITH authorized AS MATERIALIZED (
        SELECT u.id FROM balaqoldau.admin_sessions s JOIN balaqoldau.admin_users u ON u.id=s.admin_id
        WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp() AND NOT u.disabled AND u.role='admin'
        AND s.credential_version=u.credential_version FOR SHARE OF u),
        logged AS (INSERT INTO balaqoldau.admin_audit_log(event,actor_id,permission)
          SELECT 'audit.read',id,'audit:read' FROM authorized RETURNING id)
        SELECT EXISTS(SELECT 1 FROM logged) AS authorized,
          COALESCE((SELECT json_agg(page) FROM (SELECT id,created_at AS "createdAt",event,actor_id AS "actorId",target_id AS "targetId",
            permission,previous_role AS "previousRole",new_role AS "newRole",previous_status AS "previousStatus",new_status AS "newStatus" FROM balaqoldau.admin_audit_log
            WHERE EXISTS(SELECT 1 FROM logged) ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3) page),'[]') AS data`,
      [tokenHash(token), limit, offset])).rows[0];
    },
    async changeRole(actor: string, target: string, role: Role, token: string) {
      // Lock both users in stable order, then recheck the actor's current authority in the same statement.
      const result = await db.query(`WITH locked AS MATERIALIZED (
        SELECT id,role,credential_version FROM balaqoldau.admin_users WHERE id IN ($1,$2) AND NOT disabled ORDER BY id FOR UPDATE),
        active_session AS MATERIALIZED (SELECT s.token_hash FROM balaqoldau.admin_sessions s JOIN locked actor ON actor.id=s.admin_id
          WHERE s.token_hash=$4 AND s.admin_id=$1 AND s.expires_at>clock_timestamp()
          AND s.credential_version=actor.credential_version),
        changed AS (UPDATE balaqoldau.admin_users u SET role=$3 FROM locked target
          WHERE u.id=$2 AND target.id=u.id AND $1::uuid<>$2::uuid
          AND EXISTS(SELECT 1 FROM locked actor WHERE actor.id=$1 AND actor.role='admin')
          AND EXISTS(SELECT 1 FROM active_session)
          RETURNING u.id,target.role AS previous_role),
        logged AS (INSERT INTO balaqoldau.admin_audit_log(event,actor_id,target_id,permission,previous_role,new_role)
          SELECT 'rbac.role_changed',$1,id,'users:roles:manage',previous_role,$3 FROM changed RETURNING id)
        SELECT id FROM logged`, [actor, target, role, tokenHash(token)]);
      return result.rowCount === 1;
    },
  };
}
