import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=get('supabase/stamp-book-first/19_living_stampbook_v3_m04_redemptions.sql')
const actions=get('features/living-books/redemption-actions.ts')
const data=get('features/living-books/redemption-data.ts')
const panel=get('features/living-books/redemption-panel.tsx')
const page=get('app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx')
const overlay=get('features/living-books/m03-tools.tsx')
const markModel=get('features/living-books/stamp-model.ts')
const repoPath='features/living-books/redemption-actions.ts'
const id='11111111-1111-4111-8111-111111111111'
const spaceId='22222222-2222-4222-8222-222222222222'
const bookId='33333333-3333-4333-8333-333333333333'
const requestId='44444444-4444-4444-8444-444444444444'
const key='55555555-5555-4555-8555-555555555555'
const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)
function compile(code,stubs={}){
  const output=ts.transpileModule(code,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  }}).outputText
  const mod={exports:{}}
  new Function('require','exports','module',output)((name)=>{
    if(!(name in stubs))throw new Error('Unexpected dependency '+name)
    return stubs[name]
  },mod.exports,mod)
  return mod.exports
}
function mocked({error=null,existing=true,reply=null}={}){
  const calls=[]
  const supabase={
    rpc:async(name,args)=>{
      calls.push({name,args})
      let output=reply
      if(output===null)output=name==='pointplus_request_living_stamp_redemption'
        ?{id:requestId,quantity:5,status:'requested',mark_ids:[id]}
        :{id:requestId,quantity:5,status:name.includes('fulfill')?'fulfilled':'canceled'}
      return {data:error?null:output,error}
    },
    from:()=>({select(){return this},eq(){return this},
      maybeSingle:async()=>({data:existing?{id:bookId,space_id:spaceId,status:'active'}:null,error:null})}),
  }
  const stubs={
    'next/cache':{revalidatePath:()=>{}},
    '@/lib/auth/validation':{isUuid},
    '@/features/spaces/data':{
      getSpaceContext:async()=>({supabase,user:{id},member:{role:'member'},space:{id:spaceId}}),
    },
  }
  return {actions:compile(actions,stubs),calls}
}

test('M04 uses separate RLS-authorized redemption and exact stamp association ledgers',()=>{
  assert.match(sql,/CREATE TABLE public\.living_stamp_redemptions/)
  assert.match(sql,/CREATE TABLE public\.living_stamp_redemption_marks/)
  assert.match(sql,/UNIQUE\(book_id,requested_by,idempotency_key\)/)
  assert.match(sql,/UNIQUE\(id,book_id\)/)
  assert.match(sql,/REFERENCES public\.living_stamp_marks\(book_id,id\)/)
  assert.match(sql,/state IN\('available','peeled','reserved','redeemed'\)/)
  assert.match(sql,/living_stamp_marks_lifecycle_check/)
  assert.match(sql,/DROP CONSTRAINT living_stamp_marks_state_check/)
  assert.match(sql,/DROP CONSTRAINT living_stamp_events_event_type_check/)
  assert.match(sql,/event_type IN\('granted','transformed','peeled','reserved','redeemed','released'\)/)
  assert.match(sql,/ALTER TABLE public\.living_stamp_redemptions ENABLE ROW LEVEL SECURITY/)
  assert.match(sql,/ALTER TABLE public\.living_stamp_redemption_marks ENABLE ROW LEVEL SECURITY/)
  assert.match(sql,/REVOKE ALL ON TABLE public\.living_stamp_redemptions/)
  assert.match(sql,/GRANT SELECT ON TABLE public\.living_stamp_redemptions/)
  assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b|\bALTER TABLE public\.stamp_books\b/i)
})
test('M04 RPCs lock book and selected stamps, reserve atomically, and never auto-archive',()=>{
  const request=sql.slice(sql.indexOf('CREATE FUNCTION public.pointplus_request_living_stamp_redemption'),
    sql.indexOf('CREATE FUNCTION public.pointplus_fulfill_living_stamp_redemption'))
  assert.match(request,/FROM public\.living_books WHERE id=p_book FOR UPDATE/)
  assert.match(request,/state='available'/)
  assert.match(request,/ORDER BY s\.granted_at,s\.id/)
  assert.match(request,/LIMIT p_quantity/)
  assert.match(request,/FOR UPDATE/)
  assert.match(request,/v_count<>p_quantity/)
  assert.match(request,/state='reserved',redemption_id=v_redemption_id/)
  assert.match(request,/GET DIAGNOSTICS v_count=ROW_COUNT/)
  assert.match(request,/INSERT INTO public\.living_stamp_redemption_marks/)
  assert.match(request,/event_type,actor_user_id,details/)
  assert.match(request,/Idempotency key reused/)
  assert.match(request,/Only the receiving partner/)
  assert.doesNotMatch(sql,/pointplus_claim_couple_memory|UPDATE public\.living_books\s+SET status='archived'/)
  assert.match(sql,/CREATE FUNCTION public.pointplus_get_living_stamp_balance/)
  assert.match(sql,/count\(\*\) FILTER\(WHERE state='redeemed'\)/)
})
test('M04 transitions are final for fulfilled stamps and cancellation restores reserved only',()=>{
  const fulfill=sql.slice(sql.indexOf('CREATE FUNCTION public.pointplus_fulfill_living_stamp_redemption'),
    sql.indexOf('CREATE FUNCTION public.pointplus_cancel_living_stamp_redemption'))
  const cancel=sql.slice(sql.indexOf('CREATE FUNCTION public.pointplus_cancel_living_stamp_redemption'),
    sql.indexOf('CREATE FUNCTION public.pointplus_get_living_stamp_balance'))
  assert.match(fulfill,/v_book\.owner_user_id/)
  assert.match(fulfill,/state='redeemed',redeemed_at=now\(\)/)
  assert.match(fulfill,/v_request\.status='fulfilled'/)
  assert.match(fulfill,/event_type,actor_user_id,details/)
  assert.match(cancel,/v_book\.owner_user_id/)
  assert.match(cancel,/state='available',redemption_id=NULL,reserved_at=NULL/)
  assert.match(cancel,/v_request\.status='canceled'/)
  assert.match(cancel,/INSERT INTO public\.living_stamp_events/)
  assert.match(cancel,/FOR UPDATE/)
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.pointplus_request_living_stamp_redemption/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.pointplus_request_living_stamp_redemption/)
})
test('M04 UI lets recipient choose any valid quantity, enter free text and preview stamp artwork',()=>{
  assert.match(panel,/type="number" min="1"/)
  assert.match(panel,/max=\{Math\.max\(max,1\)\}/)
  assert.match(panel,/reward\.trim\(\)\.length>0/)
  assert.match(panel,/maxLength=\{2000\}/)
  assert.match(panel,/sample=candidates\.slice/)
  assert.match(panel,/stampArtwork\.get/)
  assert.match(panel,/requestLivingRedemption/)
  assert.match(panel,/fulfillLivingRedemption/)
  assert.match(panel,/cancelLivingRedemption/)
  assert.match(panel,/requested_quantity/)
  assert.match(panel,/living-redemption-history/)
  assert.match(panel,/canRequest&&isActive/)
  assert.match(panel,/canFulfill/)
  assert.match(data,/pointplus_get_living_stamp_balance/)
  assert.match(data,/living_stamp_redemption_marks/)
  assert.match(data,/state','available/)
  assert.match(page,/LivingRedemptionPanel/)
  assert.match(page,/canRequest=\{isRecipient\}/)
  assert.match(page,/canFulfill=\{owner\}/)
})
test('M04 shows permanently marked spent stamps and restricts transformations to available',()=>{
  assert.match(markModel,/state:'available'\|'reserved'\|'redeemed'\|'peeled'/)
  assert.match(overlay,/data-used=\{used\}/)
  assert.match(overlay,/data-reserved=\{reserved\}/)
  assert.match(overlay,/className="living-real-stamp__used"/)
  assert.match(overlay,/mark\?\.state==='available'&&canEdit/)
  assert.match(get('features/living-books/m03-actions.ts'),/pointplus_peel_living_stamp/)
})

test('request action submits exact chosen quantity and text only through atomic RPC',async()=>{
  const {actions,calls}=mocked()
  const result=await actions.requestLivingRedemption({
    spaceId,bookId,quantity:5,rewardMessage:'  A picnic together  ',idempotencyKey:key,
  })
  assert.equal(result.ok,true)
  assert.equal(result.data.quantity,5)
  assert.deepEqual(result.data.mark_ids,[id])
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_request_living_stamp_redemption')
  assert.deepEqual(calls[0].args,{p_book:bookId,p_quantity:5,
    p_reward_message:'A picnic together',p_key:key})
})
test('invalid quantities, empty reward, oversized reward and missing book are rejected',async()=>{
  const {actions,calls}=mocked()
  const invalids=[
    {quantity:0,rewardMessage:'valid'},
    {quantity:-1,rewardMessage:'valid'},
    {quantity:1.5,rewardMessage:'valid'},
    {quantity:2,rewardMessage:'  '},
    {quantity:1,rewardMessage:'x'.repeat(2001)},
  ]
  for(const bad of invalids){
    const result=await actions.requestLivingRedemption({
      spaceId,bookId,idempotencyKey:key,...bad,
    })
    assert.equal(result.ok,false)
  }
  assert.equal(calls.length,0)
  const absent=mocked({existing:false})
  assert.equal((await absent.actions.requestLivingRedemption({
    spaceId,bookId,quantity:1,rewardMessage:'test',idempotencyKey:key,
  })).ok,false)
  assert.equal(absent.calls.length,0)
})
test('owner fulfill/cancel actions call distinct versioned RPCs without changing book',async()=>{
  const {actions,calls}=mocked()
  assert.equal((await actions.fulfillLivingRedemption({
    spaceId,bookId,redemptionId:requestId,
  })).ok,true)
  assert.equal(calls[0].name,'pointplus_fulfill_living_stamp_redemption')
  assert.deepEqual(calls[0].args,{p_redemption:requestId})
  assert.equal((await actions.cancelLivingRedemption({
    spaceId,bookId,redemptionId:requestId,
  })).ok,true)
  assert.equal(calls[1].name,'pointplus_cancel_living_stamp_redemption')
  const conflict=mocked({error:{code:'40001'}})
  const result=await conflict.actions.fulfillLivingRedemption({
    spaceId,bookId,redemptionId:requestId,
  })
  assert.equal(result.ok,false)
  assert.equal(result.conflict,true)
})
