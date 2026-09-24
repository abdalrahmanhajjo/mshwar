-- 041_rides.sql
-- V3 of verified local services: booking a verified driver.
--
-- A traveller asks for a ride (A to B), a day with a driver, or an airport
-- pickup, choosing places by name. Live drivers whose areas cover it see the
-- request and send a fixed price up front - most red-plate taxis have no meter.
-- The traveller accepts one quote; both sides then see each other's name and
-- the driver's plate, and the traveller gets a share link for family. Payment
-- happens in the car: Mshwar never holds the money. Afterwards both review
-- each other, blind until both have written or 14 days pass. Either side can
-- report a problem; safety, wrong-driver and wrong-plate reports reach a person
-- at once. Suspending a driver cancels their future rides and tells travellers.

CREATE TABLE IF NOT EXISTS app.driver_terms (
    partner_id uuid PRIMARY KEY REFERENCES app.partners(id) ON DELETE CASCADE,
    day_rate_minor bigint CHECK (day_rate_minor IS NULL OR day_rate_minor BETWEEN 1000 AND 100000),
    currency text NOT NULL DEFAULT 'USD' REFERENCES app.currencies(code),
    airport_pickups boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.ride_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    traveller_id uuid NOT NULL REFERENCES app.users(id),
    trip_id uuid REFERENCES app.trips(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('ride', 'day', 'airport')),
    -- The area drivers are matched on: where the ride starts (or the day is spent).
    destination_id uuid NOT NULL REFERENCES app.destinations(id),
    pickup_name text NOT NULL CHECK (btrim(pickup_name) <> ''),
    pickup_location geography(Point, 4326),
    dropoff_name text NOT NULL DEFAULT '',
    dropoff_location geography(Point, 4326),
    starts_at timestamptz NOT NULL,
    hours integer CHECK (hours IS NULL OR hours BETWEEN 2 AND 14),
    party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 16),
    luggage integer NOT NULL DEFAULT 0 CHECK (luggage BETWEEN 0 AND 20),
    flight_number text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'cancelled', 'expired')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ride_requests_open_idx ON app.ride_requests (destination_id, starts_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS ride_requests_traveller_idx ON app.ride_requests (traveller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.ride_quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES app.ride_requests(id) ON DELETE CASCADE,
    partner_id uuid NOT NULL REFERENCES app.partners(id),
    vehicle_id uuid NOT NULL REFERENCES app.vehicles(id),
    price_minor bigint NOT NULL CHECK (price_minor BETWEEN 100 AND 200000),
    currency text NOT NULL DEFAULT 'USD' REFERENCES app.currencies(code),
    note text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'withdrawn', 'declined', 'expired')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (request_id, partner_id)
);

CREATE TABLE IF NOT EXISTS app.rides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL UNIQUE REFERENCES app.ride_requests(id),
    quote_id uuid NOT NULL UNIQUE REFERENCES app.ride_quotes(id),
    partner_id uuid NOT NULL REFERENCES app.partners(id),
    vehicle_id uuid NOT NULL REFERENCES app.vehicles(id),
    traveller_id uuid NOT NULL REFERENCES app.users(id),
    price_minor bigint NOT NULL,
    currency text NOT NULL REFERENCES app.currencies(code),
    state text NOT NULL DEFAULT 'confirmed'
        CHECK (state IN ('confirmed', 'completed', 'cancelled_by_traveller', 'cancelled_by_driver', 'no_show')),
    share_token_hash text NOT NULL UNIQUE,
    completed_at timestamptz,
    cancelled_at timestamptz,
    cancel_reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rides_partner_idx ON app.rides (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rides_traveller_idx ON app.rides (traveller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.ride_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id uuid NOT NULL REFERENCES app.rides(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('traveller_to_driver', 'driver_to_traveller')),
    author_id uuid NOT NULL REFERENCES app.users(id),
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body text NOT NULL DEFAULT '',
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ride_id, direction)
);

ALTER TABLE app.driver_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.driver_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE app.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ride_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE app.ride_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ride_quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE app.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.rides FORCE ROW LEVEL SECURITY;
ALTER TABLE app.ride_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ride_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.driver_terms, app.ride_requests, app.ride_quotes, app.rides, app.ride_reviews FROM mshwar_backend;

-- ---- Helpers -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.driver_partner_id(p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM app.partners WHERE user_id = p_user AND kind = 'driver';
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'partner profile not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.ride_review_released(p_ride uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT (SELECT count(*) FROM app.ride_reviews WHERE ride_id = p_ride) = 2
        OR coalesce((SELECT r.completed_at < now() - interval '14 days' FROM app.rides r WHERE r.id = p_ride), false)
$$;

CREATE OR REPLACE FUNCTION app.driver_rating(p_partner uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'average', round(avg(v.rating)::numeric, 1),
        'count', count(v.id),
        'completed_rides', (SELECT count(*) FROM app.rides r WHERE r.partner_id = p_partner AND r.state = 'completed')
    )
    FROM app.rides r
    JOIN app.ride_reviews v ON v.ride_id = r.id AND v.direction = 'traveller_to_driver' AND v.hidden_at IS NULL
    WHERE r.partner_id = p_partner AND app.ride_review_released(r.id)
$$;

-- What a traveller sees of a driver: the public page plus a rating.
CREATE OR REPLACE FUNCTION app.driver_card(p_partner uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.partner_json(p_partner, false) || jsonb_build_object(
        'rating', app.driver_rating(p_partner),
        'day_rate_minor', (SELECT t.day_rate_minor FROM app.driver_terms t WHERE t.partner_id = p_partner),
        'airport_pickups', coalesce((SELECT t.airport_pickups FROM app.driver_terms t WHERE t.partner_id = p_partner), true)
    )
$$;

CREATE OR REPLACE FUNCTION app.ride_request_json(p_request uuid, p_view text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', q.id,
        'kind', q.kind,
        'status', CASE WHEN q.status = 'open' AND q.expires_at < now() THEN 'expired' ELSE q.status END,
        'destination', jsonb_build_object('slug', d.slug, 'name', d.name),
        'pickup', jsonb_build_object('name', q.pickup_name,
            'lat', ST_Y(q.pickup_location::geometry), 'lng', ST_X(q.pickup_location::geometry)),
        'dropoff', jsonb_build_object('name', q.dropoff_name,
            'lat', ST_Y(q.dropoff_location::geometry), 'lng', ST_X(q.dropoff_location::geometry)),
        'starts_at', q.starts_at,
        'hours', q.hours,
        'party_size', q.party_size,
        'luggage', q.luggage,
        'flight_number', q.flight_number,
        'notes', q.notes,
        'expires_at', q.expires_at,
        'trip_id', CASE WHEN p_view = 'traveller' THEN q.trip_id END,
        'created_at', q.created_at,
        'ride_id', (SELECT r.id FROM app.rides r WHERE r.request_id = q.id)
    ) || CASE WHEN p_view = 'traveller' THEN jsonb_build_object(
        'quotes', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', o.id, 'price_minor', o.price_minor, 'currency', o.currency, 'note', o.note,
                'status', o.status, 'created_at', o.created_at,
                'vehicle', app.vehicle_json(o.vehicle_id, false),
                'driver', app.driver_card(o.partner_id)
            ) ORDER BY o.price_minor, o.created_at)
            FROM app.ride_quotes o
            WHERE o.request_id = q.id AND o.status IN ('offered', 'accepted')
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.ride_requests q
    JOIN app.destinations d ON d.id = q.destination_id
    WHERE q.id = p_request
$$;

CREATE OR REPLACE FUNCTION app.ride_json(p_ride uuid, p_view text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', r.id,
        'state', r.state,
        'price_minor', r.price_minor,
        'currency', r.currency,
        'request', app.ride_request_json(r.request_id, 'shared'),
        'vehicle', app.vehicle_json(r.vehicle_id, false),
        'driver', app.driver_card(r.partner_id),
        'completed_at', r.completed_at,
        'cancelled_at', r.cancelled_at,
        'cancel_reason', r.cancel_reason,
        'created_at', r.created_at,
        'reviews', jsonb_build_object(
            'mine', (SELECT jsonb_build_object('rating', v.rating, 'body', v.body) FROM app.ride_reviews v
                     WHERE v.ride_id = r.id
                       AND v.direction = CASE WHEN p_view = 'driver' THEN 'driver_to_traveller' ELSE 'traveller_to_driver' END),
            'theirs', CASE WHEN app.ride_review_released(r.id) THEN (
                SELECT jsonb_build_object('rating', v.rating, 'body', v.body) FROM app.ride_reviews v
                WHERE v.ride_id = r.id AND v.hidden_at IS NULL
                  AND v.direction = CASE WHEN p_view = 'driver' THEN 'traveller_to_driver' ELSE 'driver_to_traveller' END
            ) END,
            'can_write', r.state = 'completed' AND r.completed_at > now() - interval '14 days' AND NOT EXISTS (
                SELECT 1 FROM app.ride_reviews v WHERE v.ride_id = r.id
                  AND v.direction = CASE WHEN p_view = 'driver' THEN 'driver_to_traveller' ELSE 'traveller_to_driver' END
            )
        )
    )
    -- Once booked, each side gets the other's contact: the driver's verified phone,
    -- the traveller's name and phone if they gave one.
    || CASE WHEN p_view = 'traveller' THEN jsonb_build_object(
        'driver_phone', CASE WHEN r.state = 'confirmed' THEN (
            SELECT s.phone_e164 FROM app.partner_security s JOIN app.partners p ON p.user_id = s.user_id
            WHERE p.id = r.partner_id AND s.phone_verified_at IS NOT NULL) END
    ) WHEN p_view = 'driver' THEN jsonb_build_object(
        'traveller', jsonb_build_object(
            'display_name', (SELECT u.display_name FROM app.users u WHERE u.id = r.traveller_id),
            'phone', CASE WHEN r.state = 'confirmed' THEN (SELECT up.phone FROM app.user_private up WHERE up.user_id = r.traveller_id) END
        )
    ) ELSE '{}'::jsonb END
    FROM app.rides r WHERE r.id = p_ride
$$;

-- ---- Driver terms ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.driver_set_terms(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner uuid := app.driver_partner_id(p_user);
BEGIN
    INSERT INTO app.driver_terms (partner_id, day_rate_minor, airport_pickups, updated_at)
    VALUES (v_partner, NULLIF(p_payload->>'day_rate_minor', '')::bigint,
            coalesce((p_payload->>'airport_pickups')::boolean, true), now())
    ON CONFLICT (partner_id) DO UPDATE
    SET day_rate_minor = EXCLUDED.day_rate_minor, airport_pickups = EXCLUDED.airport_pickups, updated_at = now();
    RETURN app.driver_card(v_partner) || jsonb_build_object('live', app.partner_is_live(v_partner));
EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'a day rate is between 10 and 1,000 USD' USING ERRCODE = '22023';
END;
$$;

-- ---- Public reads -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.public_driver_directory(p_destination text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.driver_card(p.id) ORDER BY p.display_name), '[]'::jsonb)
    FROM app.partners p
    WHERE p.kind = 'driver' AND app.partner_is_live(p.id)
      AND (NULLIF(btrim(coalesce(p_destination, '')), '') IS NULL OR p_destination = ANY (p.regions))
$$;

CREATE OR REPLACE FUNCTION app.public_driver_page(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.driver_card(p.id) || jsonb_build_object(
        'reviews', coalesce((
            SELECT jsonb_agg(jsonb_build_object('rating', v.rating, 'body', v.body, 'at', v.created_at)
                             ORDER BY v.created_at DESC)
            FROM app.rides r
            JOIN app.ride_reviews v ON v.ride_id = r.id AND v.direction = 'traveller_to_driver' AND v.hidden_at IS NULL
            WHERE r.partner_id = p.id AND app.ride_review_released(r.id) AND btrim(v.body) <> ''
        ), '[]'::jsonb)
    )
    FROM app.partners p
    WHERE p.slug = p_slug AND p.kind = 'driver' AND app.partner_is_live(p.id)
$$;

-- ---- Travellers ask ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.traveller_request_ride(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := p_payload;
    v_kind text := b->>'kind';
    v_dest app.destinations;
    v_starts timestamptz;
    v_trip uuid := NULLIF(b->>'trip_id', '')::uuid;
    v_id uuid;
    v_driver record;
BEGIN
    IF v_kind NOT IN ('ride', 'day', 'airport') THEN
        RAISE EXCEPTION 'choose a ride, a day with a driver or an airport pickup' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_dest FROM app.destinations WHERE slug = b->>'destination';
    IF v_dest.id IS NULL THEN
        RAISE EXCEPTION 'choose where the ride starts' USING ERRCODE = '22023';
    END IF;
    v_starts := (b->>'starts_at')::timestamptz;
    IF v_starts < now() + interval '1 hour' OR v_starts > now() + interval '90 days' THEN
        RAISE EXCEPTION 'pick a time at least an hour from now and within 90 days' USING ERRCODE = '22023';
    END IF;
    IF btrim(coalesce(b->>'pickup_name', '')) = '' THEN
        RAISE EXCEPTION 'say where to pick you up' USING ERRCODE = '22023';
    END IF;
    IF v_kind = 'ride' AND btrim(coalesce(b->>'dropoff_name', '')) = '' THEN
        RAISE EXCEPTION 'say where you are going' USING ERRCODE = '22023';
    END IF;
    IF v_kind = 'day' AND coalesce((b->>'hours')::integer, 0) NOT BETWEEN 2 AND 14 THEN
        RAISE EXCEPTION 'a day with a driver is 2 to 14 hours' USING ERRCODE = '22023';
    END IF;
    IF v_kind = 'airport' AND btrim(coalesce(b->>'flight_number', '')) = '' THEN
        RAISE EXCEPTION 'add your flight number so the driver can follow it' USING ERRCODE = '22023';
    END IF;
    IF v_trip IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = v_trip AND t.owner_id = p_user) THEN
        v_trip := NULL;
    END IF;
    IF (SELECT count(*) FROM app.ride_requests WHERE traveller_id = p_user AND status = 'open') >= 5 THEN
        RAISE EXCEPTION 'you have five open requests; cancel one first' USING ERRCODE = '53400';
    END IF;

    INSERT INTO app.ride_requests (
        traveller_id, trip_id, kind, destination_id, pickup_name, pickup_location, dropoff_name, dropoff_location,
        starts_at, hours, party_size, luggage, flight_number, notes, expires_at
    ) VALUES (
        p_user, v_trip, v_kind, v_dest.id,
        left(btrim(b->>'pickup_name'), 160),
        CASE WHEN NULLIF(b->>'pickup_lat', '') IS NOT NULL THEN
            ST_SetSRID(ST_MakePoint((b->>'pickup_lng')::double precision, (b->>'pickup_lat')::double precision), 4326)::geography END,
        left(btrim(coalesce(b->>'dropoff_name', '')), 160),
        CASE WHEN NULLIF(b->>'dropoff_lat', '') IS NOT NULL THEN
            ST_SetSRID(ST_MakePoint((b->>'dropoff_lng')::double precision, (b->>'dropoff_lat')::double precision), 4326)::geography END,
        v_starts,
        CASE WHEN v_kind = 'day' THEN (b->>'hours')::integer END,
        coalesce((b->>'party_size')::integer, 1),
        coalesce((b->>'luggage')::integer, 0),
        left(upper(btrim(coalesce(b->>'flight_number', ''))), 12),
        left(btrim(coalesce(b->>'notes', '')), 1000),
        -- Quotes are open for two days, or until an hour before the ride.
        least(now() + interval '48 hours', v_starts - interval '1 hour')
    ) RETURNING id INTO v_id;

    FOR v_driver IN
        SELECT p.id, p.user_id FROM app.partners p
        LEFT JOIN app.driver_terms t ON t.partner_id = p.id
        WHERE p.kind = 'driver' AND v_dest.slug = ANY (p.regions) AND app.partner_is_live(p.id)
          AND (v_kind <> 'airport' OR coalesce(t.airport_pickups, true))
          AND EXISTS (SELECT 1 FROM app.vehicles v WHERE v.partner_id = p.id AND app.vehicle_is_live(v.id)
                      AND v.seats >= coalesce((b->>'party_size')::integer, 1))
    LOOP
        PERFORM app.emit_notification_event(
            'ride.requested', v_id, v_driver.user_id, NULL,
            jsonb_build_object('path', '/drive/requests', 'status', v_dest.name)
        );
    END LOOP;
    RETURN app.ride_request_json(v_id, 'traveller');
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the party size, luggage and hours' USING ERRCODE = '22023';
    WHEN invalid_datetime_format OR invalid_text_representation THEN
        RAISE EXCEPTION 'check the time and numbers on this request' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.traveller_list_rides(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'requests', coalesce((
            SELECT jsonb_agg(app.ride_request_json(q.id, 'traveller') ORDER BY q.starts_at DESC)
            FROM app.ride_requests q WHERE q.traveller_id = p_user AND q.status IN ('open', 'expired', 'cancelled')
              AND q.created_at > now() - interval '60 days'
        ), '[]'::jsonb),
        'rides', coalesce((
            SELECT jsonb_agg(app.ride_json(r.id, 'traveller') ORDER BY q.starts_at DESC)
            FROM app.rides r JOIN app.ride_requests q ON q.id = r.request_id WHERE r.traveller_id = p_user
        ), '[]'::jsonb)
    )
$$;

CREATE OR REPLACE FUNCTION app.traveller_get_request(p_user uuid, p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.ride_requests WHERE id = p_request AND traveller_id = p_user) THEN
        RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.ride_request_json(p_request, 'traveller') || jsonb_build_object(
        'ride', (SELECT app.ride_json(r.id, 'traveller') FROM app.rides r WHERE r.request_id = p_request)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.traveller_cancel_request(p_user uuid, p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.ride_requests SET status = 'cancelled', updated_at = now()
    WHERE id = p_request AND traveller_id = p_user AND status = 'open';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.ride_quotes SET status = 'declined', updated_at = now() WHERE request_id = p_request AND status = 'offered';
    RETURN app.ride_request_json(p_request, 'traveller');
END;
$$;

-- The traveller accepts one quote. The share token is minted by the API; only its hash is kept.
CREATE OR REPLACE FUNCTION app.traveller_accept_quote(p_user uuid, p_quote uuid, p_share_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_quote app.ride_quotes;
    v_request app.ride_requests;
    v_ride uuid;
    v_driver_user uuid;
BEGIN
    SELECT * INTO v_quote FROM app.ride_quotes WHERE id = p_quote FOR UPDATE;
    SELECT * INTO v_request FROM app.ride_requests WHERE id = v_quote.request_id FOR UPDATE;
    IF v_quote.id IS NULL OR v_request.traveller_id IS DISTINCT FROM p_user THEN
        RAISE EXCEPTION 'quote not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_request.status <> 'open' OR v_request.expires_at < now() THEN
        RAISE EXCEPTION 'this request is no longer open' USING ERRCODE = '22023';
    END IF;
    IF v_quote.status <> 'offered' THEN
        RAISE EXCEPTION 'this quote is no longer on offer' USING ERRCODE = '22023';
    END IF;
    -- A driver whose documents lapsed since quoting cannot be booked.
    IF NOT app.partner_is_live(v_quote.partner_id) OR NOT app.vehicle_is_live(v_quote.vehicle_id) THEN
        RAISE EXCEPTION 'this driver is not available right now' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.rides (request_id, quote_id, partner_id, vehicle_id, traveller_id, price_minor, currency, share_token_hash)
    VALUES (v_request.id, v_quote.id, v_quote.partner_id, v_quote.vehicle_id, p_user, v_quote.price_minor,
            v_quote.currency, p_share_hash)
    RETURNING id INTO v_ride;
    UPDATE app.ride_quotes SET status = 'accepted', updated_at = now() WHERE id = v_quote.id;
    UPDATE app.ride_quotes SET status = 'declined', updated_at = now()
    WHERE request_id = v_request.id AND id <> v_quote.id AND status = 'offered';
    UPDATE app.ride_requests SET status = 'booked', updated_at = now() WHERE id = v_request.id;

    SELECT user_id INTO v_driver_user FROM app.partners WHERE id = v_quote.partner_id;
    PERFORM app.emit_notification_event(
        'ride.confirmed', v_ride, v_driver_user, NULL,
        jsonb_build_object('path', '/drive/rides', 'status', 'confirmed')
    );
    RETURN app.ride_json(v_ride, 'traveller');
END;
$$;

-- ---- Drivers answer -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.driver_open_requests(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_airport boolean;
    v_seats integer;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE id = app.driver_partner_id(p_user);
    IF NOT app.partner_is_live(v_partner.id) THEN
        RETURN '[]'::jsonb;
    END IF;
    SELECT coalesce(t.airport_pickups, true) INTO v_airport
    FROM (SELECT 1) one LEFT JOIN app.driver_terms t ON t.partner_id = v_partner.id;
    SELECT max(v.seats) INTO v_seats FROM app.vehicles v WHERE v.partner_id = v_partner.id AND app.vehicle_is_live(v.id);
    RETURN coalesce((
        SELECT jsonb_agg(app.ride_request_json(q.id, 'driver') || jsonb_build_object(
            'my_quote', (SELECT jsonb_build_object('id', o.id, 'price_minor', o.price_minor, 'currency', o.currency,
                                                   'status', o.status, 'note', o.note)
                         FROM app.ride_quotes o WHERE o.request_id = q.id AND o.partner_id = v_partner.id),
            'quotes_so_far', (SELECT count(*) FROM app.ride_quotes o WHERE o.request_id = q.id AND o.status = 'offered')
        ) ORDER BY q.starts_at)
        FROM app.ride_requests q
        JOIN app.destinations d ON d.id = q.destination_id
        WHERE q.status = 'open' AND q.expires_at > now()
          AND d.slug = ANY (v_partner.regions)
          AND q.party_size <= coalesce(v_seats, 0)
          AND (q.kind <> 'airport' OR v_airport)
          AND q.traveller_id <> p_user
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.driver_quote(p_user uuid, p_request uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_partner app.partners;
    v_request app.ride_requests;
    v_vehicle app.vehicles;
    v_price bigint := NULLIF(p_payload->>'price_minor', '')::bigint;
BEGIN
    SELECT * INTO v_partner FROM app.partners WHERE id = app.driver_partner_id(p_user);
    IF NOT app.partner_is_live(v_partner.id) THEN
        RAISE EXCEPTION 'your account is not live, so you cannot quote' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_request FROM app.ride_requests WHERE id = p_request;
    IF v_request.id IS NULL OR v_request.traveller_id = p_user
       OR NOT EXISTS (SELECT 1 FROM app.destinations d WHERE d.id = v_request.destination_id AND d.slug = ANY (v_partner.regions)) THEN
        RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_request.status <> 'open' OR v_request.expires_at < now() THEN
        RAISE EXCEPTION 'this request is no longer open' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_vehicle FROM app.vehicles
    WHERE id = NULLIF(p_payload->>'vehicle_id', '')::uuid AND partner_id = v_partner.id;
    IF v_vehicle.id IS NULL OR NOT app.vehicle_is_live(v_vehicle.id) THEN
        RAISE EXCEPTION 'choose one of your verified vehicles' USING ERRCODE = '22023';
    END IF;
    IF v_vehicle.seats < v_request.party_size THEN
        RAISE EXCEPTION 'that vehicle does not have enough seats' USING ERRCODE = '22023';
    END IF;
    IF v_price IS NULL OR v_price NOT BETWEEN 100 AND 200000 THEN
        RAISE EXCEPTION 'give a fixed price between 1 and 2,000 USD' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.ride_quotes (request_id, partner_id, vehicle_id, price_minor, note)
    VALUES (v_request.id, v_partner.id, v_vehicle.id, v_price, left(btrim(coalesce(p_payload->>'note', '')), 500))
    ON CONFLICT (request_id, partner_id) DO UPDATE
    SET vehicle_id = EXCLUDED.vehicle_id, price_minor = EXCLUDED.price_minor, note = EXCLUDED.note,
        status = 'offered', updated_at = now()
    WHERE app.ride_quotes.status IN ('offered', 'withdrawn');
    PERFORM app.emit_notification_event(
        'ride.quote_received', v_request.id, v_request.traveller_id, NULL,
        jsonb_build_object('path', '/rides/' || v_request.id, 'status', v_partner.display_name)
    );
    RETURN app.ride_request_json(v_request.id, 'driver') || jsonb_build_object(
        'my_quote', (SELECT jsonb_build_object('id', o.id, 'price_minor', o.price_minor, 'currency', o.currency,
                                               'status', o.status, 'note', o.note)
                     FROM app.ride_quotes o WHERE o.request_id = v_request.id AND o.partner_id = v_partner.id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.driver_withdraw_quote(p_user uuid, p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.ride_quotes SET status = 'withdrawn', updated_at = now()
    WHERE request_id = p_request AND partner_id = app.driver_partner_id(p_user) AND status = 'offered';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'quote not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('withdrawn', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.driver_list_rides(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.ride_json(r.id, 'driver') ORDER BY q.starts_at DESC), '[]'::jsonb)
    FROM app.rides r JOIN app.ride_requests q ON q.id = r.request_id
    WHERE r.partner_id = app.driver_partner_id(p_user)
$$;

-- ---- Either side, after booking ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.ride_side(p_user uuid, p_ride uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN r.traveller_id = p_user THEN 'traveller'
        WHEN p.user_id = p_user THEN 'driver'
    END
    FROM app.rides r JOIN app.partners p ON p.id = r.partner_id WHERE r.id = p_ride
$$;

CREATE OR REPLACE FUNCTION app.get_ride(p_user uuid, p_ride uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_side text := app.ride_side(p_user, p_ride);
BEGIN
    IF v_side IS NULL THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.ride_json(p_ride, v_side) || jsonb_build_object('viewer', v_side);
END;
$$;

CREATE OR REPLACE FUNCTION app.cancel_ride(p_user uuid, p_ride uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_side text := app.ride_side(p_user, p_ride);
    v_ride app.rides;
    v_other uuid;
BEGIN
    IF v_side IS NULL THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_ride FROM app.rides WHERE id = p_ride FOR UPDATE;
    IF v_ride.state <> 'confirmed' THEN
        RAISE EXCEPTION 'this ride can no longer be cancelled' USING ERRCODE = '22023';
    END IF;
    IF v_side = 'driver' AND length(btrim(coalesce(p_reason, ''))) < 5 THEN
        RAISE EXCEPTION 'tell the traveller why' USING ERRCODE = '22023';
    END IF;
    UPDATE app.rides
    SET state = CASE WHEN v_side = 'driver' THEN 'cancelled_by_driver' ELSE 'cancelled_by_traveller' END,
        cancelled_at = now(), cancel_reason = left(btrim(coalesce(p_reason, '')), 500), updated_at = now()
    WHERE id = p_ride;
    IF v_side = 'driver' THEN
        v_other := v_ride.traveller_id;
    ELSE
        SELECT user_id INTO v_other FROM app.partners WHERE id = v_ride.partner_id;
    END IF;
    PERFORM app.emit_notification_event(
        'ride.cancelled', v_ride.id, v_other, NULL,
        jsonb_build_object('path', CASE WHEN v_side = 'driver' THEN '/rides/' || v_ride.request_id ELSE '/drive/rides' END,
                           'status', CASE WHEN v_side = 'driver' THEN 'driver' ELSE 'traveller' END)
    );
    RETURN app.ride_json(p_ride, v_side);
END;
$$;

-- The driver closes the ride once its time has come: done, or the traveller never came.
CREATE OR REPLACE FUNCTION app.driver_finish_ride(p_user uuid, p_ride uuid, p_outcome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_ride app.rides;
    v_starts timestamptz;
BEGIN
    IF app.ride_side(p_user, p_ride) IS DISTINCT FROM 'driver' THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_outcome NOT IN ('completed', 'no_show') THEN
        RAISE EXCEPTION 'mark the ride done or a no-show' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_ride FROM app.rides WHERE id = p_ride FOR UPDATE;
    SELECT starts_at INTO v_starts FROM app.ride_requests WHERE id = v_ride.request_id;
    IF v_ride.state <> 'confirmed' THEN
        RAISE EXCEPTION 'this ride is already closed' USING ERRCODE = '22023';
    END IF;
    IF v_starts > now() THEN
        RAISE EXCEPTION 'you can close the ride once it has started' USING ERRCODE = '22023';
    END IF;
    UPDATE app.rides
    SET state = p_outcome, completed_at = CASE WHEN p_outcome = 'completed' THEN now() END, updated_at = now()
    WHERE id = p_ride;
    PERFORM app.emit_notification_event(
        'ride.finished', v_ride.id, v_ride.traveller_id, NULL,
        jsonb_build_object('path', '/rides/' || v_ride.request_id, 'status', p_outcome)
    );
    RETURN app.ride_json(p_ride, 'driver');
END;
$$;

CREATE OR REPLACE FUNCTION app.write_ride_review(p_user uuid, p_ride uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_side text := app.ride_side(p_user, p_ride);
    v_ride app.rides;
    v_rating integer := NULLIF(p_payload->>'rating', '')::integer;
BEGIN
    IF v_side IS NULL THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_ride FROM app.rides WHERE id = p_ride;
    IF v_ride.state <> 'completed' OR v_ride.completed_at < now() - interval '14 days' THEN
        RAISE EXCEPTION 'reviews open when the ride is done and close 14 days later' USING ERRCODE = '22023';
    END IF;
    IF v_rating IS NULL OR v_rating NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'rate from 1 to 5' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.ride_reviews (ride_id, direction, author_id, rating, body)
    VALUES (p_ride, CASE WHEN v_side = 'driver' THEN 'driver_to_traveller' ELSE 'traveller_to_driver' END,
            p_user, v_rating, left(btrim(coalesce(p_payload->>'body', '')), 2000))
    ON CONFLICT (ride_id, direction) DO NOTHING;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'you have already reviewed this ride' USING ERRCODE = '22023';
    END IF;
    RETURN app.ride_json(p_ride, v_side);
END;
$$;

-- A family member's view through the share link: who, which car, where, when. No contact details.
CREATE OR REPLACE FUNCTION app.ride_shared_view(p_share_hash text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'state', r.state,
        'starts_at', q.starts_at,
        'kind', q.kind,
        'pickup', q.pickup_name,
        'dropoff', q.dropoff_name,
        'driver', jsonb_build_object(
            'display_name', p.display_name,
            'photo', (SELECT jsonb_build_object('provider', d.provider, 'key', d.document_key)
                      FROM app.partner_documents d
                      WHERE d.partner_id = p.id AND d.kind = 'profile_photo' AND d.verification = 'verified'),
            'trust_level', app.partner_trust_level(p.id)
        ),
        'vehicle', jsonb_build_object('plate', v.plate, 'make', v.make, 'model', v.model, 'colour', v.colour)
    )
    FROM app.rides r
    JOIN app.ride_requests q ON q.id = r.request_id
    JOIN app.partners p ON p.id = r.partner_id
    JOIN app.vehicles v ON v.id = r.vehicle_id
    WHERE r.share_token_hash = p_share_hash
      -- The link stops working a day after the ride.
      AND q.starts_at > now() - interval '1 day' - make_interval(hours => coalesce(q.hours, 3))
$$;

-- A new share link replaces the old one (the traveller can only see a link when it is made).
CREATE OR REPLACE FUNCTION app.rotate_ride_share(p_user uuid, p_ride uuid, p_share_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.rides SET share_token_hash = p_share_hash, updated_at = now()
    WHERE id = p_ride AND traveller_id = p_user AND state = 'confirmed';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('rotated', true);
END;
$$;

-- ---- Reports ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.report_ride(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_category text := p_payload->>'category';
    v_details text := btrim(coalesce(p_payload->>'details', ''));
    v_ride uuid := NULLIF(p_payload->>'ride_id', '')::uuid;
    v_side text;
    v_id uuid;
    v_urgent boolean;
BEGIN
    IF v_category NOT IN ('safety', 'wrong_driver', 'wrong_plate', 'unsafe_vehicle', 'overcharge', 'no_show',
                          'conduct', 'other') THEN
        RAISE EXCEPTION 'choose what kind of problem this is' USING ERRCODE = '22023';
    END IF;
    IF length(v_details) < 10 THEN
        RAISE EXCEPTION 'describe what happened in a sentence or two' USING ERRCODE = '22023';
    END IF;
    v_side := app.ride_side(p_user, v_ride);
    IF v_side IS NULL THEN
        RAISE EXCEPTION 'ride not found' USING ERRCODE = 'P0002';
    END IF;
    v_urgent := v_category IN ('safety', 'wrong_driver', 'wrong_plate', 'unsafe_vehicle');
    INSERT INTO app.support_cases (reporter_id, reason, evidence, escalated_at)
    VALUES (
        p_user, 'ride_' || v_category,
        jsonb_build_array(jsonb_build_object(
            'kind', 'statement', 'text', left(v_details, 4000), 'ride_id', v_ride, 'reported_as', v_side,
            'partner_id', (SELECT partner_id FROM app.rides WHERE id = v_ride)
        )),
        CASE WHEN v_urgent THEN now() END
    ) RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'category', v_category, 'escalated', v_urgent);
END;
$$;

-- ---- Suspension closes what is open -------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.on_partner_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_ride record;
    v_reason text := 'This driver is no longer available on Mshwar';
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved', 'rejected', 'suspended') THEN
        RETURN NEW;
    END IF;
    PERFORM app.emit_notification_event(
        'partner.application_decided', NEW.id, NEW.user_id, NULL,
        jsonb_build_object('path', CASE NEW.kind WHEN 'driver' THEN '/drive' ELSE '/exchange' END, 'status', NEW.status)
    );
    IF NEW.status = 'suspended' AND NEW.kind = 'driver' THEN
        UPDATE app.ride_quotes SET status = 'withdrawn', updated_at = now()
        WHERE partner_id = NEW.id AND status = 'offered';
        FOR v_ride IN
            SELECT r.id, r.traveller_id, r.request_id FROM app.rides r JOIN app.ride_requests q ON q.id = r.request_id
            WHERE r.partner_id = NEW.id AND r.state = 'confirmed' AND q.starts_at > now()
        LOOP
            UPDATE app.rides SET state = 'cancelled_by_driver', cancelled_at = now(), cancel_reason = v_reason,
                updated_at = now()
            WHERE id = v_ride.id;
            PERFORM app.emit_notification_event(
                'ride.cancelled', v_ride.id, v_ride.traveller_id, NULL,
                jsonb_build_object('path', '/rides/' || v_ride.request_id, 'status', 'driver')
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

-- ---- The sweep ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.trust_sweep_rides()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE app.ride_quotes o SET status = 'expired', updated_at = now()
    FROM app.ride_requests q
    WHERE o.request_id = q.id AND o.status = 'offered' AND q.status = 'open' AND q.expires_at < now();
    UPDATE app.ride_requests SET status = 'expired', updated_at = now()
    WHERE status = 'open' AND expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('requests_expired', v_count);
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
        'rides', app.trust_sweep_rides()
    );
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('ride.requested', 'en', 'traveller', 'A traveller needs a driver',
     'A traveller has asked for a ride starting in {status}. Send a fixed price if you can take it: {deep_link}'),
    ('ride.requested', 'ar', 'traveller', 'مسافر يحتاج إلى سائق',
     'طلب مسافر رحلة تبدأ في {status}. أرسل سعرًا ثابتًا إن كنت تستطيع أخذها: {deep_link}'),
    ('ride.requested', 'fr', 'traveller', 'Un voyageur cherche un chauffeur',
     'Un voyageur demande une course au départ de {status}. Envoyez un prix fixe si vous pouvez la faire : {deep_link}'),
    ('ride.quote_received', 'en', 'traveller', 'A driver sent you a price',
     '{status} sent a fixed price for your ride. Compare the quotes and choose one: {deep_link}'),
    ('ride.quote_received', 'ar', 'traveller', 'أرسل لك سائق سعرًا',
     'أرسل {status} سعرًا ثابتًا لرحلتك. قارن العروض واختر واحدًا: {deep_link}'),
    ('ride.quote_received', 'fr', 'traveller', 'Un chauffeur vous a envoyé un prix',
     '{status} a envoyé un prix fixe pour votre course. Comparez les offres et choisissez : {deep_link}'),
    ('ride.confirmed', 'en', 'traveller', 'Your price was accepted',
     'A traveller accepted your price. The ride is booked; see the pickup and their contact: {deep_link}'),
    ('ride.confirmed', 'ar', 'traveller', 'قُبل سعرك',
     'قبل مسافر سعرك. الرحلة محجوزة؛ اطّلع على مكان الانطلاق ووسيلة التواصل: {deep_link}'),
    ('ride.confirmed', 'fr', 'traveller', 'Votre prix a été accepté',
     'Un voyageur a accepté votre prix. La course est réservée ; voir le point de départ et le contact : {deep_link}'),
    ('ride.cancelled', 'en', 'traveller', 'A ride was cancelled',
     'A booked ride was cancelled by the {status}. See the details: {deep_link}'),
    ('ride.cancelled', 'ar', 'traveller', 'أُلغيت رحلة',
     'أُلغيت رحلة محجوزة من قِبل {status}. اطّلع على التفاصيل: {deep_link}'),
    ('ride.cancelled', 'fr', 'traveller', 'Une course a été annulée',
     'Une course réservée a été annulée ({status}). Voir les détails : {deep_link}'),
    ('ride.finished', 'en', 'traveller', 'How was your ride?',
     'Your driver closed the ride ({status}). Review them within 14 days, or report a problem: {deep_link}'),
    ('ride.finished', 'ar', 'traveller', 'كيف كانت رحلتك؟',
     'أغلق السائق الرحلة ({status}). قيّمه خلال 14 يومًا أو أبلغ عن مشكلة: {deep_link}'),
    ('ride.finished', 'fr', 'traveller', 'Comment s’est passée votre course ?',
     'Votre chauffeur a clôturé la course ({status}). Notez-le sous 14 jours ou signalez un problème : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

GRANT EXECUTE ON FUNCTION
    app.driver_partner_id(uuid),
    app.ride_review_released(uuid),
    app.driver_rating(uuid),
    app.driver_card(uuid),
    app.ride_request_json(uuid, text),
    app.ride_json(uuid, text),
    app.driver_set_terms(uuid, jsonb),
    app.public_driver_directory(text),
    app.public_driver_page(text),
    app.traveller_request_ride(uuid, jsonb),
    app.traveller_list_rides(uuid),
    app.traveller_get_request(uuid, uuid),
    app.traveller_cancel_request(uuid, uuid),
    app.traveller_accept_quote(uuid, uuid, text),
    app.driver_open_requests(uuid),
    app.driver_quote(uuid, uuid, jsonb),
    app.driver_withdraw_quote(uuid, uuid),
    app.driver_list_rides(uuid),
    app.ride_side(uuid, uuid),
    app.get_ride(uuid, uuid),
    app.cancel_ride(uuid, uuid, text),
    app.driver_finish_ride(uuid, uuid, text),
    app.write_ride_review(uuid, uuid, jsonb),
    app.ride_shared_view(text),
    app.rotate_ride_share(uuid, uuid, text),
    app.report_ride(uuid, jsonb),
    app.trust_sweep_rides(),
    app.trust_sweep()
TO mshwar_backend;
