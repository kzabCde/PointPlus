-- PointPlus remove obsolete per-user and per-room timezone storage.
-- STAGED ONLY: DO NOT APPLY until Next.js code without timezone SELECTs is
-- merged and DEPLOYED; older Vercel builds still select timezone and will fail.
-- Target: gczribbtkfvhpzzupqre. Historic account/Room rows are not deleted.
BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='60s';
DO $preflight$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='timezone')
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='spaces' AND column_name='timezone')
 THEN RAISE EXCEPTION 'Timezone columns already removed or unexpected schema'; END IF;
 IF EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND definition ILIKE '%timezone%')
 THEN RAISE EXCEPTION 'Found a view referencing timezone: abort'; END IF;
END $preflight$;
-- Retired legacy Mission RPC still contains a server-side reference to the
-- old Room timezone field. Preserve its fallback date bucketing as Bangkok,
-- while eliminating the column reference (legacy public RPC is revoked).
CREATE OR REPLACE FUNCTION pointplus_private.submit_mission(p_mission uuid, p_participant uuid, p_idempotency_key text, p_proof_text text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid:=(SELECT auth.uid()); m public.missions%ROWTYPE;
 v_space public.spaces%ROWTYPE; v_key text; v_id uuid; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF length(coalesce(p_idempotency_key,'')) NOT BETWEEN 8 AND 120 THEN
  RAISE EXCEPTION 'Invalid idempotency key'; END IF;
 SELECT id INTO v_id FROM public.mission_submissions
   WHERE created_by=v_uid AND idempotency_key=p_idempotency_key;
 IF FOUND THEN RETURN v_id; END IF;
 SELECT * INTO m FROM public.missions WHERE id=p_mission;
 IF NOT FOUND OR m.status<>'active' OR (m.starts_at IS NOT NULL AND now()<m.starts_at)
    OR (m.ends_at IS NOT NULL AND now()>=m.ends_at) THEN RAISE EXCEPTION 'Mission unavailable'; END IF;
 SELECT * INTO v_space FROM public.spaces WHERE id=m.space_id;
 IF NOT pointplus_private.can_act_for(m.space_id,p_participant) THEN
  RAISE EXCEPTION 'Cannot submit for this participant'; END IF;
 IF m.campaign_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.campaigns c WHERE c.id=m.campaign_id
    AND (c.start_at IS NULL OR c.start_at<=now())
    AND (c.end_at IS NULL OR c.end_at>now())
 ) THEN RAISE EXCEPTION 'Campaign unavailable'; END IF;
 IF m.assignment_mode='assigned' AND NOT EXISTS (
   SELECT 1 FROM public.mission_assignments a
   WHERE a.mission_id=m.id AND a.participant_id=p_participant
 ) THEN RAISE EXCEPTION 'Mission is not assigned to this participant'; END IF;
 IF p_proof_text IS NOT NULL AND length(p_proof_text)>4000 THEN RAISE EXCEPTION 'Proof too long'; END IF;
 IF p_proof_path IS NOT NULL AND (
   length(p_proof_path)>500 OR left(p_proof_path,length(v_uid::text)+1)<>v_uid::text || '/'
 ) THEN RAISE EXCEPTION 'Evidence must belong to the current user'; END IF;
 -- Lock participant to serialize period and max-completions checks.
 PERFORM 1 FROM public.participants WHERE id=p_participant FOR UPDATE;
 SELECT count(*) INTO v_count FROM public.mission_submissions
   WHERE mission_id=m.id AND participant_id=p_participant AND status='approved';
 IF m.max_completions IS NOT NULL AND v_count>=m.max_completions THEN
   RAISE EXCEPTION 'Completion limit reached'; END IF;
 IF m.frequency='once' THEN v_key:='once';
 ELSIF m.frequency='daily' THEN
   v_key:=to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'YYYY-MM-DD');
 ELSIF m.frequency='weekly' THEN
   v_key:=to_char((now() AT TIME ZONE 'Asia/Bangkok')::date,'IYYY-"W"IW');
 ELSE v_key:=gen_random_uuid()::text;
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.mission_submissions
   WHERE mission_id=m.id AND participant_id=p_participant AND occurrence_key=v_key
     AND status IN ('submitted','approved')
 ) THEN RAISE EXCEPTION 'Mission already submitted for this period'; END IF;
 INSERT INTO public.mission_submissions(space_id,mission_id,participant_id,occurrence_key,
  idempotency_key,proof_text,proof_path,points_snapshot,stamp_card_snapshot,stamps_snapshot,created_by)
 VALUES(m.space_id,m.id,p_participant,v_key,p_idempotency_key,p_proof_text,p_proof_path,
  m.points_reward,m.stamp_card_id,m.stamps_reward,v_uid) RETURNING id INTO v_id;
 INSERT INTO public.audit_events(space_id,actor_id,event_type,entity_type,entity_id)
  VALUES(m.space_id,v_uid,'mission.submitted','mission_submission',v_id);
 IF v_space.kind='personal' THEN
  PERFORM pointplus_private.review_mission(v_id,true,NULL);
 ELSE
  INSERT INTO public.notifications(recipient_user_id,space_id,type,title,payload)
   SELECT sm.user_id,m.space_id,'mission.submitted','Mission pending review',
          jsonb_build_object('submission_id',v_id)
   FROM public.space_members sm WHERE sm.space_id=m.space_id AND sm.user_id<>v_uid
     AND (sm.role IN ('owner','admin')
       OR EXISTS(SELECT 1 FROM public.participants ap
         WHERE ap.id=p_participant AND ap.kind='adult'));
 END IF;
 RETURN v_id;
END;
$function$;
ALTER TABLE public.profiles DROP COLUMN timezone;
ALTER TABLE public.spaces DROP COLUMN timezone;
COMMIT;
