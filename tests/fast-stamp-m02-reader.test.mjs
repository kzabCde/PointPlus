import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url)
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const route=read('app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx')
const reader=read('features/living-books/read-only-page.tsx')
const readerData=read('features/living-books/reader-data.ts')
const rewards=read('features/living-books/read-rewards.tsx')
const pages=read('features/living-books/page-manager.tsx')
const stampAction=read('features/living-books/fast-stamp-actions.ts')
const fakeImage=({src,alt='',width,height,...rest})=>
  React.createElement('img',{src,alt,width,height,...rest})
const fakeLink=({href,children,...rest})=>
  React.createElement('a',{href,...rest},children)
const uuid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111'

function fromTS(path,stubs,jsx=false){
  const compiled=ts.transpileModule(read(path),{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
    jsx:jsx?ts.JsxEmit.ReactJSX:ts.JsxEmit.Preserve,esModuleInterop:true,
  }}).outputText
  const module={exports:{}}
  new Function('module','exports','require',compiled)(
    module,module.exports,
    name=>{if(!(name in stubs))throw Error('unexpected dependency: '+name);return stubs[name]})
  return module.exports
}

test('Reader is default and editor bundles are imported ONLY inside edit branch',()=>{
  const readerIndex=route.indexOf("if(mode!=='edit')")
  const firstEditorImport=route.indexOf("import('@/features/living-books/paper-editor')")
  assert.ok(readerIndex>0&&firstEditorImport>readerIndex)
  assert.match(route,/loadLivingReadPage\(spaceId,bookId,requested\)/)
  assert.match(route,/<LivingReadOnlyPage/)
  assert.match(route,/mode=edit&page=/)
  assert.match(route,/<LivingPageManager/)
  assert.match(route,/<LivingPaperEditor/)
  assert.match(route,/<LivingCardBoard/)
  assert.match(route,/rewardPanel=\{<LivingRewardsOnDemand/)
  assert.doesNotMatch(reader,/giveLivingStamp|LivingPaperEditor|LiveEditorStudio/)
  assert.doesNotMatch(readerData,/loadLivingEditorData|loadLivingBookShelf/)
  assert.match(pages,/const pageHref=\(id:string\)=>base\+'\?mode=edit&page='\+id/)
  assert.doesNotMatch(pages,/base\+'\?page='/)
})

test('Reader reads one scoped page, head-only counts, bounded visible decorations',()=>{
  for(const token of [
    "getSpaceContext(spaceId)",
    ".eq('book_id',bookId).eq('space_id',spaceId)",
    ".eq('book_id',bookId).eq('page_id',page.id)",
    ".select('id',{count:'exact',head:true})",
    ".lt('page_order',page.page_order)",
    ".gt('page_order',page.page_order)",
    ".range(offset,offset+199)",
    "if(!pageResult.data)notFound()",
  ])assert.ok(readerData.includes(token),'missing reader data guard: '+token)
  assert.doesNotMatch(readerData,/from\('living_stamp_redemptions'\)|storage\.from\(|loadLivingEditorData/)
})

function readerHarness(){
  const book=uuid(1),space=uuid(2),page1=uuid(3),page2=uuid(4),calls=[]
  const records={
    living_book_pages:[
      {id:page1,book_id:book,space_id:space,page_order:1,title:'Page 1',
        background_style:'cream',version:1},
      {id:page2,book_id:book,space_id:space,page_order:2,title:'Page 2',
        background_style:'lined',version:1},
    ],
    living_book_elements:[
      {id:uuid(5),book_id:book,page_id:page1,deleted_at:null,z_index:1,element_type:'text',payload:{}},
      {id:uuid(6),book_id:book,page_id:page2,deleted_at:null,z_index:2,element_type:'text',payload:{}},
    ],
  }
  const from=name=>{
    const query={table:name,conditions:[],orderFields:[],head:false,first:null,last:null,max:null}
    const chain={
      select:(fields,opts={})=>{query.fields=fields;query.head=!!opts.head;return chain},
      eq:(field,value)=>{query.conditions.push(row=>row[field]===value);return chain},
      lt:(field,value)=>{query.conditions.push(row=>row[field]<value);return chain},
      gt:(field,value)=>{query.conditions.push(row=>row[field]>value);return chain},
      is:(field,value)=>{query.conditions.push(row=>row[field]===value);return chain},
      order:(field,options={})=>{query.orderFields.push({field,asc:options.ascending!==false});return chain},
      limit:(max)=>{query.max=max;return chain},
      range:(first,last)=>{query.first=first;query.last=last;return chain},
      maybeSingle:()=>Promise.resolve(result(true)),
      then:(resolve,reject)=>Promise.resolve(result(false)).then(resolve,reject),
    }
    function result(single){
      calls.push({...query,conditions:undefined})
      let rows=records[name].filter(row=>query.conditions.every(fn=>fn(row)))
      for(const {field,asc} of query.orderFields.slice().reverse())
        rows=rows.sort((a,b)=>asc?String(a[field]).localeCompare(String(b[field])):
          String(b[field]).localeCompare(String(a[field])))
      const count=rows.length
      if(query.max!==null)rows=rows.slice(0,query.max)
      if(query.first!==null)rows=rows.slice(query.first,query.last+1)
      return {data:query.head?null:single?(rows[0]??null):rows,
        count:query.head?count:null,error:null}
    }
    return chain
  }
  const action=fromTS('features/living-books/reader-data.ts',{
    'next/navigation':{notFound:()=>{throw Error('notFound')}},
    '@/lib/auth/validation':{isUuid:s=>typeof s==='string'&&s.length===36},
    '@/features/spaces/data':{getSpaceContext:async()=>({supabase:{from}})},
  })
  return {load:action.loadLivingReadPage,calls,space,book,page1,page2}
}

test('Reader navigates by metadata without downloading other pages decorations',async()=>{
  const h=readerHarness()
  const result=await h.load(h.space,h.book,h.page2)
  assert.equal(result.page.id,h.page2)
  assert.equal(result.pageNumber,2)
  assert.equal(result.pageCount,2)
  assert.equal(result.previous,h.page1)
  assert.equal(result.next,null)
  assert.equal(result.elements.length,1)
  assert.equal(result.elements[0].page_id,h.page2)
  assert.equal(h.calls.filter(x=>x.table==='living_book_elements').length,1)
  assert.ok(h.calls.filter(x=>x.table==='living_book_pages').length<=5)
  await assert.rejects(()=>h.load(h.space,h.book,uuid(8)),/notFound/)
})

const {LivingReadOnlyPage}=fromTS('features/living-books/read-only-page.tsx',{
  'react/jsx-runtime':require('react/jsx-runtime'),
  'next/image':fakeImage,
  'next/link':fakeLink,
  '@/lib/point-plus/assets':{pointPlusStamps:[{id:'heart',nameTh:'หัวใจ',png:'/heart.png'}]},
},true)

test('Read-only paper SSR preserves text, drawing, signed photo, stamp state and pending',()=>{
  const page={id:uuid(3),page_order:2,title:'วันพิเศษ',background_style:'cream'}
  const common={book_id:uuid(1),page_id:page.id,position_x:.2,position_y:.2,
    width:.4,height:.2,rotation_deg:15,opacity:1,z_index:1,version:1}
  const elements=[
    {...common,id:uuid(4),element_type:'text',
      payload:{text:'คิดถึงนะ',fontSize:24,color:'#224466',fontFamily:'serif',
        align:'left',bold:true,italic:false}},
    {...common,id:uuid(5),element_type:'drawing',
      payload:{points:[{x:0,y:0},{x:1,y:1}],color:'#112233',strokeWidth:3}},
    {...common,id:uuid(6),element_type:'image',
      payload:{crop:{x:0,y:0,width:1,height:1}}},
  ]
  const mark={id:uuid(7),position_x:.7,position_y:.7,rotation_deg:0,
    scale_factor:.7,asset_id:'heart',state:'peeled'}
  const pending={id:uuid(8),position_x:.5,position_y:.5,rotation_deg:0,
    scale_factor:.7,asset_id:'heart'}
  const html=renderToStaticMarkup(React.createElement(LivingReadOnlyPage,{
    spaceId:uuid(2),bookId:uuid(1),page,elements,marks:[mark],requests:[pending],
    imageUrls:{[uuid(6)]:'https://signed.example/photo'},card:null,previous:uuid(9),
    next:null,pageNumber:2,pageCount:4,
  }))
  assert.match(html,/คิดถึงนะ/)
  assert.match(html,/<polyline /)
  assert.match(html,/signed\.example\/photo/)
  assert.match(html,/ลอกแล้ว/)
  assert.match(html,/รออนุมัติ/)
  assert.match(html,/หน้า 2 \/ 4/)
  assert.match(html,/\?page=/)
  assert.doesNotMatch(html,/textarea|contenteditable|type="submit"/)
})

test('Card reader shows accurate fixed slots but cannot issue from read-only UI',()=>{
  const html=renderToStaticMarkup(React.createElement(LivingReadOnlyPage,{
    spaceId:uuid(2),bookId:uuid(1),page:{id:uuid(3)},
    elements:[],marks:[{id:uuid(4),position_x:.1667,position_y:.25,
      asset_id:'heart',state:'available'}],
    requests:[{id:uuid(5),position_x:.5,position_y:.25,asset_id:'heart'}],
    imageUrls:{},card:{target_count:6,reward_title:'เดินเล่น'},previous:null,
    next:null,pageNumber:1,pageCount:1,
  }))
  assert.match(html,/1<\/strong> \/ 6/)
  assert.match(html,/เดินเล่น/)
  assert.match(html,/รออนุมัติ/)
  assert.doesNotMatch(html,/<button/)
})

test('Rewards are downloaded only when expanded, M01 Fast Stamp remains unchanged',()=>{
  assert.match(rewards,/dynamic\(/)
  assert.match(rewards,/ssr:false/)
  assert.match(rewards,/onToggle=\{event=>setOpen\(event\.currentTarget\.open\)\}/)
  assert.match(rewards,/\{open&&<div/)
  assert.match(route,/<LivingReaderRewards/)
  assert.match(route,/loadLivingRedemptionOverview\(/)
  assert.doesNotMatch(route,/loadLivingRedemptionData\(/)
  assert.match(stampAction,/giveLivingStamp\(/)
  assert.match(read('features/living-books/fast-stamp-button.tsx'),/sessionStorage\.setItem/)
})
