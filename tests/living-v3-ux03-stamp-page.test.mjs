import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function load(path,stubs={}){
 const source=ts.transpileModule(read(path),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
 }}).outputText
 const module={exports:{}}
 new Function('require','module','exports',source)(
  name=>{if(!(name in stubs))throw Error('Unknown module '+name);return stubs[name]},
  module,module.exports)
 return module.exports
}
const model=load('features/living-books/editor-model.ts')
const stampModel={
 validPlacement:(x,y,angle,scale)=>[x,y,angle,scale].every(Number.isFinite)&&
  x>=0&&x<=1&&y>=0&&y<=1&&angle>=-180&&angle<=180&&scale>=.3&&scale<=3,
}
const gestures=load('features/living-books/stamp-gesture.ts',{
 './editor-model':model,'./stamp-model':stampModel,
})
const tools=read('features/living-books/m03-tools.tsx')
const paper=read('features/living-books/paper-editor.tsx')
const pages=read('features/living-books/page-manager.tsx')
const css=read('app/(protected)/s/[spaceId]/stamp-books/stamp-books.css')
const sql=read('supabase/stamp-book-first/18_living_stampbook_v3_m03_photos_stamps.sql')

test('A preview is not a spendable stamp; translation/rotation/scale are purely local',()=>{
 const before={artId:'heart',x:.5,y:.5,rotation:0,scale:1}
 const moved=gestures.moveStampDraft(before,100,-80,{width:1000,height:800})
 assert.deepEqual(moved,{...before,x:.6,y:.4})
 assert.equal(moved.id,undefined)
 assert.equal(moved.state,undefined)
 assert.equal(moved.request_id,undefined)
 assert.deepEqual(gestures.moveStampDraft(before,0,0,{width:0,height:800}),before)
 const rotated=gestures.rotateStampDraft({...before,rotation:170},45)
 assert.equal(rotated.rotation,-145)
 const larger=gestures.scaleStampDraft(before,1.25)
 assert.equal(larger.scale,1.25)
 assert.equal(gestures.scaleStampDraft(before,100).scale,3)
 assert.equal(gestures.scaleStampDraft(before,.01).scale,.3)
 assert.equal(gestures.stampDraftValid(larger),true)
 assert.equal(gestures.stampDraftValid({...before,scale:4}),false)
 assert.equal(gestures.stampDraftValid({...before,x:-.1}),false)
 assert.equal(gestures.stampDraftValid({...before,artId:''}),false)
})
test('Stable page UUIDs reorder predictably without duplicates',()=>{
 const ids=['a','b','c','d']
 assert.deepEqual(gestures.reorderPageIds(ids,'a','c'),['b','c','a','d'])
 assert.deepEqual(gestures.reorderPageIds(ids,'d','b'),['a','d','b','c'])
 assert.equal(gestures.reorderPageIds(ids,'a','a'),null)
 assert.equal(gestures.reorderPageIds(ids,'unrelated','a'),null)
 assert.deepEqual(ids,['a','b','c','d'])
})
test('Visual stamp tray chooses artwork before a tap, creates only an unissued preview',()=>{
 for(const code of [
  'className="living-stamp-art-grid"','pointPlusStamps.map(art=><button',
  'onSelectArtwork(art.id);onBeginPlacement()',
  "data-stamp-preview=\"true\" data-unissued=\"true\"",
  'className="living-stamp-preview-watermark"',
  'className="living-stamp-preview-handles"',
  "gesture.current={mode:'stamp-preview-move'",
  "moveStampDraft(g.originalStampPreview",
  'rotateStampDraft(d,15)','scaleStampDraft(d,1.1)',
  'onPreviewChange={next=>{if(!stampAttempted)',
  'setStampPanelOpen(false);setToolsOpen(false)'
 ])assert.ok((code.includes('pointPlusStamps')?tools:paper).includes(code)||
   (code==='className="living-stamp-art-grid"'&&tools.includes(code)),
  'missing feature '+code)
})
test('Issuance is one explicit confirmation via existing authorized RPC and stable retry key',()=>{
 assert.match(tools,/const inFlight=useRef\(false\)/)
 assert.match(tools,/if\(inFlight\.current\|\|!canGive\|\|!preview\|\|!key\|\|!stampDraftValid\(preview\)\)return/)
 assert.match(tools,/setAttempted\(true\);onPlacementAttempt\(\)/)
 assert.match(tools,/giveLivingStamp\(\{/)
 assert.match(tools,/assetId:preview\.artId,note,key/)
 assert.match(tools,/x:preview\.x,y:preview\.y,rotation:preview\.rotation,scale:preview\.scale/)
 assert.match(tools,/setKey\(crypto\.randomUUID\(\)\);setAttempted\(false\)/)
 assert.match(tools,/retry with the SAME idempotency key/)
 assert.match(tools,/ลองยืนยันคำขอเดิม/)
 assert.match(tools,/ยืนยันประทับแสตมป์/)
 assert.match(paper,/onPlacementAttempt=\{\(\)=>setStampAttempted\(true\)\}/)
 assert.match(paper,/if\(!stampAttempted\)/)
 assert.match(sql,/p_key uuid/)
 assert.match(sql,/living_stamp_requests_book_id_idempotency_key_key/)
 assert.doesNotMatch(read('features/living-books/stamp-gesture.ts'),
  /giveLivingStamp|peelLivingStamp|living_stamp_marks.*INSERT/)
})
test('Peeling is owner-only, available-only, requires fresh consent and retains audit',()=>{
 assert.match(tools,/const selectedIsEditable=mark\?\.state==='available'&&canEdit/)
 assert.match(tools,/setPeelPromptOpen\(value=>!value\);setConfirmPeel\(false\)/)
 assert.match(tools,/checked=\{confirmPeel\}/)
 assert.match(tools,/disabled=\{busy\|\|!confirmPeel\}/)
 assert.match(tools,/mark\.state!=='available'\|\|inFlight\.current\|\|!peelPromptOpen\|\|!confirmPeel/)
 assert.match(tools,/peelLivingStamp\(\{/)
 assert.match(tools,/expectedVersion:mark\.version/)
 assert.match(sql,/peeled_at=now\(\),peeled_by=v_uid/)
 assert.match(sql,/INSERT INTO public\.living_stamp_events/)
 assert.match(tools,/reviewLivingStamp\(\{/)
 assert.match(tools,/cancelLivingStampRequest\(\{/)
 assert.match(tools,/canReview&&r\.giver_user_id!==userId/)
})
test('Page turns are edge-only, deliberate and refuse unsaved previews',()=>{
 assert.match(paper,/className="living-page-edge-actions"/)
 assert.match(paper,/data-living-page-edge=\{side\}/)
 assert.match(paper,/onTouchStart=\{event=>/)
 assert.match(paper,/onTouchEnd=\{event=>/)
 assert.match(paper,/Math\.abs\(dx\)>=70/)
 assert.match(paper,/Math\.abs\(dy\)<Math\.abs\(dx\)\*\.55/)
 assert.match(paper,/stampPreview\|\|selected\|\|selectedStampId\|\|busy\|\|dirty/)
 assert.match(paper,/studio\?\.setPaperUnsaved\(dirty\|\|busy\|\|!!stampPreview\)/)
 assert.match(paper,/pointplus:living-page-turn/)
 assert.match(pages,/window\.addEventListener\('pointplus:living-page-turn',turn\)/)
 assert.match(pages,/custom\.detail\?\.pageId!==page\.id/)
 assert.match(pages,/pageTurnPending\.current/)
 assert.match(pages,/studio\?\.paperUnsaved/)
 assert.match(pages,/if\(!canNavigate\(\)\)event\.preventDefault\(\)/)
})
test('Folded corner creates exactly one page with pre-existing idempotent form',()=>{
 assert.match(pages,/current===pages\.length-1/)
 assert.match(pages,/className="living-reader-page-corner"/)
 assert.match(pages,/form\.requestSubmit\(\)/)
 assert.match(pages,/if\(!canNavigate\(\)\)return/)
 assert.match(read('features/living-books/forms.tsx'),/name="idempotency_key"/)
 assert.match(read('features/living-books/forms.tsx'),/addLivingBookPageAction/)
 assert.match(read('features/living-books/page-manager.tsx'),/AddLivingBookPageForm/)
})
test('Page overview thumbnails drag-reorder while preserving keyboard/button alternatives',()=>{
 assert.match(pages,/reorderPageIds\(pages\.map\(p=>p\.id\),fromId,toId\)/)
 assert.match(pages,/reorderLivingPages\(\{spaceId,bookId,pageIds:ids\}\)/)
 assert.match(pages,/onDragStart=\{event=>/)
 assert.match(pages,/onDrop=\{event=>/)
 assert.match(pages,/draggable=\{editable&&!busy&&!unsaved\}/)
 assert.match(pages,/onClick=\{handleLink\}/)
 assert.match(pages,/onClick=\{\(\)=>void reorder\(-1\)\}/)
 assert.match(pages,/onClick=\{\(\)=>void reorder\(1\)\}/)
})
test('Paper-first responsive stamp UX remains accessible and reduced-motion friendly',()=>{
 for(const item of [
  '.living-stamp-art-choice','.living-stamp-placement-preview',
  '.living-stamp-preview-handles','.living-stamp-peel-confirm',
  '.living-page-edge','.living-reader .living-reader-stamp-panel',
  '.living-page-thumbnail[draggable="true"]','@media(max-width:680px)',
  '@media(prefers-reduced-motion:reduce)',':focus-visible',
 ])assert.ok(css.includes(item),'Missing style '+item)
 assert.match(tools,/aria-label="ถาดแสตมป์และคำขอ"/)
 assert.match(tools,/aria-pressed=\{selectedArtwork===art\.id\}/)
 assert.match(tools,/aria-label="ยืนยันการลอกแสตมป์"/)
})
