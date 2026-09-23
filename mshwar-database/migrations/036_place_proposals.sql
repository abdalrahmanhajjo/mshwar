-- 036_place_proposals.sql
-- G4 of the supply-side pivot: guides propose new places and corrections.
--
-- Guides know places the catalogue does not, and notice when a listing is wrong.
-- A proposal is never a direct edit: it carries evidence (at least one source
-- URL, kept with the proposal), goes to a reviewer, and only an accepted
-- proposal touches the catalogue. A correction also opens a data-quality issue
-- on the listing it targets, so it shows in the queue operators already work.
--
-- Photos come either from the guide (who grants Mshwar the right to publish
-- them) or from Wikimedia Commons under a licence on the importer's allow-list;
-- the API checks the licence, the table records it.
--
-- New guides get a small daily allowance; each accepted proposal raises it.

-- ---- Tables -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.place_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id),
    kind text NOT NULL CHECK (kind IN ('new', 'correction')),
    target_experience_id uuid REFERENCES app.experiences(id),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    evidence_urls text[] NOT NULL CHECK (cardinality(evidence_urls) BETWEEN 1 AND 5),
    status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn')),
    reviewer_id uuid REFERENCES app.users(id),
    reviewed_at timestamptz,
    reason text NOT NULL DEFAULT '',
    resulting_experience_id uuid REFERENCES app.experiences(id),
    data_quality_issue_id uuid REFERENCES app.data_quality_issues(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (kind = 'new' OR target_experience_id IS NOT NULL),
    CHECK (status <> 'accepted' OR resulting_experience_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS place_proposals_guide_idx ON app.place_proposals (guide_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS place_proposals_status_idx ON app.place_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS place_proposals_result_idx ON app.place_proposals (resulting_experience_id)
    WHERE status = 'accepted';

CREATE TABLE IF NOT EXISTS app.place_proposal_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES app.place_proposals(id) ON DELETE CASCADE,
    source text NOT NULL CHECK (source IN ('guide-upload', 'wikimedia-commons')),
    provider text NOT NULL CHECK (provider IN ('imagekit', 'local', 'external')),
    object_key text NOT NULL,
    provider_file_id text,
    content_type text,
    byte_size bigint CHECK (byte_size IS NULL OR byte_size > 0),
    width integer,
    height integer,
    source_url text,
    license text NOT NULL,
    license_url text,
    attribution text NOT NULL,
    alt_text text NOT NULL DEFAULT '',
    rights_granted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- The guide's own photo needs the guide's grant; a Commons photo needs its source.
    CHECK (source <> 'guide-upload' OR rights_granted),
    CHECK (source <> 'wikimedia-commons' OR source_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS place_proposal_photos_idx ON app.place_proposal_photos (proposal_id);

ALTER TABLE app.place_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE app.place_proposal_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_proposal_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposal_author ON app.place_proposals;
CREATE POLICY proposal_author ON app.place_proposals FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = place_proposals.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = place_proposals.guide_profile_id AND g.user_id = app.current_user_id()));
DROP POLICY IF EXISTS proposal_photo_author ON app.place_proposal_photos;
CREATE POLICY proposal_photo_author ON app.place_proposal_photos FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.place_proposals p JOIN app.guide_profiles g ON g.id = p.guide_profile_id
                   WHERE p.id = place_proposal_photos.proposal_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.place_proposals p JOIN app.guide_profiles g ON g.id = p.guide_profile_id
                   WHERE p.id = place_proposal_photos.proposal_id AND g.user_id = app.current_user_id()));
GRANT SELECT, INSERT, UPDATE ON app.place_proposals, app.place_proposal_photos TO mshwar_backend;

-- Guide records join the audit log like every other consequential table.
DO $$ DECLARE n text; BEGIN
    FOREACH n IN ARRAY ARRAY['guide_profiles', 'guide_credentials', 'guide_engagements', 'place_proposals'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit ON app.%I', n);
        EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.audit_change()', n);
    END LOOP;
END $$;

-- ---- The reputation gate -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_proposal_allowance(p_profile uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH counts AS (
        SELECT
            count(*) FILTER (WHERE status = 'accepted') AS accepted,
            count(*) FILTER (WHERE status = 'rejected') AS rejected,
            count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS used
        FROM app.place_proposals WHERE guide_profile_id = p_profile
    )
    SELECT jsonb_build_object(
        'accepted', accepted,
        'rejected', rejected,
        'used', used,
        -- Two a day to start; every accepted proposal adds two, up to twenty.
        'daily_cap', least(20, 2 + 2 * accepted)::integer,
        'remaining', greatest(0, least(20, 2 + 2 * accepted) - used)::integer
    ) FROM counts;
$$;

-- ---- Reading --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.place_proposal_json(p_proposal uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', p.id,
        'kind', p.kind,
        'status', p.status,
        'payload', p.payload,
        'evidence_urls', to_jsonb(p.evidence_urls),
        'reason', p.reason,
        'created_at', p.created_at,
        'reviewed_at', p.reviewed_at,
        'target', CASE WHEN p.target_experience_id IS NULL THEN NULL ELSE (
            SELECT jsonb_build_object(
                'id', e.id, 'slug', e.slug, 'title', e.title, 'description', e.description,
                'address', v.address, 'lat', ST_Y(v.location::geometry), 'lng', ST_X(v.location::geometry)
            )
            FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id WHERE e.id = p.target_experience_id
        ) END,
        'resulting_slug', (SELECT slug FROM app.experiences WHERE id = p.resulting_experience_id),
        'photos', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', ph.id, 'source', ph.source, 'provider', ph.provider, 'object_key', ph.object_key,
                'source_url', ph.source_url, 'license', ph.license, 'license_url', ph.license_url,
                'attribution', ph.attribution, 'alt_text', ph.alt_text
            ) ORDER BY ph.created_at)
            FROM app.place_proposal_photos ph WHERE ph.proposal_id = p.id
        ), '[]'::jsonb),
        'guide', jsonb_build_object('id', g.id, 'slug', g.slug, 'display_name', g.display_name, 'tier', g.tier)
    )
    FROM app.place_proposals p JOIN app.guide_profiles g ON g.id = p.guide_profile_id
    WHERE p.id = p_proposal;
$$;

CREATE OR REPLACE FUNCTION app.guide_list_proposals(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    RETURN jsonb_build_object(
        'allowance', app.guide_proposal_allowance(g.id),
        'proposals', coalesce((
            SELECT jsonb_agg(app.place_proposal_json(p.id) ORDER BY p.created_at DESC)
            FROM app.place_proposals p WHERE p.guide_profile_id = g.id
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- Submitting -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_submit_proposal(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_kind text := p_payload->>'kind';
    v_body jsonb := coalesce(p_payload->'place', '{}'::jsonb);
    v_evidence text[];
    v_url text;
    v_target app.experiences;
    v_lat double precision;
    v_lng double precision;
    v_near text;
    v_id uuid;
    v_issue uuid;
    v_allow jsonb := app.guide_proposal_allowance(g.id);
    v_fields text[];
BEGIN
    IF (v_allow->>'remaining')::integer <= 0 THEN
        RAISE EXCEPTION 'daily proposal limit reached (% a day)', v_allow->>'daily_cap' USING ERRCODE = '53400';
    END IF;
    v_evidence := ARRAY(
        SELECT btrim(value) FROM jsonb_array_elements_text(coalesce(p_payload->'evidence_urls', '[]'::jsonb))
        WHERE btrim(value) <> ''
    );
    IF cardinality(v_evidence) = 0 THEN
        RAISE EXCEPTION 'add at least one source link that shows this is right' USING ERRCODE = '22023';
    END IF;
    IF cardinality(v_evidence) > 5 THEN
        RAISE EXCEPTION 'five source links at most' USING ERRCODE = '22023';
    END IF;
    FOREACH v_url IN ARRAY v_evidence LOOP
        IF v_url !~* '^https?://[^\s/]+\.[^\s]+$' OR length(v_url) > 500 THEN
            RAISE EXCEPTION 'not a web address: %', left(v_url, 80) USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF v_kind = 'new' THEN
        IF length(btrim(coalesce(v_body->>'name', ''))) NOT BETWEEN 3 AND 140 THEN
            RAISE EXCEPTION 'name the place (3 to 140 characters)' USING ERRCODE = '22023';
        END IF;
        IF length(btrim(coalesce(v_body->>'description', ''))) NOT BETWEEN 20 AND 4000 THEN
            RAISE EXCEPTION 'describe the place in at least 20 characters' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM app.taxonomy WHERE kind = 'category' AND slug = v_body->>'category' AND active) THEN
            RAISE EXCEPTION 'unknown category' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM app.destinations WHERE slug = v_body->>'destination_slug') THEN
            RAISE EXCEPTION 'unknown destination' USING ERRCODE = '22023';
        END IF;
        v_lat := (v_body->>'lat')::double precision;
        v_lng := (v_body->>'lng')::double precision;
        IF v_lat IS NULL OR v_lng IS NULL OR v_lat NOT BETWEEN 33.0 AND 34.8 OR v_lng NOT BETWEEN 35.0 AND 36.7 THEN
            RAISE EXCEPTION 'the pin has to be in Lebanon' USING ERRCODE = '22023';
        END IF;
        IF coalesce((v_body->>'suggested_minutes')::integer, 60) NOT BETWEEN 15 AND 600 THEN
            RAISE EXCEPTION 'suggested visit time must be 15 to 600 minutes' USING ERRCODE = '22023';
        END IF;
        -- Already there? Same name within a few hundred metres is the same place.
        SELECT e.slug INTO v_near
        FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
        WHERE e.status = 'published'
          AND app.slugify(e.title) = app.slugify(v_body->>'name')
          AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, 400)
        LIMIT 1;
        IF v_near IS NOT NULL THEN
            RAISE EXCEPTION 'this place is already in the catalogue: %', v_near USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.place_proposals (guide_profile_id, kind, payload, evidence_urls)
        VALUES (
            g.id, 'new',
            jsonb_strip_nulls(jsonb_build_object(
                'name', btrim(v_body->>'name'),
                'description', btrim(v_body->>'description'),
                'category', v_body->>'category',
                'destination_slug', v_body->>'destination_slug',
                'address', NULLIF(btrim(coalesce(v_body->>'address', '')), ''),
                'lat', v_lat, 'lng', v_lng,
                'setting', CASE WHEN v_body->>'setting' IN ('indoor', 'outdoor', 'mixed') THEN v_body->>'setting' END,
                'listing_kind', CASE WHEN v_body->>'listing_kind' IN ('experience', 'attraction', 'restaurant')
                                     THEN v_body->>'listing_kind' END,
                'suggested_minutes', coalesce((v_body->>'suggested_minutes')::integer, 60),
                'free_entry', (v_body->>'free_entry')::boolean
            )),
            v_evidence
        ) RETURNING id INTO v_id;
    ELSIF v_kind = 'correction' THEN
        SELECT * INTO v_target FROM app.experiences WHERE slug = p_payload->>'target_slug' AND status = 'published';
        IF v_target.id IS NULL THEN
            RAISE EXCEPTION 'place not found' USING ERRCODE = 'P0002';
        END IF;
        v_fields := ARRAY(
            SELECT key FROM jsonb_each(v_body)
            WHERE key IN ('title', 'description', 'address', 'lat', 'lng', 'closed')
              AND jsonb_typeof(value) <> 'null' AND value <> '""'::jsonb
        );
        IF cardinality(v_fields) = 0 THEN
            RAISE EXCEPTION 'say what is wrong: a new title, description, address, pin, or that it closed'
                USING ERRCODE = '22023';
        END IF;
        IF (v_body ? 'lat') <> (v_body ? 'lng') THEN
            RAISE EXCEPTION 'a new pin needs both latitude and longitude' USING ERRCODE = '22023';
        END IF;
        IF v_body ? 'lat' AND ((v_body->>'lat')::double precision NOT BETWEEN 33.0 AND 34.8
                               OR (v_body->>'lng')::double precision NOT BETWEEN 35.0 AND 36.7) THEN
            RAISE EXCEPTION 'the pin has to be in Lebanon' USING ERRCODE = '22023';
        END IF;
        IF EXISTS (
            SELECT 1 FROM app.place_proposals
            WHERE guide_profile_id = g.id AND target_experience_id = v_target.id AND status = 'submitted'
        ) THEN
            RAISE EXCEPTION 'you already have a correction waiting on this place' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.place_proposals (guide_profile_id, kind, target_experience_id, payload, evidence_urls)
        VALUES (
            g.id, 'correction', v_target.id,
            (SELECT jsonb_object_agg(key, value) FROM jsonb_each(v_body) WHERE key = ANY (v_fields || 'note'::text)),
            v_evidence
        ) RETURNING id INTO v_id;
        -- The existing data-quality queue sees it too.
        INSERT INTO app.data_quality_issues (experience_id, rule_code, details, organization_id, fingerprint)
        VALUES (
            v_target.id, 'guide_correction',
            jsonb_build_object('proposal_id', v_id, 'fields', to_jsonb(v_fields), 'guide', g.display_name),
            v_target.organization_id, 'guide-correction:' || v_id
        ) RETURNING id INTO v_issue;
        UPDATE app.place_proposals SET data_quality_issue_id = v_issue WHERE id = v_id;
    ELSE
        RAISE EXCEPTION 'kind must be new or correction' USING ERRCODE = '22023';
    END IF;
    RETURN app.place_proposal_json(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_withdraw_proposal(p_user uuid, p_proposal uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    p app.place_proposals;
BEGIN
    SELECT * INTO p FROM app.place_proposals WHERE id = p_proposal AND guide_profile_id = g.id FOR UPDATE;
    IF p.id IS NULL THEN
        RAISE EXCEPTION 'proposal not found' USING ERRCODE = 'P0002';
    END IF;
    IF p.status <> 'submitted' THEN
        RAISE EXCEPTION 'only a waiting proposal can be withdrawn' USING ERRCODE = '22023';
    END IF;
    UPDATE app.place_proposals SET status = 'withdrawn', updated_at = now() WHERE id = p.id;
    UPDATE app.data_quality_issues SET status = 'ignored', resolved_at = now()
    WHERE id = p.data_quality_issue_id AND status = 'open';
    RETURN app.place_proposal_json(p.id);
END;
$$;

-- The API has already checked the file (or the Commons licence); this records it.
CREATE OR REPLACE FUNCTION app.guide_attach_proposal_photo(p_user uuid, p_proposal uuid, p_photo jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    p app.place_proposals;
BEGIN
    SELECT * INTO p FROM app.place_proposals WHERE id = p_proposal AND guide_profile_id = g.id FOR UPDATE;
    IF p.id IS NULL THEN
        RAISE EXCEPTION 'proposal not found' USING ERRCODE = 'P0002';
    END IF;
    IF p.status <> 'submitted' THEN
        RAISE EXCEPTION 'photos can only be added while the proposal is waiting' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM app.place_proposal_photos WHERE proposal_id = p.id) >= 4 THEN
        RAISE EXCEPTION 'four photos at most' USING ERRCODE = '53400';
    END IF;
    IF p_photo->>'source' = 'guide-upload' AND coalesce((p_photo->>'rights_granted')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'confirm you took this photo and let Mshwar publish it' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.place_proposal_photos (
        proposal_id, source, provider, object_key, provider_file_id, content_type, byte_size, width, height,
        source_url, license, license_url, attribution, alt_text, rights_granted
    ) VALUES (
        p.id, p_photo->>'source', p_photo->>'provider', p_photo->>'object_key', p_photo->>'provider_file_id',
        p_photo->>'content_type', NULLIF(p_photo->>'byte_size', '')::bigint,
        NULLIF(p_photo->>'width', '')::integer, NULLIF(p_photo->>'height', '')::integer,
        p_photo->>'source_url',
        CASE WHEN p_photo->>'source' = 'guide-upload' THEN 'Contributor grant to Mshwar' ELSE p_photo->>'license' END,
        p_photo->>'license_url',
        CASE WHEN p_photo->>'source' = 'guide-upload' THEN g.display_name
             ELSE coalesce(NULLIF(btrim(p_photo->>'attribution'), ''), 'Wikimedia Commons') END,
        left(coalesce(p_photo->>'alt_text', ''), 200),
        coalesce((p_photo->>'rights_granted')::boolean, false)
    );
    RETURN app.place_proposal_json(p.id);
END;
$$;

-- ---- Reviewing --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_list_proposals(p_admin uuid, p_status text DEFAULT 'submitted')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(app.place_proposal_json(p.id) || jsonb_build_object(
            'allowance', app.guide_proposal_allowance(p.guide_profile_id)
        ) ORDER BY p.created_at)
        FROM app.place_proposals p
        WHERE p_status IS NULL OR p.status = p_status
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_decide_proposal(p_admin uuid, p_proposal uuid, p_decision text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    p app.place_proposals;
    g app.guide_profiles;
    b jsonb;
    v_org uuid;
    v_dest app.destinations;
    v_venue uuid;
    v_exp uuid;
    v_slug text;
    v_n integer := 1;
    v_term uuid;
    v_photo app.place_proposal_photos;
    v_order integer := 0;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO p FROM app.place_proposals WHERE id = p_proposal FOR UPDATE;
    IF p.id IS NULL THEN
        RAISE EXCEPTION 'proposal not found' USING ERRCODE = 'P0002';
    END IF;
    IF p.status <> 'submitted' THEN
        RAISE EXCEPTION 'this proposal has already been decided' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO g FROM app.guide_profiles WHERE id = p.guide_profile_id;
    PERFORM set_config('app.reason', coalesce(p_reason, ''), true);
    b := p.payload;

    IF p_decision = 'rejected' THEN
        IF NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN
            RAISE EXCEPTION 'tell the guide why' USING ERRCODE = '22023';
        END IF;
        UPDATE app.place_proposals
        SET status = 'rejected', reviewer_id = p_admin, reviewed_at = now(), reason = left(p_reason, 500),
            updated_at = now()
        WHERE id = p.id;
        UPDATE app.data_quality_issues SET status = 'ignored', resolved_at = now()
        WHERE id = p.data_quality_issue_id AND status = 'open';
    ELSIF p_decision = 'accepted' THEN
        IF p.kind = 'new' THEN
            SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';
            IF v_org IS NULL THEN
                RAISE EXCEPTION 'catalogue organisation missing' USING ERRCODE = 'P0002';
            END IF;
            PERFORM set_config('app.organization_id', v_org::text, true);
            SELECT * INTO v_dest FROM app.destinations WHERE slug = b->>'destination_slug';
            INSERT INTO app.venues (organization_id, destination_id, name, address, timezone, location,
                                    location_source, source_reference)
            VALUES (
                v_org, v_dest.id, b->>'name', coalesce(b->>'address', b->>'name'), 'Asia/Beirut',
                ST_SetSRID(ST_MakePoint((b->>'lng')::double precision, (b->>'lat')::double precision), 4326)::geography,
                'guide-proposal', 'proposal:' || p.id
            ) RETURNING id INTO v_venue;
            v_slug := app.slugify(b->>'name');
            WHILE EXISTS (SELECT 1 FROM app.experiences WHERE slug = v_slug) LOOP
                v_n := v_n + 1;
                v_slug := app.slugify(b->>'name') || '-' || v_n;
            END LOOP;
            INSERT INTO app.experiences (
                organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes,
                min_party, max_party, setting, weather_sensitivity, listing_kind, inventory_available,
                catalogue_summary, catalogue_facts
            ) VALUES (
                v_org, v_venue, v_slug, b->>'name', b->>'description', 'published', 'inquiry',
                coalesce((b->>'suggested_minutes')::integer, 60), 1, 20,
                coalesce(b->>'setting', 'outdoor'),
                CASE coalesce(b->>'setting', 'outdoor') WHEN 'indoor' THEN 'indoor' ELSE 'outdoor' END,
                coalesce(b->>'listing_kind', 'attraction'), true,
                left(b->>'description', 280), '[]'::jsonb
            ) RETURNING id INTO v_exp;
            -- No invented prices: free entry if the guide said so and a reviewer agreed, otherwise on request.
            INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
            VALUES (
                v_exp, 'USD',
                CASE WHEN coalesce((b->>'free_entry')::boolean, false) THEN 'fixed' ELSE 'quote-required' END,
                'person',
                CASE WHEN coalesce((b->>'free_entry')::boolean, false) THEN 0 END,
                '(,)', 'proposal:' || p.id
            );
            SELECT id INTO v_term FROM app.taxonomy WHERE kind = 'category' AND slug = b->>'category';
            IF v_term IS NOT NULL THEN
                INSERT INTO app.experience_taxonomy (experience_id, term_id) VALUES (v_exp, v_term)
                ON CONFLICT DO NOTHING;
            END IF;
            INSERT INTO app.experience_translations (experience_id, locale, title, description)
            VALUES (v_exp, 'en', b->>'name', b->>'description')
            ON CONFLICT (experience_id, locale) DO NOTHING;
        ELSE
            v_exp := p.target_experience_id;
            SELECT organization_id INTO v_org FROM app.experiences WHERE id = v_exp;
            PERFORM set_config('app.organization_id', v_org::text, true);
            UPDATE app.experiences
            SET title = coalesce(NULLIF(btrim(b->>'title'), ''), title),
                description = coalesce(NULLIF(btrim(b->>'description'), ''), description),
                catalogue_summary = CASE WHEN NULLIF(btrim(b->>'description'), '') IS NULL THEN catalogue_summary
                                         ELSE left(b->>'description', 280) END,
                status = CASE WHEN coalesce((b->>'closed')::boolean, false) THEN 'archived' ELSE status END,
                updated_at = now()
            WHERE id = v_exp;
            UPDATE app.venues
            SET address = coalesce(NULLIF(btrim(b->>'address'), ''), address),
                location = CASE WHEN b ? 'lat' THEN
                    ST_SetSRID(ST_MakePoint((b->>'lng')::double precision, (b->>'lat')::double precision), 4326)::geography
                    ELSE location END
            WHERE id = (SELECT venue_id FROM app.experiences WHERE id = v_exp);
            UPDATE app.data_quality_issues SET status = 'resolved', resolved_at = now()
            WHERE id = p.data_quality_issue_id AND status = 'open';
        END IF;

        -- Photos move into the catalogue, with where they came from and under what licence.
        SELECT coalesce(max(sort_order), -1) + 1 INTO v_order FROM app.media WHERE experience_id = v_exp;
        FOR v_photo IN SELECT * FROM app.place_proposal_photos WHERE proposal_id = p.id ORDER BY created_at LOOP
            INSERT INTO app.media (
                experience_id, provider, object_key, alt_text, sort_order, moderation, content_type, byte_size,
                width, height, provider_file_id, created_by, source, source_url, license, license_url, attribution
            ) VALUES (
                v_exp, v_photo.provider, v_photo.object_key,
                coalesce(NULLIF(v_photo.alt_text, ''), coalesce(b->>'name', b->>'title', 'Photo')),
                v_order, 'approved', v_photo.content_type, v_photo.byte_size, v_photo.width, v_photo.height,
                v_photo.provider_file_id, g.user_id, v_photo.source, v_photo.source_url, v_photo.license,
                v_photo.license_url, v_photo.attribution
            ) ON CONFLICT (provider, object_key) DO NOTHING;
            v_order := v_order + 1;
        END LOOP;

        UPDATE app.place_proposals
        SET status = 'accepted', reviewer_id = p_admin, reviewed_at = now(), reason = left(coalesce(p_reason, ''), 500),
            resulting_experience_id = v_exp, updated_at = now()
        WHERE id = p.id;
    ELSE
        RAISE EXCEPTION 'decision must be accepted or rejected' USING ERRCODE = '22023';
    END IF;

    PERFORM app.emit_notification_event(
        'guide.proposal_decided', p.id, g.user_id, NULL,
        jsonb_build_object('path', '/guide/contribute', 'status', p_decision)
    );
    RETURN app.place_proposal_json(p.id);
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.proposal_decided', 'en', 'traveller', 'Your place proposal was reviewed',
     'A reviewer has looked at your proposal ({status}). See the decision and any note: {deep_link}'),
    ('guide.proposal_decided', 'ar', 'traveller', 'رُوجع اقتراحك لمكان',
     'راجع أحد المراجعين اقتراحك ({status}). اطّلع على القرار وأي ملاحظة: {deep_link}'),
    ('guide.proposal_decided', 'fr', 'traveller', 'Votre proposition de lieu a été examinée',
     'Un relecteur a examiné votre proposition ({status}). Voir la décision et la note : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ---- Credit where it is due ----------------------------------------------------------------
-- Who added a place, and who corrected it, for the place page. Approved guides only.
CREATE OR REPLACE FUNCTION app.place_contributors(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'role', CASE WHEN x.kind = 'new' THEN 'added' ELSE 'corrected' END,
        'slug', x.slug, 'display_name', x.display_name, 'tier', x.tier, 'at', x.reviewed_at
    ) ORDER BY x.kind = 'new' DESC, x.reviewed_at), '[]'::jsonb)
    FROM (
        SELECT DISTINCT ON (g.id, p.kind) p.kind, g.slug, g.display_name, g.tier, p.reviewed_at
        FROM app.place_proposals p
        JOIN app.experiences e ON e.id = p.resulting_experience_id
        JOIN app.guide_profiles g ON g.id = p.guide_profile_id AND g.status = 'approved'
        WHERE e.slug = p_slug AND p.status = 'accepted'
        ORDER BY g.id, p.kind, p.reviewed_at
    ) x;
$$;

GRANT EXECUTE ON FUNCTION
    app.guide_proposal_allowance(uuid),
    app.place_proposal_json(uuid),
    app.guide_list_proposals(uuid),
    app.guide_submit_proposal(uuid, jsonb),
    app.guide_withdraw_proposal(uuid, uuid),
    app.guide_attach_proposal_photo(uuid, uuid, jsonb),
    app.admin_list_proposals(uuid, text),
    app.admin_decide_proposal(uuid, uuid, text, text),
    app.place_contributors(text)
TO mshwar_backend;
