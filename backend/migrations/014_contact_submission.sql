-- Prevent duplicate contact form submissions.
-- Existing contact messages are preserved.

ALTER TABLE balaqoldau.contact_messages
    ADD COLUMN submission_id uuid,
    ADD COLUMN submission_digest text;

CREATE UNIQUE INDEX contact_messages_submission_id_unique
    ON balaqoldau.contact_messages (submission_id);

ALTER TABLE balaqoldau.contact_messages
    ADD CONSTRAINT contact_submission_pair_check
    CHECK (
        (submission_id IS NULL AND submission_digest IS NULL)
        OR
        (submission_id IS NOT NULL AND submission_digest IS NOT NULL)
    );