import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { safeNextPath } from '@/lib/auth/redirects'
import { AuthForm } from '@/features/auth/auth-form'

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' }

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const safeNext = safeNextPath(next)
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims?.sub) redirect(safeNext)
  return (
    <>
      {error === 'confirmation' && <p role="alert" className="form-field__error">ยืนยันตัวตนไม่สำเร็จหรือลิงก์หมดอายุ โปรดลองอีกครั้ง</p>}
      <AuthForm mode="login" next={safeNext} />
    </>
  )
}
