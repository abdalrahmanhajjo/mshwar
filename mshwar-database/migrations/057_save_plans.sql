-- 057_save_plans.sql
-- Every plan the planner made became a trip in "My trips", including the ones the traveller only tried.
-- Now a plan is kept only when they save it and confirm: a trip made by the planner starts unsaved, and
-- "My trips" lists saved trips. A trip the traveller creates themselves, and every trip that exists
-- today, counts as saved. An unsaved plan still works in the planner (its versions, locks and choices);
-- it is simply not listed.

ALTER TABLE app.trips ADD COLUMN saved_at timestamptz DEFAULT now();
UPDATE app.trips SET saved_at = created_at WHERE saved_at IS NULL;

-- Whether the traveller's own trip is saved.
CREATE FUNCTION app.planner_trip_saved(p_user uuid, p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_saved timestamptz;
BEGIN
    SELECT t.saved_at INTO v_saved FROM app.trips t WHERE t.id = p_trip AND t.owner_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('trip_id', p_trip, 'saved', v_saved IS NOT NULL, 'saved_at', v_saved);
END;
$$;

-- Save the traveller's plan to their trips, optionally under a new name. Saving twice keeps the first date.
CREATE FUNCTION app.planner_save_trip(p_user uuid, p_trip uuid, p_title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF length(btrim(coalesce(p_title, ''))) > 120 THEN
        RAISE EXCEPTION 'keep the name under 120 characters' USING ERRCODE = '22023';
    END IF;
    UPDATE app.trips
    SET saved_at = coalesce(saved_at, now()),
        title = coalesce(NULLIF(btrim(p_title), ''), title)
    WHERE id = p_trip AND owner_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN app.planner_trip_saved(p_user, p_trip);
END;
$$;

REVOKE ALL ON FUNCTION app.planner_trip_saved(uuid, uuid), app.planner_save_trip(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.planner_trip_saved(uuid, uuid), app.planner_save_trip(uuid, uuid, text)
    TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.planner_persist_version(p_user uuid, p_trip uuid, p_title text, p_origin text, p_window_start timestamp with time zone, p_return_by timestamp with time zone, p_start_lng double precision, p_start_lat double precision, p_party_size integer, p_budget_minor bigint, p_currency text, p_strict_budget boolean, p_constraints jsonb, p_validation jsonb, p_stops jsonb, p_legs jsonb, p_costs jsonb, p_run jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip uuid := p_trip;
    v_version uuid;
    v_next integer;
    v_stop jsonb;
    v_leg jsonb;
    v_cost jsonb;
    v_exp uuid;
    v_retrieved jsonb;
    v_total bigint := 0;
    v_run uuid;
BEGIN
    IF p_stops IS NULL OR jsonb_typeof(p_stops) <> 'array' OR jsonb_array_length(p_stops) = 0 THEN
        RAISE EXCEPTION 'empty itinerary' USING ERRCODE = '22023';
    END IF;
    v_retrieved := coalesce(p_constraints->'retrieved_ids', '[]'::jsonb);
    IF jsonb_typeof(v_retrieved) <> 'array' THEN
        RAISE EXCEPTION 'retrieved_ids required' USING ERRCODE = '22023';
    END IF;

    IF v_trip IS NULL THEN
        -- A new plan is not kept among the traveller's trips until they save it (057).
        INSERT INTO app.trips (owner_id, title, status, saved_at)
        VALUES (p_user, coalesce(NULLIF(btrim(p_title), ''), 'Untitled plan'), 'draft', NULL)
        RETURNING id INTO v_trip;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM app.trips t WHERE t.id = v_trip AND t.owner_id = p_user) THEN
            RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
        END IF;
        UPDATE app.trips SET title = coalesce(NULLIF(btrim(p_title), ''), title) WHERE id = v_trip;
    END IF;

    SELECT coalesce(max(version), 0) + 1 INTO v_next FROM app.trip_versions WHERE trip_id = v_trip;
    INSERT INTO app.trip_versions (
        trip_id, version, created_by, origin, window_start, return_by, start_location,
        party_size, budget_minor, currency, strict_budget, constraints, validation
    ) VALUES (
        v_trip, v_next, p_user, coalesce(NULLIF(p_origin, ''), 'ai'),
        p_window_start, p_return_by,
        ST_SetSRID(ST_MakePoint(p_start_lng, p_start_lat), 4326)::geography,
        GREATEST(p_party_size, 1), GREATEST(p_budget_minor, 0), coalesce(p_currency, 'USD'),
        coalesce(p_strict_budget, false), coalesce(p_constraints, '{}'::jsonb),
        coalesce(p_validation, '{}'::jsonb)
    ) RETURNING id INTO v_version;

    FOR v_stop IN SELECT value FROM jsonb_array_elements(p_stops)
    LOOP
        v_exp := (v_stop->>'experience_id')::uuid;
        IF NOT (v_retrieved @> jsonb_build_array(v_exp::text) OR v_retrieved @> jsonb_build_array(to_jsonb(v_exp))) THEN
            RAISE EXCEPTION 'stop not in retrieved candidates' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM app.experiences e
            JOIN app.organizations o ON o.id = e.organization_id
            WHERE e.id = v_exp AND e.status = 'published' AND o.status = 'active'
        ) THEN
            RAISE EXCEPTION 'unpublished stop' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.trip_stops (
            version_id, experience_id, position, starts_at, ends_at,
            estimated_minor, price_kind, locked, snapshot
        ) VALUES (
            v_version, v_exp, (v_stop->>'position')::integer,
            (v_stop->>'starts_at')::timestamptz, (v_stop->>'ends_at')::timestamptz,
            GREATEST(coalesce((v_stop->>'estimated_minor')::bigint, 0), 0),
            coalesce(v_stop->>'price_kind', 'estimate'),
            coalesce((v_stop->>'locked')::boolean, false),
            coalesce(v_stop->'snapshot', '{}'::jsonb)
        );
    END LOOP;

    FOR v_leg IN SELECT value FROM jsonb_array_elements(coalesce(p_legs, '[]'::jsonb))
    LOOP
        INSERT INTO app.trip_legs (
            version_id, position, provider, fetched_at, expires_at,
            distance_m, duration_seconds, estimated_minor, status
        ) VALUES (
            v_version, (v_leg->>'position')::integer,
            coalesce(v_leg->>'provider', 'stub'),
            coalesce((v_leg->>'fetched_at')::timestamptz, now()),
            coalesce((v_leg->>'expires_at')::timestamptz, now() + interval '1 hour'),
            NULLIF(v_leg->>'distance_m', '')::integer,
            NULLIF(v_leg->>'duration_seconds', '')::integer,
            GREATEST(coalesce((v_leg->>'estimated_minor')::bigint, 0), 0),
            coalesce(v_leg->>'status', 'available')
        );
    END LOOP;

    FOR v_cost IN SELECT value FROM jsonb_array_elements(coalesce(p_costs, '[]'::jsonb))
    LOOP
        INSERT INTO app.trip_cost_items (version_id, kind, label, amount_minor)
        VALUES (
            v_version,
            coalesce(v_cost->>'kind', 'other'),
            coalesce(v_cost->>'label', 'Item'),
            GREATEST(coalesce((v_cost->>'amount_minor')::bigint, 0), 0)
        );
    END LOOP;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total FROM app.trip_stops WHERE version_id = v_version;
    v_total := v_total
        + coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id = v_version), 0)
        + coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id = v_version), 0);

    UPDATE app.trip_versions
    SET validation = coalesce(p_validation, '{}'::jsonb)
            || jsonb_build_object('feasible', 'true', 'validator_version', 'planner-v1', 'total_minor', v_total),
        sealed_at = now()
    WHERE id = v_version;

    INSERT INTO app.recommendation_runs (
        trip_version_id, user_id, model_version, prompt_version, ranker_version, optimizer_version,
        status, constraints, validation, latency_ms
    ) VALUES (
        v_version, p_user,
        coalesce(p_run->>'model_version', 'stub-llm'),
        coalesce(p_run->>'prompt_version', 'intent-v1'),
        coalesce(p_run->>'ranker_version', 'ranker-v1'),
        coalesce(p_run->>'optimizer_version', 'greedy-v1'),
        coalesce(p_run->>'status', 'succeeded'),
        coalesce(p_constraints, '{}'::jsonb),
        coalesce(p_validation, '{}'::jsonb) || jsonb_build_object('total_minor', v_total),
        NULLIF(p_run->>'latency_ms', '')::integer
    ) RETURNING id INTO v_run;

    INSERT INTO app.recommendation_candidates (run_id, experience_id, rank, score, eligible, sponsored, reasons)
    SELECT v_run, (c->>'experience_id')::uuid, (c->>'rank')::integer, (c->>'score')::double precision,
           coalesce((c->>'eligible')::boolean, true), coalesce((c->>'sponsored')::boolean, false),
           coalesce(c->'reasons', '{}'::jsonb)
    FROM jsonb_array_elements(coalesce(p_run->'candidates', '[]'::jsonb)) AS c
    ON CONFLICT DO NOTHING;

    RETURN app.planner_version_payload(p_user, v_version, true);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_my_trips(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE(id uuid, title text, status text, created_at timestamp with time zone, total bigint, planned_date timestamp with time zone, stop_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH latest AS (
        SELECT DISTINCT ON (tv.trip_id) tv.trip_id, tv.id AS version_id, tv.window_start
        FROM app.trip_versions tv
        ORDER BY tv.trip_id, tv.version DESC
    )
    SELECT
        t.id, t.title, t.status, t.created_at, COUNT(*) OVER (),
        l.window_start AS planned_date,
        coalesce((SELECT count(*) FROM app.trip_stops s WHERE s.version_id = l.version_id), 0) AS stop_count
    FROM app.trips t
    LEFT JOIN latest l ON l.trip_id = t.id
    WHERE t.owner_id = p_user_id AND t.saved_at IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0);
$$;
