'use client'

import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createInviteAction, type InviteState } from './actions'

const initial: InviteState = { status: 'idle', message: '' }
export function InviteForm({ spaceId, isOwner }: { spaceId: string; isOwner: boolean }) {
  const [state, action, pending] = useActionState(createInviteAction, initial)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  useEffect(() => { setCopied(false); setCopyError(false) }, [state.link])\n  async function copyLink() {
    if (!state.link) return
    try {
      await navigator.clipboard.writeText(state.link)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <form action={action} className="card">
      <h2>เชิญคนสำคัญเข้าร่วมพื้นที่</h2>
      <p className="muted">ลิงก์ใช้งานได้หนึ่งครั้งและมีวันหมดอายุ โปรดแชร์เฉพาะคนที่ตั้งใจเชิญ</p>
      <input type="hidden" name="space_id" value={spaceId} />
      <div className="form-field">
        <label className="form-field__label" htmlFor="invite-role">บทบาท</label>
        <select id="invite-role" name="role" className="input" defaultValue="member">
          <option value="member">สมาชิก</option>
          {isOwner && <option value="admin">ผู้ดูแล</option>}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="invite-days">หมดอายุภายใน</label>
        <select id="invite-days" name="days" className="input" defaultValue="7">
          <option value="1">1 วัน</option><option value="3">3 วัน</option><option value="7">7 วัน</option><option value="30">30 วัน</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'กำลังสร้าง…' : 'สร้างลิงก์เชิญ'}</Button>
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      {state.link && <div className="form-field">
        <label htmlFor="invite-link" className="form-field__label">ลิงก์เชิญ (แสดงได้เพียงครั้งนี้)</label>
        <input id="invite-link" className="input" readOnly aria-label="ลิงก์เชิญ" value={state.link} onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="secondary" onClick={copyLink}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</Button>
        {copyError && <span className="form-field__hint" role="status">เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ สามารถเลือกข้อความแล้วคัดลอกเองได้</span>}
      </div>}
    </form>
  )
}
