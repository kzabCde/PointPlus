import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
function fromTS(path,dependencies={}){
 const code=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
 }}).outputText
 const mod={exports:{}}
 new Function('require','module','exports',code)(
  name=>{if(!(name in dependencies))throw Error('Unexpected dependency '+name);return dependencies[name]},
  mod,mod.exports)
 return mod.exports
}
const model=fromTS('features/living-books/editor-model.ts')
const geom=fromTS('features/living-books/direct-manipulation.ts',{'./editor-model':model})
const editor=read('features/living-books/paper-editor.tsx')
const css=read('app/(protected)/s/[spaceId]/stamp-books/stamp-books.css')
const object={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 book_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 page_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 element_type:'image',payload:{storagePath:'private/photo.webp'},
 position_x:.25,position_y:.2,width:.3,height:.2,
 rotation_deg:0,opacity:1,z_index:2,version:7}
const box={width:1000,height:800}
const close=(actual,expected,eps=1e-8)=>
 assert.ok(Math.abs(actual-expected)<eps,'actual '+actual+' expected '+expected)

test('dragging clamps to paper and never changes UUID, photo path or version',()=>{
 const moved=geom.moveDecoration(object,120,80,box)
 close(moved.position_x,.37);close(moved.position_y,.3)
 const bounded=geom.moveDecoration(object,3000,-2000,box)
 close(bounded.position_x,.7);close(bounded.position_y,0)
 assert.equal(moved.id,object.id)
 assert.equal(moved.version,object.version)
 assert.equal(moved.payload,object.payload)
 assert.equal(geom.moveDecoration(object,300,100,{width:0,height:0}),object)
})
test('corner resize honors image aspect ratio, rotated axes and page limits',()=>{
 const bigger=geom.resizeDecoration(object,'se',60,20,box)
 close(bigger.width/.3,bigger.height/.2)
 assert.ok(bigger.width>.3)
 const rotated={...object,element_type:'drawing',rotation_deg:90}
 const next=geom.resizeDecoration(rotated,'se',0,80,box,false)
 assert.ok(next.width>rotated.width)
 close(next.height,rotated.height)
 for(const corner of ['nw','ne','sw','se']){
  for(const [x,y] of [[-5000,5000],[5000,-5000],[0,0]]){
   const item=geom.resizeDecoration(object,corner,x,y,box)
   for(const field of ['position_x','position_y','width','height'])
    assert.ok(item[field]>=0&&item[field]<=1&&Number.isFinite(item[field]),field)
  }
 }
})
test('rotation follows pointer angle and normalizes into -180..180',()=>{
 const cx=(object.position_x+object.width/2)*box.width
 const cy=(object.position_y+object.height/2)*box.height
 const r=geom.rotateDecoration(object,{x:cx+100,y:cy},{x:cx,y:cy+100},box)
 close(r.rotation_deg,90);close(r.position_x,object.position_x)
 const r2=geom.rotateDecoration({...object,rotation_deg:178},
  {x:cx+100,y:cy},{x:cx,y:cy+100},box)
 close(r2.rotation_deg,-92)
})
test('two-finger object pinch scales around center, not the stamp ledger',()=>{
 const larger=geom.pinchDecoration(object,1.5,box)
 close(larger.width/.3,1.5);close(larger.height/.2,1.5)
 close(larger.position_x+larger.width/2,object.position_x+object.width/2)
 close(larger.position_y+larger.height/2,object.position_y+object.height/2)
 for(const ratio of [.001,1,10,100]){
  const result=geom.pinchDecoration(object,ratio,box)
  assert.ok(result.width>=.005&&result.width<=1)
  assert.ok(result.height>=.005&&result.height<=1)
 }
})
test('handles, inline typing, double-tap, pointer cancel, contextual transform and keyboard fallbacks exist',()=>{
 for(const marker of [
  'data-editor-handle={corner}','data-editor-handle="rotate"',
  'data-inline-text="true"','onDoubleClick=','onTouchEnd=',
  'resizeDecoration(g.original,g.corner','rotateDecoration(g.original',
  'moveDecoration(g.original','pinchDecoration(pinch.current.original',
  'samePaperDecoration(g.next,g.original)','onPointerCancel={event=>',
  'aria-label="แก้ไขข้อความบนกระดาษ"','if(event.altKey)',
  'else if(event.shiftKey)','className="living-drawing-toolbar"'
 ])assert.ok(editor.includes(marker),'Missing direct interaction: '+marker)
})
test('selected object reveals compact contextual toolbar; detailed inspector stays closed',()=>{
 assert.match(editor,/editable&&selected&&tool==='select'&&<div/)
 assert.match(editor,/data-context-toolbar="true"/)
 assert.match(editor,/role="toolbar"/)
 assert.match(editor,/aria-controls="living-selection-advanced"/)
 assert.match(editor,/editable&&selected&&advancedOpen&&<div/)
 assert.match(editor,/setAdvancedOpen\(false\)/)
 assert.match(editor,/aria-label="แก้ไขข้อความ"/)
 assert.match(editor,/aria-label="สีข้อความ"/)
 assert.match(editor,/aria-label="นำวัตถุมาด้านหน้า"/)
 assert.match(editor,/className="living-drawing-toolbar"/)
 assert.match(editor,/aria-label="ความหนาเส้น"/)
})
test('saves only complete gestures, and keeps autosave, undo and private photo upload',()=>{
 for(const marker of [
  'saveLivingElement(', 'transformLivingPhoto(', 'saveObject(g.next,g.original)',
  'saveObject(ended.next,ended.original)','draftEdits.current.set',
  'scheduleAutosave()','850)','undoRedo(','flushDrafts(',
  'preparePhotoForUpload(file)','uploadLivingPhoto(form)',
  'className="living-editor-save-warning"','role="toolbar"'
 ])assert.ok(editor.includes(marker),'Lost M05 interaction: '+marker)
 assert.doesNotMatch(read('features/living-books/direct-manipulation.ts'),
  /living_stamp_marks|pointplus_give_living_stamp|pointplus_request_living_stamp_redemption/)
})
test('responsive handles remain visible with keyboard focus, photo drop and reduced motion',()=>{
 for(const marker of [
  '.living-selection-handles','.living-selection-rotate','.living-paper-inline-text',
  '.living-editor-paper .living-selection-toolbar',
  '.living-editor-properties--contextual','.living-drawing-toolbar',
  '.living-reader .living-editor-viewport.is-dropping',':focus-visible',
  '@media(max-width:680px)','@media(prefers-reduced-motion:reduce)'
 ])assert.ok(css.includes(marker),'Missing UX02 style '+marker)
})
