-- 067_account_security.sql
-- Security plan, P1 accounts and privacy (docs/security/security-plan.md).
--
--   SEC-22  change the password while signed in: needs the current one, signs out every other
--           session.
--   SEC-24  see the sessions that are signed in, and end one or all of the others.
--   SEC-25  changing the email address is confirmed from the new address; the old one is told.
--   SEC-63  a nightly job deletes what is past its retention period.
--   SEC-64  the data export includes everything from the guide features (033-066).
--   SEC-65  deleting an account also clears guide profiles, messages, calendars and feeds, and
--           cancels future tour bookings with notice to the other side.

-- ---- Sessions ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.list_my_sessions(p_user uuid, p_current_hash text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'created_at', s.created_at,
        'last_seen_at', s.last_seen_at,
        'expires_at', s.expires_at,
        'user_agent', coalesce(s.user_agent, ''),
        'current', s.token_hash = p_current_hash
    ) ORDER BY s.token_hash = p_current_hash DESC, s.last_seen_at DESC), '[]'::jsonb)
    FROM app.sessions s
    WHERE s.user_id = p_user AND s.revoked_at IS NULL AND s.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION app.revoke_my_session(p_user uuid, p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    UPDATE app.sessions SET revoked_at = now()
    WHERE id = p_session AND user_id = p_user AND revoked_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM app._privacy_audit(p_user, 'revoke_session', 'signed out one session', jsonb_build_object('session', p_session));
    RETURN jsonb_build_object('revoked', 1);
END;
$$;

CREATE OR REPLACE FUNCTION app.revoke_my_other_sessions(p_user uuid, p_current_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE app.sessions SET revoked_at = now()
    WHERE user_id = p_user AND revoked_at IS NULL AND expires_at > now()
      AND token_hash <> coalesce(p_current_hash, '');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM app._privacy_audit(p_user, 'revoke_sessions', 'signed out every other session', jsonb_build_object('revoked', v_count));
    RETURN jsonb_build_object('revoked', v_count);
END;
$$;

-- ---- Password -----------------------------------------------------------------------------------
-- The API checks the current password against this hash, then calls change_my_password.
CREATE OR REPLACE FUNCTION app.my_password_hash(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT c.password_hash FROM app.credentials c
    JOIN app.users u ON u.id = c.user_id AND u.status = 'active'
    WHERE c.user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION app.change_my_password(p_user uuid, p_password_hash text, p_current_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_revoked integer;
BEGIN
    IF p_password_hash IS NULL OR p_password_hash NOT LIKE '$argon2id$%' THEN
        RAISE EXCEPTION 'invalid password hash' USING ERRCODE = '22023';
    END IF;
    UPDATE app.credentials SET password_hash = p_password_hash, rotated_at = now() WHERE user_id = p_user;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE app.sessions SET revoked_at = now()
    WHERE user_id = p_user AND revoked_at IS NULL AND expires_at > now()
      AND token_hash <> coalesce(p_current_hash, '');
    GET DIAGNOSTICS v_revoked = ROW_COUNT;
    -- A reset link issued before the change must not work after it.
    UPDATE app.password_reset_tokens SET used_at = now() WHERE user_id = p_user AND used_at IS NULL;
    PERFORM app._privacy_audit(p_user, 'change_password', 'password changed while signed in',
                               jsonb_build_object('sessions_revoked', v_revoked));
    RETURN jsonb_build_object('changed', true, 'sessions_revoked', v_revoked);
END;
$$;

-- ---- Email change ----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.email_change_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    new_email text NOT NULL CHECK (length(new_email) BETWEEN 3 AND 320),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS email_change_tokens_user_idx ON app.email_change_tokens (user_id, created_at DESC);
ALTER TABLE app.email_change_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.email_change_tokens FORCE ROW LEVEL SECURITY;

-- Returns the current address, so the API can tell its owner. Earlier unused links for this
-- account stop working.
CREATE OR REPLACE FUNCTION app.request_email_change(p_user uuid, p_new_email text, p_token_hash text, p_expires_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_email text := lower(btrim(coalesce(p_new_email, '')));
    v_current text;
BEGIN
    SELECT p.email INTO v_current FROM app.user_private p
    JOIN app.users u ON u.id = p.user_id AND u.status = 'active'
    WHERE p.user_id = p_user;
    IF v_current IS NULL THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_email = lower(v_current) THEN
        RAISE EXCEPTION 'that is already your email address' USING ERRCODE = '22023';
    END IF;
    -- Do not reveal whether another account uses the address: the link simply will not work.
    UPDATE app.email_change_tokens SET used_at = now() WHERE user_id = p_user AND used_at IS NULL;
    INSERT INTO app.email_change_tokens (user_id, new_email, token_hash, expires_at)
    VALUES (p_user, v_email, p_token_hash, p_expires_at);
    PERFORM app._privacy_audit(p_user, 'request_email_change', 'email change requested', '{}'::jsonb);
    RETURN jsonb_build_object('current_email', v_current, 'new_email', v_email);
END;
$$;

CREATE OR REPLACE FUNCTION app.confirm_email_change(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    t app.email_change_tokens;
    v_old text;
BEGIN
    SELECT * INTO t FROM app.email_change_tokens
    WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
    FOR UPDATE;
    IF t.id IS NULL THEN
        RAISE EXCEPTION 'this link is invalid or has expired' USING ERRCODE = '22023';
    END IF;
    UPDATE app.email_change_tokens SET used_at = now() WHERE id = t.id;
    IF EXISTS (SELECT 1 FROM app.user_private WHERE lower(email) = t.new_email AND user_id <> t.user_id) THEN
        RAISE EXCEPTION 'this link is invalid or has expired' USING ERRCODE = '22023';
    END IF;
    SELECT email INTO v_old FROM app.user_private WHERE user_id = t.user_id;
    UPDATE app.user_private SET email = t.new_email, updated_at = now() WHERE user_id = t.user_id;
    -- The link proves the person reads the new address.
    UPDATE app.users SET email_verified_at = now() WHERE id = t.user_id;
    PERFORM app._privacy_audit(t.user_id, 'change_email', 'email changed from a confirmed link', '{}'::jsonb);
    RETURN jsonb_build_object('user_id', t.user_id, 'old_email', v_old, 'new_email', t.new_email);
END;
$$;

-- ---- Account deletion, now covering the guide features ----------------------------------------------
-- Same as 012, plus: future tour bookings are cancelled with notice to the guide; a guide's
-- profile is emptied and suspended (which cancels their open bookings and tells travellers,
-- 038); calendars, the private feed and message bodies are removed; reviews keep their star
-- rating but lose their words.
CREATE OR REPLACE FUNCTION app.anonymise_my_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_bookings integer;
    v_booking record;
    v_guide app.guide_profiles;
    v_cancelled integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app.users u WHERE u.id = p_user_id AND u.status = 'active') THEN
        RAISE EXCEPTION 'account not found' USING ERRCODE = 'P0002';
    END IF;

    -- Future tour bookings as a traveller: cancelled, so the guide is told and the seats return.
    FOR v_booking IN
        SELECT b.id FROM app.bookings b
        JOIN app.slots s ON s.id = b.slot_id
        JOIN app.tour_booking_details d ON d.booking_id = b.id
        WHERE b.customer_id = p_user_id AND b.status IN ('pending', 'confirmed') AND s.starts_at > now()
    LOOP
        PERFORM app.tour_cancel(p_user_id, v_booking.id, 'The traveller closed their account');
        v_cancelled := v_cancelled + 1;
    END LOOP;

    -- A guide: suspension closes open days and bookings and tells travellers (038).
    SELECT * INTO v_guide FROM app.guide_profiles WHERE user_id = p_user_id;
    IF v_guide.id IS NOT NULL THEN
        IF v_guide.status = 'approved' THEN
            UPDATE app.guide_profiles
            SET status = 'suspended', decided_at = now(), decision_reason = 'The guide closed their account',
                updated_at = now()
            WHERE id = v_guide.id;
        END IF;
        UPDATE app.guide_profiles
        SET phone = '', bio = '', headline = '', display_name = 'Former guide', updated_at = now()
        WHERE id = v_guide.id;
        DELETE FROM app.guide_external_calendars WHERE guide_profile_id = v_guide.id;
        DELETE FROM app.guide_calendar_feeds WHERE guide_profile_id = v_guide.id;
        DELETE FROM app.guide_busy_blocks WHERE guide_profile_id = v_guide.id;
    END IF;

    UPDATE app.guide_messages SET body = '[deleted]', masked = false WHERE sender_id = p_user_id;
    UPDATE app.guide_reviews SET body = '' WHERE author_id = p_user_id;

    UPDATE app.sessions SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;

    DELETE FROM app.credentials WHERE user_id = p_user_id;
    DELETE FROM app.password_reset_tokens WHERE user_id = p_user_id;
    DELETE FROM app.email_verification_tokens WHERE user_id = p_user_id;
    DELETE FROM app.email_change_tokens WHERE user_id = p_user_id;
    DELETE FROM app.account_favorites WHERE user_id = p_user_id;
    DELETE FROM app.account_notifications WHERE user_id = p_user_id;

    UPDATE app.user_private
    SET email = NULL,
        phone = NULL,
        preferences = '{}'::jsonb,
        personalization_consent = false,
        marketing_consent = false,
        updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE app.users
    SET display_name = 'Deleted user',
        status = 'deleted',
        auth_subject = 'deleted:' || id::text
    WHERE id = p_user_id;

    SELECT count(*) INTO v_bookings FROM app.account_bookings WHERE customer_id = p_user_id;

    PERFORM app._privacy_audit(
        p_user_id,
        'delete_account',
        'anonymise account; keep booking and accounting rows',
        jsonb_build_object('status', 'deleted', 'bookings_kept', v_bookings, 'tour_bookings_cancelled', v_cancelled,
                           'guide_profile', v_guide.id IS NOT NULL)
    );

    RETURN jsonb_build_object('ok', true, 'status', 'deleted', 'bookings_kept', v_bookings);
END;
$$;

-- ---- Export: the guide features ---------------------------------------------------------------------
-- The API adds this under "guides" to the 012 export.
CREATE OR REPLACE FUNCTION app.export_my_guide_data(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'guide_profile', (SELECT app.guide_profile_json(g.id, true) FROM app.guide_profiles g WHERE g.user_id = p_user),
        'tour_bookings', coalesce((
            SELECT jsonb_agg(app.tour_booking_json(b.id) ORDER BY b.created_at)
            FROM app.bookings b JOIN app.tour_booking_details d ON d.booking_id = b.id
            WHERE b.customer_id = p_user
        ), '[]'::jsonb),
        'conversations', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'guide', (SELECT display_name FROM app.guide_profiles WHERE id = c.guide_profile_id),
                'created_at', c.created_at,
                'messages', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'mine', m.sender_id = p_user, 'body', m.body, 'created_at', m.created_at
                    ) ORDER BY m.created_at), '[]'::jsonb)
                    FROM app.guide_messages m WHERE m.conversation_id = c.id
                )
            ) ORDER BY c.created_at)
            FROM app.guide_conversations c
            LEFT JOIN app.guide_profiles g ON g.id = c.guide_profile_id
            WHERE c.traveller_id = p_user OR g.user_id = p_user
        ), '[]'::jsonb),
        'reviews_written', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'rating', x.rating, 'body', x.body, 'direction', x.direction, 'created_at', x.created_at,
                'parts', app.guide_review_parts_json(x)
            ) ORDER BY x.created_at)
            FROM app.guide_reviews x WHERE x.author_id = p_user
        ), '[]'::jsonb),
        'hire_requests', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', e.id, 'local_date', e.local_date, 'state', e.state, 'created_at', e.created_at
            ) ORDER BY e.created_at)
            FROM app.guide_engagements e WHERE e.traveller_id = p_user
        ), '[]'::jsonb),
        'strikes', coalesce((
            SELECT jsonb_agg(app.guide_strike_json(s) ORDER BY s.created_at)
            FROM app.guide_strikes s JOIN app.guide_profiles g ON g.id = s.guide_profile_id
            WHERE g.user_id = p_user
        ), '[]'::jsonb)
    );
$$;

-- ---- Retention ---------------------------------------------------------------------------------------
-- Nightly (scheduler job "privacy-purge"). Periods are in docs/privacy-retention.md.
CREATE OR REPLACE FUNCTION app.purge_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_sessions integer;
    v_resets integer;
    v_verifications integer;
    v_email_changes integer;
    v_messages integer;
    v_conversations integer;
BEGIN
    DELETE FROM app.sessions
    WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days')
       OR expires_at < now() - interval '30 days';
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    DELETE FROM app.password_reset_tokens WHERE expires_at < now() - interval '7 days';
    GET DIAGNOSTICS v_resets = ROW_COUNT;
    DELETE FROM app.email_verification_tokens WHERE expires_at < now() - interval '7 days';
    GET DIAGNOSTICS v_verifications = ROW_COUNT;
    DELETE FROM app.email_change_tokens WHERE expires_at < now() - interval '7 days';
    GET DIAGNOSTICS v_email_changes = ROW_COUNT;

    -- Messages are kept 12 months (guide plan, section 16), unless a support case holds them.
    DELETE FROM app.guide_messages m
    WHERE m.created_at < now() - interval '365 days'
      AND NOT EXISTS (
          SELECT 1 FROM app.guide_conversations c
          WHERE c.id = m.conversation_id AND c.reported_at IS NOT NULL AND c.reported_at > now() - interval '365 days'
      );
    GET DIAGNOSTICS v_messages = ROW_COUNT;
    DELETE FROM app.guide_conversations c
    WHERE c.last_message_at < now() - interval '365 days'
      AND NOT EXISTS (SELECT 1 FROM app.guide_messages m WHERE m.conversation_id = c.id);
    GET DIAGNOSTICS v_conversations = ROW_COUNT;

    RETURN jsonb_build_object(
        'sessions', v_sessions, 'password_resets', v_resets, 'email_verifications', v_verifications,
        'email_changes', v_email_changes, 'messages', v_messages, 'conversations', v_conversations
    );
END;
$$;

REVOKE ALL ON FUNCTION
    app.list_my_sessions(uuid, text),
    app.revoke_my_session(uuid, uuid),
    app.revoke_my_other_sessions(uuid, text),
    app.my_password_hash(uuid),
    app.change_my_password(uuid, text, text),
    app.request_email_change(uuid, text, text, timestamptz),
    app.confirm_email_change(text),
    app.export_my_guide_data(uuid),
    app.purge_expired_data()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.list_my_sessions(uuid, text),
    app.revoke_my_session(uuid, uuid),
    app.revoke_my_other_sessions(uuid, text),
    app.my_password_hash(uuid),
    app.change_my_password(uuid, text, text),
    app.request_email_change(uuid, text, text, timestamptz),
    app.confirm_email_change(text),
    app.anonymise_my_account(uuid),
    app.export_my_guide_data(uuid),
    app.purge_expired_data()
TO mshwar_backend;
