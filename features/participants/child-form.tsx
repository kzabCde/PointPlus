'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { createChildAction, type ChildState } from './actions'

const initial: ChildState = { status:'idle', message:'' }
export function ChildForm({ spaceId }: { spaceId: string }) {
  const [state, action, pending] = useActionState(createChildAction, initial)
  return (
    <form action={action} className="card">
      <h3>เพิ่มเด็กในครอบครัว</h3>
      <p className="muted">โปรไฟล์เด็กอยู่ภายใต้การดูแลของผู้ใหญ่ ไม่ต้องสร้างบัญชีเข้าสู่ระบบแยก</p>
      <input type="hidden" name="space_id" value={spaceId} />
      <FormField id="child-name" name="display_name" label="ชื่อที่แสดงของเด็ก" maxLength={80} required />
      <FormField id="child-year" name="birth_year" label="ปีเกิด (ค.ศ., ไม่บังคับ)"
        type="number" min={1900} max={new Date().getFullYear()} />
      <div className="form-field">
        <label htmlFor="child-note" className="form-field__label">หมายเหตุสำหรับผู้ปกครอง (ไม่บังคับ)</label>
        <textarea id="child-note" className="input" name="note" maxLength={500} rows={3} />
      </div>
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'กำลังเพิ่ม…' : 'เพิ่มโปรไฟล์เด็ก'}</Button>
    </form>
  )
}
