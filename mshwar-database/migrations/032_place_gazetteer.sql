-- 032_place_gazetteer.sql
-- "A day in Tripoli" found nothing.
--
-- The catalogue names landmarks, not the cities they stand in: Tripoli's places
-- are "Citadel of Raymond de Saint-Gilles" and "Rachid Karami International
-- Fair", and the destination they hang off is called "North Lebanon". So the
-- one word a traveller is most likely to type appears nowhere in the data.
--
-- This adds a gazetteer of Lebanese towns with their real coordinates, and joins
-- each one to the nearest destination that actually has published places. The
-- mapping is computed from geography, not written down: if a Tripoli destination
-- is published later, the alias follows it without another migration.

CREATE TABLE IF NOT EXISTS app.place_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('ar', 'en', 'fr')),
    location geography(Point, 4326) NOT NULL,
    UNIQUE (name, locale)
);

COMMENT ON TABLE app.place_aliases IS
    'Town names a traveller may type. Resolved to a destination by distance, never by a stored slug.';

CREATE INDEX IF NOT EXISTS place_aliases_location_gix ON app.place_aliases USING gist (location);

ALTER TABLE app.place_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.place_aliases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS place_aliases_read ON app.place_aliases;
CREATE POLICY place_aliases_read ON app.place_aliases FOR SELECT USING (true);
GRANT SELECT ON app.place_aliases TO mshwar_backend;

INSERT INTO app.place_aliases (name, locale, location)
SELECT name, locale, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
FROM (VALUES
    ('Beirut', 'en', 35.5018, 33.8938), ('بيروت', 'ar', 35.5018, 33.8938), ('Beyrouth', 'fr', 35.5018, 33.8938),
    ('Tripoli', 'en', 35.8497, 34.4367), ('طرابلس', 'ar', 35.8497, 34.4367), ('Trablous', 'fr', 35.8497, 34.4367),
    ('Sidon', 'en', 35.3729, 33.5571), ('صيدا', 'ar', 35.3729, 33.5571), ('Saida', 'fr', 35.3729, 33.5571),
    ('Tyre', 'en', 35.2038, 33.2705), ('صور', 'ar', 35.2038, 33.2705), ('Sour', 'fr', 35.2038, 33.2705),
    ('Jounieh', 'en', 35.6178, 33.9808), ('جونية', 'ar', 35.6178, 33.9808),
    ('Zahle', 'en', 35.9020, 33.8463), ('زحلة', 'ar', 35.9020, 33.8463), ('Zahlé', 'fr', 35.9020, 33.8463),
    ('Baalbek', 'en', 36.2181, 34.0059), ('بعلبك', 'ar', 36.2181, 34.0059),
    ('Byblos', 'en', 35.6511, 34.1232), ('جبيل', 'ar', 35.6511, 34.1232), ('Jbeil', 'fr', 35.6511, 34.1232),
    ('Batroun', 'en', 35.6581, 34.2553), ('البترون', 'ar', 35.6581, 34.2553),
    ('Bsharri', 'en', 36.0108, 34.2513), ('بشري', 'ar', 36.0108, 34.2513), ('Bcharre', 'fr', 36.0108, 34.2513),
    ('Ehden', 'en', 35.9603, 34.2947), ('إهدن', 'ar', 35.9603, 34.2947),
    ('Zgharta', 'en', 35.8944, 34.3989), ('زغرتا', 'ar', 35.8944, 34.3989),
    ('Chekka', 'en', 35.7167, 34.3167), ('شكا', 'ar', 35.7167, 34.3167),
    ('Amioun', 'en', 35.8083, 34.2986), ('أميون', 'ar', 35.8083, 34.2986),
    ('Halba', 'en', 36.0797, 34.5428), ('حلبا', 'ar', 36.0797, 34.5428),
    ('Hermel', 'en', 36.3856, 34.3925), ('الهرمل', 'ar', 36.3856, 34.3925),
    ('Anjar', 'en', 35.9303, 33.7264), ('عنجر', 'ar', 35.9303, 33.7264),
    ('Rachaya', 'en', 35.8442, 33.5006), ('راشيا', 'ar', 35.8442, 33.5006),
    ('Aley', 'en', 35.5972, 33.8106), ('عاليه', 'ar', 35.5972, 33.8106),
    ('Broummana', 'en', 35.6333, 33.8833), ('برمانا', 'ar', 35.6333, 33.8833),
    ('Faraya', 'en', 35.8167, 34.0167), ('فاريا', 'ar', 35.8167, 34.0167),
    ('Beiteddine', 'en', 35.5811, 33.6939), ('بيت الدين', 'ar', 35.5811, 33.6939),
    ('Deir el Qamar', 'en', 35.5581, 33.6975), ('دير القمر', 'ar', 35.5581, 33.6975),
    ('Jezzine', 'en', 35.5847, 33.5442), ('جزين', 'ar', 35.5847, 33.5442),
    ('Nabatieh', 'en', 35.4839, 33.3789), ('النبطية', 'ar', 35.4839, 33.3789),
    ('Marjayoun', 'en', 35.5917, 33.3606), ('مرجعيون', 'ar', 35.5917, 33.3606),
    ('Hasbaya', 'en', 35.6844, 33.3969), ('حاصبيا', 'ar', 35.6844, 33.3969),
    ('Harissa', 'en', 35.6494, 33.9817), ('حريصا', 'ar', 35.6494, 33.9817),
    ('Jeita', 'en', 35.6414, 33.9434), ('جعيتا', 'ar', 35.6414, 33.9434),
    ('Tannourine', 'en', 35.8969, 34.2069), ('تنورين', 'ar', 35.8969, 34.2069)
) AS seed(name, locale, lng, lat)
ON CONFLICT (name, locale) DO UPDATE SET location = EXCLUDED.location;

-- ---- The term index now includes towns, resolved by distance ------------------
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
              WHERE v.destination_id = d.id
                AND e.status = 'published'
                AND e.hidden_at IS NULL
          )
    ),
    terms AS (
        SELECT o.slug, o.name AS term, 3 AS weight FROM offered o
        UNION ALL
        SELECT o.slug, replace(o.slug, '-', ' '), 3 FROM offered o
        UNION ALL
        SELECT o.slug, o.region, 1 FROM offered o WHERE o.region <> ''
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
