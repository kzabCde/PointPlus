import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const detail=read('features/living-books/data.ts')
const page=read('app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx')
const shelves=read('app/(protected)/s/[spaceId]/stamp-books/page.tsx')
const creation=read('app/(protected)/s/[spaceId]/stamp-books/new/page.tsx')
const studio=read('features/living-books/editor-studio.tsx')
const rewardData=read('features/living-books/redemption-data.ts')
const rewards=read('features/living-books/rewards-on-demand.tsx')
const rewardAction=read('features/living-books/reward-loader-action.ts')
const batchSource=read('features/living-books/editor-batch-actions.ts')
const shelfItem=read('features/living-books/shelf.tsx')
const card=read('features/living-books/card-board.tsx')
const roomLayout=read('app/(protected)/s/[spaceId]/layout.tsx')
const bookLayout=read('app/(protected)/s/[spaceId]/stamp-books/layout.tsx')
const editor=read('features/living-books/paper-editor.tsx')
const uuid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111'

test('opening a known Living book never loads the complete Room shelf or unused summary',()=>{
 const start=detail.indexOf('export async function loadLivingBookDetail(')
 const end=detail.indexOf("import type { EditorElement",start)
 assert.ok(start>=0&&end>start)
 const fn=detail.slice(start,end)
 assert.match(fn,/getSpaceContext\(spaceId\)/)
 assert.match(fn,/getSpaceParticipants\(spaceId,\{includeArchived:true\}\)/)
 assert.match(fn,/\.eq\('id',bookId\)\.eq\('space_id',spaceId\)/)
 assert.match(fn,/Promise\.all/)
 assert.doesNotMatch(fn,/loadLivingBookShelf\(|pointplus_get_living_book_summary|lastPage/)
})
test('page media reuses fetched photo paths and reads ledger in parallel',()=>{
 const fn=detail.slice(detail.indexOf('export async function loadLivingPageMedia('))
 assert.match(fn,/pageElements:EditorElement\[\]/)
 assert.match(fn,/pageElements\.filter\(item=>item\.element_type==='image'\)/)
 assert.match(fn,/marksPromise,requestsPromise,giverPromise,photosPromise/)
 assert.doesNotMatch(fn,/\.select\('id,payload'\)/)
 assert.match(page,/loadLivingPageMedia\(spaceId,bookId,page\.id,elements\)/)
})
test('reward history is fetched only when the dialog is opened, not on book navigation',()=>{
 assert.match(page,/loadLivingRedemptionOverview\(/)
 assert.match(page,/LivingRewardsOnDemand/)
 assert.doesNotMatch(page,/loadLivingRedemptionData\(/)
 assert.match(studio,/\{rewardsOpen&&rewardPanel\}/)
 assert.match(rewards,/useEffect\(\(\)=>\{/)
 assert.match(rewards,/loadLivingRewardsOnDemand\(spaceId,bookId\)/)
 assert.match(rewardAction,/if\(!isUuid\(spaceId\)\|\|!isUuid\(bookId\)\)/)
 assert.match(rewardAction,/getSpaceContext\(spaceId\)/)
 assert.match(rewardAction,/\.eq\('space_id',spaceId\)\.eq\('id',bookId\)/)
 assert.match(rewardData,/head:true/)
 assert.match(rewardData,/pendingCount:pendingResult\.count\?\?0/)
})
test('legacy shelf load, extra creation member fetch and technical labels are gone',()=>{
 assert.match(shelves,/loadLivingBookShelf\(spaceId\)/)
 assert.doesNotMatch(shelves,/loadStampBookBoard|BookShelf books=\{shelf\}/)
 assert.doesNotMatch(creation,/getSpaceMembers\(/)
 assert.match(shelfItem,/prefetch=\{false\}/)
 assert.doesNotMatch(shelfItem,/การ์ดสะสม V3|Living Stampbook/)
 assert.doesNotMatch(card,/POINT\+ \/ STAMP CARD|การ์ดแห่งความทรงจำ/)
 assert.equal((roomLayout.match(/import '\.\/stamp-books\/stamp-books\.css'/g)||[]).length,1)
 assert.doesNotMatch(roomLayout,/journal\.css|paper\.css/)
 assert.match(bookLayout,/import '\.\/journal\.css'/)
 assert.match(bookLayout,/import '\.\/paper\.css'/)
})
test('multi-decoration Save bundles at most 8 edits without touching immediate stamp ledger',()=>{
 assert.match(editor,/for\(let start=0;start<staged\.length;start\+=8\)/)
 assert.match(editor,/saveLivingPaperBatch\(\{/)
 assert.match(editor,/saveObject\(batch\[0\]\)/)
 assert.match(batchSource,/input\.drafts\.length>8/)
 assert.match(batchSource,/Promise\.all\(input\.drafts\.map/)
 assert.match(batchSource,/saveLivingElement\(\{/)
 assert.match(batchSource,/transformLivingPhoto\(\{/)
 assert.doesNotMatch(batchSource,/giveLivingStamp|living_stamp_marks|pointplus_give_living_stamp/)
})
function mockBatch(){
 const calls=[]
 let active=0,maxActive=0
 const mock={
  '@/lib/auth/validation':{isUuid:value=>typeof value==='string'&&value.includes('-')},
  './editor-actions':{saveLivingElement:async input=>{
    active++;maxActive=Math.max(maxActive,active)
    await Promise.resolve()
    calls.push({type:'text',input})
    active--
    return {ok:true,data:{id:input.element.id,version:input.expectedVersion+1,updated_at:''}}
  }},
  './m03-actions':{transformLivingPhoto:async input=>{
    calls.push({type:'image',input})
    return {ok:true,data:{id:input.elementId,version:input.expectedVersion+1},message:'saved'}
  }},
 }
 const js=ts.transpileModule(batchSource,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,
 }}).outputText
 const module={exports:{}}
 new Function('module','exports','require',js)(module,module.exports,
  id=>{if(!(id in mock))throw Error('unexpected import '+id);return mock[id]})
 return {save:module.exports.saveLivingPaperBatch,calls,getMax:()=>maxActive}
}
test('batch action invokes existing version-checked authorized operations concurrently',async()=>{
 const {save,calls,getMax}=mockBatch()
 const room=uuid(1),book=uuid(2),page=uuid(3)
 const element=n=>({
  id:uuid(n),book_id:book,page_id:page,element_type:'text',
  payload:{text:'draft'},position_x:.2,position_y:.2,width:.3,height:.1,
  rotation_deg:0,opacity:1,z_index:n,version:4,
 })
 const drafts=[element(4),element(5),element(6)].map(element=>({
  element,expectedVersion:element.version,
 }))
 const result=await save({spaceId:room,bookId:book,pageId:page,drafts})
 assert.equal(result.length,3)
 assert.deepEqual(result.map(x=>x.version),[5,5,5])
 assert.ok(result.every(x=>x.ok))
 assert.equal(calls.length,3)
 assert.ok(getMax()>1,'independent decoration saves must overlap')
 await assert.rejects(()=>save({spaceId:room,bookId:book,pageId:page,
  drafts:Array.from({length:9},(_,i)=>({element:element(i+10),expectedVersion:4}))}))
 assert.equal(calls.length,3,'invalid batch cannot write')
})
