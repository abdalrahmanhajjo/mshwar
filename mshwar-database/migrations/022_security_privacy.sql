-- Epic 13 (108–114). Additive hardening; 021 remains the group/review migration.
SET search_path = app, public;

REVOKE UPDATE, DELETE, TRUNCATE ON app.audit_log, app.consent_events FROM mshwar_backend, mshwar_reader;
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON app.audit_log
FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();
CREATE INDEX audit_actor_time ON app.audit_log (actor_id, created_at DESC, id);
CREATE INDEX audit_action_time ON app.audit_log (action, created_at DESC, id);
CREATE INDEX audit_target_time ON app.audit_log (table_name, created_at DESC, id);

-- Preserve the operational allowlist and cover every consequential domain, including
-- credential changes without ever storing hashes, bodies, provider references or tokens.
CREATE OR REPLACE FUNCTION app.audit_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
DECLARE oldj jsonb; newj jsonb; pk jsonb;
BEGIN
 oldj := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 newj := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 pk := jsonb_strip_nulls(jsonb_build_object('id', coalesce(newj->'id',oldj->'id',newj->'user_id',oldj->'user_id'),
       'organization_id',coalesce(newj->'organization_id',oldj->'organization_id')));
 INSERT INTO app.audit_log(actor_id,request_id,action,table_name,row_key,changes,reason)
 VALUES(coalesce(app.actor_id(), NULLIF(coalesce(newj->>'user_id',oldj->>'user_id'),'')::uuid),
 current_setting('app.request_id',true),TG_OP,TG_TABLE_NAME,pk,
 jsonb_build_object('old_status',oldj->'status','new_status',newj->'status',
 'old_capacity',oldj->'capacity','new_capacity',newj->'capacity',
 'old_verification',oldj->'verification','new_verification',newj->'verification'),
 coalesce(NULLIF(current_setting('app.reason',true),''),'database transition'));
 RETURN coalesce(NEW,OLD);
END $$;
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['users','credentials','sessions','user_private','consent_events',
 'trips','trip_members','trip_share_links','trip_guests','trip_suggestions','votes',
 'staff_invitations','verification_documents','platform_admins','planner_sessions',
 'catalogue_collections','account_bookings','account_trips'] LOOP
 IF to_regclass('app.'||n) IS NOT NULL THEN
 EXECUTE format('CREATE TRIGGER security_audit AFTER INSERT OR UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.audit_change()',n);
 END IF;
 END LOOP;
END $$;

CREATE FUNCTION app.security_can_access(p_actor uuid, p_resource text, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app, public AS $$
 SELECT EXISTS(SELECT 1 FROM app.users WHERE id=p_actor AND status='active') AND CASE p_resource
 WHEN 'booking' THEN EXISTS(SELECT 1 FROM app.bookings WHERE id=p_target AND customer_id=p_actor)
 WHEN 'trip' THEN EXISTS(SELECT 1 FROM app.trips WHERE id=p_target AND owner_id=p_actor)
 WHEN 'planner' THEN EXISTS(SELECT 1 FROM app.planner_sessions WHERE id=p_target AND user_id=p_actor)
 WHEN 'organization' THEN EXISTS(SELECT 1 FROM app.organization_members WHERE organization_id=p_target AND user_id=p_actor AND active)
 WHEN 'experience' THEN EXISTS(SELECT 1 FROM app.experiences e JOIN app.organization_members m ON m.organization_id=e.organization_id WHERE e.id=p_target AND m.user_id=p_actor AND m.active)
 ELSE false END
$$;

-- Atomic shared budgets. One row per opaque bucket; never store emails, IPs or tokens.
CREATE TABLE app.security_buckets (
 bucket text PRIMARY KEY, used bigint NOT NULL CHECK(used>=0), expires_at timestamptz NOT NULL
);
CREATE INDEX security_bucket_expiry ON app.security_buckets(expires_at);
REVOKE ALL ON app.security_buckets FROM PUBLIC, mshwar_backend, mshwar_reader;
CREATE FUNCTION app.security_reserve(p_key text, p_limit bigint, p_window integer, p_amount bigint DEFAULT 1)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
DECLARE v app.security_buckets; t timestamptz := clock_timestamp();
BEGIN
 IF p_limit<1 OR p_window<1 OR p_amount<1 THEN RAISE EXCEPTION 'Invalid quota'; END IF;
 -- Expired-key cleanup bounds persistent cardinality without a privileged API endpoint.
 DELETE FROM app.security_buckets WHERE bucket IN
   (SELECT bucket FROM app.security_buckets WHERE expires_at<t LIMIT 100);
 INSERT INTO app.security_buckets VALUES(p_key,0,t+make_interval(secs=>p_window)) ON CONFLICT DO NOTHING;
 SELECT * INTO v FROM app.security_buckets WHERE bucket=p_key FOR UPDATE;
 IF v.expires_at<=t THEN v.used:=0; v.expires_at:=t+make_interval(secs=>p_window); END IF;
 IF v.used+p_amount>p_limit THEN RETURN greatest(1,ceil(extract(epoch FROM v.expires_at-t))::integer); END IF;
 UPDATE app.security_buckets SET used=v.used+p_amount, expires_at=v.expires_at WHERE bucket=p_key;
 RETURN 0;
END $$;

CREATE FUNCTION app.security_consents(p_actor uuid, p_personal boolean DEFAULT NULL, p_marketing boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
DECLARE v app.user_private;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.users WHERE id=p_actor AND status='active') THEN
 RAISE EXCEPTION 'Resource not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO v FROM app.user_private WHERE user_id=p_actor FOR UPDATE;
 UPDATE app.user_private SET personalization_consent=coalesce(p_personal,personalization_consent),
 marketing_consent=coalesce(p_marketing,marketing_consent), updated_at=now() WHERE user_id=p_actor
 AND (p_personal IS NOT NULL OR p_marketing IS NOT NULL);
 RETURN jsonb_build_object('personalisation',coalesce(p_personal,v.personalization_consent),
 'marketing',coalesce(p_marketing,v.marketing_consent),'policy_version','2026-09-14');
END $$;
-- A trigger captures changes through all existing Epic 3/10/12 preference/reset paths too.
CREATE FUNCTION app.security_consent_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
BEGIN
 IF OLD.personalization_consent IS DISTINCT FROM NEW.personalization_consent THEN
 INSERT INTO app.consent_events(user_id,purpose,granted,policy_version)
 VALUES(NEW.user_id,'personalisation',NEW.personalization_consent,'2026-09-14'); END IF;
 IF OLD.marketing_consent IS DISTINCT FROM NEW.marketing_consent THEN
 INSERT INTO app.consent_events(user_id,purpose,granted,policy_version)
 VALUES(NEW.user_id,'marketing',NEW.marketing_consent,'2026-09-14'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consent_change AFTER UPDATE ON app.user_private
FOR EACH ROW EXECUTE FUNCTION app.security_consent_change();

CREATE FUNCTION app.security_audit_search(p_actor uuid, p_action text, p_target text, p_actor_filter uuid,
 p_since timestamptz, p_until timestamptz, p_query text, p_limit integer, p_offset integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, public AS $$
DECLARE v jsonb; total bigint;
BEGIN
 PERFORM app.require_admin(p_actor,false);
 SELECT count(*) INTO total FROM app.audit_log a
 WHERE (p_action IS NULL OR a.action=p_action) AND (p_target IS NULL OR a.table_name=p_target)
 AND (p_actor_filter IS NULL OR a.actor_id=p_actor_filter) AND (p_since IS NULL OR a.created_at>=p_since)
 AND (p_until IS NULL OR a.created_at<=p_until)
 AND (p_query IS NULL OR a.row_key::text ILIKE '%'||p_query||'%' OR a.reason ILIKE '%'||p_query||'%');
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v FROM (
 SELECT a.id,a.actor_id,a.action,a.table_name AS target_type,a.row_key AS target,a.reason,a.request_id,a.created_at
 FROM app.audit_log a
 WHERE (p_action IS NULL OR a.action=p_action) AND (p_target IS NULL OR a.table_name=p_target)
 AND (p_actor_filter IS NULL OR a.actor_id=p_actor_filter) AND (p_since IS NULL OR a.created_at>=p_since)
 AND (p_until IS NULL OR a.created_at<=p_until)
 AND (p_query IS NULL OR a.row_key::text ILIKE '%'||p_query||'%' OR a.reason ILIKE '%'||p_query||'%')
 ORDER BY a.created_at DESC,a.id DESC LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)
 ) x;
 RETURN jsonb_build_object('items',v,'total',total);
END $$;
REVOKE ALL ON FUNCTION app.security_can_access(uuid,text,uuid), app.security_reserve(text,bigint,integer,bigint),
 app.security_consents(uuid,boolean,boolean), app.security_audit_search(uuid,text,text,uuid,timestamptz,timestamptz,text,integer,integer)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.security_can_access(uuid,text,uuid), app.security_reserve(text,bigint,integer,bigint),
 app.security_consents(uuid,boolean,boolean), app.security_audit_search(uuid,text,text,uuid,timestamptz,timestamptz,text,integer,integer)
 TO mshwar_backend;

CREATE FUNCTION app.security_plan_preferences(p_actor uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app, public AS $$
 SELECT CASE WHEN personalization_consent THEN preferences ELSE '{}'::jsonb END
 FROM app.user_private WHERE user_id=p_actor
$$;
REVOKE ALL ON FUNCTION app.security_plan_preferences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.security_plan_preferences(uuid) TO mshwar_backend;
