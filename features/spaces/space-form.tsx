'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { createSpaceAction, updateSpaceAction, type SpaceState } from './actions'
import type { Space } from './data'

const initial: SpaceState = { status: 'idle', message: '' }
const kinds = [
  { id: 'couple', title: 'คู่รัก', detail: 'ห้องสำหรับคนสองคน', emoji: '♥' },
  { id: 'family', title: 'ครอบครัว', detail: 'ผู้ปกครองและเด็ก', emoji: '⌂' },
  { id: 'group', title: 'ทั่วไป', detail: 'เพื่อนและกลุ่มส่วนตัว', emoji: '✦' },
] as const

export function CreateSpaceForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createSpaceAction, initial)
  useEffect(() => {
    if (state.status === 'success' && state.spaceId) router.push('/s/' + state.spaceId + '/members')
  }, [state.status, state.spaceId, router])
  return <form action={action} className="card room-create__form">
    <h2>สร้างห้องใหม่</h2>
    <p className="muted">เลือกความสัมพันธ์ที่ต้องการ แล้วตั้งชื่อห้องได้เลย</p>
    <fieldset className="room-kinds">
      <legend className="form-field__label">1. รูปแบบห้อง</legend>
      {kinds.map(kind => <label className="room-kind" key={kind.id}>
        <input type="radio" name="kind" value={kind.id} defaultChecked={kind.id === 'couple'} required />
        <span aria-hidden="true" className="room-kind__icon">{kind.emoji}</span>
        <span><strong>{kind.title}</strong><small>{kind.detail}</small></span>
      </label>)}
    </fieldset>
    <FormField id="room-name" name="name" label="2. ตั้งชื่อห้อง" maxLength={100} required placeholder="เช่น Our Little World" />
    <p className="form-field__hint">เขตเวลาจะอิงจากโปรไฟล์ของคุณ เปลี่ยนได้ภายหลังในตั้งค่าห้อง</p>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
    <Button type="submit" disabled={pending}>{pending ? 'กำลังสร้างห้อง…' : 'สร้างห้องและเชิญสมาชิก'}</Button>
  </form>
}

export function EditSpaceForm({ space }: { space: Space }) {
  const [state, action, pending] = useActionState(updateSpaceAction, initial)
  return <form action={action} className="card stationery-form">
    <input type="hidden" name="space_id" value={space.id} />
    <FormField id="edit-space-name" name="name" label="ชื่อห้อง" required maxLength={100} defaultValue={space.name} />
    <div className="form-field"><label className="form-field__label" htmlFor="edit-space-timezone">เขตเวลา</label>
      <input id="edit-space-timezone" className="input" name="timezone" required maxLength={80} defaultValue={space.timezone} />
      <span className="form-field__hint">ตัวอย่าง: Asia/Bangkok</span>
    </div>
    {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
    <Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}</Button>
  </form>
}
