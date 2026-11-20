import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/features/auth/auth-form'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'สมัครสมาชิก' }

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims?.sub) redirect('/rooms')
  return <AuthForm mode="register"/>
}
