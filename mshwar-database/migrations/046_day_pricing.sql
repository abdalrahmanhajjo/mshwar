-- 046_day_pricing.sql
-- Trip builder v2, phase 4: a real price for the whole day, and the details to act on each step.
--
-- A day's price is only ever built from prices somebody published - never guessed:
--
--   * price rules on listings (fixed, from, range, estimated), now including the top of a range;
--   * a restaurant's own "typical spend per person" (new: listing_details.typical_spend_minor);
--   * a stay's "from" price per night (listing_details.price_from_minor, 043);
--   * verified drivers' published day rates (driver_terms.day_rate_minor, 041).
--
-- A step with none of these is "price on request" and is never counted as free.
--
-- The planner also needs what a traveller acts on: how to reserve a table, the booking link and
-- check-in times of a stay. Those were only in the business portal; candidates now carry them.

-- ---- 1. A restaurant's own typical spend ------------------------------------------------------
ALTER TABLE app.listing_details
    ADD COLUMN IF NOT EXISTS typical_spend_minor bigint
        CHECK (typical_spend_minor IS NULL OR typical_spend_minor BETWEEN 100 AND 100000000);

-- Owners and staff set it with the kinds of place (045). Same rules as before, plus the spend:
-- only a restaurant has one, and leaving the key out keeps what is set.
CREATE OR REPLACE FUNCTION app.set_place_types_unchecked(p_experience uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_kind text;
    v_types text[];
    v_unknown text;
    v_bad text;
    v_meals text[];
    v_spend bigint;
BEGIN
    SELECT listing_kind INTO v_kind FROM app.experiences WHERE id = p_experience;
    IF v_kind IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    IF jsonb_typeof(p_payload->'place_types') <> 'array' THEN
        RAISE EXCEPTION 'choose what kind of place this is' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(slug ORDER BY first_at) INTO v_types
    FROM (
        SELECT lower(btrim(value)) AS slug, min(ordinality) AS first_at
        FROM jsonb_array_elements_text(p_payload->'place_types') WITH ORDINALITY
        WHERE btrim(value) <> ''
        GROUP BY lower(btrim(value))
    ) given;
    IF coalesce(cardinality(v_types), 0) NOT BETWEEN 1 AND 6 THEN
        RAISE EXCEPTION 'choose between one and six kinds of place' USING ERRCODE = '22023';
    END IF;
    SELECT t INTO v_unknown FROM unnest(v_types) t
    WHERE NOT EXISTS (SELECT 1 FROM app.place_types pt WHERE pt.slug = t AND pt.active) LIMIT 1;
    IF v_unknown IS NOT NULL THEN
        RAISE EXCEPTION 'unknown kind of place: %', v_unknown USING ERRCODE = '22023';
    END IF;
    SELECT pt.slug INTO v_bad FROM app.place_types pt WHERE pt.slug = ANY (v_types) AND (
        (v_kind = 'restaurant' AND pt.role <> 'meal')
        OR (v_kind = 'hotel' AND pt.role <> 'stay')
        OR (v_kind NOT IN ('restaurant', 'hotel') AND pt.role IN ('meal', 'stay'))
    ) LIMIT 1;
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION '% does not fit a listing of this kind: set a restaurant or stay as its own listing', v_bad
            USING ERRCODE = '22023';
    END IF;

    DELETE FROM app.experience_place_types WHERE experience_id = p_experience AND NOT (place_type = ANY (v_types));
    UPDATE app.experience_place_types SET is_primary = false
    WHERE experience_id = p_experience AND is_primary AND place_type <> v_types[1];
    INSERT INTO app.experience_place_types (experience_id, place_type, is_primary)
    SELECT p_experience, t, t = v_types[1] FROM unnest(v_types) t
    ON CONFLICT (experience_id, place_type) DO UPDATE SET is_primary = EXCLUDED.is_primary;

    IF p_payload ? 'meal_services' OR p_payload ? 'schedule_note' OR p_payload ? 'typical_spend_minor' THEN
        IF p_payload ? 'meal_services' AND jsonb_typeof(p_payload->'meal_services') <> 'array' THEN
            RAISE EXCEPTION 'meal services must be a list' USING ERRCODE = '22023';
        END IF;
        v_meals := coalesce((
            SELECT array_agg(DISTINCT lower(btrim(value)) ORDER BY lower(btrim(value)))
            FROM jsonb_array_elements_text(coalesce(p_payload->'meal_services', '[]'::jsonb))
            WHERE btrim(value) <> ''
        ), '{}');
        IF cardinality(v_meals) > 0 AND v_kind <> 'restaurant' THEN
            RAISE EXCEPTION 'only a restaurant serves meals' USING ERRCODE = '22023';
        END IF;
        v_spend := NULLIF(p_payload->>'typical_spend_minor', '')::bigint;
        IF v_spend IS NOT NULL AND v_kind <> 'restaurant' THEN
            RAISE EXCEPTION 'only a restaurant has a typical spend per person' USING ERRCODE = '22023';
        END IF;
        INSERT INTO app.listing_details (experience_id) VALUES (p_experience) ON CONFLICT DO NOTHING;
        UPDATE app.listing_details
        SET meal_services = CASE WHEN p_payload ? 'meal_services' THEN v_meals ELSE meal_services END,
            schedule_note = CASE WHEN p_payload ? 'schedule_note'
                                 THEN left(btrim(coalesce(p_payload->>'schedule_note', '')), 280)
                                 ELSE schedule_note END,
            typical_spend_minor = CASE WHEN p_payload ? 'typical_spend_minor' THEN v_spend ELSE typical_spend_minor END,
            updated_at = now()
        WHERE experience_id = p_experience;
    END IF;
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the meals (breakfast, brunch, lunch, dinner or late) and the typical spend'
            USING ERRCODE = '22023';
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'the typical spend must be a whole number of cents' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.listing_place_types_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'place_types', to_jsonb(app.experience_place_type_slugs(p_experience)),
        'roles', to_jsonb(app.experience_roles(p_experience)),
        'meal_services', to_jsonb(coalesce(d.meal_services, '{}')),
        'schedule_note', coalesce(d.schedule_note, ''),
        'typical_spend_minor', d.typical_spend_minor,
        'currency', coalesce(d.currency, 'USD')
    )
    FROM (SELECT p_experience AS id) x
    LEFT JOIN app.listing_details d ON d.experience_id = x.id
$$;

-- ---- 2. What the planner needs to price and act on a step ---------------------------------------
-- Same fields as in 045, plus the full price rule and the listing's own details.
CREATE OR REPLACE FUNCTION app.planner_candidate_json(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', e.id, 'slug', e.slug, 'title', e.title, 'description', e.description, 'status', e.status,
        'duration_minutes', e.duration_minutes, 'min_party', e.min_party, 'max_party', e.max_party,
        'setting', e.setting, 'intensity', e.intensity, 'listing_kind', e.listing_kind,
        'inventory_available', e.inventory_available,
        'destination_slug', d.slug, 'destination_name', d.name,
        'venue_id', v.id, 'venue_name', v.name,
        'lat', ST_Y(v.location::geometry), 'lng', ST_X(v.location::geometry),
        'sponsored', EXISTS (SELECT 1 FROM app.planner_sponsorships sp WHERE sp.experience_id = e.id AND sp.active),
        'sponsored_label', (SELECT sp.label FROM app.planner_sponsorships sp WHERE sp.experience_id = e.id AND sp.active),
        'category_slugs', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id WHERE et.experience_id = e.id AND t.kind = 'category'
        ), '[]'::jsonb),
        'interest_slugs', coalesce((
            SELECT jsonb_agg(t.slug ORDER BY t.slug) FROM app.experience_taxonomy et
            JOIN app.taxonomy t ON t.id = et.term_id WHERE et.experience_id = e.id AND t.kind IN ('interest', 'tag')
        ), '[]'::jsonb),
        'price', jsonb_build_object(
            'currency', coalesce(pr.currency, 'USD'), 'type', coalesce(pr.price_type, 'from'),
            'source', coalesce(pr.source, 'unknown'), 'amount_minor', pr.amount_minor,
            'max_amount_minor', pr.max_amount_minor, 'unit', coalesce(pr.unit, 'person'),
            'has_rule', pr.price_type IS NOT NULL
        ),
        'hours', coalesce((
            SELECT jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', h.opens, 'closes', h.closes)
                             ORDER BY h.weekday)
            FROM app.opening_hours h WHERE h.venue_id = v.id
        ), '[]'::jsonb),
        'exceptions', coalesce((
            SELECT jsonb_agg(jsonb_build_object('local_date', x.local_date, 'closed', x.closed,
                                                'opens', x.opens, 'closes', x.closes))
            FROM app.opening_exceptions x WHERE x.venue_id = v.id
        ), '[]'::jsonb),
        'facts', coalesce(e.catalogue_facts, '[]'::jsonb),
        'details', CASE WHEN ld.experience_id IS NULL THEN '{}'::jsonb ELSE jsonb_strip_nulls(jsonb_build_object(
            'price_level', ld.price_level,
            'typical_spend_minor', ld.typical_spend_minor,
            'price_from_minor', ld.price_from_minor,
            'currency', ld.currency,
            'stay_type', ld.stay_type,
            'check_in', ld.check_in,
            'check_out', ld.check_out,
            'reservation_phone', NULLIF(ld.reservation_phone, ''),
            'reservation_whatsapp', NULLIF(ld.reservation_whatsapp, ''),
            'reservation_url', NULLIF(ld.reservation_url, ''),
            'booking_url', NULLIF(ld.booking_url, ''),
            'accepts_requests', ld.accepts_requests
        )) END
    )
    FROM app.experiences e
    JOIN app.venues v ON v.id = e.venue_id
    JOIN app.destinations d ON d.id = v.destination_id
    LEFT JOIN app.listing_details ld ON ld.experience_id = e.id
    LEFT JOIN LATERAL (
        SELECT currency, price_type, source, amount_minor, max_amount_minor, unit FROM app.current_price_rule(e.id)
    ) pr ON true
    WHERE e.id = p_experience
$$;

-- ---- 3. What a driver for the day costs ----------------------------------------------------------
-- The published day rates of the drivers a day request would reach: live, covering the destination,
-- with a live vehicle that seats the party. Per currency, lowest and highest. The driver still
-- quotes a fixed price; this is only what they publish.
CREATE FUNCTION app.planner_driver_day_rates(p_destination text, p_party integer DEFAULT 1)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'currency', r.currency, 'drivers', r.drivers, 'low_minor', r.low_minor, 'high_minor', r.high_minor
    ) ORDER BY r.drivers DESC, r.currency), '[]'::jsonb)
    FROM (
        SELECT t.currency, count(*)::integer AS drivers, min(t.day_rate_minor) AS low_minor,
               max(t.day_rate_minor) AS high_minor
        FROM app.partners p
        JOIN app.driver_terms t ON t.partner_id = p.id AND t.day_rate_minor IS NOT NULL
        WHERE p.kind = 'driver' AND p_destination = ANY (p.regions) AND app.partner_is_live(p.id)
          AND EXISTS (SELECT 1 FROM app.vehicles v WHERE v.partner_id = p.id AND app.vehicle_is_live(v.id)
                      AND v.seats >= greatest(coalesce(p_party, 1), 1))
        GROUP BY t.currency
    ) r
$$;

GRANT EXECUTE ON FUNCTION app.planner_driver_day_rates(text, integer) TO mshwar_backend;
