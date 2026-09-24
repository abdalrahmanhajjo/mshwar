-- 040_transport.sql
-- V2 of verified local services: how to get to each destination and around it.
--
-- A route card is one checked way of travelling - a service taxi from a named
-- stop, a bus line, a van, walking - with its fare range, times, tips and
-- safety notes. Nothing is published without a field check recorded by a
-- reviewer, and every card carries a review date 90 days after that check:
-- fares in Lebanon move fast, so a card past its date stops showing by itself.
-- Travellers flag cards that are wrong; three flags in 30 days send a card
-- back to review. Approved guides propose cards and updates; staff decide.

CREATE TABLE IF NOT EXISTS app.transport_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- between: from one destination to another. airport: from Beirut airport.
    -- around: getting about inside one destination.
    scope text NOT NULL CHECK (scope IN ('between', 'airport', 'around')),
    from_destination_id uuid REFERENCES app.destinations(id),
    to_destination_id uuid NOT NULL REFERENCES app.destinations(id),
    mode text NOT NULL CHECK (mode IN (
        'service_taxi', 'taxi', 'bus', 'van', 'ride_hailing', 'car_rental', 'walking', 'ferry'
    )),
    line_name text NOT NULL DEFAULT '',
    pickup_name text NOT NULL DEFAULT '',
    pickup_location geography(Point, 4326),
    dropoff_name text NOT NULL DEFAULT '',
    dropoff_location geography(Point, 4326),
    fare_basis text NOT NULL DEFAULT 'person' CHECK (fare_basis IN ('person', 'vehicle', 'free')),
    fare_low_minor bigint CHECK (fare_low_minor IS NULL OR fare_low_minor >= 0),
    fare_high_minor bigint CHECK (fare_high_minor IS NULL OR fare_high_minor >= 0),
    currency text REFERENCES app.currencies(code),
    duration_min integer CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 1440),
    duration_max integer CHECK (duration_max IS NULL OR duration_max BETWEEN 1 AND 1440),
    frequency_minutes integer CHECK (frequency_minutes IS NULL OR frequency_minutes BETWEEN 1 AND 1440),
    first_departure time,
    last_departure time,
    runs_sunday boolean,
    -- Short "how to use it" tips, per language: {"en": "...", "ar": "...", "fr": "..."}.
    tips jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(tips) = 'object'),
    step_free boolean,
    night_service boolean,
    luggage_ok boolean,
    safety_note text NOT NULL DEFAULT '',
    -- [{kind: field_check | operator | guide_report | traveller_report, note, url?, on?}]
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
    status text NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'published', 'rejected', 'retired')),
    submitted_by uuid REFERENCES app.users(id),
    submitted_role text NOT NULL DEFAULT 'staff' CHECK (submitted_role IN ('staff', 'guide')),
    replaces_route_id uuid REFERENCES app.transport_routes(id),
    checked_by uuid REFERENCES app.users(id),
    checked_on date,
    review_by date,
    decision_reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT transport_fare_range CHECK (
        (fare_basis = 'free' AND fare_low_minor IS NULL AND fare_high_minor IS NULL)
        OR (fare_basis <> 'free' AND fare_low_minor IS NOT NULL AND fare_high_minor IS NOT NULL
            AND fare_low_minor <= fare_high_minor AND currency IS NOT NULL)
        OR (fare_basis <> 'free' AND fare_low_minor IS NULL AND fare_high_minor IS NULL)
    ),
    CONSTRAINT transport_duration_range CHECK (duration_min IS NULL OR duration_max IS NULL OR duration_min <= duration_max),
    CONSTRAINT transport_scope_shape CHECK (
        (scope = 'between' AND from_destination_id IS NOT NULL AND from_destination_id <> to_destination_id)
        OR (scope IN ('airport', 'around') AND from_destination_id IS NULL)
    ),
    -- A published card was checked by a person, and knows when to be checked again.
    CONSTRAINT transport_published_checked CHECK (
        status <> 'published' OR (checked_by IS NOT NULL AND checked_on IS NOT NULL AND review_by IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS transport_routes_to_idx ON app.transport_routes (to_destination_id, status);
CREATE INDEX IF NOT EXISTS transport_routes_from_idx ON app.transport_routes (from_destination_id, status);

CREATE TABLE IF NOT EXISTS app.transport_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid NOT NULL REFERENCES app.transport_routes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES app.users(id),
    reason text NOT NULL CHECK (reason IN (
        'fare_higher', 'fare_lower', 'no_longer_runs', 'wrong_pickup', 'times_wrong', 'unsafe', 'other'
    )),
    details text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS transport_flags_one_open
    ON app.transport_flags (route_id, user_id) WHERE resolved_at IS NULL;

ALTER TABLE app.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.transport_routes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.transport_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.transport_flags FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.transport_routes, app.transport_flags FROM mshwar_backend;

COMMENT ON TABLE app.transport_routes IS 'Checked ways to reach and get around a destination. Hidden past review_by.';

-- ---- Shapes --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.transport_route_live(p_route uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT r.status = 'published' AND r.review_by >= app.beirut_today()
        FROM app.transport_routes r WHERE r.id = p_route
    ), false)
$$;

CREATE OR REPLACE FUNCTION app.transport_route_json(p_route uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', r.id,
        'scope', r.scope,
        'mode', r.mode,
        'line_name', r.line_name,
        'from', CASE WHEN f.id IS NOT NULL THEN jsonb_build_object('slug', f.slug, 'name', f.name) END,
        'to', jsonb_build_object('slug', t.slug, 'name', t.name),
        'pickup', jsonb_build_object(
            'name', r.pickup_name,
            'lat', ST_Y(r.pickup_location::geometry), 'lng', ST_X(r.pickup_location::geometry)
        ),
        'dropoff', jsonb_build_object(
            'name', r.dropoff_name,
            'lat', ST_Y(r.dropoff_location::geometry), 'lng', ST_X(r.dropoff_location::geometry)
        ),
        'fare', jsonb_build_object(
            'basis', r.fare_basis, 'low_minor', r.fare_low_minor, 'high_minor', r.fare_high_minor,
            'currency', r.currency
        ),
        'duration', jsonb_build_object('min', r.duration_min, 'max', r.duration_max),
        'frequency_minutes', r.frequency_minutes,
        'first_departure', to_char(r.first_departure, 'HH24:MI'),
        'last_departure', to_char(r.last_departure, 'HH24:MI'),
        'runs_sunday', r.runs_sunday,
        'tips', r.tips,
        'step_free', r.step_free,
        'night_service', r.night_service,
        'luggage_ok', r.luggage_ok,
        'safety_note', r.safety_note,
        'checked_on', r.checked_on,
        'review_by', r.review_by,
        'live', app.transport_route_live(r.id)
    ) || CASE WHEN p_private THEN jsonb_build_object(
        'status', r.status,
        'evidence', r.evidence,
        'submitted_role', r.submitted_role,
        'submitted_by', (SELECT display_name FROM app.users u WHERE u.id = r.submitted_by),
        'checked_by', (SELECT display_name FROM app.users u WHERE u.id = r.checked_by),
        'decision_reason', r.decision_reason,
        'replaces_route_id', r.replaces_route_id,
        'open_flags', coalesce((
            SELECT jsonb_agg(jsonb_build_object('reason', fl.reason, 'details', fl.details, 'at', fl.created_at)
                             ORDER BY fl.created_at DESC)
            FROM app.transport_flags fl WHERE fl.route_id = r.id AND fl.resolved_at IS NULL
        ), '[]'::jsonb),
        'created_at', r.created_at
    ) ELSE '{}'::jsonb END
    FROM app.transport_routes r
    JOIN app.destinations t ON t.id = r.to_destination_id
    LEFT JOIN app.destinations f ON f.id = r.from_destination_id
    WHERE r.id = p_route
$$;

-- ---- Public reads ----------------------------------------------------------------------
-- A destination's "Getting there and around", grouped the way a traveller reads it.
CREATE OR REPLACE FUNCTION app.public_destination_transport(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_dest app.destinations;
    v_beirut uuid;
BEGIN
    SELECT * INTO v_dest FROM app.destinations WHERE slug = p_slug AND status = 'published';
    IF v_dest.id IS NULL THEN
        RAISE EXCEPTION 'destination not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT id INTO v_beirut FROM app.destinations WHERE slug = 'beirut';
    RETURN jsonb_build_object(
        'destination', jsonb_build_object('slug', v_dest.slug, 'name', v_dest.name),
        'from_airport', coalesce((
            SELECT jsonb_agg(app.transport_route_json(r.id, false) ORDER BY r.mode, r.fare_low_minor NULLS LAST)
            FROM app.transport_routes r
            WHERE r.scope = 'airport' AND r.to_destination_id = v_dest.id AND app.transport_route_live(r.id)
        ), '[]'::jsonb),
        'from_beirut', coalesce((
            SELECT jsonb_agg(app.transport_route_json(r.id, false) ORDER BY r.mode, r.fare_low_minor NULLS LAST)
            FROM app.transport_routes r
            WHERE r.scope = 'between' AND r.to_destination_id = v_dest.id AND r.from_destination_id = v_beirut
              AND app.transport_route_live(r.id)
        ), '[]'::jsonb),
        'between', coalesce((
            SELECT jsonb_agg(app.transport_route_json(r.id, false) ORDER BY r.mode, r.fare_low_minor NULLS LAST)
            FROM app.transport_routes r
            WHERE r.scope = 'between' AND app.transport_route_live(r.id)
              AND ((r.to_destination_id = v_dest.id AND r.from_destination_id IS DISTINCT FROM v_beirut)
                   OR r.from_destination_id = v_dest.id)
        ), '[]'::jsonb),
        'around', coalesce((
            SELECT jsonb_agg(app.transport_route_json(r.id, false) ORDER BY r.mode)
            FROM app.transport_routes r
            WHERE r.scope = 'around' AND r.to_destination_id = v_dest.id AND app.transport_route_live(r.id)
        ), '[]'::jsonb)
    );
END;
$$;

-- For a planner leg from one destination to the next.
CREATE OR REPLACE FUNCTION app.public_transport_between(p_from text, p_to text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.transport_route_json(r.id, false) ORDER BY r.mode, r.fare_low_minor NULLS LAST),
                    '[]'::jsonb)
    FROM app.transport_routes r
    JOIN app.destinations f ON f.id = r.from_destination_id
    JOIN app.destinations t ON t.id = r.to_destination_id
    WHERE r.scope = 'between' AND f.slug = p_from AND t.slug = p_to AND app.transport_route_live(r.id)
$$;

-- ---- Writing cards ------------------------------------------------------------------------
-- Shared by staff and guides. Validates and normalises the body into a row.
CREATE OR REPLACE FUNCTION app.transport_write(
    p_user uuid, p_role text, p_route uuid, p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_scope text := b->>'scope';
    v_from uuid;
    v_to uuid;
    v_basis text := coalesce(NULLIF(b->>'fare_basis', ''), 'person');
    v_low bigint := NULLIF(b->>'fare_low_minor', '')::bigint;
    v_high bigint := NULLIF(b->>'fare_high_minor', '')::bigint;
    v_evidence jsonb := coalesce(b->'evidence', '[]'::jsonb);
    v_tips jsonb := '{}'::jsonb;
    v_id uuid := p_route;
    v_item jsonb;
BEGIN
    IF v_scope NOT IN ('between', 'airport', 'around') THEN
        RAISE EXCEPTION 'say whether this is between destinations, from the airport, or around one' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_to FROM app.destinations WHERE slug = b->>'to_destination';
    IF v_to IS NULL THEN
        RAISE EXCEPTION 'choose the destination this card is for' USING ERRCODE = '22023';
    END IF;
    IF v_scope = 'between' THEN
        SELECT id INTO v_from FROM app.destinations WHERE slug = b->>'from_destination';
        IF v_from IS NULL OR v_from = v_to THEN
            RAISE EXCEPTION 'choose where the route starts' USING ERRCODE = '22023';
        END IF;
    END IF;
    IF v_basis = 'free' THEN
        v_low := NULL;
        v_high := NULL;
    ELSIF (v_low IS NULL) <> (v_high IS NULL) OR v_low > v_high THEN
        RAISE EXCEPTION 'give the fare as a low and a high amount' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_evidence) <> 'array' THEN
        RAISE EXCEPTION 'evidence must be a list' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_evidence) LOOP
        IF v_item->>'kind' NOT IN ('field_check', 'operator', 'guide_report', 'traveller_report')
           OR length(btrim(coalesce(v_item->>'note', ''))) < 5 THEN
            RAISE EXCEPTION 'each piece of evidence needs a kind and a short note' USING ERRCODE = '22023';
        END IF;
        IF v_item ? 'url' AND coalesce(v_item->>'url', '') <> '' AND v_item->>'url' !~ '^https://' THEN
            RAISE EXCEPTION 'evidence links must start with https://' USING ERRCODE = '22023';
        END IF;
    END LOOP;
    IF p_role = 'guide' AND jsonb_array_length(v_evidence) = 0 THEN
        RAISE EXCEPTION 'say how you know: when you last took it, or the operator page' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(jsonb_object_agg(key, left(btrim(value), 400)), '{}'::jsonb) INTO v_tips
    FROM jsonb_each_text(coalesce(b->'tips', '{}'::jsonb))
    WHERE key IN ('en', 'ar', 'fr') AND btrim(value) <> '';

    IF v_id IS NULL THEN
        INSERT INTO app.transport_routes (scope, from_destination_id, to_destination_id, mode, submitted_by, submitted_role)
        VALUES (v_scope, v_from, v_to, coalesce(b->>'mode', 'taxi'), p_user, p_role)
        RETURNING id INTO v_id;
    END IF;
    UPDATE app.transport_routes
    SET scope = v_scope,
        from_destination_id = v_from,
        to_destination_id = v_to,
        mode = b->>'mode',
        line_name = left(btrim(coalesce(b->>'line_name', '')), 80),
        pickup_name = left(btrim(coalesce(b->>'pickup_name', '')), 120),
        pickup_location = CASE WHEN NULLIF(b->>'pickup_lat', '') IS NOT NULL THEN
            ST_SetSRID(ST_MakePoint((b->>'pickup_lng')::double precision, (b->>'pickup_lat')::double precision), 4326)::geography END,
        dropoff_name = left(btrim(coalesce(b->>'dropoff_name', '')), 120),
        dropoff_location = CASE WHEN NULLIF(b->>'dropoff_lat', '') IS NOT NULL THEN
            ST_SetSRID(ST_MakePoint((b->>'dropoff_lng')::double precision, (b->>'dropoff_lat')::double precision), 4326)::geography END,
        fare_basis = v_basis,
        fare_low_minor = v_low,
        fare_high_minor = v_high,
        currency = CASE WHEN v_basis = 'free' OR v_low IS NULL THEN NULL ELSE coalesce(NULLIF(b->>'currency', ''), 'USD') END,
        duration_min = NULLIF(b->>'duration_min', '')::integer,
        duration_max = NULLIF(b->>'duration_max', '')::integer,
        frequency_minutes = NULLIF(b->>'frequency_minutes', '')::integer,
        first_departure = NULLIF(b->>'first_departure', '')::time,
        last_departure = NULLIF(b->>'last_departure', '')::time,
        runs_sunday = (b->>'runs_sunday')::boolean,
        tips = v_tips,
        step_free = (b->>'step_free')::boolean,
        night_service = (b->>'night_service')::boolean,
        luggage_ok = (b->>'luggage_ok')::boolean,
        safety_note = left(btrim(coalesce(b->>'safety_note', '')), 500),
        evidence = v_evidence,
        replaces_route_id = coalesce(NULLIF(b->>'replaces_route_id', '')::uuid, replaces_route_id),
        updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the fare, times and places on this card' USING ERRCODE = '22023';
    WHEN invalid_datetime_format OR invalid_text_representation THEN
        RAISE EXCEPTION 'check the numbers and times on this card' USING ERRCODE = '22023';
END;
$$;

-- An approved guide proposes a card or an update to one. Ten a day.
CREATE OR REPLACE FUNCTION app.guide_submit_transport(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.guide_profiles WHERE user_id = p_user AND status = 'approved') THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF (SELECT count(*) FROM app.transport_routes
        WHERE submitted_by = p_user AND created_at > now() - interval '1 day') >= 10 THEN
        RAISE EXCEPTION 'ten transport cards a day; send the rest tomorrow' USING ERRCODE = '53400';
    END IF;
    IF NULLIF(p_payload->>'replaces_route_id', '') IS NOT NULL
       AND NOT app.transport_route_live((p_payload->>'replaces_route_id')::uuid) THEN
        RAISE EXCEPTION 'that card is not published' USING ERRCODE = 'P0002';
    END IF;
    v_id := app.transport_write(p_user, 'guide', NULL, p_payload);
    RETURN app.transport_route_json(v_id, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_list_transport(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.transport_route_json(r.id, true) ORDER BY r.created_at DESC), '[]'::jsonb)
    FROM app.transport_routes r WHERE r.submitted_by = p_user AND r.submitted_role = 'guide'
$$;

-- ---- Flags -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.flag_transport_route(p_user uuid, p_route uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_open integer;
    v_back boolean := false;
BEGIN
    IF NOT app.transport_route_live(p_route) THEN
        RAISE EXCEPTION 'route not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_payload->>'reason' NOT IN ('fare_higher', 'fare_lower', 'no_longer_runs', 'wrong_pickup', 'times_wrong', 'unsafe', 'other') THEN
        RAISE EXCEPTION 'choose what is wrong' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.transport_flags (route_id, user_id, reason, details)
    VALUES (p_route, p_user, p_payload->>'reason', left(btrim(coalesce(p_payload->>'details', '')), 1000))
    ON CONFLICT (route_id, user_id) WHERE resolved_at IS NULL DO UPDATE
        SET reason = EXCLUDED.reason, details = EXCLUDED.details;
    SELECT count(*) INTO v_open FROM app.transport_flags
    WHERE route_id = p_route AND resolved_at IS NULL AND created_at > now() - interval '30 days';
    IF v_open >= 3 OR p_payload->>'reason' = 'unsafe' THEN
        UPDATE app.transport_routes
        SET status = 'submitted', decision_reason = 'flagged by travellers', updated_at = now()
        WHERE id = p_route;
        v_back := true;
    END IF;
    RETURN jsonb_build_object('flagged', true, 'back_to_review', v_back);
END;
$$;

-- ---- Staff review ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_list_transport(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text := NULLIF(btrim(coalesce(p_filter->>'status', '')), '');
    v_dest text := NULLIF(btrim(coalesce(p_filter->>'destination', '')), '');
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(app.transport_route_json(r.id, true) ORDER BY
            (r.status = 'submitted') DESC, r.review_by NULLS FIRST, r.created_at)
        FROM app.transport_routes r
        JOIN app.destinations t ON t.id = r.to_destination_id
        LEFT JOIN app.destinations f ON f.id = r.from_destination_id
        WHERE (v_status IS NULL OR r.status = v_status
               OR (v_status = 'stale' AND r.status = 'published' AND r.review_by < app.beirut_today()))
          AND (v_dest IS NULL OR t.slug = v_dest OR f.slug = v_dest)
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_upsert_transport(p_admin uuid, p_route uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_route IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.transport_routes WHERE id = p_route) THEN
        RAISE EXCEPTION 'route not found' USING ERRCODE = 'P0002';
    END IF;
    v_id := app.transport_write(p_admin, 'staff', p_route, p_payload);
    -- An edited card goes back through a decision before it shows again.
    UPDATE app.transport_routes SET status = 'submitted' WHERE id = v_id AND status = 'published';
    RETURN app.transport_route_json(v_id, true);
END;
$$;

-- Publishing records the field check that justifies it and sets the review date.
CREATE OR REPLACE FUNCTION app.admin_decide_transport(p_admin uuid, p_route uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_route app.transport_routes;
    v_decision text := p_payload->>'decision';
    v_checked date := coalesce(NULLIF(p_payload->>'checked_on', '')::date, app.beirut_today());
    v_note text := btrim(coalesce(p_payload->>'field_check_note', ''));
    v_reason text := btrim(coalesce(p_payload->>'reason', ''));
    v_evidence jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_route FROM app.transport_routes WHERE id = p_route FOR UPDATE;
    IF v_route.id IS NULL THEN
        RAISE EXCEPTION 'route not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_decision NOT IN ('published', 'rejected', 'retired') THEN
        RAISE EXCEPTION 'publish, reject or retire' USING ERRCODE = '22023';
    END IF;
    IF v_decision IN ('rejected', 'retired') AND v_reason = '' THEN
        RAISE EXCEPTION 'give a reason' USING ERRCODE = '22023';
    END IF;

    IF v_decision = 'published' THEN
        IF v_checked > app.beirut_today() OR v_checked < app.beirut_today() - 30 THEN
            RAISE EXCEPTION 'the field check must be from the last 30 days' USING ERRCODE = '22023';
        END IF;
        v_evidence := v_route.evidence;
        IF v_note <> '' THEN
            v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
                'kind', 'field_check', 'note', left(v_note, 500), 'on', v_checked
            ));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_evidence) e WHERE e->>'kind' = 'field_check') THEN
            RAISE EXCEPTION 'record the field check before publishing' USING ERRCODE = '22023';
        END IF;
        UPDATE app.transport_routes
        SET status = 'published', evidence = v_evidence, checked_by = p_admin, checked_on = v_checked,
            review_by = v_checked + 90, decision_reason = v_reason, updated_at = now()
        WHERE id = p_route;
        UPDATE app.transport_flags SET resolved_at = now() WHERE route_id = p_route AND resolved_at IS NULL;
        -- An accepted update retires the card it replaces.
        IF v_route.replaces_route_id IS NOT NULL THEN
            UPDATE app.transport_routes SET status = 'retired', decision_reason = 'replaced by a newer card',
                updated_at = now()
            WHERE id = v_route.replaces_route_id AND status = 'published';
        END IF;
    ELSE
        UPDATE app.transport_routes
        SET status = v_decision, decision_reason = left(v_reason, 500), updated_at = now()
        WHERE id = p_route;
    END IF;

    IF v_route.submitted_role = 'guide' AND v_route.submitted_by IS NOT NULL AND v_decision <> 'retired' THEN
        PERFORM app.emit_notification_event(
            'transport.card_decided', v_route.id, v_route.submitted_by, NULL,
            jsonb_build_object('path', '/guide/contribute', 'status', v_decision)
        );
    END IF;
    RETURN app.transport_route_json(p_route, true);
END;
$$;

-- ---- The sweep --------------------------------------------------------------------------
-- A card past its review date is already hidden; this puts it in the review queue.
CREATE OR REPLACE FUNCTION app.trust_sweep_transport()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE app.transport_routes
    SET status = 'submitted', decision_reason = 'review date passed', updated_at = now()
    WHERE status = 'published' AND review_by < app.beirut_today();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('back_to_review', v_count);
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
        'transport', app.trust_sweep_transport()
    );
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('transport.card_decided', 'en', 'traveller', 'Your transport card was reviewed',
     'A reviewer has decided on the transport card you sent ({status}). Thank you for keeping it right: {deep_link}'),
    ('transport.card_decided', 'ar', 'traveller', 'رُوجعت بطاقة التنقّل التي أرسلتها',
     'اتّخذ أحد المراجعين قرارًا بشأن بطاقة التنقّل التي أرسلتها ({status}). شكرًا لمساعدتك في إبقائها صحيحة: {deep_link}'),
    ('transport.card_decided', 'fr', 'traveller', 'Votre fiche transport a été examinée',
     'Un relecteur a statué sur la fiche transport envoyée ({status}). Merci de la garder à jour : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

REVOKE ALL ON FUNCTION app.transport_write(uuid, text, uuid, jsonb) FROM mshwar_backend;

GRANT EXECUTE ON FUNCTION
    app.transport_route_live(uuid),
    app.transport_route_json(uuid, boolean),
    app.public_destination_transport(text),
    app.public_transport_between(text, text),
    app.guide_submit_transport(uuid, jsonb),
    app.guide_list_transport(uuid),
    app.flag_transport_route(uuid, uuid, jsonb),
    app.admin_list_transport(uuid, jsonb),
    app.admin_upsert_transport(uuid, uuid, jsonb),
    app.admin_decide_transport(uuid, uuid, jsonb),
    app.trust_sweep_transport(),
    app.trust_sweep()
TO mshwar_backend;
