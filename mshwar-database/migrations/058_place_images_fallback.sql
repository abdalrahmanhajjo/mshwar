-- 058_place_images_fallback.sql
-- Every place shows a picture. A place's own approved photo comes first. A place with none yet (most
-- restaurants and stays publish no licensed photo) shows the photo of its town or region instead, marked
-- 'area' so the page can say so; never a photo presented as the place itself. Listings, the traveller's
-- itinerary and the group itinerary all read it from here. The gallery stays the place's own photos only.

CREATE FUNCTION app.place_image(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(
        (SELECT jsonb_build_object('url', m.object_key, 'alt', m.alt_text, 'kind', 'place')
         FROM app.media m
         WHERE m.experience_id = p_experience AND m.moderation = 'approved'
         ORDER BY m.sort_order LIMIT 1),
        (SELECT jsonb_build_object('url', area.image_url, 'alt', coalesce(NULLIF(area.image_alt, ''), area.name), 'kind', 'area')
         FROM app.experiences e
         JOIN app.venues v ON v.id = e.venue_id
         JOIN app.destinations d ON d.id = v.destination_id
         LEFT JOIN app.destinations parent ON parent.id = d.parent_id
         CROSS JOIN LATERAL (
             SELECT x.image_url, x.image_alt, x.name
             FROM (VALUES (1, d.image_url, d.image_alt, d.name), (2, parent.image_url, parent.image_alt, parent.name))
                 AS x(rank, image_url, image_alt, name)
             WHERE NULLIF(x.image_url, '') IS NOT NULL
             ORDER BY x.rank LIMIT 1
         ) AS area
         WHERE e.id = p_experience)
    )
$$;

REVOKE ALL ON FUNCTION app.place_image(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.place_image(uuid) TO mshwar_backend;

CREATE OR REPLACE FUNCTION app.catalogue_listing_row(p_experience_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', e.id,
        'slug', e.slug,
        'title', e.title,
        'summary', NULLIF(e.catalogue_summary, ''),
        'body', e.description,
        'category', coalesce(
            (SELECT t.slug FROM app.experience_taxonomy et
             JOIN app.taxonomy t ON t.id = et.term_id
             WHERE et.experience_id = e.id AND t.kind = 'category'
             ORDER BY t.slug LIMIT 1),
            'city'
        ),
        'tags', coalesce((
            SELECT jsonb_agg(t.label ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'tag'
        ), '[]'::jsonb),
        'amenities', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'amenity'
        ), '[]'::jsonb),
        'suitability', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug)
            FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id
            WHERE et.experience_id = e.id AND t.kind = 'suitability'
        ), '[]'::jsonb),
        'destination_slug', d.slug,
        'place_label', v.name || ' · ' || coalesce(NULLIF(d.region, ''), d.name),
        'hours', round((e.duration_minutes / 60.0)::numeric, 1),
        'booking_mode', e.booking_mode,
        'kind', e.listing_kind,
        'available', e.inventory_available,
        'weather_sensitivity', e.weather_sensitivity,
        'setting', e.setting,
        'group_min', e.min_party,
        'group_max', e.max_party,
        'facts', e.catalogue_facts,
        'rating', e.sample_rating,
        'lat', ST_Y(v.location::geometry),
        'lng', ST_X(v.location::geometry),
        'distance_km', CASE
            WHEN v.location IS NULL THEN NULL
            ELSE round((ST_Distance(
                v.location,
                ST_SetSRID(ST_MakePoint(35.5018, 33.8938), 4326)::geography
            ) / 1000.0)::numeric, 1)
        END,
        'image', app.place_image(e.id)->>'url',
        'image_alt', app.place_image(e.id)->>'alt',
        -- 'place': a photo of the place itself; 'area': of its town, while the place has none (058).
        'image_kind', app.place_image(e.id)->>'kind',
        'gallery', coalesce((
            SELECT jsonb_agg(m.object_key ORDER BY m.sort_order)
            FROM app.media m
            WHERE m.experience_id = e.id AND m.moderation = 'approved'
        ), '[]'::jsonb),
        'price', jsonb_build_object(
            'currency', coalesce(pr.currency, 'USD'),
            'type', app.public_price_type(coalesce(pr.price_type, 'from')),
            'source', coalesce(pr.source, 'unknown'),
            'amount_minor', pr.amount_minor,
            'amount', CASE WHEN pr.amount_minor IS NULL THEN 0 ELSE pr.amount_minor / 100.0 END
        )
    )
    FROM app.experiences e
    JOIN app.organizations o ON o.id = e.organization_id
    JOIN app.venues v ON v.id = e.venue_id
    LEFT JOIN app.destinations d ON d.id = v.destination_id
    LEFT JOIN LATERAL (
        SELECT currency, price_type, source, amount_minor
        FROM app.current_price_rule(e.id)
    ) pr ON true
    WHERE e.id = p_experience_id
      AND e.status = 'published'
      AND o.status = 'active'
      AND (d.id IS NULL OR d.status = 'published');
$$;

CREATE OR REPLACE FUNCTION app.planner_version_payload(p_user uuid, p_version uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_version app.trip_versions;
    v_trip app.trips;
    v_stops jsonb;
    v_legs jsonb;
    v_costs jsonb;
    v_total bigint;
BEGIN
    SELECT * INTO v_version FROM app.trip_versions WHERE id = p_version;
    IF v_version.id IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_trip FROM app.trips WHERE id = v_version.trip_id;
    IF v_trip.owner_id <> p_user AND NOT (p_admin AND app.is_platform_admin(p_user)) THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'experience_id', s.experience_id,
        'position', s.position,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'estimated_minor', s.estimated_minor,
        'price_kind', s.price_kind,
        'locked', s.locked,
        'snapshot', s.snapshot,
        'slug', e.slug,
        'title', e.title,
        'booking_mode', e.booking_mode,
        'image', app.place_image(s.experience_id)->>'url',
        'image_alt', app.place_image(s.experience_id)->>'alt',
        -- 'place': a photo of the place itself; 'area': of its town, while the place has none (058).
        'image_kind', app.place_image(s.experience_id)->>'kind'
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = p_version;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'position', l.position, 'provider', l.provider,
        'distance_m', l.distance_m, 'duration_seconds', l.duration_seconds,
        'estimated_minor', l.estimated_minor, 'status', l.status
    ) ORDER BY l.position), '[]'::jsonb)
    INTO v_legs
    FROM app.trip_legs l
    WHERE l.version_id = p_version;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'label', c.label, 'amount_minor', c.amount_minor
    )), '[]'::jsonb)
    INTO v_costs
    FROM app.trip_cost_items c
    WHERE c.version_id = p_version;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total FROM app.trip_stops WHERE version_id = p_version;
    v_total := v_total
        + coalesce((SELECT sum(estimated_minor) FROM app.trip_legs WHERE version_id = p_version), 0)
        + coalesce((SELECT sum(amount_minor) FROM app.trip_cost_items WHERE version_id = p_version), 0);

    RETURN jsonb_build_object(
        'trip_id', v_trip.id,
        'trip_title', v_trip.title,
        'trip_status', v_trip.status,
        'version_id', v_version.id,
        'version', v_version.version,
        'origin', v_version.origin,
        'sealed_at', v_version.sealed_at,
        'window_start', v_version.window_start,
        'return_by', v_version.return_by,
        'party_size', v_version.party_size,
        'budget_minor', v_version.budget_minor,
        'currency', v_version.currency,
        'strict_budget', v_version.strict_budget,
        'constraints', v_version.constraints,
        'validation', v_version.validation,
        'stops', v_stops,
        'legs', v_legs,
        'cost_items', v_costs,
        'total_minor', v_total
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_group_itinerary(p_trip uuid, p_user uuid, p_guest uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_trip app.trips;
    v_version app.trip_versions;
    v_stops jsonb;
    v_legs jsonb;
    v_total bigint;
BEGIN
    PERFORM app.require_group_role(p_trip, p_user, p_guest, 'view');
    SELECT * INTO v_trip FROM app.trips WHERE id = p_trip;
    IF v_trip.id IS NULL THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_version
    FROM app.trip_versions
    WHERE trip_id = p_trip
    ORDER BY version DESC
    LIMIT 1;

    IF v_version.id IS NULL THEN
        RETURN jsonb_build_object(
            'trip_id', v_trip.id, 'trip_title', v_trip.title, 'trip_status', v_trip.status,
            'version_id', NULL, 'stops', '[]'::jsonb, 'legs', '[]'::jsonb, 'total_minor', 0
        );
    END IF;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'experience_id', s.experience_id,
        'position', s.position,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'estimated_minor', s.estimated_minor,
        'price_kind', s.price_kind,
        'locked', s.locked,
        'snapshot', s.snapshot,
        'slug', e.slug,
        'title', e.title,
        'booking_mode', e.booking_mode,
        'image', app.place_image(s.experience_id)->>'url',
        'image_alt', app.place_image(s.experience_id)->>'alt',
        -- 'place': a photo of the place itself; 'area': of its town, while the place has none (058).
        'image_kind', app.place_image(s.experience_id)->>'kind'
    ) ORDER BY s.position), '[]'::jsonb)
    INTO v_stops
    FROM app.trip_stops s
    JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = v_version.id;

    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'position', l.position, 'provider', l.provider,
        'distance_m', l.distance_m, 'duration_seconds', l.duration_seconds,
        'estimated_minor', l.estimated_minor, 'status', l.status
    ) ORDER BY l.position), '[]'::jsonb)
    INTO v_legs
    FROM app.trip_legs l
    WHERE l.version_id = v_version.id;

    SELECT coalesce(sum(estimated_minor), 0) INTO v_total
    FROM app.trip_stops WHERE version_id = v_version.id;

    RETURN jsonb_build_object(
        'trip_id', v_trip.id,
        'trip_title', v_trip.title,
        'trip_status', v_trip.status,
        'version_id', v_version.id,
        'version', v_version.version,
        'origin', v_version.origin,
        'sealed_at', v_version.sealed_at,
        'window_start', v_version.window_start,
        'return_by', v_version.return_by,
        'party_size', v_version.party_size,
        'budget_minor', v_version.budget_minor,
        'currency', v_version.currency,
        'stops', v_stops,
        'legs', v_legs,
        'total_minor', v_total
    );
END;
$$;
