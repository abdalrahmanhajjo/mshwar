-- 053_catalogue_place_types_from_tags.sql
-- The curated catalogue of real places (app/seed/lebanon_catalogue.py) classifies each place with source-checked
-- tags - castle, waterfall, museum, archaeological-site... - but the day planner searches by kind of place (045),
-- and none of those places had one. So every step of a planned day came back "no trusted place here yet" even
-- where trusted places exist. This maps the tags to kinds of place, once, for listings that have no kind yet:
-- a kind staff or an owner chose is never changed. The catalogue importer runs the same backfill after each import.

CREATE TABLE app.catalogue_tag_place_types (
    tag text PRIMARY KEY CHECK (tag ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    place_type text NOT NULL REFERENCES app.place_types(slug),
    -- Lower is more specific: it becomes the main kind when a place has several tags.
    rank integer NOT NULL CHECK (rank BETWEEN 1 AND 99)
);
ALTER TABLE app.catalogue_tag_place_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.catalogue_tag_place_types FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.catalogue_tag_place_types FROM PUBLIC, mshwar_backend;

INSERT INTO app.catalogue_tag_place_types (tag, place_type, rank) VALUES
    ('museum', 'museum', 10), ('castle', 'castle', 10), ('citadel', 'castle', 11), ('palace', 'palace', 10),
    ('mosque', 'mosque', 10), ('monastery', 'monastery', 10), ('shrine', 'shrine', 12), ('souk', 'souk', 12),
    ('waterfall', 'waterfall', 10), ('cave', 'cave', 10), ('cedars', 'cedars', 10), ('lake', 'lake', 11),
    ('beach', 'beach', 10), ('winery', 'winery', 10), ('ski', 'skiing', 10),
    ('archaeological-site', 'ruins', 14), ('temple', 'ruins', 15), ('roman', 'ruins', 16), ('phoenician', 'ruins', 17),
    ('mountain', 'mountain', 20), ('nature-reserve', 'nature-reserve', 20), ('forest', 'forest', 22),
    ('river', 'river', 22), ('old-town', 'old-town', 20), ('viewpoint', 'viewpoint', 30),
    ('garden', 'park', 30), ('promenade', 'viewpoint', 32), ('hiking', 'hiking', 40)
ON CONFLICT (tag) DO NOTHING;

-- Kinds for listings that have none, from their catalogue tags (at most six, the most specific first).
-- Meal and stay kinds are never given to a listing that is not a restaurant or a stay (045's rule).
CREATE FUNCTION app.backfill_catalogue_place_types()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer;
BEGIN
    WITH untyped AS (
        SELECT e.id, e.listing_kind
        FROM app.experiences e
        WHERE NOT EXISTS (SELECT 1 FROM app.experience_place_types ept WHERE ept.experience_id = e.id)
    ), wanted AS (
        SELECT u.id AS experience_id, m.place_type, min(m.rank) AS rank
        FROM untyped u
        JOIN app.experience_taxonomy et ON et.experience_id = u.id
        JOIN app.taxonomy t ON t.id = et.term_id AND t.kind = 'tag'
        JOIN app.catalogue_tag_place_types m ON m.tag = t.slug
        JOIN app.place_types pt ON pt.slug = m.place_type AND pt.active
        WHERE (u.listing_kind = 'restaurant' AND pt.role = 'meal')
           OR (u.listing_kind = 'hotel' AND pt.role = 'stay')
           OR (u.listing_kind NOT IN ('restaurant', 'hotel') AND pt.role NOT IN ('meal', 'stay'))
        GROUP BY u.id, m.place_type
    ), ranked AS (
        SELECT experience_id, place_type,
               row_number() OVER (PARTITION BY experience_id ORDER BY rank, place_type) AS n
        FROM wanted
    ), inserted AS (
        INSERT INTO app.experience_place_types (experience_id, place_type, is_primary)
        SELECT experience_id, place_type, n = 1 FROM ranked WHERE n <= 6
        ON CONFLICT (experience_id, place_type) DO NOTHING
        RETURNING experience_id
    )
    SELECT count(DISTINCT experience_id) INTO v_count FROM inserted;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION app.backfill_catalogue_place_types() FROM PUBLIC, mshwar_backend;

SELECT app.backfill_catalogue_place_types();
