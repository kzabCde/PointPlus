import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
const read = p => readFileSync(new URL('../' + p,import.meta.url),'utf8')
test('R01: staged non-destructive group proposal keeps personal and separate migration',()=>{
 const sql=read('supabase/proposals/room_first_group_kind.sql')
 assert.match(sql,/personal','couple','family','group/)
 assert.doesNotMatch(sql,/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i)
})
test('R02: lightweight room launcher replaces old all-space dashboard',()=>{
 assert.match(read('app/(protected)/dashboard/page.tsx'),/redirect\('\/rooms'\)/)
 assert.match(read('app/(protected)/rooms/page.tsx'),/listMyRooms\(\)/)
 assert.doesNotMatch(read('app/(protected)/rooms/page.tsx'),/loadDashboard|loadMissionBoard/)
})
test('R03: Room Home renders only room-local missions and protects membership',()=>{
 const page=read('app/(protected)/s/[spaceId]/page.tsx')
 assert.match(page,/getSpaceContext\(spaceId\)/)
 assert.match(page,/loadRoomActivityPreview\(spaceId/)
 assert.ok(existsSync(new URL('../app/(protected)/s/[spaceId]/collection/page.tsx',import.meta.url)))
})
test('R06: use official 18 stamp and 12 badge assets and only DB-backed earned state',()=>{
 const lib=read('lib/point-plus/assets.ts')
 assert.equal((lib.match(/"id": "(?:couple|family|personal)-/g)||[]).length,30)
 const col=read('app/(protected)/s/[spaceId]/collection/page.tsx')
 assert.match(col,/\.from\('participant_badges'\)/)
 assert.match(col,/\.from\('stamp_cycles'\)/)
 assert.match(col,/space.kind === 'couple' \? 'couple'/)
 assert.match(col,/space.kind === 'family' \? 'family' : 'personal'/)
})

test('R08: Room Home uses bounded per-Room queries and authorized Room resume',()=>{
 const home=read('features/rooms/data.ts')
 assert.match(home,/\.eq\('space_id',spaceId\)/)
 assert.match(home,/\.limit\(4\)/)
 assert.doesNotMatch(home,/loadDashboard/)
 const tracking=read('features/rooms/room-usage.tsx')
 assert.match(tracking,/rooms\.some\(room=>room\.id===saved\)/)
})

test('R05: quick activity creates mission via existing secure action and official stamp catalog',()=>{
 const s=read('features/missions/quick-form.tsx')
 assert.match(s,/createMissionAction/)
 assert.match(s,/name="status" value="active"/)
 assert.match(s,/name="space_id" value={spaceId}/)
 assert.match(s,/pointPlusStamps\.filter/)
 assert.match(s,/stampCards\.find\(c => c.active && c.image_key === s.id\)/)
 const page=read('app/(protected)/s/[spaceId]/missions/new/page.tsx')
 assert.match(page,/QuickMissionForm/)
 assert.match(page,/CreateMissionForm/)
})

test('R01 live RLS: Room creation avoids INSERT RETURNING before membership trigger',()=>{
 const s=read('features/spaces/actions.ts')
 assert.match(s,/import \{ randomUUID \} from 'node:crypto'/)
 assert.match(s,/const spaceId = randomUUID\(\)/)
 assert.match(s,/\.insert\(\{ id: spaceId, kind, name, timezone, owner_id: user\.id \}\)/)
 assert.doesNotMatch(s,/\.insert\(\{ kind, name, timezone, owner_id: user\.id \}\)\s*\.select\('id'\)/)
 assert.match(s,/spaceId \}/)
})

test('R01: createSpaceAction uses committed trigger model without INSERT RETURNING', async()=>{
 const spaceId = '33333333-3333-4333-8333-333333333333'
 const seen = []
 const profileQuery = {
   select(){ return this },eq(){ return this },
   async maybeSingle(){ return {data:{timezone:'Asia/Bangkok'},error:null} },
 }
 const supabase = {
   from(table){
     if(table === 'profiles') return profileQuery
     if(table !== 'spaces') throw new Error('Unexpected table '+table)
     return {
       async insert(row){ seen.push(row);return {error:null} },
       select(){ throw new Error('INSERT RETURNING must not be used for spaces') },
     }
   },
 }
 const compiled=ts.transpileModule(read('features/spaces/actions.ts'),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
   fileName:'features/spaces/actions.ts',
 })
 const module={exports:{}}
 const stubs={
   'node:crypto':{randomUUID:()=>spaceId},
   'next/cache':{revalidatePath:()=>{}},
   '@/lib/auth/validation':{
     field:(form,key)=>String(form.get(key)||'').trim(),
     allowedTimezone:tz=>tz==='Asia/Bangkok',
     isUuid:()=>true,
   },
   '@/lib/auth/session':{requireUser:async()=>({user:{id:'owner-id'},supabase})},
   './data':{getSpaceContext:async()=>{throw new Error('Unused')}},
 }
 new Function('require','module','exports',compiled.outputText)(
   id=>{if(!(id in stubs)) throw new Error('Unexpected import: '+id);return stubs[id]},
   module,module.exports,
 )
 const form=new FormData()
 form.set('kind','group')
 form.set('name','Friends')
 const action=module.exports.createSpaceAction
 const result=await action({status:'idle',message:''},form)
 assert.equal(result.status,'success')
 assert.equal(result.spaceId,spaceId)
 assert.deepEqual(seen,[{
   id:spaceId,kind:'group',name:'Friends',timezone:'Asia/Bangkok',owner_id:'owner-id',
 }])
})
