-- 056_sourced_restaurants_and_stays.sql
-- A day asked for breakfast at a sweets shop, dinner and a night in a hotel, and those steps stayed empty:
-- a restaurant or stay was only planned once Mshwar had visited it, and none has been visited yet.
--
-- The curated catalogue now lists real restaurants and stays with a published point, address and contact,
-- each with the page it came from (app/seed/lebanon_catalogue.py). They can fill a step, marked as coming
-- from a published source and not yet visited ('sourced', with the source link), and they rank below any
-- place Mshwar has visited. Nothing else changes: an owner's restaurant still needs its visit, prices stay
-- on request until published, and hours stay "not confirmed".

ALTER TABLE app.venues ADD COLUMN source_url text CHECK (source_url IS NULL OR source_url ~ '^https://');

-- Kinds of place for the catalogue's restaurants and stays (053's backfill keeps meal kinds for restaurants
-- and stay kinds for stays).
INSERT INTO app.catalogue_tag_place_types (tag, place_type, rank) VALUES
    ('sweets', 'sweets', 10), ('seafood', 'seafood', 10), ('guesthouse', 'guesthouse', 10),
    ('hotel', 'hotel', 10), ('resort', 'resort', 10)
ON CONFLICT (tag) DO NOTHING;

SELECT app.backfill_catalogue_place_types();

-- A restaurant or stay from the curated catalogue, with the published page its facts come from.
CREATE FUNCTION app.venue_is_sourced(p_experience uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT e.status = 'published' AND e.hidden_at IS NULL
           AND e.listing_kind IN ('restaurant', 'hotel')
           AND v.location_source = 'curated' AND v.source_url IS NOT NULL
           AND o.slug = 'mshwar-catalogue'
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.organizations o ON o.id = e.organization_id
        WHERE e.id = p_experience
    ), false)
$$;

REVOKE ALL ON FUNCTION app.venue_is_sourced(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.venue_is_sourced(uuid) TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.planner_step_eligible(p_experience uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT e.status = 'published' AND e.hidden_at IS NULL
           AND o.status = 'active' AND o.verification = 'verified'
           AND d.status = 'published'
           AND (e.listing_kind NOT IN ('restaurant', 'hotel') OR app.venue_is_checked(e.id) OR app.venue_is_sourced(e.id))
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        WHERE e.id = p_experience
    ), false)
$$;

CREATE OR REPLACE FUNCTION app.planner_trust_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'level', CASE
            WHEN e.listing_kind IN ('restaurant', 'hotel') AND app.venue_is_checked(e.id) THEN e.verified_level
            WHEN e.listing_kind IN ('restaurant', 'hotel') AND app.venue_is_sourced(e.id) THEN 'sourced'
            ELSE 'verified_organisation'
        END,
        'source_url', CASE
            WHEN e.listing_kind IN ('restaurant', 'hotel') AND NOT app.venue_is_checked(e.id)
            THEN (SELECT v.source_url FROM app.venues v WHERE v.id = e.venue_id)
        END,
        'checked_on', CASE WHEN e.listing_kind IN ('restaurant', 'hotel') THEN e.checked_on END,
        'review_by', CASE WHEN e.listing_kind IN ('restaurant', 'hotel') THEN e.review_by END
    )
    FROM app.experiences e WHERE e.id = p_experience
$$;

CREATE OR REPLACE FUNCTION app.planner_retrieve_step(p_step jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_role text := p_step->>'role';
    v_meal text := NULLIF(p_step->>'meal', '');
    v_tags text[] := ARRAY(
        SELECT DISTINCT lower(btrim(t))
        FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_step->'tags') = 'array' THEN p_step->'tags' ELSE '[]' END) t
    );
    v_needs text[] := ARRAY(
        SELECT key FROM jsonb_each(CASE WHEN jsonb_typeof(p_step->'needs') = 'object' THEN p_step->'needs' ELSE '{}' END)
        WHERE value = 'true'::jsonb AND key IN (
            'halal', 'vegetarian', 'vegan', 'gluten_free', 'serves_alcohol', 'wheelchair_access', 'step_free',
            'accessible_toilet', 'parking', 'kids_friendly', 'stroller_friendly', 'outdoor_seating', 'accepts_card',
            'accepts_usd_cash', 'accepts_lbp_cash'
        )
    );
    v_views text[];
    v_types text[];
    v_soft text;
    v_q text;
    v_dest text[] := ARRAY(
        SELECT jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(p_step->'destination_slugs') = 'array' THEN p_step->'destination_slugs' ELSE '[]' END)
    );
    v_exclude uuid[];
    v_party integer := NULLIF(p_step->>'party_size', '')::integer;
    v_lat double precision := NULLIF(p_step#>>'{near,lat}', '')::double precision;
    v_lng double precision := NULLIF(p_step#>>'{near,lng}', '')::double precision;
    v_radius integer := least(greatest(coalesce(NULLIF(p_step#>>'{near,radius_m}', '')::integer, 25000), 500), 150000);
    v_limit integer := least(greatest(coalesce(NULLIF(p_step->>'limit', '')::integer, 8), 1), 24);
    v_point geography;
    v_tsq tsquery;
    v_items jsonb;
BEGIN
    IF v_role IS NULL OR v_role NOT IN ('meal', 'sight', 'activity', 'stay', 'service') THEN
        RAISE EXCEPTION 'unknown step role' USING ERRCODE = '22023';
    END IF;
    IF v_meal IS NOT NULL AND v_meal NOT IN ('breakfast', 'brunch', 'lunch', 'dinner', 'snack') THEN
        RAISE EXCEPTION 'unknown meal' USING ERRCODE = '22023';
    END IF;
    IF (v_lat IS NULL) <> (v_lng IS NULL) OR v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'near needs both lat and lng' USING ERRCODE = '22023';
    END IF;
    BEGIN
        v_exclude := ARRAY(
            SELECT x::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(p_step->'exclude_ids') = 'array' THEN p_step->'exclude_ids' ELSE '[]' END) x
        );
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'exclude_ids must be listing ids' USING ERRCODE = '22023';
    END;
    v_types := ARRAY(SELECT t FROM unnest(v_tags) t WHERE EXISTS (
        SELECT 1 FROM app.place_types pt WHERE pt.slug = t AND pt.active));
    v_views := ARRAY(
        SELECT CASE t WHEN 'sea-view' THEN 'sea' WHEN 'mountain-view' THEN 'mountain' WHEN 'view' THEN 'city'
                      ELSE 'sunset' END
        FROM unnest(v_tags) t WHERE t IN ('sea-view', 'mountain-view', 'view', 'sunset')
    );
    v_soft := (SELECT string_agg(replace(t, '-', ' '), ' ') FROM unnest(v_tags) t WHERE NOT (t = ANY (v_types)));
    v_q := btrim(concat_ws(' ', NULLIF(btrim(coalesce(p_step->>'query', '')), ''), v_soft));
    IF v_lat IS NOT NULL THEN
        v_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
    END IF;
    IF v_q <> '' THEN
        BEGIN
            v_tsq := websearch_to_tsquery('simple', v_q);
        EXCEPTION WHEN OTHERS THEN
            v_tsq := NULL;
        END;
    END IF;

    WITH pool AS (
        SELECT e.id,
               app.experience_place_type_slugs(e.id) AS types,
               app.experience_meal_services(e.id) AS meals,
               app.place_facts_json(e.id) AS facts,
               CASE WHEN v_point IS NULL THEN NULL ELSE ST_Distance(v.location, v_point) END AS distance_m,
               CASE WHEN v_tsq IS NULL THEN 0::float4
                    ELSE ts_rank_cd(to_tsvector('simple', coalesce(NULLIF(e.search_text, ''), e.title || ' ' || e.description)), v_tsq)
               END AS fts,
               CASE WHEN v_q = '' OR v_q IS NULL OR e.embedding IS NULL THEN 0::float4
                    ELSE (1 - (e.embedding <=> app.stub_embedding(v_q)))
               END AS vec
        FROM app.experiences e
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        WHERE e.status = 'published'
          AND NOT (e.id = ANY (v_exclude))
          AND (cardinality(v_dest) = 0 OR d.slug = ANY (v_dest)
               OR d.parent_id IN (SELECT pd.id FROM app.destinations pd WHERE pd.slug = ANY (v_dest)))
          AND (v_point IS NULL OR ST_DWithin(v.location, v_point, v_radius))
          AND (v_party IS NULL OR (e.min_party <= v_party AND e.max_party >= v_party))
          AND v_role = ANY (app.experience_roles(e.id))
          AND app.planner_step_eligible(e.id)
    ), fitting AS (
        SELECT p.*,
               (cardinality(v_types) = 0 OR p.types && v_types) AS type_ok,
               (v_meal IS NULL OR v_role <> 'meal' OR v_meal = 'snack' OR cardinality(p.meals) = 0
                OR v_meal = ANY (p.meals) OR (v_meal = 'brunch' AND 'breakfast' = ANY (p.meals))) AS meal_ok,
               (v_role = 'meal' AND v_meal IS NOT NULL AND v_meal <> 'snack' AND cardinality(p.meals) = 0) AS meal_unconfirmed,
               -- A need the place says no to excludes it; unknown needs are kept and listed.
               NOT EXISTS (SELECT 1 FROM unnest(v_needs) n WHERE p.facts->>n = 'false') AS needs_ok,
               ARRAY(SELECT n FROM unnest(v_needs) n WHERE NOT (p.facts ? n)) AS unconfirmed,
               EXISTS (
                   SELECT 1 FROM jsonb_array_elements_text(coalesce(p.facts->'views', '[]')) view
                   WHERE view = ANY (v_views)
               ) AS view_ok
        FROM pool p
    ), ranked AS (
        SELECT f.*,
               (CASE WHEN v_q = '' OR v_q IS NULL THEN 0 ELSE 0.7 * f.fts + 0.3 * greatest(f.vec, 0) END)
               + (CASE WHEN f.distance_m IS NULL THEN 0 ELSE 1 - least(f.distance_m / v_radius, 1) END)
               + (CASE WHEN cardinality(v_types) > 0 AND f.types[1] = ANY (v_types) THEN 0.25 ELSE 0 END)
               + (CASE WHEN f.view_ok THEN 0.3 ELSE 0 END)
               - (CASE WHEN f.meal_unconfirmed THEN 0.2 ELSE 0 END)
               - 0.1 * cardinality(f.unconfirmed)
               -- A place Mshwar has visited comes before one known only from a published source (056).
               - (CASE WHEN app.venue_is_sourced(f.id) AND NOT app.venue_is_checked(f.id) THEN 0.3 ELSE 0 END) AS score
        FROM fitting f
        WHERE f.type_ok AND f.meal_ok AND f.needs_ok
    )
    SELECT coalesce(jsonb_agg(item ORDER BY score DESC, id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT r.id, r.score,
               app.planner_candidate_json(r.id) || jsonb_build_object(
                   'fts', r.fts, 'vec', r.vec, 'hybrid', round(r.score::numeric, 4),
                   'distance_m', CASE WHEN r.distance_m IS NULL THEN NULL ELSE round(r.distance_m::numeric) END,
                   'place_types', to_jsonb(r.types),
                   'meal_services', to_jsonb(r.meals),
                   'meal_unconfirmed', r.meal_unconfirmed,
                   'schedule_note', coalesce((SELECT d.schedule_note FROM app.listing_details d WHERE d.experience_id = r.id), ''),
                   'needs_schedule', EXISTS (SELECT 1 FROM app.place_types pt WHERE pt.slug = ANY (r.types) AND pt.needs_schedule),
                   'trust', app.planner_trust_json(r.id),
                   'place_facts', r.facts,
                   'unconfirmed_needs', to_jsonb(r.unconfirmed)
               ) AS item
        FROM ranked r
        ORDER BY r.score DESC, r.id
        LIMIT v_limit
    ) q;
    RETURN coalesce(v_items, '[]'::jsonb);
EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'check the numbers in this step' USING ERRCODE = '22023';
END;
$$;
