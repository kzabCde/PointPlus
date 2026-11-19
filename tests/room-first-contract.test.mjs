import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const read = p => readFileSync(new URL('../' + p,import.meta.url),'utf8')
test('R01: staged non-destructive group proposal keeps personal and separate migration',()=>{
 const sql=read('supabase/proposals/room_first_group_kind.sql')
 assert.match(sql,/personal','couple','family','group/)
 assert.doesNotMatch(sql,/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i)
})
test('R02: lightweight room launcher replaces old all-space dashboard',()=>{
 assert.match(read('app/(protected)/dashboard/page.tsx'),/redirect\('\/rooms'\)/)
 assert.match(read('app/(protected)/rooms/page.tsx'),/listMyRooms\(\)/)
 assert.doesNotMatch(read('app/(protected)/rooms/page.tsx'),/loadDashboard|loadMissionBoard/)
})
test('R03: Room Home renders only room-local missions and protects membership',()=>{
 const page=read('app/(protected)/s/[spaceId]/page.tsx')
 assert.match(page,/getSpaceContext\(spaceId\)/)
 assert.match(page,/loadMissionBoard\(spaceId/)
 assert.ok(existsSync(new URL('../app/(protected)/s/[spaceId]/collection/page.tsx',import.meta.url)))
})
test('R06: use official 18 stamp and 12 badge assets and only DB-backed earned state',()=>{
 const lib=read('lib/point-plus/assets.ts')
 assert.equal((lib.match(/"id": "(?:couple|family|personal)-/g)||[]).length,30)
 const col=read('app/(protected)/s/[spaceId]/collection/page.tsx')
 assert.match(col,/\.from\('participant_badges'\)/)
 assert.match(col,/\.from\('stamp_cycles'\)/)
 assert.match(col,/space.kind === 'couple' \? 'couple'/)
 assert.match(col,/space.kind === 'family' \? 'family' : 'personal'/)
})
