-- 043_venues.sql
-- V5 and V6 of verified local services: local restaurants and places to stay.
--
-- A destination shows "Eat" and "Stay" only with checked places in them, and
-- the goal is at least five restaurants and three stays per published
-- destination. Two verification levels, because outside Beirut most stays are
-- guesthouses under a loosely enforced 2011 decree:
--
--   licensed_claimed  - the owner runs the listing and its operating licence
--                       (number, authority, expiry) was checked. Re-checked yearly.
--   checked_by_mshwar - our team visited or video-called the place, but no
--                       owner has claimed it yet. Re-checked every six months.
--
-- Every checked place carries a review date and is hidden the day it (or its
-- licence) runs out. Places come from owners in the business portal, from our
-- team's visits, and from guides' proposals; unclaimed ones invite a claim.
-- Nothing is scraped. Stays take a link to their own booking or a request;
-- there is no room inventory.

-- ---- Listing kinds and verification -----------------------------------------------------------
ALTER TABLE app.experiences DROP CONSTRAINT IF EXISTS experiences_listing_kind_check;
ALTER TABLE app.experiences ADD CONSTRAINT experiences_listing_kind_check
    CHECK (listing_kind IN ('experience', 'attraction', 'restaurant', 'hotel'));

ALTER TABLE app.experiences
    ADD COLUMN IF NOT EXISTS licence_number text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS licence_authority text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS licence_expires_on date,
    ADD COLUMN IF NOT EXISTS verified_level text CHECK (verified_level IN ('licensed_claimed', 'checked_by_mshwar')),
    ADD COLUMN IF NOT EXISTS checked_on date,
    ADD COLUMN IF NOT EXISTS checked_by uuid REFERENCES app.users(id),
    ADD COLUMN IF NOT EXISTS review_by date,
    ADD COLUMN IF NOT EXISTS check_notes text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS app.listing_details (
    experience_id uuid PRIMARY KEY REFERENCES app.experiences(id) ON DELETE CASCADE,
    -- Restaurants
    cuisines text[] NOT NULL DEFAULT '{}',
    price_level integer CHECK (price_level IS NULL OR price_level BETWEEN 1 AND 4),
    reservation_phone text NOT NULL DEFAULT '',
    reservation_whatsapp text NOT NULL DEFAULT '',
    reservation_url text NOT NULL DEFAULT '' CHECK (reservation_url = '' OR reservation_url ~ '^https://'),
    -- Stays
    stay_type text CHECK (stay_type IN ('hotel', 'guesthouse', 'hostel', 'apartment')),
    stars integer CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
    rooms integer CHECK (rooms IS NULL OR rooms BETWEEN 1 AND 2000),
    check_in time,
    check_out time,
    price_from_minor bigint CHECK (price_from_minor IS NULL OR price_from_minor > 0),
    currency text NOT NULL DEFAULT 'USD' REFERENCES app.currencies(code),
    booking_url text NOT NULL DEFAULT '' CHECK (booking_url = '' OR booking_url ~ '^https://'),
    accepts_requests boolean NOT NULL DEFAULT false,
    -- Both
    amenities text[] NOT NULL DEFAULT '{}',
    accessibility text[] NOT NULL DEFAULT '{}',
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.listing_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id uuid NOT NULL REFERENCES app.experiences(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES app.organizations(id),
    requested_by uuid NOT NULL REFERENCES app.users(id),
    note text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by uuid REFERENCES app.users(id),
    decided_at timestamptz,
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS listing_claims_one_pending ON app.listing_claims (experience_id) WHERE status = 'pending';

ALTER TABLE app.listing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.listing_details FORCE ROW LEVEL SECURITY;
ALTER TABLE app.listing_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.listing_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.listing_details, app.listing_claims FROM mshwar_backend;

-- ---- Derived visibility ----------------------------------------------------------------------------
-- A restaurant or stay shows under Eat and Stay only while checked and in date.
CREATE OR REPLACE FUNCTION app.venue_is_checked(p_experience uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT e.status = 'published' AND e.hidden_at IS NULL
           AND e.listing_kind IN ('restaurant', 'hotel')
           AND e.verified_level IS NOT NULL
           AND e.review_by >= app.beirut_today()
           AND (e.licence_expires_on IS NULL OR e.licence_expires_on >= app.beirut_today())
        FROM app.experiences e WHERE e.id = p_experience
    ), false)
$$;

CREATE OR REPLACE FUNCTION app.listing_details_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE WHEN d.experience_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
        'cuisines', to_jsonb(d.cuisines), 'price_level', d.price_level,
        'reservation_phone', d.reservation_phone, 'reservation_whatsapp', d.reservation_whatsapp,
        'reservation_url', d.reservation_url,
        'stay_type', d.stay_type, 'stars', d.stars, 'rooms', d.rooms,
        'check_in', to_char(d.check_in, 'HH24:MI'), 'check_out', to_char(d.check_out, 'HH24:MI'),
        'price_from_minor', d.price_from_minor, 'currency', d.currency,
        'booking_url', d.booking_url, 'accepts_requests', d.accepts_requests,
        'amenities', to_jsonb(d.amenities), 'accessibility', to_jsonb(d.accessibility)
    ) END
    FROM (SELECT p_experience AS id) me
    LEFT JOIN app.listing_details d ON d.experience_id = me.id
$$;

-- The card plus what a traveller needs to trust it.
CREATE OR REPLACE FUNCTION app.venue_card(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.catalogue_listing_row(e.id) || jsonb_build_object(
        'details', app.listing_details_json(e.id),
        'verification', jsonb_build_object(
            'level', e.verified_level,
            'checked_on', e.checked_on,
            'review_by', e.review_by,
            'licence', CASE WHEN e.verified_level = 'licensed_claimed' THEN jsonb_build_object(
                'number', e.licence_number, 'authority', e.licence_authority, 'expires_on', e.licence_expires_on) END,
            'claimed', o.slug <> 'mshwar-catalogue'
        )
    )
    FROM app.experiences e JOIN app.organizations o ON o.id = e.organization_id
    WHERE e.id = p_experience
$$;

CREATE OR REPLACE FUNCTION app.venue_targets()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$ SELECT jsonb_build_object('restaurants', 5, 'stays', 3) $$;

CREATE OR REPLACE FUNCTION app.public_destination_eat_stay(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_dest uuid;
BEGIN
    SELECT id INTO v_dest FROM app.destinations WHERE slug = p_slug AND status = 'published';
    IF v_dest IS NULL THEN
        RAISE EXCEPTION 'destination not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
        'restaurants', coalesce((
            SELECT jsonb_agg(app.venue_card(e.id) ORDER BY (e.verified_level = 'licensed_claimed') DESC, e.title)
            FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
            WHERE v.destination_id = v_dest AND e.listing_kind = 'restaurant' AND app.venue_is_checked(e.id)
        ), '[]'::jsonb),
        'stays', coalesce((
            SELECT jsonb_agg(app.venue_card(e.id) ORDER BY (e.verified_level = 'licensed_claimed') DESC, e.title)
            FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
            WHERE v.destination_id = v_dest AND e.listing_kind = 'hotel' AND app.venue_is_checked(e.id)
        ), '[]'::jsonb),
        'targets', app.venue_targets()
    );
END;
$$;

-- For the planner: where to sleep near the day's last stop, and where to eat near a stop.
CREATE OR REPLACE FUNCTION app.public_venues_near(p_kind text, p_lat double precision, p_lng double precision,
                                                  p_radius_m integer DEFAULT 15000)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(card ORDER BY distance_m), '[]'::jsonb)
    FROM (
        SELECT app.venue_card(e.id) || jsonb_build_object('distance_m', round(ST_Distance(v.location, pt.g))) AS card,
               ST_Distance(v.location, pt.g) AS distance_m
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        CROSS JOIN (SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g) pt
        WHERE e.listing_kind = p_kind AND p_kind IN ('restaurant', 'hotel')
          AND ST_DWithin(v.location, pt.g, least(greatest(p_radius_m, 500), 50000))
          AND app.venue_is_checked(e.id)
        ORDER BY ST_Distance(v.location, pt.g)
        LIMIT 6
    ) near
$$;

-- ---- Owners in the business portal ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.portal_set_listing_details(p_user uuid, p_org uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_kind text := b->>'listing_kind';
    v_old app.experiences;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    SELECT * INTO v_old FROM app.experiences WHERE id = p_experience AND organization_id = p_org FOR UPDATE;
    IF v_old.id IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_kind NOT IN ('experience', 'attraction', 'restaurant', 'hotel') THEN
        RAISE EXCEPTION 'choose what kind of place this is' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('app.organization_id', p_org::text, true);
    UPDATE app.experiences
    SET listing_kind = v_kind,
        licence_number = left(btrim(coalesce(b->>'licence_number', licence_number)), 60),
        licence_authority = left(btrim(coalesce(b->>'licence_authority', licence_authority)), 120),
        licence_expires_on = CASE WHEN b ? 'licence_expires_on' THEN NULLIF(b->>'licence_expires_on', '')::date
                                  ELSE licence_expires_on END,
        -- A new licence number, or a new kind, is a new claim: checked again.
        verified_level = CASE
            WHEN v_old.listing_kind <> v_kind THEN NULL
            WHEN v_old.verified_level = 'licensed_claimed'
                 AND btrim(coalesce(b->>'licence_number', v_old.licence_number)) <> v_old.licence_number
            THEN 'checked_by_mshwar'
            ELSE verified_level END,
        updated_at = now()
    WHERE id = p_experience;

    INSERT INTO app.listing_details (experience_id) VALUES (p_experience) ON CONFLICT DO NOTHING;
    UPDATE app.listing_details
    SET cuisines = coalesce((SELECT array_agg(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(b->'cuisines')
                             WHERE btrim(value) <> ''), '{}'),
        price_level = NULLIF(b->>'price_level', '')::integer,
        reservation_phone = left(btrim(coalesce(b->>'reservation_phone', '')), 20),
        reservation_whatsapp = left(btrim(coalesce(b->>'reservation_whatsapp', '')), 20),
        reservation_url = btrim(coalesce(b->>'reservation_url', '')),
        stay_type = CASE WHEN v_kind = 'hotel' THEN coalesce(NULLIF(b->>'stay_type', ''), 'hotel') END,
        stars = CASE WHEN v_kind = 'hotel' THEN NULLIF(b->>'stars', '')::integer END,
        rooms = CASE WHEN v_kind = 'hotel' THEN NULLIF(b->>'rooms', '')::integer END,
        check_in = CASE WHEN v_kind = 'hotel' THEN NULLIF(b->>'check_in', '')::time END,
        check_out = CASE WHEN v_kind = 'hotel' THEN NULLIF(b->>'check_out', '')::time END,
        price_from_minor = NULLIF(b->>'price_from_minor', '')::bigint,
        booking_url = btrim(coalesce(b->>'booking_url', '')),
        accepts_requests = coalesce((b->>'accepts_requests')::boolean, false),
        amenities = coalesce((SELECT array_agg(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(b->'amenities')
                              WHERE btrim(value) <> ''), '{}'),
        accessibility = coalesce((SELECT array_agg(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(b->'accessibility')
                                  WHERE btrim(value) <> ''), '{}'),
        updated_at = now()
    WHERE experience_id = p_experience;
    RETURN app.venue_card(p_experience) || jsonb_build_object('checked', app.venue_is_checked(p_experience));
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the price level, stars, rooms and links (links start with https://)' USING ERRCODE = '22023';
    WHEN invalid_datetime_format OR invalid_text_representation THEN
        RAISE EXCEPTION 'check the times and numbers on this listing' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.portal_get_listing_details(p_user uuid, p_org uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN (
        SELECT jsonb_build_object(
            'listing_kind', e.listing_kind,
            'licence_number', e.licence_number, 'licence_authority', e.licence_authority,
            'licence_expires_on', e.licence_expires_on,
            'verification', jsonb_build_object('level', e.verified_level, 'checked_on', e.checked_on, 'review_by', e.review_by),
            'checked', app.venue_is_checked(e.id),
            'details', app.listing_details_json(e.id)
        ) FROM app.experiences e WHERE e.id = p_experience
    );
END;
$$;

-- An owner claims a place our team or a guide added. Their organisation must be verified first.
CREATE OR REPLACE FUNCTION app.portal_claim_listing(p_user uuid, p_org uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_exp app.experiences;
    v_id uuid;
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    IF NOT EXISTS (SELECT 1 FROM app.organizations WHERE id = p_org AND verification = 'verified') THEN
        RAISE EXCEPTION 'verify your business before claiming a place' USING ERRCODE = '22023';
    END IF;
    SELECT e.* INTO v_exp FROM app.experiences e JOIN app.organizations o ON o.id = e.organization_id
    WHERE e.slug = p_payload->>'slug' AND o.slug = 'mshwar-catalogue' AND e.status = 'published';
    IF v_exp.id IS NULL THEN
        RAISE EXCEPTION 'place not found, or it is already claimed' USING ERRCODE = 'P0002';
    END IF;
    IF length(btrim(coalesce(p_payload->>'note', ''))) < 10 THEN
        RAISE EXCEPTION 'say how you are connected to this place' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.listing_claims (experience_id, organization_id, requested_by, note)
    VALUES (v_exp.id, p_org, p_user, left(btrim(p_payload->>'note'), 1000))
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'status', 'pending', 'experience', app.venue_card(v_exp.id));
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'someone has already asked to claim this place' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.portal_list_claims(p_user uuid, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'settings');
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', c.id, 'status', c.status, 'reason', c.reason, 'created_at', c.created_at,
            'experience', jsonb_build_object('slug', e.slug, 'title', e.title)
        ) ORDER BY c.created_at DESC)
        FROM app.listing_claims c JOIN app.experiences e ON e.id = c.experience_id
        WHERE c.organization_id = p_org
    ), '[]'::jsonb);
END;
$$;

-- ---- Staff ---------------------------------------------------------------------------------------------
-- Our team adds a place it visited. It belongs to the catalogue organisation until claimed.
CREATE OR REPLACE FUNCTION app.admin_add_checked_venue(p_admin uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_org uuid;
    v_dest uuid;
    v_venue uuid;
    v_exp uuid;
    v_slug text;
    v_n integer := 1;
    v_kind text := b->>'listing_kind';
    v_lat double precision := (b->>'lat')::double precision;
    v_lng double precision := (b->>'lng')::double precision;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_kind NOT IN ('restaurant', 'hotel') THEN
        RAISE EXCEPTION 'a restaurant or a place to stay' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';
    SELECT id INTO v_dest FROM app.destinations WHERE slug = b->>'destination';
    IF v_dest IS NULL THEN
        RAISE EXCEPTION 'choose the destination' USING ERRCODE = '22023';
    END IF;
    IF v_lat IS NULL OR v_lng IS NULL OR v_lat NOT BETWEEN 33.0 AND 34.8 OR v_lng NOT BETWEEN 35.0 AND 36.7 THEN
        RAISE EXCEPTION 'the pin has to be in Lebanon' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'name', ''))) < 3 OR length(btrim(coalesce(b->>'description', ''))) < 20 THEN
        RAISE EXCEPTION 'give a name and a description of at least 20 characters' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'notes', ''))) < 10 THEN
        RAISE EXCEPTION 'note what you saw on the visit' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
        WHERE app.slugify(e.title) = app.slugify(b->>'name')
          AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, 300)
    ) THEN
        RAISE EXCEPTION 'this place is already listed' USING ERRCODE = '22023';
    END IF;
    PERFORM set_config('app.organization_id', v_org::text, true);
    INSERT INTO app.venues (organization_id, destination_id, name, address, timezone, location, location_source, source_reference)
    VALUES (v_org, v_dest, btrim(b->>'name'), coalesce(NULLIF(btrim(b->>'address'), ''), btrim(b->>'name')), 'Asia/Beirut',
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography, 'mshwar-visit', 'visit:' || app.beirut_today())
    RETURNING id INTO v_venue;
    v_slug := app.slugify(b->>'name');
    WHILE EXISTS (SELECT 1 FROM app.experiences WHERE slug = v_slug) LOOP
        v_n := v_n + 1;
        v_slug := app.slugify(b->>'name') || '-' || v_n;
    END LOOP;
    INSERT INTO app.experiences (
        organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, min_party,
        max_party, setting, weather_sensitivity, listing_kind, inventory_available, catalogue_summary, catalogue_facts,
        verified_level, checked_on, checked_by, review_by, check_notes
    ) VALUES (
        v_org, v_venue, v_slug, btrim(b->>'name'), btrim(b->>'description'), 'published', 'inquiry',
        CASE WHEN v_kind = 'restaurant' THEN 75 ELSE 60 END, 1, 20, 'indoor', 'indoor', v_kind, true,
        left(btrim(b->>'description'), 280), '[]'::jsonb,
        'checked_by_mshwar', app.beirut_today(), p_admin, app.beirut_today() + 180, left(btrim(b->>'notes'), 2000)
    ) RETURNING id INTO v_exp;
    -- No invented prices: on request until the owner sets them.
    INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
    VALUES (v_exp, 'USD', 'quote-required', 'person', NULL, '(,)', 'visit');
    INSERT INTO app.experience_translations (experience_id, locale, title, description)
    VALUES (v_exp, 'en', btrim(b->>'name'), btrim(b->>'description'))
    ON CONFLICT (experience_id, locale) DO NOTHING;
    RETURN app.portal_set_listing_details_admin(v_exp, b);
EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'check the pin and numbers' USING ERRCODE = '22023';
END;
$$;

-- Details written by staff on a catalogue-owned place (same fields as the portal).
CREATE OR REPLACE FUNCTION app.portal_set_listing_details_admin(p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_kind text;
BEGIN
    SELECT listing_kind INTO v_kind FROM app.experiences WHERE id = p_experience;
    INSERT INTO app.listing_details (experience_id) VALUES (p_experience) ON CONFLICT DO NOTHING;
    UPDATE app.listing_details
    SET cuisines = coalesce((SELECT array_agg(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(b->'cuisines')
                             WHERE btrim(value) <> ''), cuisines),
        price_level = coalesce(NULLIF(b->>'price_level', '')::integer, price_level),
        reservation_phone = coalesce(NULLIF(btrim(b->>'reservation_phone'), ''), reservation_phone),
        stay_type = CASE WHEN v_kind = 'hotel' THEN coalesce(NULLIF(b->>'stay_type', ''), stay_type, 'guesthouse') END,
        stars = CASE WHEN v_kind = 'hotel' THEN coalesce(NULLIF(b->>'stars', '')::integer, stars) END,
        price_from_minor = coalesce(NULLIF(b->>'price_from_minor', '')::bigint, price_from_minor),
        booking_url = coalesce(NULLIF(btrim(b->>'booking_url'), ''), booking_url),
        amenities = coalesce((SELECT array_agg(DISTINCT lower(btrim(value))) FROM jsonb_array_elements_text(b->'amenities')
                              WHERE btrim(value) <> ''), amenities),
        updated_at = now()
    WHERE experience_id = p_experience;
    RETURN app.venue_card(p_experience) || jsonb_build_object('checked', app.venue_is_checked(p_experience));
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'check the price level, stars and links' USING ERRCODE = '22023';
END;
$$;

-- A reviewer checks a restaurant or stay: which level, when, and what they saw.
CREATE OR REPLACE FUNCTION app.admin_check_venue(p_admin uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_exp app.experiences;
    v_org app.organizations;
    v_level text := p_payload->>'level';
    v_checked date := coalesce(NULLIF(p_payload->>'checked_on', '')::date, app.beirut_today());
    v_notes text := btrim(coalesce(p_payload->>'notes', ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_exp FROM app.experiences WHERE id = p_experience FOR UPDATE;
    IF v_exp.id IS NULL OR v_exp.listing_kind NOT IN ('restaurant', 'hotel') THEN
        RAISE EXCEPTION 'restaurant or stay not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_org FROM app.organizations WHERE id = v_exp.organization_id;
    IF v_level NOT IN ('licensed_claimed', 'checked_by_mshwar') THEN
        RAISE EXCEPTION 'choose the verification level' USING ERRCODE = '22023';
    END IF;
    IF length(v_notes) < 10 THEN
        RAISE EXCEPTION 'note what you checked' USING ERRCODE = '22023';
    END IF;
    IF v_checked > app.beirut_today() OR v_checked < app.beirut_today() - 30 THEN
        RAISE EXCEPTION 'the check must be from the last 30 days' USING ERRCODE = '22023';
    END IF;
    IF v_level = 'licensed_claimed' THEN
        IF v_org.slug = 'mshwar-catalogue' OR v_org.verification <> 'verified' THEN
            RAISE EXCEPTION 'licensed and claimed needs a verified owner' USING ERRCODE = '22023';
        END IF;
        IF btrim(v_exp.licence_number) = '' OR btrim(v_exp.licence_authority) = '' THEN
            RAISE EXCEPTION 'the owner must add the licence number and who issued it' USING ERRCODE = '22023';
        END IF;
        IF v_exp.licence_expires_on IS NOT NULL AND v_exp.licence_expires_on < app.beirut_today() THEN
            RAISE EXCEPTION 'that licence has expired' USING ERRCODE = '22023';
        END IF;
    END IF;
    PERFORM set_config('app.organization_id', v_exp.organization_id::text, true);
    UPDATE app.experiences
    SET verified_level = v_level, checked_on = v_checked, checked_by = p_admin,
        review_by = v_checked + CASE WHEN v_level = 'licensed_claimed' THEN 365 ELSE 180 END,
        check_notes = left(v_notes, 2000),
        hidden_at = CASE WHEN hidden_reason = 'verification lapsed' THEN NULL ELSE hidden_at END,
        hidden_reason = CASE WHEN hidden_reason = 'verification lapsed' THEN NULL ELSE hidden_reason END,
        updated_at = now()
    WHERE id = p_experience;
    RETURN app.venue_card(p_experience) || jsonb_build_object('checked', app.venue_is_checked(p_experience));
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_decide_claim(p_admin uuid, p_claim uuid, p_decision text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_claim app.listing_claims;
    v_old_venue uuid;
    v_new_venue uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_claim FROM app.listing_claims WHERE id = p_claim FOR UPDATE;
    IF v_claim.id IS NULL OR v_claim.status <> 'pending' THEN
        RAISE EXCEPTION 'claim not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'approve or reject' USING ERRCODE = '22023';
    END IF;
    IF p_decision = 'rejected' AND length(btrim(coalesce(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'tell the business why' USING ERRCODE = '22023';
    END IF;
    IF p_decision = 'approved' THEN
        PERFORM set_config('app.organization_id', v_claim.organization_id::text, true);
        -- A listing and its venue belong to one organisation (a composite key), so the
        -- venue moves as a copy under the new owner, with its hours, in one step.
        SELECT venue_id INTO v_old_venue FROM app.experiences WHERE id = v_claim.experience_id;
        INSERT INTO app.venues (organization_id, destination_id, name, address, timezone, location, location_source,
                                source_reference, source_expires_at)
        SELECT v_claim.organization_id, destination_id, name, address, timezone, location, location_source,
               source_reference, source_expires_at
        FROM app.venues WHERE id = v_old_venue
        RETURNING id INTO v_new_venue;
        UPDATE app.experiences
        SET organization_id = v_claim.organization_id, venue_id = v_new_venue, updated_at = now()
        WHERE id = v_claim.experience_id;
        IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE venue_id = v_old_venue) THEN
            UPDATE app.opening_hours SET venue_id = v_new_venue WHERE venue_id = v_old_venue;
            UPDATE app.opening_exceptions SET venue_id = v_new_venue WHERE venue_id = v_old_venue;
            UPDATE app.weather_snapshots SET venue_id = v_new_venue WHERE venue_id = v_old_venue;
        ELSE
            INSERT INTO app.opening_hours (venue_id, weekday, opens, closes)
            SELECT v_new_venue, weekday, opens, closes FROM app.opening_hours WHERE venue_id = v_old_venue;
        END IF;
        UPDATE app.listing_claims SET status = 'rejected', reason = 'another claim was approved', decided_at = now(),
            decided_by = p_admin
        WHERE experience_id = v_claim.experience_id AND id <> v_claim.id AND status = 'pending';
    END IF;
    UPDATE app.listing_claims SET status = p_decision, decided_by = p_admin, decided_at = now(),
        reason = left(coalesce(btrim(p_reason), ''), 500)
    WHERE id = p_claim;
    PERFORM app.emit_notification_event(
        'venue.claim_decided', v_claim.id, v_claim.requested_by, NULL,
        jsonb_build_object('path', '/business/listings', 'status', p_decision)
    );
    RETURN jsonb_build_object('id', p_claim, 'status', p_decision, 'experience', app.venue_card(v_claim.experience_id));
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_list_venues(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_dest text := NULLIF(btrim(coalesce(p_filter->>'destination', '')), '');
    v_kind text := NULLIF(btrim(coalesce(p_filter->>'kind', '')), '');
    v_due boolean := coalesce((p_filter->>'due')::boolean, false);
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'venues', coalesce((
            SELECT jsonb_agg(app.venue_card(e.id) || jsonb_build_object(
                'id', e.id, 'checked', app.venue_is_checked(e.id), 'check_notes', e.check_notes,
                'owner', o.name, 'destination', d.slug,
                'licence_number', e.licence_number, 'licence_authority', e.licence_authority,
                'licence_expires_on', e.licence_expires_on
            ) ORDER BY e.review_by NULLS FIRST, e.title)
            FROM app.experiences e
            JOIN app.venues v ON v.id = e.venue_id
            JOIN app.destinations d ON d.id = v.destination_id
            JOIN app.organizations o ON o.id = e.organization_id
            WHERE e.listing_kind IN ('restaurant', 'hotel') AND e.status = 'published'
              AND (v_dest IS NULL OR d.slug = v_dest) AND (v_kind IS NULL OR e.listing_kind = v_kind)
              AND (NOT v_due OR e.verified_level IS NULL OR e.review_by < app.beirut_today() + 30)
        ), '[]'::jsonb),
        'claims', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'note', c.note, 'created_at', c.created_at,
                'organization', jsonb_build_object('id', o.id, 'name', o.name, 'verification', o.verification),
                'experience', jsonb_build_object('id', e.id, 'slug', e.slug, 'title', e.title)
            ) ORDER BY c.created_at)
            FROM app.listing_claims c
            JOIN app.organizations o ON o.id = c.organization_id
            JOIN app.experiences e ON e.id = c.experience_id
            WHERE c.status = 'pending'
        ), '[]'::jsonb)
    );
END;
$$;

-- Where each published destination stands against five restaurants and three stays.
CREATE OR REPLACE FUNCTION app.admin_venue_coverage(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'targets', app.venue_targets(),
        'destinations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'slug', d.slug, 'name', d.name,
                'restaurants', (SELECT count(*) FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
                                WHERE v.destination_id = d.id AND e.listing_kind = 'restaurant' AND app.venue_is_checked(e.id)),
                'stays', (SELECT count(*) FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
                          WHERE v.destination_id = d.id AND e.listing_kind = 'hotel' AND app.venue_is_checked(e.id)),
                'transport_cards', (SELECT count(*) FROM app.transport_routes r
                                    WHERE (r.to_destination_id = d.id OR r.from_destination_id = d.id)
                                      AND app.transport_route_live(r.id)),
                'drivers', (SELECT count(*) FROM app.partners p
                            WHERE p.kind = 'driver' AND d.slug = ANY (p.regions) AND app.partner_is_live(p.id)),
                'changers', (SELECT count(*) FROM app.exchange_offices o
                             WHERE o.destination_id = d.id AND app.office_is_live(o.id))
            ) ORDER BY d.name)
            FROM app.destinations d WHERE d.status = 'published'
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- Guides may propose places to stay too -----------------------------------------------------
-- Same as 036 otherwise.
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
                'listing_kind', CASE WHEN v_body->>'listing_kind' IN ('experience', 'attraction', 'restaurant', 'hotel')
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

-- ---- The sweep ------------------------------------------------------------------------------------
-- Hides restaurants and stays whose check or licence ran out; warns owners 30 days ahead.
CREATE OR REPLACE FUNCTION app.trust_sweep_venues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_row record;
    v_hidden integer := 0;
    v_warned integer := 0;
    v_owner record;
BEGIN
    FOR v_row IN
        SELECT e.id, e.organization_id FROM app.experiences e
        WHERE e.listing_kind IN ('restaurant', 'hotel') AND e.status = 'published' AND e.hidden_at IS NULL
          AND e.verified_level IS NOT NULL
          AND (e.review_by < app.beirut_today()
               OR (e.licence_expires_on IS NOT NULL AND e.licence_expires_on < app.beirut_today()))
    LOOP
        PERFORM set_config('app.organization_id', v_row.organization_id::text, true);
        UPDATE app.experiences SET hidden_at = now(), hidden_reason = 'verification lapsed', updated_at = now()
        WHERE id = v_row.id;
        v_hidden := v_hidden + 1;
    END LOOP;
    FOR v_row IN
        SELECT e.id, e.organization_id, least(e.review_by, e.licence_expires_on) AS due
        FROM app.experiences e JOIN app.organizations o ON o.id = e.organization_id
        WHERE e.listing_kind IN ('restaurant', 'hotel') AND e.status = 'published' AND e.verified_level IS NOT NULL
          AND o.slug <> 'mshwar-catalogue'
          AND least(e.review_by, e.licence_expires_on) = app.beirut_today() + 30
    LOOP
        FOR v_owner IN SELECT m.user_id FROM app.organization_members m
                       WHERE m.organization_id = v_row.organization_id AND m.role IN ('owner', 'manager') AND m.active LOOP
            PERFORM app.emit_notification_event(
                'venue.review_due', md5(v_row.id::text || ':' || v_row.due::text)::uuid, v_owner.user_id, NULL,
                jsonb_build_object('path', '/business/listings', 'status', v_row.due)
            );
        END LOOP;
        v_warned := v_warned + 1;
    END LOOP;
    RETURN jsonb_build_object('hidden', v_hidden, 'warned', v_warned);
END;
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
        'exchange', app.trust_sweep_exchange(),
        'venues', app.trust_sweep_venues()
    );
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('venue.claim_decided', 'en', 'traveller', 'Your claim on a place was reviewed',
     'A reviewer has decided on your claim ({status}). See your listings: {deep_link}'),
    ('venue.claim_decided', 'ar', 'traveller', 'رُوجع طلبك لإدارة مكان',
     'اتّخذ أحد المراجعين قرارًا بشأن طلبك ({status}). اطّلع على منشوراتك: {deep_link}'),
    ('venue.claim_decided', 'fr', 'traveller', 'Votre demande de gestion d’un lieu a été examinée',
     'Un relecteur a statué sur votre demande ({status}). Voir vos fiches : {deep_link}'),
    ('venue.review_due', 'en', 'traveller', 'Your listing is due for its check',
     'The check or licence behind your listing runs out on {status}. Send the new licence or book a check before then, or the listing will be hidden: {deep_link}'),
    ('venue.review_due', 'ar', 'traveller', 'حان موعد التحقّق من منشورك',
     'ينتهي التحقّق أو الترخيص الخاص بمنشورك في {status}. أرسل الترخيص الجديد أو احجز تحقّقًا قبل ذلك وإلا سيُخفى المنشور: {deep_link}'),
    ('venue.review_due', 'fr', 'traveller', 'Votre fiche doit être revérifiée',
     'La vérification ou la licence de votre fiche expire le {status}. Envoyez la nouvelle licence ou demandez une visite avant, sinon la fiche sera masquée : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

REVOKE ALL ON FUNCTION app.portal_set_listing_details_admin(uuid, jsonb) FROM mshwar_backend;

GRANT EXECUTE ON FUNCTION
    app.venue_is_checked(uuid),
    app.listing_details_json(uuid),
    app.venue_card(uuid),
    app.venue_targets(),
    app.public_destination_eat_stay(text),
    app.public_venues_near(text, double precision, double precision, integer),
    app.portal_set_listing_details(uuid, uuid, uuid, jsonb),
    app.portal_get_listing_details(uuid, uuid, uuid),
    app.portal_claim_listing(uuid, uuid, jsonb),
    app.portal_list_claims(uuid, uuid),
    app.admin_add_checked_venue(uuid, jsonb),
    app.admin_check_venue(uuid, uuid, jsonb),
    app.admin_decide_claim(uuid, uuid, text, text),
    app.admin_list_venues(uuid, jsonb),
    app.admin_venue_coverage(uuid),
    app.guide_submit_proposal(uuid, jsonb),
    app.trust_sweep_venues(),
    app.trust_sweep()
TO mshwar_backend;
