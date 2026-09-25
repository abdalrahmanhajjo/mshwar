-- 050_intent_phrase_candidates.sql
-- Trip builder v2, phase 1b: the language dataset grows through review (plan, section 3.9).
--
-- Phrases written in bulk - a seed list, generated spelling variants, synthetic paraphrases - land as
-- 'candidate'. The planner never reads a candidate (app.planner_intent_phrases stays approved-only):
-- people approve or reject them in batches, and a rejected phrase is never imported again. Each
-- approved set that goes live is recorded as a release (intent-data-vN) with its eval results and a
-- checksum of exactly which phrases it holds, so a release can be compared and rolled back.

-- ---- 1. Candidates --------------------------------------------------------------------------------
ALTER TABLE app.intent_phrases DROP CONSTRAINT intent_phrases_status_check;
ALTER TABLE app.intent_phrases ADD CONSTRAINT intent_phrases_status_check
    CHECK (status IN ('candidate', 'approved', 'rejected', 'retired'));
ALTER TABLE app.intent_phrases DROP CONSTRAINT intent_phrases_source_check;
ALTER TABLE app.intent_phrases ADD CONSTRAINT intent_phrases_source_check
    CHECK (source IN ('staff', 'traveller_miss', 'reviewed_synthetic', 'seed', 'generated_variant'));
ALTER TABLE app.intent_phrases
    ADD COLUMN batch text NOT NULL DEFAULT '' CHECK (length(batch) <= 60),
    -- For a generated variant: the phrase it was made from, and how ("arabizi 7->h", "typo swap").
    ADD COLUMN variant_of text NOT NULL DEFAULT '' CHECK (length(variant_of) <= 80),
    ADD COLUMN note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
    ADD COLUMN reviewed_by uuid REFERENCES app.users(id),
    ADD COLUMN reviewed_at timestamptz;
-- One row per phrase and concept among what is pending or was turned down.
CREATE UNIQUE INDEX intent_phrases_pending_unique ON app.intent_phrases (lower(phrase), concept)
    WHERE status IN ('candidate', 'rejected');
CREATE INDEX intent_phrases_batch ON app.intent_phrases (batch, status, locale, concept);

-- p_items: [{phrase, concept, locale, source, batch, variant_of, note}], at most 20,000 per call.
-- A phrase already known for that concept - pending, approved, rejected or retired - is skipped.
CREATE FUNCTION app.admin_import_phrase_candidates(p_admin uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_total integer := jsonb_array_length(coalesce(p_items, '[]'::jsonb));
    v_valid integer;
    v_created integer;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_total > 20000 THEN
        RAISE EXCEPTION 'at most 20,000 phrases per import' USING ERRCODE = '22023';
    END IF;
    WITH incoming AS (
        SELECT DISTINCT ON (lower(btrim(i.phrase)), i.concept)
               btrim(i.phrase) AS phrase, i.concept, i.locale, coalesce(i.source, 'seed') AS source,
               left(coalesce(i.batch, ''), 60) AS batch, left(coalesce(i.variant_of, ''), 80) AS variant_of,
               left(coalesce(i.note, ''), 200) AS note
        FROM jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
             AS i(phrase text, concept text, locale text, source text, batch text, variant_of text, note text)
        WHERE btrim(coalesce(i.phrase, '')) <> '' AND length(btrim(i.phrase)) <= 80
          AND i.concept ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
          AND i.locale IN ('en', 'ar', 'ar-LB', 'arabizi', 'fr', 'mixed')
          AND coalesce(i.source, 'seed') IN ('seed', 'generated_variant', 'reviewed_synthetic')
    ), created AS (
        INSERT INTO app.intent_phrases (phrase, concept, locale, status, source, batch, variant_of, note, created_by)
        SELECT n.phrase, n.concept, n.locale, 'candidate', n.source, n.batch, n.variant_of, n.note, p_admin
        FROM incoming n
        WHERE NOT EXISTS (
            SELECT 1 FROM app.intent_phrases p WHERE lower(p.phrase) = lower(n.phrase) AND p.concept = n.concept
        )
        RETURNING 1
    )
    SELECT (SELECT count(*) FROM incoming), (SELECT count(*) FROM created) INTO v_valid, v_created;
    RETURN jsonb_build_object(
        'created', v_created, 'known', v_valid - v_created, 'invalid', v_total - v_valid
    );
END;
$$;

-- Batches and how far their review has got, by language.
CREATE FUNCTION app.admin_phrase_batches(p_admin uuid)
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
            'batch', b.batch, 'candidate', b.candidate, 'approved', b.approved, 'rejected', b.rejected,
            'locales', b.locales, 'first_added', b.first_added
        ) ORDER BY b.first_added DESC)
        FROM (
            SELECT batch,
                   count(*) FILTER (WHERE status = 'candidate')::integer AS candidate,
                   count(*) FILTER (WHERE status = 'approved')::integer AS approved,
                   count(*) FILTER (WHERE status = 'rejected')::integer AS rejected,
                   jsonb_object_agg(DISTINCT locale, true) AS locales,
                   min(created_at) AS first_added
            FROM app.intent_phrases
            WHERE batch <> ''
            GROUP BY batch
        ) b
    ), '[]'::jsonb);
END;
$$;

-- p_filter: {batch, concept, locale, status (default candidate), limit (<= 500), offset}.
CREATE FUNCTION app.admin_list_phrase_candidates(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_status text := coalesce(NULLIF(p_filter->>'status', ''), 'candidate');
    v_limit integer := least(greatest(coalesce(NULLIF(p_filter->>'limit', '')::integer, 100), 1), 500);
    v_offset integer := greatest(coalesce(NULLIF(p_filter->>'offset', '')::integer, 0), 0);
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN (
        WITH matching AS (
            SELECT p.* FROM app.intent_phrases p
            WHERE p.status = v_status
              AND (NULLIF(p_filter->>'batch', '') IS NULL OR p.batch = p_filter->>'batch')
              AND (NULLIF(p_filter->>'concept', '') IS NULL OR p.concept = p_filter->>'concept')
              AND (NULLIF(p_filter->>'locale', '') IS NULL OR p.locale = p_filter->>'locale')
        )
        SELECT jsonb_build_object(
            'total', (SELECT count(*) FROM matching),
            'items', coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', m.id, 'phrase', m.phrase, 'concept', m.concept, 'locale', m.locale,
                    'source', m.source, 'batch', m.batch, 'variant_of', m.variant_of, 'note', m.note,
                    'status', m.status
                ) ORDER BY m.concept, m.locale, m.phrase)
                FROM (SELECT * FROM matching ORDER BY concept, locale, phrase LIMIT v_limit OFFSET v_offset) m
            ), '[]'::jsonb)
        )
    );
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'limit and offset are numbers' USING ERRCODE = '22023';
END;
$$;

-- p_payload: {ids: [uuid, ...] (<= 1000), decision: approve | reject}. Only candidates change.
-- Approving a phrase already approved for the same concept rejects the copy instead.
CREATE FUNCTION app.admin_review_phrase_candidates(p_admin uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_decision text := p_payload->>'decision';
    v_ids uuid[];
    v_approved integer := 0;
    v_rejected integer := 0;
    v_duplicates integer := 0;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF v_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'decision is approve or reject' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(array_agg(DISTINCT value::uuid), '{}') INTO v_ids
    FROM jsonb_array_elements_text(coalesce(p_payload->'ids', '[]'::jsonb));
    IF cardinality(v_ids) = 0 OR cardinality(v_ids) > 1000 THEN
        RAISE EXCEPTION 'choose between 1 and 1,000 phrases' USING ERRCODE = '22023';
    END IF;
    IF v_decision = 'reject' THEN
        UPDATE app.intent_phrases SET status = 'rejected', reviewed_by = p_admin, reviewed_at = now()
        WHERE id = ANY (v_ids) AND status = 'candidate';
        GET DIAGNOSTICS v_rejected = ROW_COUNT;
    ELSE
        -- Same words, same concept, already live (or twice in this selection): the extra copy is turned down.
        UPDATE app.intent_phrases c SET status = 'rejected', note = left('duplicate of an approved phrase', 200),
               reviewed_by = p_admin, reviewed_at = now()
        WHERE c.id = ANY (v_ids) AND c.status = 'candidate'
          AND (
              EXISTS (SELECT 1 FROM app.intent_phrases a
                      WHERE a.status = 'approved' AND lower(a.phrase) = lower(c.phrase) AND a.concept = c.concept)
              OR EXISTS (SELECT 1 FROM app.intent_phrases o
                         WHERE o.id = ANY (v_ids) AND o.status = 'candidate' AND o.id < c.id
                           AND lower(o.phrase) = lower(c.phrase) AND o.concept = c.concept)
          );
        GET DIAGNOSTICS v_duplicates = ROW_COUNT;
        UPDATE app.intent_phrases SET status = 'approved', reviewed_by = p_admin, reviewed_at = now()
        WHERE id = ANY (v_ids) AND status = 'candidate';
        GET DIAGNOSTICS v_approved = ROW_COUNT;
    END IF;
    RETURN jsonb_build_object('approved', v_approved, 'rejected', v_rejected, 'duplicates', v_duplicates);
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'ids must be phrase ids' USING ERRCODE = '22023';
END;
$$;

-- The phrase list the admin screen shows: the 500 latest live or retired - not the thousands pending.
CREATE OR REPLACE FUNCTION app.admin_list_intent_phrases(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(to_jsonb(p) - 'created_by' - 'reviewed_by' ORDER BY p.status, p.concept, p.phrase)
        FROM (
            SELECT * FROM app.intent_phrases
            WHERE status IN ('approved', 'retired')
            ORDER BY coalesce(reviewed_at, created_at) DESC LIMIT 500
        ) p
    ), '[]'::jsonb);
END;
$$;

-- ---- 2. Releases ----------------------------------------------------------------------------------
CREATE TABLE app.intent_data_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version integer NOT NULL UNIQUE CHECK (version > 0),
    approved_phrases integer NOT NULL,
    -- md5 of every approved "phrase|concept", sorted: exactly which phrases this release holds.
    checksum text NOT NULL,
    -- The eval results the API measured with these phrases loaded (case, step and order accuracy).
    metrics jsonb NOT NULL CHECK (jsonb_typeof(metrics) = 'object'),
    note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
    released_by uuid NOT NULL REFERENCES app.users(id),
    released_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.intent_data_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.intent_data_releases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.intent_data_releases FROM PUBLIC, mshwar_backend;
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.intent_data_releases
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

CREATE FUNCTION app.intent_phrases_checksum()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT md5(coalesce(string_agg(lower(phrase) || '|' || concept, E'\n' ORDER BY lower(phrase), concept), ''))
    FROM app.intent_phrases WHERE status = 'approved'
$$;

-- p_payload: {note, metrics}. The API measures the eval with the approved phrases before calling this.
CREATE FUNCTION app.admin_release_intent_data(p_admin uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_row app.intent_data_releases;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF jsonb_typeof(p_payload->'metrics') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'a release needs its eval results' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('app.intent_data_releases'));
    INSERT INTO app.intent_data_releases (version, approved_phrases, checksum, metrics, note, released_by)
    VALUES (
        coalesce((SELECT max(version) FROM app.intent_data_releases), 0) + 1,
        (SELECT count(*) FROM app.intent_phrases WHERE status = 'approved'),
        app.intent_phrases_checksum(),
        p_payload->'metrics',
        left(coalesce(p_payload->>'note', ''), 500),
        p_admin
    )
    RETURNING * INTO v_row;
    RETURN to_jsonb(v_row) - 'released_by' || jsonb_build_object('name', 'intent-data-v' || v_row.version);
END;
$$;

CREATE FUNCTION app.admin_intent_data_releases(p_admin uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'current_checksum', app.intent_phrases_checksum(),
        'approved_phrases', (SELECT count(*) FROM app.intent_phrases WHERE status = 'approved'),
        'releases', coalesce((
            SELECT jsonb_agg(to_jsonb(r) - 'released_by' || jsonb_build_object('name', 'intent-data-v' || r.version)
                             ORDER BY r.version DESC)
            FROM app.intent_data_releases r
        ), '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.admin_import_phrase_candidates(uuid, jsonb),
    app.admin_phrase_batches(uuid),
    app.admin_list_phrase_candidates(uuid, jsonb),
    app.admin_review_phrase_candidates(uuid, jsonb),
    app.intent_phrases_checksum(),
    app.admin_release_intent_data(uuid, jsonb),
    app.admin_intent_data_releases(uuid)
TO mshwar_backend;
