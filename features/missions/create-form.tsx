'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MissionFields } from './mission-fields'
import { createMissionAction } from './create-actions'
import { idleMissionState } from './action-state'
import { officialMissionTemplatesV1 } from './templates.v1'
import type { PointPlusMode } from '@/lib/point-plus/assets'
import type { CampaignOption, StampCardOption } from './catalog'

export function CreateMissionForm({ spaceId, timezone, campaigns, stampCards, mode }: {
  spaceId:string; timezone:string; campaigns:CampaignOption[]; stampCards:StampCardOption[];
  mode: PointPlusMode
}) {
  const [state,action,pending] = useActionState(createMissionAction,idleMissionState)
  const [templateId,setTemplateId] = useState('')
  const [hint,setHint] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const available = officialMissionTemplatesV1.filter(t=>t.mode===mode)
  const fill = (name:string,value:string) => {
    const target=formRef.current?.elements.namedItem(name)
    if(target && 'value' in target) (target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value=value
  }
  function applyTemplate() {
    const item=available.find(t=>t.stampAssetId===templateId)
    if(!item) return
    fill('title',item.title)
    fill('description',item.description)
    fill('frequency',item.frequency)
    const card=stampCards.find(c=>c.active && c.image_key===item.stampAssetId)
    fill('stamp_card_id',card?.id??'')
    fill('stamps_reward',card?'1':'0')
    setHint(card?'ใช้เทมเพลตและเลือกบัตรสะสมของหมวดนี้ให้แล้ว':
      'ใช้เทมเพลตแล้ว แต่ยังไม่มีบัตรสะสมทางการในฐานข้อมูลนี้ กิจกรรมจะยังไม่ให้แสตมป์จนกว่าบัตรจะพร้อม')
  }
  return <form action={action} ref={formRef} className="card">
    <input type="hidden" name="space_id" value={spaceId} />
    <div className="room-template">
      <label className="form-field__label" htmlFor="mission-template">เริ่มด้วยกิจกรรมแนะนำ (ไม่บังคับ)</label>
      <select id="mission-template" className="input" value={templateId} onChange={e=>setTemplateId(e.target.value)}>
        <option value="">สร้างกิจกรรมเอง</option>
        {available.map(t=><option key={t.stampAssetId} value={t.stampAssetId}>{t.title}</option>)}
      </select>
      <Button type="button" variant="secondary" disabled={!templateId} onClick={applyTemplate}>ใช้กิจกรรมแนะนำ</Button>
      {hint && <p className="form-field__hint" role="status">{hint}</p>}
    </div>
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
