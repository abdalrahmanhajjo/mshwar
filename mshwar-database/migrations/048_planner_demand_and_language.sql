-- 048_planner_demand_and_language.sql
-- Trip builder v2, phases 1b and 6: learn from what travellers ask for, without learning who asked.
--
-- 1. Demand gaps. When no trusted place can fill a step ("bowling in Bsharri"), the kind of place,
--    where, and why are counted per day. No text, no user: only what staff should check next.
-- 2. The language dataset (plan section 3.9). The planner's seed vocabulary lives in code; staff can
--    add phrases here that map to one of its concepts ("7elwe" -> sweets). Only approved phrases are
--    ever used, so nobody can teach the planner by typing.
-- 3. Misses. Parts of a request the planner could not read are counted, redacted by the API, only for
--    travellers who allowed their data to improve Mshwar (personalisation consent), with no user id.
--    Staff review them into phrases or dismiss them. Misses are kept 90 days, gaps a year.

-- ---- 1. Steps no trusted place could fill -----------------------------------------------------
CREATE TABLE app.planner_step_gaps (
    day date NOT NULL,
    destination_slug text NOT NULL DEFAULT '' CHECK (length(destination_slug) <= 80),
    role text NOT NULL CHECK (role IN ('meal', 'sight', 'activity', 'stay', 'service', 'exchange')),
    tag text NOT NULL DEFAULT '' CHECK (tag = '' OR tag ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    meal text NOT NULL DEFAULT '' CHECK (meal IN ('', 'breakfast', 'brunch', 'lunch', 'dinner', 'snack')),
    reason text NOT NULL CHECK (reason ~ '^[a-z_]{3,60}$'),
    count integer NOT NULL DEFAULT 1 CHECK (count > 0),
    PRIMARY KEY (day, destination_slug, role, tag, meal, reason)
);
ALTER TABLE app.planner_step_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.planner_step_gaps FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.planner_step_gaps FROM PUBLIC, mshwar_backend;

-- p_gaps: [{destination_slug, role, tags[], meal, reason}]. Bad entries are skipped, never an error:
-- counting demand must not stop a traveller's plan from being saved.
CREATE FUNCTION app.planner_record_step_gaps(p_gaps jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_gap jsonb;
    v_count integer := 0;
BEGIN
    IF jsonb_typeof(p_gaps) <> 'array' THEN
        RETURN 0;
    END IF;
    FOR v_gap IN SELECT value FROM jsonb_array_elements(p_gaps) LIMIT 12
    LOOP
        BEGIN
            INSERT INTO app.planner_step_gaps (day, destination_slug, role, tag, meal, reason)
            VALUES (
                app.beirut_today(),
                left(coalesce(v_gap->>'destination_slug', ''), 80),
                v_gap->>'role',
                coalesce(v_gap->'tags'->>0, ''),
                coalesce(v_gap->>'meal', ''),
                coalesce(v_gap->>'reason', 'no_trusted_match')
            )
            ON CONFLICT (day, destination_slug, role, tag, meal, reason)
            DO UPDATE SET count = app.planner_step_gaps.count + 1;
            v_count := v_count + 1;
        EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN
            CONTINUE;
        END;
    END LOOP;
    RETURN v_count;
END;
$$;

-- What travellers asked for most that no trusted place could fill, over the last p_days.
CREATE FUNCTION app.admin_step_gaps(p_admin uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(row_to_json(g) ORDER BY g.count DESC, g.destination_slug, g.role, g.tag)
        FROM (
            SELECT destination_slug, role, tag, meal, reason, sum(count)::integer AS count
            FROM app.planner_step_gaps
            WHERE day >= app.beirut_today() - least(greatest(p_days, 1), 365)
            GROUP BY destination_slug, role, tag, meal, reason
            ORDER BY sum(count) DESC
            LIMIT 200
        ) g
    ), '[]'::jsonb);
END;
$$;

-- ---- 2. Approved phrases ----------------------------------------------------------------------
CREATE TABLE app.intent_phrases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase text NOT NULL CHECK (btrim(phrase) <> '' AND length(phrase) <= 80),
    -- A concept of the planner's vocabulary (app/planner/script/vocabulary.py), checked by the API.
    concept text NOT NULL CHECK (concept ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    locale text NOT NULL CHECK (locale IN ('en', 'ar', 'ar-LB', 'arabizi', 'fr', 'mixed')),
    status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'retired')),
    source text NOT NULL CHECK (source IN ('staff', 'traveller_miss', 'reviewed_synthetic')),
    created_by uuid NOT NULL REFERENCES app.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    retired_at timestamptz
);
CREATE UNIQUE INDEX intent_phrases_unique ON app.intent_phrases (lower(phrase), concept) WHERE status = 'approved';
ALTER TABLE app.intent_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.intent_phrases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.intent_phrases FROM PUBLIC, mshwar_backend;
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.intent_phrases
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

-- What the planner reads with, besides its seed vocabulary. Approved only.
CREATE FUNCTION app.planner_intent_phrases()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('phrase', phrase, 'concept', concept, 'locale', locale)
                              ORDER BY concept, phrase), '[]'::jsonb)
    FROM app.intent_phrases WHERE status = 'approved'
$$;

CREATE FUNCTION app.admin_add_intent_phrase(p_admin uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_row app.intent_phrases;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    INSERT INTO app.intent_phrases (phrase, concept, locale, source, created_by)
    VALUES (
        btrim(p_payload->>'phrase'), p_payload->>'concept', coalesce(p_payload->>'locale', 'mixed'),
        coalesce(p_payload->>'source', 'staff'), p_admin
    )
    RETURNING * INTO v_row;
    RETURN to_jsonb(v_row) - 'created_by';
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'that phrase already means this' USING ERRCODE = '22023';
    WHEN check_violation OR not_null_violation THEN
        RAISE EXCEPTION 'a phrase needs its words, a concept and a language' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION app.admin_retire_intent_phrase(p_admin uuid, p_phrase uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_row app.intent_phrases;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    UPDATE app.intent_phrases SET status = 'retired', retired_at = now()
    WHERE id = p_phrase AND status = 'approved' RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'phrase not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN to_jsonb(v_row) - 'created_by';
END;
$$;

CREATE FUNCTION app.admin_list_intent_phrases(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(to_jsonb(p) - 'created_by' ORDER BY p.status, p.concept, p.phrase)
        FROM app.intent_phrases p
    ), '[]'::jsonb);
END;
$$;

-- ---- 3. What the planner could not read --------------------------------------------------------
CREATE TABLE app.intent_misses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Redacted by the API (contacts, numbers and names removed) and checked again here.
    fragment text NOT NULL CHECK (
        btrim(fragment) <> '' AND length(fragment) <= 120
        AND fragment !~ '@' AND fragment !~ '[0-9]{5,}' AND fragment !~* 'https?://'
    ),
    locale text NOT NULL DEFAULT 'mixed',
    count integer NOT NULL DEFAULT 1 CHECK (count > 0),
    first_seen timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    resolved_by uuid REFERENCES app.users(id),
    phrase_id uuid REFERENCES app.intent_phrases(id)
);
CREATE UNIQUE INDEX intent_misses_fragment ON app.intent_misses (lower(fragment));
ALTER TABLE app.intent_misses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.intent_misses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.intent_misses FROM PUBLIC, mshwar_backend;

-- Only with the traveller's personalisation consent; nothing about who they are is kept.
CREATE FUNCTION app.planner_record_intent_misses(p_user uuid, p_fragments jsonb, p_locale text DEFAULT 'mixed')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_fragment text;
    v_count integer := 0;
BEGIN
    IF jsonb_typeof(p_fragments) <> 'array' OR NOT coalesce((
        SELECT personalization_consent FROM app.user_private WHERE user_id = p_user
    ), false) THEN
        RETURN 0;
    END IF;
    FOR v_fragment IN SELECT btrim(value) FROM jsonb_array_elements_text(p_fragments) LIMIT 8
    LOOP
        BEGIN
            INSERT INTO app.intent_misses (fragment, locale) VALUES (v_fragment, left(coalesce(p_locale, 'mixed'), 8))
            ON CONFLICT (lower(fragment)) DO UPDATE
            SET count = app.intent_misses.count + 1, last_seen = now(),
                status = CASE WHEN app.intent_misses.status = 'dismissed' THEN 'dismissed' ELSE 'open' END;
            v_count := v_count + 1;
        EXCEPTION WHEN check_violation OR not_null_violation THEN
            CONTINUE;
        END;
    END LOOP;
    RETURN v_count;
END;
$$;

CREATE FUNCTION app.admin_intent_misses(p_admin uuid, p_status text DEFAULT 'open')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'fragment', m.fragment, 'locale', m.locale, 'count', m.count,
            'first_seen', m.first_seen, 'last_seen', m.last_seen, 'status', m.status
        ) ORDER BY m.count DESC, m.last_seen DESC)
        FROM (SELECT * FROM app.intent_misses WHERE status = coalesce(p_status, 'open')
              ORDER BY count DESC, last_seen DESC LIMIT 200) m
    ), '[]'::jsonb);
END;
$$;

-- Staff decide: {decision: 'phrase', phrase, concept, locale} teaches the planner; {decision: 'dismiss'}.
CREATE FUNCTION app.admin_review_intent_miss(p_admin uuid, p_miss uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_miss app.intent_misses;
    v_phrase jsonb;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_miss FROM app.intent_misses WHERE id = p_miss FOR UPDATE;
    IF v_miss.id IS NULL THEN
        RAISE EXCEPTION 'miss not found' USING ERRCODE = 'P0002';
    END IF;
    IF p_payload->>'decision' = 'dismiss' THEN
        UPDATE app.intent_misses SET status = 'dismissed', resolved_by = p_admin WHERE id = p_miss;
        RETURN jsonb_build_object('id', p_miss, 'status', 'dismissed');
    END IF;
    IF p_payload->>'decision' <> 'phrase' THEN
        RAISE EXCEPTION 'choose to add a phrase or dismiss' USING ERRCODE = '22023';
    END IF;
    v_phrase := app.admin_add_intent_phrase(p_admin, jsonb_build_object(
        'phrase', coalesce(NULLIF(btrim(p_payload->>'phrase'), ''), v_miss.fragment),
        'concept', p_payload->>'concept',
        'locale', coalesce(p_payload->>'locale', v_miss.locale),
        'source', 'traveller_miss'
    ));
    UPDATE app.intent_misses SET status = 'resolved', resolved_by = p_admin, phrase_id = (v_phrase->>'id')::uuid
    WHERE id = p_miss;
    RETURN jsonb_build_object('id', p_miss, 'status', 'resolved', 'phrase', v_phrase);
END;
$$;

-- ---- Retention ---------------------------------------------------------------------------------
CREATE FUNCTION app.planner_data_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_misses integer;
    v_gaps integer;
BEGIN
    DELETE FROM app.intent_misses WHERE status <> 'resolved' AND last_seen < now() - interval '90 days';
    GET DIAGNOSTICS v_misses = ROW_COUNT;
    DELETE FROM app.planner_step_gaps WHERE day < app.beirut_today() - 365;
    GET DIAGNOSTICS v_gaps = ROW_COUNT;
    RETURN jsonb_build_object('intent_misses_deleted', v_misses, 'step_gaps_deleted', v_gaps);
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.planner_record_step_gaps(jsonb),
    app.admin_step_gaps(uuid, integer),
    app.planner_intent_phrases(),
    app.admin_add_intent_phrase(uuid, jsonb),
    app.admin_retire_intent_phrase(uuid, uuid),
    app.admin_list_intent_phrases(uuid),
    app.planner_record_intent_misses(uuid, jsonb, text),
    app.admin_intent_misses(uuid, text),
    app.admin_review_intent_miss(uuid, uuid, jsonb),
    app.planner_data_sweep()
TO mshwar_backend;
