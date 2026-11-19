'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { acceptInviteAction, type JoinState } from './actions'

const initial: JoinState = { status: 'idle', message: '' }
export function JoinForm() {
  const [token, setToken] = useState('')
  const [state, action, pending] = useActionState(acceptInviteAction, initial)
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const value = hash.get('token') ?? ''
    if (/^[a-f0-9]{64}$/i.test(value)) setToken(value)
    // Prevent copied token from living in browsing history after reading it.
    window.history.replaceState(null, '', '/join')
  }, [])
  return (
    <div className="card">
      <h1 className="page-title">เข้าร่วมพื้นที่</h1>
      <p className="muted">คำเชิญส่วนตัวสำหรับคนที่รู้จักและต้องการทำภารกิจร่วมกัน</p>
      {!token && <p role="alert">ไม่พบรหัสเชิญ กรุณาเปิดลิงก์ฉบับเต็มที่คุณได้รับ</p>}
      {token && <form action={action}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={pending}>{pending ? 'กำลังเข้าร่วม…' : 'ยอมรับคำเชิญ'}</Button>
      </form>}
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'muted'}>{state.message}</p>}
      {state.spaceId && <Link href={'/s/' + state.spaceId} className="button button--primary">เปิดพื้นที่</Link>}
      {state.status === 'login' && <Link href="/login" className="button button--secondary">เข้าสู่ระบบ</Link>}
    </div>
  )
}
