-- 055_towns_in_governorates.sql
-- Every destination shows real places. The curated catalogue hung every real place off one of the eight
-- governorates, so the towns travellers pick most - Byblos, Batroun, Bsharri, the Qadisha Valley, Baalbek -
-- only had the sample listings of 013, and a destination with no published listing is not offered at all.
-- Now a place in a town belongs to the town (app/seed/lebanon_catalogue.py, "town"), each town hangs off its
-- governorate, and a governorate shows its towns' places too: in the destination list and its counts, the
-- listings and search filters, the planner's destination names, and the planner's step search. A town is no
-- longer named by its governorate's name (its region), since the governorate itself now covers it.
-- Only the destination condition of each function changes; the rest is 049/032/031/030/022/014 as they were.

UPDATE app.destinations t
SET parent_id = g.id
FROM (VALUES ('byblos', 'mount-lebanon'), ('batroun', 'north-lebanon'), ('bsharri', 'north-lebanon'),
             ('qadisha-valley', 'north-lebanon'), ('baalbek', 'baalbek-hermel')) AS link(town, governorate)
JOIN app.destinations g ON g.slug = link.governorate
WHERE t.slug = link.town AND t.parent_id IS NULL;

CREATE OR REPLACE FUNCTION app.public_catalogue_destinations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(payload ORDER BY payload->>'name'), '[]'::jsonb)
    FROM (
        SELECT jsonb_build_object(
            'id', d.id,
            'slug', d.slug,
            'name', d.name,
            'region', d.region,
            'country', 'Lebanon',
            'blurb', d.blurb,
            'image', d.image_url,
            'image_alt', d.image_alt,
            'lat', ST_Y(d.location::geometry),
            'lng', ST_X(d.location::geometry),
            'tags', to_jsonb(d.tags),
            'experience_count', (
                SELECT count(*)
                FROM app.venues v
                JOIN app.experiences e ON e.venue_id = v.id
                JOIN app.organizations o ON o.id = e.organization_id
                    AND o.status = 'active' AND o.verification = 'verified'
                WHERE v.destination_id IN (SELECT s.id FROM app.destinations s WHERE s.id = d.id OR s.parent_id = d.id)
                  AND e.status = 'published'
                  AND e.hidden_at IS NULL
            )
        ) AS payload
        FROM app.destinations d
        WHERE d.status = 'published'
          AND EXISTS (
              SELECT 1
              FROM app.venues v
              JOIN app.experiences e ON e.venue_id = v.id
              JOIN app.organizations o ON o.id = e.organization_id
                  AND o.status = 'active' AND o.verification = 'verified'
              WHERE v.destination_id IN (SELECT s.id FROM app.destinations s WHERE s.id = d.id OR s.parent_id = d.id)
                AND e.status = 'published'
                AND e.hidden_at IS NULL
          )
    ) AS rows;
$$;

CREATE OR REPLACE FUNCTION app.planner_destination_terms()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH offered AS (
        SELECT d.id, d.slug, d.name, d.region, d.location
        FROM app.destinations d
        WHERE d.status = 'published'
          AND EXISTS (
              SELECT 1
              FROM app.venues v
              JOIN app.experiences e ON e.venue_id = v.id
              JOIN app.organizations o ON o.id = e.organization_id
                  AND o.status = 'active' AND o.verification = 'verified'
              WHERE v.destination_id IN (SELECT s.id FROM app.destinations s WHERE s.id = d.id OR s.parent_id = d.id)
                AND e.status = 'published'
                AND e.hidden_at IS NULL
          )
    ),
    terms AS (
        SELECT o.slug, o.name AS term, 3 AS weight FROM offered o
        UNION ALL
        SELECT o.slug, replace(o.slug, '-', ' '), 3 FROM offered o
        UNION ALL
        SELECT o.slug, o.region, 1 FROM offered o
        -- A town's region names its governorate, which is offered and includes it (055).
        WHERE o.region <> '' AND NOT EXISTS (SELECT 1 FROM app.destinations x WHERE x.id = o.id AND x.parent_id IS NOT NULL)
        UNION ALL
        SELECT o.slug, t.title, 3
        FROM offered o
        JOIN app.destination_translations t ON t.destination_id = o.id
        UNION ALL
        SELECT o.slug, v.name, 2
        FROM offered o
        JOIN app.venues v ON v.destination_id = o.id
        UNION ALL
        SELECT o.slug, e.title, 2
        FROM offered o
        JOIN app.venues v ON v.destination_id = o.id
        JOIN app.experiences e ON e.venue_id = v.id
        WHERE e.status = 'published' AND e.hidden_at IS NULL
        UNION ALL
        -- A town belongs to whichever offered destination has a published place
        -- closest to it. No slug is written down; the geography decides.
        SELECT nearest.slug, a.name, 3
        FROM app.place_aliases a
        CROSS JOIN LATERAL (
            SELECT o.slug, ST_Distance(v.location, a.location) AS metres
            FROM offered o
            JOIN app.venues v ON v.destination_id = o.id
            JOIN app.experiences e ON e.venue_id = v.id
            JOIN app.organizations og ON og.id = e.organization_id
                AND og.status = 'active' AND og.verification = 'verified'
            WHERE e.status = 'published' AND e.hidden_at IS NULL
            ORDER BY v.location <-> a.location
            LIMIT 1
        ) AS nearest
        WHERE nearest.metres <= 25000
    )
    SELECT coalesce(
        jsonb_agg(jsonb_build_object('slug', slug, 'term', term, 'weight', max_weight)
                  ORDER BY slug, term),
        '[]'::jsonb
    )
    FROM (
        SELECT slug, btrim(term) AS term, max(weight) AS max_weight
        FROM terms
        WHERE term IS NOT NULL AND btrim(term) <> '' AND length(btrim(term)) >= 3
        GROUP BY slug, btrim(term)
    ) AS deduped;
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_experiences(p_q text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_destination text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_available boolean DEFAULT NULL::boolean, p_price_max integer DEFAULT NULL::integer, p_party integer DEFAULT NULL::integer, p_sort text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
RETURNS TABLE(listing jsonb, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH published AS (
        SELECT e.id, e.slug, e.title, e.duration_minutes, e.listing_kind, e.inventory_available,
               e.sample_rating, e.search_text, d.slug AS destination_slug,
               (SELECT t.slug FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' LIMIT 1) AS category,
               (SELECT amount_minor FROM app.current_price_rule(e.id)) AS amount_minor
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND app.catalogue_text_matches(e.search_text, p_q)
          AND (p_category IS NULL OR p_category IN ('', 'all') OR EXISTS (
                SELECT 1 FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' AND t.slug = p_category
          ))
          AND (p_destination IS NULL OR p_destination = '' OR d.slug = p_destination
               OR d.parent_id IN (SELECT pd.id FROM app.destinations pd WHERE pd.slug = p_destination))
          AND (p_kind IS NULL OR p_kind IN ('', 'all') OR e.listing_kind = p_kind)
          AND (p_available IS NOT TRUE OR e.inventory_available)
          AND (p_price_max IS NULL OR (
                SELECT coalesce(amount_minor, 0) FROM app.current_price_rule(e.id)
              ) <= p_price_max * 100)
          AND (p_party IS NULL OR (e.min_party <= p_party AND e.max_party >= p_party))
    ),
    ordered AS (
        SELECT p.*, COUNT(*) OVER () AS total
        FROM published p
        ORDER BY
            CASE WHEN p_sort = 'price' THEN p.amount_minor END ASC NULLS LAST,
            CASE WHEN p_sort = 'duration' THEN p.duration_minutes END ASC,
            CASE WHEN p_sort = 'rating' THEN p.sample_rating END DESC NULLS LAST,
            p.title
    )
    SELECT app.catalogue_listing_row(o.id), o.total
    FROM ordered o
    LIMIT GREATEST(coalesce(p_limit, 24), 1)
    OFFSET GREATEST(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION app.public_catalogue_search(p_q text, p_locale text DEFAULT 'en'::text, p_category text DEFAULT NULL::text, p_destination text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := btrim(coalesce(p_q, ''));
    v_tokens text[] := app.catalogue_search_tokens(v_q);
    v_tsquery tsquery := NULL;
    v_items jsonb;
BEGIN
    BEGIN
        IF cardinality(v_tokens) > 0 THEN
            v_tsquery := to_tsquery(
                'simple',
                array_to_string(ARRAY(SELECT tok || ':*' FROM unnest(v_tokens) AS tok), ' & ')
            );
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_tsquery := NULL;
    END;

    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_tsquery IS NULL THEN 0::float4
                ELSE ts_rank_cd(to_tsvector('simple', e.search_text), v_tsquery)
            END AS fts,
            (1 - (e.embedding <=> app.stub_embedding(v_q))) AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id AND o.status = 'active'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND e.embedding IS NOT NULL
          AND app.catalogue_text_matches(e.search_text, v_q)
          AND (p_category IS NULL OR p_category IN ('', 'all') OR EXISTS (
                SELECT 1 FROM app.experience_taxonomy et
                JOIN app.taxonomy t ON t.id = et.term_id
                WHERE et.experience_id = e.id AND t.kind = 'category' AND t.slug = p_category
          ))
          AND (p_destination IS NULL OR p_destination = '' OR d.slug = p_destination
               OR d.parent_id IN (SELECT pd.id FROM app.destinations pd WHERE pd.slug = p_destination))
          AND (p_kind IS NULL OR p_kind IN ('', 'all') OR e.listing_kind = p_kind)
    )
    SELECT coalesce(jsonb_agg(app.catalogue_listing_row(s.id) || jsonb_build_object(
        'score', round((0.7 * s.fts + 0.3 * greatest(s.vec, 0))::numeric, 4)
    ) ORDER BY (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) DESC, s.id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT * FROM scored
        ORDER BY (0.7 * fts + 0.3 * greatest(vec, 0)) DESC
        LIMIT GREATEST(coalesce(p_limit, 20), 1)
    ) s;

    RETURN jsonb_build_object('items', v_items, 'query', v_q, 'locale', coalesce(p_locale, 'en'));
END;
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
               - 0.1 * cardinality(f.unconfirmed) AS score
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

CREATE OR REPLACE FUNCTION app.planner_retrieve_candidates(p_constraints jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_q text := btrim(coalesce(p_constraints->>'query', p_constraints->>'raw_text', ''));
    v_party integer := NULLIF(p_constraints->>'party_size', '')::integer;
    v_limit integer := GREATEST(coalesce(NULLIF(p_constraints->>'candidate_limit', '')::integer, 24), 1);
    v_items jsonb;
    v_tsq tsquery;
BEGIN
    IF v_q <> '' THEN
        BEGIN
            v_tsq := websearch_to_tsquery('simple', v_q);
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_tsq := plainto_tsquery('simple', v_q);
            EXCEPTION WHEN OTHERS THEN
                v_tsq := NULL;
            END;
        END;
    END IF;
    WITH scored AS (
        SELECT e.id,
            CASE
                WHEN v_tsq IS NULL THEN 0::float4
                -- NULLIF: an empty search_text must fall back to the title, not score 0.
                ELSE ts_rank_cd(
                    to_tsvector('simple', coalesce(NULLIF(e.search_text, ''), e.title || ' ' || e.description)),
                    v_tsq
                )
            END AS fts,
            CASE
                WHEN v_q = '' OR e.embedding IS NULL THEN 0::float4
                ELSE (1 - (e.embedding <=> app.stub_embedding(v_q)))
            END AS vec
        FROM app.experiences e
        JOIN app.organizations o ON o.id = e.organization_id
            AND o.status = 'active' AND o.verification = 'verified'
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id AND d.status = 'published'
        WHERE e.status = 'published'
          AND (v_party IS NULL OR (e.min_party <= v_party AND e.max_party >= v_party))
          AND (
                p_constraints->'destination_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'destination_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'destination_slugs') = 0
                OR d.slug IN (SELECT jsonb_array_elements_text(p_constraints->'destination_slugs'))
                OR d.parent_id IN (SELECT pd.id FROM app.destinations pd
                                   WHERE pd.slug IN (SELECT jsonb_array_elements_text(p_constraints->'destination_slugs')))
          )
          AND (
                p_constraints->'kind_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'kind_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'kind_slugs') = 0
                OR e.listing_kind IN (SELECT jsonb_array_elements_text(p_constraints->'kind_slugs'))
          )
          AND (
                p_constraints->'category_slugs' IS NULL
                OR jsonb_typeof(p_constraints->'category_slugs') <> 'array'
                OR jsonb_array_length(p_constraints->'category_slugs') = 0
                OR EXISTS (
                    SELECT 1 FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                      AND t.slug IN (SELECT jsonb_array_elements_text(p_constraints->'category_slugs'))
                )
          )
    )
    SELECT coalesce(jsonb_agg(item ORDER BY rank DESC, id), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT s.id,
            (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) AS rank,
            jsonb_build_object(
                'id', e.id,
                'slug', e.slug,
                'title', e.title,
                'description', e.description,
                'status', e.status,
                'duration_minutes', e.duration_minutes,
                'min_party', e.min_party,
                'max_party', e.max_party,
                'setting', e.setting,
                'intensity', e.intensity,
                'listing_kind', e.listing_kind,
                'inventory_available', e.inventory_available,
                'destination_slug', d.slug,
                'destination_name', d.name,
                'venue_id', v.id,
                'venue_name', v.name,
                'lat', ST_Y(v.location::geometry),
                'lng', ST_X(v.location::geometry),
                'fts', s.fts,
                'vec', s.vec,
                'hybrid', round((0.7 * s.fts + 0.3 * greatest(s.vec, 0))::numeric, 4),
                'sponsored', EXISTS (
                    SELECT 1 FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'sponsored_label', (
                    SELECT sp.label FROM app.planner_sponsorships sp
                    WHERE sp.experience_id = e.id AND sp.active
                ),
                'category_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind = 'category'
                ), '[]'::jsonb),
                'interest_slugs', coalesce((
                    SELECT jsonb_agg(t.slug ORDER BY t.slug)
                    FROM app.experience_taxonomy et
                    JOIN app.taxonomy t ON t.id = et.term_id
                    WHERE et.experience_id = e.id AND t.kind IN ('interest', 'tag')
                ), '[]'::jsonb),
                'price', jsonb_build_object(
                    'currency', coalesce(pr.currency, 'USD'),
                    'type', coalesce(pr.price_type, 'from'),
                    'source', coalesce(pr.source, 'unknown'),
                    'amount_minor', pr.amount_minor,
                    'unit', coalesce(pr.unit, 'person')
                ),
                'hours', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'weekday', h.weekday, 'opens', h.opens, 'closes', h.closes
                    ) ORDER BY h.weekday)
                    FROM app.opening_hours h WHERE h.venue_id = v.id
                ), '[]'::jsonb),
                'exceptions', coalesce((
                    SELECT jsonb_agg(jsonb_build_object(
                        'local_date', x.local_date, 'closed', x.closed,
                        'opens', x.opens, 'closes', x.closes
                    ))
                    FROM app.opening_exceptions x WHERE x.venue_id = v.id
                ), '[]'::jsonb),
                'facts', coalesce(e.catalogue_facts, '[]'::jsonb)
            ) AS item
        FROM scored s
        JOIN app.experiences e ON e.id = s.id
        JOIN app.venues v ON v.id = e.venue_id
        JOIN app.destinations d ON d.id = v.destination_id
        LEFT JOIN LATERAL (
            SELECT currency, price_type, source, amount_minor, unit
            FROM app.current_price_rule(e.id)
        ) pr ON true
        ORDER BY (0.7 * s.fts + 0.3 * greatest(s.vec, 0)) DESC, e.id
        LIMIT v_limit
    ) q;

    RETURN coalesce(v_items, '[]'::jsonb);
END;
$$;

-- "Bekaa" is how most people spell the Beqaa. An alias belongs to the offered destination nearest to it.
INSERT INTO app.place_aliases (name, locale, location)
SELECT alias.name, 'en', d.location
FROM (VALUES ('Bekaa'), ('Bekaa Valley'), ('Beqaa Valley')) AS alias(name)
JOIN app.destinations d ON d.slug = 'beqaa' AND d.location IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM app.place_aliases a WHERE lower(a.name) = lower(alias.name));

-- Churches in the curated catalogue get the church kind, like the other sights in 053.
INSERT INTO app.catalogue_tag_place_types (tag, place_type, rank) VALUES ('church', 'church', 12)
ON CONFLICT (tag) DO NOTHING;

SELECT app.backfill_catalogue_place_types();
