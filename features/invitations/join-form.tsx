'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { acceptInviteAction, type JoinState } from './actions'

const initial: JoinState = { status: 'idle', message: '' }
export function JoinForm() {
  const [token, setToken] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [state, action, pending] = useActionState(acceptInviteAction, initial)
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const value = hash.get('token') ?? ''
    if (/^[a-f0-9]{64}$/i.test(value)) setToken(value)
    // Prevent copied token from living in browsing history after reading it.
    window.history.replaceState(null, '', '/join')
  }, [])
  return (
    <div className="card stationery-form">
      <h1 className="page-title">เข้าร่วมพื้นที่</h1>
      <p className="muted">ลิงก์เชิญส่วนตัวใช้ได้ครั้งเดียว</p>
      <form action={action}>
        {token ? <input type="hidden" name="token" value={token}/> :
          <div className="form-field">
            <label htmlFor="invite-token" className="form-field__label">วางลิงก์หรือรหัสคำเชิญ</label>
            <input id="invite-token" className="input" type="password" name="token" autoComplete="off"
              required pattern="[a-fA-F0-9]{64}" value={manualToken} onChange={event => {
                const value = event.target.value.trim()
                try {
                  const url = new URL(value)
                  const code = new URLSearchParams(url.hash.slice(1)).get('token') ?? ''
                  setManualToken(/^[a-f0-9]{64}$/i.test(code) ? code : value)
                } catch {
                  setManualToken(value)
                }
              }} aria-describedby="invite-token-hint"/>
            <span id="invite-token-hint" className="form-field__hint">ใช้ลิงก์ฉบับเต็มที่ได้รับ หรือรหัสคำเชิญ 64 ตัวอักษร</span>
          </div>}
        <Button type="submit" disabled={pending || state.status === 'success'}>{pending ? 'กำลังเข้าร่วม…' : 'ยอมรับคำเชิญ'}</Button>
      </form>
      {state.message && <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'form-field__error' : 'muted'}>{state.message}</p>}
      {state.spaceId && <Link href={'/s/' + state.spaceId} className="button button--primary">เปิดพื้นที่</Link>}
      {state.status === 'login' && <Link href="/login" className="button button--secondary">เข้าสู่ระบบ</Link>}
    </div>
  )
}
