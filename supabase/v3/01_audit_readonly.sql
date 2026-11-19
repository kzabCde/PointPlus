-- POINT+ DB v3: READ ONLY INVENTORY. DO NOT TREAT A SQL RESULT AS PROJECT-ID PROOF.
-- Open this in the SQL editor of the VERIFIED PointPlus project gczribbtkfvhpzzupqre.
-- No PII, secrets, mutations, functions with side effects, or UPDATE/INSERT/DDL here.
SELECT current_database() AS database_name, current_user AS actor, current_setting('server_version') AS pg_version;

-- Public app tables, size estimate and RLS status.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relname;

-- Relevant columns (compare with v2 source).
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
  ('profiles','spaces','space_members','participants','child_profiles','space_invites',
   'missions','mission_submissions','stamp_cards','stamp_cycles','stamp_awards',
   'badge_definitions','participant_badges','point_wallets','point_transactions',
   'rewards','redemptions','stamp_prizes','notifications','audit_events','room_preferences')
ORDER BY table_name, ordinal_position;

-- Constraint names and actual definitions; migration cannot assume names.
SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name,
       c.contype AS constraint_kind, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid IN ('public.spaces'::regclass, 'public.badge_definitions'::regclass,
                     'public.stamp_cards'::regclass, 'public.space_members'::regclass,
                     'public.participant_badges'::regclass)
ORDER BY table_name, constraint_name;

-- Policy metadata and internal RPC security properties.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
SELECT n.nspname AS schema_name, p.proname AS function_name,
       p.prosecdef AS security_definer, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','pointplus_private') AND p.proname LIKE 'pointplus_%'
   OR (n.nspname='pointplus_private' AND p.proname IN
       ('review_mission','award_stamps','post_points','evaluate_badges','after_new_space'))
ORDER BY schema_name, function_name;

-- Database side-effect hooks; verify no incompatible old official-catalog triggers.
SELECT c.relname AS table_name, t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','auth') AND NOT t.tgisinternal
  AND c.relname IN ('spaces','mission_submissions','stamp_cards','badge_definitions','users')
ORDER BY table_name, trigger_name;

-- Non-sensitive aggregated data quality and drift checks.
SELECT kind, count(*) AS room_count FROM public.spaces GROUP BY kind ORDER BY kind;
SELECT count(*) AS member_count FROM public.space_members;
SELECT count(*) AS participant_count FROM public.participants;
SELECT count(*) AS mission_count FROM public.missions;
SELECT count(*) AS approved_submission_count FROM public.mission_submissions WHERE status='approved';
SELECT count(*) AS stamped_award_count FROM public.stamp_awards;
SELECT count(*) AS recorded_badges FROM public.participant_badges;
SELECT count(*) AS point_transaction_count FROM public.point_transactions;
SELECT count(*) AS issued_redemptions FROM public.redemptions;
SELECT space_id, image_key, count(*) AS duplicate_count
FROM public.stamp_cards WHERE image_key IS NOT NULL
GROUP BY space_id,image_key HAVING count(*)>1 LIMIT 50;
SELECT space_id, image_key, count(*) AS duplicate_count
FROM public.badge_definitions WHERE image_key IS NOT NULL AND space_id IS NOT NULL
GROUP BY space_id,image_key HAVING count(*)>1 LIMIT 50;
SELECT count(*) AS badge_cross_space_mismatch
FROM public.participant_badges pb JOIN public.badge_definitions bd ON bd.id=pb.badge_id
WHERE bd.space_id IS NOT NULL AND bd.space_id<>pb.space_id;
SELECT count(*) AS stamp_cross_space_mismatch
FROM public.stamp_awards a JOIN public.stamp_cycles c ON c.id=a.stamp_cycle_id
WHERE a.space_id<>c.space_id;
