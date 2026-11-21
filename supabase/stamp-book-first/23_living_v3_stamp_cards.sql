BEGIN;

-- Point+ Living V3 card variant; no legacy ledger or old creation RPC is re-enabled.
-- M01's single-active-direction index prevented multiple personal collections for
-- the same couple. Remove this index without deleting or modifying existing rows.
DROP INDEX IF EXISTS public.living_books_one_open_direction;

CREATE TABLE public.living_book_cards (
 book_id uuid PRIMARY KEY,
 space_id uuid NOT NULL,
 target_count integer NOT NULL CHECK(target_count BETWEEN 1 AND 100),
 reward_title text NOT NULL CHECK(length(btrim(reward_title)) BETWEEN 1 AND 160),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(book_id,space_id) REFERENCES public.living_books(id,space_id) ON DELETE CASCADE
);
CREATE INDEX living_book_cards_space_idx ON public.living_book_cards(space_id);
ALTER TABLE public.living_book_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.living_book_cards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.living_book_cards TO authenticated;
CREATE POLICY living_card_member_read ON public.living_book_cards FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.space_members m
  WHERE m.space_id=living_book_cards.space_id AND m.user_id=(SELECT auth.uid())));

ALTER TABLE public.living_stamp_requests ADD COLUMN card_slot integer
 CONSTRAINT living_stamp_requests_card_slot_valid CHECK(card_slot IS NULL OR card_slot BETWEEN 1 AND 100);
CREATE UNIQUE INDEX living_card_occupied_slot_unique
 ON public.living_stamp_requests(book_id,card_slot)
 WHERE card_slot IS NOT NULL AND status IN ('pending','approved');

-- Every card stamp MUST use its exact numbered paper slot. This trigger also
-- protects the legacy-compatible Living stamp issuance RPC from bypassing slots.
CREATE FUNCTION pointplus_private.assign_living_card_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_target integer;v_cols integer;v_rows integer;
 v_col integer;v_row integer;v_slot integer;v_x numeric;v_y numeric;
BEGIN
 SELECT target_count INTO v_target FROM public.living_book_cards WHERE book_id=NEW.book_id;
 IF NOT FOUND THEN NEW.card_slot:=NULL; RETURN NEW; END IF;
 v_cols:=LEAST(5,CEIL(SQRT(v_target))::integer);
 v_rows:=CEIL(v_target::numeric/v_cols)::integer;
 v_col:=FLOOR(NEW.position_x*v_cols)::integer;
 v_row:=FLOOR(NEW.position_y*v_rows)::integer;
 IF v_col<0 OR v_col>=v_cols OR v_row<0 OR v_row>=v_rows
 THEN RAISE EXCEPTION 'Invalid numbered card slot' USING ERRCODE='22023'; END IF;
 v_slot:=v_row*v_cols+v_col+1;
 v_x:=ROUND(((v_col+0.5)/v_cols)::numeric,4);
 v_y:=ROUND(((v_row+0.5)/v_rows)::numeric,4);
 IF v_slot>v_target OR ABS(NEW.position_x-v_x)>0.00005
  OR ABS(NEW.position_y-v_y)>0.00005 OR NEW.rotation_deg<>0
  OR NEW.scale_factor<>0.7
 THEN RAISE EXCEPTION 'Card stamps require a numbered slot' USING ERRCODE='22023'; END IF;
 NEW.card_slot:=v_slot;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION pointplus_private.assign_living_card_slot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER living_card_slot_guard BEFORE INSERT OR UPDATE OF
 position_x,position_y,rotation_deg,scale_factor,status
 ON public.living_stamp_requests FOR EACH ROW
 EXECUTE FUNCTION pointplus_private.assign_living_card_slot();

-- Card marks cannot be moved off their original ledger request's slot.
CREATE FUNCTION pointplus_private.guard_living_card_mark()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_request public.living_stamp_requests%ROWTYPE;
BEGIN
 SELECT * INTO v_request FROM public.living_stamp_requests WHERE id=NEW.request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original stamp request not found' USING ERRCODE='22023'; END IF;
 IF v_request.card_slot IS NOT NULL AND (
  NEW.page_id IS DISTINCT FROM v_request.page_id OR
  NEW.position_x IS DISTINCT FROM v_request.position_x OR
  NEW.position_y IS DISTINCT FROM v_request.position_y OR
  NEW.rotation_deg IS DISTINCT FROM v_request.rotation_deg OR
  NEW.scale_factor IS DISTINCT FROM v_request.scale_factor
 ) THEN RAISE EXCEPTION 'Card stamps cannot leave their numbered slot' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION pointplus_private.guard_living_card_mark() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER living_card_mark_guard BEFORE INSERT OR UPDATE OF
 page_id,position_x,position_y,rotation_deg,scale_factor
 ON public.living_stamp_marks FOR EACH ROW
 EXECUTE FUNCTION pointplus_private.guard_living_card_mark();

-- M04 remains the authority for reservations; the card adds a full-target
-- and fixed-reward rule, enforced in the same transaction as redemption.
CREATE FUNCTION pointplus_private.guard_living_card_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_card public.living_book_cards%ROWTYPE;v_count integer;
BEGIN
 SELECT * INTO v_card FROM public.living_book_cards WHERE book_id=NEW.book_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NEW.requested_quantity<>v_card.target_count OR
    NEW.reward_message IS DISTINCT FROM v_card.reward_title
 THEN RAISE EXCEPTION 'Card redemption must use its full target and configured reward' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_count FROM public.living_stamp_marks m
  JOIN public.living_stamp_requests r ON r.id=m.request_id
  WHERE m.book_id=NEW.book_id AND m.state='available' AND r.card_slot IS NOT NULL;
 IF v_count<v_card.target_count
 THEN RAISE EXCEPTION 'Card stamps are incomplete or not spendable' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION pointplus_private.guard_living_card_redemption() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER living_card_redemption_guard BEFORE INSERT ON public.living_stamp_redemptions
 FOR EACH ROW EXECUTE FUNCTION pointplus_private.guard_living_card_redemption();

-- Reuse the authorization, idempotency, giver and first-page creation of M01.
CREATE FUNCTION public.pointplus_create_living_card(
 p_space uuid,p_recipient uuid,p_title text,p_description text,p_cover text,
 p_approval text,p_key uuid,p_target integer,p_reward text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_book uuid;v_existing uuid;v_card public.living_book_cards%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR p_key IS NULL OR p_target IS NULL OR
   p_target NOT BETWEEN 1 AND 100 OR p_reward IS NULL OR
   length(btrim(p_reward)) NOT BETWEEN 1 AND 160
 THEN RAISE EXCEPTION 'Invalid card parameters' USING ERRCODE='22023'; END IF;
 -- Serialize same-room creations before checking the idempotency key, including
 -- concurrent retries of this wrapper and the base Living Book creator.
 PERFORM 1 FROM public.spaces WHERE id=p_space FOR UPDATE;
 SELECT id INTO v_existing FROM public.living_books
  WHERE owner_user_id=auth.uid() AND creation_key=p_key;
 IF v_existing IS NOT NULL THEN
   SELECT * INTO v_card FROM public.living_book_cards WHERE book_id=v_existing;
   IF NOT FOUND OR v_card.target_count<>p_target OR v_card.reward_title<>btrim(p_reward)
   THEN RAISE EXCEPTION 'Idempotency key belongs to another collection' USING ERRCODE='22023'; END IF;
 END IF;
 v_book:=public.pointplus_create_living_book(
   p_space,p_recipient,p_title,p_description,p_cover,p_approval,p_key);
 IF v_existing IS NULL THEN
   INSERT INTO public.living_book_cards(book_id,space_id,target_count,reward_title)
   VALUES(v_book,p_space,p_target,btrim(p_reward));
 END IF;
 RETURN v_book;
END $fn$;
REVOKE ALL ON FUNCTION public.pointplus_create_living_card(
 uuid,uuid,text,text,text,text,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pointplus_create_living_card(
 uuid,uuid,text,text,text,text,uuid,integer,text) TO authenticated;

COMMIT;
