-- Optional parent-managed profiles only. No dates of birth, identity or medical fields.
CREATE TABLE balaqoldau.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES balaqoldau.user_accounts(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 20),
  nickname varchar(30) CHECK (nickname IS NULL OR (length(btrim(nickname)) BETWEEN 1 AND 30 AND nickname !~ '[[:cntrl:]]')),
  age smallint NOT NULL CHECK (age BETWEEN 0 AND 17),
  region_id bigint NOT NULL REFERENCES balaqoldau.regions(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,slot)
);
CREATE TABLE balaqoldau.child_preferences (
  child_id uuid NOT NULL REFERENCES balaqoldau.child_profiles(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES balaqoldau.categories(id) ON DELETE RESTRICT,
  PRIMARY KEY(child_id,category_id)
);
CREATE INDEX child_profiles_region_idx ON balaqoldau.child_profiles(region_id);
CREATE INDEX child_preferences_category_idx ON balaqoldau.child_preferences(category_id,child_id);
REVOKE ALL ON balaqoldau.child_profiles,balaqoldau.child_preferences FROM PUBLIC;
