/**
 * Staging-only two-account + desktop/mobile smoke for Living V3 card Buttonless.
 * NEVER run against Point+ Production or the live Supabase project.
 *
 * Run manually only on an isolated staging app + staging Supabase seeded with
 * a fresh Couple Room, two members, one active V3 Card with empty slots.
 *
 * Required: POINTPLUS_E2E_STAGING_ONLY=1, POINTPLUS_E2E_STAGING_APP_URL,
 * POINTPLUS_E2E_SUPABASE_URL, POINTPLUS_E2E_PUBLISHABLE_KEY,
 * POINTPLUS_E2E_A_EMAIL/PASSWORD, POINTPLUS_E2E_B_EMAIL/PASSWORD,
 * POINTPLUS_E2E_ROOM_ID, POINTPLUS_E2E_CARD_ID, POINTPLUS_PLAYWRIGHT_CORE.
 *
 * Optional: POINTPLUS_CHROMIUM executable path.
 */
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'

const required=[
 'POINTPLUS_E2E_STAGING_ONLY','POINTPLUS_E2E_STAGING_APP_URL',
 'POINTPLUS_E2E_SUPABASE_URL','POINTPLUS_E2E_PUBLISHABLE_KEY',
 'POINTPLUS_E2E_A_EMAIL','POINTPLUS_E2E_A_PASSWORD',
 'POINTPLUS_E2E_B_EMAIL','POINTPLUS_E2E_B_PASSWORD',
 'POINTPLUS_E2E_ROOM_ID','POINTPLUS_E2E_CARD_ID','POINTPLUS_PLAYWRIGHT_CORE',
]
const missing=required.filter(k=>!process.env[k])
assert.deepEqual(missing,[],'Staging-only card E2E requires: '+missing.join(', '))
assert.equal(process.env.POINTPLUS_E2E_STAGING_ONLY,'1')
const app=new URL(process.env.POINTPLUS_E2E_STAGING_APP_URL)
const sb=new URL(process.env.POINTPLUS_E2E_SUPABASE_URL)
assert.equal(app.protocol,'https:')
assert.equal(sb.protocol,'https:')
assert.match(sb.hostname,/^[a-z0-9-]+\.supabase\.co$/)
assert.notEqual(sb.hostname,'gczribbtkfvhpzzupqre.supabase.co',
 'Refusing to write into the Point+ Production database')
assert.notEqual(app.hostname,'pointpluss.vercel.app')
assert.doesNotMatch(app.hostname,/^pointplus-kktw7je7m-nowheredev\.vercel\.app$/)
assert.doesNotMatch(app.hostname,/^(?:localhost|127\.0\.0\.1)$/)
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const room=process.env.POINTPLUS_E2E_ROOM_ID
const cardId=process.env.POINTPLUS_E2E_CARD_ID
assert.match(room,uuid);assert.match(cardId,uuid)

function client(){
 return createClient(sb.origin,process.env.POINTPLUS_E2E_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
 })
}
const owner=client(),recipient=client()
const credsA=[process.env.POINTPLUS_E2E_A_EMAIL,process.env.POINTPLUS_E2E_A_PASSWORD]
const credsB=[process.env.POINTPLUS_E2E_B_EMAIL,process.env.POINTPLUS_E2E_B_PASSWORD]
for(const [auth,[email,password]] of [[owner,credsA],[recipient,credsB]]){
 const {data,error}=await auth.auth.signInWithPassword({email,password})
 assert.ifError(error);assert.ok(data.user?.id)
}
const idA=(await owner.auth.getUser()).data.user.id
const idB=(await recipient.auth.getUser()).data.user.id
assert.notEqual(idA,idB)
const {data:book,error:bookError}=await owner.from('living_books')
 .select('id,space_id,status,owner_user_id').eq('id',cardId).eq('space_id',room).single()
assert.ifError(bookError)
assert.equal(book.owner_user_id,idA)
assert.equal(book.status,'active')
const {data:card,error:cardError}=await owner.from('living_book_cards')
 .select('book_id,space_id,target_count,reward_title')
 .eq('book_id',cardId).eq('space_id',room).single()
assert.ifError(cardError)
assert.ok(card.target_count>=1&&card.target_count<=100)
const {data:member,error:memberError}=await recipient.from('space_members')
 .select('user_id').eq('space_id',room).eq('user_id',idB).single()
assert.ifError(memberError);assert.equal(member.user_id,idB)
const prior=await owner.from('living_stamp_requests')
 .select('id').eq('book_id',cardId).eq('status','pending').limit(1)
assert.ifError(prior.error)
assert.equal(prior.data.length,0,
 'Use a fresh Staging Card without old pending requests for deterministic approval test')

const playwright=await import(pathToFileURL(process.env.POINTPLUS_PLAYWRIGHT_CORE))
const browser=await playwright.chromium.launch({
 executablePath:process.env.POINTPLUS_CHROMIUM||undefined,args:['--no-sandbox'],
})
const deep='/s/'+room+'/stamp-books/living/'+cardId
async function login(ctx,[email,password]){
 const page=await ctx.newPage()
 page.setDefaultTimeout(20000)
 await page.goto(app.origin+'/login?next='+encodeURIComponent(deep))
 await page.getByLabel('อีเมล',{exact:true}).fill(email)
 await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password)
 await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
 await page.locator('.living-card-sheet').waitFor()
 return page
}
let desk,mobile
try{
 desk=await browser.newContext({locale:'th-TH',viewport:{width:1280,height:850}})
 mobile=await browser.newContext({locale:'th-TH',
  viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})
 const pageA=await login(desk,credsA)
 const pageB=await login(mobile,credsB)
 assert.equal(await pageA.locator('.living-card-slot').count(),card.target_count)
 assert.equal(await pageB.locator('.living-card-slot').count(),card.target_count)
 assert.equal(await pageB.locator('.living-card-slot:not([disabled])').count(),0,
  'Recipient cannot issue a stamp as its non-giver')
 assert.equal(await pageA.locator('.living-card-art-tray').count(),0,
  'Art tray must not be visible before an empty slot is selected')

 const slot=pageA.locator('.living-card-slot[data-state="empty"]:not([disabled])').first()
 assert.ok(await slot.count()>0,'Fixture must have a free numbered slot')
 const slotLabel=await slot.getAttribute('aria-label')
 await slot.click()
 const dialog=pageA.getByRole('dialog',{name:/แสตมป์ช่อง/})
 await dialog.waitFor()
 assert.equal(await dialog.getAttribute('aria-modal'),'true')
 assert.ok(await dialog.locator('.living-card-art-choice').count()>0)
 await pageA.keyboard.press('Escape')
 await dialog.waitFor({state:'hidden'})
 await slot.click()
 await dialog.waitFor()

 const note='PointPlus staging card E2E '+crypto.randomUUID()
 await dialog.locator('.living-card-art-choice').first().click()
 await dialog.getByRole('textbox',{name:/ข้อความสั้น/}).fill(note)
 await dialog.getByRole('button',{name:'ยืนยันให้แสตมป์'}).click()
 await pageA.locator('.living-card-feedback').first().waitFor()
 const {data:reqs,error:requestError}=await owner.from('living_stamp_requests')
  .select('id,status,book_id,card_slot').eq('book_id',cardId).eq('note',note)
 assert.ifError(requestError)
 assert.equal(reqs.length,1,'A single UI submission must mint only one stamp request')
 assert.ok(reqs[0].card_slot>=1&&reqs[0].card_slot<=card.target_count)
 if(reqs[0].status==='pending'){
  await pageB.reload()
  await pageB.locator('.living-card-requests summary').click()
  await pageB.locator('.living-card-request').last()
   .getByRole('button',{name:'อนุมัติ'}).click()
 }
 const {data:approved,error:approvedError}=await owner.from('living_stamp_requests')
  .select('id,status').eq('id',reqs[0].id).single()
 assert.ifError(approvedError);assert.equal(approved.status,'approved')
 const {data:marks,error:marksError}=await owner.from('living_stamp_marks')
  .select('id,request_id,state').eq('request_id',reqs[0].id)
 assert.ifError(marksError)
 assert.equal(marks.length,1)
 assert.equal(marks[0].state,'available')
 await pageB.reload()
 await pageB.locator('.living-card-slot[data-state="available"]').first().waitFor()
 assert.equal(await pageA.locator('.living-card-sheet').count(),1)
 console.log('Staging-only V3 Card E2E passed: desktop owner, mobile recipient, touch, keyboard, one approved ledger stamp')
}finally{
 await desk?.close();await mobile?.close();await browser.close()
}
