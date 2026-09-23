-- 035_guide_engagements.sql
-- G3 of the supply-side pivot: a traveller hires a licensed guide for a planned day.
--
-- An engagement is a guide attached to one version of a trip. The guide can say
-- yes, say no, or answer with changes; changes are a diff against that version,
-- never a free-text counter-offer, so the traveller sees exactly which stops move.
-- Accepting the changes writes a new version (the planner's history already
-- works that way) and the engagement follows it.
--
-- The tier rule is enforced where the row is written: a local host cannot be
-- hired from the planner, and neither can a guide whose licence has lapsed. The
-- matching query applies the same rule, and the insert checks it again.

-- ---- Hire terms on the profile ----------------------------------------------------------
ALTER TABLE app.guide_profiles
    ADD COLUMN IF NOT EXISTS day_rate_minor bigint CHECK (day_rate_minor IS NULL OR day_rate_minor >= 0),
    ADD COLUMN IF NOT EXISTS max_group integer NOT NULL DEFAULT 12 CHECK (max_group BETWEEN 1 AND 60);

ALTER TABLE app.guide_profiles DROP CONSTRAINT IF EXISTS guide_host_has_no_rate;
ALTER TABLE app.guide_profiles ADD CONSTRAINT guide_host_has_no_rate
    CHECK (tier = 'licensed' OR coalesce(day_rate_minor, 0) = 0);

-- Hireable is derived, like the badge: approved, licensed, licence verified and in date.
CREATE OR REPLACE FUNCTION app.guide_hireable(p_profile uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce((
        SELECT g.status = 'approved' AND g.tier = 'licensed' AND g.organization_id IS NOT NULL
               AND app.guide_has_badge(g.id)
        FROM app.guide_profiles g WHERE g.id = p_profile
    ), false);
$$;

-- The public and private profile gain the hire terms. Same shape as 033 otherwise.
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

CREATE OR REPLACE FUNCTION app.guide_set_hire_terms(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
    v_rate bigint := NULLIF(p_payload->>'day_rate_minor', '')::bigint;
    v_group integer := coalesce(NULLIF(p_payload->>'max_group', '')::integer, 12);
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE user_id = p_user;
    IF g.id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    IF g.tier = 'host' AND coalesce(v_rate, 0) > 0 THEN
        RAISE EXCEPTION 'a local host cannot be hired from the planner' USING ERRCODE = '22023';
    END IF;
    IF v_rate IS NOT NULL AND v_rate < 0 THEN
        RAISE EXCEPTION 'day rate cannot be negative' USING ERRCODE = '22023';
    END IF;
    IF v_group NOT BETWEEN 1 AND 60 THEN
        RAISE EXCEPTION 'group size must be between 1 and 60' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_profiles SET day_rate_minor = v_rate, max_group = v_group, updated_at = now()
    WHERE id = g.id;
    RETURN app.guide_profile_json(g.id, true);
END;
$$;

-- ---- Engagements ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_engagements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id uuid NOT NULL REFERENCES app.trips(id),
    base_version_id uuid NOT NULL REFERENCES app.trip_versions(id),
    trip_version_id uuid NOT NULL REFERENCES app.trip_versions(id),
    traveller_id uuid NOT NULL REFERENCES app.users(id),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id),
    local_date date NOT NULL,
    party_size integer NOT NULL CHECK (party_size > 0),
    rate_minor bigint NOT NULL CHECK (rate_minor >= 0),
    currency text NOT NULL DEFAULT 'USD',
    message text NOT NULL DEFAULT '',
    -- What the guide needs on the day: {"dietary": "", "accessibility": "", "children": ""}.
    party_notes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(party_notes) = 'object'),
    contact_phone text NOT NULL DEFAULT '',
    state text NOT NULL DEFAULT 'requested' CHECK (state IN (
        'requested', 'accepted', 'declined', 'changes_proposed', 'confirmed', 'completed', 'cancelled'
    )),
    -- The guide's counter-proposal: the stops they would run and the diff against trip_version_id.
    proposal jsonb,
    decline_reason text NOT NULL DEFAULT '',
    cancelled_by uuid REFERENCES app.users(id),
    responded_at timestamptz,
    confirmed_at timestamptz,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (state <> 'changes_proposed' OR proposal IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS guide_engagements_guide_idx ON app.guide_engagements (guide_profile_id, local_date);
CREATE INDEX IF NOT EXISTS guide_engagements_trip_idx ON app.guide_engagements (trip_id, created_at DESC);
-- A guide works one hired day at a time.
CREATE UNIQUE INDEX IF NOT EXISTS guide_engagements_one_day
    ON app.guide_engagements (guide_profile_id, local_date)
    WHERE state IN ('accepted', 'changes_proposed', 'confirmed');
-- And a trip does not ask the same guide twice while the first ask is open.
CREATE UNIQUE INDEX IF NOT EXISTS guide_engagements_one_open_ask
    ON app.guide_engagements (trip_id, guide_profile_id)
    WHERE state IN ('requested', 'accepted', 'changes_proposed', 'confirmed');

CREATE OR REPLACE FUNCTION app.guard_engagement_tier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = app, public
AS $$
BEGIN
    IF (SELECT tier FROM app.guide_profiles WHERE id = NEW.guide_profile_id) = 'host' THEN
        RAISE EXCEPTION 'a local host cannot be hired from the planner' USING ERRCODE = '42501';
    END IF;
    IF NOT app.guide_hireable(NEW.guide_profile_id) THEN
        RAISE EXCEPTION 'guide is not available for hire' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS engagement_tier_guard ON app.guide_engagements;
CREATE TRIGGER engagement_tier_guard
    BEFORE INSERT OR UPDATE OF guide_profile_id ON app.guide_engagements
    FOR EACH ROW EXECUTE FUNCTION app.guard_engagement_tier();

ALTER TABLE app.guide_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_engagements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_parties ON app.guide_engagements;
CREATE POLICY engagement_parties ON app.guide_engagements FOR ALL TO mshwar_backend
    USING (
        traveller_id = app.current_user_id()
        OR EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_engagements.guide_profile_id AND g.user_id = app.current_user_id())
    )
    WITH CHECK (
        traveller_id = app.current_user_id()
        OR EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_engagements.guide_profile_id AND g.user_id = app.current_user_id())
    );
DROP POLICY IF EXISTS engagement_hireable ON app.guide_engagements;
CREATE POLICY engagement_hireable ON app.guide_engagements AS RESTRICTIVE FOR INSERT TO mshwar_backend
    WITH CHECK (app.guide_hireable(guide_profile_id));
GRANT SELECT, INSERT, UPDATE ON app.guide_engagements TO mshwar_backend;

-- ---- Reading a version the way a guide needs it -----------------------------------------
CREATE OR REPLACE FUNCTION app.engagement_itinerary(p_version uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'version_id', v.id,
        'version', v.version,
        'window_start', v.window_start,
        'return_by', v.return_by,
        'party_size', v.party_size,
        'start_lat', ST_Y(v.start_location::geometry),
        'start_lng', ST_X(v.start_location::geometry),
        'stops', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'position', s.position,
                'experience_id', e.id,
                'slug', e.slug,
                'title', e.title,
                'starts_at', s.starts_at,
                'ends_at', s.ends_at,
                'locked', s.locked,
                'destination_slug', d.slug,
                'lat', ST_Y(vn.location::geometry),
                'lng', ST_X(vn.location::geometry)
            ) ORDER BY s.position)
            FROM app.trip_stops s
            JOIN app.experiences e ON e.id = s.experience_id
            JOIN app.venues vn ON vn.id = e.venue_id
            LEFT JOIN app.destinations d ON d.id = vn.destination_id
            WHERE s.version_id = v.id
        ), '[]'::jsonb),
        'legs', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'position', l.position, 'distance_m', l.distance_m,
                'duration_seconds', l.duration_seconds, 'status', l.status
            ) ORDER BY l.position)
            FROM app.trip_legs l WHERE l.version_id = v.id
        ), '[]'::jsonb)
    )
    FROM app.trip_versions v WHERE v.id = p_version;
$$;

-- The places a version visits, as the region handles guides list: destination
-- slugs, their parents, and their region names ("North Lebanon" -> north-lebanon).
CREATE OR REPLACE FUNCTION app.version_regions(p_version uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(array_agg(DISTINCT r) FILTER (WHERE r IS NOT NULL AND r <> ''), '{}')
    FROM (
        SELECT unnest(ARRAY[d.slug, p.slug, app.slugify(d.region)]) AS r
        FROM app.trip_stops s
        JOIN app.experiences e ON e.id = s.experience_id
        JOIN app.venues vn ON vn.id = e.venue_id
        JOIN app.destinations d ON d.id = vn.destination_id
        LEFT JOIN app.destinations p ON p.id = d.parent_id
        WHERE s.version_id = p_version
    ) x;
$$;

CREATE OR REPLACE FUNCTION app.guide_engagement_json(p_engagement uuid, p_viewer uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements;
    g app.guide_profiles;
    v_as_guide boolean;
    v_confirmed boolean;
BEGIN
    SELECT * INTO x FROM app.guide_engagements WHERE id = p_engagement;
    IF x.id IS NULL THEN
        RAISE EXCEPTION 'engagement not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO g FROM app.guide_profiles WHERE id = x.guide_profile_id;
    v_as_guide := g.user_id = p_viewer;
    IF NOT v_as_guide AND x.traveller_id <> p_viewer THEN
        RAISE EXCEPTION 'engagement not found' USING ERRCODE = 'P0002';
    END IF;
    v_confirmed := x.state IN ('confirmed', 'completed');
    RETURN jsonb_build_object(
        'id', x.id,
        'trip_id', x.trip_id,
        'trip_title', (SELECT title FROM app.trips WHERE id = x.trip_id),
        'viewer_role', CASE WHEN v_as_guide THEN 'guide' ELSE 'traveller' END,
        'state', x.state,
        'local_date', x.local_date,
        'party_size', x.party_size,
        'rate_minor', x.rate_minor,
        'currency', x.currency,
        'message', x.message,
        'party_notes', x.party_notes,
        'decline_reason', x.decline_reason,
        'created_at', x.created_at,
        'responded_at', x.responded_at,
        'confirmed_at', x.confirmed_at,
        'completed_at', x.completed_at,
        'cancelled_at', x.cancelled_at,
        'guide', app.guide_profile_json(g.id, false),
        'traveller_name', (SELECT display_name FROM app.users WHERE id = x.traveller_id),
        'itinerary', app.engagement_itinerary(x.trip_version_id),
        'proposal', x.proposal,
        -- Phone numbers cross only once both sides have said yes.
        'contact', CASE WHEN v_confirmed THEN
            CASE WHEN v_as_guide THEN jsonb_build_object('phone', x.contact_phone)
                 ELSE jsonb_build_object('phone', g.phone) END
        ELSE NULL END
    );
END;
$$;

-- ---- Matching ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.match_guides_for_version(p_user uuid, p_version uuid, p_filters jsonb DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v app.trip_versions;
    v_regions text[];
    v_day date;
    v_language text := NULLIF(btrim(coalesce(p_filters->>'language', '')), '');
    v_party integer;
BEGIN
    SELECT tv.* INTO v FROM app.trip_versions tv JOIN app.trips t ON t.id = tv.trip_id
    WHERE tv.id = p_version AND t.owner_id = p_user;
    IF v.id IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;
    v_regions := app.version_regions(v.id);
    v_day := (v.window_start AT TIME ZONE 'Asia/Beirut')::date;
    v_party := coalesce(NULLIF(p_filters->>'party_size', '')::integer, v.party_size);

    RETURN coalesce((
        SELECT jsonb_agg(row ORDER BY (row->>'score')::integer DESC, row->>'display_name')
        FROM (
            SELECT app.guide_profile_json(g.id, false) || jsonb_build_object(
                'matched_regions', to_jsonb(ARRAY(SELECT unnest(g.regions) INTERSECT SELECT unnest(v_regions))),
                'matched_language', v_language IS NULL OR v_language = ANY (g.languages),
                'score', cardinality(ARRAY(SELECT unnest(g.regions) INTERSECT SELECT unnest(v_regions))) * 10
                         + coalesce(least(g.years_guiding, 9), 0)
            ) AS row
            FROM app.guide_profiles g
            LEFT JOIN app.guide_availability a ON a.guide_profile_id = g.id
            WHERE app.guide_hireable(g.id)
              AND g.day_rate_minor IS NOT NULL
              AND g.max_group >= v_party
              AND (cardinality(v_regions) = 0 OR g.regions && v_regions)
              AND (v_language IS NULL OR v_language = ANY (g.languages))
              AND v.window_start >= now() + make_interval(hours => coalesce(a.min_notice_hours, 24))
              AND NOT EXISTS (
                  SELECT 1 FROM app.guide_availability_exceptions ex
                  WHERE ex.guide_profile_id = g.id AND ex.local_date = v_day
              )
              AND NOT EXISTS (
                  SELECT 1 FROM app.guide_engagements busy
                  WHERE busy.guide_profile_id = g.id AND busy.local_date = v_day
                    AND busy.state IN ('accepted', 'changes_proposed', 'confirmed')
              )
              AND g.user_id <> p_user
        ) matched
    ), '[]'::jsonb);
END;
$$;

-- ---- Notifications for either side --------------------------------------------------------
CREATE OR REPLACE FUNCTION app.notify_engagement(p_engagement uuid, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements;
    v_guide_user uuid;
    v_to_guide boolean := p_event IN ('engagement.requested', 'engagement.confirmed', 'engagement.cancelled_by_traveller');
BEGIN
    SELECT * INTO x FROM app.guide_engagements WHERE id = p_engagement;
    SELECT user_id INTO v_guide_user FROM app.guide_profiles WHERE id = x.guide_profile_id;
    PERFORM app.emit_notification_event(
        p_event,
        x.id,
        CASE WHEN v_to_guide THEN v_guide_user ELSE x.traveller_id END,
        NULL,
        jsonb_build_object(
            'engagement_id', x.id,
            'trip_id', x.trip_id,
            'recipient', CASE WHEN v_to_guide THEN 'guide' ELSE 'traveller' END,
            'local_date', x.local_date,
            'status', x.state
        )
    );
END;
$$;

-- Deep links learn the guide surfaces. Same cases as 020 plus the guide ones.
CREATE OR REPLACE FUNCTION app.notification_deep_link(p_event text, p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_event LIKE 'engagement.%' AND p_payload->>'recipient' = 'guide' THEN
            '/guide/requests/' || coalesce(p_payload->>'engagement_id', p_payload->>'aggregate_id', '')
        WHEN p_event LIKE 'engagement.%' THEN
            '/plan/' || coalesce(p_payload->>'trip_id', '') || '/guide'
        WHEN p_event LIKE 'guide.%' THEN
            coalesce(p_payload->>'path', '/guide')
        WHEN p_event LIKE 'business.%' THEN
            '/business/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
        WHEN p_event = 'itinerary.material_change' THEN
            '/trips?highlight=' || coalesce(p_payload->>'trip_id', p_payload->>'aggregate_id', '')
        ELSE
            '/bookings?highlight=' || coalesce(p_payload->>'booking_id', p_payload->>'aggregate_id', '')
    END
$$;

INSERT INTO app.notification_templates (event_type, locale, audience, title, body) VALUES
    ('engagement.requested', 'en', 'traveller', 'A traveller wants you for their day',
     'Someone has asked you to guide a planned day. Open the request to accept, decline or propose changes: {deep_link}'),
    ('engagement.requested', 'ar', 'traveller', 'مسافر يطلبك ليومه',
     'طلب أحدهم أن ترشده في يوم مخطَّط. افتح الطلب لتقبل أو ترفض أو تقترح تعديلات: {deep_link}'),
    ('engagement.requested', 'fr', 'traveller', 'Un voyageur vous demande pour sa journée',
     'On vous demande de guider une journée planifiée. Ouvrez la demande pour accepter, refuser ou proposer des changements : {deep_link}'),
    ('engagement.accepted', 'en', 'traveller', 'Your guide said yes',
     'Your guide accepted the day as planned. Confirm it to lock it in: {deep_link}'),
    ('engagement.accepted', 'ar', 'traveller', 'وافق مرشدك',
     'وافق مرشدك على اليوم كما خُطِّط. أكّده لتثبيته: {deep_link}'),
    ('engagement.accepted', 'fr', 'traveller', 'Votre guide a dit oui',
     'Votre guide accepte la journée telle qu’elle est prévue. Confirmez-la : {deep_link}'),
    ('engagement.changes_proposed', 'en', 'traveller', 'Your guide suggested changes',
     'Your guide would run the day a little differently. See exactly what changes: {deep_link}'),
    ('engagement.changes_proposed', 'ar', 'traveller', 'اقترح مرشدك تعديلات',
     'يقترح مرشدك تنظيم اليوم بشكل مختلف قليلًا. اطّلع على التعديلات بدقّة: {deep_link}'),
    ('engagement.changes_proposed', 'fr', 'traveller', 'Votre guide propose des changements',
     'Votre guide ferait la journée un peu autrement. Voyez précisément ce qui change : {deep_link}'),
    ('engagement.declined', 'en', 'traveller', 'Your guide can’t make it',
     'The guide you asked is not available. Other guides may be: {deep_link}'),
    ('engagement.declined', 'ar', 'traveller', 'مرشدك غير متاح',
     'المرشد الذي طلبته غير متاح. قد يتوفّر مرشدون آخرون: {deep_link}'),
    ('engagement.declined', 'fr', 'traveller', 'Votre guide n’est pas disponible',
     'Le guide demandé n’est pas disponible. D’autres le sont peut-être : {deep_link}'),
    ('engagement.confirmed', 'en', 'traveller', 'Your day is confirmed',
     'The traveller confirmed. Their day and contact details are ready: {deep_link}'),
    ('engagement.confirmed', 'ar', 'traveller', 'تأكّد اليوم',
     'أكّد المسافر. تفاصيل اليوم ووسائل التواصل جاهزة: {deep_link}'),
    ('engagement.confirmed', 'fr', 'traveller', 'Journée confirmée',
     'Le voyageur a confirmé. Le déroulé et ses coordonnées sont prêts : {deep_link}'),
    ('engagement.cancelled_by_traveller', 'en', 'traveller', 'A hired day was cancelled',
     'The traveller cancelled the day they had asked you for: {deep_link}'),
    ('engagement.cancelled_by_traveller', 'ar', 'traveller', 'أُلغي يوم محجوز',
     'ألغى المسافر اليوم الذي طلبك له: {deep_link}'),
    ('engagement.cancelled_by_traveller', 'fr', 'traveller', 'Une journée a été annulée',
     'Le voyageur a annulé la journée pour laquelle il vous avait demandé : {deep_link}'),
    ('engagement.cancelled_by_guide', 'en', 'traveller', 'Your guide cancelled',
     'Your guide can no longer run your day. You can ask another guide: {deep_link}'),
    ('engagement.cancelled_by_guide', 'ar', 'traveller', 'ألغى مرشدك',
     'لم يعد مرشدك قادرًا على مرافقتك. يمكنك طلب مرشد آخر: {deep_link}'),
    ('engagement.cancelled_by_guide', 'fr', 'traveller', 'Votre guide a annulé',
     'Votre guide ne peut plus assurer votre journée. Vous pouvez en demander un autre : {deep_link}')
ON CONFLICT (event_type, locale, audience) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;

-- ---- The traveller asks -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.request_guide_engagement(
    p_user uuid, p_version uuid, p_guide_slug text, p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v app.trip_versions;
    g app.guide_profiles;
    v_party integer;
    v_id uuid;
    v_notes jsonb := coalesce(p_payload->'party_notes', '{}'::jsonb);
BEGIN
    SELECT tv.* INTO v FROM app.trip_versions tv JOIN app.trips t ON t.id = tv.trip_id
    WHERE tv.id = p_version AND t.owner_id = p_user;
    IF v.id IS NULL THEN
        RAISE EXCEPTION 'version not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO g FROM app.guide_profiles WHERE slug = p_guide_slug AND status = 'approved';
    IF g.id IS NULL THEN
        RAISE EXCEPTION 'guide not found' USING ERRCODE = 'P0002';
    END IF;
    IF g.tier = 'host' THEN
        RAISE EXCEPTION 'a local host cannot be hired from the planner' USING ERRCODE = '42501';
    END IF;
    v_party := coalesce(NULLIF(p_payload->>'party_size', '')::integer, v.party_size);
    IF jsonb_typeof(v_notes) <> 'object' THEN
        RAISE EXCEPTION 'party notes must be an object' USING ERRCODE = '22023';
    END IF;
    -- The insert re-runs the match rather than trusting that the screen showed this guide.
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
            app.match_guides_for_version(p_user, p_version, jsonb_build_object('party_size', v_party))
        ) m WHERE m->>'id' = g.id::text
    ) THEN
        RAISE EXCEPTION 'guide is not available for this day' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.guide_engagements (
        trip_id, base_version_id, trip_version_id, traveller_id, guide_profile_id,
        local_date, party_size, rate_minor, message, party_notes, contact_phone
    ) VALUES (
        v.trip_id, v.id, v.id, p_user, g.id,
        (v.window_start AT TIME ZONE 'Asia/Beirut')::date, v_party, g.day_rate_minor,
        left(coalesce(p_payload->>'message', ''), 2000),
        jsonb_strip_nulls(jsonb_build_object(
            'dietary', left(v_notes->>'dietary', 500),
            'accessibility', left(v_notes->>'accessibility', 500),
            'children', left(v_notes->>'children', 500)
        )),
        left(coalesce(p_payload->>'contact_phone', ''), 32)
    ) RETURNING id INTO v_id;

    PERFORM app.notify_engagement(v_id, 'engagement.requested');
    RETURN app.guide_engagement_json(v_id, p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.list_trip_engagements(p_user uuid, p_trip uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.trips WHERE id = p_trip AND owner_id = p_user) THEN
        RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(app.guide_engagement_json(x.id, p_user) ORDER BY x.created_at DESC)
        FROM app.guide_engagements x WHERE x.trip_id = p_trip AND x.traveller_id = p_user
    ), '[]'::jsonb);
END;
$$;

-- ---- The guide answers --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_list_engagements(p_user uuid, p_state text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles;
BEGIN
    SELECT * INTO g FROM app.guide_profiles WHERE user_id = p_user;
    IF g.id IS NULL THEN
        RAISE EXCEPTION 'guide profile not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(app.guide_engagement_json(x.id, p_user) ORDER BY x.local_date, x.created_at)
        FROM app.guide_engagements x
        WHERE x.guide_profile_id = g.id AND (p_state IS NULL OR x.state = p_state)
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.get_engagement(p_user uuid, p_engagement uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT app.guide_engagement_json(p_engagement, p_user);
$$;

-- Lock one engagement for the guide who owns it.
CREATE OR REPLACE FUNCTION app.engagement_for_guide(p_user uuid, p_engagement uuid)
RETURNS app.guide_engagements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements;
BEGIN
    SELECT e.* INTO x FROM app.guide_engagements e
    JOIN app.guide_profiles g ON g.id = e.guide_profile_id
    WHERE e.id = p_engagement AND g.user_id = p_user
    FOR UPDATE OF e;
    IF x.id IS NULL THEN
        RAISE EXCEPTION 'engagement not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN x;
END;
$$;

CREATE OR REPLACE FUNCTION app.engagement_for_traveller(p_user uuid, p_engagement uuid)
RETURNS app.guide_engagements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements;
BEGIN
    SELECT * INTO x FROM app.guide_engagements WHERE id = p_engagement AND traveller_id = p_user FOR UPDATE;
    IF x.id IS NULL THEN
        RAISE EXCEPTION 'engagement not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN x;
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_answer_engagement(p_user uuid, p_engagement uuid, p_answer text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements := app.engagement_for_guide(p_user, p_engagement);
BEGIN
    IF x.state <> 'requested' THEN
        RAISE EXCEPTION 'this request has already been answered' USING ERRCODE = '22023';
    END IF;
    IF p_answer = 'accept' THEN
        -- The one-day index turns a double booking into a readable refusal.
        IF EXISTS (
            SELECT 1 FROM app.guide_engagements o
            WHERE o.guide_profile_id = x.guide_profile_id AND o.local_date = x.local_date AND o.id <> x.id
              AND o.state IN ('accepted', 'changes_proposed', 'confirmed')
        ) THEN
            RAISE EXCEPTION 'you already have a hired day on this date' USING ERRCODE = '22023';
        END IF;
        UPDATE app.guide_engagements SET state = 'accepted', responded_at = now(), updated_at = now()
        WHERE id = x.id;
        PERFORM app.notify_engagement(x.id, 'engagement.accepted');
    ELSIF p_answer = 'decline' THEN
        IF NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN
            RAISE EXCEPTION 'say why, so the traveller can plan around it' USING ERRCODE = '22023';
        END IF;
        UPDATE app.guide_engagements
        SET state = 'declined', decline_reason = left(p_reason, 500), responded_at = now(), updated_at = now()
        WHERE id = x.id;
        PERFORM app.notify_engagement(x.id, 'engagement.declined');
    ELSE
        RAISE EXCEPTION 'answer must be accept or decline' USING ERRCODE = '22023';
    END IF;
    RETURN app.guide_engagement_json(x.id, p_user);
END;
$$;

-- A counter-proposal: the full list of stops the guide would run. The server
-- computes the diff against the engagement's version, and refuses to touch a
-- stop the traveller locked.
CREATE OR REPLACE FUNCTION app.guide_propose_changes(p_user uuid, p_engagement uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements := app.engagement_for_guide(p_user, p_engagement);
    v_item jsonb;
    v_stops jsonb := '[]'::jsonb;
    v_base app.trip_stops;
    v_exp app.experiences;
    v_position integer := 0;
    v_starts timestamptz;
    v_ends timestamptz;
    v_prev_end timestamptz;
    v_kept uuid[] := '{}';
    v_added jsonb := '[]'::jsonb;
    v_removed jsonb;
    v_retimed jsonb := '[]'::jsonb;
    v_moved jsonb := '[]'::jsonb;
    v_rate bigint := NULLIF(p_payload->>'rate_minor', '')::bigint;
BEGIN
    IF x.state NOT IN ('requested', 'changes_proposed') THEN
        RAISE EXCEPTION 'changes can only be proposed before the day is agreed' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_payload->'stops') <> 'array' OR jsonb_array_length(p_payload->'stops') = 0 THEN
        RAISE EXCEPTION 'a proposal needs at least one stop' USING ERRCODE = '22023';
    END IF;
    IF v_rate IS NOT NULL AND v_rate < 0 THEN
        RAISE EXCEPTION 'rate cannot be negative' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'stops') LOOP
        v_starts := (v_item->>'starts_at')::timestamptz;
        v_ends := (v_item->>'ends_at')::timestamptz;
        IF v_starts IS NULL OR v_ends IS NULL OR v_ends <= v_starts THEN
            RAISE EXCEPTION 'each stop needs a start before its end' USING ERRCODE = '22023';
        END IF;
        IF v_prev_end IS NOT NULL AND v_starts < v_prev_end THEN
            RAISE EXCEPTION 'stops overlap: put them in time order without overlaps' USING ERRCODE = '22023';
        END IF;
        v_prev_end := v_ends;
        v_position := v_position + 1;
        v_base := NULL;
        IF NULLIF(v_item->>'stop_id', '') IS NOT NULL THEN
            SELECT * INTO v_base FROM app.trip_stops
            WHERE id = (v_item->>'stop_id')::uuid AND version_id = x.trip_version_id;
            IF v_base.id IS NULL THEN
                RAISE EXCEPTION 'stop is not part of this plan' USING ERRCODE = '22023';
            END IF;
            IF v_base.id = ANY (v_kept) THEN
                RAISE EXCEPTION 'a stop appears twice' USING ERRCODE = '22023';
            END IF;
            v_kept := v_kept || v_base.id;
            SELECT * INTO v_exp FROM app.experiences WHERE id = v_base.experience_id;
            IF v_base.locked AND (v_base.starts_at <> v_starts OR v_base.ends_at <> v_ends) THEN
                RAISE EXCEPTION 'a locked stop cannot be changed: %', v_exp.title USING ERRCODE = '22023';
            END IF;
            IF v_base.starts_at <> v_starts OR v_base.ends_at <> v_ends THEN
                v_retimed := v_retimed || jsonb_build_object(
                    'stop_id', v_base.id, 'title', v_exp.title,
                    'from_starts_at', v_base.starts_at, 'from_ends_at', v_base.ends_at,
                    'starts_at', v_starts, 'ends_at', v_ends
                );
            END IF;
            IF v_base.position <> v_position THEN
                v_moved := v_moved || jsonb_build_object(
                    'stop_id', v_base.id, 'title', v_exp.title, 'from', v_base.position, 'to', v_position
                );
            END IF;
        ELSE
            SELECT * INTO v_exp FROM app.experiences WHERE slug = v_item->>'slug' AND status = 'published';
            IF v_exp.id IS NULL THEN
                RAISE EXCEPTION 'not a published place: %', coalesce(v_item->>'slug', '') USING ERRCODE = '22023';
            END IF;
            v_added := v_added || jsonb_build_object(
                'slug', v_exp.slug, 'title', v_exp.title, 'position', v_position,
                'starts_at', v_starts, 'ends_at', v_ends
            );
        END IF;
        v_stops := v_stops || jsonb_build_object(
            'position', v_position,
            'from_stop_id', v_base.id,
            'experience_id', v_exp.id,
            'slug', v_exp.slug,
            'title', v_exp.title,
            'starts_at', v_starts,
            'ends_at', v_ends,
            'locked', coalesce(v_base.locked, false)
        );
    END LOOP;

    -- A locked stop cannot be dropped either.
    IF EXISTS (
        SELECT 1 FROM app.trip_stops s
        WHERE s.version_id = x.trip_version_id AND s.locked AND NOT (s.id = ANY (v_kept))
    ) THEN
        RAISE EXCEPTION 'a locked stop cannot be removed: %', (
            SELECT e.title FROM app.trip_stops s JOIN app.experiences e ON e.id = s.experience_id
            WHERE s.version_id = x.trip_version_id AND s.locked AND NOT (s.id = ANY (v_kept))
            ORDER BY s.position LIMIT 1
        ) USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('stop_id', s.id, 'title', e.title, 'position', s.position)
                    ORDER BY s.position), '[]'::jsonb)
    INTO v_removed
    FROM app.trip_stops s JOIN app.experiences e ON e.id = s.experience_id
    WHERE s.version_id = x.trip_version_id AND NOT (s.id = ANY (v_kept));

    IF jsonb_array_length(v_added) + jsonb_array_length(v_removed) + jsonb_array_length(v_retimed)
       + jsonb_array_length(v_moved) = 0 AND (v_rate IS NULL OR v_rate = x.rate_minor) THEN
        RAISE EXCEPTION 'nothing changed: accept the day instead' USING ERRCODE = '22023';
    END IF;

    UPDATE app.guide_engagements
    SET state = 'changes_proposed',
        proposal = jsonb_build_object(
            'against_version_id', x.trip_version_id,
            'stops', v_stops,
            'diff', jsonb_build_object('added', v_added, 'removed', v_removed, 'retimed', v_retimed, 'moved', v_moved),
            'note', left(coalesce(p_payload->>'note', ''), 1000),
            'rate_minor', coalesce(v_rate, x.rate_minor),
            'proposed_at', now()
        ),
        responded_at = now(),
        updated_at = now()
    WHERE id = x.id;
    PERFORM app.notify_engagement(x.id, 'engagement.changes_proposed');
    RETURN app.guide_engagement_json(x.id, p_user);
END;
$$;

-- ---- The traveller decides -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.traveller_decide_engagement(p_user uuid, p_engagement uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements := app.engagement_for_traveller(p_user, p_engagement);
    base app.trip_versions;
    v_trip app.trips;
    v_new uuid;
    v_next integer;
    v_stop jsonb;
    v_from app.trip_stops;
BEGIN
    IF p_decision = 'confirm' THEN
        IF x.state <> 'accepted' THEN
            RAISE EXCEPTION 'only a day the guide accepted can be confirmed' USING ERRCODE = '22023';
        END IF;
        UPDATE app.guide_engagements SET state = 'confirmed', confirmed_at = now(), updated_at = now()
        WHERE id = x.id;
        PERFORM app.notify_engagement(x.id, 'engagement.confirmed');
    ELSIF p_decision = 'accept_changes' THEN
        IF x.state <> 'changes_proposed' THEN
            RAISE EXCEPTION 'there are no changes to accept' USING ERRCODE = '22023';
        END IF;
        IF (x.proposal->>'against_version_id')::uuid <> x.trip_version_id THEN
            RAISE EXCEPTION 'the plan changed since this proposal: ask the guide again' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_trip FROM app.trips WHERE id = x.trip_id FOR UPDATE;
        IF v_trip.status = 'locked' THEN
            RAISE EXCEPTION 'trip is locked' USING ERRCODE = '42501';
        END IF;
        SELECT * INTO base FROM app.trip_versions WHERE id = x.trip_version_id;
        SELECT coalesce(max(version), 0) + 1 INTO v_next FROM app.trip_versions WHERE trip_id = x.trip_id;
        -- A new version, in the planner's own history, marked as the guide's.
        INSERT INTO app.trip_versions (
            trip_id, version, created_by, origin, window_start, return_by, start_location,
            party_size, budget_minor, currency, strict_budget, constraints, validation
        ) VALUES (
            base.trip_id, v_next, p_user, 'manual',
            least(base.window_start, (SELECT min((s->>'starts_at')::timestamptz) FROM jsonb_array_elements(x.proposal->'stops') s)),
            greatest(base.return_by, (SELECT max((s->>'ends_at')::timestamptz) FROM jsonb_array_elements(x.proposal->'stops') s)),
            base.start_location, base.party_size, base.budget_minor, base.currency, base.strict_budget,
            base.constraints || jsonb_build_object('guide_engagement_id', x.id),
            base.validation
        ) RETURNING id INTO v_new;
        FOR v_stop IN SELECT value FROM jsonb_array_elements(x.proposal->'stops') LOOP
            v_from := NULL;
            IF NULLIF(v_stop->>'from_stop_id', '') IS NOT NULL THEN
                SELECT * INTO v_from FROM app.trip_stops WHERE id = (v_stop->>'from_stop_id')::uuid;
            END IF;
            INSERT INTO app.trip_stops (
                version_id, experience_id, position, starts_at, ends_at,
                estimated_minor, price_kind, locked, snapshot
            ) VALUES (
                v_new, (v_stop->>'experience_id')::uuid, (v_stop->>'position')::integer,
                (v_stop->>'starts_at')::timestamptz, (v_stop->>'ends_at')::timestamptz,
                coalesce(v_from.estimated_minor, 0), coalesce(v_from.price_kind, 'estimate'),
                coalesce(v_from.locked, false),
                coalesce(v_from.snapshot, '{}'::jsonb) || jsonb_build_object('proposed_by_guide', v_from.id IS NULL)
            );
        END LOOP;
        INSERT INTO app.trip_cost_items (version_id, kind, label, amount_minor)
        SELECT v_new, c.kind, c.label, c.amount_minor FROM app.trip_cost_items c WHERE c.version_id = base.id;

        UPDATE app.guide_engagements
        SET state = 'confirmed',
            trip_version_id = v_new,
            rate_minor = coalesce((x.proposal->>'rate_minor')::bigint, x.rate_minor),
            confirmed_at = now(),
            updated_at = now()
        WHERE id = x.id;
        PERFORM app.notify_engagement(x.id, 'engagement.confirmed');
    ELSIF p_decision = 'reject_changes' THEN
        IF x.state <> 'changes_proposed' THEN
            RAISE EXCEPTION 'there are no changes to reject' USING ERRCODE = '22023';
        END IF;
        UPDATE app.guide_engagements
        SET state = 'cancelled', cancelled_at = now(), cancelled_by = p_user, updated_at = now()
        WHERE id = x.id;
        PERFORM app.notify_engagement(x.id, 'engagement.cancelled_by_traveller');
    ELSE
        RAISE EXCEPTION 'decision must be confirm, accept_changes or reject_changes' USING ERRCODE = '22023';
    END IF;
    RETURN app.guide_engagement_json(x.id, p_user);
END;
$$;

CREATE OR REPLACE FUNCTION app.cancel_engagement(p_user uuid, p_engagement uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    x app.guide_engagements;
    v_guide_user uuid;
BEGIN
    SELECT * INTO x FROM app.guide_engagements WHERE id = p_engagement FOR UPDATE;
    SELECT user_id INTO v_guide_user FROM app.guide_profiles WHERE id = x.guide_profile_id;
    IF x.id IS NULL OR (x.traveller_id <> p_user AND v_guide_user IS DISTINCT FROM p_user) THEN
        RAISE EXCEPTION 'engagement not found' USING ERRCODE = 'P0002';
    END IF;
    IF x.state NOT IN ('requested', 'accepted', 'changes_proposed', 'confirmed') THEN
        RAISE EXCEPTION 'this day is already closed' USING ERRCODE = '22023';
    END IF;
    IF x.local_date < (now() AT TIME ZONE 'Asia/Beirut')::date THEN
        RAISE EXCEPTION 'this day has passed' USING ERRCODE = '22023';
    END IF;
    IF v_guide_user = p_user AND NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN
        RAISE EXCEPTION 'say why, so the traveller can plan around it' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_engagements
    SET state = 'cancelled', cancelled_at = now(), cancelled_by = p_user,
        decline_reason = left(coalesce(p_reason, ''), 500), updated_at = now()
    WHERE id = x.id;
    PERFORM app.notify_engagement(
        x.id, CASE WHEN v_guide_user = p_user THEN 'engagement.cancelled_by_guide' ELSE 'engagement.cancelled_by_traveller' END
    );
    RETURN app.guide_engagement_json(x.id, p_user);
END;
$$;

-- ---- A hired day closes the tour dates on it ------------------------------------------------
-- Same as 034, plus: no new tour starts on a day the guide is hired.
CREATE OR REPLACE FUNCTION app.guide_generate_tour_slots(p_user uuid, p_experience uuid, p_days integer DEFAULT 28)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    a app.guide_availability;
    e app.experiences;
    v_day date;
    v_entry jsonb;
    v_starts timestamptz;
    v_created integer := 0;
    v_skipped_cap integer := 0;
    v_rows integer;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id;
    IF e.id IS NULL THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO a FROM app.guide_availability WHERE guide_profile_id = g.id;
    IF a.guide_profile_id IS NULL OR jsonb_array_length(a.pattern) = 0 THEN
        RAISE EXCEPTION 'set a weekly pattern first' USING ERRCODE = '22023';
    END IF;

    FOR v_day IN
        SELECT generate_series(
            (now() AT TIME ZONE 'Asia/Beirut')::date,
            (now() AT TIME ZONE 'Asia/Beirut')::date + least(greatest(p_days, 1), 90) - 1,
            interval '1 day'
        )::date
    LOOP
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date = v_day
        );
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM app.guide_engagements h
            WHERE h.guide_profile_id = g.id AND h.local_date = v_day
              AND h.state IN ('accepted', 'changes_proposed', 'confirmed')
        );
        FOR v_entry IN SELECT * FROM jsonb_array_elements(a.pattern) LOOP
            CONTINUE WHEN (v_entry->>'weekday')::integer <> extract(isodow FROM v_day)::integer - 1;
            v_starts := (v_day + (v_entry->>'start')::time) AT TIME ZONE 'Asia/Beirut';
            CONTINUE WHEN v_starts < now() + make_interval(hours => a.min_notice_hours);
            IF (
                SELECT count(*) FROM app.slots s
                JOIN app.experiences x ON x.id = s.experience_id
                WHERE x.organization_id = g.organization_id
                  AND s.status = 'open'
                  AND (s.starts_at AT TIME ZONE 'Asia/Beirut')::date = v_day
            ) >= a.max_tours_per_day THEN
                v_skipped_cap := v_skipped_cap + 1;
                CONTINUE;
            END IF;
            INSERT INTO app.slots (
                experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status
            ) VALUES (
                e.id, v_starts, v_starts + make_interval(mins => e.duration_minutes),
                e.max_party, 0, true, 'guide-availability', now(), 'open'
            )
            ON CONFLICT (experience_id, starts_at) DO NOTHING;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_created := v_created + v_rows;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('created', v_created, 'skipped_for_daily_cap', v_skipped_cap);
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.guide_hireable(uuid),
    app.guide_set_hire_terms(uuid, jsonb),
    app.engagement_itinerary(uuid),
    app.version_regions(uuid),
    app.guide_engagement_json(uuid, uuid),
    app.match_guides_for_version(uuid, uuid, jsonb),
    app.notify_engagement(uuid, text),
    app.request_guide_engagement(uuid, uuid, text, jsonb),
    app.list_trip_engagements(uuid, uuid),
    app.guide_list_engagements(uuid, text),
    app.get_engagement(uuid, uuid),
    app.engagement_for_guide(uuid, uuid),
    app.engagement_for_traveller(uuid, uuid),
    app.guide_answer_engagement(uuid, uuid, text, text),
    app.guide_propose_changes(uuid, uuid, jsonb),
    app.traveller_decide_engagement(uuid, uuid, text),
    app.cancel_engagement(uuid, uuid, text),
    app.guide_generate_tour_slots(uuid, uuid, integer)
TO mshwar_backend;
