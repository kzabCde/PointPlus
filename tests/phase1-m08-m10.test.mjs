import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync, existsSync } from 'node:fs'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const exists = path => existsSync(new URL('../'+path,import.meta.url))
async function loadValidation() {
  const js = ts.transpileModule(read('features/missions/validation.ts'),{
    compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022},
  }).outputText
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
}
const uuid = 'e3c2a1b0-1234-4123-8123-abcabcabcabc'
function form(changes={}) {
  const f = new FormData()
  const values={title:'ร่วมกันออกกำลังกาย',description:'ทำกิจกรรมร่วมกัน',
    frequency:'once',assignment_mode:'open',points_reward:'10',stamps_reward:'0',
    stamp_card_id:'',campaign_id:'',max_completions:'',starts_at:'',ends_at:'',...changes}
  for(const [key,value] of Object.entries(values)) f.set(key,value)
  return f
}
test('M08 supports all four v2 mission frequencies',async()=>{
  const {parseMissionForm} = await loadValidation()
  for(const frequency of ['once','daily','weekly','repeatable']) {
    const result = parseMissionForm(form({frequency}),'Asia/Bangkok')
    assert.equal(result.error,undefined,JSON.stringify(result))
    assert.equal(result.value.frequency,frequency)
    assert.equal(result.value.verification_mode,'approval')
  }
})
test('M08 rejects invalid rewards, stamp combinations and limits',async()=>{
  const {parseMissionForm} = await loadValidation()
  const cases=[
    {title:''},{title:'a'.repeat(161)},{points_reward:'-1'},
    {points_reward:'1000001'},{points_reward:'1.1'},
    {stamps_reward:'101'},{stamps_reward:'1',stamp_card_id:''},
    {stamps_reward:'0',stamp_card_id:uuid},
    {campaign_id:'another-space'},
    {max_completions:'-1'},{frequency:'monthly'},{assignment_mode:'anyone'},
  ]
  for(const c of cases) assert.ok(parseMissionForm(form(c),'Asia/Bangkok').error,JSON.stringify(c))
})
test('M08/M09 preserve Space wall time and reject impossible DST transitions',async()=>{
  const {parseMissionForm,localToUtc,utcToLocal} = await loadValidation()
  assert.equal(localToUtc('2026-11-19T18:30','Asia/Bangkok'),'2026-11-19T11:30:00.000Z')
  assert.equal(utcToLocal('2026-11-19T11:30:00.000Z','Asia/Bangkok'),'2026-11-19T18:30')
  assert.equal(localToUtc('2026-03-08T02:30','America/New_York'),null)
  assert.equal(localToUtc('2026-11-01T01:30','America/New_York'),null)
  assert.ok(parseMissionForm(form({starts_at:'2026-11-19T19:00',ends_at:'2026-11-19T18:00'}),'Asia/Bangkok').error)
})
test('M09 management respects Space scope, assignments and history',()=>{
  const actions=read('features/missions/manage-actions.ts')
  assert.ok(actions.includes('getManagedMission(spaceId,missionId)'))
  assert.ok(actions.includes(".eq('space_id',spaceId)"))
  assert.ok(actions.includes('getSpaceParticipants(spaceId)'))
  assert.ok(actions.includes('mission_assignments'))
  assert.ok(actions.includes("mission.status === 'draft'"))
  assert.ok(actions.includes("mission.status === 'active'"))
  assert.ok(!actions.includes(".from('missions').delete("))
  assert.ok(exists('app/(protected)/s/[spaceId]/campaigns/page.tsx'))
  assert.ok(exists('app/(protected)/s/[spaceId]/missions/[missionId]/manage/page.tsx'))
})
test('M10 reads authorized dashboard records without fake wallets',()=>{
  const dashboard=read('features/dashboard/data.ts')
  assert.ok(dashboard.includes('loadMissionBoard'))
  assert.ok(dashboard.includes('point_wallets'))
  assert.ok(dashboard.includes('getSpaceMembers'))
  assert.ok(!dashboard.includes('Math.random'))
  assert.ok(!dashboard.includes('sampleMissions'))
  assert.ok(exists('docs/PHASE1_M08_M10.md'))
})

test('server action files never export non-function runtime constants',()=>{
  const files=[
    'features/auth/actions.ts','features/profiles/actions.ts',
    'features/spaces/actions.ts','features/participants/actions.ts',
    'features/invitations/actions.ts','features/missions/create-actions.ts',
    'features/missions/manage-actions.ts',
  ]
  for(const file of files){
    const source=read(file)
    assert.ok(source.startsWith("'use server'"),file)
    assert.doesNotMatch(source,/^export\s+(?:const|let|var|class)\s+/m,file)
  }
  assert.ok(exists('features/missions/action-state.ts'))
  assert.ok(exists('app/(protected)/activities/new/page.tsx'))
})
