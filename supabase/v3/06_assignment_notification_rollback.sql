-- Operator-only rollback of v3.1 hardening; preserves all user rows.
-- Do not run against any project except PointPlus gczribbtkfvhpzzupqre.
-- Notifications previously issued are intentionally retained.
BEGIN;
SET LOCAL lock_timeout = '8s';
DROP TRIGGER IF EXISTS pointplus_notify_mission_assignment
  ON public.mission_assignments;
DROP FUNCTION IF EXISTS pointplus_private.notify_mission_assignment();
-- This restores the earlier grants only if the event-trigger tool requires it.
-- Normal operation should KEEP EXECUTE revoked for anon/authenticated.
-- GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;
COMMIT;
