'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { addAssignmentAction, removeAssignmentAction } from './manage-actions'
import { idleMissionState } from './action-state'
import type { Participant } from '@/features/spaces/data'

type AssignmentItem={id:string;participant_id:string;mission_id:string}
export function AssignmentControls({spaceId,missionId,participants,assignments,readonly=false}:{
  spaceId:string;missionId:string;participants:Participant[];assignments:AssignmentItem[];readonly?:boolean
}) {
  const [state,action,pending]=useActionState(addAssignmentAction,idleMissionState)
  const assigned=new Set(assignments.map(a=>a.participant_id))
  const available=participants.filter(p=>!assigned.has(p.id))
  return <section className="card">
    <h3>ผู้ได้รับมอบหมาย ({assignments.length})</h3>
    {assignments.length
      ? <ul className="assignment-list">{assignments.map(a=>{
        const person=participants.find(p=>p.id===a.participant_id)
        return <li key={a.id}><span>{person?.display_name??'ผู้เข้าร่วมที่ไม่อยู่ในรายการ'}</span>
          {!readonly && <RemoveAssignment spaceId={spaceId} missionId={missionId} participantId={a.participant_id} />}
        </li>
      })}</ul>
      : <p className="muted">ยังไม่มีผู้ได้รับมอบหมาย</p>}
    {!readonly && <form action={action}>
      <input type="hidden" name="space_id" value={spaceId} />
      <input type="hidden" name="mission_id" value={missionId} />
      <div className="form-field"><label className="form-field__label" htmlFor="assign-to">เพิ่มผู้เข้าร่วมในพื้นที่นี้</label>
        <select className="input" id="assign-to" name="participant_id" required defaultValue="">
          <option value="" disabled>เลือกผู้เข้าร่วม</option>
          {available.map(p=><option key={p.id} value={p.id}>{p.display_name} ({p.kind==='child'?'เด็ก':'ผู้ใหญ่'})</option>)}
        </select></div>
      {state.message && <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>}
      <Button disabled={pending || !available.length} type="submit">{pending?'กำลังเพิ่ม…':'เพิ่มผู้รับมอบหมาย'}</Button>
      <p className="muted">ระบบตรวจว่าผู้รับมอบหมายต้องอยู่ในพื้นที่เดียวกัน และบันทึกผ่าน RLS</p>
    </form>}
  </section>
}
function RemoveAssignment({spaceId,missionId,participantId}:{
  spaceId:string;missionId:string;participantId:string
}) {
  const [state,action,pending]=useActionState(removeAssignmentAction,idleMissionState)
  return <form action={action}>
    <input type="hidden" name="space_id" value={spaceId}/><input type="hidden" name="mission_id" value={missionId}/>
    <input type="hidden" name="participant_id" value={participantId}/>
    <label className="confirmation"><input type="checkbox" name="confirm" value="yes" required /> ยืนยัน</label>
    <Button type="submit" variant="secondary" disabled={pending}>{pending?'กำลังลบ…':'ยกเลิกมอบหมาย'}</Button>
    {state.message && <span role="status" className={state.status==='error'?'form-field__error':'muted'}>{state.message}</span>}
  </form>
}
