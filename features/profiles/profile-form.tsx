'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import type { Profile } from './data'
import { saveProfileAction, type ProfileState } from './actions'

const initial: ProfileState = { status: 'idle', message: '' }
export function ProfileForm({ profile, onboarding = false }: { profile: Profile; onboarding?: boolean }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial)
  const router = useRouter()
  useEffect(() => { if (onboarding && state.status === 'success') router.push('/rooms') }, [onboarding, router, state.status])
  return (
    <form action={action} className="card stationery-form">
      <FormField id="display_name" name="display_name" label="ชื่อที่แสดง" maxLength={80}
        required defaultValue={profile.display_name === 'Member' ? '' : profile.display_name} />
      <input type="hidden" name="locale" value={profile.locale} />
      {state.message && <p role="status" className={state.status === 'error' ? 'form-field__error' : 'status status--success'}>{state.message}</p>}
      <div className="hero__actions">
        <Button type="submit" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'}</Button>
        {onboarding && <Link href="/rooms" className="button button--secondary">ข้ามไปสร้างห้อง</Link>}
      </div>
    </form>
  )
}
