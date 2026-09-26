-- 054_planner_leisure_places.sql
-- The curated catalogue now lists cinemas and bowling alleys (app/seed/lebanon_catalogue.py), each with its source.
-- 1. Their tags become kinds of place the day planner can search, the same way as 053. Kinds staff or an owner
--    chose are never changed; the backfill only gives kinds to listings that have none.
-- 2. When a day in a town finds nothing of a kind ("a cinema in Batroun"), the planner looks around the town
--    and marks what it finds as outside it. The town's point is public, but the API role cannot read the
--    destinations table directly, so this reads it.

INSERT INTO app.catalogue_tag_place_types (tag, place_type, rank) VALUES
    ('cinema', 'cinema', 10), ('bowling', 'bowling', 10), ('arcade', 'arcade', 20), ('mall', 'mall', 40)
ON CONFLICT (tag) DO NOTHING;

SELECT app.backfill_catalogue_place_types();

CREATE FUNCTION app.planner_destination_point(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object('lat', ST_Y(d.location::geometry), 'lng', ST_X(d.location::geometry))
    FROM app.destinations d
    WHERE d.slug = p_slug AND d.status = 'published' AND d.location IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION app.planner_destination_point(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.planner_destination_point(text) TO mshwar_backend;

-- 3. Batroun's old town is also its old souk. Listings already typed by 053 keep their kinds; this adds one.
INSERT INTO app.experience_place_types (experience_id, place_type, is_primary)
SELECT e.id, 'souk', false FROM app.experiences e WHERE e.slug = 'batroun-old-town'
ON CONFLICT (experience_id, place_type) DO NOTHING;
