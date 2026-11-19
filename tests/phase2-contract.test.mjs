import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const read=(file)=>readFileSync(resolve(process.cwd(),file),'utf8')
function loadModule(file, replacements) {
  const compiled=ts.transpileModule(read(file),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX},
    fileName:file,reportDiagnostics:true,
  })
  assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
  const module={exports:{}}
  const customRequire=id=>{
    if(id in replacements) return replacements[id]
    throw new Error('Unexpected dependency in unit test: '+id)
  }
  new Function('require','module','exports',compiled.outputText)(customRequire,module,module.exports)
  return module.exports
}
const uuid='00000000-0000-4000-8000-000000000001'
const other='00000000-0000-4000-8000-000000000002'
const spaceId='00000000-0000-4000-8000-000000000003'
const missionId='00000000-0000-4000-8000-000000000004'
const participantId='00000000-0000-4000-8000-000000000005'
const isUuid=s=>typeof s==='string'&& /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(s)
const windowState=m=>m.window??'available'
const data=loadModule('features/social/data.ts',{
  'next/navigation':{notFound(){throw new Error('notFound')}},
  '@/features/spaces/data':{getSpaceContext(){},getSpaceParticipants(){},canManage:r=>['owner','admin'].includes(r)},
  '@/features/missions/data':{getMissionDetail(){},windowState},
  '@/lib/auth/validation':{isUuid},
})

test('P2-M02: actor may submit for self, managed child, but not another adult',()=>{
  const own={kind:'adult',user_id:uuid,guardian_user_id:null,archived_at:null}
  const adult={...own,user_id:other}
  const child={kind:'child',user_id:null,guardian_user_id:uuid,archived_at:null}
  assert.equal(data.canSubmitFor(own,uuid,false),true)
  assert.equal(data.canSubmitFor(adult,uuid,false),false)
  assert.equal(data.canSubmitFor(adult,uuid,true),false)
  assert.equal(data.canSubmitFor(child,uuid,false),true)
  assert.equal(data.canSubmitFor({...child,guardian_user_id:other},uuid,true),true)
  assert.equal(data.canSubmitFor({...own,archived_at:'2026-11-19'},uuid,true),false)
})

test('P2-M06: local period honors Space timezone at midnight',()=>{
  const before=new Date('2026-11-19T16:59:59Z')
  const after=new Date('2026-11-19T17:00:00Z')
  assert.equal(data.localPeriodKey('daily','Asia/Bangkok',before),'2026-11-19')
  assert.equal(data.localPeriodKey('daily','Asia/Bangkok',after),'2026-11-20')
  assert.equal(data.localPeriodKey('once','Asia/Bangkok',after),'once')
  assert.equal(data.localPeriodKey('repeatable','Asia/Bangkok',after),null)
})
test('P2-M06: ISO week rollover uses ISO week-year (not calendar year)',()=>{
  assert.equal(data.localPeriodKey('weekly','UTC',new Date('2021-01-01T12:00:00Z')),'2020-W53')
  assert.equal(data.localPeriodKey('weekly','UTC',new Date('2021-01-04T12:00:00Z')),'2021-W01')
})
test('P2-M02: states distinguish pending, approved, rejected and closed',()=>{
  const base={status:'active',window:'available',frequency:'once',max_completions:null}
  const make=status=>[{status,occurrence_key:'once'}]
  assert.equal(data.missionAvailability(base,[],'UTC'),'available')
  assert.equal(data.missionAvailability(base,make('submitted'),'UTC'),'pending')
  assert.equal(data.missionAvailability(base,make('approved'),'UTC'),'approved')
  assert.equal(data.missionAvailability(base,make('rejected'),'UTC'),'available')
  assert.equal(data.missionAvailability({...base,max_completions:1},make('approved'),'UTC'),'unavailable')
  assert.equal(data.missionAvailability({...base,window:'upcoming'},[],'UTC'),'unavailable')
  assert.equal(data.missionAvailability({...base,status:'draft'},[],'UTC'),'unavailable')
})

function loadActions({actor=uuid,selected={kind:'adult',user_id:uuid,guardian_user_id:null,archived_at:null},scopeKind='couple'}={}) {
  let calls=[]
  let refreshed=[]
  const supabase={rpc:async(name,args)=>{calls.push({name,args});return {data:other,error:null}}}
  const context={user:{id:actor},member:{role:'member'},space:{kind:scopeKind},supabase}
  const actions=loadModule('features/social/actions.ts',{
    'next/cache':{revalidatePath:p=>refreshed.push(p)},
    '@/features/spaces/data':{getSpaceContext:async()=>context,canManage:r=>r==='owner'||r==='admin'},
    '@/features/missions/data':{getMissionDetail:async()=>({
      ...context,selected:{id:participantId,...selected},manager:false,mission:{id:missionId},
    })},
    './data':{canSubmitFor:data.canSubmitFor},
    '@/lib/auth/validation':{isUuid},
  })
  return {actions,calls,refreshed}
}
test('P2-M02: server action calls authoritative RPC once and refreshes views',async()=>{
  const {actions,calls,refreshed}=loadActions()
  const result=await actions.submitMissionAction({
    spaceId,missionId,participantId,idempotencyKey:'request-00001',proofText:'ทำแล้ว',
  })
  assert.equal(result.status,'success')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'pointplus_submit_mission')
  assert.equal(calls[0].args.p_participant,participantId)
  assert.equal(calls[0].args.p_idempotency_key,'request-00001')
  assert.ok(refreshed.includes('/s/'+spaceId+'/progress'))
})
test('P2-M09: cannot submit for another adult or another evidence owner',async()=>{
  const bad=loadActions({selected:{kind:'adult',user_id:other,guardian_user_id:null,archived_at:null}})
  const response=await bad.actions.submitMissionAction({
    spaceId,missionId,participantId,idempotencyKey:'request-00002',
  })
  assert.equal(response.status,'error')
  assert.equal(bad.calls.length,0)
  const own=loadActions()
  const response2=await own.actions.submitMissionAction({
    spaceId,missionId,participantId,idempotencyKey:'request-00003',proofPath:other+'/abc.jpg',
  })
  assert.equal(response2.status,'error')
  assert.equal(own.calls.length,0)
})
test('P2-M07: client notification views import only client-safe runtime helpers',()=>{
  const client=read('features/social/notification-center.tsx')
  assert.match(client,/import type \{ NotificationItem \} from '\.\/notifications'/)
  assert.match(client,/import \{ notificationDestination \} from '\.\/notification-links'/)
  assert.doesNotMatch(read('features/social/notification-links.ts'),/from ['\"]@\/lib\/auth\/session/)
  assert.doesNotMatch(read('features/social/actions.ts'),/service_role|point_wallets'\)\.update/)
})

function loadReviewActions({actor=uuid,role='member',scopeKind='couple',
  creator=uuid,kind='adult',guardian=null,status='submitted'}={}) {
  const calls=[]
  const supabase={
    from(table) {
      const row=table==='mission_submissions'
        ?{id:missionId,space_id:spaceId,participant_id:participantId,created_by:creator,status}
        :table==='participants'
          ?{id:participantId,kind,guardian_user_id:guardian}:null
      return {
        select(){return this},eq(){return this},
        async maybeSingle(){return {data:row,error:null}},
      }
    },
    async rpc(name,args){calls.push({name,args});return {data:missionId,error:null}},
  }
  const context={supabase,user:{id:actor},space:{kind:scopeKind},member:{role}}
  const actions=loadModule('features/social/actions.ts',{
    'next/cache':{revalidatePath(){}},
    '@/features/spaces/data':{getSpaceContext:async()=>context,canManage:r=>r==='owner'||r==='admin'},
    '@/features/missions/data':{getMissionDetail(){}},
    './data':{canSubmitFor:data.canSubmitFor},
    '@/lib/auth/validation':{isUuid},
  })
  const form=new FormData()
  form.set('space_id',spaceId);form.set('submission_id',missionId)
  return {actions,calls,form}
}
test('P2-M03: another shared Space adult can approve but submitter cannot self-approve',async()=>{
  const reviewer=loadReviewActions({creator:other})
  reviewer.form.set('decision','approve')
  const ok=await reviewer.actions.reviewMissionAction({status:'error',message:''},reviewer.form)
  assert.equal(ok.status,'success')
  assert.equal(reviewer.calls.length,1)
  assert.deepEqual(reviewer.calls[0],{
    name:'pointplus_review_mission',
    args:{p_submission:missionId,p_approve:true,p_note:null},
  })
  const submitter=loadReviewActions({creator:uuid})
  submitter.form.set('decision','approve')
  const denied=await submitter.actions.reviewMissionAction({status:'error',message:''},submitter.form)
  assert.equal(denied.status,'error')
  assert.equal(submitter.calls.length,0)
})
test('P2-M03: rejection requires explanation and posts exactly one review RPC',async()=>{
  const reviewer=loadReviewActions({creator:other})
  reviewer.form.set('decision','reject')
  assert.equal((await reviewer.actions.reviewMissionAction({status:'error',message:''},reviewer.form)).status,'error')
  assert.equal(reviewer.calls.length,0)
  reviewer.form.set('note','หลักฐานไม่ครบ')
  const accepted=await reviewer.actions.reviewMissionAction({status:'error',message:''},reviewer.form)
  assert.equal(accepted.status,'success')
  assert.equal(reviewer.calls.length,1)
  assert.equal(reviewer.calls[0].args.p_approve,false)
  assert.equal(reviewer.calls[0].args.p_note,'หลักฐานไม่ครบ')
})
test('P2-M09: guardian or manager can review child; unrelated adult cannot',async()=>{
  const guardian=loadReviewActions({kind:'child',guardian:uuid,creator:other})
  guardian.form.set('decision','approve')
  assert.equal((await guardian.actions.reviewMissionAction({status:'error',message:''},guardian.form)).status,'success')
  const stranger=loadReviewActions({kind:'child',guardian:other,creator:other})
  stranger.form.set('decision','approve')
  assert.equal((await stranger.actions.reviewMissionAction({status:'error',message:''},stranger.form)).status,'error')
  assert.equal(stranger.calls.length,0)
  const manager=loadReviewActions({kind:'child',guardian:other,creator:other,role:'admin'})
  manager.form.set('decision','approve')
  assert.equal((await manager.actions.reviewMissionAction({status:'error',message:''},manager.form)).status,'success')
})
