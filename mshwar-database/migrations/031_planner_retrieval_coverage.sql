-- 031_planner_retrieval_coverage.sql
-- The trip builder could only see a fraction of the catalogue.
--
-- app.planner_retrieve_candidates requires `e.embedding IS NOT NULL`, and ranks
-- on `coalesce(e.search_text, title || ' ' || description)`. The curated importer
-- fills neither: it leaves search_text as '' (so coalesce keeps the empty string
-- and the lexical score is always 0) and embedding as NULL (so the row is dropped
-- from retrieval entirely). Every place imported that way was invisible to AI
-- generation - published, browsable, and unreachable by the planner.
--
-- Three parts, all additive:
--   1. One definition of a listing's searchable text, reused everywhere.
--   2. A trigger that fills search_text and embedding whenever a listing is
--      written, so this cannot regress on the next import or portal edit.
--   3. A backfill for what is already there, plus a retrieval function that
--      degrades to lexical scoring instead of dropping a listing that somehow
--      still has no embedding.

-- ---- 1. What a listing is searchable by ---------------------------------------
CREATE OR REPLACE FUNCTION app.experience_search_blob(p_experience uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT btrim(
        concat_ws(' ',
            e.title,
            NULLIF(e.catalogue_summary, ''),
            NULLIF(e.description, ''),
            v.name,
            d.name,
            d.region,
            (SELECT string_agg(t.slug, ' ')
             FROM app.experience_taxonomy et
             JOIN app.taxonomy t ON t.id = et.term_id
             WHERE et.experience_id = e.id)
        )
    )
    FROM app.experiences e
    LEFT JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    WHERE e.id = p_experience;
$$;

-- ---- 2. Keep every listing retrievable, from now on ---------------------------
CREATE OR REPLACE FUNCTION app.experiences_fill_search()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, public
AS $$
DECLARE
    v_blob text;
BEGIN
    -- The row is not visible to the STABLE helper yet on INSERT, so build the
    -- text from the row in hand and fall back to the helper for the joins.
    v_blob := btrim(concat_ws(' ', NEW.title, NULLIF(NEW.catalogue_summary, ''), NULLIF(NEW.description, '')));
    IF coalesce(btrim(NEW.search_text), '') = '' THEN
        NEW.search_text := v_blob;
    END IF;
    IF NEW.embedding IS NULL THEN
        NEW.embedding := app.stub_embedding(coalesce(NULLIF(btrim(NEW.search_text), ''), NEW.title));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiences_fill_search ON app.experiences;
CREATE TRIGGER experiences_fill_search
    BEFORE INSERT OR UPDATE ON app.experiences
    FOR EACH ROW EXECUTE FUNCTION app.experiences_fill_search();

-- ---- 3a. Backfill what is already published ------------------------------------
UPDATE app.experiences e
SET search_text = coalesce(NULLIF(btrim(app.experience_search_blob(e.id)), ''), e.title)
WHERE coalesce(btrim(e.search_text), '') = '';

UPDATE app.experiences e
SET embedding = app.stub_embedding(coalesce(NULLIF(btrim(e.search_text), ''), e.title))
WHERE e.embedding IS NULL;

-- ---- 3b. A missing embedding must not hide a published place -------------------
-- Identical to the definition in 022 apart from three lines: the embedding guard
-- is gone, a NULL embedding scores 0 on the vector side instead of dropping the
-- row, and an empty search_text falls back to the title rather than scoring 0.
CREATE OR REPLACE FUNCTION app.planner_retrieve_candidates(p_constraints jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION app.experience_search_blob(uuid) TO mshwar_backend;
