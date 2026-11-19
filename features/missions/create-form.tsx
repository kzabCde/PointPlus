'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { MissionFields } from './mission-fields'
import { createMissionAction, idleMissionState } from './create-actions'
import type { CampaignOption, StampCardOption } from './catalog'

export function CreateMissionForm({ spaceId, timezone, campaigns, stampCards }: {
  spaceId:string; timezone:string; campaigns:CampaignOption[]; stampCards:StampCardOption[]
}) {
  const [state,action,pending] = useActionState(createMissionAction,idleMissionState)
  return <form action={action} className="card">
    <input type="hidden" name="space_id" value={spaceId} />
    <MissionFields timezone={timezone} campaigns={campaigns} stampCards={stampCards} creating />
    {state.message && <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>}
    <div className="hero__actions">
      <Button type="submit" disabled={pending}>{pending?'กำลังสร้าง…':'สร้างภารกิจ'}</Button>
      <Link href={'/s/'+spaceId+'/missions'} className="button button--secondary">กลับไปหน้าภารกิจ</Link>
      {state.missionId && <Link className="button button--secondary"
        href={'/s/'+spaceId+'/missions/'+state.missionId}>ดูภารกิจที่สร้าง</Link>}
    </div>
  </form>
}
