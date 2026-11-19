import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync,existsSync } from 'node:fs'
import ts from 'typescript'

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const sql=read('supabase/stamp-book-first/01_stamp_books_proposal.sql')
const retire=read('supabase/stamp-book-first/02_retire_legacy_rpc_proposal.sql')
const art=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
const noSecrets=x=>!/(service_role|service_key|SUPABASE_SECRET_KEY)/i.test(x)
const uuid='11111111-1111-4111-8111-111111111111'
const person='22222222-2222-4222-8222-222222222222'
const space='33333333-3333-4333-8333-333333333333'
const artId='family-star'
const isUuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)

test('Stamp Book proposal has original 18 designs, no business logic or destructive rebuild',()=>{
 assert.equal(art.length,18)
 assert.equal(new Set(art.map(x=>x.id)).size,18)
 for(const a of art)assert.ok(sql.includes("'"+a.id+"'"),a.id)
 assert.equal((sql.match(/^BEGIN;/gm)||[]).length,1)
 assert.equal((sql.match(/^COMMIT;/gm)||[]).length,1)
 assert.doesNotMatch(sql,/\b(?:DROP TABLE|DELETE FROM|TRUNCATE TABLE)\b/i)
 assert.equal(noSecrets(sql),true)
})

test('new stamp and reward ledger is atomic, auditable and one claim per completed cycle',()=>{
 for(const table of [
 'stamp_books','stamp_book_recipients','stamp_book_givers','stamp_book_styles',
 'stamp_book_artworks','stamp_book_cycles','stamp_book_stamp_requests',
 'stamp_book_marks','stamp_book_reward_options','stamp_book_claims'
 ])assert.ok(sql.includes('CREATE TABLE public.'+table),table)
 assert.match(sql,/request_id uuid NOT NULL UNIQUE/)
 assert.match(sql,/cycle_id uuid NOT NULL UNIQUE/)
 assert.match(sql,/progress_count=progress_count\+1/)
 assert.match(sql,/FOR UPDATE/)
 assert.match(sql,/v_submission|book_apply_stamp/)
 assert.match(sql,/p_key uuid/)
 assert.match(sql,/book_can_claim/)
 assert.doesNotMatch(sql,/UPDATE public\.point_wallets|INSERT INTO public\.point_transactions/)
})

test('new RLS is scoped and direct client writes are revoked',()=>{
 assert.match(sql,/CREATE POLICY stamp_books_read[\s\S]*m\.space_id=stamp_books\.space_id/)
 assert.match(sql,/CREATE POLICY stamp_book_claims_read[\s\S]*connected\.space_id=stamp_book_claims\.space_id/)
 assert.match(sql,/CREATE POLICY stamp_book_recipients_read[\s\S]*g\.user_id=\(SELECT auth\.uid\(\)\)/)
 assert.match(sql,/REVOKE ALL ON TABLE public\.%I FROM PUBLIC,anon,authenticated/)
 assert.match(sql,/GRANT SELECT ON TABLE public\.%I TO authenticated/)
 assert.match(sql,/pointplus_review_stamp_request/)
 assert.match(sql,/req\.giver_user_id=v_uid/)
})

test('new UI contains book form, 18-style picker, giver dialog, slot stamps and reward claim',()=>{
 for(const p of [
 'app/(protected)/s/[spaceId]/stamp-books/page.tsx',
 'app/(protected)/s/[spaceId]/stamp-books/new/page.tsx',
 'app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx',
 'app/(protected)/s/[spaceId]/stamp-books/[bookId]/edit/page.tsx',
 'features/stamp-books/forms.tsx','features/stamp-books/actions.ts'
 ])assert.equal(existsSync(new URL('../'+p,import.meta.url)),true,p)
 const forms=read('features/stamp-books/forms.tsx')
 assert.match(forms,/pointPlusStamps\.map/)
 assert.match(forms,/GiveStampDialog/)
 assert.match(forms,/ClaimStampRewardForm/)
 assert.match(forms,/ProcessBookRewardForm/)
 assert.match(read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx'),/Array\.from\(\{length:current\.target_snapshot\}/)
 const layout=read('app/(protected)/s/[spaceId]/layout.tsx')
 assert.match(layout,/stamp-books/)
 assert.doesNotMatch(layout,/href=\{base\+'\/missions'\}/)
 const room=read('app/(protected)/s/[spaceId]/page.tsx')
 assert.match(room,/loadStampBookBoard/)
 assert.doesNotMatch(room,/loadRoomActivityPreview/)
})

test('old collection and Points storefront routes now redirect; legacy retirement staged, not executed',()=>{
 for(const x of ['collection','rewards','daily','shared','reviews','progress']){
  assert.match(read('app/(protected)/s/[spaceId]/'+x+'/page.tsx'),/redirect\('\/s\/'\+spaceId\+'\/stamp-books'\)/)
 }
 assert.match(retire,/pointplus_redeem_reward/)
 assert.match(retire,/pointplus_submit_mission/)
 assert.match(retire,/REVOKE ALL ON FUNCTION/)
 assert.match(retire,/stamp_book_marks/)
 assert.doesNotMatch(retire,/\b(?:DELETE FROM|DROP TABLE|TRUNCATE)\b/i)
})

function compiledActions(mock){
 const file='features/stamp-books/actions.ts'
 const compiled=ts.transpileModule(read(file),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  fileName:file,
 })
 const refs={
  'next/cache':{revalidatePath(){}},
  '@/lib/auth/validation':{field:(f,n)=>String(f.get(n)??'').trim(),isUuid},
  '@/features/spaces/data':{
   getSpaceContext:async()=>({supabase:mock,member:{role:'owner'}}),
   canManage:role=>role==='owner'||role==='admin',
  },
  '@/lib/point-plus/assets':{pointPlusStamps:art},
 }
 const module={exports:{}}
 new Function('require','module','exports',compiled.outputText)(
   name=>{if(!(name in refs))throw Error('Unexpected import '+name);return refs[name]},
   module,module.exports,
 )
 return module.exports
}
test('create Stamp Book action passes configured art/recipients/reward choices to one RPC',async()=>{
 const calls=[]
 const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:uuid,error:null}}}
 const actions=compiledActions(supabase)
 const f=new FormData()
 for(const [key,value] of Object.entries({
  space_id:space,title:'สมุดรักของเรา',description:'',target_count:'6',
  approval_policy:'direct',rewards:'ดูหนังด้วยกัน\nทำอาหารให้',
 }))f.set(key,value)
 f.append('recipient_id',person);f.append('giver_id',uuid)
 f.append('asset_id','couple-heart');f.append('asset_id',artId)
 f.set('repeatable','on')
 const result=await actions.createStampBookAction({status:'idle',message:''},f)
 assert.equal(result.status,'success')
 assert.equal(calls.length,1)
 assert.equal(calls[0].name,'pointplus_create_stamp_book')
 assert.deepEqual(calls[0].args.p_styles,['couple-heart',artId])
 assert.deepEqual(calls[0].args.p_rewards,['ดูหนังด้วยกัน','ทำอาหารให้'])
 assert.equal(calls[0].args.p_target,6)
})
test('invalid target never contacts DB',async()=>{
 let touched=false
 const actions=compiledActions({rpc:async()=>{touched=true}})
 const f=new FormData();f.set('space_id',space);f.set('target_count','0')
 const result=await actions.createStampBookAction({status:'idle',message:''},f)
 assert.equal(result.status,'error')
 assert.equal(touched,false)
})
test('a stamp action invokes only new, scoped one-stamp RPC',async()=>{
 const calls=[]
 const supabase={
  from:t=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:uuid},error:null}}}),
  rpc:async(name,args)=>{calls.push({name,args});return {data:{status:'approved'},error:null}},
 }
 const actions=compiledActions(supabase)
 const f=new FormData()
 for(const [key,value] of Object.entries({
  space_id:space,book_id:uuid,recipient_id:person,
  asset_id:artId,idempotency_key:uuid,note:'ขอบคุณ',
 }))f.set(key,value)
 const result=await actions.giveStampAction({status:'idle',message:''},f)
 assert.equal(result.status,'success')
 assert.equal(calls.length,1)
 assert.equal(calls[0].name,'pointplus_give_stamp')
 assert.equal(calls[0].args.p_key,uuid)
 assert.equal(calls[0].args.p_art,artId)
})
