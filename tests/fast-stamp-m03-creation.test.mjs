import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require=createRequire(import.meta.url)
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const formSource=read('features/living-books/forms.tsx')
const newPage=read('app/(protected)/s/[spaceId]/stamp-books/new/page.tsx')
const loader=read('features/living-books/creation-data.ts')
const actionSource=read('features/living-books/actions.ts')
const schema=read('supabase/stamp-book-first/16_living_stampbook_v3_m01.sql')
const cards=read('supabase/stamp-book-first/23_living_v3_stamp_cards.sql')
const artwork=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
const id='11111111-1111-4111-8111-111111111111'
const room='22222222-2222-4222-8222-222222222222'
const partner='33333333-3333-4333-8333-333333333333'
const key='44444444-4444-4444-8444-444444444444'
const users=[
  {id:partner,kind:'adult',user_id:partner,display_name:'My partner'},
  {id:id,kind:'adult',user_id:id,display_name:'Me'},
]
function compile(path,dependencies,jsx=false){
  const mod={exports:{}}
  const js=ts.transpileModule(read(path),{compilerOptions:{
    jsx:jsx?ts.JsxEmit.ReactJSX:ts.JsxEmit.Preserve,
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  }}).outputText
  new Function('module','exports','require',js)(mod,mod.exports,
    name=>{if(!(name in dependencies))throw Error('Unexpected dependency '+name);return dependencies[name]})
  return mod.exports
}
const intent=compile('features/living-books/creation-intent.ts',{})
const formComponents=compile('features/living-books/forms.tsx',{
  react:require('react'),'react/jsx-runtime':require('react/jsx-runtime'),
  'next/navigation':{useRouter:()=>({replace(){},refresh(){}})},
  '@/lib/point-plus/assets':{pointPlusStamps:artwork},
  './creation-intent':intent,
  './actions':{
    createLivingBookAction(){throw Error('Creating a book during render')},
    createLivingCardAction(){throw Error('Creating a card during render')},
    addLivingBookPageAction(){throw Error('Adding a page during render')},
  },
},true)

test('M03 only retrieves active minimal recipients, not shelf, profiles or previews',()=>{
  assert.match(newPage,/loadCreationRecipients\(spaceId\)/)
  assert.match(newPage,/getSpaceContext\(spaceId\)/)
  assert.match(newPage,/Promise\.all/)
  assert.match(loader,/\.select\('id,kind,user_id,display_name'\)/)
  assert.match(loader,/\.eq\('space_id',spaceId\)\.is\('archived_at',null\)/)
  assert.doesNotMatch(newPage+loader,/loadLivingBookShelf|getSpaceMembers|loadStampBookBoard|private_image|signedUrl/)
})

test('Couple book creation initially requires only title, recipient is chosen automatically',()=>{
  const html=renderToStaticMarkup(React.createElement(formComponents.CreateLivingBookForm,{
    spaceId:room,userId:id,kind:'couple',participants:users,format:'living',
  }))
  assert.match(html,/name="title"[^>]*required/)
  assert.match(html,/name="recipient_id" value="33333333-3333-4333-8333-333333333333"/)
  assert.match(html,/name="approval_policy" value="direct"/)
  assert.doesNotMatch(html,/id="living-book-recipient"/)
  assert.doesNotMatch(html,/name="target_count"/)
  assert.doesNotMatch(html,/<img\b/)
  assert.match(html,/<details class="living-fast-creation-advanced"/)
  assert.match(html,/name="cover_asset_id"/)
  assert.match(html,/name="description"/)
})

test('Card quick-create exposes only title, number of slots and mandatory reward',()=>{
  const html=renderToStaticMarkup(React.createElement(formComponents.CreateLivingBookForm,{
    spaceId:room,userId:id,kind:'couple',participants:users,format:'card',
  }))
  assert.match(html,/name="target_count"/)
  assert.match(html,/name="reward_title"/)
  assert.match(html,/name="title"/)
  assert.match(html,/name="recipient_id"/)
  assert.match(html,/defaultValue|value="6"/)
  assert.match(html,/สร้างการ์ดสะสม/)
  assert.doesNotMatch(html,/<img\b/)
})

test('Non-Couple creators retain recipient selection and approval customization',()=>{
  const html=renderToStaticMarkup(React.createElement(formComponents.CreateLivingBookForm,{
    spaceId:room,userId:id,kind:'family',participants:users,format:'living',
  }))
  assert.match(html,/id="living-book-recipient"/)
  assert.match(html,/name="approval_policy"/)
  assert.match(html,/approval_required/)
  assert.match(html,/name="cover_asset_id"/)
})

test('A frozen creation command retries with identical data after edit/reload',()=>{
  const original=new FormData()
  for(const [name,value] of Object.entries({
    space_id:room,recipient_id:partner,title:'Little things',description:'',
    cover_asset_id:artwork[0].id,approval_policy:'direct',idempotency_key:key,
    target_count:'6',reward_title:'A picnic',
  }))original.set(name,value)
  const captured=intent.captureCreationIntent('card',key,original)
  const persisted=JSON.stringify(captured)
  original.set('title','Different title')
  original.set('reward_title','Different reward')
  original.set('idempotency_key',id)
  const restored=intent.restoreCreationIntent(persisted,'card',room)
  assert.deepEqual(restored,captured)
  const retry=intent.intentFormData(restored)
  assert.equal(retry.get('idempotency_key'),key)
  assert.equal(retry.get('title'),'Little things')
  assert.equal(retry.get('reward_title'),'A picnic')
  assert.deepEqual(Object.fromEntries(retry),captured.fields)
  assert.equal(intent.restoreCreationIntent(persisted,'living',room),null)
  assert.equal(intent.restoreCreationIntent(persisted,'card',id),null)
  assert.equal(intent.restoreCreationIntent('{bad json','card',room),null)
  assert.equal(intent.restoreCreationIntent(null,'card',room),null)
})

test('UI locks the captured payload and requires explicit acknowledgement to start new request',()=>{
  assert.match(formSource,/const payload=intent\?intentFormData\(intent\):new FormData\(event\.currentTarget\)/)
  assert.match(formSource,/captureCreationIntent\(format,key,payload\)/)
  assert.match(formSource,/sessionStorage\.setItem\(storageKey,JSON\.stringify\(command\)\)/)
  assert.match(formSource,/startTransition\(\(\)=>\{action\(payload\)\}\)/)
  assert.match(formSource,/router\.replace\('\/s\/'.*state\.bookId\)/)
  assert.match(formSource,/state\.status==='success'/)
  assert.match(formSource,/sessionStorage\.removeItem\(storageKey\)/)
  assert.match(formSource,/window\.confirm\(/)
  assert.match(formSource,/submitLock\.current=true/)
  assert.match(formSource,/disabled=\{!key\|\|pending\|\|state\.status==='success'\}/)
})

function actionHarness(kind='couple',role='member'){
  const calls=[],paths=[],created=new Map()
  const context={
    space:{kind},member:{role},user:{id},
    supabase:{rpc:async(name,args)=>{
      calls.push({name,args})
      const old=created.get(args.p_key)
      if(old){
        if(old.name!==name||JSON.stringify(old.args)!==JSON.stringify(args))
          return {data:null,error:{code:'22023',message:'Reused key with different data'}}
        return {data:old.bookId,error:null}
      }
      const bookId='55555555-5555-4555-8555-555555555555'
      created.set(args.p_key,{name,args,bookId})
      return {data:bookId,error:null}
    }},
  }
  const module=compile('features/living-books/actions.ts',{
    'next/cache':{revalidatePath:path=>paths.push(path)},
    '@/lib/auth/validation':{
      isUuid:s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s),
      field:(f,name)=>String(f.get(name)??'').trim(),
    },
    '@/features/spaces/data':{getSpaceContext:async()=>context},
    '@/lib/point-plus/assets':{pointPlusStamps:artwork},
  })
  return {actions:module,calls,paths,created}
}
function creationForm(format){
  const form=new FormData()
  const fields={
    space_id:room,recipient_id:partner,title:'Our story',
    description:'',cover_asset_id:artwork[0].id,
    approval_policy:'direct',idempotency_key:key,
  }
  if(format==='card')Object.assign(fields,{
    target_count:'6',reward_title:'Go on a date',
  })
  for(const [name,value] of Object.entries(fields))form.set(name,value)
  return form
}

test('Living Book and Card each require exactly one original authorized RPC with retry key',async()=>{
  for(const format of ['living','card']){
    const h=actionHarness()
    const form=creationForm(format)
    const fn=format==='card'?h.actions.createLivingCardAction:h.actions.createLivingBookAction
    const first=await fn({status:'idle',message:''},form)
    const retry=await fn({status:'error',message:'Network uncertain'},form)
    assert.equal(first.status,'success')
    assert.deepEqual(retry,first)
    assert.equal(h.created.size,1)
    assert.equal(h.calls.length,2)
    assert.equal(h.calls[0].args.p_key,key)
    assert.equal(h.calls[0].name,format==='card'?
      'pointplus_create_living_card':'pointplus_create_living_book')
    assert.equal(h.paths.length,4,'two replays revalidate both Room and collection shelf')
    form.set('title','Changed after first submission')
    assert.equal((await fn({status:'error',message:'Unknown'},form)).status,'error')
    assert.equal(h.created.size,1)
  }
})

test('Authorization and input validation remain enforced server-side',async()=>{
  const h=actionHarness('group','member')
  assert.equal((await h.actions.createLivingBookAction({},creationForm('living'))).status,'error')
  assert.equal((await h.actions.createLivingCardAction({},creationForm('card'))).status,'error')
  assert.equal(h.calls.length,0)
  const couple=actionHarness()
  const invalid=creationForm('card')
  invalid.set('target_count','101')
  assert.equal((await couple.actions.createLivingCardAction({},invalid)).status,'error')
  invalid.set('target_count','6');invalid.set('reward_title','')
  assert.equal((await couple.actions.createLivingCardAction({},invalid)).status,'error')
  assert.equal(couple.calls.length,0)
})

test('Database M01/M23 keep one initial page, creator giver and atomic card idempotency',()=>{
  assert.match(schema,/INSERT INTO public\.living_book_givers/)
  assert.match(schema,/INSERT INTO public\.living_book_pages/)
  assert.match(schema,/creation_key/)
  assert.match(schema,/Idempotency key reused with different Living Book input/)
  assert.match(cards,/pointplus_create_living_book\(/)
  assert.match(cards,/Idempotency key belongs to another collection/)
  assert.match(cards,/FOR UPDATE/)
  assert.doesNotMatch(formSource,/\.from\('living_books'\)|\.insert\(/)
  assert.match(formSource,/useActionState\(format==='card'\?createLivingCardAction:createLivingBookAction,livingIdle\)/)
})
