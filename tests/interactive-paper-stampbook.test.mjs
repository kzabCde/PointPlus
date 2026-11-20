import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const code = ts.transpileModule(read('features/stamp-books/paper-model.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function('exports', code)(module.exports)
const { paperPageCount, legacyPaperPosition, normalizedPaperPosition, deterministicRotation,
  normalizeStampRotation, clampStampScale, stampGestureTransform } = module.exports

test('a sheet has one page, a notebook preserves six-stamp historical paging', () => {
  assert.equal(paperPageCount(1, 'single_sheet'), 1)
  assert.equal(paperPageCount(100, 'single_sheet'), 1)
  assert.equal(paperPageCount(6, 'notebook'), 1)
  assert.equal(paperPageCount(7, 'notebook'), 2)
  assert.equal(paperPageCount(100, 'notebook'), 17)
})
test('positions are stable, deterministic and within the page', () => {
  assert.deepEqual(legacyPaperPosition(0), legacyPaperPosition(0))
  assert.equal(legacyPaperPosition(6).pageIndex, 1)
  assert.ok(legacyPaperPosition(8).x > 0)
  assert.ok(legacyPaperPosition(8).x < 1)
  assert.equal(deterministicRotation(.23,.72), deterministicRotation(.23,.72))
})
test('normalizes pointer positions across screen sizes, allowing placement at paper edges', () => {
  const mobile = normalizedPaperPosition(200,300,{left:100,top:100,width:200,height:400})
  const desktop = normalizedPaperPosition(400,600,{left:200,top:200,width:400,height:800})
  assert.deepEqual(mobile, desktop)
  assert.deepEqual(mobile, {x:.5,y:.5})
  assert.deepEqual(normalizedPaperPosition(-20,-10,{left:0,top:0,width:300,height:300}),{x:0,y:0})
  assert.equal(normalizedPaperPosition(5,5,{left:0,top:0,width:0,height:300}),null)
})
test('full-circle rotation and per-stamp scale are deterministic and bounded', () => {
  assert.equal(normalizeStampRotation(180), -180)
  assert.equal(normalizeStampRotation(-181), 179)
  assert.equal(normalizeStampRotation(720 + 37), 37)
  assert.equal(normalizeStampRotation(-760), -40)
  assert.equal(clampStampScale(.1), .4)
  assert.equal(clampStampScale(3), 2.5)
  assert.equal(clampStampScale(1.3), 1.3)
  const twist=stampGestureTransform({ distance:100, angle:0, scale:1, rotation:170 },
    {distance:175,angle:Math.PI/2})
  assert.equal(twist.scale,1.75)
  assert.equal(twist.rotation,-100)
  assert.deepEqual(stampGestureTransform({distance:0,angle:0,scale:1,rotation:0},
    {distance:100,angle:Math.PI}),{scale:1,rotation:0})
})
test('new additive SQL supports persisted scale and 360-degree orientation without replacing ledgers', () => {
  const sql=read('supabase/stamp-book-first/13_free_transform_stamp_sound.sql')
  assert.match(sql,/pointplus_give_stamp_freely/)
  assert.match(sql,/scale_factor numeric/)
  assert.match(sql,/rotation_deg BETWEEN -180 AND 180/)
  assert.match(sql,/p_rotation NOT BETWEEN -180 AND 180/)
  assert.match(sql,/p_scale NOT BETWEEN 0\\.4 AND 2\\.5/)
  assert.match(sql,/v_prior\\.scale_factor IS DISTINCT FROM p_scale/)
  assert.match(sql,/UPDATE public\\.stamp_book_marks/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\\.pointplus_give_stamp_freely/)
  assert.doesNotMatch(sql,/\\bTRUNCATE\\b|\\bDROP TABLE\\b|\\bDELETE FROM\\b/i)
})
test('sound is controlled, generated locally and cannot break stamp writes', () => {
  const sound=read('features/stamp-books/sound.tsx')
  assert.match(sound,/AudioContext/)
  assert.match(sound,/window\\.localStorage/)
  assert.match(sound,/BookSoundControls/)
  assert.match(sound,/ctx\\.createOscillator/)
  assert.match(sound,/ctx\\.createBuffer/)
  const page=read('app/(protected)/s/[spaceId]/stamp-books/[bookId]/page.tsx')
  assert.match(page,/BookSoundProvider/)
  assert.match(page,/BookSoundControls/)
  const paper=read('features/stamp-books/paper.tsx')
  assert.match(paper,/stampGestureTransform/)
  assert.match(paper,/scale_factor/)
  assert.match(paper,/onPointerCancel=\\{cancelPointer\\}/)
  assert.match(paper,/playSound\\?\\.\\('stamp'\\)/)
})
test('new RPCs preserve old contracts and copy approved request positions', () => {
  const sql=read('supabase/stamp-book-first/12_interactive_paper_stampbook.sql')
  assert.match(sql,/pointplus_give_stamp_at/)
  assert.match(sql,/pointplus_create_paper_stamp_book/)
  assert.match(sql,/pointplus_private\.book_copy_paper_position/)
  assert.match(sql,/public\.pointplus_give_stamp\(p_book, p_recipient, p_art, p_note, p_key\)/)
  assert.match(sql,/p_key uuid/)
  assert.match(sql,/rotation_deg/)
  assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM\b/i)
})
test('new UI uses pointer placement and original approval and claim actions', () => {
  const paper=read('features/stamp-books/paper.tsx')
  assert.match(paper,/onPointerDown=\{pointerDown\}/)
  assert.match(paper,/onPointerUp=\{pointerUp\}/)
  assert.match(paper,/crypto\.randomUUID\(\)/)
  assert.match(paper,/useBookAction\(giveStampAction\)/)
  const journal=read('features/stamp-books/journal.tsx')
  assert.match(journal,/StampPaper/)
  assert.match(journal,/rewardContent\[cycle\.id\]/)
  const actions=read('features/stamp-books/actions.ts')
  assert.match(actions,/pointplus_give_stamp_at/)
  assert.match(actions,/pointplus_claim_couple_memory/)
})

const sampleId='11111111-1111-4111-8111-111111111111'
const personId='22222222-2222-4222-8222-222222222222'
const spaceId='33333333-3333-4333-8333-333333333333'
const artworks=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
function compiledStampActions(supabase) {
  const compiled=ts.transpileModule(read('features/stamp-books/actions.ts'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop:true},
  })
  const refs={
    'next/cache':{ revalidatePath(){} },
    '@/lib/auth/validation':{
      field:(f,n)=>String(f.get(n)??'').trim(),
      isUuid:value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value),
    },
    '@/features/spaces/data':{
      getSpaceContext:async()=>({supabase,member:{role:'owner'},space:{kind:'couple'}}),
      canManage:role=>role==='owner'||role==='admin',
    },
    '@/lib/point-plus/assets':{ pointPlusStamps: artworks },
  }
  const module={exports:{}}
  new Function('require','module','exports',compiled.outputText)(
    name=>{ if (!(name in refs)) throw Error('Unexpected import '+name); return refs[name] },
    module,module.exports,
  )
  return module.exports
}
function stampForm() {
  const f=new FormData()
  for(const [key,value] of Object.entries({
    space_id:spaceId,book_id:sampleId,recipient_id:personId,
    asset_id:artworks[0].id,idempotency_key:sampleId,note:'',page_index:'1',
    position_x:'0.25',position_y:'0.7',rotation_deg:'-2',
  })) f.set(key,value)
  return f
}
test('valid paper tap calls only the versioned placement RPC with exact coordinates',async()=>{
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:sampleId},error:null}}}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:{status:'approved',request_id:sampleId},error:null}},
  }
  const result=await compiledStampActions(supabase).giveStampAction({status:'idle',message:''},stampForm())
  assert.equal(result.status,'success')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_give_stamp_at')
  assert.equal(calls[0].args.p_page,1)
  assert.equal(calls[0].args.p_x,.25)
  assert.equal(calls[0].args.p_y,.7)
  assert.equal(calls[0].args.p_rotation,-2)
})
test('incomplete, NaN, or out-of-bounds positions are blocked before any RPC',async()=>{
  let calls=0
  const actions=compiledStampActions({rpc:async()=>{calls++}})
  for(const field of ['missing','nan','beyond']) {
    const f=stampForm()
    if(field==='missing')f.delete('position_y')
    if(field==='nan')f.set('position_y','NaN')
    if(field==='beyond')f.set('position_x','1.5')
    assert.equal((await actions.giveStampAction({status:'idle',message:''},f)).status,'error')
  }
  assert.equal(calls,0)
})
test('paper creation invokes versioned creator without losing recipient and artwork choices',async()=>{
  const calls=[]
  const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:sampleId,error:null}}}
  const f=new FormData()
  for(const [key,value] of Object.entries({
    space_id:spaceId,title:'สมุดของเรา',description:'',target_count:'6',
    approval_policy:'direct',rewards:'ข้อความความทรงจำ',layout_mode:'single_sheet',
  }))f.set(key,value)
  f.append('recipient_id',personId)
  f.append('giver_id',sampleId)
  f.append('asset_id',artworks[0].id)
  const result=await compiledStampActions(supabase).createStampBookAction({status:'idle',message:''},f)
  assert.equal(result.status,'success')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_create_paper_stamp_book')
  assert.equal(calls[0].args.p_layout,'single_sheet')
  assert.deepEqual(calls[0].args.p_styles,[artworks[0].id])
})

test('scale and rotation are passed to the server in one authoritative action',async()=>{
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:sampleId},error:null}}}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:{status:'approved',request_id:sampleId},error:null}},
  }
  const actions=compiledStampActions(supabase)
  const f=stampForm()
  f.set('scale_factor','2.25')
  f.set('rotation_deg','-167')
  const result=await actions.giveStampAction({status:'idle',message:''},f)
  assert.equal(result.status,'success')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_give_stamp_freely')
  assert.equal(calls[0].args.p_scale,2.25)
  assert.equal(calls[0].args.p_rotation,-167)
  assert.equal(calls[0].args.p_x,.25)
  assert.equal(calls[0].args.p_y,.7)
})
test('server rejects invalid scale, partial placement or rotation greater than full circle',async()=>{
  let calls=0
  const actions=compiledStampActions({rpc:async()=>{calls++}})
  const forms=[
    {scale_factor:'0.39'},
    {scale_factor:'2.51'},
    {scale_factor:'NaN'},
    {scale_factor:'1',position_x:'NaN'},
    {scale_factor:'1',rotation_deg:'181'},
  ]
  for(const changes of forms){
    const f=stampForm()
    for(const [k,v] of Object.entries(changes))f.set(k,v)
    assert.equal((await actions.giveStampAction({status:'idle',message:''},f)).status,'error')
  }
  assert.equal(calls,0)
})
