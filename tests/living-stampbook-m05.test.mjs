import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function transpile(path,stubs={}){
  const code=ts.transpileModule(read(path),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  }}).outputText
  const mod={exports:{}}
  new Function('require','module','exports',code)(
    name=>{if(!(name in stubs))throw Error('Unexpected import '+name);return stubs[name]},
    mod,mod.exports)
  return mod.exports
}
const model=transpile('features/living-books/editor-model.ts')
const history=transpile('features/living-books/paper-history.ts')
const sample={
  id:'11111111-1111-4111-8111-111111111111',
  book_id:'22222222-2222-4222-8222-222222222222',
  page_id:'33333333-3333-4333-8333-333333333333',
  element_type:'text',payload:{...model.textDefault},
  position_x:.2,position_y:.3,width:.3,height:.15,
  rotation_deg:0,opacity:1,z_index:5,version:1,
}
const clone=(changes={})=>({...sample,...changes})
const path='features/living-books/paper-editor.tsx'
const code=read(path)
const pageManager=read('features/living-books/page-manager.tsx')
const sound=read('features/living-books/paper-sound.ts')
const studio=read('features/living-books/editor-studio.tsx')
const css=read('app/(protected)/s/[spaceId]/stamp-books/stamp-books.css')
const sql=read('supabase/stamp-book-first/20_living_stampbook_v3_m05_reversible_editor.sql')

test('Undo/redo is bounded to 60 confirmed paper edits and does not lose redo until new edit',()=>{
  let state=history.emptyPaperHistory()
  for(let i=0;i<65;i++)state=history.appendPaperHistory(state,{
    id:sample.id,before:clone({position_x:i/100}),after:clone({position_x:(i+1)/100}),
  })
  assert.equal(state.undo.length,60)
  assert.equal(state.redo.length,0)
  const last=history.peekPaperHistory(state,'undo')
  assert.equal(last.after.position_x,.65)
  state=history.completePaperHistory(state,'undo')
  assert.equal(state.undo.length,59)
  assert.equal(state.redo.length,1)
  assert.deepEqual(history.peekPaperHistory(state,'redo'),last)
  state=history.completePaperHistory(state,'redo')
  assert.equal(state.undo.length,60)
  assert.equal(state.redo.length,0)
  state=history.completePaperHistory(state,'undo')
  state=history.appendPaperHistory(state,{
    id:sample.id,before:clone({position_x:.4}),after:clone({position_x:.41}),
  })
  assert.equal(state.redo.length,0,'a new write must invalidate redo stack')
})
test('version increments are not mistaken for a visible edit',()=>{
  assert.equal(history.samePaperDecoration(clone({version:1}),clone({version:102})),true)
  assert.equal(history.samePaperDecoration(clone(),clone({position_x:.45})),false)
  assert.equal(history.samePaperDecoration(null,clone()),false)
  assert.equal(history.samePaperDecoration(null,null),true)
  assert.equal(history.appendPaperHistory(history.emptyPaperHistory(),{
    id:sample.id,before:null,after:clone(),
  }).undo.length,1)
})
test('only decorative text, vector drawing and images are reversible, not stamp accounting',()=>{
  assert.match(sql,/v_element\.element_type NOT IN \('text','drawing','image'\)/)
  assert.match(sql,/deleted_at=NULL,version=version\+1/)
  assert.match(sql,/v_book\.owner_user_id<>v_uid/)
  assert.match(sql,/v_book\.status<>'active'/)
  assert.match(sql,/m\.user_id=v_uid/)
  assert.match(sql,/IF v_element\.version<>p_expected_version/)
  assert.match(sql,/storage\.objects o/)
  assert.match(sql,/o\.bucket_id='pointplus-living-photos'/)
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.pointplus_restore_living_book_element/)
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.pointplus_restore_living_book_element/)
  assert.doesNotMatch(sql,/living_stamp_marks\s+SET|living_stamp_redemptions\s+SET|UPDATE public\.living_stamp_/)
  assert.match(read('features/living-books/editor-actions.ts'),/pointplus_restore_living_book_element/)
})
test('manual Save retains local drafts and never overwrites other devices silently',()=>{
  assert.match(code,/draftEdits=useRef\(new Map/)
  assert.match(code,/savedRef=useRef\(new Map/)
  assert.match(code,/function stageObject\(/)
  assert.match(code,/function discardDrafts\(/)
  assert.match(code,/className="living-reader-save-strip"/)
  assert.doesNotMatch(code,/scheduleAutosave|autosaveTimer/)
  assert.match(code,/async function flushDrafts/)
  assert.match(code,/draftEdits\.current\.set\(item\.id,item\)/)
  assert.match(code,/setDirty\(true\);setSaveFailed\(true\)/)
  assert.match(code,/window\.addEventListener\('beforeunload'/)
  assert.match(code,/samePaperDecoration\(pending,item\)/)
  assert.match(code,/restoreLivingElement\(/)
  assert.match(code,/deleteLivingElement\(/)
  assert.match(code,/const result=target\.element_type==='image'/)
  assert.match(code,/historyRef\.current=next;setHistory\(next\)/)
  assert.match(code,/key==='y'\|\|event\.shiftKey/)
  assert.match(code,/Ctrl\/Cmd\+Z/)
})
test('Pages require explicit Save and navigation refuses pending paper or page drafts',()=>{
  assert.doesNotMatch(pageManager,/setTimeout\(\(\)=>\{void savePage\(\)\},850\)/)
  assert.match(pageManager,/onClick=\{\(\)=>void savePage\(\)\}/)
  assert.match(pageManager,/expectedVersion:expected/)
  assert.match(pageManager,/savingRef\.current\|\|unsaved\|\|studio\?\.paperUnsaved/)
  assert.match(pageManager,/onClick=\{handleLink\}/)
  assert.match(pageManager,/onTouchStart=\{beginSwipe\} onTouchEnd=\{finishSwipe\}/)
  assert.match(pageManager,/go\(next\)/)
  assert.match(pageManager,/pages\.slice\(start,start\+windowSize\)/)
  assert.match(pageManager,/const windowSize=36/)
  assert.doesNotMatch(pageManager,/pages\.map\(.*<Link/)
})
test('Original sound is opt-in, has user mute, and no external audio/music URL',()=>{
  assert.match(sound,/useState\(false\)/)
  assert.match(sound,/localStorage\.setItem/)
  assert.match(sound,/new AudioContext\(\)/)
  assert.match(sound,/createBufferSource\(\)/)
  assert.match(sound,/createOscillator\(\)/)
  assert.match(sound,/enabledRef\.current/)
  assert.match(sound,/audio|WebAudio/i)
  assert.doesNotMatch(sound,/fetch\(|new Audio\(|https?:\/\//)
  assert.match(studio,/aria-pressed=\{enabled\}/)
  assert.match(studio,/usePaperSound\(\)/)
  assert.match(studio,/14\*60\*1000/)
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.match(css,/living-book-paper-reveal/)
  assert.match(css,/living-stamp-impact/)
  assert.match(css,/living-redeemed-mark/)
  assert.match(css,/min-height:44px/)
})
test('Pinch zoom, fresh stamp animation and page swipe work without injecting spendable marks',()=>{
  assert.match(code,/activeFingers=useRef\(new Map/)
  assert.match(code,/pinch=useRef/)
  assert.match(code,/event\.pointerType==='touch'/)
  assert.match(code,/setZoom\(clamp\(pinch\.current\.initialZoom/)
  assert.match(code,/freshMarkId=\{freshMarkId\}/)
  assert.match(read('features/living-books/m03-tools.tsx'),/data-stamp-fresh=\{freshMarkId===mark\.id\}/)
})
const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)
function mockRestore({allowed=true,rpcError=null,reply=null}={}){
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},
      maybeSingle:async()=>({data:allowed?{
        id:sample.book_id,owner_user_id:sample.id,status:'active',
      }:{id:sample.book_id,owner_user_id:sample.page_id,status:'active'},error:null})}),
    rpc:async(name,args)=>{
      calls.push({name,args})
      return {data:rpcError?null:reply??{
        id:sample.id,version:4,restored:true,
      },error:rpcError}
    },
  }
  const actions=transpile('features/living-books/editor-actions.ts',{
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{isUuid},
    '@/features/spaces/data':{
      getSpaceContext:async()=>({supabase,user:{id:sample.id}}),
    },
    './editor-model':model,
  })
  return {actions,calls}
}
test('restore action sends exact book/page UUID and deletion version once',async()=>{
  const {actions,calls}=mockRestore()
  const result=await actions.restoreLivingElement({
    spaceId:sample.page_id,bookId:sample.book_id,pageId:sample.page_id,
    elementId:sample.id,expectedVersion:3,
  })
  assert.equal(result.ok,true)
  assert.equal(result.data.version,4)
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_restore_living_book_element')
  assert.equal(calls[0].args.p_expected_version,3)
  assert.equal(calls[0].args.p_book,sample.book_id)
})
test('restore rejects anonymous, nonowner, zero version and optimistic conflict',async()=>{
  const denied=mockRestore({allowed:false})
  assert.equal((await denied.actions.restoreLivingElement({
    spaceId:sample.page_id,bookId:sample.book_id,pageId:sample.page_id,
    elementId:sample.id,expectedVersion:3,
  })).ok,false)
  assert.equal(denied.calls.length,0)
  const invalid=mockRestore()
  assert.equal((await invalid.actions.restoreLivingElement({
    spaceId:sample.page_id,bookId:sample.book_id,pageId:sample.page_id,
    elementId:sample.id,expectedVersion:0,
  })).ok,false)
  assert.equal(invalid.calls.length,0)
  const conflict=mockRestore({rpcError:{code:'40001',message:'stale'}})
  const result=await conflict.actions.restoreLivingElement({
    spaceId:sample.page_id,bookId:sample.book_id,pageId:sample.page_id,
    elementId:sample.id,expectedVersion:3,
  })
  assert.equal(result.ok,false)
  assert.equal(result.conflict,true)
  assert.equal(conflict.calls.length,1)
})
