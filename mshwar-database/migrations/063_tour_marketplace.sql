-- 063_tour_marketplace.sql
-- Guide plan, step 4: the tours marketplace.
--
-- Travellers find tours in one place (/tours) with filters, open a tour page with photos,
-- highlights, the route on a map, what is included, accessibility, the guide and real
-- reviews, and see guided tours on each destination page. Nothing here is invented:
-- photos are only approved ones, ratings only come from released reviews, and a tour is
-- listed only when it is published by an approved guide.

-- ---- What a tour page says beyond the listing ------------------------------------------
ALTER TABLE app.guide_tours
    ADD COLUMN IF NOT EXISTS highlights text[] NOT NULL DEFAULT '{}'
        CHECK (cardinality(highlights) <= 8),
    ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(faq) = 'array' AND jsonb_array_length(faq) <= 10),
    ADD COLUMN IF NOT EXISTS accessibility text NOT NULL DEFAULT '' CHECK (length(accessibility) <= 1000);

CREATE OR REPLACE FUNCTION app.guide_set_tour_content(p_user uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_highlights text[];
    v_faq jsonb := '[]'::jsonb;
    v_item jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id AND status <> 'archived'
    ) THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT coalesce(array_agg(left(btrim(h), 140)) FILTER (WHERE length(btrim(h)) >= 2), '{}')
    INTO v_highlights
    FROM jsonb_array_elements_text(coalesce(p_payload->'highlights', '[]'::jsonb)) AS h;
    IF cardinality(v_highlights) > 8 THEN
        RAISE EXCEPTION 'at most 8 highlights' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'faq', '[]'::jsonb)) LOOP
        CONTINUE WHEN length(btrim(coalesce(v_item->>'question', ''))) < 3
            OR length(btrim(coalesce(v_item->>'answer', ''))) < 2;
        v_faq := v_faq || jsonb_build_array(jsonb_build_object(
            'question', left(btrim(v_item->>'question'), 200),
            'answer', left(btrim(v_item->>'answer'), 1000)
        ));
    END LOOP;
    IF jsonb_array_length(v_faq) > 10 THEN
        RAISE EXCEPTION 'at most 10 questions' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_tours
    SET highlights = v_highlights,
        faq = v_faq,
        accessibility = left(btrim(coalesce(p_payload->>'accessibility', '')), 1000),
        updated_at = now()
    WHERE experience_id = p_experience;
    RETURN jsonb_build_object(
        'highlights', to_jsonb(v_highlights),
        'faq', v_faq,
        'accessibility', left(btrim(coalesce(p_payload->>'accessibility', '')), 1000)
    );
END;
$$;

-- ---- Real ratings and approved photos only -------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_rating(p_guide uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object('count', count(x.id), 'average', round(avg(x.rating)::numeric, 1))
    FROM app.guide_reviews x
    WHERE x.guide_profile_id = p_guide AND x.direction = 'traveller_to_guide'
      AND x.hidden_at IS NULL AND app.guide_review_released(x.id);
$$;

CREATE OR REPLACE FUNCTION app.tour_photos(p_experience uuid, p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'provider', m.provider, 'object_key', m.object_key, 'alt_text', m.alt_text
    ) ORDER BY m.sort_order, m.id), '[]'::jsonb)
    FROM (
        SELECT * FROM app.media m
        WHERE m.experience_id = p_experience AND m.moderation = 'approved'
        ORDER BY m.sort_order, m.id
        LIMIT greatest(1, least(p_limit, 20))
    ) m;
$$;

-- The first bookable start from now, for "next date" on a card and for sorting.
CREATE OR REPLACE FUNCTION app.tour_next_start(p_experience uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT min(s.starts_at)
    FROM (
        SELECT s.id, s.starts_at FROM app.slots s
        WHERE s.experience_id = p_experience AND s.status = 'open'
          AND s.starts_at > now() AND s.reserved < s.capacity
        ORDER BY s.starts_at
        LIMIT 20
    ) s
    WHERE app.guide_slot_clash(s.id) IS NULL;
$$;

-- One card on the marketplace, a destination page or the sitemap.
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
            'founding_number', g.founding_number, 'tier', g.tier
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

-- ---- The marketplace ------------------------------------------------------------------------
-- Filters: q (words in the title or description), destination (slug), language, date (a
-- bookable start that day in Beirut), max_duration (minutes), max_price (minor units, per
-- person or group as published), instant (true), sort: recommended | price | duration | soonest.
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
        SELECT e.id, e.title, e.duration_minutes, app.tour_card_json(e.id) AS card
        FROM app.experiences e
        JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
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
        -- Recommended: tours someone can book soon, then real ratings (with enough of them to
        -- mean something), then those with photos, then the most recent.
        CASE WHEN v_sort = 'recommended' THEN (card->>'next_start') IS NULL END ASC,
        CASE WHEN v_sort = 'recommended' THEN
            (coalesce((card->'rating'->>'average')::numeric, 0) * (card->'rating'->>'count')::numeric + 4.5 * 5)
            / ((card->'rating'->>'count')::numeric + 5)
        END DESC NULLS LAST,
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

-- Guided tours starting in one destination, for its page.
CREATE OR REPLACE FUNCTION app.public_destination_tours(p_destination text, p_limit integer DEFAULT 6)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(app.public_tours_search(jsonb_build_object(
        'destination', p_destination, 'limit', least(greatest(p_limit, 1), 12)
    ))->'tours', '[]'::jsonb);
$$;

-- Every listed tour, for the sitemap.
CREATE OR REPLACE FUNCTION app.public_tour_slugs()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('slug', e.slug, 'updated_at', e.updated_at) ORDER BY e.slug), '[]'::jsonb)
    FROM app.experiences e
    JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
    JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE e.status = 'published';
$$;

-- ---- One tour page, now complete -------------------------------------------------------------
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
            'founding_number', g.founding_number, 'headline', g.headline, 'languages', to_jsonb(g.languages)
        ),
        'updated_at', e.updated_at
    )
    FROM app.experiences e
    JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE e.slug = p_slug AND e.status = 'published';
$$;

-- The guide's own view carries the page content, so the builder can edit it.
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
            'booking', app.tour_booking_terms(p_experience),
            'content', jsonb_build_object(
                'highlights', to_jsonb(coalesce(v_tour.highlights, '{}'::text[])),
                'faq', coalesce(v_tour.faq, '[]'::jsonb),
                'accessibility', coalesce(v_tour.accessibility, '')
            )
        );
END;
$$;

REVOKE ALL ON FUNCTION
    app.guide_set_tour_content(uuid, uuid, jsonb),
    app.guide_rating(uuid),
    app.tour_photos(uuid, integer),
    app.tour_next_start(uuid),
    app.tour_card_json(uuid),
    app.public_tours_search(jsonb),
    app.public_destination_tours(text, integer),
    app.public_tour_slugs()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.guide_set_tour_content(uuid, uuid, jsonb),
    app.guide_rating(uuid),
    app.tour_photos(uuid, integer),
    app.tour_next_start(uuid),
    app.tour_card_json(uuid),
    app.public_tours_search(jsonb),
    app.public_destination_tours(text, integer),
    app.public_tour_slugs(),
    app.public_tour(text),
    app.guide_tour_json(uuid, uuid)
TO mshwar_backend;
