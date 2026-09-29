-- 066_guide_quality.sql
-- Guide plan, step 7: quality, levels and ranking.
--
-- Reviews gain four parts (knowledge, communication, value, route) and one public reply from
-- the guide. Levels (New, Trusted, Top guide) are worked out every night from real runs,
-- reviews, reply speed and cancellations over the last 12 months; a guide who slips keeps the
-- level for 30 days and is told what to fix. "Recommended" sorts by a score whose parts the
-- guide can see. Strikes (late guide cancellations, and no-shows, safety or conduct problems
-- an admin has checked) lead to a warning, then a 14-day pause, then suspension.
--
-- Every number comes from the database. Nothing is estimated or invented: a guide with no
-- reviews has no rating, and the ranking uses a neutral prior until real data exists.

-- ---- Reviews: parts, one reply, moderation --------------------------------------------------
ALTER TABLE app.guide_reviews
    ADD COLUMN IF NOT EXISTS rating_knowledge smallint CHECK (rating_knowledge BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS rating_communication smallint CHECK (rating_communication BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS rating_value smallint CHECK (rating_value BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS rating_route smallint CHECK (rating_route BETWEEN 1 AND 5),
    ADD COLUMN IF NOT EXISTS reply text CHECK (reply IS NULL OR length(reply) BETWEEN 2 AND 1000),
    ADD COLUMN IF NOT EXISTS replied_at timestamptz,
    ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES app.users(id),
    ADD COLUMN IF NOT EXISTS hidden_reason text NOT NULL DEFAULT '' CHECK (length(hidden_reason) <= 300);

CREATE OR REPLACE FUNCTION app.guide_review_parts_json(x app.guide_reviews)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN num_nonnulls(x.rating_knowledge, x.rating_communication, x.rating_value, x.rating_route) = 0
        THEN NULL
        ELSE jsonb_build_object(
            'knowledge', x.rating_knowledge, 'communication', x.rating_communication,
            'value', x.rating_value, 'route', x.rating_route
        ) END;
$$;

-- A traveller's review with its four parts (each optional, 1 to 5). A guide's review of a
-- traveller has no parts.
CREATE OR REPLACE FUNCTION app.write_guide_review_full(
    p_user uuid, p_run uuid, p_traveller uuid, p_rating integer, p_body text, p_parts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_parts jsonb := coalesce(p_parts, '{}'::jsonb);
    v_key text;
    v_result jsonb;
BEGIN
    IF jsonb_typeof(v_parts) <> 'object' THEN
        RAISE EXCEPTION 'rate each part from 1 to 5' USING ERRCODE = '22023';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(v_parts) LOOP
        IF v_key NOT IN ('knowledge', 'communication', 'value', 'route') THEN
            RAISE EXCEPTION 'rate each part from 1 to 5' USING ERRCODE = '22023';
        END IF;
        IF jsonb_typeof(v_parts->v_key) <> 'null' AND coalesce(v_parts->>v_key, '') !~ '^[1-5]$' THEN
            RAISE EXCEPTION 'rate each part from 1 to 5' USING ERRCODE = '22023';
        END IF;
    END LOOP;
    v_result := app.write_guide_review(p_user, p_run, p_traveller, p_rating, p_body);
    IF v_result->>'direction' = 'traveller_to_guide' THEN
        UPDATE app.guide_reviews
        SET rating_knowledge = (v_parts->>'knowledge')::smallint,
            rating_communication = (v_parts->>'communication')::smallint,
            rating_value = (v_parts->>'value')::smallint,
            rating_route = (v_parts->>'route')::smallint
        WHERE id = (v_result->>'id')::uuid;
    END IF;
    RETURN v_result;
END;
$$;

-- The guide answers a published review once, in public.
CREATE OR REPLACE FUNCTION app.guide_reply_to_review(p_user uuid, p_review uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_reviews;
    g app.guide_profiles;
    v_body text := btrim(coalesce(p_body, ''));
BEGIN
    SELECT r.* INTO x FROM app.guide_reviews r
    JOIN app.guide_profiles gp ON gp.id = r.guide_profile_id
    WHERE r.id = p_review AND gp.user_id = p_user AND r.direction = 'traveller_to_guide' AND r.hidden_at IS NULL
    FOR UPDATE OF r;
    IF x.id IS NULL THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT app.guide_review_released(x.id) THEN
        RAISE EXCEPTION 'you can reply once the review is published' USING ERRCODE = '22023';
    END IF;
    IF x.reply IS NOT NULL THEN
        RAISE EXCEPTION 'you have already replied to this review' USING ERRCODE = '22023';
    END IF;
    IF length(v_body) < 2 OR length(v_body) > 1000 THEN
        RAISE EXCEPTION 'write a reply of up to 1000 characters' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_reviews SET reply = v_body, replied_at = now() WHERE id = x.id;
    SELECT * INTO g FROM app.guide_profiles WHERE id = x.guide_profile_id;
    PERFORM app.emit_notification_event(
        'guide.review_reply', x.id, x.author_id, NULL,
        jsonb_build_object('status', g.display_name, 'body', left(v_body, 200), 'path', '/guides/' || g.slug)
    );
    RETURN jsonb_build_object('id', x.id, 'reply', v_body, 'replied_at', now());
END;
$$;

-- Released traveller reviews of a guide, with the part averages and the guide's replies.
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
        'parts', jsonb_build_object(
            'knowledge', round(avg(x.rating_knowledge)::numeric, 1),
            'communication', round(avg(x.rating_communication)::numeric, 1),
            'value', round(avg(x.rating_value)::numeric, 1),
            'route', round(avg(x.rating_route)::numeric, 1)
        ),
        'recent', coalesce(jsonb_agg(jsonb_build_object(
            'id', x.id,
            'rating', x.rating, 'body', x.body, 'created_at', x.created_at,
            'author', (SELECT split_part(display_name, ' ', 1) FROM app.users WHERE id = x.author_id),
            'parts', app.guide_review_parts_json(x),
            'reply', x.reply, 'replied_at', x.replied_at
        ) ORDER BY x.created_at DESC) FILTER (WHERE x.id IS NOT NULL), '[]'::jsonb)
    )
    FROM app.guide_profiles g
    LEFT JOIN app.guide_reviews x ON x.guide_profile_id = g.id AND x.direction = 'traveller_to_guide'
        AND x.hidden_at IS NULL AND app.guide_review_released(x.id)
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

-- Same as 037, with parts and replies on the reviews about the guide.
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
        'about_me_as_guide', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', x.id, 'rating', x.rating, 'body', x.body, 'created_at', x.created_at,
                'title', app.guide_run_title(x.run_id),
                'parts', app.guide_review_parts_json(x),
                'reply', x.reply, 'replied_at', x.replied_at
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

-- ---- Numbers behind levels and ranking --------------------------------------------------------
-- Rolling 12 months. Requests still waiting are not judged yet; a request that lapsed counts
-- as not answered. A cancellation counts against the guide only if the booking was confirmed.
CREATE OR REPLACE FUNCTION app.guide_quality_stats(p_guide uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH g AS (
        SELECT * FROM app.guide_profiles WHERE id = p_guide
    ),
    runs AS (
        SELECT count(*) AS n,
               count(*) FILTER (WHERE r.completed_at > now() - interval '90 days') AS recent
        FROM app.guide_runs r
        WHERE r.guide_profile_id = p_guide AND r.state = 'completed' AND r.completed_at > now() - interval '365 days'
    ),
    reviews AS (
        SELECT count(*) AS n, avg(x.rating) AS average
        FROM app.guide_reviews x
        WHERE x.guide_profile_id = p_guide AND x.direction = 'traveller_to_guide' AND x.hidden_at IS NULL
          AND x.created_at > now() - interval '365 days' AND app.guide_review_released(x.id)
    ),
    requests AS (
        SELECT b.id, b.status, b.created_at, a.answered_at, a.answer
        FROM app.bookings b
        LEFT JOIN LATERAL (
            SELECT e.created_at AS answered_at, e.to_status AS answer
            FROM app.booking_events e
            WHERE e.booking_id = b.id AND e.from_status = 'pending' AND e.to_status IN ('confirmed', 'rejected')
            ORDER BY e.created_at LIMIT 1
        ) a ON true
        WHERE b.organization_id = (SELECT organization_id FROM g) AND b.mode = 'request'
          AND b.created_at > now() - interval '365 days'
    ),
    response AS (
        SELECT count(*) FILTER (WHERE answered_at IS NOT NULL OR status = 'expired') AS due,
               count(*) FILTER (WHERE answered_at IS NOT NULL
                                  AND answered_at - created_at <= interval '24 hours') AS within_24h,
               count(*) FILTER (WHERE answer = 'confirmed') AS accepted,
               round((percentile_cont(0.5) WITHIN GROUP (
                   ORDER BY extract(epoch FROM answered_at - created_at) / 60
               ) FILTER (WHERE answered_at IS NOT NULL))::numeric) AS median_minutes
        FROM requests
    ),
    held AS (
        SELECT count(*) AS n,
               count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM app.booking_events e
                   WHERE e.booking_id = b.id AND e.from_status = 'confirmed' AND e.to_status = 'cancelled'
                     AND e.actor_id = (SELECT user_id FROM g)
               )) AS cancelled
        FROM app.bookings b
        WHERE b.organization_id = (SELECT organization_id FROM g) AND b.created_at > now() - interval '365 days'
          AND (b.status IN ('confirmed', 'completed')
               OR EXISTS (SELECT 1 FROM app.booking_events e WHERE e.booking_id = b.id AND e.from_status = 'confirmed'))
    ),
    profile AS (
        SELECT
            (length(coalesce(g.bio, '')) >= 80)::int AS bio,
            (coalesce(array_length(g.languages, 1), 0) > 0)::int AS languages,
            EXISTS (
                SELECT 1 FROM app.experiences e JOIN app.media m ON m.experience_id = e.id AND m.moderation = 'approved'
                WHERE e.organization_id = g.organization_id AND e.status = 'published'
            )::int AS photos,
            EXISTS (
                SELECT 1 FROM app.experiences e JOIN app.guide_tours t ON t.experience_id = e.id
                WHERE e.organization_id = g.organization_id AND e.status = 'published'
                  AND length(btrim(coalesce(t.meeting_point, ''))) > 0
            )::int AS meeting_point,
            EXISTS (
                SELECT 1 FROM app.experiences e JOIN app.slots s ON s.experience_id = e.id
                WHERE e.organization_id = g.organization_id AND e.status = 'published' AND s.status = 'open'
                  AND s.starts_at BETWEEN now() AND now() + interval '30 days'
            )::int AS schedule
        FROM g
    )
    SELECT jsonb_build_object(
        'completed_runs', runs.n,
        'recent_runs', runs.recent,
        'reviews', reviews.n,
        'rating', round(reviews.average::numeric, 2),
        'requests_due', response.due,
        'answered_24h', response.within_24h,
        'answered_24h_rate', CASE WHEN response.due > 0 THEN round(response.within_24h::numeric / response.due, 3) END,
        'median_response_minutes', response.median_minutes,
        'requests_accepted', response.accepted,
        'bookings_held', held.n,
        'guide_cancellations', held.cancelled,
        'cancel_rate', CASE WHEN held.n > 0 THEN round(held.cancelled::numeric / held.n, 3) ELSE 0 END,
        'completeness', round((profile.bio + profile.languages + profile.photos + profile.meeting_point
                               + profile.schedule)::numeric / 5, 2),
        'profile', jsonb_build_object(
            'bio', profile.bio = 1, 'languages', profile.languages = 1, 'photos', profile.photos = 1,
            'meeting_point', profile.meeting_point = 1, 'schedule', profile.schedule = 1
        ),
        'approved_at', (SELECT decided_at FROM g)
    )
    FROM runs, reviews, response, held, profile;
$$;

CREATE OR REPLACE FUNCTION app.guide_level_rank(p_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_level WHEN 'top' THEN 2 WHEN 'trusted' THEN 1 ELSE 0 END;
$$;

-- The public thresholds (section 15.1 of the guide plan).
CREATE OR REPLACE FUNCTION app.guide_level_thresholds()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'trusted', jsonb_build_object('completed_runs', 5, 'rating', 4.6, 'answered_24h_rate', 0.9, 'cancel_rate', 0.05),
        'top', jsonb_build_object('completed_runs', 25, 'rating', 4.8, 'median_response_minutes', 120, 'cancel_rate', 0.02)
    );
$$;

-- What the numbers earn today. A guide with no requests to answer meets the reply rules.
CREATE OR REPLACE FUNCTION app.guide_level_earned(p_stats jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN (p_stats->>'completed_runs')::int >= 25
             AND coalesce((p_stats->>'rating')::numeric, 0) >= 4.8
             AND ((p_stats->>'requests_due')::int = 0
                  OR coalesce((p_stats->>'median_response_minutes')::numeric, 1e9) < 120)
             AND (p_stats->>'cancel_rate')::numeric <= 0.02
            THEN 'top'
        WHEN (p_stats->>'completed_runs')::int >= 5
             AND coalesce((p_stats->>'rating')::numeric, 0) >= 4.6
             AND ((p_stats->>'requests_due')::int = 0
                  OR coalesce((p_stats->>'answered_24h_rate')::numeric, 0) >= 0.9)
             AND (p_stats->>'cancel_rate')::numeric <= 0.05
            THEN 'trusted'
        ELSE 'new'
    END;
$$;

-- The "Recommended" score (section 15.2), each part between 0 and 1.
CREATE OR REPLACE FUNCTION app.guide_rank_parts(p_stats jsonb, p_level text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_reviews numeric := (p_stats->>'reviews')::numeric;
    v_rating numeric := coalesce((p_stats->>'rating')::numeric, 0);
    v_due numeric := (p_stats->>'requests_due')::numeric;
    v_held numeric := (p_stats->>'bookings_held')::numeric;
    v_review numeric;
    v_response numeric;
    v_reliability numeric;
    v_conversion numeric;
    v_completeness numeric := (p_stats->>'completeness')::numeric;
    v_freshness numeric := least(1, (p_stats->>'recent_runs')::numeric / 5);
    v_boost numeric := 0;
    v_score numeric;
BEGIN
    IF p_stats IS NULL OR p_stats = '{}'::jsonb THEN
        RETURN jsonb_build_object('score', 0, 'boost', 0, 'parts', '{}'::jsonb);
    END IF;
    -- Bayesian average with a prior of five 4.5-star reviews, so two 5-star reviews do not beat
    -- eighty at 4.9.
    v_review := ((v_rating * v_reviews) + 4.5 * 5) / (v_reviews + 5) / 5;
    v_response := CASE WHEN v_due = 0 THEN 0.7
        ELSE 0.6 * coalesce((p_stats->>'answered_24h_rate')::numeric, 0)
             + 0.4 * greatest(0, 1 - coalesce((p_stats->>'median_response_minutes')::numeric, 1440) / 1440)
        END;
    v_reliability := greatest(0, 1 - (p_stats->>'guide_cancellations')::numeric / (v_held + 1));
    v_conversion := ((p_stats->>'requests_accepted')::numeric + 1) / (v_due + 2);
    IF (p_stats->>'approved_at') IS NOT NULL AND (p_stats->>'approved_at')::timestamptz > now() - interval '60 days' THEN
        v_boost := v_boost + 0.05;  -- new-guide boost, so a newcomer can earn first reviews
    END IF;
    v_boost := v_boost + CASE p_level WHEN 'top' THEN 0.06 WHEN 'trusted' THEN 0.03 ELSE 0 END;
    v_score := 0.35 * v_review + 0.20 * v_response + 0.15 * v_reliability + 0.10 * v_conversion
               + 0.10 * v_completeness + 0.10 * v_freshness + v_boost;
    RETURN jsonb_build_object(
        'score', round(v_score, 4),
        'boost', v_boost,
        'parts', jsonb_build_object(
            'review', round(v_review, 3), 'response', round(v_response, 3),
            'reliability', round(v_reliability, 3), 'conversion', round(v_conversion, 3),
            'completeness', round(v_completeness, 3), 'freshness', round(v_freshness, 3)
        )
    );
END;
$$;

-- ---- Levels, worked out every night ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_levels (
    guide_profile_id uuid PRIMARY KEY REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    level text NOT NULL DEFAULT 'new' CHECK (level IN ('new', 'trusted', 'top')),
    earned text NOT NULL DEFAULT 'new' CHECK (earned IN ('new', 'trusted', 'top')),
    held_until timestamptz,
    score numeric(6, 4) NOT NULL DEFAULT 0,
    parts jsonb NOT NULL DEFAULT '{}'::jsonb,
    stats jsonb NOT NULL DEFAULT '{}'::jsonb,
    computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.guide_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_levels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_levels_read ON app.guide_levels;
CREATE POLICY guide_levels_read ON app.guide_levels FOR SELECT TO mshwar_backend USING (true);
GRANT SELECT ON app.guide_levels TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.guide_level(p_guide uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((SELECT level FROM app.guide_levels WHERE guide_profile_id = p_guide), 'new');
$$;

-- The stored score, or (before the first nightly run) the score worked out now.
CREATE OR REPLACE FUNCTION app.guide_rank_score(p_guide uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(
        (SELECT score FROM app.guide_levels WHERE guide_profile_id = p_guide),
        (app.guide_rank_parts(app.guide_quality_stats(p_guide), 'new')->>'score')::numeric
    );
$$;

CREATE OR REPLACE FUNCTION app.guide_recompute_levels()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    cur app.guide_levels;
    v_stats jsonb;
    v_earned text;
    v_level text;
    v_held timestamptz;
    v_rank jsonb;
    v_up integer := 0;
    v_down integer := 0;
    v_held_count integer := 0;
    v_total integer := 0;
BEGIN
    FOR g IN SELECT * FROM app.guide_profiles WHERE status = 'approved' LOOP
        v_total := v_total + 1;
        v_stats := app.guide_quality_stats(g.id);
        v_earned := app.guide_level_earned(v_stats);
        SELECT * INTO cur FROM app.guide_levels WHERE guide_profile_id = g.id;
        v_level := v_earned;
        v_held := NULL;
        IF cur.guide_profile_id IS NOT NULL AND app.guide_level_rank(v_earned) < app.guide_level_rank(cur.level) THEN
            IF cur.held_until IS NULL THEN
                -- Slipped below: keep the level 30 days and say what to fix.
                v_level := cur.level;
                v_held := now() + interval '30 days';
                v_held_count := v_held_count + 1;
                PERFORM app.emit_notification_event(
                    'guide.level_at_risk', g.id, g.user_id, NULL,
                    jsonb_build_object('status', cur.level, 'path', '/guide/quality')
                );
            ELSIF cur.held_until > now() THEN
                v_level := cur.level;
                v_held := cur.held_until;
                v_held_count := v_held_count + 1;
            ELSE
                v_down := v_down + 1;
                PERFORM app.emit_notification_event(
                    'guide.level_changed', g.id, g.user_id, NULL,
                    jsonb_build_object('status', v_earned, 'path', '/guide/quality')
                );
            END IF;
        ELSIF app.guide_level_rank(v_earned) > app.guide_level_rank(coalesce(cur.level, 'new')) THEN
            v_up := v_up + 1;
            PERFORM app.emit_notification_event(
                'guide.level_changed', g.id, g.user_id, NULL,
                jsonb_build_object('status', v_earned, 'path', '/guide/quality')
            );
        END IF;
        v_rank := app.guide_rank_parts(v_stats, v_level);
        INSERT INTO app.guide_levels (guide_profile_id, level, earned, held_until, score, parts, stats, computed_at)
        VALUES (g.id, v_level, v_earned, v_held, (v_rank->>'score')::numeric, v_rank, v_stats, now())
        ON CONFLICT (guide_profile_id) DO UPDATE
        SET level = EXCLUDED.level, earned = EXCLUDED.earned, held_until = EXCLUDED.held_until,
            score = EXCLUDED.score, parts = EXCLUDED.parts, stats = EXCLUDED.stats, computed_at = now();
    END LOOP;
    RETURN jsonb_build_object('guides', v_total, 'up', v_up, 'down', v_down, 'held', v_held_count);
END;
$$;

-- ---- Strikes ----------------------------------------------------------------------------------
ALTER TABLE app.guide_profiles ADD COLUMN IF NOT EXISTS paused_until timestamptz;

CREATE TABLE IF NOT EXISTS app.guide_strikes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('guide_cancellation', 'no_show', 'safety', 'conduct', 'other')),
    reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
    booking_id uuid REFERENCES app.bookings(id),
    support_case_id uuid REFERENCES app.support_cases(id),
    created_by uuid REFERENCES app.users(id),  -- NULL: recorded automatically
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '365 days',
    voided_at timestamptz,
    voided_by uuid REFERENCES app.users(id),
    void_reason text NOT NULL DEFAULT '' CHECK (length(void_reason) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS guide_strikes_booking_once
    ON app.guide_strikes (booking_id, kind) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS guide_strikes_guide_idx ON app.guide_strikes (guide_profile_id, created_at DESC);
ALTER TABLE app.guide_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_strikes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_strikes_self ON app.guide_strikes;
CREATE POLICY guide_strikes_self ON app.guide_strikes FOR SELECT TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_strikes.guide_profile_id AND g.user_id = app.current_user_id()));
GRANT SELECT ON app.guide_strikes TO mshwar_backend;

DROP TRIGGER IF EXISTS audit ON app.guide_strikes;
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.guide_strikes
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

CREATE OR REPLACE FUNCTION app.guide_active_strikes(p_guide uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT count(*)::integer FROM app.guide_strikes
    WHERE guide_profile_id = p_guide AND voided_at IS NULL AND expires_at > now();
$$;

CREATE OR REPLACE FUNCTION app.guide_paused(p_guide uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((SELECT paused_until > now() FROM app.guide_profiles WHERE id = p_guide), false);
$$;

-- One strike: a warning. Two: a 14-day pause on new bookings. Three: suspension, which
-- closes future days and tells travellers (038).
CREATE OR REPLACE FUNCTION app.guide_apply_strikes(p_guide uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    v_active integer := app.guide_active_strikes(p_guide);
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE id = p_guide FOR UPDATE;
    IF v_active >= 3 THEN
        IF g.status = 'approved' THEN
            UPDATE app.guide_profiles
            SET status = 'suspended', decided_at = now(), updated_at = now(),
                decision_reason = 'Three strikes within 12 months'
            WHERE id = p_guide;
        END IF;
        RETURN 'suspended';
    ELSIF v_active = 2 THEN
        UPDATE app.guide_profiles
        SET paused_until = greatest(coalesce(paused_until, now()), now() + interval '14 days'), updated_at = now()
        WHERE id = p_guide;
        PERFORM app.emit_notification_event(
            'guide.paused', p_guide, g.user_id, NULL,
            jsonb_build_object('status', to_char((now() + interval '14 days') AT TIME ZONE 'Asia/Beirut', 'YYYY-MM-DD'),
                               'path', '/guide/quality')
        );
        RETURN 'paused';
    ELSIF v_active = 1 THEN
        PERFORM app.emit_notification_event(
            'guide.strike_warning', p_guide, g.user_id, NULL,
            jsonb_build_object('path', '/guide/quality')
        );
        RETURN 'warning';
    END IF;
    RETURN 'none';
END;
$$;

-- A guide cancelling a confirmed booking less than 72 hours before the start is a strike,
-- recorded automatically. Earlier cancellations only count in reliability.
CREATE OR REPLACE FUNCTION app.on_booking_event_strike()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    v_starts timestamptz;
    v_id uuid;
BEGIN
    IF NEW.from_status <> 'confirmed' OR NEW.to_status <> 'cancelled' OR NEW.actor_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT gp.* INTO g FROM app.guide_profiles gp
    JOIN app.bookings b ON b.organization_id = gp.organization_id
    WHERE b.id = NEW.booking_id AND gp.user_id = NEW.actor_id;
    IF g.id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT s.starts_at INTO v_starts FROM app.bookings b JOIN app.slots s ON s.id = b.slot_id WHERE b.id = NEW.booking_id;
    IF v_starts IS NULL OR v_starts - NEW.created_at > interval '72 hours' THEN
        RETURN NEW;
    END IF;
    INSERT INTO app.guide_strikes (guide_profile_id, kind, reason, booking_id)
    VALUES (g.id, 'guide_cancellation', 'Cancelled a confirmed booking less than 72 hours before the start', NEW.booking_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
        PERFORM app.guide_apply_strikes(g.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_event_strike ON app.booking_events;
CREATE TRIGGER booking_event_strike
    AFTER INSERT ON app.booking_events
    FOR EACH ROW EXECUTE FUNCTION app.on_booking_event_strike();

-- A paused guide takes no new bookings (same guard as 061, plus the pause).
CREATE OR REPLACE FUNCTION app.guard_guide_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_code text;
    v_guide uuid;
BEGIN
    IF NEW.status NOT IN ('pending', 'confirmed') THEN
        RETURN NEW;
    END IF;
    SELECT g.id INTO v_guide FROM app.guide_profiles g WHERE g.organization_id = NEW.organization_id;
    IF v_guide IS NULL THEN
        RETURN NEW;
    END IF;
    IF (SELECT starts_at FROM app.slots WHERE id = NEW.slot_id) <= now() THEN
        RETURN NEW;
    END IF;
    IF app.guide_paused(v_guide) THEN
        RAISE EXCEPTION 'this guide is not taking new bookings right now' USING ERRCODE = '23P01';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guide-busy:' || NEW.organization_id::text, 0));
    v_code := app.guide_slot_clash(NEW.slot_id, true);
    IF v_code IS NOT NULL THEN
        RAISE EXCEPTION '%', app.guide_clash_message(v_code) USING ERRCODE = '23P01';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_strike_json(s app.guide_strikes)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'id', s.id, 'kind', s.kind, 'reason', s.reason, 'booking_id', s.booking_id,
        'automatic', s.created_by IS NULL, 'created_at', s.created_at, 'expires_at', s.expires_at,
        'voided_at', s.voided_at, 'void_reason', s.void_reason,
        'active', s.voided_at IS NULL AND s.expires_at > now()
    );
$$;

-- ---- The guide's own view ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_my_quality(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    lv app.guide_levels;
    v_stats jsonb := app.guide_quality_stats(g.id);
    v_level text;
BEGIN
    SELECT * INTO lv FROM app.guide_levels WHERE guide_profile_id = g.id;
    v_level := coalesce(lv.level, 'new');
    RETURN jsonb_build_object(
        'level', v_level,
        'earned', app.guide_level_earned(v_stats),
        'held_until', lv.held_until,
        'computed_at', lv.computed_at,
        'stats', v_stats,
        'thresholds', app.guide_level_thresholds(),
        'ranking', app.guide_rank_parts(v_stats, v_level),
        'paused_until', CASE WHEN g.paused_until > now() THEN g.paused_until END,
        'active_strikes', app.guide_active_strikes(g.id),
        'strikes', coalesce((
            SELECT jsonb_agg(app.guide_strike_json(s) ORDER BY s.created_at DESC)
            FROM app.guide_strikes s WHERE s.guide_profile_id = g.id AND s.created_at > now() - interval '365 days'
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- Admin: levels, strikes and review moderation ----------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_guide_quality(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := NULLIF(btrim(coalesce(p_filter->>'q', '')), '');
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(row ORDER BY (row->>'active_strikes')::int DESC, row->>'display_name')
        FROM (
            SELECT jsonb_build_object(
                'id', g.id, 'slug', g.slug, 'display_name', g.display_name, 'status', g.status,
                'level', coalesce(lv.level, 'new'), 'earned', coalesce(lv.earned, 'new'),
                'held_until', lv.held_until, 'score', lv.score, 'stats', coalesce(lv.stats, '{}'::jsonb),
                'computed_at', lv.computed_at,
                'paused_until', CASE WHEN g.paused_until > now() THEN g.paused_until END,
                'active_strikes', app.guide_active_strikes(g.id),
                'strikes', coalesce((
                    SELECT jsonb_agg(app.guide_strike_json(s) ORDER BY s.created_at DESC)
                    FROM app.guide_strikes s WHERE s.guide_profile_id = g.id
                ), '[]'::jsonb)
            ) AS row
            FROM app.guide_profiles g
            LEFT JOIN app.guide_levels lv ON lv.guide_profile_id = g.id
            WHERE g.status IN ('approved', 'suspended')
              AND (v_q IS NULL OR g.display_name ILIKE '%' || v_q || '%' OR g.slug ILIKE '%' || v_q || '%')
            LIMIT 500
        ) t
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_add_guide_strike(p_admin uuid, p_guide uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_kind text := p_payload->>'kind';
    v_reason text := btrim(coalesce(p_payload->>'reason', ''));
    v_case uuid := NULLIF(p_payload->>'support_case_id', '')::uuid;
    v_outcome text;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NOT EXISTS (SELECT 1 FROM app.guide_profiles WHERE id = p_guide) THEN
        RAISE EXCEPTION 'guide not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_kind NOT IN ('guide_cancellation', 'no_show', 'safety', 'conduct', 'other') THEN
        RAISE EXCEPTION 'choose what the strike is for' USING ERRCODE = '22023';
    END IF;
    IF length(v_reason) < 3 OR length(v_reason) > 500 THEN
        RAISE EXCEPTION 'say why, in a sentence' USING ERRCODE = '22023';
    END IF;
    IF v_case IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.support_cases WHERE id = v_case) THEN
        RAISE EXCEPTION 'support case not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO app.guide_strikes (guide_profile_id, kind, reason, support_case_id, created_by)
    VALUES (p_guide, v_kind, v_reason, v_case, p_admin);
    v_outcome := app.guide_apply_strikes(p_guide);
    RETURN jsonb_build_object('outcome', v_outcome, 'guides', app.admin_guide_quality(p_admin, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_void_guide_strike(p_admin uuid, p_strike uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    s app.guide_strikes;
    v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO s FROM app.guide_strikes WHERE id = p_strike FOR UPDATE;
    IF s.id IS NULL THEN
        RAISE EXCEPTION 'strike not found' USING ERRCODE = 'P0002';
    END IF;
    IF s.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'this strike is already withdrawn' USING ERRCODE = '22023';
    END IF;
    IF length(v_reason) < 3 THEN
        RAISE EXCEPTION 'say why, in a sentence' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_strikes SET voided_at = now(), voided_by = p_admin, void_reason = left(v_reason, 500)
    WHERE id = p_strike;
    -- Fewer than two live strikes: the pause lifts. A suspension stays an admin decision.
    IF app.guide_active_strikes(s.guide_profile_id) < 2 THEN
        UPDATE app.guide_profiles SET paused_until = NULL, updated_at = now()
        WHERE id = s.guide_profile_id AND paused_until IS NOT NULL;
    END IF;
    RETURN app.admin_guide_quality(p_admin, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_guide_reviews(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_state text := coalesce(NULLIF(p_filter->>'state', ''), 'all');
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_state NOT IN ('all', 'hidden', 'low', 'replied') THEN
        RAISE EXCEPTION 'unknown filter' USING ERRCODE = '22023';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(row ORDER BY row->>'created_at' DESC)
        FROM (
            SELECT jsonb_build_object(
                'id', x.id, 'direction', x.direction, 'rating', x.rating, 'body', x.body,
                'parts', app.guide_review_parts_json(x), 'reply', x.reply, 'replied_at', x.replied_at,
                'created_at', x.created_at, 'released', app.guide_review_released(x.id),
                'hidden', x.hidden_at IS NOT NULL, 'hidden_reason', x.hidden_reason,
                'guide', jsonb_build_object('slug', g.slug, 'display_name', g.display_name),
                'author', (SELECT split_part(display_name, ' ', 1) FROM app.users WHERE id = x.author_id)
            ) AS row
            FROM app.guide_reviews x
            JOIN app.guide_profiles g ON g.id = x.guide_profile_id
            WHERE (v_state = 'all')
               OR (v_state = 'hidden' AND x.hidden_at IS NOT NULL)
               OR (v_state = 'low' AND x.rating <= 2)
               OR (v_state = 'replied' AND x.reply IS NOT NULL)
            ORDER BY x.created_at DESC
            LIMIT 200
        ) t
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_moderate_guide_review(p_admin uuid, p_review uuid, p_action text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF NOT EXISTS (SELECT 1 FROM app.guide_reviews WHERE id = p_review) THEN
        RAISE EXCEPTION 'review not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_action NOT IN ('hide', 'show', 'remove_reply') THEN
        RAISE EXCEPTION 'hide, show or remove_reply' USING ERRCODE = '22023';
    END IF;
    IF p_action IN ('hide', 'remove_reply') AND length(v_reason) < 3 THEN
        RAISE EXCEPTION 'say why, in a sentence' USING ERRCODE = '22023';
    END IF;
    IF p_action = 'hide' THEN
        UPDATE app.guide_reviews SET hidden_at = now(), hidden_by = p_admin, hidden_reason = left(v_reason, 300)
        WHERE id = p_review;
    ELSIF p_action = 'show' THEN
        UPDATE app.guide_reviews SET hidden_at = NULL, hidden_by = NULL, hidden_reason = '' WHERE id = p_review;
    ELSE
        UPDATE app.guide_reviews SET reply = NULL, replied_at = NULL, hidden_reason = left(v_reason, 300)
        WHERE id = p_review;
    END IF;
    RETURN app.admin_guide_reviews(p_admin, '{}'::jsonb);
END;
$$;

-- ---- Levels where travellers see guides ---------------------------------------------------------
-- Same shape as 060, plus the level and the public numbers "About your guide" shows.
CREATE OR REPLACE FUNCTION app.guide_profile_json(p_profile uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'tier', g.tier,
        'badge', app.guide_has_badge(g.id),
        'display_name', g.display_name,
        'headline', g.headline,
        'bio', g.bio,
        'languages', to_jsonb(g.languages),
        'regions', to_jsonb(g.regions),
        'specialities', to_jsonb(g.specialities),
        'years_guiding', g.years_guiding,
        'status', g.status,
        'organization_id', g.organization_id,
        'day_rate_minor', g.day_rate_minor,
        'max_group', g.max_group,
        'hireable', app.guide_hireable(g.id),
        'founding_number', g.founding_number,
        'level', app.guide_level(g.id),
        'tours_given', (SELECT count(*) FROM app.guide_runs r WHERE r.guide_profile_id = g.id AND r.state = 'completed'),
        'response_minutes', (SELECT (lv.stats->>'median_response_minutes')::numeric
                             FROM app.guide_levels lv WHERE lv.guide_profile_id = g.id)
    )
    || CASE WHEN p_private THEN jsonb_build_object(
        'phone', g.phone,
        'submitted_at', g.submitted_at,
        'decided_at', g.decided_at,
        'decision_reason', g.decision_reason,
        'paused_until', CASE WHEN g.paused_until > now() THEN g.paused_until END,
        'required_documents', to_jsonb(app.guide_required_documents(g.tier)),
        'agreement', jsonb_build_object(
            'current', app.current_guide_agreement_version(),
            'accepted', app.guide_accepted_agreement(g.id)
        ),
        'documents', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'kind', c.kind, 'reference', c.reference, 'issuer', c.issuer,
                'issued_on', c.issued_on, 'expires_on', c.expires_on,
                'verification', c.verification, 'reason', c.reason,
                'expired', c.expires_on IS NOT NULL AND c.expires_on < current_date
            ) ORDER BY c.kind)
            FROM app.guide_credentials c WHERE c.guide_profile_id = g.id
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.guide_profiles g
    WHERE g.id = p_profile;
$$;

-- Same as 063, with the guide's level on the card.
CREATE OR REPLACE FUNCTION app.tour_card_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'slug', e.slug,
        'title', e.title,
        'summary', left(e.description, 220),
        'duration_minutes', e.duration_minutes,
        'max_party', e.max_party,
        'languages', to_jsonb(coalesce(t.languages, '{}'::text[])),
        'price_minor', pr.amount_minor,
        'price_unit', pr.unit,
        'instant_booking', coalesce(t.instant_booking, false),
        'policy', coalesce(t.policy, 'flexible'),
        'destination', CASE WHEN d.id IS NULL THEN NULL
                            ELSE jsonb_build_object('slug', d.slug, 'name', d.name) END,
        'lat', ST_Y(v.location::geometry),
        'lng', ST_X(v.location::geometry),
        'photo', app.tour_photos(e.id, 1)->0,
        'next_start', app.tour_next_start(e.id),
        'guide', jsonb_build_object(
            'slug', g.slug, 'display_name', g.display_name, 'badge', app.guide_has_badge(g.id),
            'founding_number', g.founding_number, 'tier', g.tier, 'level', app.guide_level(g.id)
        ),
        'rating', app.guide_rating(g.id)
    )
    FROM app.experiences e
    JOIN app.guide_profiles g ON g.organization_id = e.organization_id
    JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    LEFT JOIN LATERAL (
        SELECT p.amount_minor, p.unit FROM app.price_rules p
        WHERE p.experience_id = e.id AND p.price_type = 'fixed'
        ORDER BY lower(p.valid_during) DESC NULLS LAST LIMIT 1
    ) pr ON true
    WHERE e.id = p_experience;
$$;

-- Same as 063, with "About your guide": level, tours given and typical reply time.
CREATE OR REPLACE FUNCTION app.public_tour(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.tour_card_json(e.id) || jsonb_build_object(
        'description', e.description,
        'min_party', e.min_party,
        'min_age', e.min_age,
        'intensity', e.intensity,
        'meeting_point', coalesce(t.meeting_point, ''),
        'included', coalesce(t.included, ''),
        'bring', coalesce(t.bring, ''),
        'cancellation_terms', coalesce(t.cancellation_terms, ''),
        'highlights', to_jsonb(coalesce(t.highlights, '{}'::text[])),
        'faq', coalesce(t.faq, '[]'::jsonb),
        'accessibility', coalesce(t.accessibility, ''),
        'photos', app.tour_photos(e.id, 8),
        'booking', app.tour_booking_terms(e.id),
        'route', app.guide_tour_route(e.id),
        'guide', jsonb_build_object(
            'slug', g.slug, 'display_name', g.display_name, 'tier', g.tier, 'badge', app.guide_has_badge(g.id),
            'founding_number', g.founding_number, 'headline', g.headline, 'languages', to_jsonb(g.languages),
            'level', app.guide_level(g.id),
            'tours_given', (SELECT count(*) FROM app.guide_runs r WHERE r.guide_profile_id = g.id AND r.state = 'completed'),
            'response_minutes', (SELECT (lv.stats->>'median_response_minutes')::numeric
                                 FROM app.guide_levels lv WHERE lv.guide_profile_id = g.id)
        ),
        'updated_at', e.updated_at
    )
    FROM app.experiences e
    JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE e.slug = p_slug AND e.status = 'published';
$$;

-- Same filters as 063. "Recommended" now sorts by the ranking score (filters first, then the
-- score), and a paused guide's tours are not listed.
CREATE OR REPLACE FUNCTION app.public_tours_search(p_filters jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := NULLIF(btrim(coalesce(p_filters->>'q', '')), '');
    v_destination text := NULLIF(btrim(coalesce(p_filters->>'destination', '')), '');
    v_language text := NULLIF(btrim(coalesce(p_filters->>'language', '')), '');
    v_date date := NULLIF(p_filters->>'date', '')::date;
    v_max_duration integer := NULLIF(p_filters->>'max_duration', '')::integer;
    v_max_price bigint := NULLIF(p_filters->>'max_price', '')::bigint;
    v_instant boolean := coalesce((p_filters->>'instant')::boolean, false);
    v_sort text := coalesce(NULLIF(p_filters->>'sort', ''), 'recommended');
    v_limit integer := least(greatest(coalesce(NULLIF(p_filters->>'limit', '')::integer, 60), 1), 100);
    v_rows jsonb;
BEGIN
    WITH tours AS (
        SELECT e.id, e.title, e.duration_minutes, app.tour_card_json(e.id) AS card,
               app.guide_rank_score(g.id) AS score
        FROM app.experiences e
        JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
             AND (g.paused_until IS NULL OR g.paused_until <= now())
        JOIN app.venues v ON v.id = e.venue_id
        LEFT JOIN app.destinations d ON d.id = v.destination_id
        LEFT JOIN app.guide_tours t ON t.experience_id = e.id
        WHERE e.status = 'published'
          AND (v_q IS NULL OR e.title ILIKE '%' || v_q || '%' OR e.description ILIKE '%' || v_q || '%')
          AND (v_destination IS NULL OR d.slug = v_destination)
          AND (v_language IS NULL OR v_language = ANY (coalesce(t.languages, '{}'::text[])))
          AND (v_max_duration IS NULL OR e.duration_minutes <= v_max_duration)
          AND (NOT v_instant OR coalesce(t.instant_booking, false))
          AND (v_date IS NULL OR EXISTS (
              SELECT 1 FROM app.slots s
              WHERE s.experience_id = e.id AND s.status = 'open' AND s.starts_at > now()
                AND s.reserved < s.capacity
                AND (s.starts_at AT TIME ZONE 'Asia/Beirut')::date = v_date
                AND app.guide_slot_clash(s.id) IS NULL
          ))
    ),
    carded AS (
        SELECT * FROM tours
        WHERE v_max_price IS NULL OR coalesce((card->>'price_minor')::bigint, 0) <= v_max_price
    )
    SELECT coalesce(jsonb_agg(card ORDER BY
        CASE WHEN v_sort = 'price' THEN coalesce((card->>'price_minor')::bigint, 0) END ASC NULLS LAST,
        CASE WHEN v_sort = 'duration' THEN duration_minutes END ASC NULLS LAST,
        CASE WHEN v_sort = 'soonest' THEN (card->>'next_start')::timestamptz END ASC NULLS LAST,
        -- Recommended: tours someone can book soon, then the guide's ranking score, then photos.
        CASE WHEN v_sort = 'recommended' THEN (card->>'next_start') IS NULL END ASC,
        CASE WHEN v_sort = 'recommended' THEN score END DESC NULLS LAST,
        CASE WHEN v_sort = 'recommended' THEN (card->'photo') IS NULL END ASC,
        title ASC
    ), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT * FROM carded LIMIT 500) c;

    RETURN jsonb_build_object(
        'tours', coalesce((SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(v_rows) x LIMIT v_limit) y), '[]'::jsonb),
        'total', jsonb_array_length(v_rows),
        'destinations', coalesce((
            SELECT jsonb_agg(DISTINCT jsonb_build_object('slug', d.slug, 'name', d.name))
            FROM app.experiences e
            JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
            JOIN app.venues v ON v.id = e.venue_id
            JOIN app.destinations d ON d.id = v.destination_id
            WHERE e.status = 'published' AND EXISTS (SELECT 1 FROM app.guide_tours t WHERE t.experience_id = e.id)
        ), '[]'::jsonb)
    );
END;
$$;

-- ---- Notices ------------------------------------------------------------------------------------
INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.review_reply', 'en', 'traveller', '{status} replied to your review',
     '"{body}" See it on their page: {deep_link}'),
    ('guide.review_reply', 'ar', 'traveller', 'ردّ {status} على تقييمك',
     '"{body}" شاهده على صفحته: {deep_link}'),
    ('guide.review_reply', 'fr', 'traveller', '{status} a répondu à votre avis',
     '« {body} » À voir sur sa page : {deep_link}'),
    ('guide.level_changed', 'en', 'traveller', 'Your guide level is now: {status}',
     'Levels are worked out every night from your runs, reviews, replies and cancellations. See yours: {deep_link}'),
    ('guide.level_changed', 'ar', 'traveller', 'مستواك كمرشد الآن: {status}',
     'تُحسب المستويات كل ليلة من جولاتك وتقييماتك وسرعة ردّك والإلغاءات. شاهد مستواك: {deep_link}'),
    ('guide.level_changed', 'fr', 'traveller', 'Votre niveau de guide : {status}',
     'Les niveaux sont recalculés chaque nuit à partir de vos départs, avis, réponses et annulations. Le vôtre : {deep_link}'),
    ('guide.level_at_risk', 'en', 'traveller', 'Keep your {status} level',
     'Your numbers have dipped below the level. You keep it for 30 days; here is what to fix: {deep_link}'),
    ('guide.level_at_risk', 'ar', 'traveller', 'حافظ على مستوى {status}',
     'انخفضت أرقامك دون المستوى. تحتفظ به 30 يوماً؛ إليك ما يجب تحسينه: {deep_link}'),
    ('guide.level_at_risk', 'fr', 'traveller', 'Gardez votre niveau {status}',
     'Vos chiffres sont passés sous le seuil. Vous le gardez 30 jours ; voici quoi améliorer : {deep_link}'),
    ('guide.strike_warning', 'en', 'traveller', 'A warning on your guide account',
     'A strike was recorded. A second within 12 months pauses new bookings for 14 days. Details: {deep_link}'),
    ('guide.strike_warning', 'ar', 'traveller', 'تنبيه على حسابك كمرشد',
     'سُجّلت مخالفة. مخالفة ثانية خلال 12 شهراً توقف الحجوزات الجديدة 14 يوماً. التفاصيل: {deep_link}'),
    ('guide.strike_warning', 'fr', 'traveller', 'Un avertissement sur votre compte guide',
     'Un avertissement a été enregistré. Un second en 12 mois suspend les nouvelles réservations 14 jours. Détails : {deep_link}'),
    ('guide.paused', 'en', 'traveller', 'New bookings are paused until {status}',
     'Two strikes within 12 months pause new bookings for 14 days. Existing bookings stand. Details: {deep_link}'),
    ('guide.paused', 'ar', 'traveller', 'الحجوزات الجديدة متوقفة حتى {status}',
     'مخالفتان خلال 12 شهراً توقفان الحجوزات الجديدة 14 يوماً. تبقى الحجوزات القائمة. التفاصيل: {deep_link}'),
    ('guide.paused', 'fr', 'traveller', 'Nouvelles réservations suspendues jusqu''au {status}',
     'Deux avertissements en 12 mois suspendent les nouvelles réservations 14 jours. Les réservations existantes restent. Détails : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

REVOKE ALL ON FUNCTION
    app.write_guide_review_full(uuid, uuid, uuid, integer, text, jsonb),
    app.guide_reply_to_review(uuid, uuid, text),
    app.guide_quality_stats(uuid),
    app.guide_recompute_levels(),
    app.guide_apply_strikes(uuid),
    app.guide_my_quality(uuid),
    app.admin_guide_quality(uuid, jsonb),
    app.admin_add_guide_strike(uuid, uuid, jsonb),
    app.admin_void_guide_strike(uuid, uuid, text),
    app.admin_guide_reviews(uuid, jsonb),
    app.admin_moderate_guide_review(uuid, uuid, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.guide_review_parts_json(app.guide_reviews),
    app.write_guide_review_full(uuid, uuid, uuid, integer, text, jsonb),
    app.guide_reply_to_review(uuid, uuid, text),
    app.public_guide_reviews(text),
    app.guide_review_inbox(uuid),
    app.guide_quality_stats(uuid),
    app.guide_level_rank(text),
    app.guide_level_thresholds(),
    app.guide_level_earned(jsonb),
    app.guide_rank_parts(jsonb, text),
    app.guide_level(uuid),
    app.guide_rank_score(uuid),
    app.guide_recompute_levels(),
    app.guide_active_strikes(uuid),
    app.guide_paused(uuid),
    app.guide_apply_strikes(uuid),
    app.guide_strike_json(app.guide_strikes),
    app.guide_my_quality(uuid),
    app.admin_guide_quality(uuid, jsonb),
    app.admin_add_guide_strike(uuid, uuid, jsonb),
    app.admin_void_guide_strike(uuid, uuid, text),
    app.admin_guide_reviews(uuid, jsonb),
    app.admin_moderate_guide_review(uuid, uuid, text, text),
    app.guide_profile_json(uuid, boolean),
    app.tour_card_json(uuid),
    app.public_tour(text),
    app.public_tours_search(jsonb)
TO mshwar_backend;
