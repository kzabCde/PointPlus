import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const sql=read('supabase/stamp-book-first/17_living_stampbook_v3_m02_editor.sql')
const modelSrc=read('features/living-books/editor-model.ts')
const actionsSrc=read('features/living-books/editor-actions.ts')
const editor=read('features/living-books/paper-editor.tsx')
const manager=read('features/living-books/page-manager.tsx')
const detail=read('app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx')
const data=read('features/living-books/data.ts')
const id='11111111-1111-4111-8111-111111111111'
const room='22222222-2222-4222-8222-222222222222'
const bookId='33333333-3333-4333-8333-333333333333'
const pageId='44444444-4444-4444-8444-444444444444'
function compile(path,stubs={}){
  const code=ts.transpileModule(read(path),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
  }).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(
    name=>{if(!(name in stubs))throw Error('Unexpected import '+name);return stubs[name]},
    module,module.exports)
  return module.exports
}
const model=compile('features/living-books/editor-model.ts')
const textPayload={...model.textDefault}
const element={
  id,book_id:bookId,page_id:pageId,element_type:'text',payload:textPayload,
  position_x:.2,position_y:.3,width:.3,height:.15,rotation_deg:0,
  opacity:1,z_index:0,version:0,
}

test('M02 migration is additive, with one editor ledger and no finite page or stamp limits',()=>{
  assert.match(sql,/CREATE TABLE public\.living_book_elements/)
  assert.match(sql,/FOREIGN KEY \(book_id,page_id\)/)
  assert.match(sql,/REFERENCES public\.living_book_pages\(book_id,id\)/)
  assert.match(sql,/element_type IN \('text','drawing'\)/)
  assert.match(sql,/CHECK \(pointplus_private\.living_editor_payload_valid\(element_type,payload\)\)/)
  assert.match(sql,/CREATE INDEX living_book_elements_page_z_idx/)
  assert.doesNotMatch(sql,/target_count|target_snapshot|LIMIT 100|\bDROP TABLE\b|\bDELETE FROM\b|\bTRUNCATE\b/i)
  assert.match(sql,/COMMIT;\s*$/)
})
test('M02 protects all editor writes through authenticated owner-checked, optimistic RPCs',()=>{
  assert.match(sql,/ALTER TABLE public\.living_book_elements ENABLE ROW LEVEL SECURITY/)
  assert.match(sql,/REVOKE ALL ON TABLE public\.living_book_elements FROM PUBLIC, anon, authenticated/)
  assert.match(sql,/GRANT SELECT ON TABLE public\.living_book_elements TO authenticated/)
  assert.match(sql,/CREATE POLICY living_elements_room_member_read/)
  for(const name of ['pointplus_update_living_book_page','pointplus_save_living_book_element','pointplus_delete_living_book_element']){
    assert.match(sql,new RegExp('CREATE FUNCTION public\\.'+name+'\\('))
    assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+name+'\\('))
    assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+name+'\\('))
  }
  assert.match(sql,/v_book\.owner_user_id<>v_uid/)
  assert.match(sql,/v_book\.status<>'active'/)
  assert.match(sql,/m\.user_id=v_uid/)
  assert.match(sql,/IF v_element\.version<>p_expected_version/)
  assert.match(sql,/IF v_page\.version<>p_expected_version/)
  assert.match(sql,/USING ERRCODE='40001'/)
  assert.match(sql,/SET deleted_at=now\(\)|SET deleted_at=now\(\),version/)
  assert.match(sql,/p_type NOT IN \('text','drawing'\)/)
  assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE) ON TABLE public\.living_book_elements TO authenticated/)
})
test('paper editor validates text and vector paths instead of trusting full-page screenshots',()=>{
  assert.equal(model.validPayload('text',textPayload),true)
  assert.equal(model.validPayload('text',{...textPayload,fontSize:200}),false)
  assert.equal(model.validPayload('text',{...textPayload,color:'url(javascript:)'}),false)
  assert.equal(model.validPayload('text',{...textPayload,text:'x'.repeat(5001)}),false)
  assert.equal(model.validPayload('drawing',{color:'#ff0123',strokeWidth:4,points:[{x:0,y:0},{x:1,y:1}]}),true)
  assert.equal(model.validPayload('drawing',{color:'#ff0123',strokeWidth:4,points:[{x:0,y:0},{x:2,y:1}]}),false)
  assert.equal(model.validPayload('image',{src:'https://example.com/spy'},),false)
  const stroke=model.makeStrokeElement([{x:.2,y:.25},{x:.7,y:.8}], '#112233',5)
  assert.equal(stroke.position_x,.2)
  assert.equal(stroke.position_y,.25)
  assert.ok(Math.abs(stroke.width-.5)<1e-12)
  assert.ok(Math.abs(stroke.height-.55)<1e-12)
  assert.deepEqual(stroke.payload.points,[{x:0,y:0},{x:1,y:1}])
  assert.equal(model.validPayload('drawing',stroke.payload),true)
})
test('normalized geometry stays stable across responsive view sizes',()=>{
  assert.deepEqual(model.normalizePoint(250,100,{left:100,top:0,width:300,height:200}),{x:.5,y:.5})
  assert.deepEqual(model.normalizePoint(-100,1000,{left:0,top:0,width:300,height:200}),{x:0,y:1})
  assert.equal(model.normalizePoint(1,2,{left:0,top:0,width:0,height:100}),null)
  assert.equal(model.normalizeRotation(540),-180)
})
test('page reorder logic handles 100+ pages with stable UUIDs and no auto-generation',()=>{
  const pages=Array.from({length:120},(_,i)=>({id:'page-'+i,page_order:i+1}))
  const order=model.orderedPageIds(pages,'page-80',-1)
  assert.equal(order.length,120)
  assert.equal(order[79],'page-80')
  assert.equal(order[80],'page-79')
  assert.equal(model.orderedPageIds(pages,'page-0',-1),null)
  assert.equal(model.orderedPageIds(pages,'invalid',1),null)
  assert.match(data,/\.range\(offset,offset\+299\)/)
  assert.match(data,/if\(batch\.length<300\)break/)
  assert.match(manager,/AddLivingBookPageForm/)
  assert.match(manager,/reorderLivingPages/)
  assert.match(manager,/updateLivingPageSettings/)
  assert.match(manager,/living-page-thumbnails/)
  assert.match(manager,/page\.version/)
  assert.match(detail,/LivingPageManager/)
  assert.match(detail,/LivingPaperEditor/)
  assert.match(detail,/key=\{page\.id\}/)
})
test('editor tools provide independent text, vector pen, selection, eraser, pan, layers and zoom',()=>{
  assert.match(editor,/tool:'select'/)
  assert.match(editor,/tool:'pen'/)
  assert.match(editor,/tool:'eraser'/)
  assert.match(editor,/tool:'text'/)
  assert.match(editor,/tool:'hand'/)
  assert.match(editor,/onPointerDown=\{begin\}/)
  assert.match(editor,/onPointerCancel=\{cancel\}/)
  assert.match(editor,/makeStrokeElement/)
  assert.match(editor,/saveLivingElement/)
  assert.match(editor,/deleteLivingElement/)
  assert.match(editor,/patchSelected/)
  assert.match(editor,/onKeyDown=\{handleKey\}/)
  assert.match(editor,/type="range" min="-180" max="180"/)
  assert.match(editor,/aria-pressed=\{tool===item\.tool\}/)
})
function mockActions({owner=id,status='active',dbError=null}={}){
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},
      maybeSingle:async()=>({data:{id:bookId,owner_user_id:owner,status},error:null})}),
    rpc:async(name,args)=>{
      calls.push({name,args})
      return {data:dbError?null:{id,version:2,updated_at:'2026-11-21T00:00:00Z'},error:dbError}
    },
  }
  const mocked={
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{isUuid:v=>typeof v==='string'&&
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)},
    '@/features/spaces/data':{getSpaceContext:async()=>({
      supabase,user:{id},space:{kind:'couple'},member:{role:'owner'},
    })},
    './editor-model':model,
  }
  return {actions:compile('features/living-books/editor-actions.ts',mocked),calls}
}
test('owner save sends exact page UUID and version to one authoritative RPC',async()=>{
  const {actions,calls}=mockActions()
  const result=await actions.saveLivingElement({
    spaceId:room,bookId,pageId,element,expectedVersion:0,
  })
  assert.equal(result.ok,true)
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_save_living_book_element')
  assert.equal(calls[0].args.p_book,bookId)
  assert.equal(calls[0].args.p_page,pageId)
  assert.equal(calls[0].args.p_expected_version,0)
  assert.deepEqual(calls[0].args.p_payload,textPayload)
})
test('unauthorized actors, invalid payload and stale versions are rejected',async()=>{
  const invalid=mockActions()
  const form={spaceId:room,bookId,pageId,expectedVersion:0}
  assert.equal((await invalid.actions.saveLivingElement({
    ...form,element:{...element,payload:{...textPayload,color:'transparent'}},
  })).ok,false)
  assert.equal(invalid.calls.length,0)
  const denied=mockActions({owner:room})
  assert.equal((await denied.actions.saveLivingElement({...form,element})).ok,false)
  assert.equal(denied.calls.length,0)
  const conflict=mockActions({dbError:{code:'40001',message:'conflict'}})
  const failed=await conflict.actions.saveLivingElement({...form,element})
  assert.equal(failed.ok,false)
  assert.equal(failed.conflict,true)
  assert.equal(conflict.calls.length,1)
})
test('page settings and deletion enforce positive version and separate RPCs',async()=>{
  const {actions,calls}=mockActions()
  assert.equal((await actions.updateLivingPageSettings({
    spaceId:room,bookId,pageId,title:'New page',background:'kraft',expectedVersion:1,
  })).ok,true)
  assert.equal(calls[0].name,'pointplus_update_living_book_page')
  assert.equal(calls[0].args.p_expected_version,1)
  assert.equal((await actions.deleteLivingElement({
    spaceId:room,bookId,pageId,elementId:id,expectedVersion:1,
  })).ok,true)
  assert.equal(calls[1].name,'pointplus_delete_living_book_element')
  assert.equal((await actions.deleteLivingElement({
    spaceId:room,bookId,pageId,elementId:id,expectedVersion:0,
  })).ok,false)
  assert.equal(calls.length,2)
})
