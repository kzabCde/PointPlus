-- Point+ DB v3.1 live reconciliation: additive, zero historical row changes.
-- Target project: gczribbtkfvhpzzupqre, linked account Que168 ONLY.
-- Supersedes no v3 table; do not re-run the v2->v3 upgrade proposal.
-- Precondition: existing v3 official catalog and original mission flow present.
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF to_regclass('pointplus_private.official_assets') IS NULL
     OR to_regclass('public.mission_assignments') IS NULL
     OR to_regclass('public.notifications') IS NULL
     OR to_regprocedure('pointplus_private.submit_mission(uuid,uuid,text,text,text)') IS NULL
     OR to_regprocedure('public.rls_auto_enable()') IS NULL THEN
    RAISE EXCEPTION 'Unexpected PointPlus v3 schema: abort without changes';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgrelid='public.mission_assignments'::regclass
               AND tgname='pointplus_notify_mission_assignment'
               AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Assignment notification trigger already exists: reconcile before reapplying';
  END IF;
END;
$preflight$;

-- Mission assignments are authorized by the existing manager-only INSERT RLS.
-- Notify only the assigned adult or the child guardian; do not leak proof data.
CREATE FUNCTION pointplus_private.notify_mission_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_recipient uuid; v_title text;
BEGIN
  SELECT COALESCE(p.user_id,p.guardian_user_id), m.title
    INTO v_recipient,v_title
  FROM public.participants p
  JOIN public.missions m ON m.space_id=p.space_id AND m.id=NEW.mission_id
  WHERE p.space_id=NEW.space_id AND p.id=NEW.participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment room/participant/mission mismatch';
  END IF;
  -- No redundant notification when the assignment author is the recipient.
  IF v_recipient IS NOT NULL AND v_recipient IS DISTINCT FROM NEW.assigned_by THEN
    INSERT INTO public.notifications
      (recipient_user_id,space_id,type,title,body,payload)
    VALUES
      (v_recipient,NEW.space_id,'mission.assigned','มีภารกิจใหม่ที่มอบหมาย',
       v_title,jsonb_build_object('mission_id',NEW.mission_id,
                                  'participant_id',NEW.participant_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pointplus_private.notify_mission_assignment()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pointplus_notify_mission_assignment
AFTER INSERT ON public.mission_assignments
FOR EACH ROW EXECUTE FUNCTION pointplus_private.notify_mission_assignment();

-- The internal DDL event trigger function must never be callable by API users.
-- Existing event-trigger execution is not dependent on public EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
COMMIT;
