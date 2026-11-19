import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('R06: official catalog proposal includes 18 stamp and 12 badge IDs from source manifest',()=>{
 const stamps=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
 const badges=JSON.parse(read('assets/point-plus/manifest/badges.json'))
 const rules=JSON.parse(read('assets/point-plus/manifest/earning-rules.v1.json'))
 const ids=[...stamps,...badges].map(x=>x.id)
 assert.equal(rules.length,30)
 assert.equal(new Set(rules.map(x=>x.asset_id)).size,30)
 assert.deepEqual(rules.map(x=>x.asset_id).sort(),ids.sort())
 const sql=read('supabase/proposals/room_first_official_catalog_v1.sql')
 for(const id of ids) assert.ok(sql.includes(id),'SQL missing '+id)
 assert.match(sql,/ON CONFLICT \(participant_id,badge_id\) DO NOTHING/)
})
test('R06: versioned mission templates cover exactly the 18 official stamp asset IDs',()=>{
 const t=read('features/missions/templates.v1.ts')
 const stamps=JSON.parse(read('assets/point-plus/manifest/stamps.json'))
 for(const s of stamps) assert.ok(t.includes(s.id),s.id)
 assert.equal((t.match(/"version": 1/g)||[]).length,18)
})
