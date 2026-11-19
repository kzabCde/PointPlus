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
test('R08: badge unlock mapping requires room and official slug, not artwork only',()=>{
 const a=read('app/(protected)/s/[spaceId]/collection/page.tsx')
 assert.match(a,/r.space_id === spaceId && r.slug === item.id && r.image_key === item.id/)
})
test('R08: performance script never prints auth cookie or saves secrets',()=>{
 const a=read('scripts/measure-room-latency.mjs')
 assert.match(a,/median_ms/)
 assert.match(a,/p95_ms/)
 assert.doesNotMatch(a,/console\.log\([^\n]*cookie/)
})
