'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { changeMissionStatusAction } from './manage-actions'
import { idleMissionState } from './create-actions'
import type { Mission } from './data'

export function StatusControls({mission,spaceId}: {mission:Mission;spaceId:string}) {
  const [state,action,pending]=useActionState(changeMissionStatusAction,idleMissionState)
  if (mission.status === 'archived') return <div className="card"><h3>เก็บถาวรแล้ว</h3>
    <p className="muted">ภารกิจถูกเก็บถาวร ประวัติและการมอบหมายเดิมยังอยู่ในฐานข้อมูล</p></div>
  const activating=mission.status==='draft'
  return <form action={action} className="card">
    <h3>{activating?'ตรวจสอบก่อนเปิดใช้งาน':'เก็บภารกิจเข้าคลัง'}</h3>
    {activating
      ? <div className="muted"><p>ชื่อ: <strong>{mission.title}</strong></p>
          <p>ความถี่: {mission.frequency} · การมอบหมาย: {mission.assignment_mode}</p>
          <p>แต้ม: {mission.points_reward} · แสตมป์: {mission.stamps_reward}</p>
          <p>หากเป็นภารกิจมอบหมาย ต้องเพิ่มผู้เข้าร่วมก่อนเปิดใช้งาน</p></div>
      : <p className="muted">การเก็บถาวรจะหยุดแสดงภารกิจเป็นรายการที่ทำได้ โดยไม่ลบข้อมูลหรือประวัติ</p>}
    <input type="hidden" name="space_id" value={spaceId} />
    <input type="hidden" name="mission_id" value={mission.id} />
    <input type="hidden" name="target" value={activating?'active':'archived'} />
    <label className="confirmation"><input type="checkbox" name="confirm" value="yes" required />
      {activating?'ฉันตรวจสอบรายละเอียดและการมอบหมายก่อนเปิดใช้งานแล้ว':'ฉันยืนยันการเก็บภารกิจเข้าคลัง'}</label>
    {state.message && <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>}
    <Button type="submit" variant={activating?'primary':'secondary'} disabled={pending}>
      {pending?'กำลังดำเนินการ…':activating?'เปิดใช้งานภารกิจ':'เก็บถาวร'}
    </Button>
  </form>
}
