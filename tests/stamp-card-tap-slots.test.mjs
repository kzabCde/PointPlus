import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
function loadPure(path) {
  const code=ts.transpileModule(read(path),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText
  const module={exports:{}}
  new Function('exports',code)(module.exports)
  return module.exports
}
const {cardMarkSlots}=loadPure('features/stamp-books/card-model.ts')

test('existing unindexed cards keep their original numbered positions',()=>{
  const legacy=[{id:'A',slot_index:null},{id:'B',slot_index:null}]
  assert.deepEqual(cardMarkSlots(legacy,4).map(x=>x?.id??null),['A','B',null,null])
})
test('clicked slot persists in its exact position while legacy marks occupy earlier available cells',()=>{
  const marks=[
    {id:'legacy1',slot_index:null},
    {id:'slot4',slot_index:4},
    {id:'legacy2',slot_index:null},
    {id:'slot2',slot_index:2},
  ]
  const mapped=cardMarkSlots(marks,6)
  assert.deepEqual(mapped.map(x=>x?.id??null),['legacy1','legacy2','slot2',null,'slot4',null])
  assert.deepEqual(cardMarkSlots([{id:1,slot_index:0}],1).map(x=>x?.id),[1])
  assert.deepEqual(cardMarkSlots([{id:'bad',slot_index:8}],6),[null,null,null,null,null,null])
  assert.deepEqual(cardMarkSlots([],101),[])
})
test('tapping an empty cell opens an inline stamp picker for the selected cell',()=>{
  const card=read('features/stamp-books/card.tsx')
  const page=read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx')
  const journal=read('features/stamp-books/journal.tsx')
  assert.match(card,/className="stamp-card-slot__pick"/)
  assert.match(card,/onClick=\{\(\) => openSlot\(index\)\}/)
  assert.match(card,/dialog\.current\?\.showModal\(\)/)
  assert.match(card,/form\.set\('card_slot', String\(selectedSlot\)\)/)
  assert.match(card,/form\.set\('idempotency_key', key\.current\)/)
  assert.match(card,/status === 'pending'/)
  assert.match(card,/slot_index/)
  assert.match(card,/onSubmit=\{submit\}/)
  assert.match(journal,/StampCollectionCard/)
  assert.match(journal,/canGive=\{canGive && !cycle\.completed_at/)
  assert.doesNotMatch(page,/GiveStampDialog/)
  assert.match(page,/ClaimCoupleMemoryForm/)
  assert.match(page,/ClaimStampRewardForm/)
})
test('additive PostgreSQL migration reserves each card cell with exact slot and original issuer',()=>{
  const sql=read('supabase/stamp-book-first/15_card_click_to_stamp.sql')
  assert.match(sql,/ADD COLUMN IF NOT EXISTS slot_index integer/)
  assert.match(sql,/CREATE UNIQUE INDEX stamp_book_marks_unique_card_slot/)
  assert.match(sql,/CREATE UNIQUE INDEX stamp_book_requests_pending_card_slot/)
  assert.match(sql,/pointplus_private\.book_copy_card_slot/)
  assert.match(sql,/pointplus_give_stamp_to_card/)
  assert.match(sql,/public\.pointplus_give_stamp\(p_book,p_recipient,p_art,p_note,p_key\)/)
  assert.match(sql,/v_prior\.slot_index IS DISTINCT FROM p_slot/)
  assert.match(sql,/v_cycle\.target_snapshot/)
  assert.match(sql,/v_legacy_count > v_free_before/)
  assert.match(sql,/WHERE request_id=v_request/)
  assert.match(sql,/auth\.uid\(\)/)
  assert.match(sql,/TO authenticated/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.pointplus_give_stamp_to_card/)
  assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDELETE FROM\b|\bDROP TABLE\b|\bDROP COLUMN\b/i)
  assert.match(sql,/COMMIT;\s*$/)
})

const sampleId='11111111-1111-4111-8111-111111111111'
const recipientId='22222222-2222-4222-8222-222222222222'
const spaceId='33333333-3333-4333-8333-333333333333'
const stamps=JSON.parse(read('assets/point-plus/manifest/stamps.json'))

function compileAction(mockSupabase) {
  const compiled=ts.transpileModule(read('features/stamp-books/actions.ts'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText
  const mocks={
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{
      field:(form,name)=>String(form.get(name)??'').trim(),
      isUuid:value=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value),
    },
    '@/features/spaces/data':{
      getSpaceContext:async()=>({supabase:mockSupabase,member:{role:'owner'},space:{kind:'couple'}}),
      canManage:role=>role==='owner',
    },
    '@/lib/point-plus/assets':{pointPlusStamps:stamps},
  }
  const module={exports:{}}
  new Function('require','module','exports',compiled)(
    name=>{if(!(name in mocks))throw Error('unexpected import '+name);return mocks[name]},
    module,module.exports)
  return module.exports
}
function requestForm(slot='7'){
  const form=new FormData()
  for(const [name,value] of Object.entries({
    space_id:spaceId,book_id:sampleId,recipient_id:recipientId,
    asset_id:stamps[0].id,note:'รักกัน',idempotency_key:sampleId,card_slot:slot,
  }))form.set(name,value)
  return form
}
test('server action sends the exact clicked cell through the new versioned stamp RPC',async()=>{
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:sampleId},error:null}}}),
    rpc:async(name,args)=>{
      calls.push({name,args})
      return {data:{status:'approved',request_id:sampleId},error:null}
    },
  }
  const outcome=await compileAction(supabase).giveStampAction({status:'idle',message:''},requestForm('7'))
  assert.equal(outcome.status,'success')
  assert.equal(outcome.outcome,'granted')
  assert.deepEqual(outcome.receipt,{kind:'stamp',id:sampleId})
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_give_stamp_to_card')
  assert.equal(calls[0].args.p_slot,7)
  assert.equal(calls[0].args.p_book,sampleId)
  assert.equal(calls[0].args.p_art,stamps[0].id)
  assert.equal(calls[0].args.p_note,'รักกัน')
})
test('pending card stamp continues through the original review approval flow',async()=>{
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:sampleId},error:null}}}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:{status:'pending',request_id:sampleId},error:null}},
  }
  const outcome=await compileAction(supabase).giveStampAction({status:'idle',message:''},requestForm('3'))
  assert.equal(outcome.status,'success')
  assert.equal(outcome.outcome,'pending')
  assert.equal(calls[0].name,'pointplus_give_stamp_to_card')
  const form=read('features/stamp-books/forms.tsx')
  assert.match(form,/ReviewStampForm/)
  assert.match(read('features/stamp-books/actions.ts'),/pointplus_review_stamp_request/)
})
test('invalid slot, fractional slot or mixed paper/card payload never reaches any RPC',async()=>{
  let calls=0
  const action=compileAction({rpc:async()=>{calls++}}).giveStampAction
  for(const slot of ['-1','100','1.5','NaN','','Infinity']){
    const form=requestForm(slot)
    assert.equal((await action({status:'idle',message:''},form)).status,'error')
  }
  const mixed=requestForm('3')
  mixed.set('page_index','0')
  mixed.set('position_x','0.5')
  mixed.set('position_y','0.5')
  mixed.set('rotation_deg','0')
  assert.equal((await action({status:'idle',message:''},mixed)).status,'error')
  assert.equal(calls,0)
})
