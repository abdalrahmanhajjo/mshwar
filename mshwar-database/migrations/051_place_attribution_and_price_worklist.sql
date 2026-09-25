-- 051_place_attribution_and_price_worklist.sql
-- Trip builder v2, phases 2b and 4 (docs/ai-trip-builder-v2-plan.md; docs/places-import.md).
--
-- 1. Attribution: a listing published from an open-data lead (049) credits where its name and location
--    came from - OpenStreetMap (ODbL 1.0, attribution required) or Wikidata (CC0). The public listing
--    shows it; docs/legal/odbl-review.md explains why and what legal still has to decide.
-- 2. The price worklist: listings the planner offers that have no published price today - no current
--    amount, only "on request" - most planned first, with the last source that lapsed. It is the list
--    staff work through to record prices from official sources (047); nothing here invents one.

-- ---- 1. Attribution ------------------------------------------------------------------------------
CREATE FUNCTION app.listing_attributions(p_experience uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT jsonb_agg(item)
        FROM (
            SELECT CASE split_part(v.source_reference, ':', 2)
                WHEN 'osm' THEN jsonb_build_object(
                    'source', 'osm', 'name', 'OpenStreetMap contributors', 'licence', 'ODbL-1.0',
                    'licence_url', 'https://www.openstreetmap.org/copyright',
                    'record_url', 'https://www.openstreetmap.org/' || split_part(v.source_reference, ':', 3))
                WHEN 'wikidata' THEN jsonb_build_object(
                    'source', 'wikidata', 'name', 'Wikidata', 'licence', 'CC0-1.0',
                    'licence_url', 'https://creativecommons.org/publicdomain/zero/1.0/',
                    'record_url', 'https://www.wikidata.org/wiki/' || split_part(v.source_reference, ':', 3))
            END AS item
            FROM app.experiences e
            JOIN app.venues v ON v.id = e.venue_id
            WHERE e.id = p_experience AND e.status = 'published' AND v.source_reference LIKE 'lead:%'
        ) credits
        WHERE item IS NOT NULL
    ), '[]'::jsonb)
$$;

-- ---- 2. The price worklist -----------------------------------------------------------------------
-- p_filter: {destination, kind (restaurant | hotel | attraction | experience), limit (<= 200)}.
CREATE FUNCTION app.admin_price_worklist(p_admin uuid, p_filter jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_limit integer := least(greatest(coalesce(NULLIF(p_filter->>'limit', '')::integer, 100), 1), 200);
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(to_jsonb(w) ORDER BY w.planned DESC, w.destination_slug, w.title)
        FROM (
            SELECT e.id AS experience_id, e.slug, e.title, e.listing_kind, d.slug AS destination_slug,
                   coalesce((SELECT array_agg(ept.place_type ORDER BY ept.is_primary DESC, ept.place_type)
                             FROM app.experience_place_types ept WHERE ept.experience_id = e.id), '{}') AS place_types,
                   current_rule.price_type AS current_price_type,
                   -- How often the planner put it in a trip (priced on request) in the last 90 days. Counts only.
                   (SELECT count(*) FROM app.trip_stops ts JOIN app.trip_versions tv ON tv.id = ts.version_id
                    WHERE ts.experience_id = e.id AND ts.price_kind = 'quote'
                      AND tv.created_at >= now() - interval '90 days')::integer AS planned,
                   (SELECT jsonb_build_object('source_name', s.source_name, 'source_url', s.source_url,
                                              'checked_on', s.checked_on, 'review_by', s.review_by)
                    FROM app.price_sources s JOIN app.price_rules r ON r.id = s.price_rule_id
                    WHERE r.experience_id = e.id ORDER BY s.checked_on DESC LIMIT 1) AS last_source
            FROM app.experiences e
            JOIN app.venues v ON v.id = e.venue_id
            JOIN app.destinations d ON d.id = v.destination_id
            LEFT JOIN LATERAL (
                SELECT r.price_type, r.amount_minor FROM app.price_rules r
                WHERE r.experience_id = e.id AND r.currency = 'USD' AND r.valid_during @> now()
                LIMIT 1
            ) current_rule ON true
            LEFT JOIN app.listing_details ld ON ld.experience_id = e.id
            WHERE app.planner_step_eligible(e.id)
              AND (current_rule.amount_minor IS NULL)
              -- A restaurant with its own typical spend already has a price the planner can show.
              AND NOT (e.listing_kind = 'restaurant' AND ld.typical_spend_minor IS NOT NULL)
              AND (NULLIF(p_filter->>'destination', '') IS NULL OR d.slug = p_filter->>'destination')
              AND (NULLIF(p_filter->>'kind', '') IS NULL OR e.listing_kind = p_filter->>'kind')
            ORDER BY 8 DESC, d.slug, e.title
            LIMIT v_limit
        ) w
    ), '[]'::jsonb);
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'limit is a number' USING ERRCODE = '22023';
END;
$$;

-- ---- 3. Publishing with what was seen on site -----------------------------------------------------
-- Same as 049, plus p_payload.on_site: {name, name_ar, name_fr, lat, lng} - the name on the sign and the
-- point taken there. With it, only the kind and destination come from the lead, and the venue records
-- only that the lead led us there ('lead-found:'), not that its data was copied.
CREATE OR REPLACE FUNCTION app.admin_publish_lead(p_admin uuid, p_lead uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := coalesce(p_payload, '{}'::jsonb);
    v_lead app.place_leads;
    v_org uuid;
    v_dest uuid;
    v_type app.place_types;
    v_kind text;
    v_venue uuid;
    v_exp uuid;
    v_slug text;
    v_n integer := 1;
    -- Option A of docs/legal/odbl-review.md: the name on the sign and the point taken on site.
    v_site jsonb := b->'on_site';
    v_name text;
    v_point geography;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT * INTO v_lead FROM app.place_leads WHERE id = p_lead FOR UPDATE;
    IF v_lead.id IS NULL OR v_lead.status NOT IN ('new', 'checking') THEN
        RAISE EXCEPTION 'lead not found or not open' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO v_type FROM app.place_types
    WHERE slug = coalesce(NULLIF(b->>'place_type', ''), v_lead.place_type) AND active;
    IF v_type.slug IS NULL THEN
        RAISE EXCEPTION 'choose what kind of place this is' USING ERRCODE = '22023';
    END IF;
    v_dest := coalesce(v_lead.destination_id, (SELECT id FROM app.destinations WHERE slug = b->>'destination'));
    IF v_dest IS NULL THEN
        RAISE EXCEPTION 'choose the destination' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'description', ''))) < 20 THEN
        RAISE EXCEPTION 'give a description of at least 20 characters' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(coalesce(b->>'notes', ''))) < 10 THEN
        RAISE EXCEPTION 'note what you checked, and how' USING ERRCODE = '22023';
    END IF;
    IF v_site IS NOT NULL THEN
        v_name := NULLIF(btrim(v_site->>'name'), '');
        IF v_name IS NULL OR length(v_name) > 140 THEN
            RAISE EXCEPTION 'write the name as it is on the sign' USING ERRCODE = '22023';
        END IF;
        IF NOT coalesce(app.point_in_lebanon((v_site->>'lng')::double precision, (v_site->>'lat')::double precision), false) THEN
            RAISE EXCEPTION 'the point taken on site must be in Lebanon' USING ERRCODE = '22023';
        END IF;
        v_point := ST_SetSRID(ST_MakePoint((v_site->>'lng')::double precision, (v_site->>'lat')::double precision), 4326)::geography;
    ELSE
        v_name := v_lead.name;
        v_point := v_lead.location;
    END IF;
    v_kind := CASE v_type.role WHEN 'meal' THEN 'restaurant' WHEN 'stay' THEN 'hotel'
                               WHEN 'sight' THEN 'attraction' ELSE 'experience' END;
    SELECT id INTO v_org FROM app.organizations WHERE slug = 'mshwar-catalogue';
    PERFORM set_config('app.organization_id', v_org::text, true);
    INSERT INTO app.venues (organization_id, destination_id, name, address, timezone, location, location_source, source_reference)
    VALUES (v_org, v_dest, v_name, coalesce(NULLIF(btrim(b->>'address'), ''), v_name), 'Asia/Beirut',
            v_point, CASE WHEN v_site IS NULL THEN 'lead-check' ELSE 'on-site' END,
            -- Copied from the lead: credited (see listing_attributions). Taken on site: only where we heard of it.
            CASE WHEN v_site IS NULL THEN 'lead:' ELSE 'lead-found:' END || v_lead.source || ':' || v_lead.external_id)
    RETURNING id INTO v_venue;
    v_slug := app.slugify(v_name);
    WHILE EXISTS (SELECT 1 FROM app.experiences WHERE slug = v_slug) LOOP
        v_n := v_n + 1;
        v_slug := app.slugify(v_name) || '-' || v_n;
    END LOOP;
    INSERT INTO app.experiences (
        organization_id, venue_id, slug, title, description, status, booking_mode, duration_minutes, min_party,
        max_party, setting, weather_sensitivity, listing_kind, inventory_available, catalogue_summary, catalogue_facts,
        verified_level, checked_on, checked_by, review_by, check_notes
    ) VALUES (
        v_org, v_venue, v_slug, v_name, btrim(b->>'description'), 'published', 'inquiry',
        coalesce(NULLIF(b->>'duration_minutes', '')::integer, v_type.default_minutes), 1, 20,
        coalesce(NULLIF(b->>'setting', ''), CASE WHEN v_type.place_group IN ('nature', 'sport') THEN 'outdoor' ELSE 'indoor' END),
        CASE WHEN v_type.place_group IN ('nature', 'sport') THEN 'outdoor' ELSE 'indoor' END,
        v_kind, true, left(btrim(b->>'description'), 280), '[]'::jsonb,
        CASE WHEN v_kind IN ('restaurant', 'hotel') THEN 'checked_by_mshwar' END,
        app.beirut_today(), p_admin,
        CASE WHEN v_kind IN ('restaurant', 'hotel') THEN app.beirut_today() + 180 END,
        left(btrim(b->>'notes'), 2000)
    ) RETURNING id INTO v_exp;
    INSERT INTO app.price_rules (experience_id, currency, price_type, unit, amount_minor, valid_during, source)
    VALUES (v_exp, 'USD', 'quote-required', 'person', NULL, '(,)', 'lead');
    INSERT INTO app.experience_translations (experience_id, locale, title, description)
    SELECT v_exp, locale, title, btrim(b->>'description')
    FROM (VALUES
        ('en', v_name),
        ('ar', CASE WHEN v_site IS NULL THEN NULLIF(v_lead.name_ar, '') ELSE NULLIF(btrim(v_site->>'name_ar'), '') END),
        ('fr', CASE WHEN v_site IS NULL THEN NULLIF(v_lead.name_fr, '') ELSE NULLIF(btrim(v_site->>'name_fr'), '') END)
    ) t(locale, title)
    WHERE title IS NOT NULL
    ON CONFLICT (experience_id, locale) DO NOTHING;
    INSERT INTO app.experience_place_types (experience_id, place_type, is_primary) VALUES (v_exp, v_type.slug, true);
    UPDATE app.place_leads SET status = 'published', experience_id = v_exp, reviewed_by = p_admin, reviewed_at = now()
    WHERE id = p_lead;
    RETURN app.lead_json(p_lead) || jsonb_build_object('slug', v_slug, 'listing_kind', v_kind);
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'check the setting and the visit length' USING ERRCODE = '22023';
    WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'check the numbers' USING ERRCODE = '22023';
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.listing_attributions(uuid),
    app.admin_price_worklist(uuid, jsonb)
TO mshwar_backend;
