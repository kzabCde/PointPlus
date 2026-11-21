import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const paths={
  sql:'supabase/stamp-book-first/18_living_stampbook_v3_m03_photos_stamps.sql',
  actions:'features/living-books/m03-actions.ts',
  media:'features/living-books/data.ts',
  tools:'features/living-books/m03-tools.tsx',
  editor:'features/living-books/paper-editor.tsx',
  page:'app/(protected)/s/[spaceId]/stamp-books/living/[bookId]/page.tsx',
  model:'features/living-books/stamp-model.ts',
}
const source=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,read(v)]))
const fakeStamp={id:'heart',png:'/heart.png',nameTh:'Heart',mode:'couple'}
const mockAssets={'@/lib/point-plus/assets':{pointPlusStamps:[fakeStamp]}}
function transpile(file,stubs){
  const code=ts.transpileModule(read(file),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  }}).outputText
  const module={exports:{}}
  new Function('require','module','exports',code)(
    name=>{if(!(name in stubs))throw Error('Unknown import '+name);return stubs[name]},
    module,module.exports)
  return module.exports
}
const model=transpile(paths.model,mockAssets)
const validator=transpile('features/living-books/photo-validation.ts',{
  './stamp-model':model,
})
const a='11111111-1111-4111-8111-111111111111'
const b='22222222-2222-4222-8222-222222222222'
const page='33333333-3333-4333-8333-333333333333'
const user='44444444-4444-4444-8444-444444444444'
const key='55555555-5555-4555-8555-555555555555'

test('M03 migrations keep room Stamp Card ledger intact and install private photo RLS',()=>{
  assert.match(source.sql,/CREATE TABLE public\.living_stamp_requests/)
  assert.match(source.sql,/CREATE TABLE public\.living_stamp_marks/)
  assert.match(source.sql,/CREATE TABLE public\.living_stamp_events/)
  assert.match(source.sql,/state IN\('available','peeled'\)/)
  assert.match(source.sql,/CREATE POLICY "living_photos_room_read_m03" ON storage\.objects/)
  assert.match(source.sql,/CREATE POLICY "living_photos_owner_insert_m03" ON storage\.objects/)
  assert.match(source.sql,/CREATE POLICY "living_photos_owner_delete_m03" ON storage\.objects/)
  assert.match(source.sql,/VALUES \('pointplus-living-photos','pointplus-living-photos',false/)
  assert.match(source.sql,/GRANT SELECT ON TABLE public\.living_stamp_requests/)
  assert.match(source.sql,/living_book_givers/)
  assert.match(source.sql,/v_uid<>v_request\.giver_user_id/)
  assert.match(source.sql,/v_stamp\.state<>'available'/)
  assert.match(source.sql,/peeled_at=now\(\),peeled_by=v_uid/)
  assert.match(source.sql,/INSERT INTO public\.living_stamp_events/)
  assert.doesNotMatch(source.sql,/\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b|\bALTER TABLE public\.stamp_book_marks\b/i)
})
test('image elements cannot mint spendable stamps',()=>{
  assert.match(source.sql,/CHECK \(element_type IN \('text','drawing','image'\)\)/)
  assert.match(source.sql,/pointplus_private\.living_image_payload_valid/)
  assert.match(source.sql,/CREATE UNIQUE INDEX living_images_unique_storage_path/)
  assert.match(source.sql,/p_element::text\|\|'.'\|\|v_extension/)
  assert.match(source.sql,/pointplus_create_living_book_image/)
  assert.match(source.sql,/pointplus_transform_living_book_image/)
  assert.match(source.editor,/element\.element_type==='image'/)
  assert.match(source.page,/loadLivingPageMedia/)
  assert.match(source.media,/createSignedUrl/)
  assert.match(source.media,/photoBucket/)
})
test('photo geometry, mime and header validation reject unsupported/oversized/animated inputs',()=>{
  assert.equal(model.validPlacement(.5,.5,180,.3),true)
  assert.equal(model.validPlacement(-.1,.5,0,1),false)
  assert.equal(model.validPlacement(.5,.5,181,1),false)
  assert.equal(model.validCrop({x:.1,y:.2,width:.8,height:.7}),true)
  assert.equal(model.validCrop({x:.5,y:.5,width:.8,height:.5}),false)
  assert.equal(model.photoPath(a,b,page,key,'image/png'),a+'/'+b+'/'+page+'/'+key+'.png')
  assert.equal(model.photoPath(a,b,page,key,'image/svg+xml'),null)
  const png=new Uint8Array(35)
  png.set([137,80,78,71,13,10,26,10],0)
  png.set([73,72,68,82],12)
  png.set([0,0,4,0,0,0,3,0],16)
  assert.deepEqual(validator.inspectPhoto(png,'image/png'),{mime:'image/png',width:1024,height:768})
  assert.equal(validator.inspectPhoto(png,'image/jpeg'),null)
  assert.equal(validator.inspectPhoto(new Uint8Array([60,115,118,103]),'image/svg+xml'),null)
  const webp=new Uint8Array(35)
  webp.set([82,73,70,70],0);webp.set([87,69,66,80],8)
  webp.set([86,80,56,88],12)
  webp[24]=255;webp[27]=127
  assert.deepEqual(validator.inspectPhoto(webp,'image/webp'),{mime:'image/webp',width:256,height:128})
  webp[20]=2
  assert.equal(validator.inspectPhoto(webp,'image/webp'),null)
})
test('room stamp tools support tap to place, approval, original identity, peel trace and crop',()=>{
  assert.match(source.tools,/LivingStampOverlay/)
  assert.match(source.tools,/giveLivingStamp/)
  assert.match(source.tools,/reviewLivingStamp/)
  assert.match(source.tools,/cancelLivingStampRequest/)
  assert.match(source.tools,/peelLivingStamp/)
  assert.match(source.tools,/transformLivingStamp/)
  assert.match(source.tools,/onCancelPlacement/)
  assert.match(source.tools,/data-peeled=\{peeled\}/)
  assert.match(source.editor,/tool==='stamp'/)
  assert.match(source.editor,/gesture\.current=\{mode:'stamp-move'/)
  assert.match(source.editor,/saveStampMove/)
  assert.match(source.editor,/LivingPhotoUpload/)
  assert.match(source.editor,/living-photo-crop/)
  assert.match(source.editor,/transformLivingPhoto/)
  assert.match(source.tools,/preparePhotoForUpload/)
  assert.match(source.tools,/canvas\.toBlob\(resolve,'image\/webp'/)
})

function mockActions({owner=true,dbError=null,approval=false}={}){
  const calls=[]
  const supabase={
    from:()=>({select(){return this},eq(){return this},
      maybeSingle:async()=>({data:{id:b,owner_user_id:owner?user:a,
        status:'active'},error:null})}),
    rpc:async(name,args)=>{
      calls.push({name,args})
      let data={id:key,version:2,state:'peeled',request_id:key,mark_id:key,status:approval?'pending':'approved'}
      return {data:dbError?null:data,error:dbError}
    },
  }
  const stubs={
    'next/cache':{revalidatePath(){}},
    '@/lib/auth/validation':{isUuid:v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v)},
    '@/features/spaces/data':{getSpaceContext:async()=>({supabase,user:{id:user}})},
    '@/lib/point-plus/assets':{pointPlusStamps:[fakeStamp]},
    './photo-validation':validator,
    './stamp-model':model,
  }
  return {module:transpile(paths.actions,stubs),calls,supabase}
}
test('versioned real issuance calls authenticated give RPC with idempotency key, never editor insert',async()=>{
  const {module,calls}=mockActions()
  const result=await module.giveLivingStamp({
    spaceId:a,bookId:b,pageId:page,assetId:'heart',note:'hello',key,
    x:.5,y:.4,rotation:-180,scale:2.5,
  })
  assert.equal(result.ok,true)
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_give_living_stamp')
  assert.equal(calls[0].args.p_key,key)
  assert.equal(calls[0].args.p_scale,2.5)
  assert.equal(calls[0].args.p_rotation,-180)
  const invalid=await module.giveLivingStamp({
    spaceId:a,bookId:b,pageId:page,assetId:'heart',note:'hello',key,
    x:1.2,y:.4,rotation:0,scale:2,
  })
  assert.equal(invalid.ok,false)
  assert.equal(calls.length,1)
})
test('only current owner can peel or change stamp transform, and conflicting versions fail',async()=>{
  const denied=mockActions({owner:false})
  const result=await denied.module.peelLivingStamp({
    spaceId:a,bookId:b,markId:key,expectedVersion:1,
  })
  assert.equal(result.ok,false)
  assert.equal(denied.calls.length,0)
  const ok=mockActions()
  const peel=await ok.module.peelLivingStamp({
    spaceId:a,bookId:b,markId:key,expectedVersion:1,
  })
  assert.equal(peel.ok,true)
  assert.equal(ok.calls[0].name,'pointplus_peel_living_stamp')
  const conflict=mockActions({dbError:{code:'40001'}})
  const transformed=await conflict.module.transformLivingStamp({
    spaceId:a,bookId:b,markId:key,pageId:page,x:.5,y:.5,
    rotation:20,scale:1,expectedVersion:2,
  })
  assert.equal(transformed.ok,false)
  assert.equal(transformed.conflict,true)
})
