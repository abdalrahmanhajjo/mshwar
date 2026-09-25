-- 052_admin_two_step.sql
-- Two-step sign-in for the operations console (security review SR-14, docs/security/review-2026-09.md).
--
-- An admin session counts as verified for 12 hours after its admin enters a code from their authenticator.
-- The authenticator is the same one partners use (app.partner_security, 039): one secret per person, a code
-- counts once (replays refused by step), and the secret never leaves the SECURITY DEFINER functions.
-- The API refuses every admin route until the session is verified (app/core/admin_auth.py), except the two
-- that show the state and take the code. An elevated admin can reset another admin's authenticator when
-- they lose their phone; the reset is audited and ends the admin's open sessions.

ALTER TABLE app.admin_sessions ADD COLUMN mfa_verified_at timestamptz;

CREATE FUNCTION app.admin_mfa_state(p_user uuid, p_session uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_verified timestamptz;
BEGIN
    PERFORM app.require_admin(p_user, false);
    SELECT max(mfa_verified_at) INTO v_verified
    FROM app.admin_sessions
    WHERE user_id = p_user AND ended_at IS NULL AND session_id IS NOT DISTINCT FROM p_session
      AND mfa_verified_at > now() - interval '12 hours';
    RETURN jsonb_build_object(
        'enrolled', EXISTS (SELECT 1 FROM app.partner_security WHERE user_id = p_user AND totp_enabled_at IS NOT NULL),
        'verified', v_verified IS NOT NULL,
        'verified_until', v_verified + interval '12 hours'
    );
END;
$$;

-- p_step: the time step the API matched the code to. A step already used (or older) is refused.
CREATE FUNCTION app.admin_mfa_verify(p_user uuid, p_session uuid, p_step bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_user, false);
    IF p_session IS NULL THEN
        RAISE EXCEPTION 'sign in again to verify this session' USING ERRCODE = '22023';
    END IF;
    UPDATE app.partner_security
    SET totp_last_step = p_step, updated_at = now()
    WHERE user_id = p_user AND totp_enabled_at IS NOT NULL AND totp_last_step < p_step;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'that code was already used; wait for the next one' USING ERRCODE = '22023';
    END IF;
    UPDATE app.admin_sessions SET mfa_verified_at = now(), last_seen_at = now()
    WHERE user_id = p_user AND session_id = p_session AND ended_at IS NULL;
    IF NOT FOUND THEN
        INSERT INTO app.admin_sessions (user_id, session_id, mfa_verified_at) VALUES (p_user, p_session, now());
    END IF;
    RETURN app.admin_mfa_state(p_user, p_session);
END;
$$;

-- Lost phone: an elevated admin turns the other admin's authenticator off. They set it up again at next sign-in.
CREATE FUNCTION app.admin_reset_mfa(p_admin uuid, p_user uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    PERFORM app.require_admin(p_admin, false);
    IF p_admin = p_user THEN
        RAISE EXCEPTION 'another elevated admin must reset your authenticator' USING ERRCODE = '42501';
    END IF;
    PERFORM app.require_admin(p_admin, true);
    IF length(btrim(coalesce(p_reason, ''))) < 10 THEN
        RAISE EXCEPTION 'say why the authenticator is being reset' USING ERRCODE = '22023';
    END IF;
    IF app.admin_tier(p_user) IS NULL THEN
        RAISE EXCEPTION 'admin not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('app.user_id', p_admin::text, true);
    UPDATE app.partner_security
    SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, updated_at = now()
    WHERE user_id = p_user;
    UPDATE app.admin_sessions SET ended_at = now() WHERE user_id = p_user AND ended_at IS NULL;
    INSERT INTO app.audit_log (actor_id, action, table_name, row_key, changes, reason)
    VALUES (p_admin, 'admin_mfa_reset', 'partner_security', jsonb_build_object('user_id', p_user),
            jsonb_build_object('totp_enabled', false), left(btrim(p_reason), 500));
    RETURN jsonb_build_object('user_id', p_user, 'reset', true);
END;
$$;

GRANT EXECUTE ON FUNCTION
    app.admin_mfa_state(uuid, uuid),
    app.admin_mfa_verify(uuid, uuid, bigint),
    app.admin_reset_mfa(uuid, uuid, text)
TO mshwar_backend;
