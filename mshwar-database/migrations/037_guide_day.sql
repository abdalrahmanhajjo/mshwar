-- 037_guide_day.sql
-- G5 of the supply-side pivot: running the day.
--
-- A guide's day is either a tour start (one slot, several bookings) or a hired
-- day (one engagement). Both get the same day sheet - stops, times, travel legs,
-- the group, their phones once confirmed, the meeting point and what the guide
-- needs to know about food, access and children - and the same two state
-- changes: start and complete.
--
-- Completing the day opens reviews in both directions: the traveller reviews the
-- guide, the guide reviews the traveller. Neither side sees the other's review
-- until both have written theirs or the fourteen-day window closes, so nobody
-- writes in reply.

CREATE TABLE IF NOT EXISTS app.guide_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id),
    slot_id uuid UNIQUE REFERENCES app.slots(id),
    engagement_id uuid UNIQUE REFERENCES app.guide_engagements(id),
    state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'started', 'completed')),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(slot_id, engagement_id) = 1),
    CHECK (state <> 'completed' OR completed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS app.guide_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES app.guide_runs(id),
    direction text NOT NULL CHECK (direction IN ('traveller_to_guide', 'guide_to_traveller')),
    author_id uuid NOT NULL REFERENCES app.users(id),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id),
    traveller_id uuid NOT NULL REFERENCES app.users(id),
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, traveller_id, direction)
);
CREATE INDEX IF NOT EXISTS guide_reviews_guide_idx ON app.guide_reviews (guide_profile_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS guide_reviews_traveller_idx ON app.guide_reviews (traveller_id, direction, created_at DESC);

ALTER TABLE app.guide_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE app.guide_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_run_owner ON app.guide_runs;
CREATE POLICY guide_run_owner ON app.guide_runs FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_runs.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_runs.guide_profile_id AND g.user_id = app.current_user_id()));
DROP POLICY IF EXISTS guide_review_parties ON app.guide_reviews;
CREATE POLICY guide_review_parties ON app.guide_reviews FOR ALL TO mshwar_backend
    USING (author_id = app.current_user_id() OR traveller_id = app.current_user_id()
           OR EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_reviews.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (author_id = app.current_user_id());
GRANT SELECT, INSERT, UPDATE ON app.guide_runs, app.guide_reviews TO mshwar_backend;

DO $$ DECLARE n text; BEGIN
    FOREACH n IN ARRAY ARRAY['guide_runs', 'guide_reviews'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit ON app.%I', n);
        EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.audit_change()', n);
    END LOOP;
END $$;

-- ---- Which day is this --------------------------------------------------------------------
-- A day id is a slot id (a tour start) or an engagement id (a hired day). Either
-- way it must belong to the calling guide; the run row is made on first sight.
CREATE OR REPLACE FUNCTION app.guide_run_for(p_user uuid, p_id uuid)
RETURNS app.guide_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    r app.guide_runs;
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE user_id = p_user AND status IN ('approved', 'suspended');
    IF g.id IS NULL THEN
        RAISE EXCEPTION 'day not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO r FROM app.guide_runs WHERE (slot_id = p_id OR engagement_id = p_id) AND guide_profile_id = g.id;
    IF r.id IS NOT NULL THEN
        RETURN r;
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.slots s JOIN app.experiences e ON e.id = s.experience_id
        WHERE s.id = p_id AND e.organization_id = g.organization_id
    ) THEN
        INSERT INTO app.guide_runs (guide_profile_id, slot_id) VALUES (g.id, p_id)
        ON CONFLICT (slot_id) DO NOTHING;
    ELSIF EXISTS (
        SELECT 1 FROM app.guide_engagements x
        WHERE x.id = p_id AND x.guide_profile_id = g.id AND x.state IN ('confirmed', 'completed')
    ) THEN
        INSERT INTO app.guide_runs (guide_profile_id, engagement_id) VALUES (g.id, p_id)
        ON CONFLICT (engagement_id) DO NOTHING;
    ELSE
        RAISE EXCEPTION 'day not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO r FROM app.guide_runs WHERE (slot_id = p_id OR engagement_id = p_id) AND guide_profile_id = g.id;
    RETURN r;
END;
$$;

-- ---- Released together ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_review_released(p_review uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM app.guide_reviews other
        WHERE other.run_id = r.run_id AND other.traveller_id = r.traveller_id AND other.direction <> r.direction
    ) OR (SELECT completed_at FROM app.guide_runs WHERE id = r.run_id) < now() - interval '14 days'
    FROM app.guide_reviews r WHERE r.id = p_review;
$$;

-- How other guides have found a traveller. Only released reviews count.
CREATE OR REPLACE FUNCTION app.traveller_reputation(p_traveller uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object('reviews', count(*), 'average', round(avg(r.rating)::numeric, 1))
    FROM app.guide_reviews r
    WHERE r.traveller_id = p_traveller AND r.direction = 'guide_to_traveller' AND r.hidden_at IS NULL
      AND app.guide_review_released(r.id);
$$;

-- ---- The day sheet -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_day_sheet(p_user uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    r app.guide_runs := app.guide_run_for(p_user, p_id);
    s app.slots;
    e app.experiences;
    t app.guide_tours;
    v app.venues;
    x app.guide_engagements;
    v_body jsonb;
BEGIN
    IF r.slot_id IS NOT NULL THEN
        SELECT * INTO s FROM app.slots WHERE id = r.slot_id;
        SELECT * INTO e FROM app.experiences WHERE id = s.experience_id;
        SELECT * INTO t FROM app.guide_tours WHERE experience_id = e.id;
        SELECT * INTO v FROM app.venues WHERE id = e.venue_id;
        v_body := jsonb_build_object(
            'kind', 'tour',
            'title', e.title,
            'local_date', (s.starts_at AT TIME ZONE 'Asia/Beirut')::date,
            'starts_at', s.starts_at,
            'ends_at', s.ends_at,
            'meeting', jsonb_build_object(
                'name', coalesce(NULLIF(t.meeting_point, ''), v.name),
                'address', v.address,
                'lat', ST_Y(v.location::geometry),
                'lng', ST_X(v.location::geometry)
            ),
            'stops', app.guide_tour_route(e.id),
            'legs', '[]'::jsonb,
            'bring', coalesce(t.bring, ''),
            'roster', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'booking_id', b.id,
                    'traveller_id', b.customer_id,
                    'name', u.display_name,
                    'party_size', b.party_size,
                    'status', b.status,
                    'note', b.traveller_note,
                    'notes', '{}'::jsonb,
                    'phone', CASE WHEN b.status IN ('confirmed', 'completed') THEN p.phone END,
                    'collect_minor', b.total_minor,
                    'currency', b.currency,
                    'reputation', app.traveller_reputation(b.customer_id)
                ) ORDER BY b.created_at)
                FROM app.bookings b
                JOIN app.users u ON u.id = b.customer_id
                LEFT JOIN app.user_private p ON p.user_id = b.customer_id
                WHERE b.slot_id = s.id AND b.status IN ('pending', 'confirmed', 'completed')
            ), '[]'::jsonb)
        );
    ELSE
        SELECT * INTO x FROM app.guide_engagements WHERE id = r.engagement_id;
        v_body := jsonb_build_object(
            'kind', 'hire',
            'title', (SELECT title FROM app.trips WHERE id = x.trip_id),
            'local_date', x.local_date,
            'starts_at', (SELECT min(starts_at) FROM app.trip_stops WHERE version_id = x.trip_version_id),
            'ends_at', (SELECT max(ends_at) FROM app.trip_stops WHERE version_id = x.trip_version_id),
            'meeting', (
                SELECT jsonb_build_object(
                    'name', 'Start of the day', 'address', '',
                    'lat', ST_Y(tv.start_location::geometry), 'lng', ST_X(tv.start_location::geometry)
                ) FROM app.trip_versions tv WHERE tv.id = x.trip_version_id
            ),
            'stops', app.engagement_itinerary(x.trip_version_id)->'stops',
            'legs', app.engagement_itinerary(x.trip_version_id)->'legs',
            'bring', '',
            'roster', jsonb_build_array(jsonb_build_object(
                'engagement_id', x.id,
                'traveller_id', x.traveller_id,
                'name', (SELECT display_name FROM app.users WHERE id = x.traveller_id),
                'party_size', x.party_size,
                'status', x.state,
                'note', x.message,
                'notes', x.party_notes,
                'phone', CASE WHEN x.state IN ('confirmed', 'completed') THEN NULLIF(x.contact_phone, '') END,
                'collect_minor', x.rate_minor,
                'currency', x.currency,
                'reputation', app.traveller_reputation(x.traveller_id)
            ))
        );
    END IF;
    RETURN v_body || jsonb_build_object(
        'id', p_id,
        'run', jsonb_build_object('id', r.id, 'state', r.state, 'started_at', r.started_at, 'completed_at', r.completed_at),
        'people', (SELECT coalesce(sum((row->>'party_size')::integer), 0)
                   FROM jsonb_array_elements(v_body->'roster') row WHERE row->>'status' <> 'pending'),
        'generated_at', now()
    );
END;
$$;

-- The guide's upcoming days, for the home screen and the sheet's navigation.
CREATE OR REPLACE FUNCTION app.guide_list_days(p_user uuid, p_days integer DEFAULT 14)
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
        SELECT jsonb_agg(d ORDER BY d->>'starts_at')
        FROM (
            SELECT jsonb_build_object(
                'id', s.id, 'kind', 'tour', 'title', e.title, 'starts_at', s.starts_at,
                'people', (SELECT coalesce(sum(b.party_size), 0) FROM app.bookings b
                           WHERE b.slot_id = s.id AND b.status IN ('confirmed', 'completed')),
                'state', coalesce((SELECT state FROM app.guide_runs WHERE slot_id = s.id), 'scheduled')
            ) AS d
            FROM app.slots s JOIN app.experiences e ON e.id = s.experience_id
            WHERE e.organization_id = g.organization_id
              AND s.ends_at > now() - interval '1 day'
              AND s.starts_at < now() + make_interval(days => least(greatest(p_days, 1), 60))
              AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status IN ('confirmed', 'completed'))
            UNION ALL
            SELECT jsonb_build_object(
                'id', x.id, 'kind', 'hire', 'title', t.title,
                'starts_at', (SELECT min(starts_at) FROM app.trip_stops WHERE version_id = x.trip_version_id),
                'people', x.party_size,
                'state', coalesce((SELECT state FROM app.guide_runs WHERE engagement_id = x.id), 'scheduled')
            )
            FROM app.guide_engagements x JOIN app.trips t ON t.id = x.trip_id
            WHERE x.guide_profile_id = g.id AND x.state IN ('confirmed', 'completed')
              AND x.local_date >= (now() AT TIME ZONE 'Asia/Beirut')::date - 1
              AND x.local_date < (now() AT TIME ZONE 'Asia/Beirut')::date + least(greatest(p_days, 1), 60)
        ) days
    ), '[]'::jsonb);
END;
$$;

-- ---- Start and complete --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_start_day(p_user uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    r app.guide_runs := app.guide_run_for(p_user, p_id);
    v_start timestamptz;
    v_end timestamptz;
BEGIN
    IF r.state <> 'scheduled' THEN
        RAISE EXCEPTION 'this day has already started' USING ERRCODE = '22023';
    END IF;
    IF r.slot_id IS NOT NULL THEN
        SELECT starts_at, ends_at INTO v_start, v_end FROM app.slots WHERE id = r.slot_id;
    ELSE
        SELECT min(s.starts_at), max(s.ends_at) INTO v_start, v_end
        FROM app.guide_engagements x JOIN app.trip_stops s ON s.version_id = x.trip_version_id
        WHERE x.id = r.engagement_id;
    END IF;
    IF now() < v_start - interval '2 hours' THEN
        RAISE EXCEPTION 'too early: you can start two hours before the first stop' USING ERRCODE = '22023';
    END IF;
    IF now() > v_end + interval '12 hours' THEN
        RAISE EXCEPTION 'this day is over: complete it instead' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_runs SET state = 'started', started_at = now() WHERE id = r.id;
    RETURN app.guide_day_sheet(p_user, p_id);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_complete_day(p_user uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    r app.guide_runs := app.guide_run_for(p_user, p_id);
    v_end timestamptz;
    v_start timestamptz;
    v_booking record;
    v_guide_user uuid := p_user;
BEGIN
    IF r.state = 'completed' THEN
        RAISE EXCEPTION 'this day is already complete' USING ERRCODE = '22023';
    END IF;
    IF r.slot_id IS NOT NULL THEN
        SELECT ends_at INTO v_end FROM app.slots WHERE id = r.slot_id;
        IF now() < v_end THEN
            RAISE EXCEPTION 'finish the tour once it has ended' USING ERRCODE = '22023';
        END IF;
        FOR v_booking IN SELECT id, customer_id FROM app.bookings WHERE slot_id = r.slot_id AND status = 'confirmed' LOOP
            PERFORM set_config('app.reason', 'Tour completed by the guide', true);
            UPDATE app.bookings SET status = 'completed', reason = 'Tour completed by the guide' WHERE id = v_booking.id;
            PERFORM app.emit_notification_event(
                'guide.review_requested', v_booking.id, v_booking.customer_id, NULL,
                jsonb_build_object('path', '/guides/review')
            );
        END LOOP;
    ELSE
        SELECT min(s.starts_at) INTO v_start
        FROM app.guide_engagements x JOIN app.trip_stops s ON s.version_id = x.trip_version_id
        WHERE x.id = r.engagement_id;
        IF now() < v_start THEN
            RAISE EXCEPTION 'complete the day once it has begun' USING ERRCODE = '22023';
        END IF;
        UPDATE app.guide_engagements SET state = 'completed', completed_at = now(), updated_at = now()
        WHERE id = r.engagement_id AND state = 'confirmed';
        PERFORM app.emit_notification_event(
            'guide.review_requested', r.engagement_id,
            (SELECT traveller_id FROM app.guide_engagements WHERE id = r.engagement_id), NULL,
            jsonb_build_object('path', '/guides/review')
        );
    END IF;
    UPDATE app.guide_runs
    SET state = 'completed', completed_at = now(), started_at = coalesce(started_at, now())
    WHERE id = r.id;
    PERFORM app.emit_notification_event(
        'guide.review_requested', r.id, v_guide_user, NULL, jsonb_build_object('path', '/guide/reviews')
    );
    RETURN app.guide_day_sheet(p_user, p_id);
END;
$$;

-- ---- Reviews in both directions ------------------------------------------------------------
-- Who took part in a completed run: bookings on the slot, or the engagement's traveller.
CREATE OR REPLACE FUNCTION app.guide_run_travellers(p_run uuid)
RETURNS TABLE (traveller_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT b.customer_id, u.display_name
    FROM app.guide_runs r
    JOIN app.bookings b ON b.slot_id = r.slot_id AND b.status = 'completed'
    JOIN app.users u ON u.id = b.customer_id
    WHERE r.id = p_run
    UNION
    SELECT x.traveller_id, u.display_name
    FROM app.guide_runs r
    JOIN app.guide_engagements x ON x.id = r.engagement_id AND x.state = 'completed'
    JOIN app.users u ON u.id = x.traveller_id
    WHERE r.id = p_run;
$$;

CREATE OR REPLACE FUNCTION app.guide_run_title(p_run uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(
        (SELECT e.title FROM app.guide_runs r JOIN app.slots s ON s.id = r.slot_id
         JOIN app.experiences e ON e.id = s.experience_id WHERE r.id = p_run),
        (SELECT t.title FROM app.guide_runs r JOIN app.guide_engagements x ON x.id = r.engagement_id
         JOIN app.trips t ON t.id = x.trip_id WHERE r.id = p_run)
    );
$$;

CREATE OR REPLACE FUNCTION app.write_guide_review(p_user uuid, p_run uuid, p_traveller uuid, p_rating integer, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    r app.guide_runs;
    g app.guide_profiles;
    v_direction text;
    v_traveller uuid;
    v_id uuid;
BEGIN
    SELECT * INTO r FROM app.guide_runs WHERE id = p_run;
    IF r.id IS NULL OR r.state <> 'completed' THEN
        RAISE EXCEPTION 'review not available' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO g FROM app.guide_profiles WHERE id = r.guide_profile_id;
    IF g.user_id = p_user THEN
        v_direction := 'guide_to_traveller';
        v_traveller := p_traveller;
    ELSE
        v_direction := 'traveller_to_guide';
        v_traveller := p_user;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.guide_run_travellers(r.id) t WHERE t.traveller_id = v_traveller) THEN
        RAISE EXCEPTION 'review not available' USING ERRCODE = 'P0002';
    END IF;
    IF r.completed_at < now() - interval '14 days' THEN
        RAISE EXCEPTION 'the review window has closed' USING ERRCODE = '22023';
    END IF;
    IF p_rating NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION 'rating must be 1 to 5' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.guide_reviews (run_id, direction, author_id, guide_profile_id, traveller_id, rating, body)
    VALUES (r.id, v_direction, p_user, g.id, v_traveller, p_rating, left(coalesce(p_body, ''), 2000))
    ON CONFLICT (run_id, traveller_id, direction) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'already reviewed' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
        'id', v_id, 'direction', v_direction, 'released', app.guide_review_released(v_id)
    );
END;
$$;

-- What each side still owes, and what each side can now read.
CREATE OR REPLACE FUNCTION app.guide_review_inbox(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE user_id = p_user;
    RETURN jsonb_build_object(
        -- As a guide: travellers to review.
        'to_review_as_guide', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'run_id', r.id, 'title', app.guide_run_title(r.id), 'completed_at', r.completed_at,
                'traveller_id', t.traveller_id, 'traveller_name', t.name
            ) ORDER BY r.completed_at DESC)
            FROM app.guide_runs r CROSS JOIN LATERAL app.guide_run_travellers(r.id) t
            WHERE g.id IS NOT NULL AND r.guide_profile_id = g.id AND r.state = 'completed'
              AND r.completed_at > now() - interval '14 days'
              AND NOT EXISTS (SELECT 1 FROM app.guide_reviews x WHERE x.run_id = r.id
                              AND x.traveller_id = t.traveller_id AND x.direction = 'guide_to_traveller')
        ), '[]'::jsonb),
        -- As a traveller: guides to review.
        'to_review_as_traveller', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'run_id', r.id, 'title', app.guide_run_title(r.id), 'completed_at', r.completed_at,
                'guide_slug', gp.slug, 'guide_name', gp.display_name
            ) ORDER BY r.completed_at DESC)
            FROM app.guide_runs r
            JOIN app.guide_profiles gp ON gp.id = r.guide_profile_id
            WHERE r.state = 'completed' AND r.completed_at > now() - interval '14 days'
              AND EXISTS (SELECT 1 FROM app.guide_run_travellers(r.id) t WHERE t.traveller_id = p_user)
              AND NOT EXISTS (SELECT 1 FROM app.guide_reviews x WHERE x.run_id = r.id
                              AND x.traveller_id = p_user AND x.direction = 'traveller_to_guide')
        ), '[]'::jsonb),
        -- Released reviews about me, in either role.
        'about_me_as_guide', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', x.id, 'rating', x.rating, 'body', x.body, 'created_at', x.created_at,
                'title', app.guide_run_title(x.run_id)
            ) ORDER BY x.created_at DESC)
            FROM app.guide_reviews x
            WHERE g.id IS NOT NULL AND x.guide_profile_id = g.id AND x.direction = 'traveller_to_guide'
              AND x.hidden_at IS NULL AND app.guide_review_released(x.id)
        ), '[]'::jsonb),
        'about_me_as_traveller', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', x.id, 'rating', x.rating, 'body', x.body, 'created_at', x.created_at,
                'title', app.guide_run_title(x.run_id)
            ) ORDER BY x.created_at DESC)
            FROM app.guide_reviews x
            WHERE x.traveller_id = p_user AND x.direction = 'guide_to_traveller'
              AND x.hidden_at IS NULL AND app.guide_review_released(x.id)
        ), '[]'::jsonb),
        'waiting_to_release', (
            SELECT count(*) FROM app.guide_reviews x
            WHERE x.author_id = p_user AND NOT app.guide_review_released(x.id)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.public_guide_reviews(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'count', count(x.id),
        'average', round(avg(x.rating)::numeric, 1),
        'recent', coalesce(jsonb_agg(jsonb_build_object(
            'rating', x.rating, 'body', x.body, 'created_at', x.created_at,
            'author', (SELECT split_part(display_name, ' ', 1) FROM app.users WHERE id = x.author_id)
        ) ORDER BY x.created_at DESC) FILTER (WHERE x.id IS NOT NULL), '[]'::jsonb)
    )
    FROM app.guide_profiles g
    LEFT JOIN app.guide_reviews x ON x.guide_profile_id = g.id AND x.direction = 'traveller_to_guide'
        AND x.hidden_at IS NULL AND app.guide_review_released(x.id)
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.review_requested', 'en', 'traveller', 'How did the day go?',
     'Leave a short review. Neither side sees the other''s until both are in: {deep_link}'),
    ('guide.review_requested', 'ar', 'traveller', 'كيف كان اليوم؟',
     'اترك تقييمًا قصيرًا. لا يرى أي طرف تقييم الآخر حتى يكتب الطرفان: {deep_link}'),
    ('guide.review_requested', 'fr', 'traveller', 'Comment s’est passée la journée ?',
     'Laissez un court avis. Aucun des deux ne voit celui de l’autre avant que les deux soient écrits : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

GRANT EXECUTE ON FUNCTION
    app.guide_run_for(uuid, uuid),
    app.traveller_reputation(uuid),
    app.guide_review_released(uuid),
    app.guide_day_sheet(uuid, uuid),
    app.guide_list_days(uuid, integer),
    app.guide_start_day(uuid, uuid),
    app.guide_complete_day(uuid, uuid),
    app.guide_run_travellers(uuid),
    app.guide_run_title(uuid),
    app.write_guide_review(uuid, uuid, uuid, integer, text),
    app.guide_review_inbox(uuid),
    app.public_guide_reviews(text)
TO mshwar_backend;
