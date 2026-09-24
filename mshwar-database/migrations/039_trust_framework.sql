-- 039_trust_framework.sql
-- V1 of verified local services: one trust framework for every partner who is
-- not a guide or a catalogue business - drivers first, money changers next.
--
-- The rules are the ones guides already follow, made general:
--
-- * A partner is a person (or a shop) with an application, private documents
--   and an admin decision. Documents carry a reference, an issuer and dates.
-- * What each kind of partner owes is data (app.trust_requirements), not code,
--   so a new document kind is one row.
-- * Trust is derived, never stored. A partner is "live" only while every
--   required document is verified and unexpired, the current agreement is
--   accepted and (for a driver) at least one vehicle is fully verified. A
--   document that lapses takes the partner off every public list that day.
-- * Every decision, visit and re-check is an event with who did it and when.
-- * Partner accounts authenticate harder than travellers: a verified phone and
--   an authenticator app before an application can be sent, and a fresh
--   authenticator code before changes to a plate, an address or rates.
-- * A daily sweep warns 30 and 7 days before a document expires and tells the
--   partner the day it lapses.

-- ---- Local dates ---------------------------------------------------------------
-- Documents expire on a Lebanese calendar day, not at UTC midnight.
CREATE OR REPLACE FUNCTION app.beirut_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'Asia/Beirut')::date $$;

-- ---- Partners ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id),
    kind text NOT NULL CHECK (kind IN ('driver', 'changer')),
    slug text NOT NULL UNIQUE,
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    headline text NOT NULL DEFAULT '',
    bio text NOT NULL DEFAULT '',
    languages text[] NOT NULL DEFAULT '{}',
    -- Destination handles, chosen by name in the portal.
    regions text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'suspended')),
    submitted_at timestamptz,
    decided_at timestamptz,
    decided_by uuid REFERENCES app.users(id),
    decision_reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, kind)
);
CREATE INDEX IF NOT EXISTS partners_kind_status_idx ON app.partners (kind, status);

CREATE TABLE IF NOT EXISTS app.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES app.partners(id) ON DELETE CASCADE,
    -- Public-transport plates in Lebanon are red and start with P. Stored
    -- normalised ("P 123456") so the traveller can match it on the day.
    plate text NOT NULL CHECK (plate ~ '^P [0-9]{1,7}$'),
    plate_rented boolean NOT NULL DEFAULT false,
    make text NOT NULL CHECK (btrim(make) <> ''),
    model text NOT NULL CHECK (btrim(model) <> ''),
    colour text NOT NULL CHECK (btrim(colour) <> ''),
    year integer CHECK (year IS NULL OR year BETWEEN 1970 AND 2100),
    seats integer NOT NULL CHECK (seats BETWEEN 1 AND 16),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plate)
);
CREATE INDEX IF NOT EXISTS vehicles_partner_idx ON app.vehicles (partner_id);

CREATE TABLE IF NOT EXISTS app.trust_requirements (
    subject_kind text NOT NULL,
    document_kind text NOT NULL,
    scope text NOT NULL CHECK (scope IN ('partner', 'vehicle', 'office')),
    needs_expiry boolean NOT NULL DEFAULT false,
    -- A document that is only good for so long after it was issued (a judicial
    -- record) lapses this many days after issued_on.
    valid_days integer CHECK (valid_days IS NULL OR valid_days > 0),
    -- ...and must be this fresh when the application is sent.
    fresh_days integer CHECK (fresh_days IS NULL OR fresh_days > 0),
    -- Shown to travellers as a line under "What we checked".
    public boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    PRIMARY KEY (subject_kind, document_kind)
);

INSERT INTO app.trust_requirements
    (subject_kind, document_kind, scope, needs_expiry, valid_days, fresh_days, public, sort_order)
VALUES
    ('driver', 'id', 'partner', false, NULL, NULL, true, 10),
    ('driver', 'selfie', 'partner', false, NULL, NULL, false, 20),
    ('driver', 'profile_photo', 'partner', false, NULL, NULL, false, 30),
    ('driver', 'public_licence', 'partner', true, NULL, NULL, true, 40),
    ('driver', 'judicial_record', 'partner', false, 365, 90, true, 50),
    ('driver', 'vehicle_registration', 'vehicle', false, NULL, NULL, true, 60),
    ('driver', 'insurance', 'vehicle', true, NULL, NULL, true, 70),
    ('driver', 'inspection', 'vehicle', true, NULL, NULL, true, 80),
    ('changer', 'id', 'partner', false, NULL, NULL, true, 10),
    ('changer', 'selfie', 'partner', false, NULL, NULL, false, 20),
    ('changer', 'bdl_registration', 'partner', false, NULL, NULL, true, 30),
    ('changer', 'commercial_register', 'partner', false, NULL, NULL, true, 40)
ON CONFLICT (subject_kind, document_kind) DO UPDATE
SET scope = EXCLUDED.scope, needs_expiry = EXCLUDED.needs_expiry, valid_days = EXCLUDED.valid_days,
    fresh_days = EXCLUDED.fresh_days, public = EXCLUDED.public, sort_order = EXCLUDED.sort_order;

-- Only needed when the red plate is rented rather than owned: the rental contract.
CREATE OR REPLACE FUNCTION app.partner_document_kinds()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ARRAY[
        'id', 'selfie', 'profile_photo', 'public_licence', 'judicial_record',
        'vehicle_registration', 'insurance', 'inspection', 'plate_rental',
        'bdl_registration', 'commercial_register', 'storefront_photo'
    ]
$$;

CREATE TABLE IF NOT EXISTS app.partner_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES app.partners(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind = ANY (app.partner_document_kinds())),
    vehicle_id uuid REFERENCES app.vehicles(id) ON DELETE CASCADE,
    reference text NOT NULL DEFAULT '',
    issuer text NOT NULL DEFAULT '',
    issued_on date,
    expires_on date,
    -- A storage key, never a URL. Photos of a partner's face may sit on the
    -- image CDN; everything else is private and read through signed links.
    provider text NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'imagekit')),
    document_key text NOT NULL CHECK (btrim(document_key) <> ''),
    verification text NOT NULL DEFAULT 'pending' CHECK (verification IN ('pending', 'verified', 'rejected')),
    reviewed_by uuid REFERENCES app.users(id),
    reviewed_at timestamptz,
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_documents_one_per_kind
    ON app.partner_documents (partner_id, kind, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS partner_documents_expiry_idx ON app.partner_documents (expires_on)
    WHERE verification = 'verified';

CREATE TABLE IF NOT EXISTS app.partner_agreements (
    partner_id uuid NOT NULL REFERENCES app.partners(id) ON DELETE CASCADE,
    version text NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}$'),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (partner_id, version)
);

CREATE TABLE IF NOT EXISTS app.trust_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL REFERENCES app.partners(id) ON DELETE CASCADE,
    event text NOT NULL CHECK (event IN (
        'submitted', 'document_verified', 'document_rejected', 'approved', 'rejected', 'suspended',
        'reinstated', 'video_call', 'visit', 'recheck', 'reminder', 'lapsed', 'register_match',
        'register_missing', 'report_upheld'
    )),
    actor_id uuid REFERENCES app.users(id),
    reason text NOT NULL DEFAULT '',
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_events_partner_idx ON app.trust_events (partner_id, created_at DESC);

COMMENT ON TABLE app.partners IS 'Drivers and money changers: one application each, decided by Mshwar.';
COMMENT ON TABLE app.partner_documents IS 'Private documents behind a partner application. Never exposed publicly.';
COMMENT ON TABLE app.trust_events IS 'Every decision, visit, re-check and lapse, with who and when.';

-- ---- Partner account security ------------------------------------------------------
-- No policy for the backend role: only the SECURITY DEFINER functions below
-- read or write these rows, so a secret never leaves them by accident.
CREATE TABLE IF NOT EXISTS app.partner_security (
    user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE CASCADE,
    phone_e164 text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    phone_verified_at timestamptz,
    totp_secret text,
    totp_pending_secret text,
    totp_enabled_at timestamptz,
    totp_last_step bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.phone_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    phone_e164 text NOT NULL,
    code_hash text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_challenges_user_idx ON app.phone_challenges (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.partner_step_ups (
    session_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    valid_until timestamptz NOT NULL
);

-- ---- Row-level security ----------------------------------------------------------------
ALTER TABLE app.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.partners FORCE ROW LEVEL SECURITY;
ALTER TABLE app.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trust_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trust_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE app.partner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.partner_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE app.partner_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.partner_agreements FORCE ROW LEVEL SECURITY;
ALTER TABLE app.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.trust_events FORCE ROW LEVEL SECURITY;
ALTER TABLE app.partner_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.partner_security FORCE ROW LEVEL SECURITY;
ALTER TABLE app.phone_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.phone_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE app.partner_step_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.partner_step_ups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_self ON app.partners;
CREATE POLICY partner_self ON app.partners FOR ALL TO mshwar_backend
    USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
DROP POLICY IF EXISTS vehicle_self ON app.vehicles;
CREATE POLICY vehicle_self ON app.vehicles FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = vehicles.partner_id AND p.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = vehicles.partner_id AND p.user_id = app.current_user_id()));
DROP POLICY IF EXISTS partner_document_self ON app.partner_documents;
CREATE POLICY partner_document_self ON app.partner_documents FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = partner_documents.partner_id AND p.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = partner_documents.partner_id AND p.user_id = app.current_user_id()));
DROP POLICY IF EXISTS partner_agreement_self ON app.partner_agreements;
CREATE POLICY partner_agreement_self ON app.partner_agreements FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = partner_agreements.partner_id AND p.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.partners p WHERE p.id = partner_agreements.partner_id AND p.user_id = app.current_user_id()));
DROP POLICY IF EXISTS trust_requirements_read ON app.trust_requirements;
CREATE POLICY trust_requirements_read ON app.trust_requirements FOR SELECT TO mshwar_backend USING (true);

GRANT SELECT, INSERT, UPDATE ON app.partners, app.vehicles, app.partner_documents, app.partner_agreements
    TO mshwar_backend;
GRANT SELECT ON app.trust_requirements TO mshwar_backend;
REVOKE ALL ON app.partner_security, app.phone_challenges, app.partner_step_ups, app.trust_events FROM mshwar_backend;

-- ---- Agreements ------------------------------------------------------------------------
-- Keep in step with apps/web/src/lib/legal/partner-agreements.ts.
CREATE OR REPLACE FUNCTION app.current_partner_agreement_version(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_kind WHEN 'driver' THEN '2026-09-23' WHEN 'changer' THEN '2026-09-23' END
$$;

CREATE OR REPLACE FUNCTION app.partner_accepted_agreement(p_partner uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT version FROM app.partner_agreements WHERE partner_id = p_partner ORDER BY version DESC LIMIT 1
$$;

-- ---- Derived trust -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.partner_document_valid(p_document uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM app.partner_documents d
        JOIN app.partners p ON p.id = d.partner_id
        LEFT JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.document_kind = d.kind
        WHERE d.id = p_document
          AND d.verification = 'verified'
          AND (d.expires_on IS NULL OR d.expires_on >= app.beirut_today())
          AND (r.valid_days IS NULL OR (d.issued_on IS NOT NULL AND d.issued_on + r.valid_days >= app.beirut_today()))
    )
$$;

-- The day a document stops counting: its expiry, or issued + valid_days.
CREATE OR REPLACE FUNCTION app.partner_document_lapses_on(p_document uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT least(d.expires_on, CASE WHEN r.valid_days IS NOT NULL THEN d.issued_on + r.valid_days END)
    FROM app.partner_documents d
    JOIN app.partners p ON p.id = d.partner_id
    LEFT JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.document_kind = d.kind
    WHERE d.id = p_document
$$;

-- What a vehicle still owes: its required documents, plus the plate rental when rented.
CREATE OR REPLACE FUNCTION app.vehicle_required_documents(p_vehicle uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(array_agg(r.document_kind ORDER BY r.sort_order), '{}')
        || CASE WHEN v.plate_rented THEN ARRAY['plate_rental'] ELSE ARRAY[]::text[] END
    FROM app.vehicles v
    JOIN app.partners p ON p.id = v.partner_id
    JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.scope = 'vehicle'
    WHERE v.id = p_vehicle
    GROUP BY v.plate_rented
$$;

CREATE OR REPLACE FUNCTION app.vehicle_is_live(p_vehicle uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT v.active AND NOT EXISTS (
        SELECT 1 FROM unnest(app.vehicle_required_documents(v.id)) AS required
        WHERE NOT EXISTS (
            SELECT 1 FROM app.partner_documents d
            WHERE d.vehicle_id = v.id AND d.kind = required AND app.partner_document_valid(d.id)
        )
    )
    FROM app.vehicles v WHERE v.id = p_vehicle
$$;

-- Every partner-scope requirement is verified and in date.
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
              WHERE d.partner_id = p.id AND d.kind = r.document_kind AND d.vehicle_id IS NULL
                AND app.partner_document_valid(d.id)
          )
    )
$$;

-- Shown to travellers only while this is true. Changers add their branches in 042.
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
        FROM app.partners p WHERE p.id = p_partner
    ), false)
$$;

-- verified | lapsed | pending | none. "lapsed" = approved, but a document ran out.
CREATE OR REPLACE FUNCTION app.partner_trust_level(p_partner uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN app.partner_is_live(p.id) THEN 'verified'
        WHEN p.status = 'approved' THEN 'lapsed'
        WHEN p.status = 'submitted' THEN 'pending'
        ELSE 'none'
    END
    FROM app.partners p WHERE p.id = p_partner
$$;

-- "What we checked": one line per public check with when it was checked and until when.
CREATE OR REPLACE FUNCTION app.partner_public_checks(p_partner uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'level', app.partner_trust_level(p.id),
        'checks', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'kind', d.kind,
                'checked_on', (d.reviewed_at AT TIME ZONE 'Asia/Beirut')::date,
                'valid_until', app.partner_document_lapses_on(d.id),
                'vehicle_plate', v.plate
            ) ORDER BY r.sort_order, v.plate)
            FROM app.partner_documents d
            JOIN app.trust_requirements r ON r.subject_kind = p.kind AND r.document_kind = d.kind AND r.public
            LEFT JOIN app.vehicles v ON v.id = d.vehicle_id
            WHERE d.partner_id = p.id AND app.partner_document_valid(d.id) AND (v.id IS NULL OR v.active)
        ), '[]'::jsonb),
        'in_person', (
            SELECT jsonb_build_object('kind', e.event, 'on', (e.created_at AT TIME ZONE 'Asia/Beirut')::date)
            FROM app.trust_events e
            WHERE e.partner_id = p.id AND e.event IN ('video_call', 'visit', 'recheck')
            ORDER BY e.created_at DESC LIMIT 1
        ),
        'approved_on', CASE WHEN p.status = 'approved' THEN (p.decided_at AT TIME ZONE 'Asia/Beirut')::date END
    )
    FROM app.partners p WHERE p.id = p_partner
$$;

-- What is still missing before the application can be sent, as {kind, vehicle_id?} rows.
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
              WHERE d.partner_id = p.id AND d.kind = r.document_kind AND d.vehicle_id IS NULL
          )
    ), '[]'::jsonb)
    || coalesce((
        SELECT jsonb_agg(jsonb_build_object('kind', required, 'vehicle_id', v.id, 'plate', v.plate))
        FROM app.vehicles v
        CROSS JOIN LATERAL unnest(app.vehicle_required_documents(v.id)) AS required
        WHERE v.partner_id = p_partner AND v.active
          AND NOT EXISTS (
              SELECT 1 FROM app.partner_documents d WHERE d.vehicle_id = v.id AND d.kind = required
          )
    ), '[]'::jsonb)
$$;

-- ---- Security status -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.partner_security_status(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'phone', s.phone_e164,
        'phone_verified', s.phone_verified_at IS NOT NULL,
        'totp_enabled', s.totp_enabled_at IS NOT NULL,
        'totp_pending', s.totp_pending_secret IS NOT NULL
    )
    FROM (SELECT p_user AS user_id) me
    LEFT JOIN app.partner_security s ON s.user_id = me.user_id
$$;

-- ---- Shapes --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.vehicle_json(p_vehicle uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', v.id, 'plate', v.plate, 'make', v.make, 'model', v.model, 'colour', v.colour,
        'year', v.year, 'seats', v.seats, 'live', app.vehicle_is_live(v.id)
    ) || CASE WHEN p_private THEN jsonb_build_object(
        'plate_rented', v.plate_rented,
        'active', v.active,
        'required_documents', to_jsonb(app.vehicle_required_documents(v.id))
    ) ELSE '{}'::jsonb END
    FROM app.vehicles v WHERE v.id = p_vehicle
$$;

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
                'id', d.id, 'kind', d.kind, 'vehicle_id', d.vehicle_id, 'reference', d.reference,
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

-- A live partner's public page; nothing while any document has lapsed.
CREATE OR REPLACE FUNCTION app.public_partner_page(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.partner_json(p.id, false) FROM app.partners p WHERE p.slug = p_slug AND app.partner_is_live(p.id)
$$;

-- ---- Applying ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.partner_id_for(p_user uuid, p_kind text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM app.partners WHERE user_id = p_user AND kind = p_kind;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_my_partner(p_user uuid, p_kind text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(
        (SELECT app.partner_json(p.id, true) FROM app.partners p WHERE p.user_id = p_user AND p.kind = p_kind),
        'null'::jsonb
    )
$$;

CREATE OR REPLACE FUNCTION app.partner_upsert_profile(p_user uuid, p_kind text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_name text := btrim(coalesce(p_payload->>'display_name', ''));
    v_slug text;
    v_suffix integer := 0;
    v_regions text[];
    v_bad text;
BEGIN
    IF p_kind NOT IN ('driver', 'changer') THEN
        RAISE EXCEPTION 'unknown partner kind' USING ERRCODE = '22023';
    END IF;
    IF length(v_name) < 2 THEN
        RAISE EXCEPTION 'name travellers will see is required' USING ERRCODE = '22023';
    END IF;
    IF p_payload ? 'regions' THEN
        SELECT coalesce(array_agg(DISTINCT value), '{}') INTO v_regions
        FROM jsonb_array_elements_text(p_payload->'regions');
        SELECT r INTO v_bad FROM unnest(v_regions) AS r
        WHERE NOT EXISTS (SELECT 1 FROM app.destinations d WHERE d.slug = r) LIMIT 1;
        IF v_bad IS NOT NULL THEN
            RAISE EXCEPTION 'unknown area: %', v_bad USING ERRCODE = '22023';
        END IF;
    END IF;

    SELECT id INTO v_id FROM app.partners WHERE user_id = p_user AND kind = p_kind;
    IF v_id IS NULL THEN
        v_slug := app.slugify(v_name);
        IF v_slug = '' THEN
            v_slug := p_kind;
        END IF;
        v_slug := v_slug || '-' || p_kind;
        WHILE EXISTS (SELECT 1 FROM app.partners WHERE slug = v_slug) LOOP
            v_suffix := v_suffix + 1;
            v_slug := app.slugify(v_name) || '-' || p_kind || '-' || v_suffix::text;
        END LOOP;
        INSERT INTO app.partners (user_id, kind, slug, display_name)
        VALUES (p_user, p_kind, v_slug, v_name) RETURNING id INTO v_id;
    END IF;

    UPDATE app.partners
    SET display_name = CASE WHEN status IN ('draft', 'rejected') THEN v_name ELSE display_name END,
        headline = left(coalesce(p_payload->>'headline', headline), 140),
        bio = left(coalesce(p_payload->>'bio', bio), 2000),
        languages = coalesce(
            (SELECT array_agg(DISTINCT lower(value)) FROM jsonb_array_elements_text(p_payload->'languages')
             WHERE value ~ '^[A-Za-z]{2,3}$'),
            languages),
        regions = coalesce(v_regions, regions),
        status = CASE WHEN status = 'rejected' THEN 'draft' ELSE status END,
        updated_at = now()
    WHERE id = v_id;
    RETURN app.partner_json(v_id, true);
END;
$$;

-- Sensitive changes on a live account need an authenticator code from this session.
CREATE OR REPLACE FUNCTION app.partner_require_step_up(p_user uuid, p_session uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.partner_step_ups s
        WHERE s.session_id = p_session AND s.user_id = p_user AND s.valid_until > now()
    ) THEN
        RAISE EXCEPTION 'step-up required: enter the code from your authenticator app' USING ERRCODE = '22023';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.partner_upsert_vehicle(p_user uuid, p_session uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_vehicle uuid := NULLIF(p_payload->>'id', '')::uuid;
    v_plate text := upper(regexp_replace(btrim(coalesce(p_payload->>'plate', '')), '[\s\-]+', '', 'g'));
    v_old_plate text;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = 'driver';
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_partner.status IN ('approved', 'suspended') THEN
        PERFORM app.partner_require_step_up(p_user, p_session);
    END IF;
    IF v_plate !~ '^P[0-9]{1,7}$' THEN
        RAISE EXCEPTION 'enter the red public plate, for example P 123456' USING ERRCODE = '22023';
    END IF;
    v_plate := 'P ' || substr(v_plate, 2);
    IF coalesce((p_payload->>'seats')::integer, 0) NOT BETWEEN 1 AND 16 THEN
        RAISE EXCEPTION 'seats must be between 1 and 16' USING ERRCODE = '22023';
    END IF;

    IF v_vehicle IS NULL THEN
        INSERT INTO app.vehicles (partner_id, plate, plate_rented, make, model, colour, year, seats)
        VALUES (
            v_partner.id, v_plate, coalesce((p_payload->>'plate_rented')::boolean, false),
            btrim(p_payload->>'make'), btrim(p_payload->>'model'), btrim(p_payload->>'colour'),
            NULLIF(p_payload->>'year', '')::integer, (p_payload->>'seats')::integer
        ) RETURNING id INTO v_vehicle;
    ELSE
        SELECT plate INTO v_old_plate FROM app.vehicles WHERE id = v_vehicle AND partner_id = v_partner.id;
        UPDATE app.vehicles
        SET plate = v_plate,
            plate_rented = coalesce((p_payload->>'plate_rented')::boolean, plate_rented),
            make = btrim(coalesce(p_payload->>'make', make)),
            model = btrim(coalesce(p_payload->>'model', model)),
            colour = btrim(coalesce(p_payload->>'colour', colour)),
            year = CASE WHEN p_payload ? 'year' THEN NULLIF(p_payload->>'year', '')::integer ELSE year END,
            seats = coalesce((p_payload->>'seats')::integer, seats),
            active = coalesce((p_payload->>'active')::boolean, active),
            updated_at = now()
        WHERE id = v_vehicle AND partner_id = v_partner.id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'vehicle not found' USING ERRCODE = 'P0002';
        END IF;
        -- A new plate is a new claim: its registration goes back to review.
        IF v_old_plate IS DISTINCT FROM v_plate THEN
            UPDATE app.partner_documents
            SET verification = 'pending', reviewed_by = NULL, reviewed_at = NULL, reason = ''
            WHERE vehicle_id = v_vehicle AND kind = 'vehicle_registration';
        END IF;
    END IF;
    RETURN app.partner_json(v_partner.id, true);
END;
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
    v_scope text;
    v_needs_expiry boolean;
    v_expires date := NULLIF(p_payload->>'expires_on', '')::date;
    v_issued date := NULLIF(p_payload->>'issued_on', '')::date;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE user_id = p_user AND kind = p_kind;
    IF v_partner.id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_doc = 'plate_rental' THEN
        v_scope := 'vehicle';
        v_needs_expiry := true;
    ELSE
        SELECT scope, needs_expiry INTO v_scope, v_needs_expiry
        FROM app.trust_requirements WHERE subject_kind = p_kind AND document_kind = v_doc;
    END IF;
    IF v_scope IS NULL OR v_scope = 'office' THEN
        RAISE EXCEPTION 'unknown document kind' USING ERRCODE = '22023';
    END IF;
    IF v_scope = 'vehicle' THEN
        IF v_vehicle IS NULL OR NOT EXISTS (
            SELECT 1 FROM app.vehicles WHERE id = v_vehicle AND partner_id = v_partner.id
        ) THEN
            RAISE EXCEPTION 'say which vehicle this document is for' USING ERRCODE = '22023';
        END IF;
    ELSE
        v_vehicle := NULL;
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
    WHERE partner_id = v_partner.id AND kind = v_doc AND vehicle_id IS NOT DISTINCT FROM v_vehicle;
    INSERT INTO app.partner_documents (
        partner_id, kind, vehicle_id, reference, issuer, issued_on, expires_on, provider, document_key
    ) VALUES (
        v_partner.id, v_doc, v_vehicle,
        left(btrim(coalesce(p_payload->>'reference', '')), 120),
        left(btrim(coalesce(p_payload->>'issuer', '')), 120),
        v_issued, v_expires,
        coalesce(NULLIF(p_payload->>'provider', ''), 'local'),
        btrim(p_payload->>'document_key')
    );
    RETURN app.partner_json(v_partner.id, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.partner_accept_agreement(p_user uuid, p_kind text, p_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid := app.partner_id_for(p_user, p_kind);
BEGIN
    IF p_version IS DISTINCT FROM app.current_partner_agreement_version(p_kind) THEN
        RAISE EXCEPTION 'agreement version is out of date' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.partner_agreements (partner_id, version) VALUES (v_id, p_version) ON CONFLICT DO NOTHING;
    RETURN app.partner_json(v_id, true);
END;
$$;

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
    IF cardinality(v_partner.regions) = 0 THEN
        RAISE EXCEPTION 'choose at least one area you work in' USING ERRCODE = '22023';
    END IF;
    IF p_kind = 'driver' AND NOT EXISTS (SELECT 1 FROM app.vehicles WHERE partner_id = v_partner.id AND active) THEN
        RAISE EXCEPTION 'add the vehicle you drive' USING ERRCODE = '22023';
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

-- ---- Phone and authenticator ----------------------------------------------------------------
-- Codes are generated, hashed and checked by the API; only hashes reach the database.
CREATE OR REPLACE FUNCTION app.security_start_phone(p_user uuid, p_phone text, p_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
        RAISE EXCEPTION 'enter the phone number with its country code, for example +961 70 123 456'
            USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM app.phone_challenges
        WHERE user_id = p_user AND created_at > now() - interval '1 hour') >= 5 THEN
        RAISE EXCEPTION 'too many codes sent; try again in an hour' USING ERRCODE = '53400';
    END IF;
    UPDATE app.phone_challenges SET consumed_at = now()
    WHERE user_id = p_user AND consumed_at IS NULL;
    INSERT INTO app.phone_challenges (user_id, phone_e164, code_hash, expires_at)
    VALUES (p_user, p_phone, p_code_hash, now() + interval '10 minutes');
    RETURN jsonb_build_object('sent_to', p_phone, 'expires_in_seconds', 600);
END;
$$;

CREATE OR REPLACE FUNCTION app.security_confirm_phone(p_user uuid, p_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_challenge app.phone_challenges;
BEGIN
    SELECT * INTO v_challenge FROM app.phone_challenges
    WHERE user_id = p_user AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF v_challenge.id IS NULL OR v_challenge.expires_at < now() OR v_challenge.attempts >= 5 THEN
        RAISE EXCEPTION 'that code has expired; send a new one' USING ERRCODE = '22023';
    END IF;
    UPDATE app.phone_challenges SET attempts = attempts + 1 WHERE id = v_challenge.id;
    IF v_challenge.code_hash <> p_code_hash THEN
        -- The attempt count must survive the failed check, so this is a
        -- returned verdict rather than an exception that would roll it back.
        RETURN jsonb_build_object('ok', false, 'attempts_left', 4 - v_challenge.attempts);
    END IF;
    UPDATE app.phone_challenges SET consumed_at = now() WHERE id = v_challenge.id;
    INSERT INTO app.partner_security (user_id, phone_e164, phone_verified_at, updated_at)
    VALUES (p_user, v_challenge.phone_e164, now(), now())
    ON CONFLICT (user_id) DO UPDATE
    SET phone_e164 = EXCLUDED.phone_e164, phone_verified_at = now(), updated_at = now();
    RETURN jsonb_build_object('ok', true) || app.partner_security_status(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.security_totp_begin(p_user uuid, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF p_secret !~ '^[A-Z2-7]{32}$' THEN
        RAISE EXCEPTION 'invalid secret' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM app.partner_security WHERE user_id = p_user AND totp_enabled_at IS NOT NULL) THEN
        RAISE EXCEPTION 'two-step sign-in is already on' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.partner_security (user_id, totp_pending_secret, updated_at)
    VALUES (p_user, p_secret, now())
    ON CONFLICT (user_id) DO UPDATE SET totp_pending_secret = EXCLUDED.totp_pending_secret, updated_at = now();
    RETURN app.partner_security_status(p_user);
END;
$$;

-- The backend needs the secret to check a code; nothing else ever reads it.
CREATE OR REPLACE FUNCTION app.security_totp_secret(p_user uuid, p_pending boolean)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE WHEN p_pending THEN totp_pending_secret ELSE totp_secret END
    FROM app.partner_security WHERE user_id = p_user
$$;

CREATE OR REPLACE FUNCTION app.security_totp_confirm(p_user uuid, p_step bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.partner_security
    SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled_at = now(),
        totp_last_step = p_step, updated_at = now()
    WHERE user_id = p_user AND totp_pending_secret IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start setting up the authenticator first' USING ERRCODE = '22023';
    END IF;
    RETURN app.partner_security_status(p_user);
END;
$$;

-- A code counts once: replaying the same (or an older) step is refused.
CREATE OR REPLACE FUNCTION app.security_step_up(p_user uuid, p_session uuid, p_step bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_until timestamptz := now() + interval '15 minutes';
BEGIN
    UPDATE app.partner_security
    SET totp_last_step = p_step, updated_at = now()
    WHERE user_id = p_user AND totp_enabled_at IS NOT NULL AND totp_last_step < p_step;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'that code was already used; wait for the next one' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.partner_step_ups (session_id, user_id, valid_until) VALUES (p_session, p_user, v_until)
    ON CONFLICT (session_id) DO UPDATE SET user_id = EXCLUDED.user_id, valid_until = EXCLUDED.valid_until;
    DELETE FROM app.partner_step_ups WHERE valid_until < now() - interval '1 day';
    RETURN jsonb_build_object('valid_until', v_until);
END;
$$;

-- ---- Admin review --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_list_partners(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text := NULLIF(btrim(coalesce(p_filter->>'status', '')), '');
    v_kind text := NULLIF(btrim(coalesce(p_filter->>'kind', '')), '');
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', p.id, 'kind', p.kind, 'slug', p.slug, 'display_name', p.display_name, 'status', p.status,
            'trust_level', app.partner_trust_level(p.id), 'submitted_at', p.submitted_at,
            'regions', to_jsonb(p.regions),
            'pending_documents', (SELECT count(*) FROM app.partner_documents d
                                  WHERE d.partner_id = p.id AND d.verification = 'pending'),
            'missing', app.partner_missing_documents(p.id),
            -- Hours waiting, for the 48-hour review target.
            'waiting_hours', CASE WHEN p.status = 'submitted'
                THEN round(extract(epoch FROM now() - p.submitted_at) / 3600) END
        ) ORDER BY p.submitted_at NULLS LAST, p.created_at)
        FROM app.partners p
        WHERE (v_status IS NULL OR p.status = v_status OR (v_status = 'lapsed' AND p.status = 'approved'
               AND NOT app.partner_is_live(p.id)))
          AND (v_kind IS NULL OR p.kind = v_kind)
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_get_partner_case(p_admin uuid, p_partner uuid)
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
    SELECT app.partner_json(p.id, true) || jsonb_build_object(
        'user_id', p.user_id,
        'document_keys', coalesce((
            SELECT jsonb_object_agg(d.id::text, jsonb_build_object('provider', d.provider, 'key', d.document_key))
            FROM app.partner_documents d WHERE d.partner_id = p.id
        ), '{}'::jsonb),
        'events', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'event', e.event, 'reason', e.reason, 'details', e.details, 'at', e.created_at,
                'actor', (SELECT display_name FROM app.users u WHERE u.id = e.actor_id)
            ) ORDER BY e.created_at DESC)
            FROM app.trust_events e WHERE e.partner_id = p.id
        ), '[]'::jsonb)
    ) INTO v_payload
    FROM app.partners p WHERE p.id = p_partner;
    IF v_payload IS NULL THEN
        RAISE EXCEPTION 'partner not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_review_partner_document(
    p_admin uuid, p_document uuid, p_decision text, p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_doc app.partner_documents;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_decision NOT IN ('verified', 'rejected') THEN
        RAISE EXCEPTION 'decision must be verified or rejected' USING ERRCODE = '22023';
    END IF;
    IF p_decision = 'rejected' AND NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN
        RAISE EXCEPTION 'say why the document was rejected' USING ERRCODE = '22023';
    END IF;
    UPDATE app.partner_documents
    SET verification = p_decision, reviewed_by = p_admin, reviewed_at = now(), reason = left(coalesce(btrim(p_reason), ''), 500)
    WHERE id = p_document
    RETURNING * INTO v_doc;
    IF v_doc.id IS NULL THEN
        RAISE EXCEPTION 'document not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.trust_events (partner_id, event, actor_id, reason, details)
    VALUES (
        v_doc.partner_id, CASE WHEN p_decision = 'verified' THEN 'document_verified' ELSE 'document_rejected' END,
        p_admin, coalesce(btrim(p_reason), ''), jsonb_build_object('kind', v_doc.kind, 'document_id', v_doc.id)
    );
    RETURN app.admin_get_partner_case(p_admin, v_doc.partner_id);
END;
$$;

-- A video call or a visit, recorded before approval and on every re-check.
CREATE OR REPLACE FUNCTION app.admin_record_partner_check(p_admin uuid, p_partner uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_kind text := p_payload->>'kind';
    v_notes text := btrim(coalesce(p_payload->>'notes', ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_kind NOT IN ('video_call', 'visit', 'recheck') THEN
        RAISE EXCEPTION 'record a video call, a visit or a re-check' USING ERRCODE = '22023';
    END IF;
    IF length(v_notes) < 10 THEN
        RAISE EXCEPTION 'note what you saw in a sentence or two' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.partners WHERE id = p_partner) THEN
        RAISE EXCEPTION 'partner not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.trust_events (partner_id, event, actor_id, reason, details)
    VALUES (p_partner, v_kind, p_admin, left(v_notes, 2000),
            jsonb_build_object('outcome', coalesce(p_payload->>'outcome', 'ok')));
    RETURN app.admin_get_partner_case(p_admin, p_partner);
END;
$$;

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
          AND (d.vehicle_id IS NULL OR EXISTS (SELECT 1 FROM app.vehicles v WHERE v.id = d.vehicle_id AND v.active));
        IF v_unverified > 0 OR jsonb_array_length(app.partner_missing_documents(v_partner.id)) > 0 THEN
            RAISE EXCEPTION 'every required document must be verified and in date first' USING ERRCODE = '22023';
        END IF;
        -- A person must have seen them: a video call or a visit is part of approval.
        IF NOT EXISTS (
            SELECT 1 FROM app.trust_events e
            WHERE e.partner_id = v_partner.id AND e.event IN ('video_call', 'visit')
              AND e.created_at > coalesce(v_partner.submitted_at, v_partner.created_at) - interval '30 days'
        ) THEN
            RAISE EXCEPTION 'record the video call or visit before approving' USING ERRCODE = '22023';
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

-- A random sample of live partners for the monthly re-check (10% by default, at least one).
CREATE OR REPLACE FUNCTION app.admin_recheck_sample(p_admin uuid, p_kind text, p_percent integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_live integer;
    v_take integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT count(*) INTO v_live FROM app.partners p WHERE p.kind = p_kind AND app.partner_is_live(p.id);
    v_take := CASE WHEN v_live = 0 THEN 0 ELSE greatest(1, ceil(v_live * least(greatest(p_percent, 1), 100) / 100.0)::integer) END;
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', s.id, 'display_name', s.display_name, 'slug', s.slug,
            'last_in_person', (SELECT max(e.created_at) FROM app.trust_events e
                               WHERE e.partner_id = s.id AND e.event IN ('video_call', 'visit', 'recheck'))
        ))
        FROM (
            SELECT p.id, p.display_name, p.slug FROM app.partners p
            WHERE p.kind = p_kind AND app.partner_is_live(p.id)
            -- Longest since a person last looked first, then random.
            ORDER BY (SELECT max(e.created_at) FROM app.trust_events e
                      WHERE e.partner_id = p.id AND e.event IN ('video_call', 'visit', 'recheck')) NULLS FIRST,
                     random()
            LIMIT v_take
        ) s
    ), '[]'::jsonb);
END;
$$;

-- ---- Decisions reach the partner ----------------------------------------------------------
CREATE OR REPLACE FUNCTION app.on_partner_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved', 'rejected', 'suspended') THEN
        RETURN NEW;
    END IF;
    PERFORM app.emit_notification_event(
        'partner.application_decided', NEW.id, NEW.user_id, NULL,
        jsonb_build_object('path', CASE NEW.kind WHEN 'driver' THEN '/drive' ELSE '/exchange' END, 'status', NEW.status)
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_status_change ON app.partners;
CREATE TRIGGER partner_status_change
    AFTER UPDATE OF status ON app.partners
    FOR EACH ROW EXECUTE FUNCTION app.on_partner_status_change();

-- ---- The daily sweep ------------------------------------------------------------------------
-- Warns 30 and 7 days ahead and on the day a document lapses. Aggregates are
-- derived from the document, its dates and the threshold, so each warning is
-- sent once and a renewed document starts afresh.
CREATE OR REPLACE FUNCTION app.trust_sweep_partners()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_doc record;
    v_warned integer := 0;
    v_lapsed integer := 0;
    v_days integer;
    v_path text;
BEGIN
    FOR v_doc IN
        SELECT d.id, d.kind, d.partner_id, p.user_id, p.kind AS partner_kind,
               app.partner_document_lapses_on(d.id) AS lapses_on
        FROM app.partner_documents d
        JOIN app.partners p ON p.id = d.partner_id
        WHERE d.verification = 'verified' AND p.status = 'approved'
    LOOP
        IF v_doc.lapses_on IS NULL THEN
            CONTINUE;
        END IF;
        v_days := v_doc.lapses_on - app.beirut_today();
        v_path := CASE v_doc.partner_kind WHEN 'driver' THEN '/drive' ELSE '/exchange' END;
        IF v_days IN (30, 7) OR (v_days BETWEEN 0 AND 6 AND NOT EXISTS (
            SELECT 1 FROM app.outbox o
            WHERE o.aggregate_id = md5(v_doc.id::text || ':' || v_doc.lapses_on::text || ':7')::uuid
        )) THEN
            PERFORM app.emit_notification_event(
                'partner.document_expiring',
                md5(v_doc.id::text || ':' || v_doc.lapses_on::text || ':' || CASE WHEN v_days > 7 THEN '30' ELSE '7' END)::uuid,
                v_doc.user_id, NULL,
                jsonb_build_object('path', v_path, 'status', v_doc.kind, 'lapses_on', v_doc.lapses_on)
            );
            v_warned := v_warned + 1;
        ELSIF v_days < 0 AND NOT EXISTS (
            SELECT 1 FROM app.trust_events e
            WHERE e.partner_id = v_doc.partner_id AND e.event = 'lapsed'
              AND e.details->>'document_id' = v_doc.id::text
              AND e.details->>'lapses_on' = v_doc.lapses_on::text
        ) THEN
            INSERT INTO app.trust_events (partner_id, event, reason, details)
            VALUES (v_doc.partner_id, 'lapsed', 'document expired',
                    jsonb_build_object('document_id', v_doc.id, 'kind', v_doc.kind, 'lapses_on', v_doc.lapses_on));
            PERFORM app.emit_notification_event(
                'partner.lapsed', md5(v_doc.id::text || ':' || v_doc.lapses_on::text || ':lapsed')::uuid,
                v_doc.user_id, NULL,
                jsonb_build_object('path', v_path, 'status', v_doc.kind)
            );
            v_lapsed := v_lapsed + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('warned', v_warned, 'lapsed', v_lapsed);
END;
$$;

-- One entry point for the scheduler; later migrations add their own sweeps here.
CREATE OR REPLACE FUNCTION app.trust_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN jsonb_build_object('partners', app.trust_sweep_partners());
END;
$$;

-- ---- Notifications ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.notification_deep_link(p_event text, p_payload jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN p_event ~ '^(partner|ride|exchange|transport|venue)\.' THEN
            coalesce(p_payload->>'path', '/')
        WHEN p_event LIKE 'engagement.%' AND p_payload->>'recipient' = 'guide' THEN
            '/guide/requests/' || coalesce(p_payload->>'engagement_id', p_payload->>'aggregate_id', '')
        WHEN p_event LIKE 'engagement.%' THEN
            '/plan/' || coalesce(p_payload->>'trip_id', '') || '/guide'
        WHEN p_event LIKE 'guide.%' THEN
            coalesce(p_payload->>'path', '/guide')
        WHEN p_event LIKE 'business.%' AND EXISTS (
            SELECT 1 FROM app.bookings b JOIN app.guide_profiles g ON g.organization_id = b.organization_id
            WHERE b.id::text = coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id')
        ) THEN
            '/guide/requests'
        WHEN p_event LIKE 'business.%' THEN
            '/business/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event = 'itinerary.material_change' THEN
            '/trips?highlight=' || coalesce(p_payload->>'trip_id', p_payload->>'aggregate_id', '')
        ELSE
            '/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
    END
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('partner.application_decided', 'en', 'traveller', 'Your Mshwar partner application was reviewed',
     'A reviewer has decided on your application ({status}). See what it means for you: {deep_link}'),
    ('partner.application_decided', 'ar', 'traveller', 'رُوجع طلبك كشريك في مشوار',
     'اتّخذ أحد المراجعين قرارًا بشأن طلبك ({status}). اطّلع على ما يعنيه لك: {deep_link}'),
    ('partner.application_decided', 'fr', 'traveller', 'Votre candidature de partenaire Mshwar a été examinée',
     'Un relecteur a statué sur votre candidature ({status}). Voir ce que cela implique : {deep_link}'),
    ('partner.document_expiring', 'en', 'traveller', 'A document runs out soon',
     'Your {status} document runs out soon. Upload the new one before it does, or you will stop showing to travellers: {deep_link}'),
    ('partner.document_expiring', 'ar', 'traveller', 'تنتهي صلاحية مستند قريبًا',
     'تنتهي صلاحية مستند {status} قريبًا. ارفع المستند الجديد قبل ذلك وإلا ستتوقف عن الظهور للمسافرين: {deep_link}'),
    ('partner.document_expiring', 'fr', 'traveller', 'Un document expire bientôt',
     'Votre document {status} expire bientôt. Envoyez le nouveau avant, sinon vous ne serez plus visible des voyageurs : {deep_link}'),
    ('partner.lapsed', 'en', 'traveller', 'You are hidden from travellers',
     'Your {status} document has run out, so travellers no longer see you. Upload the new one to come back: {deep_link}'),
    ('partner.lapsed', 'ar', 'traveller', 'لم تعد ظاهرًا للمسافرين',
     'انتهت صلاحية مستند {status}، لذلك لم يعد المسافرون يرونك. ارفع المستند الجديد لتعود: {deep_link}'),
    ('partner.lapsed', 'fr', 'traveller', 'Vous n’êtes plus visible des voyageurs',
     'Votre document {status} a expiré : les voyageurs ne vous voient plus. Envoyez le nouveau pour revenir : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

GRANT EXECUTE ON FUNCTION
    app.beirut_today(),
    app.partner_document_kinds(),
    app.current_partner_agreement_version(text),
    app.partner_accepted_agreement(uuid),
    app.partner_document_valid(uuid),
    app.partner_document_lapses_on(uuid),
    app.vehicle_required_documents(uuid),
    app.vehicle_is_live(uuid),
    app.partner_documents_complete(uuid),
    app.partner_is_live(uuid),
    app.partner_trust_level(uuid),
    app.partner_public_checks(uuid),
    app.partner_missing_documents(uuid),
    app.partner_security_status(uuid),
    app.vehicle_json(uuid, boolean),
    app.partner_json(uuid, boolean),
    app.public_partner_page(text),
    app.partner_id_for(uuid, text),
    app.get_my_partner(uuid, text),
    app.partner_upsert_profile(uuid, text, jsonb),
    app.partner_require_step_up(uuid, uuid),
    app.partner_upsert_vehicle(uuid, uuid, jsonb),
    app.partner_put_document(uuid, text, jsonb),
    app.partner_accept_agreement(uuid, text, text),
    app.partner_submit(uuid, text),
    app.security_start_phone(uuid, text, text),
    app.security_confirm_phone(uuid, text),
    app.security_totp_begin(uuid, text),
    app.security_totp_secret(uuid, boolean),
    app.security_totp_confirm(uuid, bigint),
    app.security_step_up(uuid, uuid, bigint),
    app.admin_list_partners(uuid, jsonb),
    app.admin_get_partner_case(uuid, uuid),
    app.admin_review_partner_document(uuid, uuid, text, text),
    app.admin_record_partner_check(uuid, uuid, jsonb),
    app.admin_decide_partner(uuid, uuid, text, text),
    app.admin_recheck_sample(uuid, text, integer),
    app.trust_sweep_partners(),
    app.trust_sweep(),
    app.notification_deep_link(text, jsonb)
TO mshwar_backend;
