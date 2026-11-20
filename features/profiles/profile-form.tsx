'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import type { Profile } from './data'
import { saveProfileAction, type ProfileState } from './actions'

const initial: ProfileState = { status: 'idle', message: '' }
export function ProfileForm({ profile, onboarding = false }: { profile: Profile; onboarding?: boolean }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial)
  return (
    <form action={action} className="card stationery-form">
      <FormField id="display_name" name="display_name" label="ชื่อที่แสดง" maxLength={80}
        required defaultValue={profile.display_name === 'Member' ? '' : profile.display_name} />
      <div className="form-field">
        <label htmlFor="locale" className="form-field__label">ภาษา</label>
        <select className="input" id="locale" name="locale" defaultValue={profile.locale}>
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="timezone" className="form-field__label">เขตเวลา</label>
        <select className="input" id="timezone" name="timezone" defaultValue={profile.timezone}>
          <option value="Asia/Bangkok">Asia/Bangkok</option>
          <option value="Asia/Tokyo">Asia/Tokyo</option>
          <option value="Europe/London">Europe/London</option>
          <option value="Europe/Paris">Europe/Paris</option>
          <option value="America/New_York">America/New_York</option>
        </select>
      </div>
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      <div className="hero__actions">
        <Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}</Button>
        {onboarding && state.status === 'success' && <Link href="/rooms" className="button button--secondary">ไปยังห้องของฉัน</Link>}
      </div>
    </form>
  )
}
