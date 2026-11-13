import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../api/repository.ts';

// Separate storage, cookie and principals: no regular-user lookup ever touches admin tables.
export const userToken = () => randomBytes(32).toString('hex');
export const userTokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export interface UserSession { userId: string | null; csrf: string; email: string | null; language: 'kk' | 'ru' | null }
export function userRepository(db: Database) {
  return {
    async session(token: string) {
      return (await db.query<UserSession>(`SELECT s.user_id AS "userId",s.csrf_token AS csrf,u.email,u.language
        FROM balaqoldau.user_sessions s LEFT JOIN balaqoldau.user_accounts u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp()
        AND (s.user_id IS NULL OR (NOT u.disabled AND s.credential_version=u.credential_version))`, [userTokenHash(token)])).rows[0];
    },
    async anonymous(token: string, csrf: string) {
      await db.query(`INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,expires_at)
        VALUES($1,$2,clock_timestamp()+interval '10 minutes')`, [userTokenHash(token), csrf]);
    },
    async register(email: string, hash: string, language: 'kk' | 'ru') {
      await db.query(`INSERT INTO balaqoldau.user_accounts(email,password_hash,language) VALUES($1,$2,$3)
        ON CONFLICT(email) DO NOTHING`, [email, hash, language]);
    },
    async loginCandidate(email: string) {
      return (await db.query<{ id: string; hash: string }>(`WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS at)
        UPDATE balaqoldau.user_accounts u SET
        login_attempts=CASE WHEN login_window_ends<=instant.at THEN 1 ELSE login_attempts+1 END,
        login_window_ends=CASE WHEN login_window_ends<=instant.at THEN instant.at+interval '15 minutes' ELSE login_window_ends END
        FROM instant WHERE email=$1 AND NOT disabled AND (login_window_ends<=instant.at OR login_attempts<10)
        RETURNING u.id,u.password_hash AS hash`, [email])).rows[0];
    },
    async authenticate(old: string, fresh: string, csrf: string, id: string, hash: string, seconds: number) {
      const result = await db.query(`WITH consumed AS (
        DELETE FROM balaqoldau.user_sessions WHERE token_hash=$1 AND user_id IS NULL AND expires_at>clock_timestamp() RETURNING token_hash),
        eligible AS MATERIALIZED (SELECT id,credential_version FROM balaqoldau.user_accounts
          WHERE id=$4 AND NOT disabled AND password_hash=$5 FOR SHARE)
        INSERT INTO balaqoldau.user_sessions(token_hash,csrf_token,user_id,credential_version,expires_at)
        SELECT $2,$3,u.id,u.credential_version,clock_timestamp()+($6::integer*interval '1 second') FROM consumed,eligible u
        RETURNING user_id`, [userTokenHash(old), userTokenHash(fresh), csrf, id, hash, seconds]);
      return result.rowCount === 1;
    },
    async logout(token: string) { await db.query('DELETE FROM balaqoldau.user_sessions WHERE token_hash=$1', [userTokenHash(token)]); },
    async issueReset(email: string, token: string, seconds: number) {
      return (await db.query<{ email: string }>(`WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS at),
        eligible AS (UPDATE balaqoldau.user_accounts u SET
          reset_attempts=CASE WHEN reset_window_ends<=instant.at THEN 1 ELSE reset_attempts+1 END,
          reset_window_ends=CASE WHEN reset_window_ends<=instant.at THEN instant.at+interval '1 hour' ELSE reset_window_ends END
          FROM instant WHERE email=$1 AND NOT disabled AND (reset_window_ends<=instant.at OR reset_attempts<3)
          RETURNING u.id,u.email,u.credential_version),
        issued AS (INSERT INTO balaqoldau.user_reset_tokens(token_hash,user_id,credential_version,expires_at)
          SELECT $2,id,credential_version,clock_timestamp()+($3::integer*interval '1 second') FROM eligible RETURNING user_id)
        SELECT email FROM eligible JOIN issued ON eligible.id=issued.user_id`, [email, userTokenHash(token), seconds])).rows[0];
    },
    async reset(token: string, hash: string) {
      const result = await db.query(`WITH eligible AS MATERIALIZED (
        SELECT u.id FROM balaqoldau.user_accounts u JOIN balaqoldau.user_reset_tokens t ON t.user_id=u.id
        WHERE t.token_hash=$1 AND t.expires_at>clock_timestamp() AND NOT u.disabled
          AND t.credential_version=u.credential_version FOR UPDATE OF u,t),
        changed AS (UPDATE balaqoldau.user_accounts u SET password_hash=$2,credential_version=credential_version+1,
          login_attempts=0,login_window_ends=clock_timestamp() FROM eligible e WHERE u.id=e.id RETURNING u.id),
        revoked AS (DELETE FROM balaqoldau.user_sessions WHERE user_id IN (SELECT id FROM changed) RETURNING token_hash),
        consumed AS (DELETE FROM balaqoldau.user_reset_tokens WHERE user_id IN (SELECT id FROM changed) RETURNING token_hash)
        SELECT id FROM changed`, [userTokenHash(token), hash]);
      return result.rowCount === 1;
    },
  };
}
