-- 068_calendar_secret.sql
-- Security plan SEC-45: a guide's connected calendar address is a secret (it grants read
-- access to their calendar), so it is stored encrypted by the API (app/core/secret_box.py),
-- never in plain text.
--
--   * url_ciphertext holds the encrypted address; host is what the guide sees.
--   * url_fingerprint (an HMAC of the address) keeps "the same calendar twice" out.
--   * Rows written before this migration still hold the plain address in url. The sync job
--     encrypts each one the next time it reads it (guide_store_calendar_secret), and clears url.

ALTER TABLE app.guide_external_calendars DROP CONSTRAINT IF EXISTS guide_external_calendars_url_check;
ALTER TABLE app.guide_external_calendars ALTER COLUMN url DROP NOT NULL;
ALTER TABLE app.guide_external_calendars
    ADD COLUMN IF NOT EXISTS url_ciphertext text CHECK (url_ciphertext IS NULL OR url_ciphertext LIKE 'v1.%'),
    ADD COLUMN IF NOT EXISTS url_fingerprint text CHECK (url_fingerprint IS NULL OR length(url_fingerprint) = 64),
    ADD COLUMN IF NOT EXISTS host text NOT NULL DEFAULT '' CHECK (length(host) <= 255);
ALTER TABLE app.guide_external_calendars
    ADD CONSTRAINT guide_external_calendars_has_address CHECK (url IS NOT NULL OR url_ciphertext IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS guide_external_calendars_fingerprint_idx
    ON app.guide_external_calendars (guide_profile_id, url_fingerprint) WHERE url_fingerprint IS NOT NULL;

UPDATE app.guide_external_calendars
SET host = coalesce(substring(url FROM '^https://([^/]+)'), '')
WHERE host = '' AND url IS NOT NULL;

CREATE OR REPLACE FUNCTION app.guide_external_calendar_json(c app.guide_external_calendars)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'id', c.id,
        -- Only the host is shown back: a calendar's secret address stays secret.
        'host', CASE WHEN c.host <> '' THEN c.host ELSE substring(c.url FROM '^https://([^/]+)') END,
        'label', c.label,
        'last_synced_at', c.last_synced_at,
        'last_status', c.last_status,
        'last_error', c.last_error,
        'events', c.events
    );
$$;

-- The API has already checked the address (https or webcal, at most 1000 characters),
-- encrypted it and made its fingerprint.
CREATE OR REPLACE FUNCTION app.guide_add_external_calendar_secret(
    p_user uuid, p_ciphertext text, p_fingerprint text, p_host text, p_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    g app.guide_profiles := app.guide_for_user(p_user);
BEGIN
    IF p_ciphertext IS NULL OR p_ciphertext NOT LIKE 'v1.%' OR p_fingerprint IS NULL OR length(p_fingerprint) <> 64 THEN
        RAISE EXCEPTION 'paste the calendar''s secret address (https:// or webcal://)' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.guide_external_calendars
        WHERE guide_profile_id = g.id AND url_fingerprint = p_fingerprint
    ) THEN
        RETURN app.guide_list_external_calendars(p_user);
    END IF;
    IF (SELECT count(*) FROM app.guide_external_calendars WHERE guide_profile_id = g.id) >= 3 THEN
        RAISE EXCEPTION 'connect at most 3 calendars' USING ERRCODE = '53400';
    END IF;
    INSERT INTO app.guide_external_calendars (guide_profile_id, url, url_ciphertext, url_fingerprint, host, label)
    VALUES (g.id, NULL, p_ciphertext, p_fingerprint, left(coalesce(p_host, ''), 255), left(btrim(coalesce(p_label, '')), 60));
    RETURN app.guide_list_external_calendars(p_user);
END;
$$;

-- For the sync job: the encrypted address, or (for rows from before 068) the plain one.
CREATE OR REPLACE FUNCTION app.guide_calendars_to_sync(p_user uuid DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'url', x.url, 'ciphertext', x.url_ciphertext)), '[]'::jsonb)
    FROM (
        SELECT c.id, c.url, c.url_ciphertext
        FROM app.guide_external_calendars c
        JOIN app.guide_profiles g ON g.id = c.guide_profile_id
        WHERE (p_user IS NULL AND g.status = 'approved') OR g.user_id = p_user
        ORDER BY c.last_synced_at NULLS FIRST
        LIMIT least(greatest(p_limit, 1), 500)
    ) x;
$$;

-- Moves a pre-068 row to the encrypted form and forgets the plain address.
CREATE OR REPLACE FUNCTION app.guide_store_calendar_secret(
    p_calendar uuid, p_ciphertext text, p_fingerprint text, p_host text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
    IF p_ciphertext IS NULL OR p_ciphertext NOT LIKE 'v1.%' OR length(coalesce(p_fingerprint, '')) <> 64 THEN
        RAISE EXCEPTION 'invalid encrypted address' USING ERRCODE = '22023';
    END IF;
    UPDATE app.guide_external_calendars
    SET url_ciphertext = p_ciphertext, url_fingerprint = p_fingerprint, host = left(coalesce(p_host, host), 255),
        url = NULL
    WHERE id = p_calendar;
END;
$$;

-- The plain-text entry point is retired: an address can only arrive encrypted.
REVOKE EXECUTE ON FUNCTION app.guide_add_external_calendar(uuid, text, text) FROM mshwar_backend;

REVOKE ALL ON FUNCTION
    app.guide_add_external_calendar_secret(uuid, text, text, text, text),
    app.guide_store_calendar_secret(uuid, text, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    app.guide_external_calendar_json(app.guide_external_calendars),
    app.guide_add_external_calendar_secret(uuid, text, text, text, text),
    app.guide_calendars_to_sync(uuid, integer),
    app.guide_store_calendar_secret(uuid, text, text, text)
TO mshwar_backend;
