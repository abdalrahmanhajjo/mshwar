-- 047_sourced_prices.sql
-- Real prices with proof: staff record a price a place or an authority PUBLISHED, with where it was
-- published and when it was checked. Nothing here is an estimate.
--
-- Until now a catalogue place our team listed (a castle, a grotto, a museum) could only be "free"
-- or "on request": its owner is not on Mshwar to publish a price. Staff can now record the price
-- from the official source - the site's own page, the ministry's list, the ticket office - and:
--
--   * the source link, its name and the day it was checked are kept with the price and shown to
--     travellers ("$15 per person · Jeita Grotto official site · checked 12 Sep 2026");
--   * every sourced price has a review date (at most a year after the check). After it the price
--     simply stops applying and the place is "on request" again - an old price is never shown as
--     today's;
--   * the rule it replaces is ended, not deleted: bookings keep pointing at the price they used.

CREATE TABLE app.price_sources (
    price_rule_id uuid PRIMARY KEY REFERENCES app.price_rules(id),
    source_url text NOT NULL CHECK (source_url ~ '^https://[^/[:space:]]+'),
    source_name text NOT NULL CHECK (btrim(source_name) <> '' AND length(source_name) <= 120),
    checked_on date NOT NULL,
    review_by date NOT NULL CHECK (review_by > checked_on AND review_by <= checked_on + 366),
    checked_by uuid NOT NULL REFERENCES app.users(id),
    note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_sources_review_idx ON app.price_sources (review_by);

ALTER TABLE app.price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.price_sources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.price_sources FROM PUBLIC, mshwar_backend;
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON app.price_sources
    FOR EACH ROW EXECUTE FUNCTION app.audit_change();

CREATE FUNCTION app.price_source_json(p_rule uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'price_rule_id', r.id, 'experience_id', r.experience_id, 'slug', e.slug, 'title', e.title,
        'price_type', r.price_type, 'amount_minor', r.amount_minor, 'max_amount_minor', r.max_amount_minor,
        'currency', r.currency, 'unit', r.unit,
        'source_url', s.source_url, 'source_name', s.source_name,
        'checked_on', s.checked_on, 'review_by', s.review_by, 'note', s.note
    )
    FROM app.price_rules r
    JOIN app.price_sources s ON s.price_rule_id = r.id
    JOIN app.experiences e ON e.id = r.experience_id
    WHERE r.id = p_rule
$$;

-- Staff record a published price. payload: {price_type: fixed|from|range, amount_minor,
-- max_amount_minor (range), currency, unit: person|group, source_url, source_name, checked_on,
-- review_by (default checked_on + 180 days), note}. A published 0 is "free".
CREATE FUNCTION app.admin_set_sourced_price(p_admin uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    b jsonb := coalesce(p_payload, '{}'::jsonb);
    v_type text := b->>'price_type';
    v_amount bigint := NULLIF(b->>'amount_minor', '')::bigint;
    v_max bigint := NULLIF(b->>'max_amount_minor', '')::bigint;
    v_currency text := upper(coalesce(NULLIF(b->>'currency', ''), 'USD'));
    v_unit text := coalesce(NULLIF(b->>'unit', ''), 'person');
    v_url text := btrim(coalesce(b->>'source_url', ''));
    v_source text := btrim(coalesce(b->>'source_name', ''));
    v_checked date := coalesce(NULLIF(b->>'checked_on', '')::date, app.beirut_today());
    v_review date;
    v_from timestamptz;
    v_until timestamptz;
    v_org uuid;
    v_rule uuid;
BEGIN
    PERFORM app.require_admin(p_admin, false);
    SELECT organization_id INTO v_org FROM app.experiences WHERE id = p_experience;
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'listing not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_type NOT IN ('fixed', 'from', 'range') THEN
        RAISE EXCEPTION 'a sourced price is fixed, from or a range' USING ERRCODE = '22023';
    END IF;
    IF v_amount IS NULL OR v_amount < 0 OR (v_type = 'range' AND (v_max IS NULL OR v_max < v_amount))
       OR (v_type <> 'range' AND v_max IS NOT NULL) THEN
        RAISE EXCEPTION 'check the amounts: a range needs a lowest and a highest price' USING ERRCODE = '22023';
    END IF;
    IF v_unit NOT IN ('person', 'group') THEN
        RAISE EXCEPTION 'the price is per person or per group' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.currencies WHERE code = v_currency) THEN
        RAISE EXCEPTION 'unknown currency' USING ERRCODE = '22023';
    END IF;
    IF v_url !~ '^https://[^/[:space:]]+' OR v_source = '' THEN
        RAISE EXCEPTION 'say where the price is published: a https link and its name' USING ERRCODE = '22023';
    END IF;
    IF v_checked > app.beirut_today() OR v_checked < app.beirut_today() - 60 THEN
        RAISE EXCEPTION 'the price must have been checked in the last 60 days' USING ERRCODE = '22023';
    END IF;
    v_review := coalesce(NULLIF(b->>'review_by', '')::date, v_checked + 180);
    IF v_review <= app.beirut_today() OR v_review > v_checked + 366 THEN
        RAISE EXCEPTION 'the review date must be in the future and within a year of the check' USING ERRCODE = '22023';
    END IF;
    v_from := (v_checked::timestamp AT TIME ZONE 'Asia/Beirut');
    v_until := ((v_review + 1)::timestamp AT TIME ZONE 'Asia/Beirut');
    IF EXISTS (
        SELECT 1 FROM app.price_rules
        WHERE experience_id = p_experience AND currency = v_currency
          AND valid_during && tstzrange(v_from, v_until, '[)') AND lower(valid_during) >= v_from
    ) THEN
        RAISE EXCEPTION 'a price starting on or after that day is already set' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.organization_id', v_org::text, true);
    -- End the price that applied until now; bookings keep pointing at it.
    UPDATE app.price_rules
    SET valid_during = tstzrange(lower(valid_during), v_from, '[)')
    WHERE experience_id = p_experience AND currency = v_currency
      AND valid_during && tstzrange(v_from, v_until, '[)');
    INSERT INTO app.price_rules
        (experience_id, currency, price_type, unit, amount_minor, max_amount_minor, valid_during, source, verified_at)
    VALUES (
        p_experience, v_currency, v_type, v_unit, v_amount, CASE WHEN v_type = 'range' THEN v_max END,
        tstzrange(v_from, v_until, '[)'), 'sourced:' || left(v_source, 80), now()
    ) RETURNING id INTO v_rule;
    INSERT INTO app.price_sources (price_rule_id, source_url, source_name, checked_on, review_by, checked_by, note)
    VALUES (v_rule, v_url, v_source, v_checked, v_review, p_admin, left(btrim(coalesce(b->>'note', '')), 500));
    RETURN app.price_source_json(v_rule);
EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow
         OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'check the amounts and dates' USING ERRCODE = '22023';
END;
$$;

-- What staff must re-check: sourced prices that lapse within p_days (or already lapsed, last 30 days).
CREATE FUNCTION app.admin_sourced_prices_due(p_admin uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN coalesce((
        SELECT jsonb_agg(app.price_source_json(s.price_rule_id) ORDER BY s.review_by, s.price_rule_id)
        FROM app.price_sources s
        WHERE s.review_by BETWEEN app.beirut_today() - 30 AND app.beirut_today() + least(greatest(p_days, 1), 365)
          -- Only the latest source per listing: an older one already replaced is not "due".
          AND NOT EXISTS (
              SELECT 1 FROM app.price_sources later
              JOIN app.price_rules lr ON lr.id = later.price_rule_id
              JOIN app.price_rules r ON r.id = s.price_rule_id
              WHERE lr.experience_id = r.experience_id AND lr.currency = r.currency
                AND later.checked_on > s.checked_on
          )
    ), '[]'::jsonb);
END;
$$;

-- Candidates carry where their price was published and when it was checked (046 fields, plus these).
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
        'price', jsonb_strip_nulls(jsonb_build_object(
            'currency', coalesce(pr.currency, 'USD'), 'type', coalesce(pr.price_type, 'from'),
            'source', coalesce(pr.source, 'unknown'), 'amount_minor', pr.amount_minor,
            'max_amount_minor', pr.max_amount_minor, 'unit', coalesce(pr.unit, 'person'),
            'has_rule', pr.price_type IS NOT NULL,
            'verified_at', pr.verified_at,
            'source_url', ps.source_url, 'source_name', ps.source_name,
            'checked_on', ps.checked_on, 'review_by', ps.review_by
        )),
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
        SELECT id, currency, price_type, source, amount_minor, max_amount_minor, unit, verified_at
        FROM app.current_price_rule(e.id)
    ) pr ON true
    LEFT JOIN app.price_sources ps ON ps.price_rule_id = pr.id
    WHERE e.id = p_experience
$$;

GRANT EXECUTE ON FUNCTION
    app.price_source_json(uuid),
    app.admin_set_sourced_price(uuid, uuid, jsonb),
    app.admin_sourced_prices_due(uuid, integer)
TO mshwar_backend;
