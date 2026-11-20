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
test('R08: new Stamp Book claim is Room scoped and never uses old point wallet',()=>{
 const a=read('features/stamp-books/actions.ts')
 assert.match(a,/pointplus_claim_stamp_book_reward/)
 assert.match(a,/eq\('book_id',bookId\)\.eq\('space_id',spaceId\)/)
 assert.doesNotMatch(a,/point_wallets|pointplus_redeem_reward/)
})
test('R08: performance script never prints auth cookie or saves secrets',()=>{
 const a=read('scripts/measure-room-latency.mjs')
 assert.match(a,/median_ms/)
 assert.match(a,/p95_ms/)
 assert.doesNotMatch(a,/console\.log\([^\n]*cookie/)
})
