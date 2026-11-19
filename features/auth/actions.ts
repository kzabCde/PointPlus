'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { safeNextPath, siteOrigin } from '@/lib/auth/redirects'

export type AuthState = { status: 'idle' | 'error' | 'success'; message: string }
const invalid = (message: string): AuthState => ({ status: 'error', message })
const value = (data: FormData, key: string) => {
  const item = data.get(key)
  return typeof item === 'string' ? item.trim() : ''
}
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export async function signInAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = value(form, 'email').toLowerCase()
  const password = value(form, 'password')
  if (!validEmail(email) || !password) return invalid('กรุณาตรวจสอบอีเมลและรหัสผ่าน')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return invalid('เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบข้อมูลหรือยืนยันอีเมลก่อน')
  redirect(safeNextPath(value(form, 'next')))
}

export async function signUpAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = value(form, 'email').toLowerCase()
  const password = value(form, 'password')
  if (!validEmail(email)) return invalid('กรุณากรอกอีเมลที่ถูกต้อง')
  if (password.length < 8 || password.length > 128) return invalid('รหัสผ่านต้องมี 8–128 ตัวอักษร')
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: siteOrigin() + '/auth/callback?next=/onboarding' },
  })
  if (error) return invalid('ไม่สามารถสร้างบัญชีได้ในขณะนี้ โปรดลองอีกครั้ง')
  if (data.session) redirect('/onboarding')
  return { status: 'success', message: 'หากอีเมลนี้สมัครได้ ระบบจะส่งลิงก์ยืนยันให้ กรุณาตรวจกล่องจดหมาย' }
}

export async function forgotPasswordAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = value(form, 'email').toLowerCase()
  if (!validEmail(email)) return invalid('กรุณากรอกอีเมลที่ถูกต้อง')
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteOrigin() + '/auth/callback?next=/auth/reset-password',
  })
  if (error) return invalid('ไม่สามารถส่งคำขอได้ โปรดลองอีกครั้ง')
  return { status: 'success', message: 'หากอีเมลนี้มีบัญชีอยู่ คุณจะได้รับลิงก์ตั้งรหัสผ่านใหม่' }
}

export async function updatePasswordAction(_state: AuthState, form: FormData): Promise<AuthState> {
  const password = value(form, 'password')
  const confirm = value(form, 'confirm')
  if (password.length < 8 || password.length > 128) return invalid('รหัสผ่านต้องมี 8–128 ตัวอักษร')
  if (password !== confirm) return invalid('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
  const supabase = await createClient()
  const { data: { user }, error: identityError } = await supabase.auth.getUser()
  if (identityError || !user) return invalid('ลิงก์หมดอายุหรือยังไม่ได้เข้าสู่ระบบ โปรดขอลิงก์ใหม่')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return invalid('ตั้งรหัสผ่านไม่สำเร็จ โปรดลองอีกครั้ง')
  return { status: 'success', message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
