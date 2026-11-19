'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { createSpaceAction, updateSpaceAction, type SpaceState } from './actions'
import type { Space } from './data'

const initial: SpaceState = { status: 'idle', message: '' }
export function CreateSpaceForm() {
  const [state, action, pending] = useActionState(createSpaceAction, initial)
  return (
    <form action={action} className="card">
      <h2>สร้างพื้นที่ใหม่</h2>
      <div className="form-field">
        <label htmlFor="kind" className="form-field__label">รูปแบบความสัมพันธ์</label>
        <select id="kind" className="input" name="kind" required>
          <option value="couple">คนรัก (สมาชิกสูงสุด 2 คน)</option>
          <option value="family">ครอบครัว</option>
        </select>
      </div>
      <FormField id="space-name" name="name" label="ชื่อพื้นที่" maxLength={100} required placeholder="เช่น ครอบครัวของเรา" />
      <div className="form-field">
        <label className="form-field__label" htmlFor="space-timezone">เขตเวลา</label>
        <select id="space-timezone" className="input" name="timezone" defaultValue="Asia/Bangkok">
          <option value="Asia/Bangkok">Asia/Bangkok</option><option value="Asia/Tokyo">Asia/Tokyo</option>
          <option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option>
        </select>
      </div>
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      <div className="hero__actions">
        <Button type="submit" disabled={pending}>{pending ? 'กำลังสร้าง…' : 'สร้างพื้นที่'}</Button>
        {state.spaceId && <Link className="button button--secondary" href={'/s/' + state.spaceId}>เปิดพื้นที่ที่สร้าง</Link>}
      </div>
    </form>
  )
}

export function EditSpaceForm({ space }: { space: Space }) {
  const [state, action, pending] = useActionState(updateSpaceAction, initial)
  return (
    <form action={action} className="card">
      <input type="hidden" name="space_id" value={space.id} />
      <FormField id="edit-space-name" name="name" label="ชื่อพื้นที่" required maxLength={100} defaultValue={space.name} />
      <div className="form-field">
        <label className="form-field__label" htmlFor="edit-space-timezone">เขตเวลา</label>
        <input id="edit-space-timezone" className="input" name="timezone" required maxLength={80} defaultValue={space.timezone} />
        <span className="form-field__hint">ตัวอย่าง: Asia/Bangkok</span>
      </div>
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}</Button>
    </form>
  )
}
