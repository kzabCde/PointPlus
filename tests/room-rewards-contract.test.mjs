import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('R07: rewards follow v2 authoritative RPCs, never update wallets client-side',()=>{
 const actions=read('features/rewards/actions.ts')
 assert.match(actions,/pointplus_redeem_reward/)
 assert.match(actions,/pointplus_cancel_redemption/)
 assert.match(actions,/pointplus_fulfill_redemption/)
 assert.doesNotMatch(actions,/\.from\('point_wallets'\)\.update/)
 assert.match(actions,/getSpaceContext\(spaceId\)/)
})
test('R07: reward creation derives owner from session, not a client-supplied user id',()=>{
 const actions=read('features/rewards/actions.ts')
 assert.match(actions,/created_by: user.id/)
 assert.match(actions,/canManage\(member.role\)/)
})
