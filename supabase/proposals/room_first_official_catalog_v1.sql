-- Point+ R06 / v1 Official Catalog — PROPOSAL ONLY.
-- Prerequisite: review and apply room_first_group_kind.sql to the EXACT
-- target project gczribbtkfvhpzzupqre. Never apply on another project.
-- Audited against supplied original PointPlus Database v2.0 source,
-- NOT against live schema or actual data. Test on isolated PointPlus DB first.
BEGIN;

-- Preserve existing cycles, awards, badges, wallets, users and missions.
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

-- Stable asset IDs map to database UUID rows through image_key, not slug/UUID equality.
-- Existing unofficial/default cards are NOT deleted or rewritten.
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
    s.asset_id,5,true,true,v_owner,1
  FROM (VALUES
    ('couple', 'couple-heart', 'หัวใจแทนความใส่ใจ'),
    ('couple', 'couple-letter', 'ส่งข้อความดี ๆ ให้กัน'),
    ('couple', 'couple-cheers', 'ใช้เวลาคุณภาพด้วยกัน'),
    ('couple', 'couple-flowers', 'สร้างเซอร์ไพรส์เล็ก ๆ'),
    ('couple', 'couple-cake', 'ฉลองโอกาสพิเศษ'),
    ('couple', 'couple-lock', 'ดูแลและรักษาคำมั่นสัญญา'),
    ('family', 'family-star', 'ทำภารกิจได้สำเร็จ'),
    ('family', 'family-books', 'อ่านหนังสือ'),
    ('family', 'family-home', 'ช่วยดูแลบ้าน'),
    ('family', 'family-paint', 'ทำกิจกรรมสร้างสรรค์'),
    ('family', 'family-sprout', 'เรียนรู้สิ่งใหม่'),
    ('family', 'family-bear', 'แบ่งปันและมีน้ำใจ'),
    ('personal', 'personal-sunrise', 'เริ่มต้นวันตามเป้าหมาย'),
    ('personal', 'personal-dumbbell', 'ออกกำลังกาย'),
    ('personal', 'personal-open-book', 'เรียนรู้ทุกวัน'),
    ('personal', 'personal-target', 'ตั้งเป้าหมายและลงมือทำ'),
    ('personal', 'personal-mountain', 'ก้าวข้ามความท้าทาย'),
    ('personal', 'personal-trophy', 'ทำสถิติของตัวเอง')
  ) AS s(mode,asset_id,title)
  WHERE s.mode=v_mode AND NOT EXISTS(
    SELECT 1 FROM public.stamp_cards c WHERE c.space_id=p_space AND c.image_key=s.asset_id
  );

  INSERT INTO public.badge_definitions(
    space_id,slug,title,description,rarity,image_key,
    criterion,threshold,required_stamp_asset_id,created_by,official_rule_version)
  SELECT p_space,b.asset_id,b.title,'Official Point+ badge rule v1: '||b.asset_id,
    b.rarity,b.asset_id,b.criterion,b.threshold,b.required_stamp_asset_id,v_owner,1
  FROM (VALUES
    ('couple', 'couple-caring-heart', 'ใจดีต่อกัน', 'common', 'official_stamps_count', 1, 'couple-heart'),
    ('couple', 'couple-love-notes', 'ส่งกำลังใจกันสม่ำเสมอ', 'rare', 'official_stamps_count', 3, 'couple-letter'),
    ('couple', 'couple-moment-maker', 'สร้างความทรงจำร่วมกัน', 'epic', 'official_stamps_count', 5, 'couple-cheers'),
    ('couple', 'couple-forever-team', 'ผ่านภารกิจสำคัญร่วมกัน', 'legendary', 'official_categories_count', 6, NULL),
    ('family', 'family-first-star', 'สำเร็จภารกิจแรก', 'common', 'official_stamps_count', 1, 'family-star'),
    ('family', 'family-book-explorer', 'อ่านหนังสืออย่างต่อเนื่อง', 'rare', 'official_stamps_count', 3, 'family-books'),
    ('family', 'family-creative-hero', 'ทำกิจกรรมสร้างสรรค์', 'epic', 'official_stamps_count', 5, 'family-paint'),
    ('family', 'family-growth-champion', 'พิชิตเป้าหมายการเรียนรู้', 'legendary', 'official_categories_count', 6, NULL),
    ('personal', 'personal-fresh-start', 'เริ่มสร้างนิสัยใหม่', 'common', 'official_stamps_count', 1, 'personal-sunrise'),
    ('personal', 'personal-active-streak', 'เคลื่อนไหวอย่างต่อเนื่อง', 'rare', 'official_stamps_count', 3, 'personal-dumbbell'),
    ('personal', 'personal-goal-chaser', 'ทำเป้าหมายสำคัญสำเร็จ', 'epic', 'official_stamps_count', 5, 'personal-target'),
    ('personal', 'personal-personal-legend', 'พิชิตความสำเร็จใหญ่', 'legendary', 'official_categories_count', 6, NULL)
  ) AS b(mode,asset_id,title,rarity,criterion,threshold,required_stamp_asset_id)
  WHERE b.mode=v_mode
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

-- Backfill official cards/rules into existing Spaces. No changes to existing
-- Personal Space identity or to previous stamp award/point ledgers.
DO $backfill$
DECLARE x record;
BEGIN
  FOR x IN SELECT id FROM public.spaces LOOP
    PERFORM pointplus_private.seed_official_asset_catalog(x.id);
  END LOOP;
END
$backfill$;

-- Extend, rather than replace, v2's five legacy badge criteria.
-- Called only from v2 approval/redemption server-side RPC flows.
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
      WHERE cy.space_id=p_space AND cy.participant_id=p_participant
        AND c.image_key=b.required_stamp_asset_id;
   ELSIF b.criterion='official_categories_count' THEN
     SELECT count(DISTINCT c.image_key) INTO v_count
       FROM public.stamp_awards a
       JOIN public.stamp_cycles cy ON cy.id=a.stamp_cycle_id
       JOIN public.stamp_cards c ON c.id=cy.stamp_card_id
      WHERE cy.space_id=p_space AND cy.participant_id=p_participant
        AND c.image_key LIKE v_mode||'-%';
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
-- Privileges remain those of the existing private function.
COMMIT;

-- POST-MIGRATION ACCEPTANCE (not executed here):
-- 1. Check each Space has exactly six official stamp_cards and four badge_definitions.
-- 2. Create all 18 approved mission/card combinations across three Room modes.
-- 3. Verify each badge's threshold and per-participant isolation using two users.
-- 4. Replay one submission/review and verify no duplicate stamp/point/badge award.
-- 5. Confirm 22 v2 tables/RLS/legacy rows remain intact.
