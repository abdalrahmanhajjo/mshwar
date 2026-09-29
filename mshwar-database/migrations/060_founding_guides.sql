-- 060_founding_guides.sql
-- Step 1 of the guide plan (docs/guide-experience-plan.md, section 3): the Founding Guides.
--
-- The first fifty guides Mshwar approves are its Founding Guides. Each keeps a number
-- (1-50) for life; the number is given by the database when a profile is first approved,
-- in approval order, so it cannot be claimed, bought or edited by hand. The public page
-- shows how many places are left from the same count - never a made-up scarcity.
--
-- The number is what later fee schedules read ("0% for Founding Guides for six months");
-- nothing here charges anything.

ALTER TABLE app.guide_profiles
    ADD COLUMN IF NOT EXISTS founding_number integer UNIQUE
        CHECK (founding_number IS NULL OR founding_number BETWEEN 1 AND 50);

CREATE OR REPLACE FUNCTION app.founding_guide_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 50 $$;

-- Given on the first approval, in order. A guide suspended and approved again keeps theirs.
CREATE OR REPLACE FUNCTION app.assign_founding_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
    v_next integer;
BEGIN
    IF NEW.status <> 'approved' OR NEW.founding_number IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
        RETURN NEW;
    END IF;
    -- One approval at a time takes the next number, so two approvals never share one.
    PERFORM pg_advisory_xact_lock(hashtext('app.founding_guides'));
    SELECT coalesce(max(founding_number), 0) + 1 INTO v_next
    FROM app.guide_profiles
    WHERE founding_number IS NOT NULL;
    IF v_next <= app.founding_guide_limit() THEN
        NEW.founding_number := v_next;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guide_founding_number ON app.guide_profiles;
CREATE TRIGGER guide_founding_number
    BEFORE INSERT OR UPDATE OF status ON app.guide_profiles
    FOR EACH ROW EXECUTE FUNCTION app.assign_founding_number();

-- Guides approved before this migration keep their place in line: numbered by approval date.
WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY decided_at NULLS LAST, created_at, id) AS n
    FROM app.guide_profiles
    WHERE organization_id IS NOT NULL
      AND status IN ('approved', 'suspended')
      AND founding_number IS NULL
)
UPDATE app.guide_profiles g
SET founding_number = r.n
FROM ranked r
WHERE g.id = r.id AND r.n <= app.founding_guide_limit();

-- How many Founding Guide places are left, for the public "Earn with Mshwar" page.
CREATE OR REPLACE FUNCTION app.founding_guide_programme()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
    SELECT jsonb_build_object(
        'limit', app.founding_guide_limit(),
        'taken', count(*),
        'remaining', greatest(app.founding_guide_limit() - count(*), 0)
    )
    FROM app.guide_profiles
    WHERE founding_number IS NOT NULL;
$$;

-- Same shape as 038, plus the founding number.
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
        'hireable', app.guide_hireable(g.id),
        'founding_number', g.founding_number
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

GRANT EXECUTE ON FUNCTION
    app.founding_guide_limit(),
    app.founding_guide_programme(),
    app.guide_profile_json(uuid, boolean)
TO mshwar_backend;
