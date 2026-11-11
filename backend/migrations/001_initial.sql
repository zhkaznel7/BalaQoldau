CREATE TABLE balaqoldau.categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0)
);
CREATE TABLE balaqoldau.regions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0)
);
CREATE TABLE balaqoldau.family_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug varchar(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0)
);
CREATE TABLE balaqoldau.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(120) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id bigint NOT NULL REFERENCES balaqoldau.categories(id) ON DELETE RESTRICT,
  title varchar(240) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 10000),
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
  is_demo boolean NOT NULL DEFAULT false,
  source_url varchar(2048) CHECK (source_url ~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'),
  source_name varchar(200) CHECK (length(btrim(source_name)) > 0),
  verified_at timestamptz,
  age_min smallint NOT NULL DEFAULT 0,
  age_max smallint NOT NULL DEFAULT 17,
  deadline date,
  apply_url varchar(2048) CHECK (apply_url ~ '^https://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT age_range CHECK (age_min >= 0 AND age_max <= 17 AND age_min <= age_max),
  CONSTRAINT verification_required CHECK (status = 'draft' OR
    (source_url IS NOT NULL AND source_name IS NOT NULL AND verified_at IS NOT NULL)),
  CONSTRAINT demo_stays_draft CHECK (NOT is_demo OR status = 'draft')
);
CREATE INDEX programs_category_idx ON balaqoldau.programs(category_id);
CREATE INDEX programs_published_deadline_idx ON balaqoldau.programs(deadline, id) WHERE status = 'published' AND NOT is_demo;
CREATE INDEX programs_status_idx ON balaqoldau.programs(status);
CREATE TABLE balaqoldau.program_regions (
  program_id uuid NOT NULL REFERENCES balaqoldau.programs(id) ON DELETE CASCADE,
  region_id bigint NOT NULL REFERENCES balaqoldau.regions(id) ON DELETE RESTRICT,
  PRIMARY KEY (program_id, region_id)
);
CREATE INDEX program_regions_region_idx ON balaqoldau.program_regions(region_id, program_id);
CREATE TABLE balaqoldau.program_family_categories (
  program_id uuid NOT NULL REFERENCES balaqoldau.programs(id) ON DELETE CASCADE,
  family_category_id bigint NOT NULL REFERENCES balaqoldau.family_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (program_id, family_category_id)
);
CREATE INDEX program_family_categories_family_idx ON balaqoldau.program_family_categories(family_category_id, program_id);
-- No submission endpoint or collection is enabled. No IIN or medical fields.
CREATE TABLE balaqoldau.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name varchar(100) NOT NULL CHECK (length(btrim(sender_name)) > 0),
  email varchar(254) NOT NULL CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_messages_created_idx ON balaqoldau.contact_messages(created_at);
CREATE VIEW balaqoldau.published_programs WITH (security_barrier = true) AS
  SELECT id, slug, category_id, title, description, source_url, source_name,
         verified_at, age_min, age_max, deadline, apply_url
  FROM balaqoldau.programs WHERE status = 'published' AND NOT is_demo;
REVOKE ALL ON ALL TABLES IN SCHEMA balaqoldau FROM PUBLIC;
