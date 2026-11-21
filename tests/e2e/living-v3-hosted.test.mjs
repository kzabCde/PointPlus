/**
 * POINT+ Living V3 hosted staging E2E gate (NOT run against Production).
 *
 * Run only after M01..M05 migrations are applied to isolated staging:
 *
 * POINTPLUS_E2E_STAGING_ONLY=1
 * POINTPLUS_E2E_SUPABASE_URL=https://<staging-project>.supabase.co
 * POINTPLUS_E2E_PUBLISHABLE_KEY=...
 * POINTPLUS_E2E_A_EMAIL=...
 * POINTPLUS_E2E_A_PASSWORD=...
 * POINTPLUS_E2E_B_EMAIL=...
 * POINTPLUS_E2E_B_PASSWORD=...
 * POINTPLUS_E2E_ROOM_ID=<room-of-the-two-staging-accounts>
 * POINTPLUS_E2E_BOOK_A=<book-owned-by-A-for-B>
 * POINTPLUS_E2E_BOOK_B=<book-owned-by-B-for-A>
 *
 * node --test tests/e2e/living-v3-hosted.test.mjs
 *
 * This exercises real Supabase Auth, Data API, RLS, RPC and private Storage
 * with two separate accounts. Browser gesture E2E is still a separate gate.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'

const required=[
  'POINTPLUS_E2E_STAGING_ONLY','POINTPLUS_E2E_SUPABASE_URL',
  'POINTPLUS_E2E_PUBLISHABLE_KEY',
  'POINTPLUS_E2E_A_EMAIL','POINTPLUS_E2E_A_PASSWORD',
  'POINTPLUS_E2E_B_EMAIL','POINTPLUS_E2E_B_PASSWORD',
  'POINTPLUS_E2E_ROOM_ID','POINTPLUS_E2E_BOOK_A','POINTPLUS_E2E_BOOK_B',
]
const missing=required.filter(name=>!process.env[name])
if(missing.length)
  throw new Error('Staging E2E is not configured: '+missing.join(', ')+
    '. This test refuses to run without real isolated staging credentials.')
if(process.env.POINTPLUS_E2E_STAGING_ONLY!=='1')
  throw new Error('Set POINTPLUS_E2E_STAGING_ONLY=1 after confirming the isolated test project.')
const url=new URL(process.env.POINTPLUS_E2E_SUPABASE_URL)
if(url.hostname==='gczribbtkfvhpzzupqre.supabase.co'||
  url.hostname==='supabase.co'||
  !['https:','http:'].includes(url.protocol))
  throw new Error('Refusing to modify PointPlus Production or a non-staging URL')
if(url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))
  throw new Error('Only local Supabase may use HTTP in staging E2E')

const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const room=process.env.POINTPLUS_E2E_ROOM_ID
const bookA=process.env.POINTPLUS_E2E_BOOK_A
const bookB=process.env.POINTPLUS_E2E_BOOK_B
for(const value of [room,bookA,bookB])
  if(!id.test(value))throw new Error('Staging fixture UUID is invalid')
const key=process.env.POINTPLUS_E2E_PUBLISHABLE_KEY
const create=()=>createClient(url.toString(),key,{auth:{
  persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,
}})
const a=create(),b=create()
async function rpc(client,name,params){
  const {data,error}=await client.rpc(name,params)
  assert.ifError(error)
  return data
}
async function row(client,table,columns,bookId){
  const {data,error}=await client.from(table).select(columns)
    .eq('book_id',bookId).limit(1).maybeSingle()
  assert.ifError(error)
  return data
}
async function auth(client,email,password){
  const {data,error}=await client.auth.signInWithPassword({email,password})
  assert.ifError(error)
  assert.ok(data.user?.id)
  return data.user.id
}
async function giveAndApprove(owner,recipient,book,page,asset){
  const receipt=await rpc(owner,'pointplus_give_living_stamp',{
    p_book:book,p_page:page,p_asset:asset,p_note:'M05 staged end-to-end stamp',
    p_key:crypto.randomUUID(),p_x:.45,p_y:.48,p_rotation:34,p_scale:1.3,
  })
  if(receipt.status==='pending'){
    const reviewed=await rpc(recipient,'pointplus_review_living_stamp',{
      p_request:receipt.request_id,p_approve:true,
    })
    assert.equal(reviewed.status,'approved')
    return reviewed.mark_id
  }
  assert.equal(receipt.status,'approved')
  return receipt.mark_id
}
const pngOnePixel=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1GQAAAABJRU5ErkJggg==',
  'base64',
)
test('Two-account staged Living Book E2E: Auth / RLS / Undo / Stamp / Redemption / Storage',async()=>{
  const idA=await auth(a,process.env.POINTPLUS_E2E_A_EMAIL,process.env.POINTPLUS_E2E_A_PASSWORD)
  const idB=await auth(b,process.env.POINTPLUS_E2E_B_EMAIL,process.env.POINTPLUS_E2E_B_PASSWORD)
  assert.notEqual(idA,idB)
  for(const [client,uid] of [[a,idA],[b,idB]]){
    const {data,error}=await client.from('space_members')
      .select('user_id,space_id').eq('space_id',room).eq('user_id',uid).single()
    assert.ifError(error)
    assert.equal(data.user_id,uid)
  }
  const {data:ab,error:abErr}=await a.from('living_books')
    .select('id,owner_user_id,status').eq('id',bookA).eq('space_id',room).single()
  assert.ifError(abErr)
  const {data:ba,error:baErr}=await b.from('living_books')
    .select('id,owner_user_id,status').eq('id',bookB).eq('space_id',room).single()
  assert.ifError(baErr)
  assert.equal(ab.owner_user_id,idA);assert.equal(ab.status,'active')
  assert.equal(ba.owner_user_id,idB);assert.equal(ba.status,'active')

  const newPage=await rpc(a,'pointplus_add_living_book_page',{
    p_book:bookA,p_key:crypto.randomUUID(),p_title:'M05 staging memory',
    p_background:'cream',
  })
  assert.match(newPage,id)
  const unauthorized=await b.rpc('pointplus_add_living_book_page',{
    p_book:bookA,p_key:crypto.randomUUID(),p_title:'Not my page',p_background:'cream',
  })
  assert.ok(unauthorized.error,'Recipient must not add pages to owner book')

  const elementId=crypto.randomUUID()
  const body={text:'Our M05 E2E memory',fontSize:28,color:'#a65b64',
    fontFamily:'sans',align:'left',bold:false,italic:false}
  const base={p_book:bookA,p_page:newPage,p_element:elementId,
    p_type:'text',p_payload:body,p_x:.2,p_y:.3,p_width:.4,p_height:.15,
    p_rotation:0,p_opacity:1,p_z:5,p_expected_version:0}
  assert.equal((await rpc(a,'pointplus_save_living_book_element',base)).version,1)
  const denied=await b.rpc('pointplus_save_living_book_element',{
    ...base,p_expected_version:1,p_payload:{...body,text:'not allowed'},
  })
  assert.ok(denied.error,'Recipient must not edit creator paper')
  assert.equal((await rpc(a,'pointplus_save_living_book_element',{
    ...base,p_expected_version:1,p_payload:{...body,text:'Updated M05 memory'},
  })).version,2)
  const stale=await a.rpc('pointplus_save_living_book_element',{
    ...base,p_expected_version:1,
  })
  assert.ok(stale.error,'Stale version must be rejected')
  const deleted=await rpc(a,'pointplus_delete_living_book_element',{
    p_book:bookA,p_page:newPage,p_element:elementId,p_expected_version:2,
  })
  assert.equal(deleted.deleted,true)
  const restored=await rpc(a,'pointplus_restore_living_book_element',{
    p_book:bookA,p_page:newPage,p_element:elementId,p_expected_version:deleted.version,
  })
  assert.equal(restored.restored,true)
  assert.equal(restored.id,elementId)
  const visible=await b.from('living_book_elements').select('id,payload')
    .eq('book_id',bookA).eq('page_id',newPage).eq('id',elementId).single()
  assert.ifError(visible.error)
  assert.equal(visible.data.payload.text,'Updated M05 memory')

  // Image upload is fully private to room members.
  const photoId=crypto.randomUUID()
  const photoPath=[room,bookA,newPage,photoId+'.png'].join('/')
  const uploaded=await a.storage.from('pointplus-living-photos').upload(photoPath,pngOnePixel,{
    upsert:false,contentType:'image/png',
  })
  assert.ifError(uploaded.error)
  const image=await rpc(a,'pointplus_create_living_book_image',{
    p_book:bookA,p_page:newPage,p_element:photoId,p_path:photoPath,
    p_mime:'image/png',p_pixel_width:1,p_pixel_height:1,
  })
  assert.equal(image.version,1)
  const signed=await b.storage.from('pointplus-living-photos').createSignedUrl(photoPath,60)
  assert.ifError(signed.error)
  assert.ok(signed.data?.signedUrl?.startsWith('http'))
  const photoDelete=await rpc(a,'pointplus_delete_living_book_element',{
    p_book:bookA,p_page:newPage,p_element:photoId,p_expected_version:1,
  })
  const photoRestore=await rpc(a,'pointplus_restore_living_book_element',{
    p_book:bookA,p_page:newPage,p_element:photoId,
    p_expected_version:photoDelete.version,
  })
  assert.equal(photoRestore.restored,true)

  // Issuance and redemption always use authoritative mark UUIDs, not decoration.
  const art=process.env.POINTPLUS_E2E_ARTWORK??'heart'
  const granted=await giveAndApprove(a,b,bookA,newPage,art)
  assert.match(granted,id)
  const claim=await rpc(b,'pointplus_request_living_stamp_redemption',{
    p_book:bookA,p_quantity:1,p_reward_message:'M05 staging celebration',
    p_key:crypto.randomUUID(),
  })
  assert.equal(claim.status,'requested')
  assert.equal(claim.mark_ids.length,1)
  const fulfill=await rpc(a,'pointplus_fulfill_living_stamp_redemption',{
    p_redemption:claim.id,
  })
  assert.equal(fulfill.status,'fulfilled')
  const used=await a.from('living_stamp_marks').select('id,state,redemption_id')
    .eq('book_id',bookA).eq('id',claim.mark_ids[0]).single()
  assert.ifError(used.error)
  assert.equal(used.data.state,'redeemed')
  assert.equal(used.data.redemption_id,claim.id)
  const cannotPeel=await a.rpc('pointplus_peel_living_stamp',{
    p_mark:used.data.id,p_expected_version:2,
  })
  assert.ok(cannotPeel.error,'Redeemed stamp must never be peeled/spent again')
  const currentBook=await a.from('living_books').select('status').eq('id',bookA).single()
  assert.ifError(currentBook.error)
  assert.equal(currentBook.data.status,'active','Living Book must never auto-archive')

  const pageB=await row(b,'living_book_pages','id',bookB)
  assert.ok(pageB?.id)
  await giveAndApprove(b,a,bookB,pageB.id,art)
  const reverse=await rpc(a,'pointplus_request_living_stamp_redemption',{
    p_book:bookB,p_quantity:1,p_reward_message:'Reverse direction',
    p_key:crypto.randomUUID(),
  })
  assert.equal(reverse.status,'requested')
  assert.equal((await rpc(b,'pointplus_fulfill_living_stamp_redemption',{
    p_redemption:reverse.id,
  })).status,'fulfilled')

  // Assertions use two distinct user sessions, no service_role key.
  console.log('Staging two-account end-to-end auth, Storage, edit restoration and redemption passed.')
})
