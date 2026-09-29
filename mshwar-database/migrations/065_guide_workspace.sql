-- 065_guide_workspace.sql
-- Guide plan, step 6: the guide's workspace.
--
-- A guide sees their month at a glance (open, partly booked, full, private, blocked, hired
-- days and busy time from their own calendar), subscribes to a private calendar feed of
-- their confirmed runs, imports busy time from Google or any iCal calendar so they are never
-- double-booked, checks guests in on the day, records what was paid, and reads an honest
-- statement and a few numbers about each tour.
--
-- Money is still paid on the day. The statement is what the guide recorded, next to what
-- the bookings said; Mshwar's fee is shown as what it is today (0%), never estimated.

-- ---- Busy time from other calendars -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_external_calendars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    url text NOT NULL CHECK (url ~ '^https://' AND length(url) <= 1000),
    label text NOT NULL DEFAULT '' CHECK (length(label) <= 60),
    last_synced_at timestamptz,
    last_status text NOT NULL DEFAULT 'pending' CHECK (last_status IN ('pending', 'ok', 'failed')),
    last_error text NOT NULL DEFAULT '' CHECK (length(last_error) <= 200),
    events integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (guide_profile_id, url)
);
ALTER TABLE app.guide_external_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_external_calendars FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_external_calendar_self ON app.guide_external_calendars;
CREATE POLICY guide_external_calendar_self ON app.guide_external_calendars FOR SELECT TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_external_calendars.guide_profile_id AND g.user_id = app.current_user_id()));
GRANT SELECT ON app.guide_external_calendars TO mshwar_backend;

ALTER TABLE app.guide_busy_blocks
    ADD COLUMN IF NOT EXISTS calendar_id uuid REFERENCES app.guide_external_calendars(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS guide_busy_blocks_calendar_idx ON app.guide_busy_blocks (calendar_id) WHERE calendar_id IS NOT NULL;

CREATE OR REPLACE FUNCTION app.guide_external_calendar_json(c app.guide_external_calendars)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'id', c.id,
        -- Only the host is shown back: a calendar's secret address stays secret.
        'host', substring(c.url FROM '^https://([^/]+)'),
        'label', c.label,
        'last_synced_at', c.last_synced_at,
        'last_status', c.last_status,
        'last_error', c.last_error,
        'events', c.events
    );
$$;

CREATE OR REPLACE FUNCTION app.guide_list_external_calendars(p_user uuid)
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
        SELECT jsonb_agg(app.guide_external_calendar_json(c) ORDER BY c.created_at)
        FROM app.guide_external_calendars c WHERE c.guide_profile_id = g.id
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_add_external_calendar(p_user uuid, p_url text, p_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_url text := btrim(coalesce(p_url, ''));
BEGIN
    -- webcal:// is how Google and Apple hand out the same address.
    IF v_url ~* '^webcal://' THEN
        v_url := 'https://' || substring(v_url FROM 10);
    END IF;
    IF v_url !~ '^https://[^/\s]+/\S*$' OR length(v_url) > 1000 THEN
        RAISE EXCEPTION 'paste the calendar''s secret address (https:// or webcal://)' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM app.guide_external_calendars WHERE guide_profile_id = g.id) >= 3 THEN
        RAISE EXCEPTION 'connect at most 3 calendars' USING ERRCODE = '53400';
    END IF;
    INSERT INTO app.guide_external_calendars (guide_profile_id, url, label)
    VALUES (g.id, v_url, left(btrim(coalesce(p_label, '')), 60))
    ON CONFLICT (guide_profile_id, url) DO NOTHING;
    RETURN app.guide_list_external_calendars(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_remove_external_calendar(p_user uuid, p_calendar uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    DELETE FROM app.guide_external_calendars WHERE id = p_calendar AND guide_profile_id = g.id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'calendar not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.guide_list_external_calendars(p_user);
END;
$$;

-- For the sync job: connected calendars with their address, least recently read first.
-- With a user, only that guide's calendars (the "sync now" button).
CREATE OR REPLACE FUNCTION app.guide_calendars_to_sync(p_user uuid DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'url', x.url)), '[]'::jsonb)
    FROM (
        SELECT c.id, c.url
        FROM app.guide_external_calendars c
        JOIN app.guide_profiles g ON g.id = c.guide_profile_id
        WHERE (p_user IS NULL AND g.status = 'approved') OR g.user_id = p_user
        ORDER BY c.last_synced_at NULLS FIRST
        LIMIT least(greatest(p_limit, 1), 500)
    ) x;
$$;

-- Replaces one calendar's busy time with what it says now. Only start and end are kept.
CREATE OR REPLACE FUNCTION app.guide_replace_external_blocks(p_calendar uuid, p_periods jsonb, p_error text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    c app.guide_external_calendars;
    v_count integer := 0;
BEGIN
    SELECT * INTO c FROM app.guide_external_calendars WHERE id = p_calendar;
    IF c.id IS NULL THEN
        RETURN 0;
    END IF;
    IF p_error IS NOT NULL THEN
        -- A failed read keeps the last known busy time rather than freeing the guide's week.
        UPDATE app.guide_external_calendars
        SET last_synced_at = now(), last_status = 'failed', last_error = left(p_error, 200)
        WHERE id = p_calendar;
        RETURN 0;
    END IF;
    DELETE FROM app.guide_busy_blocks WHERE calendar_id = p_calendar;
    INSERT INTO app.guide_busy_blocks (guide_profile_id, period, kind, note, calendar_id)
    SELECT c.guide_profile_id, tstzrange(x.starts, x.ends, '[)'), 'external', '', p_calendar
    FROM (
        SELECT (p->>'starts_at')::timestamptz AS starts, (p->>'ends_at')::timestamptz AS ends
        FROM jsonb_array_elements(coalesce(p_periods, '[]'::jsonb)) AS p
    ) x
    WHERE x.ends > x.starts
      AND x.ends > now()
      AND x.starts < now() + interval '120 days'
      AND x.ends - x.starts <= interval '31 days'
    LIMIT 2000;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE app.guide_external_calendars
    SET last_synced_at = now(), last_status = 'ok', last_error = '', events = v_count
    WHERE id = p_calendar;
    RETURN v_count;
END;
$$;

-- ---- A private feed of the guide's confirmed work ------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_calendar_feeds (
    guide_profile_id uuid PRIMARY KEY REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.guide_calendar_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_calendar_feeds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_calendar_feeds_none ON app.guide_calendar_feeds;
CREATE POLICY guide_calendar_feeds_none ON app.guide_calendar_feeds FOR SELECT TO mshwar_backend USING (false);

-- A new address replaces the old one. Only its hash is stored; the address is shown once.
CREATE OR REPLACE FUNCTION app.guide_new_calendar_feed(p_user uuid, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
        RAISE EXCEPTION 'invalid feed token' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.guide_calendar_feeds (guide_profile_id, token_hash)
    VALUES (g.id, p_token_hash)
    ON CONFLICT (guide_profile_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = now();
    RETURN jsonb_build_object('created', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_revoke_calendar_feed(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    DELETE FROM app.guide_calendar_feeds WHERE guide_profile_id = g.id;
    RETURN jsonb_build_object('active', false, 'created_at', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_calendar_feed_status(p_user uuid)
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
        'active', EXISTS (SELECT 1 FROM app.guide_calendar_feeds f WHERE f.guide_profile_id = g.id),
        'created_at', (SELECT f.created_at FROM app.guide_calendar_feeds f WHERE f.guide_profile_id = g.id)
    );
END;
$$;

-- What the feed carries: confirmed runs (with the number of guests) and hired days, from a
-- month back to four months ahead. Guest names and phones are never in it.
CREATE OR REPLACE FUNCTION app.guide_calendar_feed(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH g AS (
        SELECT gp.* FROM app.guide_calendar_feeds f
        JOIN app.guide_profiles gp ON gp.id = f.guide_profile_id AND gp.status = 'approved'
        WHERE f.token_hash = p_token_hash
    )
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM g) THEN NULL ELSE jsonb_build_object(
        'name', (SELECT display_name FROM g),
        'runs', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'title', x.title,
                'meeting_point', coalesce(t.meeting_point, ''),
                'guests', (SELECT sum(b.party_size) FROM app.bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')
            ) ORDER BY s.starts_at)
            FROM app.slots s
            JOIN app.experiences x ON x.id = s.experience_id
            LEFT JOIN app.guide_tours t ON t.experience_id = x.id
            WHERE x.organization_id = (SELECT organization_id FROM g)
              AND s.starts_at BETWEEN now() - interval '31 days' AND now() + interval '120 days'
              AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')
        ), '[]'::jsonb),
        'hired_days', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', h.id, 'local_date', h.local_date) ORDER BY h.local_date)
            FROM app.guide_engagements h
            WHERE h.guide_profile_id = (SELECT id FROM g) AND h.state = 'confirmed'
              AND h.local_date BETWEEN current_date - 31 AND current_date + 120
        ), '[]'::jsonb)
    ) END;
$$;

-- ---- The calendar view ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_calendar(p_user uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_from timestamptz := p_from::timestamp AT TIME ZONE 'Asia/Beirut';
    v_to timestamptz := (p_to + 1)::timestamp AT TIME ZONE 'Asia/Beirut';
BEGIN
    IF p_to < p_from OR p_to - p_from > 62 THEN
        RAISE EXCEPTION 'show at most two months at a time' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
        'slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'tour_id', x.id,
                'tour_title', x.title,
                'starts_at', s.starts_at,
                'ends_at', s.ends_at,
                'capacity', s.capacity,
                'reserved', s.reserved,
                'private', s.private,
                'closed', s.status <> 'open',
                'bookings', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', b.id, 'status', b.status, 'party_size', b.party_size,
                        'code', d.code, 'checked_in', d.checked_in_at IS NOT NULL, 'no_show', d.no_show
                    ) ORDER BY b.created_at), '[]'::jsonb)
                    FROM app.bookings b LEFT JOIN app.tour_booking_details d ON d.booking_id = b.id
                    WHERE b.slot_id = s.id AND b.status IN ('pending', 'confirmed', 'completed')
                )
            ) ORDER BY s.starts_at)
            FROM app.slots s
            JOIN app.experiences x ON x.id = s.experience_id
            WHERE x.organization_id = g.organization_id
              AND s.starts_at >= v_from AND s.starts_at < v_to
              AND (s.status = 'open' OR EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id))
        ), '[]'::jsonb),
        'blocks', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', k.id, 'starts_at', lower(k.period), 'ends_at', upper(k.period), 'kind', k.kind,
                'note', k.note
            ) ORDER BY lower(k.period))
            FROM app.guide_busy_blocks k
            WHERE k.guide_profile_id = g.id AND k.period && tstzrange(v_from, v_to, '[)')
        ), '[]'::jsonb),
        'hired_days', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', h.id, 'local_date', h.local_date, 'state', h.state)
                             ORDER BY h.local_date)
            FROM app.guide_engagements h
            WHERE h.guide_profile_id = g.id AND h.local_date BETWEEN p_from AND p_to
              AND h.state IN ('accepted', 'changes_proposed', 'confirmed')
        ), '[]'::jsonb),
        'days_off', coalesce((
            SELECT jsonb_agg(jsonb_build_object('local_date', x.local_date, 'reason', x.reason) ORDER BY x.local_date)
            FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date BETWEEN p_from AND p_to
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- On the day: check-in, no-show, payment -----------------------------------------------------
ALTER TABLE app.tour_booking_details
    ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS no_show boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS paid_minor bigint CHECK (paid_minor IS NULL OR paid_minor >= 0),
    ADD COLUMN IF NOT EXISTS paid_method text CHECK (paid_method IS NULL OR paid_method IN ('cash', 'wallet', 'card', 'transfer', 'other')),
    ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE OR REPLACE FUNCTION app.guide_owned_booking(p_user uuid, p_booking uuid)
RETURNS app.bookings
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    b app.bookings;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND organization_id = g.organization_id;
    IF b.id IS NULL OR NOT EXISTS (SELECT 1 FROM app.tour_booking_details WHERE booking_id = p_booking) THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN b;
END;
$$;

-- Arrived or no-show, from an hour before the start to a day after the end.
CREATE OR REPLACE FUNCTION app.guide_check_in(p_user uuid, p_booking uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings := app.guide_owned_booking(p_user, p_booking);
    s app.slots;
BEGIN
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id;
    IF b.status NOT IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'only a confirmed booking can be checked in' USING ERRCODE = '22023';
    END IF;
    IF now() < s.starts_at - interval '1 hour' OR now() > s.ends_at + interval '24 hours' THEN
        RAISE EXCEPTION 'check guests in on the day of the run' USING ERRCODE = '22023';
    END IF;
    IF p_status = 'arrived' THEN
        UPDATE app.tour_booking_details SET checked_in_at = coalesce(checked_in_at, now()), no_show = false
        WHERE booking_id = p_booking;
    ELSIF p_status = 'no_show' THEN
        IF now() < s.starts_at THEN
            RAISE EXCEPTION 'a no-show is marked after the start' USING ERRCODE = '22023';
        END IF;
        UPDATE app.tour_booking_details SET checked_in_at = NULL, no_show = true WHERE booking_id = p_booking;
        PERFORM app.emit_notification_event(
            'guide.no_show', p_booking, b.customer_id, NULL,
            jsonb_build_object('booking_id', p_booking, 'status', 'no_show', 'path', '/tour-bookings/' || p_booking)
        );
    ELSE
        RAISE EXCEPTION 'arrived or no_show' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (p_booking, p_user, b.status, b.status,
            CASE WHEN p_status = 'arrived' THEN 'Guide checked the guests in' ELSE 'Guide marked a no-show' END);
    RETURN app.guide_tour_booking(p_user, p_booking);
END;
$$;

-- What the guide received on the day, in their own words and amount.
CREATE OR REPLACE FUNCTION app.guide_record_payment(p_user uuid, p_booking uuid, p_amount bigint, p_method text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings := app.guide_owned_booking(p_user, p_booking);
    s app.slots;
BEGIN
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id;
    IF b.status NOT IN ('confirmed', 'completed') THEN
        RAISE EXCEPTION 'only a confirmed booking is paid' USING ERRCODE = '22023';
    END IF;
    IF now() < s.starts_at - interval '1 hour' THEN
        RAISE EXCEPTION 'record the payment on the day' USING ERRCODE = '22023';
    END IF;
    IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
        RAISE EXCEPTION 'enter the amount received' USING ERRCODE = '22023';
    END IF;
    IF p_method NOT IN ('cash', 'wallet', 'card', 'transfer', 'other') THEN
        RAISE EXCEPTION 'choose how it was paid' USING ERRCODE = '22023';
    END IF;
    UPDATE app.tour_booking_details SET paid_minor = p_amount, paid_method = p_method, paid_at = now()
    WHERE booking_id = p_booking;
    INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
    VALUES (p_booking, p_user, b.status, b.status, format('Guide recorded %s received (%s)', p_amount, p_method));
    RETURN app.guide_tour_booking(p_user, p_booking);
END;
$$;

-- The guide's view of a booking now carries the day's record.
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
    RETURN app.tour_booking_json(p_booking) || (
        SELECT jsonb_build_object(
            'checked_in_at', d.checked_in_at,
            'no_show', d.no_show,
            'paid_minor', d.paid_minor,
            'paid_method', d.paid_method,
            'paid_at', d.paid_at,
            'arrived_at', (SELECT max(e.created_at) FROM app.booking_events e
                           WHERE e.booking_id = d.booking_id AND e.reason = 'Traveller is at the meeting point')
        )
        FROM app.tour_booking_details d WHERE d.booking_id = p_booking
    );
END;
$$;

-- ---- Earnings ----------------------------------------------------------------------------------
-- Mshwar's fee today, as a share of what the guest paid. Zero until online payments exist;
-- Founding Guides keep zero for good (see /guides/join).
CREATE OR REPLACE FUNCTION app.guide_fee_percent(p_guide uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    SELECT 0::numeric;
$$;

CREATE OR REPLACE FUNCTION app.guide_earnings(p_user uuid, p_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_from timestamptz := date_trunc('month', p_month)::timestamp AT TIME ZONE 'Asia/Beirut';
    v_to timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamp AT TIME ZONE 'Asia/Beirut';
    v_fee numeric := app.guide_fee_percent(g.id);
    v_rows jsonb;
BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'code', d.code,
        'starts_at', s.starts_at,
        'tour_title', x.title,
        'party_size', b.party_size,
        'status', b.status,
        'no_show', d.no_show,
        'expected_minor', d.total_minor,
        'paid_minor', d.paid_minor,
        'paid_method', d.paid_method
    ) ORDER BY s.starts_at), '[]'::jsonb)
    INTO v_rows
    FROM app.bookings b
    JOIN app.tour_booking_details d ON d.booking_id = b.id
    JOIN app.slots s ON s.id = b.slot_id
    JOIN app.experiences x ON x.id = b.experience_id
    WHERE b.organization_id = g.organization_id
      AND b.status IN ('confirmed', 'completed')
      AND s.starts_at >= v_from AND s.starts_at < v_to;

    RETURN jsonb_build_object(
        'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
        'currency', 'USD',
        'fee_percent', v_fee,
        'rows', v_rows,
        'bookings', jsonb_array_length(v_rows),
        'guests', (SELECT coalesce(sum((r->>'party_size')::integer), 0) FROM jsonb_array_elements(v_rows) r),
        'expected_minor', (SELECT coalesce(sum((r->>'expected_minor')::bigint), 0) FROM jsonb_array_elements(v_rows) r
                           WHERE NOT (r->>'no_show')::boolean),
        'recorded_minor', (SELECT coalesce(sum((r->>'paid_minor')::bigint), 0) FROM jsonb_array_elements(v_rows) r),
        'fee_minor', (SELECT round(coalesce(sum((r->>'paid_minor')::bigint), 0) * v_fee / 100)
                      FROM jsonb_array_elements(v_rows) r),
        'net_minor', (SELECT coalesce(sum((r->>'paid_minor')::bigint), 0)
                             - round(coalesce(sum((r->>'paid_minor')::bigint), 0) * v_fee / 100)
                      FROM jsonb_array_elements(v_rows) r),
        'upcoming_minor', (
            SELECT coalesce(sum(d.total_minor), 0)
            FROM app.bookings b JOIN app.tour_booking_details d ON d.booking_id = b.id
            JOIN app.slots s ON s.id = b.slot_id
            WHERE b.organization_id = g.organization_id AND b.status = 'confirmed' AND s.starts_at > now()
        ),
        'upcoming_bookings', (
            SELECT count(*)
            FROM app.bookings b JOIN app.tour_booking_details d ON d.booking_id = b.id
            JOIN app.slots s ON s.id = b.slot_id
            WHERE b.organization_id = g.organization_id AND b.status = 'confirmed' AND s.starts_at > now()
        )
    );
END;
$$;

-- ---- Insights --------------------------------------------------------------------------------------
-- Per tour over the last N days: requests, confirmed, declined, lapsed, cancelled by either
-- side, seats filled on runs that went ahead, and how fast the guide answers requests.
CREATE OR REPLACE FUNCTION app.guide_insights(p_user uuid, p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 7), 365));
BEGIN
    RETURN jsonb_build_object(
        'days', least(greatest(p_days, 7), 365),
        'tours', coalesce((
            SELECT jsonb_agg(row ORDER BY row->>'title')
            FROM (
                SELECT jsonb_build_object(
                    'id', x.id,
                    'title', x.title,
                    'bookings', count(b.id),
                    'requests', count(b.id) FILTER (WHERE b.mode = 'request'),
                    'confirmed', count(b.id) FILTER (WHERE b.status IN ('confirmed', 'completed')
                                                    OR d.rescheduled_to IS NOT NULL),
                    'declined', count(b.id) FILTER (WHERE b.status = 'rejected'),
                    'lapsed', count(b.id) FILTER (WHERE b.status = 'expired'),
                    'cancelled_by_guide', count(b.id) FILTER (WHERE d.cancelled_by = 'guide'),
                    'cancelled_by_traveller', count(b.id) FILTER (WHERE d.cancelled_by = 'traveller'),
                    'guests', coalesce(sum(b.party_size) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0),
                    'occupancy', (
                        SELECT round(100.0 * sum(s.reserved) / nullif(sum(s.capacity), 0))
                        FROM app.slots s
                        WHERE s.experience_id = x.id AND s.starts_at >= v_since AND s.starts_at < now()
                          AND s.reserved > 0
                    )
                ) AS row
                FROM app.experiences x
                LEFT JOIN app.bookings b ON b.experience_id = x.id AND b.created_at >= v_since
                LEFT JOIN app.tour_booking_details d ON d.booking_id = b.id
                WHERE x.organization_id = g.organization_id AND x.status <> 'archived'
                GROUP BY x.id, x.title
            ) t
        ), '[]'::jsonb),
        'response', (
            SELECT jsonb_build_object(
                'answered', count(*),
                'within_24h', count(*) FILTER (WHERE a.answered_at - b.created_at <= interval '24 hours'),
                'median_minutes', round(extract(epoch FROM percentile_cont(0.5) WITHIN GROUP (
                    ORDER BY a.answered_at - b.created_at)) / 60)
            )
            FROM app.bookings b
            JOIN LATERAL (
                SELECT min(e.created_at) AS answered_at FROM app.booking_events e
                WHERE e.booking_id = b.id AND e.to_status IN ('confirmed', 'rejected') AND e.from_status = 'pending'
            ) a ON a.answered_at IS NOT NULL
            WHERE b.organization_id = g.organization_id AND b.mode = 'request' AND b.created_at >= v_since
        )
    );
END;
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.no_show', 'en', 'traveller', 'Your guide marked you as a no-show',
     'If you were there, reply from your booking and we will look into it: {deep_link}'),
    ('guide.no_show', 'ar', 'traveller', 'سجّلك المرشد غائباً',
     'إن كنت حاضراً، ردّ من صفحة حجزك وسنتحقق من الأمر: {deep_link}'),
    ('guide.no_show', 'fr', 'traveller', 'Votre guide vous a indiqué absent',
     'Si vous étiez là, répondez depuis votre réservation et nous vérifierons : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

REVOKE ALL ON FUNCTION
    app.guide_list_external_calendars(uuid),
    app.guide_add_external_calendar(uuid, text, text),
    app.guide_remove_external_calendar(uuid, uuid),
    app.guide_calendars_to_sync(uuid, integer),
    app.guide_replace_external_blocks(uuid, jsonb, text),
    app.guide_new_calendar_feed(uuid, text),
    app.guide_revoke_calendar_feed(uuid),
    app.guide_calendar_feed_status(uuid),
    app.guide_calendar_feed(text),
    app.guide_calendar(uuid, date, date),
    app.guide_owned_booking(uuid, uuid),
    app.guide_check_in(uuid, uuid, text),
    app.guide_record_payment(uuid, uuid, bigint, text),
    app.guide_earnings(uuid, date),
    app.guide_insights(uuid, integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.guide_external_calendar_json(app.guide_external_calendars),
    app.guide_list_external_calendars(uuid),
    app.guide_add_external_calendar(uuid, text, text),
    app.guide_remove_external_calendar(uuid, uuid),
    app.guide_calendars_to_sync(uuid, integer),
    app.guide_replace_external_blocks(uuid, jsonb, text),
    app.guide_new_calendar_feed(uuid, text),
    app.guide_revoke_calendar_feed(uuid),
    app.guide_calendar_feed_status(uuid),
    app.guide_calendar_feed(text),
    app.guide_calendar(uuid, date, date),
    app.guide_check_in(uuid, uuid, text),
    app.guide_record_payment(uuid, uuid, bigint, text),
    app.guide_tour_booking(uuid, uuid),
    app.guide_fee_percent(uuid),
    app.guide_earnings(uuid, date),
    app.guide_insights(uuid, integer)
TO mshwar_backend;
