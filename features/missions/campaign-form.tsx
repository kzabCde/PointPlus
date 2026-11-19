'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { createCampaignAction,updateCampaignAction } from './manage-actions'
import { idleMissionState } from './create-actions'
import { utcToLocal } from './validation'
import type { CampaignOption } from './catalog'

export function CampaignForm({spaceId,timezone,campaign}:{
  spaceId:string;timezone:string;campaign?:CampaignOption
}) {
  const [state,action,pending]=useActionState(campaign?updateCampaignAction:createCampaignAction,idleMissionState)
  return <form action={action} className="card">
    <h3>{campaign?'แก้ไขชุดภารกิจ':'สร้างชุดภารกิจใหม่'}</h3>
    <input type="hidden" name="space_id" value={spaceId}/>
    {campaign && <input type="hidden" name="campaign_id" value={campaign.id}/>}
    <FormField id="campaign-title" name="title" label="ชื่อชุดภารกิจ" maxLength={120} required defaultValue={campaign?.title??''}/>
    <div className="form-field"><label className="form-field__label" htmlFor="campaign-description">รายละเอียด</label>
      <textarea id="campaign-description" className="input" name="description" maxLength={4000}
        rows={3} defaultValue={campaign?.description??''}/></div>
    <div className="mission-fields-grid">
      <div className="form-field"><label className="form-field__label" htmlFor="campaign-start">เริ่มต้น (ไม่บังคับ)</label>
        <input id="campaign-start" className="input" name="starts_at" type="datetime-local"
          defaultValue={utcToLocal(campaign?.start_at??null,timezone)}/></div>
      <div className="form-field"><label className="form-field__label" htmlFor="campaign-end">สิ้นสุด (ไม่บังคับ)</label>
        <input id="campaign-end" className="input" name="ends_at" type="datetime-local"
          defaultValue={utcToLocal(campaign?.end_at??null,timezone)}/></div>
    </div>
    <p className="muted">เวลาอ้างอิงเขตเวลา {timezone}</p>
    {state.message && <p role="status" className={state.status==='error'?'form-field__error':'status status--success'}>{state.message}</p>}
    <div className="hero__actions"><Button type="submit" disabled={pending}>{pending?'กำลังบันทึก…':campaign?'บันทึกชุดภารกิจ':'สร้างชุดภารกิจ'}</Button>
      {state.missionId && <Link className="button button--secondary" href={'/s/'+spaceId+'/campaigns/'+state.missionId}>เปิดชุดภารกิจที่สร้าง</Link>}
    </div>
  </form>
}
