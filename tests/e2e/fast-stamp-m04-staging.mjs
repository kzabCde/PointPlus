/**
 * M04 — opt-in, authenticated two-user browser/SQL verification and timing.
 *
 * THIS WRITES TEST BOOKS, STAMPS AND REDEMPTIONS. NEVER POINT IT AT PRODUCTION.
 * Run manually ONLY after operator verifies the exact Preview deployment SHA,
 * separate Staging Supabase, two seeded Couple members and Stage Auth credentials.
 *
 * Required: POINTPLUS_E2E_STAGING_ONLY=1, POINTPLUS_E2E_PREVIEW_VERIFIED=1,
 * POINTPLUS_E2E_STAGING_APP_URL, POINTPLUS_E2E_SUPABASE_URL,
 * POINTPLUS_E2E_PUBLISHABLE_KEY, POINTPLUS_E2E_A_EMAIL/PASSWORD,
 * POINTPLUS_E2E_B_EMAIL/PASSWORD, POINTPLUS_E2E_ROOM_ID,
 * POINTPLUS_E2E_VERIFIED_COMMIT_SHA, POINTPLUS_PLAYWRIGHT_CORE.
 * Optional: POINTPLUS_CHROMIUM, POINTPLUS_E2E_METRICS_OUTPUT.
 *
 * No secrets, full URLs, user identifiers, auth traces or screenshots are
 * saved in performance JSON. Staging fixture records are intentionally kept
 * for independent audit of idempotency and redemption.
 */
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import {pathToFileURL} from 'node:url'
import {createClient} from '@supabase/supabase-js'
import {validateM04Staging} from './m04-staging-guard.mjs'
import {summarizeSamples} from '../../scripts/m04-performance-summary.mjs'

const config=validateM04Staging(process.env)
const branchCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
assert.equal(branchCommit,config.expectedCommit,
  'The verified Staging deployment SHA must equal the checked-out test commit')
const playwright=await import(pathToFileURL(process.env.POINTPLUS_PLAYWRIGHT_CORE))
const browser=await playwright.chromium.launch({
  executablePath:process.env.POINTPLUS_CHROMIUM||undefined,
  args:['--no-sandbox'],
})
const auth=()=>createClient(config.supabaseOrigin,
  process.env.POINTPLUS_E2E_PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  })
const dbA=auth(),dbB=auth()
const pair=[
  [dbA,process.env.POINTPLUS_E2E_A_EMAIL,process.env.POINTPLUS_E2E_A_PASSWORD],
  [dbB,process.env.POINTPLUS_E2E_B_EMAIL,process.env.POINTPLUS_E2E_B_PASSWORD],
]
const samples=[]
const runLabel='M04 '+crypto.randomUUID().slice(0,8)
const base='/s/'+config.room+'/stamp-books'
const requiredArt='couple-heart'
const measure=async(scenario,device,fn)=>{
  const began=performance.now()
  const result=await fn()
  samples.push({scenario,device,ms:Math.max(0,Number((performance.now()-began).toFixed(3)))})
  return result
}
async function sampleNavigation(page,device,scenario,path,ready,count=22){
  for(let i=0;i<count+3;i++){
    const began=performance.now()
    await page.goto(config.appOrigin+path,{waitUntil:'domcontentloaded'})
    await page.locator(ready).first().waitFor({state:'visible'})
    if(i>=3)samples.push({scenario,device,ms:Number((performance.now()-began).toFixed(3))})
  }
}
async function signIn(browserContext,email,password){
  const page=await browserContext.newPage()
  page.setDefaultTimeout(25000)
  await page.goto(config.appOrigin+'/login?next='+encodeURIComponent(base))
  await page.getByLabel('อีเมล',{exact:true}).fill(email)
  await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password)
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
  await page.locator('.stamp-book-library').first().waitFor()
  return page
}
async function createUI(page,device,format){
  await page.goto(config.appOrigin+base+'/new')
  await page.locator('.living-fast-creation-form').waitFor()
  if(format==='card')await page.locator('input[name="top_level_format"][value="card"]').check()
  const title=runLabel+' '+(device==='desktop'?'A':'B')+' '+format
  await page.locator('input[name="title"]').fill(title)
  if(format==='card'){
    await page.locator('input[name="target_count"]').fill('1')
    await page.locator('input[name="reward_title"]').fill('M04 Staging reward')
  }
  await measure(format==='card'?'create_card_confirmed':'create_book_confirmed',device,async()=>{
    await page.locator('.living-fast-creation-form button[type="submit"]').click()
    await page.waitForURL(url=>
      /\/stamp-books\/living\/[0-9a-f-]{36}/i.test(url.pathname),{timeout:30000})
    await page.locator('.living-reading-page').waitFor()
  })
  const id=page.url().split('/living/')[1].split(/[?/#]/)[0]
  assert.match(id,/^[0-9a-f-]{36}$/i)
  const db=device==='desktop'?dbA:dbB
  const {data,error}=await db.from('living_books')
    .select('id,title,space_id,owner_user_id,recipient_participant_id')
    .eq('id',id).eq('space_id',config.room).single()
  assert.ifError(error)
  assert.equal(data.title,title)
  return id
}
async function giveUI(page,device,bookId,card){
  await page.goto(config.appOrigin+base)
  const shelf=page.locator('.stamp-book-cover').filter({
    has:page.locator('a[href$="/living/'+bookId+'"]'),
  })
  await shelf.waitFor()
  const open=shelf.getByRole('button',{name:'ให้แสตมป์'})
  await measure('fast_stamp_sheet_ready',device,async()=>{
    await open.click()
    await page.locator('.fast-stamp-sheet').waitFor()
    await page.locator('.fast-stamp-sheet .fast-stamp-artwork').first().waitFor()
  })
  const note=runLabel+' '+device+' '+(card?'card':'book')
  await page.locator('.fast-stamp-sheet textarea').fill(note)
  if(card){
    await page.locator('.fast-stamp-slot-grid button:not([disabled])').first().click()
  }
  await measure('fast_stamp_confirmed',device,async()=>{
    await page.locator('.fast-stamp-sheet button[type="submit"]').click()
    await page.locator('.fast-stamp-receipt').first().waitFor()
  })
  const db=device==='desktop'?dbA:dbB
  const {data:reqs,error}=await db.from('living_stamp_requests')
    .select('id,status,book_id,card_slot').eq('book_id',bookId).eq('note',note)
  assert.ifError(error)
  assert.equal(reqs.length,1,'One UI stamp submission creates one request')
  assert.equal(reqs[0].status,'approved','Couple direct policy must grant immediately')
  const {data:marks,error:markError}=await db.from('living_stamp_marks')
    .select('id,request_id,state').eq('request_id',reqs[0].id)
  assert.ifError(markError);assert.equal(marks.length,1)
  return {request:reqs[0],mark:marks[0]}
}
let desk,mobile,secondDesk
try{
  for(const [client,email,password] of pair){
    const {data,error}=await client.auth.signInWithPassword({email,password})
    assert.ifError(error);assert.ok(data.user?.id)
  }
  const idA=(await dbA.auth.getUser()).data.user.id
  const idB=(await dbB.auth.getUser()).data.user.id
  assert.notEqual(idA,idB)
  for(const [db,id] of [[dbA,idA],[dbB,idB]]){
    const {data,error}=await db.from('space_members').select('user_id')
      .eq('space_id',config.room).eq('user_id',id).single()
    assert.ifError(error);assert.equal(data.user_id,id)
  }
  const {data:art,error:artError}=await dbA.from('stamp_book_artworks')
    .select('asset_id').eq('asset_id',requiredArt).single()
  assert.ifError(artError);assert.equal(art.asset_id,requiredArt)
  desk=await browser.newContext({locale:'th-TH',viewport:{width:1280,height:850}})
  mobile=await browser.newContext({locale:'th-TH',viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,reducedMotion:'reduce'})
  const pageA=await signIn(desk,pair[0][1],pair[0][2])
  const pageB=await signIn(mobile,pair[1][1],pair[1][2])
  // Two independent browser sessions; no service_role keys.
  await sampleNavigation(pageA,'desktop','shelf_ready',base,'.stamp-book-library')
  await sampleNavigation(pageB,'mobile','shelf_ready',base,'.stamp-book-library')
  await sampleNavigation(pageA,'desktop','creation_form_ready',base+'/new','.living-fast-creation-form')
  await sampleNavigation(pageB,'mobile','creation_form_ready',base+'/new','.living-fast-creation-form')
  const bookA=await createUI(pageA,'desktop','living')
  const cardB=await createUI(pageB,'mobile','card')
  for(const [db,id] of [[dbA,bookA],[dbB,cardB]]){
    const pages=await db.from('living_book_pages').select('id').eq('book_id',id)
    assert.ifError(pages.error);assert.equal(pages.data.length,1)
  }
  const giversA=await dbA.from('living_book_givers').select('user_id').eq('book_id',bookA)
  const giversB=await dbB.from('living_book_givers').select('user_id').eq('book_id',cardB)
  assert.ifError(giversA.error);assert.ifError(giversB.error)
  assert.equal(giversA.data.length,1);assert.equal(giversA.data[0].user_id,idA)
  assert.equal(giversB.data.length,1);assert.equal(giversB.data[0].user_id,idB)

  // Default page reading is independent of Editor and can be timed without mutations.
  for(const [page,device] of [[pageA,'desktop'],[pageB,'mobile']]){
    await sampleNavigation(page,device,'reader_ready',base+'/living/'+bookA,'.living-reading-paper')
    await sampleNavigation(page,device,'editor_ready',
      base+'/living/'+bookA+'?mode=edit','.living-editor-paper')
    await sampleNavigation(page,device,'card_ready',base+'/living/'+cardB,'.living-reading-card')
  }
  // Recipient sees read-only card but no giver button on the owner-only card.
  await pageA.goto(config.appOrigin+base)
  const cardInA=pageA.locator('.stamp-book-cover').filter({
    has:pageA.locator('a[href$="/living/'+cardB+'"]'),
  })
  assert.equal(await cardInA.getByRole('button',{name:'ให้แสตมป์'}).count(),0)
  await pageB.goto(config.appOrigin+base)
  const bookInB=pageB.locator('.stamp-book-cover').filter({
    has:pageB.locator('a[href$="/living/'+bookA+'"]'),
  })
  assert.equal(await bookInB.getByRole('button',{name:'ให้แสตมป์'}).count(),0)

  // An unauthorized partner cannot mint on the other person's book.
  const firstPage=await dbA.from('living_book_pages').select('id')
    .eq('book_id',bookA).order('page_order').limit(1).single()
  assert.ifError(firstPage.error)
  const unauthorized=await dbB.rpc('pointplus_give_living_stamp',{
    p_book:bookA,p_page:firstPage.data.id,p_asset:requiredArt,
    p_note:runLabel+' denied',p_key:crypto.randomUUID(),
    p_x:.55,p_y:.55,p_rotation:0,p_scale:.7,
  })
  assert.ok(unauthorized.error,'Wrong giver must fail closed')

  const sentA=await giveUI(pageA,'desktop',bookA,false)
  const sentB=await giveUI(pageB,'mobile',cardB,true)
  const {data:cardMarks,error:cardErr}=await dbB.from('living_stamp_marks')
    .select('id,request_id,state').eq('book_id',cardB)
  assert.ifError(cardErr);assert.equal(cardMarks.length,1)

  // Reward is a real ledger transaction; one-slot card cannot double-spend.
  const claim=await dbA.rpc('pointplus_request_living_stamp_redemption',{
    p_book:cardB,p_quantity:1,p_reward_message:runLabel+' celebrate',
    p_key:crypto.randomUUID(),
  })
  assert.ifError(claim.error);assert.equal(claim.data.status,'requested')
  const fulfill=await dbB.rpc('pointplus_fulfill_living_stamp_redemption',{
    p_redemption:claim.data.id,
  })
  assert.ifError(fulfill.error);assert.equal(fulfill.data.status,'fulfilled')
  const {data:redeemed,error:redeemError}=await dbA.from('living_stamp_marks')
    .select('id,state,redemption_id').eq('id',sentB.mark.id).single()
  assert.ifError(redeemError);assert.equal(redeemed.state,'redeemed')
  assert.equal(redeemed.redemption_id,claim.data.id)

  // Explicit original RPC idempotency check on another clean Staging book.
  const key=crypto.randomUUID()
  const grantArgs={
    p_book:bookA,p_page:firstPage.data.id,p_asset:requiredArt,
    p_note:runLabel+' RPC same key',p_key:key,
    p_x:.75,p_y:.25,p_rotation:0,p_scale:.7,
  }
  const first=await dbA.rpc('pointplus_give_living_stamp',grantArgs)
  const retry=await dbA.rpc('pointplus_give_living_stamp',grantArgs)
  assert.ifError(first.error);assert.ifError(retry.error)
  assert.equal(first.data.request_id,retry.data.request_id)
  const associated=await dbA.from('living_stamp_marks')
    .select('id').eq('request_id',first.data.request_id)
  assert.ifError(associated.error);assert.equal(associated.data.length,1)
  const mismatch=await dbA.rpc('pointplus_give_living_stamp',{
    ...grantArgs,p_note:'different input same key',
  })
  assert.ok(mismatch.error,'Same key with altered payload must fail')

  // Concurrent unique-slot guard: only one distinct request may occupy slot 1.
  const freshCard=await dbB.rpc('pointplus_create_living_card',{
    p_space:config.room,p_recipient:cardB?
      (await dbB.from('living_books').select('recipient_participant_id')
        .eq('id',cardB).single()).data.recipient_participant_id:null,
    p_title:runLabel+' race card',p_description:null,
    p_cover:requiredArt,p_approval:'direct',p_key:crypto.randomUUID(),
    p_target:1,p_reward:'M04 isolated concurrency',
  })
  assert.ifError(freshCard.error)
  const fp=await dbB.from('living_book_pages').select('id')
    .eq('book_id',freshCard.data).limit(1).single()
  assert.ifError(fp.error)
  const common={p_book:freshCard.data,p_page:fp.data.id,p_asset:requiredArt,
    p_note:runLabel+' collision',p_x:.5,p_y:.5,p_rotation:0,p_scale:.7}
  const results=await Promise.all([
    dbB.rpc('pointplus_give_living_stamp',{...common,p_key:crypto.randomUUID()}),
    dbB.rpc('pointplus_give_living_stamp',{...common,p_key:crypto.randomUUID()}),
  ])
  assert.equal(results.filter(item=>!item.error).length,1)
  const occupied=await dbB.from('living_stamp_requests').select('id')
    .eq('book_id',freshCard.data).in('status',['approved','pending'])
  assert.ifError(occupied.error);assert.equal(occupied.data.length,1)

  // Save only anonymized, numeric, real browser samples.
  const output={environment:'staging',commit:branchCommit,
    measured_at:new Date().toISOString(),
    conditions:{network:'normal',viewport:{desktop:[1280,850],mobile:[390,844]},
      warmup:3,samplesPerNavigation:22,accountCount:2,reader:'M02'},
    samples}
  const summary=summarizeSamples(output)
  if(process.env.POINTPLUS_E2E_METRICS_OUTPUT)
    writeFileSync(process.env.POINTPLUS_E2E_METRICS_OUTPUT,JSON.stringify(output,null,2)+'\n')
  console.log(JSON.stringify({result:'staging_browser_e2e_pass',
    commit:branchCommit,metrics:summary.metrics,
    verified:['two accounts','reciprocal creation','Fast Stamp book and card',
      'Reader vs Editor','authorization','same-key replay','card slot race',
      'redemption single-spend']},null,2))
} finally {
  await desk?.close();await mobile?.close();await secondDesk?.close()
  await browser.close()
}
