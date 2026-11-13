# Contact privacy and retention — Stage 8.2

Implemented: a separately invoked cleanup command, strict configuration, bounded SQL,
dry-run, identity verification and tests. **No scheduler or automatic deletion is active.**
No existing development/production contact message was deleted during implementation.
The public form/API/schema and Stage 8.1 readiness behavior are unchanged.

## Policy and timestamp

Messages store name, email, message, UUID and DB-assigned `created_at` (timestamptz).
Default retention: **30 × 24 hours from created_at**. Cleanup compares `created_at < cutoff`;
an exact boundary timestamp is preserved. PostgreSQL transaction time computes one UTC
cutoff, preserving microseconds; the workstation clock and caller-supplied dates are
not accepted. All messages are covered, including unread, read and resolved messages. Status changes do not extend retention.

RETENTION_DAYS allows integer **30–365**, default 30. Values below 30 are refused to
prevent accidental shortening. A longer period requires privacy-owner approval and an
accurate public notice; configuration is not permission to retain data without purpose.
RETENTION_BATCH_SIZE allows integer **1–1000**, default 100. Each invocation performs
**one batch only**, oldest first. No unbounded loop, truncate, database reset or hardcoded
credentials. PostgreSQL connection/query/lock timeouts from the existing pool remain.

## Configuration and commands

From backend, first `npm.cmd run build`. Configure the authorized operator's protected
environment or secret manager (do not overwrite the application's .env):

```dotenv
RETENTION_DATABASE_URL=postgresql://YOUR_RETENTION_ROLE@YOUR_DB_HOST:5432/YOUR_APPROVED_DATABASE
RETENTION_EXPECTED_DATABASE=YOUR_APPROVED_DATABASE
RETENTION_DAYS=30
RETENTION_BATCH_SIZE=100
```

Replace placeholders before use; real database names must be lowercase letters/digits/
underscores, start with a letter and fit 63 characters. Production: NODE_ENV=production,
DB_SSL_MODE=verify-full and verified TLS hostname/CA, matching backend security policy.
No fallback to DATABASE_URL exists. URL database name and actual current_database() must
both match RETENTION_EXPECTED_DATABASE. balaqoldau_db and PostgreSQL system databases are
explicitly forbidden. Verify host, owner and environment with the operator before use;
matching database names alone cannot prove a server is the intended production cluster.

Both modes require exactly one flag. Missing, unknown, duplicate or conflicting flags fail
before connecting. These commands are documentation, **not approval to delete real data**:

```powershell
# Read-only transaction; eligible = all old records, wouldDelete = one bounded batch.
npm.cmd run contact:cleanup -- --dry-run

# Only after identity, dry-run review and the operator's authorization:
npm.cmd run contact:cleanup -- --execute
```

Execute holds a transaction-level advisory lock; overlapping cleanup fails safely rather
than running two cleanup batches concurrently. ID selection and DELETE use one statement
and parameterized cutoff/batch values. It rechecks created_at on deletion. Errors before
commit roll back that invocation; a lost commit acknowledgement is handled by safe retry.
Output is JSON with only mode, retentionDays, batchSize, eligible,
wouldDelete and deleted counts. No record IDs, names, emails, bodies, DSNs or passwords.
Dry-run never issues DELETE and the CLI additionally sets the transaction READ ONLY.

Counts are a point-in-time estimate; actual deleted count is authoritative. Other authorized
manual deletions may reduce it. `eligible > deleted` after execution indicates possible
backlog, not a request to remove the batch cap. Review volume and rerun a bounded batch if
authorized. Repeating the command is safe; already removed records are not removed again.

## Least-privilege operator (not provisioned here)

Use a **separate** retention login/secret; do not grant deletion to the public API runtime.
DBA/operator may approve the following permissions on the verified target, separately from
this implementation. No local role, grant or credential was changed:

```sql
-- Required privileges, not executed by this work; CONNECT is also needed on the target DB.
GRANT USAGE ON SCHEMA balaqoldau TO YOUR_RETENTION_ROLE;
GRANT SELECT (id, created_at) ON balaqoldau.contact_messages TO YOUR_RETENTION_ROLE;
GRANT DELETE ON balaqoldau.contact_messages TO YOUR_RETENTION_ROLE;
```

No SELECT of name/email/message, INSERT, UPDATE, TRUNCATE, DDL, ownership or superuser is
needed. No row-level FOR UPDATE is used, so no UPDATE grant is required. Ordinary DB
advisory-lock function access is required. Verify these exact grants in staging: local
integration tests use the existing test login, not a newly provisioned restricted role.

## Authorized early deletion requests

1. Assign a privacy owner and publish a real request channel before public launch. Verify
   the request proportionately through a restricted channel; do not request IIN/medical data.
   This repository does not implement a public deletion API or an admin inbox.
2. An authorized support operator identifies the specific UUID privately. Keep it out of
   tickets/general logs, shell history, URLs and command-line arguments. Retention operators
   do not need access to message contents. Verify database identity before proceeding.
3. In an approved parameter-binding DB tool, bind the verified UUID as `$1`; dry-review the
   count (at most one), then explicitly authorize execution in a transaction:

   ```sql
   -- Review only, using a bound parameter:
   SELECT count(*) FROM balaqoldau.contact_messages WHERE id = $1::uuid;
   -- Separately approved transaction; no RETURNING personal data:
   BEGIN;
   DELETE FROM balaqoldau.contact_messages WHERE id = $1::uuid;
   COMMIT;
   ```

   If identity/count/authorization is uncertain, ROLLBACK and stop. This is not an executable
   psql script: parameters must be bound by the approved client. Never replace the UUID
   predicate with an email/name search or an unbounded DELETE. Record completion time and
   affected count only. Ensure DB/client statement-parameter and error logging do not expose
   the identifier. An earlier verified request may bypass age retention for this one record.

## Scheduling, failures and operations

- **Not installed/configured:** cron, Task Scheduler, external services, automatic retries,
  deletion-request tooling and monitoring. The implementation is a command, not an active job.
- The operator must approve and configure a protected schedule separately. A daily run is
  a starting point only; choose sufficient bounded-run capacity for actual message volume.
  Avoid overlap. Monitor aggregate completion/failure/age/backlog counts without personal data.
  Scheduling commands are intentionally not installed or executed by this stage.
- Missing/unsafe config, identity mismatch, missing grants, lock contention or unavailable DB
  produce exit 1 and a generic message. On failure, do not widen permissions or lower the
  retention threshold. Check the target/connection/permissions privately, dry-run, then retry
  when authorized. If commit succeeded but acknowledgement failed, repeating is idempotent.
- Until scheduling is configured, a named operator must perform approved manual cleanup.
  Do not claim automatic 30-day deletion on the form or in public policy. The current form
  accurately states which fields are sent and warns against sensitive content; it contains
  no automatic-deletion claim and therefore was left unchanged. Before launch, publish a
  full privacy notice and real deletion contact, reflecting actual operations.
- Encrypted backup expiry remains the proposed maximum **30 days**, independently configured.
  Live deletion does not erase old backups immediately. On restore, reapply retention and
  verified early deletions before reopening traffic. Any necessary erasure ledger belongs
  in restricted encrypted operational storage, not application logs. Backup expiry, erasure
  ledger and restore enforcement are **not automated here** and require an approved owner.
- This is an operational policy, not certification of Kazakhstan legal compliance; the
  operator must review applicable obligations before public launch.

## Verification and scope

Integration tests only use balaqoldau_test. Synthetic timestamps straddle the exact cutoff
by one microsecond; dry-run, configurable period, batch size and repeatability are tested.
All fixture DELETEs occur inside a transaction that is rolled back. A CLI dry-run is tested
against the verified test database. No execute CLI command was run on development/production.
No schema migration or external dependency was necessary.

## Stage 16.1 inbox metadata

Migration 014 submission IDs/digests and migration 015 status/version/updated_at remain on the same contact row. Cleanup uses only original created_at, so every status is eligible at the same cutoff and all submission metadata is erased with the row. Inbox has no hard-delete API or scheduler. Admin-only read/status operations use metadata-only security audit; no email/name/body in audit. Existing approved manual deletion and backup procedures still apply. Scheduling remains an operator task; no real development contacts were deleted.
# Reply retention and delivery

Contact replies are private communication and share the contact message's existing retention deadline, measured from the **original contact creation time**, not the reply time. Deleting an eligible contact through the authorized bounded retention command cascades to its reply bodies. This feature does not execute cleanup or configure scheduling. Existing scheduling/manual deletion responsibilities remain in force. Program-report replies persist with their reports; they are not covered by the contact cleanup command and need an operator-approved retention policy before public launch.

Authenticated submissions are linked to the submitting session's account and replies appear in the private account inbox. Historical anonymous submissions are not linked by email. Anonymous contact email is attempted only through a configured existing mail service; acceptance is not guaranteed delivery. Anonymous reports have no email and cannot receive email replies. Message/reply bodies and recipient addresses must never enter application/audit logs. See `backend/CONTACT_API.md` for status semantics and least-privilege grants.
