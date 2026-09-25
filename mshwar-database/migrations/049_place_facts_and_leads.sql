-- 049_place_facts_and_leads.sql
-- Trip builder v2, phase 2b (docs/ai-trip-builder-v2-plan.md, section 3.11).
--
-- 1. Place facts: what a traveller filters on - halal, vegetarian, wheelchair access, a sea view,
--    cards accepted... One row per listing, set by its owner or by staff, with who said it and when.
--    NULL means unknown and stays unknown: a filter keeps an unknown place but says it is unconfirmed,
--    and drops a place only when the fact says no. Facts older than a year are not used.
-- 2. Place leads: places we have heard of (OpenStreetMap, Wikidata, an official list, a guide) but
--    have not checked. Leads are NEVER shown to travellers or planned. Duplicates (same name within
--    75 m) are merged, a rejected lead is never imported again, and the queue is ordered by what
--    travellers asked for and could not get (planner_step_gaps, 048). A lead becomes a listing only
--    when staff publish it after a check - through the same rules as a visited venue (043).

-- ---- 1. Place facts --------------------------------------------------------------------------------
CREATE TABLE app.place_facts (
    experience_id uuid PRIMARY KEY REFERENCES app.experiences(id) ON DELETE CASCADE,
    halal boolean,
    vegetarian boolean,
    vegan boolean,
    gluten_free boolean,
    serves_alcohol boolean,
    wheelchair_access boolean,
    step_free boolean,
    accessible_toilet boolean,
    parking boolean,
    kids_friendly boolean,
    stroller_friendly boolean,
    outdoor_seating boolean,
    accepts_card boolean,
    accepts_usd_cash boolean,
    accepts_lbp_cash boolean,
    min_age integer CHECK (min_age IS NULL OR min_age BETWEEN 0 AND 25),
    views text[] NOT NULL DEFAULT '{}' CHECK (views <@ ARRAY['sea', 'mountain', 'city', 'valley', 'sunset']::text[]),
    languages text[] NOT NULL DEFAULT '{}' CHECK (cardinality(languages) <= 8),
    dress_code text NOT NULL DEFAULT '' CHECK (length(dress_code) <= 120),
    source text NOT NULL CHECK (source IN ('owner', 'staff')),
    checked_on date NOT NULL,
    checked_by uuid NOT NULL REFERENCES app.users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.place_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_facts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.place_facts FROM PUBLIC, mshwar_backend;
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.place_facts
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

-- The facts the planner may use: in date (checked within a year), unknowns left out.
CREATE FUNCTION app.place_facts_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT jsonb_strip_nulls(to_jsonb(f) - 'experience_id' - 'checked_by' - 'updated_at')
               || jsonb_build_object('views', to_jsonb(f.views), 'languages', to_jsonb(f.languages))
        FROM app.place_facts f
        WHERE f.experience_id = p_experience AND f.checked_on >= app.beirut_today() - 365
    ), '{}'::jsonb)
$$;

CREATE FUNCTION app.set_place_facts_unchecked(p_user uuid, p_experience uuid, p_source text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := coalesce(p_payload, '{}'::jsonb);
    v_flag text;
BEGIN
    FOREACH v_flag IN ARRAY ARRAY[
        'halal', 'vegetarian', 'vegan', 'gluten_free', 'serves_alcohol', 'wheelchair_access', 'step_free',
        'accessible_toilet', 'parking', 'kids_friendly', 'stroller_friendly', 'outdoor_seating', 'accepts_card',
        'accepts_usd_cash', 'accepts_lbp_cash'
    ] LOOP
        IF b ? v_flag AND jsonb_typeof(b->v_flag) NOT IN ('boolean', 'null') THEN
            RAISE EXCEPTION '% must be yes, no or unknown', v_flag USING ERRCODE = '22023';
        END IF;
    END LOOP;
    INSERT INTO app.place_facts (
        experience_id, halal, vegetarian, vegan, gluten_free, serves_alcohol, wheelchair_access, step_free,
        accessible_toilet, parking, kids_friendly, stroller_friendly, outdoor_seating, accepts_card,
        accepts_usd_cash, accepts_lbp_cash, min_age, views, languages, dress_code, source, checked_on, checked_by
    ) VALUES (
        p_experience,
        (b->>'halal')::boolean, (b->>'vegetarian')::boolean, (b->>'vegan')::boolean, (b->>'gluten_free')::boolean,
        (b->>'serves_alcohol')::boolean, (b->>'wheelchair_access')::boolean, (b->>'step_free')::boolean,
        (b->>'accessible_toilet')::boolean, (b->>'parking')::boolean, (b->>'kids_friendly')::boolean,
        (b->>'stroller_friendly')::boolean, (b->>'outdoor_seating')::boolean, (b->>'accepts_card')::boolean,
        (b->>'accepts_usd_cash')::boolean, (b->>'accepts_lbp_cash')::boolean,
        NULLIF(b->>'min_age', '')::integer,
        coalesce((SELECT array_agg(DISTINCT lower(value)) FROM jsonb_array_elements_text(coalesce(b->'views', '[]'))), '{}'),
        coalesce((SELECT array_agg(DISTINCT lower(value)) FROM jsonb_array_elements_text(coalesce(b->'languages', '[]'))), '{}'),
        left(btrim(coalesce(b->>'dress_code', '')), 120),
        p_source, app.beirut_today(), p_user
    )
    ON CONFLICT (experience_id) DO UPDATE SET
        halal = EXCLUDED.halal, vegetarian = EXCLUDED.vegetarian, vegan = EXCLUDED.vegan,
        gluten_free = EXCLUDED.gluten_free, serves_alcohol = EXCLUDED.serves_alcohol,
        wheelchair_access = EXCLUDED.wheelchair_access, step_free = EXCLUDED.step_free,
        accessible_toilet = EXCLUDED.accessible_toilet, parking = EXCLUDED.parking,
        kids_friendly = EXCLUDED.kids_friendly, stroller_friendly = EXCLUDED.stroller_friendly,
        outdoor_seating = EXCLUDED.outdoor_seating, accepts_card = EXCLUDED.accepts_card,
        accepts_usd_cash = EXCLUDED.accepts_usd_cash, accepts_lbp_cash = EXCLUDED.accepts_lbp_cash,
        min_age = EXCLUDED.min_age, views = EXCLUDED.views, languages = EXCLUDED.languages,
        dress_code = EXCLUDED.dress_code, source = EXCLUDED.source, checked_on = EXCLUDED.checked_on,
        checked_by = EXCLUDED.checked_by, updated_at = now();
    RETURN app.place_facts_json(p_experience);
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'views are sea, mountain, city, valley or sunset; check the age and languages'
            USING ERRCODE = '22023';
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'check the yes/no answers and the minimum age' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION app.portal_set_place_facts(p_user uuid, p_org uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_capability(p_user, p_org, 'listings');
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = p_org) THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.organization_id', p_org::text, true);
    RETURN app.set_place_facts_unchecked(p_user, p_experience, 'owner', p_payload);
END;
$$;

CREATE FUNCTION app.admin_set_place_facts(p_admin uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_org uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT organization_id INTO v_org FROM app.experiences WHERE id = p_experience;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.organization_id', v_org::text, true);
    RETURN app.set_place_facts_unchecked(p_admin, p_experience, 'staff', p_payload);
END;
$$;

-- ---- 2. Candidates for one step, now filtering on facts ------------------------------------------
-- Same as 045, plus p_step.needs: {halal, vegetarian, vegan, gluten_free, wheelchair_access, step_free,
-- kids_friendly, ...: true}. A place whose fact says no is dropped; an unknown one is kept and listed in
-- 'unconfirmed'. A view asked for (sea-view, mountain-view, sunset) ranks places that have it.
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
          AND (cardinality(v_dest) = 0 OR d.slug = ANY (v_dest))
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

-- ---- 3. Place leads ------------------------------------------------------------------------------
CREATE TABLE app.place_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL CHECK (source IN ('osm', 'wikidata', 'official_list', 'guide', 'staff')),
    external_id text NOT NULL CHECK (btrim(external_id) <> '' AND length(external_id) <= 120),
    name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 200),
    name_ar text NOT NULL DEFAULT '' CHECK (length(name_ar) <= 200),
    name_fr text NOT NULL DEFAULT '' CHECK (length(name_fr) <= 200),
    location geography(Point, 4326) NOT NULL,
    place_type text REFERENCES app.place_types(slug),
    destination_id uuid REFERENCES app.destinations(id),
    raw jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'checking', 'published', 'rejected', 'duplicate')),
    reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 500),
    duplicate_of uuid REFERENCES app.place_leads(id),
    experience_id uuid REFERENCES app.experiences(id),
    reviewed_by uuid REFERENCES app.users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source, external_id)
);
CREATE INDEX place_leads_location_idx ON app.place_leads USING gist (location);
CREATE INDEX place_leads_queue_idx ON app.place_leads (status, destination_id, place_type);
ALTER TABLE app.place_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_leads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.place_leads FROM PUBLIC, mshwar_backend;
CREATE TRIGGER audit AFTER UPDATE OR DELETE ON app.place_leads
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

CREATE FUNCTION app.lead_json(p_lead uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', l.id, 'source', l.source, 'external_id', l.external_id,
        'name', l.name, 'name_ar', l.name_ar, 'name_fr', l.name_fr,
        'lat', ST_Y(l.location::geometry), 'lng', ST_X(l.location::geometry),
        'place_type', l.place_type, 'destination_slug', d.slug, 'status', l.status, 'reason', l.reason,
        'duplicate_of', l.duplicate_of, 'experience_id', l.experience_id, 'created_at', l.created_at,
        'raw', l.raw
    )
    FROM app.place_leads l LEFT JOIN app.destinations d ON d.id = l.destination_id
    WHERE l.id = p_lead
$$;

-- p_leads: [{source, external_id, name, name_ar, name_fr, lat, lng, place_type, destination_slug, raw}].
-- New leads land as 'new'; the same place under another id, or already listed, as 'duplicate';
-- a lead already known (any status, rejected included) is left as it is - never imported again.
CREATE FUNCTION app.admin_import_leads(p_admin uuid, p_leads jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_lead jsonb;
    v_point geography;
    v_name text;
    v_dup uuid;
    v_listed boolean;
    v_created integer := 0;
    v_duplicates integer := 0;
    v_known integer := 0;
    v_invalid integer := 0;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF jsonb_typeof(p_leads) <> 'array' OR jsonb_array_length(p_leads) > 5000 THEN
        RAISE EXCEPTION 'send up to 5000 leads at a time' USING ERRCODE = '22023';
    END IF;
    FOR v_lead IN SELECT value FROM jsonb_array_elements(p_leads)
    LOOP
        BEGIN
            v_name := btrim(coalesce(v_lead->>'name', ''));
            IF EXISTS (SELECT 1 FROM app.place_leads
                       WHERE source = v_lead->>'source' AND external_id = v_lead->>'external_id') THEN
                v_known := v_known + 1;
                CONTINUE;
            END IF;
            IF (v_lead->>'lat')::double precision NOT BETWEEN 33.0 AND 34.8
               OR (v_lead->>'lng')::double precision NOT BETWEEN 35.0 AND 36.7 THEN
                v_invalid := v_invalid + 1;
                CONTINUE;
            END IF;
            v_point := ST_SetSRID(ST_MakePoint((v_lead->>'lng')::double precision, (v_lead->>'lat')::double precision), 4326)::geography;
            -- The same place: a similar name within 75 m, as a lead or as a listing.
            SELECT l.id INTO v_dup FROM app.place_leads l
            WHERE l.status <> 'duplicate' AND ST_DWithin(l.location, v_point, 75)
              AND similarity(lower(l.name), lower(v_name)) >= 0.5
            ORDER BY ST_Distance(l.location, v_point) LIMIT 1;
            v_listed := EXISTS (
                SELECT 1 FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id
                WHERE ST_DWithin(v.location, v_point, 75) AND similarity(lower(e.title), lower(v_name)) >= 0.5
            );
            INSERT INTO app.place_leads (source, external_id, name, name_ar, name_fr, location, place_type,
                                         destination_id, raw, status, duplicate_of, reason)
            VALUES (
                v_lead->>'source', v_lead->>'external_id', v_name,
                btrim(coalesce(v_lead->>'name_ar', '')), btrim(coalesce(v_lead->>'name_fr', '')), v_point,
                (SELECT slug FROM app.place_types WHERE slug = v_lead->>'place_type' AND active),
                (SELECT id FROM app.destinations WHERE slug = v_lead->>'destination_slug'),
                coalesce(v_lead->'raw', '{}'::jsonb),
                CASE WHEN v_dup IS NOT NULL OR v_listed THEN 'duplicate' ELSE 'new' END,
                v_dup,
                CASE WHEN v_listed THEN 'already listed' WHEN v_dup IS NOT NULL THEN 'same place as another lead' ELSE '' END
            );
            IF v_dup IS NOT NULL OR v_listed THEN
                v_duplicates := v_duplicates + 1;
            ELSE
                v_created := v_created + 1;
            END IF;
        EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
            v_invalid := v_invalid + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('created', v_created, 'duplicates', v_duplicates, 'known', v_known, 'invalid', v_invalid);
END;
$$;

-- The queue: leads of the kinds travellers asked for and could not get, in those places, first.
CREATE FUNCTION app.admin_list_leads(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text := coalesce(NULLIF(p_filter->>'status', ''), 'new');
    v_limit integer := least(greatest(coalesce(NULLIF(p_filter->>'limit', '')::integer, 50), 1), 200);
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(app.lead_json(q.id) || jsonb_build_object('demand', q.demand) ORDER BY q.demand DESC, q.created_at)
        FROM (
            SELECT l.id, l.created_at, coalesce((
                SELECT sum(g.count) FROM app.planner_step_gaps g
                WHERE g.day >= app.beirut_today() - 90 AND g.tag = l.place_type
                  AND (g.destination_slug = d.slug OR g.destination_slug = '')
            ), 0)::integer AS demand
            FROM app.place_leads l LEFT JOIN app.destinations d ON d.id = l.destination_id
            WHERE l.status = v_status
              AND (NULLIF(p_filter->>'destination', '') IS NULL OR d.slug = p_filter->>'destination')
              AND (NULLIF(p_filter->>'place_type', '') IS NULL OR l.place_type = p_filter->>'place_type')
            ORDER BY 3 DESC, l.created_at
            LIMIT v_limit
        ) q
    ), '[]'::jsonb);
END;
$$;

-- {decision: checking | rejected | duplicate, reason}. A rejected lead keeps its reason and is never re-imported.
CREATE FUNCTION app.admin_decide_lead(p_admin uuid, p_lead uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_decision text := p_payload->>'decision';
    v_reason text := btrim(coalesce(p_payload->>'reason', ''));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_decision NOT IN ('checking', 'rejected', 'duplicate') THEN
        RAISE EXCEPTION 'choose checking, rejected or duplicate' USING ERRCODE = '22023';
    END IF;
    IF v_decision IN ('rejected', 'duplicate') AND length(v_reason) < 3 THEN
        RAISE EXCEPTION 'say why' USING ERRCODE = '22023';
    END IF;
    UPDATE app.place_leads
    SET status = v_decision, reason = left(v_reason, 500), reviewed_by = p_admin, reviewed_at = now()
    WHERE id = p_lead AND status IN ('new', 'checking', 'duplicate');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'lead not found or already published' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.lead_json(p_lead);
END;
$$;

-- Publish a checked lead as a listing of the Mshwar catalogue. payload: {description (20+), notes (what
-- was checked, 10+), destination (slug, if the lead has none), place_type (if the lead has none),
-- setting, duration_minutes}. Restaurants and stays are published as checked by Mshwar (043 rules);
-- prices stay "on request" until an owner or a sourced price (047) sets them.
CREATE FUNCTION app.admin_publish_lead(p_admin uuid, p_lead uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := coalesce(p_payload, '{}'::jsonb);
    v_lead app.place_leads;
    v_org uuid;
    v_dest uuid;
    v_type app.place_types;
    v_kind text;
    v_venue uuid;
    v_exp uuid;
    v_slug text;
    v_n integer := 1;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_lead FROM app.place_leads WHERE id = p_lead FOR UPDATE;
    IF v_lead.id IS NULL OR v_lead.status NOT IN ('new', 'checking') THEN
        RAISE EXCEPTION 'lead not found or not open' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_type FROM app.place_types
    WHERE slug = coalesce(NULLIF(b->>'place_type', ''), v_lead.place_type) AND active;
    IF v_type.slug IS NULL THEN
        RAISE EXCEPTION 'choose what kind of place this is' USING ERRCODE = '22023';
    END IF;
    v_dest := coalesce(v_lead.destination_id, (SELECT id FROM app.destinations WHERE slug = b->>'destination'));
    IF v_dest IS NULL THEN
        RAISE EXCEPTION 'choose the destination' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'description', ''))) < 20 THEN
        RAISE EXCEPTION 'give a description of at least 20 characters' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'notes', ''))) < 10 THEN
        RAISE EXCEPTION 'note what you checked, and how' USING ERRCODE = '22023';
    END IF;
    v_kind := CASE v_type.role WHEN 'meal' THEN 'restaurant' WHEN 'stay' THEN 'hotel'
                               WHEN 'sight' THEN 'attraction' ELSE 'experience' END;
    SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';
    PERFORM set_config('app.organization_id', v_org::text, true);
    INSERT INTO app.venues (organization_id, destination_id, name, address, timezone, location, location_source, source_reference)
    VALUES (v_org, v_dest, v_lead.name, coalesce(NULLIF(btrim(b->>'address'), ''), v_lead.name), 'Asia/Beirut',
            v_lead.location, 'lead-check', 'lead:' || v_lead.source || ':' || v_lead.external_id)
    RETURNING id INTO v_venue;
    v_slug := app.slugify(v_lead.name);
    WHILE EXISTS (SELECT 1 FROM app.experiences WHERE slug = v_slug) LOOP
        v_n := v_n + 1;
        v_slug := app.slugify(v_lead.name) || '-' || v_n;
    END LOOP;
    INSERT INTO app.experiences (
        organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, min_party,
        max_party, setting, weather_sensitivity, listing_kind, inventory_available, catalogue_summary, catalogue_facts,
        verified_level, checked_on, checked_by, review_by, check_notes
    ) VALUES (
        v_org, v_venue, v_slug, v_lead.name, btrim(b->>'description'), 'published', 'inquiry',
        coalesce(NULLIF(b->>'duration_minutes', '')::integer, v_type.default_minutes), 1, 20,
        coalesce(NULLIF(b->>'setting', ''), CASE WHEN v_type.place_group IN ('nature', 'sport') THEN 'outdoor' ELSE 'indoor' END),
        CASE WHEN v_type.place_group IN ('nature', 'sport') THEN 'outdoor' ELSE 'indoor' END,
        v_kind, true, left(btrim(b->>'description'), 280), '[]'::jsonb,
        CASE WHEN v_kind IN ('restaurant', 'hotel') THEN 'checked_by_mshwar' END,
        app.beirut_today(), p_admin,
        CASE WHEN v_kind IN ('restaurant', 'hotel') THEN app.beirut_today() + 180 END,
        left(btrim(b->>'notes'), 2000)
    ) RETURNING id INTO v_exp;
    INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
    VALUES (v_exp, 'USD', 'quote-required', 'person', NULL, '(,)', 'lead');
    INSERT INTO app.experience_translations (experience_id, locale, title, description)
    SELECT v_exp, locale, title, btrim(b->>'description')
    FROM (VALUES ('en', v_lead.name), ('ar', NULLIF(v_lead.name_ar, '')), ('fr', NULLIF(v_lead.name_fr, ''))) t(locale, title)
    WHERE title IS NOT NULL
    ON CONFLICT (experience_id, locale) DO NOTHING;
    INSERT INTO app.experience_place_types (experience_id, place_type, is_primary) VALUES (v_exp, v_type.slug, true);
    UPDATE app.place_leads SET status = 'published', experience_id = v_exp, reviewed_by = p_admin, reviewed_at = now()
    WHERE id = p_lead;
    RETURN app.lead_json(p_lead) || jsonb_build_object('slug', v_slug, 'listing_kind', v_kind);
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the setting and the visit length' USING ERRCODE = '22023';
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'check the numbers' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION app.set_place_facts_unchecked(uuid, uuid, text, jsonb) FROM PUBLIC, mshwar_backend;
GRANT EXECUTE ON FUNCTION
    app.place_facts_json(uuid),
    app.portal_set_place_facts(uuid, uuid, uuid, jsonb),
    app.admin_set_place_facts(uuid, uuid, jsonb),
    app.lead_json(uuid),
    app.admin_import_leads(uuid, jsonb),
    app.admin_list_leads(uuid, jsonb),
    app.admin_decide_lead(uuid, uuid, jsonb),
    app.admin_publish_lead(uuid, uuid, jsonb)
TO mshwar_backend;
