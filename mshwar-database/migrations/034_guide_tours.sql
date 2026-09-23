-- 034_guide_tours.sql
-- G2 of the supply-side pivot: guides publish tours, say when they are free, and
-- receive requests.
--
-- Almost nothing here is new machinery. A tour is an experience owned by the
-- guide's solo organisation, so it is created by app.upsert_experience, published
-- by app.publish_experience, booked through app.reserve_booking and answered with
-- app.respond_portal_booking - the functions the business portal already uses and
-- the tests already cover. This migration adds what a guide has that a business
-- does not: a route through catalogue places, a weekly rhythm instead of opening
-- hours, and the tier rule.
--
-- The tier rule lives next to the data. A local host cannot charge, so a priced
-- rule on a host's tour fails the write - from this migration's functions, from
-- the portal endpoints the guide could also reach, or from anything written later.

-- ---- Who is asking -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_for_user(p_user uuid)
RETURNS app.guide_profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE user_id = p_user;
    IF g.id IS NULL OR g.status <> 'approved' OR g.organization_id IS NULL THEN
        -- Reported as missing, like any object the caller may not touch.
        RAISE EXCEPTION 'approved guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN g;
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_tier_for_org(p_org uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT tier FROM app.guide_profiles WHERE organization_id = p_org;
$$;

-- ---- The tier rule, enforced on the write ---------------------------------------------
CREATE OR REPLACE FUNCTION app.guard_host_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, public
AS $$
BEGIN
    IF app.guide_tier_for_org((SELECT organization_id FROM app.experiences WHERE id = NEW.experience_id)) = 'host'
       AND NOT (NEW.price_type = 'fixed' AND coalesce(NEW.amount_minor, 0) = 0 AND NEW.max_amount_minor IS NULL)
    THEN
        RAISE EXCEPTION 'a local host cannot charge: price must be free' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS host_price_guard ON app.price_rules;
CREATE TRIGGER host_price_guard
    BEFORE INSERT OR UPDATE ON app.price_rules
    FOR EACH ROW EXECUTE FUNCTION app.guard_host_price();

-- Defence in depth for anything that writes the table directly as the API role:
-- a restrictive policy is ANDed with the org-scoped one from migration 006.
DROP POLICY IF EXISTS host_cannot_charge ON app.price_rules;
CREATE POLICY host_cannot_charge ON app.price_rules AS RESTRICTIVE FOR ALL TO mshwar_backend
    USING (true)
    WITH CHECK (
        coalesce(app.guide_tier_for_org(
            (SELECT e.organization_id FROM app.experiences e WHERE e.id = price_rules.experience_id)
        ), 'licensed') <> 'host'
        OR (price_type = 'fixed' AND coalesce(amount_minor, 0) = 0 AND max_amount_minor IS NULL)
    );

-- ---- What a tour has that a listing does not ------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_tours (
    experience_id uuid PRIMARY KEY REFERENCES app.experiences(id) ON DELETE CASCADE,
    -- The route through catalogue places reuses trip_templates, which already
    -- existed for exactly this and had never been used.
    template_id uuid UNIQUE REFERENCES app.trip_templates(id),
    languages text[] NOT NULL DEFAULT '{}',
    meeting_point text NOT NULL DEFAULT '',
    included text NOT NULL DEFAULT '',
    bring text NOT NULL DEFAULT '',
    cancellation_terms text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.guide_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_tours FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_tour_org ON app.guide_tours;
CREATE POLICY guide_tour_org ON app.guide_tours FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = guide_tours.experience_id AND e.organization_id = app.current_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = guide_tours.experience_id AND e.organization_id = app.current_organization_id()
    ));
GRANT SELECT, INSERT, UPDATE ON app.guide_tours TO mshwar_backend;

-- ---- When a guide is free -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_availability (
    guide_profile_id uuid PRIMARY KEY REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    -- [{"weekday": 0-6 (Monday = 0, as the seed), "start": "HH:MM"}]
    pattern jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pattern) = 'array'),
    min_notice_hours integer NOT NULL DEFAULT 24 CHECK (min_notice_hours BETWEEN 0 AND 720),
    max_tours_per_day integer NOT NULL DEFAULT 2 CHECK (max_tours_per_day BETWEEN 1 AND 8),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.guide_availability_exceptions (
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    local_date date NOT NULL,
    reason text NOT NULL DEFAULT '',
    PRIMARY KEY (guide_profile_id, local_date)
);

ALTER TABLE app.guide_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_availability FORCE ROW LEVEL SECURITY;
ALTER TABLE app.guide_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_availability_exceptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_availability_self ON app.guide_availability;
CREATE POLICY guide_availability_self ON app.guide_availability FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_availability.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_availability.guide_profile_id AND g.user_id = app.current_user_id()));
DROP POLICY IF EXISTS guide_exception_self ON app.guide_availability_exceptions;
CREATE POLICY guide_exception_self ON app.guide_availability_exceptions FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_availability_exceptions.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_availability_exceptions.guide_profile_id AND g.user_id = app.current_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON app.guide_availability, app.guide_availability_exceptions TO mshwar_backend;

-- ---- Reading a tour -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_tour_route(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'position', s.position,
        'experience_id', e.id,
        'slug', e.slug,
        'title', e.title,
        'destination_slug', d.slug,
        'lat', ST_Y(v.location::geometry),
        'lng', ST_X(v.location::geometry)
    ) ORDER BY s.position), '[]'::jsonb)
    FROM app.guide_tours t
    JOIN app.trip_template_stops s ON s.template_id = t.template_id
    JOIN app.experiences e ON e.id = s.experience_id
    JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    WHERE t.experience_id = p_experience;
$$;

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
            )
        );
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_list_tours(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    RETURN coalesce((
        SELECT jsonb_agg(app.guide_tour_json(p_user, e.id) ORDER BY e.updated_at DESC)
        FROM app.experiences e
        WHERE e.organization_id = g.organization_id AND e.status <> 'archived'
    ), '[]'::jsonb);
END;
$$;

-- ---- Writing a tour -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_upsert_tour(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
    v_meet jsonb := coalesce(p_payload->'meeting', '{}'::jsonb);
    v_venue uuid;
    v_venue_json jsonb;
    v_experience jsonb;
    v_amount bigint := coalesce(NULLIF(p_payload->>'price_minor', '')::bigint, 0);
    v_template uuid;
    v_slug text;
    v_route text[];
    v_position integer := 0;
    v_stop uuid;
    v_destination uuid;
BEGIN
    IF v_amount < 0 THEN
        RAISE EXCEPTION 'price cannot be negative' USING ERRCODE = '22023';
    END IF;
    -- Said here as well as in the trigger, so a host sees a sentence, not a 403.
    IF g.tier = 'host' AND v_amount > 0 THEN
        RAISE EXCEPTION 'a local host cannot charge: price must be free' USING ERRCODE = '22023';
    END IF;
    IF v_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM app.experiences WHERE id = v_id AND organization_id = g.organization_id
    ) THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;

    -- The meeting point is the tour's venue: that is where the day starts.
    SELECT venue_id INTO v_venue FROM app.experiences WHERE id = v_id;
    v_venue_json := app.upsert_venue(
        p_user,
        g.organization_id,
        v_venue,
        coalesce(NULLIF(btrim(v_meet->>'name'), ''), 'Meeting point'),
        coalesce(NULLIF(btrim(v_meet->>'address'), ''), coalesce(NULLIF(btrim(v_meet->>'name'), ''), 'Lebanon')),
        (v_meet->>'lng')::double precision,
        (v_meet->>'lat')::double precision,
        coalesce(NULLIF(btrim(v_meet->>'destination_slug'), ''), 'beirut')
    );
    v_venue := (v_venue_json->>'id')::uuid;

    v_experience := app.upsert_experience(p_user, g.organization_id, jsonb_strip_nulls(jsonb_build_object(
        'id', v_id,
        'venue_id', v_venue,
        'title', p_payload->>'title',
        'description', p_payload->>'description',
        -- Always a request: the guide confirms, and is paid on the day.
        'booking_mode', 'request',
        'duration_minutes', p_payload->>'duration_minutes',
        'min_party', coalesce(p_payload->>'min_party', '1'),
        'max_party', p_payload->>'max_party',
        'min_age', p_payload->>'min_age',
        'intensity', p_payload->>'intensity',
        'setting', coalesce(p_payload->>'setting', 'outdoor'),
        'category', coalesce(p_payload->>'category', 'culture'),
        'price', jsonb_build_object(
            'currency', 'USD', 'price_type', 'fixed',
            'unit', coalesce(p_payload->>'price_unit', 'person'),
            'amount_minor', v_amount
        ),
        'policy', jsonb_build_object(
            'terms_text', coalesce(NULLIF(btrim(p_payload->>'cancellation_terms'), ''),
                'Tell the guide as early as you can if you cannot make it.'),
            'cancellation_rules', '{}'::jsonb
        )
    )));
    v_id := (v_experience->>'id')::uuid;

    INSERT INTO app.guide_tours (experience_id, languages, meeting_point, included, bring, cancellation_terms)
    VALUES (
        v_id,
        coalesce((SELECT array_agg(value) FROM jsonb_array_elements_text(p_payload->'languages')), g.languages),
        coalesce(btrim(v_meet->>'name'), ''),
        coalesce(btrim(p_payload->>'included'), ''),
        coalesce(btrim(p_payload->>'bring'), ''),
        coalesce(btrim(p_payload->>'cancellation_terms'), '')
    )
    ON CONFLICT (experience_id) DO UPDATE
    SET languages = EXCLUDED.languages,
        meeting_point = EXCLUDED.meeting_point,
        included = EXCLUDED.included,
        bring = EXCLUDED.bring,
        cancellation_terms = EXCLUDED.cancellation_terms,
        updated_at = now();

    -- The route: an ordered list of published catalogue places.
    IF p_payload ? 'route' AND jsonb_typeof(p_payload->'route') = 'array' THEN
        v_route := ARRAY(SELECT jsonb_array_elements_text(p_payload->'route'));
        SELECT template_id INTO v_template FROM app.guide_tours WHERE experience_id = v_id;
        SELECT destination_id INTO v_destination FROM app.venues WHERE id = v_venue;
        IF v_template IS NULL THEN
            v_slug := 'tour-' || (SELECT slug FROM app.experiences WHERE id = v_id);
            INSERT INTO app.trip_templates (slug, title, status, destination_id, description)
            VALUES (v_slug, p_payload->>'title', 'draft', v_destination, coalesce(p_payload->>'description', ''))
            RETURNING id INTO v_template;
            UPDATE app.guide_tours SET template_id = v_template WHERE experience_id = v_id;
        ELSE
            UPDATE app.trip_templates
            SET title = p_payload->>'title', destination_id = v_destination,
                description = coalesce(p_payload->>'description', description)
            WHERE id = v_template;
        END IF;
        DELETE FROM app.trip_template_stops WHERE template_id = v_template;
        FOREACH v_slug IN ARRAY v_route LOOP
            SELECT id INTO v_stop FROM app.experiences WHERE slug = v_slug AND status = 'published';
            IF v_stop IS NULL THEN
                RAISE EXCEPTION 'route stop is not a published place: %', v_slug USING ERRCODE = '22023';
            END IF;
            v_position := v_position + 1;
            INSERT INTO app.trip_template_stops (template_id, position, experience_id)
            VALUES (v_template, v_position, v_stop);
        END LOOP;
    END IF;

    RETURN app.guide_tour_json(p_user, v_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_publish_tour(p_user uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    PERFORM app.publish_experience(p_user, g.organization_id, p_experience);
    UPDATE app.trip_templates SET status = 'published'
    WHERE id = (SELECT template_id FROM app.guide_tours WHERE experience_id = p_experience);
    RETURN app.guide_tour_json(p_user, p_experience);
END;
$$;

-- ---- Availability, and the slots it produces --------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_get_availability(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    a app.guide_availability;
BEGIN
    SELECT * INTO a FROM app.guide_availability WHERE guide_profile_id = g.id;
    RETURN jsonb_build_object(
        'pattern', coalesce(a.pattern, '[]'::jsonb),
        'min_notice_hours', coalesce(a.min_notice_hours, 24),
        'max_tours_per_day', coalesce(a.max_tours_per_day, 2),
        'exceptions', coalesce((
            SELECT jsonb_agg(jsonb_build_object('local_date', x.local_date, 'reason', x.reason) ORDER BY x.local_date)
            FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date >= current_date
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_set_availability(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_entry jsonb;
BEGIN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'pattern', '[]'::jsonb)) LOOP
        IF (v_entry->>'weekday')::integer NOT BETWEEN 0 AND 6
           OR (v_entry->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'each entry needs a weekday 0-6 and a start time HH:MM' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    INSERT INTO app.guide_availability (guide_profile_id, pattern, min_notice_hours, max_tours_per_day)
    VALUES (
        g.id,
        coalesce(p_payload->'pattern', '[]'::jsonb),
        coalesce((p_payload->>'min_notice_hours')::integer, 24),
        coalesce((p_payload->>'max_tours_per_day')::integer, 2)
    )
    ON CONFLICT (guide_profile_id) DO UPDATE
    SET pattern = EXCLUDED.pattern,
        min_notice_hours = EXCLUDED.min_notice_hours,
        max_tours_per_day = EXCLUDED.max_tours_per_day,
        updated_at = now();

    IF p_payload ? 'exceptions' AND jsonb_typeof(p_payload->'exceptions') = 'array' THEN
        DELETE FROM app.guide_availability_exceptions WHERE guide_profile_id = g.id AND local_date >= current_date;
        INSERT INTO app.guide_availability_exceptions (guide_profile_id, local_date, reason)
        SELECT g.id, (x->>'local_date')::date, coalesce(x->>'reason', '')
        FROM jsonb_array_elements(p_payload->'exceptions') AS x
        WHERE (x->>'local_date')::date >= current_date
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN app.guide_get_availability(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_generate_tour_slots(p_user uuid, p_experience uuid, p_days integer DEFAULT 28)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    a app.guide_availability;
    e app.experiences;
    v_day date;
    v_entry jsonb;
    v_starts timestamptz;
    v_created integer := 0;
    v_skipped_cap integer := 0;
    v_rows integer;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id;
    IF e.id IS NULL THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO a FROM app.guide_availability WHERE guide_profile_id = g.id;
    IF a.guide_profile_id IS NULL OR jsonb_array_length(a.pattern) = 0 THEN
        RAISE EXCEPTION 'set a weekly pattern first' USING ERRCODE = '22023';
    END IF;

    FOR v_day IN
        SELECT generate_series(
            (now() AT TIME ZONE 'Asia/Beirut')::date,
            (now() AT TIME ZONE 'Asia/Beirut')::date + least(greatest(p_days, 1), 90) - 1,
            interval '1 day'
        )::date
    LOOP
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date = v_day
        );
        FOR v_entry IN SELECT * FROM jsonb_array_elements(a.pattern) LOOP
            CONTINUE WHEN (v_entry->>'weekday')::integer <> extract(isodow FROM v_day)::integer - 1;
            v_starts := (v_day + (v_entry->>'start')::time) AT TIME ZONE 'Asia/Beirut';
            CONTINUE WHEN v_starts < now() + make_interval(hours => a.min_notice_hours);
            -- One person can only be in so many places: the cap counts every tour.
            IF (
                SELECT count(*) FROM app.slots s
                JOIN app.experiences x ON x.id = s.experience_id
                WHERE x.organization_id = g.organization_id
                  AND s.status = 'open'
                  AND (s.starts_at AT TIME ZONE 'Asia/Beirut')::date = v_day
            ) >= a.max_tours_per_day THEN
                v_skipped_cap := v_skipped_cap + 1;
                CONTINUE;
            END IF;
            INSERT INTO app.slots (
                experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status
            ) VALUES (
                e.id, v_starts, v_starts + make_interval(mins => e.duration_minutes),
                e.max_party, 0, true, 'guide-availability', now(), 'open'
            )
            ON CONFLICT (experience_id, starts_at) DO NOTHING;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_created := v_created + v_rows;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('created', v_created, 'skipped_for_daily_cap', v_skipped_cap);
END;
$$;

-- ---- Requests: a traveller asks, the guide answers -----------------------------------
CREATE OR REPLACE FUNCTION app.guide_request_tour(
    p_user uuid, p_slug text, p_slot uuid, p_party integer, p_key text, p_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    q jsonb := app.quote_checkout(p_slug, p_slot, p_party);
    v_booking uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.experiences e
        JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
        WHERE e.id = (q->>'experience_id')::uuid
    ) THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.user_id', p_user::text, true);
    -- Paid on the day: Mshwar carries the request and the confirmation, never the
    -- money, so the booking is written with payment_required = false whatever the
    -- price. reserve_booking checks the actor, the party limits and the capacity,
    -- and returns the earlier booking when the same key is retried.
    v_booking := app.reserve_booking(
        p_user, p_slot, p_party, p_key, p_hash,
        (q->>'price_rule_id')::uuid, (q->>'policy_id')::uuid, false, NULL
    );
    IF EXISTS (SELECT 1 FROM app.bookings WHERE id = v_booking AND inventory_reserved)
       AND NOT EXISTS (SELECT 1 FROM app.slot_unit_holds WHERE booking_id = v_booking)
    THEN
        PERFORM app.allocate_slot_units(p_slot, v_booking, p_party);
    END IF;
    RETURN app.checkout_booking_json(v_booking);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_list_requests(p_user uuid, p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    RETURN app.list_portal_bookings(p_user, g.organization_id, p_status, NULL, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_respond_request(
    p_user uuid, p_booking uuid, p_status text, p_reason text, p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    RETURN app.respond_portal_booking(p_user, g.organization_id, p_booking, p_status, p_reason, p_message);
END;
$$;

-- ---- The public side of a tour --------------------------------------------------------
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
        'route', app.guide_tour_route(e.id),
        'next_slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id, 'starts_at', s.starts_at, 'remaining', s.capacity - s.reserved
            ) ORDER BY s.starts_at)
            FROM (
                SELECT * FROM app.slots s
                WHERE s.experience_id = e.id AND s.status = 'open'
                  AND s.starts_at > now() AND s.reserved < s.capacity
                ORDER BY s.starts_at LIMIT 12
            ) s
        ), '[]'::jsonb)
    ) ORDER BY e.title), '[]'::jsonb)
    FROM app.guide_profiles g
    JOIN app.experiences e ON e.organization_id = g.organization_id AND e.status = 'published'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION
    app.guide_for_user(uuid),
    app.guide_tier_for_org(uuid),
    app.guide_tour_route(uuid),
    app.guide_tour_json(uuid, uuid),
    app.guide_list_tours(uuid),
    app.guide_upsert_tour(uuid, jsonb),
    app.guide_publish_tour(uuid, uuid),
    app.guide_get_availability(uuid),
    app.guide_set_availability(uuid, jsonb),
    app.guide_generate_tour_slots(uuid, uuid, integer),
    app.guide_request_tour(uuid, text, uuid, integer, text, text),
    app.guide_list_requests(uuid, text),
    app.guide_respond_request(uuid, uuid, text, text, text),
    app.public_guide_tours(text)
TO mshwar_backend;
