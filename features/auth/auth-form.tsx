'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import {
  signInAction, signUpAction, forgotPasswordAction, updatePasswordAction,
  type AuthState,
} from './actions'

type Mode = 'login' | 'register' | 'forgot' | 'reset'
const heading: Record<Mode, string> = {
  login: 'ยินดีต้อนรับกลับมา',
  register: 'สร้างบัญชี PointPlus',
  forgot: 'ขอตั้งรหัสผ่านใหม่',
  reset: 'ตั้งรหัสผ่านใหม่',
}
const actions = { login: signInAction, register: signUpAction, forgot: forgotPasswordAction, reset: updatePasswordAction }
const initial: AuthState = { status: 'idle', message: '' }

export function AuthForm({ mode, next = '/rooms' }: { mode: Mode; next?: string }) {
  const [state, action, pending] = useActionState(actions[mode], initial)
  return (
    <>
      <h1 className="page-title">{heading[mode]}</h1>
      <p className="muted">พื้นที่เล็ก ๆ สำหรับเป้าหมายและความสัมพันธ์ที่สำคัญ</p>
      <form action={action} onSubmit={event => {
        const opening = event.currentTarget.elements.namedItem('opening')
        if (opening instanceof HTMLInputElement) opening.value = '1'
      }}>
        {mode === 'register' && (
          <FormField id="display_name" name="display_name" label="ชื่อที่แสดง" required maxLength={80} autoComplete="nickname" />
        )}
        {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
          <FormField id="email" name="email" type="email" label="อีเมล" autoComplete="email" required maxLength={254} />
        )}
        {mode !== 'forgot' && (
          <FormField id="password" name="password" type="password"
            label={mode === 'reset' ? 'รหัสผ่านใหม่' : 'รหัสผ่าน'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'login' ? 1 : 8} maxLength={128} required />
        )}
        {mode === 'reset' && (
          <FormField id="confirm" name="confirm" type="password" label="ยืนยันรหัสผ่านใหม่"
            autoComplete="new-password" minLength={8} maxLength={128} required />
        )}
        {mode === 'login' && <>
          <input type="hidden" name="next" value={next}/>
          <input type="hidden" name="opening" defaultValue=""/>
        </>}
        {state.message && <p className={state.status === 'error' ? 'form-field__error' : 'status status--success'} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
        {pending && mode === 'login' && <p className="muted auth-pending" role="status">กำลังตรวจสอบข้อมูลเข้าสู่ระบบ…</p>}
        <Button type="submit" disabled={pending}>{pending ? 'กำลังดำเนินการ…' :
          mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : mode === 'forgot' ? 'ส่งลิงก์' : 'บันทึกรหัสผ่าน'}</Button>
      </form>
      <div className="auth-links">
        {mode !== 'login' && <Link href="/login">เข้าสู่ระบบ</Link>}
        {mode === 'login' && <><Link href="/register">สมัครสมาชิก</Link><Link href="/forgot-password">ลืมรหัสผ่าน?</Link></>}
        {mode === 'reset' && state.status === 'success' && <Link href="/rooms">ไปยังห้องของฉัน</Link>}
      </div>
    </>
  )
}
