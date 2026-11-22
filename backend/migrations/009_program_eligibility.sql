-- Additive: old records remain explicitly incomplete. No inferred or backfilled eligibility.
ALTER TABLE balaqoldau.programs ADD COLUMN eligibility_complete boolean NOT NULL DEFAULT false;
CREATE OR REPLACE VIEW balaqoldau.published_programs WITH (security_barrier = true) AS
  SELECT id, slug, category_id, title, description, source_url, source_name,
         verified_at, age_min, age_max, deadline, apply_url, eligibility_complete
  FROM balaqoldau.programs WHERE status = 'published' AND NOT is_demo;
-- Existing table/view grants are retained. No roles or credentials are modified.
