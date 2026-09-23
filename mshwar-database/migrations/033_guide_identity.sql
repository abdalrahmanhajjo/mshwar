-- 033_guide_identity.sql
-- G1 of the supply-side pivot: a guide can apply, be verified, and have a public
-- page. Nothing is bookable yet - this phase exists to find out whether guides
-- will sign up at all, which is the cheapest question to answer first.
--
-- Two tiers. A licensed guide runs paid tours; a local host runs free walks and
-- cannot take money. The badge is granted by Mshwar and never self-assigned, and
-- because a licence expires, the badge is derived rather than stored - a lapsed
-- licence drops it the moment it lapses, with nothing to run.
--
-- On approval the guide gets a solo organisation. That is the whole point of
-- reusing organisations: every piece of machinery already built (venues,
-- experiences, slots, bookings, reviews, the org-scoped policies, the audit
-- trail) then works for guides unchanged, instead of a second supply type
-- growing its own half-tested copy of booking.

-- ---- Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES app.users(id),
    -- Null until approval: the solo org is created by the admin decision.
    organization_id uuid UNIQUE REFERENCES app.organizations(id),
    tier text NOT NULL CHECK (tier IN ('licensed', 'host')),
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    slug text NOT NULL UNIQUE,
    headline text NOT NULL DEFAULT '',
    bio text NOT NULL DEFAULT '',
    languages text[] NOT NULL DEFAULT '{}',
    regions text[] NOT NULL DEFAULT '{}',
    specialities text[] NOT NULL DEFAULT '{}',
    years_guiding integer CHECK (years_guiding IS NULL OR years_guiding BETWEEN 0 AND 70),
    phone text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'suspended')),
    submitted_at timestamptz,
    decided_at timestamptz,
    decided_by uuid REFERENCES app.users(id),
    decision_reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- An approved guide always has its organisation; the two go live together.
    CONSTRAINT guide_profiles_approved_has_org
        CHECK (status <> 'approved' OR organization_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS guide_profiles_status_idx ON app.guide_profiles (status);
CREATE INDEX IF NOT EXISTS guide_profiles_tier_idx ON app.guide_profiles (tier);

CREATE TABLE IF NOT EXISTS app.guide_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('licence', 'id', 'first_aid', 'insurance', 'driving')),
    reference text NOT NULL DEFAULT '',
    issuer text NOT NULL DEFAULT '',
    issued_on date,
    expires_on date,
    -- A storage key, never a URL. Documents are private and fetched through a
    -- signed read, exactly like the business verification documents.
    document_key text NOT NULL CHECK (btrim(document_key) <> ''),
    verification text NOT NULL DEFAULT 'pending'
        CHECK (verification IN ('pending', 'verified', 'rejected')),
    reviewed_by uuid REFERENCES app.users(id),
    reviewed_at timestamptz,
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guide_profile_id, kind)
);

CREATE INDEX IF NOT EXISTS guide_credentials_profile_idx ON app.guide_credentials (guide_profile_id);

COMMENT ON TABLE app.guide_profiles IS 'One row per guide. The solo organisation is attached on approval.';
COMMENT ON TABLE app.guide_credentials IS 'Private documents behind a guide application. Never exposed publicly.';

-- ---- Row-level security --------------------------------------------------------
ALTER TABLE app.guide_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.guide_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_credentials FORCE ROW LEVEL SECURITY;

-- A guide reaches their own row and nobody else's. Everything an admin or the
-- public needs goes through the SECURITY DEFINER functions below.
DROP POLICY IF EXISTS guide_profile_self ON app.guide_profiles;
CREATE POLICY guide_profile_self ON app.guide_profiles FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS guide_credential_self ON app.guide_credentials;
CREATE POLICY guide_credential_self ON app.guide_credentials FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.guide_profiles g
        WHERE g.id = guide_credentials.guide_profile_id AND g.user_id = app.current_user_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.guide_profiles g
        WHERE g.id = guide_credentials.guide_profile_id AND g.user_id = app.current_user_id()
    ));

GRANT SELECT, INSERT, UPDATE ON app.guide_profiles, app.guide_credentials TO mshwar_backend;
GRANT DELETE ON app.guide_credentials TO mshwar_backend;

-- ---- The badge is derived, so an expired licence drops it -----------------------
CREATE OR REPLACE FUNCTION app.guide_has_badge(p_profile uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM app.guide_profiles g
        JOIN app.guide_credentials c ON c.guide_profile_id = g.id
        WHERE g.id = p_profile
          AND g.status = 'approved'
          AND g.tier = 'licensed'
          AND c.kind = 'licence'
          AND c.verification = 'verified'
          AND (c.expires_on IS NULL OR c.expires_on >= current_date)
    );
$$;

COMMENT ON FUNCTION app.guide_has_badge(uuid) IS
    'Derived, never stored: a licence that lapses drops the badge with nothing to run.';

-- ---- Which documents each tier owes --------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_required_documents(p_tier text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN p_tier = 'licensed' THEN ARRAY['id', 'licence'] ELSE ARRAY['id'] END;
$$;

-- ---- Shared shapes --------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_profile_json(p_profile uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'tier', g.tier,
        'badge', app.guide_has_badge(g.id),
        'display_name', g.display_name,
        'headline', g.headline,
        'bio', g.bio,
        'languages', to_jsonb(g.languages),
        'regions', to_jsonb(g.regions),
        'specialities', to_jsonb(g.specialities),
        'years_guiding', g.years_guiding,
        'status', g.status,
        'organization_id', g.organization_id
    )
    || CASE WHEN p_private THEN jsonb_build_object(
        'phone', g.phone,
        'submitted_at', g.submitted_at,
        'decided_at', g.decided_at,
        'decision_reason', g.decision_reason,
        'required_documents', to_jsonb(app.guide_required_documents(g.tier)),
        'documents', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'kind', c.kind, 'reference', c.reference, 'issuer', c.issuer,
                'issued_on', c.issued_on, 'expires_on', c.expires_on,
                'verification', c.verification, 'reason', c.reason,
                'expired', c.expires_on IS NOT NULL AND c.expires_on < current_date
            ) ORDER BY c.kind)
            FROM app.guide_credentials c WHERE c.guide_profile_id = g.id
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.guide_profiles g
    WHERE g.id = p_profile;
$$;

-- ---- Applying -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_upsert_profile(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_status text;
    v_tier text := btrim(coalesce(p_payload->>'tier', ''));
    v_name text := btrim(coalesce(p_payload->>'display_name', ''));
    v_slug text;
    v_suffix integer := 0;
BEGIN
    IF v_tier NOT IN ('licensed', 'host') THEN
        RAISE EXCEPTION 'tier must be licensed or host' USING ERRCODE = '22023';
    END IF;
    IF v_name = '' THEN
        RAISE EXCEPTION 'display name is required' USING ERRCODE = '22023';
    END IF;

    SELECT id, status INTO v_id, v_status FROM app.guide_profiles WHERE user_id = p_user;

    IF v_id IS NOT NULL AND v_status IN ('approved', 'suspended') THEN
        -- An approved guide edits their page, but cannot re-pick their tier:
        -- the tier is what the documents were verified against.
        UPDATE app.guide_profiles
        SET headline = coalesce(p_payload->>'headline', headline),
            bio = coalesce(p_payload->>'bio', bio),
            languages = coalesce(
                (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'languages')), languages),
            regions = coalesce(
                (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'regions')), regions),
            specialities = coalesce(
                (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'specialities')), specialities),
            years_guiding = coalesce((p_payload->>'years_guiding')::integer, years_guiding),
            phone = coalesce(p_payload->>'phone', phone),
            updated_at = now()
        WHERE id = v_id;
        RETURN app.guide_profile_json(v_id, true);
    END IF;

    IF v_id IS NULL THEN
        -- A readable, stable handle. Collisions get a numeric suffix rather than
        -- a random one, so the guide's own URL stays guessable to them.
        v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
        v_slug := btrim(regexp_replace(v_slug, '(^-+)|(-+$)', '', 'g'), '-');
        IF v_slug = '' THEN
            v_slug := 'guide';
        END IF;
        WHILE EXISTS (SELECT 1 FROM app.guide_profiles WHERE slug = v_slug) LOOP
            v_suffix := v_suffix + 1;
            v_slug := regexp_replace(v_slug, '-[0-9]+$', '') || '-' || v_suffix::text;
        END LOOP;

        INSERT INTO app.guide_profiles (user_id, tier, display_name, slug)
        VALUES (p_user, v_tier, v_name, v_slug)
        RETURNING id INTO v_id;
    END IF;

    UPDATE app.guide_profiles
    SET tier = v_tier,
        display_name = v_name,
        headline = coalesce(p_payload->>'headline', headline),
        bio = coalesce(p_payload->>'bio', bio),
        languages = coalesce(
            (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'languages')), languages),
        regions = coalesce(
            (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'regions')), regions),
        specialities = coalesce(
            (SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'specialities')), specialities),
        years_guiding = coalesce((p_payload->>'years_guiding')::integer, years_guiding),
        phone = coalesce(p_payload->>'phone', phone),
        -- Editing a rejected application puts it back in the guide's hands.
        status = CASE WHEN status = 'rejected' THEN 'draft' ELSE status END,
        updated_at = now()
    WHERE id = v_id;

    RETURN app.guide_profile_json(v_id, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_put_credential(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_kind text := btrim(coalesce(p_payload->>'kind', ''));
BEGIN
    SELECT id INTO v_id FROM app.guide_profiles WHERE user_id = p_user;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_kind NOT IN ('licence', 'id', 'first_aid', 'insurance', 'driving') THEN
        RAISE EXCEPTION 'unknown document kind' USING ERRCODE = '22023';
    END IF;
    IF btrim(coalesce(p_payload->>'document_key', '')) = '' THEN
        RAISE EXCEPTION 'document is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.guide_credentials (
        guide_profile_id, kind, reference, issuer, issued_on, expires_on, document_key
    ) VALUES (
        v_id, v_kind,
        btrim(coalesce(p_payload->>'reference', '')),
        btrim(coalesce(p_payload->>'issuer', '')),
        NULLIF(p_payload->>'issued_on', '')::date,
        NULLIF(p_payload->>'expires_on', '')::date,
        btrim(p_payload->>'document_key')
    )
    ON CONFLICT (guide_profile_id, kind) DO UPDATE
    SET reference = EXCLUDED.reference,
        issuer = EXCLUDED.issuer,
        issued_on = EXCLUDED.issued_on,
        expires_on = EXCLUDED.expires_on,
        document_key = EXCLUDED.document_key,
        -- A replaced document is a new claim: it goes back in the queue.
        verification = 'pending',
        reviewed_by = NULL,
        reviewed_at = NULL,
        reason = '';

    RETURN app.guide_profile_json(v_id, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_submit(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_tier text;
    v_status text;
    v_missing text[];
BEGIN
    SELECT id, tier, status INTO v_id, v_tier, v_status FROM app.guide_profiles WHERE user_id = p_user;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'application is not editable' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(required), '{}')
    INTO v_missing
    FROM unnest(app.guide_required_documents(v_tier)) AS required
    WHERE NOT EXISTS (
        SELECT 1 FROM app.guide_credentials c
        WHERE c.guide_profile_id = v_id AND c.kind = required
    );
    IF array_length(v_missing, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'missing documents: %', array_to_string(v_missing, ', ') USING ERRCODE = '22023';
    END IF;

    UPDATE app.guide_profiles
    SET status = 'submitted', submitted_at = now(), decision_reason = '', updated_at = now()
    WHERE id = v_id;
    RETURN app.guide_profile_json(v_id, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.get_my_guide_profile(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(app.guide_profile_json(g.id, true), 'null'::jsonb)
    FROM app.guide_profiles g WHERE g.user_id = p_user;
$$;

-- ---- Admin review ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_list_guide_applications(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text := NULLIF(btrim(coalesce(p_filter->>'status', '')), '');
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', g.id,
            'slug', g.slug,
            'display_name', g.display_name,
            'tier', g.tier,
            'status', g.status,
            'badge', app.guide_has_badge(g.id),
            'submitted_at', g.submitted_at,
            'document_count', (SELECT count(*) FROM app.guide_credentials c WHERE c.guide_profile_id = g.id),
            'missing_documents', to_jsonb(coalesce((
                SELECT array_agg(required)
                FROM unnest(app.guide_required_documents(g.tier)) AS required
                WHERE NOT EXISTS (
                    SELECT 1 FROM app.guide_credentials c
                    WHERE c.guide_profile_id = g.id AND c.kind = required
                )
            ), '{}'::text[]))
        ) ORDER BY g.submitted_at NULLS LAST, g.created_at)
        FROM app.guide_profiles g
        WHERE v_status IS NULL OR g.status = v_status
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_get_guide_case(p_admin uuid, p_profile uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_payload jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT app.guide_profile_json(g.id, true)
        || jsonb_build_object('document_keys', coalesce((
            SELECT jsonb_object_agg(c.kind, c.document_key)
            FROM app.guide_credentials c WHERE c.guide_profile_id = g.id
        ), '{}'::jsonb))
    INTO v_payload
    FROM app.guide_profiles g WHERE g.id = p_profile;
    IF v_payload IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_review_guide_document(
    p_admin uuid, p_credential uuid, p_decision text, p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_profile uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('verified', 'rejected') THEN
        RAISE EXCEPTION 'decision must be verified or rejected' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_credentials
    SET verification = p_decision, reviewed_by = p_admin, reviewed_at = now(),
        reason = coalesce(btrim(p_reason), '')
    WHERE id = p_credential
    RETURNING guide_profile_id INTO v_profile;
    IF v_profile IS NULL THEN
        RAISE EXCEPTION 'document not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.guide_profile_json(v_profile, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_decide_guide(
    p_admin uuid, p_profile uuid, p_decision text, p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_guide app.guide_profiles;
    v_org uuid;
    v_slug text;
    v_suffix integer := 0;
    v_unverified integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('approved', 'rejected', 'suspended') THEN
        RAISE EXCEPTION 'unknown decision' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_guide FROM app.guide_profiles WHERE id = p_profile FOR UPDATE;
    IF v_guide.id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'approved' THEN
        IF v_guide.status <> 'submitted' THEN
            RAISE EXCEPTION 'only a submitted application can be approved' USING ERRCODE = '22023';
        END IF;
        -- Approving a guide whose documents are not reviewed would grant the
        -- badge on nobody's authority. BR-02: Mshwar grants it, deliberately.
        SELECT count(*) INTO v_unverified
        FROM unnest(app.guide_required_documents(v_guide.tier)) AS required
        JOIN app.guide_credentials c
            ON c.guide_profile_id = v_guide.id AND c.kind = required
        WHERE c.verification <> 'verified';
        IF v_unverified > 0 THEN
            RAISE EXCEPTION 'every required document must be verified first' USING ERRCODE = '22023';
        END IF;

        v_org := v_guide.organization_id;
        IF v_org IS NULL THEN
            -- The solo organisation. Verified because the human behind it just was.
            v_slug := 'guide-' || v_guide.slug;
            WHILE EXISTS (SELECT 1 FROM app.organizations WHERE slug = v_slug) LOOP
                v_suffix := v_suffix + 1;
                v_slug := 'guide-' || v_guide.slug || '-' || v_suffix::text;
            END LOOP;
            INSERT INTO app.organizations (name, slug, status, verification)
            VALUES (v_guide.display_name, v_slug, 'active', 'verified')
            RETURNING id INTO v_org;
            INSERT INTO app.organization_members (organization_id, user_id, role, active)
            VALUES (v_org, v_guide.user_id, 'owner', true)
            ON CONFLICT (organization_id, user_id) DO UPDATE SET active = true;
        END IF;

        UPDATE app.guide_profiles
        SET status = 'approved', organization_id = v_org, decided_at = now(),
            decided_by = p_admin, decision_reason = coalesce(btrim(p_reason), ''), updated_at = now()
        WHERE id = p_profile;
    ELSE
        UPDATE app.guide_profiles
        SET status = p_decision, decided_at = now(), decided_by = p_admin,
            decision_reason = coalesce(btrim(p_reason), ''), updated_at = now()
        WHERE id = p_profile;
    END IF;

    RETURN app.guide_profile_json(p_profile, true);
END;
$$;

-- ---- The public page ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.public_guide_page(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.guide_profile_json(g.id, false)
    FROM app.guide_profiles g
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

CREATE OR REPLACE FUNCTION app.public_guide_directory(p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(payload ORDER BY payload->>'display_name'), '[]'::jsonb)
    FROM (
        SELECT app.guide_profile_json(g.id, false) AS payload
        FROM app.guide_profiles g
        WHERE g.status = 'approved'
          AND (NULLIF(btrim(coalesce(p_filter->>'region', '')), '') IS NULL
               OR btrim(p_filter->>'region') = ANY (g.regions))
          AND (NULLIF(btrim(coalesce(p_filter->>'language', '')), '') IS NULL
               OR btrim(p_filter->>'language') = ANY (g.languages))
          AND (NULLIF(btrim(coalesce(p_filter->>'tier', '')), '') IS NULL
               OR g.tier = btrim(p_filter->>'tier'))
    ) AS rows;
$$;

GRANT EXECUTE ON FUNCTION
    app.guide_has_badge(uuid),
    app.guide_required_documents(text),
    app.guide_profile_json(uuid, boolean),
    app.guide_upsert_profile(uuid, jsonb),
    app.guide_put_credential(uuid, jsonb),
    app.guide_submit(uuid),
    app.get_my_guide_profile(uuid),
    app.admin_list_guide_applications(uuid, jsonb),
    app.admin_get_guide_case(uuid, uuid),
    app.admin_review_guide_document(uuid, uuid, text, text),
    app.admin_decide_guide(uuid, uuid, text, text),
    app.public_guide_page(text),
    app.public_guide_directory(jsonb)
TO mshwar_backend;
