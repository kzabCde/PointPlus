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
 assert.match(read('features/stamp-books/journal.tsx'),/stampPage\(cycle\.target_snapshot, page\)/)
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
   getSpaceContext:async()=>({supabase:mock,member:{role:'owner'},space:{kind:'family'}}),
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

test('Couple Stamp Books: SQL allows both members to create a partner book and protects self-stamping',()=>{
 const couple=read('supabase/stamp-book-first/06_couple_mutual_books.sql')
 assert.match(couple,/s\.kind='couple' AND m\.user_id=v_uid/)
 assert.match(couple,/p_approval<>'direct'/)
 assert.match(couple,/partner\.user_id<>v_uid/)
 assert.match(couple,/partner\.id=p_recipients\[1\]/)
 assert.match(couple,/UNION SELECT v_uid WHERE v_kind='couple'/)
 assert.match(couple,/b\.created_by=v_uid/)
 assert.match(couple,/Self-stamping is not permitted/)
 assert.match(couple,/book_can_edit\(b\.id,v_uid\)/)
 assert.match(couple,/book_can_edit\(cl\.book_id,v_uid\)/)
 assert.doesNotMatch(couple,/\b(?:TRUNCATE|DROP TABLE|DELETE FROM)\b/i)
 assert.equal((couple.match(/^BEGIN;/gm)||[]).length,1)
 assert.equal((couple.match(/^COMMIT;/gm)||[]).length,1)
})

test('Couple Stamp Books: both partners see their shared progress and only creator edits',()=>{
 const couple=read('supabase/stamp-book-first/06_couple_mutual_books.sql')
 for(const name of [
  'stamp_book_recipients','stamp_book_cycles','stamp_book_stamp_requests',
  'stamp_book_marks','stamp_book_claims',
 ]) assert.match(couple,new RegExp('pointplus_couple_'+name+'_read'))
 assert.match(couple,/pointplus_private\.is_member\(space_id\)/)
 assert.match(couple,/s\.kind='couple'/)
 const data=read('features/stamp-books/data.ts')
 assert.match(data,/kind==='couple'&&p\.kind==='adult'/)
 assert.match(data,/readableParticipants\(people,user\.id,manager,context\.space\.kind\)/)
 assert.match(data,/book\.created_by===user\.id/)
 const board=read('app/(protected)/s/[spaceId]/stamp-books/page.tsx')
 assert.match(board,/context\.space\.kind\s*===\s*'couple'/)
 assert.match(board,/<BookShelf books=\{shelf\} cycles=\{cycles\} people=\{eligible\}/)
 assert.match(read('features/stamp-books/presentation.tsx'),/latest\.get\(person\.id\)/)
 const newPage=read('app/(protected)/s/[spaceId]/stamp-books/new/page.tsx')
 assert.match(newPage,/space\.kind!=='couple'&&!canManage\(member\.role\)/)
 const forms=read('features/stamp-books/forms.tsx')
 assert.match(forms,/p\.kind==='adult'&&p\.user_id!==userId/)
 assert.match(forms,/name="giver_id" value={userId}/)
 assert.match(forms,/name="approval_policy" value="direct"/)
 const actions=read('features/stamp-books/actions.ts')
 assert.match(actions,/space\.kind!=='couple'&&!canManage\(member\.role\)/)
 assert.match(actions,/book\.created_by!==user\.id/)
 const detail=read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx')
 assert.match(detail,/book\.created_by\s*===\s*context\.user\.id/)
 assert.match(detail,/ClaimStampRewardForm/)
})

test('Couple Stamp Books: partner recipient filtering is confined to Couple Rooms',()=>{
 const c=ts.transpileModule(read('features/stamp-books/data.ts'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  fileName:'features/stamp-books/data.ts',
 })
 const module={exports:{}}
 new Function('require','module','exports',c.outputText)(()=>{
  return {
   notFound(){throw new Error('not-found')},
   canManage(){return false},getSpaceContext(){},getSpaceParticipants(){},getSpaceMembers(){},
  }
 },module,module.exports)
 const both=[
  {id:'a',kind:'adult',user_id:'A',guardian_user_id:null},
  {id:'b',kind:'adult',user_id:'B',guardian_user_id:null},
  {id:'child',kind:'child',user_id:null,guardian_user_id:'A'},
 ]
 const filter=module.exports.readableParticipants
 assert.deepEqual(filter(both,'A',false,'couple').map(x=>x.id),['a','b','child'])
 assert.deepEqual(filter(both,'A',false,'group').map(x=>x.id),['a','child'])
 assert.deepEqual(filter(both,'B',false,'couple').map(x=>x.id),['a','b'])
})

test('Couple Memory final redemption is message-based, unique and archives original book',()=>{
 const sql=read('supabase/stamp-book-first/08_couple_memory_redemption.sql')
 assert.match(sql,/CREATE FUNCTION public\.pointplus_claim_couple_memory/)
 assert.match(sql,/v_text:=btrim\(coalesce\(p_message,''\)\)/)
 assert.match(sql,/length\(v_text\) NOT BETWEEN 1 AND 1000/)
 assert.match(sql,/pointplus_private\.book_can_claim/)
 assert.match(sql,/v_prior\.reward_title_snapshot=v_text/)
 assert.match(sql,/FOR UPDATE OF b/)
 assert.match(sql,/v_cycle\.completed_at IS NULL/)
 assert.match(sql,/UPDATE public\.stamp_books SET status='archived',repeatable=false/)
 assert.match(sql,/reward_title_snapshot,claimed_by,idempotency_key,status/)
 assert.match(sql,/pointplus_claim_stamp_book_reward/)
 assert.match(sql,/Couple memory rewards require a message/)
 assert.match(sql,/s\.kind='couple'/)
 assert.match(sql,/pointplus_private\.book_apply_stamp/)
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE TABLE|DELETE FROM/i)
})

test('Couple Memory form is free-text, recipient-only and does not require fixed reward options',()=>{
 const forms=read('features/stamp-books/forms.tsx')
 const actions=read('features/stamp-books/actions.ts')
 const detail=read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx')
 assert.match(forms,/export function ClaimCoupleMemoryForm/)
 assert.match(forms,/name="reward_message"/)
 assert.match(forms,/maxLength=\{1000\}/)
 assert.match(forms,/name="rewards" value="ข้อความรางวัล/)
 assert.match(actions,/export async function claimCoupleMemoryAction/)
 assert.match(actions,/pointplus_claim_couple_memory/)
 assert.match(actions,/p_message:message,p_key:key/)
 assert.match(detail,/context\.space\.kind\s*===\s*'couple'/)
 assert.match(detail,/ClaimCoupleMemoryForm/)
 assert.match(detail,/book\.status\s*===\s*'active'/)
 assert.match(detail,/book\.status\s*!==\s*'archived'/)
})

test('stamp feedback follows confirmed RPC outcomes', async () => {
 const form = new FormData()
 for (const [key, value] of Object.entries({
  space_id: space, book_id: uuid, recipient_id: person,
  asset_id: artId, idempotency_key: uuid,
 })) form.set(key, value)

 for (const [rpcStatus, expected] of [
  ['pending', { status: 'success', outcome: 'pending' }],
  ['approved', { status: 'success', outcome: 'granted' }],
  ['rejected', { status: 'success', outcome: 'rejected' }],
  ['unexpected', { status: 'error', outcome: undefined }],
 ]) {
  const actions = compiledActions({
   from: () => ({
    select() { return this },
    eq() { return this },
    async maybeSingle() { return { data: { id: uuid }, error: null } },
   }),
   rpc: async () => ({ data: { status: rpcStatus, request_id: uuid }, error: null }),
  })
  const { status, outcome, receipt } = await actions.giveStampAction({ status: 'idle', message: '' }, form)
  assert.deepEqual({ status, outcome }, expected, rpcStatus)
  assert.deepEqual(receipt, rpcStatus === 'approved' ? { kind: 'stamp', id: uuid } : undefined, rpcStatus)
 }
})
