'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { MissionFields } from './mission-fields'
import { updateMissionAction } from './manage-actions'
import { idleMissionState } from './create-actions'
import type { Mission } from './data'
import type { CampaignOption, StampCardOption } from './catalog'

export function MissionEditor({mission,spaceId,timezone,campaigns,stampCards}:{
  mission:Mission;spaceId:string;timezone:string;campaigns:CampaignOption[];stampCards:StampCardOption[]
}) {
  const [state,action,pending]=useActionState(updateMissionAction,idleMissionState)
  return <form className="card" action={action}>
    <h3>แก้ไขรายละเอียดภารกิจ</h3>
    <input type="hidden" name="space_id" value={spaceId} />
    <input type="hidden" name="mission_id" value={mission.id} />
    <MissionFields mission={mission} timezone={timezone} campaigns={campaigns} stampCards={stampCards} />
    {state.message && <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>}
    <div className="hero__actions">
      <Button type="submit" disabled={pending}>{pending?'กำลังบันทึก…':'บันทึกการแก้ไข'}</Button>
      <Link className="button button--secondary" href={'/s/'+spaceId+'/missions/'+mission.id}>ดูรายละเอียด</Link>
    </div>
    <p className="muted">การแก้ไขไม่เปลี่ยน ID หรือหลักฐานการทำภารกิจเดิม ข้อมูลรางวัลที่บันทึกไปแล้วคงตาม snapshot ในฐานข้อมูล</p>
  </form>
}
