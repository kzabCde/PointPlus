import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const sql=read('supabase/stamp-book-first/23_living_v3_stamp_cards.sql')
const actions=read('features/living-books/actions.ts')
const forms=read('features/living-books/forms.tsx')
const roomHome=read('app/(protected)/s/[spaceId]/page.tsx')
const cardBoard=read('features/living-books/card-board.tsx')
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const c='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const stamps=JSON.parse(read('assets/point-plus/manifest/stamps.json'))

function actionHarness(kind='couple',role='member',error=null){
 const calls=[]
 const context={
  space:{kind},member:{role},user:{id:a},
  supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:error?null:c,error}}}
 }
 const module={exports:{}}
 const js=ts.transpileModule(actions,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
 }}).outputText
 const stubs={
  'next/cache':{revalidatePath(){}},
  '@/lib/auth/validation':{
   field:(f,n)=>String(f.get(n)??'').trim(),
   isUuid:s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s),
  },
  '@/features/spaces/data':{getSpaceContext:async()=>context},
  '@/lib/point-plus/assets':{pointPlusStamps:stamps},
 }
 new Function('require','module','exports',js)(
  name=>{if(!(name in stubs))throw Error('unexpected import '+name);return stubs[name]},
  module,module.exports)
 return {actions:module.exports,calls}
}
function cardForm(target='6'){
 const form=new FormData()
 for(const [name,value] of Object.entries({
  space_id:a,recipient_id:b,title:'Shared card',description:'Small gestures',
  cover_asset_id:stamps[0].id,approval_policy:'direct',idempotency_key:c,
  target_count:target,reward_title:'A picnic together',
 }))form.set(name,value)
 return form
}
test('active creation UI uses only V3 actions; Room home no longer filters by legacy books',()=>{
 assert.match(roomHome,/loadLivingBookShelf/)
 assert.match(roomHome,/href={base\+'\/new'}/)
 assert.doesNotMatch(roomHome,/loadStampBookBoard/)
 assert.match(forms,/format==='card'/)
 assert.match(forms,/createLivingCardAction/)
 assert.doesNotMatch(forms,/CreateCoupleStampBookForm|CreateStampBookForm/)
 assert.match(read('features/living-books/shelf.tsx'),/book\.card/)
})
test('card action routes to V3 RPC, keeps idempotency and accepts Couple member',async()=>{
 const {actions:act,calls}=actionHarness()
 const result=await act.createLivingCardAction({},cardForm())
 assert.equal(result.status,'success')
 assert.equal(result.bookId,c)
 assert.equal(calls.length,1)
 assert.equal(calls[0].name,'pointplus_create_living_card')
 assert.equal(calls[0].args.p_target,6)
 assert.equal(calls[0].args.p_reward,'A picnic together')
 assert.equal(calls[0].args.p_key,c)
})
test('card creation refuses invalid target, missing reward, unauthorized Group member',async()=>{
 const invalid=actionHarness()
 assert.equal((await invalid.actions.createLivingCardAction({},cardForm('0'))).status,'error')
 assert.equal((await invalid.actions.createLivingCardAction({},cardForm('101'))).status,'error')
 const form=cardForm();form.set('reward_title','')
 assert.equal((await invalid.actions.createLivingCardAction({},form)).status,'error')
 assert.equal(invalid.calls.length,0)
 const group=actionHarness('group','member')
 assert.equal((await group.actions.createLivingCardAction({},cardForm())).status,'error')
 assert.equal(group.calls.length,0)
})
test('card DB schema uses read-only RLS, single-slot ledger and full reward gate',()=>{
 for(const required of [
  /CREATE TABLE public\.living_book_cards/,
  /ENABLE ROW LEVEL SECURITY/,
  /GRANT SELECT ON TABLE public\.living_book_cards TO authenticated/,
  /living_card_occupied_slot_unique/,
  /living_card_slot_guard/,
  /living_card_mark_guard/,
  /living_card_redemption_guard/,
  /pointplus_create_living_book\(/,
  /REVOKE ALL ON FUNCTION public\.pointplus_create_living_card/,
  /GRANT EXECUTE ON FUNCTION public\.pointplus_create_living_card/,
  /DROP INDEX IF EXISTS public\.living_books_one_open_direction/,
 ])assert.match(sql,required)
 assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i)
 assert.match(sql,/COMMIT;\s*$/)
 assert.match(cardBoard,/giveLivingStamp\(/)
 assert.match(cardBoard,/toFixed\(4\)/)
 assert.match(read('features/living-books/redemption-panel.tsx'),/requestedQuantity=card\?\.target_count\?\?quantity/)
})
