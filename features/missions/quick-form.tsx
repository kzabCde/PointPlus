'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { pointPlusStamps, type PointPlusMode } from '@/lib/point-plus/assets'
import { createMissionAction } from './create-actions'
import { idleMissionState } from './action-state'
import type { StampCardOption } from './catalog'

export function QuickMissionForm({ spaceId, stampCards, mode }: {
  spaceId: string; stampCards: StampCardOption[]; mode: PointPlusMode
}) {
  const [state, action, pending] = useActionState(createMissionAction, idleMissionState)
  const [selected, setSelected] = useState('')
  const stampChoices = pointPlusStamps.filter(s => s.mode === mode)
    .map(s => ({ stamp: s, card: stampCards.find(c => c.active && c.image_key === s.id) }))
    .filter((x): x is { stamp: typeof x.stamp; card: StampCardOption } => !!x.card)
  return <form action={action} className="card quick-mission-form">
    <h3>สร้างกิจกรรมแบบรวดเร็ว</h3>
    <p className="muted">ตั้งชื่อกิจกรรม เลือกความถี่ และกำหนดแต้ม ก็เริ่มใช้งานได้</p>
    <input type="hidden" name="space_id" value={spaceId} />
    <input type="hidden" name="assignment_mode" value="open" />
    <input type="hidden" name="campaign_id" value="" />
    <input type="hidden" name="max_completions" value="" />
    <input type="hidden" name="starts_at" value="" />
    <input type="hidden" name="ends_at" value="" />
    <input type="hidden" name="status" value="active" />
    <input type="hidden" name="stamps_reward" value={selected ? '1' : '0'} />

    <label htmlFor="quick-title">ชื่อกิจกรรม</label>
    <input id="quick-title" name="title" className="input" maxLength={160}
      placeholder="เช่น อ่านหนังสือด้วยกัน 15 นาที" required />
    <label htmlFor="quick-description">รายละเอียด (ไม่บังคับ)</label>
    <textarea id="quick-description" name="description" className="input" rows={2} maxLength={4000}
      placeholder="อยากให้ทำอะไรบ้าง?" />

    <div className="quick-mission-grid">
      <div className="form-field">
        <label htmlFor="quick-frequency">ทำบ่อยแค่ไหน</label>
        <select id="quick-frequency" className="input" name="frequency" defaultValue="once">
          <option value="once">ครั้งเดียว</option>
          <option value="daily">ทุกวัน</option>
          <option value="weekly">ทุกสัปดาห์</option>
          <option value="repeatable">ทำซ้ำได้</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="quick-points">แต้มเมื่อสำเร็จ</label>
        <input id="quick-points" className="input" name="points_reward" type="number"
          min={0} max={1000000} step={1} defaultValue={10} required />
      </div>
    </div>
    <div className="form-field">
      <label htmlFor="quick-stamp">หมวดแสตมป์ (ไม่บังคับ)</label>
      <select id="quick-stamp" className="input" name="stamp_card_id" value={selected}
        onChange={e => setSelected(e.target.value)}>
        <option value="">ไม่สะสมแสตมป์สำหรับกิจกรรมนี้</option>
        {stampChoices.map(({ stamp, card }) =>
          <option key={card.id} value={card.id}>{stamp.nameTh}</option>)}
      </select>
      {!stampChoices.length && <span className="form-field__hint">
        บัตรสะสมอย่างเป็นทางการยังไม่พร้อมในฐานข้อมูลนี้ จึงสามารถสร้างกิจกรรมที่ให้แต้มได้ก่อน
      </span>}
    </div>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>
      {state.message}</p>}
    <div className="hero__actions">
      <Button type="submit" disabled={pending}>{pending ? 'กำลังสร้าง…' : 'สร้างและเปิดกิจกรรม'}</Button>
      {state.missionId && <Link className="button button--secondary"
        href={'/s/'+spaceId+'/missions/'+state.missionId}>เปิดกิจกรรมที่สร้าง</Link>}
    </div>
  </form>
}
