-- 061_tour_schedules.sql
-- Guide plan, step 2: the scheduling core.
--
-- Until now a guide had one weekly pattern shared by every tour, and nothing stopped
-- two travellers booking the same guide into two places at once. This migration gives
-- each tour its own schedules (weekdays, start times, a season, seats, shared or
-- private, a minimum group) and puts the guide's rules where no path can skip them:
--
--   * one guide, one place: a booking is refused when it overlaps another booked run,
--     a hired day, a day off or a blocked time, with a buffer and, when the guide asks
--     for it, the drive between the two meeting points;
--   * a private slot takes one booking; a shared one fills to its seats;
--   * minimum notice and a cut-off time ("tomorrow's bookings close at 18:00");
--   * the daily cap counts booked runs and hired days together;
--   * a shared run that misses its minimum group by the guide's deadline is cancelled
--     with a reason, never silently dropped.
--
-- Nothing is decided when slots are generated that could go stale: a slot is only a
-- start time. Whether it can be booked right now is asked of app.guide_slot_clash at
-- booking time (under a per-guide lock) and when the public page lists it.

-- ---- The guide's rules -----------------------------------------------------------------
ALTER TABLE app.guide_availability
    ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 30
        CHECK (buffer_minutes BETWEEN 0 AND 240),
    ADD COLUMN IF NOT EXISTS cutoff_time time,
    ADD COLUMN IF NOT EXISTS travel_aware boolean NOT NULL DEFAULT true;

-- ---- Schedules: one recurring rule for one tour ----------------------------------------
CREATE TABLE IF NOT EXISTS app.tour_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id uuid NOT NULL REFERENCES app.experiences(id) ON DELETE CASCADE,
    -- Monday = 0, as the weekly pattern.
    weekdays smallint[] NOT NULL
        CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]),
    start_times time[] NOT NULL CHECK (cardinality(start_times) BETWEEN 1 AND 8),
    valid_from date NOT NULL,
    valid_to date CHECK (valid_to IS NULL OR valid_to >= valid_from),
    capacity integer CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 60),
    mode text NOT NULL DEFAULT 'shared' CHECK (mode IN ('shared', 'private')),
    min_group integer NOT NULL DEFAULT 1 CHECK (min_group BETWEEN 1 AND 60),
    min_group_deadline_hours integer NOT NULL DEFAULT 24 CHECK (min_group_deadline_hours BETWEEN 1 AND 168),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (mode = 'shared' OR min_group = 1)
);
CREATE INDEX IF NOT EXISTS tour_schedules_experience_idx ON app.tour_schedules (experience_id);

ALTER TABLE app.tour_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tour_schedules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_schedule_org ON app.tour_schedules;
CREATE POLICY tour_schedule_org ON app.tour_schedules FOR ALL TO mshwar_backend
    USING (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = tour_schedules.experience_id AND e.organization_id = app.current_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM app.experiences e
        WHERE e.id = tour_schedules.experience_id AND e.organization_id = app.current_organization_id()
    ));
GRANT SELECT, INSERT, UPDATE, DELETE ON app.tour_schedules TO mshwar_backend;

-- A slot remembers the schedule that made it and the terms it was offered on.
ALTER TABLE app.slots
    ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES app.tour_schedules(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS private boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS min_group integer NOT NULL DEFAULT 1 CHECK (min_group >= 1),
    ADD COLUMN IF NOT EXISTS min_group_deadline timestamptz;
CREATE INDEX IF NOT EXISTS slots_schedule_idx ON app.slots (schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS slots_min_group_due_idx ON app.slots (min_group_deadline)
    WHERE min_group > 1 AND status = 'open';

-- ---- Busy blocks: time the guide cannot work --------------------------------------------
CREATE TABLE IF NOT EXISTS app.guide_busy_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_profile_id uuid NOT NULL REFERENCES app.guide_profiles(id) ON DELETE CASCADE,
    period tstzrange NOT NULL CHECK (NOT isempty(period) AND NOT lower_inf(period) AND NOT upper_inf(period)),
    -- 'external' blocks come from an imported calendar (a later step); only busy time
    -- is ever stored, never what the event was.
    kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'external')),
    note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (upper(period) - lower(period) <= interval '31 days')
);
CREATE INDEX IF NOT EXISTS guide_busy_blocks_period_idx ON app.guide_busy_blocks USING gist (guide_profile_id, period);

ALTER TABLE app.guide_busy_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.guide_busy_blocks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_busy_self ON app.guide_busy_blocks;
CREATE POLICY guide_busy_self ON app.guide_busy_blocks FOR ALL TO mshwar_backend
    USING (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_busy_blocks.guide_profile_id AND g.user_id = app.current_user_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM app.guide_profiles g
                   WHERE g.id = guide_busy_blocks.guide_profile_id AND g.user_id = app.current_user_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON app.guide_busy_blocks TO mshwar_backend;

-- ---- Travel between two meeting points --------------------------------------------------
-- A cautious estimate from the straight-line distance at 35 km/h, which is what a
-- Lebanese mountain road allows on a good day. It only ever widens the gap between two
-- runs, so an estimate on the slow side protects the traveller waiting at the second.
CREATE OR REPLACE FUNCTION app.guide_travel_minutes(p_from_venue uuid, p_to_venue uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT CASE
        WHEN p_from_venue IS NULL OR p_to_venue IS NULL OR p_from_venue = p_to_venue THEN 0
        ELSE coalesce((
            SELECT ceil(ST_Distance(a.location, b.location) / 1000.0 / 35.0 * 60.0)::integer
            FROM app.venues a, app.venues b
            WHERE a.id = p_from_venue AND b.id = p_to_venue
        ), 0)
    END;
$$;

-- ---- The one question: can this slot be booked right now? --------------------------------
-- NULL means yes. Otherwise a short reason code the API and the page can explain.
CREATE OR REPLACE FUNCTION app.guide_slot_clash(p_slot uuid, p_booking boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    s app.slots;
    v_org uuid;
    v_venue uuid;
    g app.guide_profiles;
    v_notice integer := 24;
    v_cap integer := 2;
    v_buffer integer := 30;
    v_cutoff time;
    v_travel boolean := true;
    v_day date;
    v_booked integer;
BEGIN
    SELECT * INTO s FROM app.slots WHERE id = p_slot;
    IF s.id IS NULL OR s.status <> 'open' THEN
        RETURN 'closed';
    END IF;
    IF s.starts_at <= now() THEN
        RETURN 'started';
    END IF;
    SELECT e.organization_id, e.venue_id INTO v_org, v_venue FROM app.experiences e WHERE e.id = s.experience_id;
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = v_org;
    IF g.id IS NULL THEN
        RETURN NULL; -- not a guide's slot: the business rules elsewhere apply
    END IF;
    IF g.status <> 'approved' THEN
        RETURN 'guide_unavailable';
    END IF;

    SELECT a.min_notice_hours, a.max_tours_per_day, a.buffer_minutes, a.cutoff_time, a.travel_aware
    INTO v_notice, v_cap, v_buffer, v_cutoff, v_travel
    FROM app.guide_availability a WHERE a.guide_profile_id = g.id;
    v_notice := coalesce(v_notice, 24);
    v_cap := coalesce(v_cap, 2);
    v_buffer := coalesce(v_buffer, 30);
    v_travel := coalesce(v_travel, true);
    v_day := (s.starts_at AT TIME ZONE 'Asia/Beirut')::date;

    IF s.starts_at < now() + make_interval(hours => v_notice) THEN
        RETURN 'notice';
    END IF;
    IF v_cutoff IS NOT NULL AND now() >= ((v_day - 1) + v_cutoff) AT TIME ZONE 'Asia/Beirut' THEN
        RETURN 'cutoff';
    END IF;

    -- A private run takes one party; a shared one fills to its seats.
    IF s.private AND EXISTS (
        SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status IN ('pending', 'confirmed')
    ) THEN
        RETURN 'private_taken';
    END IF;
    -- While a booking is being written its party is already counted (reserve_booking
    -- moves the counter first), and the counter's own check protects the seats.
    IF NOT p_booking AND s.reserved >= s.capacity THEN
        RETURN 'full';
    END IF;

    IF EXISTS (
        SELECT 1 FROM app.guide_availability_exceptions x
        WHERE x.guide_profile_id = g.id AND x.local_date = v_day
    ) THEN
        RETURN 'day_off';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.guide_engagements h
        WHERE h.guide_profile_id = g.id AND h.local_date = v_day
          AND h.state IN ('accepted', 'changes_proposed', 'confirmed')
    ) THEN
        RETURN 'hired';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.guide_busy_blocks k
        WHERE k.guide_profile_id = g.id
          AND k.period && tstzrange(
              s.starts_at - make_interval(mins => v_buffer), s.ends_at + make_interval(mins => v_buffer), '[)'
          )
    ) THEN
        RETURN 'blocked';
    END IF;

    -- One guide, one place: every other run with a live booking, with the buffer and
    -- the drive between the two meeting points on either side.
    IF EXISTS (
        SELECT 1
        FROM app.slots o
        JOIN app.experiences oe ON oe.id = o.experience_id
        WHERE oe.organization_id = v_org
          AND o.id <> s.id
          AND o.starts_at < s.ends_at + interval '1 day'
          AND o.ends_at > s.starts_at - interval '1 day'
          AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = o.id AND b.status IN ('pending', 'confirmed'))
          AND o.starts_at < s.ends_at + make_interval(mins => v_buffer
                + CASE WHEN v_travel THEN app.guide_travel_minutes(v_venue, oe.venue_id) ELSE 0 END)
          AND s.starts_at < o.ends_at + make_interval(mins => v_buffer
                + CASE WHEN v_travel THEN app.guide_travel_minutes(oe.venue_id, v_venue) ELSE 0 END)
    ) THEN
        RETURN 'overlap';
    END IF;

    -- The daily cap counts runs that are already booked, not starts on offer.
    IF NOT EXISTS (
        SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status IN ('pending', 'confirmed')
    ) THEN
        SELECT count(DISTINCT o.id) INTO v_booked
        FROM app.slots o
        JOIN app.experiences oe ON oe.id = o.experience_id
        WHERE oe.organization_id = v_org
          AND (o.starts_at AT TIME ZONE 'Asia/Beirut')::date = v_day
          AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = o.id AND b.status IN ('pending', 'confirmed'));
        IF v_booked >= v_cap THEN
            RETURN 'daily_cap';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_clash_message(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_code
        WHEN 'closed' THEN 'this time is no longer offered'
        WHEN 'started' THEN 'this time has already started'
        WHEN 'guide_unavailable' THEN 'this guide is not taking bookings'
        WHEN 'notice' THEN 'this time is too soon: the guide needs more notice'
        WHEN 'cutoff' THEN 'bookings for this day have closed'
        WHEN 'private_taken' THEN 'this time has been booked privately'
        WHEN 'full' THEN 'no seats left at this time'
        WHEN 'day_off' THEN 'the guide is not working that day'
        WHEN 'hired' THEN 'the guide is hired for that day'
        WHEN 'blocked' THEN 'the guide is not available at this time'
        WHEN 'overlap' THEN 'the guide is on another tour at this time'
        WHEN 'daily_cap' THEN 'the guide is fully booked that day'
        ELSE 'this time cannot be booked'
    END;
$$;

-- ---- The guard on every booking of a guide's tour ----------------------------------------
-- Runs inside reserve_booking's transaction, after the slot row is locked. The advisory
-- lock serialises bookings per guide, so two travellers booking two overlapping runs
-- of the same guide at the same moment cannot both win.
CREATE OR REPLACE FUNCTION app.guard_guide_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_code text;
BEGIN
    IF NEW.status NOT IN ('pending', 'confirmed') THEN
        RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM app.guide_profiles g WHERE g.organization_id = NEW.organization_id) THEN
        RETURN NEW;
    END IF;
    -- A start already under way is history being recorded (reserve_booking refuses to
    -- book one), not a new booking to weigh against the guide's week.
    IF (SELECT starts_at FROM app.slots WHERE id = NEW.slot_id) <= now() THEN
        RETURN NEW;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('guide-busy:' || NEW.organization_id::text, 0));
    v_code := app.guide_slot_clash(NEW.slot_id, true);
    IF v_code IS NOT NULL THEN
        RAISE EXCEPTION '%', app.guide_clash_message(v_code) USING ERRCODE = '23P01';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guide_booking_guard ON app.bookings;
CREATE TRIGGER guide_booking_guard
    BEFORE INSERT ON app.bookings
    FOR EACH ROW EXECUTE FUNCTION app.guard_guide_booking();

-- ---- Generating slots from schedules ------------------------------------------------------
-- Fills up to 120 days ahead. Never touches a slot that has a booking or a run: a
-- changed schedule only replaces future empty starts; booked ones stay until the guide
-- moves or cancels them with notice.
CREATE OR REPLACE FUNCTION app.generate_schedule_slots(p_schedule uuid, p_days integer DEFAULT 120)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    sc app.tour_schedules;
    e app.experiences;
    g app.guide_profiles;
    v_today date := (now() AT TIME ZONE 'Asia/Beirut')::date;
    v_day date;
    v_time time;
    v_starts timestamptz;
    v_rows integer;
    v_created integer := 0;
BEGIN
    SELECT * INTO sc FROM app.tour_schedules WHERE id = p_schedule;
    IF sc.id IS NULL THEN
        RETURN 0;
    END IF;
    SELECT * INTO e FROM app.experiences WHERE id = sc.experience_id;
    SELECT * INTO g FROM app.guide_profiles WHERE organization_id = e.organization_id;
    IF g.id IS NULL OR g.status <> 'approved' OR e.status = 'archived' THEN
        RETURN 0;
    END IF;

    FOR v_day IN
        SELECT generate_series(
            greatest(v_today, sc.valid_from),
            least(v_today + least(greatest(p_days, 1), 120) - 1, coalesce(sc.valid_to, v_today + 119)),
            interval '1 day'
        )::date
    LOOP
        CONTINUE WHEN NOT ((extract(isodow FROM v_day)::integer - 1)::smallint = ANY (sc.weekdays));
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date = v_day
        );
        FOREACH v_time IN ARRAY sc.start_times LOOP
            v_starts := (v_day + v_time) AT TIME ZONE 'Asia/Beirut';
            CONTINUE WHEN v_starts <= now();
            INSERT INTO app.slots (
                experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status,
                schedule_id, private, min_group, min_group_deadline
            ) VALUES (
                e.id, v_starts, v_starts + make_interval(mins => e.duration_minutes),
                coalesce(sc.capacity, e.max_party), 0, true, 'guide-schedule', now(), 'open',
                sc.id, sc.mode = 'private', sc.min_group,
                CASE WHEN sc.min_group > 1 THEN v_starts - make_interval(hours => sc.min_group_deadline_hours) END
            )
            ON CONFLICT (experience_id, starts_at) DO NOTHING;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_created := v_created + v_rows;
        END LOOP;
    END LOOP;
    RETURN v_created;
END;
$$;

-- Removes the future starts of one schedule that nobody has booked.
CREATE OR REPLACE FUNCTION app.clear_schedule_slots(p_schedule uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_rows integer;
BEGIN
    DELETE FROM app.slots s
    WHERE s.schedule_id = p_schedule
      AND s.starts_at > now()
      AND s.reserved = 0
      AND NOT EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM app.guide_runs r WHERE r.slot_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM app.slot_unit_holds u WHERE u.slot_id = s.id);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$;

-- ---- Reading and writing schedules --------------------------------------------------------
CREATE OR REPLACE FUNCTION app.tour_schedule_json(sc app.tour_schedules)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'id', sc.id,
        'experience_id', sc.experience_id,
        'weekdays', to_jsonb(sc.weekdays),
        'start_times', (SELECT jsonb_agg(to_char(t, 'HH24:MI') ORDER BY t) FROM unnest(sc.start_times) AS t),
        'valid_from', sc.valid_from,
        'valid_to', sc.valid_to,
        'capacity', sc.capacity,
        'mode', sc.mode,
        'min_group', sc.min_group,
        'min_group_deadline_hours', sc.min_group_deadline_hours,
        'upcoming_slots', (
            SELECT count(*) FROM app.slots s
            WHERE s.schedule_id = sc.id AND s.status = 'open' AND s.starts_at > now()
        )
    );
$$;

CREATE OR REPLACE FUNCTION app.guide_list_schedules(p_user uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id) THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN coalesce((
        SELECT jsonb_agg(app.tour_schedule_json(sc) ORDER BY sc.valid_from, sc.created_at)
        FROM app.tour_schedules sc WHERE sc.experience_id = p_experience
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_save_schedule(p_user uuid, p_experience uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    e app.experiences;
    v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
    v_weekdays smallint[];
    v_times time[];
    v_text text;
    v_from date := coalesce(NULLIF(p_payload->>'valid_from', '')::date, (now() AT TIME ZONE 'Asia/Beirut')::date);
    v_to date := NULLIF(p_payload->>'valid_to', '')::date;
    v_mode text := coalesce(NULLIF(p_payload->>'mode', ''), 'shared');
    v_capacity integer := NULLIF(p_payload->>'capacity', '')::integer;
    v_min integer := coalesce(NULLIF(p_payload->>'min_group', '')::integer, 1);
    v_deadline integer := coalesce(NULLIF(p_payload->>'min_group_deadline_hours', '')::integer, 24);
    sc app.tour_schedules;
    v_cleared integer := 0;
    v_created integer;
BEGIN
    SELECT * INTO e FROM app.experiences WHERE id = p_experience AND organization_id = g.organization_id;
    IF e.id IS NULL OR e.status = 'archived' THEN
        RAISE EXCEPTION 'tour not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM app.tour_schedules WHERE id = v_id AND experience_id = p_experience
    ) THEN
        RAISE EXCEPTION 'schedule not found' USING ERRCODE = 'P0002';
    END IF;

    IF jsonb_typeof(p_payload->'weekdays') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'choose at least one day of the week' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(DISTINCT d::smallint ORDER BY d::smallint) INTO v_weekdays
    FROM jsonb_array_elements_text(p_payload->'weekdays') AS d;
    IF v_weekdays IS NULL OR NOT (v_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]) THEN
        RAISE EXCEPTION 'choose at least one day of the week' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_payload->'start_times') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'add at least one start time' USING ERRCODE = '22023';
    END IF;
    FOR v_text IN SELECT jsonb_array_elements_text(p_payload->'start_times') LOOP
        IF v_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'start times are HH:MM, for example 09:30' USING ERRCODE = '22023';
        END IF;
    END LOOP;
    SELECT array_agg(DISTINCT t::time ORDER BY t::time) INTO v_times
    FROM jsonb_array_elements_text(p_payload->'start_times') AS t;
    IF v_times IS NULL OR cardinality(v_times) > 8 THEN
        RAISE EXCEPTION 'add between one and eight start times' USING ERRCODE = '22023';
    END IF;

    IF v_mode NOT IN ('shared', 'private') THEN
        RAISE EXCEPTION 'a schedule is shared or private' USING ERRCODE = '22023';
    END IF;
    IF v_to IS NOT NULL AND v_to < v_from THEN
        RAISE EXCEPTION 'the season ends before it starts' USING ERRCODE = '22023';
    END IF;
    IF v_capacity IS NOT NULL AND v_capacity NOT BETWEEN 1 AND 60 THEN
        RAISE EXCEPTION 'seats are between 1 and 60' USING ERRCODE = '22023';
    END IF;
    IF v_mode = 'private' THEN
        v_min := 1;
    END IF;
    IF v_min NOT BETWEEN 1 AND 60 OR v_min > coalesce(v_capacity, e.max_party) THEN
        RAISE EXCEPTION 'the minimum group must fit in the seats' USING ERRCODE = '22023';
    END IF;
    IF v_deadline NOT BETWEEN 1 AND 168 THEN
        RAISE EXCEPTION 'decide on the minimum group between 1 and 168 hours before' USING ERRCODE = '22023';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO app.tour_schedules (
            experience_id, weekdays, start_times, valid_from, valid_to, capacity, mode, min_group,
            min_group_deadline_hours
        ) VALUES (
            p_experience, v_weekdays, v_times, v_from, v_to, v_capacity, v_mode, v_min, v_deadline
        ) RETURNING * INTO sc;
    ELSE
        v_cleared := app.clear_schedule_slots(v_id);
        UPDATE app.tour_schedules
        SET weekdays = v_weekdays, start_times = v_times, valid_from = v_from, valid_to = v_to,
            capacity = v_capacity, mode = v_mode, min_group = v_min, min_group_deadline_hours = v_deadline,
            updated_at = now()
        WHERE id = v_id
        RETURNING * INTO sc;
    END IF;

    v_created := app.generate_schedule_slots(sc.id);
    RETURN app.tour_schedule_json(sc) || jsonb_build_object('created', v_created, 'cleared', v_cleared);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_delete_schedule(p_user uuid, p_schedule uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_cleared integer;
    v_kept integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app.tour_schedules sc
        JOIN app.experiences e ON e.id = sc.experience_id
        WHERE sc.id = p_schedule AND e.organization_id = g.organization_id
    ) THEN
        RAISE EXCEPTION 'schedule not found' USING ERRCODE = 'P0002';
    END IF;
    v_cleared := app.clear_schedule_slots(p_schedule);
    SELECT count(*) INTO v_kept FROM app.slots WHERE schedule_id = p_schedule AND starts_at > now();
    DELETE FROM app.tour_schedules WHERE id = p_schedule;
    RETURN jsonb_build_object('deleted', true, 'cleared', v_cleared, 'kept_booked', v_kept);
END;
$$;

-- ---- Blocking time -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_list_blocks(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    RETURN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
            'id', k.id,
            'starts_at', lower(k.period),
            'ends_at', upper(k.period),
            'kind', k.kind,
            'note', k.note
        ) ORDER BY lower(k.period))
        FROM app.guide_busy_blocks k
        WHERE k.guide_profile_id = g.id AND upper(k.period) > now()
    ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_add_block(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_starts timestamptz := NULLIF(p_payload->>'starts_at', '')::timestamptz;
    v_ends timestamptz := NULLIF(p_payload->>'ends_at', '')::timestamptz;
    v_note text := left(coalesce(btrim(p_payload->>'note'), ''), 200);
    v_id uuid;
BEGIN
    IF v_starts IS NULL OR v_ends IS NULL OR v_ends <= v_starts THEN
        RAISE EXCEPTION 'a block needs a start and a later end' USING ERRCODE = '22023';
    END IF;
    IF v_ends <= now() THEN
        RAISE EXCEPTION 'a block must end in the future' USING ERRCODE = '22023';
    END IF;
    IF v_ends - v_starts > interval '31 days' THEN
        RAISE EXCEPTION 'block at most 31 days at a time' USING ERRCODE = '22023';
    END IF;
    -- Travellers who already booked are not stranded by a block: move or cancel first.
    IF EXISTS (
        SELECT 1 FROM app.slots s
        JOIN app.experiences e ON e.id = s.experience_id
        WHERE e.organization_id = g.organization_id
          AND tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(v_starts, v_ends, '[)')
          AND EXISTS (SELECT 1 FROM app.bookings b WHERE b.slot_id = s.id AND b.status IN ('pending', 'confirmed'))
    ) THEN
        RAISE EXCEPTION 'you have a booking in that time: answer or cancel it first' USING ERRCODE = '23P01';
    END IF;
    INSERT INTO app.guide_busy_blocks (guide_profile_id, period, kind, note)
    VALUES (g.id, tstzrange(v_starts, v_ends, '[)'), 'manual', v_note)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('id', v_id, 'starts_at', v_starts, 'ends_at', v_ends, 'kind', 'manual', 'note', v_note);
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_delete_block(p_user uuid, p_block uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    DELETE FROM app.guide_busy_blocks WHERE id = p_block AND guide_profile_id = g.id AND kind = 'manual';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'block not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object('deleted', true);
END;
$$;

-- ---- The guide's rules, now with buffer, cut-off and travel ---------------------------------
CREATE OR REPLACE FUNCTION app.guide_get_availability(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    a app.guide_availability;
BEGIN
    SELECT * INTO a FROM app.guide_availability WHERE guide_profile_id = g.id;
    RETURN jsonb_build_object(
        'pattern', coalesce(a.pattern, '[]'::jsonb),
        'min_notice_hours', coalesce(a.min_notice_hours, 24),
        'max_tours_per_day', coalesce(a.max_tours_per_day, 2),
        'buffer_minutes', coalesce(a.buffer_minutes, 30),
        'cutoff_time', to_char(a.cutoff_time, 'HH24:MI'),
        'travel_aware', coalesce(a.travel_aware, true),
        'schedules', (
            SELECT count(*) FROM app.tour_schedules sc
            JOIN app.experiences e ON e.id = sc.experience_id
            WHERE e.organization_id = g.organization_id AND e.status <> 'archived'
        ),
        'exceptions', coalesce((
            SELECT jsonb_agg(jsonb_build_object('local_date', x.local_date, 'reason', x.reason) ORDER BY x.local_date)
            FROM app.guide_availability_exceptions x
            WHERE x.guide_profile_id = g.id AND x.local_date >= current_date
        ), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.guide_set_availability(p_user uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    a app.guide_availability;
    v_entry jsonb;
    v_cutoff text := NULLIF(btrim(coalesce(p_payload->>'cutoff_time', '')), '');
BEGIN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'pattern', '[]'::jsonb)) LOOP
        IF (v_entry->>'weekday')::integer NOT BETWEEN 0 AND 6
           OR (v_entry->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RAISE EXCEPTION 'each entry needs a weekday 0-6 and a start time HH:MM' USING ERRCODE = '22023';
        END IF;
    END LOOP;
    IF v_cutoff IS NOT NULL AND v_cutoff !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION 'the cut-off time is HH:MM, for example 18:00' USING ERRCODE = '22023';
    END IF;

    -- Fields left out keep what the guide set before.
    SELECT * INTO a FROM app.guide_availability WHERE guide_profile_id = g.id;
    INSERT INTO app.guide_availability (
        guide_profile_id, pattern, min_notice_hours, max_tours_per_day, buffer_minutes, cutoff_time, travel_aware
    )
    VALUES (
        g.id,
        coalesce(p_payload->'pattern', a.pattern, '[]'::jsonb),
        coalesce((p_payload->>'min_notice_hours')::integer, a.min_notice_hours, 24),
        coalesce((p_payload->>'max_tours_per_day')::integer, a.max_tours_per_day, 2),
        coalesce((p_payload->>'buffer_minutes')::integer, a.buffer_minutes, 30),
        CASE WHEN p_payload ? 'cutoff_time' THEN v_cutoff::time ELSE a.cutoff_time END,
        coalesce((p_payload->>'travel_aware')::boolean, a.travel_aware, true)
    )
    ON CONFLICT (guide_profile_id) DO UPDATE
    SET pattern = EXCLUDED.pattern,
        min_notice_hours = EXCLUDED.min_notice_hours,
        max_tours_per_day = EXCLUDED.max_tours_per_day,
        buffer_minutes = EXCLUDED.buffer_minutes,
        cutoff_time = EXCLUDED.cutoff_time,
        travel_aware = EXCLUDED.travel_aware,
        updated_at = now();

    IF p_payload ? 'exceptions' AND jsonb_typeof(p_payload->'exceptions') = 'array' THEN
        DELETE FROM app.guide_availability_exceptions WHERE guide_profile_id = g.id AND local_date >= current_date;
        INSERT INTO app.guide_availability_exceptions (guide_profile_id, local_date, reason)
        SELECT g.id, (x->>'local_date')::date, coalesce(x->>'reason', '')
        FROM jsonb_array_elements(p_payload->'exceptions') AS x
        WHERE (x->>'local_date')::date >= current_date
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN app.guide_get_availability(p_user);
END;
$$;

-- ---- A tour, now with its schedules ---------------------------------------------------------
CREATE OR REPLACE FUNCTION app.guide_tour_json(p_user uuid, p_experience uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
    v_tour app.guide_tours;
BEGIN
    SELECT * INTO v_tour FROM app.guide_tours WHERE experience_id = p_experience;
    RETURN app.get_experience_portal(p_user, g.organization_id, p_experience)
        || jsonb_build_object(
            'tier', g.tier,
            'languages', to_jsonb(coalesce(v_tour.languages, '{}'::text[])),
            'meeting_point', coalesce(v_tour.meeting_point, ''),
            'included', coalesce(v_tour.included, ''),
            'bring', coalesce(v_tour.bring, ''),
            'cancellation_terms', coalesce(v_tour.cancellation_terms, ''),
            'route', app.guide_tour_route(p_experience),
            'upcoming_slots', (
                SELECT count(*) FROM app.slots s
                WHERE s.experience_id = p_experience AND s.status = 'open' AND s.starts_at > now()
            ),
            'schedules', coalesce((
                SELECT jsonb_agg(app.tour_schedule_json(sc) ORDER BY sc.valid_from, sc.created_at)
                FROM app.tour_schedules sc WHERE sc.experience_id = p_experience
            ), '[]'::jsonb)
        );
END;
$$;

-- ---- The public side: only starts that can really be booked --------------------------------
CREATE OR REPLACE FUNCTION app.public_guide_tours(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'slug', e.slug,
        'title', e.title,
        'description', e.description,
        'duration_minutes', e.duration_minutes,
        'max_party', e.max_party,
        'min_age', e.min_age,
        'intensity', e.intensity,
        'languages', to_jsonb(t.languages),
        'meeting_point', t.meeting_point,
        'included', t.included,
        'bring', t.bring,
        'cancellation_terms', t.cancellation_terms,
        'price_minor', (SELECT pr.amount_minor FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1),
        'price_unit', (SELECT pr.unit FROM app.price_rules pr WHERE pr.experience_id = e.id LIMIT 1),
        'route', app.guide_tour_route(e.id),
        'next_slots', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'starts_at', s.starts_at,
                'remaining', s.capacity - s.reserved,
                'private', s.private,
                'min_group', s.min_group
            ) ORDER BY s.starts_at)
            FROM (
                SELECT * FROM app.slots s
                WHERE s.experience_id = e.id AND s.status = 'open'
                  AND s.starts_at > now() AND s.reserved < s.capacity
                  AND app.guide_slot_clash(s.id) IS NULL
                ORDER BY s.starts_at LIMIT 12
            ) s
        ), '[]'::jsonb)
    ) ORDER BY e.title), '[]'::jsonb)
    FROM app.guide_profiles g
    JOIN app.experiences e ON e.organization_id = g.organization_id AND e.status = 'published'
    LEFT JOIN app.guide_tours t ON t.experience_id = e.id
    WHERE g.slug = p_slug AND g.status = 'approved';
$$;

-- ---- Jobs -------------------------------------------------------------------------------------
-- Nightly: keep every live schedule filled 120 days ahead.
CREATE OR REPLACE FUNCTION app.guide_generate_all_slots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_schedule uuid;
    v_schedules integer := 0;
    v_created integer := 0;
BEGIN
    FOR v_schedule IN
        SELECT sc.id
        FROM app.tour_schedules sc
        JOIN app.experiences e ON e.id = sc.experience_id AND e.status <> 'archived'
        JOIN app.guide_profiles g ON g.organization_id = e.organization_id AND g.status = 'approved'
        WHERE sc.valid_to IS NULL OR sc.valid_to >= (now() AT TIME ZONE 'Asia/Beirut')::date
        ORDER BY sc.id
    LOOP
        v_created := v_created + app.generate_schedule_slots(v_schedule);
        v_schedules := v_schedules + 1;
    END LOOP;
    RETURN jsonb_build_object('schedules', v_schedules, 'created', v_created);
END;
$$;

-- Hourly: a shared run that has not reached its minimum group by the guide's deadline is
-- cancelled, with the reason, for everyone on it. The booking trigger tells each traveller.
CREATE OR REPLACE FUNCTION app.guide_min_group_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    s record;
    b record;
    v_runs integer := 0;
    v_bookings integer := 0;
BEGIN
    FOR s IN
        SELECT sl.id, sl.min_group
        FROM app.slots sl
        WHERE sl.min_group > 1
          AND sl.status = 'open'
          AND sl.min_group_deadline IS NOT NULL
          AND sl.min_group_deadline <= now()
          AND sl.starts_at > now()
          AND (
              SELECT coalesce(sum(bk.party_size), 0) FROM app.bookings bk
              WHERE bk.slot_id = sl.id AND bk.status IN ('pending', 'confirmed')
          ) < sl.min_group
        ORDER BY sl.starts_at
        FOR UPDATE SKIP LOCKED
    LOOP
        FOR b IN
            SELECT bk.id FROM app.bookings bk
            WHERE bk.slot_id = s.id AND bk.status IN ('pending', 'confirmed')
            ORDER BY bk.created_at
        LOOP
            PERFORM app.transition_booking(
                b.id, 'cancelled',
                format('The minimum group of %s was not reached, so this run is cancelled. Nothing is owed.', s.min_group)
            );
            v_bookings := v_bookings + 1;
        END LOOP;
        UPDATE app.slots SET status = 'closed' WHERE id = s.id;
        v_runs := v_runs + 1;
    END LOOP;
    RETURN jsonb_build_object('runs_cancelled', v_runs, 'bookings_cancelled', v_bookings);
END;
$$;

REVOKE ALL ON FUNCTION
    app.guide_travel_minutes(uuid, uuid),
    app.guide_slot_clash(uuid, boolean),
    app.guard_guide_booking(),
    app.generate_schedule_slots(uuid, integer),
    app.clear_schedule_slots(uuid),
    app.tour_schedule_json(app.tour_schedules),
    app.guide_list_schedules(uuid, uuid),
    app.guide_save_schedule(uuid, uuid, jsonb),
    app.guide_delete_schedule(uuid, uuid),
    app.guide_list_blocks(uuid),
    app.guide_add_block(uuid, jsonb),
    app.guide_delete_block(uuid, uuid),
    app.guide_generate_all_slots(),
    app.guide_min_group_check()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.guide_travel_minutes(uuid, uuid),
    app.guide_slot_clash(uuid, boolean),
    app.guide_clash_message(text),
    app.tour_schedule_json(app.tour_schedules),
    app.guide_list_schedules(uuid, uuid),
    app.guide_save_schedule(uuid, uuid, jsonb),
    app.guide_delete_schedule(uuid, uuid),
    app.guide_list_blocks(uuid),
    app.guide_add_block(uuid, jsonb),
    app.guide_delete_block(uuid, uuid),
    app.guide_get_availability(uuid),
    app.guide_set_availability(uuid, jsonb),
    app.guide_tour_json(uuid, uuid),
    app.public_guide_tours(text),
    app.guide_generate_all_slots(),
    app.guide_min_group_check()
TO mshwar_backend;
