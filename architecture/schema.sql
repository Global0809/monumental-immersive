-- PROPOSAL / UNAPPLIED: PostgreSQL website foundation, not a deployed database.
-- Review against the identity, billing, media and hosting providers before use.
-- Run with a migration owner, never from the browser. No extensions required.
-- The application server MUST enforce owner/role access and publication rights.
-- No browser-facing database grants or incomplete RLS policies are supplied.
-- Clients cannot choose profile_id or grant membership/entitlements themselves.
BEGIN;
CREATE SCHEMA monumental;
REVOKE ALL ON SCHEMA monumental FROM PUBLIC;
SET LOCAL search_path = monumental, pg_catalog;
ALTER DEFAULT PRIVILEGES IN SCHEMA monumental REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA monumental REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA monumental REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION touch_updated_at() FROM PUBLIC;

CREATE TABLE series (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  title text NOT NULL, description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE categories (id text PRIMARY KEY, label text NOT NULL UNIQUE);
CREATE TABLE places (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  name text NOT NULL, country text NOT NULL, kind text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE people (id text PRIMARY KEY, display_name text NOT NULL, biography text NOT NULL DEFAULT '');
CREATE TABLE periods (id text PRIMARY KEY, label text NOT NULL, description text NOT NULL DEFAULT '');
CREATE TABLE stories (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  title text NOT NULL CHECK (length(title) > 0), description text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '', series_id text REFERENCES series(id),
  episode integer CHECK (episode > 0), duration_seconds numeric(12,3) CHECK (duration_seconds >= 0),
  release_state text NOT NULL CHECK (release_state IN ('development', 'available')),
  original_release_date date, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  CHECK (episode IS NULL OR series_id IS NOT NULL), UNIQUE (series_id, episode)
);
CREATE TABLE story_categories (
  story_id text REFERENCES stories(id) ON DELETE CASCADE,
  category_id text REFERENCES categories(id), PRIMARY KEY (story_id, category_id)
);
CREATE TABLE story_places (
  story_id text REFERENCES stories(id) ON DELETE CASCADE,
  place_id text REFERENCES places(id), PRIMARY KEY (story_id, place_id)
);
CREATE TABLE story_people (
  story_id text REFERENCES stories(id) ON DELETE CASCADE,
  person_id text REFERENCES people(id), credit_role text NOT NULL,
  PRIMARY KEY (story_id, person_id, credit_role)
);
CREATE TABLE story_periods (
  story_id text REFERENCES stories(id) ON DELETE CASCADE,
  period_id text REFERENCES periods(id),
  relationship text CHECK (relationship IN ('made', 'explores')),
  PRIMARY KEY (story_id, period_id, relationship)
);
CREATE TABLE story_tags (
  story_id text REFERENCES stories(id) ON DELETE CASCADE, tag text CHECK (length(tag) > 0),
  PRIMARY KEY (story_id, tag)
);

-- Assets hold metadata and private object keys, not file bytes or permanent premium URLs.
-- The publisher verifies attribution, territory and time windows before publication/playback.
CREATE TABLE assets (
  id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('video', 'image', 'audio', 'caption', 'transcript')),
  storage_key text NOT NULL UNIQUE, mime_type text NOT NULL,
  processing_state text NOT NULL DEFAULT 'pending' CHECK (processing_state IN ('pending', 'processing', 'ready', 'failed')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  creator_credit text NOT NULL, source_url text, license_name text NOT NULL, license_url text,
  provenance_type text NOT NULL CHECK (provenance_type IN ('original', 'licensed', 'public-domain', 'generated')),
  rights_from timestamptz, rights_until timestamptz,
  territory_codes text[] NOT NULL DEFAULT '{}', -- Empty means unspecified, NOT worldwide permission.
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rights_until IS NULL OR rights_from IS NULL OR rights_until > rights_from)
);
CREATE TABLE asset_renditions (
  id text PRIMARY KEY, asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE, format text NOT NULL,
  width integer CHECK (width > 0), height integer CHECK (height > 0),
  bitrate integer CHECK (bitrate > 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE story_assets (
  story_id text REFERENCES stories(id) ON DELETE CASCADE, asset_id text REFERENCES assets(id),
  role text CHECK (role IN ('feature', 'trailer', 'poster', 'caption', 'transcript')),
  language_tag text NOT NULL DEFAULT 'und', PRIMARY KEY (story_id, asset_id, role)
);
CREATE TABLE place_assets (
  place_id text REFERENCES places(id) ON DELETE CASCADE, asset_id text REFERENCES assets(id),
  caption text NOT NULL, PRIMARY KEY (place_id, asset_id)
);
CREATE TABLE story_relationships (
  from_story_id text REFERENCES stories(id) ON DELETE CASCADE,
  to_story_id text REFERENCES stories(id) ON DELETE CASCADE,
  relationship text NOT NULL, explanation text NOT NULL, source_url text,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('shared-metadata', 'editorial', 'documented')),
  PRIMARY KEY (from_story_id, to_story_id, relationship), CHECK (from_story_id <> to_story_id),
  CHECK (evidence_kind <> 'documented' OR source_url IS NOT NULL)
);
CREATE TABLE profiles (
  id text PRIMARY KEY, identity_issuer text NOT NULL, identity_subject text NOT NULL,
  display_name text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (identity_issuer, identity_subject)
);
-- Publication is an editorial gate. Draft AI output never writes a published row directly.
-- A server transaction checks story/media readiness, rights, credits and the publisher's role.
CREATE TABLE publications (
  story_id text PRIMARY KEY REFERENCES stories(id),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'review', 'published', 'archived')),
  access text NOT NULL DEFAULT 'free' CHECK (access IN ('free', 'premium')),
  approved_by text REFERENCES profiles(id), published_at timestamptz,
  catalogue_revision bigint NOT NULL CHECK (catalogue_revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'published' OR (approved_by IS NOT NULL AND published_at IS NOT NULL))
);

-- Private viewer data: derive profile_id from the authenticated session on every request.
-- Guest migration is an explicit merge operation. Never upload local notes automatically.
CREATE TABLE saved_stories (
  profile_id text REFERENCES profiles(id) ON DELETE CASCADE, story_id text REFERENCES stories(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (profile_id, story_id)
);
CREATE TABLE saved_places (
  profile_id text REFERENCES profiles(id) ON DELETE CASCADE, place_id text REFERENCES places(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (profile_id, place_id)
);
CREATE TABLE viewing_progress (
  profile_id text REFERENCES profiles(id) ON DELETE CASCADE, story_id text REFERENCES stories(id),
  position_seconds numeric(12,3) NOT NULL CHECK (position_seconds >= 0),
  duration_seconds numeric(12,3) NOT NULL CHECK (duration_seconds > 0),
  completed boolean NOT NULL DEFAULT false, revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (profile_id, story_id),
  CHECK (position_seconds <= duration_seconds)
);
CREATE TABLE notes (
  id text PRIMARY KEY, profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_id text NOT NULL REFERENCES stories(id), position_seconds integer NOT NULL CHECK (position_seconds >= 0),
  body text NOT NULL CHECK (length(body) <= 2000), revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, story_id, position_seconds)
);
CREATE TABLE journeys (
  id text PRIMARY KEY, profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE journey_items (
  journey_id text REFERENCES journeys(id) ON DELETE CASCADE,
  position integer CHECK (position >= 0), story_id text NOT NULL REFERENCES stories(id),
  PRIMARY KEY (journey_id, position)
);

-- Only verified provider webhooks/reconciliation can change subscription authority.
-- Billing amounts, product catalogues and provider-specific states need provider design.
CREATE TABLE subscriptions (
  id text PRIMARY KEY, profile_id text NOT NULL REFERENCES profiles(id),
  provider text NOT NULL, provider_subscription_id text NOT NULL, provider_product_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'active', 'past-due', 'cancelled', 'expired')),
  access_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id), UNIQUE (id, profile_id)
);
CREATE TABLE entitlements (
  id text PRIMARY KEY, profile_id text NOT NULL REFERENCES profiles(id), subscription_id text,
  scope text NOT NULL CHECK (scope IN ('catalogue', 'story')), story_id text REFERENCES stories(id),
  starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (subscription_id, profile_id) REFERENCES subscriptions(id, profile_id),
  CHECK ((scope = 'catalogue' AND story_id IS NULL) OR (scope = 'story' AND story_id IS NOT NULL)),
  CHECK (expires_at > starts_at)
);
CREATE TABLE webhook_receipts (
  provider text NOT NULL, event_id text NOT NULL, payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  state text NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), last_error text,
  PRIMARY KEY (provider, event_id)
);
-- Signature verification happens BEFORE receipt insertion. Process receipt, subscription
-- and outbox event in one transaction; retries deduplicate by provider/event ID.
CREATE TABLE outbox_events (
  id text PRIMARY KEY, event_type text NOT NULL, aggregate_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz, attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_at timestamptz, last_error text
);
-- Outbox payloads contain IDs/minimal metadata, not private notes, credentials or film bytes.
-- Workers claim using FOR UPDATE SKIP LOCKED, recover stale locks and handle idempotently.
CREATE TABLE audit_events (
  id text PRIMARY KEY, actor_profile_id text REFERENCES profiles(id), action text NOT NULL,
  entity_type text NOT NULL, entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX story_categories_lookup ON story_categories(category_id, story_id);
CREATE INDEX story_places_lookup ON story_places(place_id, story_id);
CREATE INDEX story_people_lookup ON story_people(person_id, story_id);
CREATE INDEX story_periods_lookup ON story_periods(period_id, relationship, story_id);
CREATE INDEX story_tags_lookup ON story_tags(tag, story_id);
CREATE INDEX publications_browse ON publications(state, published_at DESC, story_id);
CREATE INDEX asset_renditions_asset ON asset_renditions(asset_id);
CREATE INDEX story_assets_asset ON story_assets(asset_id);
CREATE INDEX relationships_target ON story_relationships(to_story_id);
CREATE INDEX viewing_progress_recent ON viewing_progress(profile_id, updated_at DESC);
CREATE INDEX notes_owner ON notes(profile_id, updated_at DESC);
CREATE INDEX journeys_owner ON journeys(profile_id, updated_at DESC);
CREATE INDEX subscriptions_owner ON subscriptions(profile_id, state);
CREATE INDEX entitlements_authorize ON entitlements(profile_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX outbox_pending ON outbox_events(available_at, created_at) WHERE processed_at IS NULL;
CREATE INDEX audit_entity ON audit_events(entity_type, entity_id, created_at DESC);

-- updated_at is automatic; API updates MUST compare/increment revision atomically where
-- present, returning a conflict instead of silently overwriting a newer user/editor change.
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['series', 'places', 'stories', 'assets', 'profiles',
      'publications', 'viewing_progress', 'notes', 'journeys', 'subscriptions'] LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON monumental.%I FOR EACH ROW EXECUTE FUNCTION monumental.touch_updated_at()', relation_name);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA monumental FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA monumental FROM PUBLIC;
-- Deployment must create least-privilege runtime roles and explicit grants. Use a
-- separate migration owner. Do not grant the app ownership or browser/direct SQL access.
-- Audit writes should be append-only for runtime roles. Account deletion, audit retention,
-- backups/restore, rights revocation, guest merge and API ownership checks require services.
COMMIT;
