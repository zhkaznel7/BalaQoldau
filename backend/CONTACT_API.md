# Stage 16.1 — Contact submission and Admin inbox

The existing public form, submissionId/digest repository, admin sessions, same-origin
cookies, CSRF, RBAC, transaction helper and immutable audit log are reused. Replies may
reuse the optional existing local mail adapter; no external service, dependency or automatic deletion job is added.

## Public submission

`POST /api/contact-messages` accepts strict JSON:

```json
{"senderName":"TEST","email":"test@example.com","message":"TEST only","submissionId":"11111111-1111-4111-8111-111111111111"}
```

Name/email/message limits and five requests/IP/15-minute protection are unchanged.
submissionId is optional for existing clients; the UI sends a random UUID. The server
hashes the normalized field tuple already validated by Zod. Insert succeeds before
201 `{data:{id}}`; SQL errors never return success. No body, email or name is echoed.
There is no public list/detail endpoint. Public requests omit authentication credentials.

An identical ID/digest replay returns the original ID, without inserting/updating a
message. Reusing an ID with different content returns generic 409 CONTACT_CONFLICT.
014's unique index arbitrates concurrent inserts; conflict retrieval uses a subsequent
query snapshot. No UPDATE privilege is needed for public idempotency. All values are
SQL parameters. Requests, including replays, consume the spam budget.

The UI retains inputs/key after ambiguous network failure, including a whitespace-only
edit with the same normalized content. Changed content gets a new key on submission;
confirmed success clears inputs/key. No automatic write retry or PII browser storage
is added. Idempotency covers explicit key replay while its row exists; refresh/new
logical messages can use new keys, and retention erasure ends that key's replay window.

## Private APIs and permission

Only the Admin role has new `contacts:manage`; Editor and Reviewer receive 403.
Missing/expired sessions receive 401. The UI permission check is not authorization:
the backend rechecks session/role inside the transaction for every operation.

| Method/path | Contract |
|---|---|
| GET `/api/admin/contact-messages` | page 1–10000, limit 1–50/default 20, optional status; returns data/pagination/unreadCount |
| GET `/api/admin/contact-messages/:uuid` | Full message, no submission digest/key; 404 when absent |
| POST `/api/admin/contact-messages/:uuid` | Strict `{version,status}`, current Origin + session-bound CSRF |

List rows contain ID, sender name/email, 160-character plaintext preview, status,
version and timestamps. Full body is detail-only. No personal-data search parameters
are supported. Responses are no-store; user text renders as text, never HTML.

Stored `unread` is displayed as NEW; then `read` and `resolved`. Allowed transitions:
unread → read; read → resolved/unread; resolved → read (reopen). Version mismatch or
invalid transition returns 409; concurrent writes lock the row and never silently
overwrite status. Failures require explicit reload before another UI write.

Status update and audit insert are atomic. Reads/status actions log actor/target UUIDs,
permission, event and database time only. Events are contact.inbox_viewed, contact.viewed,
contact.read, contact.resolved, contact.reopened. Audit failure rolls back and fails
safely. No sender, email, message, token or digest is copied into audit/log messages.
This inbox is separate from `/admin/reports`, which handles program misinformation.

## Migrations and production permissions

014_contact_submission.sql was already applied and remains byte-for-byte unchanged.
Additive 015 adds status/version/updated_at defaults and an inbox pagination index,
plus contact permission/audit event constraints. Existing messages become unread;
sender/email/body/created_at and all submission IDs/digests are preserved. No program,
user, child or audit records are rewritten. Runner checksums and idempotency remain.
Local application was guarded by a verified balaqoldau_dev identity; no other DB used.

An authorized production operator must extend the existing runtime grants (not done
locally): SELECT the contact fields used above plus submission_id/submission_digest;
INSERT only sender_name,email,message,submission_id,submission_digest; UPDATE only
status,version,updated_at. Runtime must not DELETE/TRUNCATE, alter stored bodies or
supply IDs/timestamps. Production admin startup fails closed on unsafe/missing grants.
The existing narrow audit INSERT grant is reused. Migrations use a separate role.

## Privacy, retention and operations

The existing [retention policy](../docs/CONTACT_RETENTION.md) applies to **all statuses**:
default 30 days from original created_at; reading/resolving/reopening does not extend it.
Deletion removes body, sender/email, key and digest together. The existing explicitly
invoked bounded cleanup/dry-run command and authorized manual UUID deletion procedure
remain. **Scheduling is not configured**; no automatic deletion claim is made.
Do not run cleanup on real local messages during QA. Operators own approved scheduling,
failure alerts, backup expiry/restore erasures and proxy/APM body redaction. No deletion
button or mail-sending integration is implemented by the inbox.

## Manual verification

1. Run the usual local backend/frontend; open http://localhost:5173/contact?lang=kk
   (or `?lang=ru`). Submit an explicitly TEST-labelled synthetic message.
2. DevTools POST response is 201 with its UUID. In pgAdmin, run `SELECT current_database()`;
   stop unless it is balaqoldau_dev. Verify without printing message/PII:
   `SELECT id,status,created_at FROM balaqoldau.contact_messages WHERE id='RESPONSE_UUID';`
3. Log in using an authorized Admin at http://localhost:5173/admin/login.
4. Open http://localhost:5173/admin/messages, inspect unread count/filter, open the TEST
   row, mark READ and RESOLVED. Refresh: status persists. Reopen if required.
5. Editor/Reviewer must not have access, including direct URLs/API calls. Use the
   automated rollback QA for negative cases rather than manipulating real accounts.

From project root, safe complete browser regression (requires existing Chrome):

```powershell
npm run build --prefix backend
npm run build --prefix balaqoldau
node --env-file=backend/.env balaqoldau/tests/contact-inbox-browser.mjs
```

It verifies the real form/API/database/login/inbox in both languages, a lost successful
response and stable retry key, status persistence, plaintext/XSS protection, filtering
and five viewport widths. All synthetic records are inside a rollback transaction.
## Replies (contact messages and program error reports)

- `GET/POST /api/admin/contact-messages/:id/replies`: existing `contacts:manage` (Admin).
- `GET/POST /api/admin/reports/:id/replies`: existing `programs:review` (Reviewer/Admin).
- POST JSON: `{ "submissionId": "UUID", "text": "reply" }`; requires existing admin session, same-origin CSRF token and JSON. Text is trimmed, 1–2000 characters, bounded plain text; control characters rejected.
- Replies are separate from processing statuses. `replied` is derived from reply existence; unread/read/resolved and open/reviewed/resolved/dismissed transitions and revisions are unchanged. GET returns the latest 50 replies. Saved replies record author UUID, creation time, delivery status and delivery timestamp; audit logs contain UUID metadata only. No reply edit/delete endpoint.
- Idempotency key is bound to target, body and administrator. A replay returns the saved reply without sending another email. Saving/auditing is transactional. Email dispatch happens only after the save commits. No automatic retries or external scheduler.
- Authenticated submissions use `POST /api/auth/contact-messages` and `POST /api/auth/programs/:id/reports` with the **unchanged** body contracts and existing regular-user session/CSRF. Ownership comes only from the active session; the editable contact email does not determine account ownership. These submissions have a 5/15-minute IP limit, in addition to existing authentication limits. Anonymous public endpoints remain available.
- `GET /api/auth/messages?page=1&limit=20` returns replies exclusively for the active account (maximum 50/page). The UI is `/profile/messages?lang=kk` or `?lang=ru`. Account replies use `deliveryStatus: account`: available in the account, not an email claim.
- Anonymous contacts can use the existing optional `USER_MAIL_COMMAND`/`USER_MAIL_FROM` local sendmail-compatible service. No credentials or new provider are introduced. Only a successful service exit is `email_accepted`; that means accepted by the service, **not confirmed inbox delivery**. Missing service, service failure, or ambiguous post-send database failure remains `saved_not_delivered`. Operators must investigate ambiguous outcomes before manually composing another reply; there is no blind resend endpoint.
- Anonymous program reports collect no email. Historical submissions without `user_id` remain anonymous; never retroactively associate by email. Replies to these reports can be saved but cannot be delivered. The admin UI explicitly says “Saved, not delivered”.
- Migration `017_inbox_replies.sql` is additive. Contact/report owner UUIDs are nullable foreign keys; reply parents use cascading deletion so the existing contact retention command also removes associated reply bodies. Admin UUID uses RESTRICT. No existing messages/programs/accounts are rewritten.

Production grants (operator action only; no roles changed locally): runtime needs SELECT on `inbox_replies`, INSERT only `(contact_id,report_id,admin_id,submission_id,body,delivery_status,delivered_at)`, UPDATE only `(delivery_status,delivered_at)`; never UPDATE body/author/target, DELETE, TRUNCATE, TRIGGER or table ownership. Existing contact/report INSERT allowlists additionally need `user_id`; contact SELECT also needs `user_id`. Preserve existing status-only UPDATE grants and append-only audit protections. Production privilege gates validate the new allowlists.

Safe local checks: `node --env-file=backend/.env --test backend/tests/users/replies.test.mjs`; browser: `node --env-file=backend/.env balaqoldau/tests/replies-browser.mjs` (build both projects first). The helper verifies `balaqoldau_dev` before migrations; test fixtures roll back. Never use an unrelated database or a real email adapter in automated tests.

