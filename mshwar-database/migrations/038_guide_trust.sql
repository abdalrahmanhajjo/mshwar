-- 038_guide_trust.sql
-- G6 of the supply-side pivot: trust, safety and launch.
--
-- * The guide agreement and code of conduct are versioned, and a guide accepts
--   the current version before an application can be sent for review.
-- * Decisions on an application reach the guide as a notification.
-- * Suspending a guide pauses their tours and closes the days they have not yet
--   run, telling each traveller; nothing is left bookable behind a suspension.
-- * Either side can report a problem with a day. Reports land in the existing
--   support-case queue; safety reports are escalated on arrival.
-- * Business-portal notifications raised by a guide's own organisation link to
--   the guide screens, not to the hidden business portal.
-- * A funnel for operators: applications to approved guides to published tours
--   to requests to completed days.

-- ---- The agreement ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_agreements (
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    version text NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}$'),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (guide_profile_id, version)
);
ALTER TABLE app.guide_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_agreements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_agreement_self ON app.guide_agreements;
CREATE POLICY guide_agreement_self ON app.guide_agreements FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_agreements.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.id = guide_agreements.guide_profile_id AND g.user_id = app.current_user_id()));
GRANT SELECT, INSERT ON app.guide_agreements TO mshwar_backend;

-- Keep in step with apps/web/src/lib/legal/guide-agreement.ts (GUIDE_AGREEMENT_VERSION).
CREATE OR REPLACE FUNCTION app.current_guide_agreement_version()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT '2026-09-22'::text $$;

CREATE OR REPLACE FUNCTION app.guide_accepted_agreement(p_profile uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT version FROM app.guide_agreements WHERE guide_profile_id = p_profile
    ORDER BY version DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.guide_accept_agreement(p_user uuid, p_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM app.guide_profiles WHERE user_id = p_user;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    -- Acceptance only counts for the text the guide was actually shown.
    IF p_version IS DISTINCT FROM app.current_guide_agreement_version() THEN
        RAISE EXCEPTION 'agreement version is out of date' USING ERRCODE = '22023';
    END IF;
    INSERT INTO app.guide_agreements (guide_profile_id, version) VALUES (v_id, p_version)
    ON CONFLICT DO NOTHING;
    RETURN app.guide_profile_json(v_id, true);
END;
$$;

-- The profile shows where the guide stands on the agreement. Same as 035 otherwise.
CREATE OR REPLACE FUNCTION app.guide_profile_json(p_profile uuid, p_private boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', g.id,
        'slug', g.slug,
        'tier', g.tier,
        'badge', app.guide_has_badge(g.id),
        'display_name', g.display_name,
        'headline', g.headline,
        'bio', g.bio,
        'languages', to_jsonb(g.languages),
        'regions', to_jsonb(g.regions),
        'specialities', to_jsonb(g.specialities),
        'years_guiding', g.years_guiding,
        'status', g.status,
        'organization_id', g.organization_id,
        'day_rate_minor', g.day_rate_minor,
        'max_group', g.max_group,
        'hireable', app.guide_hireable(g.id)
    )
    || CASE WHEN p_private THEN jsonb_build_object(
        'phone', g.phone,
        'submitted_at', g.submitted_at,
        'decided_at', g.decided_at,
        'decision_reason', g.decision_reason,
        'required_documents', to_jsonb(app.guide_required_documents(g.tier)),
        'agreement', jsonb_build_object(
            'current', app.current_guide_agreement_version(),
            'accepted', app.guide_accepted_agreement(g.id)
        ),
        'documents', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id, 'kind', c.kind, 'reference', c.reference, 'issuer', c.issuer,
                'issued_on', c.issued_on, 'expires_on', c.expires_on,
                'verification', c.verification, 'reason', c.reason,
                'expired', c.expires_on IS NOT NULL AND c.expires_on < current_date
            ) ORDER BY c.kind)
            FROM app.guide_credentials c WHERE c.guide_profile_id = g.id
        ), '[]'::jsonb)
    ) ELSE '{}'::jsonb END
    FROM app.guide_profiles g
    WHERE g.id = p_profile;
$$;

-- Submitting now needs the current agreement. Same as 033 otherwise.
CREATE OR REPLACE FUNCTION app.guide_submit(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_id uuid;
    v_tier text;
    v_status text;
    v_missing text[];
BEGIN
    SELECT id, tier, status INTO v_id, v_tier, v_status FROM app.guide_profiles WHERE user_id = p_user;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_status NOT IN ('draft', 'rejected') THEN
        RAISE EXCEPTION 'application is not editable' USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(required), '{}')
    INTO v_missing
    FROM unnest(app.guide_required_documents(v_tier)) AS required
    WHERE NOT EXISTS (
        SELECT 1 FROM app.guide_credentials c
        WHERE c.guide_profile_id = v_id AND c.kind = required
    );
    IF array_length(v_missing, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'missing documents: %', array_to_string(v_missing, ', ') USING ERRCODE = '22023';
    END IF;
    IF app.guide_accepted_agreement(v_id) IS DISTINCT FROM app.current_guide_agreement_version() THEN
        RAISE EXCEPTION 'accept the guide agreement and code of conduct first' USING ERRCODE = '22023';
    END IF;

    UPDATE app.guide_profiles
    SET status = 'submitted', submitted_at = now(), decision_reason = '', updated_at = now()
    WHERE id = v_id;
    RETURN app.guide_profile_json(v_id, true);
END;
$$;

-- ---- Decisions reach the guide; suspension closes what is open ----------------------------
CREATE OR REPLACE FUNCTION app.on_guide_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_booking record;
    v_engagement record;
    v_reason text := 'This guide is no longer available on Mshwar';
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved', 'rejected', 'suspended') THEN
        RETURN NEW;
    END IF;
    PERFORM app.emit_notification_event(
        'guide.application_decided', NEW.id, NEW.user_id, NULL,
        jsonb_build_object('path', '/guide', 'status', NEW.status)
    );
    IF NEW.status = 'suspended' AND NEW.organization_id IS NOT NULL THEN
        PERFORM set_config('app.reason', v_reason, true);
        UPDATE app.experiences SET status = 'paused', updated_at = now()
        WHERE organization_id = NEW.organization_id AND status = 'published';
        FOR v_booking IN
            SELECT b.id, b.status FROM app.bookings b JOIN app.slots s ON s.id = b.slot_id
            WHERE b.organization_id = NEW.organization_id AND b.status IN ('pending', 'confirmed')
              AND s.starts_at > now()
        LOOP
            PERFORM app.transition_booking(
                v_booking.id, CASE WHEN v_booking.status = 'pending' THEN 'rejected' ELSE 'cancelled' END, v_reason
            );
        END LOOP;
        FOR v_engagement IN
            SELECT id FROM app.guide_engagements
            WHERE guide_profile_id = NEW.id AND state IN ('requested', 'accepted', 'changes_proposed', 'confirmed')
              AND local_date >= (now() AT TIME ZONE 'Asia/Beirut')::date
        LOOP
            UPDATE app.guide_engagements
            SET state = 'cancelled', cancelled_at = now(), decline_reason = v_reason, updated_at = now()
            WHERE id = v_engagement.id;
            PERFORM app.notify_engagement(v_engagement.id, 'engagement.cancelled_by_guide');
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guide_status_change ON app.guide_profiles;
CREATE TRIGGER guide_status_change
    AFTER UPDATE OF status ON app.guide_profiles
    FOR EACH ROW EXECUTE FUNCTION app.on_guide_status_change();

-- ---- Reports ----------------------------------------------------------------------------------
-- One party to a day reports the other. It becomes a support case; safety is escalated.
CREATE OR REPLACE FUNCTION app.report_guide_day(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_category text := p_payload->>'category';
    v_details text := btrim(coalesce(p_payload->>'details', ''));
    v_engagement app.guide_engagements;
    v_booking app.bookings;
    v_guide_user uuid;
    v_org uuid;
    v_experience uuid;
    v_id uuid;
BEGIN
    IF v_category NOT IN ('safety', 'no_show', 'payment', 'conduct', 'other') THEN
        RAISE EXCEPTION 'choose what kind of problem this is' USING ERRCODE = '22023';
    END IF;
    IF length(v_details) < 10 THEN
        RAISE EXCEPTION 'describe what happened in a sentence or two' USING ERRCODE = '22023';
    END IF;

    IF NULLIF(p_payload->>'engagement_id', '') IS NOT NULL THEN
        SELECT * INTO v_engagement FROM app.guide_engagements WHERE id = (p_payload->>'engagement_id')::uuid;
        SELECT user_id, organization_id INTO v_guide_user, v_org FROM app.guide_profiles WHERE id = v_engagement.guide_profile_id;
        IF v_engagement.id IS NULL OR (v_engagement.traveller_id <> p_user AND v_guide_user IS DISTINCT FROM p_user) THEN
            RAISE EXCEPTION 'day not found' USING ERRCODE = 'P0002';
        END IF;
    ELSIF NULLIF(p_payload->>'booking_id', '') IS NOT NULL THEN
        SELECT * INTO v_booking FROM app.bookings WHERE id = (p_payload->>'booking_id')::uuid;
        SELECT g.user_id INTO v_guide_user FROM app.guide_profiles g WHERE g.organization_id = v_booking.organization_id;
        IF v_booking.id IS NULL OR v_guide_user IS NULL
           OR (v_booking.customer_id <> p_user AND v_guide_user <> p_user) THEN
            RAISE EXCEPTION 'day not found' USING ERRCODE = 'P0002';
        END IF;
        v_org := v_booking.organization_id;
        v_experience := v_booking.experience_id;
    ELSE
        RAISE EXCEPTION 'say which day this is about' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.support_cases (reporter_id, booking_id, experience_id, reason, evidence, organization_id, escalated_at)
    VALUES (
        p_user, v_booking.id, v_experience,
        'guide_' || v_category,
        jsonb_build_array(jsonb_build_object(
            'kind', 'statement',
            'text', left(v_details, 4000),
            'engagement_id', v_engagement.id,
            'reported_as', CASE WHEN v_guide_user = p_user THEN 'guide' ELSE 'traveller' END
        )),
        v_org,
        CASE WHEN v_category = 'safety' THEN now() END
    ) RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'category', v_category, 'escalated', v_category = 'safety');
END;
$$;

-- ---- Deep links: a guide's own organisation goes to the guide screens -------------------------
CREATE OR REPLACE FUNCTION app.notification_deep_link(p_event text, p_payload jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN p_event LIKE 'engagement.%' AND p_payload->>'recipient' = 'guide' THEN
            '/guide/requests/' || coalesce(p_payload->>'engagement_id', p_payload->>'aggregate_id', '')
        WHEN p_event LIKE 'engagement.%' THEN
            '/plan/' || coalesce(p_payload->>'trip_id', '') || '/guide'
        WHEN p_event LIKE 'guide.%' THEN
            coalesce(p_payload->>'path', '/guide')
        WHEN p_event LIKE 'business.%' AND EXISTS (
            SELECT 1 FROM app.bookings b JOIN app.guide_profiles g ON g.organization_id = b.organization_id
            WHERE b.id::text = coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id')
        ) THEN
            '/guide/requests'
        WHEN p_event LIKE 'business.%' THEN
            '/business/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event = 'itinerary.material_change' THEN
            '/trips?highlight=' || coalesce(p_payload->>'trip_id', p_payload->>'aggregate_id', '')
        ELSE
            '/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
    END
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('guide.application_decided', 'en', 'traveller', 'Your guide application was reviewed',
     'A reviewer has decided on your application ({status}). See what it means for you: {deep_link}'),
    ('guide.application_decided', 'ar', 'traveller', 'رُوجع طلبك كمرشد',
     'اتّخذ أحد المراجعين قرارًا بشأن طلبك ({status}). اطّلع على ما يعنيه لك: {deep_link}'),
    ('guide.application_decided', 'fr', 'traveller', 'Votre candidature de guide a été examinée',
     'Un relecteur a statué sur votre candidature ({status}). Voir ce que cela implique : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ---- The funnel ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.admin_guide_funnel(p_admin uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 365));
BEGIN
    PERFORM app.require_admin(p_admin, false);
    RETURN jsonb_build_object(
        'days', least(greatest(p_days, 1), 365),
        'since', v_since,
        'applications', (
            SELECT jsonb_build_object(
                'started', count(*) FILTER (WHERE created_at >= v_since),
                'submitted', count(*) FILTER (WHERE submitted_at >= v_since),
                'approved', count(*) FILTER (WHERE status = 'approved' AND decided_at >= v_since),
                'rejected', count(*) FILTER (WHERE status = 'rejected' AND decided_at >= v_since),
                'waiting', count(*) FILTER (WHERE status = 'submitted'),
                'suspended', count(*) FILTER (WHERE status = 'suspended')
            ) FROM app.guide_profiles
        ),
        'guides', (
            SELECT jsonb_build_object(
                'approved', count(*) FILTER (WHERE status = 'approved'),
                'licensed', count(*) FILTER (WHERE status = 'approved' AND tier = 'licensed'),
                'hosts', count(*) FILTER (WHERE status = 'approved' AND tier = 'host'),
                'with_badge', count(*) FILTER (WHERE status = 'approved' AND app.guide_has_badge(id)),
                'hireable', count(*) FILTER (WHERE app.guide_hireable(id) AND day_rate_minor IS NOT NULL),
                'with_published_tour', count(*) FILTER (WHERE status = 'approved' AND EXISTS (
                    SELECT 1 FROM app.experiences e WHERE e.organization_id = guide_profiles.organization_id
                      AND e.status = 'published'))
            ) FROM app.guide_profiles
        ),
        'tours', (
            SELECT jsonb_build_object(
                'published', count(*) FILTER (WHERE e.status = 'published'),
                'draft', count(*) FILTER (WHERE e.status = 'draft')
            )
            FROM app.experiences e JOIN app.guide_profiles g ON g.organization_id = e.organization_id
        ),
        'tour_requests', (
            SELECT jsonb_build_object(
                'received', count(*),
                'confirmed', count(*) FILTER (WHERE b.status IN ('confirmed', 'completed')),
                'declined', count(*) FILTER (WHERE b.status = 'rejected'),
                'completed', count(*) FILTER (WHERE b.status = 'completed')
            )
            FROM app.bookings b JOIN app.guide_profiles g ON g.organization_id = b.organization_id
            WHERE b.created_at >= v_since
        ),
        'engagements', (
            SELECT jsonb_build_object(
                'requested', count(*),
                'accepted_or_proposed', count(*) FILTER (WHERE responded_at IS NOT NULL AND state <> 'declined'),
                'declined', count(*) FILTER (WHERE state = 'declined'),
                'confirmed', count(*) FILTER (WHERE confirmed_at IS NOT NULL),
                'completed', count(*) FILTER (WHERE state = 'completed'),
                'median_response_hours', round((percentile_cont(0.5) WITHIN GROUP (
                    ORDER BY extract(epoch FROM responded_at - created_at) / 3600
                ) FILTER (WHERE responded_at IS NOT NULL))::numeric, 1)
            ) FROM app.guide_engagements WHERE created_at >= v_since
        ),
        'days_completed', (SELECT count(*) FROM app.guide_runs WHERE completed_at >= v_since),
        'proposals', (
            SELECT jsonb_build_object(
                'submitted', count(*),
                'accepted', count(*) FILTER (WHERE status = 'accepted'),
                'rejected', count(*) FILTER (WHERE status = 'rejected'),
                'waiting', count(*) FILTER (WHERE status = 'submitted')
            ) FROM app.place_proposals WHERE created_at >= v_since
        ),
        'reviews', (
            SELECT jsonb_build_object(
                'written', count(*),
                'of_guides_average', round(avg(rating) FILTER (WHERE direction = 'traveller_to_guide')::numeric, 2)
            ) FROM app.guide_reviews WHERE created_at >= v_since
        ),
        'reports', (
            SELECT jsonb_build_object(
                'open', count(*) FILTER (WHERE status IN ('open', 'investigating')),
                'safety', count(*) FILTER (WHERE reason = 'guide_safety')
            ) FROM app.support_cases WHERE reason LIKE 'guide\_%' AND created_at >= v_since
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.current_guide_agreement_version(),
    app.guide_accepted_agreement(uuid),
    app.guide_accept_agreement(uuid, text),
    app.report_guide_day(uuid, jsonb),
    app.admin_guide_funnel(uuid, integer)
TO mshwar_backend;
