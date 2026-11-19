-- ================================================================
-- Point+ Database v3 — CANONICAL NON-DESTRUCTIVE MIGRATION PROPOSAL
-- DO NOT EXECUTE until target ref and live v2 drift are verified.
-- TARGET: gczribbtkfvhpzzupqre (verified outside SQL).
-- This supersedes both supabase/proposals/room_first_*.sql scripts.
-- All statements form ONE transaction; an error aborts all changes.
-- ================================================================
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '120s';

DO $v3_preflight$
DECLARE existing_kind text; existing_badge text;
BEGIN
 IF to_regnamespace('pointplus_private') IS NULL THEN
   RAISE EXCEPTION 'Missing PointPlus v2 private schema. STOP.';
 END IF;
 IF to_regclass('public.spaces') IS NULL
    OR to_regclass('public.stamp_cards') IS NULL
    OR to_regclass('public.badge_definitions') IS NULL
    OR to_regclass('public.mission_submissions') IS NULL
    OR to_regclass('public.point_wallets') IS NULL THEN
   RAISE EXCEPTION 'Missing PointPlus v2 base tables. STOP.';
 END IF;
 SELECT pg_get_constraintdef(oid) INTO existing_kind FROM pg_constraint
  WHERE conrelid='public.spaces'::regclass AND conname='spaces_kind_check';
 SELECT pg_get_constraintdef(oid) INTO existing_badge FROM pg_constraint
  WHERE conrelid='public.badge_definitions'::regclass
    AND conname='badge_definitions_criterion_check';
 IF existing_kind IS NULL OR existing_kind NOT LIKE '%personal%'
    OR existing_kind NOT LIKE '%couple%' OR existing_kind NOT LIKE '%family%'
    OR existing_kind LIKE '%group%' THEN
   RAISE EXCEPTION 'PointPlus spaces.kind differs from clean v2 baseline. STOP and reconcile.';
 END IF;
 IF existing_badge IS NULL OR existing_badge NOT LIKE '%first_mission%'
    OR existing_badge LIKE '%official_stamps_count%' THEN
   RAISE EXCEPTION 'PointPlus badge criteria already diverged from v2. STOP and reconcile.';
 END IF;
 IF to_regclass('pointplus_private.official_assets') IS NOT NULL
    OR to_regclass('public.room_preferences') IS NOT NULL THEN
   RAISE EXCEPTION 'v3 objects already exist. STOP; do not partially reapply.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.stamp_cards
             WHERE image_key IS NOT NULL
             GROUP BY space_id,image_key HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Existing stamp_cards duplicate image_key by Room. STOP and audit.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.badge_definitions
             WHERE image_key IS NOT NULL AND space_id IS NOT NULL
             GROUP BY space_id,image_key HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Existing badge_definitions duplicate image_key by Room. STOP and audit.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.participant_badges pb
             JOIN public.badge_definitions bd ON bd.id=pb.badge_id
             WHERE bd.space_id IS NOT NULL AND bd.space_id<>pb.space_id) THEN
   RAISE EXCEPTION 'Found cross-Room historical badges. STOP and audit.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.stamp_awards sa
             JOIN public.stamp_cycles sc ON sc.id=sa.stamp_cycle_id
             WHERE sa.space_id<>sc.space_id) THEN
   RAISE EXCEPTION 'Found cross-Room stamp awards. STOP and audit.';
 END IF;
END
$v3_preflight$;

DO $migration$
DECLARE existing_check text;
BEGIN
  IF to_regclass('public.spaces') IS NULL THEN
    RAISE EXCEPTION 'PointPlus v2 spaces table does not exist';
  END IF;
  SELECT pg_get_constraintdef(c.oid) INTO existing_check
    FROM pg_constraint c
   WHERE c.conrelid='public.spaces'::regclass AND c.conname='spaces_kind_check' AND c.contype='c';
  IF existing_check IS NULL
     OR existing_check NOT LIKE '%personal%'
     OR existing_check NOT LIKE '%couple%'
     OR existing_check NOT LIKE '%family%' THEN
    RAISE EXCEPTION 'Unexpected spaces.kind constraint: inspect live schema before migration';
  END IF;
END
$migration$;

ALTER TABLE public.spaces DROP CONSTRAINT spaces_kind_check;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_kind_check
  CHECK (kind IN ('personal','couple','family','group')) NOT VALID;
ALTER TABLE public.spaces VALIDATE CONSTRAINT spaces_kind_check;

-- v3 canonical official asset catalog: private, never in the exposed Data API.
CREATE TABLE pointplus_private.official_assets (
  asset_id text PRIMARY KEY CHECK(asset_id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  mode text NOT NULL CHECK(mode IN ('couple','family','personal')),
  kind text NOT NULL CHECK(kind IN ('stamp','badge')),
  title text NOT NULL,
  rule_version integer NOT NULL CHECK(rule_version BETWEEN 1 AND 1000),
  stamp_target_count smallint,
  criterion text,
  threshold integer,
  required_stamp_asset_id text REFERENCES pointplus_private.official_assets(asset_id),
  db_rarity text CHECK(db_rarity IN ('common','rare','epic','legendary')),
  CONSTRAINT official_asset_kind_valid CHECK(
    (kind='stamp' AND stamp_target_count BETWEEN 1 AND 100
      AND criterion IS NULL AND threshold IS NULL
      AND required_stamp_asset_id IS NULL AND db_rarity IS NULL)
    OR
    (kind='badge' AND stamp_target_count IS NULL
      AND criterion IN ('official_stamps_count','official_categories_count')
      AND threshold BETWEEN 1 AND 6 AND db_rarity IS NOT NULL
      AND ((criterion='official_stamps_count' AND required_stamp_asset_id IS NOT NULL)
        OR (criterion='official_categories_count' AND required_stamp_asset_id IS NULL)))
  )
);
REVOKE ALL ON pointplus_private.official_assets FROM PUBLIC, anon, authenticated;
INSERT INTO pointplus_private.official_assets(
  asset_id,mode,kind,title,rule_version,stamp_target_count,
  criterion,threshold,required_stamp_asset_id,db_rarity)
VALUES
  ('couple-heart', 'couple', 'stamp', 'หัวใจแทนความใส่ใจ', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-letter', 'couple', 'stamp', 'ส่งข้อความดี ๆ ให้กัน', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-cheers', 'couple', 'stamp', 'ใช้เวลาคุณภาพด้วยกัน', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-flowers', 'couple', 'stamp', 'สร้างเซอร์ไพรส์เล็ก ๆ', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-cake', 'couple', 'stamp', 'ฉลองโอกาสพิเศษ', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-lock', 'couple', 'stamp', 'ดูแลและรักษาคำมั่นสัญญา', '1', '5', NULL, NULL, NULL, NULL),
  ('family-star', 'family', 'stamp', 'ทำภารกิจได้สำเร็จ', '1', '5', NULL, NULL, NULL, NULL),
  ('family-books', 'family', 'stamp', 'อ่านหนังสือ', '1', '5', NULL, NULL, NULL, NULL),
  ('family-home', 'family', 'stamp', 'ช่วยดูแลบ้าน', '1', '5', NULL, NULL, NULL, NULL),
  ('family-paint', 'family', 'stamp', 'ทำกิจกรรมสร้างสรรค์', '1', '5', NULL, NULL, NULL, NULL),
  ('family-sprout', 'family', 'stamp', 'เรียนรู้สิ่งใหม่', '1', '5', NULL, NULL, NULL, NULL),
  ('family-bear', 'family', 'stamp', 'แบ่งปันและมีน้ำใจ', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-sunrise', 'personal', 'stamp', 'เริ่มต้นวันตามเป้าหมาย', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-dumbbell', 'personal', 'stamp', 'ออกกำลังกาย', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-open-book', 'personal', 'stamp', 'เรียนรู้ทุกวัน', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-target', 'personal', 'stamp', 'ตั้งเป้าหมายและลงมือทำ', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-mountain', 'personal', 'stamp', 'ก้าวข้ามความท้าทาย', '1', '5', NULL, NULL, NULL, NULL),
  ('personal-trophy', 'personal', 'stamp', 'ทำสถิติของตัวเอง', '1', '5', NULL, NULL, NULL, NULL),
  ('couple-caring-heart', 'couple', 'badge', 'ใจดีต่อกัน', '1', NULL, 'official_stamps_count', '1', 'couple-heart', 'common'),
  ('couple-love-notes', 'couple', 'badge', 'ส่งกำลังใจกันสม่ำเสมอ', '1', NULL, 'official_stamps_count', '3', 'couple-letter', 'rare'),
  ('couple-moment-maker', 'couple', 'badge', 'สร้างความทรงจำร่วมกัน', '1', NULL, 'official_stamps_count', '5', 'couple-cheers', 'epic'),
  ('couple-forever-team', 'couple', 'badge', 'ผ่านภารกิจสำคัญร่วมกัน', '1', NULL, 'official_categories_count', '6', NULL, 'legendary'),
  ('family-first-star', 'family', 'badge', 'สำเร็จภารกิจแรก', '1', NULL, 'official_stamps_count', '1', 'family-star', 'common'),
  ('family-book-explorer', 'family', 'badge', 'อ่านหนังสืออย่างต่อเนื่อง', '1', NULL, 'official_stamps_count', '3', 'family-books', 'rare'),
  ('family-creative-hero', 'family', 'badge', 'ทำกิจกรรมสร้างสรรค์', '1', NULL, 'official_stamps_count', '5', 'family-paint', 'epic'),
  ('family-growth-champion', 'family', 'badge', 'พิชิตเป้าหมายการเรียนรู้', '1', NULL, 'official_categories_count', '6', NULL, 'legendary'),
  ('personal-fresh-start', 'personal', 'badge', 'เริ่มสร้างนิสัยใหม่', '1', NULL, 'official_stamps_count', '1', 'personal-sunrise', 'common'),
  ('personal-active-streak', 'personal', 'badge', 'เคลื่อนไหวอย่างต่อเนื่อง', '1', NULL, 'official_stamps_count', '3', 'personal-dumbbell', 'rare'),
  ('personal-goal-chaser', 'personal', 'badge', 'ทำเป้าหมายสำคัญสำเร็จ', '1', NULL, 'official_stamps_count', '5', 'personal-target', 'epic'),
  ('personal-personal-legend', 'personal', 'badge', 'พิชิตความสำเร็จใหญ่', '1', NULL, 'official_categories_count', '6', NULL, 'legendary')
ON CONFLICT(asset_id) DO NOTHING;

DO $v3_count$
BEGIN
 IF (SELECT count(*) FROM pointplus_private.official_assets)<>30
 OR (SELECT count(*) FROM pointplus_private.official_assets WHERE kind='stamp')<>18
 OR (SELECT count(*) FROM pointplus_private.official_assets WHERE kind='badge')<>12
 OR EXISTS (
   SELECT 1 FROM pointplus_private.official_assets b
   JOIN pointplus_private.official_assets s ON s.asset_id=b.required_stamp_asset_id
   WHERE b.kind='badge' AND (s.kind<>'stamp' OR s.mode<>b.mode)
 ) THEN RAISE EXCEPTION 'Invalid official catalog counts or dependency mode'; END IF;
END
$v3_count$;


-- Optional synchronized last-Room preference; no historical Account/Space changes.
CREATE TABLE public.room_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_space_id uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (last_space_id,user_id)
    REFERENCES public.space_members(space_id,user_id)
    ON DELETE SET NULL (last_space_id)
);
ALTER TABLE public.room_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON public.room_preferences TO authenticated;
GRANT UPDATE (last_space_id,updated_at) ON public.room_preferences TO authenticated;
CREATE POLICY room_preferences_read ON public.room_preferences
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
CREATE POLICY room_preferences_create ON public.room_preferences
 FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND (
   last_space_id IS NULL OR EXISTS (
     SELECT 1 FROM public.space_members m JOIN public.spaces s ON s.id=m.space_id
     WHERE m.space_id=last_space_id AND m.user_id=(SELECT auth.uid())
       AND s.kind IN ('couple','family','group')
   )));
CREATE POLICY room_preferences_update ON public.room_preferences
 FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()))
 WITH CHECK (user_id=(SELECT auth.uid()) AND (
   last_space_id IS NULL OR EXISTS (
     SELECT 1 FROM public.space_members m JOIN public.spaces s ON s.id=m.space_id
     WHERE m.space_id=last_space_id AND m.user_id=(SELECT auth.uid())
       AND s.kind IN ('couple','family','group')
   )));
CREATE TRIGGER pointplus_room_preferences_updated_at BEFORE UPDATE
 ON public.room_preferences FOR EACH ROW EXECUTE FUNCTION pointplus_private.set_updated_at();


ALTER TABLE public.stamp_cards
  ADD COLUMN IF NOT EXISTS official_rule_version integer NOT NULL DEFAULT 1
  CHECK (official_rule_version BETWEEN 1 AND 1000);
ALTER TABLE public.badge_definitions
  ADD COLUMN IF NOT EXISTS official_rule_version integer NOT NULL DEFAULT 1
  CHECK (official_rule_version BETWEEN 1 AND 1000);
ALTER TABLE public.badge_definitions
  ADD COLUMN IF NOT EXISTS required_stamp_asset_id text;

DO $check$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid='public.badge_definitions'::regclass
    AND c.conname='badge_definitions_criterion_check' AND c.contype='c';
  IF v_def IS NULL OR v_def NOT LIKE '%first_mission%'
     OR v_def NOT LIKE '%stamp_cards_completed%' THEN
    RAISE EXCEPTION 'Unexpected badge criterion CHECK. Review actual PointPlus schema.';
  END IF;
END
$check$;
ALTER TABLE public.badge_definitions DROP CONSTRAINT badge_definitions_criterion_check;
ALTER TABLE public.badge_definitions
  ADD CONSTRAINT badge_definitions_criterion_check CHECK (
    criterion IN ('first_mission','mission_count','first_redemption',
      'lifetime_points','stamp_cards_completed',
      'official_stamps_count','official_categories_count')
  ) NOT VALID;
ALTER TABLE public.badge_definitions VALIDATE CONSTRAINT badge_definitions_criterion_check;
ALTER TABLE public.badge_definitions
  ADD CONSTRAINT pointplus_badges_official_requirement CHECK (
    criterion <> 'official_stamps_count' OR required_stamp_asset_id IS NOT NULL
  );
CREATE OR REPLACE FUNCTION pointplus_private.seed_official_asset_catalog(p_space uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_kind text; v_owner uuid; v_mode text;
BEGIN
  SELECT kind, owner_id INTO v_kind, v_owner FROM public.spaces WHERE id=p_space;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown PointPlus Space'; END IF;
  v_mode:=CASE WHEN v_kind='couple' THEN 'couple'
    WHEN v_kind='family' THEN 'family' ELSE 'personal' END;

  INSERT INTO public.stamp_cards(
    space_id,title,description,image_key,target_count,repeatable,active,
    created_by,official_rule_version)
  SELECT p_space,s.title,'Official Point+ stamp card v1: '||s.asset_id,
    s.asset_id,s.stamp_target_count,true,true,v_owner,s.rule_version
  FROM pointplus_private.official_assets s
  WHERE s.kind='stamp'
  AND s.mode=v_mode AND NOT EXISTS(
    SELECT 1 FROM public.stamp_cards c WHERE c.space_id=p_space AND c.image_key=s.asset_id
  );

  INSERT INTO public.badge_definitions(
    space_id,slug,title,description,rarity,image_key,
    criterion,threshold,required_stamp_asset_id,created_by,official_rule_version)
  SELECT p_space,b.asset_id,b.title,'Official Point+ badge rule v1: '||b.asset_id,
    b.db_rarity,b.asset_id,b.criterion,b.threshold,b.required_stamp_asset_id,v_owner,b.rule_version
  FROM pointplus_private.official_assets b
  WHERE b.kind='badge'
  AND b.mode=v_mode
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION pointplus_private.seed_official_asset_catalog(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pointplus_private.seed_new_space_official_assets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pointplus_private.seed_official_asset_catalog(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pointplus_private.seed_new_space_official_assets()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS pointplus_official_assets_new_space ON public.spaces;
CREATE TRIGGER pointplus_official_assets_new_space
AFTER INSERT ON public.spaces
FOR EACH ROW EXECUTE FUNCTION pointplus_private.seed_new_space_official_assets();
DO $backfill$
DECLARE x record;
BEGIN
  FOR x IN SELECT id FROM public.spaces LOOP
    PERFORM pointplus_private.seed_official_asset_catalog(x.id);
  END LOOP;
END
$backfill$;
CREATE OR REPLACE FUNCTION pointplus_private.evaluate_badges(p_space uuid,p_participant uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.badge_definitions%ROWTYPE; v_count bigint; v_eligible boolean;
  v_mode text;
BEGIN
 SELECT CASE WHEN kind='couple' THEN 'couple'
             WHEN kind='family' THEN 'family' ELSE 'personal' END
   INTO v_mode FROM public.spaces WHERE id=p_space;
 IF v_mode IS NULL THEN RAISE EXCEPTION 'Unknown Room in badge evaluation'; END IF;
 FOR b IN SELECT * FROM public.badge_definitions
   WHERE active AND (space_id IS NULL OR space_id=p_space)
 LOOP
   v_eligible:=false;
   v_count:=0;
   IF b.criterion IN ('first_mission','mission_count') THEN
     SELECT count(*) INTO v_count FROM public.mission_submissions
       WHERE participant_id=p_participant AND space_id=p_space AND status='approved';
   ELSIF b.criterion='first_redemption' THEN
     SELECT count(*) INTO v_count FROM public.redemptions
       WHERE participant_id=p_participant AND space_id=p_space;
   ELSIF b.criterion='lifetime_points' THEN
     SELECT lifetime_earned INTO v_count FROM public.point_wallets
       WHERE participant_id=p_participant AND space_id=p_space;
   ELSIF b.criterion='stamp_cards_completed' THEN
     SELECT count(*) INTO v_count FROM public.stamp_cycles
       WHERE participant_id=p_participant AND space_id=p_space
       AND completed_at IS NOT NULL;
   ELSIF b.criterion='official_stamps_count' THEN
     SELECT coalesce(sum(a.quantity),0) INTO v_count
       FROM public.stamp_awards a
       JOIN public.stamp_cycles cy ON cy.id=a.stamp_cycle_id
       JOIN public.stamp_cards c ON c.id=cy.stamp_card_id
       JOIN public.mission_submissions sub ON sub.id=a.submission_id
       JOIN pointplus_private.official_assets oa ON oa.asset_id=c.image_key
      WHERE a.space_id=p_space AND cy.space_id=p_space AND c.space_id=p_space
        AND cy.participant_id=p_participant AND sub.participant_id=p_participant
        AND sub.space_id=p_space AND sub.status='approved'
        AND oa.kind='stamp' AND oa.mode=v_mode
        AND oa.asset_id=b.required_stamp_asset_id;
   ELSIF b.criterion='official_categories_count' THEN
     SELECT count(DISTINCT oa.asset_id) INTO v_count
       FROM public.stamp_awards a
       JOIN public.stamp_cycles cy ON cy.id=a.stamp_cycle_id
       JOIN public.stamp_cards c ON c.id=cy.stamp_card_id
       JOIN public.mission_submissions sub ON sub.id=a.submission_id
       JOIN pointplus_private.official_assets oa ON oa.asset_id=c.image_key
      WHERE a.space_id=p_space AND cy.space_id=p_space AND c.space_id=p_space
        AND cy.participant_id=p_participant AND sub.participant_id=p_participant
        AND sub.space_id=p_space AND sub.status='approved'
        AND oa.kind='stamp' AND oa.mode=v_mode;
   END IF;
   v_eligible:=coalesce(v_count,0)>=b.threshold;
   IF v_eligible THEN
     INSERT INTO public.participant_badges(space_id,participant_id,badge_id)
       VALUES(p_space,p_participant,b.id)
       ON CONFLICT (participant_id,badge_id) DO NOTHING;
   END IF;
 END LOOP;
END;
$$;
-- Integrity/indexes: avoid new duplicate official mappings while retaining legacy cards.
CREATE UNIQUE INDEX pointplus_v3_unique_official_stamp_image_per_room
 ON public.stamp_cards (space_id,image_key)
 WHERE image_key IN ('couple-heart','couple-letter','couple-cheers','couple-flowers','couple-cake','couple-lock','family-star','family-books','family-home','family-paint','family-sprout','family-bear','personal-sunrise','personal-dumbbell','personal-open-book','personal-target','personal-mountain','personal-trophy');
CREATE UNIQUE INDEX pointplus_v3_unique_official_badge_image_per_room
 ON public.badge_definitions (space_id,image_key)
 WHERE space_id IS NOT NULL AND image_key IN ('couple-caring-heart','couple-love-notes','couple-moment-maker','couple-forever-team','family-first-star','family-book-explorer','family-creative-hero','family-growth-champion','personal-fresh-start','personal-active-streak','personal-goal-chaser','personal-personal-legend');
CREATE INDEX pointplus_v3_badge_room_criterion_idx
 ON public.badge_definitions (space_id,criterion) WHERE active=true;
CREATE INDEX pointplus_v3_stamp_awards_submission_idx
 ON public.stamp_awards (space_id,submission_id);

-- Lock down official catalog rule *updates* by regular room managers. Existing
-- non-official/custom cards remain editable under their current RLS rules.
CREATE OR REPLACE FUNCTION pointplus_private.protect_official_collection_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_official_old boolean; v_official_new boolean;
BEGIN
 IF TG_TABLE_NAME='stamp_cards' THEN
   SELECT EXISTS(SELECT 1 FROM pointplus_private.official_assets a
     WHERE a.asset_id=OLD.image_key AND a.kind='stamp') INTO v_official_old;
   SELECT EXISTS(SELECT 1 FROM pointplus_private.official_assets a
     WHERE a.asset_id=NEW.image_key AND a.kind='stamp') INTO v_official_new;
   IF (v_official_old OR v_official_new) AND (
       NEW.image_key IS DISTINCT FROM OLD.image_key OR
       NEW.target_count IS DISTINCT FROM OLD.target_count OR
       NEW.repeatable IS DISTINCT FROM OLD.repeatable OR
       NEW.official_rule_version IS DISTINCT FROM OLD.official_rule_version) THEN
     RAISE EXCEPTION 'Official Stamp identity and rules are immutable';
   END IF;
 ELSIF TG_TABLE_NAME='badge_definitions' THEN
   SELECT EXISTS(SELECT 1 FROM pointplus_private.official_assets a
     WHERE a.asset_id=OLD.image_key AND a.kind='badge') INTO v_official_old;
   SELECT EXISTS(SELECT 1 FROM pointplus_private.official_assets a
     WHERE a.asset_id=NEW.image_key AND a.kind='badge') INTO v_official_new;
   IF (v_official_old OR v_official_new) AND (
       NEW.image_key IS DISTINCT FROM OLD.image_key OR
       NEW.slug IS DISTINCT FROM OLD.slug OR
       NEW.criterion IS DISTINCT FROM OLD.criterion OR
       NEW.threshold IS DISTINCT FROM OLD.threshold OR
       NEW.required_stamp_asset_id IS DISTINCT FROM OLD.required_stamp_asset_id OR
       NEW.official_rule_version IS DISTINCT FROM OLD.official_rule_version OR
       NEW.rarity IS DISTINCT FROM OLD.rarity) THEN
     RAISE EXCEPTION 'Official Badge identity and rules are immutable';
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pointplus_private.protect_official_collection_fields()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pointplus_v3_immutable_stamp_rule BEFORE UPDATE ON public.stamp_cards
 FOR EACH ROW EXECUTE FUNCTION pointplus_private.protect_official_collection_fields();
CREATE TRIGGER pointplus_v3_immutable_badge_rule BEFORE UPDATE ON public.badge_definitions
 FOR EACH ROW EXECUTE FUNCTION pointplus_private.protect_official_collection_fields();

-- Cross-Room Badge awards are invalid, even when issued by an internal function.
CREATE OR REPLACE FUNCTION pointplus_private.assert_badge_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_badge_space uuid;
BEGIN
 SELECT space_id INTO v_badge_space FROM public.badge_definitions WHERE id=NEW.badge_id;
 IF NOT FOUND OR (v_badge_space IS NOT NULL AND v_badge_space<>NEW.space_id) THEN
   RAISE EXCEPTION 'Badge definition does not belong to this Room';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pointplus_private.assert_badge_scope()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER pointplus_v3_badge_scope BEFORE INSERT OR UPDATE ON public.participant_badges
 FOR EACH ROW EXECUTE FUNCTION pointplus_private.assert_badge_scope();


-- Ensure one officially mapped Stamp/Badge record exists per Room (6 + 4).
DO $v3_verify$
DECLARE v_bad_spaces integer; v_bad_rules integer;
BEGIN
 SELECT count(*) INTO v_bad_spaces FROM (
   SELECT s.id, count(DISTINCT sc.image_key) FILTER(WHERE oa.kind='stamp') AS stamp_n,
                count(DISTINCT bd.image_key) FILTER(WHERE oa.kind='badge') AS badge_n
   FROM public.spaces s
   LEFT JOIN public.stamp_cards sc ON sc.space_id=s.id
   LEFT JOIN pointplus_private.official_assets oa ON oa.asset_id=sc.image_key AND oa.kind='stamp'
   LEFT JOIN public.badge_definitions bd ON bd.space_id=s.id AND bd.image_key IS NOT NULL
   GROUP BY s.id
 ) q WHERE stamp_n<>6;
 -- Badge count independently (avoid fan-out from joining cards).
 SELECT count(*) INTO v_bad_rules
 FROM public.spaces s
 WHERE (SELECT count(*) FROM public.badge_definitions bd
          JOIN pointplus_private.official_assets oa ON oa.asset_id=bd.image_key
         WHERE bd.space_id=s.id AND oa.kind='badge')<>4;
 IF v_bad_spaces>0 OR v_bad_rules>0 THEN
   RAISE EXCEPTION 'Official Catalog backfill incomplete, Rooms: %, badge Rooms: %',v_bad_spaces,v_bad_rules;
 END IF;
END
$v3_verify$;

COMMIT;
-- No live Postgres query has run as part of producing this proposal.
