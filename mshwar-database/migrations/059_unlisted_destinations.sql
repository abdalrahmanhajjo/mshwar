-- 059_unlisted_destinations.sql
-- Baalbek appeared twice in the destination list: the town, and the Baalbek-Hermel governorate that already
-- shows the town's places (055) under the same temples photo. A destination can now be left out of the list
-- while staying a real place: its page, search, the planner and its places keep working. Only Baalbek is
-- left out, and only while it hangs off its governorate (the catalogue import links it); a database
-- without the governorate still lists it.

ALTER TABLE app.destinations ADD COLUMN listed boolean NOT NULL DEFAULT true;
UPDATE app.destinations SET listed = false WHERE slug = 'baalbek';

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
        -- An unlisted town is left out only while a governorate carries it.
        WHERE d.status = 'published' AND (d.listed OR d.parent_id IS NULL)
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
