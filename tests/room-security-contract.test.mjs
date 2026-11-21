import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('R08: additional redemption room ownership and participant checks exist',()=>{
 const a=read('features/rewards/actions.ts')
 assert.match(a,/eq\('space_id',spaceId\)\.eq\('id',rewardId\)/)
 assert.match(a,/eq\('id',participantId\)\.is\('archived_at',null\)/)
 assert.match(a,/eq\('space_id',spaceId\)\.eq\('id',redemptionId\)/)
})
test('R08: Living Book redemption checks Room scope and never uses point wallet',()=>{
 const actions=read('features/living-books/redemption-actions.ts')
 const sql=read('supabase/stamp-book-first/19_living_stampbook_v3_m04_redemptions.sql')
 assert.match(actions,/eq\('space_id',input\.spaceId\)/)
 assert.match(actions,/pointplus_request_living_stamp_redemption/)
 assert.match(actions,/pointplus_fulfill_living_stamp_redemption/)
 assert.match(sql,/Only the receiving partner/)
 assert.match(sql,/Only the book owner may fulfill/)
 assert.doesNotMatch(actions,/point_wallets|pointplus_redeem_reward|pointplus_claim_stamp_book_reward/)
})
test('R08: performance script never prints auth cookie or saves secrets',()=>{
 const a=read('scripts/measure-room-latency.mjs')
 assert.match(a,/median_ms/)
 assert.match(a,/p95_ms/)
 assert.doesNotMatch(a,/console\.log\([^\n]*cookie/)
})
