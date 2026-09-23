-- 030_destination_coverage.sql
-- Two read-side fixes, both additive:
--   1. The destination list stopped being a hardcoded slug list. A destination is
--      offered when it is published AND holds at least one published experience the
--      trip builder can actually use (active, verified organisation), so
--      the catalogue can never send a traveller somewhere with nothing in it, and a
--      newly imported town appears the moment its first place is published.
--   2. app.planner_destination_terms() indexes every name a traveller might use for
--      a destination - its own name in each locale, its region, its venues and the
--      titles of the places inside it - so the trip builder can resolve "Tripoli",
--      "صيدا" or "Jeita" without a hardcoded list in application code.

-- ---- 1. Destinations are the ones that actually hold experiences --------------
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
                WHERE v.destination_id = d.id
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
              WHERE v.destination_id = d.id
                AND e.status = 'published'
                AND e.hidden_at IS NULL
          )
    ) AS rows;
$$;

-- ---- 2. Every name a destination answers to -----------------------------------
CREATE OR REPLACE FUNCTION app.planner_destination_terms()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    WITH offered AS (
        SELECT d.id, d.slug, d.name, d.region
        FROM app.destinations d
        WHERE d.status = 'published'
          AND EXISTS (
              SELECT 1
              FROM app.venues v
              JOIN app.experiences e ON e.venue_id = v.id
              JOIN app.organizations o ON o.id = e.organization_id
                  AND o.status = 'active' AND o.verification = 'verified'
              WHERE v.destination_id = d.id
                AND e.status = 'published'
                AND e.hidden_at IS NULL
          )
    ),
    terms AS (
        -- The destination's own identity, in every locale it is translated into.
        SELECT o.slug, o.name AS term, 3 AS weight FROM offered o
        UNION ALL
        SELECT o.slug, replace(o.slug, '-', ' '), 3 FROM offered o
        UNION ALL
        SELECT o.slug, o.region, 1 FROM offered o WHERE o.region <> ''
        UNION ALL
        SELECT o.slug, t.title, 3
        FROM offered o
        JOIN app.destination_translations t ON t.destination_id = o.id
        -- The places inside it: "Jeita", "sea castle", "Tripoli" all live here.
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

GRANT EXECUTE ON FUNCTION app.planner_destination_terms() TO mshwar_backend;
