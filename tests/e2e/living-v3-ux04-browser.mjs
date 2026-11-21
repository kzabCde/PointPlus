/**
 * UX04 hosted browser E2E: NEVER point at Production.
 * Requires a separately provisioned Staging web deployment and Staging Supabase.
 *
 * Required:
 *   POINTPLUS_E2E_STAGING_ONLY=1
 *   POINTPLUS_E2E_STAGING_APP_URL=https://<staging-app>
 *   POINTPLUS_E2E_SUPABASE_URL=https://<staging-project>.supabase.co
 *   POINTPLUS_E2E_PUBLISHABLE_KEY=...
 *   POINTPLUS_E2E_A_EMAIL=... / POINTPLUS_E2E_A_PASSWORD=...
 *   POINTPLUS_E2E_B_EMAIL=... / POINTPLUS_E2E_B_PASSWORD=...
 *   POINTPLUS_E2E_ROOM_ID=... / POINTPLUS_E2E_BOOK_A=...
 *   POINTPLUS_PLAYWRIGHT_CORE=/absolute/path/to/playwright-core/index.mjs
 *   POINTPLUS_CHROMIUM=/path/to/chromium (optional)
 *   POINTPLUS_E2E_ARTWORK=... (needed only when book has no available stamps)
 *
 * Owner A -> Recipient B. Creates a real stamp (if needed) and redeems one
 * on the isolated Staging database. NEVER run on Production, and do NOT
 * invoke automatically on every feature-branch commit.
 */
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'

const required=[
 'POINTPLUS_E2E_STAGING_ONLY','POINTPLUS_E2E_STAGING_APP_URL',
 'POINTPLUS_E2E_SUPABASE_URL','POINTPLUS_E2E_PUBLISHABLE_KEY',
 'POINTPLUS_E2E_A_EMAIL','POINTPLUS_E2E_A_PASSWORD',
 'POINTPLUS_E2E_B_EMAIL','POINTPLUS_E2E_B_PASSWORD',
 'POINTPLUS_E2E_ROOM_ID','POINTPLUS_E2E_BOOK_A',
 'POINTPLUS_PLAYWRIGHT_CORE',
]
const missing=required.filter(k=>!process.env[k])
assert.deepEqual(missing,[],'Isolated browser E2E requires: '+missing.join(', '))
assert.equal(process.env.POINTPLUS_E2E_STAGING_ONLY,'1')
const app=new URL(process.env.POINTPLUS_E2E_STAGING_APP_URL)
const sb=new URL(process.env.POINTPLUS_E2E_SUPABASE_URL)
assert.equal(app.protocol,'https:','Staging browser E2E requires HTTPS')
assert.equal(sb.protocol,'https:','Staging Supabase E2E requires HTTPS')
assert.notEqual(app.hostname,sb.hostname)
assert.match(sb.hostname,/^[a-z0-9-]+\.supabase\.co$/)
assert.notEqual(sb.hostname,'gczribbtkfvhpzzupqre.supabase.co',
 'PRODUCTION SUPABASE IS FORBIDDEN')
assert.doesNotMatch(app.hostname,/^(?:www\.)?pointplus(?:-nowheredev)?\.vercel\.app$/)
assert.doesNotMatch(app.hostname,/^pointplus-kktw7je7m-nowheredev\.vercel\.app$/)
assert.doesNotMatch(app.hostname,/^localhost$|^127\.0\.0\.1$/)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const room=process.env.POINTPLUS_E2E_ROOM_ID
const book=process.env.POINTPLUS_E2E_BOOK_A
assert.match(room,uuid)
assert.match(book,uuid)
const key=process.env.POINTPLUS_E2E_PUBLISHABLE_KEY
const auth=()=>createClient(sb.origin,key,{auth:{
 persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,
}})
const owner=auth(),recipient=auth()
const credsA=[process.env.POINTPLUS_E2E_A_EMAIL,process.env.POINTPLUS_E2E_A_PASSWORD]
const credsB=[process.env.POINTPLUS_E2E_B_EMAIL,process.env.POINTPLUS_E2E_B_PASSWORD]
for(const [client,[email,password]] of [[owner,credsA],[recipient,credsB]]){
 const {data,error}=await client.auth.signInWithPassword({email,password})
 assert.ifError(error);assert.ok(data.user?.id)
}
const {data:bookRow,error:bookError}=await owner.from('living_books')
 .select('id,space_id,status,owner_user_id')
 .eq('id',book).eq('space_id',room).single()
assert.ifError(bookError)
assert.equal(bookRow.status,'active')
assert.equal(bookRow.owner_user_id,(await owner.auth.getUser()).data.user.id)
const recipientIdentity=(await recipient.auth.getUser()).data.user.id
assert.notEqual(recipientIdentity,bookRow.owner_user_id)
const {data:recipientMembership,error:memberError}=await recipient.from('space_members')
 .select('user_id').eq('space_id',room).eq('user_id',recipientIdentity).single()
assert.ifError(memberError);assert.equal(recipientMembership.user_id,recipientIdentity)

const balance=async()=>{
 const {data,error}=await recipient.rpc('pointplus_get_living_stamp_balance',{p_book:book})
 assert.ifError(error);return data
}
if((await balance()).available<1){
 const art=process.env.POINTPLUS_E2E_ARTWORK
 assert.ok(art,'Pre-seed one available stamp or set POINTPLUS_E2E_ARTWORK')
 const {data:page,error:pageError}=await owner.from('living_book_pages').select('id')
  .eq('book_id',book).order('page_order',{ascending:true}).limit(1).single()
 assert.ifError(pageError)
 const {data:grant,error:giveError}=await owner.rpc('pointplus_give_living_stamp',{
  p_book:book,p_page:page.id,p_asset:art,p_note:'UX04 isolated browser test',
  p_key:crypto.randomUUID(),p_x:.4,p_y:.35,p_rotation:0,p_scale:1,
 })
 assert.ifError(giveError)
 if(grant.status==='pending'){
  const {data:review,error:reviewError}=await recipient.rpc('pointplus_review_living_stamp',{
   p_request:grant.request_id,p_approve:true,
  })
  assert.ifError(reviewError);assert.equal(review.status,'approved')
 }else assert.equal(grant.status,'approved')
}
assert.ok((await balance()).available>=1)
const pw=await import(pathToFileURL(process.env.POINTPLUS_PLAYWRIGHT_CORE))
const browser=await pw.chromium.launch({
 executablePath:process.env.POINTPLUS_CHROMIUM||undefined,
 args:['--no-sandbox'],
})
// This gate verifies the original rewards dialog in Editor mode; M02 defaults to Reader.
const deep='/s/'+room+'/stamp-books/living/'+book+'?mode=edit'
async function login(context,[email,password]){
 const page=await context.newPage()
 page.setDefaultTimeout(20000)
 await page.goto(app.origin+'/login?next='+encodeURIComponent(deep))
 await page.getByLabel('อีเมล',{exact:true}).fill(email)
 await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password)
 await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
 await page.getByRole('button',{name:/ดูยอดแสตมป์และการแลกรางวัล/}).waitFor()
 return page
}
let ctxA,ctxB
try{
 ctxA=await browser.newContext({locale:'th-TH',viewport:{width:1280,height:850}})
 ctxB=await browser.newContext({locale:'th-TH',viewport:{width:390,height:844},
  reducedMotion:'reduce'})
 const pageA=await login(ctxA,credsA)
 const pageB=await login(ctxB,credsB)
 const triggerB=pageB.getByRole('button',{name:/ดูยอดแสตมป์และการแลกรางวัล/})
 await triggerB.click()
 const dialogB=pageB.getByRole('dialog',{name:'ความทรงจำและรางวัล'})
 await dialogB.waitFor()
 assert.equal(await dialogB.getAttribute('aria-modal'),'true')
 assert.equal(await pageB.evaluate(()=>
  document.activeElement?.id==='living-reader-rewards'),true,
  'Modal must take keyboard focus on opening')
 const motion=await dialogB.evaluate(node=>getComputedStyle(node).animationName)
 assert.equal(motion,'none','Reduced-motion user must not see sheet animation')
 await pageB.keyboard.press('Escape')
 await dialogB.waitFor({state:'hidden'})
 assert.equal(await triggerB.evaluate(node=>document.activeElement===node),true,
  'Closing must restore focus to balance trigger')
 await triggerB.click()
 await dialogB.getByLabel('จำนวนแสตมป์ที่ต้องการแลก').fill('1')
 const reward='UX04 staging browser redemption '+crypto.randomUUID()
 await dialogB.getByLabel('อยากแลกเป็นอะไร?').fill(reward)
 await dialogB.getByRole('button',{name:'ส่งคำขอแลกรางวัล'}).click()
 await dialogB.getByText(/จองแสตมป์และส่งคำขอแลกรางวัลแล้ว/).waitFor()
 const {data:record,error:recordError}=await recipient.from('living_stamp_redemptions')
  .select('id,status,requested_quantity,reward_message')
  .eq('book_id',book).eq('reward_message',reward).limit(1).single()
 assert.ifError(recordError)
 assert.equal(record.status,'requested');assert.equal(record.requested_quantity,1)
 await pageA.reload()
 await pageA.getByRole('button',{name:/ดูยอดแสตมป์และการแลกรางวัล/}).click()
 const dialogA=pageA.getByRole('dialog',{name:'ความทรงจำและรางวัล'})
 await dialogA.getByText(reward,{exact:true}).waitFor()
 const pending=dialogA.locator('.living-redemption-pending-entry')
  .filter({hasText:reward})
 await pending.getByRole('button',{name:'ยืนยันให้รางวัลแล้ว',exact:true}).click()
 await pending.getByRole('button',{name:'ยืนยันมอบรางวัลแล้ว'}).click()
 await pending.getByText(/รอยืนยัน/).waitFor({state:'detached'})
 const {data:updated,error:updatedError}=await owner.from('living_stamp_redemptions')
  .select('id,status').eq('id',record.id).single()
 assert.ifError(updatedError);assert.equal(updated.status,'fulfilled')
 const {data:linked,error:linkedError}=await owner.from('living_stamp_redemption_marks')
  .select('mark_id').eq('redemption_id',record.id)
 assert.ifError(linkedError);assert.equal(linked.length,1)
 const {data:mark,error:markError}=await owner.from('living_stamp_marks')
  .select('state,redemption_id').eq('id',linked[0].mark_id).single()
 assert.ifError(markError);assert.equal(mark.state,'redeemed')
 assert.equal(mark.redemption_id,record.id)
 console.log('UX04 isolated browser E2E passed: two accounts, focus trap, reduced motion, exact redemption marks')
}finally{
 await ctxA?.close();await ctxB?.close()
 await browser.close()
}
