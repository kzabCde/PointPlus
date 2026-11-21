import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=read('supabase/stamp-book-first/16_living_stampbook_v3_m01.sql')
const actions=read('features/living-books/actions.ts')
const forms=read('features/living-books/forms.tsx')
const data=read('features/living-books/data.ts')
const newPage=read('app/(protected)/s/[spaceId]/stamp-books/new/page.tsx')
const library=read('app/(protected)/s/[spaceId]/stamp-books/page.tsx')
const id='11111111-1111-4111-8111-111111111111'
const room='22222222-2222-4222-8222-222222222222'
const recipient='33333333-3333-4333-8333-333333333333'
const key='44444444-4444-4444-8444-444444444444'
const assets=JSON.parse(read('assets/point-plus/manifest/stamps.json'))

test('M01 is additive: no finite cycle, stamp target, auto archive or mutation of Stamp Card ledgers',()=>{
  assert.match(sql,/CREATE TABLE public\.living_books/)
  assert.match(sql,/CREATE TABLE public\.living_book_pages/)
  assert.match(sql,/CREATE TABLE public\.living_book_givers/)
  assert.match(sql,/living_books_one_open_direction/)
  assert.match(sql,/living_book_pages_order_unique/)
  assert.match(sql,/living_book_pages_idempotency_unique/)
  assert.doesNotMatch(sql,/CREATE TABLE public\.living_book_cycles/)
  assert.doesNotMatch(sql,/target_count|target_snapshot|auto_archive\s*=\s*true/i)
  assert.doesNotMatch(sql,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b|\bALTER TABLE public\.stamp_books\b/i)
  assert.match(sql,/COMMIT;\s*$/)
})
test('M01 enforces RLS and read-only exposed tables, permission checked RPCs',()=>{
  for(const table of ['living_books','living_book_pages','living_book_givers']){
    assert.match(sql,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY'))
  }
  assert.match(sql,/REVOKE ALL ON TABLE public\.living_books/)
  assert.match(sql,/GRANT SELECT ON TABLE public\.living_books/)
  for(const fn of [
    'pointplus_create_living_book',
    'pointplus_add_living_book_page',
    'pointplus_reorder_living_book_pages',
    'pointplus_get_living_book_summary',
  ]){
    assert.match(sql,new RegExp('CREATE FUNCTION public\\.'+fn+'\\('))
    assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+fn+'\\('))
    assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+fn+'\\('))
  }
  assert.match(sql,/m\.user_id=v_uid/)
  assert.match(sql,/v_book\.owner_user_id <> v_uid/)
  assert.match(sql,/recipient.*room member/i)
  assert.match(sql,/SECURITY INVOKER SET search_path = ''/)
})
test('M01 always creates exactly one initial page and adds new pages only through owner-checked RPC',()=>{
  const creation=sql.slice(sql.indexOf('CREATE FUNCTION public.pointplus_create_living_book('),
    sql.indexOf('CREATE FUNCTION public.pointplus_add_living_book_page('))
  assert.match(creation,/INSERT INTO public\.living_books\(/)
  assert.match(creation,/INSERT INTO public\.living_book_pages\(/)
  assert.match(creation,/VALUES\(v_book,p_space,1,NULL,'cream',v_uid,p_key\)/)
  assert.equal((creation.match(/INSERT INTO public\.living_book_pages\(/g)||[]).length,1)
  const page=sql.slice(sql.indexOf('CREATE FUNCTION public.pointplus_add_living_book_page('),
    sql.indexOf('CREATE FUNCTION public.pointplus_reorder_living_book_pages('))
  assert.match(page,/v_book\.owner_user_id <> v_uid/)
  assert.match(page,/v_book\.status <> 'active'/)
  assert.match(page,/WHERE book_id=p_book AND client_key=p_key/)
  assert.match(page,/coalesce\(max\(page_order\),0\)\+1/)
  assert.doesNotMatch(page,/BETWEEN 0 AND 99|count\(\) *>= *100|LIMIT 100/)
})
test('page reorder requires exactly the existing book pages and serializes with adds',()=>{
  assert.match(sql,/FOR UPDATE;/)
  assert.match(sql,/cardinality\(p_page_ids\) <> v_count/)
  assert.match(sql,/count\(DISTINCT id\)/)
  assert.match(sql,/SET CONSTRAINTS public\.living_book_pages_order_unique DEFERRED/)
  assert.match(sql,/FROM unnest\(p_page_ids\) WITH ORDINALITY/)
})
test('Living-only creation and library contain no legacy Stamp Card option',()=>{
  assert.doesNotMatch(forms,/CollectionCreationChoice|CreateCoupleStampBookForm|CreateStampBookForm|cardOnly/)
  assert.match(forms,/name="idempotency_key"/)
  assert.match(forms,/CreateLivingBookForm/)
  assert.match(forms,/AddLivingBookPageForm/)
  assert.match(newPage,/CreateLivingBookForm/)
  assert.match(library,/LivingBookShelf/)
  assert.doesNotMatch(library,/loadStampBookBoard|BookShelf[^a-zA-Z]|การ์ดสะสมเดิม/)
  assert.match(data,/pointplus_get_living_book_summary/)
})
function mockActions({role='member',kind='couple',owner=id,status='active'}={}){
  const calls=[]
  const supabase={
    rpc:async(name,args)=>{
      calls.push({name,args})
      return {data:id,error:null}
    },
    from:()=>({
      select(){return this},eq(){return this},
      maybeSingle:async()=>({data:{id,owner_user_id:owner,status},error:null}),
    }),
  }
  const stubs={
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{
      field:(f,name)=>String(f.get(name)??'').trim(),
      isUuid:v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v),
    },
    '@/features/spaces/data':{
      getSpaceContext:async()=>({supabase,member:{role},space:{kind},user:{id}}),
    },
    '@/lib/point-plus/assets':{pointPlusStamps:assets},
  }
  const transpiled=ts.transpileModule(actions,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText
  const mod={exports:{}}
  new Function('require','module','exports',transpiled)(
    name=>{if(!(name in stubs))throw Error('Unexpected import '+name);return stubs[name]},
    mod,mod.exports)
  return {actions:mod.exports,calls}
}
test('Couple member creation calls only versioned Living Book RPC, no finite target',async()=>{
  const {actions:act,calls}=mockActions()
  const form=new FormData()
  for(const [k,v] of Object.entries({
    space_id:room,recipient_id:recipient,title:'Our Memories',
    description:'Together',cover_asset_id:assets[0].id,
    approval_policy:'direct',idempotency_key:key,
  }))form.set(k,v)
  const result=await act.createLivingBookAction({status:'idle',message:''},form)
  assert.equal(result.status,'success')
  assert.equal(result.bookId,id)
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_create_living_book')
  assert.equal(calls[0].args.p_recipient,recipient)
  assert.equal(calls[0].args.p_key,key)
  assert.ok(!('p_target' in calls[0].args))
})
test('Non-admin Group member is not allowed to create',async()=>{
  const {actions:act,calls}=mockActions({kind:'group',role:'member'})
  const form=new FormData()
  for(const [k,v] of Object.entries({
    space_id:room,recipient_id:recipient,title:'Test',
    cover_asset_id:assets[0].id,approval_policy:'direct',idempotency_key:key,
  }))form.set(k,v)
  assert.equal((await act.createLivingBookAction({},form)).status,'error')
  assert.equal(calls.length,0)
})
test('Only the book owner can manually add a page',async()=>{
  const {actions:act,calls}=mockActions({owner:recipient})
  const form=new FormData()
  for(const [k,v] of Object.entries({
    space_id:room,book_id:id,idempotency_key:key,background_style:'cream',title:'Page',
  }))form.set(k,v)
  assert.equal((await act.addLivingBookPageAction({},form)).status,'error')
  assert.equal(calls.length,0)
  const permitted=mockActions({owner:id})
  const done=await permitted.actions.addLivingBookPageAction({},form)
  assert.equal(done.status,'success')
  assert.equal(permitted.calls[0].name,'pointplus_add_living_book_page')
  assert.equal(permitted.calls[0].args.p_key,key)
})
