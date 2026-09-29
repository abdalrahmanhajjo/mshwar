-- 064_after_booking.sql
-- Guide plan, step 5: after booking.
--
-- A traveller sees their tour bookings in one place, adds one to their calendar, gets a
-- reminder the day before and two hours before, taps "I'm here" at the meeting point, and
-- can message the guide. The guide gets tomorrow's manifest, a nudge before a request
-- lapses, and a weather warning two days before an outdoor run.
--
-- Messaging keeps both sides safe: until the two have a confirmed booking together, phone
-- numbers, e-mail addresses and links are replaced before the message is stored, so
-- nobody's contact details leave the platform early. Only the masked text is kept.

-- ---- A traveller's tour bookings ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.traveller_tour_bookings(p_user uuid, p_when text DEFAULT 'upcoming')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.tour_booking_json(b.id) ORDER BY
        CASE WHEN p_when = 'past' THEN NULL ELSE s.starts_at END ASC,
        CASE WHEN p_when = 'past' THEN s.starts_at END DESC
    ), '[]'::jsonb)
    FROM app.bookings b
    JOIN app.tour_booking_details d ON d.booking_id = b.id
    JOIN app.slots s ON s.id = b.slot_id
    WHERE b.customer_id = p_user
      -- A booking that moved is shown once, at its new time.
      AND d.rescheduled_to IS NULL
      AND CASE
          WHEN p_when = 'past' THEN s.ends_at <= now() OR b.status NOT IN ('pending', 'confirmed')
          ELSE s.ends_at > now() AND b.status IN ('pending', 'confirmed')
      END;
$$;

-- What the booking page needs on the day: the meeting point on the map, and the guide's
-- phone once the booking is confirmed (never before).
CREATE OR REPLACE FUNCTION app.tour_booking_contact(p_booking uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'meeting_lat', ST_Y(v.location::geometry),
        'meeting_lng', ST_X(v.location::geometry),
        'guide_phone', CASE WHEN b.status = 'confirmed' AND s.ends_at > now() - interval '7 days'
                            THEN NULLIF(g.phone, '') END,
        'arrived_at', (SELECT max(e.created_at) FROM app.booking_events e
                       WHERE e.booking_id = b.id AND e.reason = 'Traveller is at the meeting point')
    )
    FROM app.bookings b
    JOIN app.slots s ON s.id = b.slot_id
    JOIN app.experiences x ON x.id = b.experience_id
    JOIN app.venues v ON v.id = x.venue_id
    JOIN app.guide_profiles g ON g.organization_id = b.organization_id
    WHERE b.id = p_booking;
$$;

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
    RETURN app.tour_booking_json(p_booking) || app.tour_booking_contact(p_booking);
END;
$$;

-- "I'm here": from half an hour before the start to an hour after, the traveller tells the
-- guide they have arrived. Recorded once.
CREATE OR REPLACE FUNCTION app.tour_traveller_arrived(p_user uuid, p_booking uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b app.bookings;
    s app.slots;
    v_guide uuid;
BEGIN
    SELECT * INTO b FROM app.bookings WHERE id = p_booking AND customer_id = p_user;
    IF b.id IS NULL OR NOT EXISTS (SELECT 1 FROM app.tour_booking_details WHERE booking_id = p_booking) THEN
        RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO s FROM app.slots WHERE id = b.slot_id;
    IF b.status <> 'confirmed' THEN
        RAISE EXCEPTION 'only a confirmed booking can check in' USING ERRCODE = '22023';
    END IF;
    IF now() < s.starts_at - interval '30 minutes' OR now() > s.starts_at + interval '1 hour' THEN
        RAISE EXCEPTION 'you can say you are here from 30 minutes before the start' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM app.booking_events e WHERE e.booking_id = p_booking AND e.reason = 'Traveller is at the meeting point'
    ) THEN
        INSERT INTO app.booking_events (booking_id, actor_id, from_status, to_status, reason)
        VALUES (p_booking, p_user, b.status, b.status, 'Traveller is at the meeting point');
        SELECT user_id INTO v_guide FROM app.guide_profiles WHERE organization_id = b.organization_id;
        PERFORM app.emit_notification_event(
            'guide.traveller_arrived', p_booking, v_guide, NULL,
            jsonb_build_object('booking_id', p_booking, 'status', 'arrived', 'path', '/guide/bookings/' || p_booking)
        );
    END IF;
    RETURN app.traveller_tour_booking(p_user, p_booking);
END;
$$;

-- ---- Reminders ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.tour_reminders (
    booking_id uuid NOT NULL REFERENCES app.bookings(id),
    kind text NOT NULL CHECK (kind IN ('day_before', 'two_hours', 'request_expiring')),
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (booking_id, kind)
);
ALTER TABLE app.tour_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_reminders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_reminders_none ON app.tour_reminders;
-- Only the job functions (SECURITY DEFINER) touch this table.
CREATE POLICY tour_reminders_none ON app.tour_reminders FOR SELECT TO mshwar_backend USING (false);

CREATE TABLE IF NOT EXISTS app.tour_manifests_sent (
    slot_id uuid PRIMARY KEY REFERENCES app.slots(id),
    sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.tour_manifests_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_manifests_sent FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_manifests_none ON app.tour_manifests_sent;
CREATE POLICY tour_manifests_none ON app.tour_manifests_sent FOR SELECT TO mshwar_backend USING (false);

-- Every 15 minutes. Each reminder is sent once, so the job is safe to repeat.
CREATE OR REPLACE FUNCTION app.tour_send_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    r record;
    v_day integer := 0;
    v_soon integer := 0;
    v_expiring integer := 0;
    v_manifests integer := 0;
BEGIN
    -- The day before: when to be where, and what to bring.
    FOR r IN
        SELECT b.id, b.customer_id, x.title, t.bring
        FROM app.bookings b
        JOIN app.tour_booking_details d ON d.booking_id = b.id
        JOIN app.slots s ON s.id = b.slot_id
        JOIN app.experiences x ON x.id = b.experience_id
        LEFT JOIN app.guide_tours t ON t.experience_id = x.id
        WHERE b.status = 'confirmed'
          AND s.starts_at > now() + interval '2 hours'
          AND s.starts_at <= now() + interval '24 hours'
          AND NOT EXISTS (SELECT 1 FROM app.tour_reminders m WHERE m.booking_id = b.id AND m.kind = 'day_before')
    LOOP
        INSERT INTO app.tour_reminders (booking_id, kind) VALUES (r.id, 'day_before');
        PERFORM app.emit_notification_event(
            'guide.tour_tomorrow', r.id, r.customer_id, NULL,
            jsonb_build_object('booking_id', r.id, 'status', r.title,
                               'body', coalesce(NULLIF(r.bring, ''), '-'), 'path', '/tour-bookings/' || r.id)
        );
        v_day := v_day + 1;
    END LOOP;

    -- Two hours before: the meeting point and the way there.
    FOR r IN
        SELECT b.id, b.customer_id, t.meeting_point
        FROM app.bookings b
        JOIN app.tour_booking_details d ON d.booking_id = b.id
        JOIN app.slots s ON s.id = b.slot_id
        LEFT JOIN app.guide_tours t ON t.experience_id = b.experience_id
        WHERE b.status = 'confirmed'
          AND s.starts_at > now()
          AND s.starts_at <= now() + interval '2 hours'
          AND NOT EXISTS (SELECT 1 FROM app.tour_reminders m WHERE m.booking_id = b.id AND m.kind = 'two_hours')
    LOOP
        INSERT INTO app.tour_reminders (booking_id, kind) VALUES (r.id, 'two_hours');
        PERFORM app.emit_notification_event(
            'guide.tour_soon', r.id, r.customer_id, NULL,
            jsonb_build_object('booking_id', r.id, 'status', coalesce(NULLIF(r.meeting_point, ''), '-'),
                               'path', '/tour-bookings/' || r.id)
        );
        v_soon := v_soon + 1;
    END LOOP;

    -- A request four hours from lapsing: one nudge to the guide.
    FOR r IN
        SELECT b.id, g.user_id AS guide_user
        FROM app.bookings b
        JOIN app.tour_booking_details d ON d.booking_id = b.id
        JOIN app.guide_profiles g ON g.organization_id = b.organization_id
        WHERE b.status = 'pending'
          AND b.response_due_at > now()
          AND b.response_due_at <= now() + interval '4 hours'
          AND NOT EXISTS (SELECT 1 FROM app.tour_reminders m WHERE m.booking_id = b.id AND m.kind = 'request_expiring')
    LOOP
        INSERT INTO app.tour_reminders (booking_id, kind) VALUES (r.id, 'request_expiring');
        PERFORM app.emit_notification_event(
            'guide.request_expiring', r.id, r.guide_user, NULL,
            jsonb_build_object('booking_id', r.id, 'status', 'pending', 'path', '/guide/bookings/' || r.id)
        );
        v_expiring := v_expiring + 1;
    END LOOP;

    -- Tomorrow's manifest for the guide: one note per run, with who is coming.
    FOR r IN
        SELECT s.id AS slot_id, g.user_id AS guide_user, x.title,
               sum(b.party_size) AS people, count(b.id) AS bookings
        FROM app.slots s
        JOIN app.experiences x ON x.id = s.experience_id
        JOIN app.guide_profiles g ON g.organization_id = x.organization_id
        JOIN app.bookings b ON b.slot_id = s.id AND b.status = 'confirmed'
        WHERE s.starts_at > now() + interval '2 hours'
          AND s.starts_at <= now() + interval '24 hours'
          AND NOT EXISTS (SELECT 1 FROM app.tour_manifests_sent m WHERE m.slot_id = s.id)
        GROUP BY s.id, g.user_id, x.title
    LOOP
        INSERT INTO app.tour_manifests_sent (slot_id) VALUES (r.slot_id);
        PERFORM app.emit_notification_event(
            'guide.manifest', r.slot_id, r.guide_user, NULL,
            jsonb_build_object('status', r.title, 'body', r.people::text, 'path', '/guide/calendar')
        );
        v_manifests := v_manifests + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'day_before', v_day, 'two_hours', v_soon, 'request_expiring', v_expiring, 'manifests', v_manifests
    );
END;
$$;

-- ---- Weather warnings -----------------------------------------------------------------------------
-- The forecast is fetched by the API (Open-Meteo); the database says which runs to check
-- and records a warning once per run.
CREATE TABLE IF NOT EXISTS app.tour_weather_alerts (
    slot_id uuid PRIMARY KEY REFERENCES app.slots(id),
    reason text NOT NULL CHECK (reason IN ('rain', 'heat', 'wind')),
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.tour_weather_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_weather_alerts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_weather_org ON app.tour_weather_alerts;
CREATE POLICY tour_weather_org ON app.tour_weather_alerts FOR SELECT TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.slots s JOIN app.experiences e ON e.id = s.experience_id
        WHERE s.id = tour_weather_alerts.slot_id AND e.organization_id = app.current_organization_id()
    ));

-- Booked outdoor runs 36 to 60 hours out that have not been warned about.
CREATE OR REPLACE FUNCTION app.tour_weather_candidates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slot_id', s.id,
        'starts_at', s.starts_at,
        'lat', ST_Y(v.location::geometry),
        'lng', ST_X(v.location::geometry)
    ) ORDER BY s.starts_at), '[]'::jsonb)
    FROM app.slots s
    JOIN app.experiences x ON x.id = s.experience_id AND x.setting IN ('outdoor', 'mixed')
    JOIN app.venues v ON v.id = x.venue_id
    JOIN app.guide_profiles g ON g.organization_id = x.organization_id AND g.status = 'approved'
    WHERE s.starts_at BETWEEN now() + interval '36 hours' AND now() + interval '60 hours'
      AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed')
      AND NOT EXISTS (SELECT 1 FROM app.tour_weather_alerts w WHERE w.slot_id = s.id);
$$;

CREATE OR REPLACE FUNCTION app.tour_record_weather_alert(p_slot uuid, p_reason text, p_detail jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_guide uuid;
    v_title text;
    v_rows integer;
BEGIN
    IF p_reason NOT IN ('rain', 'heat', 'wind') THEN
        RAISE EXCEPTION 'unknown weather reason' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.tour_weather_alerts (slot_id, reason, detail)
    VALUES (p_slot, p_reason, coalesce(p_detail, '{}'::jsonb))
    ON CONFLICT (slot_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RETURN false;
    END IF;
    SELECT g.user_id, x.title INTO v_guide, v_title
    FROM app.slots s
    JOIN app.experiences x ON x.id = s.experience_id
    JOIN app.guide_profiles g ON g.organization_id = x.organization_id
    WHERE s.id = p_slot;
    PERFORM app.emit_notification_event(
        'guide.weather_alert', p_slot, v_guide, NULL,
        jsonb_build_object('status', v_title, 'body', p_reason, 'path', '/guide/calendar')
    );
    RETURN true;
END;
$$;

-- ---- Messaging -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    traveller_id uuid NOT NULL REFERENCES app.users(id),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_message_at timestamptz NOT NULL DEFAULT now(),
    blocked_by uuid REFERENCES app.users(id),
    blocked_at timestamptz,
    reported_at timestamptz,
    UNIQUE (traveller_id, guide_profile_id)
);
CREATE INDEX IF NOT EXISTS guide_conversations_guide_idx ON app.guide_conversations (guide_profile_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS app.guide_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES app.guide_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES app.users(id),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    masked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz
);
CREATE INDEX IF NOT EXISTS guide_messages_conversation_idx ON app.guide_messages (conversation_id, created_at);

ALTER TABLE app.guide_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE app.guide_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_conversation_parties ON app.guide_conversations;
CREATE POLICY guide_conversation_parties ON app.guide_conversations FOR SELECT TO mshwar_backend
    USING (traveller_id = app.current_user_id() OR EXISTS (
        SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_conversations.guide_profile_id AND g.user_id = app.current_user_id()
    ));
DROP POLICY IF EXISTS guide_message_parties ON app.guide_messages;
CREATE POLICY guide_message_parties ON app.guide_messages FOR SELECT TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.guide_conversations c
        JOIN app.guide_profiles g ON g.id = c.guide_profile_id
        WHERE c.id = guide_messages.conversation_id
          AND (c.traveller_id = app.current_user_id() OR g.user_id = app.current_user_id())
    ));
GRANT SELECT ON app.guide_conversations, app.guide_messages TO mshwar_backend;

-- Replace phone numbers, e-mail addresses and links. Deliberately broad: a missed number
-- is worse than a masked date, and the guide can share anything once the booking is confirmed.
CREATE OR REPLACE FUNCTION app.mask_contact_details(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(p_text,
                    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[shared after booking]', 'g'),
                '(https?://|www\.)\S+', '[shared after booking]', 'gi'),
            '\m[A-Za-z0-9-]+\.(com|net|org|lb|me|io|co|app|info)\M\S*', '[shared after booking]', 'gi'),
        '\+?\d[\d\s().-]{6,}\d', '[shared after booking]', 'g'
    );
$$;

CREATE OR REPLACE FUNCTION app.conversation_confirmed(p_conversation uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM app.guide_conversations c
        JOIN app.guide_profiles g ON g.id = c.guide_profile_id
        JOIN app.bookings b ON b.customer_id = c.traveller_id AND b.organization_id = g.organization_id
        JOIN app.slots s ON s.id = b.slot_id
        WHERE c.id = p_conversation AND b.status IN ('confirmed', 'completed')
          AND s.ends_at > now() - interval '7 days'
    );
$$;

CREATE OR REPLACE FUNCTION app.conversation_json(p_user uuid, p_conversation uuid, p_messages boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', c.id,
        'role', CASE WHEN c.traveller_id = p_user THEN 'traveller' ELSE 'guide' END,
        'guide', jsonb_build_object('slug', g.slug, 'display_name', g.display_name),
        'traveller', jsonb_build_object('display_name', split_part(u.display_name, ' ', 1)),
        'last_message_at', c.last_message_at,
        'blocked', c.blocked_at IS NOT NULL,
        'contact_open', app.conversation_confirmed(c.id),
        'unread', (SELECT count(*) FROM app.guide_messages m
                   WHERE m.conversation_id = c.id AND m.sender_id <> p_user AND m.read_at IS NULL),
        'last', (SELECT left(m.body, 140) FROM app.guide_messages m
                 WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
        'messages', CASE WHEN p_messages THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id, 'mine', m.sender_id = p_user, 'body', m.body, 'masked', m.masked,
                'created_at', m.created_at, 'read', m.read_at IS NOT NULL
            ) ORDER BY m.created_at)
            FROM (SELECT * FROM app.guide_messages m WHERE m.conversation_id = c.id
                  ORDER BY m.created_at DESC LIMIT 200) m
        ), '[]'::jsonb) END
    )
    FROM app.guide_conversations c
    JOIN app.guide_profiles g ON g.id = c.guide_profile_id
    JOIN app.users u ON u.id = c.traveller_id
    WHERE c.id = p_conversation;
$$;

CREATE OR REPLACE FUNCTION app.conversation_for(p_user uuid, p_conversation uuid)
RETURNS app.guide_conversations
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    c app.guide_conversations;
BEGIN
    SELECT c0.* INTO c FROM app.guide_conversations c0
    JOIN app.guide_profiles g ON g.id = c0.guide_profile_id
    WHERE c0.id = p_conversation AND (c0.traveller_id = p_user OR g.user_id = p_user);
    IF c.id IS NULL THEN
        RAISE EXCEPTION 'conversation not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION app.send_guide_message(p_user uuid, p_conversation uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    c app.guide_conversations := app.conversation_for(p_user, p_conversation);
    v_body text := btrim(coalesce(p_body, ''));
    v_stored text;
    v_other uuid;
    v_first_unread boolean;
    v_path text;
    v_id uuid;
BEGIN
    IF length(v_body) < 1 OR length(v_body) > 2000 THEN
        RAISE EXCEPTION 'write between 1 and 2000 characters' USING ERRCODE = '22023';
    END IF;
    IF c.blocked_at IS NOT NULL THEN
        RAISE EXCEPTION 'this conversation is closed' USING ERRCODE = '22023';
    END IF;
    -- Twenty messages in ten minutes is plenty for anyone.
    IF (SELECT count(*) FROM app.guide_messages
        WHERE sender_id = p_user AND created_at > now() - interval '10 minutes') >= 20 THEN
        RAISE EXCEPTION 'too many messages: wait a few minutes' USING ERRCODE = '53400';
    END IF;
    v_stored := CASE WHEN app.conversation_confirmed(c.id) THEN v_body ELSE app.mask_contact_details(v_body) END;
    INSERT INTO app.guide_messages (conversation_id, sender_id, body, masked)
    VALUES (c.id, p_user, v_stored, v_stored <> v_body)
    RETURNING id INTO v_id;
    UPDATE app.guide_conversations SET last_message_at = now() WHERE id = c.id;

    IF c.traveller_id = p_user THEN
        SELECT user_id INTO v_other FROM app.guide_profiles WHERE id = c.guide_profile_id;
    ELSE
        v_other := c.traveller_id;
    END IF;
    -- One notice per burst: only when this is the first message the other side has not read.
    SELECT NOT EXISTS (
        SELECT 1 FROM app.guide_messages m
        WHERE m.conversation_id = c.id AND m.sender_id = p_user AND m.read_at IS NULL AND m.id <> v_id
    ) INTO v_first_unread;
    IF v_first_unread THEN
        v_path := '/messages/' || c.id;
        PERFORM app.emit_notification_event(
            'guide.new_message', v_id, v_other, NULL,
            jsonb_build_object('status', 'new', 'body', left(v_stored, 140), 'path', v_path)
        );
    END IF;
    RETURN app.conversation_json(p_user, c.id, true);
END;
$$;

-- A traveller starts (or reopens) the one conversation they have with a guide.
CREATE OR REPLACE FUNCTION app.start_guide_conversation(p_user uuid, p_guide_slug text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    v_id uuid;
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE slug = p_guide_slug AND status = 'approved';
    IF g.id IS NULL THEN
        RAISE EXCEPTION 'guide not found' USING ERRCODE = 'P0002';
    END IF;
    IF g.user_id = p_user THEN
        RAISE EXCEPTION 'you cannot message yourself' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.guide_conversations (traveller_id, guide_profile_id)
    VALUES (p_user, g.id)
    ON CONFLICT (traveller_id, guide_profile_id) DO UPDATE SET last_message_at = app.guide_conversations.last_message_at
    RETURNING id INTO v_id;
    RETURN app.send_guide_message(p_user, v_id, p_body);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_guide_conversations(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(app.conversation_json(p_user, c.id, false) ORDER BY c.last_message_at DESC), '[]'::jsonb)
    FROM app.guide_conversations c
    JOIN app.guide_profiles g ON g.id = c.guide_profile_id
    WHERE c.traveller_id = p_user OR g.user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION app.read_guide_conversation(p_user uuid, p_conversation uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    c app.guide_conversations := app.conversation_for(p_user, p_conversation);
BEGIN
    UPDATE app.guide_messages SET read_at = now()
    WHERE conversation_id = c.id AND sender_id <> p_user AND read_at IS NULL;
    RETURN app.conversation_json(p_user, c.id, true);
END;
$$;

-- Block closes the conversation for both; a report also opens a support case with the thread.
CREATE OR REPLACE FUNCTION app.close_guide_conversation(p_user uuid, p_conversation uuid, p_report boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    c app.guide_conversations := app.conversation_for(p_user, p_conversation);
    v_org uuid;
BEGIN
    UPDATE app.guide_conversations
    SET blocked_by = coalesce(blocked_by, p_user),
        blocked_at = coalesce(blocked_at, now()),
        reported_at = CASE WHEN p_report THEN coalesce(reported_at, now()) ELSE reported_at END
    WHERE id = c.id;
    IF p_report AND c.reported_at IS NULL THEN
        SELECT organization_id INTO v_org FROM app.guide_profiles WHERE id = c.guide_profile_id;
        INSERT INTO app.support_cases (reporter_id, reason, evidence, organization_id)
        VALUES (
            p_user, 'guide_conduct',
            jsonb_build_array(
                jsonb_build_object('kind', 'statement', 'text', left(btrim(coalesce(p_reason, '')), 2000),
                                   'conversation_id', c.id),
                jsonb_build_object('kind', 'messages', 'messages', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'from', CASE WHEN m.sender_id = c.traveller_id THEN 'traveller' ELSE 'guide' END,
                        'body', m.body, 'at', m.created_at
                    ) ORDER BY m.created_at), '[]'::jsonb)
                    FROM (SELECT * FROM app.guide_messages m WHERE m.conversation_id = c.id
                          ORDER BY m.created_at DESC LIMIT 50) m
                ))
            ),
            v_org
        );
    END IF;
    RETURN app.conversation_json(p_user, c.id, true);
END;
$$;

-- ---- Deep links: tour bookings open their own pages -------------------------------------------------
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
            SELECT 1 FROM app.tour_booking_details d
            WHERE d.booking_id::text = coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id')
        ) THEN
            '/guide/bookings/' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event LIKE 'business.%' AND EXISTS (
            SELECT 1 FROM app.bookings b JOIN app.guide_profiles g ON g.organization_id = b.organization_id
            WHERE b.id::text = coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id')
        ) THEN
            '/guide/requests'
        WHEN p_event LIKE 'business.%' THEN
            '/business/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event = 'itinerary.material_change' THEN
            '/trips?highlight=' || coalesce(p_payload->>'trip_id', p_payload->>'aggregate_id', '')
        WHEN p_event LIKE 'booking.%' AND EXISTS (
            SELECT 1 FROM app.tour_booking_details d
            WHERE d.booking_id::text = coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id')
        ) THEN
            '/tour-bookings/' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        ELSE
            '/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
    END
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.tour_tomorrow', 'en', 'traveller', 'Your tour is tomorrow: {status}',
     'What to bring: {body}. Your booking, the meeting point and the way there: {deep_link}'),
    ('guide.tour_tomorrow', 'ar', 'traveller', 'جولتك غداً: {status}',
     'ما يجب إحضاره: {body}. حجزك ونقطة اللقاء والطريق إليها: {deep_link}'),
    ('guide.tour_tomorrow', 'fr', 'traveller', 'Votre visite est demain : {status}',
     'À apporter : {body}. Votre réservation, le point de rendez-vous et l’itinéraire : {deep_link}'),
    ('guide.tour_soon', 'en', 'traveller', 'Your tour starts in two hours',
     'Meet your guide at: {status}. Directions: {deep_link}'),
    ('guide.tour_soon', 'ar', 'traveller', 'تبدأ جولتك بعد ساعتين',
     'التقِ بالمرشد في: {status}. الطريق: {deep_link}'),
    ('guide.tour_soon', 'fr', 'traveller', 'Votre visite commence dans deux heures',
     'Rendez-vous avec votre guide : {status}. Itinéraire : {deep_link}'),
    ('guide.request_expiring', 'en', 'traveller', 'A request lapses in 4 hours',
     'Accept or decline it before it lapses, so the traveller can plan: {deep_link}'),
    ('guide.request_expiring', 'ar', 'traveller', 'ينتهي طلب خلال 4 ساعات',
     'اقبله أو ارفضه قبل أن ينتهي، ليتمكّن المسافر من التخطيط: {deep_link}'),
    ('guide.request_expiring', 'fr', 'traveller', 'Une demande expire dans 4 heures',
     'Acceptez-la ou refusez-la avant qu’elle expire, pour que le voyageur puisse s’organiser : {deep_link}'),
    ('guide.manifest', 'en', 'traveller', 'Tomorrow: {status}',
     '{body} people are booked. See the run: {deep_link}'),
    ('guide.manifest', 'ar', 'traveller', 'غداً: {status}',
     'عدد الأشخاص المحجوزين: {body}. اطّلع على الجولة: {deep_link}'),
    ('guide.manifest', 'fr', 'traveller', 'Demain : {status}',
     '{body} personnes réservées. Voir la sortie : {deep_link}'),
    ('guide.weather_alert', 'en', 'traveller', 'Weather warning for {status}',
     'The forecast shows {body} for your outdoor run in two days. Move it or keep it: {deep_link}'),
    ('guide.weather_alert', 'ar', 'traveller', 'تنبيه طقس لـ{status}',
     'تشير التوقعات إلى {body} لجولتك في الهواء الطلق بعد يومين. انقلها أو أبقِها: {deep_link}'),
    ('guide.weather_alert', 'fr', 'traveller', 'Alerte météo pour {status}',
     'Les prévisions annoncent {body} pour votre sortie en plein air dans deux jours. Déplacez-la ou gardez-la : {deep_link}'),
    ('guide.new_message', 'en', 'traveller', 'New message',
     '"{body}" Reply: {deep_link}'),
    ('guide.new_message', 'ar', 'traveller', 'رسالة جديدة',
     '«{body}» ردّ: {deep_link}'),
    ('guide.new_message', 'fr', 'traveller', 'Nouveau message',
     '« {body} » Répondre : {deep_link}'),
    ('guide.traveller_arrived', 'en', 'traveller', 'Your traveller is at the meeting point',
     'They just told us they have arrived: {deep_link}'),
    ('guide.traveller_arrived', 'ar', 'traveller', 'المسافر عند نقطة اللقاء',
     'أبلغنا للتو أنه وصل: {deep_link}'),
    ('guide.traveller_arrived', 'fr', 'traveller', 'Votre voyageur est au point de rendez-vous',
     'Il vient de nous dire qu’il est arrivé : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

REVOKE ALL ON FUNCTION
    app.traveller_tour_bookings(uuid, text),
    app.tour_booking_contact(uuid),
    app.tour_traveller_arrived(uuid, uuid),
    app.tour_send_reminders(),
    app.tour_weather_candidates(),
    app.tour_record_weather_alert(uuid, text, jsonb),
    app.conversation_confirmed(uuid),
    app.conversation_json(uuid, uuid, boolean),
    app.conversation_for(uuid, uuid),
    app.send_guide_message(uuid, uuid, text),
    app.start_guide_conversation(uuid, text, text),
    app.list_guide_conversations(uuid),
    app.read_guide_conversation(uuid, uuid),
    app.close_guide_conversation(uuid, uuid, boolean, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.traveller_tour_bookings(uuid, text),
    app.tour_booking_contact(uuid),
    app.traveller_tour_booking(uuid, uuid),
    app.tour_traveller_arrived(uuid, uuid),
    app.tour_send_reminders(),
    app.tour_weather_candidates(),
    app.tour_record_weather_alert(uuid, text, jsonb),
    app.mask_contact_details(text),
    app.conversation_confirmed(uuid),
    app.conversation_json(uuid, uuid, boolean),
    app.send_guide_message(uuid, uuid, text),
    app.start_guide_conversation(uuid, text, text),
    app.list_guide_conversations(uuid),
    app.read_guide_conversation(uuid, uuid),
    app.close_guide_conversation(uuid, uuid, boolean, text)
TO mshwar_backend;
