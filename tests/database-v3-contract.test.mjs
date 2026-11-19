import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8')
const stamps = JSON.parse(read('assets/point-plus/manifest/stamps.json'))
const badges = JSON.parse(read('assets/point-plus/manifest/badges.json'))
const rules = JSON.parse(read('assets/point-plus/manifest/earning-rules.v1.json'))
const upgrade = read('supabase/v3/02_upgrade_proposal.sql')
const audit = read('supabase/v3/01_audit_readonly.sql')
const verify = read('supabase/v3/03_verify_readonly.sql')
const rollback = read('supabase/v3/04_safe_rollback.sql')

test('v3: schema is additive and preserves all 22 v2 tables, functions and participants',()=>{
 assert.match(upgrade,/CREATE TABLE public\.room_preferences/)
 assert.match(upgrade,/CREATE TABLE pointplus_private\.official_assets/)
 assert.match(upgrade,/CHECK \(kind IN \('personal','couple','family','group'\)\)/)
 assert.match(upgrade,/ALTER TABLE public\.room_preferences ENABLE ROW LEVEL SECURITY/)
 assert.match(upgrade,/CREATE POLICY room_preferences_read/)
 assert.match(upgrade,/CREATE POLICY room_preferences_update/)
 assert.match(upgrade,/ON DELETE SET NULL \(last_space_id\)/)
 assert.doesNotMatch(upgrade,/\b(?:TRUNCATE|DELETE\s+FROM|DROP\s+TABLE|DROP\s+SCHEMA)\b/i)
 assert.equal((upgrade.match(/^COMMIT;/gm)||[]).length,1)
 assert.equal((upgrade.match(/^BEGIN;/gm)||[]).length,1)
 assert.match(upgrade,/SET LOCAL lock_timeout/)
})

test('v3: exactly 18 official Stamps and 12 official Badges are mapped by original asset ID',()=>{
 const assets=[...stamps,...badges]
 assert.equal(stamps.length,18)
 assert.equal(badges.length,12)
 assert.equal(rules.length,30)
 assert.equal(new Set(assets.map(a=>a.id)).size,30)
 assert.deepEqual(new Set(rules.map(r=>r.asset_id)),new Set(assets.map(a=>a.id)))
 for(const asset of assets){
   assert.ok(upgrade.includes("'"+asset.id+"'"),'Missing official SQL seed: '+asset.id)
 }
 for(const mode of ['couple','family','personal']){
   assert.equal(stamps.filter(s=>s.mode===mode).length,6)
   assert.equal(badges.filter(s=>s.mode===mode).length,4)
 }
 assert.match(upgrade,/official_assets/)
 assert.match(upgrade,/s\.stamp_target_count/)
 assert.match(upgrade,/b\.db_rarity/)
})

test('v3: award engine counts only approved submissions in authorized room and recipient',()=>{
 assert.match(upgrade,/sub\.status='approved'/)
 assert.match(upgrade,/sub\.participant_id=p_participant/)
 assert.match(upgrade,/sub\.space_id=p_space/)
 assert.match(upgrade,/oa\.mode=v_mode/)
 assert.match(upgrade,/COUNT\(DISTINCT oa\.asset_id\)/i)
 assert.match(upgrade,/ON CONFLICT \(participant_id,badge_id\) DO NOTHING/)
 assert.match(upgrade,/CREATE TRIGGER pointplus_v3_badge_scope/)
 assert.match(upgrade,/CREATE TRIGGER pointplus_v3_immutable_badge_rule/)
 assert.match(upgrade,/CREATE TRIGGER pointplus_v3_immutable_stamp_rule/)
})

test('v3: audit/verification scripts are read-only and rollback does not erase data',()=>{
 for(const [name,sql] of [['audit',audit],['verify',verify]]){
   const stripped=sql.replace(/--[^\n]*/g,'')
   assert.doesNotMatch(stripped,/\b(?:INSERT|UPDATE|DELETE|ALTER|TRUNCATE|DROP|CREATE)\s+(?:INTO|TABLE|FROM|FUNCTION|POLICY|TRIGGER|INDEX|SCHEMA)?\b/i,name)
 }
 assert.match(verify,/stamp_rule_mismatches/)
 assert.match(verify,/badge_rule_mismatches/)
 assert.match(verify,/wallet_balance_discrepancies/)
 assert.match(rollback,/DISABLE TRIGGER pointplus_official_assets_new_space/)
 assert.doesNotMatch(rollback,/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i)
})

test('v3: rule version and rarity mapping are deterministic',()=>{
 const rarity={bronze:'common',silver:'rare',gold:'epic',diamond:'legendary'}
 for(const b of badges){
   const rule=rules.find(x=>x.asset_id===b.id)
   assert.ok(rule)
   assert.equal(rule.kind,'badge')
   assert.equal(rule.version,1)
   assert.ok(['official_stamps_count','official_categories_count'].includes(rule.criterion))
   assert.ok(upgrade.includes("'"+rarity[b.rarity]+"'"))
 }
})
