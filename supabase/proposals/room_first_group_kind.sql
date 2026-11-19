-- Point+ R01 | Proposed, non-destructive migration against Database v2.0
-- DO NOT execute without verifying the TARGET PointPlus project gczribbtkfvhpzzupqre.
-- This script must be reviewed against the live schema before applying.
BEGIN;
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

-- No existing Space IDs, owners, memberships, participants, points,
-- missions, or history are changed. The existing RLS membership predicates,
-- invitation RPC and post-insert provisioning triggers remain authoritative.
COMMIT;
