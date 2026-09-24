-- 042_exchange.sql
-- V4 of verified local services: licensed money changers.
--
-- Under Law 347/2001 only exchange institutions registered with Banque du
-- Liban may call themselves money changers, and each must show its
-- registration number. A changer on Mshwar therefore carries its BDL number
-- and category (A or B), matched by a reviewer against the list BDL publishes;
-- each branch is visited or video-called and has its shop front checked. The
-- list is reloaded every month and diffed: a changer who disappears from it,
-- or whose category changes, is hidden that day.
--
-- Changers may post buy and sell rates. A rate is the changer's, never a
-- Mshwar quote; it goes stale after 12 hours, and one more than 3% away from
-- the median of other verified changers is held for review before it shows.
-- Mshwar never exchanges money, takes deposits, sends transfers, or ranks
-- changers by rate.

-- ---- Licence and branches ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.exchange_licences (
    partner_id uuid PRIMARY KEY REFERENCES app.partners(id) ON DELETE CASCADE,
    bdl_number text NOT NULL CHECK (bdl_number ~ '^[0-9A-Za-z/\-]{1,20}$'),
    category text NOT NULL CHECK (category IN ('A', 'B')),
    legal_name text NOT NULL CHECK (btrim(legal_name) <> ''),
    register_status text NOT NULL DEFAULT 'unchecked'
        CHECK (register_status IN ('unchecked', 'matched', 'missing', 'category_changed')),
    matched_on date,
    matched_snapshot_id uuid,
    rates_suspended_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.exchange_offices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES app.partners(id) ON DELETE CASCADE,
    branch_name text NOT NULL CHECK (btrim(branch_name) <> ''),
    address text NOT NULL CHECK (btrim(address) <> ''),
    location geography(Point, 4326) NOT NULL,
    destination_id uuid NOT NULL REFERENCES app.destinations(id),
    -- {"mon": [["09:00", "18:00"]], ...}; a missing day is closed.
    hours jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(hours) = 'object'),
    phone text NOT NULL DEFAULT '',
    active boolean NOT NULL DEFAULT true,
    verified_at timestamptz,
    verified_by uuid REFERENCES app.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exchange_offices_destination_idx ON app.exchange_offices (destination_id);

-- Branch documents (the shop-front photo) hang off the office.
ALTER TABLE app.partner_documents ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES app.exchange_offices(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS app.partner_documents_one_per_kind;
CREATE UNIQUE INDEX IF NOT EXISTS partner_documents_one_per_kind ON app.partner_documents (
    partner_id, kind,
    coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(office_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

INSERT INTO app.trust_requirements
    (subject_kind, document_kind, scope, needs_expiry, valid_days, fresh_days, public, sort_order)
VALUES ('changer', 'storefront_photo', 'office', false, NULL, NULL, true, 50)
ON CONFLICT (subject_kind, document_kind) DO UPDATE SET scope = EXCLUDED.scope, public = EXCLUDED.public;

-- ---- The BDL register, as published ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.bdl_register_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    published_on date NOT NULL,
    source_url text NOT NULL CHECK (source_url ~ '^https://'),
    loaded_by uuid NOT NULL REFERENCES app.users(id),
    loaded_at timestamptz NOT NULL DEFAULT now(),
    entry_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app.bdl_register_entries (
    snapshot_id uuid NOT NULL REFERENCES app.bdl_register_snapshots(id) ON DELETE CASCADE,
    bdl_number text NOT NULL,
    category text NOT NULL CHECK (category IN ('A', 'B')),
    name text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    PRIMARY KEY (snapshot_id, bdl_number)
);

-- ---- Rates ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.exchange_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES app.exchange_offices(id) ON DELETE CASCADE,
    base text NOT NULL CHECK (base IN ('USD', 'EUR')),
    quote text NOT NULL DEFAULT 'LBP' CHECK (quote = 'LBP'),
    -- LBP per one unit of the base currency: what the changer pays (buy) and charges (sell).
    buy numeric(14, 2) NOT NULL CHECK (buy > 0),
    sell numeric(14, 2) NOT NULL CHECK (sell > 0),
    posted_at timestamptz NOT NULL DEFAULT now(),
    posted_by uuid NOT NULL REFERENCES app.users(id),
    status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'held', 'rejected')),
    held_reason text NOT NULL DEFAULT '',
    reviewed_by uuid REFERENCES app.users(id),
    reviewed_at timestamptz,
    CONSTRAINT exchange_rate_spread CHECK (buy <= sell AND sell <= buy * 1.10)
);
CREATE INDEX IF NOT EXISTS exchange_rates_recent_idx ON app.exchange_rates (office_id, base, posted_at DESC);

ALTER TABLE app.exchange_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.exchange_licences FORCE ROW LEVEL SECURITY;
ALTER TABLE app.exchange_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.exchange_offices FORCE ROW LEVEL SECURITY;
ALTER TABLE app.bdl_register_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.bdl_register_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE app.bdl_register_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.bdl_register_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE app.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.exchange_rates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.exchange_licences, app.exchange_offices, app.bdl_register_snapshots, app.bdl_register_entries,
    app.exchange_rates FROM mshwar_backend;

-- ---- Documents now know about branches ----------------------------------------------------------
CREATE OR REPLACE FUNCTION app.partner_missing_documents(p_partner uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT jsonb_agg(jsonb_build_object('kind', r.document_kind) ORDER BY r.sort_order)
        FROM app.partners p
        JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.scope = 'partner'
        WHERE p.id = p_partner
          AND NOT EXISTS (
              SELECT 1 FROM app.partner_documents d
              WHERE d.partner_id = p.id AND d.kind = r.document_kind AND d.vehicle_id IS NULL AND d.office_id IS NULL
          )
    ), '[]'::jsonb)
    || coalesce((
        SELECT jsonb_agg(jsonb_build_object('kind', required, 'vehicle_id', v.id, 'plate', v.plate))
        FROM app.vehicles v
        CROSS JOIN LATERAL unnest(app.vehicle_required_documents(v.id)) AS required
        WHERE v.partner_id = p_partner AND v.active
          AND NOT EXISTS (SELECT 1 FROM app.partner_documents d WHERE d.vehicle_id = v.id AND d.kind = required)
    ), '[]'::jsonb)
    || coalesce((
        SELECT jsonb_agg(jsonb_build_object('kind', r.document_kind, 'office_id', o.id, 'branch', o.branch_name))
        FROM app.exchange_offices o
        JOIN app.partners p ON p.id = o.partner_id
        JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.scope = 'office'
        WHERE o.partner_id = p_partner AND o.active
          AND NOT EXISTS (SELECT 1 FROM app.partner_documents d WHERE d.office_id = o.id AND d.kind = r.document_kind)
    ), '[]'::jsonb)
$$;

CREATE OR REPLACE FUNCTION app.partner_documents_complete(p_partner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT NOT EXISTS (
        SELECT 1
        FROM app.partners p
        JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.scope = 'partner'
        WHERE p.id = p_partner
          AND NOT EXISTS (
              SELECT 1 FROM app.partner_documents d
              WHERE d.partner_id = p.id AND d.kind = r.document_kind AND d.vehicle_id IS NULL AND d.office_id IS NULL
                AND app.partner_document_valid(d.id)
          )
    )
$$;

CREATE OR REPLACE FUNCTION app.partner_put_document(p_user uuid, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_doc text := btrim(coalesce(p_payload->>'kind', ''));
    v_vehicle uuid := NULLIF(p_payload->>'vehicle_id', '')::uuid;
    v_office uuid := NULLIF(p_payload->>'office_id', '')::uuid;
    v_scope text;
    v_needs_expiry boolean;
    v_expires date := NULLIF(p_payload->>'expires_on', '')::date;
    v_issued date := NULLIF(p_payload->>'issued_on', '')::date;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = p_kind;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_doc = 'plate_rental' AND p_kind = 'driver' THEN
        v_scope := 'vehicle';
        v_needs_expiry := true;
    ELSE
        SELECT scope, needs_expiry INTO v_scope, v_needs_expiry
        FROM app.trust_requirements WHERE subject_kind = p_kind AND document_kind = v_doc;
    END IF;
    IF v_scope IS NULL THEN
        RAISE EXCEPTION 'unknown document kind' USING ERRCODE = '22023';
    END IF;
    IF v_scope = 'vehicle' THEN
        IF v_vehicle IS NULL OR NOT EXISTS (SELECT 1 FROM app.vehicles WHERE id = v_vehicle AND partner_id = v_partner.id) THEN
            RAISE EXCEPTION 'say which vehicle this document is for' USING ERRCODE = '22023';
        END IF;
    ELSE
        v_vehicle := NULL;
    END IF;
    IF v_scope = 'office' THEN
        IF v_office IS NULL OR NOT EXISTS (SELECT 1 FROM app.exchange_offices WHERE id = v_office AND partner_id = v_partner.id) THEN
            RAISE EXCEPTION 'say which branch this document is for' USING ERRCODE = '22023';
        END IF;
    ELSE
        v_office := NULL;
    END IF;
    IF btrim(coalesce(p_payload->>'document_key', '')) = '' THEN
        RAISE EXCEPTION 'document is required' USING ERRCODE = '22023';
    END IF;
    IF v_needs_expiry AND v_expires IS NULL THEN
        RAISE EXCEPTION 'this document needs its expiry date' USING ERRCODE = '22023';
    END IF;
    IF v_expires IS NOT NULL AND v_expires < app.beirut_today() THEN
        RAISE EXCEPTION 'this document has already expired' USING ERRCODE = '22023';
    END IF;
    IF v_issued IS NOT NULL AND v_issued > app.beirut_today() THEN
        RAISE EXCEPTION 'the issue date cannot be in the future' USING ERRCODE = '22023';
    END IF;
    IF v_doc = 'judicial_record' AND v_issued IS NULL THEN
        RAISE EXCEPTION 'the judicial record needs the date it was issued' USING ERRCODE = '22023';
    END IF;

    DELETE FROM app.partner_documents
    WHERE partner_id = v_partner.id AND kind = v_doc
      AND vehicle_id IS NOT DISTINCT FROM v_vehicle AND office_id IS NOT DISTINCT FROM v_office;
    INSERT INTO app.partner_documents (
        partner_id, kind, vehicle_id, office_id, reference, issuer, issued_on, expires_on, provider, document_key
    ) VALUES (
        v_partner.id, v_doc, v_vehicle, v_office,
        left(btrim(coalesce(p_payload->>'reference', '')), 120),
        left(btrim(coalesce(p_payload->>'issuer', '')), 120),
        v_issued, v_expires,
        coalesce(NULLIF(p_payload->>'provider', ''), 'local'),
        btrim(p_payload->>'document_key')
    );
    RETURN app.partner_json(v_partner.id, true);
END;
$$;

-- Documents list their branch too. Same as 039 otherwise.
CREATE OR REPLACE FUNCTION app.partner_json(p_partner uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', p.id,
        'kind', p.kind,
        'slug', p.slug,
        'display_name', p.display_name,
        'headline', p.headline,
        'bio', p.bio,
        'languages', to_jsonb(p.languages),
        'regions', to_jsonb(p.regions),
        'live', app.partner_is_live(p.id),
        'trust', app.partner_public_checks(p.id),
        -- The face travellers should expect: only once a reviewer matched it to the ID.
        'photo', (
            SELECT jsonb_build_object('provider', d.provider, 'key', d.document_key)
            FROM app.partner_documents d
            WHERE d.partner_id = p.id AND d.kind = 'profile_photo' AND d.verification = 'verified'
        ),
        'vehicles', coalesce((
            SELECT jsonb_agg(app.vehicle_json(v.id, p_private) ORDER BY v.created_at)
            FROM app.vehicles v
            WHERE v.partner_id = p.id AND (p_private OR (v.active AND app.vehicle_is_live(v.id)))
        ), '[]'::jsonb)
    )
    || CASE WHEN p_private THEN jsonb_build_object(
        'status', p.status,
        'submitted_at', p.submitted_at,
        'decided_at', p.decided_at,
        'decision_reason', p.decision_reason,
        'trust_level', app.partner_trust_level(p.id),
        'requirements', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'kind', r.document_kind, 'scope', r.scope, 'needs_expiry', r.needs_expiry,
                'valid_days', r.valid_days, 'fresh_days', r.fresh_days
            ) ORDER BY r.sort_order)
            FROM app.trust_requirements r WHERE r.subject_kind = p.kind
        ), '[]'::jsonb),
        'missing', app.partner_missing_documents(p.id),
        'agreement', jsonb_build_object(
            'current', app.current_partner_agreement_version(p.kind),
            'accepted', app.partner_accepted_agreement(p.id)
        ),
        'security', app.partner_security_status(p.user_id),
        'documents', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', d.id, 'kind', d.kind, 'vehicle_id', d.vehicle_id, 'office_id', d.office_id, 'reference', d.reference,
                'issuer', d.issuer, 'issued_on', d.issued_on, 'expires_on', d.expires_on,
                'verification', d.verification, 'reason', d.reason,
                'valid', app.partner_document_valid(d.id),
                'lapses_on', app.partner_document_lapses_on(d.id)
            ) ORDER BY d.kind, d.created_at)
            FROM app.partner_documents d WHERE d.partner_id = p.id
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.partners p WHERE p.id = p_partner
$$;

-- ---- Derived trust for changers -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.office_is_verified(p_office uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT o.active AND o.verified_at IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM app.trust_requirements r
            WHERE r.subject_kind = 'changer' AND r.scope = 'office'
              AND NOT EXISTS (SELECT 1 FROM app.partner_documents d
                              WHERE d.office_id = o.id AND d.kind = r.document_kind AND app.partner_document_valid(d.id))
        )
        FROM app.exchange_offices o WHERE o.id = p_office
    ), false)
$$;

CREATE OR REPLACE FUNCTION app.partner_is_live(p_partner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT p.status = 'approved'
           AND app.partner_documents_complete(p.id)
           AND app.partner_accepted_agreement(p.id) IS NOT DISTINCT FROM app.current_partner_agreement_version(p.kind)
           AND (p.kind <> 'driver' OR EXISTS (
               SELECT 1 FROM app.vehicles v WHERE v.partner_id = p.id AND app.vehicle_is_live(v.id)
           ))
           -- A changer must be on BDL's current list and have at least one checked branch.
           AND (p.kind <> 'changer' OR (
               EXISTS (SELECT 1 FROM app.exchange_licences l WHERE l.partner_id = p.id AND l.register_status = 'matched')
               AND EXISTS (SELECT 1 FROM app.exchange_offices o WHERE o.partner_id = p.id AND app.office_is_verified(o.id))
           ))
        FROM app.partners p WHERE p.id = p_partner
    ), false)
$$;

CREATE OR REPLACE FUNCTION app.office_is_live(p_office uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.office_is_verified(p_office)
       AND app.partner_is_live((SELECT partner_id FROM app.exchange_offices WHERE id = p_office))
$$;

-- The most recent live rate per currency, only while fresh (12 hours).
CREATE OR REPLACE FUNCTION app.office_current_rates(p_office uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'base', x.base, 'quote', x.quote, 'buy', x.buy, 'sell', x.sell, 'posted_at', x.posted_at
    ) ORDER BY x.base), '[]'::jsonb)
    FROM (
        SELECT DISTINCT ON (r.base) r.*
        FROM app.exchange_rates r
        JOIN app.exchange_offices o ON o.id = r.office_id
        JOIN app.exchange_licences l ON l.partner_id = o.partner_id
        WHERE r.office_id = p_office AND r.status = 'live' AND r.posted_at > now() - interval '12 hours'
          AND (l.rates_suspended_until IS NULL OR l.rates_suspended_until < now())
        ORDER BY r.base, r.posted_at DESC
    ) x
$$;

CREATE OR REPLACE FUNCTION app.office_json(p_office uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', o.id,
        'branch_name', o.branch_name,
        'address', o.address,
        'lat', ST_Y(o.location::geometry),
        'lng', ST_X(o.location::geometry),
        'destination', jsonb_build_object('slug', d.slug, 'name', d.name),
        'hours', o.hours,
        'phone', o.phone,
        'checked_on', (o.verified_at AT TIME ZONE 'Asia/Beirut')::date,
        'rates', app.office_current_rates(o.id),
        'changer', jsonb_build_object(
            'slug', p.slug, 'display_name', p.display_name, 'languages', to_jsonb(p.languages),
            'bdl_number', l.bdl_number, 'category', l.category, 'legal_name', l.legal_name,
            'register_checked_on', l.matched_on,
            'trust', app.partner_public_checks(p.id)
        )
    ) || CASE WHEN p_private THEN jsonb_build_object(
        'active', o.active,
        'verified', app.office_is_verified(o.id),
        'live', app.office_is_live(o.id),
        'recent_rates', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', r.id, 'base', r.base, 'buy', r.buy, 'sell', r.sell, 'posted_at', r.posted_at,
                'status', r.status, 'held_reason', r.held_reason
            ) ORDER BY r.posted_at DESC)
            FROM (SELECT * FROM app.exchange_rates WHERE office_id = o.id ORDER BY posted_at DESC LIMIT 10) r
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.exchange_offices o
    JOIN app.partners p ON p.id = o.partner_id
    JOIN app.destinations d ON d.id = o.destination_id
    LEFT JOIN app.exchange_licences l ON l.partner_id = p.id
    WHERE o.id = p_office
$$;

-- The changer's own view: profile, licence, branches, rates.
CREATE OR REPLACE FUNCTION app.changer_portal(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner uuid;
BEGIN
    SELECT id INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = 'changer';
    IF v_partner IS NULL THEN
        RETURN 'null'::jsonb;
    END IF;
    RETURN app.partner_json(v_partner, true) || jsonb_build_object(
        'licence', (SELECT jsonb_build_object(
            'bdl_number', l.bdl_number, 'category', l.category, 'legal_name', l.legal_name,
            'register_status', l.register_status, 'matched_on', l.matched_on,
            'rates_suspended_until', l.rates_suspended_until
        ) FROM app.exchange_licences l WHERE l.partner_id = v_partner),
        'offices', coalesce((
            SELECT jsonb_agg(app.office_json(o.id, true) ORDER BY o.created_at)
            FROM app.exchange_offices o WHERE o.partner_id = v_partner
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- Changers edit ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.changer_set_licence(p_user uuid, p_session uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_number text := upper(btrim(coalesce(p_payload->>'bdl_number', '')));
    v_category text := upper(btrim(coalesce(p_payload->>'category', '')));
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = 'changer';
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_partner.status IN ('approved', 'suspended') THEN
        PERFORM app.partner_require_step_up(p_user, p_session);
    END IF;
    IF v_number !~ '^[0-9A-Z/\-]{1,20}$' THEN
        RAISE EXCEPTION 'enter the registration number from the BDL list' USING ERRCODE = '22023';
    END IF;
    IF v_category NOT IN ('A', 'B') THEN
        RAISE EXCEPTION 'choose category A or B' USING ERRCODE = '22023';
    END IF;
    IF btrim(coalesce(p_payload->>'legal_name', '')) = '' THEN
        RAISE EXCEPTION 'enter the legal name as registered' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.exchange_licences (partner_id, bdl_number, category, legal_name)
    VALUES (v_partner.id, v_number, v_category, left(btrim(p_payload->>'legal_name'), 160))
    ON CONFLICT (partner_id) DO UPDATE
    SET bdl_number = EXCLUDED.bdl_number, category = EXCLUDED.category, legal_name = EXCLUDED.legal_name,
        -- A changed number or category is matched again before the changer shows.
        register_status = CASE
            WHEN app.exchange_licences.bdl_number = EXCLUDED.bdl_number AND app.exchange_licences.category = EXCLUDED.category
            THEN app.exchange_licences.register_status ELSE 'unchecked' END,
        updated_at = now();
    RETURN app.changer_portal(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.changer_upsert_office(p_user uuid, p_session uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_partner app.partners;
    v_office uuid := NULLIF(b->>'id', '')::uuid;
    v_dest uuid;
    v_lat double precision := NULLIF(b->>'lat', '')::double precision;
    v_lng double precision := NULLIF(b->>'lng', '')::double precision;
    v_old app.exchange_offices;
    v_day text;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = 'changer';
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_partner.status IN ('approved', 'suspended') THEN
        PERFORM app.partner_require_step_up(p_user, p_session);
    END IF;
    SELECT id INTO v_dest FROM app.destinations WHERE slug = b->>'destination';
    IF v_dest IS NULL THEN
        RAISE EXCEPTION 'choose the destination this branch is in' USING ERRCODE = '22023';
    END IF;
    IF v_lat IS NULL OR v_lng IS NULL OR v_lat NOT BETWEEN 33.0 AND 34.8 OR v_lng NOT BETWEEN 35.0 AND 36.7 THEN
        RAISE EXCEPTION 'pin the branch on the map, inside Lebanon' USING ERRCODE = '22023';
    END IF;
    IF btrim(coalesce(b->>'branch_name', '')) = '' OR btrim(coalesce(b->>'address', '')) = '' THEN
        RAISE EXCEPTION 'give the branch a name and an address' USING ERRCODE = '22023';
    END IF;
    FOR v_day IN SELECT jsonb_object_keys(coalesce(b->'hours', '{}'::jsonb)) LOOP
        IF v_day NOT IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') THEN
            RAISE EXCEPTION 'opening hours use mon to sun' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF v_office IS NULL THEN
        INSERT INTO app.exchange_offices (partner_id, branch_name, address, location, destination_id, hours, phone)
        VALUES (
            v_partner.id, left(btrim(b->>'branch_name'), 120), left(btrim(b->>'address'), 240),
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, v_dest,
            coalesce(b->'hours', '{}'::jsonb), left(btrim(coalesce(b->>'phone', '')), 20)
        ) RETURNING id INTO v_office;
    ELSE
        SELECT * INTO v_old FROM app.exchange_offices WHERE id = v_office AND partner_id = v_partner.id FOR UPDATE;
        IF v_old.id IS NULL THEN
            RAISE EXCEPTION 'branch not found' USING ERRCODE = 'P0002';
        END IF;
        UPDATE app.exchange_offices
        SET branch_name = left(btrim(b->>'branch_name'), 120),
            address = left(btrim(b->>'address'), 240),
            location = ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
            destination_id = v_dest,
            hours = coalesce(b->'hours', hours),
            phone = left(btrim(coalesce(b->>'phone', phone)), 20),
            active = coalesce((b->>'active')::boolean, active),
            -- Moving the branch means a new visit before it shows again.
            verified_at = CASE WHEN v_old.address <> btrim(b->>'address')
                                 OR ST_Distance(v_old.location, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography) > 50
                               THEN NULL ELSE verified_at END,
            updated_at = now()
        WHERE id = v_office;
    END IF;
    RETURN app.changer_portal(p_user);
EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'check the branch details' USING ERRCODE = '22023';
END;
$$;

-- Posting rates. Held for review when far from what other verified changers post.
CREATE OR REPLACE FUNCTION app.changer_post_rates(p_user uuid, p_session uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner uuid;
    v_office uuid := NULLIF(p_payload->>'office_id', '')::uuid;
    v_rate jsonb;
    v_buy numeric;
    v_sell numeric;
    v_median numeric;
    v_peers integer;
    v_status text;
    v_reason text;
    v_suspended timestamptz;
BEGIN
    SELECT id INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = 'changer';
    IF v_partner IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app.partner_require_step_up(p_user, p_session);
    IF NOT EXISTS (SELECT 1 FROM app.exchange_offices WHERE id = v_office AND partner_id = v_partner) THEN
        RAISE EXCEPTION 'branch not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT app.office_is_live(v_office) THEN
        RAISE EXCEPTION 'this branch is not live yet, so its rates cannot show' USING ERRCODE = '22023';
    END IF;
    SELECT rates_suspended_until INTO v_suspended FROM app.exchange_licences WHERE partner_id = v_partner;
    IF v_suspended IS NOT NULL AND v_suspended > now() THEN
        RAISE EXCEPTION 'rate posting is paused after upheld reports, until %', to_char(v_suspended AT TIME ZONE 'Asia/Beirut', 'YYYY-MM-DD')
            USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_payload->'rates') <> 'array' OR jsonb_array_length(p_payload->'rates') = 0 THEN
        RAISE EXCEPTION 'post at least one rate' USING ERRCODE = '22023';
    END IF;

    FOR v_rate IN SELECT value FROM jsonb_array_elements(p_payload->'rates') LOOP
        v_buy := (v_rate->>'buy')::numeric;
        v_sell := (v_rate->>'sell')::numeric;
        IF v_rate->>'base' NOT IN ('USD', 'EUR') OR v_buy IS NULL OR v_sell IS NULL OR v_buy <= 0 OR v_sell < v_buy
           OR v_sell > v_buy * 1.10 THEN
            RAISE EXCEPTION 'each rate needs a buy no higher than its sell, within 10%%' USING ERRCODE = '22023';
        END IF;
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (x.buy + x.sell) / 2), count(*)
        INTO v_median, v_peers
        FROM (
            SELECT DISTINCT ON (r.office_id) r.buy, r.sell
            FROM app.exchange_rates r
            JOIN app.exchange_offices o ON o.id = r.office_id
            WHERE r.base = v_rate->>'base' AND r.status = 'live' AND r.posted_at > now() - interval '12 hours'
              AND o.partner_id <> v_partner
            ORDER BY r.office_id, r.posted_at DESC
        ) x;
        IF v_peers >= 2 AND abs((v_buy + v_sell) / 2 - v_median) / v_median > 0.03 THEN
            v_status := 'held';
            v_reason := format('%s%% from the median of %s other changers',
                               round(abs((v_buy + v_sell) / 2 - v_median) / v_median * 100, 1), v_peers);
        ELSE
            v_status := 'live';
            v_reason := '';
        END IF;
        INSERT INTO app.exchange_rates (office_id, base, buy, sell, posted_by, status, held_reason)
        VALUES (v_office, v_rate->>'base', v_buy, v_sell, p_user, v_status, v_reason);
    END LOOP;
    RETURN app.changer_portal(p_user);
EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'rates must be numbers' USING ERRCODE = '22023';
END;
$$;

-- ---- Public reads ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.public_destination_changers(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    -- Sorted by name here; the page sorts by distance when it knows where you are.
    -- Never by rate: ranking by rate invites gaming.
    SELECT coalesce(jsonb_agg(app.office_json(o.id, false) ORDER BY p.display_name, o.branch_name), '[]'::jsonb)
    FROM app.exchange_offices o
    JOIN app.partners p ON p.id = o.partner_id
    JOIN app.destinations d ON d.id = o.destination_id
    WHERE d.slug = p_slug AND app.office_is_live(o.id)
$$;

-- ---- Reports -------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.report_exchange(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_category text := p_payload->>'category';
    v_details text := btrim(coalesce(p_payload->>'details', ''));
    v_office app.exchange_offices;
    v_id uuid;
BEGIN
    IF v_category NOT IN ('rate_different', 'counterfeit', 'refused_receipt', 'conduct', 'other') THEN
        RAISE EXCEPTION 'choose what kind of problem this is' USING ERRCODE = '22023';
    END IF;
    IF length(v_details) < 10 THEN
        RAISE EXCEPTION 'describe what happened in a sentence or two' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_office FROM app.exchange_offices WHERE id = NULLIF(p_payload->>'office_id', '')::uuid;
    IF v_office.id IS NULL OR NOT app.office_is_live(v_office.id) THEN
        RAISE EXCEPTION 'branch not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.support_cases (reporter_id, reason, evidence, escalated_at)
    VALUES (
        p_user, 'exchange_' || v_category,
        jsonb_build_array(jsonb_build_object(
            'kind', 'statement', 'text', left(v_details, 4000), 'office_id', v_office.id,
            'partner_id', v_office.partner_id
        )),
        CASE WHEN v_category = 'counterfeit' THEN now() END
    ) RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'category', v_category, 'escalated', v_category = 'counterfeit');
END;
$$;

-- ---- Staff --------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_load_bdl_register(p_admin uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_snapshot uuid;
    v_count integer;
    v_licence record;
    v_entry app.bdl_register_entries;
    v_matched integer := 0;
    v_missing jsonb := '[]'::jsonb;
    v_changed jsonb := '[]'::jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF jsonb_typeof(p_payload->'entries') <> 'array' OR jsonb_array_length(p_payload->'entries') = 0 THEN
        RAISE EXCEPTION 'the list has no rows' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_payload->>'source_url', '') !~ '^https://' THEN
        RAISE EXCEPTION 'link to the BDL page the list came from' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.bdl_register_snapshots (published_on, source_url, loaded_by)
    VALUES ((p_payload->>'published_on')::date, p_payload->>'source_url', p_admin)
    RETURNING id INTO v_snapshot;
    INSERT INTO app.bdl_register_entries (snapshot_id, bdl_number, category, name, address)
    SELECT v_snapshot, upper(btrim(e->>'bdl_number')), upper(btrim(e->>'category')),
           left(btrim(coalesce(e->>'name', '')), 200), left(btrim(coalesce(e->>'address', '')), 300)
    FROM jsonb_array_elements(p_payload->'entries') e
    WHERE btrim(coalesce(e->>'bdl_number', '')) <> ''
    ON CONFLICT (snapshot_id, bdl_number) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE app.bdl_register_snapshots SET entry_count = v_count WHERE id = v_snapshot;

    -- Diff every licence that was on the previous list, or has never been checked.
    FOR v_licence IN
        SELECT l.*, p.user_id, p.display_name FROM app.exchange_licences l JOIN app.partners p ON p.id = l.partner_id
    LOOP
        SELECT * INTO v_entry FROM app.bdl_register_entries
        WHERE snapshot_id = v_snapshot AND bdl_number = v_licence.bdl_number;
        IF v_entry.bdl_number IS NULL THEN
            IF v_licence.register_status IN ('matched', 'unchecked') THEN
                UPDATE app.exchange_licences SET register_status = 'missing', updated_at = now()
                WHERE partner_id = v_licence.partner_id;
                INSERT INTO app.trust_events (partner_id, event, actor_id, reason, details)
                VALUES (v_licence.partner_id, 'register_missing', p_admin, 'not on the BDL list',
                        jsonb_build_object('snapshot_id', v_snapshot, 'bdl_number', v_licence.bdl_number));
                IF v_licence.register_status = 'matched' THEN
                    PERFORM app.emit_notification_event(
                        'exchange.register_missing', md5(v_licence.partner_id::text || v_snapshot::text)::uuid,
                        v_licence.user_id, NULL, jsonb_build_object('path', '/exchange', 'status', v_licence.bdl_number)
                    );
                END IF;
                v_missing := v_missing || jsonb_build_array(jsonb_build_object(
                    'partner_id', v_licence.partner_id, 'display_name', v_licence.display_name,
                    'bdl_number', v_licence.bdl_number));
            END IF;
        ELSIF v_entry.category <> v_licence.category THEN
            UPDATE app.exchange_licences SET register_status = 'category_changed', updated_at = now()
            WHERE partner_id = v_licence.partner_id;
            INSERT INTO app.trust_events (partner_id, event, actor_id, reason, details)
            VALUES (v_licence.partner_id, 'register_missing', p_admin, 'category differs from the BDL list',
                    jsonb_build_object('snapshot_id', v_snapshot, 'listed_category', v_entry.category));
            v_changed := v_changed || jsonb_build_array(jsonb_build_object(
                'partner_id', v_licence.partner_id, 'display_name', v_licence.display_name,
                'bdl_number', v_licence.bdl_number, 'listed_category', v_entry.category));
        ELSE
            UPDATE app.exchange_licences
            SET register_status = 'matched', matched_on = (p_payload->>'published_on')::date,
                matched_snapshot_id = v_snapshot, updated_at = now()
            WHERE partner_id = v_licence.partner_id;
            INSERT INTO app.trust_events (partner_id, event, actor_id, details)
            VALUES (v_licence.partner_id, 'register_match', p_admin,
                    jsonb_build_object('snapshot_id', v_snapshot, 'bdl_number', v_licence.bdl_number));
            v_matched := v_matched + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('snapshot_id', v_snapshot, 'entries', v_count, 'matched', v_matched,
                              'missing', v_missing, 'category_changed', v_changed);
EXCEPTION WHEN invalid_datetime_format OR check_violation THEN
    RAISE EXCEPTION 'check the list date and that every category is A or B' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_register_status(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_latest app.bdl_register_snapshots;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_latest FROM app.bdl_register_snapshots ORDER BY loaded_at DESC LIMIT 1;
    RETURN jsonb_build_object(
        'latest', CASE WHEN v_latest.id IS NOT NULL THEN jsonb_build_object(
            'id', v_latest.id, 'published_on', v_latest.published_on, 'source_url', v_latest.source_url,
            'loaded_at', v_latest.loaded_at, 'entries', v_latest.entry_count) END,
        -- The list is reloaded monthly; past 35 days it is overdue.
        'overdue', v_latest.id IS NULL OR v_latest.loaded_at < now() - interval '35 days',
        'held_rates', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', r.id, 'base', r.base, 'buy', r.buy, 'sell', r.sell, 'posted_at', r.posted_at,
                'held_reason', r.held_reason, 'office', o.branch_name, 'changer', p.display_name
            ) ORDER BY r.posted_at)
            FROM app.exchange_rates r
            JOIN app.exchange_offices o ON o.id = r.office_id
            JOIN app.partners p ON p.id = o.partner_id
            WHERE r.status = 'held' AND r.posted_at > now() - interval '12 hours'
        ), '[]'::jsonb),
        'licences', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'partner_id', p.id, 'display_name', p.display_name, 'status', p.status,
                'bdl_number', l.bdl_number, 'category', l.category, 'register_status', l.register_status,
                'matched_on', l.matched_on, 'rates_suspended_until', l.rates_suspended_until,
                'offices', (SELECT jsonb_agg(jsonb_build_object(
                    'id', o.id, 'branch_name', o.branch_name, 'address', o.address,
                    'verified', app.office_is_verified(o.id), 'verified_at', o.verified_at))
                    FROM app.exchange_offices o WHERE o.partner_id = p.id)
            ) ORDER BY p.display_name)
            FROM app.exchange_licences l JOIN app.partners p ON p.id = l.partner_id
        ), '[]'::jsonb)
    );
END;
$$;

-- A reviewer visits (or video-calls) a branch and checks its shop front.
CREATE OR REPLACE FUNCTION app.admin_verify_office(p_admin uuid, p_office uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_office app.exchange_offices;
    v_kind text := p_payload->>'kind';
    v_notes text := btrim(coalesce(p_payload->>'notes', ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_office FROM app.exchange_offices WHERE id = p_office FOR UPDATE;
    IF v_office.id IS NULL THEN
        RAISE EXCEPTION 'branch not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_kind NOT IN ('visit', 'video_call') OR length(v_notes) < 10 THEN
        RAISE EXCEPTION 'record a visit or video call, with what you saw' USING ERRCODE = '22023';
    END IF;
    UPDATE app.exchange_offices SET verified_at = now(), verified_by = p_admin, updated_at = now() WHERE id = p_office;
    INSERT INTO app.trust_events (partner_id, event, actor_id, reason, details)
    VALUES (v_office.partner_id, v_kind, p_admin, left(v_notes, 2000),
            jsonb_build_object('office_id', p_office, 'branch', v_office.branch_name));
    RETURN app.office_json(p_office, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_decide_rate(p_admin uuid, p_rate uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('live', 'rejected') THEN
        RAISE EXCEPTION 'let it show or reject it' USING ERRCODE = '22023';
    END IF;
    UPDATE app.exchange_rates SET status = p_decision, reviewed_by = p_admin, reviewed_at = now()
    WHERE id = p_rate AND status = 'held';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'rate not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('id', p_rate, 'status', p_decision);
END;
$$;

-- Two upheld "rate was different" reports in 30 days pause rate posting for 30 days.
CREATE OR REPLACE FUNCTION app.admin_uphold_exchange_report(p_admin uuid, p_case uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_case app.support_cases;
    v_partner uuid;
    v_upheld integer;
    v_paused boolean := false;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_case FROM app.support_cases WHERE id = p_case;
    IF v_case.id IS NULL OR v_case.reason NOT LIKE 'exchange\_%' THEN
        RAISE EXCEPTION 'report not found' USING ERRCODE = 'P0002';
    END IF;
    v_partner := (v_case.evidence->0->>'partner_id')::uuid;
    IF EXISTS (SELECT 1 FROM app.trust_events WHERE partner_id = v_partner AND event = 'report_upheld'
               AND details->>'case_id' = p_case::text) THEN
        RAISE EXCEPTION 'this report is already upheld' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.trust_events (partner_id, event, actor_id, details)
    VALUES (v_partner, 'report_upheld', p_admin, jsonb_build_object('case_id', p_case, 'reason', v_case.reason));
    SELECT count(*) INTO v_upheld FROM app.trust_events
    WHERE partner_id = v_partner AND event = 'report_upheld' AND details->>'reason' = 'exchange_rate_different'
      AND created_at > now() - interval '30 days';
    IF v_case.reason = 'exchange_rate_different' AND v_upheld >= 2 THEN
        UPDATE app.exchange_licences SET rates_suspended_until = now() + interval '30 days', updated_at = now()
        WHERE partner_id = v_partner;
        v_paused := true;
    END IF;
    RETURN jsonb_build_object('upheld', true, 'rates_paused', v_paused);
END;
$$;

-- ---- Approval now knows about changers ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_decide_partner(
    p_admin uuid, p_partner uuid, p_decision text, p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_unverified integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('approved', 'rejected', 'suspended') THEN
        RAISE EXCEPTION 'unknown decision' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_partner FROM app.partners WHERE id = p_partner FOR UPDATE;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_decision IN ('rejected', 'suspended') AND NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN
        RAISE EXCEPTION 'give the reason the partner will see' USING ERRCODE = '22023';
    END IF;

    IF p_decision = 'approved' THEN
        IF v_partner.status NOT IN ('submitted', 'suspended') THEN
            RAISE EXCEPTION 'only a submitted or suspended partner can be approved' USING ERRCODE = '22023';
        END IF;
        SELECT count(*) INTO v_unverified FROM app.partner_documents d
        WHERE d.partner_id = v_partner.id AND NOT app.partner_document_valid(d.id)
          AND (d.vehicle_id IS NULL OR EXISTS (SELECT 1 FROM app.vehicles v WHERE v.id = d.vehicle_id AND v.active))
          AND (d.office_id IS NULL OR EXISTS (SELECT 1 FROM app.exchange_offices o WHERE o.id = d.office_id AND o.active));
        IF v_unverified > 0 OR jsonb_array_length(app.partner_missing_documents(v_partner.id)) > 0 THEN
            RAISE EXCEPTION 'every required document must be verified and in date first' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM app.trust_events e
            WHERE e.partner_id = v_partner.id AND e.event IN ('video_call', 'visit')
              AND e.created_at > coalesce(v_partner.submitted_at, v_partner.created_at) - interval '30 days'
        ) THEN
            RAISE EXCEPTION 'record the video call or visit before approving' USING ERRCODE = '22023';
        END IF;
        IF v_partner.kind = 'changer' THEN
            IF NOT EXISTS (SELECT 1 FROM app.exchange_licences WHERE partner_id = v_partner.id AND register_status = 'matched') THEN
                RAISE EXCEPTION 'match the BDL number against the current list first' USING ERRCODE = '22023';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM app.exchange_offices o WHERE o.partner_id = v_partner.id AND app.office_is_verified(o.id)) THEN
                RAISE EXCEPTION 'visit or video-call at least one branch first' USING ERRCODE = '22023';
            END IF;
        END IF;
    END IF;

    UPDATE app.partners
    SET status = p_decision, decided_at = now(), decided_by = p_admin,
        decision_reason = left(coalesce(btrim(p_reason), ''), 500), updated_at = now()
    WHERE id = p_partner;
    INSERT INTO app.trust_events (partner_id, event, actor_id, reason)
    VALUES (
        p_partner,
        CASE WHEN p_decision = 'approved' AND v_partner.status = 'suspended' THEN 'reinstated' ELSE p_decision END,
        p_admin, coalesce(btrim(p_reason), '')
    );
    RETURN app.admin_get_partner_case(p_admin, p_partner);
END;
$$;

-- Submitting a changer application needs the licence and at least one branch.
CREATE OR REPLACE FUNCTION app.partner_submit(p_user uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_missing jsonb;
    v_security jsonb;
    v_stale text;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = p_kind;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_partner.status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'application is not editable' USING ERRCODE = '22023';
    END IF;
    IF cardinality(v_partner.regions) = 0 AND p_kind = 'driver' THEN
        RAISE EXCEPTION 'choose at least one area you work in' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'driver' AND NOT EXISTS (SELECT 1 FROM app.vehicles WHERE partner_id = v_partner.id AND active) THEN
        RAISE EXCEPTION 'add the vehicle you drive' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'changer' THEN
        IF NOT EXISTS (SELECT 1 FROM app.exchange_licences WHERE partner_id = v_partner.id) THEN
            RAISE EXCEPTION 'add your BDL registration number and category' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM app.exchange_offices WHERE partner_id = v_partner.id AND active) THEN
            RAISE EXCEPTION 'add at least one branch' USING ERRCODE = '22023';
        END IF;
    END IF;
    v_missing := app.partner_missing_documents(v_partner.id);
    IF jsonb_array_length(v_missing) > 0 THEN
        RAISE EXCEPTION 'missing documents: %',
            (SELECT string_agg(value->>'kind', ', ') FROM jsonb_array_elements(v_missing)) USING ERRCODE = '22023';
    END IF;
    SELECT d.kind INTO v_stale
    FROM app.partner_documents d
    JOIN app.trust_requirements r ON r.subject_kind = p_kind AND r.document_kind = d.kind
    WHERE d.partner_id = v_partner.id AND r.fresh_days IS NOT NULL
      AND (d.issued_on IS NULL OR d.issued_on + r.fresh_days < app.beirut_today())
    LIMIT 1;
    IF v_stale IS NOT NULL THEN
        RAISE EXCEPTION 'the % must have been issued in the last three months', replace(v_stale, '_', ' ')
            USING ERRCODE = '22023';
    END IF;
    IF app.partner_accepted_agreement(v_partner.id) IS DISTINCT FROM app.current_partner_agreement_version(p_kind) THEN
        RAISE EXCEPTION 'accept the partner agreement first' USING ERRCODE = '22023';
    END IF;
    v_security := app.partner_security_status(p_user);
    IF NOT coalesce((v_security->>'phone_verified')::boolean, false) THEN
        RAISE EXCEPTION 'verify your phone number first' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((v_security->>'totp_enabled')::boolean, false) THEN
        RAISE EXCEPTION 'turn on two-step sign-in with an authenticator app first' USING ERRCODE = '22023';
    END IF;

    UPDATE app.partners
    SET status = 'submitted', submitted_at = now(), decision_reason = '', updated_at = now()
    WHERE id = v_partner.id;
    INSERT INTO app.trust_events (partner_id, event, actor_id) VALUES (v_partner.id, 'submitted', p_user);
    RETURN app.partner_json(v_partner.id, true);
END;
$$;

-- ---- The sweep --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.trust_sweep_exchange()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'register_overdue', NOT EXISTS (
            SELECT 1 FROM app.bdl_register_snapshots WHERE loaded_at > now() - interval '35 days'),
        'held_rates', (SELECT count(*) FROM app.exchange_rates WHERE status = 'held' AND posted_at > now() - interval '12 hours')
    )
$$;

CREATE OR REPLACE FUNCTION app.trust_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN jsonb_build_object(
        'partners', app.trust_sweep_partners(),
        'transport', app.trust_sweep_transport(),
        'rides', app.trust_sweep_rides(),
        'exchange', app.trust_sweep_exchange()
    );
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('exchange.register_missing', 'en', 'traveller', 'Your BDL number is not on the latest list',
     'Registration {status} is not on the latest Banque du Liban list, so travellers no longer see you. Contact us to fix it: {deep_link}'),
    ('exchange.register_missing', 'ar', 'traveller', 'رقمك غير موجود في أحدث لائحة لمصرف لبنان',
     'رقم التسجيل {status} غير موجود في أحدث لائحة لمصرف لبنان، لذلك لم يعد المسافرون يرونك. تواصل معنا لتصحيح ذلك: {deep_link}'),
    ('exchange.register_missing', 'fr', 'traveller', 'Votre numéro BDL n’est pas sur la dernière liste',
     'L’enregistrement {status} ne figure pas sur la dernière liste de la Banque du Liban : les voyageurs ne vous voient plus. Contactez-nous : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

GRANT EXECUTE ON FUNCTION
    app.partner_missing_documents(uuid),
    app.partner_documents_complete(uuid),
    app.partner_put_document(uuid, text, jsonb),
    app.partner_json(uuid, boolean),
    app.office_is_verified(uuid),
    app.partner_is_live(uuid),
    app.office_is_live(uuid),
    app.office_current_rates(uuid),
    app.office_json(uuid, boolean),
    app.changer_portal(uuid),
    app.changer_set_licence(uuid, uuid, jsonb),
    app.changer_upsert_office(uuid, uuid, jsonb),
    app.changer_post_rates(uuid, uuid, jsonb),
    app.public_destination_changers(text),
    app.report_exchange(uuid, jsonb),
    app.admin_load_bdl_register(uuid, jsonb),
    app.admin_register_status(uuid),
    app.admin_verify_office(uuid, uuid, jsonb),
    app.admin_decide_rate(uuid, uuid, text),
    app.admin_uphold_exchange_report(uuid, uuid),
    app.admin_decide_partner(uuid, uuid, text, text),
    app.partner_submit(uuid, text),
    app.trust_sweep_exchange(),
    app.trust_sweep()
TO mshwar_backend;
