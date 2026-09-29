-- 062_tour_booking.sql
-- Guide plan, step 3: the booking experience.
--
-- A traveller picks a start, says how many adults and children, the language, any
-- extras and anything the guide should know, sees the total and the cancellation
-- policy, and books. The guide decides, per tour, whether that is confirmed at once
-- (instant) or is a request answered within a deadline they set (12 to 48 hours).
--
-- Prices are only what the guide published: an adult price (the tour's price rule), an
-- optional child price, and fixed-price extras. A local host still cannot charge: the
-- extras and child price of a host's tour must be free, like the tour itself.
--
-- Cancellation follows one of three plain policies, and a booking keeps the deadline it
-- was made under. Until online payment exists nothing is refunded, so the policy sets
-- expectations and records who cancelled and whether it was late. A booking moves to a
-- new time by a proposal the other side accepts, never by a silent change.

-- ---- Per-tour booking settings -----------------------------------------------------------
ALTER TABLE app.guide_tours
    ADD COLUMN IF NOT EXISTS instant_booking boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS request_ttl_hours integer NOT NULL DEFAULT 24 CHECK (request_ttl_hours BETWEEN 12 AND 48),
    ADD COLUMN IF NOT EXISTS policy text NOT NULL DEFAULT 'flexible' CHECK (policy IN ('flexible', 'moderate', 'strict')),
    ADD COLUMN IF NOT EXISTS child_price_minor bigint CHECK (child_price_minor IS NULL OR child_price_minor >= 0),
    ADD COLUMN IF NOT EXISTS child_age_max integer CHECK (child_age_max IS NULL OR child_age_max BETWEEN 1 AND 17);

CREATE OR REPLACE FUNCTION app.tour_policy_hours(p_policy text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_policy WHEN 'strict' THEN 168 WHEN 'moderate' THEN 72 ELSE 24 END;
$$;

-- ---- Extras -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.tour_addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id uuid NOT NULL REFERENCES app.experiences(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0 AND price_minor <= 100000000),
    unit text NOT NULL DEFAULT 'booking' CHECK (unit IN ('person', 'booking')),
    position integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tour_addons_experience_idx ON app.tour_addons (experience_id) WHERE active;

ALTER TABLE app.tour_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_addons FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_addon_org ON app.tour_addons;
CREATE POLICY tour_addon_org ON app.tour_addons FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = tour_addons.experience_id AND e.organization_id = app.current_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = tour_addons.experience_id AND e.organization_id = app.current_organization_id()
    ));
GRANT SELECT, INSERT, UPDATE, DELETE ON app.tour_addons TO mshwar_backend;

-- The host rule, next to the data like the one on price rules.
CREATE OR REPLACE FUNCTION app.guard_host_extras()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, public
AS $$
DECLARE
    v_org uuid;
BEGIN
    IF TG_TABLE_NAME = 'tour_addons' THEN
        SELECT organization_id INTO v_org FROM app.experiences WHERE id = NEW.experience_id;
        IF app.guide_tier_for_org(v_org) = 'host' AND NEW.price_minor > 0 THEN
            RAISE EXCEPTION 'a local host cannot charge: extras must be free' USING ERRCODE = '42501';
        END IF;
    ELSE
        SELECT organization_id INTO v_org FROM app.experiences WHERE id = NEW.experience_id;
        IF app.guide_tier_for_org(v_org) = 'host' AND coalesce(NEW.child_price_minor, 0) > 0 THEN
            RAISE EXCEPTION 'a local host cannot charge: the child price must be free' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS host_extras_guard ON app.tour_addons;
CREATE TRIGGER host_extras_guard
    BEFORE INSERT OR UPDATE ON app.tour_addons
    FOR EACH ROW EXECUTE FUNCTION app.guard_host_extras();
DROP TRIGGER IF EXISTS host_child_price_guard ON app.guide_tours;
CREATE TRIGGER host_child_price_guard
    BEFORE INSERT OR UPDATE OF child_price_minor ON app.guide_tours
    FOR EACH ROW EXECUTE FUNCTION app.guard_host_extras();

-- ---- What a tour booking carries beyond a listing booking ----------------------------------
CREATE TABLE IF NOT EXISTS app.tour_booking_details (
    booking_id uuid PRIMARY KEY REFERENCES app.bookings(id),
    code text NOT NULL UNIQUE CHECK (code ~ '^MSH-[A-HJ-NP-Z2-9]{6}$'),
    adults integer NOT NULL CHECK (adults >= 1),
    children integer NOT NULL DEFAULT 0 CHECK (children >= 0),
    language text,
    adult_price_minor bigint NOT NULL CHECK (adult_price_minor >= 0),
    child_price_minor bigint NOT NULL CHECK (child_price_minor >= 0),
    price_unit text NOT NULL CHECK (price_unit IN ('person', 'group')),
    addons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(addons) = 'array'),
    addons_minor bigint NOT NULL DEFAULT 0 CHECK (addons_minor >= 0),
    total_minor bigint NOT NULL CHECK (total_minor >= 0),
    policy text NOT NULL CHECK (policy IN ('flexible', 'moderate', 'strict')),
    free_cancel_until timestamptz NOT NULL,
    cancelled_by text CHECK (cancelled_by IN ('traveller', 'guide', 'system')),
    late_cancellation boolean NOT NULL DEFAULT false,
    rescheduled_from uuid REFERENCES app.bookings(id),
    rescheduled_to uuid REFERENCES app.bookings(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.tour_booking_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_booking_details FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_booking_parties ON app.tour_booking_details;
CREATE POLICY tour_booking_parties ON app.tour_booking_details FOR SELECT TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.bookings b
        WHERE b.id = tour_booking_details.booking_id
          AND (b.customer_id = app.current_user_id() OR b.organization_id = app.current_organization_id())
    ));
GRANT SELECT ON app.tour_booking_details TO mshwar_backend;

CREATE TABLE IF NOT EXISTS app.tour_reschedule_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES app.bookings(id),
    proposed_by uuid NOT NULL REFERENCES app.users(id),
    by_role text NOT NULL CHECK (by_role IN ('traveller', 'guide')),
    new_slot_id uuid NOT NULL REFERENCES app.slots(id),
    message text NOT NULL DEFAULT '' CHECK (length(message) <= 500),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'lapsed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS tour_reschedule_one_open ON app.tour_reschedule_proposals (booking_id)
    WHERE status = 'pending';

ALTER TABLE app.tour_reschedule_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_reschedule_proposals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_reschedule_parties ON app.tour_reschedule_proposals;
CREATE POLICY tour_reschedule_parties ON app.tour_reschedule_proposals FOR SELECT TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.bookings b
        WHERE b.id = tour_reschedule_proposals.booking_id
          AND (b.customer_id = app.current_user_id() OR b.organization_id = app.current_organization_id())
    ));
GRANT SELECT ON app.tour_reschedule_proposals TO mshwar_backend;

-- A short code a traveller can read out on the phone: no 0/O or 1/I to confuse.
CREATE OR REPLACE FUNCTION app.new_booking_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = app, public
AS $$
DECLARE
    v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_code text;
BEGIN
    LOOP
        v_code := 'MSH-' || (
            SELECT string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1), '')
            FROM generate_series(1, 6)
        );
        EXIT WHEN NOT EXISTS (SELECT 1 FROM app.tour_booking_details WHERE code = v_code);
    END LOOP;
    RETURN v_code;
END;
$$;

-- ---- Reading what a traveller needs to book -------------------------------------------------
CREATE OR REPLACE FUNCTION app.tour_addons_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'price_minor', a.price_minor, 'unit', a.unit
    ) ORDER BY a.position, a.created_at), '[]'::jsonb)
    FROM app.tour_addons a
    WHERE a.experience_id = p_experience AND a.active;
$$;

CREATE OR REPLACE FUNCTION app.tour_booking_terms(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'instant_booking', coalesce(t.instant_booking, false),
        'request_ttl_hours', coalesce(t.request_ttl_hours, 24),
        'policy', coalesce(t.policy, 'flexible'),
        'free_cancel_hours', app.tour_policy_hours(coalesce(t.policy, 'flexible')),
        'child_price_minor', t.child_price_minor,
        'child_age_max', t.child_age_max,
        'addons', app.tour_addons_json(p_experience)
    )
    FROM (SELECT p_experience AS id) x
    LEFT JOIN app.guide_tours t ON t.experience_id = x.id;
$$;

-- One month of bookable starts for the calendar: each day with its starts and a "from"
-- price, computed from the published prices only.
CREATE OR REPLACE FUNCTION app.public_tour_availability(p_slug text, p_month date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH tour AS (
        SELECT e.id, e.max_party, e.min_party,
            (SELECT pr.amount_minor FROM app.price_rules pr WHERE pr.experience_id = e.id AND pr.price_type = 'fixed'
             ORDER BY lower(pr.valid_during) DESC NULLS LAST LIMIT 1) AS price_minor,
            (SELECT pr.unit FROM app.price_rules pr WHERE pr.experience_id = e.id AND pr.price_type = 'fixed'
             ORDER BY lower(pr.valid_during) DESC NULLS LAST LIMIT 1) AS price_unit
        FROM app.experiences e
        JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
        WHERE e.slug = p_slug AND e.status = 'published'
    ),
    starts AS (
        SELECT s.id, s.starts_at, s.capacity - s.reserved AS remaining, s.private, s.min_group,
               (s.starts_at AT TIME ZONE 'Asia/Beirut')::date AS local_date
        FROM app.slots s
        JOIN tour ON tour.id = s.experience_id
        WHERE s.status = 'open'
          AND s.starts_at > now()
          AND (s.starts_at AT TIME ZONE 'Asia/Beirut')::date >= date_trunc('month', p_month)::date
          AND (s.starts_at AT TIME ZONE 'Asia/Beirut')::date < (date_trunc('month', p_month) + interval '1 month')::date
          AND s.reserved < s.capacity
          AND app.guide_slot_clash(s.id) IS NULL
    )
    SELECT jsonb_build_object(
        'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
        'price_minor', (SELECT price_minor FROM tour),
        'price_unit', (SELECT price_unit FROM tour),
        'days', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'date', d.local_date,
                'from_minor', (SELECT price_minor FROM tour),
                'starts', d.starts
            ) ORDER BY d.local_date)
            FROM (
                SELECT local_date, jsonb_agg(jsonb_build_object(
                    'id', id, 'starts_at', starts_at, 'remaining', remaining, 'private', private, 'min_group', min_group
                ) ORDER BY starts_at) AS starts
                FROM starts GROUP BY local_date
            ) d
        ), '[]'::jsonb)
    )
    WHERE EXISTS (SELECT 1 FROM tour);
$$;

-- ---- The guide's booking settings for one tour -----------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_set_booking_settings(p_user uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_policy text := coalesce(NULLIF(p_payload->>'policy', ''), 'flexible');
    v_ttl integer := coalesce(NULLIF(p_payload->>'request_ttl_hours', '')::integer, 24);
    v_child bigint := NULLIF(p_payload->>'child_price_minor', '')::bigint;
    v_child_age integer := NULLIF(p_payload->>'child_age_max', '')::integer;
    v_addon jsonb;
    v_keep uuid[] := '{}';
    v_id uuid;
    v_position integer := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id AND status <> 'archived'
    ) THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_policy NOT IN ('flexible', 'moderate', 'strict') THEN
        RAISE EXCEPTION 'choose a flexible, moderate or strict policy' USING ERRCODE = '22023';
    END IF;
    IF v_ttl NOT BETWEEN 12 AND 48 THEN
        RAISE EXCEPTION 'answer requests within 12 to 48 hours' USING ERRCODE = '22023';
    END IF;
    IF v_child IS NOT NULL AND v_child < 0 THEN
        RAISE EXCEPTION 'a price cannot be negative' USING ERRCODE = '22023';
    END IF;
    IF g.tier = 'host' AND coalesce(v_child, 0) > 0 THEN
        RAISE EXCEPTION 'a local host cannot charge: the child price must be free' USING ERRCODE = '22023';
    END IF;
    IF v_child_age IS NOT NULL AND v_child_age NOT BETWEEN 1 AND 17 THEN
        RAISE EXCEPTION 'children are up to 17 years old' USING ERRCODE = '22023';
    END IF;

    UPDATE app.guide_tours
    SET instant_booking = coalesce((p_payload->>'instant_booking')::boolean, false),
        request_ttl_hours = v_ttl,
        policy = v_policy,
        child_price_minor = v_child,
        child_age_max = v_child_age,
        updated_at = now()
    WHERE experience_id = p_experience;

    -- Extras: the list sent is the list kept. Removed ones are retired, not deleted, so a
    -- booking that bought one still says what it was.
    IF jsonb_typeof(p_payload->'addons') = 'array' THEN
        IF jsonb_array_length(p_payload->'addons') > 12 THEN
            RAISE EXCEPTION 'offer at most 12 extras' USING ERRCODE = '22023';
        END IF;
        FOR v_addon IN SELECT * FROM jsonb_array_elements(p_payload->'addons') LOOP
            v_position := v_position + 1;
            IF length(btrim(coalesce(v_addon->>'name', ''))) NOT BETWEEN 2 AND 80 THEN
                RAISE EXCEPTION 'each extra needs a name' USING ERRCODE = '22023';
            END IF;
            IF coalesce((v_addon->>'price_minor')::bigint, 0) < 0 THEN
                RAISE EXCEPTION 'a price cannot be negative' USING ERRCODE = '22023';
            END IF;
            IF g.tier = 'host' AND coalesce((v_addon->>'price_minor')::bigint, 0) > 0 THEN
                RAISE EXCEPTION 'a local host cannot charge: extras must be free' USING ERRCODE = '22023';
            END IF;
            v_id := NULLIF(v_addon->>'id', '')::uuid;
            IF v_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM app.tour_addons WHERE id = v_id AND experience_id = p_experience
            ) THEN
                UPDATE app.tour_addons
                SET name = btrim(v_addon->>'name'),
                    price_minor = coalesce((v_addon->>'price_minor')::bigint, 0),
                    unit = coalesce(NULLIF(v_addon->>'unit', ''), 'booking'),
                    position = v_position,
                    active = true
                WHERE id = v_id;
            ELSE
                INSERT INTO app.tour_addons (experience_id, name, price_minor, unit, position)
                VALUES (
                    p_experience, btrim(v_addon->>'name'), coalesce((v_addon->>'price_minor')::bigint, 0),
                    coalesce(NULLIF(v_addon->>'unit', ''), 'booking'), v_position
                )
                RETURNING id INTO v_id;
            END IF;
            v_keep := v_keep || v_id;
        END LOOP;
        UPDATE app.tour_addons SET active = false
        WHERE experience_id = p_experience AND active AND NOT (id = ANY (v_keep));
    END IF;

    RETURN app.tour_booking_terms(p_experience);
END;
$$;

-- ---- A tour booking, as either side sees it ----------------------------------------------------
CREATE OR REPLACE FUNCTION app.tour_booking_json(p_booking uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', b.id,
        'code', d.code,
        'status', b.status,
        'mode', b.mode,
        'reason', b.reason,
        'tour_slug', e.slug,
        'tour_title', e.title,
        'guide_slug', g.slug,
        'guide_name', g.display_name,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'private', s.private,
        'party_size', b.party_size,
        'adults', d.adults,
        'children', d.children,
        'language', d.language,
        'adult_price_minor', d.adult_price_minor,
        'child_price_minor', d.child_price_minor,
        'price_unit', d.price_unit,
        'addons', d.addons,
        'addons_minor', d.addons_minor,
        'total_minor', d.total_minor,
        'currency', b.currency,
        'paid_on_the_day', true,
        'payment_required', b.payment_required,
        'note', b.traveller_note,
        'policy', d.policy,
        'free_cancel_until', d.free_cancel_until,
        'response_due_at', b.response_due_at,
        'cancelled_by', d.cancelled_by,
        'late_cancellation', d.late_cancellation,
        'rescheduled_from', d.rescheduled_from,
        'rescheduled_to', d.rescheduled_to,
        'meeting_point', t.meeting_point,
        'reschedule', (
            SELECT jsonb_build_object(
                'id', r.id, 'by_role', r.by_role, 'new_slot_id', r.new_slot_id,
                'new_starts_at', ns.starts_at, 'message', r.message, 'status', r.status
            )
            FROM app.tour_reschedule_proposals r
            JOIN app.slots ns ON ns.id = r.new_slot_id
            WHERE r.booking_id = b.id AND r.status = 'pending'
        ),
        'created_at', b.created_at
    )
    FROM app.bookings b
    JOIN app.tour_booking_details d ON d.booking_id = b.id
    JOIN app.slots s ON s.id = b.slot_id
    JOIN app.experiences e ON e.id = b.experience_id
    JOIN app.guide_profiles g ON g.organization_id = b.organization_id
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE b.id = p_booking;
$$;

-- ---- Booking a tour -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.tour_book(p_user uuid, p_slug text, p_payload jsonb, p_key text, p_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    e app.experiences;
    t app.guide_tours;
    g app.guide_profiles;
    s app.slots;
    pr app.price_rules;
    pol app.policies;
    b app.bookings;
    v_slot uuid := NULLIF(p_payload->>'slot_id', '')::uuid;
    v_adults integer := coalesce(NULLIF(p_payload->>'adults', '')::integer, 0);
    v_children integer := coalesce(NULLIF(p_payload->>'children', '')::integer, 0);
    v_party integer;
    v_language text := NULLIF(btrim(coalesce(p_payload->>'language', '')), '');
    v_note text := left(btrim(coalesce(p_payload->>'note', '')), 1000);
    v_child_price bigint;
    v_people_minor bigint;
    v_addons jsonb := '[]'::jsonb;
    v_addons_minor bigint := 0;
    v_addon app.tour_addons;
    v_total bigint;
    v_mode text;
    v_ttl integer;
    v_policy text;
    v_booking uuid;
BEGIN
    IF p_key IS NULL OR length(p_key) < 8 OR p_hash IS NULL OR length(p_hash) < 16 THEN
        RAISE EXCEPTION 'invalid request' USING ERRCODE = '22023';
    END IF;
    -- A retried request is the same request.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_key, 0));
    SELECT * INTO b FROM app.bookings WHERE customer_id = p_user AND request_key = p_key;
    IF FOUND THEN
        IF b.request_hash <> p_hash THEN
            RAISE EXCEPTION 'idempotency key reused for a different booking' USING ERRCODE = '22023';
        END IF;
        RETURN app.tour_booking_json(b.id);
    END IF;

    SELECT * INTO e FROM app.experiences WHERE slug = p_slug AND status = 'published';
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = e.organization_id AND status = 'approved';
    IF e.id IS NULL OR g.id IS NULL THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    IF g.user_id = p_user THEN
        RAISE EXCEPTION 'you cannot book your own tour' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO t FROM app.guide_tours WHERE experience_id = e.id;

    SELECT * INTO s FROM app.slots WHERE id = v_slot AND experience_id = e.id FOR UPDATE;
    IF s.id IS NULL OR s.status <> 'open' OR s.starts_at <= now() THEN
        RAISE EXCEPTION 'this time is no longer offered' USING ERRCODE = '23P01';
    END IF;

    IF v_adults < 1 THEN
        RAISE EXCEPTION 'at least one adult books' USING ERRCODE = '22023';
    END IF;
    IF v_children < 0 THEN
        RAISE EXCEPTION 'children cannot be negative' USING ERRCODE = '22023';
    END IF;
    v_party := v_adults + v_children;
    IF v_party < e.min_party OR v_party > e.max_party THEN
        RAISE EXCEPTION 'this tour takes groups of % to %', e.min_party, e.max_party USING ERRCODE = '22023';
    END IF;
    IF v_language IS NOT NULL AND t.languages IS NOT NULL AND cardinality(t.languages) > 0
       AND NOT (v_language = ANY (t.languages)) THEN
        RAISE EXCEPTION 'the guide does not give this tour in that language' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO pr FROM app.price_rules
    WHERE experience_id = e.id AND price_type = 'fixed' AND valid_during @> s.starts_at
    ORDER BY lower(valid_during) DESC NULLS LAST LIMIT 1;
    SELECT * INTO pol FROM app.policies WHERE experience_id = e.id ORDER BY version DESC LIMIT 1;
    IF pr.id IS NULL THEN
        RAISE EXCEPTION 'this tour has no published price for that date' USING ERRCODE = '22023';
    END IF;

    v_child_price := coalesce(t.child_price_minor, pr.amount_minor);
    v_people_minor := CASE
        WHEN pr.unit = 'person' THEN v_adults * pr.amount_minor + v_children * v_child_price
        ELSE pr.amount_minor
    END;

    IF jsonb_typeof(p_payload->'addons') = 'array' THEN
        FOR v_addon IN
            SELECT a.* FROM app.tour_addons a
            WHERE a.experience_id = e.id AND a.active
              AND a.id IN (SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(p_payload->'addons') AS x)
            ORDER BY a.position
        LOOP
            v_addons := v_addons || jsonb_build_array(jsonb_build_object(
                'id', v_addon.id, 'name', v_addon.name, 'unit', v_addon.unit, 'price_minor', v_addon.price_minor,
                'quantity', CASE WHEN v_addon.unit = 'person' THEN v_party ELSE 1 END,
                'total_minor', v_addon.price_minor * CASE WHEN v_addon.unit = 'person' THEN v_party ELSE 1 END
            ));
            v_addons_minor := v_addons_minor
                + v_addon.price_minor * CASE WHEN v_addon.unit = 'person' THEN v_party ELSE 1 END;
        END LOOP;
        IF jsonb_array_length(v_addons) <> (
            SELECT count(DISTINCT x) FROM jsonb_array_elements_text(p_payload->'addons') AS x
        ) THEN
            RAISE EXCEPTION 'an extra is not offered on this tour' USING ERRCODE = '22023';
        END IF;
    END IF;
    v_total := v_people_minor + v_addons_minor;

    v_mode := CASE WHEN coalesce(t.instant_booking, false) THEN 'instant' ELSE 'request' END;
    v_ttl := coalesce(t.request_ttl_hours, 24);
    v_policy := coalesce(t.policy, 'flexible');

    -- Seats: the counter protects the last one; the booking guard (061) keeps the guide
    -- in one place and refuses a private start that is already taken.
    UPDATE app.slots SET reserved = reserved + v_party WHERE id = s.id AND reserved + v_party <= capacity;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'no seats left at this time' USING ERRCODE = '23P01';
    END IF;

    PERFORM set_config('app.user_id', p_user::text, true);
    INSERT INTO app.bookings (
        customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
        hold_until, response_due_at, inventory_reserved, currency, total_minor, payment_required,
        price_snapshot, policy_snapshot, request_key, request_hash, traveller_note
    ) VALUES (
        p_user, e.organization_id, e.id, s.id, v_party,
        CASE WHEN v_mode = 'instant' THEN 'confirmed' ELSE 'pending' END,
        v_mode,
        CASE WHEN v_mode = 'request' THEN least(s.starts_at, now() + make_interval(hours => v_ttl)) END,
        CASE WHEN v_mode = 'request' THEN least(s.starts_at, now() + make_interval(hours => v_ttl)) END,
        true, pr.currency, v_total, false,
        jsonb_build_object(
            'schema_version', 2, 'rule_id', pr.id, 'unit', pr.unit, 'unit_minor', pr.amount_minor,
            'adults', v_adults, 'children', v_children, 'child_unit_minor', v_child_price,
            'addons', v_addons, 'total_minor', v_total, 'currency', pr.currency, 'source', pr.source,
            'experience_title', e.title, 'starts_at', s.starts_at, 'ends_at', s.ends_at
        ),
        jsonb_build_object(
            'schema_version', 2, 'policy', v_policy, 'free_cancel_hours', app.tour_policy_hours(v_policy),
            'policy_id', pol.id, 'terms', coalesce(pol.terms_text, '')
        ),
        p_key, p_hash, v_note
    )
    RETURNING id INTO v_booking;
    PERFORM app.allocate_slot_units(s.id, v_booking, v_party);

    INSERT INTO app.tour_booking_details (
        booking_id, code, adults, children, language, adult_price_minor, child_price_minor, price_unit,
        addons, addons_minor, total_minor, policy, free_cancel_until
    ) VALUES (
        v_booking, app.new_booking_code(), v_adults, v_children, v_language, pr.amount_minor, v_child_price, pr.unit,
        v_addons, v_addons_minor, v_total, v_policy, s.starts_at - make_interval(hours => app.tour_policy_hours(v_policy))
    );

    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (v_booking, p_user, NULL, CASE WHEN v_mode = 'instant' THEN 'confirmed' ELSE 'pending' END,
            CASE WHEN v_mode = 'instant' THEN 'Instant booking' ELSE 'Requested' END);

    -- An instant booking tells the guide too (a request already does, through the booking row).
    IF v_mode = 'instant' THEN
        PERFORM app.emit_notification_event(
            'guide.booking_confirmed', v_booking, g.user_id, NULL,
            jsonb_build_object('booking_id', v_booking, 'status', 'confirmed', 'path', '/guide/requests/' || v_booking)
        );
    END IF;

    RETURN app.tour_booking_json(v_booking);
END;
$$;

-- The older request endpoint now books through the same path, so every tour booking has
-- a code, a price breakdown and a policy.
CREATE OR REPLACE FUNCTION app.guide_request_tour(
    p_user uuid, p_slug text, p_slot uuid, p_party integer, p_key text, p_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    RETURN app.tour_book(
        p_user, p_slug, jsonb_build_object('slot_id', p_slot, 'adults', p_party, 'children', 0), p_key, p_hash
    );
END;
$$;

-- ---- Reading one's own bookings --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.traveller_tour_booking(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.bookings b JOIN app.tour_booking_details d ON d.booking_id = b.id
        WHERE b.id = p_booking AND b.customer_id = p_user
    ) THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.tour_booking_json(p_booking);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_tour_booking(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.bookings b JOIN app.tour_booking_details d ON d.booking_id = b.id
        WHERE b.id = p_booking AND b.organization_id = g.organization_id
    ) THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.tour_booking_json(p_booking);
END;
$$;

-- ---- Cancelling ----------------------------------------------------------------------------------
-- By the traveller: always possible before the start; after the policy's deadline it is
-- recorded as late. By the guide: always a full refund once payments exist, and it counts
-- against the guide's reliability.
CREATE OR REPLACE FUNCTION app.tour_cancel(p_user uuid, p_booking uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings;
    d app.tour_booking_details;
    s app.slots;
    g app.guide_profiles;
    v_role text;
    v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking FOR UPDATE;
    SELECT * INTO d FROM app.tour_booking_details WHERE booking_id = p_booking;
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = b.organization_id;
    IF b.id IS NULL OR d.booking_id IS NULL THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    IF b.customer_id = p_user THEN
        v_role := 'traveller';
    ELSIF g.user_id = p_user THEN
        v_role := 'guide';
    ELSE
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    IF b.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'this booking is already %', b.status USING ERRCODE = '22023';
    END IF;
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id;
    IF s.starts_at <= now() THEN
        RAISE EXCEPTION 'this tour has already started' USING ERRCODE = '22023';
    END IF;
    IF length(v_reason) < 2 THEN
        RAISE EXCEPTION 'say why, in a few words' USING ERRCODE = '22023';
    END IF;

    PERFORM app.transition_booking(
        p_booking, 'cancelled',
        CASE WHEN v_role = 'guide' THEN 'Cancelled by the guide: ' ELSE 'Cancelled by the traveller: ' END || v_reason
    );
    UPDATE app.tour_booking_details
    SET cancelled_by = v_role,
        late_cancellation = (v_role = 'traveller' AND b.status = 'confirmed' AND now() > d.free_cancel_until)
    WHERE booking_id = p_booking;
    UPDATE app.tour_reschedule_proposals SET status = 'withdrawn', decided_at = now()
    WHERE booking_id = p_booking AND status = 'pending';
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (p_booking, p_user, b.status, 'cancelled', v_reason);

    IF v_role = 'traveller' THEN
        PERFORM app.emit_notification_event(
            'guide.booking_cancelled', p_booking, g.user_id, NULL,
            jsonb_build_object('booking_id', p_booking, 'status', 'cancelled', 'body', v_reason,
                               'path', '/guide/requests/' || p_booking)
        );
    END IF;
    RETURN app.tour_booking_json(p_booking);
END;
$$;

-- ---- Moving a booking to another time ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.tour_propose_reschedule(p_user uuid, p_booking uuid, p_slot uuid, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings;
    g app.guide_profiles;
    ns app.slots;
    v_role text;
    v_code text;
    v_other uuid;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking FOR UPDATE;
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = b.organization_id;
    IF b.id IS NULL OR NOT EXISTS (SELECT 1 FROM app.tour_booking_details WHERE booking_id = p_booking) THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    IF b.customer_id = p_user THEN
        v_role := 'traveller';
        v_other := g.user_id;
    ELSIF g.user_id = p_user THEN
        v_role := 'guide';
        v_other := b.customer_id;
    ELSE
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    IF b.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'only a live booking can move' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO ns FROM app.slots WHERE id = p_slot AND experience_id = b.experience_id;
    IF ns.id IS NULL OR ns.id = b.slot_id THEN
        RAISE EXCEPTION 'choose another start of the same tour' USING ERRCODE = '22023';
    END IF;
    v_code := app.guide_slot_clash(ns.id);
    IF v_code IS NOT NULL THEN
        RAISE EXCEPTION '%', app.guide_clash_message(v_code) USING ERRCODE = '23P01';
    END IF;
    IF ns.capacity - ns.reserved < b.party_size THEN
        RAISE EXCEPTION 'no seats left at this time' USING ERRCODE = '23P01';
    END IF;
    UPDATE app.tour_reschedule_proposals SET status = 'withdrawn', decided_at = now()
    WHERE booking_id = p_booking AND status = 'pending';
    INSERT INTO app.tour_reschedule_proposals (booking_id, proposed_by, by_role, new_slot_id, message)
    VALUES (p_booking, p_user, v_role, ns.id, left(btrim(coalesce(p_message, '')), 500));
    PERFORM app.emit_notification_event(
        'guide.reschedule_proposed', p_booking, v_other, NULL,
        jsonb_build_object(
            'booking_id', p_booking, 'status', 'proposed', 'body', left(btrim(coalesce(p_message, '')), 500),
            'path', CASE WHEN v_role = 'traveller' THEN '/guide/requests/' || p_booking ELSE '/bookings/' || p_booking END
        )
    );
    RETURN app.tour_booking_json(p_booking);
END;
$$;

-- The other side answers. Accepting moves the booking: a new booking at the new start
-- carries the same party, prices and policy; the old one is cancelled with a pointer to it.
CREATE OR REPLACE FUNCTION app.tour_answer_reschedule(p_user uuid, p_booking uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings;
    d app.tour_booking_details;
    g app.guide_profiles;
    r app.tour_reschedule_proposals;
    ns app.slots;
    v_role text;
    v_new uuid;
    v_code text;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking FOR UPDATE;
    SELECT * INTO d FROM app.tour_booking_details WHERE booking_id = p_booking;
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = b.organization_id;
    IF b.id IS NULL OR d.booking_id IS NULL THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    v_role := CASE WHEN b.customer_id = p_user THEN 'traveller' WHEN g.user_id = p_user THEN 'guide' END;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO r FROM app.tour_reschedule_proposals WHERE booking_id = p_booking AND status = 'pending' FOR UPDATE;
    IF r.id IS NULL THEN
        RAISE EXCEPTION 'there is no open proposal to answer' USING ERRCODE = 'P0002';
    END IF;
    IF r.by_role = v_role THEN
        RAISE EXCEPTION 'the other side answers a proposal' USING ERRCODE = '22023';
    END IF;

    IF NOT p_accept THEN
        UPDATE app.tour_reschedule_proposals SET status = 'declined', decided_at = now() WHERE id = r.id;
        RETURN app.tour_booking_json(p_booking);
    END IF;
    IF b.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'only a live booking can move' USING ERRCODE = '22023';
    END IF;

    -- Free the old seats first, so moving within the same guide's day does not clash
    -- with itself; if the new start cannot take the party, the whole move rolls back.
    -- The traveller hears about the new booking, not a cancellation of the old one.
    PERFORM set_config('app.quiet_booking', p_booking::text, true);
    PERFORM app.transition_booking(p_booking, 'cancelled', 'Moved to a new time at the traveller''s and guide''s agreement');
    PERFORM set_config('app.quiet_booking', '', true);
    SELECT * INTO ns FROM app.slots WHERE id = r.new_slot_id FOR UPDATE;
    v_code := app.guide_slot_clash(ns.id);
    IF v_code IS NOT NULL THEN
        RAISE EXCEPTION '%', app.guide_clash_message(v_code) USING ERRCODE = '23P01';
    END IF;
    UPDATE app.slots SET reserved = reserved + b.party_size WHERE id = ns.id AND reserved + b.party_size <= capacity;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'no seats left at this time' USING ERRCODE = '23P01';
    END IF;
    INSERT INTO app.bookings (
        customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
        hold_until, response_due_at, inventory_reserved, currency, total_minor, payment_required,
        price_snapshot, policy_snapshot, request_key, request_hash, traveller_note
    ) VALUES (
        b.customer_id, b.organization_id, b.experience_id, ns.id, b.party_size,
        CASE WHEN b.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END, b.mode,
        CASE WHEN b.status = 'pending' THEN least(ns.starts_at, coalesce(b.hold_until, now() + interval '24 hours')) END,
        CASE WHEN b.status = 'pending' THEN least(ns.starts_at, coalesce(b.response_due_at, now() + interval '24 hours')) END,
        true, b.currency, b.total_minor, false,
        b.price_snapshot || jsonb_build_object('starts_at', ns.starts_at, 'ends_at', ns.ends_at, 'moved_from', b.id),
        b.policy_snapshot,
        b.request_key || ':moved:' || r.id::text, b.request_hash, b.traveller_note
    )
    RETURNING id INTO v_new;
    PERFORM app.allocate_slot_units(ns.id, v_new, b.party_size);
    INSERT INTO app.tour_booking_details (
        booking_id, code, adults, children, language, adult_price_minor, child_price_minor, price_unit,
        addons, addons_minor, total_minor, policy, free_cancel_until, rescheduled_from
    ) VALUES (
        v_new, app.new_booking_code(), d.adults, d.children, d.language, d.adult_price_minor, d.child_price_minor, d.price_unit,
        d.addons, d.addons_minor, d.total_minor, d.policy,
        ns.starts_at - make_interval(hours => app.tour_policy_hours(d.policy)), b.id
    );
    UPDATE app.tour_booking_details SET rescheduled_to = v_new, cancelled_by = NULL WHERE booking_id = b.id;
    UPDATE app.tour_reschedule_proposals SET status = 'accepted', decided_at = now() WHERE id = r.id;
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (v_new, p_user, NULL, CASE WHEN b.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END,
            'Moved from ' || b.id::text);
    RETURN app.tour_booking_json(v_new);
END;
$$;

-- A booking being moved is not a cancellation the traveller needs to hear about.
CREATE OR REPLACE FUNCTION app.notify_booking_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            PERFORM app.emit_notification_event(
                'booking.requested', NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
            PERFORM app.emit_notification_event(
                'business.booking.requested', NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        ELSIF NEW.status IN ('confirmed', 'rejected', 'cancelled') THEN
            PERFORM app.emit_notification_event(
                'booking.' || NEW.status, NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        IF coalesce(current_setting('app.quiet_booking', true), '') = NEW.id::text THEN
            RETURN NEW;
        END IF;
        -- An unanswered request that lapses is news too: the traveller can pick another time.
        -- (An unpaid checkout hold that lapses is not a request, and stays quiet as before.)
        IF NEW.status IN ('confirmed', 'rejected', 'cancelled') OR (NEW.status = 'expired' AND NEW.mode = 'request') THEN
            PERFORM app.emit_notification_event(
                'booking.' || NEW.status, NEW.id, NEW.customer_id, NEW.organization_id,
                jsonb_build_object('booking_id', NEW.id, 'status', NEW.status, 'organization_id', NEW.organization_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---- Notification texts for the new guide events ----------------------------------------------------
INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('booking.expired', 'en', 'traveller', 'Your request was not answered in time',
     'Nothing is owed. Pick another time or another tour: {deep_link}'),
    ('booking.expired', 'ar', 'traveller', 'لم يُردّ على طلبك في الوقت المحدد',
     'لا شيء مستحق. اختر موعداً آخر أو جولة أخرى: {deep_link}'),
    ('booking.expired', 'fr', 'traveller', 'Votre demande n’a pas reçu de réponse à temps',
     'Rien n’est dû. Choisissez un autre horaire ou une autre visite : {deep_link}'),
    ('guide.booking_confirmed', 'en', 'traveller', 'New booking on your tour',
     'A traveller booked one of your tours. See who is coming: {deep_link}'),
    ('guide.booking_confirmed', 'ar', 'traveller', 'حجز جديد في جولتك',
     'حجز أحد المسافرين إحدى جولاتك. اطّلع على من سيأتي: {deep_link}'),
    ('guide.booking_confirmed', 'fr', 'traveller', 'Nouvelle réservation sur votre visite',
     'Un voyageur a réservé l’une de vos visites. Voir qui vient : {deep_link}'),
    ('guide.booking_cancelled', 'en', 'traveller', 'A traveller cancelled',
     'A booking on your tour was cancelled: "{body}". The seats are open again: {deep_link}'),
    ('guide.booking_cancelled', 'ar', 'traveller', 'ألغى مسافر حجزه',
     'أُلغي حجز في جولتك: «{body}». عادت المقاعد متاحة: {deep_link}'),
    ('guide.booking_cancelled', 'fr', 'traveller', 'Un voyageur a annulé',
     'Une réservation sur votre visite a été annulée : « {body} ». Les places sont de nouveau libres : {deep_link}'),
    ('guide.reschedule_proposed', 'en', 'traveller', 'A new time is proposed',
     'Another time was proposed for a tour booking: "{body}". Accept or decline: {deep_link}'),
    ('guide.reschedule_proposed', 'ar', 'traveller', 'اقتُرح موعد جديد',
     'اقتُرح موعد آخر لحجز جولة: «{body}». اقبل أو ارفض: {deep_link}'),
    ('guide.reschedule_proposed', 'fr', 'traveller', 'Un nouvel horaire est proposé',
     'Un autre horaire a été proposé pour une réservation : « {body} ». Accepter ou refuser : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- The public side of a tour now says how it books.
CREATE OR REPLACE FUNCTION app.public_guide_tours(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'duration_minutes', e.duration_minutes,
        'min_party', e.min_party,
        'max_party', e.max_party,
        'min_age', e.min_age,
        'intensity', e.intensity,
        'languages', to_jsonb(t.languages),
        'meeting_point', t.meeting_point,
        'included', t.included,
        'bring', t.bring,
        'cancellation_terms', t.cancellation_terms,
        'price_minor', (SELECT pr.amount_minor FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1),
        'price_unit', (SELECT pr.unit FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1),
        'booking', app.tour_booking_terms(e.id),
        'route', app.guide_tour_route(e.id),
        'next_slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'starts_at', s.starts_at,
                'remaining', s.capacity - s.reserved,
                'private', s.private,
                'min_group', s.min_group
            ) ORDER BY s.starts_at)
            FROM (
                SELECT * FROM app.slots s
                WHERE s.experience_id = e.id AND s.status = 'open'
                  AND s.starts_at > now() AND s.reserved < s.capacity
                  AND app.guide_slot_clash(s.id) IS NULL
                ORDER BY s.starts_at LIMIT 12
            ) s
        ), '[]'::jsonb)
    ) ORDER BY e.title), '[]'::jsonb)
    FROM app.guide_profiles g
    JOIN app.experiences e ON e.organization_id = g.organization_id AND e.status = 'published'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

-- The guide's own view of a tour now carries its booking terms.
CREATE OR REPLACE FUNCTION app.guide_tour_json(p_user uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_tour app.guide_tours;
BEGIN
    SELECT * INTO v_tour FROM app.guide_tours WHERE experience_id = p_experience;
    RETURN app.get_experience_portal(p_user, g.organization_id, p_experience)
        || jsonb_build_object(
            'tier', g.tier,
            'languages', to_jsonb(coalesce(v_tour.languages, '{}'::text[])),
            'meeting_point', coalesce(v_tour.meeting_point, ''),
            'included', coalesce(v_tour.included, ''),
            'bring', coalesce(v_tour.bring, ''),
            'cancellation_terms', coalesce(v_tour.cancellation_terms, ''),
            'route', app.guide_tour_route(p_experience),
            'upcoming_slots', (
                SELECT count(*) FROM app.slots s
                WHERE s.experience_id = p_experience AND s.status = 'open' AND s.starts_at > now()
            ),
            'schedules', coalesce((
                SELECT jsonb_agg(app.tour_schedule_json(sc) ORDER BY sc.valid_from, sc.created_at)
                FROM app.tour_schedules sc WHERE sc.experience_id = p_experience
            ), '[]'::jsonb),
            'booking', app.tour_booking_terms(p_experience)
        );
END;
$$;

-- One published tour, with its guide and how it books: what the booking page needs.
CREATE OR REPLACE FUNCTION app.public_tour(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'duration_minutes', e.duration_minutes,
        'min_party', e.min_party,
        'max_party', e.max_party,
        'min_age', e.min_age,
        'intensity', e.intensity,
        'languages', to_jsonb(coalesce(t.languages, '{}'::text[])),
        'meeting_point', coalesce(t.meeting_point, ''),
        'included', coalesce(t.included, ''),
        'bring', coalesce(t.bring, ''),
        'cancellation_terms', coalesce(t.cancellation_terms, ''),
        'price_minor', (SELECT pr.amount_minor FROM app.price_rules pr
                        WHERE pr.experience_id = e.id AND pr.price_type = 'fixed'
                        ORDER BY lower(pr.valid_during) DESC NULLS LAST LIMIT 1),
        'price_unit', (SELECT pr.unit FROM app.price_rules pr
                       WHERE pr.experience_id = e.id AND pr.price_type = 'fixed'
                       ORDER BY lower(pr.valid_during) DESC NULLS LAST LIMIT 1),
        'booking', app.tour_booking_terms(e.id),
        'route', app.guide_tour_route(e.id),
        'guide', jsonb_build_object(
            'slug', g.slug, 'display_name', g.display_name, 'tier', g.tier, 'badge', app.guide_has_badge(g.id),
            'founding_number', g.founding_number
        )
    )
    FROM app.experiences e
    JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE e.slug = p_slug AND e.status = 'published';
$$;

REVOKE ALL ON FUNCTION
    app.public_tour(text),
    app.guard_host_extras(),
    app.new_booking_code(),
    app.tour_addons_json(uuid),
    app.tour_booking_terms(uuid),
    app.public_tour_availability(text, date),
    app.guide_set_booking_settings(uuid, uuid, jsonb),
    app.tour_booking_json(uuid),
    app.tour_book(uuid, text, jsonb, text, text),
    app.traveller_tour_booking(uuid, uuid),
    app.guide_tour_booking(uuid, uuid),
    app.tour_cancel(uuid, uuid, text),
    app.tour_propose_reschedule(uuid, uuid, uuid, text),
    app.tour_answer_reschedule(uuid, uuid, boolean)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.public_tour(text),
    app.tour_policy_hours(text),
    app.tour_addons_json(uuid),
    app.tour_booking_terms(uuid),
    app.public_tour_availability(text, date),
    app.guide_set_booking_settings(uuid, uuid, jsonb),
    app.tour_booking_json(uuid),
    app.tour_book(uuid, text, jsonb, text, text),
    app.traveller_tour_booking(uuid, uuid),
    app.guide_tour_booking(uuid, uuid),
    app.tour_cancel(uuid, uuid, text),
    app.tour_propose_reschedule(uuid, uuid, uuid, text),
    app.tour_answer_reschedule(uuid, uuid, boolean),
    app.public_guide_tours(text),
    app.guide_tour_json(uuid, uuid)
TO mshwar_backend;
